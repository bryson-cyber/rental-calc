/**
 * Doola Partner API client — the direct-fulfillment provider.
 *
 * Contract (docs.doola.com, /v1/partner, verified 2026-07-24):
 *  - Auth: raw `dk_test_…` / `dk_live_…` key as the Authorization header.
 *  - Idempotency-Key required on creates; envelope { payload, error{code} }.
 *  - Flow: create customer → create company (CHARGED AT SUBMISSION) →
 *    webhooks/polling → documents (per-document short-lived download URLs)
 *    → `ein` returned as data once the IRS issues it.
 *
 * White-label rule: nothing from this module may reach a client payload —
 * "doola" is as forbidden client-side as "whop" (serialization tests scan
 * for both).
 */
import { randomUUID } from "node:crypto";
import type { llcFounders, llcRegistrations } from "../../drizzle/schema";
import { decryptPii } from "./pii";

type LlcRegistrationRecord = typeof llcRegistrations.$inferSelect;
type LlcFounderRecord = typeof llcFounders.$inferSelect;
import { LLC_ACTIVITY_PRESETS } from "../../shared/llc";
import type { WhopFormationSnapshot } from "./whop";

export const DEFAULT_DOOLA_API_BASE_URL = "https://api.doola.com";
export const DOOLA_SANDBOX_API_BASE_URL = "https://api.test.doola.com";
const DOOLA_KEY_PATTERN = /^dk_(test|live)_[A-Za-z0-9_-]{10,}$/;
const REQUEST_TIMEOUT_MS = 30_000;

export class DoolaConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DoolaConfigurationError";
  }
}

export class DoolaApiError extends Error {
  readonly httpStatus: number | null;
  readonly code: string | null;
  readonly retryable: boolean;

  constructor(params: {
    message: string;
    httpStatus: number | null;
    code: string | null;
    retryable: boolean;
  }) {
    super(params.message);
    this.name = "DoolaApiError";
    this.httpStatus = params.httpStatus;
    this.code = params.code;
    this.retryable = params.retryable;
  }
}

export interface DoolaConfig {
  apiKey: string;
  baseUrl: string;
}

/**
 * Returns true when LLC_TEST_MODE is explicitly "true". This toggles all
 * provider credentials (Doola + Stripe) to their sandbox/test counterparts
 * without overwriting the live values.
 */
export function isLlcTestMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LLC_TEST_MODE === "true";
}

export function getDoolaConfig(env: NodeJS.ProcessEnv = process.env): DoolaConfig {
  const testMode = isLlcTestMode(env);

  // In test mode, read from DOOLA_TEST_API_KEY; in live mode, read DOOLA_API_KEY.
  const apiKey = testMode
    ? env.DOOLA_TEST_API_KEY?.trim()
    : env.DOOLA_API_KEY?.trim();

  if (!apiKey || !DOOLA_KEY_PATTERN.test(apiKey)) {
    const varName = testMode ? "DOOLA_TEST_API_KEY" : "DOOLA_API_KEY";
    throw new DoolaConfigurationError(
      `${varName} is missing or invalid. Configure the partner API key (dk_live_… or dk_test_…).`,
    );
  }

  // In test mode, auto-derive sandbox URL from the test key prefix;
  // in live mode, use DOOLA_API_BASE_URL (defaulting to production).
  let rawBaseUrl: string;
  if (testMode) {
    // Test mode always uses sandbox URL regardless of DOOLA_API_BASE_URL
    rawBaseUrl = DOOLA_SANDBOX_API_BASE_URL;
  } else {
    rawBaseUrl = (env.DOOLA_API_BASE_URL ?? DEFAULT_DOOLA_API_BASE_URL).trim().replace(/\/+$/, "");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawBaseUrl);
  } catch {
    throw new DoolaConfigurationError("DOOLA_API_BASE_URL must be a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new DoolaConfigurationError("DOOLA_API_BASE_URL must use HTTPS.");
  }
  if (![new URL(DEFAULT_DOOLA_API_BASE_URL).host, new URL(DOOLA_SANDBOX_API_BASE_URL).host].includes(parsed.host)) {
    throw new DoolaConfigurationError(
      "DOOLA_API_BASE_URL must point at the Doola production or sandbox API.",
    );
  }
  // Key and host must belong to the SAME environment.
  const liveKey = apiKey.startsWith("dk_live_");
  const productionHost = parsed.host === new URL(DEFAULT_DOOLA_API_BASE_URL).host;
  if (liveKey !== productionHost) {
    throw new DoolaConfigurationError(
      "DOOLA_API_KEY and DOOLA_API_BASE_URL point at different environments (dk_live_ pairs with api.doola.com, dk_test_ with api.test.doola.com).",
    );
  }
  return { apiKey, baseUrl: rawBaseUrl };
}

export type DoolaEnvironment = "production" | "sandbox";

/**
 * The environment the current configuration targets. Rows are stamped with
 * this at filing time so an env flip can never re-fire them at the other
 * environment. Throws DoolaConfigurationError when unconfigured/mismatched.
 */
export function getDoolaEnvironment(env: NodeJS.ProcessEnv = process.env): DoolaEnvironment {
  const config = getDoolaConfig(env);
  return new URL(config.baseUrl).host === new URL(DEFAULT_DOOLA_API_BASE_URL).host
    ? "production"
    : "sandbox";
}

export function getDoolaWebhookSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const testMode = isLlcTestMode(env);
  const secret = testMode
    ? env.DOOLA_TEST_WEBHOOK_SECRET?.trim()
    : env.DOOLA_WEBHOOK_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

/** Retryable = transient transport/5xx/429; everything else needs review. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function doolaRequest<T>(params: {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}): Promise<{ payload: T; httpStatus: number }> {
  const config = getDoolaConfig();
  const headers: Record<string, string> = {
    Authorization: config.apiKey,
    Accept: "application/json",
  };
  if (params.body !== undefined) headers["Content-Type"] = "application/json";
  if (params.idempotencyKey) {
    headers["Idempotency-Key"] = params.idempotencyKey.slice(0, 255);
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${params.path}`, {
      method: params.method,
      headers,
      body: params.body === undefined ? undefined : JSON.stringify(params.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new DoolaApiError({
      message: "The filing service could not be reached.",
      httpStatus: null,
      code: error instanceof Error && error.name === "TimeoutError" ? "E_TIMEOUT" : "E_NETWORK",
      retryable: true,
    });
  }

  let envelope: { payload?: unknown; error?: { code?: unknown; message?: unknown } } = {};
  try {
    envelope = (await response.json()) as typeof envelope;
  } catch {
    // Non-JSON body; fall through to status-based handling.
  }

  if (!response.ok || envelope.error) {
    const code = typeof envelope.error?.code === "string" ? envelope.error.code : null;
    // Provider text stays server-side (ops logs); never client-facing.
    const fieldErrors =
      envelope.error && typeof envelope.error === "object" && "fields" in envelope.error
        ? Object.entries((envelope.error as { fields?: Record<string, { code?: string }> }).fields ?? {}).map(
            ([field, detail]) => `${field}:${detail?.code ?? "?"}`,
          )
        : [];
    console.error("[Doola] API request failed", {
      method: params.method,
      path: params.path.replace(/\/dc_[A-Za-z0-9]+/g, "/dc_[redacted]"),
      httpStatus: response.status,
      code,
      fieldErrors,
    });
    throw new DoolaApiError({
      message: "The filing service reported an error.",
      httpStatus: response.status,
      code,
      retryable: isRetryableStatus(response.status),
    });
  }

  return { payload: (envelope.payload ?? envelope) as T, httpStatus: response.status };
}

// ─── ISO country mapping (registration stores alpha-2; Doola wants alpha-3) ──

const ISO2_TO_ISO3: Record<string, string> = {
  US: "USA", CA: "CAN", GB: "GBR", AU: "AUS", NZ: "NZL", MX: "MEX", BR: "BRA",
  DE: "DEU", FR: "FRA", ES: "ESP", IT: "ITA", NL: "NLD", BE: "BEL", CH: "CHE",
  AT: "AUT", SE: "SWE", NO: "NOR", DK: "DNK", FI: "FIN", IE: "IRL", PT: "PRT",
  PL: "POL", CZ: "CZE", GR: "GRC", TR: "TUR", AE: "ARE", SA: "SAU", IL: "ISR",
  IN: "IND", PK: "PAK", BD: "BGD", CN: "CHN", HK: "HKG", TW: "TWN", JP: "JPN",
  KR: "KOR", SG: "SGP", MY: "MYS", TH: "THA", VN: "VNM", PH: "PHL", ID: "IDN",
  NG: "NGA", GH: "GHA", KE: "KEN", ZA: "ZAF", EG: "EGY", MA: "MAR", CO: "COL",
  AR: "ARG", CL: "CHL", PE: "PER", VE: "VEN", DO: "DOM", JM: "JAM", TT: "TTO",
};

export function toIso3Country(iso2: string | null | undefined): string {
  const code = (iso2 ?? "US").trim().toUpperCase();
  const mapped = ISO2_TO_ISO3[code];
  if (!mapped) {
    throw new DoolaApiError({
      message: "A founder country on this filing is not supported yet.",
      httpStatus: null,
      code: "E_UNSUPPORTED_COUNTRY",
      retryable: false,
    });
  }
  return mapped;
}

/** 9-digit stored SSN/ITIN → XXX-XX-XXXX wire format. */
export function formatSsnForDoola(ssn: string | null): string | undefined {
  if (!ssn) return undefined;
  const digits = ssn.replace(/\D/g, "");
  if (digits.length !== 9) return undefined;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function founderSsn(founder: LlcFounderRecord): string | undefined {
  if (!founder.ssnEncrypted) return undefined;
  return formatSsnForDoola(decryptPii(founder.ssnEncrypted));
}

/**
 * Doola requires E.164 phone numbers (E_PHONE_INVALID otherwise —
 * sandbox-verified). The wizard accepts bare US numbers and normalizes at
 * validation time, but founder ROWS store the raw draft value, so the
 * mapper must normalize again here.
 */
export function normalizePhoneForDoola(phone: string | null | undefined): string | undefined {
  const raw = (phone ?? "").trim();
  if (!raw) return undefined;
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw;
}

function personAddress(founder: LlcFounderRecord) {
  return {
    line1: founder.addressLine1 ?? "",
    ...(founder.addressLine2 ? { line2: founder.addressLine2 } : {}),
    city: founder.addressCity ?? "",
    state: founder.addressState ?? "",
    postalCode: founder.addressPostalCode ?? "",
    country: toIso3Country(founder.addressCountry),
    // Doola requires a phone on person addresses; the wizard requires a
    // phone per founder, so this is always present on validated bundles.
    phone: normalizePhoneForDoola(founder.phone) ?? "",
  };
}

/** Humanized business description (Doola requires one; the wizard doesn't collect it). */
export function deriveBusinessDescription(registration: LlcRegistrationRecord): string {
  const source =
    registration.industryType ?? registration.industryGroup ?? registration.businessType;
  if (!source) return "General business activities";
  const words = source.replace(/[_-]+/g, " ").trim();
  const sentence = words.charAt(0).toUpperCase() + words.slice(1);
  return `${sentence} business`.slice(0, 250);
}

/**
 * Doola industry label when the registration's taxonomy matches a preset.
 * Doola validates against its OWN industry list (821 labeled entries) and
 * documents `industry` as the field to send — raw NAICS codes outside their
 * list are rejected with E_NAICS_INVALID (verified in sandbox).
 */
export function deriveDoolaIndustry(registration: LlcRegistrationRecord): string | undefined {
  const preset = LLC_ACTIVITY_PRESETS.find(
    (candidate) =>
      candidate.businessType === registration.businessType &&
      candidate.industryGroup === registration.industryGroup &&
      candidate.industryType === registration.industryType,
  );
  return (preset as { doolaIndustry?: string } | undefined)?.doolaIndustry;
}

// ─── Request mapping ─────────────────────────────────────────────────────────

export function mapRegistrationToDoolaCustomer(
  registration: LlcRegistrationRecord,
  founders: LlcFounderRecord[],
) {
  const primary = founders.find((founder) => founder.isPrimary);
  if (!primary) {
    throw new DoolaApiError({
      message: "The filing has no primary founder.",
      httpStatus: null,
      code: "E_NO_PRIMARY_FOUNDER",
      retryable: false,
    });
  }
  return {
    email: primary.email ?? "",
    firstName: primary.firstName ?? "",
    lastName: primary.lastName ?? "",
    countryOfResidence: toIso3Country(primary.addressCountry),
    ...(normalizePhoneForDoola(primary.phone)
      ? { phoneNumber: normalizePhoneForDoola(primary.phone) }
      : {}),
  };
}

export function mapRegistrationToDoolaCompany(
  registration: LlcRegistrationRecord,
  founders: LlcFounderRecord[],
  doolaCustomerId: string,
) {
  const primary = founders.find((founder) => founder.isPrimary);
  if (!primary) {
    throw new DoolaApiError({
      message: "The filing has no primary founder.",
      httpStatus: null,
      code: "E_NO_PRIMARY_FOUNDER",
      retryable: false,
    });
  }

  const companyAddress = registration.useRegisteredAgent
    ? null
    : {
        line1: registration.companyAddressLine1 ?? "",
        ...(registration.companyAddressLine2 ? { line2: registration.companyAddressLine2 } : {}),
        city: registration.companyAddressCity ?? "",
        state: registration.companyAddressState ?? "",
        postalCode: registration.companyAddressPostalCode ?? "",
        country: toIso3Country(registration.companyAddressCountry),
        ...(normalizePhoneForDoola(registration.businessPhone)
          ? { phone: normalizePhoneForDoola(registration.businessPhone) }
          : {}),
      };

  // Registered-agent mode routes BOTH addresses through Doola's RA: state
  // filings and postal mail (incl. the EIN letter) then arrive as API
  // documents — the strongest white-label posture available. Own-address
  // mode uses the company address for both.
  const addresses = registration.useRegisteredAgent
    ? [
        { provider: "registeredAgent", type: "mailing" },
        { provider: "registeredAgent", type: "business" },
      ]
    : [
        { provider: "customer", type: "mailing", address: companyAddress },
        { provider: "customer", type: "business", address: companyAddress },
      ];

  const industry = deriveDoolaIndustry(registration);

  return {
    doolaCustomerId,
    entityType: "LLC",
    state: registration.formationState ?? "",
    nameOptions: [
      {
        name: registration.legalName ?? "",
        entityTypeEnding: registration.entitySuffix,
      },
    ],
    ...(industry ? { industry } : {}),
    description: deriveBusinessDescription(registration),
    responsibleParty: {
      legalFirstName: primary.firstName ?? "",
      legalLastName: primary.lastName ?? "",
      ...(founderSsn(primary) ? { ssn: founderSsn(primary) } : {}),
      email: primary.email ?? "",
      address: personAddress(primary),
    },
    addresses,
    members: founders.map((founder) => ({
      legalFirstName: founder.firstName ?? "",
      legalLastName: founder.lastName ?? "",
      isNaturalPerson: true,
      address: personAddress(founder),
      ownershipPercent: (founder.ownershipBasisPoints ?? 0) / 100,
      ...(founderSsn(founder) ? { ssn: founderSsn(founder) } : {}),
    })),
    // EIN is part of every order. Expedite is requested only when the client
    // bought the add-on AND no founder supplies a US tax id — Doola rejects
    // expedited requests for SSN-carrying filings outright (and rejects them
    // entirely for partners whose agreement lacks the feature, so the UI
    // additionally gates the offer on an ops-set add-on price).
    requestedServices: [
      {
        service: "EinCreation",
        variant:
          registration.expediteEin && !founders.some((founder) => founder.ssnEncrypted)
            ? "Expedite"
            : "Standard",
      },
    ],
  };
}

// ─── API calls ───────────────────────────────────────────────────────────────

export async function createDoolaCustomer(params: {
  registration: LlcRegistrationRecord;
  founders: LlcFounderRecord[];
  idempotencyKey: string;
}): Promise<{ doolaCustomerId: string }> {
  const body = mapRegistrationToDoolaCustomer(params.registration, params.founders);
  const { payload } = await doolaRequest<{ doolaCustomerId?: string; id?: string }>({
    method: "POST",
    path: "/v1/partner/customers",
    body,
    idempotencyKey: params.idempotencyKey,
  });
  const doolaCustomerId = payload.doolaCustomerId ?? payload.id;
  if (!doolaCustomerId) {
    throw new DoolaApiError({
      message: "The filing service returned no customer id.",
      httpStatus: null,
      code: "E_MALFORMED_RESPONSE",
      retryable: false,
    });
  }
  return { doolaCustomerId };
}

export interface DoolaCompany {
  doolaCompanyId?: string;
  formationSubmissionStatus?: string;
  ein?: string | null;
  formationFilingDate?: string | null;
  services?: Array<{ name?: string; variant?: string; status?: string; subStatus?: string }>;
  signatureRequirements?: Array<{ documentType?: string; status?: string }>;
  adminNotes?: Array<{ note?: string; status?: string }>;
  [key: string]: unknown;
}

export async function createDoolaCompany(params: {
  registration: LlcRegistrationRecord;
  founders: LlcFounderRecord[];
  doolaCustomerId: string;
  idempotencyKey: string;
}): Promise<DoolaCompany> {
  const body = mapRegistrationToDoolaCompany(
    params.registration,
    params.founders,
    params.doolaCustomerId,
  );
  const { payload } = await doolaRequest<DoolaCompany>({
    method: "POST",
    path: "/v1/partner/companies",
    body,
    idempotencyKey: params.idempotencyKey,
  });
  return payload;
}

export async function retrieveDoolaCompany(doolaCompanyId: string): Promise<DoolaCompany> {
  const { payload } = await doolaRequest<DoolaCompany>({
    method: "GET",
    path: `/v1/partner/companies/${encodeURIComponent(doolaCompanyId)}`,
  });
  return payload;
}

/** Provider's live per-state filing fee table (billed through at cost). */
export async function listDoolaStateFees(): Promise<Record<string, number>> {
  const { payload } = await doolaRequest<
    Array<{ state?: string; priceInCents?: number }> | { content?: Array<{ state?: string; priceInCents?: number }> }
  >({ method: "GET", path: "/v1/partner/references/state-fees" });
  const items = Array.isArray(payload) ? payload : (payload.content ?? []);
  const fees: Record<string, number> = {};
  for (const entry of items) {
    if (typeof entry.state === "string" && typeof entry.priceInCents === "number") {
      fees[entry.state] = entry.priceInCents;
    }
  }
  return fees;
}

/**
 * The partner's per-formation cost under the prepaid credit-pack model.
 * The operator holds the $10,000 pack: $100/formation, locked at any
 * volume (state fees billed separately). Drives ops margin math.
 */
export function getDoolaFormationCostCents(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number.parseInt(env.DOOLA_FORMATION_COST_CENTS ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10000;
}

export interface DoolaDocument {
  id?: string;
  name?: string;
  contentType?: string;
  documentType?: string;
  downloadUrl?: string;
}

export async function listDoolaDocuments(doolaCompanyId: string): Promise<DoolaDocument[]> {
  const { payload } = await doolaRequest<DoolaDocument[] | { documents?: DoolaDocument[] }>({
    method: "GET",
    path: `/v1/partner/companies/${encodeURIComponent(doolaCompanyId)}/documents`,
  });
  if (Array.isArray(payload)) return payload;
  return payload.documents ?? [];
}

export async function getDoolaDocumentDownload(
  doolaCompanyId: string,
  documentId: string,
): Promise<DoolaDocument> {
  const { payload } = await doolaRequest<DoolaDocument>({
    method: "GET",
    path: `/v1/partner/companies/${encodeURIComponent(doolaCompanyId)}/documents/${encodeURIComponent(documentId)}`,
  });
  return payload;
}

export async function createDoolaSignatureSession(
  doolaCompanyId: string,
  documentType: "SS4" | "FORM8821",
): Promise<{ url: string | null; expiresAt: string | null }> {
  const { payload } = await doolaRequest<{ url?: string; signingUrl?: string; expiresAt?: string }>({
    method: "POST",
    path: `/v1/partner/companies/${encodeURIComponent(doolaCompanyId)}/signatures`,
    body: { documentType },
    idempotencyKey: randomUUID(),
  });
  return {
    url: payload.url ?? payload.signingUrl ?? null,
    expiresAt: payload.expiresAt ?? null,
  };
}

// ─── Normalization into the provider-neutral snapshot ────────────────────────

/** Doola PascalCase document types → the vault's snake_case vocabulary. */
const DOOLA_DOCUMENT_TYPES: Record<string, string> = {
  ArticlesOfOrganization: "articles_of_organization",
  EinLetter: "ein_letter",
  OperatingAgreement: "operating_agreement",
  CorporateBylaws: "corporate_bylaws",
  SignedSS4: "signed_ss4",
  SignedForm8821: "signed_form8821",
  Mail: "mail",
};

export function normalizeDoolaDocumentType(documentType: string | undefined): string | null {
  if (!documentType) return null;
  return DOOLA_DOCUMENT_TYPES[documentType] ?? documentType.toLowerCase().slice(0, 128);
}

/**
 * Map a Doola company to the same local statuses the Whop path uses, plus a
 * sanitized ops snapshot in the established shape (documents/signatures keys
 * match what the vault mirror and ops alerts already consume).
 */
export function normalizeDoolaCompanyStatus(
  company: DoolaCompany,
  documents: DoolaDocument[] = [],
): {
  snapshot: WhopFormationSnapshot;
  localStatus: "processing" | "completed" | "action_required" | null;
  note: string;
  ein: string | null;
} {
  const snapshot: WhopFormationSnapshot = {};
  const submission =
    typeof company.formationSubmissionStatus === "string"
      ? company.formationSubmissionStatus.toUpperCase()
      : null;
  if (submission) snapshot.status = submission.toLowerCase();
  const ein = typeof company.ein === "string" && company.ein.trim() ? company.ein.trim().slice(0, 16) : null;
  if (ein) snapshot.ein_registered = true;
  if (typeof company.formationFilingDate === "string" && company.formationFilingDate) {
    snapshot.filed_at = company.formationFilingDate.slice(0, 64);
    snapshot.state_registered = true;
  }

  const sanitizedDocuments = documents.slice(0, 20).map((document) => ({
    id: typeof document.id === "string" ? document.id.slice(0, 128) : null,
    name: typeof document.name === "string" ? document.name.slice(0, 200) : null,
    document_type: normalizeDoolaDocumentType(document.documentType),
    download_url:
      typeof document.downloadUrl === "string" ? document.downloadUrl.slice(0, 2000) : null,
  }));
  if (sanitizedDocuments.length > 0) snapshot.documents = sanitizedDocuments;

  const pendingSignatures = (company.signatureRequirements ?? []).filter(
    (requirement) => (requirement.status ?? "").toUpperCase() === "PENDING",
  );
  if (pendingSignatures.length > 0) {
    snapshot.signatures = pendingSignatures.map((requirement) => ({
      form: (requirement.documentType ?? "").toLowerCase().slice(0, 32) || null,
      status: "pending",
      url: null,
      expires_at: null,
    }));
  }

  if (submission === "FAILED") {
    return {
      snapshot,
      localStatus: "action_required",
      note: "The filing service reported the formation failed; ops review required",
      ein,
    };
  }
  if (pendingSignatures.length > 0) {
    return {
      snapshot,
      localStatus: "action_required",
      note: "A founder signature is required before the filing can continue",
      ein,
    };
  }
  if (snapshot.state_registered === true && ein) {
    return {
      snapshot,
      localStatus: "completed",
      note: "The state filing and EIN are both complete",
      ein,
    };
  }
  if (snapshot.state_registered === true) {
    return {
      snapshot,
      localStatus: "processing",
      note: "The state filing is complete; the EIN is still in progress",
      ein,
    };
  }
  if (submission === "SUBMITTED" || submission === "PENDING") {
    return {
      snapshot,
      localStatus: "processing",
      note: "The filing service is processing the formation",
      ein,
    };
  }
  return { snapshot, localStatus: company ? "processing" : null, note: "Formation in progress", ein };
}

import { z } from "zod";
import type { LlcComplete, LlcStatus } from "../../shared/llc";

export const WHOP_API_VERSION = "2026-07-08-1";
export const DEFAULT_WHOP_API_BASE_URL = "https://api.whop.com/api/v1";
const ALLOWED_WHOP_HOSTS = new Set(["api.whop.com", "sandbox-api.whop.com"]);

export type WhopConfig = {
  apiKey: string;
  baseUrl: string;
  apiVersion: string;
};

export class WhopConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhopConfigurationError";
  }
}

export class WhopApiError extends Error {
  readonly httpStatus?: number;
  readonly errorType: string;
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly actionRequired: boolean;
  readonly uncertain: boolean;
  readonly safeMessage: string;

  constructor(params: {
    message: string;
    errorType: string;
    safeMessage: string;
    httpStatus?: number;
    requestId?: string;
    retryable?: boolean;
    actionRequired?: boolean;
    uncertain?: boolean;
  }) {
    super(params.message);
    this.name = "WhopApiError";
    this.httpStatus = params.httpStatus;
    this.errorType = params.errorType.slice(0, 128);
    this.requestId = params.requestId?.slice(0, 128);
    this.retryable = params.retryable ?? false;
    this.actionRequired = params.actionRequired ?? false;
    this.uncertain = params.uncertain ?? false;
    this.safeMessage = params.safeMessage.slice(0, 500);
  }
}

export function getWhopConfig(env: NodeJS.ProcessEnv = process.env): WhopConfig {
  const apiKey = env.WHOP_API_KEY?.trim();
  if (!apiKey || !/^whop_[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
    throw new WhopConfigurationError(
      "WHOP_API_KEY is missing or invalid. Configure a server-side Whop Account API key.",
    );
  }

  const rawBaseUrl = (env.WHOP_API_BASE_URL ?? DEFAULT_WHOP_API_BASE_URL)
    .trim()
    .replace(/\/+$/, "");

  let parsed: URL;
  try {
    parsed = new URL(rawBaseUrl);
  } catch {
    throw new WhopConfigurationError("WHOP_API_BASE_URL must be a valid URL.");
  }

  if (
    parsed.protocol !== "https:" ||
    !ALLOWED_WHOP_HOSTS.has(parsed.hostname) ||
    parsed.pathname.replace(/\/+$/, "") !== "/api/v1" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new WhopConfigurationError(
      "WHOP_API_BASE_URL must be Whop's production or sandbox /api/v1 endpoint.",
    );
  }

  return {
    apiKey,
    baseUrl: parsed.toString().replace(/\/+$/, ""),
    apiVersion: WHOP_API_VERSION,
  };
}

const whopErrorBodySchema = z
  .object({
    error: z
      .object({
        type: z.string().optional(),
        message: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const connectedAccountSchema = z
  .object({
    id: z.string().regex(/^biz_[A-Za-z0-9]+$/),
  })
  .passthrough();

const checkoutSchema = z
  .object({
    checkout_session_id: z.string().regex(/^ch_[A-Za-z0-9]+$/),
    checkout_url: z.string().url(),
    currency: z.literal("usd"),
    total: z.number().int().nonnegative(),
  })
  .passthrough();

const accountStatusSchema = z
  .object({
    id: z.string().regex(/^biz_[A-Za-z0-9]+$/),
    llc_formation: z.unknown(),
  })
  .passthrough();

const accountListSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string().regex(/^biz_[A-Za-z0-9]+$/),
        metadata: z.record(z.string(), z.unknown()).default({}),
      })
      .passthrough(),
  ),
  page_info: z.object({
    end_cursor: z.string().nullable(),
    has_next_page: z.boolean(),
  }),
});

export type WhopConnectedAccount = z.infer<typeof connectedAccountSchema>;
export type WhopCheckout = z.infer<typeof checkoutSchema>;
export type WhopAccountStatus = z.infer<typeof accountStatusSchema>;

function safeMessageForStatus(status: number, errorType: string): {
  safeMessage: string;
  retryable: boolean;
  actionRequired: boolean;
} {
  if (status === 400 || status === 422) {
    return {
      safeMessage:
        "We could not accept one or more registration details. Review the highlighted information, then try again.",
      retryable: false,
      actionRequired: true,
    };
  }
  if (status === 401) {
    return {
      safeMessage:
        "The filing service is temporarily unavailable because its secure connection needs attention.",
      retryable: false,
      actionRequired: true,
    };
  }
  if (status === 403) {
    return {
      safeMessage:
        "The filing service is not authorized for this action. Our team has been notified to review its configuration.",
      retryable: false,
      actionRequired: true,
    };
  }
  if (status === 404) {
    return {
      safeMessage:
        "We hit a problem preparing this filing. Our team has been notified; please do not resubmit.",
      retryable: false,
      actionRequired: true,
    };
  }
  if (status === 409) {
    return {
      safeMessage:
        "This registration may already exist. Refresh the filing status before trying again.",
      retryable: false,
      actionRequired: true,
    };
  }
  if (status === 429) {
    return {
      safeMessage:
        "The filing service is receiving a high volume of requests. Your draft is safe; wait a moment, then retry.",
      retryable: true,
      actionRequired: false,
    };
  }
  if (status >= 500) {
    return {
      safeMessage:
        "The filing service could not process the request right now. Your draft is safe and can be retried.",
      retryable: true,
      actionRequired: false,
    };
  }
  return {
    safeMessage:
      errorType === "invalid_response"
        ? "The filing service returned an unexpected response. Your draft is safe; refresh the status before retrying."
        : "The filing service could not process the request. Your draft remains saved.",
    retryable: false,
    actionRequired: true,
  };
}

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestWhop<T>(params: {
  method: "GET" | "POST";
  path: string;
  schema: z.ZodType<T>;
  body?: Record<string, unknown>;
  timeoutMs?: number;
  idempotencyKey?: string;
}): Promise<{ data: T; requestId?: string; httpStatus: number }> {
  const config = getWhopConfig();
  const requestIdHeaders = ["x-request-id", "whop-request-id", "request-id"];
  let response: Response;

  try {
    response = await fetch(`${config.baseUrl}${params.path}`, {
      method: params.method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Api-Version-Date": config.apiVersion,
        Accept: "application/json",
        ...(params.body ? { "Content-Type": "application/json" } : {}),
        ...(params.idempotencyKey
          ? { "Idempotency-Key": params.idempotencyKey.slice(0, 255) }
          : {}),
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
      signal: AbortSignal.timeout(params.timeoutMs ?? 20_000),
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    throw new WhopApiError({
      message: isTimeout ? "Whop request timed out" : "Whop network request failed",
      errorType: isTimeout ? "request_timeout" : "network_error",
      safeMessage:
        "The connection to the filing service was interrupted. Your draft is safe. Refresh the status before retrying to avoid a duplicate request.",
      retryable: true,
      uncertain: params.method === "POST",
    });
  }

  const requestId = requestIdHeaders
    .map((header) => response.headers.get(header))
    .find((value): value is string => Boolean(value));
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    const parsedError = whopErrorBodySchema.safeParse(payload);
    const errorType = parsedError.success
      ? (parsedError.data.error?.type ?? `http_${response.status}`)
      : `http_${response.status}`;
    const classification = safeMessageForStatus(response.status, errorType);

    console.warn("[Whop] API request failed", {
      method: params.method,
      path: params.path.replace(/biz_[A-Za-z0-9]+/g, "biz_[redacted]"),
      httpStatus: response.status,
      errorType,
      requestId,
    });

    throw new WhopApiError({
      message: `Whop request failed with HTTP ${response.status}`,
      errorType,
      safeMessage: classification.safeMessage,
      httpStatus: response.status,
      requestId,
      retryable: classification.retryable,
      actionRequired: classification.actionRequired,
    });
  }

  const parsed = params.schema.safeParse(payload);
  if (!parsed.success) {
    console.warn("[Whop] API response failed validation", {
      method: params.method,
      path: params.path.replace(/biz_[A-Za-z0-9]+/g, "biz_[redacted]"),
      httpStatus: response.status,
      errorType: "invalid_response",
      requestId,
    });
    const classification = safeMessageForStatus(response.status, "invalid_response");
    throw new WhopApiError({
      message: "Whop returned an invalid response shape",
      errorType: "invalid_response",
      safeMessage: classification.safeMessage,
      httpStatus: response.status,
      requestId,
      actionRequired: true,
      uncertain: params.method === "POST",
    });
  }

  return { data: parsed.data, requestId, httpStatus: response.status };
}

export function mapLlcToWhopRequest(registration: LlcComplete) {
  // Whop rejects expedite_ein when any founder supplies an SSN (the SSN path
  // is already the fastest EIN route); the schema coerces this, this guard is
  // the last line of defense.
  const anyFounderSsn = registration.founders.some((founder) => founder.ssn);
  const businessInfo: Record<string, unknown> = {
    legal_name: registration.legalName,
    entity_suffix: registration.entitySuffix,
    formation_state: registration.formationState,
    business_type: registration.businessType,
    industry_group: registration.industryGroup,
    industry_type: registration.industryType,
    use_registered_agent: registration.useRegisteredAgent,
    expedite_ein: registration.expediteEin && !anyFounderSsn,
  };

  if (registration.businessPhone) businessInfo.phone = registration.businessPhone;
  if (registration.website) businessInfo.website = registration.website;
  if (!registration.useRegisteredAgent) {
    businessInfo.address = {
      line1: registration.companyAddress.line1,
      ...(registration.companyAddress.line2
        ? { line2: registration.companyAddress.line2 }
        : {}),
      city: registration.companyAddress.city,
      state: registration.companyAddress.state,
      postal_code: registration.companyAddress.postalCode,
      country: registration.companyAddress.country,
    };
  }

  return {
    business_info: businessInfo,
    founders: registration.founders.map((founder) => ({
      is_primary: founder.isPrimary,
      first_name: founder.firstName,
      last_name: founder.lastName,
      email: founder.email,
      phone: founder.phone,
      ...(founder.ssn ? { ssn: founder.ssn } : {}),
      ownership_percentage: founder.ownershipPercentage,
      address: {
        line1: founder.address.line1,
        ...(founder.address.line2 ? { line2: founder.address.line2 } : {}),
        city: founder.address.city,
        state: founder.address.state,
        postal_code: founder.address.postalCode,
        country: founder.address.country,
      },
    })),
  };
}

export async function createWhopConnectedAccount(params: {
  email: string;
  title: string;
  userId: number;
  registrationId: number;
  idempotencyKey?: string;
}) {
  return requestWhop({
    method: "POST",
    path: "/accounts",
    schema: connectedAccountSchema,
    idempotencyKey: params.idempotencyKey,
    body: {
      country: "US",
      email: params.email,
      title: params.title.slice(0, 160),
      metadata: {
        app_user_id: String(params.userId),
        llc_registration_id: String(params.registrationId),
        source: "rental-calc-llc",
      },
    },
  });
}

export async function registerWhopLlc(
  accountId: string,
  registration: LlcComplete,
  options?: { idempotencyKey?: string },
) {
  if (!/^biz_[A-Za-z0-9]+$/.test(accountId)) {
    throw new WhopApiError({
      message: "Invalid connected Whop account ID",
      errorType: "invalid_account_id",
      safeMessage:
        "We hit a problem preparing this filing. Our team has been notified; please do not resubmit.",
      actionRequired: true,
    });
  }

  return requestWhop({
    method: "POST",
    path: `/accounts/${accountId}/llc`,
    schema: checkoutSchema,
    body: mapLlcToWhopRequest(registration),
    timeoutMs: 30_000,
    idempotencyKey: options?.idempotencyKey,
  });
}

export async function findWhopConnectedAccountByRegistrationId(
  registrationId: number,
): Promise<string | null> {
  let cursor: string | null = null;
  const expectedId = String(registrationId);

  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ first: "50" });
    if (cursor) query.set("after", cursor);
    const result = await requestWhop({
      method: "GET",
      path: `/accounts?${query.toString()}`,
      schema: accountListSchema,
    });

    const match = result.data.data.find(
      (account) => account.metadata.llc_registration_id === expectedId,
    );
    if (match) return match.id;

    if (!result.data.page_info.has_next_page) return null;
    cursor = result.data.page_info.end_cursor;
    if (!cursor) return null;
  }

  // Past the scan cap, treat the account as not found rather than failing the
  // submission: the Idempotency-Key on account creation is the real duplicate
  // guard, and Whop replays the original response for a repeated key.
  console.warn("[Whop] Account reconciliation scan hit the pagination cap", {
    pagesScanned: 20,
  });
  return null;
}

export async function retrieveWhopAccount(accountId: string) {
  if (!/^biz_[A-Za-z0-9]+$/.test(accountId)) {
    throw new WhopApiError({
      message: "Invalid connected Whop account ID",
      errorType: "invalid_account_id",
      safeMessage:
        "We hit a problem checking this filing. Our team has been notified.",
      actionRequired: true,
    });
  }

  return requestWhop({
    method: "GET",
    path: `/accounts/${accountId}`,
    schema: accountStatusSchema,
  });
}

const SAFE_PROVIDER_KEYS = new Set([
  "status",
  "state",
  "formation_status",
  "registration_status",
  "payment_pending",
  "action_required",
  "state_registered",
  "ein_registered",
  "legal_name",
  "pending_signatures_count",
  "documents_count",
  "filed_at",
  "completed_at",
  "submitted_at",
]);

export type WhopFormationDocument = {
  id: string | null;
  name: string | null;
  document_type: string | null;
  download_url: string | null;
};

export type WhopFormationSignature = {
  status: string | null;
  url: string | null;
  expires_at: string | null;
};

export type WhopFormationSnapshot = Record<
  string,
  string | number | boolean | null
> & {
  documents?: WhopFormationDocument[];
  signatures?: WhopFormationSignature[];
};

function safeString(value: unknown, maxLength = 500): string | null {
  return typeof value === "string" ? value.slice(0, maxLength) : null;
}

function sanitizeDocuments(value: unknown): WhopFormationDocument[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    return [
      {
        id: safeString(record.id, 128),
        name: safeString(record.name, 200),
        document_type: safeString(record.document_type, 128),
        download_url: safeString(record.download_url, 2000),
      },
    ];
  });
}

function sanitizeSignatures(value: unknown): WhopFormationSignature[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const expires =
      typeof record.expires_at === "number"
        ? String(record.expires_at)
        : safeString(record.expires_at, 64);
    return [
      {
        status: safeString(record.status, 64),
        url: safeString(record.url, 2000),
        expires_at: expires,
      },
    ];
  });
}

export function normalizeWhopFormationStatus(value: unknown): {
  snapshot: WhopFormationSnapshot;
  localStatus:
    | Extract<
        LlcStatus,
        "payment_required" | "processing" | "completed" | "action_required"
      >
    | null;
  note: string;
} {
  const snapshot: WhopFormationSnapshot = {};
  const isProviderObject =
    Boolean(value) && typeof value === "object" && !Array.isArray(value);
  if (isProviderObject) {
    const record = value as Record<string, unknown>;
    for (const [key, entry] of Object.entries(record)) {
      if (!SAFE_PROVIDER_KEYS.has(key)) continue;
      if (
        entry === null ||
        typeof entry === "number" ||
        typeof entry === "boolean" ||
        typeof entry === "string"
      ) {
        snapshot[key] = typeof entry === "string" ? entry.slice(0, 200) : entry;
      }
    }
    const documents = sanitizeDocuments(record.documents);
    if (documents.length > 0) snapshot.documents = documents;
    const signatures = sanitizeSignatures(record.signatures);
    if (signatures.length > 0) snapshot.signatures = signatures;
  }

  if (snapshot.payment_pending === true) {
    return {
      snapshot,
      localStatus: "payment_required",
      note: "Whop is waiting for checkout payment",
    };
  }

  const pendingSignatures = (snapshot.signatures ?? []).filter((signature) =>
    /pending|await|required/i.test(signature.status ?? ""),
  );
  if (pendingSignatures.length > 0) {
    return {
      snapshot,
      localStatus: "action_required",
      note: "Whop is waiting on a founder signature before the filing can continue",
    };
  }

  if (snapshot.action_required === true) {
    return {
      snapshot,
      localStatus: "action_required",
      note: "Whop reports that additional action is required",
    };
  }

  if (snapshot.state_registered === true && snapshot.ein_registered === true) {
    return {
      snapshot,
      localStatus: "completed",
      note: "Whop reports the state filing and EIN are both complete",
    };
  }

  // Snake/kebab separators become spaces so \b token matching works on values
  // like "filing_completed", and substrings ("inactive", "incomplete") cannot
  // false-match "active"/"complete".
  const statusText = [
    snapshot.status,
    snapshot.state,
    snapshot.formation_status,
    snapshot.registration_status,
  ]
    .filter((entry): entry is string => typeof entry === "string")
    .join(" ")
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  // Failure/attention signals are checked before completion signals so a
  // compound value like "filing_failed" can never read as complete.
  if (
    /\b(rejected|reject|failed|failure|fail|error|canceled|cancelled|cancel|action|attention|signature|signatures|required)\b/.test(
      statusText,
    )
  ) {
    return {
      snapshot,
      localStatus: "action_required",
      note: "Whop reports that additional action is required",
    };
  }
  if (/\b(completed|complete|approved|active|formed|filed)\b/.test(statusText)) {
    return {
      snapshot,
      localStatus: "completed",
      note: "Whop reports that the LLC filing is complete",
    };
  }
  if (
    /\b(processing|submitted|review|reviewing|pending|progress|filing|preparing|draft)\b/.test(
      statusText,
    )
  ) {
    return {
      snapshot,
      localStatus: "processing",
      note: "Whop is processing the LLC filing",
    };
  }

  if (snapshot.state_registered === true) {
    return {
      snapshot,
      localStatus: "processing",
      note: "The state filing is complete; the EIN is still in progress",
    };
  }

  if (Object.keys(snapshot).length > 0) {
    return {
      snapshot,
      localStatus: "processing",
      note: "Whop accepted the filing; detailed progress is not yet available",
    };
  }

  return {
    snapshot,
    localStatus: null,
    note: "Whop has not published detailed filing progress yet",
  };
}

const FORMATION_STATUS_RANK: Partial<Record<LlcStatus, number>> = {
  payment_required: 1,
  processing: 2,
  completed: 3,
};

/**
 * True when moving from `current` to `next` would rewind confirmed provider
 * progress (e.g. completed -> processing after a stale provider read).
 * Transitions involving statuses outside the provider ladder (action_required,
 * failed, ...) are never treated as regressions, except away from completed.
 */
export function isFormationStatusRegression(
  current: LlcStatus,
  next: LlcStatus,
): boolean {
  if (current === "completed") return next !== "completed";
  const currentRank = FORMATION_STATUS_RANK[current];
  const nextRank = FORMATION_STATUS_RANK[next];
  if (currentRank === undefined || nextRank === undefined) return false;
  return nextRank < currentRank;
}

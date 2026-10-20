/**
 * Annual report filing: the provider's compliance API (docs.doola.com/api/compliance/annual-report-filing,
 * verified 2026-10-20). Pure transport plus response normalization: no database, no app glue, so the three sibling
 * apps copy this file unchanged (they share the same `server/llc/doola.ts` request helper and partner account).
 *
 * Base: /v1/partner/companies/{companyId}/compliance/annual-reports
 *  - GET  requirements?fiscalYear=YYYY   the questions and company details the state asks, and the due date
 *  - GET  state-fees                     the quote (priceInCents, never null; isMinimum = a floor, repriced on submit)
 *  - POST (base)                         submit or replace answers: 201 new, 200 replaced; returns { report, isReplaced }
 *  - POST {annualReportId}/confirm       hand it to the provider to file; idempotent
 *  - GET  (base)                         list, newest year first, no answers
 *  - GET  {annualReportId}               one, with answers
 * Plus GET /v1/partner/companies/{companyId}/compliance/calendar (always one ANNUAL_REPORT event).
 *
 * Errors come through doolaRequest's mapping (DoolaApiError with code, httpStatus and per-field codes). White-label:
 * nothing here is client-facing; the service maps every value into our own words before a member sees it.
 */
import { createHash } from "node:crypto";
import { doolaRequest } from "../doola";

export const ANNUAL_REPORT_FIELD_TYPES = ["TEXT", "NUMBER", "SELECT", "RADIO", "AMOUNT", "DATE", "BOOLEAN", "ADDRESS"] as const;
export type AnnualReportFieldType = (typeof ANNUAL_REPORT_FIELD_TYPES)[number];

export const ANNUAL_REPORT_STATUSES = ["FILLED", "IN_PROGRESS", "AWAITING_INFORMATION", "FILING_COMPLETED"] as const;
export type AnnualReportStatus = (typeof ANNUAL_REPORT_STATUSES)[number];

export const COMPLIANCE_CALENDAR_STATUSES = ["UPCOMING", "OVERDUE", "NOT_YET_DUE", "UNSUPPORTED_STATE"] as const;
export type ComplianceCalendarStatus = (typeof COMPLIANCE_CALENDAR_STATUSES)[number];

export type AnnualReportFieldOption = { value: string; label: string };

export type AnnualReportField = {
  fieldId: string;
  label: string;
  type: AnnualReportFieldType;
  group: "QUESTION" | "COMPANY_DETAIL";
  required: boolean;
  affectsFee: boolean;
  options: AnnualReportFieldOption[];
  dependsOn: { fieldId: string; answer: string } | null;
};

export type AnnualReportRequirements = {
  state: string;
  entityType: string;
  fiscalYear: number;
  isFilingRequired: boolean;
  dueDate: string | null;
  fields: AnnualReportField[];
};

export type AnnualReportStateFee = {
  state: string;
  entityType: string;
  priceInCents: number;
  isFilingRequired: boolean;
  isMinimum: boolean;
};

export type AnnualReportAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

/** The companyDetails keys the submit body takes; a COMPANY_DETAIL field whose fieldId is one of these goes there. */
export const COMPANY_DETAIL_KEYS = [
  "companyName",
  "address",
  "mailingAddress",
  "physicalAddress",
  "phoneNumber",
  "authorizedShares",
  "issuedShares",
  "perValuedShares",
] as const;
export type CompanyDetailKey = (typeof COMPANY_DETAIL_KEYS)[number];

export type AnnualReportAnswerValue = string | number | boolean | AnnualReportAddress;
export type AnnualReportAnswer = { fieldId: string; value: AnnualReportAnswerValue };

export type AnnualReportSubmission = {
  fiscalYear?: number;
  answers?: AnnualReportAnswer[];
  companyDetails?: Partial<Record<CompanyDetailKey, AnnualReportAnswerValue>>;
};

export type ProviderAnnualReport = {
  annualReportId: string;
  fiscalYear: number;
  state: string;
  entityType: string;
  status: AnnualReportStatus;
  priceInCents: number | null;
  submittedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  answers: AnnualReportAnswer[];
};

export type ComplianceCalendarEvent = {
  state: string;
  nextDueDate: string | null;
  lastFiledDate: string | null;
  status: ComplianceCalendarStatus;
};

const companyBase = (companyId: string) => `/v1/partner/companies/${encodeURIComponent(companyId)}`;
const reportsBase = (companyId: string) => `${companyBase(companyId)}/compliance/annual-reports`;

const str = (value: unknown, max = 200): string => (typeof value === "string" ? value.trim().slice(0, max) : "");
const ymd = (value: unknown): string | null => {
  const text = str(value, 32);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
};
const intOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;

function normalizeOptions(raw: unknown): AnnualReportFieldOption[] {
  if (!Array.isArray(raw)) return [];
  const out: AnnualReportFieldOption[] = [];
  for (const option of raw.slice(0, 200)) {
    if (typeof option === "string" || typeof option === "number") {
      out.push({ value: String(option).slice(0, 200), label: String(option).slice(0, 200) });
    } else if (option && typeof option === "object") {
      const record = option as Record<string, unknown>;
      const value = str(record.value ?? record.id ?? record.key ?? record.label);
      if (value) out.push({ value, label: str(record.label ?? record.name ?? value) || value });
    }
  }
  return out;
}

export function normalizeField(raw: unknown): AnnualReportField | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const fieldId = str(record.fieldId, 128);
  const type = str(record.type, 16).toUpperCase() as AnnualReportFieldType;
  if (!fieldId || !ANNUAL_REPORT_FIELD_TYPES.includes(type)) return null;
  const depends = record.dependsOn && typeof record.dependsOn === "object" ? (record.dependsOn as Record<string, unknown>) : null;
  const dependsField = depends ? str(depends.fieldId, 128) : "";
  return {
    fieldId,
    label: str(record.label, 300) || fieldId,
    type,
    group: str(record.group, 32).toUpperCase() === "COMPANY_DETAIL" ? "COMPANY_DETAIL" : "QUESTION",
    required: record.required === true,
    affectsFee: record.affectsFee === true,
    options: normalizeOptions(record.options),
    dependsOn: depends && dependsField ? { fieldId: dependsField, answer: String(depends.answer ?? "").slice(0, 200) } : null,
  };
}

export function normalizeRequirements(payload: unknown): AnnualReportRequirements {
  const record = (payload ?? {}) as Record<string, unknown>;
  const fields = Array.isArray(record.fields) ? record.fields.map(normalizeField).filter((field): field is AnnualReportField => field !== null) : [];
  return {
    state: str(record.state, 8).toUpperCase(),
    entityType: str(record.entityType, 16) || "LLC",
    fiscalYear: intOrNull(record.fiscalYear) ?? new Date().getUTCFullYear(),
    isFilingRequired: record.isFilingRequired !== false,
    dueDate: ymd(record.dueDate),
    fields,
  };
}

export function normalizeStateFee(payload: unknown): AnnualReportStateFee {
  const record = (payload ?? {}) as Record<string, unknown>;
  const price = intOrNull(record.priceInCents);
  return {
    state: str(record.state, 8).toUpperCase(),
    entityType: str(record.entityType, 16) || "LLC",
    priceInCents: price !== null && price >= 0 ? price : 0,
    isFilingRequired: record.isFilingRequired !== false,
    isMinimum: record.isMinimum === true,
  };
}

function normalizeAnswers(raw: unknown): AnnualReportAnswer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((answer): answer is Record<string, unknown> => Boolean(answer) && typeof answer === "object")
    .map((answer) => ({ fieldId: str(answer.fieldId, 128), value: answer.value as AnnualReportAnswerValue }))
    .filter((answer) => answer.fieldId);
}

export function normalizeReport(payload: unknown): ProviderAnnualReport | null {
  const outer = (payload ?? {}) as Record<string, unknown>;
  // The submit answers { report, isReplaced }; the reads answer the report itself.
  const record = (outer.report && typeof outer.report === "object" ? outer.report : outer) as Record<string, unknown>;
  const annualReportId = str(record.annualReportId ?? record.id, 128);
  const status = str(record.status, 32).toUpperCase() as AnnualReportStatus;
  if (!annualReportId || !ANNUAL_REPORT_STATUSES.includes(status)) return null;
  const price = intOrNull(record.priceInCents);
  return {
    annualReportId,
    fiscalYear: intOrNull(record.fiscalYear) ?? new Date().getUTCFullYear(),
    state: str(record.state, 8).toUpperCase(),
    entityType: str(record.entityType, 16) || "LLC",
    status,
    priceInCents: price !== null && price >= 0 ? price : null,
    submittedAt: str(record.submittedAt, 64) || null,
    createdAt: str(record.createdAt, 64) || null,
    updatedAt: str(record.updatedAt, 64) || null,
    answers: normalizeAnswers(record.answers),
  };
}

export function normalizeCalendar(payload: unknown): ComplianceCalendarEvent | null {
  const record = (payload ?? {}) as Record<string, unknown>;
  const events = Array.isArray(record.events) ? record.events : Array.isArray(payload) ? (payload as unknown[]) : [];
  const event = events.find(
    (candidate): candidate is Record<string, unknown> =>
      Boolean(candidate) && typeof candidate === "object" && str((candidate as Record<string, unknown>).type, 32).toUpperCase() === "ANNUAL_REPORT",
  );
  if (!event) return null;
  const status = str(event.status, 32).toUpperCase() as ComplianceCalendarStatus;
  return {
    state: str(event.state, 8).toUpperCase(),
    nextDueDate: ymd(event.nextDueDate),
    lastFiledDate: ymd(event.lastFiledDate),
    status: COMPLIANCE_CALENDAR_STATUSES.includes(status) ? status : "UNSUPPORTED_STATE",
  };
}

/** Same body, same key: a retried identical submit is deduplicated by the provider; changed answers get a new key. */
export function submissionIdempotencyKey(companyId: string, body: AnnualReportSubmission): string {
  const digest = createHash("sha256").update(JSON.stringify([companyId, body])).digest("hex").slice(0, 40);
  return `hfo-annual-report-${digest}`;
}

export type AnnualReportProvider = {
  getRequirements(companyId: string, fiscalYear?: number): Promise<AnnualReportRequirements>;
  getStateFee(companyId: string): Promise<AnnualReportStateFee>;
  submit(companyId: string, body: AnnualReportSubmission): Promise<{ report: ProviderAnnualReport; isReplaced: boolean }>;
  confirm(companyId: string, annualReportId: string): Promise<ProviderAnnualReport | null>;
  list(companyId: string): Promise<ProviderAnnualReport[]>;
  get(companyId: string, annualReportId: string): Promise<ProviderAnnualReport | null>;
  calendar(companyId: string): Promise<ComplianceCalendarEvent | null>;
};

function malformed(): Error {
  return Object.assign(new Error("The filing service returned an unreadable annual report."), { code: "E_MALFORMED_RESPONSE" });
}

export const doolaAnnualReportProvider: AnnualReportProvider = {
  async getRequirements(companyId, fiscalYear) {
    const query = fiscalYear ? `?fiscalYear=${encodeURIComponent(String(fiscalYear))}` : "";
    const { payload } = await doolaRequest<unknown>({ method: "GET", path: `${reportsBase(companyId)}/requirements${query}` });
    return normalizeRequirements(payload);
  },
  async getStateFee(companyId) {
    const { payload } = await doolaRequest<unknown>({ method: "GET", path: `${reportsBase(companyId)}/state-fees` });
    return normalizeStateFee(payload);
  },
  async submit(companyId, body) {
    const { payload } = await doolaRequest<unknown>({
      method: "POST",
      path: reportsBase(companyId),
      body,
      idempotencyKey: submissionIdempotencyKey(companyId, body),
    });
    const report = normalizeReport(payload);
    if (!report) throw malformed();
    return { report, isReplaced: Boolean((payload as { isReplaced?: unknown } | null)?.isReplaced) };
  },
  async confirm(companyId, annualReportId) {
    const { payload } = await doolaRequest<unknown>({
      method: "POST",
      path: `${reportsBase(companyId)}/${encodeURIComponent(annualReportId)}/confirm`,
      body: {},
      idempotencyKey: `hfo-annual-report-confirm-${annualReportId}`.slice(0, 255),
    });
    return normalizeReport(payload);
  },
  async list(companyId) {
    const { payload } = await doolaRequest<unknown>({ method: "GET", path: reportsBase(companyId) });
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { content?: unknown })?.content)
        ? (payload as { content: unknown[] }).content
        : Array.isArray((payload as { annualReports?: unknown })?.annualReports)
          ? (payload as { annualReports: unknown[] }).annualReports
          : [];
    return items.map(normalizeReport).filter((report): report is ProviderAnnualReport => report !== null);
  },
  async get(companyId, annualReportId) {
    const { payload } = await doolaRequest<unknown>({
      method: "GET",
      path: `${reportsBase(companyId)}/${encodeURIComponent(annualReportId)}`,
    });
    return normalizeReport(payload);
  },
  async calendar(companyId) {
    const { payload } = await doolaRequest<unknown>({ method: "GET", path: `${companyBase(companyId)}/compliance/calendar` });
    return normalizeCalendar(payload);
  },
};

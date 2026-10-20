/**
 * Annual report filing, the core (the owner, 2026-10-20: "for llc we need to add these in"). Provider-neutral and
 * app-neutral: every outside thing comes in through AnnualReportDeps (the provider client, the store, this app's
 * filings, ops alerts, the document mirror, the clock), so the sibling apps copy this file unchanged and tests run it
 * against fakes. Payments and emails are app glue (payments.ts, reminders.ts) that call into it.
 *
 * The flow: the calendar says when it's due → she answers the state's questions (requirements) → submit (FILLED, the
 * price is fixed) → she pays exactly that price → on a verified payment, confirm (IN_PROGRESS) → the provider files
 * it (FILING_COMPLETED) → the filed report lands in her documents. A zero-fee report confirms without payment.
 *
 * Money rule: confirmReport never confirms a priced report without a verified payment for that report's exact price,
 * re-read from the provider just before the hand-off. Every step is safe to repeat (double clicks, webhook replays,
 * payment retries): stamps are guarded updates and the provider's confirm is idempotent.
 *
 * Filing window (live check 2026-10-20, ported to the Coach Inayah app first; back-port to the siblings): the provider
 * answered the same due date for fiscal years 2026 and 2027, so the form, the submit and the File button open only
 * within 90 days of the calendar's due date or once it says OVERDUE (shared/llcAnnualReports.ts isFilingWindowOpen).
 * This is the one change from Her First Order's copy of this file.
 */
import { DoolaApiError } from "../doola";
import { LLC_STATE_NAMES } from "../../../shared/llc";
import {
  ANNUAL_REPORT_CARD_HEADLINES,
  ANNUAL_REPORT_STATUS_WORDS,
  dateWords,
  feeWords,
  filingOpensOn,
  isFilingWindowOpen,
  pacificToday,
  validateAnnualReportAnswers,
  type AnnualReportAnswers,
  type AnnualReportCardState,
  type AnnualReportValue,
  type MemberAnnualReportField,
  type MemberAnnualReportView,
} from "../../../shared/llcAnnualReports";
import {
  COMPANY_DETAIL_KEYS,
  type AnnualReportField,
  type AnnualReportProvider,
  type AnnualReportSubmission,
  type CompanyDetailKey,
  type ProviderAnnualReport,
} from "./provider";
import type { AnnualReportRow, AnnualReportStore, ComplianceRow, ReportPatch } from "./store";
import type { FilingFacts, FilingSource } from "./filings";

export type AnnualReportAlerts = {
  /** At most once per (registration, type); never throws. */
  once(params: { registrationId: number; type: string; subject: string; lines: string[] }): Promise<unknown>;
};

export type AnnualReportDocuments = {
  /** Mirror filed reports into her vault (best effort, idempotent); returns how many new documents landed. */
  mirror(params: { facts: FilingFacts; reports: AnnualReportRow[]; documentId?: string | null }): Promise<{ mirrored: number }>;
};

export type AnnualReportDeps = {
  provider: AnnualReportProvider;
  store: AnnualReportStore;
  filings: FilingSource;
  alerts: AnnualReportAlerts;
  documents: AnnualReportDocuments;
  now: () => Date;
};

/** A page view reads the provider again at most this often; the daily sweep after this long. */
export const PAGE_VIEW_SYNC_MS = 10 * 60_000;
export const DAILY_SYNC_MS = 20 * 60 * 60_000;

export type AnnualReportErrorCode =
  | "not_found"
  | "not_eligible"
  | "not_required"
  | "locked"
  | "invalid"
  | "conflict"
  | "unsupported"
  | "not_open"
  | "unavailable";

/** A refusal in plain words she can read (no provider names, no codes). */
export class AnnualReportError extends Error {
  readonly code: AnnualReportErrorCode;
  readonly fieldErrors: Record<string, string>;
  constructor(code: AnnualReportErrorCode, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "AnnualReportError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const PROVIDER_NAMES = /doola|whop/gi;
const scrub = (text: string) => text.replace(PROVIDER_NAMES, "our filing team");

export function errorCodeOf(error: unknown): string {
  if (error instanceof DoolaApiError) return (error.code ?? `HTTP_${error.httpStatus ?? "network"}`).slice(0, 64);
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code.slice(0, 64) : error instanceof Error ? error.name.slice(0, 64) : "UnknownError";
}

/**
 * The fiscal year this cycle files: the due date's year, else this year. Awaiting provider confirmation: a live check
 * (2026-10-20) returned the same due date for fiscal years 2026 and 2027, which is why filing only opens inside the
 * 90-day window (filingWindowOpen below).
 */
export function cycleFiscalYear(compliance: Pick<ComplianceRow, "nextDueDate"> | null, now: Date): number {
  const year = Number(String(compliance?.nextDueDate ?? "").slice(0, 4));
  return Number.isInteger(year) && year > 2000 ? year : now.getUTCFullYear();
}

/** Filing is open for this calendar today (Pacific date): within 90 days of the due date, or OVERDUE. */
export function filingWindowOpen(compliance: Pick<ComplianceRow, "nextDueDate" | "status"> | null, now: Date): boolean {
  return Boolean(compliance) && isFilingWindowOpen({ nextDueDate: compliance?.nextDueDate ?? null, status: compliance?.status ?? null }, pacificToday(now));
}

function requireFilingWindow(compliance: ComplianceRow | null, now: Date) {
  if (filingWindowOpen(compliance, now)) return;
  const opens = dateWords(filingOpensOn(compliance?.nextDueDate ?? null));
  throw new AnnualReportError(
    "not_open",
    opens ? `Filing for this year's annual report opens on ${opens}. We'll email you when it's time.` : "Filing opens here once your state's due date is in. We'll email you when it's time.",
  );
}

/** The provider's field as the member page gets it: provider names scrubbed from every label. */
export function memberField(field: AnnualReportField): MemberAnnualReportField {
  return {
    fieldId: field.fieldId,
    label: scrub(field.label),
    type: field.type,
    group: field.group,
    required: field.required,
    affectsFee: field.affectsFee,
    options: field.options.map((option) => ({ value: option.value, label: scrub(option.label) })),
    dependsOn: field.dependsOn,
  };
}

/** Her saved company details prefilled into the COMPANY_DETAIL questions (she can change them before submitting). */
export function prefillAnswers(fields: readonly AnnualReportField[], facts: FilingFacts): Record<string, AnnualReportValue> {
  const out: Record<string, AnnualReportValue> = {};
  for (const field of fields) {
    if (field.group !== "COMPANY_DETAIL") continue;
    const key = field.fieldId as CompanyDetailKey;
    if (field.type === "ADDRESS") {
      const address =
        // Her own mailing address only, never her business address in its place (review fix, 2026-10-20).
        key === "mailingAddress" ? facts.mailingAddress : key === "address" || key === "physicalAddress" ? facts.businessAddress : null;
      if (address) out[field.fieldId] = address;
    } else if (key === "companyName" && facts.companyName) {
      out[field.fieldId] = facts.companyName;
    } else if (key === "phoneNumber" && facts.phone) {
      out[field.fieldId] = facts.phone;
    }
  }
  return out;
}

/** The submit body: only fields the requirements returned and the page showed; known company details apart. */
export function buildSubmission(fields: readonly AnnualReportField[], cleaned: Record<string, AnnualReportValue>, fiscalYear: number): AnnualReportSubmission {
  const answers: Array<{ fieldId: string; value: AnnualReportValue }> = [];
  const companyDetails: Partial<Record<CompanyDetailKey, AnnualReportValue>> = {};
  for (const field of fields) {
    if (!(field.fieldId in cleaned)) continue;
    const value = cleaned[field.fieldId];
    if (field.group === "COMPANY_DETAIL" && (COMPANY_DETAIL_KEYS as readonly string[]).includes(field.fieldId)) {
      companyDetails[field.fieldId as CompanyDetailKey] = value;
    } else {
      answers.push({ fieldId: field.fieldId, value });
    }
  }
  return {
    fiscalYear,
    ...(answers.length ? { answers } : {}),
    ...(Object.keys(companyDetails).length ? { companyDetails } : {}),
  };
}

const isLocked = (row: AnnualReportRow | null | undefined) =>
  Boolean(row && (row.paidAt || row.confirmedAt || (row.status && row.status !== "FILLED")));

// ─── Calendar and report sync ──────────────────────────────────────────────────────────────────────────────────────

export type SyncResult = { facts: FilingFacts; compliance: ComplianceRow | null; reports: AnnualReportRow[] };

async function alertAwaitingInformation(deps: AnnualReportDeps, facts: FilingFacts, row: AnnualReportRow) {
  await deps.alerts.once({
    registrationId: facts.registrationId,
    type: `ar_awaiting_${row.id}`,
    subject: `Annual report needs information (order #${facts.registrationId})`,
    lines: [
      `The ${row.fiscalYear} annual report for order #${facts.registrationId} (${facts.companyName || "company"}) is AWAITING_INFORMATION at the filing provider.`,
      "The API has no action for this: check the provider's portal or support, then reach out to her. Her page says our team is reviewing a detail.",
    ],
  });
}

/** Fold the provider's report list into our rows: status, fixed price, and the confirm/filed stamps. */
async function applyProviderReports(deps: AnnualReportDeps, facts: FilingFacts, list: ProviderAnnualReport[]) {
  const now = deps.now();
  const local = await deps.store.listReports(facts.registrationId);
  for (const report of list) {
    const row = local.find((candidate) => candidate.annualReportId === report.annualReportId) ?? local.find((candidate) => candidate.fiscalYear === report.fiscalYear);
    const patch: ReportPatch = {
      annualReportId: report.annualReportId,
      status: report.status,
      ...(report.priceInCents !== null ? { priceInCents: report.priceInCents } : {}),
      ...(!row?.submittedAt && report.submittedAt && Number.isFinite(Date.parse(report.submittedAt)) ? { submittedAt: new Date(report.submittedAt) } : {}),
      // Past FILLED means it was handed over (by us, a retry, or the provider's own team).
      ...(report.status !== "FILLED" && !row?.confirmedAt ? { confirmedAt: now } : {}),
      ...(report.status === "FILING_COMPLETED" && !row?.completedAt ? { completedAt: now } : {}),
    };
    const saved = await deps.store.upsertReport({ registrationId: facts.registrationId, userId: facts.userId, fiscalYear: row?.fiscalYear ?? report.fiscalYear }, patch);
    if (report.status === "AWAITING_INFORMATION" && row?.status !== "AWAITING_INFORMATION") {
      await alertAwaitingInformation(deps, facts, saved);
    }
  }
}

/**
 * Read the provider's compliance calendar, state fee quote and report list for one filing into our rows. With
 * `maxAgeMs`, a calendar read more recently than that is reused (page views); without it, it always reads. Never
 * throws for a provider outage: the last good values stay and lastError says what failed.
 */
export async function syncCompliance(registrationId: number, options: { maxAgeMs?: number }, deps: AnnualReportDeps): Promise<SyncResult | null> {
  const facts = await deps.filings.load(registrationId);
  if (!facts?.eligible || !facts.companyId) return null;
  const now = deps.now();
  const existing = await deps.store.getCompliance(registrationId);
  if (options.maxAgeMs && existing?.syncedAt && now.getTime() - existing.syncedAt.getTime() < options.maxAgeMs) {
    return { facts, compliance: existing, reports: await deps.store.listReports(registrationId) };
  }

  let failure: string | null = null;
  const calendar = await deps.provider.calendar(facts.companyId).catch((error) => {
    failure = `calendar:${errorCodeOf(error)}`;
    return null;
  });
  const fee = await deps.provider.getStateFee(facts.companyId).catch((error) => {
    if (errorCodeOf(error) !== "E_STATE_NOT_SUPPORTED") failure ??= `state_fee:${errorCodeOf(error)}`;
    return null;
  });
  const list = await deps.provider.list(facts.companyId).catch((error) => {
    failure ??= `reports:${errorCodeOf(error)}`;
    return null;
  });

  const compliance: ComplianceRow & { syncedAt: Date } = {
    registrationId,
    userId: facts.userId,
    state: calendar?.state || existing?.state || facts.state,
    nextDueDate: calendar ? calendar.nextDueDate : existing?.nextDueDate ?? null,
    lastFiledDate: calendar ? calendar.lastFiledDate : existing?.lastFiledDate ?? null,
    status: calendar ? calendar.status : existing?.status ?? null,
    filingRequired: fee ? fee.isFilingRequired : existing?.filingRequired ?? null,
    quotePriceCents: fee ? fee.priceInCents : existing?.quotePriceCents ?? null,
    quoteIsMinimum: fee ? fee.isMinimum : existing?.quoteIsMinimum ?? false,
    syncedAt: now,
    lastError: failure,
  };
  await deps.store.upsertCompliance(compliance);
  if (list) await applyProviderReports(deps, facts, list);

  let reports = await deps.store.listReports(registrationId);
  if (reports.some((report) => report.status === "FILING_COMPLETED" && !report.filedDocumentId)) {
    const result = await deps.documents.mirror({ facts, reports }).catch(() => ({ mirrored: 0 }));
    if (result.mirrored > 0) reports = await deps.store.listReports(registrationId);
  }
  return { facts, compliance, reports };
}

// ─── The filing form and the submit ────────────────────────────────────────────────────────────────────────────────

async function requireOwnEligible(userId: number, registrationId: number, deps: AnnualReportDeps): Promise<FilingFacts> {
  const facts = await deps.filings.load(registrationId);
  if (!facts || facts.userId !== userId) throw new AnnualReportError("not_found", "This LLC could not be found in your workspace.");
  if (!facts.eligible || !facts.companyId) {
    throw new AnnualReportError("not_eligible", "Annual reports open here once your LLC is official.");
  }
  return facts;
}

export type AnnualReportForm = {
  fiscalYear: number;
  dueDate: string | null;
  dueDateWords: string | null;
  isFilingRequired: boolean;
  fields: MemberAnnualReportField[];
  answers: Record<string, AnnualReportValue>;
  quote: { priceCents: number; isMinimum: boolean } | null;
  /** The fixed fee of answers she already submitted (FILLED), so the page can say when it changes. */
  savedPriceCents: number | null;
  reportId: number | null;
};

export async function getAnnualReportForm(userId: number, registrationId: number, deps: AnnualReportDeps): Promise<AnnualReportForm> {
  const facts = await requireOwnEligible(userId, registrationId, deps);
  const synced = await syncCompliance(registrationId, { maxAgeMs: PAGE_VIEW_SYNC_MS }, deps);
  const compliance = synced?.compliance ?? null;
  requireFilingWindow(compliance, deps.now());
  let requirements;
  try {
    requirements = await deps.provider.getRequirements(facts.companyId as string, cycleFiscalYear(compliance, deps.now()));
  } catch (error) {
    if (errorCodeOf(error) === "E_STATE_NOT_SUPPORTED") {
      throw new AnnualReportError("unsupported", "Annual reports for your state can't be filed online yet. Our team will reach out to help.");
    }
    throw new AnnualReportError("unavailable", "The state's questions couldn't be loaded right now. Please try again in a few minutes.");
  }
  const current = (synced?.reports ?? []).find((report) => report.fiscalYear === requirements.fiscalYear) ?? null;
  if (isLocked(current)) throw new AnnualReportError("locked", "This year's annual report is already on its way, so the answers can't be changed.");
  const fields = requirements.fields.map(memberField);
  return {
    fiscalYear: requirements.fiscalYear,
    dueDate: requirements.dueDate ?? compliance?.nextDueDate ?? null,
    dueDateWords: dateWords(requirements.dueDate ?? compliance?.nextDueDate ?? null),
    isFilingRequired: requirements.isFilingRequired,
    fields: requirements.isFilingRequired ? fields : [],
    answers: { ...prefillAnswers(requirements.fields, facts), ...(current?.answers ?? {}) },
    quote: compliance?.quotePriceCents !== null && compliance?.quotePriceCents !== undefined
      ? { priceCents: compliance.quotePriceCents, isMinimum: compliance.quoteIsMinimum }
      : null,
    savedPriceCents: current?.priceInCents ?? null,
    reportId: current?.id ?? null,
  };
}

export type SubmitResult = {
  reportId: number;
  priceCents: number;
  /** What she was shown before this submit: the fee of her earlier answers, else the state quote. */
  previousPriceCents: number | null;
  priceChanged: boolean;
  isReplaced: boolean;
  /** A zero-fee report goes to the state straight away. */
  confirmOutcome: ConfirmOutcome | null;
};

const FIELD_PROBLEM = "Check this answer.";

export async function submitAnnualReport(userId: number, registrationId: number, answers: AnnualReportAnswers, deps: AnnualReportDeps): Promise<SubmitResult> {
  const facts = await requireOwnEligible(userId, registrationId, deps);
  const companyId = facts.companyId as string;
  const synced = await syncCompliance(registrationId, { maxAgeMs: PAGE_VIEW_SYNC_MS }, deps);
  const compliance = synced?.compliance ?? null;
  requireFilingWindow(compliance, deps.now());
  let requirements;
  try {
    requirements = await deps.provider.getRequirements(companyId, cycleFiscalYear(compliance, deps.now()));
  } catch (error) {
    if (errorCodeOf(error) === "E_STATE_NOT_SUPPORTED") {
      throw new AnnualReportError("unsupported", "Annual reports for your state can't be filed online yet. Our team will reach out to help.");
    }
    throw new AnnualReportError("unavailable", "The state's questions couldn't be loaded right now. Please try again in a few minutes.");
  }
  if (!requirements.isFilingRequired) throw new AnnualReportError("not_required", "Your state doesn't require an annual report, so there's nothing to file.");
  const current = (synced?.reports ?? []).find((report) => report.fiscalYear === requirements.fiscalYear) ?? null;
  if (isLocked(current)) throw new AnnualReportError("locked", "This year's annual report is already on its way, so the answers can't be changed.");

  const fields = requirements.fields.map(memberField);
  const validation = validateAnnualReportAnswers(fields, answers);
  if (!validation.ok) throw new AnnualReportError("invalid", "A few answers need a look before this can be sent.", validation.errors);

  const body = buildSubmission(requirements.fields, validation.cleaned, requirements.fiscalYear);
  let submitted;
  try {
    submitted = await deps.provider.submit(companyId, body);
  } catch (error) {
    const code = errorCodeOf(error);
    if (code === "E_VALIDATION_FAILED") {
      const known = new Set(fields.map((field) => field.fieldId));
      const fieldErrors: Record<string, string> = {};
      for (const fieldId of Object.keys(error instanceof DoolaApiError ? error.fields : {})) {
        if (known.has(fieldId)) fieldErrors[fieldId] = FIELD_PROBLEM;
      }
      throw new AnnualReportError("invalid", "The state's form didn't accept some answers. Check the ones marked and try again.", fieldErrors);
    }
    if (code === "E_ANNUAL_REPORT_ALREADY_EXISTS") {
      await syncCompliance(registrationId, {}, deps).catch(() => null);
      throw new AnnualReportError("conflict", "This year's annual report is already on file, so it can't be changed here. Our team can help.");
    }
    if (code === "E_STATE_NOT_SUPPORTED") {
      throw new AnnualReportError("unsupported", "Annual reports for your state can't be filed online yet. Our team will reach out to help.");
    }
    throw new AnnualReportError("unavailable", "Your answers couldn't be sent right now. Nothing was charged. Please try again in a few minutes.");
  }

  const report = submitted.report;
  const price = report.priceInCents ?? 0;
  const previousPriceCents = current?.priceInCents ?? compliance?.quotePriceCents ?? null;
  // A new price voids any checkout made for the old one: she pays the price on file, never an older one.
  const checkoutStale = current?.checkoutPriceCents !== null && current?.checkoutPriceCents !== undefined && current.checkoutPriceCents !== price;
  const row = await deps.store.upsertReport(
    { registrationId, userId: facts.userId, fiscalYear: report.fiscalYear },
    {
      annualReportId: report.annualReportId,
      status: report.status,
      priceInCents: price,
      answers: validation.cleaned,
      submittedAt: deps.now(),
      lastError: null,
      lastErrorAt: null,
      ...(checkoutStale
        ? { checkoutSessionId: null, checkoutUrl: null, checkoutPlanId: null, checkoutQuoteHash: null, checkoutPriceCents: null, checkoutExpiresAt: null }
        : {}),
    },
  );
  const confirmOutcome = price === 0 && report.status === "FILLED" ? await confirmReport(row.id, { source: "zero_fee" }, deps) : null;
  return {
    reportId: row.id,
    priceCents: price,
    previousPriceCents,
    priceChanged: previousPriceCents !== null && previousPriceCents !== price,
    isReplaced: submitted.isReplaced,
    confirmOutcome,
  };
}

// ─── Confirm (the hand-off to file) ────────────────────────────────────────────────────────────────────────────────

export type ConfirmOutcome = "confirmed" | "already_confirmed" | "not_paid" | "price_mismatch" | "confirm_failed" | "not_found" | "not_ready";

export async function confirmReport(
  reportId: number,
  options: { source: "payment" | "zero_fee" | "ops" | "retry" },
  deps: AnnualReportDeps,
): Promise<ConfirmOutcome> {
  const row = await deps.store.getReport(reportId);
  if (!row) return "not_found";
  const facts = await deps.filings.load(row.registrationId);
  if (!facts?.companyId || !facts.eligible) return "not_found";
  if (row.confirmedAt) return "already_confirmed";
  if (!row.annualReportId || row.priceInCents === null) return "not_ready";
  const price = row.priceInCents;
  // THE money rule: a priced report goes to the state only on a verified payment of exactly its price.
  if (price > 0 && !(row.paidAt && row.paidCents === price)) return "not_paid";

  const now = deps.now();
  const stampConfirmed = async (status: string) => {
    await deps.store.updateReport(row.id, { confirmedAt: now, status, lastError: null, lastErrorAt: null }, { confirmedAtIsNull: true });
  };

  // Re-read the provider's report right before the hand-off: its status and the price it will charge.
  let live: ProviderAnnualReport | null = null;
  try {
    live = await deps.provider.get(facts.companyId, row.annualReportId);
  } catch {
    live = null;
  }
  if (live && live.status !== "FILLED") {
    await stampConfirmed(live.status);
    return "already_confirmed";
  }
  if (live && live.priceInCents !== null && live.priceInCents !== price) {
    await deps.store.updateReport(row.id, { priceInCents: live.priceInCents, lastError: "price_mismatch", lastErrorAt: now });
    if (price === 0) return "not_paid";
    await deps.alerts.once({
      registrationId: row.registrationId,
      type: `ar_mismatch_${row.id}`,
      subject: `Annual report payment does not match the fee (order #${row.registrationId})`,
      lines: [
        `Order #${row.registrationId}, ${row.fiscalYear} annual report: she paid ${feeWords(row.paidCents ?? 0)} (payment ${row.paymentReference ?? "n/a"}), but the filing provider now prices it at ${feeWords(live.priceInCents)}.`,
        "It was NOT confirmed. Refund or collect the difference, then confirm it from /admin/llc.",
      ],
    });
    return "price_mismatch";
  }

  try {
    const confirmed = await deps.provider.confirm(facts.companyId, row.annualReportId);
    await stampConfirmed(confirmed?.status ?? "IN_PROGRESS");
    if (confirmed?.status === "AWAITING_INFORMATION") await alertAwaitingInformation(deps, facts, row);
    return "confirmed";
  } catch (error) {
    const code = errorCodeOf(error);
    if (code === "E_RESOURCE_CONFLICT") {
      // Wrong status for a confirm: someone already handed it over. Read it back and record what it is.
      const after = await deps.provider.get(facts.companyId, row.annualReportId).catch(() => null);
      if (after && after.status !== "FILLED") {
        await stampConfirmed(after.status);
        return "already_confirmed";
      }
    }
    await deps.store.updateReport(row.id, { lastError: `confirm:${code}`, lastErrorAt: now });
    await deps.alerts.once({
      registrationId: row.registrationId,
      type: `ar_confirm_failed_${row.id}`,
      subject: `Annual report confirm failed (order #${row.registrationId})`,
      lines: [
        `Order #${row.registrationId}, ${row.fiscalYear} annual report: the hand-off to the filing provider failed (${code}).`,
        row.paidAt
          ? `She already paid ${feeWords(row.paidCents ?? 0)} (payment ${row.paymentReference ?? "n/a"}). Her page says we've got her payment and our team is finishing her filing. The hourly sweep retries; you can also press "Confirm filing" on /admin/llc.`
          : `It was a no-fee report (source: ${options.source}). The hourly sweep retries; you can also press "Confirm filing" on /admin/llc.`,
      ],
    });
    return "confirm_failed";
  }
}

// ─── Webhooks ──────────────────────────────────────────────────────────────────────────────────────────────────────

export const ANNUAL_REPORT_EVENTS = [
  "company_annual_report_submitted",
  "company_annual_report_completed",
  "document_annualreport_uploaded",
] as const;

export function isAnnualReportEvent(eventName: string): boolean {
  return (ANNUAL_REPORT_EVENTS as readonly string[]).includes(eventName);
}

/**
 * One verified, deduplicated provider event (doolaWebhook.ts claims the eventId first). The submitted and completed
 * events carry only the company id, so both re-read everything for that filing; the document event also mirrors.
 */
export async function processAnnualReportEvent(
  event: { eventName: string; doolaCompanyId: string; documentId?: string | null },
  deps: AnnualReportDeps,
): Promise<"synced" | "ignored"> {
  if (!isAnnualReportEvent(event.eventName)) return "ignored";
  const facts = await deps.filings.findByCompanyId(event.doolaCompanyId);
  if (!facts?.eligible) return "ignored";
  const synced = await syncCompliance(facts.registrationId, {}, deps);
  if (!synced) return "ignored";
  if (event.eventName === "document_annualreport_uploaded") {
    await deps.documents.mirror({ facts: synced.facts, reports: synced.reports, documentId: event.documentId ?? null }).catch(() => ({ mirrored: 0 }));
  }
  return "synced";
}

// ─── What she sees ─────────────────────────────────────────────────────────────────────────────────────────────────

function stateNameOf(code: string | null | undefined): string {
  const key = String(code ?? "").trim().toUpperCase() as keyof typeof LLC_STATE_NAMES;
  return LLC_STATE_NAMES[key] ?? (String(code ?? "").trim() || "your state");
}

function filedOnWords(row: AnnualReportRow, compliance: ComplianceRow | null): string | null {
  if (row.status !== "FILING_COMPLETED") return null;
  const completed = row.completedAt ? row.completedAt.toISOString().slice(0, 10) : null;
  return dateWords(completed) ?? dateWords(compliance?.lastFiledDate ?? null);
}

/** Pure: the member card from what we have on file. */
export function buildMemberView(
  facts: Pick<FilingFacts, "registrationId" | "state">,
  compliance: ComplianceRow | null,
  reports: AnnualReportRow[],
  now: Date,
): MemberAnnualReportView {
  const stateName = stateNameOf(compliance?.state ?? facts.state);
  const dueWords = dateWords(compliance?.nextDueDate ?? null);
  const year = cycleFiscalYear(compliance, now);
  const current =
    reports.find((report) => report.fiscalYear === year) ??
    reports.find((report) => report.status !== null && report.status !== "FILING_COMPLETED") ??
    null;
  const lastFiled = reports.find((report) => report.status === "FILING_COMPLETED") ?? null;
  const open = filingWindowOpen(compliance, now);
  const opensWords = dateWords(filingOpensOn(compliance?.nextDueDate ?? null));

  let cardState: AnnualReportCardState;
  let body: string;
  if (current?.paidAt && !current.confirmedAt) {
    cardState = "paid_finishing";
    body = "We've got your payment. Our team is finishing your filing, and we'll email you when it's with the state.";
  } else if (current?.status === "AWAITING_INFORMATION") {
    cardState = "awaiting_information";
    body = "Our team is reviewing a detail. We'll reach out if we need anything from you.";
  } else if (current?.status === "FILING_COMPLETED") {
    cardState = "filed";
    const filed = filedOnWords(current, compliance);
    body = `${filed ? `Filed on ${filed}.` : "Filed."} Your filed report is in your documents.`;
  } else if (current?.status === "IN_PROGRESS" || (current?.confirmedAt && current.status === "FILLED")) {
    cardState = "filing";
    body = "We're filing it with the state. We'll let you know when it's done.";
  } else if (current?.status === "FILLED") {
    cardState = "saved";
    const price = current.priceInCents ?? 0;
    body = price > 0
      ? `Your answers are saved. The state fee is ${feeWords(price)}. Pay it and we send your report to the state.`
      : "Your answers are saved. There's no state fee, so we're sending it to the state.";
  } else if (compliance?.filingRequired === false || compliance?.status === "UNSUPPORTED_STATE") {
    cardState = "not_required";
    body = compliance?.status === "UNSUPPORTED_STATE" && compliance.filingRequired !== false
      ? `${stateName} annual reports can't be filed here yet. Our team will reach out if anything is needed.`
      : `${stateName} doesn't ask LLCs like yours for an annual report, so there's nothing to file.`;
  } else if (compliance?.status === "NOT_YET_DUE") {
    cardState = "not_yet_due";
    const filed = lastFiled ? filedOnWords(lastFiled, compliance) : null;
    body = `${filed ? `Your last one was filed on ${filed}. ` : ""}${dueWords ? `Your next annual report is due ${dueWords}. We'll email you before then.` : "We'll let you know when it's time to file."}`;
  } else if (compliance?.status === "OVERDUE") {
    cardState = "overdue";
    body = `It was due ${dueWords ?? "already"}. File it now to keep your LLC in good standing with ${stateName}. It takes a few minutes.`;
  } else if (compliance?.status === "UPCOMING" && open) {
    cardState = "due";
    body = `Your ${stateName} annual report is due ${dueWords ?? "soon"}. Answer the state's questions, pay the state fee, and we file it for you.`;
  } else if (compliance?.status === "UPCOMING") {
    // More than 90 days out: not open for filing yet (live check 2026-10-20).
    cardState = "not_yet_due";
    body = `Your next ${stateName} annual report is due ${dueWords ?? "later this year"}. Filing opens ${opensWords ? `on ${opensWords}` : "closer to the date"}, and we'll email you before it's due.`;
  } else {
    cardState = "checking";
    body = "We'll show your due date here as soon as we have it.";
  }

  const fileable = (cardState === "due" || cardState === "overdue" || cardState === "saved") && open;
  return {
    registrationId: facts.registrationId,
    stateName,
    cardState,
    headline: ANNUAL_REPORT_CARD_HEADLINES[cardState],
    body,
    dueDate: compliance?.nextDueDate ?? null,
    dueDateWords: dueWords,
    canFile: fileable,
    opensOnWords: !open && opensWords && (cardState === "not_yet_due" || cardState === "saved") ? opensWords : null,
    quote:
      compliance?.quotePriceCents !== null && compliance?.quotePriceCents !== undefined && compliance.filingRequired !== false
        ? { priceCents: compliance.quotePriceCents, isMinimum: compliance.quoteIsMinimum }
        : null,
    current: current
      ? {
          id: current.id,
          fiscalYear: current.fiscalYear,
          status: current.status,
          statusWords: current.paidAt && !current.confirmedAt ? "Paid, our team is finishing it" : ANNUAL_REPORT_STATUS_WORDS[current.status ?? ""] ?? "Not started",
          priceCents: current.priceInCents,
          paid: Boolean(current.paidAt),
          confirmed: Boolean(current.confirmedAt),
          filedOnWords: filedOnWords(current, compliance),
          canEdit: !isLocked(current),
          needsPayment: current.status === "FILLED" && !current.paidAt && !current.confirmedAt && (current.priceInCents ?? 0) > 0,
        }
      : null,
    history: reports
      .filter((report) => report !== current && report.status)
      .map((report) => ({
        fiscalYear: report.fiscalYear,
        statusWords: ANNUAL_REPORT_STATUS_WORDS[report.status ?? ""] ?? "Saved",
        filedOnWords: filedOnWords(report, compliance),
      })),
  };
}

export async function getMemberAnnualReport(userId: number, registrationId: number, deps: AnnualReportDeps): Promise<MemberAnnualReportView | null> {
  const facts = await deps.filings.load(registrationId);
  if (!facts || facts.userId !== userId) throw new AnnualReportError("not_found", "This LLC could not be found in your workspace.");
  if (!facts.eligible) return null;
  const synced = await syncCompliance(registrationId, { maxAgeMs: PAGE_VIEW_SYNC_MS }, deps);
  if (!synced) return null;
  return buildMemberView(facts, synced.compliance, synced.reports, deps.now());
}

// ─── Ops ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export type OpsAnnualReportView = {
  eligible: boolean;
  compliance: {
    state: string | null;
    status: string | null;
    nextDueDate: string | null;
    lastFiledDate: string | null;
    filingRequired: boolean | null;
    quotePriceCents: number | null;
    quoteIsMinimum: boolean;
    syncedAt: number | null;
    lastError: string | null;
  } | null;
  reports: Array<{
    id: number;
    fiscalYear: number;
    annualReportId: string | null;
    status: string | null;
    priceInCents: number | null;
    paidCents: number | null;
    paidAt: number | null;
    paymentReference: string | null;
    submittedAt: number | null;
    confirmedAt: number | null;
    completedAt: number | null;
    hasDocument: boolean;
    lastError: string | null;
    canConfirm: boolean;
  }>;
};

/** Ops: the same rows, read again from the provider when the last read is over 10 minutes old. */
export async function getOpsAnnualReports(registrationId: number, deps: AnnualReportDeps): Promise<OpsAnnualReportView> {
  const synced = await syncCompliance(registrationId, { maxAgeMs: PAGE_VIEW_SYNC_MS }, deps).catch(() => null);
  if (!synced) return { eligible: false, compliance: null, reports: [] };
  const c = synced.compliance;
  return {
    eligible: true,
    compliance: c
      ? {
          state: c.state,
          status: c.status,
          nextDueDate: c.nextDueDate,
          lastFiledDate: c.lastFiledDate,
          filingRequired: c.filingRequired,
          quotePriceCents: c.quotePriceCents,
          quoteIsMinimum: c.quoteIsMinimum,
          syncedAt: c.syncedAt?.getTime() ?? null,
          lastError: c.lastError,
        }
      : null,
    reports: synced.reports.map((row) => ({
      id: row.id,
      fiscalYear: row.fiscalYear,
      annualReportId: row.annualReportId,
      status: row.status,
      priceInCents: row.priceInCents,
      paidCents: row.paidCents,
      paidAt: row.paidAt?.getTime() ?? null,
      paymentReference: row.paymentReference,
      submittedAt: row.submittedAt?.getTime() ?? null,
      confirmedAt: row.confirmedAt?.getTime() ?? null,
      completedAt: row.completedAt?.getTime() ?? null,
      hasDocument: Boolean(row.filedDocumentId),
      lastError: row.lastError,
      // Paid (or no fee) and not handed over yet: ops may push the confirm.
      canConfirm: !row.confirmedAt && row.status === "FILLED" && row.priceInCents !== null && (row.priceInCents === 0 || (Boolean(row.paidAt) && row.paidCents === row.priceInCents)),
    })),
  };
}

/** Ops "Confirm filing": the same guarded confirm; it still refuses without a verified payment. */
export async function opsConfirmAnnualReport(registrationId: number, reportId: number, deps: AnnualReportDeps): Promise<ConfirmOutcome> {
  const row = await deps.store.getReport(reportId);
  if (!row || row.registrationId !== registrationId) return "not_found";
  return confirmReport(reportId, { source: "ops" }, deps);
}

/** Retry the confirm for every paid, unconfirmed report (the hourly sweep). */
export async function retryPaidUnconfirmed(deps: AnnualReportDeps): Promise<Record<string, number>> {
  const outcomes: Record<string, number> = {};
  for (const row of await deps.store.listPaidUnconfirmed(50)) {
    const outcome = await confirmReport(row.id, { source: "retry" }, deps).catch(() => "confirm_failed" as const);
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  }
  return outcomes;
}

/** Re-read calendars not read in DAILY_SYNC_MS (the hourly sweep keeps every filing at most a day old). */
export async function syncStaleCalendars(deps: AnnualReportDeps, limit = 25): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  // Read a wider window than `limit`: a filing this server can't ask about (made in the other provider environment)
  // stays stale forever and must never crowd out the ones it can.
  const stale = await deps.store.listStaleFilings(new Date(deps.now().getTime() - DAILY_SYNC_MS), limit * 8);
  for (const filing of stale) {
    if (synced >= limit) break;
    try {
      if (await syncCompliance(filing.registrationId, {}, deps)) synced += 1;
    } catch {
      failed += 1;
    }
  }
  return { synced, failed };
}

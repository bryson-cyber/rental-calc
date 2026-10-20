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
 * and never confirms anything (paid or no-fee) without a successful re-read of the provider's report that shows that
 * same price just before the hand-off. A missing price is unknown, never $0. Every step is safe to repeat (double
 * clicks, webhook replays, payment retries): stamps are guarded updates and the provider's confirm is idempotent.
 *
 * Filing window (2026-10-20 review): a cycle opens FILING_WINDOW_DAYS before the calendar's due date (or when it's
 * overdue) and files the due date's year only when that is unambiguous (filingCycle). The form, the submit and the
 * checkout refuse outside it, so the File button never reopens right after a filing rolls the calendar forward.
 */
import { DoolaApiError } from "../doola";
import { LLC_STATE_NAMES } from "../../../shared/llc";
import {
  ANNUAL_REPORT_CARD_HEADLINES,
  ANNUAL_REPORT_STATUS_WORDS,
  dateWords,
  feeWords,
  validateAnnualReportAnswers,
  type AnnualReportAnswers,
  type AnnualReportCardState,
  type AnnualReportValue,
  type MemberAnnualReportField,
  type MemberAnnualReportView,
} from "../../../shared/llcAnnualReports";
import { OPS_FEE_ACTION_LABELS } from "../../../shared/llcAnnualReportOps";
import {
  COMPANY_DETAIL_KEYS,
  type AnnualReportField,
  type AnnualReportProvider,
  type AnnualReportRequirements,
  type AnnualReportSubmission,
  type CompanyDetailKey,
  type ProviderAnnualReport,
} from "./provider";
import type { AnnualReportRow, AnnualReportStore, ComplianceRow, ReportPatch } from "./store";
import type { FilingFacts, FilingSource } from "./filings";
import { addDays, daysBetween, pacificToday } from "./dates";

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
/** After a failed calendar read, the next sweep reads it again within about this long. */
export const RETRY_AFTER_FAILURE_MS = 60 * 60_000;

export type AnnualReportErrorCode =
  | "not_found"
  | "not_eligible"
  | "not_required"
  | "locked"
  | "invalid"
  | "conflict"
  | "unsupported"
  | "unavailable"
  | "not_open";

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

/** A cycle opens this many days before the calendar's due date (the 60/30/7-day reminders all fall inside it). */
export const FILING_WINDOW_DAYS = 90;

export type FilingCycle = {
  /** Fileable now: within FILING_WINDOW_DAYS of the due date, or overdue. */
  open: boolean;
  overdue: boolean;
  dueDate: string | null;
  /** The first day it can be filed ("yyyy-MM-dd"): the due date less FILING_WINDOW_DAYS. */
  opensOn: string | null;
  /**
   * The fiscal year this cycle files, only when it is unambiguous: open, and overdue or due in this (Pacific) year.
   * Null otherwise, including a January to March due date whose window starts the year before (which year the
   * provider means is the open question in docs/LLC_ANNUAL_REPORTS_2026-10-20.md).
   */
  fiscalYear: number | null;
};

/** The calendar's cycle as of `now` (pure). Closed without a due date, when the state asks for none, or unsupported. */
export function filingCycle(
  compliance: Pick<ComplianceRow, "nextDueDate" | "filingRequired" | "status"> | null,
  now: Date,
): FilingCycle {
  const due = compliance?.nextDueDate ?? null;
  if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due) || compliance?.filingRequired === false || compliance?.status === "UNSUPPORTED_STATE") {
    return { open: false, overdue: false, dueDate: due, opensOn: null, fiscalYear: null };
  }
  const today = pacificToday(now);
  const days = daysBetween(today, due);
  const overdue = days < 0 || compliance?.status === "OVERDUE";
  const open = overdue || days <= FILING_WINDOW_DAYS;
  const dueYear = Number(due.slice(0, 4));
  return {
    open,
    overdue,
    dueDate: due,
    opensOn: addDays(due, -FILING_WINDOW_DAYS),
    fiscalYear: open && (overdue || today.slice(0, 4) === due.slice(0, 4)) ? dueYear : null,
  };
}

/** The cycle's report: the one submitted for this due date, else the one for this fiscal year. */
export function reportForCycle(reports: readonly AnnualReportRow[], dueDate: string | null, fiscalYear: number | null): AnnualReportRow | null {
  return (dueDate ? reports.find((report) => report.dueDate === dueDate) : undefined)
    ?? (fiscalYear !== null ? reports.find((report) => report.fiscalYear === fiscalYear) : undefined)
    ?? null;
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
      // Her mailing address only: when she chose the agent's address for mail, the field stays empty (and is not sent
      // unless she types one), so her business address never goes out as her mail address.
      const address =
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

/** Paid, handed over or past FILLED: her answers can't change and the cycle needs nothing more from her. */
export const isLocked = (row: AnnualReportRow | null | undefined) =>
  Boolean(row && (row.paidAt || row.confirmedAt || (row.status && row.status !== "FILLED")));

// ─── Calendar and report sync ──────────────────────────────────────────────────────────────────────────────────────

export type SyncResult = { facts: FilingFacts; compliance: ComplianceRow | null; reports: AnnualReportRow[] };

/** One AWAITING_INFORMATION episode: the provider's updatedAt for it, else today's date (a new episode, a new alert). */
function awaitingEpisode(updatedAt: string | null | undefined, now: Date): string {
  const compact = String(updatedAt ?? "").replace(/[^0-9A-Za-z]/g, "").slice(0, 24);
  return compact || pacificToday(now).replaceAll("-", "");
}

async function alertAwaitingInformation(deps: AnnualReportDeps, facts: FilingFacts, row: AnnualReportRow, episode: string) {
  await deps.alerts.once({
    registrationId: facts.registrationId,
    type: `ar_awaiting_${row.id}_${episode}`,
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
      await alertAwaitingInformation(deps, facts, saved, awaitingEpisode(report.updatedAt, now));
    }
  }
}

/** Ops hear once per cycle when the window is open but which fiscal year it files can't be told (filingCycle). */
async function alertYearUnconfirmed(deps: AnnualReportDeps, facts: FilingFacts, dueDate: string, why: string) {
  await deps.alerts.once({
    registrationId: facts.registrationId,
    type: `ar_year_unconfirmed_${facts.registrationId}_${dueDate}`,
    subject: `Annual report filing year needs confirming (order #${facts.registrationId})`,
    lines: [
      `Order #${facts.registrationId} (${facts.companyName || "company"}): the annual report due ${dueDate} is inside the filing window, but ${why}.`,
      "Her page says we're confirming her filing year with the state and will email her; filing stays closed until it's clear. Ask the provider which fiscalYear satisfies this due date (see docs/LLC_ANNUAL_REPORTS_2026-10-20.md, open question).",
    ],
  });
}

/** The wrong-year safety net: a filed report whose due date is still the calendar's next due date two weeks later. */
const WRONG_YEAR_GRACE_MS = 14 * 86_400_000;

async function checkFiledCycles(deps: AnnualReportDeps, facts: FilingFacts, compliance: ComplianceRow, reports: AnnualReportRow[]) {
  const now = deps.now();
  for (const row of reports) {
    if (row.status !== "FILING_COMPLETED" || !row.dueDate || !row.completedAt) continue;
    if (row.dueDate !== compliance.nextDueDate || now.getTime() - row.completedAt.getTime() < WRONG_YEAR_GRACE_MS) continue;
    await deps.alerts.once({
      registrationId: facts.registrationId,
      type: `ar_wrong_year_${row.id}`,
      subject: `Annual report may have been filed for the wrong year (order #${facts.registrationId})`,
      lines: [
        `Order #${facts.registrationId}, the ${row.fiscalYear} annual report was filed (completed ${row.completedAt.toISOString().slice(0, 10)}) for the cycle due ${row.dueDate}, but two weeks later the provider's calendar still says the next one is due ${compliance.nextDueDate} (${compliance.status ?? "no status"}).`,
        "It may have been filed for a different fiscal year than the state expected. Check with the provider before she is told anything; her page still shows it as filed.",
      ],
    });
  }
}

/**
 * Read the provider's compliance calendar, state fee quote and report list for one filing into our rows. With
 * `maxAgeMs`, a calendar read more recently than that is reused (page views); without it, it always reads. Never
 * throws for a provider outage: the last good values stay and lastError says what failed. A read whose calendar
 * failed is not counted fresh: syncedAt stays at most RETRY_AFTER_FAILURE_MS short of stale, so the hourly sweep
 * (and the next page view) tries again within about an hour instead of trusting old values for a day.
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

  // The calendar drives the window: without it this read is not fresh (see above).
  const retrySyncedAt = new Date(now.getTime() - DAILY_SYNC_MS + RETRY_AFTER_FAILURE_MS);
  const syncedAt = calendar ? now : existing?.syncedAt && existing.syncedAt < retrySyncedAt ? existing.syncedAt : retrySyncedAt;
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
    syncedAt,
    lastError: failure,
  };
  await deps.store.upsertCompliance(compliance);
  if (list) await applyProviderReports(deps, facts, list);

  let reports = await deps.store.listReports(registrationId);
  if (reports.some((report) => report.status === "FILING_COMPLETED" && !report.filedDocumentId)) {
    const result = await deps.documents.mirror({ facts, reports }).catch(() => ({ mirrored: 0 }));
    if (result.mirrored > 0) reports = await deps.store.listReports(registrationId);
  }
  if (calendar) {
    const cycle = filingCycle(compliance, now);
    if (cycle.open && cycle.fiscalYear === null && cycle.dueDate && !isLocked(reportForCycle(reports, cycle.dueDate, null))) {
      await alertYearUnconfirmed(deps, facts, cycle.dueDate, `its window opened ${cycle.opensOn} in the year before the due date, so the fiscal year to file is not confirmed`);
    }
    await checkFiledCycles(deps, facts, compliance, reports);
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

const YEAR_UNCONFIRMED_WORDS = "We're confirming your filing year with the state. We'll email you when it's ready to file.";

export type OpenFilingCycle = FilingCycle & { open: true; dueDate: string; fiscalYear: number };

/** The cycle as of now, or a plain refusal: the form, the submit and the checkout all go through this. */
export function requireOpenCycle(compliance: ComplianceRow | null, now: Date): OpenFilingCycle {
  if (compliance?.filingRequired === false) throw new AnnualReportError("not_required", "Your state doesn't require an annual report, so there's nothing to file.");
  if (compliance?.status === "UNSUPPORTED_STATE") {
    throw new AnnualReportError("unsupported", "Annual reports for your state can't be filed online yet. Our team will reach out to help.");
  }
  const cycle = filingCycle(compliance, now);
  if (!cycle.dueDate) throw new AnnualReportError("not_open", "We don't have your annual report due date yet. We'll let you know when it's time to file.");
  if (!cycle.open) {
    const opens = dateWords(cycle.opensOn);
    throw new AnnualReportError("not_open", `Your next annual report can't be filed yet.${opens ? ` Filing opens ${opens}.` : ""} We'll email you before then.`);
  }
  if (cycle.fiscalYear === null) throw new AnnualReportError("not_open", YEAR_UNCONFIRMED_WORDS);
  return cycle as OpenFilingCycle;
}

/** Sync (at most every 10 minutes) and require the open cycle; for app glue (the checkout) that must refuse the same way. */
export async function requireOpenFiling(registrationId: number, deps: AnnualReportDeps): Promise<{ facts: FilingFacts; cycle: OpenFilingCycle; reports: AnnualReportRow[] }> {
  const synced = await syncCompliance(registrationId, { maxAgeMs: PAGE_VIEW_SYNC_MS }, deps);
  if (!synced) throw new AnnualReportError("not_eligible", "Annual reports open here once your LLC is official.");
  return { facts: synced.facts, cycle: requireOpenCycle(synced.compliance, deps.now()), reports: synced.reports };
}

/** The state's questions for exactly the cycle's fiscal year; a different year back means the year isn't confirmed. */
async function loadCycleRequirements(facts: FilingFacts, cycle: OpenFilingCycle, deps: AnnualReportDeps): Promise<AnnualReportRequirements> {
  let requirements: AnnualReportRequirements;
  try {
    requirements = await deps.provider.getRequirements(facts.companyId as string, cycle.fiscalYear);
  } catch (error) {
    if (errorCodeOf(error) === "E_STATE_NOT_SUPPORTED") {
      throw new AnnualReportError("unsupported", "Annual reports for your state can't be filed online yet. Our team will reach out to help.");
    }
    throw new AnnualReportError("unavailable", "The state's questions couldn't be loaded right now. Please try again in a few minutes.");
  }
  if (requirements.fiscalYear !== cycle.fiscalYear) {
    await alertYearUnconfirmed(deps, facts, cycle.dueDate, `the requirements asked for fiscal year ${cycle.fiscalYear} came back for ${requirements.fiscalYear}`);
    throw new AnnualReportError("not_open", YEAR_UNCONFIRMED_WORDS);
  }
  return requirements;
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
  const { cycle, reports } = await requireOpenFiling(registrationId, deps);
  const compliance = await deps.store.getCompliance(registrationId);
  const requirements = await loadCycleRequirements(facts, cycle, deps);
  const current = reportForCycle(reports, cycle.dueDate, cycle.fiscalYear);
  if (isLocked(current)) throw new AnnualReportError("locked", "This year's annual report is already on its way, so the answers can't be changed.");
  const fields = requirements.fields.map(memberField);
  return {
    fiscalYear: requirements.fiscalYear,
    dueDate: cycle.dueDate,
    dueDateWords: dateWords(cycle.dueDate),
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
  /** The fee the provider fixed for these answers; null while it hasn't said (never read as $0). */
  priceCents: number | null;
  /** What she was shown before this submit: the fee of her earlier answers, else the state quote. */
  previousPriceCents: number | null;
  priceChanged: boolean;
  isReplaced: boolean;
  /** A zero-fee report goes to the state straight away. */
  confirmOutcome: ConfirmOutcome | null;
};

const FIELD_PROBLEM = "Check this answer.";
const PAID_LOCKED_WORDS = "Your payment is in, so your answers can't be changed now. We'll email you when your report is with the state.";

/** Names this submit attempt for the provider's idempotency key: what the row looked like before it. */
function submitAttempt(row: AnnualReportRow | null): string {
  return row ? `${row.id}:${row.annualReportId ?? "none"}:${row.submittedAt?.getTime() ?? 0}` : "first";
}

export async function submitAnnualReport(userId: number, registrationId: number, answers: AnnualReportAnswers, deps: AnnualReportDeps): Promise<SubmitResult> {
  const facts = await requireOwnEligible(userId, registrationId, deps);
  const companyId = facts.companyId as string;
  const { cycle, reports } = await requireOpenFiling(registrationId, deps);
  const compliance = await deps.store.getCompliance(registrationId);
  const requirements = await loadCycleRequirements(facts, cycle, deps);
  if (!requirements.isFilingRequired) throw new AnnualReportError("not_required", "Your state doesn't require an annual report, so there's nothing to file.");
  // The row this submit writes (one per fiscal year) and the cycle's report (by due date): never one already paid,
  // handed over or filed, so one due date is never filed twice under two fiscal years.
  const current = reports.find((report) => report.fiscalYear === cycle.fiscalYear) ?? null;
  if (isLocked(current) || isLocked(reportForCycle(reports, cycle.dueDate, cycle.fiscalYear))) {
    throw new AnnualReportError("locked", "This year's annual report is already on its way, so the answers can't be changed.");
  }

  const fields = requirements.fields.map(memberField);
  const validation = validateAnnualReportAnswers(fields, answers);
  if (!validation.ok) throw new AnnualReportError("invalid", "A few answers need a look before this can be sent.", validation.errors);

  const body = buildSubmission(requirements.fields, validation.cleaned, cycle.fiscalYear);
  let submitted;
  try {
    submitted = await deps.provider.submit(companyId, body, { attempt: submitAttempt(current) });
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
  // A missing price is unknown, never $0: stored as null, no checkout and no zero-fee confirm until it's known.
  const price = report.priceInCents;
  const previousPriceCents = current?.priceInCents ?? compliance?.quotePriceCents ?? null;
  // A new price voids any checkout made for the old one: she pays the price on file, never an older one.
  const checkoutStale = current?.checkoutPriceCents !== null && current?.checkoutPriceCents !== undefined && current.checkoutPriceCents !== price;
  // Guarded: a payment claimed (or a hand-off) since the check above wins; nothing about the paid report changes.
  const row = await deps.store.upsertReport(
    { registrationId, userId: facts.userId, fiscalYear: report.fiscalYear },
    {
      dueDate: cycle.dueDate,
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
    { paidAtIsNull: true, confirmedAtIsNull: true },
  );
  if (row.paidAt || row.confirmedAt) throw new AnnualReportError("locked", PAID_LOCKED_WORDS);
  const confirmOutcome = price === 0 && report.status === "FILLED" ? await confirmReport(row.id, { source: "zero_fee" }, deps) : null;
  return {
    reportId: row.id,
    priceCents: price,
    previousPriceCents,
    priceChanged: previousPriceCents !== null && price !== null && previousPriceCents !== price,
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
  const now = deps.now();
  // THE money rule: a priced report goes to the state only on a verified payment of exactly its price. A payment for
  // a fee that has since changed is ops' call (the two fee buttons on /admin/llc); they hear once.
  if (price > 0 && !(row.paidAt && row.paidCents === price)) {
    if (row.paidAt && row.lastError !== "price_mismatch") {
      await deps.store.updateReport(row.id, { lastError: "price_mismatch", lastErrorAt: now }, { confirmedAtIsNull: true });
      await alertFeeChanged(deps, row, price);
    }
    return "not_paid";
  }

  // An ops note (a difference we absorbed) survives the stamp, so the row keeps its audit line.
  const keptNote = row.lastError?.startsWith("ops:") ? row.lastError : null;
  const stampConfirmed = async (status: string) => {
    await deps.store.updateReport(row.id, { confirmedAt: now, status, lastError: keptNote, lastErrorAt: keptNote ? row.lastErrorAt : null }, { confirmedAtIsNull: true });
  };
  const failed = async (code: string): Promise<ConfirmOutcome> => {
    await deps.store.updateReport(row.id, { lastError: `confirm:${code}`.slice(0, 255), lastErrorAt: now });
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
  };

  // Re-read the provider's report right before the hand-off: its status and the price it will charge. Nothing is
  // confirmed without this read (paid or no-fee); a failed read is a confirm_failed the hourly sweep retries.
  let live: ProviderAnnualReport | null;
  try {
    live = await deps.provider.get(facts.companyId, row.annualReportId);
  } catch (error) {
    return failed(`reread:${errorCodeOf(error)}`);
  }
  if (!live) return failed("reread:not_found");
  if (live.status !== "FILLED") {
    await stampConfirmed(live.status);
    return "already_confirmed";
  }
  if (live.priceInCents === null) return failed("reread:no_price");
  if (live.priceInCents !== price) {
    await deps.store.updateReport(row.id, { priceInCents: live.priceInCents, lastError: "price_mismatch", lastErrorAt: now }, { confirmedAtIsNull: true });
    if (!row.paidAt) return "not_paid";
    await alertFeeChanged(deps, { ...row, priceInCents: live.priceInCents }, live.priceInCents);
    return "price_mismatch";
  }

  try {
    const confirmed = await deps.provider.confirm(facts.companyId, row.annualReportId);
    await stampConfirmed(confirmed?.status ?? "IN_PROGRESS");
    if (confirmed?.status === "AWAITING_INFORMATION") await alertAwaitingInformation(deps, facts, row, awaitingEpisode(confirmed.updatedAt, now));
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
    return failed(code);
  }
}

/** A paid report whose fee is no longer what she paid: never confirmed; ops pick one of the two fee buttons. */
async function alertFeeChanged(deps: AnnualReportDeps, row: AnnualReportRow, feeCents: number) {
  await deps.alerts.once({
    registrationId: row.registrationId,
    type: `ar_mismatch_${row.id}`,
    subject: `Annual report payment does not match the fee (order #${row.registrationId})`,
    lines: [
      `Order #${row.registrationId}, ${row.fiscalYear} annual report: she paid ${feeWords(row.paidCents ?? 0)} (payment ${row.paymentReference ?? "n/a"}), but the filing provider now prices it at ${feeWords(feeCents)}.`,
      `It was NOT confirmed. On /admin/llc, open the order's Annual reports and either refund her payment in the payment processor and press "${OPS_FEE_ACTION_LABELS.refunded_pay_again}" (she gets an email with a link to pay the new fee), or press "${OPS_FEE_ACTION_LABELS.absorb_difference}" to file it now with us covering the difference.`,
    ],
  });
}

/** The two ops buttons for a paid report whose fee changed (the alerts name them by these labels). */
export { OPS_FEE_ACTION_LABELS };

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

/**
 * Pure: the member card from what we have on file. Due and overdue (with the File button) only while the cycle is
 * open (filingCycle); before that it's "Not due yet" with the day filing opens. The cycle's report is matched by its
 * due date, then its fiscal year, so a report filed for this due date keeps the card "filed" until the calendar
 * moves on, and the next cycle's File button only shows once that cycle opens.
 */
export function buildMemberView(
  facts: Pick<FilingFacts, "registrationId" | "state">,
  compliance: ComplianceRow | null,
  reports: AnnualReportRow[],
  now: Date,
): MemberAnnualReportView {
  const stateName = stateNameOf(compliance?.state ?? facts.state);
  const dueWords = dateWords(compliance?.nextDueDate ?? null);
  const cycle = filingCycle(compliance, now);
  const fileable = cycle.open && cycle.fiscalYear !== null;
  const current =
    reportForCycle(reports, cycle.dueDate, cycle.fiscalYear) ??
    reports.find((report) => report.status !== null && report.status !== "FILING_COMPLETED") ??
    null;
  const lastFiled = reports.find((report) => report.status === "FILING_COMPLETED") ?? null;

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
  } else if (current?.status === "FILLED" && fileable) {
    cardState = "saved";
    body = current.priceInCents === null
      ? "Your answers are saved. We're getting the state fee for them and will show it here."
      : current.priceInCents > 0
        ? `Your answers are saved. The state fee is ${feeWords(current.priceInCents)}. Pay it and we send your report to the state.`
        : "Your answers are saved. There's no state fee, so we're sending it to the state.";
  } else if (compliance?.filingRequired === false || compliance?.status === "UNSUPPORTED_STATE") {
    cardState = "not_required";
    body = compliance?.status === "UNSUPPORTED_STATE" && compliance.filingRequired !== false
      ? `${stateName} annual reports can't be filed here yet. Our team will reach out if anything is needed.`
      : `${stateName} doesn't ask LLCs like yours for an annual report, so there's nothing to file.`;
  } else if (!compliance || (!cycle.dueDate && !compliance.status)) {
    cardState = "checking";
    body = "We'll show your due date here as soon as we have it.";
  } else if (cycle.open && cycle.fiscalYear === null) {
    cardState = "confirming_year";
    body = `Your ${stateName} annual report is due ${dueWords ?? "soon"}. We're confirming your filing year with the state, and we'll email you when it's ready to file.`;
  } else if (cycle.open && cycle.overdue) {
    cardState = "overdue";
    body = `It was due ${dueWords ?? "already"}. File it now to keep your LLC in good standing with ${stateName}. It takes a few minutes.`;
  } else if (cycle.open) {
    cardState = "due";
    body = `Your ${stateName} annual report is due ${dueWords ?? "soon"}. Answer the state's questions, pay the state fee, and we file it for you.`;
  } else {
    cardState = "not_yet_due";
    const filed = lastFiled ? filedOnWords(lastFiled, compliance) : null;
    const opens = dateWords(cycle.opensOn);
    body = `${filed ? `Your last one was filed on ${filed}. ` : ""}${dueWords ? `Your next annual report is due ${dueWords}.${opens ? ` Filing opens ${opens}.` : ""} We'll email you before then.` : "We'll let you know when it's time to file."}`;
  }

  const canFile = fileable && (cardState === "due" || cardState === "overdue" || cardState === "saved");
  return {
    registrationId: facts.registrationId,
    stateName,
    cardState,
    headline: ANNUAL_REPORT_CARD_HEADLINES[cardState],
    body,
    dueDate: compliance?.nextDueDate ?? null,
    dueDateWords: dueWords,
    opensOnWords: cycle.open ? null : dateWords(cycle.opensOn),
    canFile,
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
    dueDate: string | null;
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
    /** Paid, not handed over, and the fee is no longer what she paid: the two fee buttons. */
    feeChanged: boolean;
    /** "Fee changed: refunded, let her pay again" also applies to an unpaid report a mismatched payment hit. */
    canResetPayment: boolean;
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
      dueDate: row.dueDate,
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
      feeChanged: isFeeChanged(row),
      canResetPayment: canResetPayment(row),
    })),
  };
}

const isFeeChanged = (row: AnnualReportRow) =>
  Boolean(row.paidAt) && !row.confirmedAt && row.priceInCents !== null && row.paidCents !== row.priceInCents;

const canResetPayment = (row: AnnualReportRow) =>
  !row.confirmedAt && row.status === "FILLED" && (isFeeChanged(row) || (!row.paidAt && row.lastError === "payment_mismatch"));

export type OpsFeeActionOutcome = "reset" | "not_allowed" | ConfirmOutcome;

/**
 * Ops "Fee changed: refunded, let her pay again", after ops refunded her payment in the payment processor: the
 * payment and the checkout come off the report (guarded: never once it's handed over), so her page asks for the fee
 * on file again with a fresh checkout. The app emails her the pay link (router glue). An audit line stays in
 * lastError.
 */
export async function opsResetAnnualReportPayment(registrationId: number, reportId: number, deps: AnnualReportDeps): Promise<OpsFeeActionOutcome> {
  const row = await deps.store.getReport(reportId);
  if (!row || row.registrationId !== registrationId) return "not_found";
  if (!canResetPayment(row)) return "not_allowed";
  const note = `ops: refunded ${row.paidAt ? `${feeWords(row.paidCents ?? 0)} payment ${row.paymentReference ?? "n/a"}` : "a mismatched payment"}; she pays ${row.priceInCents !== null ? feeWords(row.priceInCents) : "the fee"} again`;
  const reset = await deps.store.updateReport(
    row.id,
    {
      paymentReference: null,
      paidAt: null,
      paidCents: null,
      checkoutSessionId: null,
      checkoutUrl: null,
      checkoutPlanId: null,
      checkoutQuoteHash: null,
      checkoutPriceCents: null,
      checkoutExpiresAt: null,
      lastError: note.slice(0, 255),
      lastErrorAt: deps.now(),
    },
    { confirmedAtIsNull: true },
  );
  return reset ? "reset" : "not_allowed";
}

/**
 * Ops "Difference absorbed, file it": we cover the gap, so the payment on file is taken as the fee on file (an audit
 * line with both amounts stays in lastError), then the normal guarded confirm runs, re-reading the provider's price
 * first like every confirm.
 */
export async function opsAbsorbAnnualReportDifference(registrationId: number, reportId: number, deps: AnnualReportDeps): Promise<OpsFeeActionOutcome> {
  const row = await deps.store.getReport(reportId);
  if (!row || row.registrationId !== registrationId) return "not_found";
  if (!isFeeChanged(row) || row.priceInCents === null) return "not_allowed";
  const note = `ops: absorbed the difference (paid ${feeWords(row.paidCents ?? 0)}, fee ${feeWords(row.priceInCents)}, payment ${row.paymentReference ?? "n/a"})`;
  const absorbed = await deps.store.updateReport(
    row.id,
    { paidCents: row.priceInCents, lastError: note.slice(0, 255), lastErrorAt: deps.now() },
    { confirmedAtIsNull: true, paidAtIsNotNull: true },
  );
  if (!absorbed) return "not_allowed";
  return confirmReport(row.id, { source: "ops" }, deps);
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

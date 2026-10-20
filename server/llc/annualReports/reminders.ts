/**
 * Annual report reminders (the owner, 2026-10-20): an email 60, 30 and 7 days before the provider's next due date and
 * once when it's overdue. Runs from the hourly sweep on the LLC status-poll heartbeat.
 *
 * Rules (same as Her First Order's port):
 * - One stage at a time: the most urgent stage that applies today (Pacific date). A client whose LLC was formed 20
 *   days before the due date gets the 30-day message, never the 60-day one late.
 * - Claim-once per filing + due date + stage in llc_email_log (`annual_report_<due>_<stage>`), the same send-once
 *   table every LLC email here uses; a failed send lets the claim go so a later pass retries. A new due date (next
 *   year) is a new set of claims.
 * - Nothing once that cycle's report is paid, handed to the state or filed; nothing for test or demo filings.
 * - Sent to the account email that owns the filing, through this app's client email transport (SMTP, "Inayah"),
 *   exactly like the formation lifecycle emails. Those are service emails with no unsubscribe list in this app, so
 *   none is checked here either.
 *
 * Texts: none. The owner allowed texts only on a recorded agreement to texts, US/Canada only. This app's LLC wizard
 * never asks about texts, users carry no consent field, and the only SMS lists (webinar registrants imported from
 * WebinarJam/Zapier, newsletter preferences keyed on HubSpot) record opt-outs, not an agreement this app captured. So
 * there is no consent source that covers LLC members, and reminders are email only. Revisit if the wizard ever records
 * an explicit agreement to texts.
 */
import { and, eq } from "drizzle-orm";
import { llcEmailLog } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { deliverClientEmail, statusUrl, type ClientEmailContent } from "../clientEmails";
import { LLC_STATE_NAMES } from "../../../shared/llc";
import { addDaysToDate, dateWords, pacificToday } from "../../../shared/llcAnnualReports";
import { annualReportReminderEmail, type ReminderStage } from "./copy";
import { isDuplicateKeyError } from "./defaults";
import { loadReminderRecipient } from "./filings";
import { cycleFiscalYear, type AnnualReportDeps } from "./service";
import { defaultAnnualReportDeps } from "./defaults";

export { pacificToday };

const DAY_MS = 86_400_000;

export function daysBetween(fromYmd: string, toYmd: string): number {
  const from = Date.parse(`${fromYmd}T00:00:00Z`);
  const to = Date.parse(`${toYmd}T00:00:00Z`);
  return Math.round((to - from) / DAY_MS);
}

export function addDays(ymd: string, days: number): string {
  return addDaysToDate(ymd, days) ?? ymd;
}

/** The one stage that applies today, or null (more than 60 days out). */
export function reminderStageFor(nextDueDate: string, today: string, calendarStatus?: string | null): ReminderStage | null {
  const days = daysBetween(today, nextDueDate);
  if (!Number.isFinite(days)) return null;
  if (days < 0 || calendarStatus === "OVERDUE") return "overdue";
  if (days <= 7) return "7";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  return null;
}

export const reminderEmailType = (dueDate: string, stage: ReminderStage) => `annual_report_${dueDate}_${stage}`;

type ClaimKey = { registrationId: number; type: string };

export type ReminderDeps = {
  service: AnnualReportDeps;
  claims: {
    /** True when this pass owns the send (the first claim). */
    claim(key: ClaimKey): Promise<boolean>;
    /** A send that failed: the claim is let go so a later pass can retry. */
    release(key: ClaimKey): Promise<void>;
  };
  recipient(registrationId: number): Promise<{ email: string; firstName: string } | null>;
  portalUrl(registrationId: number): string;
  email: {
    send(to: string, content: ClientEmailContent): Promise<boolean>;
  };
};

export type ReminderSummary = { considered: number; emailed: number; skipped: Record<string, number>; failed: number };

const bump = (summary: ReminderSummary, reason: string) => {
  summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
};

export async function runAnnualReportReminders(deps: ReminderDeps): Promise<ReminderSummary> {
  const summary: ReminderSummary = { considered: 0, emailed: 0, skipped: {}, failed: 0 };
  const now = deps.service.now();
  const today = pacificToday(now);
  const due = await deps.service.store.listDueSoon(addDays(today, 60), 200);
  for (const compliance of due) {
    if (!compliance.nextDueDate) continue;
    const stage = reminderStageFor(compliance.nextDueDate, today, compliance.status);
    if (!stage) continue;
    summary.considered += 1;
    const facts = await deps.service.filings.load(compliance.registrationId);
    if (!facts?.eligible) {
      bump(summary, "not_eligible");
      continue;
    }
    const cycleYear = cycleFiscalYear(compliance, now);
    const reports = await deps.service.store.listReports(compliance.registrationId);
    if (reports.some((report) => report.fiscalYear === cycleYear && (report.paidAt || report.confirmedAt || (report.status && report.status !== "FILLED")))) {
      bump(summary, "already_filing");
      continue;
    }
    const recipient = await deps.recipient(compliance.registrationId);
    if (!recipient?.email) {
      bump(summary, "no_email");
      continue;
    }
    const key: ClaimKey = { registrationId: compliance.registrationId, type: reminderEmailType(compliance.nextDueDate, stage) };
    if (!(await deps.claims.claim(key))) {
      bump(summary, "email_already_sent");
      continue;
    }
    const stateName = LLC_STATE_NAMES[String(compliance.state ?? facts.state ?? "").toUpperCase() as keyof typeof LLC_STATE_NAMES] ?? "your state";
    const content = annualReportReminderEmail({
      stage,
      firstName: recipient.firstName,
      companyName: facts.companyName,
      stateName,
      dueWords: dateWords(compliance.nextDueDate) ?? compliance.nextDueDate,
      daysLeft: Math.max(0, daysBetween(today, compliance.nextDueDate)),
      fileUrl: `${deps.portalUrl(compliance.registrationId)}?file=annual-report`,
      quote: compliance.quotePriceCents !== null ? { priceCents: compliance.quotePriceCents, isMinimum: compliance.quoteIsMinimum } : null,
    });
    const sent = await deps.email.send(recipient.email, content).catch(() => false);
    if (sent) {
      summary.emailed += 1;
    } else {
      summary.failed += 1;
      await deps.claims.release(key).catch(() => undefined);
    }
  }
  return summary;
}

// ─── Live wiring ───────────────────────────────────────────────────────────────────────────────────────────────────

const sqlClaims: ReminderDeps["claims"] = {
  async claim(key) {
    const db = await getDb();
    if (!db) return false;
    try {
      await db.insert(llcEmailLog).values({ registrationId: key.registrationId, emailType: key.type.slice(0, 64) });
      return true;
    } catch (error) {
      if (isDuplicateKeyError(error)) return false;
      throw error;
    }
  },
  async release(key) {
    const db = await getDb();
    if (!db) return;
    await db
      .delete(llcEmailLog)
      .where(and(eq(llcEmailLog.registrationId, key.registrationId), eq(llcEmailLog.emailType, key.type.slice(0, 64))));
  },
};

export function defaultReminderDeps(service: AnnualReportDeps = defaultAnnualReportDeps()): ReminderDeps {
  return {
    service,
    claims: sqlClaims,
    recipient: (registrationId) => loadReminderRecipient(registrationId),
    // The plain status page (no ?t= token): filing and paying need her signed-in account, and the page's sign-in
    // brings her straight back to this link.
    portalUrl: (registrationId) => statusUrl(registrationId),
    email: { send: (to, content) => deliverClientEmail(to, content) },
  };
}

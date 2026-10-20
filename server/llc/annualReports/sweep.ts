/**
 * The hourly annual report pass, run from the existing LLC status poller (server/ops/poller.ts, the same heartbeat as
 * the Whop reconciliation; POLL_INTERVAL_MINUTES, /api/poll and the scheduled llc-status-poll all drive it): re-read
 * compliance calendars older than a day, pick up annual report payments the webhook missed, retry the confirm for
 * paid reports, then send the reminders that are due. Each step runs on its own; one failing never stops the next.
 * Counts only in the log (no names, emails or numbers).
 */
import { getDoolaConfig } from "../doola";
import { defaultAnnualReportDeps } from "./defaults";
import { reconcileAnnualReportPayments } from "./payments";
import { defaultReminderDeps, runAnnualReportReminders } from "./reminders";
import { retryPaidUnconfirmed, syncStaleCalendars } from "./service";

let inFlight = false;

export async function runAnnualReportSweep(): Promise<{ skipped: boolean; report?: Record<string, unknown> }> {
  if (inFlight) return { skipped: true };
  try {
    getDoolaConfig();
  } catch {
    return { skipped: true };
  }
  inFlight = true;
  try {
    const deps = defaultAnnualReportDeps();
    const failed = (step: string) => (error: unknown) => {
      console.warn(`[AnnualReports] ${step} failed`, { error: error instanceof Error ? error.name : "UnknownError" });
      return null;
    };
    const calendars = await syncStaleCalendars(deps).catch(failed("calendar sync"));
    const payments = await reconcileAnnualReportPayments({}, deps).catch(failed("payment reconciliation"));
    const confirms = await retryPaidUnconfirmed(deps).catch(failed("confirm retry"));
    const reminders = await runAnnualReportReminders(defaultReminderDeps(deps)).catch(failed("reminders"));
    const report = { calendars, payments, confirms, reminders: reminders ? { emailed: reminders.emailed, failed: reminders.failed } : null };
    if ((calendars?.synced ?? 0) + (reminders?.emailed ?? 0) + (reminders?.failed ?? 0) > 0 || Object.keys(confirms ?? {}).length > 0) {
      console.log("[AnnualReports] sweep", JSON.stringify(report));
    }
    return { skipped: false, report };
  } finally {
    inFlight = false;
  }
}

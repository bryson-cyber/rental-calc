/**
 * Calendar-day helpers the annual report service and the reminders share (moved out of reminders.ts so service.ts can
 * use them without importing app glue). Pure, app-neutral: the sibling apps copy this file unchanged. Dates are
 * "yyyy-MM-dd" text, compared as whole days, so no time zone ever moves a due date.
 */

const DAY_MS = 86_400_000;

/** Today's date where the owner works (Pacific), "yyyy-MM-dd". */
export function pacificToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function daysBetween(fromYmd: string, toYmd: string): number {
  const from = Date.parse(`${fromYmd}T00:00:00Z`);
  const to = Date.parse(`${toYmd}T00:00:00Z`);
  return Math.round((to - from) / DAY_MS);
}

export function addDays(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

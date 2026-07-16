/**
 * Webinar schedule-date parsing shared by the admin UI and server.
 *
 * WebinarJam's API returns schedule dates as timezone-naive wall-clock strings
 * ("2026-07-15 19:00") in the WEBINAR's configured timezone — Eastern Time for
 * this account — and we store that string verbatim in settings
 * (selected_schedule_date). Parsing it with `new Date(...)` uses the browser's
 * local zone and `+ "Z"` treats it as UTC; both are wrong everywhere except
 * the one zone they happen to match, which is how the admin dashboard hid
 * no-shows all evening during the Jul 15 2026 live webinar.
 */

export const WEBINAR_TIMEZONE = "America/New_York";

/**
 * How long after its start a webinar counts as "live". Generous because these
 * webinars regularly run past 2 hours — every consumer must use the same
 * window or tabs will disagree about whether the webinar is still running.
 */
export const WEBINAR_LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

const NAIVE_DATETIME = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const EXPLICIT_ZONE = /(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)\s*$/i;

// Intl.DateTimeFormat construction is much more expensive than using one;
// cache per zone since these run on every render tick.
const formatterCache = new Map<string, Intl.DateTimeFormat>();
function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

/**
 * Convert a wall-clock time in a named IANA zone to the real UTC instant.
 * Two-pass fixed-point iteration handles DST edges without a tz library.
 */
function zonedWallTimeToUtc(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number,
  timeZone: string,
): Date {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = wallAsUtc;
  const fmt = getFormatter(timeZone);
  for (let i = 0; i < 2; i++) {
    const parts = fmt.formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    let hh = get("hour");
    if (hh === 24) hh = 0; // some engines render midnight as "24"
    const zonedAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hh, get("minute"), get("second"));
    guess += wallAsUtc - zonedAsUtc;
  }
  return new Date(guess);
}

/**
 * Parse a stored webinar schedule date into a real UTC instant.
 * - Strings carrying an explicit zone ("Z", ±hh:mm, GMT/UTC) parse as-is.
 * - Everything else — "YYYY-MM-DD HH:mm[:ss]" and human formats like
 *   "February 25, 2026 8:00 PM" — is wall-clock time in the webinar's
 *   timezone (Eastern by default), never the viewer's local zone.
 * - Returns null for missing/unparseable input.
 */
export function parseWebinarScheduleDate(
  scheduleDate: string | null | undefined,
  timeZone: string = WEBINAR_TIMEZONE,
): Date | null {
  if (!scheduleDate) return null;
  const s = scheduleDate.trim();

  const naive = NAIVE_DATETIME.exec(s);
  if (naive) {
    const [, y, mo, d, h, mi, sec] = naive;
    return zonedWallTimeToUtc(
      Number(y), Number(mo), Number(d),
      Number(h), Number(mi), Number(sec ?? 0),
      timeZone,
    );
  }

  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return null;
  if (EXPLICIT_ZONE.test(s)) return parsed;

  // No zone in the string: the engine parsed it in ITS local zone, which may
  // not be the webinar's. Reinterpret the parsed wall-clock components as
  // webinar-zone time so e.g. "February 25, 2026 8:00 PM" means 8 PM Eastern
  // on every machine.
  return zonedWallTimeToUtc(
    parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate(),
    parsed.getHours(), parsed.getMinutes(), parsed.getSeconds(),
    timeZone,
  );
}

export type WebinarPhase = "unknown" | "upcoming" | "live" | "ended";

/**
 * Where the webinar is relative to `now`: upcoming (before start), live
 * (start → start + duration), or ended. "unknown" when no/invalid date.
 */
export function getWebinarPhase(
  scheduleDate: string | null | undefined,
  now: Date = new Date(),
  durationMs: number = WEBINAR_LIVE_WINDOW_MS,
): { phase: WebinarPhase; start: Date | null } {
  const start = parseWebinarScheduleDate(scheduleDate);
  if (!start) return { phase: "unknown", start: null };
  if (now.getTime() < start.getTime()) return { phase: "upcoming", start };
  if (now.getTime() < start.getTime() + durationMs) return { phase: "live", start };
  return { phase: "ended", start };
}

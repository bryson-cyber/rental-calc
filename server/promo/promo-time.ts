/**
 * Promo Drip — schedule computation + IANA-zone wall-clock → UTC conversion.
 *
 * Drip steps are defined as (dayOffset, sendTimeEt). At launch we convert each
 * to a concrete UTC Date: day 0 sends shortly after launch; day N sends at its
 * Eastern Time wall-clock time N calendar days (ET) after the launch day.
 * ET is used because the audience is US-based and the copy assumes daytime
 * delivery; 12:30 PM ET = 9:30 AM PT keeps SMS inside TCPA quiet-hours
 * (8am–9pm local) for all four US time zones.
 */

const ET_ZONE = "America/New_York";

/** Minutes after launch that day-0 steps fire (gives a cancel window). */
export const DAY0_EMAIL_DELAY_MS = 2 * 60 * 1000;
export const DAY0_SMS_DELAY_MS = 5 * 60 * 1000;

/** Get the calendar date (y/m/d) for a given instant in an IANA zone. */
export function zonedCalendarDate(zone: string, instant: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** What wall-clock time does this instant correspond to in the given zone? */
function zonedWallClock(
  zone: string,
  instant: Date
): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Intl can return hour "24" for midnight in some environments — normalize.
  const hour = get("hour") % 24;
  return { year: get("year"), month: get("month"), day: get("day"), hour, minute: get("minute") };
}

/**
 * Convert a wall-clock datetime in an IANA zone to a UTC Date.
 * Two-pass fixed-point: guess UTC, read back what wall time that guess renders
 * as in the zone, and correct by the difference. Converges across DST edges.
 */
export function zonedToUtc(zone: string, year: number, month: number, day: number, hour: number, minute: number): Date {
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  for (let i = 0; i < 4; i++) {
    const wall = zonedWallClock(zone, guess);
    const wantMs = Date.UTC(year, month - 1, day, hour, minute);
    const gotMs = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
    const diff = wantMs - gotMs;
    if (diff === 0) return guess;
    guess = new Date(guess.getTime() + diff);
  }
  return guess;
}

/** Convert an ET wall-clock datetime to a UTC Date. */
export function etToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  return zonedToUtc(ET_ZONE, year, month, day, hour, minute);
}

/**
 * SMS quiet-hours window, expressed in ET but chosen to be safe NATIONWIDE:
 * 14:00 ET = 8:00am Hawaii (the tightest US zone), 20:30 ET = 8:30pm Eastern.
 * TCPA quiet hours are 8am–9pm in the RECIPIENT's local time; a single ET
 * window inside all US zones avoids needing per-recipient timezone data.
 */
const SMS_WINDOW_START_ET_MIN = 14 * 60;
const SMS_WINDOW_END_ET_MIN = 20 * 60 + 30;

/** Clamp an instant into the nationwide-safe ET texting window. */
export function clampSmsToQuietHours(candidate: Date): Date {
  const wall = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_ZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(candidate);
  const get = (type: string) => Number(wall.find((p) => p.type === type)?.value);
  const minutes = (get("hour") % 24) * 60 + get("minute");
  if (minutes >= SMS_WINDOW_START_ET_MIN && minutes <= SMS_WINDOW_END_ET_MIN) return candidate;
  const { year, month, day } = zonedCalendarDate(ET_ZONE, candidate);
  if (minutes < SMS_WINDOW_START_ET_MIN) {
    // Too early today (ET) — send at window open today.
    return etToUtc(year, month, day, 14, 0);
  }
  // Too late today — window open tomorrow. (launchCampaign spaces any
  // resulting same-day collision with the next SMS step.)
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return etToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 14, 0);
}

/**
 * Compute the UTC send time for a drip step.
 * - dayOffset 0: launchAt + a small fixed delay (email before SMS; SMS is
 *   additionally clamped into the nationwide quiet-hours window).
 * - dayOffset N: launch's ET calendar day + N days, at sendTimeEt (ET).
 */
export function computeStepScheduledAt(
  launchAt: Date,
  step: { channel: "email" | "sms"; dayOffset: number; sendTimeEt: string }
): Date {
  if (step.dayOffset === 0) {
    if (step.channel === "email") {
      return new Date(launchAt.getTime() + DAY0_EMAIL_DELAY_MS);
    }
    return clampSmsToQuietHours(new Date(launchAt.getTime() + DAY0_SMS_DELAY_MS));
  }
  const { year, month, day } = zonedCalendarDate(ET_ZONE, launchAt);
  const [hh, mm] = step.sendTimeEt.split(":").map(Number);
  // Use UTC date arithmetic on the ET calendar date to add days safely
  // (Date.UTC normalizes overflow, e.g. Jul 30 + 5 days → Aug 4).
  const target = new Date(Date.UTC(year, month - 1, day + step.dayOffset));
  return etToUtc(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate(), hh, mm);
}

/**
 * Parse a WebinarJam schedule datetime string ("YYYY-MM-DD HH:mm", wall clock
 * in the webinar's own IANA timezone) to UTC. Returns null on malformed input.
 */
export function parseWebinarJamScheduleToUtc(dateStr: string, timezone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec((dateStr || "").trim());
  if (!m) return null;
  const zone = timezone || "America/Los_Angeles";
  try {
    return zonedToUtc(zone, Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
  } catch {
    // Unknown timezone string — fall back to Pacific (WebinarJam's default)
    try {
      return zonedToUtc("America/Los_Angeles", Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
    } catch {
      return null;
    }
  }
}

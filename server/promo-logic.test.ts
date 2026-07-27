/**
 * Promo drip pure-logic tests: phone/email normalization (must mirror the
 * webinar system's rules so HubSpot phones match webinar_registrants rows),
 * schedule math (ET → UTC across DST), WebinarJam schedule parsing, the
 * upcoming-webinar predicate, HubSpot phone picking, unsubscribe tokens, and
 * SMS error classification.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

// Must run before the hoisted static imports evaluate ENV (env.ts captures
// process.env at module-eval time).
vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-promo-tokens";
});

import {
  chunk,
  isUsCanadaPromoPhone,
  normalizeEmail,
  normalizePromoPhone,
  renderPromoVars,
} from "./promo/promo-util";
import { computeStepScheduledAt, etToUtc, parseWebinarJamScheduleToUtc, zonedToUtc } from "./promo/promo-time";
import { hasUpcomingSchedule } from "./promo/promo-webinar-exclusion";
import { pickPromoPhone } from "./promo/promo-snapshot";
import { classifySmsError } from "./promo/promo-dispatcher";

describe("phone normalization (mirrors webinar-sms rules)", () => {
  it("normalizes formatted US numbers to 10 digits", () => {
    expect(normalizePromoPhone("+1 (973) 986-8305")).toBe("9739868305");
    expect(normalizePromoPhone("1-520-343-0725")).toBe("5203430725");
    expect(normalizePromoPhone("5203430725")).toBe("5203430725");
  });

  it("accepts US/Canada, rejects international", () => {
    expect(isUsCanadaPromoPhone("+1 (973) 986-8305")).toBe(true);
    expect(isUsCanadaPromoPhone("9739868305")).toBe(true);
    expect(isUsCanadaPromoPhone("+233 (53) 920 2145")).toBe(false); // Ghana
    expect(isUsCanadaPromoPhone("12345")).toBe(false);
    expect(isUsCanadaPromoPhone("")).toBe(false);
  });
});

describe("email normalization", () => {
  it("lowercases and trims; empty → null", () => {
    expect(normalizeEmail("  Bryson@CoachInayah.com ")).toBe("bryson@coachinayah.com");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe("personalization", () => {
  it("fills %FIRST_NAME% and falls back to 'there'", () => {
    expect(renderPromoVars("Hey %FIRST_NAME%!", { firstName: "Jaida" })).toBe("Hey Jaida!");
    expect(renderPromoVars("Hey %FIRST_NAME%!", { firstName: "" })).toBe("Hey there!");
    expect(renderPromoVars("Hey %FIRST_NAME%!", { firstName: null })).toBe("Hey there!");
    expect(renderPromoVars("No placeholders here.", { firstName: "X" })).toBe("No placeholders here.");
  });
});

describe("ET schedule math", () => {
  it("converts summer (EDT, UTC-4) and winter (EST, UTC-5) wall times", () => {
    expect(etToUtc(2026, 7, 28, 9, 0).toISOString()).toBe("2026-07-28T13:00:00.000Z");
    expect(etToUtc(2026, 12, 1, 9, 0).toISOString()).toBe("2026-12-01T14:00:00.000Z");
  });

  it("day-0 steps fire minutes after launch (email first; SMS inside the quiet-hours window)", () => {
    // Launch 7/28 3:47pm ET — 3:52pm is inside the 14:00–20:30 ET window
    const launch = new Date("2026-07-28T19:47:00Z");
    const email = computeStepScheduledAt(launch, { channel: "email", dayOffset: 0, sendTimeEt: "09:00" });
    const sms = computeStepScheduledAt(launch, { channel: "sms", dayOffset: 0, sendTimeEt: "14:00" });
    expect(email.getTime()).toBe(launch.getTime() + 2 * 60 * 1000);
    expect(sms.getTime()).toBe(launch.getTime() + 5 * 60 * 1000);
  });

  it("day-0 SMS from an early-morning launch waits for 2:00 PM ET (8:00 AM Hawaii)", () => {
    // Launch 7/28 8:00am ET → SMS clamps to same day 14:00 ET = 18:00 UTC
    const launch = new Date("2026-07-28T12:00:00Z");
    const sms = computeStepScheduledAt(launch, { channel: "sms", dayOffset: 0, sendTimeEt: "14:00" });
    expect(sms.toISOString()).toBe("2026-07-28T18:00:00.000Z");
    // Email is unaffected by quiet hours
    const email = computeStepScheduledAt(launch, { channel: "email", dayOffset: 0, sendTimeEt: "09:00" });
    expect(email.getTime()).toBe(launch.getTime() + 2 * 60 * 1000);
  });

  it("day-0 SMS from a late-night launch rolls to 2:00 PM ET the next day", () => {
    // Launch 7/28 11:30pm ET (= 7/29 03:30 UTC) → SMS = 7/29 14:00 ET = 18:00 UTC
    const launch = new Date("2026-07-29T03:30:00Z");
    const sms = computeStepScheduledAt(launch, { channel: "sms", dayOffset: 0, sendTimeEt: "14:00" });
    expect(sms.toISOString()).toBe("2026-07-29T18:00:00.000Z");
  });

  it("day-N steps land on the Nth ET calendar day at the step's ET time", () => {
    // Launch 7/28 3:47pm ET → day 1 email = 7/29 9:00 ET = 13:00 UTC
    const launch = new Date("2026-07-28T19:47:00Z");
    const d1 = computeStepScheduledAt(launch, { channel: "email", dayOffset: 1, sendTimeEt: "09:00" });
    expect(d1.toISOString()).toBe("2026-07-29T13:00:00.000Z");
    // Day 18 SMS = 8/15 14:00 ET = 18:00 UTC
    const d18 = computeStepScheduledAt(launch, { channel: "sms", dayOffset: 18, sendTimeEt: "14:00" });
    expect(d18.toISOString()).toBe("2026-08-15T18:00:00.000Z");
  });

  it("handles a late-night ET launch without shifting the calendar day", () => {
    // 7/28 11:30pm ET = 7/29 03:30 UTC — day 1 must be 7/29 ET, not 7/30
    const launch = new Date("2026-07-29T03:30:00Z");
    const d1 = computeStepScheduledAt(launch, { channel: "email", dayOffset: 1, sendTimeEt: "09:00" });
    expect(d1.toISOString()).toBe("2026-07-29T13:00:00.000Z");
  });

  it("a campaign spanning the DST fall-back keeps ET wall times (EDT before, EST after)", () => {
    // Launch Oct 20, 2026 3pm ET (EDT). Nov 1 is the fall-back.
    const launch = new Date("2026-10-20T19:00:00Z");
    const d5 = computeStepScheduledAt(launch, { channel: "email", dayOffset: 5, sendTimeEt: "09:00" });
    expect(d5.toISOString()).toBe("2026-10-25T13:00:00.000Z"); // EDT: 9am = 13:00 UTC
    const d15 = computeStepScheduledAt(launch, { channel: "email", dayOffset: 15, sendTimeEt: "09:00" });
    expect(d15.toISOString()).toBe("2026-11-04T14:00:00.000Z"); // EST: 9am = 14:00 UTC
  });
});

describe("WebinarJam schedule parsing", () => {
  it("parses Pacific-time schedule strings to UTC", () => {
    const utc = parseWebinarJamScheduleToUtc("2026-07-17 16:00", "America/Los_Angeles");
    expect(utc?.toISOString()).toBe("2026-07-17T23:00:00.000Z");
  });

  it("returns null on malformed dates and survives bad timezones", () => {
    expect(parseWebinarJamScheduleToUtc("not a date", "America/Los_Angeles")).toBeNull();
    const fallback = parseWebinarJamScheduleToUtc("2026-07-17 16:00", "Not/AZone");
    expect(fallback?.toISOString()).toBe("2026-07-17T23:00:00.000Z");
  });

  it("zonedToUtc handles arbitrary IANA zones", () => {
    expect(zonedToUtc("America/Chicago", 2026, 7, 17, 16, 0).toISOString()).toBe("2026-07-17T21:00:00.000Z");
  });
});

describe("upcoming-webinar predicate", () => {
  const now = new Date("2026-07-27T12:00:00Z");

  it("future schedule → upcoming", () => {
    const w = { timezone: "America/Los_Angeles", schedules: [{ date: "2026-08-01 16:00" }] };
    expect(hasUpcomingSchedule(w, now)).toBe(true);
  });

  it("webinar that started <3h ago still counts as upcoming (in progress)", () => {
    // 2026-07-27 04:00 PT = 11:00 UTC — one hour before `now`
    const w = { timezone: "America/Los_Angeles", schedules: [{ date: "2026-07-27 04:00" }] };
    expect(hasUpcomingSchedule(w, now)).toBe(true);
  });

  it("clearly-past schedules → not upcoming", () => {
    const w = { timezone: "America/Los_Angeles", schedules: [{ date: "2026-07-17 16:00" }] };
    expect(hasUpcomingSchedule(w, now)).toBe(false);
  });

  it("no schedules → not upcoming", () => {
    expect(hasUpcomingSchedule({ timezone: "America/New_York", schedules: [] }, now)).toBe(false);
    expect(hasUpcomingSchedule({}, now)).toBe(false);
  });

  it("unparseable schedule date fails CLOSED (treated as upcoming)", () => {
    const w = { timezone: "America/Los_Angeles", schedules: [{ date: "TBD" }] };
    expect(hasUpcomingSchedule(w, now)).toBe(true);
  });
});

describe("HubSpot phone picking (TCPA: lead-submitted number only)", () => {
  it("uses the phone property when it's a valid US/Canada number", () => {
    expect(pickPromoPhone({ phone: "+1 (409) 750-1154" })).toEqual({ phone: "4097501154", valid: true });
  });

  it("NEVER falls back to vendor-appended data_perfection__phones (no texting consent)", () => {
    expect(
      pickPromoPhone({ phone: "+233 (53) 920 2145", data_perfection__phones: "+233539202145; (336) 455-5697" }).valid
    ).toBe(false);
    expect(pickPromoPhone({ data_perfection__phones: "(336) 455-5697" }).valid).toBe(false);
  });

  it("no valid US/Canada phone → invalid", () => {
    expect(pickPromoPhone({ phone: "+233 (53) 920 2145" }).valid).toBe(false);
    expect(pickPromoPhone({}).valid).toBe(false);
  });
});

describe("unsubscribe tokens", () => {
  let util: typeof import("./promo/promo-util");
  beforeAll(async () => {
    util = await import("./promo/promo-util");
  });

  it("round-trips and rejects tampering", () => {
    const token = util.promoUnsubscribeToken(7, "someone@example.com");
    expect(util.verifyPromoUnsubscribeToken(7, "someone@example.com", token)).toBe(true);
    expect(util.verifyPromoUnsubscribeToken(7, "someone@example.com", token + "x")).toBe(false);
    expect(util.verifyPromoUnsubscribeToken(8, "someone@example.com", token)).toBe(false);
    expect(util.verifyPromoUnsubscribeToken(7, "other@example.com", token)).toBe(false);
    expect(util.verifyPromoUnsubscribeToken(7, "someone@example.com", "")).toBe(false);
  });

  it("is case-insensitive on the email (normalized before signing)", () => {
    const token = util.promoUnsubscribeToken(7, "Someone@Example.com");
    expect(util.verifyPromoUnsubscribeToken(7, "someone@example.com", token)).toBe(true);
  });

  it("builds a well-formed unsubscribe URL", () => {
    const url = util.buildPromoUnsubscribeUrl("https://app.example.com/", 7, "a@b.com");
    expect(url).toMatch(/^https:\/\/app\.example\.com\/api\/promo\/unsubscribe\?c=7&e=a%40b\.com&t=/);
  });
});

describe("SMS error classification (skip vs fail vs billing)", () => {
  it("classifies opt-outs and invalid numbers as skips, not failures", () => {
    expect(classifySmsError("International number skipped (not US/Canada): +233...")).toBe("skipped");
    expect(classifySmsError("Invalid phone number: 12345 (too short)")).toBe("skipped");
    expect(classifySmsError("SimpleTexting error (409): contact has unsubscribed")).toBe("skipped");
    expect(classifySmsError("Contact marked as invalid")).toBe("skipped");
  });

  it("classifies billing blocks for the circuit breaker", () => {
    expect(classifySmsError("SimpleTexting error (402): BLOCKED_BY_PAYMENT")).toBe("billing");
  });

  it("everything else is a real failure", () => {
    expect(classifySmsError("SimpleTexting request timed out (10s)")).toBe("failed");
    expect(classifySmsError("SimpleTexting error (500): internal")).toBe("failed");
  });
});

describe("chunk", () => {
  it("splits arrays evenly with a remainder tail", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 8)).toEqual([]);
  });
});

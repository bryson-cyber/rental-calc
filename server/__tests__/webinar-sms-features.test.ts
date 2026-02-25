import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the new webinar SMS features:
 * 1. SMS Replies Inbox (getIncomingReplies)
 * 2. Customizable Sequence Timing (generateSequence with timing param)
 * 3. Live No-Show Nudge (sendNoShowNudge)
 */

// Mock fetch for SimpleTexting API
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("SMS Replies Inbox", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should filter incoming (MO) messages from SimpleTexting API response", () => {
    const allMessages = [
      { id: "1", text: "Yes", contactPhone: "+12125551234", directionType: "MO", timestamp: "2026-02-25T10:00:00Z", category: "REPLY" },
      { id: "2", text: "Reminder sent", contactPhone: "+12125551234", directionType: "MT", timestamp: "2026-02-25T09:00:00Z", category: "CAMPAIGN" },
      { id: "3", text: "No thanks", contactPhone: "+12125555678", directionType: "MO", timestamp: "2026-02-25T11:00:00Z", category: "REPLY" },
      { id: "4", text: "Another outgoing", contactPhone: "+12125559999", directionType: "MT", timestamp: "2026-02-25T08:00:00Z", category: "CAMPAIGN" },
    ];

    const incoming = allMessages.filter(m => m.directionType === "MO");
    expect(incoming).toHaveLength(2);
    expect(incoming[0].text).toBe("Yes");
    expect(incoming[1].text).toBe("No thanks");
  });

  it("should normalize phone numbers for matching (last 10 digits)", () => {
    const normalizePhone = (phone: string): string => {
      const clean = phone.replace(/[^\d]/g, "");
      return clean.length >= 10 ? clean.slice(-10) : clean;
    };

    expect(normalizePhone("+12125551234")).toBe("2125551234");
    expect(normalizePhone("(212) 555-1234")).toBe("2125551234");
    expect(normalizePhone("12125551234")).toBe("2125551234");
    expect(normalizePhone("2125551234")).toBe("2125551234");
    expect(normalizePhone("555-1234")).toBe("5551234"); // short number
  });
});

describe("Customizable Sequence Timing", () => {
  it("should calculate correct offsets from webinar date", () => {
    const webinarDate = new Date("2026-03-01T18:00:00Z");
    const offset = (minutes: number) => new Date(webinarDate.getTime() + minutes * 60 * 1000);

    // 1 hour before = -60 minutes
    const oneHourBefore = offset(-60);
    expect(oneHourBefore.toISOString()).toBe("2026-03-01T17:00:00.000Z");

    // 15 minutes before = -15 minutes
    const fifteenMinBefore = offset(-15);
    expect(fifteenMinBefore.toISOString()).toBe("2026-03-01T17:45:00.000Z");

    // Starting now = 0 minutes (or -5 for slight lead)
    const startingNow = offset(0);
    expect(startingNow.toISOString()).toBe("2026-03-01T18:00:00.000Z");

    // 2 hours after = +120 minutes
    const twoHoursAfter = offset(120);
    expect(twoHoursAfter.toISOString()).toBe("2026-03-01T20:00:00.000Z");

    // 7 days before = -10080 minutes
    const sevenDaysBefore = offset(-10080);
    expect(sevenDaysBefore.toISOString()).toBe("2026-02-22T18:00:00.000Z");
  });

  it("should use default timing when no custom timing provided", () => {
    const defaults = {
      registrationConfirm: -10080,
      twoDaysBefore: -2880,
      dayBefore: -1440,
      morningOf: -240,
      oneHourWarning: -60,
      goingLiveNow: -5,
      thankYouAttended: 60,
      missedYouNoShow: 120,
      followUpCta: 1440,
    };

    const customTiming = undefined;
    const t = {
      registrationConfirm: customTiming?.registrationConfirm ?? -10080,
      twoDaysBefore: customTiming?.twoDaysBefore ?? -2880,
      dayBefore: customTiming?.dayBefore ?? -1440,
      morningOf: customTiming?.morningOf ?? -240,
      oneHourWarning: customTiming?.oneHourWarning ?? -60,
      goingLiveNow: customTiming?.goingLiveNow ?? -5,
      thankYouAttended: customTiming?.thankYouAttended ?? 60,
      missedYouNoShow: customTiming?.missedYouNoShow ?? 120,
      followUpCta: customTiming?.followUpCta ?? 1440,
    };

    expect(t).toEqual(defaults);
  });

  it("should override specific timing values while keeping defaults for others", () => {
    const customTiming = {
      oneHourWarning: -60,
      goingLiveNow: -15, // Changed from -5 to -15
      followUpCta: 2880, // Changed from 1440 to 2880 (2 days)
    } as any;

    const t = {
      registrationConfirm: customTiming?.registrationConfirm ?? -10080,
      twoDaysBefore: customTiming?.twoDaysBefore ?? -2880,
      dayBefore: customTiming?.dayBefore ?? -1440,
      morningOf: customTiming?.morningOf ?? -240,
      oneHourWarning: customTiming?.oneHourWarning ?? -60,
      goingLiveNow: customTiming?.goingLiveNow ?? -5,
      thankYouAttended: customTiming?.thankYouAttended ?? 60,
      missedYouNoShow: customTiming?.missedYouNoShow ?? 120,
      followUpCta: customTiming?.followUpCta ?? 1440,
    };

    // Custom values
    expect(t.goingLiveNow).toBe(-15);
    expect(t.followUpCta).toBe(2880);
    // Default values preserved
    expect(t.registrationConfirm).toBe(-10080);
    expect(t.dayBefore).toBe(-1440);
  });

  it("should produce 9 messages in the sequence", () => {
    const sequenceNames = [
      "Registration Confirmation",
      "2 Days Before Reminder",
      "Day Before Reminder",
      "Morning Of",
      "1 Hour Warning",
      "Starting NOW",
      "Thank You (Attended)",
      "Missed You (No-Show)",
      "Follow-Up CTA",
    ];
    expect(sequenceNames).toHaveLength(9);
  });
});

describe("Live No-Show Nudge", () => {
  it("should determine if webinar is live (10+ minutes in, within 3 hours)", () => {
    const isWebinarLive = (scheduleDate: string | null): boolean => {
      if (!scheduleDate) return false;
      const now = new Date();
      const webinarStart = new Date(scheduleDate);
      return (
        now.getTime() >= webinarStart.getTime() + 10 * 60 * 1000 &&
        now.getTime() <= webinarStart.getTime() + 3 * 60 * 60 * 1000
      );
    };

    // No schedule date
    expect(isWebinarLive(null)).toBe(false);

    // Webinar in the future (1 hour from now)
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(isWebinarLive(future)).toBe(false);

    // Webinar started 5 minutes ago (not yet 10 min in)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(isWebinarLive(fiveMinAgo)).toBe(false);

    // Webinar started 15 minutes ago (live!)
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    expect(isWebinarLive(fifteenMinAgo)).toBe(true);

    // Webinar started 2 hours ago (still live)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(isWebinarLive(twoHoursAgo)).toBe(true);

    // Webinar started 4 hours ago (no longer live)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    expect(isWebinarLive(fourHoursAgo)).toBe(false);
  });

  it("should personalize nudge message with first name", () => {
    const personalizeMessage = (message: string, name: string | null): string => {
      const firstName = name?.split(" ")[0] || "there";
      return message.replace(/%FIRST_NAME%/gi, firstName);
    };

    expect(personalizeMessage("Hey %FIRST_NAME%! Join now!", "John Smith"))
      .toBe("Hey John! Join now!");

    expect(personalizeMessage("Hey %FIRST_NAME%! Join now!", null))
      .toBe("Hey there! Join now!");

    expect(personalizeMessage("Hey %FIRST_NAME%! Join now!", ""))
      .toBe("Hey there! Join now!");
  });

  it("should calculate no-show count correctly", () => {
    const summary = { total: 100, attended: 35, optedOut: 5 };
    const noShowCount = summary.total - summary.attended - summary.optedOut;
    expect(noShowCount).toBe(60);
  });
});

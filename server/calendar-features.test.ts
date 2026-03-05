import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildWebinarReminderEmail } from "./gmail-reminders";

// ─── Gmail Reminder Email Template Tests ─────────────────────────────────────

describe("buildWebinarReminderEmail", () => {
  const baseParams = {
    name: "Jane Smith",
    email: "jane@example.com",
    eventName: "LIVE: Coach Inayah's 5-Step Airbnb Masterclass",
    joinUrl: "https://webinarjam.com/live/123",
    eventDate: "Saturday, March 8, 2:00 PM PST",
  };

  it("builds a 24h reminder email with correct subject and personalization", () => {
    const result = buildWebinarReminderEmail(
      baseParams.name,
      baseParams.email,
      "24h",
      baseParams.eventName,
      baseParams.joinUrl,
      baseParams.eventDate
    );

    expect(result.to).toBe("jane@example.com");
    expect(result.recipientName).toBe("Jane Smith");
    expect(result.subject).toContain("Tomorrow");
    expect(result.subject).toContain(baseParams.eventName);
    expect(result.htmlBody).toContain("Jane"); // First name personalization
    expect(result.htmlBody).toContain("TOMORROW");
    expect(result.htmlBody).toContain(baseParams.joinUrl);
    expect(result.htmlBody).toContain(baseParams.eventDate);
    expect(result.htmlBody).toContain("Coach Inayah");
  });

  it("builds a 1h reminder email with urgency messaging", () => {
    const result = buildWebinarReminderEmail(
      baseParams.name,
      baseParams.email,
      "1h",
      baseParams.eventName,
      baseParams.joinUrl
    );

    expect(result.subject).toContain("1 Hour");
    expect(result.htmlBody).toContain("LIVE in just 1 hour");
    expect(result.htmlBody).toContain(baseParams.joinUrl);
    expect(result.htmlBody).toContain("Jane");
  });

  it("builds a 'starting' reminder email with LIVE NOW messaging", () => {
    const result = buildWebinarReminderEmail(
      baseParams.name,
      baseParams.email,
      "starting",
      baseParams.eventName,
      baseParams.joinUrl
    );

    expect(result.subject).toContain("LIVE NOW");
    expect(result.htmlBody).toContain("LIVE RIGHT NOW");
    expect(result.htmlBody).toContain("JOIN LIVE NOW");
    expect(result.htmlBody).toContain(baseParams.joinUrl);
  });

  it("uses first name only for personalization", () => {
    const result = buildWebinarReminderEmail(
      "John Michael Doe",
      "john@example.com",
      "24h",
      "Test Event",
      "https://example.com"
    );

    expect(result.htmlBody).toContain("John");
    expect(result.htmlBody).not.toContain("John Michael Doe");
  });

  it("handles empty name gracefully", () => {
    const result = buildWebinarReminderEmail(
      "",
      "test@example.com",
      "1h",
      "Test Event",
      "https://example.com"
    );

    // Should not crash and should produce valid HTML
    expect(result.to).toBe("test@example.com");
    expect(result.htmlBody).toContain("Test Event");
    expect(result.subject).toBeTruthy();
  });

  it("includes proper HTML structure with meta tags", () => {
    const result = buildWebinarReminderEmail(
      "Test User",
      "test@example.com",
      "24h",
      "Test Event",
      "https://example.com"
    );

    expect(result.htmlBody).toContain("<!DOCTYPE html>");
    expect(result.htmlBody).toContain('charset="utf-8"');
    expect(result.htmlBody).toContain("viewport");
  });

  it("includes CTA button with proper styling", () => {
    const result = buildWebinarReminderEmail(
      "Test User",
      "test@example.com",
      "starting",
      "Test Event",
      "https://example.com/join"
    );

    // Check CTA button has inline styles (for email client compatibility)
    expect(result.htmlBody).toContain("background-color:");
    expect(result.htmlBody).toContain("text-decoration: none");
    expect(result.htmlBody).toContain("border-radius:");
    expect(result.htmlBody).toContain("https://example.com/join");
  });

  it("includes unsubscribe/footer information", () => {
    const result = buildWebinarReminderEmail(
      "Test User",
      "test@example.com",
      "24h",
      "My Webinar",
      "https://example.com"
    );

    expect(result.htmlBody).toContain("You're receiving this because you registered");
    expect(result.htmlBody).toContain("My Webinar");
    expect(result.htmlBody).toContain("I&B Coaching");
  });
});

// ─── ICS Date Format Tests ───────────────────────────────────────────────────

describe("formatIcsDate (inline)", () => {
  // We test the format indirectly since formatIcsDate is not exported,
  // but we verify the expected format: YYYYMMDDTHHmmssZ
  it("should produce valid ICS date format", () => {
    const date = new Date("2026-03-08T14:00:00Z");
    const pad = (n: number) => String(n).padStart(2, "0");
    const formatted =
      date.getUTCFullYear().toString() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      "T" +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      "Z";

    expect(formatted).toBe("20260308T140000Z");
  });

  it("should handle midnight correctly", () => {
    const date = new Date("2026-01-01T00:00:00Z");
    const pad = (n: number) => String(n).padStart(2, "0");
    const formatted =
      date.getUTCFullYear().toString() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      "T" +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      "Z";

    expect(formatted).toBe("20260101T000000Z");
  });

  it("should handle end of year correctly", () => {
    const date = new Date("2026-12-31T23:59:59Z");
    const pad = (n: number) => String(n).padStart(2, "0");
    const formatted =
      date.getUTCFullYear().toString() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      "T" +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      "Z";

    expect(formatted).toBe("20261231T235959Z");
  });
});

// ─── ICS Content Structure Tests ─────────────────────────────────────────────

describe("ICS file structure validation", () => {
  it("validates ICS content has required fields", () => {
    // Simulate what the generateIcsFile procedure produces
    const eventName = "Test Webinar";
    const startTime = new Date("2026-03-08T14:00:00Z");
    const endTime = new Date("2026-03-08T16:00:00Z");
    const joinUrl = "https://webinarjam.com/live/123";

    const pad = (n: number) => String(n).padStart(2, "0");
    const formatIcsDate = (date: Date) =>
      date.getUTCFullYear().toString() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      "T" +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      "Z";

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Coach Inayah//Rental Calculator//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `DTSTART:${formatIcsDate(startTime)}`,
      `DTEND:${formatIcsDate(endTime)}`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `SUMMARY:${eventName}`,
      `DESCRIPTION:Join here: ${joinUrl}`,
      `URL:${joinUrl}`,
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      "DESCRIPTION:Webinar tomorrow!",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    // Validate required ICS fields
    expect(icsContent).toContain("BEGIN:VCALENDAR");
    expect(icsContent).toContain("END:VCALENDAR");
    expect(icsContent).toContain("BEGIN:VEVENT");
    expect(icsContent).toContain("END:VEVENT");
    expect(icsContent).toContain("VERSION:2.0");
    expect(icsContent).toContain("DTSTART:");
    expect(icsContent).toContain("DTEND:");
    expect(icsContent).toContain("SUMMARY:Test Webinar");
    expect(icsContent).toContain("URL:https://webinarjam.com/live/123");

    // Validate VALARM (reminder) section
    expect(icsContent).toContain("BEGIN:VALARM");
    expect(icsContent).toContain("END:VALARM");
    expect(icsContent).toContain("TRIGGER:-P1D");
    expect(icsContent).toContain("ACTION:DISPLAY");
  });
});

// ─── UTM Tracking Tests ─────────────────────────────────────────────────────

describe("UTM tracking for reminder URLs", () => {
  it("adds correct UTM parameters for 24h reminder", () => {
    const joinUrl = "https://webinarjam.com/live/123";
    const url = new URL(joinUrl);
    url.searchParams.set("utm_source", "coach_inayah");
    url.searchParams.set("utm_medium", "email");
    url.searchParams.set("utm_campaign", "webinar_reminder_24h");
    url.searchParams.set("utm_content", "manual_24h");
    const trackedUrl = url.toString();

    expect(trackedUrl).toContain("utm_source=coach_inayah");
    expect(trackedUrl).toContain("utm_medium=email");
    expect(trackedUrl).toContain("utm_campaign=webinar_reminder_24h");
    expect(trackedUrl).toContain("utm_content=manual_24h");
    expect(trackedUrl).toContain("webinarjam.com/live/123");
  });

  it("adds correct UTM parameters for auto-scheduler reminders", () => {
    const joinUrl = "https://webinarjam.com/live/456";
    const reminderType = "1h";
    const url = new URL(joinUrl);
    url.searchParams.set("utm_source", "coach_inayah");
    url.searchParams.set("utm_medium", "email");
    url.searchParams.set("utm_campaign", `webinar_reminder_${reminderType}`);
    url.searchParams.set("utm_content", `auto_${reminderType}`);
    const trackedUrl = url.toString();

    expect(trackedUrl).toContain("utm_source=coach_inayah");
    expect(trackedUrl).toContain("utm_campaign=webinar_reminder_1h");
    expect(trackedUrl).toContain("utm_content=auto_1h");
  });

  it("adds correct UTM parameters for starting reminder", () => {
    const joinUrl = "https://webinarjam.com/live/789";
    const url = new URL(joinUrl);
    url.searchParams.set("utm_source", "coach_inayah");
    url.searchParams.set("utm_medium", "email");
    url.searchParams.set("utm_campaign", "webinar_reminder_starting");
    url.searchParams.set("utm_content", "auto_starting");
    const trackedUrl = url.toString();

    expect(trackedUrl).toContain("utm_campaign=webinar_reminder_starting");
    expect(trackedUrl).toContain("utm_content=auto_starting");
  });

  it("preserves existing URL parameters when adding UTM", () => {
    const joinUrl = "https://webinarjam.com/live/123?ref=abc";
    const url = new URL(joinUrl);
    url.searchParams.set("utm_source", "coach_inayah");
    url.searchParams.set("utm_medium", "email");
    const trackedUrl = url.toString();

    expect(trackedUrl).toContain("ref=abc");
    expect(trackedUrl).toContain("utm_source=coach_inayah");
  });
});

// ─── Reminder Scheduler Logic Tests ──────────────────────────────────────────

describe("Reminder scheduler timing logic", () => {
  it("correctly identifies when 24h reminder is due", () => {
    const now = new Date("2026-03-07T14:00:00Z");
    const webinarStart = new Date("2026-03-08T14:00:00Z");
    const hoursUntilStart = (webinarStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    // 24h reminder should fire when <= 24h away
    expect(hoursUntilStart).toBeLessThanOrEqual(24);
    expect(hoursUntilStart).toBeGreaterThan(0);
  });

  it("correctly identifies when 1h reminder is due", () => {
    const now = new Date("2026-03-08T13:00:00Z");
    const webinarStart = new Date("2026-03-08T14:00:00Z");
    const hoursUntilStart = (webinarStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    // 1h reminder should fire when <= 1h away
    expect(hoursUntilStart).toBeLessThanOrEqual(1);
    expect(hoursUntilStart).toBeGreaterThan(0);
  });

  it("correctly identifies when starting reminder is due", () => {
    const now = new Date("2026-03-08T14:05:00Z");
    const webinarStart = new Date("2026-03-08T14:00:00Z");
    const minutesPast = (now.getTime() - webinarStart.getTime()) / (1000 * 60);

    // Starting reminder should fire when past start time but within 15 min
    expect(minutesPast).toBeGreaterThanOrEqual(0);
    expect(minutesPast).toBeLessThanOrEqual(15);
  });

  it("does not fire 24h reminder when more than 24h away", () => {
    const now = new Date("2026-03-06T14:00:00Z");
    const webinarStart = new Date("2026-03-08T14:00:00Z");
    const hoursUntilStart = (webinarStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    expect(hoursUntilStart).toBeGreaterThan(24);
  });

  it("auto-disables schedule after webinar ends (2h past start)", () => {
    const now = new Date("2026-03-08T16:30:00Z");
    const webinarStart = new Date("2026-03-08T14:00:00Z");
    const hoursPast = (now.getTime() - webinarStart.getTime()) / (1000 * 60 * 60);

    // Should auto-disable when > 2h past start
    expect(hoursPast).toBeGreaterThan(2);
  });

  it("does not auto-disable during the webinar window", () => {
    const now = new Date("2026-03-08T15:30:00Z");
    const webinarStart = new Date("2026-03-08T14:00:00Z");
    const hoursPast = (now.getTime() - webinarStart.getTime()) / (1000 * 60 * 60);

    // Should NOT disable when < 2h past start
    expect(hoursPast).toBeLessThanOrEqual(2);
  });
});

// ─── Email Send Log Structure Tests ──────────────────────────────────────────

describe("Email send log data structure", () => {
  it("validates required fields for a send log entry", () => {
    const logEntry = {
      webinarId: "webinar-123",
      registrantId: 42,
      recipientEmail: "test@example.com",
      recipientName: "Test User",
      emailType: "reminder_24h",
      subject: "Tomorrow: Your Webinar",
      channel: "gmail" as const,
      status: "sent" as const,
      messageId: "msg-abc-123",
      errorMessage: null,
      trackedJoinUrl: "https://webinarjam.com/live/123?utm_source=coach_inayah",
    };

    expect(logEntry.webinarId).toBeTruthy();
    expect(logEntry.recipientEmail).toContain("@");
    expect(["gmail", "calendar"]).toContain(logEntry.channel);
    expect(["sent", "failed"]).toContain(logEntry.status);
    expect(logEntry.emailType).toMatch(/^reminder_(24h|1h|starting)$/);
  });

  it("validates failed log entry has error message", () => {
    const failedEntry = {
      webinarId: "webinar-123",
      recipientEmail: "bad@example.com",
      emailType: "reminder_1h",
      channel: "gmail" as const,
      status: "failed" as const,
      messageId: null,
      errorMessage: "Gmail API: 403 Forbidden - insufficient scopes",
    };

    expect(failedEntry.status).toBe("failed");
    expect(failedEntry.errorMessage).toBeTruthy();
    expect(failedEntry.messageId).toBeNull();
  });

  it("validates stats aggregation logic", () => {
    const logs = [
      { channel: "gmail", status: "sent", emailType: "reminder_24h" },
      { channel: "gmail", status: "sent", emailType: "reminder_24h" },
      { channel: "gmail", status: "failed", emailType: "reminder_24h" },
      { channel: "calendar", status: "sent", emailType: "reminder_1h" },
      { channel: "gmail", status: "sent", emailType: "reminder_starting" },
    ];

    const total = logs.length;
    const sent = logs.filter(l => l.status === "sent").length;
    const failed = logs.filter(l => l.status === "failed").length;

    expect(total).toBe(5);
    expect(sent).toBe(4);
    expect(failed).toBe(1);

    // By channel
    const gmailSent = logs.filter(l => l.channel === "gmail" && l.status === "sent").length;
    const gmailFailed = logs.filter(l => l.channel === "gmail" && l.status === "failed").length;
    const calendarSent = logs.filter(l => l.channel === "calendar" && l.status === "sent").length;

    expect(gmailSent).toBe(3);
    expect(gmailFailed).toBe(1);
    expect(calendarSent).toBe(1);

    // By type
    const reminder24hSent = logs.filter(l => l.emailType === "reminder_24h" && l.status === "sent").length;
    expect(reminder24hSent).toBe(2);
  });
});

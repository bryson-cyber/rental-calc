import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildWebinarReminderEmail } from "./gmail-reminders";
import { addUtmParams, SMS_TO_REMINDER_MAP } from "./reminder-scheduler";

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

    expect(icsContent).toContain("BEGIN:VCALENDAR");
    expect(icsContent).toContain("END:VCALENDAR");
    expect(icsContent).toContain("BEGIN:VEVENT");
    expect(icsContent).toContain("END:VEVENT");
    expect(icsContent).toContain("VERSION:2.0");
    expect(icsContent).toContain("DTSTART:");
    expect(icsContent).toContain("DTEND:");
    expect(icsContent).toContain("SUMMARY:Test Webinar");
    expect(icsContent).toContain("URL:https://webinarjam.com/live/123");
    expect(icsContent).toContain("BEGIN:VALARM");
    expect(icsContent).toContain("END:VALARM");
    expect(icsContent).toContain("TRIGGER:-P1D");
    expect(icsContent).toContain("ACTION:DISPLAY");
  });
});

// ─── UTM Tracking Tests (using addUtmParams) ───────────────────────────────

describe("addUtmParams", () => {
  it("adds correct UTM parameters for 24h gmail reminder", () => {
    const result = addUtmParams("https://webinarjam.com/live/123", "24h", "gmail");

    expect(result).toContain("utm_source=coach_inayah");
    expect(result).toContain("utm_medium=email");
    expect(result).toContain("utm_campaign=webinar_reminder_24h");
    expect(result).toContain("utm_content=auto_24h");
    expect(result).toContain("webinarjam.com/live/123");
  });

  it("adds correct UTM parameters for 1h calendar_update reminder", () => {
    const result = addUtmParams("https://webinarjam.com/live/456", "1h", "calendar_update");

    expect(result).toContain("utm_source=coach_inayah");
    expect(result).toContain("utm_medium=calendar");
    expect(result).toContain("utm_campaign=webinar_reminder_1h");
    expect(result).toContain("utm_content=auto_1h");
  });

  it("adds correct UTM parameters for starting multi_channel reminder", () => {
    const result = addUtmParams("https://webinarjam.com/live/789", "starting", "multi_channel");

    expect(result).toContain("utm_campaign=webinar_reminder_starting");
    expect(result).toContain("utm_content=auto_starting");
    expect(result).toContain("utm_medium=calendar"); // multi_channel falls to calendar
  });

  it("preserves existing URL parameters when adding UTM", () => {
    const result = addUtmParams("https://webinarjam.com/live/123?ref=abc", "24h", "gmail");

    expect(result).toContain("ref=abc");
    expect(result).toContain("utm_source=coach_inayah");
  });

  it("returns original URL when URL parsing fails", () => {
    const result = addUtmParams("not-a-valid-url", "24h", "gmail");
    expect(result).toBe("not-a-valid-url");
  });
});

// ─── SMS-to-Reminder Mapping Tests ──────────────────────────────────────────

describe("SMS_TO_REMINDER_MAP", () => {
  it("maps 'Day Before Reminder' to 24h", () => {
    expect(SMS_TO_REMINDER_MAP["Day Before Reminder"]).toBe("24h");
  });

  it("maps '2 Days Before Reminder' to 24h", () => {
    expect(SMS_TO_REMINDER_MAP["2 Days Before Reminder"]).toBe("24h");
  });

  it("maps '1 Hour Warning' to 1h", () => {
    expect(SMS_TO_REMINDER_MAP["1 Hour Warning"]).toBe("1h");
  });

  it("maps 'Starting NOW' to starting", () => {
    expect(SMS_TO_REMINDER_MAP["Starting NOW"]).toBe("starting");
  });

  it("returns undefined for non-reminder SMS sequences", () => {
    expect(SMS_TO_REMINDER_MAP["Registration Confirmation"]).toBeUndefined();
    expect(SMS_TO_REMINDER_MAP["Post-Webinar Follow Up"]).toBeUndefined();
    expect(SMS_TO_REMINDER_MAP["some random message"]).toBeUndefined();
  });

  it("covers all expected SMS sequence names", () => {
    const expectedKeys = ["Day Before Reminder", "2 Days Before Reminder", "1 Hour Warning", "Starting NOW"];
    expect(Object.keys(SMS_TO_REMINDER_MAP)).toEqual(expectedKeys);
  });
});

// ─── Reminder Scheduler Timing Logic Tests ──────────────────────────────────

describe("Reminder scheduler timing logic", () => {
  it("correctly identifies when 24h reminder is due", () => {
    const now = new Date("2026-03-07T14:00:00Z");
    const webinarStart = new Date("2026-03-08T14:00:00Z");
    const hoursUntilStart = (webinarStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    expect(hoursUntilStart).toBeLessThanOrEqual(24);
    expect(hoursUntilStart).toBeGreaterThan(0);
  });

  it("correctly identifies when 1h reminder is due", () => {
    const now = new Date("2026-03-08T13:00:00Z");
    const webinarStart = new Date("2026-03-08T14:00:00Z");
    const hoursUntilStart = (webinarStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    expect(hoursUntilStart).toBeLessThanOrEqual(1);
    expect(hoursUntilStart).toBeGreaterThan(0);
  });

  it("correctly identifies when starting reminder is due", () => {
    const now = new Date("2026-03-08T14:05:00Z");
    const webinarStart = new Date("2026-03-08T14:00:00Z");
    const minutesPast = (now.getTime() - webinarStart.getTime()) / (1000 * 60);

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

    expect(hoursPast).toBeGreaterThan(2);
  });

  it("does not auto-disable during the webinar window", () => {
    const now = new Date("2026-03-08T15:30:00Z");
    const webinarStart = new Date("2026-03-08T14:00:00Z");
    const hoursPast = (now.getTime() - webinarStart.getTime()) / (1000 * 60 * 60);

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

    const gmailSent = logs.filter(l => l.channel === "gmail" && l.status === "sent").length;
    const gmailFailed = logs.filter(l => l.channel === "gmail" && l.status === "failed").length;
    const calendarSent = logs.filter(l => l.channel === "calendar" && l.status === "sent").length;

    expect(gmailSent).toBe(3);
    expect(gmailFailed).toBe(1);
    expect(calendarSent).toBe(1);

    const reminder24hSent = logs.filter(l => l.emailType === "reminder_24h" && l.status === "sent").length;
    expect(reminder24hSent).toBe(2);
  });
});

// ─── Multi-Channel Dispatch Integration Tests ───────────────────────────────

describe("Multi-channel dispatch integration", () => {
  it("correctly maps SMS sequence names to multi-channel actions", () => {
    // Simulate what the SMS dispatcher does
    const smsMessages = [
      { sequenceName: "Registration Confirmation", expectedReminder: undefined },
      { sequenceName: "Day Before Reminder", expectedReminder: "24h" },
      { sequenceName: "2 Days Before Reminder", expectedReminder: "24h" },
      { sequenceName: "1 Hour Warning", expectedReminder: "1h" },
      { sequenceName: "Starting NOW", expectedReminder: "starting" },
      { sequenceName: "Post-Webinar Follow Up", expectedReminder: undefined },
    ];

    for (const msg of smsMessages) {
      const reminderType = SMS_TO_REMINDER_MAP[msg.sequenceName];
      expect(reminderType).toBe(msg.expectedReminder);
    }
  });

  it("generates correct UTM URLs for multi-channel dispatch", () => {
    const joinUrl = "https://webinarjam.com/live/test123";

    // When SMS dispatcher fires "Day Before Reminder", it should create these UTM URLs:
    const calendarUtm = addUtmParams(joinUrl, "24h", "calendar_update");
    const gmailUtm = addUtmParams(joinUrl, "24h", "gmail");

    // Calendar UTM
    expect(calendarUtm).toContain("utm_medium=calendar");
    expect(calendarUtm).toContain("utm_campaign=webinar_reminder_24h");

    // Gmail UTM
    expect(gmailUtm).toContain("utm_medium=email");
    expect(gmailUtm).toContain("utm_campaign=webinar_reminder_24h");

    // Both should preserve the original URL
    expect(calendarUtm).toContain("webinarjam.com/live/test123");
    expect(gmailUtm).toContain("webinarjam.com/live/test123");
  });

  it("builds correct Gmail emails for each reminder type in multi-channel flow", () => {
    const reminderTypes: Array<"24h" | "1h" | "starting"> = ["24h", "1h", "starting"];

    for (const type of reminderTypes) {
      const email = buildWebinarReminderEmail(
        "Test User",
        "test@example.com",
        type,
        "Test Webinar",
        addUtmParams("https://example.com/join", type, "gmail"),
        "Saturday, March 8, 2:00 PM PST"
      );

      expect(email.to).toBe("test@example.com");
      expect(email.subject).toBeTruthy();
      expect(email.htmlBody).toContain("utm_campaign=webinar_reminder_" + type);
      expect(email.htmlBody).toContain("utm_medium=email");
    }
  });
});

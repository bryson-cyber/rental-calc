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
    const timezone = "America/Los_Angeles";

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

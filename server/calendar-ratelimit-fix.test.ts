import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for Calendar Invite Rate Limiting Fix:
 * 1. sendBulkCalendarInvites uses proper rate limiting (1500ms+ delay, not 200ms)
 * 2. isRateLimitError helper function exists and covers key patterns
 * 3. Exponential backoff retry logic exists for rate-limited invites
 * 4. sendCalendarReminderUpdates also uses proper rate limiting
 * 5. sendBulkReminderEmails (Gmail) also uses proper rate limiting
 */

describe("Calendar Rate Limit Fix - Code Structure", () => {
  const calendarSource = fs.readFileSync(
    path.resolve(__dirname, "google-calendar.ts"),
    "utf-8"
  );

  it("should have isRateLimitError helper function", () => {
    expect(calendarSource).toContain("function isRateLimitError(");
    expect(calendarSource).toContain("rate limit");
    expect(calendarSource).toContain("429");
    expect(calendarSource).toContain("quota");
    expect(calendarSource).toContain("too many requests");
  });

  it("sendBulkCalendarInvites should use 1500ms+ base delay (not 200ms)", () => {
    // Find the sendBulkCalendarInvites function
    const funcStart = calendarSource.indexOf("export async function sendBulkCalendarInvites(");
    expect(funcStart).toBeGreaterThan(-1);

    // Find the end of the function (next export)
    const funcEnd = calendarSource.indexOf("/**\n * Check if the Google Calendar", funcStart);
    expect(funcEnd).toBeGreaterThan(funcStart);

    const funcBody = calendarSource.substring(funcStart, funcEnd);

    // Should NOT have the old 200ms delay
    expect(funcBody).not.toContain("setTimeout(r, 200)");

    // Should have 1500ms base delay
    expect(funcBody).toContain("BASE_DELAY_MS = 1500");
  });

  it("sendBulkCalendarInvites should have exponential backoff on rate limit", () => {
    const funcStart = calendarSource.indexOf("export async function sendBulkCalendarInvites(");
    const funcEnd = calendarSource.indexOf("/**\n * Check if the Google Calendar", funcStart);
    const funcBody = calendarSource.substring(funcStart, funcEnd);

    // Should have retry logic
    expect(funcBody).toContain("MAX_RETRIES");
    expect(funcBody).toContain("INITIAL_BACKOFF_MS");
    expect(funcBody).toContain("Math.pow(2, attempt)");

    // Should check for rate limit errors
    expect(funcBody).toContain("isRateLimitError");

    // Should have consecutive rate limit tracking
    expect(funcBody).toContain("consecutiveRateLimits");
  });

  it("sendBulkCalendarInvites should have progress logging", () => {
    const funcStart = calendarSource.indexOf("export async function sendBulkCalendarInvites(");
    const funcEnd = calendarSource.indexOf("/**\n * Check if the Google Calendar", funcStart);
    const funcBody = calendarSource.substring(funcStart, funcEnd);

    expect(funcBody).toContain("Progress:");
    expect(funcBody).toContain("% 25");
  });

  it("sendCalendarReminderUpdates should use 1500ms+ delay (not 200ms)", () => {
    const funcStart = calendarSource.indexOf("export async function sendCalendarReminderUpdates(");
    expect(funcStart).toBeGreaterThan(-1);

    const funcEnd = calendarSource.indexOf("/**\n * Clear the cached auth", funcStart);
    const funcBody = calendarSource.substring(funcStart, funcEnd);

    // Should NOT have the old 200ms delay
    expect(funcBody).not.toContain("setTimeout(r, 200)");

    // Should have 1500ms delay
    expect(funcBody).toContain("1500");

    // Should have retry logic
    expect(funcBody).toContain("isRateLimitError");
    expect(funcBody).toContain("consecutiveRateLimits");
  });
});

describe("Gmail Bulk Send Rate Limit Fix", () => {
  const gmailSource = fs.readFileSync(
    path.resolve(__dirname, "gmail-reminders.ts"),
    "utf-8"
  );

  it("sendBulkReminderEmails should use 1500ms+ delay (not 500ms)", () => {
    const funcStart = gmailSource.indexOf("export async function sendBulkReminderEmails(");
    expect(funcStart).toBeGreaterThan(-1);

    const funcEnd = gmailSource.indexOf("/**", funcStart + 100);
    const funcBody = gmailSource.substring(funcStart, funcEnd);

    // Should NOT have the old 500ms delay
    expect(funcBody).not.toContain("setTimeout(r, 500)");

    // Should have 1500ms delay
    expect(funcBody).toContain("1500");

    // Should have retry logic
    expect(funcBody).toContain("rate limit");
    expect(funcBody).toContain("consecutiveRateLimits");
    expect(funcBody).toContain("Math.pow(2, attempt)");
  });

  it("sendBulkReminderEmails should have progress logging", () => {
    const funcStart = gmailSource.indexOf("export async function sendBulkReminderEmails(");
    const funcEnd = gmailSource.indexOf("/**", funcStart + 100);
    const funcBody = gmailSource.substring(funcStart, funcEnd);

    expect(funcBody).toContain("Progress:");
    expect(funcBody).toContain("% 25");
  });
});

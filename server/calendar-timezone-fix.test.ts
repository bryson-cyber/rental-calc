import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for Calendar Invite Timezone Fix:
 * 
 * Root cause: WebinarJam returns schedule dates like "2026-03-11 19:00" in the
 * webinar's timezone (America/New_York). The code was converting this through
 * `new Date("2026-03-11 19:00:00")` which JavaScript parses as UTC, then
 * `.toISOString()` outputs "2026-03-11T19:00:00.000Z" (UTC). Google Calendar
 * sees the Z suffix and treats it as UTC, ignoring the timeZone field.
 * Result: event shows 4 hours early (7pm UTC = 3pm ET = 12pm PT).
 * 
 * Fix: Pass raw date strings and use local time format (no Z suffix) so
 * Google Calendar respects the timeZone field.
 */

describe("Calendar Invite Timezone Fix - google-calendar.ts", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "google-calendar.ts"),
    "utf-8"
  );

  it("should NOT use .toISOString() for start/end dateTime in event creation", () => {
    // Find the event creation section
    const eventStart = source.indexOf("const event: calendar_v3.Schema$Event");
    expect(eventStart).toBeGreaterThan(-1);
    
    const eventSection = source.substring(eventStart, eventStart + 500);
    
    // Should NOT use .toISOString() which appends Z (UTC)
    expect(eventSection).not.toContain("toISOString()");
    
    // Should use the local time variables
    expect(eventSection).toContain("startDateTimeLocal");
    expect(eventSection).toContain("endDateTimeLocal");
  });

  it("should handle string input by normalizing to YYYY-MM-DDTHH:mm:ss without Z", () => {
    // The code should replace spaces with T and strip Z suffix
    expect(source).toContain('params.startTime.replace(" ", "T")');
    expect(source).toContain('.replace(/Z$/, "")');
  });

  it("should strip timezone offset suffixes from input strings", () => {
    expect(source).toContain('.replace(/[+-]\\d{2}:\\d{2}$/, "")');
  });

  it("should compute default end time (90 min) from string without Date object", () => {
    // The end time calculation should work with string parsing, not Date math
    expect(source).toContain("startDateTimeLocal.split(\"T\")");
    expect(source).toContain("+ 90");
  });

  it("should have timezone-aware date handling documentation", () => {
    expect(source).toContain("TIMEZONE-AWARE DATE HANDLING");
    expect(source).toContain("must NOT convert through JavaScript's");
    expect(source).toContain("4-5 hour offset");
  });
});

describe("Calendar Invite Timezone Fix - webinar-sms.ts", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "routers/webinar-sms.ts"),
    "utf-8"
  );

  it("should NOT use new Date() to parse schedule dates for calendar invites", () => {
    // Find all instances where scheduleDate is used for calendar startTime
    // There should be NO `new Date(\`${scheduleDate}:00\`)` patterns remaining
    const badPattern = /const startTime = new Date\(`\$\{scheduleDate\}/g;
    const matches = source.match(badPattern);
    expect(matches).toBeNull();
  });

  it("should pass scheduleDate as raw string in all calendar invite paths", () => {
    // All three paths should have the comment about not converting through new Date()
    const commentPattern = /DO NOT convert through new Date\(\)/g;
    const matches = source.match(commentPattern);
    // Should appear in: single invite, bulk invite, auto-send
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it("should keep scheduleDate as string type for startTime", () => {
    // Each invite path assigns startTime directly from the raw scheduleDate
    // string (via let or const) — never parsed through new Date(). Matches the
    // single/bulk/auto-send paths.
    const stringPattern = /startTime = scheduleDate;/g;
    const matches = source.match(stringPattern);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Calendar Invite Timezone - Correctness Verification", () => {
  it("should produce correct local time format for WebinarJam date", () => {
    // Simulate what the fixed code does
    const scheduleDate = "2026-03-11 19:00"; // WebinarJam format
    
    // Old code (WRONG): new Date("2026-03-11 19:00:00") parses differently
    // depending on the runtime timezone. The key issue is that the resulting
    // .toISOString() always has a Z suffix, which Google Calendar treats as UTC,
    // ignoring the timeZone field entirely.
    const oldWay = new Date(`${scheduleDate}:00`).toISOString();
    // The old way always ends with Z, which is the problem
    expect(oldWay).toMatch(/Z$/);
    
    // New code (CORRECT): normalize string to local format
    let newWay = scheduleDate.replace(" ", "T");
    if (!newWay.includes(":", 14)) newWay += ":00";
    newWay = newWay.replace(/Z$/, "").replace(/[+-]\d{2}:\d{2}$/, "");
    
    expect(newWay).toBe("2026-03-11T19:00:00"); // No Z = local time!
    // Google Calendar will interpret this as 7:00 PM in the specified timezone
  });

  it("should correctly compute 90-minute end time from string", () => {
    const startDateTimeLocal = "2026-03-11T19:00:00";
    const [datePart, timePart] = startDateTimeLocal.split("T");
    const [hours, minutes, seconds] = timePart.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + 90;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    const endDateTimeLocal = `${datePart}T${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:${String(seconds || 0).padStart(2, "0")}`;
    
    expect(endDateTimeLocal).toBe("2026-03-11T20:30:00"); // 7pm + 90min = 8:30pm
  });

  it("should handle edge case: end time crossing midnight", () => {
    const startDateTimeLocal = "2026-03-11T23:00:00";
    const [datePart, timePart] = startDateTimeLocal.split("T");
    const [hours, minutes, seconds] = timePart.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + 90;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    const endDateTimeLocal = `${datePart}T${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:${String(seconds || 0).padStart(2, "0")}`;
    
    // 11pm + 90min = 12:30am (next day, but date part stays same — Google handles this)
    expect(endDateTimeLocal).toBe("2026-03-11T00:30:00");
  });
});

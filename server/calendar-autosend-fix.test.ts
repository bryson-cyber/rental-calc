import { describe, it, expect } from "vitest";
import * as fs from "fs";

/**
 * Tests for Calendar Auto-Send Fix:
 * 1. autoSendCalendarInvites uses proper rate limiting (1500ms, not 200ms)
 * 2. autoSendCalendarInvites has retry/backoff logic for rate limits
 * 3. runWebinarImport sends to ALL pending registrants, not just newly imported
 * 4. Pending registrants with errors are excluded from auto-send (avoid hammering)
 */

describe("Calendar Auto-Send Fix - Code Structure", () => {
  const source = fs.readFileSync(
    "/home/ubuntu/rental-calculator/server/routers/webinar-sms.ts",
    "utf-8"
  );

  it("autoSendCalendarInvites should use 1500ms delay (not 200ms)", () => {
    // Find the autoSendCalendarInvites function
    const funcStart = source.indexOf("async function autoSendCalendarInvites(");
    expect(funcStart).toBeGreaterThan(-1);

    // Find the end of the function (next section marker)
    const funcEnd = source.indexOf("// ─── Shared import logic", funcStart);
    expect(funcEnd).toBeGreaterThan(funcStart);

    const funcBody = source.substring(funcStart, funcEnd);

    // Should NOT have the old 200ms delay
    expect(funcBody).not.toContain("setTimeout(r, 200)");

    // Should have 1500ms delay
    expect(funcBody).toContain("1500");
  });

  it("autoSendCalendarInvites should have retry/backoff on rate limit", () => {
    const funcStart = source.indexOf("async function autoSendCalendarInvites(");
    const funcEnd = source.indexOf("// ─── Shared import logic", funcStart);
    const funcBody = source.substring(funcStart, funcEnd);

    // Should have retry logic
    expect(funcBody).toContain("attempt");
    expect(funcBody).toContain("Math.pow(2, attempt)");

    // Should check for rate limit errors
    expect(funcBody).toContain("rate limit");
    expect(funcBody).toContain("consecutiveRateLimits");
  });

  it("autoSendCalendarInvites should have progress logging", () => {
    const funcStart = source.indexOf("async function autoSendCalendarInvites(");
    const funcEnd = source.indexOf("// ─── Shared import logic", funcStart);
    const funcBody = source.substring(funcStart, funcEnd);

    expect(funcBody).toContain("Progress:");
    expect(funcBody).toContain("% 25");
  });

  it("runWebinarImport should send to ALL pending registrants, not just new imports", () => {
    const funcStart = source.indexOf("async function runWebinarImport(");
    expect(funcStart).toBeGreaterThan(-1);

    // Find the calendar auto-send section
    const funcEnd = source.indexOf("// ─── Cron:", funcStart);
    const funcBody = source.substring(funcStart, funcEnd);

    // Should NOT be gated by "if (imported > 0)" — should always check for pending
    // The old code had: if (imported > 0) { ... query recent ... }
    // The new code should query ALL pending regardless of import count
    expect(funcBody).toContain("Auto-send calendar invites to ALL pending registrants");
    expect(funcBody).toContain("calendarInviteSent, 0");

    // Should exclude registrants with existing errors (avoid hammering)
    expect(funcBody).toContain("calendarInviteError");
  });

  it("should log when pending registrants are found for auto-send", () => {
    const funcStart = source.indexOf("async function runWebinarImport(");
    const funcEnd = source.indexOf("// ─── Cron:", funcStart);
    const funcBody = source.substring(funcStart, funcEnd);

    expect(funcBody).toContain("Found");
    expect(funcBody).toContain("pending registrants for auto-send");
  });
});

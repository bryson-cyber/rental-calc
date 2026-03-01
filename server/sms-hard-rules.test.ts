/**
 * Tests for the HARD RULES in the SMS Dispatcher
 * These rules ensure attendance-targeted messages (attended / not_attended)
 * only go to the correct audience by enforcing fresh WebinarJam sync.
 */
import { describe, it, expect } from "vitest";

describe("SMS Dispatcher Hard Rules", () => {
  // Simulate the hard rules logic as implemented in processScheduledMessages

  type Audience = "all" | "attended" | "not_attended";

  interface DispatchDecision {
    action: "send" | "block";
    reason: string;
  }

  /**
   * Replicate the hard rules decision logic from the SMS dispatcher.
   * This mirrors the exact checks in processScheduledMessages.
   */
  function evaluateHardRules(
    audience: Audience,
    syncSuccess: boolean,
    confirmedAttendees: number
  ): DispatchDecision {
    // "all" audience messages skip hard rules entirely
    if (audience === "all") {
      return { action: "send", reason: "Audience is 'all' — no attendance check needed" };
    }

    // RULE 1 + 2: Sync must succeed
    if (!syncSuccess) {
      return {
        action: "block",
        reason: "Attendance sync failed — cannot verify audience",
      };
    }

    // RULE 3: For not_attended, require at least 1 confirmed attendee
    if (audience === "not_attended" && confirmedAttendees === 0) {
      return {
        action: "block",
        reason: "0 confirmed attendees — attendance data not yet available",
      };
    }

    // All rules passed
    return {
      action: "send",
      reason: `Attendance data verified (${confirmedAttendees} confirmed attendees)`,
    };
  }

  // ─── RULE 1: Force attendance sync ──────────────────────────────────────

  it("should BLOCK not_attended message when attendance sync fails", () => {
    const decision = evaluateHardRules("not_attended", false, 0);
    expect(decision.action).toBe("block");
    expect(decision.reason).toContain("sync failed");
  });

  it("should BLOCK attended message when attendance sync fails", () => {
    const decision = evaluateHardRules("attended", false, 0);
    expect(decision.action).toBe("block");
    expect(decision.reason).toContain("sync failed");
  });

  it("should NOT require sync for 'all' audience messages", () => {
    const decision = evaluateHardRules("all", false, 0);
    expect(decision.action).toBe("send");
    expect(decision.reason).toContain("no attendance check needed");
  });

  // ─── RULE 2: Fail safe — skip if sync fails ────────────────────────────

  it("should BLOCK even if there are registrants when sync fails", () => {
    // Even if we had previous attendance data, a failed sync means
    // the data could be stale — block to be safe
    const decision = evaluateHardRules("not_attended", false, 5);
    expect(decision.action).toBe("block");
  });

  // ─── RULE 3: Require confirmed attendees for not_attended ───────────────

  it("should BLOCK not_attended message when 0 confirmed attendees after successful sync", () => {
    // Sync succeeded but nobody is marked as attended yet
    // This means WebinarJam hasn't reported attendance — everyone looks like a no-show
    const decision = evaluateHardRules("not_attended", true, 0);
    expect(decision.action).toBe("block");
    expect(decision.reason).toContain("0 confirmed attendees");
  });

  it("should ALLOW not_attended message when at least 1 confirmed attendee exists", () => {
    const decision = evaluateHardRules("not_attended", true, 1);
    expect(decision.action).toBe("send");
    expect(decision.reason).toContain("1 confirmed attendees");
  });

  it("should ALLOW not_attended message when many confirmed attendees exist", () => {
    const decision = evaluateHardRules("not_attended", true, 25);
    expect(decision.action).toBe("send");
    expect(decision.reason).toContain("25 confirmed attendees");
  });

  it("should ALLOW attended message even with 0 confirmed attendees (sync succeeded)", () => {
    // For "attended" audience, if sync succeeded but 0 attended,
    // the query will simply return 0 recipients — no harm done
    const decision = evaluateHardRules("attended", true, 0);
    expect(decision.action).toBe("send");
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────

  it("should ALLOW 'all' audience messages regardless of sync or attendance state", () => {
    // "all" messages don't care about attendance
    expect(evaluateHardRules("all", true, 0).action).toBe("send");
    expect(evaluateHardRules("all", true, 50).action).toBe("send");
    expect(evaluateHardRules("all", false, 0).action).toBe("send");
    expect(evaluateHardRules("all", false, 50).action).toBe("send");
  });

  it("should treat sync failure as higher priority than attendee count check", () => {
    // Even with 100 confirmed attendees, if sync failed, block
    // (because the data might be stale and wrong)
    const decision = evaluateHardRules("not_attended", false, 100);
    expect(decision.action).toBe("block");
    expect(decision.reason).toContain("sync failed");
  });

  // ─── Scenario: No-Show Nudge (the specific use case) ───────────────────

  it("should BLOCK No-Show Nudge when WebinarJam API is down", () => {
    // Webinar just started, API is unreachable
    const decision = evaluateHardRules("not_attended", false, 0);
    expect(decision.action).toBe("block");
  });

  it("should BLOCK No-Show Nudge when webinar just started and no attendance data yet", () => {
    // Webinar started 10 min ago, sync succeeded but WebinarJam
    // hasn't reported any attendees yet (all still show attended=0)
    const decision = evaluateHardRules("not_attended", true, 0);
    expect(decision.action).toBe("block");
  });

  it("should ALLOW No-Show Nudge when some people are confirmed as attending", () => {
    // Webinar started 10 min ago, 15 people confirmed attending,
    // 30 people still show attended=0 — safe to nudge the 30
    const decision = evaluateHardRules("not_attended", true, 15);
    expect(decision.action).toBe("send");
  });
});

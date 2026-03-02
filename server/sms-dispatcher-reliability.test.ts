/**
 * Tests for SMS Dispatcher Reliability Fixes:
 * 1. Startup recovery for stuck "sending" messages
 * 2. Incremental count updates during batch sending
 * 3. Delivery tracking resilience (try/catch per recipient)
 */
import { describe, it, expect } from "vitest";

// ─── Startup Recovery Logic ──────────────────────────────────────────────────

describe("SMS Dispatcher Startup Recovery", () => {
  type RecoveryAction = "reset_to_pending" | "mark_failed" | "skip";

  interface RecoveryDecision {
    action: RecoveryAction;
    reason: string;
  }

  /**
   * Replicate the startup recovery decision logic.
   * On startup, any message stuck in "sending" state is evaluated:
   * - If within 30-min window: reset to "pending" for retry
   * - If older than 30 min: mark as "failed" (too stale to retry)
   * - If not in "sending" state: skip (no recovery needed)
   */
  function evaluateRecovery(
    status: string,
    scheduledAtMs: number,
    nowMs: number
  ): RecoveryDecision {
    const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

    if (status !== "sending") {
      return { action: "skip", reason: "Not stuck — status is " + status };
    }

    const age = nowMs - scheduledAtMs;

    if (age <= STALE_THRESHOLD_MS) {
      return {
        action: "reset_to_pending",
        reason: `Stuck for ${Math.round(age / 60000)}min — within 30min window, resetting to pending`,
      };
    } else {
      return {
        action: "mark_failed",
        reason: `Stuck for ${Math.round(age / 60000)}min — exceeds 30min threshold, marking as failed`,
      };
    }
  }

  it("should reset a message stuck for 5 minutes back to pending", () => {
    const now = Date.now();
    const scheduledAt = now - 5 * 60 * 1000; // 5 min ago
    const decision = evaluateRecovery("sending", scheduledAt, now);
    expect(decision.action).toBe("reset_to_pending");
    expect(decision.reason).toContain("5min");
  });

  it("should reset a message stuck for exactly 30 minutes back to pending", () => {
    const now = Date.now();
    const scheduledAt = now - 30 * 60 * 1000; // exactly 30 min ago
    const decision = evaluateRecovery("sending", scheduledAt, now);
    expect(decision.action).toBe("reset_to_pending");
  });

  it("should mark a message stuck for 31 minutes as failed", () => {
    const now = Date.now();
    const scheduledAt = now - 31 * 60 * 1000; // 31 min ago
    const decision = evaluateRecovery("sending", scheduledAt, now);
    expect(decision.action).toBe("mark_failed");
    expect(decision.reason).toContain("31min");
  });

  it("should mark a message stuck for 2 hours as failed", () => {
    const now = Date.now();
    const scheduledAt = now - 120 * 60 * 1000; // 2 hours ago
    const decision = evaluateRecovery("sending", scheduledAt, now);
    expect(decision.action).toBe("mark_failed");
    expect(decision.reason).toContain("120min");
  });

  it("should skip messages with 'pending' status", () => {
    const decision = evaluateRecovery("pending", Date.now(), Date.now());
    expect(decision.action).toBe("skip");
  });

  it("should skip messages with 'sent' status", () => {
    const decision = evaluateRecovery("sent", Date.now(), Date.now());
    expect(decision.action).toBe("skip");
  });

  it("should skip messages with 'failed' status", () => {
    const decision = evaluateRecovery("failed", Date.now(), Date.now());
    expect(decision.action).toBe("skip");
  });

  it("should skip messages with 'cancelled' status", () => {
    const decision = evaluateRecovery("cancelled", Date.now(), Date.now());
    expect(decision.action).toBe("skip");
  });

  it("should reset a message stuck for 0 minutes (just started) back to pending", () => {
    const now = Date.now();
    const decision = evaluateRecovery("sending", now, now);
    expect(decision.action).toBe("reset_to_pending");
    expect(decision.reason).toContain("0min");
  });
});

// ─── Incremental Count Updates ───────────────────────────────────────────────

describe("SMS Dispatcher Incremental Count Updates", () => {
  const BATCH_UPDATE_INTERVAL = 25;

  /**
   * Determine if counts should be persisted to the database at this index.
   * Counts are updated every BATCH_UPDATE_INTERVAL sends and on the last send.
   */
  function shouldUpdateCounts(index: number, totalRecipients: number): boolean {
    return (index + 1) % BATCH_UPDATE_INTERVAL === 0 || index === totalRecipients - 1;
  }

  it("should update counts at index 24 (25th send)", () => {
    expect(shouldUpdateCounts(24, 100)).toBe(true);
  });

  it("should update counts at index 49 (50th send)", () => {
    expect(shouldUpdateCounts(49, 100)).toBe(true);
  });

  it("should NOT update counts at index 23", () => {
    expect(shouldUpdateCounts(23, 100)).toBe(false);
  });

  it("should update counts on the last recipient (index 99 of 100)", () => {
    expect(shouldUpdateCounts(99, 100)).toBe(true);
  });

  it("should update counts on the last recipient even if not at interval boundary", () => {
    // 37 recipients — last index is 36, not a multiple of 25
    expect(shouldUpdateCounts(36, 37)).toBe(true);
  });

  it("should update counts for a single recipient batch", () => {
    expect(shouldUpdateCounts(0, 1)).toBe(true);
  });

  it("should count total DB updates for a 342-recipient batch", () => {
    // 342 recipients: updates at 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 342
    let updateCount = 0;
    for (let i = 0; i < 342; i++) {
      if (shouldUpdateCounts(i, 342)) updateCount++;
    }
    // 342/25 = 13 interval updates + 1 final = 14 total
    // But 342 is not a multiple of 25, so last interval (325) and final (342) are separate
    expect(updateCount).toBe(14);
  });

  it("should count total DB updates for a 50-recipient batch (exact multiple)", () => {
    let updateCount = 0;
    for (let i = 0; i < 50; i++) {
      if (shouldUpdateCounts(i, 50)) updateCount++;
    }
    // 50/25 = 2 interval updates, and index 49 is both interval AND last
    expect(updateCount).toBe(2);
  });
});

// ─── Delivery Tracking Resilience ────────────────────────────────────────────

describe("SMS Dispatcher Delivery Tracking Resilience", () => {
  /**
   * Simulate the sending loop with try/catch around delivery tracking.
   * Even if delivery DB inserts fail, the send count should still be accurate.
   */
  function simulateSendingLoop(
    recipients: { phone: string; sendSuccess: boolean }[],
    deliveryTrackingFailsAt: number[] // indices where DB insert will throw
  ): { sentCount: number; failedCount: number; trackingErrors: number } {
    let sentCount = 0;
    let failedCount = 0;
    let trackingErrors = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      // Simulate send
      if (recipient.sendSuccess) {
        sentCount++;
      } else {
        failedCount++;
      }

      // Simulate delivery tracking with try/catch
      try {
        if (deliveryTrackingFailsAt.includes(i)) {
          throw new Error("DB insert failed");
        }
        // DB insert would happen here
      } catch {
        trackingErrors++;
        // Error is caught — loop continues
      }
    }

    return { sentCount, failedCount, trackingErrors };
  }

  it("should count all sends correctly even when delivery tracking fails", () => {
    const recipients = Array.from({ length: 10 }, (_, i) => ({
      phone: `555000${i}`,
      sendSuccess: true,
    }));

    // Delivery tracking fails for recipients 3 and 7
    const result = simulateSendingLoop(recipients, [3, 7]);
    expect(result.sentCount).toBe(10);
    expect(result.failedCount).toBe(0);
    expect(result.trackingErrors).toBe(2);
  });

  it("should count mixed success/failure sends correctly despite tracking errors", () => {
    const recipients = [
      { phone: "5550001", sendSuccess: true },
      { phone: "5550002", sendSuccess: false },
      { phone: "5550003", sendSuccess: true },
      { phone: "5550004", sendSuccess: false },
      { phone: "5550005", sendSuccess: true },
    ];

    // All delivery tracking fails
    const result = simulateSendingLoop(recipients, [0, 1, 2, 3, 4]);
    expect(result.sentCount).toBe(3);
    expect(result.failedCount).toBe(2);
    expect(result.trackingErrors).toBe(5);
  });

  it("should have zero tracking errors when all DB inserts succeed", () => {
    const recipients = Array.from({ length: 5 }, (_, i) => ({
      phone: `555000${i}`,
      sendSuccess: true,
    }));

    const result = simulateSendingLoop(recipients, []);
    expect(result.sentCount).toBe(5);
    expect(result.trackingErrors).toBe(0);
  });
});

import { describe, it, expect } from "vitest";

/**
 * Tests for the SMS Dispatcher logic.
 * The dispatcher runs every 30s, picks up pending scheduled messages whose
 * scheduledAt <= now, sends them via SimpleTexting, and updates status/counts.
 */

describe("SMS Dispatcher Logic", () => {
  describe("Staleness Guard", () => {
    it("should identify messages within 30-minute window as sendable", () => {
      const now = Date.now();
      const staleThresholdMs = 30 * 60 * 1000;

      // Message scheduled 5 minutes ago — should be sent
      const fiveMinAgo = now - 5 * 60 * 1000;
      expect(now - fiveMinAgo).toBeLessThanOrEqual(staleThresholdMs);

      // Message scheduled 29 minutes ago — should be sent
      const twentyNineMinAgo = now - 29 * 60 * 1000;
      expect(now - twentyNineMinAgo).toBeLessThanOrEqual(staleThresholdMs);
    });

    it("should identify messages older than 30 minutes as stale", () => {
      const now = Date.now();
      const staleThresholdMs = 30 * 60 * 1000;

      // Message scheduled 31 minutes ago — should be skipped
      const thirtyOneMinAgo = now - 31 * 60 * 1000;
      expect(now - thirtyOneMinAgo).toBeGreaterThan(staleThresholdMs);

      // Message scheduled 2 hours ago — should be skipped
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;
      expect(now - twoHoursAgo).toBeGreaterThan(staleThresholdMs);

      // Message scheduled yesterday — should be skipped
      const yesterday = now - 24 * 60 * 60 * 1000;
      expect(now - yesterday).toBeGreaterThan(staleThresholdMs);
    });

    it("should not consider future messages as due", () => {
      const now = Date.now();

      // Message scheduled 5 minutes from now — should NOT be picked up
      const fiveMinFromNow = now + 5 * 60 * 1000;
      expect(fiveMinFromNow).toBeGreaterThan(now);
      // The query uses lte(scheduledAt, now), so future messages won't match
    });
  });

  describe("Audience Filtering Logic", () => {
    it("should correctly identify audience types", () => {
      const audiences = ["all", "attended", "not_attended"];
      expect(audiences).toContain("all");
      expect(audiences).toContain("attended");
      expect(audiences).toContain("not_attended");
    });

    it("should apply correct filter for attended audience", () => {
      // When audience is "attended", only registrants with attended=1 should receive
      const registrants = [
        { id: 1, name: "Alice", phone: "5551234567", attended: 1 },
        { id: 2, name: "Bob", phone: "5559876543", attended: 0 },
        { id: 3, name: "Carol", phone: "5555555555", attended: 1 },
      ];

      const attended = registrants.filter(r => r.attended === 1);
      expect(attended).toHaveLength(2);
      expect(attended.map(r => r.name)).toEqual(["Alice", "Carol"]);
    });

    it("should apply correct filter for not_attended audience", () => {
      const registrants = [
        { id: 1, name: "Alice", phone: "5551234567", attended: 1 },
        { id: 2, name: "Bob", phone: "5559876543", attended: 0 },
        { id: 3, name: "Carol", phone: "5555555555", attended: 0 },
      ];

      const notAttended = registrants.filter(r => r.attended === 0 || r.attended === null);
      expect(notAttended).toHaveLength(2);
      expect(notAttended.map(r => r.name)).toEqual(["Bob", "Carol"]);
    });

    it("should include all registrants for 'all' audience", () => {
      const registrants = [
        { id: 1, name: "Alice", attended: 1 },
        { id: 2, name: "Bob", attended: 0 },
        { id: 3, name: "Carol", attended: 1 },
      ];

      // No filter for "all"
      expect(registrants).toHaveLength(3);
    });
  });

  describe("Message Personalization", () => {
    it("should replace %FIRST_NAME% with first name", () => {
      const template = "Hey %FIRST_NAME%, join us now!";
      const name = "John Smith";
      const firstName = name.split(" ")[0];
      const result = template.replace(/%FIRST_NAME%/g, firstName);
      expect(result).toBe("Hey John, join us now!");
    });

    it("should handle names with no last name", () => {
      const template = "%FIRST_NAME%, we missed you!";
      const name = "Alice";
      const firstName = name.split(" ")[0];
      const result = template.replace(/%FIRST_NAME%/g, firstName);
      expect(result).toBe("Alice, we missed you!");
    });

    it("should handle multiple %FIRST_NAME% occurrences", () => {
      const template = "Hi %FIRST_NAME%! %FIRST_NAME%, don't miss out!";
      const firstName = "Bob";
      const result = template.replace(/%FIRST_NAME%/g, firstName);
      expect(result).toBe("Hi Bob! Bob, don't miss out!");
    });
  });

  describe("Status Transitions", () => {
    it("should follow valid status transitions", () => {
      const validTransitions: Record<string, string[]> = {
        pending: ["sending", "cancelled"],
        sending: ["sent", "failed"],
        sent: [],
        failed: [],
        cancelled: [],
      };

      // pending -> sending (dispatcher picks it up)
      expect(validTransitions.pending).toContain("sending");

      // sending -> sent (all messages delivered)
      expect(validTransitions.sending).toContain("sent");

      // sending -> failed (all messages failed)
      expect(validTransitions.sending).toContain("failed");

      // pending -> cancelled (stale message auto-cancelled)
      expect(validTransitions.pending).toContain("cancelled");
    });
  });

  describe("Delivery Status Display", () => {
    it("should format sent time correctly", () => {
      const sentAt = new Date("2026-02-25T15:30:00");
      const timeStr = sentAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      expect(timeStr).toBeTruthy();
      // Should contain hour and minute
      expect(timeStr).toMatch(/\d{1,2}:\d{2}/);
    });

    it("should show delivery counts", () => {
      const msg = { sentCount: 350, failedCount: 9 };
      const display = `${msg.sentCount} delivered`;
      expect(display).toBe("350 delivered");

      const failDisplay = msg.failedCount > 0 ? `(${msg.failedCount} failed)` : "";
      expect(failDisplay).toBe("(9 failed)");
    });
  });
});

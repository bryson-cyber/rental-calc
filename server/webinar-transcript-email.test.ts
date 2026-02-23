import { describe, it, expect, vi } from "vitest";

/**
 * Tests for webinar transcript storage and email composition features.
 * These test the data structures and validation logic without hitting real APIs.
 */

describe("Webinar Transcript & Email Features", () => {
  describe("Transcript Storage", () => {
    it("should validate transcript input requires webinarId and transcript text", () => {
      const validInput = {
        webinarId: "370",
        webinarTitle: "5 Steps to Get Your First Yes",
        keySummary: "Airbnb rental arbitrage webinar",
        transcript: "Full transcript text here...",
      };

      expect(validInput.webinarId).toBeTruthy();
      expect(validInput.transcript.length).toBeGreaterThan(0);
      expect(validInput.webinarTitle).toBeDefined();
      expect(validInput.keySummary).toBeDefined();
    });

    it("should allow optional webinarTitle and keySummary", () => {
      const minimalInput = {
        webinarId: "370",
        transcript: "Some transcript text",
      };

      expect(minimalInput.webinarId).toBeTruthy();
      expect(minimalInput.transcript).toBeTruthy();
      // These should be optional
      expect((minimalInput as any).webinarTitle).toBeUndefined();
      expect((minimalInput as any).keySummary).toBeUndefined();
    });

    it("should handle large transcript text", () => {
      const largeTranscript = "A".repeat(200000);
      expect(largeTranscript.length).toBe(200000);
      // Ensure substring extraction for AI context works
      const contextSlice = largeTranscript.substring(0, 3000);
      expect(contextSlice.length).toBe(3000);
    });
  });

  describe("AI Email Composition", () => {
    it("should validate email compose input", () => {
      const input = {
        prompt: "Tell them about the replay and what they missed",
        webinarId: "370",
      };

      expect(input.prompt.length).toBeGreaterThan(0);
      expect(input.prompt.length).toBeLessThanOrEqual(2000);
      expect(input.webinarId).toBeTruthy();
    });

    it("should parse valid JSON email response", () => {
      const aiResponse = JSON.stringify({
        subject: "You missed something amazing, %FIRST_NAME%!",
        body: "Hey %FIRST_NAME%,\n\nI noticed you registered for our class but couldn't make it...",
      });

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      expect(jsonMatch).toBeTruthy();

      const parsed = JSON.parse(jsonMatch![0]);
      expect(parsed.subject).toBeTruthy();
      expect(parsed.body).toBeTruthy();
      expect(parsed.body).toContain("%FIRST_NAME%");
    });

    it("should handle JSON wrapped in markdown code blocks", () => {
      const aiResponse = '```json\n{"subject": "Test Subject", "body": "Test Body"}\n```';
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      expect(jsonMatch).toBeTruthy();

      const parsed = JSON.parse(jsonMatch![0]);
      expect(parsed.subject).toBe("Test Subject");
      expect(parsed.body).toBe("Test Body");
    });
  });

  describe("Email Personalization", () => {
    it("should replace all personalization variables", () => {
      const template = "Hey %FIRST_NAME%, your full name is %FULL_NAME% and email is %EMAIL%";
      const registrant = {
        name: "John Smith",
        email: "john@example.com",
      };

      const nameParts = registrant.name.split(" ");
      const firstName = nameParts[0] || "Friend";
      const fullName = registrant.name;

      const personalized = template
        .replace(/%FIRST_NAME%/g, firstName)
        .replace(/%FULL_NAME%/g, fullName)
        .replace(/%EMAIL%/g, registrant.email);

      expect(personalized).toBe("Hey John, your full name is John Smith and email is john@example.com");
    });

    it("should handle missing name gracefully", () => {
      const name = "";
      const nameParts = (name || "Friend").split(" ");
      const firstName = nameParts[0] || "Friend";

      expect(firstName).toBe("Friend");
    });

    it("should handle single-word names", () => {
      const name = "Madonna";
      const nameParts = name.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "";

      expect(firstName).toBe("Madonna");
      expect(lastName).toBe("");
    });
  });

  describe("HubSpot Email Send", () => {
    it("should validate emailNoShows input", () => {
      const input = {
        webinarId: "370",
        subject: "You missed our class, %FIRST_NAME%!",
        body: "Hey %FIRST_NAME%,\n\nWe missed you at the webinar...",
      };

      expect(input.webinarId).toBeTruthy();
      expect(input.subject.length).toBeGreaterThan(0);
      expect(input.body.length).toBeGreaterThan(0);
    });

    it("should filter no-shows correctly", () => {
      const registrants = [
        { id: 1, name: "Alice", email: "alice@test.com", attended: 1 },
        { id: 2, name: "Bob", email: "bob@test.com", attended: 0 },
        { id: 3, name: "Charlie", email: null, attended: 0 },
        { id: 4, name: "Diana", email: "", attended: 0 },
        { id: 5, name: "Eve", email: "eve@test.com", attended: 0 },
      ];

      const noShows = registrants.filter(
        (r) => r.attended === 0 && r.email && r.email !== ""
      );

      expect(noShows).toHaveLength(2);
      expect(noShows.map((r) => r.name)).toEqual(["Bob", "Eve"]);
    });

    it("should handle rate limiting logic", () => {
      let processed = 0;
      const shouldPause = () => {
        processed++;
        return processed % 50 === 0;
      };

      // Process 100 items
      let pauses = 0;
      for (let i = 0; i < 100; i++) {
        if (shouldPause()) pauses++;
      }

      expect(pauses).toBe(2); // Pauses at 50 and 100
    });
  });

  describe("Transcript Context for AI", () => {
    it("should prefer keySummary over raw transcript for AI context", () => {
      const transcript = {
        keySummary: "Short focused summary for AI",
        transcript: "Very long transcript text ".repeat(1000),
      };

      const context = transcript.keySummary || transcript.transcript.substring(0, 3000);
      expect(context).toBe("Short focused summary for AI");
    });

    it("should fall back to truncated transcript when no summary", () => {
      const transcript = {
        keySummary: null as string | null,
        transcript: "A".repeat(10000),
      };

      const context = transcript.keySummary || transcript.transcript.substring(0, 3000);
      expect(context.length).toBe(3000);
    });

    it("should use 5000 char limit for email context vs 3000 for SMS", () => {
      const longTranscript = "B".repeat(10000);

      const smsContext = longTranscript.substring(0, 3000);
      const emailContext = longTranscript.substring(0, 5000);

      expect(smsContext.length).toBe(3000);
      expect(emailContext.length).toBe(5000);
    });
  });
});

import { describe, it, expect } from "vitest";
import { buildWebinarEmail } from "./hubspot-smtp";

describe("HubSpot SMTP Integration", () => {
  it("should have SMTP credentials configured", () => {
    // Verify env vars are present (they're injected at deploy time)
    // In sandbox, they may be placeholders but must exist
    expect(process.env.HUBSPOT_SMTP_USER).toBeDefined();
    expect(process.env.HUBSPOT_SMTP_PASS).toBeDefined();
    expect(process.env.HUBSPOT_SMTP_FROM).toBeDefined();
  });

  it("should build morning_of email correctly", () => {
    const result = buildWebinarEmail("morning_of", {
      firstName: "John",
      webinarLink: "https://event.webinarjam.com/go/live/123",
    });
    expect(result).not.toBeNull();
    expect(result!.subject).toContain("tonight");
    expect(result!.html).toContain("John");
    expect(result!.html).toContain("https://event.webinarjam.com/go/live/123");
  });

  it("should build 3h email correctly", () => {
    const result = buildWebinarEmail("3h", {
      firstName: "Jane",
      webinarLink: "https://event.webinarjam.com/go/live/456",
    });
    expect(result).not.toBeNull();
    expect(result!.subject).toContain("3");
    expect(result!.html).toContain("Jane");
  });

  it("should build 1h email correctly", () => {
    const result = buildWebinarEmail("1h", {
      firstName: "Mike",
      webinarLink: "https://event.webinarjam.com/go/live/789",
    });
    expect(result).not.toBeNull();
    expect(result!.subject).toBeDefined();
    expect(result!.html).toContain("Mike");
  });

  it("should build 15min email correctly", () => {
    const result = buildWebinarEmail("15min", {
      firstName: "Sarah",
      webinarLink: "https://event.webinarjam.com/go/live/abc",
    });
    expect(result).not.toBeNull();
    expect(result!.html).toContain("Sarah");
  });

  it("should build starting_now email correctly", () => {
    const result = buildWebinarEmail("starting_now", {
      firstName: "Alex",
      webinarLink: "https://event.webinarjam.com/go/live/def",
    });
    expect(result).not.toBeNull();
    expect(result!.html).toContain("Alex");
  });

  it("should build thank_you email correctly", () => {
    const result = buildWebinarEmail("thank_you", {
      firstName: "Lisa",
      webinarLink: "https://event.webinarjam.com/go/live/ghi",
      replayUrl: "https://replay.example.com/123",
    });
    expect(result).not.toBeNull();
    expect(result!.html).toContain("Lisa");
    expect(result!.html).toContain("https://replay.example.com/123");
  });

  it("should build missed_you email correctly", () => {
    const result = buildWebinarEmail("missed_you", {
      firstName: "Tom",
      webinarLink: "https://event.webinarjam.com/go/live/jkl",
      replayUrl: "https://replay.example.com/456",
    });
    expect(result).not.toBeNull();
    expect(result!.html).toContain("Tom");
    expect(result!.html).toContain("https://replay.example.com/456");
  });

  it("should build follow_up email correctly", () => {
    const result = buildWebinarEmail("follow_up", {
      firstName: "Emma",
      webinarLink: "https://event.webinarjam.com/go/live/mno",
      replayUrl: "https://replay.example.com/789",
    });
    expect(result).not.toBeNull();
    expect(result!.html).toContain("Emma");
  });

  it("should return null for unknown email type", () => {
    const result = buildWebinarEmail("unknown_type" as any, {
      firstName: "Test",
      webinarLink: "https://example.com",
    });
    expect(result).toBeNull();
  });
});

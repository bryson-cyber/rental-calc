import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Tests for:
 * 1. webinarSms.saveWebinarSelection — now accepts memberId & integrationWebinarId
 * 2. webinarSms.getWebinarCredentials — returns per-webinar saved credentials
 * 3. webinarSms.getSettings — returns credentials from webinarCredentials table
 * 4. webinarSms.composeMessage — AI message composer endpoint
 */

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("webinarSms.saveWebinarSelection", () => {
  it("accepts all 4 credential fields without error", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.webinarSms.saveWebinarSelection({
      webinarId: "test-webinar-123",
      webinarName: "Test Webinar",
      webinarApiKey: "test-api-key-abc",
      webinarHash: "test-hash-xyz",
      webinarMemberId: "member-456",
      webinarIntegrationId: "integration-789",
    });

    expect(result).toEqual({ success: true });
  });

  it("works with only some credential fields", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.webinarSms.saveWebinarSelection({
      webinarId: "test-webinar-456",
      webinarName: "Another Webinar",
      webinarApiKey: "key-only",
    });

    expect(result).toEqual({ success: true });
  });
});

describe("webinarSms.getWebinarCredentials", () => {
  it("returns saved credentials for a webinar that has them", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // First save credentials
    await caller.webinarSms.saveWebinarSelection({
      webinarId: "cred-test-webinar",
      webinarName: "Cred Test",
      webinarApiKey: "my-api-key",
      webinarHash: "my-hash",
      webinarMemberId: "my-member-id",
      webinarIntegrationId: "my-integration-id",
    });

    // Then fetch them
    const creds = await caller.webinarSms.getWebinarCredentials({
      webinarId: "cred-test-webinar",
    });

    expect(creds.found).toBe(true);
    expect(creds.apiKey).toBe("my-api-key");
    expect(creds.webinarHash).toBe("my-hash");
    expect(creds.memberId).toBe("my-member-id");
    expect(creds.integrationWebinarId).toBe("my-integration-id");
  });

  it("returns found=false for a webinar with no saved credentials", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const creds = await caller.webinarSms.getWebinarCredentials({
      webinarId: "nonexistent-webinar-xyz",
    });

    expect(creds.found).toBe(false);
    expect(creds.apiKey).toBeNull();
    expect(creds.webinarHash).toBeNull();
    expect(creds.memberId).toBeNull();
    expect(creds.integrationWebinarId).toBeNull();
  });
});

describe("webinarSms.getSettings", () => {
  it("returns credential fields including memberId and integrationId", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Save a webinar selection with credentials
    await caller.webinarSms.saveWebinarSelection({
      webinarId: "settings-test-webinar",
      webinarName: "Settings Test",
      webinarApiKey: "settings-key",
      webinarHash: "settings-hash",
      webinarMemberId: "settings-member",
      webinarIntegrationId: "settings-integration",
    });

    const settings = await caller.webinarSms.getSettings();

    expect(settings.selectedWebinarId).toBe("settings-test-webinar");
    expect(settings.selectedWebinarName).toBe("Settings Test");
    expect(settings.webinarApiKey).toBe("settings-key");
    expect(settings.webinarHash).toBe("settings-hash");
    expect(settings.webinarMemberId).toBe("settings-member");
    expect(settings.webinarIntegrationId).toBe("settings-integration");
    expect(settings.webinarApiKeyConfigured).toBe(true);
    expect(settings.webinarHashConfigured).toBe(true);
  });
});

describe("webinarSms.composeMessage", () => {
  it("validates that prompt is required", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.webinarSms.composeMessage({
        prompt: "",
        audience: "all",
      })
    ).rejects.toThrow();
  });

  it("validates that prompt max length is enforced", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const longPrompt = "a".repeat(1001);
    await expect(
      caller.webinarSms.composeMessage({
        prompt: longPrompt,
        audience: "all",
      })
    ).rejects.toThrow();
  });

  it("accepts valid input and calls LLM (may fail if LLM unavailable)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // This test verifies the endpoint accepts valid input.
    // It may throw if the LLM service is unavailable, which is acceptable.
    try {
      const result = await caller.webinarSms.composeMessage({
        prompt: "remind them about the replay",
        audience: "not_attended",
        webinarName: "Test Webinar",
      });

      expect(result.success).toBe(true);
      expect(typeof result.message).toBe("string");
      expect(result.message.length).toBeGreaterThan(0);
    } catch (err: any) {
      // LLM service unavailable is acceptable in test environment
      expect(err.message).toContain("AI composition failed");
    }
  });
});

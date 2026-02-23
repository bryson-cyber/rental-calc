import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Tests for the webinar SMS settings endpoints:
 * - getApiStatus
 * - getSettings
 * - saveWebinarSelection
 * - saveCronConfig
 * - triggerManualImport (error path: no webinar selected)
 */

// Mock ENV to control API key status
vi.mock("./_core/env", () => ({
  ENV: {
    webinarjamApiKey: "wj_test_key_1234567890abcdef",
    simpletextingApiKey: "st_test_key_abcdef1234567890",
    zapierWebhookUrl: "",
    databaseUrl: "mysql://test:test@localhost:3306/test",
    cookieSecret: "test-secret",
    appId: "test-app",
    oAuthServerUrl: "https://test.oauth.com",
    ownerOpenId: "test-owner",
    isProduction: false,
    forgeApiUrl: "",
    forgeApiKey: "",
    airdnaApiKey: "",
    anthropicApiKey: "",
    geminiApiKey: "",
    hasdataApiKey: "",
    rentometerApiKey: "",
    golpoApiKey: "",
    devMockApi: false,
    coachinayahEmail: "",
    coachinayahPassword: "",
  },
}));

// Mock getDb to return a fake database
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbValues = vi.fn();
const mockDbOnDuplicateKeyUpdate = vi.fn();

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: () => ({
      from: (table: any) => {
        mockDbFrom(table);
        return {
          where: mockDbWhere.mockReturnValue(Promise.resolve([])),
          then: (resolve: any) => resolve([]),
          [Symbol.iterator]: function* () {},
        };
      },
    }),
    insert: (table: any) => ({
      values: (data: any) => {
        mockDbValues(data);
        return {
          onDuplicateKeyUpdate: mockDbOnDuplicateKeyUpdate.mockReturnValue(Promise.resolve([{ insertId: 1 }])),
        };
      },
    }),
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createNonAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("webinarSms.getApiStatus", () => {
  it("returns configured status for both API keys when they are set", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.webinarSms.getApiStatus();

    expect(result.webinarjam.configured).toBe(true);
    expect(result.webinarjam.keyPreview).toBeTruthy();
    expect(result.webinarjam.keyPreview).toContain("...");

    expect(result.simpletexting.configured).toBe(true);
    expect(result.simpletexting.keyPreview).toBeTruthy();
    expect(result.simpletexting.keyPreview).toContain("...");
  });

  it("rejects non-admin users", async () => {
    const ctx = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.webinarSms.getApiStatus()).rejects.toThrow();
  });
});

describe("webinarSms.getSettings", () => {
  it("returns default settings when no settings are saved", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.webinarSms.getSettings();

    expect(result).toHaveProperty("selectedWebinarId");
    expect(result).toHaveProperty("selectedWebinarName");
    expect(result).toHaveProperty("selectedScheduleId");
    expect(result).toHaveProperty("cronEnabled");
    expect(result).toHaveProperty("cronIntervalMinutes");
    expect(result).toHaveProperty("lastAutoImportAt");
    expect(result).toHaveProperty("lastAutoImportResult");

    // Defaults
    expect(result.selectedWebinarId).toBeNull();
    expect(result.cronEnabled).toBe(false);
    expect(result.cronIntervalMinutes).toBe(30);
  });
});

describe("webinarSms.saveWebinarSelection", () => {
  beforeEach(() => {
    mockDbValues.mockClear();
    mockDbOnDuplicateKeyUpdate.mockClear();
  });

  it("accepts valid webinar selection input", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.webinarSms.saveWebinarSelection({
      webinarId: "12345",
      webinarName: "Test Webinar",
      scheduleId: "67890",
    });

    expect(result).toEqual({ success: true });
  });

  it("rejects empty webinarId", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.webinarSms.saveWebinarSelection({
        webinarId: "",
        webinarName: "Test",
      })
    ).rejects.toThrow();
  });
});

describe("webinarSms.saveCronConfig", () => {
  beforeEach(() => {
    mockDbValues.mockClear();
    mockDbOnDuplicateKeyUpdate.mockClear();
  });

  it("accepts valid cron config", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.webinarSms.saveCronConfig({
      enabled: true,
      intervalMinutes: 60,
    });

    expect(result).toEqual({ success: true });
  });

  it("rejects interval below minimum (5 minutes)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.webinarSms.saveCronConfig({
        enabled: true,
        intervalMinutes: 2,
      })
    ).rejects.toThrow();
  });

  it("rejects interval above maximum (1440 minutes)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.webinarSms.saveCronConfig({
        enabled: true,
        intervalMinutes: 2000,
      })
    ).rejects.toThrow();
  });
});

describe("webinarSms.triggerManualImport", () => {
  it("fails when no webinar is selected", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // The mock DB returns empty settings, so no webinar is selected
    await expect(caller.webinarSms.triggerManualImport()).rejects.toThrow(
      /No webinar selected/
    );
  });
});

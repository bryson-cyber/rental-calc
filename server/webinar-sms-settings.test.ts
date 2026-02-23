import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock env
vi.mock("./_core/env", () => ({
  ENV: {
    webinarjamApiKey: "test-wj-key",
    simpletextingApiKey: "test-st-key",
    zapierWebhookUrl: "",
    coachinayahPassword: "",
  },
}));

// Mock getDb to return a fake database
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbValues = vi.fn();
const mockDbOnDuplicateKeyUpdate = vi.fn();

// Create a chainable result that supports .where().orderBy().limit().offset().groupBy()
function createChainableResult(resolvedValue: any[] = []) {
  const chain: any = {
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    groupBy: vi.fn(),
    then: (resolve: any) => resolve(resolvedValue),
    [Symbol.iterator]: function* () {},
  };
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.offset.mockReturnValue(chain);
  chain.groupBy.mockReturnValue(chain);
  return chain;
}

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: (fields?: any) => ({
      from: (table: any) => {
        mockDbFrom(table);
        return createChainableResult([]);
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
  return {
    user: {
      id: 1,
      openId: "admin-open-id",
      name: "Admin User",
      avatarUrl: null,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AuthenticatedUser,
  };
}

function createNonAdminContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "user-open-id",
      name: "Regular User",
      avatarUrl: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AuthenticatedUser,
  };
}

function createUnauthContext(): TrpcContext {
  return { user: null };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getApiStatus ────────────────────────────────────────────────────────────

describe("webinarSms.getApiStatus", () => {
  it("returns API key status for admin user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarSms.getApiStatus();

    // Check the actual property names from the API
    const keys = Object.keys(result);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    // The API returns webinarjam and simpletexting (lowercase)
    const wjKey = keys.find(k => k.toLowerCase().includes('webinar'))!;
    const stKey = keys.find(k => k.toLowerCase().includes('simple') || k.toLowerCase().includes('texting'))!;
    expect(wjKey).toBeDefined();
    expect(stKey).toBeDefined();
    expect((result as any)[wjKey].configured).toBe(true);
    expect((result as any)[stKey].configured).toBe(true);
  });

  it("rejects non-admin users", async () => {
    const ctx = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.webinarSms.getApiStatus()).rejects.toThrow();
  });

  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.webinarSms.getApiStatus()).rejects.toThrow();
  });
});

// ─── getSettings ─────────────────────────────────────────────────────────────

describe("webinarSms.getSettings", () => {
  it("returns default settings when no rows exist", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarSms.getSettings();

    expect(result).toHaveProperty("selectedWebinarId");
    expect(result).toHaveProperty("cronEnabled");
    expect(result).toHaveProperty("cronIntervalMinutes");
    expect(result.selectedWebinarId).toBeNull();
    expect(result.cronEnabled).toBe(false);
  });
});

// ─── saveWebinarSelection ────────────────────────────────────────────────────

describe("webinarSms.saveWebinarSelection", () => {
  it("saves webinar selection for admin user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarSms.saveWebinarSelection({
      webinarId: "123",
      webinarName: "Test Webinar",
      scheduleId: "456",
    });

    expect(result.success).toBe(true);
    expect(mockDbValues).toHaveBeenCalled();
  });

  it("rejects non-admin users", async () => {
    const ctx = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.webinarSms.saveWebinarSelection({
        webinarId: "123",
        webinarName: "Test Webinar",
      })
    ).rejects.toThrow();
  });
});

// ─── saveCronConfig ──────────────────────────────────────────────────────────

describe("webinarSms.saveCronConfig", () => {
  it("accepts valid cron config", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarSms.saveCronConfig({
      enabled: true,
      intervalMinutes: 60,
    });

    expect(result.success).toBe(true);
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
});

// ─── triggerManualImport ─────────────────────────────────────────────────────

describe("webinarSms.triggerManualImport", () => {
  it("fails when no webinar is selected", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.webinarSms.triggerManualImport()).rejects.toThrow(
      "No webinar selected"
    );
  });
});

// ─── refreshAttendance ───────────────────────────────────────────────────────

describe("webinarSms.refreshAttendance", () => {
  it("rejects non-admin users", async () => {
    const ctx = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.webinarSms.refreshAttendance({ webinarId: "123" })
    ).rejects.toThrow();
  });

  it("requires a webinarId", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      // @ts-expect-error - testing missing required field
      caller.webinarSms.refreshAttendance({})
    ).rejects.toThrow();
  });
});

// ─── getCampaignDeliveries ───────────────────────────────────────────────────

describe("webinarSms.getCampaignDeliveries", () => {
  it("rejects non-admin users", async () => {
    const ctx = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.webinarSms.getCampaignDeliveries({ campaignId: 1 })
    ).rejects.toThrow();
  });

  it("accepts valid input with admin user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarSms.getCampaignDeliveries({
      campaignId: 1,
      page: 1,
      pageSize: 10,
    });

    expect(result).toHaveProperty("deliveries");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page");
    expect(result).toHaveProperty("totalPages");
    expect(result).toHaveProperty("statusSummary");
  });

  it("accepts optional status filter", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarSms.getCampaignDeliveries({
      campaignId: 1,
      status: "sent",
    });

    expect(result).toHaveProperty("deliveries");
    expect(result).toHaveProperty("statusSummary");
  });
});

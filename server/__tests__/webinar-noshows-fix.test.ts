import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

// Mock env
vi.mock("../_core/env", () => ({
  ENV: {
    webinarjamApiKey: "test-wj-key",
    simpletextingApiKey: "test-st-key",
    zapierWebhookUrl: "",
    coachinayahPassword: "",
  },
}));

// Mock getDb
const mockDbFrom = vi.fn();
const mockDbValues = vi.fn();
const mockDbOnDuplicateKeyUpdate = vi.fn();

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

vi.mock("../db", () => ({
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

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getSettings returns selectedScheduleDate ───────────────────────────────

describe("webinarSms.getSettings — schedule date", () => {
  it("returns selectedScheduleDate as null when no setting exists", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarSms.getSettings();

    expect(result).toHaveProperty("selectedScheduleDate");
    expect(result.selectedScheduleDate).toBeNull();
  });
});

// ─── saveWebinarSelection accepts scheduleDate ──────────────────────────────

describe("webinarSms.saveWebinarSelection — schedule date", () => {
  it("accepts scheduleDate parameter and saves it", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarSms.saveWebinarSelection({
      webinarId: "371",
      webinarName: "Webby 2.25.26",
      scheduleId: "654",
      scheduleDate: "February 25, 2026 8:00 PM",
    });

    expect(result.success).toBe(true);
    // Verify that the schedule date was included in the upserts
    const allCalls = mockDbValues.mock.calls;
    const scheduleDateCall = allCalls.find(
      (call: any) => call[0]?.settingKey === "selected_schedule_date"
    );
    expect(scheduleDateCall).toBeDefined();
    expect(scheduleDateCall![0].settingValue).toBe("February 25, 2026 8:00 PM");
  });

  it("works without scheduleDate parameter", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinarSms.saveWebinarSelection({
      webinarId: "371",
      webinarName: "Webby 2.25.26",
    });

    expect(result.success).toBe(true);
    // No scheduleDate call should exist
    const allCalls = mockDbValues.mock.calls;
    const scheduleDateCall = allCalls.find(
      (call: any) => call[0]?.settingKey === "selected_schedule_date"
    );
    expect(scheduleDateCall).toBeUndefined();
  });
});

// ─── Frontend logic: webinarHasEnded calculation ────────────────────────────

describe("webinarHasEnded logic (unit test)", () => {
  function webinarHasEnded(scheduleDate: string | null): boolean {
    if (!scheduleDate) return false;
    try {
      const scheduledTime = new Date(scheduleDate);
      if (isNaN(scheduledTime.getTime())) return false;
      const endTime = new Date(scheduledTime.getTime() + 2 * 60 * 60 * 1000);
      return new Date() > endTime;
    } catch {
      return false;
    }
  }

  it("returns false when scheduleDate is null", () => {
    expect(webinarHasEnded(null)).toBe(false);
  });

  it("returns false when scheduleDate is invalid", () => {
    expect(webinarHasEnded("not-a-date")).toBe(false);
  });

  it("returns false for a future webinar", () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(webinarHasEnded(futureDate)).toBe(false);
  });

  it("returns false for a webinar that just started (within 2h buffer)", () => {
    const justStarted = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
    expect(webinarHasEnded(justStarted)).toBe(false);
  });

  it("returns true for a webinar that ended more than 2 hours ago", () => {
    const pastDate = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(); // 4 hours ago
    expect(webinarHasEnded(pastDate)).toBe(true);
  });

  it("handles WebinarJam date format like 'February 25, 2026 8:00 PM'", () => {
    // A date far in the past
    expect(webinarHasEnded("January 1, 2020 8:00 PM")).toBe(true);
    // A date far in the future
    expect(webinarHasEnded("December 31, 2030 8:00 PM")).toBe(false);
  });
});

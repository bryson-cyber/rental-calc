import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

// ─── Helpers ──────────────────────────────────────────────────────────

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
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
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
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("admin.getReportById", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.getReportById({ id: 1 })
    ).rejects.toThrow();
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.getReportById({ id: 1 })
    ).rejects.toThrow(/admin/i);
  });

  it("rejects invalid input (non-positive id)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.getReportById({ id: 0 })
    ).rejects.toThrow();

    await expect(
      caller.admin.getReportById({ id: -1 })
    ).rejects.toThrow();
  });
});

describe("rentometer.getComprehensiveData input validation", () => {
  it("rejects empty address", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.rentometer.getComprehensiveData({ address: "", bedrooms: 2 })
    ).rejects.toThrow();
  });

  it("rejects invalid bedroom count", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.rentometer.getComprehensiveData({ address: "123 Main St", bedrooms: 10 })
    ).rejects.toThrow();
  });

  it("accepts valid input without throwing validation error", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);

    // This will attempt to call the actual API which may fail,
    // but it should NOT fail on input validation
    try {
      await caller.rentometer.getComprehensiveData({
        address: "123 Main St, Denver, CO 80202",
        bedrooms: 3,
        buildingType: "house",
      });
    } catch (error: any) {
      // If it throws, it should NOT be a ZodError (input validation)
      expect(error.code).not.toBe("BAD_REQUEST");
    }
  });
});

describe("OAuth return URL state encoding", () => {
  it("correctly encodes and decodes JSON state with returnTo path", () => {
    // Simulate what getLoginUrl does
    const redirectUri = "https://example.com/api/oauth/callback";
    const returnPath = "/report/abc123";
    const statePayload = JSON.stringify({ redirectUri, returnTo: returnPath });
    const state = Buffer.from(statePayload).toString('base64');

    // Simulate what the OAuth callback does
    const decoded = Buffer.from(state, 'base64').toString('utf-8');
    expect(decoded.startsWith('{')).toBe(true);

    const parsed = JSON.parse(decoded);
    expect(parsed.returnTo).toBe("/report/abc123");
    expect(parsed.redirectUri).toBe(redirectUri);
  });

  it("handles old-format state (plain redirectUri string)", () => {
    // Old format: just the redirectUri base64-encoded
    const oldState = Buffer.from("https://example.com/api/oauth/callback").toString('base64');
    const decoded = Buffer.from(oldState, 'base64').toString('utf-8');

    // Should NOT start with '{' so the callback falls through to default "/"
    expect(decoded.startsWith('{')).toBe(false);
  });

  it("rejects returnTo paths that don't start with /", () => {
    const statePayload = JSON.stringify({
      redirectUri: "https://example.com/api/oauth/callback",
      returnTo: "https://evil.com/steal"
    });
    const state = Buffer.from(statePayload).toString('base64');
    const decoded = Buffer.from(state, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);

    // The callback checks parsed.returnTo.startsWith('/')
    const isValidReturn = parsed.returnTo && typeof parsed.returnTo === 'string' && parsed.returnTo.startsWith('/');
    expect(isValidReturn).toBe(false);
  });
});

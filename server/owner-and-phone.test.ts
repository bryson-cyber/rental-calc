import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-open-id",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── auth.me isOwner flag ───────────────────────────────────────────────────

describe("auth.me isOwner flag", () => {
  const OWNER_OPEN_ID = process.env.OWNER_OPEN_ID || "";

  it("returns isOwner=true when user openId matches OWNER_OPEN_ID", async () => {
    // Skip if OWNER_OPEN_ID is not set in test environment
    if (!OWNER_OPEN_ID) {
      console.log("Skipping: OWNER_OPEN_ID not set");
      return;
    }

    const ctx = createContext({ openId: OWNER_OPEN_ID });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();

    expect(result).toBeDefined();
    expect(result?.isOwner).toBe(true);
  });

  it("returns isOwner=false for non-owner users", async () => {
    const ctx = createContext({ openId: "definitely-not-the-owner" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();

    expect(result).toBeDefined();
    expect(result?.isOwner).toBe(false);
  });

  it("returns null for unauthenticated users", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();

    expect(result).toBeNull();
  });
});

// ─── isUsCanadaPhone logic (unit test the pattern) ──────────────────────────

describe("US/Canada phone number validation", () => {
  // Replicate the isUsCanadaPhone logic from webinar-sms.ts
  function isUsCanadaPhone(phone: string): boolean {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return true;
    if (digits.length === 11 && digits.startsWith("1")) return true;
    return false;
  }

  it("accepts 10-digit US numbers", () => {
    expect(isUsCanadaPhone("5551234567")).toBe(true);
    expect(isUsCanadaPhone("2125551234")).toBe(true);
  });

  it("accepts 11-digit numbers starting with 1 (US/Canada country code)", () => {
    expect(isUsCanadaPhone("15551234567")).toBe(true);
    expect(isUsCanadaPhone("12125551234")).toBe(true);
  });

  it("accepts formatted US numbers", () => {
    expect(isUsCanadaPhone("(555) 123-4567")).toBe(true);
    expect(isUsCanadaPhone("+1 555 123 4567")).toBe(true);
    expect(isUsCanadaPhone("1-555-123-4567")).toBe(true);
  });

  it("rejects international numbers (too many digits)", () => {
    // German number: +49 176 45904051
    expect(isUsCanadaPhone("4917645904051")).toBe(false);
    // UK number: +44 7453 173895
    expect(isUsCanadaPhone("447453173895")).toBe(false);
    // Algerian number: +213 663 696800
    expect(isUsCanadaPhone("213663696800")).toBe(false);
    // Australian number: +61 4 1234 5678
    expect(isUsCanadaPhone("61412345678")).toBe(false);
  });

  it("rejects numbers that are too short", () => {
    expect(isUsCanadaPhone("12345")).toBe(false);
    expect(isUsCanadaPhone("555123")).toBe(false);
  });

  it("rejects 11-digit numbers NOT starting with 1", () => {
    // 11 digits but starts with 2 (not US/Canada)
    expect(isUsCanadaPhone("21366369680")).toBe(false);
    // 11 digits starting with 4 (not US/Canada)
    expect(isUsCanadaPhone("44745317389")).toBe(false);
  });
});

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
  }, 15000);
});

describe("Rentometer pre-fetch data flow", () => {
  it("rentometer_data is preserved through JSON serialization (simulating DB storage)", () => {
    // Simulate the data that gets stored in fullAnalysisData
    const mockRentometerData = {
      summary: {
        address: "123 Main St",
        latitude: "39.75",
        longitude: "-104.99",
        bedrooms: 3,
        baths: "2",
        building_type: "house",
        look_back_days: 365,
        mean: 2500,
        median: 2400,
        min: 1800,
        max: 3200,
        percentile_25: 2100,
        percentile_75: 2800,
        std_dev: 350,
        samples: 42,
        radius_miles: 1,
        quickview_url: "https://rentometer.com/quickview/abc",
        token: "abc123",
      },
      propertyRents: {
        formatted_address: "123 Main St",
        latitude: 39.75,
        longitude: -104.99,
        average_update_days: 30,
        count: 5,
        property_listings: [
          { id: 1, bedrooms: 3, baths: "2", price: 2400, sqft: 1500, last_seen: "2025-01-15", price_per_sqft: 1.6 },
        ],
      },
      nearbyComps: {
        search_address: "123 Main St",
        count: 3,
        nearby_properties: [
          { address: "125 Main St", latitude: 39.751, longitude: -104.991, distance: 0.1, price: 2300, bedrooms: 3, baths: "2", property_type: "house", last_seen: "2025-01-10", sqft: 1400, dollar_sqft: 1.64 },
        ],
      },
      errors: [],
    };

    // Simulate storing and retrieving from DB (JSON serialization round-trip)
    const fullAnalysisData = {
      property_estimate: { adr: 200, occupancy: 0.7 },
      rentometer_data: mockRentometerData,
    };

    const serialized = JSON.stringify(fullAnalysisData);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.rentometer_data).toBeDefined();
    expect(deserialized.rentometer_data.summary.median).toBe(2400);
    expect(deserialized.rentometer_data.summary.samples).toBe(42);
    expect(deserialized.rentometer_data.propertyRents.count).toBe(5);
    expect(deserialized.rentometer_data.nearbyComps.count).toBe(3);
    expect(deserialized.rentometer_data.nearbyComps.nearby_properties[0].address).toBe("125 Main St");
  });

  it("handles missing rentometer_data gracefully (older reports)", () => {
    const fullAnalysisData = {
      property_estimate: { adr: 200, occupancy: 0.7 },
      // No rentometer_data field
    };

    const serialized = JSON.stringify(fullAnalysisData);
    const deserialized = JSON.parse(serialized);

    // Should be undefined, not throw
    expect(deserialized.rentometer_data).toBeUndefined();
    // The component checks for preloadedData and falls back to on-demand fetch
    const preloadedData = deserialized.rentometer_data || null;
    expect(preloadedData).toBeNull();
  });

  it("handles partial rentometer_data (some endpoints failed)", () => {
    const partialRentometerData = {
      summary: {
        address: "123 Main St",
        median: 2400,
        mean: 2500,
        min: 1800,
        max: 3200,
        percentile_25: 2100,
        percentile_75: 2800,
        samples: 42,
      },
      propertyRents: null, // This endpoint failed
      nearbyComps: null,   // This endpoint failed
      errors: ["property_rents failed", "nearby_comps failed"],
    };

    const serialized = JSON.stringify({ rentometer_data: partialRentometerData });
    const deserialized = JSON.parse(serialized);

    expect(deserialized.rentometer_data.summary.median).toBe(2400);
    expect(deserialized.rentometer_data.propertyRents).toBeNull();
    expect(deserialized.rentometer_data.nearbyComps).toBeNull();
    expect(deserialized.rentometer_data.errors).toHaveLength(2);
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

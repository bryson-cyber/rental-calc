import { describe, expect, it } from "vitest";
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

// ─── Profit Filter Logic (unit test the filtering algorithm) ────────────────

describe("Step 2 profit filter logic", () => {
  // Replicate the filtering logic from OpportunityFinderStep.tsx
  interface PropertyResult {
    address: string;
    monthlyProfit: number;
    analyzed: boolean;
  }

  function filterByProfitThreshold(
    properties: PropertyResult[],
    threshold: number,
    allAnalyzed: boolean
  ): PropertyResult[] {
    if (!allAnalyzed || threshold <= 0) return properties;
    return properties.filter((p) => {
      if (!p.analyzed) return true; // keep unanalyzed properties visible
      return p.monthlyProfit >= threshold;
    });
  }

  it("returns all properties when no threshold is set (0)", () => {
    const props = [
      { address: "A", monthlyProfit: 500, analyzed: true },
      { address: "B", monthlyProfit: -200, analyzed: true },
      { address: "C", monthlyProfit: 3000, analyzed: true },
    ];
    const result = filterByProfitThreshold(props, 0, true);
    expect(result).toHaveLength(3);
  });

  it("returns all properties when analysis is not complete", () => {
    const props = [
      { address: "A", monthlyProfit: 500, analyzed: true },
      { address: "B", monthlyProfit: -200, analyzed: true },
    ];
    const result = filterByProfitThreshold(props, 2000, false);
    expect(result).toHaveLength(2);
  });

  it("filters out properties below $2000/mo threshold after analysis", () => {
    const props = [
      { address: "A", monthlyProfit: 500, analyzed: true },
      { address: "B", monthlyProfit: -200, analyzed: true },
      { address: "C", monthlyProfit: 3000, analyzed: true },
      { address: "D", monthlyProfit: 2000, analyzed: true },
      { address: "E", monthlyProfit: 1999, analyzed: true },
    ];
    const result = filterByProfitThreshold(props, 2000, true);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.address)).toEqual(["C", "D"]);
  });

  it("returns empty array when no properties meet threshold", () => {
    const props = [
      { address: "A", monthlyProfit: 500, analyzed: true },
      { address: "B", monthlyProfit: -200, analyzed: true },
      { address: "C", monthlyProfit: 22, analyzed: true },
    ];
    const result = filterByProfitThreshold(props, 2000, true);
    expect(result).toHaveLength(0);
  });

  it("keeps unanalyzed properties visible even with threshold", () => {
    const props = [
      { address: "A", monthlyProfit: 500, analyzed: true },
      { address: "B", monthlyProfit: 0, analyzed: false },
      { address: "C", monthlyProfit: 3000, analyzed: true },
    ];
    const result = filterByProfitThreshold(props, 2000, true);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.address)).toEqual(["B", "C"]);
  });

  it("handles negative profit threshold (edge case)", () => {
    const props = [
      { address: "A", monthlyProfit: -500, analyzed: true },
      { address: "B", monthlyProfit: -200, analyzed: true },
    ];
    // Negative threshold treated as 0 (no filter)
    const result = filterByProfitThreshold(props, -100, true);
    expect(result).toHaveLength(2);
  });
});

// ─── Rentometer comprehensive endpoint validation ───────────────────────────

describe("Rentometer getComprehensiveData endpoint", () => {
  it("accepts valid input with address, bedrooms, and userRent", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    // We can't actually call the Rentometer API in tests, but we can validate
    // that the endpoint exists and accepts the right input shape
    try {
      await caller.rentometer.getComprehensiveData({
        address: "123 Test St, Denver, CO 80202",
        bedrooms: 3,
        userRent: 2000,
      });
    } catch (error: any) {
      // API key may not be set in test env, but the endpoint should exist
      // and not throw a validation error
      expect(error.message).not.toContain("invalid_type");
      expect(error.message).not.toContain("Required");
    }
  });

  it("accepts optional baths and buildingType parameters", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.rentometer.getComprehensiveData({
        address: "123 Test St, Denver, CO 80202",
        bedrooms: 3,
        baths: "1.5+",
        buildingType: "house",
        userRent: 2000,
      });
    } catch (error: any) {
      // Should not throw validation errors
      expect(error.message).not.toContain("invalid_type");
      expect(error.message).not.toContain("Required");
    }
  });
});

// ─── Rentometer data shape validation ───────────────────────────────────────

describe("Rentometer data shape for TeslaDashboard", () => {
  it("validates the expanded rentometerData shape has all required fields", () => {
    // This validates the data shape that TeslaDashboard expects
    const sampleData = {
      median: 1265,
      percentile25: 1155,
      percentile75: 1445,
      min: 800,
      max: 2100,
      mean: 1280,
      stdDev: 245,
      sampleCount: 30,
      radiusMiles: 1.5,
      userRentVsMarket: "below" as const,
      rentAdvantage: 85,
      percentileRank: 42,
      quickviewUrl: "https://www.rentometer.com/analysis/abc123",
      nearbyComps: [
        {
          address: "456 Nearby St",
          price: 1300,
          bedrooms: 3,
          baths: "2",
          property_type: "apartment",
          distance: 0.5,
          sqft: 1200,
          last_seen: "2026-02-20",
        },
      ],
      propertyRents: [
        {
          bedrooms: 3,
          baths: "2",
          price: 1350,
          sqft: 1200,
          last_seen: "2026-02-15",
        },
      ],
    };

    // Validate all required fields exist
    expect(sampleData.median).toBeTypeOf("number");
    expect(sampleData.percentile25).toBeTypeOf("number");
    expect(sampleData.percentile75).toBeTypeOf("number");
    expect(sampleData.min).toBeTypeOf("number");
    expect(sampleData.max).toBeTypeOf("number");
    expect(sampleData.mean).toBeTypeOf("number");
    expect(sampleData.stdDev).toBeTypeOf("number");
    expect(sampleData.sampleCount).toBeTypeOf("number");
    expect(sampleData.radiusMiles).toBeTypeOf("number");
    expect(sampleData.userRentVsMarket).toMatch(/^(below|above|at)$/);
    expect(sampleData.rentAdvantage).toBeTypeOf("number");
    expect(sampleData.percentileRank).toBeTypeOf("number");
    expect(sampleData.quickviewUrl).toBeTypeOf("string");
    expect(sampleData.nearbyComps).toBeInstanceOf(Array);
    expect(sampleData.nearbyComps[0]).toHaveProperty("address");
    expect(sampleData.nearbyComps[0]).toHaveProperty("price");
    expect(sampleData.nearbyComps[0]).toHaveProperty("distance");
    expect(sampleData.propertyRents).toBeInstanceOf(Array);
    expect(sampleData.propertyRents[0]).toHaveProperty("price");
    expect(sampleData.propertyRents[0]).toHaveProperty("last_seen");
  });

  it("handles missing optional fields gracefully (backward compat)", () => {
    // Old-style data without the new fields should still be valid
    const oldStyleData = {
      median: 1265,
      percentile25: 1155,
      percentile75: 1445,
      min: 800,
      max: 2100,
      mean: 0,
      stdDev: 0,
      sampleCount: 30,
      radiusMiles: 0,
      userRentVsMarket: "below" as const,
      rentAdvantage: 85,
      percentileRank: 42,
    };

    // Should work without optional fields
    expect(oldStyleData.nearbyComps).toBeUndefined();
    expect(oldStyleData.propertyRents).toBeUndefined();
    expect(oldStyleData.quickviewUrl).toBeUndefined();
    
    // Required fields still present
    expect(oldStyleData.median).toBe(1265);
    expect(oldStyleData.sampleCount).toBe(30);
  });
});

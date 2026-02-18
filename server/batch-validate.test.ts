import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock usage limits to bypass DB checks
vi.mock('./usage-limits', () => ({
  canPerformAnalysis: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
  canPerformMarketResearch: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
  recordAnalysisUsage: vi.fn().mockResolvedValue(undefined),
  recordMarketResearchUsage: vi.fn().mockResolvedValue(undefined),
  recordApiCallsUsage: vi.fn().mockResolvedValue(undefined),
  getUsageStatus: vi.fn().mockResolvedValue({ propertyAnalyses: { used: 0, limit: 5, remaining: 5 }, marketResearches: { used: 0, limit: 3, remaining: 3 }, apiCalls: { used: 0, limit: 50, remaining: 50 }, isAdmin: false, canAnalyze: true, canResearchMarket: true }),
  isUserAdmin: vi.fn().mockResolvedValue(false),
}));

// Mock the rate limiter to bypass DB checks and use our mock fetch directly
vi.mock('./airdna-rate-limiter', async (importOriginal) => {
  return {
    rateLimitedAirDNARequest: async (endpoint: string, method: string, body: any, options?: any) => {
      // Use globalThis.fetch which is mocked in tests
      const response = await globalThis.fetch(`https://api.airdna.co/api/enterprise/v2${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        throw new Error(`AirDNA API error (${response.status})`);
      }
      return response.json();
    },
    AirDNARateLimitError: class AirDNARateLimitError extends Error {
      isRateLimit = true;
      type: string;
      currentCount: number;
      limit: number;
      constructor(type: string, currentCount: number, limit: number) {
        super(`Rate limit: ${type}`);
        this.type = type;
        this.currentCount = currentCount;
        this.limit = limit;
      }
    },
    AIRDNA_API_BASE: 'https://api.airdna.co/api/enterprise/v2',
    DAILY_HARD_LIMIT: 600,
    PER_MINUTE_LIMIT: 15,
    getRateLimiterStats: () => ({ callsInLastMinute: 0, perMinuteLimit: 15, dailyHardLimit: 600, dailyWarnThreshold: 500, dailyLimitNotified: false }),
  };
});

// Mock fetch globally so AirDNA API calls return predictable data
const mockFetch = vi.fn();

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// Helper to create a mock AirDNA response
function mockAirDNAResponse(revenue: number, occupancy: number, adr: number) {
  return {
    ok: true,
    json: async () => ({
      status: { type: "success" },
      payload: {
        stats: {
          future: {
            summary: {
              revenue,
              occupancy, // decimal format (e.g., 0.65)
              adr,
            },
          },
        },
      },
    }),
  };
}

describe("opportunityFinder.batchValidateProperties", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    caller = appRouter.createCaller(createPublicContext());
    // Replace global fetch with our mock
    globalThis.fetch = mockFetch as any;
    mockFetch.mockReset();
    // Default: return a successful AirDNA response
    mockFetch.mockResolvedValue(mockAirDNAResponse(48000, 0.65, 200));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("validates the input schema requires at least 1 property", async () => {
    await expect(
      caller.opportunityFinder.batchValidateProperties({
        properties: [],
      })
    ).rejects.toThrow();
  });

  it("validates the input schema rejects more than 50 properties", async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => ({
      id: `prop-${i}`,
      address: `${i} Main St`,
      rent: 1500,
      bedrooms: 2,
      bathrooms: 1,
    }));

    await expect(
      caller.opportunityFinder.batchValidateProperties({
        properties: tooMany,
      })
    ).rejects.toThrow();
  });

  it("validates required fields in property input", async () => {
    await expect(
      caller.opportunityFinder.batchValidateProperties({
        properties: [
          {
            id: "test-1",
            address: "", // empty address should fail
            rent: 1500,
            bedrooms: 2,
            bathrooms: 1,
          },
        ],
      })
    ).rejects.toThrow();
  });

  it("accepts valid input with minimum required fields", async () => {
    const result = await caller.opportunityFinder.batchValidateProperties({
      properties: [
        {
          id: "test-1",
          address: "123 Main St",
          rent: 1500,
          bedrooms: 2,
          bathrooms: 1,
        },
      ],
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.totalAnalyzed).toBe(1);
    expect(typeof result.successCount).toBe("number");
    expect(typeof result.failedCount).toBe("number");
    expect(typeof result.elapsedSeconds).toBe("number");
    expect(Array.isArray(result.results)).toBe(true);
    expect(Array.isArray(result.topDeals)).toBe(true);
  });

  it("accepts valid input with all optional fields", async () => {
    const result = await caller.opportunityFinder.batchValidateProperties({
      properties: [
        {
          id: "test-2",
          address: "456 Oak Ave",
          rent: 2000,
          bedrooms: 3,
          bathrooms: 2,
          zillowUrl: "https://zillow.com/test",
          image: "https://example.com/photo.jpg",
          city: "Atlanta",
          state: "GA",
          zipCode: "30301",
        },
      ],
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.totalAnalyzed).toBe(1);
  });

  it("handles multiple properties in a batch", async () => {
    const properties = Array.from({ length: 5 }, (_, i) => ({
      id: `prop-${i}`,
      address: `${100 + i} Test St`,
      rent: 1500 + i * 200,
      bedrooms: 2,
      bathrooms: 1,
      city: "Denver",
      state: "CO",
    }));

    const result = await caller.opportunityFinder.batchValidateProperties({
      properties,
    });

    expect(result.success).toBe(true);
    expect(result.totalAnalyzed).toBe(5);
    expect(result.results).toHaveLength(5);
    // successCount + failedCount should equal total
    expect(result.successCount + result.failedCount).toBe(5);
    // All should succeed with our mock
    expect(result.successCount).toBe(5);
    // fetch should have been called at least 5 times (rentalizer estimate per property + possible comp-median calls)
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it("returns results sorted by monthly profit descending", async () => {
    // All get same revenue=48000, but different rents produce different profits
    const properties = [
      { id: "expensive", address: "100 Expensive St", rent: 4000, bedrooms: 3, bathrooms: 2 },
      { id: "cheap", address: "200 Cheap St", rent: 1000, bedrooms: 2, bathrooms: 1 },
      { id: "mid", address: "300 Mid St", rent: 2500, bedrooms: 2, bathrooms: 1 },
    ];

    const result = await caller.opportunityFinder.batchValidateProperties({
      properties,
    });

    // Successful results should be sorted by profit (cheap rent = highest profit)
    const successfulResults = result.results.filter((r) => r.success && r.projection);
    expect(successfulResults.length).toBeGreaterThan(1);
    for (let i = 0; i < successfulResults.length - 1; i++) {
      expect(successfulResults[i].projection!.monthlyProfit).toBeGreaterThanOrEqual(
        successfulResults[i + 1].projection!.monthlyProfit
      );
    }
  });

  it("calculates profit correctly for a successful analysis", async () => {
    // Mock returns revenue=48000, occupancy=0.65 (65%)
    // Monthly revenue = 48000/12 = 4000
    // Operating costs = 4000 * 0.20 = 800 (20% of monthly revenue)
    // Monthly profit = 4000 - 1500 - 800 = 1700
    const result = await caller.opportunityFinder.batchValidateProperties({
      properties: [
        {
          id: "calc-test",
          address: "789 Calc St",
          rent: 1500,
          bedrooms: 2,
          bathrooms: 1,
        },
      ],
    });

    const successResult = result.results.find((r) => r.success && r.projection);
    expect(successResult).toBeDefined();
    expect(successResult!.projection!.annualRevenue).toBe(48000);
    expect(successResult!.projection!.monthlyRevenue).toBe(4000);
    expect(successResult!.projection!.operatingCosts).toBe(800);
    expect(successResult!.projection!.monthlyProfit).toBe(1700);
    expect(successResult!.projection!.annualProfit).toBe(20400);
    // Occupancy is returned as 0.65 * 100 = 65
    expect(successResult!.projection!.occupancy).toBe(65);
    expect(successResult!.projection!.adr).toBe(200);
  });

  it("returns topDeals only for properties that meet the threshold", async () => {
    // Good deal: rent=1500, profit=4000-1500-800=1700 > 500, occupancy=65 > 50 → isGoodDeal=true
    // Bad deal: rent=3800, profit=4000-3800-800=-600 → isGoodDeal=false
    const properties = [
      { id: "good-deal", address: "100 Profit St", rent: 1500, bedrooms: 2, bathrooms: 1 },
      { id: "bad-deal", address: "200 Loss St", rent: 3800, bedrooms: 2, bathrooms: 1 },
    ];

    const result = await caller.opportunityFinder.batchValidateProperties({
      properties,
    });

    // Only the good deal should appear in topDeals
    const goodDealInTop = result.topDeals.find((d) => d.id === "good-deal");
    const badDealInTop = result.topDeals.find((d) => d.id === "bad-deal");

    expect(goodDealInTop).toBeDefined();
    expect(goodDealInTop!.monthlyProfit).toBe(1700);
    expect(badDealInTop).toBeUndefined();
  });

  it("assigns correct verdict labels based on profit", async () => {
    // rent=1000, profit=4000-1000-800=2200 → Excellent Opportunity (> 1000)
    const result = await caller.opportunityFinder.batchValidateProperties({
      properties: [
        { id: "excellent", address: "100 Excellent St", rent: 1000, bedrooms: 2, bathrooms: 1 },
      ],
    });

    const excellentResult = result.results.find((r) => r.id === "excellent");
    expect(excellentResult).toBeDefined();
    expect(excellentResult!.verdict).toBe("Excellent Opportunity");
  });

  it("handles API failures gracefully", async () => {
    // Make fetch return a failure
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await caller.opportunityFinder.batchValidateProperties({
      properties: [
        { id: "fail-test", address: "999 Fail St", rent: 1500, bedrooms: 2, bathrooms: 1 },
      ],
    });

    expect(result.success).toBe(true); // The batch itself succeeds
    expect(result.failedCount).toBe(1);
    expect(result.successCount).toBe(0);
    expect(result.topDeals).toHaveLength(0);
  });

  it("handles mixed success and failure results", async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (callCount % 2 === 0) {
        // Every other call fails
        return { ok: false, status: 500 };
      }
      return mockAirDNAResponse(48000, 0.65, 200);
    });

    const properties = Array.from({ length: 4 }, (_, i) => ({
      id: `mixed-${i}`,
      address: `${i} Mixed St`,
      rent: 1500,
      bedrooms: 2,
      bathrooms: 1,
    }));

    const result = await caller.opportunityFinder.batchValidateProperties({
      properties,
    });

    expect(result.success).toBe(true);
    expect(result.totalAnalyzed).toBe(4);
    // Some succeed, some fail
    expect(result.successCount).toBeGreaterThan(0);
    expect(result.failedCount).toBeGreaterThan(0);
    expect(result.successCount + result.failedCount).toBe(4);
  });
});

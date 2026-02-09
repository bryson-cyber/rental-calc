import { describe, expect, it, vi } from "vitest";
import { MOCK_DENVER_ESTIMATE } from "./__tests__/fixtures/mock-rentalizer-data";

/**
 * AirDNA API Integration Tests
 * Uses mocked cached data to avoid burning API calls during testing.
 * The app runs on the live AirDNA API in production.
 */

// Mock the getRentalizerEstimate function to return cached data
vi.mock("./airdna", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./airdna")>();
  return {
    ...actual,
    getRentalizerEstimate: vi.fn().mockResolvedValue(MOCK_DENVER_ESTIMATE),
  };
});

import { getRentalizerEstimate } from "./airdna";

describe("AirDNA API Integration (Mocked)", () => {
  it("should have AIRDNA_API_KEY environment variable set", () => {
    const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
    expect(AIRDNA_API_KEY).toBeDefined();
    expect(AIRDNA_API_KEY).not.toBe("");
    expect(typeof AIRDNA_API_KEY).toBe("string");
  });

  it("should return valid rental estimate data structure", async () => {
    const result = await getRentalizerEstimate({
      address: "1321 15th St, Denver, CO 80202",
      bedrooms: 3,
      bathrooms: 2,
      accommodates: 6,
      currency: "usd",
    });

    // Verify the response structure
    expect(result).toBeDefined();
    expect(result!.property).toBeDefined();
    expect(result!.estimates).toBeDefined();
    expect(result!.monthly_forecast).toBeDefined();
    expect(result!.comps).toBeDefined();

    // Verify property details
    expect(result!.property.address).toBeDefined();
    expect(typeof result!.property.bedrooms).toBe("number");
    expect(typeof result!.property.bathrooms).toBe("number");

    // Verify estimates have reasonable values
    expect(result!.estimates.annual_revenue).toBeGreaterThan(0);
    expect(result!.estimates.average_daily_rate).toBeGreaterThan(0);
    expect(result!.estimates.occupancy_rate).toBeGreaterThan(0);
    expect(result!.estimates.occupancy_rate).toBeLessThanOrEqual(1);

    // Verify revenue range is logical
    expect(result!.estimates.annual_revenue_low).toBeLessThanOrEqual(result!.estimates.annual_revenue);
    expect(result!.estimates.annual_revenue_high).toBeGreaterThanOrEqual(result!.estimates.annual_revenue);

    // Verify monthly forecast
    expect(result!.monthly_forecast.length).toBeGreaterThan(0);
    result!.monthly_forecast.forEach((month) => {
      expect(month.month).toBeDefined();
      expect(typeof month.revenue).toBe("number");
      expect(typeof month.adr).toBe("number");
      expect(typeof month.occupancy).toBe("number");
    });

    // Verify comps
    expect(result!.comps.length).toBeGreaterThan(0);
    result!.comps.forEach((comp) => {
      expect(comp.title).toBeDefined();
      expect(typeof comp.bedrooms).toBe("number");
      expect(typeof comp.bathrooms).toBe("number");
      expect(typeof comp.annual_revenue).toBe("number");
      expect(typeof comp.adr).toBe("number");
      expect(typeof comp.occupancy).toBe("number");
    });

    console.log("Mocked API Response validated successfully:");
    console.log(`- Annual Revenue: $${result!.estimates.annual_revenue}`);
    console.log(`- ADR: $${result!.estimates.average_daily_rate}`);
    console.log(`- Occupancy: ${(result!.estimates.occupancy_rate * 100).toFixed(0)}%`);
    console.log(`- Monthly forecast months: ${result!.monthly_forecast.length}`);
    console.log(`- Comparable properties: ${result!.comps.length}`);
  }, 10000);
});

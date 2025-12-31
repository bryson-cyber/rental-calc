import { describe, expect, it } from "vitest";
import { getRentalizerEstimate } from "./airdna";

/**
 * Test to validate the AirDNA API key and integration
 */
describe("AirDNA API Integration", () => {
  const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;

  it("should have AIRDNA_API_KEY environment variable set", () => {
    expect(AIRDNA_API_KEY).toBeDefined();
    expect(AIRDNA_API_KEY).not.toBe("");
    expect(typeof AIRDNA_API_KEY).toBe("string");
  });

  it("should successfully authenticate with AirDNA API", async () => {
    if (!AIRDNA_API_KEY) {
      throw new Error("AIRDNA_API_KEY is not set");
    }

    // Use market search as a lightweight validation endpoint
    const response = await fetch(
      "https://api.airdna.co/api/enterprise/v2/market/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRDNA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          search_term: "Denver",
          pagination: {
            page_size: 1,
            offset: 0,
          },
        }),
      }
    );

    // Check that we get a successful response (not 401 Unauthorized)
    expect(response.status).not.toBe(401);
    
    // If we get 200, the API key is valid
    if (response.status === 200) {
      const data = await response.json();
      expect(data.status?.type).toBe("success");
    } else {
      // 403 means the key is valid but doesn't have access to this endpoint
      expect([200, 403]).toContain(response.status);
    }
  });

  it("should fetch rental estimate data from AirDNA Rentalizer API", async () => {
    if (!AIRDNA_API_KEY) {
      throw new Error("AIRDNA_API_KEY is not set");
    }

    const result = await getRentalizerEstimate({
      address: "1321 15th St, Denver, CO 80202",
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4,
      currency: "usd",
    });

    // Verify the response structure
    expect(result).toBeDefined();
    expect(result.property).toBeDefined();
    expect(result.estimates).toBeDefined();
    expect(result.monthly_forecast).toBeDefined();
    expect(result.comps).toBeDefined();

    // Verify property details
    expect(result.property.address).toBeDefined();
    expect(typeof result.property.bedrooms).toBe("number");
    expect(typeof result.property.bathrooms).toBe("number");

    // Verify estimates have reasonable values
    expect(result.estimates.annual_revenue).toBeGreaterThan(0);
    expect(result.estimates.average_daily_rate).toBeGreaterThan(0);
    expect(result.estimates.occupancy_rate).toBeGreaterThan(0);
    expect(result.estimates.occupancy_rate).toBeLessThanOrEqual(1);

    // Verify revenue range is logical
    expect(result.estimates.annual_revenue_low).toBeLessThanOrEqual(result.estimates.annual_revenue);
    expect(result.estimates.annual_revenue_high).toBeGreaterThanOrEqual(result.estimates.annual_revenue);

    // Verify monthly forecast
    expect(result.monthly_forecast.length).toBeGreaterThan(0);
    result.monthly_forecast.forEach((month) => {
      expect(month.month).toBeDefined();
      expect(typeof month.revenue).toBe("number");
      expect(typeof month.adr).toBe("number");
      expect(typeof month.occupancy).toBe("number");
    });

    // Verify comps
    expect(result.comps.length).toBeGreaterThan(0);
    result.comps.forEach((comp) => {
      expect(comp.title).toBeDefined();
      expect(typeof comp.bedrooms).toBe("number");
      expect(typeof comp.bathrooms).toBe("number");
      expect(typeof comp.annual_revenue).toBe("number");
      expect(typeof comp.adr).toBe("number");
      expect(typeof comp.occupancy).toBe("number");
    });

    console.log("API Response validated successfully:");
    console.log(`- Annual Revenue: $${result.estimates.annual_revenue}`);
    console.log(`- ADR: $${result.estimates.average_daily_rate}`);
    console.log(`- Occupancy: ${(result.estimates.occupancy_rate * 100).toFixed(0)}%`);
    console.log(`- Monthly forecast months: ${result.monthly_forecast.length}`);
    console.log(`- Comparable properties: ${result.comps.length}`);
  }, 30000); // 30 second timeout for API call
});

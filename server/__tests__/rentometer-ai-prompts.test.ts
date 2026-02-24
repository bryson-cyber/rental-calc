import { describe, expect, it } from "vitest";

/**
 * Tests for Rentometer data integration into AI advisor prompts.
 * These tests verify that the data structures and prompt building logic
 * correctly handle Rentometer data for property advisor and full report summary.
 */

// ─── Mock Data ───────────────────────────────────────────────────────

const mockRentometerData = {
  summary: {
    address: "1321 15th St, Denver, CO 80202",
    latitude: "39.7508",
    longitude: "-104.9966",
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
    formatted_address: "1321 15th St, Denver, CO 80202",
    latitude: 39.7508,
    longitude: -104.9966,
    average_update_days: 30,
    count: 5,
    property_listings: [
      { id: 1, bedrooms: 3, baths: "2", price: 2400, sqft: 1500, last_seen: "2025-01-15", price_per_sqft: 1.6 },
      { id: 2, bedrooms: 3, baths: "2", price: 2600, sqft: 1600, last_seen: "2025-02-01", price_per_sqft: 1.625 },
    ],
  },
  nearbyComps: {
    search_address: "1321 15th St, Denver, CO 80202",
    count: 3,
    nearby_properties: [
      { address: "1325 15th St", latitude: 39.751, longitude: -104.997, distance: 0.1, price: 2300, bedrooms: 3, baths: "2", property_type: "house", last_seen: "2025-01-10", sqft: 1400, dollar_sqft: 1.64 },
      { address: "1400 16th St", latitude: 39.752, longitude: -104.998, distance: 0.3, price: 2700, bedrooms: 3, baths: "2.5", property_type: "apartment", last_seen: "2025-01-20", sqft: 1600, dollar_sqft: 1.69 },
      { address: "1500 Market St", latitude: 39.749, longitude: -104.999, distance: 0.5, price: 2100, bedrooms: 3, baths: "2", property_type: "condo", last_seen: "2025-01-05", sqft: 1300, dollar_sqft: 1.62 },
    ],
  },
  errors: [],
};

// ─── Property Advisor Prompt Tests ───────────────────────────────────

describe("Property Advisor: Rentometer data in prompt", () => {
  it("builds correct STR vs LTR comparison from Rentometer data", () => {
    const strMonthly = 10678; // Projected STR monthly revenue
    const ltrMonthly = mockRentometerData.summary.median; // 2400
    const strPremium = ((strMonthly - ltrMonthly) / ltrMonthly * 100).toFixed(0);

    expect(Number(strPremium)).toBeGreaterThan(0);
    expect(Number(strPremium)).toBe(345); // (10678 - 2400) / 2400 * 100 = 344.9%
  });

  it("formats nearby comps data correctly for prompt injection", () => {
    const comps = mockRentometerData.nearbyComps.nearby_properties;
    const formatted = comps.slice(0, 5).map((c, i) =>
      `  ${i + 1}. ${c.address} — ${c.bedrooms}BR/${c.baths}BA — $${c.price.toLocaleString()}/mo — ${c.property_type} — ${c.distance.toFixed(1)} mi away`
    ).join('\n');

    expect(formatted).toContain("1325 15th St");
    expect(formatted).toContain("3BR/2BA");
    expect(formatted).toContain("$2,300/mo");
    expect(formatted).toContain("house");
    expect(formatted).toContain("0.1 mi away");
    expect(formatted).toContain("1400 16th St");
    expect(formatted).toContain("apartment");
  });

  it("formats property rent history correctly for prompt injection", () => {
    const listings = mockRentometerData.propertyRents.property_listings;
    const formatted = listings.slice(0, 5).map((l, i) =>
      `  ${i + 1}. ${l.bedrooms}BR/${l.baths}BA — $${l.price.toLocaleString()}/mo — ${l.sqft ? l.sqft + ' sqft' : 'N/A'} — Last seen: ${l.last_seen}`
    ).join('\n');

    expect(formatted).toContain("3BR/2BA");
    expect(formatted).toContain("$2,400/mo");
    expect(formatted).toContain("1500 sqft");
    expect(formatted).toContain("Last seen: 2025-01-15");
  });

  it("handles missing nearbyComps gracefully in prompt building", () => {
    const partialData = {
      ...mockRentometerData,
      nearbyComps: null,
    };

    // Simulate the prompt building logic
    let rentometerSection = '';
    if (partialData.summary) {
      rentometerSection = `Median: $${partialData.summary.median}/mo`;
      if (partialData.nearbyComps && (partialData.nearbyComps as any).nearby_properties?.length > 0) {
        rentometerSection += '\nNearby comps available';
      }
    }

    expect(rentometerSection).toContain("Median: $2400/mo");
    expect(rentometerSection).not.toContain("Nearby comps available");
  });

  it("handles missing propertyRents gracefully in prompt building", () => {
    const partialData = {
      ...mockRentometerData,
      propertyRents: null,
    };

    let rentometerSection = '';
    if (partialData.summary) {
      rentometerSection = `Median: $${partialData.summary.median}/mo`;
      if (partialData.propertyRents && (partialData.propertyRents as any).property_listings?.length > 0) {
        rentometerSection += '\nProperty rent history available';
      }
    }

    expect(rentometerSection).toContain("Median: $2400/mo");
    expect(rentometerSection).not.toContain("Property rent history available");
  });
});

// ─── Full Report Summary Prompt Tests ────────────────────────────────

describe("Full Report Summary: Rentometer data in prompt", () => {
  it("builds correct rentometerSection for context injection", () => {
    const s = mockRentometerData.summary;
    const strMonthly = 10678;
    const ltrMonthly = s.median;
    const strPremium = ltrMonthly > 0 ? ((strMonthly - ltrMonthly) / ltrMonthly * 100).toFixed(0) : 'N/A';

    let rentometerSection = `
LONG-TERM RENTAL MARKET (RENTOMETER DATA):
- Median Long-Term Rent: $${s.median.toLocaleString()}/mo
- Mean Long-Term Rent: $${s.mean.toLocaleString()}/mo
- 25th Percentile: $${s.percentile_25.toLocaleString()}/mo
- 75th Percentile: $${s.percentile_75.toLocaleString()}/mo
- Rent Range: $${s.min.toLocaleString()} – $${s.max.toLocaleString()}/mo
- Sample Size: ${s.samples} comparable rentals within ${s.radius_miles} mile radius
- STR vs LTR Comparison: This property's projected STR income ($${strMonthly.toLocaleString()}/mo) is ${Number(strPremium) >= 0 ? '+' : ''}${strPremium}% compared to the median long-term rent ($${ltrMonthly.toLocaleString()}/mo)`;

    expect(rentometerSection).toContain("Median Long-Term Rent: $2,400/mo");
    expect(rentometerSection).toContain("Mean Long-Term Rent: $2,500/mo");
    expect(rentometerSection).toContain("25th Percentile: $2,100/mo");
    expect(rentometerSection).toContain("75th Percentile: $2,800/mo");
    expect(rentometerSection).toContain("Rent Range: $1,800 – $3,200/mo");
    expect(rentometerSection).toContain("42 comparable rentals within 1 mile radius");
    expect(rentometerSection).toContain("+345%");
  });

  it("appends nearby comps to rentometerSection when available", () => {
    const comps = mockRentometerData.nearbyComps.nearby_properties;
    let rentometerSection = "LONG-TERM RENTAL MARKET";

    if (comps && comps.length > 0) {
      rentometerSection += `\n\nNEARBY LONG-TERM RENTAL COMPS (top 5):\n${comps.slice(0, 5).map((c, i) => `  ${i + 1}. ${c.address} — ${c.bedrooms}BR/${c.baths}BA — $${c.price.toLocaleString()}/mo — ${c.property_type} — ${c.distance.toFixed(1)} mi away`).join('\n')}`;
    }

    expect(rentometerSection).toContain("NEARBY LONG-TERM RENTAL COMPS (top 5):");
    expect(rentometerSection).toContain("1325 15th St — 3BR/2BA — $2,300/mo — house — 0.1 mi away");
    expect(rentometerSection).toContain("1400 16th St — 3BR/2.5BA — $2,700/mo — apartment — 0.3 mi away");
    expect(rentometerSection).toContain("1500 Market St — 3BR/2BA — $2,100/mo — condo — 0.5 mi away");
  });

  it("handles zero median rent (edge case) without division by zero", () => {
    const zeroMedianData = {
      ...mockRentometerData.summary,
      median: 0,
    };

    const strMonthly = 10678;
    const ltrMonthly = zeroMedianData.median;
    const strPremium = ltrMonthly > 0 ? ((strMonthly - ltrMonthly) / ltrMonthly * 100).toFixed(0) : 'N/A';

    expect(strPremium).toBe('N/A');
  });

  it("handles negative STR premium (LTR more profitable than STR)", () => {
    const strMonthly = 1500; // Lower than LTR
    const ltrMonthly = mockRentometerData.summary.median; // 2400
    const strPremium = ltrMonthly > 0 ? ((strMonthly - ltrMonthly) / ltrMonthly * 100).toFixed(0) : 'N/A';

    expect(Number(strPremium)).toBeLessThan(0);
    expect(Number(strPremium)).toBe(-38); // (1500 - 2400) / 2400 * 100 = -37.5% → -38%
  });

  it("conditionally includes Long-Term Rental Market format section", () => {
    // When rentometerData is present
    const withData = mockRentometerData.summary
      ? `### Long-Term Rental Market\nCompare the short-term rental income to the long-term rental market data from Rentometer.`
      : '';
    expect(withData).toContain("Long-Term Rental Market");

    // When rentometerData is absent
    const noSummary = null;
    const withoutData = noSummary
      ? `### Long-Term Rental Market\nCompare the short-term rental income to the long-term rental market data from Rentometer.`
      : '';
    expect(withoutData).toBe('');
  });
});

// ─── Data Flow: Report → AI Prompt ───────────────────────────────────

describe("Data flow: rentometer_data from report to AI prompt", () => {
  it("rentometerData flows correctly from fullAnalysisData to summaryInput", () => {
    // Simulate the data flow from shared-reports.ts
    const reportData: any = {
      property_estimate: { adr: 200, occupancy: 0.7 },
      rentometer_data: mockRentometerData,
      revenue: { annual: 128000, monthly: 10678, nightly: 480 },
    };

    const summaryInput = {
      property: { address: "1321 15th St", bedrooms: 3, bathrooms: 2 },
      revenue: reportData.revenue,
      rentometerData: reportData.rentometer_data,
    };

    expect(summaryInput.rentometerData).toBeDefined();
    expect(summaryInput.rentometerData.summary.median).toBe(2400);
    expect(summaryInput.rentometerData.nearbyComps.count).toBe(3);
    expect(summaryInput.rentometerData.propertyRents.count).toBe(5);
  });

  it("handles undefined rentometer_data in older reports", () => {
    const oldReportData: any = {
      property_estimate: { adr: 200, occupancy: 0.7 },
      // No rentometer_data field
    };

    const summaryInput = {
      property: { address: "1321 15th St", bedrooms: 3, bathrooms: 2 },
      rentometerData: oldReportData.rentometer_data,
    };

    expect(summaryInput.rentometerData).toBeUndefined();

    // The prompt building logic should handle this gracefully
    let rentometerSection = '';
    if (summaryInput.rentometerData?.summary) {
      rentometerSection = 'LONG-TERM RENTAL MARKET';
    }
    expect(rentometerSection).toBe('');
  });

  it("property advisor receives expanded rentometerData with comps", () => {
    // Simulate the data flow from advanced.ts
    const comprehensiveRentometerData = mockRentometerData;

    const propertyAdvisorInput = {
      rentometerData: {
        median: comprehensiveRentometerData.summary?.median,
        mean: comprehensiveRentometerData.summary?.mean,
        percentile_25: comprehensiveRentometerData.summary?.percentile_25,
        percentile_75: comprehensiveRentometerData.summary?.percentile_75,
        min: comprehensiveRentometerData.summary?.min,
        max: comprehensiveRentometerData.summary?.max,
        samples: comprehensiveRentometerData.summary?.samples,
        radius_miles: comprehensiveRentometerData.summary?.radius_miles,
        nearbyComps: comprehensiveRentometerData.nearbyComps?.nearby_properties?.slice(0, 5).map(c => ({
          address: c.address,
          bedrooms: c.bedrooms,
          baths: c.baths,
          price: c.price,
          property_type: c.property_type,
          distance: c.distance,
        })),
        propertyRents: comprehensiveRentometerData.propertyRents?.property_listings?.slice(0, 5).map(l => ({
          bedrooms: l.bedrooms,
          baths: l.baths,
          price: l.price,
          sqft: l.sqft,
          last_seen: l.last_seen,
        })),
      },
    };

    expect(propertyAdvisorInput.rentometerData.median).toBe(2400);
    expect(propertyAdvisorInput.rentometerData.nearbyComps).toHaveLength(3);
    expect(propertyAdvisorInput.rentometerData.nearbyComps![0].address).toBe("1325 15th St");
    expect(propertyAdvisorInput.rentometerData.propertyRents).toHaveLength(2);
    expect(propertyAdvisorInput.rentometerData.propertyRents![0].price).toBe(2400);
  });
});

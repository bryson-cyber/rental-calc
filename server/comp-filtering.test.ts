import { describe, expect, it } from "vitest";

/**
 * Tests for the comp filtering logic that ensures comps match the subject
 * property's bedroom AND bathroom count (not just bedrooms).
 *
 * The core logic under test:
 * - matchesBathrooms(compBa, targetBa) => Math.abs(compBa - targetBa) <= 0.5
 * - Comps are sorted: exact BA match first, then same-BR-only, then adjacent-BR
 * - Fallback: if fewer than 10 exact BR+BA matches, supplement with same-BR comps
 */

// Replicate the matchesBathrooms function from airdna.ts
const matchesBathrooms = (compBa: number, targetBa: number) =>
  Math.abs(compBa - targetBa) <= 0.5;

// Helper to create a mock comp
function mockComp(overrides: {
  id: string;
  bedrooms: number;
  bathrooms: number;
  annual_revenue: number;
  adr: number;
}) {
  return {
    id: overrides.id,
    title: `Listing ${overrides.id}`,
    bedrooms: overrides.bedrooms,
    bathrooms: overrides.bathrooms,
    annual_revenue: overrides.annual_revenue,
    adr: overrides.adr,
    occupancy: 0.75,
    rating: 4.5,
    reviews: 50,
    accommodates: overrides.bedrooms * 2,
    property_type: "house",
  };
}

describe("matchesBathrooms tolerance", () => {
  it("exact match returns true", () => {
    expect(matchesBathrooms(1, 1)).toBe(true);
    expect(matchesBathrooms(2, 2)).toBe(true);
    expect(matchesBathrooms(2.5, 2.5)).toBe(true);
  });

  it("half-bath difference returns true (±0.5 tolerance)", () => {
    expect(matchesBathrooms(1, 1.5)).toBe(true);
    expect(matchesBathrooms(1.5, 1)).toBe(true);
    expect(matchesBathrooms(2, 2.5)).toBe(true);
    expect(matchesBathrooms(2.5, 2)).toBe(true);
  });

  it("full bathroom difference returns false", () => {
    expect(matchesBathrooms(1, 2)).toBe(false);
    expect(matchesBathrooms(2, 1)).toBe(false);
    expect(matchesBathrooms(1, 2.5)).toBe(false);
    expect(matchesBathrooms(2.5, 1)).toBe(false);
  });

  it("large differences return false", () => {
    expect(matchesBathrooms(1, 3)).toBe(false);
    expect(matchesBathrooms(1, 4)).toBe(false);
  });
});

describe("comp sorting: exact BA match first, then different BA", () => {
  it("sorts exact BA matches before different BA comps", () => {
    const propertyBathrooms = 1;

    const comps = [
      mockComp({ id: "a", bedrooms: 2, bathrooms: 2, annual_revenue: 50000, adr: 174 }),
      mockComp({ id: "b", bedrooms: 2, bathrooms: 1, annual_revenue: 35000, adr: 110 }),
      mockComp({ id: "c", bedrooms: 2, bathrooms: 2.5, annual_revenue: 48000, adr: 160 }),
      mockComp({ id: "d", bedrooms: 2, bathrooms: 1.5, annual_revenue: 42000, adr: 137 }),
      mockComp({ id: "e", bedrooms: 2, bathrooms: 1, annual_revenue: 32000, adr: 105 }),
    ];

    const sorted = [...comps].sort((a, b) => {
      const aExact = matchesBathrooms(a.bathrooms, propertyBathrooms) ? 0 : 1;
      const bExact = matchesBathrooms(b.bathrooms, propertyBathrooms) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return b.annual_revenue - a.annual_revenue;
    });

    // First should be exact BA matches (1 or 1.5 BA), sorted by revenue
    expect(sorted[0].id).toBe("d"); // 1.5 BA, $42K (within ±0.5 of 1 BA)
    expect(sorted[1].id).toBe("b"); // 1 BA, $35K
    expect(sorted[2].id).toBe("e"); // 1 BA, $32K

    // Then different BA comps, sorted by revenue
    expect(sorted[3].id).toBe("a"); // 2 BA, $50K
    expect(sorted[4].id).toBe("c"); // 2.5 BA, $48K
  });

  it("for 2BA property, 2BA and 2.5BA are exact, 1BA is not", () => {
    const propertyBathrooms = 2;

    const comps = [
      mockComp({ id: "a", bedrooms: 3, bathrooms: 1, annual_revenue: 60000, adr: 200 }),
      mockComp({ id: "b", bedrooms: 3, bathrooms: 2, annual_revenue: 50000, adr: 170 }),
      mockComp({ id: "c", bedrooms: 3, bathrooms: 2.5, annual_revenue: 55000, adr: 180 }),
      mockComp({ id: "d", bedrooms: 3, bathrooms: 3, annual_revenue: 65000, adr: 210 }),
    ];

    const sorted = [...comps].sort((a, b) => {
      const aExact = matchesBathrooms(a.bathrooms, propertyBathrooms) ? 0 : 1;
      const bExact = matchesBathrooms(b.bathrooms, propertyBathrooms) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return b.annual_revenue - a.annual_revenue;
    });

    // Exact matches (2 or 2.5 BA) first
    expect(sorted[0].id).toBe("c"); // 2.5 BA, $55K
    expect(sorted[1].id).toBe("b"); // 2 BA, $50K

    // Different BA after
    expect(sorted[2].id).toBe("d"); // 3 BA, $65K
    expect(sorted[3].id).toBe("a"); // 1 BA, $60K
  });
});

describe("comp filtering simulation: 2BR/1BA property (Phoenix scenario)", () => {
  it("prioritizes 2BR/1BA comps over 2BR/2BA comps", () => {
    const propertyBedrooms = 2;
    const propertyBathrooms = 1;

    // Simulate the Phoenix scenario: mix of 2BR/1BA and 2BR/2BA comps
    const allComps = [
      mockComp({ id: "1", bedrooms: 2, bathrooms: 2, annual_revenue: 48000, adr: 174 }), // 2BR/2BA
      mockComp({ id: "2", bedrooms: 2, bathrooms: 1, annual_revenue: 42000, adr: 134 }), // 2BR/1BA
      mockComp({ id: "3", bedrooms: 2, bathrooms: 1, annual_revenue: 42000, adr: 137 }), // 2BR/1BA
      mockComp({ id: "4", bedrooms: 2, bathrooms: 2, annual_revenue: 38000, adr: 117 }), // 2BR/2BA
      mockComp({ id: "5", bedrooms: 2, bathrooms: 1, annual_revenue: 35000, adr: 113 }), // 2BR/1BA
      mockComp({ id: "6", bedrooms: 2, bathrooms: 1.5, annual_revenue: 32000, adr: 110 }), // 2BR/1.5BA (within tolerance)
      mockComp({ id: "7", bedrooms: 2, bathrooms: 2.5, annual_revenue: 52000, adr: 190 }), // 2BR/2.5BA
    ];

    // Filter same bedroom
    const sameBedroom = allComps.filter((c) => c.bedrooms === propertyBedrooms);
    expect(sameBedroom.length).toBe(7);

    // Split into exact BA match and different BA
    const exactMatch = sameBedroom.filter((c) =>
      matchesBathrooms(c.bathrooms, propertyBathrooms)
    );
    const differentBa = sameBedroom.filter(
      (c) => !matchesBathrooms(c.bathrooms, propertyBathrooms)
    );

    expect(exactMatch.length).toBe(4); // 1BA and 1.5BA comps
    expect(differentBa.length).toBe(3); // 2BA and 2.5BA comps

    // Sort with exact match priority
    const sorted = [...sameBedroom].sort((a, b) => {
      const aExact = matchesBathrooms(a.bathrooms, propertyBathrooms) ? 0 : 1;
      const bExact = matchesBathrooms(b.bathrooms, propertyBathrooms) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return b.annual_revenue - a.annual_revenue;
    });

    // First 4 should all be exact BA matches (1 or 1.5 BA)
    for (let i = 0; i < 4; i++) {
      expect(matchesBathrooms(sorted[i].bathrooms, propertyBathrooms)).toBe(true);
    }

    // Last 3 should be different BA
    for (let i = 4; i < 7; i++) {
      expect(matchesBathrooms(sorted[i].bathrooms, propertyBathrooms)).toBe(false);
    }

    // Within exact matches, sorted by revenue descending
    expect(sorted[0].annual_revenue).toBeGreaterThanOrEqual(sorted[1].annual_revenue);
    expect(sorted[1].annual_revenue).toBeGreaterThanOrEqual(sorted[2].annual_revenue);

    // The highest-revenue exact match ($42K) should come before the highest different-BA ($52K)
    expect(sorted[0].annual_revenue).toBe(42000);
    expect(sorted[4].annual_revenue).toBe(52000); // 2.5BA comp is highest but pushed down
  });
});

// ============================================
// COMP-MEDIAN ADJUSTMENT (Option B) TESTS
// ============================================

// Replicate the comp-median adjustment logic from airdna.ts
function getMedian(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function getPercentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

interface MockEstimate {
  annual_revenue: number;
  annual_revenue_low: number;
  annual_revenue_high: number;
  average_daily_rate: number;
  occupancy_rate: number;
}

interface MockForecast {
  month: string;
  revenue: number;
  adr: number;
  occupancy: number;
}

function applyCompMedianAdjustment(
  estimates: MockEstimate,
  monthly_forecast: MockForecast[],
  exactMatchComps: Array<{ annual_revenue: number; adr: number; occupancy: number }>
): { estimates: MockEstimate; monthly_forecast: MockForecast[]; adjusted: boolean } {
  if (exactMatchComps.length < 2) {
    return { estimates: { ...estimates }, monthly_forecast: [...monthly_forecast], adjusted: false };
  }

  const sortedRevenues = exactMatchComps.map(c => c.annual_revenue).sort((a, b) => a - b);
  const sortedAdrs = exactMatchComps.map(c => c.adr).sort((a, b) => a - b);
  const sortedOccupancies = exactMatchComps.map(c => c.occupancy).sort((a, b) => a - b);

  const compMedianRevenue = getMedian(sortedRevenues);
  const compMedianAdr = getMedian(sortedAdrs);
  const compMedianOccupancy = getMedian(sortedOccupancies);
  const compP25Revenue = getPercentile(sortedRevenues, 25);
  const compP75Revenue = getPercentile(sortedRevenues, 75);

  if (compMedianRevenue <= estimates.annual_revenue) {
    return { estimates: { ...estimates }, monthly_forecast: [...monthly_forecast], adjusted: false };
  }

  const scaleFactor = compMedianRevenue / estimates.annual_revenue;

  const newEstimates: MockEstimate = {
    annual_revenue: compMedianRevenue,
    average_daily_rate: compMedianAdr,
    occupancy_rate: compMedianOccupancy > 1 ? compMedianOccupancy / 100 : compMedianOccupancy,
    annual_revenue_low: compP25Revenue,
    annual_revenue_high: compP75Revenue,
  };

  const newForecast = monthly_forecast.map(m => ({
    ...m,
    revenue: Math.round(m.revenue * scaleFactor),
    adr: Math.round(m.adr * scaleFactor),
  }));

  return { estimates: newEstimates, monthly_forecast: newForecast, adjusted: true };
}

describe("Comp-Median Adjustment (Option B)", () => {
  const baseEstimates: MockEstimate = {
    annual_revenue: 20889,
    annual_revenue_low: 19000,
    annual_revenue_high: 22000,
    average_daily_rate: 75,
    occupancy_rate: 0.73,
  };

  const baseForecast: MockForecast[] = [
    { month: "2025-01", revenue: 1500, adr: 65, occupancy: 0.75 },
    { month: "2025-02", revenue: 1800, adr: 70, occupancy: 0.80 },
    { month: "2025-03", revenue: 2200, adr: 85, occupancy: 0.85 },
    { month: "2025-04", revenue: 1900, adr: 78, occupancy: 0.78 },
    { month: "2025-05", revenue: 1700, adr: 72, occupancy: 0.72 },
    { month: "2025-06", revenue: 1600, adr: 68, occupancy: 0.70 },
  ];

  it("adjusts revenue upward when comp median exceeds Rentalizer estimate", () => {
    const comps = [
      { annual_revenue: 32000, adr: 110, occupancy: 0.75 },
      { annual_revenue: 35000, adr: 113, occupancy: 0.78 },
      { annual_revenue: 38000, adr: 120, occupancy: 0.80 },
      { annual_revenue: 42000, adr: 134, occupancy: 0.82 },
      { annual_revenue: 42000, adr: 137, occupancy: 0.85 },
    ];

    const result = applyCompMedianAdjustment(baseEstimates, baseForecast, comps);

    expect(result.adjusted).toBe(true);
    expect(result.estimates.annual_revenue).toBe(38000); // median of [32K, 35K, 38K, 42K, 42K]
    expect(result.estimates.average_daily_rate).toBe(120); // median of [110, 113, 120, 134, 137]
    expect(result.estimates.annual_revenue).toBeGreaterThan(baseEstimates.annual_revenue);
  });

  it("does NOT adjust when Rentalizer estimate exceeds comp median", () => {
    const highEstimates: MockEstimate = {
      ...baseEstimates,
      annual_revenue: 50000,
    };

    const comps = [
      { annual_revenue: 32000, adr: 110, occupancy: 0.75 },
      { annual_revenue: 35000, adr: 113, occupancy: 0.78 },
      { annual_revenue: 38000, adr: 120, occupancy: 0.80 },
    ];

    const result = applyCompMedianAdjustment(highEstimates, baseForecast, comps);

    expect(result.adjusted).toBe(false);
    expect(result.estimates.annual_revenue).toBe(50000); // unchanged
  });

  it("does NOT adjust when fewer than 2 exact-match comps", () => {
    const comps = [
      { annual_revenue: 50000, adr: 180, occupancy: 0.85 },
    ];

    const result = applyCompMedianAdjustment(baseEstimates, baseForecast, comps);

    expect(result.adjusted).toBe(false);
    expect(result.estimates.annual_revenue).toBe(baseEstimates.annual_revenue);
  });

  it("does NOT adjust when zero comps", () => {
    const result = applyCompMedianAdjustment(baseEstimates, baseForecast, []);

    expect(result.adjusted).toBe(false);
    expect(result.estimates.annual_revenue).toBe(baseEstimates.annual_revenue);
  });

  it("scales monthly forecast proportionally while preserving seasonal shape", () => {
    const comps = [
      { annual_revenue: 32000, adr: 110, occupancy: 0.75 },
      { annual_revenue: 38000, adr: 120, occupancy: 0.80 },
      { annual_revenue: 42000, adr: 134, occupancy: 0.82 },
    ];

    const result = applyCompMedianAdjustment(baseEstimates, baseForecast, comps);

    expect(result.adjusted).toBe(true);

    const scaleFactor = 38000 / 20889; // ~1.819

    // Revenue and ADR should be scaled
    expect(result.monthly_forecast[0].revenue).toBe(Math.round(1500 * scaleFactor));
    expect(result.monthly_forecast[2].revenue).toBe(Math.round(2200 * scaleFactor));

    // Occupancy should remain unchanged (seasonal pattern preserved)
    expect(result.monthly_forecast[0].occupancy).toBe(0.75);
    expect(result.monthly_forecast[2].occupancy).toBe(0.85);

    // Seasonal shape should be preserved: March (index 2) should still be highest
    const maxRevMonth = result.monthly_forecast.reduce((max, m) =>
      m.revenue > max.revenue ? m : max
    );
    expect(maxRevMonth.month).toBe("2025-03");
  });

  it("sets P25 and P75 as the revenue range", () => {
    const comps = [
      { annual_revenue: 30000, adr: 100, occupancy: 0.70 },
      { annual_revenue: 35000, adr: 115, occupancy: 0.75 },
      { annual_revenue: 38000, adr: 120, occupancy: 0.78 },
      { annual_revenue: 42000, adr: 135, occupancy: 0.82 },
      { annual_revenue: 48000, adr: 160, occupancy: 0.88 },
    ];

    const result = applyCompMedianAdjustment(baseEstimates, baseForecast, comps);

    expect(result.adjusted).toBe(true);
    expect(result.estimates.annual_revenue_low).toBe(getPercentile([30000, 35000, 38000, 42000, 48000], 25));
    expect(result.estimates.annual_revenue_high).toBe(getPercentile([30000, 35000, 38000, 42000, 48000], 75));
    expect(result.estimates.annual_revenue_low).toBeLessThan(result.estimates.annual_revenue);
    expect(result.estimates.annual_revenue_high).toBeGreaterThan(result.estimates.annual_revenue);
  });

  it("normalizes comp occupancy from percentage to decimal", () => {
    const comps = [
      { annual_revenue: 35000, adr: 115, occupancy: 75 }, // percentage format (75 = 75%)
      { annual_revenue: 38000, adr: 120, occupancy: 80 },
      { annual_revenue: 42000, adr: 135, occupancy: 85 },
    ];

    const result = applyCompMedianAdjustment(baseEstimates, baseForecast, comps);

    expect(result.adjusted).toBe(true);
    // Occupancy should be normalized to decimal (0.80, not 80)
    expect(result.estimates.occupancy_rate).toBe(0.80);
    expect(result.estimates.occupancy_rate).toBeLessThanOrEqual(1);
  });

  it("handles even number of comps (median is average of two middle values)", () => {
    const comps = [
      { annual_revenue: 30000, adr: 100, occupancy: 0.70 },
      { annual_revenue: 35000, adr: 115, occupancy: 0.75 },
      { annual_revenue: 42000, adr: 135, occupancy: 0.82 },
      { annual_revenue: 48000, adr: 160, occupancy: 0.88 },
    ];

    const result = applyCompMedianAdjustment(baseEstimates, baseForecast, comps);

    expect(result.adjusted).toBe(true);
    // Median of [30000, 35000, 42000, 48000] = (35000 + 42000) / 2 = 38500
    expect(result.estimates.annual_revenue).toBe(38500);
  });

  it("Phoenix scenario: 2BR/1BA with $21K Rentalizer vs $32-42K comps", () => {
    const phoenixEstimates: MockEstimate = {
      annual_revenue: 20889,
      annual_revenue_low: 19000,
      annual_revenue_high: 22000,
      average_daily_rate: 75,
      occupancy_rate: 0.73,
    };

    const phoenixComps = [
      { annual_revenue: 32000, adr: 110, occupancy: 75 },
      { annual_revenue: 35000, adr: 113, occupancy: 78 },
      { annual_revenue: 38000, adr: 120, occupancy: 80 },
      { annual_revenue: 42000, adr: 134, occupancy: 82 },
      { annual_revenue: 42000, adr: 137, occupancy: 85 },
    ];

    const result = applyCompMedianAdjustment(phoenixEstimates, baseForecast, phoenixComps);

    expect(result.adjusted).toBe(true);
    expect(result.estimates.annual_revenue).toBe(38000); // median
    expect(result.estimates.annual_revenue).toBeGreaterThan(phoenixEstimates.annual_revenue);

    // Monthly revenue should now be ~$3,167/mo instead of ~$1,741/mo
    const totalMonthlyRevenue = result.monthly_forecast.reduce((sum, m) => sum + m.revenue, 0);
    const avgMonthly = totalMonthlyRevenue / result.monthly_forecast.length;
    expect(avgMonthly).toBeGreaterThan(2500);
  });
});

describe("getMedian helper", () => {
  it("returns middle value for odd-length arrays", () => {
    expect(getMedian([1, 2, 3])).toBe(2);
    expect(getMedian([10, 20, 30, 40, 50])).toBe(30);
  });

  it("returns average of two middle values for even-length arrays", () => {
    expect(getMedian([1, 2, 3, 4])).toBe(3); // (2+3)/2 = 2.5, rounded to 3
    expect(getMedian([10, 20, 30, 40])).toBe(25);
  });

  it("handles single element", () => {
    expect(getMedian([42])).toBe(42);
  });

  it("handles two elements", () => {
    expect(getMedian([10, 20])).toBe(15);
  });
});

describe("getPercentile helper", () => {
  it("returns P25 correctly", () => {
    const arr = [30000, 35000, 38000, 42000, 48000];
    expect(getPercentile(arr, 25)).toBe(35000);
  });

  it("returns P75 correctly", () => {
    const arr = [30000, 35000, 38000, 42000, 48000];
    expect(getPercentile(arr, 75)).toBe(42000);
  });

  it("returns P50 (median) correctly", () => {
    const arr = [30000, 35000, 38000, 42000, 48000];
    expect(getPercentile(arr, 50)).toBe(38000);
  });
});

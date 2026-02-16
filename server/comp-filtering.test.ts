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
// COMP-MEDIAN REVENUE ADJUSTMENT TESTS
// Uses median of exact-match (same BR+BA) comps as headline revenue
// ============================================

// Replicate the helper functions from airdna.ts
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

/**
 * Replicates the comp-median adjustment logic from airdna.ts:
 * - Uses MEDIAN of exact-match comps as the headline revenue
 * - No cap — comp median IS the real data
 * - Adjusts both up AND down (comp median replaces Rentalizer)
 * - Requires >= 3 exact-match comps
 * - Sets Q1 as the low end, Q3 as the high end
 */
function applyCompMedianAdjustment(
  estimates: MockEstimate,
  monthly_forecast: MockForecast[],
  exactMatchComps: Array<{ annual_revenue: number; adr: number; occupancy: number }>
): { estimates: MockEstimate; monthly_forecast: MockForecast[]; adjusted: boolean } {
  if (exactMatchComps.length < 3) {
    return { estimates: { ...estimates }, monthly_forecast: [...monthly_forecast], adjusted: false };
  }

  const sortedRevenues = exactMatchComps.map(c => c.annual_revenue).sort((a, b) => a - b);
  const sortedAdrs = exactMatchComps.map(c => c.adr).sort((a, b) => a - b);
  const sortedOccupancies = exactMatchComps.map(c => c.occupancy).sort((a, b) => a - b);

  const compMedianRevenue = getMedian(sortedRevenues);
  const compMedianAdr = getMedian(sortedAdrs);
  const compMedianOccupancy = getMedian(sortedOccupancies);
  const compQ1Revenue = getPercentile(sortedRevenues, 25);
  const compQ3Revenue = getPercentile(sortedRevenues, 75);

  const rentalizerRevenue = estimates.annual_revenue;
  const targetRevenue = compMedianRevenue;

  // Only adjust if median differs from Rentalizer
  if (targetRevenue === rentalizerRevenue) {
    return { estimates: { ...estimates }, monthly_forecast: [...monthly_forecast], adjusted: false };
  }

  const scaleFactor = targetRevenue / rentalizerRevenue;

  const newEstimates: MockEstimate = {
    annual_revenue: targetRevenue,
    average_daily_rate: compMedianAdr > 1 ? compMedianAdr : Math.round(compMedianAdr),
    occupancy_rate: compMedianOccupancy > 1 ? compMedianOccupancy / 100 : compMedianOccupancy,
    annual_revenue_low: compQ1Revenue,
    annual_revenue_high: compQ3Revenue,
  };

  const newForecast = monthly_forecast.map(m => ({
    ...m,
    revenue: Math.round(m.revenue * scaleFactor),
    adr: Math.round(m.adr * scaleFactor),
  }));

  return { estimates: newEstimates, monthly_forecast: newForecast, adjusted: true };
}

describe("Comp-Median Revenue Adjustment", () => {
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
  ];

  it("uses comp median as headline revenue when comps are higher than Rentalizer", () => {
    const comps = [
      { annual_revenue: 32000, adr: 110, occupancy: 0.75 },
      { annual_revenue: 35000, adr: 113, occupancy: 0.78 },
      { annual_revenue: 38000, adr: 120, occupancy: 0.80 },
      { annual_revenue: 42000, adr: 134, occupancy: 0.82 },
      { annual_revenue: 42000, adr: 137, occupancy: 0.85 },
    ];

    const result = applyCompMedianAdjustment(baseEstimates, baseForecast, comps);

    expect(result.adjusted).toBe(true);
    // Median of [32K, 35K, 38K, 42K, 42K] = 38000
    expect(result.estimates.annual_revenue).toBe(38000);
    expect(result.estimates.annual_revenue).toBeGreaterThan(baseEstimates.annual_revenue);
  });

  it("uses comp median even when it is LOWER than Rentalizer (adjusts downward)", () => {
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

    expect(result.adjusted).toBe(true);
    // Median of [32K, 35K, 38K] = 35000 — LOWER than Rentalizer $50K
    expect(result.estimates.annual_revenue).toBe(35000);
    expect(result.estimates.annual_revenue).toBeLessThan(highEstimates.annual_revenue);
  });

  it("has no artificial cap — comp median is the real data", () => {
    const comps = [
      { annual_revenue: 40000, adr: 140, occupancy: 0.80 },
      { annual_revenue: 50000, adr: 170, occupancy: 0.85 },
      { annual_revenue: 60000, adr: 200, occupancy: 0.88 },
      { annual_revenue: 70000, adr: 230, occupancy: 0.90 },
    ];

    const result = applyCompMedianAdjustment(baseEstimates, baseForecast, comps);

    expect(result.adjusted).toBe(true);
    // Median of [40K, 50K, 60K, 70K] = (50K+60K)/2 = 55000
    expect(result.estimates.annual_revenue).toBe(55000);
    // No cap — even though 55K is >2.5x the Rentalizer, it's what comps actually earn
    expect(result.estimates.average_daily_rate).toBe(Math.round((170 + 200) / 2)); // median ADR
  });

  it("does NOT adjust when comp median equals Rentalizer", () => {
    const comps = [
      { annual_revenue: 18000, adr: 60, occupancy: 0.70 },
      { annual_revenue: 20889, adr: 75, occupancy: 0.73 },
      { annual_revenue: 24000, adr: 90, occupancy: 0.78 },
    ];

    const result = applyCompMedianAdjustment(baseEstimates, baseForecast, comps);

    expect(result.adjusted).toBe(false);
    // Median of [18K, 20889, 24K] = 20889 = Rentalizer
    expect(result.estimates.annual_revenue).toBe(20889);
  });

  it("does NOT adjust when fewer than 3 exact-match comps", () => {
    const comps = [
      { annual_revenue: 50000, adr: 180, occupancy: 0.85 },
      { annual_revenue: 60000, adr: 200, occupancy: 0.90 },
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

    // Median = 38000
    const scaleFactor = 38000 / 20889;

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

  it("sets Q1 as low end and Q3 as high end of range", () => {
    const comps = [
      { annual_revenue: 30000, adr: 100, occupancy: 0.70 },
      { annual_revenue: 35000, adr: 115, occupancy: 0.75 },
      { annual_revenue: 38000, adr: 120, occupancy: 0.78 },
      { annual_revenue: 42000, adr: 135, occupancy: 0.82 },
      { annual_revenue: 48000, adr: 160, occupancy: 0.88 },
    ];

    const result = applyCompMedianAdjustment(baseEstimates, baseForecast, comps);

    expect(result.adjusted).toBe(true);
    // Q1 of [30K, 35K, 38K, 42K, 48K] = 35000
    expect(result.estimates.annual_revenue_low).toBe(35000);
    // Q3 of [30K, 35K, 38K, 42K, 48K] = 42000
    expect(result.estimates.annual_revenue_high).toBe(42000);
  });

  it("normalizes comp occupancy from percentage to decimal", () => {
    const comps = [
      { annual_revenue: 35000, adr: 115, occupancy: 75 }, // percentage format (75 = 75%)
      { annual_revenue: 38000, adr: 120, occupancy: 80 },
      { annual_revenue: 42000, adr: 135, occupancy: 85 },
    ];

    const result = applyCompMedianAdjustment(baseEstimates, baseForecast, comps);

    expect(result.adjusted).toBe(true);
    // Median occupancy = 80, normalized to 0.80
    expect(result.estimates.occupancy_rate).toBe(0.80);
    expect(result.estimates.occupancy_rate).toBeLessThanOrEqual(1);
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
    // Median of [32K, 35K, 38K, 42K, 42K] = 38000
    expect(result.estimates.annual_revenue).toBe(38000);
    expect(result.estimates.annual_revenue).toBeGreaterThan(phoenixEstimates.annual_revenue);

    // Monthly revenue should now be ~$3,167/mo instead of ~$1,741/mo
    const totalMonthlyRevenue = result.monthly_forecast.reduce((sum, m) => sum + m.revenue, 0);
    const avgMonthly = totalMonthlyRevenue / result.monthly_forecast.length;
    expect(avgMonthly).toBeGreaterThan(2500);
  });

  it("handles exactly 3 comps (minimum threshold)", () => {
    const comps = [
      { annual_revenue: 30000, adr: 100, occupancy: 0.70 },
      { annual_revenue: 35000, adr: 115, occupancy: 0.78 },
      { annual_revenue: 42000, adr: 135, occupancy: 0.85 },
    ];

    const result = applyCompMedianAdjustment(baseEstimates, baseForecast, comps);

    expect(result.adjusted).toBe(true);
    // Median of [30K, 35K, 42K] = 35000
    expect(result.estimates.annual_revenue).toBe(35000);
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

describe("Cache Comp-Median Re-application (stale cache handling)", () => {
  // Simulates the comp-median logic in getComprehensivePropertyReport cache hit path
  function applyCacheCompMedian(cachedReport: any, bedrooms: number, bathrooms: number) {
    const cachedProp = cachedReport.property;
    if (cachedProp?.estimates && !cachedProp._original_rentalizer && cachedReport.same_bedroom_comps?.length > 0) {
      const propBr = bedrooms || cachedProp.property?.bedrooms;
      const propBa = bathrooms || cachedProp.property?.bathrooms;
      if (propBr && propBa) {
        const matchBa = (compBa: number, targetBa: number) => Math.abs(compBa - targetBa) <= 0.5;
        const exactComps = cachedReport.same_bedroom_comps.filter(
          (c: any) => c.bedrooms === propBr && matchBa(c.bathrooms, propBa) && c.annual_revenue > 0
        );
        if (exactComps.length >= 3) {
          const sortedRevs = exactComps.map((c: any) => c.annual_revenue).sort((a: number, b: number) => a - b);
          const sortedAdrs = exactComps.map((c: any) => c.adr).sort((a: number, b: number) => a - b);
          const sortedOccs = exactComps.map((c: any) => c.occupancy).sort((a: number, b: number) => a - b);
          const medianIdx = Math.floor(sortedRevs.length / 2);
          const median = sortedRevs.length % 2 === 0 ? Math.round((sortedRevs[medianIdx - 1] + sortedRevs[medianIdx]) / 2) : sortedRevs[medianIdx];
          const medianAdr = sortedAdrs.length % 2 === 0 ? Math.round((sortedAdrs[medianIdx - 1] + sortedAdrs[medianIdx]) / 2) : sortedAdrs[medianIdx];
          const medianOcc = sortedOccs.length % 2 === 0 ? (sortedOccs[medianIdx - 1] + sortedOccs[medianIdx]) / 2 : sortedOccs[medianIdx];
          const q1Idx = Math.max(0, Math.ceil((25 / 100) * sortedRevs.length) - 1);
          const q3Idx = Math.max(0, Math.ceil((75 / 100) * sortedRevs.length) - 1);
          const rentalizerRev = cachedProp.estimates.annual_revenue;
          
          if (median !== rentalizerRev) {
            const scale = median / rentalizerRev;
            cachedProp._original_rentalizer = {
              annual_revenue: rentalizerRev,
              annual_revenue_low: cachedProp.estimates.annual_revenue_low,
              annual_revenue_high: cachedProp.estimates.annual_revenue_high,
              average_daily_rate: cachedProp.estimates.average_daily_rate,
              occupancy_rate: cachedProp.estimates.occupancy_rate,
            };
            cachedProp.estimates.annual_revenue = median;
            cachedProp.estimates.average_daily_rate = medianAdr;
            cachedProp.estimates.occupancy_rate = medianOcc > 1 ? medianOcc / 100 : medianOcc;
            cachedProp.estimates.annual_revenue_low = sortedRevs[q1Idx];
            cachedProp.estimates.annual_revenue_high = sortedRevs[q3Idx];
            if (cachedProp.monthly_forecast?.length > 0) {
              cachedProp.monthly_forecast = cachedProp.monthly_forecast.map((m: any) => ({
                ...m,
                revenue: Math.round(m.revenue * scale),
                adr: Math.round(m.adr * scale),
              }));
            }
            return { adjusted: true, scale };
          }
        }
      }
    }
    return { adjusted: false };
  }

  function makeStaleCachedReport(rentalizerRevenue: number, comps: any[]) {
    return {
      property: {
        property: { bedrooms: 2, bathrooms: 1 },
        estimates: {
          annual_revenue: rentalizerRevenue,
          annual_revenue_low: Math.round(rentalizerRevenue * 0.9),
          annual_revenue_high: Math.round(rentalizerRevenue * 1.1),
          average_daily_rate: Math.round(rentalizerRevenue / 365 / 0.7),
          occupancy_rate: 0.7,
        },
        monthly_forecast: [
          { month: "2024-01", revenue: Math.round(rentalizerRevenue / 12), adr: 100 },
          { month: "2024-02", revenue: Math.round(rentalizerRevenue / 12 * 0.8), adr: 90 },
        ],
      },
      same_bedroom_comps: comps,
      market: null,
      submarkets: [],
      bedroom_performance: [],
      generated_at: new Date().toISOString(),
    };
  }

  it("applies comp median to stale cached result without _original_rentalizer", () => {
    const comps = [
      mockComp({ id: "1", bedrooms: 2, bathrooms: 1, annual_revenue: 25000, adr: 150 }),
      mockComp({ id: "2", bedrooms: 2, bathrooms: 1, annual_revenue: 30000, adr: 170 }),
      mockComp({ id: "3", bedrooms: 2, bathrooms: 1, annual_revenue: 35000, adr: 190 }),
      mockComp({ id: "4", bedrooms: 2, bathrooms: 1, annual_revenue: 40000, adr: 210 }),
    ];
    const cached = makeStaleCachedReport(20000, comps);
    const result = applyCacheCompMedian(cached, 2, 1);
    
    expect(result.adjusted).toBe(true);
    // Median of [25K, 30K, 35K, 40K] = (30K+35K)/2 = 32500
    expect(cached.property.estimates.annual_revenue).toBe(32500);
    expect(cached.property._original_rentalizer.annual_revenue).toBe(20000);
    // Q1 of [25K, 30K, 35K, 40K]: ceil(0.25*4)-1 = 0 → 25000
    // Q3 of [25K, 30K, 35K, 40K]: ceil(0.75*4)-1 = 2 → 35000
    expect(cached.property.estimates.annual_revenue_low).toBe(25000);
    expect(cached.property.estimates.annual_revenue_high).toBe(35000);
  });

  it("does NOT re-apply comp median if _original_rentalizer already exists", () => {
    const comps = [
      mockComp({ id: "1", bedrooms: 2, bathrooms: 1, annual_revenue: 30000, adr: 170 }),
      mockComp({ id: "2", bedrooms: 2, bathrooms: 1, annual_revenue: 35000, adr: 190 }),
      mockComp({ id: "3", bedrooms: 2, bathrooms: 1, annual_revenue: 40000, adr: 210 }),
    ];
    const cached = makeStaleCachedReport(20000, comps);
    // Simulate already-adjusted
    (cached.property as any)._original_rentalizer = { annual_revenue: 15000 };
    cached.property.estimates.annual_revenue = 35000;
    
    const result = applyCacheCompMedian(cached, 2, 1);
    expect(result.adjusted).toBe(false);
    expect(cached.property.estimates.annual_revenue).toBe(35000); // unchanged
  });

  it("can adjust downward when comp median is lower than cached Rentalizer", () => {
    const comps = [
      mockComp({ id: "1", bedrooms: 2, bathrooms: 1, annual_revenue: 10000, adr: 80 }),
      mockComp({ id: "2", bedrooms: 2, bathrooms: 1, annual_revenue: 12000, adr: 90 }),
      mockComp({ id: "3", bedrooms: 2, bathrooms: 1, annual_revenue: 15000, adr: 100 }),
      mockComp({ id: "4", bedrooms: 2, bathrooms: 1, annual_revenue: 18000, adr: 110 }),
    ];
    const cached = makeStaleCachedReport(20000, comps);
    const result = applyCacheCompMedian(cached, 2, 1);
    
    expect(result.adjusted).toBe(true);
    // Median of [10K, 12K, 15K, 18K] = (12K+15K)/2 = 13500
    expect(cached.property.estimates.annual_revenue).toBe(13500);
    expect(cached.property.estimates.annual_revenue).toBeLessThan(20000);
  });

  it("scales monthly forecast proportionally on cache comp-median", () => {
    const comps = [
      mockComp({ id: "1", bedrooms: 2, bathrooms: 1, annual_revenue: 25000, adr: 150 }),
      mockComp({ id: "2", bedrooms: 2, bathrooms: 1, annual_revenue: 30000, adr: 170 }),
      mockComp({ id: "3", bedrooms: 2, bathrooms: 1, annual_revenue: 35000, adr: 190 }),
      mockComp({ id: "4", bedrooms: 2, bathrooms: 1, annual_revenue: 40000, adr: 210 }),
    ];
    const cached = makeStaleCachedReport(20000, comps);
    const originalMonth1Rev = cached.property.monthly_forecast[0].revenue;
    
    applyCacheCompMedian(cached, 2, 1);
    
    // Median = 32500, scale = 32500/20000 = 1.625
    const scale = 32500 / 20000;
    expect(cached.property.monthly_forecast[0].revenue).toBe(Math.round(originalMonth1Rev * scale));
  });

  it("Phoenix scenario: cache comp-median adjusts $20,889 to comp median", () => {
    // Real Phoenix data: 19 exact 2BR/1BA comps
    const phoenixComps = [
      mockComp({ id: "1", bedrooms: 2, bathrooms: 1, annual_revenue: 18500, adr: 120 }),
      mockComp({ id: "2", bedrooms: 2, bathrooms: 1, annual_revenue: 21000, adr: 135 }),
      mockComp({ id: "3", bedrooms: 2, bathrooms: 1, annual_revenue: 23000, adr: 140 }),
      mockComp({ id: "4", bedrooms: 2, bathrooms: 1, annual_revenue: 25000, adr: 150 }),
      mockComp({ id: "5", bedrooms: 2, bathrooms: 1, annual_revenue: 26500, adr: 155 }),
      mockComp({ id: "6", bedrooms: 2, bathrooms: 1, annual_revenue: 27000, adr: 160 }),
      mockComp({ id: "7", bedrooms: 2, bathrooms: 1, annual_revenue: 28000, adr: 165 }),
      mockComp({ id: "8", bedrooms: 2, bathrooms: 1, annual_revenue: 29000, adr: 170 }),
      mockComp({ id: "9", bedrooms: 2, bathrooms: 1, annual_revenue: 30000, adr: 175 }),
      mockComp({ id: "10", bedrooms: 2, bathrooms: 1, annual_revenue: 30500, adr: 178 }),
      mockComp({ id: "11", bedrooms: 2, bathrooms: 1, annual_revenue: 31000, adr: 180 }),
      mockComp({ id: "12", bedrooms: 2, bathrooms: 1, annual_revenue: 31500, adr: 182 }),
      mockComp({ id: "13", bedrooms: 2, bathrooms: 1, annual_revenue: 32000, adr: 185 }),
      mockComp({ id: "14", bedrooms: 2, bathrooms: 1, annual_revenue: 32174, adr: 186 }),
      mockComp({ id: "15", bedrooms: 2, bathrooms: 1, annual_revenue: 33000, adr: 190 }),
      mockComp({ id: "16", bedrooms: 2, bathrooms: 1, annual_revenue: 35000, adr: 200 }),
      mockComp({ id: "17", bedrooms: 2, bathrooms: 1, annual_revenue: 37000, adr: 210 }),
      mockComp({ id: "18", bedrooms: 2, bathrooms: 1, annual_revenue: 39000, adr: 220 }),
      mockComp({ id: "19", bedrooms: 2, bathrooms: 1, annual_revenue: 42000, adr: 240 }),
    ];
    const cached = makeStaleCachedReport(20889, phoenixComps);
    const result = applyCacheCompMedian(cached, 2, 1);
    
    expect(result.adjusted).toBe(true);
    // Median of 19 comps (odd): sorted[9] = 30500
    expect(cached.property.estimates.annual_revenue).toBe(30500);
    expect(cached.property.estimates.annual_revenue).toBeGreaterThan(20889);
    expect(cached.property._original_rentalizer.annual_revenue).toBe(20889);
  });
});

describe("P75 Fallback (when <3 exact-match comps)", () => {
  // Simulates the P75 fallback logic: when fewer than 3 exact-match comps,
  // use P75 of ALL same-bedroom comps with a 1.5x Rentalizer cap
  function applyP75Fallback(
    estimates: MockEstimate,
    forecast: MockForecast[],
    sameBedroomComps: Array<{ annual_revenue: number; adr: number; occupancy: number }>
  ) {
    const result = {
      adjusted: false,
      method: 'none' as 'none' | 'p75_fallback',
      estimates: { ...estimates },
      monthly_forecast: forecast.map(m => ({ ...m })),
      _original_rentalizer: null as MockEstimate | null,
    };

    const p75Comps = sameBedroomComps.filter(c => c.annual_revenue > 0);

    if (p75Comps.length < 3) {
      return result; // Not enough comps for any adjustment
    }

    const sortedRevenues = p75Comps.map(c => c.annual_revenue).sort((a, b) => a - b);
    const sortedAdrs = p75Comps.map(c => c.adr).sort((a, b) => a - b);
    const sortedOccs = p75Comps.map(c => c.occupancy).sort((a, b) => a - b);

    const p75Revenue = getPercentile(sortedRevenues, 75);
    const p75Adr = getPercentile(sortedAdrs, 75);
    const p75Occ = getPercentile(sortedOccs, 75);
    const medianRevenue = getPercentile(sortedRevenues, 50);
    const rentalizerRevenue = estimates.annual_revenue;

    // Cap at 1.5x Rentalizer
    const cap = Math.floor(rentalizerRevenue * 1.5);
    const targetRevenue = Math.min(p75Revenue, cap);

    // Only adjust upward
    if (targetRevenue > rentalizerRevenue) {
      const scaleFactor = targetRevenue / rentalizerRevenue;

      result.adjusted = true;
      result.method = 'p75_fallback';
      result._original_rentalizer = { ...estimates };
      result.estimates.annual_revenue = targetRevenue;
      result.estimates.average_daily_rate = p75Adr;
      result.estimates.occupancy_rate = p75Occ > 1 ? p75Occ / 100 : p75Occ;
      result.estimates.annual_revenue_low = medianRevenue;
      result.estimates.annual_revenue_high = p75Revenue;

      result.monthly_forecast = forecast.map(m => ({
        ...m,
        revenue: Math.round(m.revenue * scaleFactor),
        adr: Math.round(m.adr * scaleFactor),
      }));
    }

    return result;
  }

  const baseEstimates: MockEstimate = {
    annual_revenue: 20889,
    annual_revenue_low: 19000,
    annual_revenue_high: 22000,
    average_daily_rate: 75,
    occupancy_rate: 0.73,
  };

  const baseForecast: MockForecast[] = [
    { month: "2025-01", revenue: 1500, adr: 95, occupancy: 0.75 },
    { month: "2025-02", revenue: 1800, adr: 100, occupancy: 0.80 },
    { month: "2025-03", revenue: 2200, adr: 110, occupancy: 0.85 },
  ];

  it("applies P75 with 1.5x cap when <3 exact-match but 3+ same-bedroom comps", () => {
    // These are same-bedroom comps (different BA counts, so they wouldn't be exact-match)
    const sameBedroomComps = [
      { annual_revenue: 25000, adr: 130, occupancy: 0.72 },
      { annual_revenue: 30000, adr: 150, occupancy: 0.78 },
      { annual_revenue: 35000, adr: 170, occupancy: 0.82 },
      { annual_revenue: 40000, adr: 190, occupancy: 0.88 },
      { annual_revenue: 50000, adr: 220, occupancy: 0.92 },
    ];

    const result = applyP75Fallback(baseEstimates, baseForecast, sameBedroomComps);

    expect(result.adjusted).toBe(true);
    expect(result.method).toBe('p75_fallback');
    // P75 of [25K, 30K, 35K, 40K, 50K] = 40000
    // Cap = floor(20889 * 1.5) = 31333
    // Target = min(40000, 31333) = 31333
    expect(result.estimates.annual_revenue).toBe(31333);
    expect(result._original_rentalizer?.annual_revenue).toBe(20889);
  });

  it("uses P75 directly when it's below the 1.5x cap", () => {
    const sameBedroomComps = [
      { annual_revenue: 20000, adr: 110, occupancy: 0.70 },
      { annual_revenue: 22000, adr: 120, occupancy: 0.73 },
      { annual_revenue: 24000, adr: 130, occupancy: 0.76 },
      { annual_revenue: 26000, adr: 140, occupancy: 0.80 },
    ];

    const result = applyP75Fallback(baseEstimates, baseForecast, sameBedroomComps);

    expect(result.adjusted).toBe(true);
    // P75 of [20K, 22K, 24K, 26K] = 24000
    // Cap = floor(20889 * 1.5) = 31333
    // Target = min(24000, 31333) = 24000 (P75 is below cap)
    expect(result.estimates.annual_revenue).toBe(24000);
  });

  it("does NOT adjust when P75 is below Rentalizer", () => {
    const sameBedroomComps = [
      { annual_revenue: 10000, adr: 60, occupancy: 0.50 },
      { annual_revenue: 12000, adr: 70, occupancy: 0.55 },
      { annual_revenue: 15000, adr: 80, occupancy: 0.60 },
      { annual_revenue: 18000, adr: 90, occupancy: 0.65 },
    ];

    const result = applyP75Fallback(baseEstimates, baseForecast, sameBedroomComps);

    // P75 of [10K, 12K, 15K, 18K] = 15000
    // Cap = floor(20889 * 1.5) = 31333
    // Target = min(15000, 31333) = 15000 — below Rentalizer $20889
    expect(result.adjusted).toBe(false);
    expect(result.estimates.annual_revenue).toBe(20889);
  });

  it("does NOT adjust when fewer than 3 same-bedroom comps", () => {
    const sameBedroomComps = [
      { annual_revenue: 30000, adr: 150, occupancy: 0.78 },
      { annual_revenue: 40000, adr: 190, occupancy: 0.85 },
    ];

    const result = applyP75Fallback(baseEstimates, baseForecast, sameBedroomComps);

    expect(result.adjusted).toBe(false);
    expect(result.estimates.annual_revenue).toBe(20889);
  });

  it("sets revenue range: low = median, high = P75", () => {
    const sameBedroomComps = [
      { annual_revenue: 25000, adr: 130, occupancy: 0.72 },
      { annual_revenue: 30000, adr: 150, occupancy: 0.78 },
      { annual_revenue: 35000, adr: 170, occupancy: 0.82 },
      { annual_revenue: 40000, adr: 190, occupancy: 0.88 },
      { annual_revenue: 50000, adr: 220, occupancy: 0.92 },
    ];

    const result = applyP75Fallback(baseEstimates, baseForecast, sameBedroomComps);

    expect(result.adjusted).toBe(true);
    // Median (P50) of [25K, 30K, 35K, 40K, 50K] = 35000
    expect(result.estimates.annual_revenue_low).toBe(35000);
    // P75 of [25K, 30K, 35K, 40K, 50K] = 40000
    expect(result.estimates.annual_revenue_high).toBe(40000);
  });

  it("scales monthly forecast proportionally", () => {
    const sameBedroomComps = [
      { annual_revenue: 25000, adr: 130, occupancy: 0.72 },
      { annual_revenue: 30000, adr: 150, occupancy: 0.78 },
      { annual_revenue: 35000, adr: 170, occupancy: 0.82 },
      { annual_revenue: 40000, adr: 190, occupancy: 0.88 },
      { annual_revenue: 50000, adr: 220, occupancy: 0.92 },
    ];

    const result = applyP75Fallback(baseEstimates, baseForecast, sameBedroomComps);

    expect(result.adjusted).toBe(true);
    // Target = 31333, scale = 31333 / 20889 ≈ 1.5
    const scaleFactor = 31333 / 20889;
    expect(result.monthly_forecast[0].revenue).toBe(Math.round(1500 * scaleFactor));
    expect(result.monthly_forecast[2].revenue).toBe(Math.round(2200 * scaleFactor));
    // Occupancy unchanged
    expect(result.monthly_forecast[0].occupancy).toBe(0.75);
  });

  it("normalizes P75 occupancy from percentage to decimal", () => {
    const sameBedroomComps = [
      { annual_revenue: 25000, adr: 130, occupancy: 72 }, // percentage format
      { annual_revenue: 30000, adr: 150, occupancy: 78 },
      { annual_revenue: 35000, adr: 170, occupancy: 82 },
      { annual_revenue: 40000, adr: 190, occupancy: 88 },
    ];

    const result = applyP75Fallback(baseEstimates, baseForecast, sameBedroomComps);

    expect(result.adjusted).toBe(true);
    // P75 of [72, 78, 82, 88]: idx = ceil(0.75*4)-1 = 2, so P75 = 82, normalized to 0.82
    expect(result.estimates.occupancy_rate).toBe(0.82);
    expect(result.estimates.occupancy_rate).toBeLessThanOrEqual(1);
  });

  it("1.5x cap prevents extreme uplift", () => {
    const sameBedroomComps = [
      { annual_revenue: 50000, adr: 200, occupancy: 0.85 },
      { annual_revenue: 60000, adr: 250, occupancy: 0.88 },
      { annual_revenue: 70000, adr: 300, occupancy: 0.90 },
      { annual_revenue: 80000, adr: 350, occupancy: 0.92 },
      { annual_revenue: 100000, adr: 400, occupancy: 0.95 },
    ];

    const result = applyP75Fallback(baseEstimates, baseForecast, sameBedroomComps);

    expect(result.adjusted).toBe(true);
    // P75 of [50K, 60K, 70K, 80K, 100K] = 80000
    // Cap = floor(20889 * 1.5) = 31333
    // Target = min(80000, 31333) = 31333 (capped!)
    expect(result.estimates.annual_revenue).toBe(31333);
    // Uplift should be exactly 50% (1.5x cap)
    const uplift = (result.estimates.annual_revenue - 20889) / 20889;
    expect(uplift).toBeCloseTo(0.5, 1);
  });
});

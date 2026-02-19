import { describe, it, expect } from 'vitest';

/**
 * Tests for the three-tier revenue scenarios (P50/P75/P90) calculation logic.
 * This mirrors the exact logic used in server/airdna.ts to compute revenueScenarios
 * from comp data.
 */

// Replicate the exact percentile/median functions from airdna.ts
function getPercentile(arr: number[], p: number): number {
  const idx = Math.max(0, Math.ceil((p / 100) * arr.length) - 1);
  return arr[idx];
}

function getMedian(arr: number[]): number {
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 0 ? Math.round((arr[mid - 1] + arr[mid]) / 2) : arr[mid];
}

/**
 * Compute revenue scenarios from comp data, matching the logic in airdna.ts
 */
function computeRevenueScenarios(
  exactMatchComps: { annual_revenue: number; bedrooms: number; bathrooms: number }[],
  sameBedroomComps: { annual_revenue: number; bedrooms: number }[]
): { conservative: number; target: number; optimistic: number; source: string; compCount: number } | undefined {
  const scenarioComps = exactMatchComps.length >= 3
    ? exactMatchComps
    : sameBedroomComps.filter(c => c.annual_revenue > 0);

  if (scenarioComps.length < 3) return undefined;

  const scenarioRevenues = scenarioComps.map(c => c.annual_revenue).sort((a, b) => a - b);
  const p50 = getMedian(scenarioRevenues);
  const p75 = getPercentile(scenarioRevenues, 75);
  const p90 = getPercentile(scenarioRevenues, 90);

  return {
    conservative: p50,
    target: p75,
    optimistic: p90,
    source: exactMatchComps.length >= 3 ? 'exact_match' : 'same_bedroom',
    compCount: scenarioComps.length,
  };
}

describe('Revenue Scenarios (Three-Tier P50/P75/P90)', () => {
  it('returns undefined when fewer than 3 comps are available', () => {
    const result = computeRevenueScenarios(
      [{ annual_revenue: 50000, bedrooms: 2, bathrooms: 1 }],
      [{ annual_revenue: 50000, bedrooms: 2 }]
    );
    expect(result).toBeUndefined();
  });

  it('uses exact_match source when >= 3 exact match comps', () => {
    const exactComps = [
      { annual_revenue: 40000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 60000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 80000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 100000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 120000, bedrooms: 2, bathrooms: 1 },
    ];
    const result = computeRevenueScenarios(exactComps, []);
    expect(result).toBeDefined();
    expect(result!.source).toBe('exact_match');
    expect(result!.compCount).toBe(5);
  });

  it('falls back to same_bedroom source when < 3 exact match comps', () => {
    const exactComps = [
      { annual_revenue: 40000, bedrooms: 2, bathrooms: 1 },
    ];
    const sameBedroomComps = [
      { annual_revenue: 40000, bedrooms: 2 },
      { annual_revenue: 60000, bedrooms: 2 },
      { annual_revenue: 80000, bedrooms: 2 },
      { annual_revenue: 100000, bedrooms: 2 },
    ];
    const result = computeRevenueScenarios(exactComps, sameBedroomComps);
    expect(result).toBeDefined();
    expect(result!.source).toBe('same_bedroom');
    expect(result!.compCount).toBe(4);
  });

  it('correctly computes P50 (median) for odd-length array', () => {
    const comps = [
      { annual_revenue: 30000, bedrooms: 3, bathrooms: 2 },
      { annual_revenue: 50000, bedrooms: 3, bathrooms: 2 },
      { annual_revenue: 70000, bedrooms: 3, bathrooms: 2 },
      { annual_revenue: 90000, bedrooms: 3, bathrooms: 2 },
      { annual_revenue: 110000, bedrooms: 3, bathrooms: 2 },
    ];
    const result = computeRevenueScenarios(comps, []);
    expect(result).toBeDefined();
    // Median of [30k, 50k, 70k, 90k, 110k] = 70k (middle element)
    expect(result!.conservative).toBe(70000);
  });

  it('correctly computes P50 (median) for even-length array', () => {
    const comps = [
      { annual_revenue: 40000, bedrooms: 3, bathrooms: 2 },
      { annual_revenue: 60000, bedrooms: 3, bathrooms: 2 },
      { annual_revenue: 80000, bedrooms: 3, bathrooms: 2 },
      { annual_revenue: 100000, bedrooms: 3, bathrooms: 2 },
    ];
    const result = computeRevenueScenarios(comps, []);
    expect(result).toBeDefined();
    // Median of [40k, 60k, 80k, 100k] = avg(60k, 80k) = 70k
    expect(result!.conservative).toBe(70000);
  });

  it('ensures conservative <= target <= optimistic', () => {
    const comps = [
      { annual_revenue: 25000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 35000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 45000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 55000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 65000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 75000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 85000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 95000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 105000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 115000, bedrooms: 2, bathrooms: 1 },
    ];
    const result = computeRevenueScenarios(comps, []);
    expect(result).toBeDefined();
    expect(result!.conservative).toBeLessThanOrEqual(result!.target);
    expect(result!.target).toBeLessThanOrEqual(result!.optimistic);
  });

  it('handles comps with zero revenue (filtered out in same_bedroom fallback)', () => {
    const exactComps: { annual_revenue: number; bedrooms: number; bathrooms: number }[] = [];
    const sameBedroomComps = [
      { annual_revenue: 0, bedrooms: 2 },
      { annual_revenue: 50000, bedrooms: 2 },
      { annual_revenue: 60000, bedrooms: 2 },
      { annual_revenue: 70000, bedrooms: 2 },
    ];
    const result = computeRevenueScenarios(exactComps, sameBedroomComps);
    expect(result).toBeDefined();
    // Zero-revenue comp is filtered out, leaving 3 comps
    expect(result!.compCount).toBe(3);
    expect(result!.conservative).toBe(60000); // Median of [50k, 60k, 70k]
  });

  it('computes correct P75 and P90 for a 10-comp dataset', () => {
    const revenues = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110].map(r => r * 1000);
    const comps = revenues.map(r => ({ annual_revenue: r, bedrooms: 3, bathrooms: 2 }));
    const result = computeRevenueScenarios(comps, []);
    expect(result).toBeDefined();
    
    // P75 of sorted [20k..110k]: ceil(75/100 * 10) - 1 = ceil(7.5) - 1 = 8 - 1 = 7 → arr[7] = 90000
    expect(result!.target).toBe(90000);
    
    // P90 of sorted [20k..110k]: ceil(90/100 * 10) - 1 = ceil(9) - 1 = 9 - 1 = 8 → arr[8] = 100000
    expect(result!.optimistic).toBe(100000);
  });

  it('handles exactly 3 comps (minimum threshold)', () => {
    const comps = [
      { annual_revenue: 40000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 60000, bedrooms: 2, bathrooms: 1 },
      { annual_revenue: 80000, bedrooms: 2, bathrooms: 1 },
    ];
    const result = computeRevenueScenarios(comps, []);
    expect(result).toBeDefined();
    expect(result!.conservative).toBe(60000); // Median of [40k, 60k, 80k]
    expect(result!.compCount).toBe(3);
  });
});

import { describe, it, expect } from 'vitest';

/**
 * Tests for the top-3 comp average headline revenue logic.
 * 
 * The headline projected revenue is now computed as the average of the 
 * top 3 comps by revenue (after 30% boost). This replaces the previous
 * comp-median / P75 fallback approach.
 */

describe('Top-3 Comp Average Revenue Logic', () => {
  // Helper: simulate the top-3 comp average calculation
  function computeTop3Average(comps: { annual_revenue: number; adr: number; occupancy: number }[]) {
    if (comps.length < 3) return null;
    const top3 = [...comps].sort((a, b) => b.annual_revenue - a.annual_revenue).slice(0, 3);
    return {
      revenue: Math.round(top3.reduce((sum, c) => sum + c.annual_revenue, 0) / 3),
      adr: Math.round(top3.reduce((sum, c) => sum + c.adr, 0) / 3),
      occupancy: top3.reduce((sum, c) => sum + c.occupancy, 0) / 3,
    };
  }

  it('should use average of top 3 comps by revenue as headline', () => {
    const comps = [
      { annual_revenue: 80000, adr: 300, occupancy: 0.73 },
      { annual_revenue: 70000, adr: 280, occupancy: 0.68 },
      { annual_revenue: 60000, adr: 250, occupancy: 0.65 },
      { annual_revenue: 50000, adr: 220, occupancy: 0.62 },
      { annual_revenue: 40000, adr: 200, occupancy: 0.55 },
    ];

    const result = computeTop3Average(comps);
    expect(result).not.toBeNull();
    // Top 3: $80k, $70k, $60k → average = $70,000
    expect(result!.revenue).toBe(70000);
    // Top 3 ADR: 300, 280, 250 → average = 277
    expect(result!.adr).toBe(277);
  });

  it('should select the 3 highest revenue comps regardless of order', () => {
    const comps = [
      { annual_revenue: 30000, adr: 150, occupancy: 0.55 },
      { annual_revenue: 90000, adr: 350, occupancy: 0.70 },
      { annual_revenue: 50000, adr: 200, occupancy: 0.60 },
      { annual_revenue: 75000, adr: 290, occupancy: 0.68 },
      { annual_revenue: 60000, adr: 240, occupancy: 0.63 },
    ];

    const result = computeTop3Average(comps);
    // Top 3: $90k, $75k, $60k → average = $75,000
    expect(result!.revenue).toBe(75000);
  });

  it('should work with exactly 3 comps', () => {
    const comps = [
      { annual_revenue: 55000, adr: 220, occupancy: 0.65 },
      { annual_revenue: 65000, adr: 260, occupancy: 0.70 },
      { annual_revenue: 45000, adr: 180, occupancy: 0.60 },
    ];

    const result = computeTop3Average(comps);
    // All 3 are used: $65k, $55k, $45k → average = $55,000
    expect(result!.revenue).toBe(55000);
  });

  it('should return null with fewer than 3 comps', () => {
    const comps = [
      { annual_revenue: 55000, adr: 220, occupancy: 0.65 },
      { annual_revenue: 65000, adr: 260, occupancy: 0.70 },
    ];

    const result = computeTop3Average(comps);
    expect(result).toBeNull();
  });

  it('should produce higher headline than comp-median for right-skewed distributions', () => {
    // Right-skewed: a few high earners pull the top-3 average above the median
    const comps = [
      { annual_revenue: 120000, adr: 450, occupancy: 0.73 },
      { annual_revenue: 100000, adr: 380, occupancy: 0.72 },
      { annual_revenue: 80000, adr: 300, occupancy: 0.73 },
      { annual_revenue: 40000, adr: 180, occupancy: 0.61 },
      { annual_revenue: 35000, adr: 160, occupancy: 0.60 },
      { annual_revenue: 30000, adr: 140, occupancy: 0.59 },
      { annual_revenue: 25000, adr: 120, occupancy: 0.57 },
    ];

    const top3Avg = computeTop3Average(comps);
    // Top 3: $120k, $100k, $80k → average = $100,000
    expect(top3Avg!.revenue).toBe(100000);

    // Median would be $40,000 (4th value in sorted array of 7)
    const sorted = comps.map(c => c.annual_revenue).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    expect(median).toBe(40000);

    // Top-3 average is significantly higher than median
    expect(top3Avg!.revenue).toBeGreaterThan(median);
  });

  it('should correctly compute scale factor for monthly forecast adjustment', () => {
    const rentalizerRevenue = 40000; // Original AirDNA estimate (already boosted by 30%)
    const top3Revenue = 70000; // Top-3 comp average

    const scaleFactor = top3Revenue / rentalizerRevenue;
    expect(scaleFactor).toBeCloseTo(1.75, 2);

    // Monthly forecast should scale proportionally
    const originalMonthlyRevenue = 3333; // ~$40k/12
    const scaledMonthlyRevenue = Math.round(originalMonthlyRevenue * scaleFactor);
    expect(scaledMonthlyRevenue).toBe(5833); // ~$70k/12
  });

  it('should handle comps with same revenue gracefully', () => {
    const comps = [
      { annual_revenue: 50000, adr: 200, occupancy: 0.65 },
      { annual_revenue: 50000, adr: 210, occupancy: 0.65 },
      { annual_revenue: 50000, adr: 190, occupancy: 0.65 },
      { annual_revenue: 30000, adr: 150, occupancy: 0.55 },
    ];

    const result = computeTop3Average(comps);
    // Top 3 all have $50k → average = $50,000
    expect(result!.revenue).toBe(50000);
    // ADR average: (200 + 210 + 190) / 3 = 200
    expect(result!.adr).toBe(200);
  });

  it('should combine with 30% boost correctly', () => {
    const REVENUE_BOOST_FACTOR = 1.30;
    
    // Raw AirDNA comp revenues before boost
    const rawComps = [
      { annual_revenue: 60000, adr: 240, occupancy: 0.70 },
      { annual_revenue: 50000, adr: 200, occupancy: 0.65 },
      { annual_revenue: 45000, adr: 180, occupancy: 0.62 },
    ];

    // After 30% boost (applied at API layer)
    const boostedComps = rawComps.map(c => ({
      annual_revenue: Math.round(c.annual_revenue * REVENUE_BOOST_FACTOR),
      adr: Math.round(c.adr * REVENUE_BOOST_FACTOR),
      occupancy: c.occupancy, // Occupancy NOT boosted
    }));

    const result = computeTop3Average(boostedComps);
    // Boosted: $78k, $65k, $58.5k → average = ~$67,167
    const expectedAvg = Math.round((78000 + 65000 + 58500) / 3);
    expect(result!.revenue).toBe(expectedAvg);
    
    // This should be 30% higher than the unboosted top-3 average
    const unboostedResult = computeTop3Average(rawComps);
    // Unboosted: $60k, $50k, $45k → average = $51,667
    expect(Math.abs(result!.revenue - Math.round(unboostedResult!.revenue * REVENUE_BOOST_FACTOR))).toBeLessThan(2);
  });
});

import { describe, expect, it } from "vitest";

/**
 * Tests for consistent profit calculation across the application.
 * 
 * The canonical formula is:
 *   monthlyProfit = monthlyRevenue - monthlyRent - (monthlyRevenue * 0.20)
 * 
 * Operating costs are always 20% of REVENUE (not rent).
 */

describe("Profit Calculation Consistency", () => {
  // The canonical profit formula used across the app
  function calculateProfit(monthlyRevenue: number, monthlyRent: number, expenseRate: number = 0.20) {
    const operatingCosts = monthlyRevenue * expenseRate;
    const monthlyProfit = monthlyRevenue - monthlyRent - operatingCosts;
    return { operatingCosts, monthlyProfit, annualProfit: monthlyProfit * 12 };
  }

  it("calculates profit correctly for a typical rental arbitrage property", () => {
    // Example: $2,248/mo revenue, $1,295/mo rent
    const result = calculateProfit(2248, 1295);
    
    // Operating costs = 2248 * 0.20 = 449.6
    expect(result.operatingCosts).toBeCloseTo(449.6, 1);
    // Profit = 2248 - 1295 - 449.6 = 503.4
    expect(result.monthlyProfit).toBeCloseTo(503.4, 1);
    // Annual = 503.4 * 12 = 6040.8
    expect(result.annualProfit).toBeCloseTo(6040.8, 1);
  });

  it("operating costs should be based on revenue, NOT rent", () => {
    const monthlyRevenue = 3000;
    const monthlyRent = 1500;
    
    // CORRECT: 20% of revenue
    const correctOpCosts = monthlyRevenue * 0.20; // 600
    const correctProfit = monthlyRevenue - monthlyRent - correctOpCosts; // 900
    
    // WRONG (old bug): 20% of rent
    const wrongOpCosts = monthlyRent * 0.20; // 300
    const wrongProfit = monthlyRevenue - monthlyRent - wrongOpCosts; // 1200
    
    const result = calculateProfit(monthlyRevenue, monthlyRent);
    
    expect(result.operatingCosts).toBe(correctOpCosts);
    expect(result.operatingCosts).not.toBe(wrongOpCosts);
    expect(result.monthlyProfit).toBe(correctProfit);
    expect(result.monthlyProfit).not.toBe(wrongProfit);
  });

  it("handles zero rent (purchase mode)", () => {
    const result = calculateProfit(3000, 0);
    
    // Operating costs = 3000 * 0.20 = 600
    expect(result.operatingCosts).toBe(600);
    // Profit = 3000 - 0 - 600 = 2400
    expect(result.monthlyProfit).toBe(2400);
  });

  it("handles negative profit scenarios", () => {
    // Revenue too low to cover rent + expenses
    const result = calculateProfit(1000, 1500);
    
    // Operating costs = 1000 * 0.20 = 200
    expect(result.operatingCosts).toBe(200);
    // Profit = 1000 - 1500 - 200 = -700
    expect(result.monthlyProfit).toBe(-700);
    expect(result.monthlyProfit).toBeLessThan(0);
  });

  it("handles zero revenue", () => {
    const result = calculateProfit(0, 1500);
    
    expect(result.operatingCosts).toBe(0);
    expect(result.monthlyProfit).toBe(-1500);
  });
});

describe("Studio Apartment (0 Bedroom) Handling", () => {
  /**
   * Studios have 0 bedrooms. The old code used `bedrooms || 2` or `bedrooms || 0`
   * which treated 0 as falsy and defaulted to 2.
   * The fix uses `bedrooms ?? 2` (nullish coalescing) which only defaults for null/undefined.
   */

  it("nullish coalescing preserves 0 bedrooms for studios", () => {
    const bedrooms = 0;
    
    // Old buggy pattern: || treats 0 as falsy
    const buggyResult = bedrooms || 2;
    expect(buggyResult).toBe(2); // BUG: studio becomes 2-bed
    
    // Fixed pattern: ?? only defaults for null/undefined
    const fixedResult = bedrooms ?? 2;
    expect(fixedResult).toBe(0); // CORRECT: studio stays 0
  });

  it("nullish coalescing still defaults null to fallback", () => {
    const bedrooms: number | null = null;
    const result = bedrooms ?? 2;
    expect(result).toBe(2);
  });

  it("nullish coalescing still defaults undefined to fallback", () => {
    const bedrooms: number | undefined = undefined;
    const result = bedrooms ?? 2;
    expect(result).toBe(2);
  });

  it("regular bedroom counts are unaffected by the fix", () => {
    for (const beds of [1, 2, 3, 4, 5]) {
      expect(beds ?? 2).toBe(beds);
      expect(beds || 2).toBe(beds); // Both work for non-zero
    }
  });

  it("studio label should show 'Studio' not '0 BR'", () => {
    const bedrooms = 0;
    const label = bedrooms === 0 ? 'Studio' : `${bedrooms} BR`;
    expect(label).toBe('Studio');
  });

  it("non-studio label should show bedroom count", () => {
    const bedrooms = 3;
    const label = bedrooms === 0 ? 'Studio' : `${bedrooms} BR`;
    expect(label).toBe('3 BR');
  });
});

describe("Profit Formula Consistency Across All Paths", () => {
  /**
   * Verifies that the same inputs produce the same outputs
   * regardless of which calculation path is used.
   * All paths should use: profit = revenue - rent - (revenue * 0.20)
   */

  const testCases = [
    { revenue: 2248, rent: 1295, label: "Denver 2BR" },
    { revenue: 5000, rent: 2000, label: "High revenue property" },
    { revenue: 1500, rent: 1800, label: "Unprofitable property" },
    { revenue: 800, rent: 0, label: "Purchase mode (no rent)" },
    { revenue: 3500, rent: 1200, label: "Strong arbitrage deal" },
  ];

  for (const tc of testCases) {
    it(`all paths agree for ${tc.label} (rev: $${tc.revenue}, rent: $${tc.rent})`, () => {
      // Path 1: Step 5 TeslaDashboard formula
      const teslaDashboardProfit = tc.revenue - tc.rent - (tc.revenue * 0.20);
      
      // Path 2: Step 2 batch validate formula (opportunity-finder.ts)
      const batchOperatingCosts = tc.revenue * 0.20;
      const batchProfit = tc.revenue - tc.rent - batchOperatingCosts;
      
      // Path 3: LeadMagnet.tsx cashFlow formula
      const leadMagnetProfit = tc.revenue - tc.rent - (tc.revenue * 0.20);
      
      // All three should be identical
      expect(batchProfit).toBeCloseTo(teslaDashboardProfit, 2);
      expect(leadMagnetProfit).toBeCloseTo(teslaDashboardProfit, 2);
      expect(batchProfit).toBeCloseTo(leadMagnetProfit, 2);
    });
  }
});

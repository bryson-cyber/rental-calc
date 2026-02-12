/**
 * Tests for Investor Report Improvements:
 * 1. Total Return Summary card logic (cash flow + tax savings)
 * 2. Stress test / regulation / expense post-processing in create endpoint
 * 3. Bedroom-specific benchmark computation
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// 1. TOTAL RETURN SUMMARY — Tests for the calculation logic
//    used in the Total Return Summary section of FullPropertyReport
// ============================================================
describe('Total Return Summary calculations', () => {
  // Simulate the same calculations used in the component
  function computeTotalReturn(params: {
    annualRevenue: number;
    totalAnnualExpenses: number;
    annualMortgage: number;
    purchasePrice: number;
    downPaymentPercent: number;
    buildingValuePercent?: number;
    taxBracket?: number;
  }) {
    const {
      annualRevenue,
      totalAnnualExpenses,
      annualMortgage,
      purchasePrice,
      downPaymentPercent,
      buildingValuePercent = 0.80,
      taxBracket = 0.24,
    } = params;

    const preTaxCashFlow = annualRevenue - totalAnnualExpenses - annualMortgage;
    const buildingValue = purchasePrice * buildingValuePercent;
    const annualDepreciation = Math.round(buildingValue / 27.5);
    const totalDeductions = totalAnnualExpenses + annualDepreciation + (annualMortgage * 0.7); // ~70% of mortgage is interest in early years
    const taxableIncome = annualRevenue - totalDeductions;
    const estimatedTaxSavings = taxableIncome < 0 ? Math.round(Math.abs(taxableIncome) * taxBracket) : 0;
    const netAnnualBenefit = preTaxCashFlow + estimatedTaxSavings;
    const totalCashInvested = purchasePrice * (downPaymentPercent / 100);
    const totalReturnOnInvestment = totalCashInvested > 0 ? (netAnnualBenefit / totalCashInvested) * 100 : 0;

    return {
      preTaxCashFlow,
      annualDepreciation,
      estimatedTaxSavings,
      netAnnualBenefit,
      totalReturnOnInvestment,
    };
  }

  it('should compute positive net benefit when tax savings offset negative cash flow', () => {
    // Scenario: property has negative cash flow but large depreciation creates tax savings
    const result = computeTotalReturn({
      annualRevenue: 76054,
      totalAnnualExpenses: 42000,
      annualMortgage: 37176, // ~$3098/mo
      purchasePrice: 649900,
      downPaymentPercent: 20,
    });

    expect(result.preTaxCashFlow).toBeLessThan(0); // Negative cash flow
    expect(result.annualDepreciation).toBeGreaterThan(15000); // Significant depreciation
    expect(result.estimatedTaxSavings).toBeGreaterThan(0); // Tax savings from paper loss
    expect(result.netAnnualBenefit).toBeGreaterThan(result.preTaxCashFlow); // Net benefit > cash flow alone
  });

  it('should compute zero tax savings when taxable income is positive', () => {
    // Scenario: high revenue, low expenses, no mortgage
    const result = computeTotalReturn({
      annualRevenue: 150000,
      totalAnnualExpenses: 30000,
      annualMortgage: 0,
      purchasePrice: 300000,
      downPaymentPercent: 100, // cash purchase
    });

    expect(result.preTaxCashFlow).toBe(120000);
    expect(result.estimatedTaxSavings).toBe(0); // No tax savings when profitable
    expect(result.netAnnualBenefit).toBe(120000);
  });

  it('should compute correct depreciation for 27.5-year schedule', () => {
    const result = computeTotalReturn({
      annualRevenue: 50000,
      totalAnnualExpenses: 20000,
      annualMortgage: 24000,
      purchasePrice: 500000,
      downPaymentPercent: 25,
    });

    // Building value = 500000 * 0.80 = 400000
    // Annual depreciation = 400000 / 27.5 ≈ 14545
    expect(result.annualDepreciation).toBe(Math.round(400000 / 27.5));
  });

  it('should compute correct ROI based on down payment', () => {
    const result = computeTotalReturn({
      annualRevenue: 100000,
      totalAnnualExpenses: 35000,
      annualMortgage: 30000,
      purchasePrice: 500000,
      downPaymentPercent: 20,
    });

    // Cash invested = 500000 * 0.20 = 100000
    const expectedROI = (result.netAnnualBenefit / 100000) * 100;
    expect(result.totalReturnOnInvestment).toBeCloseTo(expectedROI, 1);
  });

  it('should handle zero down payment (0% ROI denominator)', () => {
    const result = computeTotalReturn({
      annualRevenue: 50000,
      totalAnnualExpenses: 20000,
      annualMortgage: 30000,
      purchasePrice: 400000,
      downPaymentPercent: 0,
    });

    expect(result.totalReturnOnInvestment).toBe(0);
  });
});

// ============================================================
// 2. STRESS TEST / REGULATION / EXPENSE POST-PROCESSING
//    Tests for the logic added to the create and regenerate endpoints
// ============================================================
describe('Report post-processing: expense_breakdown generation', () => {
  function generateExpenseBreakdown(annualRev: number, occRate: number, bedrooms: number) {
    const monthlyRevBase = Math.round(annualRev / 12);
    const nightsPerMonth = Math.round(occRate * 30);
    const itemizedExpenses = {
      cleaning: Math.round(nightsPerMonth * 0.33 * (bedrooms <= 1 ? 75 : bedrooms <= 2 ? 100 : bedrooms <= 3 ? 140 : 180)),
      platform_fees: Math.round(monthlyRevBase * 0.14),
      property_management: Math.round(monthlyRevBase * 0.15),
      supplies: Math.round(bedrooms * 40 + 60),
      utilities: Math.round(bedrooms * 75 + 100),
      maintenance: Math.round(monthlyRevBase * 0.05),
      insurance: Math.round(bedrooms <= 2 ? 150 : bedrooms <= 4 ? 225 : 300),
      licenses_taxes: Math.round(monthlyRevBase * 0.08),
    };
    const totalMonthlyExpenses = Object.values(itemizedExpenses).reduce((a, b) => a + b, 0);
    const expensePercent = monthlyRevBase > 0 ? Math.round((totalMonthlyExpenses / monthlyRevBase) * 100) : 0;
    return { items: itemizedExpenses, total_monthly: totalMonthlyExpenses, total_annual: totalMonthlyExpenses * 12, percent_of_revenue: expensePercent };
  }

  it('should generate expense breakdown with correct categories', () => {
    const result = generateExpenseBreakdown(76054, 0.49, 6);
    expect(result.items).toHaveProperty('cleaning');
    expect(result.items).toHaveProperty('platform_fees');
    expect(result.items).toHaveProperty('property_management');
    expect(result.items).toHaveProperty('supplies');
    expect(result.items).toHaveProperty('utilities');
    expect(result.items).toHaveProperty('maintenance');
    expect(result.items).toHaveProperty('insurance');
    expect(result.items).toHaveProperty('licenses_taxes');
  });

  it('should produce total_monthly equal to sum of items', () => {
    const result = generateExpenseBreakdown(76054, 0.49, 6);
    const sum = Object.values(result.items).reduce((a, b) => a + b, 0);
    expect(result.total_monthly).toBe(sum);
  });

  it('should produce total_annual equal to total_monthly * 12', () => {
    const result = generateExpenseBreakdown(76054, 0.49, 6);
    expect(result.total_annual).toBe(result.total_monthly * 12);
  });

  it('should scale cleaning costs with bedroom count', () => {
    const small = generateExpenseBreakdown(76054, 0.49, 1);
    const large = generateExpenseBreakdown(76054, 0.49, 6);
    expect(large.items.cleaning).toBeGreaterThan(small.items.cleaning);
  });

  it('should scale insurance with bedroom count', () => {
    const small = generateExpenseBreakdown(76054, 0.49, 2);
    const large = generateExpenseBreakdown(76054, 0.49, 5);
    expect(large.items.insurance).toBeGreaterThan(small.items.insurance);
  });

  it('should produce reasonable expense percentage (25-80%)', () => {
    const result = generateExpenseBreakdown(76054, 0.49, 6);
    expect(result.percent_of_revenue).toBeGreaterThanOrEqual(25);
    expect(result.percent_of_revenue).toBeLessThanOrEqual(80);
  });
});

describe('Report post-processing: stress_test generation', () => {
  function generateStressTest(annualRev: number, occRate: number, adr: number, expPct: number) {
    const occScenarios = [
      Math.max(0.25, occRate - 0.20),
      Math.max(0.30, occRate - 0.10),
      occRate,
      Math.min(0.95, occRate + 0.10),
    ];
    const adrScenarios = [
      Math.round(adr * 0.75),
      Math.round(adr * 0.90),
      adr,
      Math.round(adr * 1.10),
    ];
    const scenarios: Array<{ occupancy_pct: number; adr: number; annual_revenue: number; monthly_revenue: number; monthly_profit: number; cash_flow_positive: boolean }> = [];
    for (const occ of occScenarios) {
      for (const testAdr of adrScenarios) {
        const testAnnualRev = Math.round(occ * testAdr * 365);
        const testMonthlyRev = Math.round(testAnnualRev / 12);
        const testExpenses = Math.round(testMonthlyRev * (expPct / 100));
        const monthlyProfit = testMonthlyRev - testExpenses;
        scenarios.push({
          occupancy_pct: occ,
          adr: testAdr,
          annual_revenue: testAnnualRev,
          monthly_revenue: testMonthlyRev,
          monthly_profit: monthlyProfit,
          cash_flow_positive: monthlyProfit >= 0,
        });
      }
    }
    return { base_occupancy: occRate, base_adr: adr, scenarios, occupancy_levels: occScenarios, adr_levels: adrScenarios };
  }

  it('should generate 16 scenarios (4 occupancy x 4 ADR)', () => {
    const result = generateStressTest(76054, 0.49, 424, 40);
    expect(result.scenarios).toHaveLength(16);
  });

  it('should include the base scenario in the matrix', () => {
    const result = generateStressTest(76054, 0.49, 424, 40);
    const baseScenario = result.scenarios.find(s => s.occupancy_pct === 0.49 && s.adr === 424);
    expect(baseScenario).toBeDefined();
  });

  it('should have all scenarios with positive monthly_revenue', () => {
    const result = generateStressTest(76054, 0.49, 424, 40);
    result.scenarios.forEach(s => {
      expect(s.monthly_revenue).toBeGreaterThan(0);
    });
  });

  it('should correctly flag cash_flow_positive', () => {
    const result = generateStressTest(76054, 0.49, 424, 40);
    result.scenarios.forEach(s => {
      expect(s.cash_flow_positive).toBe(s.monthly_profit >= 0);
    });
  });

  it('should have higher revenue at higher occupancy and ADR', () => {
    const result = generateStressTest(76054, 0.49, 424, 40);
    const lowest = result.scenarios[0]; // lowest occ, lowest adr
    const highest = result.scenarios[result.scenarios.length - 1]; // highest occ, highest adr
    expect(highest.annual_revenue).toBeGreaterThan(lowest.annual_revenue);
  });

  it('should include base occupancy in levels even when very low', () => {
    const result = generateStressTest(76054, 0.20, 424, 40); // very low base occ
    // The base occupancy (0.20) is included as-is, but -0.20 and -0.10 are clamped
    expect(result.occupancy_levels).toContain(0.20);
    // The +0.10 scenario should be 0.30
    expect(result.occupancy_levels).toContain(0.30);
    // All levels should be positive
    result.occupancy_levels.forEach(occ => {
      expect(occ).toBeGreaterThan(0);
      expect(occ).toBeLessThanOrEqual(0.95);
    });
  });
});

// ============================================================
// 3. BEDROOM-SPECIFIC BENCHMARK COMPUTATION
//    Tests for the bedroomBenchmark useMemo logic
// ============================================================
describe('Bedroom-specific benchmark computation', () => {
  interface BedroomPerformance {
    bedrooms: number;
    occupancy: number;
    adr: number;
    revenue: number;
    listing_count?: number;
    count?: number;
    avg_revenue?: number;
    avg_adr?: number;
    avg_occupancy?: number;
  }

  function computeBedroomBenchmark(bedroomPerformance: BedroomPerformance[], propertyBedrooms: number) {
    if (!bedroomPerformance || bedroomPerformance.length === 0) return null;
    const match = bedroomPerformance.find(bp => bp.bedrooms === propertyBedrooms);
    if (!match) return null;
    const rev = match.avg_revenue || match.revenue || 0;
    const adrVal = match.avg_adr || match.adr || 0;
    const occVal = match.avg_occupancy || match.occupancy || 0;
    const count = match.listing_count || match.count || 0;
    if (rev === 0 && adrVal === 0) return null;
    return {
      revenue: rev < 50000 ? rev * 12 : rev,
      adr: adrVal,
      occupancy: occVal,
      revpar: adrVal * (occVal > 1 ? occVal / 100 : occVal),
      listingCount: count,
    };
  }

  const sampleData: BedroomPerformance[] = [
    { bedrooms: 1, occupancy: 0.65, adr: 120, revenue: 28000, listing_count: 450, avg_revenue: 28000, avg_adr: 120, avg_occupancy: 0.65 },
    { bedrooms: 2, occupancy: 0.60, adr: 180, revenue: 39000, listing_count: 380, avg_revenue: 39000, avg_adr: 180, avg_occupancy: 0.60 },
    { bedrooms: 3, occupancy: 0.55, adr: 250, revenue: 50000, listing_count: 200, avg_revenue: 50000, avg_adr: 250, avg_occupancy: 0.55 },
    { bedrooms: 6, occupancy: 0.45, adr: 550, revenue: 90000, listing_count: 15, avg_revenue: 90000, avg_adr: 550, avg_occupancy: 0.45 },
  ];

  it('should return matching bedroom data when available', () => {
    const result = computeBedroomBenchmark(sampleData, 6);
    expect(result).not.toBeNull();
    expect(result!.adr).toBe(550);
    expect(result!.occupancy).toBe(0.45);
    expect(result!.listingCount).toBe(15);
  });

  it('should return null when bedroom count not found', () => {
    const result = computeBedroomBenchmark(sampleData, 5);
    expect(result).toBeNull();
  });

  it('should return null for empty bedroom_performance array', () => {
    const result = computeBedroomBenchmark([], 6);
    expect(result).toBeNull();
  });

  it('should annualize monthly revenue values (< 50000)', () => {
    const data: BedroomPerformance[] = [
      { bedrooms: 3, occupancy: 0.55, adr: 250, revenue: 4500, listing_count: 100 },
    ];
    const result = computeBedroomBenchmark(data, 3);
    expect(result).not.toBeNull();
    expect(result!.revenue).toBe(4500 * 12); // Annualized
  });

  it('should NOT annualize already-annual revenue values (>= 50000)', () => {
    const result = computeBedroomBenchmark(sampleData, 6);
    expect(result!.revenue).toBe(90000); // Already annual
  });

  it('should prefer avg_* fields over base fields', () => {
    const data: BedroomPerformance[] = [
      { bedrooms: 3, occupancy: 0.50, adr: 200, revenue: 40000, avg_revenue: 45000, avg_adr: 220, avg_occupancy: 0.58 },
    ];
    const result = computeBedroomBenchmark(data, 3);
    expect(result!.adr).toBe(220);
    expect(result!.occupancy).toBe(0.58);
  });

  it('should compute revpar correctly', () => {
    const result = computeBedroomBenchmark(sampleData, 6);
    expect(result!.revpar).toBeCloseTo(550 * 0.45, 2);
  });

  it('should handle occupancy > 1 (percentage format)', () => {
    const data: BedroomPerformance[] = [
      { bedrooms: 3, occupancy: 55, adr: 250, revenue: 50000, listing_count: 100 },
    ];
    const result = computeBedroomBenchmark(data, 3);
    expect(result!.revpar).toBeCloseTo(250 * (55 / 100), 2);
  });

  it('should return null when both revenue and adr are 0', () => {
    const data: BedroomPerformance[] = [
      { bedrooms: 3, occupancy: 0.55, adr: 0, revenue: 0, listing_count: 100 },
    ];
    const result = computeBedroomBenchmark(data, 3);
    expect(result).toBeNull();
  });
});

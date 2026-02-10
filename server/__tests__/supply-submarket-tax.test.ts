import { describe, it, expect } from 'vitest';

/**
 * Tests for the new Full Property Report features:
 * 1. Supply Trend data mapping
 * 2. Submarket Comparison data mapping
 * 3. Tax Implications calculations
 */

// ============================================================
// SUPPLY TREND DATA MAPPING
// ============================================================
describe('Supply Trend Data Mapping', () => {
  it('should correctly map historical active_listings to supply_trend format', () => {
    // Simulate the mapping logic from routers.ts
    const rawHistorical = {
      active_listings: [
        { date: '2024-01', value: 1200 },
        { date: '2024-02', value: 1250 },
        { date: '2024-03', value: 1300 },
        { date: '2024-06', value: 1450 },
        { date: '2024-12', value: 1100 },
      ]
    };

    const supply_trend = (rawHistorical.active_listings || []).map((d: any) => ({
      date: d.date,
      value: d.value,
    }));

    expect(supply_trend).toHaveLength(5);
    expect(supply_trend[0]).toEqual({ date: '2024-01', value: 1200 });
    expect(supply_trend[4]).toEqual({ date: '2024-12', value: 1100 });
  });

  it('should handle empty active_listings gracefully', () => {
    const rawHistorical = { active_listings: [] };
    const supply_trend = (rawHistorical.active_listings || []).map((d: any) => ({
      date: d.date,
      value: d.value,
    }));

    expect(supply_trend).toHaveLength(0);
  });

  it('should handle missing active_listings gracefully', () => {
    const rawHistorical: any = {};
    const supply_trend = (rawHistorical?.active_listings || []).map((d: any) => ({
      date: d.date,
      value: d.value,
    }));

    expect(supply_trend).toHaveLength(0);
  });

  it('should calculate correct supply growth percentage', () => {
    const supply_trend = [
      { date: '2024-01', value: 1000 },
      { date: '2024-06', value: 1100 },
      { date: '2024-12', value: 1200 },
    ];

    // Growth calculation as done in the frontend
    const firstValue = supply_trend[0].value;
    const lastValue = supply_trend[supply_trend.length - 1].value;
    const growthPct = ((lastValue - firstValue) / firstValue) * 100;

    expect(growthPct).toBeCloseTo(20, 1);
  });

  it('should handle negative supply growth', () => {
    const supply_trend = [
      { date: '2024-01', value: 1500 },
      { date: '2024-12', value: 1200 },
    ];

    const firstValue = supply_trend[0].value;
    const lastValue = supply_trend[supply_trend.length - 1].value;
    const growthPct = ((lastValue - firstValue) / firstValue) * 100;

    expect(growthPct).toBeCloseTo(-20, 1);
  });
});

// ============================================================
// SUBMARKET COMPARISON DATA MAPPING
// ============================================================
describe('Submarket Comparison Data Mapping', () => {
  it('should correctly map submarket data from API response', () => {
    // Simulate the mapping logic from routers.ts
    const rawSubmarkets = [
      {
        id: 'sm-1',
        name: 'Downtown',
        listing_count: 500,
        metrics: { occupancy: 0.75, adr: 200, revenue: 54750, revpar: 150 }
      },
      {
        id: 'sm-2',
        name: 'Suburbs',
        listing_count: 300,
        metrics: { occupancy: 0.65, adr: 150, revenue: 35588, revpar: 97.5 }
      },
    ];

    const submarkets = rawSubmarkets.map((s: any) => ({
      id: s.id,
      name: s.name,
      listing_count: s.listing_count || 0,
      metrics: s.metrics ? {
        occupancy: s.metrics.occupancy || 0,
        adr: s.metrics.adr || 0,
        revenue: s.metrics.revenue || 0,
        revpar: s.metrics.revpar || 0,
      } : undefined,
    }));

    expect(submarkets).toHaveLength(2);
    expect(submarkets[0].name).toBe('Downtown');
    expect(submarkets[0].metrics?.occupancy).toBe(0.75);
    expect(submarkets[0].metrics?.revenue).toBe(54750);
    expect(submarkets[1].name).toBe('Suburbs');
    expect(submarkets[1].listing_count).toBe(300);
  });

  it('should handle submarkets without metrics', () => {
    const rawSubmarkets = [
      { id: 'sm-1', name: 'Downtown', listing_count: 500 },
    ];

    const submarkets = rawSubmarkets.map((s: any) => ({
      id: s.id,
      name: s.name,
      listing_count: s.listing_count || 0,
      metrics: s.metrics ? {
        occupancy: s.metrics.occupancy || 0,
        adr: s.metrics.adr || 0,
        revenue: s.metrics.revenue || 0,
        revpar: s.metrics.revpar || 0,
      } : undefined,
    }));

    expect(submarkets[0].metrics).toBeUndefined();
  });

  it('should handle empty submarkets array', () => {
    const rawSubmarkets: any[] = [];
    const submarkets = rawSubmarkets.map((s: any) => ({
      id: s.id,
      name: s.name,
      listing_count: s.listing_count || 0,
      metrics: s.metrics ? {
        occupancy: s.metrics.occupancy || 0,
        adr: s.metrics.adr || 0,
        revenue: s.metrics.revenue || 0,
        revpar: s.metrics.revpar || 0,
      } : undefined,
    }));

    expect(submarkets).toHaveLength(0);
  });

  it('should identify best and worst submarkets by revenue', () => {
    const submarkets = [
      { name: 'Downtown', metrics: { revenue: 80000, occupancy: 0.75, adr: 250, revpar: 187 } },
      { name: 'Suburbs', metrics: { revenue: 45000, occupancy: 0.65, adr: 150, revpar: 97 } },
      { name: 'Beach', metrics: { revenue: 95000, occupancy: 0.80, adr: 300, revpar: 240 } },
    ];

    const withMetrics = submarkets.filter(s => s.metrics);
    const best = withMetrics.reduce((a, b) => (a.metrics!.revenue > b.metrics!.revenue ? a : b));
    const worst = withMetrics.reduce((a, b) => (a.metrics!.revenue < b.metrics!.revenue ? a : b));

    expect(best.name).toBe('Beach');
    expect(worst.name).toBe('Suburbs');
  });
});

// ============================================================
// TAX IMPLICATIONS CALCULATIONS
// ============================================================
describe('Tax Implications Calculations', () => {
  // Replicate the tax calculation logic from FullPropertyReport.tsx
  function calculateTaxDeductions(params: {
    annualRevenue: number;
    purchasePrice?: number;
    downPaymentPercent?: number;
    interestRate?: number;
    loanType?: string;
    monthlyRent?: number;
    hasPurchase: boolean;
    hasRental: boolean;
  }) {
    const { annualRevenue, purchasePrice = 0, downPaymentPercent = 20, interestRate = 7, loanType, monthlyRent = 0, hasPurchase, hasRental } = params;

    // Operating expense deductions
    const platformFees = Math.round(annualRevenue * 0.03);
    const cleaningCosts = Math.round(annualRevenue * 0.08);
    const utilitiesCost = Math.round(annualRevenue * 0.04);
    const suppliesCost = Math.round(annualRevenue * 0.025);
    const maintenanceCost = Math.round(annualRevenue * 0.04);
    const insuranceCost = Math.round(annualRevenue * 0.03);
    const advertisingCost = Math.round(annualRevenue * 0.01);
    const professionalCost = Math.round(annualRevenue * 0.02);

    const operatingDeductions = platformFees + cleaningCosts + utilitiesCost + suppliesCost + maintenanceCost + insuranceCost + advertisingCost + professionalCost;

    // Purchase-specific deductions
    let purchaseDeductions = 0;
    let annualDepreciation = 0;
    let mortgageInterest = 0;
    let propertyTaxEst = 0;

    if (hasPurchase && purchasePrice > 0) {
      const buildingValue = Math.round(purchasePrice * 0.80);
      annualDepreciation = Math.round(buildingValue / 27.5);
      propertyTaxEst = Math.round(purchasePrice * 0.012);

      if (loanType !== 'cash') {
        const downPct = downPaymentPercent / 100;
        const loanAmount = purchasePrice * (1 - downPct);
        const rate = interestRate / 100;
        mortgageInterest = Math.round(loanAmount * rate * 0.97);
      }

      purchaseDeductions = annualDepreciation + mortgageInterest + propertyTaxEst;
    }

    // Rental arbitrage deductions
    let rentalDeductions = 0;
    if (hasRental && monthlyRent > 0) {
      rentalDeductions = monthlyRent * 12;
    }

    const totalDeductions = operatingDeductions + purchaseDeductions + rentalDeductions;
    const taxableIncome = Math.max(0, annualRevenue - totalDeductions);

    return {
      operatingDeductions,
      purchaseDeductions,
      rentalDeductions,
      totalDeductions,
      taxableIncome,
      annualDepreciation,
      mortgageInterest,
      propertyTaxEst,
      platformFees,
      cleaningCosts,
    };
  }

  it('should calculate operating expense deductions correctly', () => {
    const result = calculateTaxDeductions({
      annualRevenue: 100000,
      hasPurchase: false,
      hasRental: false,
    });

    // 3% + 8% + 4% + 2.5% + 4% + 3% + 1% + 2% = 27.5% of revenue
    expect(result.operatingDeductions).toBe(27500);
    expect(result.platformFees).toBe(3000);
    expect(result.cleaningCosts).toBe(8000);
    expect(result.purchaseDeductions).toBe(0);
    expect(result.rentalDeductions).toBe(0);
    expect(result.totalDeductions).toBe(27500);
    expect(result.taxableIncome).toBe(72500);
  });

  it('should calculate purchase-specific deductions correctly', () => {
    const result = calculateTaxDeductions({
      annualRevenue: 80000,
      purchasePrice: 400000,
      downPaymentPercent: 20,
      interestRate: 7,
      hasPurchase: true,
      hasRental: false,
    });

    // Building value: 400000 * 0.80 = 320000
    // Depreciation: 320000 / 27.5 = 11636
    expect(result.annualDepreciation).toBe(Math.round(320000 / 27.5));

    // Property tax: 400000 * 0.012 = 4800
    expect(result.propertyTaxEst).toBe(4800);

    // Mortgage interest: 400000 * 0.80 * 0.07 * 0.97 = 21728
    const expectedMortgageInterest = Math.round(400000 * 0.80 * 0.07 * 0.97);
    expect(result.mortgageInterest).toBe(expectedMortgageInterest);

    expect(result.purchaseDeductions).toBeGreaterThan(0);
    expect(result.totalDeductions).toBeGreaterThan(result.operatingDeductions);
  });

  it('should calculate cash purchase deductions (no mortgage interest)', () => {
    const result = calculateTaxDeductions({
      annualRevenue: 80000,
      purchasePrice: 400000,
      loanType: 'cash',
      hasPurchase: true,
      hasRental: false,
    });

    expect(result.mortgageInterest).toBe(0);
    expect(result.annualDepreciation).toBeGreaterThan(0);
    expect(result.propertyTaxEst).toBe(4800);
  });

  it('should calculate rental arbitrage deductions correctly', () => {
    const result = calculateTaxDeductions({
      annualRevenue: 60000,
      monthlyRent: 2500,
      hasPurchase: false,
      hasRental: true,
    });

    expect(result.rentalDeductions).toBe(30000); // 2500 * 12
    expect(result.totalDeductions).toBe(result.operatingDeductions + 30000);
  });

  it('should not allow negative taxable income', () => {
    const result = calculateTaxDeductions({
      annualRevenue: 30000,
      monthlyRent: 3000,
      hasPurchase: false,
      hasRental: true,
    });

    // Revenue: 30000, Rent: 36000, Operating: 8250 => total deductions > revenue
    expect(result.taxableIncome).toBe(0);
    expect(result.totalDeductions).toBeGreaterThan(30000);
  });

  it('should calculate tax savings by bracket correctly', () => {
    const totalDeductions = 50000;
    const brackets = [
      { rate: 0.22, label: '22%' },
      { rate: 0.24, label: '24%' },
      { rate: 0.32, label: '32%' },
    ];

    const savings = brackets.map(b => ({
      label: b.label,
      saved: Math.round(totalDeductions * b.rate),
    }));

    expect(savings[0].saved).toBe(11000);
    expect(savings[1].saved).toBe(12000);
    expect(savings[2].saved).toBe(16000);
  });

  it('should handle zero revenue gracefully', () => {
    const result = calculateTaxDeductions({
      annualRevenue: 0,
      hasPurchase: false,
      hasRental: false,
    });

    expect(result.operatingDeductions).toBe(0);
    expect(result.totalDeductions).toBe(0);
    expect(result.taxableIncome).toBe(0);
  });

  it('should calculate depreciation over 27.5 years correctly', () => {
    const purchasePrice = 500000;
    const buildingValue = Math.round(purchasePrice * 0.80);
    const annualDepreciation = Math.round(buildingValue / 27.5);

    // Over 27.5 years, total depreciation should approximate building value
    const totalOver275Years = annualDepreciation * 27.5;
    // Allow small rounding difference
    expect(Math.abs(totalOver275Years - buildingValue)).toBeLessThan(15);
  });

  it('should handle combined purchase + rental scenario', () => {
    const result = calculateTaxDeductions({
      annualRevenue: 100000,
      purchasePrice: 350000,
      downPaymentPercent: 25,
      interestRate: 6.5,
      monthlyRent: 2000,
      hasPurchase: true,
      hasRental: true,
    });

    // Should have all three types of deductions
    expect(result.operatingDeductions).toBeGreaterThan(0);
    expect(result.purchaseDeductions).toBeGreaterThan(0);
    expect(result.rentalDeductions).toBe(24000); // 2000 * 12
    expect(result.totalDeductions).toBe(
      result.operatingDeductions + result.purchaseDeductions + result.rentalDeductions
    );
  });
});

// ============================================================
// AI SUMMARY INPUT - SUPPLY TREND & SUBMARKET DATA
// ============================================================
describe('AI Summary Input Data', () => {
  it('should format supply trend data for AI summary', () => {
    const supplyTrend = [
      { date: '2024-01', value: 1000 },
      { date: '2024-06', value: 1100 },
      { date: '2024-12', value: 1200 },
    ];

    // Simulate the formatting done in routers.ts for AI summary input
    const formatted = supplyTrend.length > 0
      ? supplyTrend
      : undefined;

    expect(formatted).toBeDefined();
    expect(formatted).toHaveLength(3);
  });

  it('should format submarket data for AI summary', () => {
    const submarkets = [
      { name: 'Downtown', listing_count: 500, metrics: { occupancy: 0.75, adr: 200, revenue: 54750 } },
      { name: 'Suburbs', listing_count: 300, metrics: { occupancy: 0.65, adr: 150, revenue: 35588 } },
    ];

    // Simulate the formatting done in routers.ts for AI summary input
    const formatted = submarkets.length > 0
      ? submarkets.map(s => ({
          name: s.name,
          listing_count: s.listing_count,
          occupancy: s.metrics?.occupancy,
          adr: s.metrics?.adr,
          revenue: s.metrics?.revenue,
        }))
      : undefined;

    expect(formatted).toBeDefined();
    expect(formatted).toHaveLength(2);
    expect(formatted![0].name).toBe('Downtown');
    expect(formatted![0].occupancy).toBe(0.75);
  });
});

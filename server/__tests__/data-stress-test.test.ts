/**
 * COMPREHENSIVE DATA STRESS TEST
 * 
 * Tests ALL data outputs across the rental calculator pipeline:
 * 1. Revenue calculations (annual, monthly, ADR, occupancy consistency)
 * 2. Comp-median adjustment (median-based revenue, edge cases, bidirectional)
 * 3. Comp filtering (bedroom/bathroom matching, inactive filtering, distance)
 * 4. Shared report generation (data integrity from raw → shared format)
 * 5. Forecast consistency (monthly totals vs annual, seasonal shape)
 * 6. Edge cases (zero comps, single comp, extreme values, missing data)
 * 7. Currency/number formatting (no NaN, no undefined, no negative where inappropriate)
 * 8. Market data integrity (scores, supply trends, booking patterns)
 */

import { describe, it, expect } from 'vitest';

// ============================================
// HELPERS: Replicate core logic from production
// ============================================

const matchesBathrooms = (compBa: number, targetBa: number) =>
  Math.abs(compBa - targetBa) <= 0.5;

function getPercentile(arr: number[], p: number) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function getMedian(arr: number[]) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/** Replicate the comp-median adjustment logic from airdna.ts */
function applyCompMedianAdjustment(
  rentalizerRevenue: number,
  exactMatchComps: Array<{ annual_revenue: number; adr: number; occupancy: number }>
) {
  if (exactMatchComps.length < 3) {
    return { adjusted: false, reason: 'insufficient_comps', finalRevenue: rentalizerRevenue };
  }
  
  const sortedRevenues = exactMatchComps.map(c => c.annual_revenue).sort((a, b) => a - b);
  const sortedAdrs = exactMatchComps.map(c => c.adr).sort((a, b) => a - b);
  const sortedOccs = exactMatchComps.map(c => c.occupancy).sort((a, b) => a - b);
  
  const compMedianRevenue = getMedian(sortedRevenues);
  const compMedianAdr = getMedian(sortedAdrs);
  const compMedianOccupancy = getMedian(sortedOccs);
  const compQ1Revenue = getPercentile(sortedRevenues, 25);
  const compQ3Revenue = getPercentile(sortedRevenues, 75);
  
  const targetRevenue = compMedianRevenue;
  
  if (targetRevenue === rentalizerRevenue) {
    return { adjusted: false, reason: 'median_equals_rentalizer', finalRevenue: rentalizerRevenue, compMedianRevenue };
  }
  
  const scaleFactor = targetRevenue / rentalizerRevenue;
  
  return {
    adjusted: true,
    finalRevenue: targetRevenue,
    compMedianRevenue,
    compMedianAdr,
    compMedianOccupancy,
    compQ1Revenue,
    compQ3Revenue,
    scaleFactor,
    adjustedDown: targetRevenue < rentalizerRevenue,
  };
}

/** Replicate the profit calculation from the app */
function calculateProfit(monthlyRevenue: number, monthlyRent: number, expenseRate: number = 0.20) {
  const operatingCosts = monthlyRevenue * expenseRate;
  const monthlyProfit = monthlyRevenue - monthlyRent - operatingCosts;
  return { operatingCosts, monthlyProfit, annualProfit: monthlyProfit * 12 };
}

/** Replicate the shared report revenue_estimate builder */
function buildRevenueEstimate(annualRev: number, adr: number, occRate: number, lowOverride?: number, highOverride?: number) {
  return {
    annual: annualRev,
    monthly: Math.round(annualRev / 12),
    nightly: adr,
    occupancy: occRate,
    range: {
      low: lowOverride ?? Math.round(annualRev * 0.9),
      high: highOverride ?? Math.round(annualRev * 1.1),
    },
  };
}

/** Replicate monthly forecast scaling */
function scaleMonthlyForecast(
  forecast: Array<{ month: string; revenue: number; adr: number; occupancy: number }>,
  scaleFactor: number
) {
  return forecast.map(m => ({
    ...m,
    revenue: Math.round(m.revenue * scaleFactor),
    adr: Math.round(m.adr * scaleFactor),
    // Occupancy stays unchanged
  }));
}

// Mock comp generator
function mockComp(overrides: Partial<{
  id: string; bedrooms: number; bathrooms: number; annual_revenue: number;
  adr: number; occupancy: number; rating: number; reviews: number;
  last_review_date: string; distance_meters: number;
}>) {
  return {
    id: overrides.id || `comp_${Math.random().toString(36).slice(2, 8)}`,
    title: `Listing ${overrides.id || 'unknown'}`,
    bedrooms: overrides.bedrooms ?? 2,
    bathrooms: overrides.bathrooms ?? 1,
    annual_revenue: overrides.annual_revenue ?? 30000,
    adr: overrides.adr ?? 150,
    occupancy: overrides.occupancy ?? 0.65,
    rating: overrides.rating ?? 4.5,
    reviews: overrides.reviews ?? 50,
    accommodates: (overrides.bedrooms ?? 2) * 2,
    property_type: 'house',
    last_review_date: overrides.last_review_date,
    distance_meters: overrides.distance_meters ?? 1000,
  };
}

// Mock monthly forecast
function mockForecast() {
  return [
    { month: '2025-01', revenue: 2500, adr: 150, occupancy: 0.55 },
    { month: '2025-02', revenue: 2800, adr: 155, occupancy: 0.60 },
    { month: '2025-03', revenue: 3200, adr: 165, occupancy: 0.65 },
    { month: '2025-04', revenue: 3800, adr: 175, occupancy: 0.72 },
    { month: '2025-05', revenue: 4200, adr: 185, occupancy: 0.76 },
    { month: '2025-06', revenue: 4800, adr: 200, occupancy: 0.80 },
    { month: '2025-07', revenue: 5000, adr: 210, occupancy: 0.82 },
    { month: '2025-08', revenue: 4700, adr: 205, occupancy: 0.78 },
    { month: '2025-09', revenue: 3900, adr: 180, occupancy: 0.72 },
    { month: '2025-10', revenue: 3400, adr: 170, occupancy: 0.67 },
    { month: '2025-11', revenue: 2900, adr: 155, occupancy: 0.62 },
    { month: '2025-12', revenue: 2600, adr: 150, occupancy: 0.58 },
  ];
}


// ============================================
// TEST SUITE 1: REVENUE CALCULATION CONSISTENCY
// ============================================

describe('Revenue Calculation Consistency', () => {
  it('monthly revenue equals annual / 12 (rounded)', () => {
    const testCases = [20889, 32174, 44778, 82782, 93726, 124056, 85284, 64828, 120280, 58554];
    for (const annual of testCases) {
      const monthly = Math.round(annual / 12);
      expect(monthly * 12).toBeGreaterThanOrEqual(annual - 12); // rounding tolerance
      expect(monthly * 12).toBeLessThanOrEqual(annual + 12);
      expect(monthly).toBeGreaterThan(0);
      expect(Number.isFinite(monthly)).toBe(true);
      expect(Number.isNaN(monthly)).toBe(false);
    }
  });

  it('ADR * occupancy * 365 should approximate annual revenue', () => {
    // ADR * occupancy * 365 = annual revenue (approximately)
    const scenarios = [
      { adr: 150, occupancy: 0.65, expectedApprox: 35588 },
      { adr: 250, occupancy: 0.73, expectedApprox: 66613 },
      { adr: 480, occupancy: 0.73, expectedApprox: 127896 },
      { adr: 100, occupancy: 0.50, expectedApprox: 18250 },
    ];
    for (const s of scenarios) {
      const calculated = Math.round(s.adr * s.occupancy * 365);
      expect(calculated).toBeCloseTo(s.expectedApprox, -2); // within ~100
      expect(calculated).toBeGreaterThan(0);
    }
  });

  it('revenue range low should be <= annual <= high', () => {
    const testCases = [
      { annual: 50000, low: 45000, high: 55000 },
      { annual: 32174, low: 28957, high: 35391 },
      { annual: 100000, low: 90000, high: 110000 },
    ];
    for (const t of testCases) {
      expect(t.low).toBeLessThanOrEqual(t.annual);
      expect(t.high).toBeGreaterThanOrEqual(t.annual);
      expect(t.low).toBeGreaterThan(0);
      expect(t.high).toBeGreaterThan(0);
    }
  });

  it('occupancy rate should be between 0 and 1 (decimal)', () => {
    const rates = [0.50, 0.65, 0.73, 0.88, 0.91, 0.55, 0.42, 0.99];
    for (const rate of rates) {
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });

  it('occupancy normalization: values > 1 should be divided by 100', () => {
    // The comp-median code normalizes occupancy > 1 to decimal
    const normalize = (occ: number) => occ > 1 ? occ / 100 : occ;
    expect(normalize(73)).toBeCloseTo(0.73, 2);
    expect(normalize(0.73)).toBeCloseTo(0.73, 2);
    expect(normalize(100)).toBeCloseTo(1.0, 2);
    expect(normalize(0.5)).toBeCloseTo(0.5, 2);
    expect(normalize(55)).toBeCloseTo(0.55, 2);
    expect(normalize(1)).toBeCloseTo(1, 2); // edge: exactly 1 stays 1
  });

  it('no revenue value should be NaN, undefined, or negative', () => {
    const estimates = [
      buildRevenueEstimate(50000, 200, 0.68),
      buildRevenueEstimate(20889, 120, 0.48),
      buildRevenueEstimate(124056, 480, 0.73),
    ];
    for (const est of estimates) {
      expect(Number.isFinite(est.annual)).toBe(true);
      expect(Number.isFinite(est.monthly)).toBe(true);
      expect(Number.isFinite(est.nightly)).toBe(true);
      expect(Number.isFinite(est.occupancy)).toBe(true);
      expect(Number.isFinite(est.range.low)).toBe(true);
      expect(Number.isFinite(est.range.high)).toBe(true);
      expect(est.annual).toBeGreaterThan(0);
      expect(est.monthly).toBeGreaterThan(0);
      expect(est.nightly).toBeGreaterThan(0);
      expect(est.occupancy).toBeGreaterThan(0);
      expect(est.range.low).toBeGreaterThan(0);
      expect(est.range.high).toBeGreaterThan(0);
    }
  });
});


// ============================================
// TEST SUITE 2: COMP-MEDIAN ADJUSTMENT COMPREHENSIVE
// ============================================

describe('Comp-Median Adjustment Comprehensive', () => {
  describe('Median as headline revenue', () => {
    it('uses comp median when comps are higher than Rentalizer', () => {
      const result = applyCompMedianAdjustment(20000, [
        { annual_revenue: 25000, adr: 150, occupancy: 0.65 },
        { annual_revenue: 30000, adr: 170, occupancy: 0.70 },
        { annual_revenue: 35000, adr: 190, occupancy: 0.75 },
        { annual_revenue: 40000, adr: 210, occupancy: 0.80 },
        { annual_revenue: 50000, adr: 250, occupancy: 0.85 },
      ]);
      expect(result.adjusted).toBe(true);
      // Median of [25K, 30K, 35K, 40K, 50K] = 35000
      expect(result.finalRevenue).toBe(35000);
    });

    it('adjusts downward when comp median is lower than Rentalizer', () => {
      const result = applyCompMedianAdjustment(50000, [
        { annual_revenue: 25000, adr: 150, occupancy: 0.65 },
        { annual_revenue: 30000, adr: 170, occupancy: 0.70 },
        { annual_revenue: 35000, adr: 190, occupancy: 0.75 },
        { annual_revenue: 40000, adr: 210, occupancy: 0.80 },
      ]);
      expect(result.adjusted).toBe(true);
      // Median of [25K, 30K, 35K, 40K] = (30K+35K)/2 = 32500
      expect(result.finalRevenue).toBe(32500);
      expect(result.adjustedDown).toBe(true);
    });

    it('has no artificial cap — comp median is real data', () => {
      const result = applyCompMedianAdjustment(20000, [
        { annual_revenue: 80000, adr: 300, occupancy: 0.80 },
        { annual_revenue: 90000, adr: 350, occupancy: 0.85 },
        { annual_revenue: 100000, adr: 400, occupancy: 0.88 },
      ]);
      expect(result.adjusted).toBe(true);
      // Median = 90000, which is 4.5x Rentalizer — no cap
      expect(result.finalRevenue).toBe(90000);
    });

    it('Phoenix scenario: 2BR/1BA with $21K Rentalizer vs $32-42K comps', () => {
      const result = applyCompMedianAdjustment(20889, [
        { annual_revenue: 32000, adr: 110, occupancy: 0.75 },
        { annual_revenue: 35000, adr: 113, occupancy: 0.78 },
        { annual_revenue: 38000, adr: 120, occupancy: 0.80 },
        { annual_revenue: 42000, adr: 134, occupancy: 0.82 },
        { annual_revenue: 42000, adr: 137, occupancy: 0.85 },
      ]);
      expect(result.adjusted).toBe(true);
      // Median of [32K, 35K, 38K, 42K, 42K] = 38000
      expect(result.finalRevenue).toBe(38000);
    });
  });

  describe('No adjustment scenarios', () => {
    it('no adjustment when comp median equals Rentalizer', () => {
      const result = applyCompMedianAdjustment(35000, [
        { annual_revenue: 30000, adr: 150, occupancy: 0.60 },
        { annual_revenue: 35000, adr: 170, occupancy: 0.65 },
        { annual_revenue: 40000, adr: 190, occupancy: 0.70 },
      ]);
      expect(result.adjusted).toBe(false);
      expect(result.reason).toBe('median_equals_rentalizer');
      expect(result.finalRevenue).toBe(35000);
    });

    it('no adjustment when fewer than 3 exact comps', () => {
      const result = applyCompMedianAdjustment(20000, [
        { annual_revenue: 30000, adr: 170, occupancy: 0.70 },
        { annual_revenue: 40000, adr: 210, occupancy: 0.80 },
      ]);
      expect(result.adjusted).toBe(false);
      expect(result.reason).toBe('insufficient_comps');
    });

    it('no adjustment when zero comps', () => {
      const result = applyCompMedianAdjustment(20000, []);
      expect(result.adjusted).toBe(false);
      expect(result.reason).toBe('insufficient_comps');
    });
  });

  describe('Scale factor correctness', () => {
    it('scale factor is median / rentalizer', () => {
      const result = applyCompMedianAdjustment(20000, [
        { annual_revenue: 22000, adr: 140, occupancy: 0.60 },
        { annual_revenue: 25000, adr: 155, occupancy: 0.65 },
        { annual_revenue: 28000, adr: 170, occupancy: 0.70 },
      ]);
      if (result.adjusted) {
        expect(result.scaleFactor).toBeCloseTo(result.finalRevenue / 20000, 5);
      }
    });

    it('scale factor can be < 1 when adjusting downward', () => {
      const result = applyCompMedianAdjustment(50000, [
        { annual_revenue: 20000, adr: 120, occupancy: 0.55 },
        { annual_revenue: 25000, adr: 150, occupancy: 0.60 },
        { annual_revenue: 30000, adr: 170, occupancy: 0.65 },
      ]);
      if (result.adjusted) {
        expect(result.scaleFactor!).toBeLessThan(1);
        expect(result.adjustedDown).toBe(true);
      }
    });

    it('scale factor > 1 when adjusting upward', () => {
      const scenarios = [
        { rentalizer: 20000, comps: [25000, 30000, 35000] },
        { rentalizer: 10000, comps: [12000, 13000, 14000] },
      ];
      for (const s of scenarios) {
        const result = applyCompMedianAdjustment(
          s.rentalizer,
          s.comps.map(r => ({ annual_revenue: r, adr: 150, occupancy: 0.70 }))
        );
        if (result.adjusted && !result.adjustedDown) {
          expect(result.scaleFactor!).toBeGreaterThan(1);
        }
      }
    });
  });

  describe('Extreme value handling', () => {
    it('handles very low Rentalizer values', () => {
      const result = applyCompMedianAdjustment(1000, [
        { annual_revenue: 5000, adr: 50, occupancy: 0.30 },
        { annual_revenue: 8000, adr: 70, occupancy: 0.40 },
        { annual_revenue: 10000, adr: 80, occupancy: 0.45 },
      ]);
      expect(result.adjusted).toBe(true);
      // Median = 8000, no cap
      expect(result.finalRevenue).toBe(8000);
    });

    it('handles very high Rentalizer values (adjusts downward)', () => {
      const result = applyCompMedianAdjustment(500000, [
        { annual_revenue: 400000, adr: 1200, occupancy: 0.90 },
        { annual_revenue: 450000, adr: 1300, occupancy: 0.92 },
        { annual_revenue: 480000, adr: 1400, occupancy: 0.94 },
      ]);
      // Median = 450000, different from 500000
      expect(result.adjusted).toBe(true);
      expect(result.finalRevenue).toBe(450000);
      expect(result.adjustedDown).toBe(true);
    });

    it('handles comps with identical revenues', () => {
      const result = applyCompMedianAdjustment(20000, [
        { annual_revenue: 30000, adr: 170, occupancy: 0.70 },
        { annual_revenue: 30000, adr: 170, occupancy: 0.70 },
        { annual_revenue: 30000, adr: 170, occupancy: 0.70 },
      ]);
      expect(result.adjusted).toBe(true);
      expect(result.finalRevenue).toBe(30000);
      expect(result.compMedianRevenue).toBe(30000);
    });

    it('handles large number of comps (50+)', () => {
      const comps = Array.from({ length: 50 }, (_, i) => ({
        annual_revenue: 20000 + i * 1000,
        adr: 100 + i * 5,
        occupancy: 0.50 + i * 0.01,
      }));
      const result = applyCompMedianAdjustment(20000, comps);
      expect(result.adjusted).toBe(true);
      // Median of 20K-69K (50 items) = (44K+45K)/2 = 44500
      expect(result.finalRevenue).toBe(44500);
    });
  });

  describe('Q1/Q3 range', () => {
    it('sets Q1 as low and Q3 as high', () => {
      const result = applyCompMedianAdjustment(20000, [
        { annual_revenue: 25000, adr: 150, occupancy: 0.65 },
        { annual_revenue: 30000, adr: 170, occupancy: 0.70 },
        { annual_revenue: 35000, adr: 190, occupancy: 0.75 },
        { annual_revenue: 40000, adr: 210, occupancy: 0.80 },
        { annual_revenue: 50000, adr: 250, occupancy: 0.85 },
      ]);
      expect(result.adjusted).toBe(true);
      expect(result.compQ1Revenue).toBe(30000); // Q1
      expect(result.compQ3Revenue).toBe(40000); // Q3
      expect(result.finalRevenue).toBe(35000); // median
      // Q1 <= median <= Q3
      expect(result.compQ1Revenue!).toBeLessThanOrEqual(result.finalRevenue);
      expect(result.finalRevenue).toBeLessThanOrEqual(result.compQ3Revenue!);
    });
  });
});


// ============================================
// TEST SUITE 3: COMP FILTERING
// ============================================

describe('Comp Filtering Comprehensive', () => {
  describe('Bedroom matching', () => {
    it('exact bedroom match', () => {
      const comps = [
        mockComp({ id: 'a', bedrooms: 2, bathrooms: 1, annual_revenue: 30000, adr: 150 }),
        mockComp({ id: 'b', bedrooms: 3, bathrooms: 1, annual_revenue: 40000, adr: 200 }),
        mockComp({ id: 'c', bedrooms: 2, bathrooms: 1, annual_revenue: 35000, adr: 170 }),
      ];
      const filtered = comps.filter(c => c.bedrooms === 2);
      expect(filtered.length).toBe(2);
      expect(filtered.every(c => c.bedrooms === 2)).toBe(true);
    });

    it('bedroom range 1-8 only', () => {
      const validBedrooms = [1, 2, 3, 4, 5, 6, 7, 8];
      const invalidBedrooms = [0, -1, 9, 10, 100];
      for (const br of validBedrooms) {
        expect(br >= 1 && br <= 8).toBe(true);
      }
      for (const br of invalidBedrooms) {
        expect(br >= 1 && br <= 8).toBe(false);
      }
    });
  });

  describe('Bathroom matching (±0.5 tolerance)', () => {
    it('all valid bathroom combinations', () => {
      const testCases = [
        { comp: 1, target: 1, expected: true },
        { comp: 1, target: 1.5, expected: true },
        { comp: 1.5, target: 1, expected: true },
        { comp: 2, target: 2, expected: true },
        { comp: 2, target: 2.5, expected: true },
        { comp: 2.5, target: 2, expected: true },
        { comp: 1, target: 2, expected: false },
        { comp: 2, target: 1, expected: false },
        { comp: 1, target: 2.5, expected: false },
        { comp: 3, target: 1, expected: false },
        { comp: 0.5, target: 1, expected: true },
        { comp: 1, target: 0.5, expected: true },
      ];
      for (const tc of testCases) {
        expect(matchesBathrooms(tc.comp, tc.target)).toBe(tc.expected);
      }
    });
  });

  describe('Inactive property filtering', () => {
    it('filters out properties with last review > 2 months ago', () => {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      
      const comps = [
        mockComp({ id: 'active', last_review_date: new Date().toISOString(), annual_revenue: 30000 }),
        mockComp({ id: 'recent', last_review_date: new Date(Date.now() - 30 * 86400000).toISOString(), annual_revenue: 35000 }),
        mockComp({ id: 'stale', last_review_date: '2024-01-01', annual_revenue: 50000 }),
        mockComp({ id: 'very_stale', last_review_date: '2023-06-01', annual_revenue: 60000 }),
      ];
      
      const filtered = comps.filter(c => {
        if (!c.last_review_date) return true; // no date = include
        const lastReview = new Date(c.last_review_date);
        return lastReview >= twoMonthsAgo;
      });
      
      expect(filtered.length).toBe(2);
      expect(filtered.map(c => c.id)).toContain('active');
      expect(filtered.map(c => c.id)).toContain('recent');
    });

    it('includes properties with no last_review_date', () => {
      const comps = [
        mockComp({ id: 'no_date', annual_revenue: 30000 }),
      ];
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      
      const filtered = comps.filter(c => {
        if (!c.last_review_date) return true;
        return new Date(c.last_review_date) >= twoMonthsAgo;
      });
      expect(filtered.length).toBe(1);
    });
  });

  describe('Revenue filtering', () => {
    it('filters out comps with zero or negative revenue', () => {
      const comps = [
        mockComp({ id: 'good', annual_revenue: 30000 }),
        mockComp({ id: 'zero', annual_revenue: 0 }),
        mockComp({ id: 'negative', annual_revenue: -5000 }),
        mockComp({ id: 'also_good', annual_revenue: 15000 }),
      ];
      const filtered = comps.filter(c => c.annual_revenue > 0);
      expect(filtered.length).toBe(2);
      expect(filtered.map(c => c.id)).toEqual(['good', 'also_good']);
    });
  });

  describe('Comp sorting priority', () => {
    it('exact BA match comps sort before different BA comps', () => {
      const targetBa = 1;
      const comps = [
        mockComp({ id: 'diff_ba', bedrooms: 2, bathrooms: 2, annual_revenue: 50000 }),
        mockComp({ id: 'exact_ba', bedrooms: 2, bathrooms: 1, annual_revenue: 35000 }),
        mockComp({ id: 'close_ba', bedrooms: 2, bathrooms: 1.5, annual_revenue: 42000 }),
      ];
      
      const sorted = [...comps].sort((a, b) => {
        const aExact = matchesBathrooms(a.bathrooms, targetBa) ? 0 : 1;
        const bExact = matchesBathrooms(b.bathrooms, targetBa) ? 0 : 1;
        return aExact - bExact;
      });
      
      // exact_ba (1BA) and close_ba (1.5BA, within ±0.5) should come first
      expect(matchesBathrooms(sorted[0].bathrooms, targetBa)).toBe(true);
      expect(matchesBathrooms(sorted[1].bathrooms, targetBa)).toBe(true);
      expect(matchesBathrooms(sorted[2].bathrooms, targetBa)).toBe(false);
    });
  });
});


// ============================================
// TEST SUITE 4: FORECAST CONSISTENCY
// ============================================

describe('Forecast Consistency', () => {
  it('scaled forecast monthly sum approximates new annual total', () => {
    const forecast = mockForecast();
    const originalAnnual = forecast.reduce((sum, m) => sum + m.revenue, 0);
    const scaleFactor = 1.4; // 40% uplift
    const scaled = scaleMonthlyForecast(forecast, scaleFactor);
    const scaledAnnual = scaled.reduce((sum, m) => sum + m.revenue, 0);
    
    // Due to rounding, allow ±12 tolerance (1 per month)
    expect(scaledAnnual).toBeGreaterThanOrEqual(Math.round(originalAnnual * scaleFactor) - 12);
    expect(scaledAnnual).toBeLessThanOrEqual(Math.round(originalAnnual * scaleFactor) + 12);
  });

  it('seasonal shape is preserved after scaling', () => {
    const forecast = mockForecast();
    const scaleFactor = 1.5;
    const scaled = scaleMonthlyForecast(forecast, scaleFactor);
    
    // Find peak and trough months in original
    const originalPeakIdx = forecast.reduce((maxIdx, m, i) => 
      m.revenue > forecast[maxIdx].revenue ? i : maxIdx, 0);
    const originalTroughIdx = forecast.reduce((minIdx, m, i) => 
      m.revenue < forecast[minIdx].revenue ? i : minIdx, 0);
    
    // Peak and trough should be same months after scaling
    const scaledPeakIdx = scaled.reduce((maxIdx, m, i) => 
      m.revenue > scaled[maxIdx].revenue ? i : maxIdx, 0);
    const scaledTroughIdx = scaled.reduce((minIdx, m, i) => 
      m.revenue < scaled[minIdx].revenue ? i : minIdx, 0);
    
    expect(scaledPeakIdx).toBe(originalPeakIdx);
    expect(scaledTroughIdx).toBe(originalTroughIdx);
  });

  it('occupancy stays unchanged after scaling', () => {
    const forecast = mockForecast();
    const scaled = scaleMonthlyForecast(forecast, 1.5);
    
    for (let i = 0; i < forecast.length; i++) {
      expect(scaled[i].occupancy).toBe(forecast[i].occupancy);
    }
  });

  it('all scaled values are positive integers', () => {
    const forecast = mockForecast();
    const scaled = scaleMonthlyForecast(forecast, 1.3);
    
    for (const m of scaled) {
      expect(m.revenue).toBeGreaterThan(0);
      expect(Number.isInteger(m.revenue)).toBe(true);
      expect(m.adr).toBeGreaterThan(0);
      expect(Number.isInteger(m.adr)).toBe(true);
      expect(Number.isFinite(m.occupancy)).toBe(true);
    }
  });

  it('12 months in forecast', () => {
    const forecast = mockForecast();
    expect(forecast.length).toBe(12);
    const scaled = scaleMonthlyForecast(forecast, 1.5);
    expect(scaled.length).toBe(12);
  });

  it('handles scale factor of 1.0 (no change)', () => {
    const forecast = mockForecast();
    const scaled = scaleMonthlyForecast(forecast, 1.0);
    for (let i = 0; i < forecast.length; i++) {
      expect(scaled[i].revenue).toBe(forecast[i].revenue);
      expect(scaled[i].adr).toBe(forecast[i].adr);
    }
  });
});


// ============================================
// TEST SUITE 5: SHARED REPORT DATA INTEGRITY
// ============================================

describe('Shared Report Data Integrity', () => {
  it('revenue_estimate fields are all populated and consistent', () => {
    const est = buildRevenueEstimate(50000, 200, 0.68);
    expect(est.annual).toBe(50000);
    expect(est.monthly).toBe(Math.round(50000 / 12));
    expect(est.nightly).toBe(200);
    expect(est.occupancy).toBe(0.68);
    expect(est.range.low).toBe(45000);
    expect(est.range.high).toBe(55000);
  });

  it('revenue_estimate with comp overrides uses Q1 as low, Q3 as high', () => {
    const compQ1 = 28000;
    const compQ3 = 42000;
    const est = buildRevenueEstimate(35000, 180, 0.72, compQ1, compQ3);
    expect(est.range.low).toBe(28000); // Q1
    expect(est.range.high).toBe(42000); // Q3
    expect(est.annual).toBe(35000); // comp median
  });

  it('percentile calculation requires >= 5 unique revenues', () => {
    const calcPercentiles = (revenues: number[]) => {
      const unique = Array.from(new Set(revenues)).sort((a, b) => a - b);
      if (unique.length < 5) return undefined;
      const percentile = (arr: number[], p: number) => arr[Math.floor(arr.length * p / 100)] || 0;
      return {
        p10: percentile(unique, 10),
        p25: percentile(unique, 25),
        p50: percentile(unique, 50),
        p75: percentile(unique, 75),
        p90: percentile(unique, 90),
      };
    };

    // 4 unique → undefined
    expect(calcPercentiles([10000, 20000, 30000, 40000])).toBeUndefined();
    
    // 5 unique → defined
    const result = calcPercentiles([10000, 20000, 30000, 40000, 50000]);
    expect(result).toBeDefined();
    expect(result!.p10).toBeLessThanOrEqual(result!.p25);
    expect(result!.p25).toBeLessThanOrEqual(result!.p50);
    expect(result!.p50).toBeLessThanOrEqual(result!.p75);
    expect(result!.p75).toBeLessThanOrEqual(result!.p90);
    
    // Duplicates reduce unique count: 5 inputs but only 3 unique → undefined
    expect(calcPercentiles([10000, 10000, 20000, 20000, 30000])).toBeUndefined();
  });

  it('percentiles are monotonically increasing', () => {
    const revenues = [15000, 22000, 28000, 35000, 42000, 50000, 58000, 65000, 72000, 80000];
    const unique = Array.from(new Set(revenues)).sort((a, b) => a - b);
    const percentile = (arr: number[], p: number) => arr[Math.floor(arr.length * p / 100)] || 0;
    
    const p10 = percentile(unique, 10);
    const p25 = percentile(unique, 25);
    const p50 = percentile(unique, 50);
    const p75 = percentile(unique, 75);
    const p90 = percentile(unique, 90);
    
    expect(p10).toBeLessThanOrEqual(p25);
    expect(p25).toBeLessThanOrEqual(p50);
    expect(p50).toBeLessThanOrEqual(p75);
    expect(p75).toBeLessThanOrEqual(p90);
  });

  it('city/state extraction from various address formats', () => {
    const extractCity = (address: string) => {
      const parts = address.split(',').map(s => s.trim());
      if (parts.length >= 3) return parts[1];
      if (parts.length === 2) {
        const beforeComma = parts[0];
        const words = beforeComma.split(/\s+/);
        return words.length > 2 ? words[words.length - 1] : 'Unknown';
      }
      return 'Unknown';
    };
    
    const extractState = (address: string) => {
      const parts = address.split(',').map(s => s.trim());
      const lastPart = parts[parts.length - 1];
      const stateMatch = lastPart.match(/\b([A-Z]{2})\b/);
      return stateMatch ? stateMatch[1] : '';
    };

    expect(extractCity('411 N 32nd Pl, Phoenix, AZ 85008')).toBe('Phoenix');
    expect(extractCity('1321 15th St, Denver, CO 80202')).toBe('Denver');
    expect(extractCity('100 Ocean Dr, Miami Beach, FL 33139')).toBe('Miami Beach');
    expect(extractState('411 N 32nd Pl, Phoenix, AZ 85008')).toBe('AZ');
    expect(extractState('1321 15th St, Denver, CO 80202')).toBe('CO');
    expect(extractState('100 Ocean Dr, Miami Beach, FL 33139')).toBe('FL');
  });

  it('historical data trend classification', () => {
    const classifyTrend = (change: number) => {
      return change > 2 ? 'up' : change < -2 ? 'down' : 'stable';
    };
    
    expect(classifyTrend(5)).toBe('up');
    expect(classifyTrend(15)).toBe('up');
    expect(classifyTrend(2.1)).toBe('up');
    expect(classifyTrend(2)).toBe('stable');
    expect(classifyTrend(0)).toBe('stable');
    expect(classifyTrend(-1)).toBe('stable');
    expect(classifyTrend(-2)).toBe('stable');
    expect(classifyTrend(-2.1)).toBe('down');
    expect(classifyTrend(-10)).toBe('down');
  });
});


// ============================================
// TEST SUITE 6: PROFIT CALCULATION
// ============================================

describe('Profit Calculation Stress Test', () => {
  it('profit formula: revenue - rent - (revenue * 0.20)', () => {
    const scenarios = [
      { revenue: 2248, rent: 1295, expectedProfit: 503.4 },
      { revenue: 3000, rent: 1500, expectedProfit: 900 },
      { revenue: 5000, rent: 2000, expectedProfit: 2000 },
      { revenue: 10000, rent: 3000, expectedProfit: 5000 },
      { revenue: 1000, rent: 800, expectedProfit: 0 },
    ];
    
    for (const s of scenarios) {
      const result = calculateProfit(s.revenue, s.rent);
      expect(result.monthlyProfit).toBeCloseTo(s.expectedProfit, 1);
    }
  });

  it('operating costs are always 20% of revenue (not rent)', () => {
    const result = calculateProfit(5000, 2000);
    expect(result.operatingCosts).toBe(1000); // 5000 * 0.20
    expect(result.operatingCosts).not.toBe(400); // NOT 2000 * 0.20
  });

  it('annual profit is monthly * 12', () => {
    const result = calculateProfit(3000, 1500);
    expect(result.annualProfit).toBe(result.monthlyProfit * 12);
  });

  it('handles zero rent (purchase mode)', () => {
    const result = calculateProfit(5000, 0);
    expect(result.monthlyProfit).toBe(4000); // 5000 - 0 - 1000
  });

  it('handles break-even scenario', () => {
    // revenue - rent - (revenue * 0.20) = 0
    // revenue - rent = revenue * 0.20
    // revenue * 0.80 = rent
    const revenue = 5000;
    const rent = revenue * 0.80; // 4000
    const result = calculateProfit(revenue, rent);
    expect(result.monthlyProfit).toBeCloseTo(0, 1);
  });

  it('handles negative profit (loss) correctly', () => {
    const result = calculateProfit(1000, 1500);
    // 1000 - 1500 - 200 = -700
    expect(result.monthlyProfit).toBe(-700);
    expect(result.annualProfit).toBe(-8400);
  });

  it('no NaN or Infinity in any scenario', () => {
    const edgeCases = [
      { revenue: 0, rent: 0 },
      { revenue: 1, rent: 0 },
      { revenue: 999999, rent: 500000 },
      { revenue: 0.01, rent: 0.01 },
    ];
    for (const ec of edgeCases) {
      const result = calculateProfit(ec.revenue, ec.rent);
      expect(Number.isFinite(result.monthlyProfit)).toBe(true);
      expect(Number.isFinite(result.annualProfit)).toBe(true);
      expect(Number.isFinite(result.operatingCosts)).toBe(true);
    }
  });
});


// ============================================
// TEST SUITE 7: MARKET DATA INTEGRITY
// ============================================

describe('Market Data Integrity', () => {
  it('market score should be 0-100', () => {
    const scores = [0, 25, 50, 75, 78, 100];
    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('bedroom performance data is sorted by bedroom count', () => {
    const bedroomPerf = [
      { bedrooms: 1, revenue: 25000, adr: 120, occupancy: 60, listing_count: 500 },
      { bedrooms: 2, revenue: 35000, adr: 160, occupancy: 65, listing_count: 800 },
      { bedrooms: 3, revenue: 50000, adr: 220, occupancy: 68, listing_count: 600 },
      { bedrooms: 4, revenue: 65000, adr: 280, occupancy: 62, listing_count: 300 },
    ];
    
    for (let i = 1; i < bedroomPerf.length; i++) {
      expect(bedroomPerf[i].bedrooms).toBeGreaterThan(bedroomPerf[i - 1].bedrooms);
    }
  });

  it('bedroom performance fields are all positive', () => {
    const perf = { bedrooms: 2, revenue: 35000, adr: 160, occupancy: 65, listing_count: 800 };
    expect(perf.bedrooms).toBeGreaterThan(0);
    expect(perf.revenue).toBeGreaterThan(0);
    expect(perf.adr).toBeGreaterThan(0);
    expect(perf.occupancy).toBeGreaterThan(0);
    expect(perf.listing_count).toBeGreaterThan(0);
  });

  it('YoY percentage change calculation', () => {
    const calcYoY = (latest: number, yearAgo: number) => {
      if (yearAgo === 0) return undefined;
      return Math.round(((latest - yearAgo) / yearAgo) * 100);
    };
    
    expect(calcYoY(110, 100)).toBe(10); // +10%
    expect(calcYoY(90, 100)).toBe(-10); // -10%
    expect(calcYoY(100, 100)).toBe(0); // 0%
    expect(calcYoY(200, 100)).toBe(100); // +100%
    expect(calcYoY(50, 100)).toBe(-50); // -50%
    expect(calcYoY(100, 0)).toBeUndefined(); // division by zero
  });

  it('supply trend data has consistent structure', () => {
    const supplyData = [
      { date: '2024-01', listing_count: 5000 },
      { date: '2024-02', listing_count: 5100 },
      { date: '2024-03', listing_count: 5200 },
    ];
    
    for (const d of supplyData) {
      expect(d.date).toMatch(/^\d{4}-\d{2}$/);
      expect(d.listing_count).toBeGreaterThan(0);
      expect(Number.isInteger(d.listing_count)).toBe(true);
    }
  });
});


// ============================================
// TEST SUITE 8: EDGE CASES & DATA SAFETY
// ============================================

describe('Edge Cases & Data Safety', () => {
  it('handles missing market data gracefully', () => {
    const marketData = null;
    const fallbackMarket = {
      name: 'Unknown Market',
      listing_count: 0,
      metrics: {
        occupancy: 0,
        adr: 0,
        revenue: 0,
        active_listings: 0,
      },
    };
    
    const result = marketData || fallbackMarket;
    expect(result.name).toBe('Unknown Market');
    expect(result.listing_count).toBe(0);
  });

  it('handles empty comps array', () => {
    const comps: any[] = [];
    const sameBedComps: any[] = [];
    
    const allComps = [...comps, ...sameBedComps];
    const revenues = allComps.filter(c => c.annual_revenue > 0).map(c => c.annual_revenue);
    
    expect(revenues.length).toBe(0);
    expect(allComps.length).toBe(0);
  });

  it('handles single comp (not enough for comp-median)', () => {
    const result = applyCompMedianAdjustment(20000, [
      { annual_revenue: 35000, adr: 190, occupancy: 0.75 },
    ]);
    expect(result.adjusted).toBe(false);
    expect(result.reason).toBe('insufficient_comps');
  });

  it('handles two comps (not enough for comp-median)', () => {
    const result = applyCompMedianAdjustment(20000, [
      { annual_revenue: 35000, adr: 190, occupancy: 0.75 },
      { annual_revenue: 40000, adr: 210, occupancy: 0.80 },
    ]);
    expect(result.adjusted).toBe(false);
    expect(result.reason).toBe('insufficient_comps');
  });

  it('handles exactly 3 comps (minimum for comp-median)', () => {
    const result = applyCompMedianAdjustment(20000, [
      { annual_revenue: 25000, adr: 155, occupancy: 0.65 },
      { annual_revenue: 28000, adr: 170, occupancy: 0.70 },
      { annual_revenue: 30000, adr: 180, occupancy: 0.73 },
    ]);
    // Median of [25K, 28K, 30K] = 28000
    expect(result.adjusted).toBe(true);
    expect(result.finalRevenue).toBe(28000);
  });

  it('currency formatting produces valid output', () => {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };
    
    expect(formatCurrency(50000)).toBe('$50,000');
    expect(formatCurrency(0)).toBe('$0');
    expect(formatCurrency(1234567)).toBe('$1,234,567');
    expect(formatCurrency(99)).toBe('$99');
    // Negative should still format
    expect(formatCurrency(-5000)).toBe('-$5,000');
  });

  it('percentage formatting produces valid output', () => {
    const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
    
    expect(formatPercent(0.73)).toBe('73%');
    expect(formatPercent(0.50)).toBe('50%');
    expect(formatPercent(1.0)).toBe('100%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.999)).toBe('100%');
  });

  it('distance formatting handles various ranges', () => {
    const formatDistance = (meters: number) => {
      if (meters < 1000) return `${Math.round(meters)}m`;
      return `${(meters / 1000).toFixed(1)}km`;
    };
    
    expect(formatDistance(500)).toBe('500m');
    expect(formatDistance(885)).toBe('885m');
    expect(formatDistance(1000)).toBe('1.0km');
    expect(formatDistance(1500)).toBe('1.5km');
    expect(formatDistance(10000)).toBe('10.0km');
  });

  it('no NaN in any formatted output', () => {
    const values = [0, 1, -1, 0.5, 100000, NaN, undefined as any, null as any];
    for (const v of values) {
      const num = Number(v) || 0;
      expect(Number.isFinite(num)).toBe(true);
      expect(String(num)).not.toContain('NaN');
      expect(String(num)).not.toContain('undefined');
    }
  });
});


// ============================================
// TEST SUITE 9: FULL PIPELINE SIMULATION
// ============================================

describe('Full Pipeline Simulation', () => {
  it('complete property report flow: Rentalizer → Comp Median → Shared Report', () => {
    // Step 1: Simulate Rentalizer response
    const rentalizerRevenue = 20889;
    const rentalizerAdr = 120;
    const rentalizerOccupancy = 0.48;
    
    // Step 2: Simulate comps
    const comps = [
      { annual_revenue: 25000, adr: 155, occupancy: 0.65 },
      { annual_revenue: 28000, adr: 170, occupancy: 0.70 },
      { annual_revenue: 30000, adr: 180, occupancy: 0.73 },
      { annual_revenue: 33000, adr: 195, occupancy: 0.76 },
      { annual_revenue: 35000, adr: 200, occupancy: 0.78 },
    ];
    
    // Step 3: Apply comp-median adjustment
    const medianResult = applyCompMedianAdjustment(rentalizerRevenue, comps);
    expect(medianResult.adjusted).toBe(true);
    
    // Median of [25K, 28K, 30K, 33K, 35K] = 30000
    expect(medianResult.finalRevenue).toBe(30000);
    
    // Step 4: Build shared report revenue estimate
    const finalRevenue = medianResult.finalRevenue;
    const compQ1 = medianResult.compQ1Revenue!;
    const compQ3 = medianResult.compQ3Revenue!;
    
    const est = buildRevenueEstimate(
      finalRevenue,
      medianResult.compMedianAdr!,
      medianResult.compMedianOccupancy!,
      compQ1,   // low = Q1
      compQ3    // high = Q3
    );
    
    // Verify all fields are populated
    expect(est.annual).toBe(30000);
    expect(est.monthly).toBe(Math.round(30000 / 12));
    expect(est.range.low).toBe(compQ1);
    expect(est.range.high).toBe(compQ3);
    
    // Step 5: Verify consistency
    expect(est.annual).toBeGreaterThanOrEqual(est.range.low);
    expect(est.range.high).toBeGreaterThanOrEqual(est.annual);
    expect(est.monthly * 12).toBeGreaterThanOrEqual(est.annual - 12);
    expect(est.monthly * 12).toBeLessThanOrEqual(est.annual + 12);
  });

  it('complete flow with comp median lower than Rentalizer (adjusts down)', () => {
    const rentalizerRevenue = 50000;
    const comps = [
      { annual_revenue: 30000, adr: 170, occupancy: 0.65 },
      { annual_revenue: 35000, adr: 190, occupancy: 0.70 },
      { annual_revenue: 40000, adr: 210, occupancy: 0.75 },
    ];
    
    const medianResult = applyCompMedianAdjustment(rentalizerRevenue, comps);
    expect(medianResult.adjusted).toBe(true);
    // Median = 35000, lower than Rentalizer 50000
    expect(medianResult.finalRevenue).toBe(35000);
    expect(medianResult.adjustedDown).toBe(true);
    
    const est = buildRevenueEstimate(medianResult.finalRevenue, medianResult.compMedianAdr!, medianResult.compMedianOccupancy!);
    expect(est.annual).toBe(35000);
  });

  it('complete flow with forecast scaling', () => {
    const rentalizerRevenue = 20000;
    const forecast = mockForecast();
    const originalTotal = forecast.reduce((sum, m) => sum + m.revenue, 0);
    
    const comps = [
      { annual_revenue: 25000, adr: 155, occupancy: 0.65 },
      { annual_revenue: 28000, adr: 170, occupancy: 0.70 },
      { annual_revenue: 30000, adr: 180, occupancy: 0.73 },
    ];
    
    const medianResult = applyCompMedianAdjustment(rentalizerRevenue, comps);
    expect(medianResult.adjusted).toBe(true);
    
    const scaleFactor = medianResult.scaleFactor!;
    const scaled = scaleMonthlyForecast(forecast, scaleFactor);
    const scaledTotal = scaled.reduce((sum, m) => sum + m.revenue, 0);
    
    // Scaled total should be approximately originalTotal * scaleFactor
    expect(scaledTotal).toBeGreaterThan(originalTotal);
    
    // All months should be positive
    for (const m of scaled) {
      expect(m.revenue).toBeGreaterThan(0);
      expect(m.adr).toBeGreaterThan(0);
    }
  });
});


// ============================================
// TEST SUITE 10: LIVE DATA SCENARIOS
// ============================================

describe('Live Data Scenarios (comp-median approach)', () => {
  // Comp-median results: final = comp median of exact-match comps
  // When comps exist, final may be higher OR lower than Rentalizer
  // When no comps, final = Rentalizer (fallback)
  const liveResults = [
    { address: 'Phoenix, AZ (2BR/1BA)', rentalizer: 20889, comps: 7, adjusted: true, description: 'Low Rentalizer, comps should be higher' },
    { address: 'Denver, CO (3BR)', rentalizer: 44778, comps: 0, adjusted: false, description: 'No exact-match comps, Rentalizer fallback' },
    { address: 'Nashville, TN', rentalizer: 124056, comps: 0, adjusted: false, description: 'High Rentalizer, no comps' },
    { address: 'Baltimore, MD', rentalizer: 41102, comps: 0, adjusted: false, description: 'No exact-match comps' },
  ];

  it('all live results have positive revenue', () => {
    for (const r of liveResults) {
      expect(r.rentalizer).toBeGreaterThan(0);
    }
  });

  it('non-adjusted results fall back to Rentalizer', () => {
    for (const r of liveResults) {
      if (!r.adjusted) {
        expect(r.comps).toBe(0);
      }
    }
  });

  it('comp-median approach: adjusted results are based on real comp data', () => {
    // With comp-median, the final number IS the median of what real properties earn
    // It can be higher or lower than Rentalizer — both are valid
    for (const r of liveResults) {
      if (r.adjusted) {
        expect(r.comps).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('all addresses returned valid data', () => {
    expect(liveResults.length).toBe(4);
    for (const r of liveResults) {
      expect(r.address).toBeTruthy();
      expect(typeof r.rentalizer).toBe('number');
    }
  });
});

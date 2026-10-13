import { describe, it, expect } from 'vitest';
import { arbStartupCost, buildDealFacts, findTopEarnerAmenities, looksActive, parseDealBrief, projectionFromEstimate } from './deal-brief';
import type { RentalizerResponse } from './airdna';
import type { BnbCalcArbAnalysis } from './bnbcalc';

// Boosted estimate as getBnbCalcEstimate returns it (p75 × 1.3)
const estimate = {
  property: { address: '1 Main St', bedrooms: 2, bathrooms: 1, accommodates: 6 },
  estimates: {
    annual_revenue: 60_000,
    annual_revenue_low: 39_000,
    annual_revenue_high: 78_000,
    average_daily_rate: 260,
    occupancy_rate: 0.6,
    currency: 'USD',
    currency_symbol: '$',
  },
  comps: [
    { title: 'Boosted comp', annual_revenue: 52_000, adr: 260, occupancy: 0.55, bedrooms: 2, airbnb_url: 'https://www.airbnb.com/rooms/1' },
  ],
} as unknown as RentalizerResponse;

const arb = {
  _id: 'x',
  url: 'https://www.bnbcalc.com/analysis/x',
  ratePerNightUSD: 200,
  occupancyRatePercentage: 50,
  revenue: { p25: 30_000, p50: 36_000, p75: 46_000, p90: 55_000, avg: 38_000 },
  adr: { p25: 150, p50: 180, p75: 200, p90: 240, avg: 185 },
  occupancy: { p25: 0.4, p50: 0.5, p75: 0.6, p90: 0.7, avg: 0.5 },
  comparables: [
    { airbnbId: '9', name: 'Real comp', annualRevenueUSD: 41_000, occupancyRatePercentage: 58, averageDailyRateUSD: 195, distanceMiles: 0.4 },
  ],
  monthlyRentUSD: 1500,
  monthlyRevenueUSD: 4000,
  monthlyExpensesUSD: 1200, // 30%
  yearOneRevenueUSD: 48_000,
  yearOneCashFlowUSD: 15_600,
  totalCashInvestment: 6000,
} as BnbCalcArbAnalysis;

describe('arbStartupCost', () => {
  it('uses our launch budget table', () => {
    expect(arbStartupCost(0)).toBe(15_000);
    expect(arbStartupCost(1)).toBe(15_000);
    expect(arbStartupCost(2)).toBe(20_000);
    expect(arbStartupCost(3)).toBe(25_000);
    expect(arbStartupCost(4)).toBe(30_000);
  });
});

describe('buildDealFacts', () => {
  it('uses the optimized projection with BNB Calc AI expenses and raw comps', () => {
    const f = buildDealFacts({ bedrooms: 2, bathrooms: 1, monthlyRent: 1500, projection: projectionFromEstimate(estimate, 1.3), arb });
    expect(f.monthlyRevenue).toBe(5000);
    expect(f.expenseRatio).toBeCloseTo(0.3);
    expect(f.expenseSource).toBe('bnbcalc_ai');
    expect(f.monthlyExpenses).toBe(1500);
    expect(f.monthlyProfit).toBe(2000);
    expect(f.dataModelMonthlyRevenue).toBe(3000); // arb p50 / 12
    expect(f.slowYearMonthlyProfit).toBe(Math.round(2500 * 0.7 - 1500)); // arb p25 / 12
    // revenue needed ÷ revenue at 60% booked, scaled to 60%
    expect(f.breakEvenOccupancy).toBeCloseTo(0.6 * (1500 / 0.7) / 5000);
    expect(f.adr).toBe(Math.round(5000 / (0.6 * 30.4)));
    expect(f.marketMedianOccupancy).toBe(0.5);
    expect(f.startupCost).toBe(20_000);
    expect(f.paybackMonths).toBe(10);
    expect(f.annualCashOnCash).toBeCloseTo(1.2);
    expect(f.comps[0]).toMatchObject({ title: 'Real comp', annualRevenue: 41_000, occupancy: 0.58, url: 'https://www.airbnb.com/rooms/9' });
  });

  it('falls back to 20% expenses and un-boosted estimate comps without an arb analysis', () => {
    const f = buildDealFacts({ bedrooms: 2, bathrooms: 1, monthlyRent: 1500, projection: projectionFromEstimate(estimate, 1.3), arb: null });
    expect(f.expenseRatio).toBe(0.2);
    expect(f.expenseSource).toBe('default');
    expect(f.monthlyProfit).toBe(2500);
    expect(f.comps[0].annualRevenue).toBe(40_000);
    expect(f.comps[0].adr).toBe(200);
  });

  it('has no payback when the deal loses money', () => {
    const f = buildDealFacts({ bedrooms: 2, bathrooms: 1, monthlyRent: 6000, projection: projectionFromEstimate(estimate, 1.3), arb });
    expect(f.monthlyProfit).toBeLessThan(0);
    expect(f.paybackMonths).toBeNull();
  });
});

describe('looksActive', () => {
  const l90d = (days_reserved: number, revenue: number) =>
    ({ metrics: { l90d: { days_reserved, revenue } as any } });

  it('drops comps with no bookings in the last 90 days', () => {
    expect(looksActive(l90d(0, 0))).toBe(false);
    expect(looksActive(l90d(12, 3000))).toBe(true);
    expect(looksActive({})).toBe(true); // no data to judge on
  });

  it('keeps dead comps out of the client page', () => {
    const withDead = {
      ...arb,
      comparables: [
        { airbnbId: '1', name: 'Dead', annualRevenueUSD: 90_000, ...l90d(0, 0) },
        { airbnbId: '2', name: 'Live', annualRevenueUSD: 40_000, ...l90d(20, 4000) },
      ],
    } as BnbCalcArbAnalysis;
    const f = buildDealFacts({ bedrooms: 2, bathrooms: 1, monthlyRent: 1500, projection: projectionFromEstimate(estimate, 1.3), arb: withDead });
    expect(f.comps.map(c => c.title)).toEqual(['Live']);
  });
});

describe('findTopEarnerAmenities', () => {
  it('surfaces amenities far more common among top earners', () => {
    const comps = [80, 75, 70, 40, 35, 30].map((k, i) => ({
      annualRevenueUSD: k * 1000,
      amenities_raw: i < 3 ? ['Wifi', 'Hot tub'] : ['Wifi'],
    }));
    const result = findTopEarnerAmenities(comps);
    expect(result.map(a => a.amenity)).toEqual(['Hot tub']);
  });

  it('says nothing with too few comps', () => {
    expect(findTopEarnerAmenities([{ annualRevenueUSD: 1, amenities_raw: ['Pool'] }])).toEqual([]);
  });
});

describe('parseDealBrief', () => {
  it('parses JSON wrapped in fences and drops empty items', () => {
    const brief = parseDealBrief('```json\n{"headline":"Clears rent at 34% booked","summary":"s","whyItWorks":["a",""],"upsideMoves":[{"move":"Hot tub","why":"w"},{}],"watchOuts":[],"closingNote":"c"}\n```');
    expect(brief?.headline).toBe('Clears rent at 34% booked');
    expect(brief?.whyItWorks).toEqual(['a']);
    expect(brief?.upsideMoves).toEqual([{ move: 'Hot tub', why: 'w' }]);
  });

  it('rejects replies without a headline or reasons', () => {
    expect(parseDealBrief('no json here')).toBeNull();
    expect(parseDealBrief('{"headline":"","whyItWorks":[]}')).toBeNull();
  });
});

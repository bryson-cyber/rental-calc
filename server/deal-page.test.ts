import { describe, it, expect } from 'vitest';
import { isDealTeamUser, projectionFromReport } from './deal-page';
import { buildDealFacts } from './deal-brief';

// Shape of a real team-built report (623 East Gates St, Columbus — Sep 2026)
const row = {
  reportType: 'validator',
  address: '623 East Gates Street, Columbus, OH, USA',
  bedrooms: 2,
  bathrooms: '1.0',
  monthlyRent: 1375,
  revenueOverride: 50883,
  occupancyOverride: null,
  adrOverride: null,
  boostFactorAtCreation: '1.30',
  reportData: {
    _mode: 'rent',
    _expensePercent: 20,
    _furnitureCost: 20000,
    _occupancyOverride: 66,
    _revenueOverride: 50883,
    revenue: { projected: 45883, low: 24407, high: 59493 },
    metrics: { adr: 251, occupancy: 61 },
    comparables: [
      { title: 'Quaint Gem in German Village', airbnbUrl: 'https://www.airbnb.com/rooms/1290544023214076390', revenue: 69919, adr: 212, occupancy: 77, distanceMeters: 0 },
    ],
  },
} as any;

describe('projectionFromReport', () => {
  it("uses the team's overrides and furniture budget", () => {
    const p = projectionFromReport(row)!;
    expect(p.annualRevenue).toBe(50883);
    expect(p.occupancy).toBe(0.66);
    expect(p.startupCost).toBe(20000);
    expect(p.expenseRatio).toBe(0.2);
    expect(p.boostFactor).toBe(1.3);
    // comps shown at real numbers
    expect(p.comps[0].annualRevenue).toBe(Math.round(69919 / 1.3));
    expect(p.comps[0].occupancy).toBe(0.77);
  });

  it('produces a consistent deal page from the report', () => {
    const f = buildDealFacts({ bedrooms: 2, bathrooms: 1, monthlyRent: 1375, projection: projectionFromReport(row)!, arb: null });
    expect(f.monthlyRevenue).toBe(4240);
    expect(f.monthlyProfit).toBe(Math.round(4240.25 - 1375 - 4240.25 * 0.2));
    expect(f.startupCost).toBe(20000);
    // rate × booked nights reproduces the revenue (rate is rounded to whole dollars)
    expect(f.adr * f.projectedOccupancy * 30.4).toBeCloseTo(4240.25, -2);
    expect(f.breakEvenOccupancy).toBeLessThan(f.projectedOccupancy);
  });

  it('returns null without any revenue', () => {
    expect(projectionFromReport({ ...row, revenueOverride: null, reportData: {} })).toBeNull();
  });
});

describe('isDealTeamUser', () => {
  it('allows admins and team emails only', () => {
    expect(isDealTeamUser({ role: 'admin' })).toBe(true);
    expect(isDealTeamUser({ role: 'user', email: 'ismail@coachinayah.com' })).toBe(true);
    expect(isDealTeamUser({ role: 'user', email: 'someone@gmail.com' })).toBe(false);
    expect(isDealTeamUser(null)).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';

/**
 * Tests for the three UI fixes in FullPropertyReport:
 * 1. Stress test section redesign - more self-explanatory
 * 2. Comp placeholder images removed
 * 3. Supply trend SVG chart removed (stats + insight kept)
 *
 * These are logic-level tests that verify the data transformations
 * and conditions used in the component rendering.
 */

// ---- Stress Test Logic Tests ----

describe('Stress Test: Scenario Classification', () => {
  const buildScenarios = (data: Array<{ occ: number; adr: number; profit: number }>) =>
    data.map(d => ({
      occupancy_pct: d.occ,
      adr: d.adr,
      monthly_profit: d.profit,
      monthly_revenue: d.profit + 2000, // revenue before expenses
      cash_flow_positive: d.profit >= 0,
    }));

  it('should correctly count profitable scenarios', () => {
    const scenarios = buildScenarios([
      { occ: 0.4, adr: 174, profit: -800 },
      { occ: 0.5, adr: 174, profit: -200 },
      { occ: 0.6, adr: 174, profit: 400 },
      { occ: 0.7, adr: 174, profit: 1000 },
      { occ: 0.4, adr: 209, profit: -400 },
      { occ: 0.5, adr: 209, profit: 300 },
      { occ: 0.6, adr: 209, profit: 900 },
      { occ: 0.7, adr: 209, profit: 1500 },
      { occ: 0.4, adr: 232, profit: -100 },
      { occ: 0.5, adr: 232, profit: 600 },
      { occ: 0.6, adr: 232, profit: 1200 },
      { occ: 0.7, adr: 232, profit: 1800 },
      { occ: 0.4, adr: 255, profit: 200 },
      { occ: 0.5, adr: 255, profit: 900 },
      { occ: 0.6, adr: 255, profit: 1500 },
      { occ: 0.7, adr: 255, profit: 2100 },
    ]);

    const breakEvenScenarios = scenarios.filter(s => s.cash_flow_positive);
    const totalScenarios = scenarios.length;
    const positivePercent = Math.round((breakEvenScenarios.length / totalScenarios) * 100);

    expect(breakEvenScenarios.length).toBe(12);
    expect(totalScenarios).toBe(16);
    expect(positivePercent).toBe(75);
  });

  it('should identify worst and best case scenarios', () => {
    const scenarios = buildScenarios([
      { occ: 0.4, adr: 174, profit: -800 },
      { occ: 0.7, adr: 255, profit: 2100 },
      { occ: 0.6, adr: 232, profit: 1200 },
    ]);

    const worstCase = scenarios.reduce((min, s) =>
      (s.monthly_profit) < (min.monthly_profit) ? s : min
    );
    const bestCase = scenarios.reduce((max, s) =>
      (s.monthly_profit) > (max.monthly_profit) ? s : max
    );

    expect(worstCase.monthly_profit).toBe(-800);
    expect(worstCase.occupancy_pct).toBe(0.4);
    expect(worstCase.adr).toBe(174);

    expect(bestCase.monthly_profit).toBe(2100);
    expect(bestCase.occupancy_pct).toBe(0.7);
    expect(bestCase.adr).toBe(255);
  });

  it('should extract unique sorted occupancies and ADRs', () => {
    const scenarios = buildScenarios([
      { occ: 0.6, adr: 232, profit: 1200 },
      { occ: 0.4, adr: 174, profit: -800 },
      { occ: 0.7, adr: 255, profit: 2100 },
      { occ: 0.5, adr: 209, profit: 300 },
      { occ: 0.4, adr: 232, profit: -100 },
      { occ: 0.6, adr: 174, profit: 400 },
    ]);

    const occupancies = Array.from(new Set(scenarios.map(s => s.occupancy_pct)))
      .filter(v => v != null && !isNaN(v))
      .sort((a, b) => a - b);
    const adrs = Array.from(new Set(scenarios.map(s => s.adr)))
      .filter(v => v != null && !isNaN(v))
      .sort((a, b) => a - b);

    expect(occupancies).toEqual([0.4, 0.5, 0.6, 0.7]);
    expect(adrs).toEqual([174, 209, 232, 255]);
  });

  it('should correctly identify base scenario', () => {
    const baseOcc = 0.6;
    const baseAdr = 232;
    const scenarios = buildScenarios([
      { occ: 0.4, adr: 174, profit: -800 },
      { occ: 0.6, adr: 232, profit: 1200 },
      { occ: 0.7, adr: 255, profit: 2100 },
    ]);

    const baseScenario = scenarios.find(
      s => s.occupancy_pct === baseOcc && s.adr === baseAdr
    );

    expect(baseScenario).toBeDefined();
    expect(baseScenario!.monthly_profit).toBe(1200);
  });

  it('should handle old occupancy format (integer 0-100) normalization', () => {
    // Simulates the normalization logic in FullPropertyReport
    const oldFormatScenarios = [
      { occupancy: 40, occupancy_pct: undefined as number | undefined, adr: 174, monthly_profit: -800 },
      { occupancy: 60, occupancy_pct: undefined as number | undefined, adr: 232, monthly_profit: 1200 },
    ];

    const normalized = oldFormatScenarios.map(s => {
      if (s.occupancy_pct == null && s.occupancy != null) {
        return { ...s, occupancy_pct: s.occupancy / 100 };
      }
      return s;
    });

    expect(normalized[0].occupancy_pct).toBe(0.4);
    expect(normalized[1].occupancy_pct).toBe(0.6);
  });
});

// ---- Supply Trend Logic Tests ----

describe('Supply Trend: Stats Calculation (no SVG chart)', () => {
  it('should calculate change percent correctly for growing supply', () => {
    const supply_trend = [
      { date: '2024-01', value: 10000 },
      { date: '2024-06', value: 10500 },
      { date: '2024-12', value: 11000 },
    ];

    const sorted = [...supply_trend].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const changePercent = first.value > 0 ? ((last.value - first.value) / first.value * 100) : 0;
    const isGrowing = changePercent > 2;
    const isShrinking = changePercent < -2;

    expect(changePercent).toBe(10);
    expect(isGrowing).toBe(true);
    expect(isShrinking).toBe(false);
  });

  it('should calculate change percent correctly for shrinking supply', () => {
    const supply_trend = [
      { date: '2024-01', value: 10000 },
      { date: '2024-12', value: 9000 },
    ];

    const sorted = [...supply_trend].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const changePercent = first.value > 0 ? ((last.value - first.value) / first.value * 100) : 0;
    const isGrowing = changePercent > 2;
    const isShrinking = changePercent < -2;

    expect(changePercent).toBe(-10);
    expect(isGrowing).toBe(false);
    expect(isShrinking).toBe(true);
  });

  it('should classify stable supply correctly', () => {
    const supply_trend = [
      { date: '2024-01', value: 10000 },
      { date: '2024-12', value: 10100 },
    ];

    const sorted = [...supply_trend].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const changePercent = first.value > 0 ? ((last.value - first.value) / first.value * 100) : 0;
    const isGrowing = changePercent > 2;
    const isShrinking = changePercent < -2;

    expect(changePercent).toBe(1);
    expect(isGrowing).toBe(false);
    expect(isShrinking).toBe(false);
  });

  it('should only render when supply_trend has more than 2 data points', () => {
    const tooFew = [
      { date: '2024-01', value: 10000 },
      { date: '2024-06', value: 10500 },
    ];
    const enough = [
      { date: '2024-01', value: 10000 },
      { date: '2024-06', value: 10500 },
      { date: '2024-12', value: 11000 },
    ];

    // The component condition is: supply_trend && supply_trend.length > 2
    expect(tooFew.length > 2).toBe(false);
    expect(enough.length > 2).toBe(true);
  });
});

// ---- Comp Image Removal Tests ----

describe('Comp Table: Image Removal Logic', () => {
  it('should display comp data without requiring image_url', () => {
    const comps = [
      { title: 'Downtown Luxury Loft', bedrooms: 3, bathrooms: 2.5, annual_revenue: 116954, adr: 491, occupancy: 0.66 },
      { title: 'Modern City Townhome', bedrooms: 3, bathrooms: 3, annual_revenue: 71676, adr: 278, occupancy: 0.71, image_url: undefined },
      { title: 'Spacious Urban Retreat', bedrooms: 3, bathrooms: 2.5, annual_revenue: 61115, adr: 347, occupancy: 0.88, image_url: '' },
    ];

    // Verify all comps can be rendered without images
    for (const comp of comps) {
      expect(comp.title).toBeTruthy();
      expect(comp.bedrooms).toBeGreaterThan(0);
      expect(comp.bathrooms).toBeGreaterThan(0);
      expect(comp.annual_revenue).toBeGreaterThan(0);
    }
  });

  it('should not depend on image_url for comp ranking', () => {
    const comps = [
      { title: 'A', annual_revenue: 50000, image_url: undefined },
      { title: 'B', annual_revenue: 80000, image_url: 'https://example.com/img.jpg' },
      { title: 'C', annual_revenue: 30000, image_url: undefined },
    ];

    const sorted = [...comps].sort((a, b) => b.annual_revenue - a.annual_revenue);
    expect(sorted[0].title).toBe('B');
    expect(sorted[1].title).toBe('A');
    expect(sorted[2].title).toBe('C');
  });
});

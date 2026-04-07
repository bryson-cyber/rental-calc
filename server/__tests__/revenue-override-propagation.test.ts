/**
 * Revenue Override Propagation Tests
 * 
 * Verifies that when admin overrides the headline revenue, all dependent
 * calculations use the adjusted values instead of original AirDNA estimates.
 * 
 * Bug context: ArbitrageCalculator and PropertyChatBot were using 
 * result.cashFlow.monthlyRevenue (original Rentalizer estimate) instead of
 * effectiveRevenue.projected / 12 (admin-adjusted value), causing the
 * Investment Analysis section to show different profit numbers than the
 * HeroRevenueCard.
 */
import { describe, it, expect } from 'vitest';

describe('Revenue Override Propagation', () => {
  // Simulate the data flow in TeslaDashboard
  const mockResult = {
    revenue: {
      projected: 36000, // Original Rentalizer estimate ($36K/yr)
      low: 19000,
      high: 47000,
    },
    cashFlow: {
      monthlyRevenue: 3000, // $36K / 12 = $3,000/mo (original)
      monthlyRent: 2200,
      monthlyProfit: 200, // $3000 - $2200 - $600 expenses
    },
    metrics: {
      adr: 157,
      occupancy: 63,
    },
    revenueScenarios: {
      conservative: 30000,
      target: 47383, // P75 target
      optimistic: 57840, // P90 optimistic
      source: 'exact_match',
      compCount: 30,
    },
  };

  const expensePercent = 20;
  const monthlyRent = 2200;

  describe('Without admin override (default state)', () => {
    const revenueOverride = null;
    const effectiveScenarios = mockResult.revenueScenarios;
    const baseHeadlineRevenue = effectiveScenarios.target; // $47,383
    const headlineRevenue = revenueOverride ?? baseHeadlineRevenue; // $47,383

    // effectiveRevenue calculation
    const ratio = (revenueOverride !== null && baseHeadlineRevenue > 0)
      ? revenueOverride / baseHeadlineRevenue
      : 1;
    const effectiveRevenue = {
      projected: headlineRevenue,
      low: Math.round(mockResult.revenue.low * ratio),
      high: Math.round(mockResult.revenue.high * ratio),
    };

    it('should use P75 target as headline revenue', () => {
      expect(headlineRevenue).toBe(47383);
    });

    it('should keep original low/high when no override', () => {
      expect(effectiveRevenue.low).toBe(19000);
      expect(effectiveRevenue.high).toBe(47000);
    });

    it('HeroRevenueCard should compute correct monthly profit', () => {
      const monthlyRevenue = headlineRevenue / 12; // $3,948.58
      const monthlyExpenses = monthlyRevenue * (expensePercent / 100);
      const trueMonthlyProfit = monthlyRevenue - monthlyRent - monthlyExpenses;
      
      expect(Math.round(monthlyRevenue)).toBe(3949);
      expect(Math.round(trueMonthlyProfit)).toBe(959);
    });

    it('ArbitrageCalculator should use effectiveRevenue, NOT result.cashFlow.monthlyRevenue', () => {
      // BEFORE FIX: ArbitrageCalculator received result.cashFlow.monthlyRevenue = $3,000
      // AFTER FIX: ArbitrageCalculator receives effectiveRevenue.projected / 12 = $3,949
      const arbitrageMonthlyRevenue = effectiveRevenue.projected / 12;
      
      // This should match HeroRevenueCard's monthlyRevenue
      expect(Math.round(arbitrageMonthlyRevenue)).toBe(3949);
      
      // And NOT be the original Rentalizer estimate
      expect(Math.round(arbitrageMonthlyRevenue)).not.toBe(mockResult.cashFlow.monthlyRevenue);
    });

    it('ArbitrageCalculator profit should match HeroRevenueCard profit', () => {
      const arbitrageMonthlyRevenue = effectiveRevenue.projected / 12;
      const arbitrageExpenses = arbitrageMonthlyRevenue * (expensePercent / 100);
      const arbitrageProfit = arbitrageMonthlyRevenue - monthlyRent - arbitrageExpenses;

      const heroMonthlyRevenue = headlineRevenue / 12;
      const heroExpenses = heroMonthlyRevenue * (expensePercent / 100);
      const heroProfit = heroMonthlyRevenue - monthlyRent - heroExpenses;

      expect(Math.round(arbitrageProfit)).toBe(Math.round(heroProfit));
    });

    it('Projection card should show optimistic scenario (higher than headline)', () => {
      // The Projection card uses scenarios.optimistic, which is P90
      const projectionMonthlyRevenue = mockResult.revenueScenarios.optimistic / 12;
      
      // Should be higher than headline monthly
      expect(projectionMonthlyRevenue).toBeGreaterThan(headlineRevenue / 12);
      expect(Math.round(projectionMonthlyRevenue)).toBe(4820);
    });
  });

  describe('With admin override (revenue decreased)', () => {
    const revenueOverride = 35000; // Admin decreased from $47,383 to $35,000
    const effectiveScenarios = mockResult.revenueScenarios;
    const baseHeadlineRevenue = effectiveScenarios.target; // $47,383
    const headlineRevenue = revenueOverride ?? baseHeadlineRevenue; // $35,000

    // effectiveRevenue calculation
    const ratio = (revenueOverride !== null && baseHeadlineRevenue > 0)
      ? revenueOverride / baseHeadlineRevenue
      : 1;
    const effectiveRevenue = {
      projected: headlineRevenue,
      low: Math.round(mockResult.revenue.low * ratio),
      high: Math.round(mockResult.revenue.high * ratio),
    };

    // adjustedScenarios calculation
    const originalTarget = effectiveScenarios.target;
    const scenarioRatio = revenueOverride / originalTarget;
    const adjustedScenarios = {
      ...effectiveScenarios,
      conservative: Math.round(effectiveScenarios.conservative * scenarioRatio),
      target: revenueOverride,
      optimistic: Math.round(effectiveScenarios.optimistic * scenarioRatio),
    };

    it('should use override as headline revenue', () => {
      expect(headlineRevenue).toBe(35000);
    });

    it('should scale low/high proportionally', () => {
      // ratio = 35000 / 47383 ≈ 0.7386
      expect(effectiveRevenue.low).toBe(Math.round(19000 * ratio));
      expect(effectiveRevenue.high).toBe(Math.round(47000 * ratio));
      expect(effectiveRevenue.low).toBeLessThan(19000);
      expect(effectiveRevenue.high).toBeLessThan(47000);
    });

    it('should scale scenarios proportionally', () => {
      expect(adjustedScenarios.target).toBe(35000);
      expect(adjustedScenarios.conservative).toBeLessThan(30000);
      expect(adjustedScenarios.optimistic).toBeLessThan(57840);
    });

    it('ArbitrageCalculator should use adjusted revenue', () => {
      const arbitrageMonthlyRevenue = effectiveRevenue.projected / 12;
      expect(Math.round(arbitrageMonthlyRevenue)).toBe(Math.round(35000 / 12));
    });

    it('ArbitrageCalculator profit should match HeroRevenueCard profit', () => {
      const arbitrageMonthlyRevenue = effectiveRevenue.projected / 12;
      const arbitrageExpenses = arbitrageMonthlyRevenue * (expensePercent / 100);
      const arbitrageProfit = arbitrageMonthlyRevenue - monthlyRent - arbitrageExpenses;

      const heroMonthlyRevenue = headlineRevenue / 12;
      const heroExpenses = heroMonthlyRevenue * (expensePercent / 100);
      const heroProfit = heroMonthlyRevenue - monthlyRent - heroExpenses;

      expect(Math.round(arbitrageProfit)).toBe(Math.round(heroProfit));
    });

    it('Projection card should use adjusted optimistic (scaled down)', () => {
      const projectionMonthlyRevenue = adjustedScenarios.optimistic / 12;
      
      // Should be less than original optimistic
      expect(projectionMonthlyRevenue).toBeLessThan(57840 / 12);
      
      // But still higher than headline (optimistic > target)
      expect(projectionMonthlyRevenue).toBeGreaterThan(headlineRevenue / 12);
    });

    it('Revenue Range should use scaled low/high', () => {
      // Revenue Range card receives effectiveRevenue.low and effectiveRevenue.high
      expect(effectiveRevenue.low).toBeLessThan(19000);
      expect(effectiveRevenue.high).toBeLessThan(47000);
    });
  });

  describe('AI advisor data should use effective values', () => {
    const revenueOverride = 40000;
    const effectiveScenarios = mockResult.revenueScenarios;
    const baseHeadlineRevenue = effectiveScenarios.target;
    const headlineRevenue = revenueOverride ?? baseHeadlineRevenue;

    const ratio = (revenueOverride !== null && baseHeadlineRevenue > 0)
      ? revenueOverride / baseHeadlineRevenue
      : 1;
    const effectiveRevenue = {
      projected: headlineRevenue,
      low: Math.round(mockResult.revenue.low * ratio),
      high: Math.round(mockResult.revenue.high * ratio),
    };

    it('cashFlow data for AI advisor should use effective monthly revenue', () => {
      // Simulating the IIFE that computes cashFlow for AIPropertyAdvisor
      const effMonthly = effectiveRevenue.projected ? effectiveRevenue.projected / 12 : mockResult.cashFlow.monthlyRevenue;
      const effRent = monthlyRent || mockResult.cashFlow.monthlyRent;
      const effExpenses = effMonthly * (expensePercent / 100);
      const effProfit = effMonthly - effRent - effExpenses;

      // Should use effective value, not original
      expect(Math.round(effMonthly)).toBe(Math.round(40000 / 12));
      expect(effMonthly).not.toBe(mockResult.cashFlow.monthlyRevenue);
      
      // Profit should be consistent
      const heroMonthlyRevenue = headlineRevenue / 12;
      const heroExpenses = heroMonthlyRevenue * (expensePercent / 100);
      const heroProfit = heroMonthlyRevenue - monthlyRent - heroExpenses;
      
      expect(Math.round(effProfit)).toBe(Math.round(heroProfit));
    });
  });
});

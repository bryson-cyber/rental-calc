/**
 * Tests for BreakEvenCalculator component calculations
 */

import { describe, it, expect } from 'vitest';

// Test the calculation logic directly (extracted from component)
function calculateBreakEven(
  monthlyRent: number,
  projectedADR: number,
  projectedOccupancy: number,
  projectedRevenue: number,
  startupCosts: number = 15000
) {
  const daysPerMonth = 30;
  
  // Break-even occupancy (at current ADR)
  const breakEvenOccupancy = projectedADR > 0 
    ? (monthlyRent / (projectedADR * daysPerMonth)) * 100 
    : 100;
  
  // Break-even ADR (at current occupancy)
  const breakEvenADR = projectedOccupancy > 0 
    ? monthlyRent / (daysPerMonth * (projectedOccupancy / 100))
    : 0;
  
  // Cushion calculations
  const occupancyCushion = projectedOccupancy - breakEvenOccupancy;
  const adrCushion = projectedADR - breakEvenADR;
  
  // Monthly profit
  const monthlyProfit = projectedRevenue - monthlyRent;
  
  // Months to recover startup costs
  const monthsToBreakEven = monthlyProfit > 0 ? Math.ceil(startupCosts / monthlyProfit) : Infinity;
  
  // Worst case scenario (30% drop in occupancy)
  const worstCaseOccupancy = projectedOccupancy * 0.7;
  const worstCaseRevenue = projectedADR * daysPerMonth * (worstCaseOccupancy / 100);
  const worstCaseProfit = worstCaseRevenue - monthlyRent;
  
  // Best case scenario (20% increase in occupancy, capped at 95%)
  const bestCaseOccupancy = Math.min(projectedOccupancy * 1.2, 95);
  const bestCaseRevenue = projectedADR * daysPerMonth * (bestCaseOccupancy / 100);
  const bestCaseProfit = bestCaseRevenue - monthlyRent;
  
  return {
    breakEvenOccupancy,
    breakEvenADR,
    occupancyCushion,
    adrCushion,
    monthlyProfit,
    monthsToBreakEven,
    worstCaseOccupancy,
    worstCaseRevenue,
    worstCaseProfit,
    bestCaseOccupancy,
    bestCaseRevenue,
    bestCaseProfit
  };
}

describe('BreakEvenCalculator', () => {
  describe('Break-even calculations', () => {
    it('should calculate correct break-even occupancy', () => {
      // $2000 rent, $200 ADR, 65% occupancy, $3900 revenue
      const result = calculateBreakEven(2000, 200, 65, 3900);
      
      // Break-even occupancy = 2000 / (200 * 30) = 33.33%
      expect(result.breakEvenOccupancy).toBeCloseTo(33.33, 1);
    });

    it('should calculate correct break-even ADR', () => {
      // $2000 rent, $200 ADR, 65% occupancy, $3900 revenue
      const result = calculateBreakEven(2000, 200, 65, 3900);
      
      // Break-even ADR = 2000 / (30 * 0.65) = $102.56
      expect(result.breakEvenADR).toBeCloseTo(102.56, 1);
    });

    it('should calculate correct occupancy cushion', () => {
      const result = calculateBreakEven(2000, 200, 65, 3900);
      
      // Cushion = 65 - 33.33 = 31.67%
      expect(result.occupancyCushion).toBeCloseTo(31.67, 1);
    });

    it('should calculate correct ADR cushion', () => {
      const result = calculateBreakEven(2000, 200, 65, 3900);
      
      // ADR cushion = 200 - 102.56 = $97.44
      expect(result.adrCushion).toBeCloseTo(97.44, 1);
    });
  });

  describe('Profit calculations', () => {
    it('should calculate correct monthly profit', () => {
      const result = calculateBreakEven(2000, 200, 65, 3900);
      
      // Profit = 3900 - 2000 = 1900
      expect(result.monthlyProfit).toBe(1900);
    });

    it('should calculate months to break even', () => {
      const result = calculateBreakEven(2000, 200, 65, 3900, 15000);
      
      // Months = ceil(15000 / 1900) = 8 months
      expect(result.monthsToBreakEven).toBe(8);
    });

    it('should return Infinity for unprofitable scenarios', () => {
      // Revenue less than rent
      const result = calculateBreakEven(5000, 100, 50, 1500);
      
      expect(result.monthsToBreakEven).toBe(Infinity);
    });
  });

  describe('Scenario analysis', () => {
    it('should calculate worst case (30% drop)', () => {
      const result = calculateBreakEven(2000, 200, 65, 3900);
      
      // Worst case occupancy = 65 * 0.7 = 45.5%
      expect(result.worstCaseOccupancy).toBeCloseTo(45.5, 1);
      
      // Worst case revenue = 200 * 30 * 0.455 = $2730
      expect(result.worstCaseRevenue).toBeCloseTo(2730, 0);
      
      // Worst case profit = 2730 - 2000 = $730
      expect(result.worstCaseProfit).toBeCloseTo(730, 0);
    });

    it('should calculate best case (20% increase, capped at 95%)', () => {
      const result = calculateBreakEven(2000, 200, 65, 3900);
      
      // Best case occupancy = min(65 * 1.2, 95) = 78%
      expect(result.bestCaseOccupancy).toBeCloseTo(78, 0);
      
      // Best case revenue = 200 * 30 * 0.78 = $4680
      expect(result.bestCaseRevenue).toBeCloseTo(4680, 0);
      
      // Best case profit = 4680 - 2000 = $2680
      expect(result.bestCaseProfit).toBeCloseTo(2680, 0);
    });

    it('should cap best case occupancy at 95%', () => {
      // High occupancy scenario
      const result = calculateBreakEven(2000, 200, 85, 5100);
      
      // 85 * 1.2 = 102, but capped at 95
      expect(result.bestCaseOccupancy).toBe(95);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero ADR', () => {
      const result = calculateBreakEven(2000, 0, 65, 0);
      
      expect(result.breakEvenOccupancy).toBe(100);
      expect(result.breakEvenADR).toBeCloseTo(102.56, 1);
    });

    it('should handle zero occupancy', () => {
      const result = calculateBreakEven(2000, 200, 0, 0);
      
      expect(result.breakEvenADR).toBe(0);
      expect(result.occupancyCushion).toBeCloseTo(-33.33, 1);
    });

    it('should handle high rent scenarios', () => {
      // Very high rent that makes break-even impossible
      const result = calculateBreakEven(10000, 200, 65, 3900);
      
      // Break-even occupancy = 10000 / (200 * 30) = 166.67% (impossible)
      expect(result.breakEvenOccupancy).toBeGreaterThan(100);
      expect(result.occupancyCushion).toBeLessThan(0);
      expect(result.monthlyProfit).toBeLessThan(0);
    });
  });
});

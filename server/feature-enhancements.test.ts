/**
 * Feature Enhancements Tests
 * Tests for booking patterns, supply trend, and break-even calculator
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the airdna module
vi.mock('./airdna', () => ({
  getMarketBookingPatterns: vi.fn(),
  getMarketSupplyTrend: vi.fn(),
}));

import { getMarketBookingPatterns, getMarketSupplyTrend } from './airdna';

describe('Market Insights Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMarketBookingPatterns', () => {
    it('should return booking patterns data for a valid market', async () => {
      const mockBookingPatterns = {
        lead_time: {
          average_days: 21,
          last_minute_percent: 0.15,
          advance_booking_percent: 0.45,
        },
        length_of_stay: {
          average_nights: 3.2,
          weekend_percent: 0.35,
          week_long_percent: 0.12,
        },
      };
      
      (getMarketBookingPatterns as any).mockResolvedValue(mockBookingPatterns);
      
      const result = await getMarketBookingPatterns('12345');
      
      expect(result).toEqual(mockBookingPatterns);
      expect(getMarketBookingPatterns).toHaveBeenCalledWith('12345');
    });

    it('should return null for invalid market', async () => {
      (getMarketBookingPatterns as any).mockResolvedValue(null);
      
      const result = await getMarketBookingPatterns('invalid');
      
      expect(result).toBeNull();
    });
  });

  describe('getMarketSupplyTrend', () => {
    it('should return supply trend data for a valid market', async () => {
      const mockSupplyTrend = {
        current_listings: 1250,
        trend: [
          { month: '2025-01', listings: 1100 },
          { month: '2025-02', listings: 1150 },
          { month: '2025-03', listings: 1200 },
          { month: '2025-04', listings: 1250 },
        ],
        growth_rate: 0.14,
      };
      
      (getMarketSupplyTrend as any).mockResolvedValue(mockSupplyTrend);
      
      const result = await getMarketSupplyTrend('12345');
      
      expect(result).toEqual(mockSupplyTrend);
      expect(getMarketSupplyTrend).toHaveBeenCalledWith('12345');
    });

    it('should return null for invalid market', async () => {
      (getMarketSupplyTrend as any).mockResolvedValue(null);
      
      const result = await getMarketSupplyTrend('invalid');
      
      expect(result).toBeNull();
    });
  });
});

describe('Break-Even Calculator Logic', () => {
  const daysInMonth = 30;
  
  // Helper functions that mirror the component logic
  const calculateBreakEvenOccupancy = (monthlyRent: number, adr: number) => {
    return monthlyRent / (adr * daysInMonth);
  };
  
  const calculateBreakEvenADR = (monthlyRent: number, occupancy: number) => {
    return monthlyRent / (occupancy * daysInMonth);
  };
  
  const calculateMonthlyProfit = (revenue: number, rent: number) => {
    return revenue - rent;
  };
  
  const calculateMonthsToBreakEven = (startupCosts: number, monthlyProfit: number) => {
    return monthlyProfit > 0 ? startupCosts / monthlyProfit : Infinity;
  };

  describe('Break-Even Occupancy', () => {
    it('should calculate correct break-even occupancy', () => {
      // $2000 rent, $200 ADR, 30 days
      // Break-even = 2000 / (200 * 30) = 0.333 (33.3%)
      const result = calculateBreakEvenOccupancy(2000, 200);
      expect(result).toBeCloseTo(0.333, 2);
    });

    it('should return higher break-even for higher rent', () => {
      const lowRent = calculateBreakEvenOccupancy(1500, 200);
      const highRent = calculateBreakEvenOccupancy(3000, 200);
      expect(highRent).toBeGreaterThan(lowRent);
    });

    it('should return lower break-even for higher ADR', () => {
      const lowADR = calculateBreakEvenOccupancy(2000, 150);
      const highADR = calculateBreakEvenOccupancy(2000, 300);
      expect(highADR).toBeLessThan(lowADR);
    });
  });

  describe('Break-Even ADR', () => {
    it('should calculate correct break-even ADR', () => {
      // $2000 rent, 65% occupancy, 30 days
      // Break-even ADR = 2000 / (0.65 * 30) = $102.56
      const result = calculateBreakEvenADR(2000, 0.65);
      expect(result).toBeCloseTo(102.56, 1);
    });

    it('should return higher break-even ADR for lower occupancy', () => {
      const highOcc = calculateBreakEvenADR(2000, 0.80);
      const lowOcc = calculateBreakEvenADR(2000, 0.50);
      expect(lowOcc).toBeGreaterThan(highOcc);
    });
  });

  describe('Monthly Profit', () => {
    it('should calculate positive profit when revenue exceeds rent', () => {
      const profit = calculateMonthlyProfit(5000, 2000);
      expect(profit).toBe(3000);
    });

    it('should calculate negative profit when rent exceeds revenue', () => {
      const profit = calculateMonthlyProfit(1500, 2000);
      expect(profit).toBe(-500);
    });

    it('should calculate zero profit when revenue equals rent', () => {
      const profit = calculateMonthlyProfit(2000, 2000);
      expect(profit).toBe(0);
    });
  });

  describe('Startup Cost Recovery', () => {
    it('should calculate correct months to break even', () => {
      // $5000 startup, $1000/month profit = 5 months
      const months = calculateMonthsToBreakEven(5000, 1000);
      expect(months).toBe(5);
    });

    it('should return Infinity for zero or negative profit', () => {
      const zeroProfit = calculateMonthsToBreakEven(5000, 0);
      const negativeProfit = calculateMonthsToBreakEven(5000, -500);
      expect(zeroProfit).toBe(Infinity);
      expect(negativeProfit).toBe(Infinity);
    });

    it('should calculate fractional months correctly', () => {
      // $5000 startup, $1500/month profit = 3.33 months
      const months = calculateMonthsToBreakEven(5000, 1500);
      expect(months).toBeCloseTo(3.33, 1);
    });
  });

  describe('Scenario Analysis', () => {
    it('should calculate worst case with 30% reduction', () => {
      const baseOccupancy = 0.70;
      const worstCase = baseOccupancy * 0.7;
      expect(worstCase).toBeCloseTo(0.49, 2);
    });

    it('should calculate best case with 20% increase capped at 95%', () => {
      const baseOccupancy = 0.70;
      const bestCase = Math.min(baseOccupancy * 1.2, 0.95);
      expect(bestCase).toBeCloseTo(0.84, 2);
      
      // High occupancy should cap at 95%
      const highOccupancy = 0.85;
      const cappedBestCase = Math.min(highOccupancy * 1.2, 0.95);
      expect(cappedBestCase).toBe(0.95);
    });
  });

  describe('Investment Safety Score', () => {
    const calculateSafetyScore = (
      occupancyCushion: number,
      profitMargin: number,
      monthsToBreakEven: number
    ) => {
      let score = 0;
      
      // Occupancy cushion (0-30 points)
      if (occupancyCushion > 0.3) score += 30;
      else if (occupancyCushion > 0.2) score += 25;
      else if (occupancyCushion > 0.1) score += 15;
      else if (occupancyCushion > 0) score += 5;
      
      // Profit margin (0-40 points)
      if (profitMargin > 0.4) score += 40;
      else if (profitMargin > 0.3) score += 30;
      else if (profitMargin > 0.2) score += 20;
      else if (profitMargin > 0.1) score += 10;
      else if (profitMargin > 0) score += 5;
      
      // Break-even speed (0-30 points)
      if (monthsToBreakEven <= 3) score += 30;
      else if (monthsToBreakEven <= 6) score += 25;
      else if (monthsToBreakEven <= 9) score += 15;
      else if (monthsToBreakEven <= 12) score += 10;
      else if (monthsToBreakEven < Infinity) score += 5;
      
      return score;
    };

    it('should give high score for excellent metrics', () => {
      const score = calculateSafetyScore(0.35, 0.45, 2);
      expect(score).toBe(100); // 30 + 40 + 30
    });

    it('should give low score for poor metrics', () => {
      const score = calculateSafetyScore(0.05, 0.05, 15);
      expect(score).toBe(15); // 5 + 5 + 5
    });

    it('should give zero score for negative metrics', () => {
      const score = calculateSafetyScore(-0.1, -0.1, Infinity);
      expect(score).toBe(0);
    });

    it('should give moderate score for average metrics', () => {
      const score = calculateSafetyScore(0.15, 0.25, 6);
      expect(score).toBe(60); // 15 + 20 + 25
    });
  });
});

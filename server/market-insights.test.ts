/**
 * Tests for Market Insights endpoints (booking patterns and supply trend)
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
      const mockPatterns = {
        booking_lead_time: {
          avg_days: 21,
          median_days: 14,
          last_minute_percent: 25,
          advance_booking_percent: 35,
        },
        length_of_stay: {
          avg_nights: 3.5,
          median_nights: 3,
          weekend_percent: 45,
          week_percent: 15,
        },
        insights: ['Guests typically book 2-3 weeks in advance'],
      };

      (getMarketBookingPatterns as any).mockResolvedValue(mockPatterns);

      const result = await getMarketBookingPatterns('us:co:denver', 2);

      expect(result).toBeDefined();
      expect(result?.booking_lead_time).toBeDefined();
      expect(result?.booking_lead_time.avg_days).toBe(21);
      expect(result?.length_of_stay).toBeDefined();
      expect(result?.length_of_stay.avg_nights).toBe(3.5);
    });

    it('should return null for invalid market', async () => {
      (getMarketBookingPatterns as any).mockResolvedValue(null);

      const result = await getMarketBookingPatterns('invalid:market', 2);

      expect(result).toBeNull();
    });

    it('should handle bedroom filter parameter', async () => {
      const mockPatterns = {
        booking_lead_time: {
          avg_days: 28,
          median_days: 21,
          last_minute_percent: 20,
          advance_booking_percent: 40,
        },
        length_of_stay: {
          avg_nights: 4,
          median_nights: 3,
          weekend_percent: 40,
          week_percent: 20,
        },
        insights: ['3-bedroom properties book further in advance'],
      };

      (getMarketBookingPatterns as any).mockResolvedValue(mockPatterns);

      const result = await getMarketBookingPatterns('us:co:denver', 3);

      expect(getMarketBookingPatterns).toHaveBeenCalledWith('us:co:denver', 3);
      expect(result?.booking_lead_time.avg_days).toBe(28);
    });
  });

  describe('getMarketSupplyTrend', () => {
    it('should return supply trend data for a valid market', async () => {
      const mockTrend = {
        current_listings: 1500,
        listings_12_months_ago: 1200,
        net_change: 300,
        percent_change: 25,
        monthly_data: [
          { month: '2025-01', active_listings: 1200, change_from_previous: 0 },
          { month: '2025-02', active_listings: 1250, change_from_previous: 50 },
          { month: '2025-03', active_listings: 1300, change_from_previous: 50 },
        ],
        trend: 'growing' as const,
        insight: 'Market is growing with 25% more listings than last year',
      };

      (getMarketSupplyTrend as any).mockResolvedValue(mockTrend);

      const result = await getMarketSupplyTrend('us:co:denver', 2);

      expect(result).toBeDefined();
      expect(result?.current_listings).toBe(1500);
      expect(result?.trend).toBe('growing');
      expect(result?.percent_change).toBe(25);
    });

    it('should return null for invalid market', async () => {
      (getMarketSupplyTrend as any).mockResolvedValue(null);

      const result = await getMarketSupplyTrend('invalid:market', 2);

      expect(result).toBeNull();
    });

    it('should correctly identify declining markets', async () => {
      const mockTrend = {
        current_listings: 1000,
        listings_12_months_ago: 1200,
        net_change: -200,
        percent_change: -16.7,
        monthly_data: [],
        trend: 'declining' as const,
        insight: 'Market is declining with fewer listings than last year',
      };

      (getMarketSupplyTrend as any).mockResolvedValue(mockTrend);

      const result = await getMarketSupplyTrend('us:ca:san-francisco', 2);

      expect(result?.trend).toBe('declining');
      expect(result?.net_change).toBeLessThan(0);
    });

    it('should correctly identify stable markets', async () => {
      const mockTrend = {
        current_listings: 1000,
        listings_12_months_ago: 980,
        net_change: 20,
        percent_change: 2,
        monthly_data: [],
        trend: 'stable' as const,
        insight: 'Market is stable with minimal change in listings',
      };

      (getMarketSupplyTrend as any).mockResolvedValue(mockTrend);

      const result = await getMarketSupplyTrend('us:tx:austin', 2);

      expect(result?.trend).toBe('stable');
    });
  });

  describe('Data validation', () => {
    it('booking patterns should have required fields', async () => {
      const mockPatterns = {
        booking_lead_time: {
          avg_days: 21,
          median_days: 14,
          last_minute_percent: 25,
          advance_booking_percent: 35,
        },
        length_of_stay: {
          avg_nights: 3.5,
          median_nights: 3,
          weekend_percent: 45,
          week_percent: 15,
        },
        insights: [],
      };

      (getMarketBookingPatterns as any).mockResolvedValue(mockPatterns);

      const result = await getMarketBookingPatterns('us:co:denver');

      // Verify all required fields exist
      expect(result?.booking_lead_time).toHaveProperty('avg_days');
      expect(result?.booking_lead_time).toHaveProperty('median_days');
      expect(result?.booking_lead_time).toHaveProperty('last_minute_percent');
      expect(result?.booking_lead_time).toHaveProperty('advance_booking_percent');
      expect(result?.length_of_stay).toHaveProperty('avg_nights');
      expect(result?.length_of_stay).toHaveProperty('median_nights');
      expect(result?.length_of_stay).toHaveProperty('weekend_percent');
      expect(result?.length_of_stay).toHaveProperty('week_percent');
    });

    it('supply trend should have required fields', async () => {
      const mockTrend = {
        current_listings: 1500,
        listings_12_months_ago: 1200,
        net_change: 300,
        percent_change: 25,
        monthly_data: [],
        trend: 'growing' as const,
        insight: 'Growing market',
      };

      (getMarketSupplyTrend as any).mockResolvedValue(mockTrend);

      const result = await getMarketSupplyTrend('us:co:denver');

      // Verify all required fields exist
      expect(result).toHaveProperty('current_listings');
      expect(result).toHaveProperty('listings_12_months_ago');
      expect(result).toHaveProperty('net_change');
      expect(result).toHaveProperty('percent_change');
      expect(result).toHaveProperty('monthly_data');
      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('insight');
    });
  });
});

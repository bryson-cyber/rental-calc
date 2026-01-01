import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SOPReports,
  MarketPercentiles
} from '../sop-reports';

const {
  calculateSOPProfitability,
  calculateMarketPercentiles,
  filterCompetitorsAboveThreshold,
  analyzeCompetitorSuccessFactors,
  tierNeighborhoods
} = SOPReports;
import type { ListingData } from '../airdna';

describe('SOP Reports Module', () => {
  describe('calculateSOPProfitability', () => {
    it('should calculate profitability using SOP formulas', () => {
      const monthlyRent = 3000;
      const percentiles: MarketPercentiles = {
        top_10_percent: 120000,
        top_25_percent: 90000,
        median: 60000,
        average: 65000
      };

      const result = calculateSOPProfitability(monthlyRent, percentiles);

      // Verify startup costs
      expect(result.startup_costs).toBe(20000);

      // Verify monthly expenses breakdown
      expect(result.monthly_expenses.rent).toBe(3000);
      expect(result.monthly_expenses.utilities).toBe(250);
      expect(result.monthly_expenses.internet).toBe(80);
      expect(result.monthly_expenses.supplies).toBe(250);
      expect(result.monthly_expenses.maintenance).toBe(200);
      expect(result.monthly_expenses.total).toBe(3780); // 3000 + 780

      // Verify annual operating costs
      expect(result.annual_operating_costs).toBe(45360); // 3780 * 12

      // Verify minimum revenue threshold (2x annual rent)
      expect(result.minimum_revenue_threshold).toBe(72000); // 3000 * 12 * 2

      // Verify scenarios
      expect(result.scenarios.conservative.projected_revenue).toBe(60000);
      expect(result.scenarios.conservative.estimated_profit).toBe(14640); // 60000 - 45360

      expect(result.scenarios.realistic.projected_revenue).toBe(90000);
      expect(result.scenarios.realistic.estimated_profit).toBe(44640); // 90000 - 45360

      expect(result.scenarios.optimistic.projected_revenue).toBe(120000);
      expect(result.scenarios.optimistic.estimated_profit).toBe(74640); // 120000 - 45360
    });

    it('should handle high rent that makes arbitrage unprofitable', () => {
      const monthlyRent = 5000;
      const percentiles: MarketPercentiles = {
        top_10_percent: 80000,
        top_25_percent: 60000,
        median: 45000,
        average: 50000
      };

      const result = calculateSOPProfitability(monthlyRent, percentiles);

      // Annual operating costs: (5000 + 780) * 12 = 69,360
      expect(result.annual_operating_costs).toBe(69360);

      // Conservative scenario should be negative
      expect(result.scenarios.conservative.estimated_profit).toBeLessThan(0);
    });
  });

  describe('calculateMarketPercentiles', () => {
    it('should calculate percentiles from listing data', () => {
      const listings: ListingData[] = [
        { id: '1', title: 'Top', annual_revenue: 100000, bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: 'house', rating: 5, reviews: 100, adr: 300, occupancy: 80 },
        { id: '2', title: 'High', annual_revenue: 80000, bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: 'house', rating: 4.9, reviews: 80, adr: 250, occupancy: 75 },
        { id: '3', title: 'Mid', annual_revenue: 60000, bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: 'house', rating: 4.8, reviews: 60, adr: 200, occupancy: 70 },
        { id: '4', title: 'Low', annual_revenue: 40000, bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: 'house', rating: 4.5, reviews: 40, adr: 150, occupancy: 60 },
      ];

      const result = calculateMarketPercentiles(listings);

      expect(result.top_10_percent).toBe(100000);
      expect(result.average).toBe(70000);
    });

    it('should handle empty listings array', () => {
      const result = calculateMarketPercentiles([]);

      expect(result.top_10_percent).toBe(0);
      expect(result.top_25_percent).toBe(0);
      expect(result.median).toBe(0);
      expect(result.average).toBe(0);
    });
  });

  describe('filterCompetitorsAboveThreshold', () => {
    it('should filter competitors above 2x annual rent threshold', () => {
      const monthlyRent = 2500; // Threshold: 2500 * 12 * 2 = 60000
      const listings: ListingData[] = [
        { id: '1', title: 'Above', annual_revenue: 80000, bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: 'house', rating: 5, reviews: 100, adr: 300, occupancy: 80 },
        { id: '2', title: 'At', annual_revenue: 60000, bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: 'house', rating: 4.9, reviews: 80, adr: 250, occupancy: 75 },
        { id: '3', title: 'Below', annual_revenue: 50000, bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: 'house', rating: 4.8, reviews: 60, adr: 200, occupancy: 70 },
      ];

      const result = filterCompetitorsAboveThreshold(listings, monthlyRent);

      expect(result.length).toBe(2);
      expect(result[0].title).toBe('Above');
      expect(result[1].title).toBe('At');
    });
  });

  describe('analyzeCompetitorSuccessFactors', () => {
    it('should identify hot tub as key success factor', () => {
      const listing: ListingData = {
        id: '1',
        title: 'Cozy Cabin with Hot Tub',
        annual_revenue: 80000,
        bedrooms: 3,
        bathrooms: 2,
        accommodates: 6,
        property_type: 'cabin',
        rating: 4.8,
        reviews: 50,
        adr: 250,
        occupancy: 75,
        amenities: ['hot_tub', 'wifi', 'parking']
      };

      const result = analyzeCompetitorSuccessFactors(listing);

      expect(result.key_success_factor).toBe('A Private Hot Tub');
      expect(result.airbnb_url).toContain('airbnb.com/rooms');
    });

    it('should identify exceptional reviews as key success factor', () => {
      const listing: ListingData = {
        id: '1',
        title: 'Amazing Downtown Loft',
        annual_revenue: 70000,
        bedrooms: 2,
        bathrooms: 1,
        accommodates: 4,
        property_type: 'apartment',
        rating: 5.0,
        reviews: 150,
        adr: 200,
        occupancy: 80,
        amenities: ['wifi', 'parking']
      };

      const result = analyzeCompetitorSuccessFactors(listing);

      expect(result.key_success_factor).toBe('Exceptional Reviews & 5-Star Rating');
    });

    it('should identify superhost status as key success factor', () => {
      const listing: ListingData = {
        id: '1',
        title: 'Superhost Home',
        annual_revenue: 65000,
        bedrooms: 3,
        bathrooms: 2,
        accommodates: 6,
        property_type: 'house',
        rating: 4.7,
        reviews: 80,
        adr: 180,
        occupancy: 70,
        superhost: true,
        amenities: ['wifi', 'parking']
      };

      const result = analyzeCompetitorSuccessFactors(listing);

      expect(result.key_success_factor).toBe('Superhost Status & Trust');
    });
  });

  describe('tierNeighborhoods', () => {
    it('should categorize neighborhoods into tiers', () => {
      const submarkets = [
        { name: 'Premier Area', metrics: { occupancy: 80, adr: 300, revenue: 90000, revpar: 240 } },
        { name: 'High Occ Area', metrics: { occupancy: 85, adr: 200, revenue: 70000, revpar: 170 } },
        { name: 'Average Area', metrics: { occupancy: 65, adr: 180, revenue: 50000, revpar: 117 } },
        { name: 'Declining Area', metrics: { occupancy: 50, adr: 150, revenue: 35000, revpar: 75 } },
      ];

      const result = tierNeighborhoods(submarkets);

      expect(result.length).toBe(4);
      
      // Check that tiers are assigned
      const tiers = result.map(n => n.tier);
      expect(tiers).toContain('Premier');
      expect(tiers).toContain('Caution');
    });

    it('should handle empty submarkets array', () => {
      const result = tierNeighborhoods([]);
      expect(result).toEqual([]);
    });

    it('should handle submarkets without metrics', () => {
      const submarkets = [
        { name: 'No Metrics Area' },
        { name: 'With Metrics', metrics: { occupancy: 70, adr: 200, revenue: 60000, revpar: 140 } },
      ];

      const result = tierNeighborhoods(submarkets);

      // Should only include submarkets with metrics
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('With Metrics');
    });
  });
});

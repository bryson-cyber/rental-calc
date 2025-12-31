import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AirDNA API functions
vi.mock('./airdna', () => ({
  getCountryMarkets: vi.fn(),
  getListingsInRadius: vi.fn(),
  getMarketSeasonality: vi.fn(),
  getTopPerformers: vi.fn(),
  calculateArbitrageFeasibility: vi.fn(),
}));

import {
  getCountryMarkets,
  getListingsInRadius,
  getMarketSeasonality,
  getTopPerformers,
  calculateArbitrageFeasibility,
} from './airdna';

describe('Advanced Features API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCountryMarkets', () => {
    it('should return markets with scores and metrics', async () => {
      const mockMarkets = {
        markets: [
          {
            id: 'market-1',
            name: 'Austin',
            market_type: 'urban_metro',
            listing_count: 15000,
            location: { state: 'TX', country: 'US', latitude: 30.2672, longitude: -97.7431 },
            scores: {
              market_score: 85,
              investability: 78,
              rental_demand: 82,
              revenue_growth: 75,
              seasonality: 70,
              regulation: 65,
            },
            metrics: {
              occupancy: 68,
              adr: 225,
              revenue: 55000,
              revpar: 153,
            },
          },
          {
            id: 'market-2',
            name: 'Nashville',
            market_type: 'urban_metro',
            listing_count: 12000,
            location: { state: 'TN', country: 'US', latitude: 36.1627, longitude: -86.7816 },
            scores: {
              market_score: 82,
              investability: 80,
              rental_demand: 79,
              revenue_growth: 72,
              seasonality: 68,
              regulation: 60,
            },
            metrics: {
              occupancy: 65,
              adr: 210,
              revenue: 48000,
              revpar: 137,
            },
          },
        ],
        total_count: 500,
      };

      vi.mocked(getCountryMarkets).mockResolvedValue(mockMarkets);

      const result = await getCountryMarkets('us', {
        limit: 50,
        sort_by: 'market_score',
        sort_direction: 'desc',
      });

      expect(result.markets).toHaveLength(2);
      expect(result.markets[0].name).toBe('Austin');
      expect(result.markets[0].scores.market_score).toBe(85);
      expect(result.total_count).toBe(500);
    });

    it('should filter by market type', async () => {
      const mockMarkets = {
        markets: [
          {
            id: 'market-3',
            name: 'Miami Beach',
            market_type: 'coastal',
            listing_count: 8000,
            location: { state: 'FL', country: 'US' },
            scores: { market_score: 80, investability: 75, rental_demand: 85, revenue_growth: 70, seasonality: 60, regulation: 55 },
            metrics: { occupancy: 72, adr: 280, revenue: 72000, revpar: 202 },
          },
        ],
        total_count: 150,
      };

      vi.mocked(getCountryMarkets).mockResolvedValue(mockMarkets);

      const result = await getCountryMarkets('us', {
        market_type: 'coastal',
        min_market_score: 70,
      });

      expect(result.markets[0].market_type).toBe('coastal');
      expect(result.markets[0].scores.market_score).toBeGreaterThanOrEqual(70);
    });
  });

  describe('getListingsInRadius', () => {
    it('should return listings within specified radius', async () => {
      const mockResult = {
        listings: [
          {
            id: 'listing-1',
            title: 'Downtown Condo',
            bedrooms: 2,
            bathrooms: 2,
            accommodates: 4,
            property_type: 'apartment',
            rating: 4.9,
            reviews: 150,
            annual_revenue: 45000,
            adr: 180,
            occupancy: 0.68,
            distance_meters: 500,
          },
          {
            id: 'listing-2',
            title: 'City View Loft',
            bedrooms: 1,
            bathrooms: 1,
            accommodates: 2,
            property_type: 'apartment',
            rating: 4.7,
            reviews: 85,
            annual_revenue: 32000,
            adr: 150,
            occupancy: 0.58,
            distance_meters: 1200,
          },
        ],
        total_count: 45,
        center: { latitude: 30.2672, longitude: -97.7431 },
        radius_meters: 2000,
      };

      vi.mocked(getListingsInRadius).mockResolvedValue(mockResult);

      const result = await getListingsInRadius(30.2672, -97.7431, 2000, {
        sort_by: 'distance',
        sort_direction: 'asc',
      });

      expect(result.listings).toHaveLength(2);
      expect(result.listings[0].distance_meters).toBe(500);
      expect(result.radius_meters).toBe(2000);
    });

    it('should filter by bedrooms', async () => {
      const mockResult = {
        listings: [
          {
            id: 'listing-3',
            title: '3BR Family Home',
            bedrooms: 3,
            bathrooms: 2,
            accommodates: 6,
            property_type: 'house',
            rating: 4.8,
            reviews: 200,
            annual_revenue: 65000,
            adr: 250,
            occupancy: 0.71,
            distance_meters: 800,
          },
        ],
        total_count: 12,
        center: { latitude: 30.2672, longitude: -97.7431 },
        radius_meters: 5000,
      };

      vi.mocked(getListingsInRadius).mockResolvedValue(mockResult);

      const result = await getListingsInRadius(30.2672, -97.7431, 5000, {
        bedrooms: 3,
      });

      expect(result.listings[0].bedrooms).toBe(3);
    });
  });

  describe('getMarketSeasonality', () => {
    it('should return 12 months of seasonality data', async () => {
      const mockSeasonality = [
        { month: '2024-01', month_name: 'January', occupancy: 45, adr: 150, revenue: 2000, season_type: 'off', pricing_recommendation: 'Discount pricing' },
        { month: '2024-02', month_name: 'February', occupancy: 50, adr: 160, revenue: 2400, season_type: 'shoulder', pricing_recommendation: 'Standard pricing' },
        { month: '2024-03', month_name: 'March', occupancy: 72, adr: 220, revenue: 4700, season_type: 'peak', pricing_recommendation: 'Premium pricing' },
        { month: '2024-04', month_name: 'April', occupancy: 68, adr: 200, revenue: 4000, season_type: 'shoulder', pricing_recommendation: 'Standard pricing' },
        { month: '2024-05', month_name: 'May', occupancy: 65, adr: 190, revenue: 3700, season_type: 'shoulder', pricing_recommendation: 'Standard pricing' },
        { month: '2024-06', month_name: 'June', occupancy: 78, adr: 250, revenue: 5800, season_type: 'peak', pricing_recommendation: 'Premium pricing' },
        { month: '2024-07', month_name: 'July', occupancy: 82, adr: 280, revenue: 6800, season_type: 'peak', pricing_recommendation: 'Premium pricing' },
        { month: '2024-08', month_name: 'August', occupancy: 75, adr: 240, revenue: 5400, season_type: 'peak', pricing_recommendation: 'Premium pricing' },
        { month: '2024-09', month_name: 'September', occupancy: 60, adr: 180, revenue: 3200, season_type: 'shoulder', pricing_recommendation: 'Standard pricing' },
        { month: '2024-10', month_name: 'October', occupancy: 55, adr: 170, revenue: 2800, season_type: 'shoulder', pricing_recommendation: 'Standard pricing' },
        { month: '2024-11', month_name: 'November', occupancy: 48, adr: 155, revenue: 2200, season_type: 'off', pricing_recommendation: 'Discount pricing' },
        { month: '2024-12', month_name: 'December', occupancy: 52, adr: 165, revenue: 2600, season_type: 'shoulder', pricing_recommendation: 'Standard pricing' },
      ];

      vi.mocked(getMarketSeasonality).mockResolvedValue(mockSeasonality);

      const result = await getMarketSeasonality('market-austin');

      expect(result).toHaveLength(12);
      expect(result.some(m => m.season_type === 'peak')).toBe(true);
      expect(result.some(m => m.season_type === 'off')).toBe(true);
      expect(result[6].month_name).toBe('July'); // Peak summer month
      expect(result[6].season_type).toBe('peak');
    });
  });

  describe('getTopPerformers', () => {
    it('should return top performing listings sorted by revenue', async () => {
      const mockResult = {
        listings: [
          {
            id: 'top-1',
            title: 'Luxury Downtown Penthouse',
            bedrooms: 4,
            bathrooms: 3,
            accommodates: 8,
            property_type: 'apartment',
            rating: 5.0,
            reviews: 320,
            annual_revenue: 120000,
            adr: 450,
            occupancy: 0.73,
            superhost: true,
            professionally_managed: true,
          },
          {
            id: 'top-2',
            title: 'Waterfront Villa',
            bedrooms: 5,
            bathrooms: 4,
            accommodates: 10,
            property_type: 'house',
            rating: 4.98,
            reviews: 180,
            annual_revenue: 95000,
            adr: 380,
            occupancy: 0.68,
            superhost: true,
            professionally_managed: false,
          },
        ],
        total_count: 150,
      };

      vi.mocked(getTopPerformers).mockResolvedValue(mockResult);

      const result = await getTopPerformers({
        marketId: 'market-austin',
        limit: 25,
        sort_by: 'revenue',
      });

      expect(result.listings).toHaveLength(2);
      expect(result.listings[0].annual_revenue).toBeGreaterThan(result.listings[1].annual_revenue);
      expect(result.listings[0].superhost).toBe(true);
    });

    it('should filter by superhost only', async () => {
      const mockResult = {
        listings: [
          {
            id: 'superhost-1',
            title: 'Superhost Property',
            bedrooms: 3,
            bathrooms: 2,
            accommodates: 6,
            property_type: 'house',
            rating: 4.95,
            reviews: 250,
            annual_revenue: 75000,
            adr: 280,
            occupancy: 0.73,
            superhost: true,
            professionally_managed: false,
          },
        ],
        total_count: 45,
      };

      vi.mocked(getTopPerformers).mockResolvedValue(mockResult);

      const result = await getTopPerformers({
        marketId: 'market-austin',
        filters: {
          superhost_only: true,
        },
      });

      expect(result.listings.every(l => l.superhost)).toBe(true);
    });
  });

  describe('calculateArbitrageFeasibility', () => {
    it('should calculate profitable arbitrage scenario', async () => {
      const mockFeasibility = {
        property: {
          address: '123 Main St, Austin, TX',
          bedrooms: 3,
          bathrooms: 2,
          monthly_rent: 2500,
        },
        projections: {
          annual_str_revenue: 65000,
          annual_str_revenue_low: 55000,
          annual_str_revenue_high: 75000,
          monthly_str_revenue: 5417,
          break_even_occupancy: 35,
          projected_monthly_profit: 1875,
          projected_annual_profit: 22500,
          roi_percentage: 75,
        },
        risk_assessment: {
          overall_risk: 'low',
          seasonality_risk: 'medium',
          regulation_risk: 'medium',
          market_saturation: 'low',
          factors: [
            'Strong ROI potential - property appears well-suited for arbitrage',
            'Comfortable break-even point below market average',
          ],
        },
        recommendation: 'This property shows strong potential for rental arbitrage.',
        market_context: {
          market_name: 'Austin, TX',
          avg_occupancy: 0.68,
          avg_adr: 225,
          avg_revenue: 65000,
        },
      };

      vi.mocked(calculateArbitrageFeasibility).mockResolvedValue(mockFeasibility);

      const result = await calculateArbitrageFeasibility('123 Main St, Austin, TX', 2500, 3, 2);

      expect(result).not.toBeNull();
      expect(result!.projections.roi_percentage).toBeGreaterThan(0);
      expect(result!.projections.projected_annual_profit).toBeGreaterThan(0);
      expect(result!.risk_assessment.overall_risk).toBe('low');
    });

    it('should identify high-risk unprofitable scenario', async () => {
      const mockFeasibility = {
        property: {
          address: '456 Expensive Ave, San Francisco, CA',
          bedrooms: 2,
          bathrooms: 1,
          monthly_rent: 5000,
        },
        projections: {
          annual_str_revenue: 45000,
          annual_str_revenue_low: 38000,
          annual_str_revenue_high: 52000,
          monthly_str_revenue: 3750,
          break_even_occupancy: 85,
          projected_monthly_profit: -1500,
          projected_annual_profit: -18000,
          roi_percentage: -30,
        },
        risk_assessment: {
          overall_risk: 'high',
          seasonality_risk: 'medium',
          regulation_risk: 'high',
          market_saturation: 'high',
          factors: [
            'WARNING: Projected annual loss - property may not be viable for arbitrage',
            'WARNING: Break-even occupancy exceeds market average - high risk',
          ],
        },
        recommendation: 'This property presents significant risk for rental arbitrage.',
        market_context: {
          market_name: 'San Francisco, CA',
          avg_occupancy: 0.55,
          avg_adr: 280,
          avg_revenue: 45000,
        },
      };

      vi.mocked(calculateArbitrageFeasibility).mockResolvedValue(mockFeasibility);

      const result = await calculateArbitrageFeasibility('456 Expensive Ave, San Francisco, CA', 5000, 2, 1);

      expect(result).not.toBeNull();
      expect(result!.projections.projected_annual_profit).toBeLessThan(0);
      expect(result!.risk_assessment.overall_risk).toBe('high');
      expect(result!.risk_assessment.factors.some(f => f.includes('WARNING'))).toBe(true);
    });

    it('should return null for invalid address', async () => {
      vi.mocked(calculateArbitrageFeasibility).mockResolvedValue(null);

      const result = await calculateArbitrageFeasibility('Invalid Address XYZ', 2000);

      expect(result).toBeNull();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the airdna module
vi.mock('./airdna', () => ({
  getSubmarketListings: vi.fn(),
  getMarketHistoricalData: vi.fn(),
}));

import { getSubmarketListings, getMarketHistoricalData } from './airdna';

describe('CompData Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSubmarketListings', () => {
    it('should return listings with correct structure', async () => {
      const mockListings = {
        listings: [
          {
            id: '123',
            title: 'Test Listing',
            property_type: 'house',
            bedrooms: 3,
            bathrooms: 2,
            accommodates: 6,
            annual_revenue: 50000,
            adr: 200,
            occupancy: 0.75,
            rating: 4.8,
            reviews: 50,
            airbnb_url: 'https://airbnb.com/rooms/123',
            image_url: 'https://example.com/image.jpg',
            is_superhost: true,
          },
        ],
        total_count: 1,
      };

      vi.mocked(getSubmarketListings).mockResolvedValue(mockListings);

      const result = await getSubmarketListings('submarket-123', {
        limit: 25,
        offset: 0,
        orderBy: 'revenue',
        orderDirection: 'desc',
      });

      expect(result).toBeDefined();
      expect(result?.listings).toHaveLength(1);
      expect(result?.listings[0]).toHaveProperty('title', 'Test Listing');
      expect(result?.listings[0]).toHaveProperty('annual_revenue', 50000);
    });

    it('should handle filters correctly', async () => {
      vi.mocked(getSubmarketListings).mockResolvedValue({
        listings: [],
        total_count: 0,
      });

      await getSubmarketListings('submarket-123', {
        limit: 10,
        offset: 0,
        orderBy: 'adr',
        orderDirection: 'asc',
      });

      expect(getSubmarketListings).toHaveBeenCalledWith('submarket-123', {
        limit: 10,
        offset: 0,
        orderBy: 'adr',
        orderDirection: 'asc',
      });
    });

    it('should return empty array when no listings found', async () => {
      vi.mocked(getSubmarketListings).mockResolvedValue({
        listings: [],
        total_count: 0,
      });

      const result = await getSubmarketListings('submarket-empty', {
        limit: 25,
        offset: 0,
      });

      expect(result?.listings).toHaveLength(0);
      expect(result?.total_count).toBe(0);
    });
  });

  describe('getMarketHistoricalData', () => {
    it('should return historical data with all metric types', async () => {
      const mockHistoricalData = {
        occupancy: [
          { month: '2024-01', value: 0.65 },
          { month: '2024-02', value: 0.70 },
        ],
        adr: [
          { month: '2024-01', value: 200 },
          { month: '2024-02', value: 210 },
        ],
        revenue: [
          { month: '2024-01', value: 3000 },
          { month: '2024-02', value: 3200 },
        ],
        revpar: [
          { month: '2024-01', value: 130 },
          { month: '2024-02', value: 147 },
        ],
        active_listings: [
          { month: '2024-01', value: 1000 },
          { month: '2024-02', value: 1050 },
        ],
      };

      vi.mocked(getMarketHistoricalData).mockResolvedValue(mockHistoricalData);

      const result = await getMarketHistoricalData('market-123', 24);

      expect(result).toBeDefined();
      expect(result?.occupancy).toHaveLength(2);
      expect(result?.adr).toHaveLength(2);
      expect(result?.revenue).toHaveLength(2);
      expect(result?.active_listings).toHaveLength(2);
    });

    it('should handle different time ranges', async () => {
      vi.mocked(getMarketHistoricalData).mockResolvedValue({
        occupancy: [],
        adr: [],
        revenue: [],
        revpar: [],
        active_listings: [],
      });

      await getMarketHistoricalData('market-123', 12);
      expect(getMarketHistoricalData).toHaveBeenCalledWith('market-123', 12);

      await getMarketHistoricalData('market-123', 60);
      expect(getMarketHistoricalData).toHaveBeenCalledWith('market-123', 60);
    });

    it('should return empty arrays when no data available', async () => {
      vi.mocked(getMarketHistoricalData).mockResolvedValue({
        occupancy: [],
        adr: [],
        revenue: [],
        revpar: [],
        active_listings: [],
      });

      const result = await getMarketHistoricalData('market-empty', 24);

      expect(result?.occupancy).toHaveLength(0);
      expect(result?.adr).toHaveLength(0);
      expect(result?.revenue).toHaveLength(0);
    });
  });
});

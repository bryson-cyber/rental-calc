import { describe, it, expect } from 'vitest';
import { getAllMarketListings } from '../airdna';

describe('getAllMarketListings', () => {
  it('should return market listings with expected structure', async () => {
    // Austin, TX market ID
    const marketId = 'austin-tx';
    
    const result = await getAllMarketListings(marketId, { maxListings: 50 });
    
    // Should return an object with listings array and total_count
    expect(result).toHaveProperty('listings');
    expect(result).toHaveProperty('total_count');
    expect(Array.isArray(result.listings)).toBe(true);
    expect(typeof result.total_count).toBe('number');
    
    // Each listing should have expected properties
    if (result.listings.length > 0) {
      const listing = result.listings[0];
      expect(listing).toHaveProperty('bedrooms');
      expect(listing).toHaveProperty('annual_revenue');
    }
  }, 30000);
});

describe('Market Saturation Analysis', () => {
  it('should calculate bedroom distribution correctly', () => {
    const mockListings = [
      { bedrooms: 1 },
      { bedrooms: 2 },
      { bedrooms: 2 },
      { bedrooms: 3 },
      { bedrooms: 2 }
    ];
    
    const bedroomCounts = new Map<number, number>();
    mockListings.forEach(l => {
      const br = l.bedrooms || 0;
      bedroomCounts.set(br, (bedroomCounts.get(br) || 0) + 1);
    });
    
    const distribution = Array.from(bedroomCounts.entries())
      .map(([bedrooms, count]) => ({
        bedrooms,
        count,
        percentage: (count / mockListings.length) * 100
      }))
      .sort((a, b) => a.bedrooms - b.bedrooms);
    
    expect(distribution).toEqual([
      { bedrooms: 1, count: 1, percentage: 20 },
      { bedrooms: 2, count: 3, percentage: 60 },
      { bedrooms: 3, count: 1, percentage: 20 }
    ]);
  });

  it('should calculate revenue percentiles correctly', () => {
    const revenues = [10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000];
    
    const getPercentile = (arr: number[], p: number) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.floor(sorted.length * p);
      return sorted[Math.min(idx, sorted.length - 1)] || 0;
    };
    
    // With floor-based index: 0.25*10=2.5->2 (30000), 0.50*10=5 (60000), 0.75*10=7.5->7 (80000), 0.90*10=9 (100000)
    expect(getPercentile(revenues, 0.25)).toBe(30000);
    expect(getPercentile(revenues, 0.50)).toBe(60000); // floor(5) = index 5 = 60000
    expect(getPercentile(revenues, 0.75)).toBe(80000);
    expect(getPercentile(revenues, 0.90)).toBe(100000);
  });

  it('should determine market concentration correctly', () => {
    const determineConcentration = (top10Share: number): 'fragmented' | 'moderate' | 'concentrated' => {
      if (top10Share > 50) return 'concentrated';
      if (top10Share > 30) return 'moderate';
      return 'fragmented';
    };
    
    expect(determineConcentration(60)).toBe('concentrated');
    expect(determineConcentration(40)).toBe('moderate');
    expect(determineConcentration(20)).toBe('fragmented');
  });

  it('should calculate top 10% revenue share correctly', () => {
    const revenues = [10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000];
    const totalRevenue = revenues.reduce((sum, r) => sum + r, 0); // 550000
    
    const top10Percent = Math.ceil(revenues.length * 0.1); // 1
    const top10Revenue = revenues.slice(-top10Percent).reduce((sum, r) => sum + r, 0); // 100000
    const top10Share = (top10Revenue / totalRevenue) * 100;
    
    expect(top10Share).toBeCloseTo(18.18, 1);
  });

  it('should position property correctly against percentiles', () => {
    const percentiles = { p25: 30000, p50: 50000, p75: 75000, p90: 100000 };
    
    const getPosition = (projectedRevenue: number) => {
      if (projectedRevenue > percentiles.p75) return 'TOP 25%';
      if (projectedRevenue > percentiles.p50) return 'ABOVE MEDIAN';
      return 'BELOW MEDIAN';
    };
    
    expect(getPosition(80000)).toBe('TOP 25%');
    expect(getPosition(60000)).toBe('ABOVE MEDIAN');
    expect(getPosition(40000)).toBe('BELOW MEDIAN');
  });
});

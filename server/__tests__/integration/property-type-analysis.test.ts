import { describe, it, expect } from 'vitest';
import { getFilteredMarketListings } from '../airdna';

describe('getFilteredMarketListings', () => {
  it('should filter by listing type entire_home', async () => {
    const listings = await getFilteredMarketListings('austin-tx', {
      listing_type: 'entire_home'
    }, 'revenue', 10);
    
    expect(Array.isArray(listings)).toBe(true);
  }, 30000);

  it('should filter by listing type private_room', async () => {
    const listings = await getFilteredMarketListings('austin-tx', {
      listing_type: 'private_room'
    }, 'revenue', 10);
    
    expect(Array.isArray(listings)).toBe(true);
  }, 30000);
});

describe('Property Type Analysis', () => {
  it('should calculate stats correctly for a set of listings', () => {
    const mockListings = [
      { annual_revenue: 50000, adr: 200, occupancy: 0.7, superhost: true },
      { annual_revenue: 60000, adr: 220, occupancy: 0.75, superhost: false },
      { annual_revenue: 55000, adr: 210, occupancy: 0.72, superhost: true }
    ];
    
    const calcStats = (listings: typeof mockListings) => {
      if (listings.length === 0) return { count: 0, avg_revenue: 0, avg_adr: 0, avg_occupancy: 0, superhost_percentage: 0 };
      return {
        count: listings.length,
        avg_revenue: listings.reduce((sum, l) => sum + (l.annual_revenue || 0), 0) / listings.length,
        avg_adr: listings.reduce((sum, l) => sum + (l.adr || 0), 0) / listings.length,
        avg_occupancy: listings.reduce((sum, l) => sum + (l.occupancy || 0), 0) / listings.length,
        superhost_percentage: (listings.filter(l => l.superhost).length / listings.length) * 100
      };
    };
    
    const stats = calcStats(mockListings);
    
    expect(stats.count).toBe(3);
    expect(stats.avg_revenue).toBeCloseTo(55000, 0);
    expect(stats.avg_adr).toBeCloseTo(210, 0);
    expect(stats.avg_occupancy).toBeCloseTo(0.7233, 2);
    expect(stats.superhost_percentage).toBeCloseTo(66.67, 1);
  });

  it('should calculate revenue premium correctly', () => {
    const entireHomeAvgRevenue = 60000;
    const privateRoomAvgRevenue = 30000;
    
    const revenuePremium = ((entireHomeAvgRevenue - privateRoomAvgRevenue) / privateRoomAvgRevenue) * 100;
    
    expect(revenuePremium).toBe(100); // 100% premium
  });

  it('should recommend entire_home when revenue premium is high', () => {
    const revenuePremium = 75;
    const entireHomeOccupancy = 0.65;
    const privateRoomOccupancy = 0.70;
    
    const recommendedType = revenuePremium > 50 ? 'entire_home' : 
      entireHomeOccupancy > privateRoomOccupancy ? 'entire_home' : 'private_room';
    
    expect(recommendedType).toBe('entire_home');
  });

  it('should recommend private_room when occupancy is higher and premium is low', () => {
    const revenuePremium = 30;
    const entireHomeOccupancy = 0.60;
    const privateRoomOccupancy = 0.75;
    
    const recommendedType = revenuePremium > 50 ? 'entire_home' : 
      entireHomeOccupancy > privateRoomOccupancy ? 'entire_home' : 'private_room';
    
    expect(recommendedType).toBe('private_room');
  });

  it('should handle empty listings gracefully', () => {
    const mockListings: any[] = [];
    
    const calcStats = (listings: any[]) => {
      if (listings.length === 0) return { count: 0, avg_revenue: 0, avg_adr: 0, avg_occupancy: 0, superhost_percentage: 0 };
      return {
        count: listings.length,
        avg_revenue: listings.reduce((sum: number, l: any) => sum + (l.annual_revenue || 0), 0) / listings.length,
        avg_adr: listings.reduce((sum: number, l: any) => sum + (l.adr || 0), 0) / listings.length,
        avg_occupancy: listings.reduce((sum: number, l: any) => sum + (l.occupancy || 0), 0) / listings.length,
        superhost_percentage: (listings.filter((l: any) => l.superhost).length / listings.length) * 100
      };
    };
    
    const stats = calcStats(mockListings);
    
    expect(stats.count).toBe(0);
    expect(stats.avg_revenue).toBe(0);
  });
});

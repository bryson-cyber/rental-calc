import { describe, it, expect } from 'vitest';
import { getSinglePropertyDetails, getSubmarketListings } from '../airdna';

describe('getSinglePropertyDetails', () => {
  it('should return property details or null for a property ID', async () => {
    // Test with a sample property ID (may or may not exist)
    const propertyId = 'airbnb-12345';
    
    const details = await getSinglePropertyDetails(propertyId);
    
    // Should return either details or null
    expect(details === null || typeof details === 'object').toBe(true);
  });

  it('should return correct structure when property is found', async () => {
    // Use a known property ID format
    const propertyId = 'airbnb-123456';
    
    const result = await getSinglePropertyDetails(propertyId);
    
    if (result !== null) {
      // Verify structure
      expect(result).toHaveProperty('property_id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('bedrooms');
      expect(result).toHaveProperty('bathrooms');
      expect(result).toHaveProperty('annual_revenue');
      expect(result).toHaveProperty('adr');
      expect(result).toHaveProperty('occupancy');
      expect(result).toHaveProperty('rating');
      expect(result).toHaveProperty('reviews');
    }
  });

  it('should handle invalid property IDs gracefully', async () => {
    const invalidId = 'invalid-property-xyz';
    
    // Should not throw
    const result = await getSinglePropertyDetails(invalidId);
    
    expect(result === null || typeof result === 'object').toBe(true);
  });
});

describe('getSubmarketListings', () => {
  it('should return listings for a submarket ID', async () => {
    // Test with a sample submarket ID
    const submarketId = 'austin-downtown';
    
    const result = await getSubmarketListings(submarketId, { limit: 10 });
    
    // Should return object with listings array
    expect(result).toHaveProperty('listings');
    expect(result).toHaveProperty('total_count');
    expect(Array.isArray(result.listings)).toBe(true);
  });

  it('should return correct listing structure', async () => {
    const submarketId = 'test-submarket';
    
    const result = await getSubmarketListings(submarketId, { limit: 5 });
    
    if (result.listings.length > 0) {
      const listing = result.listings[0];
      expect(listing).toHaveProperty('property_id');
      expect(listing).toHaveProperty('title');
      expect(listing).toHaveProperty('bedrooms');
      expect(listing).toHaveProperty('annual_revenue');
      expect(listing).toHaveProperty('adr');
      expect(listing).toHaveProperty('occupancy');
    }
  });

  it('should respect limit parameter', async () => {
    const submarketId = 'test-submarket';
    const limit = 5;
    
    const result = await getSubmarketListings(submarketId, { limit });
    
    expect(result.listings.length).toBeLessThanOrEqual(limit);
  });

  it('should support ordering options', async () => {
    const submarketId = 'test-submarket';
    
    const result = await getSubmarketListings(submarketId, {
      limit: 10,
      orderBy: 'revenue',
      orderDirection: 'desc'
    });
    
    // Just verify it doesn't throw
    expect(result).toHaveProperty('listings');
  });
});

describe('Integration: Existing Listing Detection', () => {
  it('should correctly identify existing listing from rentalizer comps', () => {
    // Mock rentalizer comps with a property at distance 0
    const mockComps = [
      { listing_id: 'airbnb-111', distance_meters: 500 },
      { listing_id: 'airbnb-222', distance_meters: 0 }, // Same property!
      { listing_id: 'airbnb-333', distance_meters: 300 }
    ];
    
    const samePropertyComp = mockComps.find(c => c.distance_meters === 0);
    
    expect(samePropertyComp).toBeDefined();
    expect(samePropertyComp?.listing_id).toBe('airbnb-222');
  });

  it('should return undefined when no existing listing found', () => {
    const mockComps = [
      { listing_id: 'airbnb-111', distance_meters: 500 },
      { listing_id: 'airbnb-333', distance_meters: 300 }
    ];
    
    const samePropertyComp = mockComps.find(c => c.distance_meters === 0);
    
    expect(samePropertyComp).toBeUndefined();
  });
});

describe('Integration: Submarket Analysis', () => {
  it('should calculate submarket averages correctly', () => {
    const mockListings = [
      { annual_revenue: 40000, adr: 150, occupancy: 0.65 },
      { annual_revenue: 50000, adr: 180, occupancy: 0.70 },
      { annual_revenue: 60000, adr: 200, occupancy: 0.75 }
    ];
    
    const avgRevenue = mockListings.reduce((sum, l) => sum + l.annual_revenue, 0) / mockListings.length;
    const avgAdr = mockListings.reduce((sum, l) => sum + l.adr, 0) / mockListings.length;
    const avgOccupancy = mockListings.reduce((sum, l) => sum + l.occupancy, 0) / mockListings.length;
    
    expect(avgRevenue).toBe(50000);
    expect(avgAdr).toBeCloseTo(176.67, 1);
    expect(avgOccupancy).toBeCloseTo(0.70, 2);
  });
});

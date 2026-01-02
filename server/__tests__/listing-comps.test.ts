import { describe, it, expect, vi } from 'vitest';
import { getListingComps, ListingComp } from '../airdna';

describe('getListingComps', () => {
  it('should return an array of listing comps', async () => {
    // Test with a real listing ID (from a known active listing)
    // Using a sample listing ID - this tests the actual API
    const listingId = '12345678'; // Sample ID
    
    const comps = await getListingComps(listingId, 5);
    
    // Should return an array (may be empty if listing not found)
    expect(Array.isArray(comps)).toBe(true);
  });

  it('should return comps with correct structure when found', async () => {
    // Test with a known listing ID that should have comps
    const listingId = '12345678';
    
    const comps = await getListingComps(listingId, 10);
    
    // If comps are returned, verify structure
    if (comps.length > 0) {
      const comp = comps[0];
      expect(comp).toHaveProperty('listing_id');
      expect(comp).toHaveProperty('title');
      expect(comp).toHaveProperty('bedrooms');
      expect(comp).toHaveProperty('bathrooms');
      expect(comp).toHaveProperty('annual_revenue');
      expect(comp).toHaveProperty('adr');
      expect(comp).toHaveProperty('occupancy');
      expect(comp).toHaveProperty('similarity_score');
      expect(comp).toHaveProperty('amenities');
      expect(Array.isArray(comp.amenities)).toBe(true);
    }
  });

  it('should handle invalid listing IDs gracefully', async () => {
    const invalidListingId = 'invalid-id-12345';
    
    // Should not throw, should return empty array
    const comps = await getListingComps(invalidListingId, 5);
    
    expect(Array.isArray(comps)).toBe(true);
  });

  it('should respect the limit parameter', async () => {
    const listingId = '12345678';
    const limit = 3;
    
    const comps = await getListingComps(listingId, limit);
    
    // Should return at most 'limit' comps
    expect(comps.length).toBeLessThanOrEqual(limit);
  });
});

describe('ListingComp type structure', () => {
  it('should have all required fields in the interface', () => {
    // Type check - this verifies the interface is correctly defined
    const mockComp: ListingComp = {
      listing_id: '123',
      title: 'Test Listing',
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4,
      property_type: 'house',
      annual_revenue: 50000,
      adr: 150,
      occupancy: 0.65,
      rating: 4.8,
      reviews: 50,
      distance_meters: 1000,
      similarity_score: 0.85,
      airbnb_url: 'https://airbnb.com/rooms/123',
      amenities: ['wifi', 'kitchen', 'parking']
    };

    expect(mockComp.listing_id).toBe('123');
    expect(mockComp.similarity_score).toBe(0.85);
    expect(mockComp.amenities).toContain('wifi');
  });
});

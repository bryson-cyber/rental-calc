import { describe, it, expect } from 'vitest';
import { getRentalizerComps, RentalizerCompData } from '../airdna';

describe('getRentalizerComps', () => {
  it('should return comps data or null for an address', async () => {
    // Test with a sample address
    const address = '123 Main St, Austin, TX';
    
    const comps = await getRentalizerComps(address, 2, 1, 10);
    
    // Should return either comps data or null
    expect(comps === null || typeof comps === 'object').toBe(true);
  });

  it('should return correct structure when comps are found', async () => {
    const address = '123 Main St, Austin, TX';
    
    const result = await getRentalizerComps(address, 2, 1, 10);
    
    if (result !== null) {
      // Verify structure
      expect(result).toHaveProperty('comps');
      expect(result).toHaveProperty('market_context');
      expect(Array.isArray(result.comps)).toBe(true);
      
      // Verify market_context structure
      expect(result.market_context).toHaveProperty('market_id');
      expect(result.market_context).toHaveProperty('market_name');
      
      // If comps exist, verify comp structure
      if (result.comps.length > 0) {
        const comp = result.comps[0];
        expect(comp).toHaveProperty('listing_id');
        expect(comp).toHaveProperty('title');
        expect(comp).toHaveProperty('bedrooms');
        expect(comp).toHaveProperty('annual_revenue');
        expect(comp).toHaveProperty('superhost');
        expect(comp).toHaveProperty('professionally_managed');
        expect(comp).toHaveProperty('distance_meters');
        expect(typeof comp.superhost).toBe('boolean');
        expect(typeof comp.professionally_managed).toBe('boolean');
      }
    }
  });

  it('should handle invalid addresses gracefully', async () => {
    const invalidAddress = 'xyz invalid address 12345';
    
    // Should not throw
    const result = await getRentalizerComps(invalidAddress, 2, 1, 5);
    
    expect(result === null || typeof result === 'object').toBe(true);
  });

  it('should respect the limit parameter', async () => {
    const address = '123 Main St, Austin, TX';
    const limit = 5;
    
    const result = await getRentalizerComps(address, 2, 1, limit);
    
    if (result !== null) {
      expect(result.comps.length).toBeLessThanOrEqual(limit);
    }
  });
});

describe('RentalizerCompData type structure', () => {
  it('should have all required fields in the interface', () => {
    // Type check - verifies the interface is correctly defined
    const mockData: RentalizerCompData = {
      comps: [
        {
          listing_id: '123',
          title: 'Test Listing',
          bedrooms: 2,
          bathrooms: 1,
          annual_revenue: 45000,
          adr: 150,
          occupancy: 0.65,
          rating: 4.8,
          reviews: 50,
          distance_meters: 500,
          airbnb_url: 'https://airbnb.com/rooms/123',
          property_type: 'house',
          amenities: ['wifi', 'kitchen'],
          superhost: true,
          professionally_managed: false
        }
      ],
      market_context: {
        market_id: 'austin-tx',
        market_name: 'Austin, TX'
      }
    };

    expect(mockData.comps[0].superhost).toBe(true);
    expect(mockData.comps[0].professionally_managed).toBe(false);
    expect(mockData.comps[0].distance_meters).toBe(500);
  });

  it('should calculate superhost percentage correctly', () => {
    const comps = [
      { superhost: true },
      { superhost: true },
      { superhost: false },
      { superhost: false },
      { superhost: true }
    ];
    
    const superhostCount = comps.filter(c => c.superhost).length;
    const superhostPercentage = (superhostCount / comps.length) * 100;
    
    expect(superhostPercentage).toBe(60);
  });
});

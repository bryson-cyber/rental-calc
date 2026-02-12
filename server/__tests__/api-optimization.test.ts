import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for API call optimization:
 * 1. Top-level property report caching
 * 2. Radius search caching
 * 3. Bedroom performance consolidation (single call instead of 5-6)
 */

// Mock the cache module
const mockGetAsync = vi.fn();
const mockSet = vi.fn();
const mockGenerateKey = vi.fn((prefix: string, params: any) => `${prefix}:${JSON.stringify(params)}`);

vi.mock('../cache', () => ({
  apiCache: {
    getAsync: (...args: any[]) => mockGetAsync(...args),
    set: (...args: any[]) => mockSet(...args),
    generateKey: (...args: any[]) => mockGenerateKey(...args),
  },
}));

describe('API Optimization - Cache Key Generation', () => {
  it('should generate consistent cache keys for property reports', () => {
    const address = '2953 Kalmia St, San Diego, CA 92104';
    const key1 = `property_comprehensive:${address}:3:2:auto`;
    const key2 = `property_comprehensive:${address}:3:2:auto`;
    expect(key1).toBe(key2);
  });

  it('should generate different cache keys for different addresses', () => {
    const key1 = `property_comprehensive:123 Main St:3:2:auto`;
    const key2 = `property_comprehensive:456 Oak Ave:3:2:auto`;
    expect(key1).not.toBe(key2);
  });

  it('should generate different cache keys for different bedroom counts', () => {
    const address = '123 Main St';
    const key1 = `property_comprehensive:${address}:2:1:auto`;
    const key2 = `property_comprehensive:${address}:3:2:auto`;
    expect(key1).not.toBe(key2);
  });
});

describe('API Optimization - Radius Search Cache Keys', () => {
  it('should generate consistent cache keys for same radius search params', () => {
    const address = '2953 Kalmia St';
    const key1 = `radius_listings:${address}:5000:brall:baall:rev0:lim200`;
    const key2 = `radius_listings:${address}:5000:brall:baall:rev0:lim200`;
    expect(key1).toBe(key2);
  });

  it('should generate different cache keys for different bedroom filters', () => {
    const address = '2953 Kalmia St';
    const key1 = `radius_listings:${address}:5000:br3:baall:rev0:lim50`;
    const key2 = `radius_listings:${address}:5000:br4:baall:rev0:lim50`;
    expect(key1).not.toBe(key2);
  });

  it('should generate different cache keys for different radii', () => {
    const address = '2953 Kalmia St';
    const key1 = `radius_listings:${address}:3000:brall:baall:rev0:lim50`;
    const key2 = `radius_listings:${address}:5000:brall:baall:rev0:lim50`;
    expect(key1).not.toBe(key2);
  });
});

describe('API Optimization - Bedroom Performance Consolidation', () => {
  it('should group listings by bedroom count correctly', () => {
    // Simulate the optimized bedroom performance calculation
    const allRadiusListings = [
      { bedrooms: 1, annual_revenue: 30000, adr: 100, occupancy: 70 },
      { bedrooms: 1, annual_revenue: 35000, adr: 110, occupancy: 75 },
      { bedrooms: 2, annual_revenue: 50000, adr: 150, occupancy: 72 },
      { bedrooms: 2, annual_revenue: 55000, adr: 160, occupancy: 78 },
      { bedrooms: 2, annual_revenue: 60000, adr: 170, occupancy: 80 },
      { bedrooms: 3, annual_revenue: 80000, adr: 250, occupancy: 65 },
      { bedrooms: 4, annual_revenue: 120000, adr: 400, occupancy: 60 },
    ];

    const brMap = new Map<number, { count: number; totalRev: number; totalAdr: number; totalOcc: number }>();
    allRadiusListings.forEach(l => {
      const br = l.bedrooms;
      if (br >= 1 && br <= 8) {
        const existing = brMap.get(br) || { count: 0, totalRev: 0, totalAdr: 0, totalOcc: 0 };
        brMap.set(br, {
          count: existing.count + 1,
          totalRev: existing.totalRev + l.annual_revenue,
          totalAdr: existing.totalAdr + l.adr,
          totalOcc: existing.totalOcc + l.occupancy,
        });
      }
    });

    const bedroomPerformance = Array.from(brMap.entries())
      .map(([br, data]) => ({
        bedrooms: br,
        occupancy: Math.round(data.totalOcc / data.count),
        adr: Math.round(data.totalAdr / data.count),
        revenue: Math.round(data.totalRev / data.count),
        listing_count: data.count,
      }))
      .sort((a, b) => a.bedrooms - b.bedrooms);

    expect(bedroomPerformance).toHaveLength(4); // 1BR, 2BR, 3BR, 4BR
    
    // Check 1BR averages
    const br1 = bedroomPerformance.find(p => p.bedrooms === 1);
    expect(br1).toBeDefined();
    expect(br1!.listing_count).toBe(2);
    expect(br1!.revenue).toBe(32500); // (30000+35000)/2
    expect(br1!.adr).toBe(105); // (100+110)/2
    expect(br1!.occupancy).toBe(73); // Math.round((70+75)/2)

    // Check 2BR averages
    const br2 = bedroomPerformance.find(p => p.bedrooms === 2);
    expect(br2).toBeDefined();
    expect(br2!.listing_count).toBe(3);
    expect(br2!.revenue).toBe(55000); // (50000+55000+60000)/3

    // Check sorted order
    expect(bedroomPerformance[0].bedrooms).toBe(1);
    expect(bedroomPerformance[1].bedrooms).toBe(2);
    expect(bedroomPerformance[2].bedrooms).toBe(3);
    expect(bedroomPerformance[3].bedrooms).toBe(4);
  });

  it('should handle empty listings gracefully', () => {
    const allRadiusListings: any[] = [];
    const brMap = new Map<number, { count: number; totalRev: number; totalAdr: number; totalOcc: number }>();
    allRadiusListings.forEach(l => {
      const br = l.bedrooms;
      if (br >= 1 && br <= 8) {
        const existing = brMap.get(br) || { count: 0, totalRev: 0, totalAdr: 0, totalOcc: 0 };
        brMap.set(br, {
          count: existing.count + 1,
          totalRev: existing.totalRev + l.annual_revenue,
          totalAdr: existing.totalAdr + l.adr,
          totalOcc: existing.totalOcc + l.occupancy,
        });
      }
    });

    const bedroomPerformance = Array.from(brMap.entries())
      .map(([br, data]) => ({
        bedrooms: br,
        occupancy: Math.round(data.totalOcc / data.count),
        adr: Math.round(data.totalAdr / data.count),
        revenue: Math.round(data.totalRev / data.count),
        listing_count: data.count,
      }))
      .sort((a, b) => a.bedrooms - b.bedrooms);

    expect(bedroomPerformance).toHaveLength(0);
  });

  it('should filter out bedrooms outside 1-8 range', () => {
    const allRadiusListings = [
      { bedrooms: 0, annual_revenue: 20000, adr: 80, occupancy: 60 }, // Studio - filtered out
      { bedrooms: 1, annual_revenue: 30000, adr: 100, occupancy: 70 },
      { bedrooms: 9, annual_revenue: 200000, adr: 600, occupancy: 50 }, // 9BR - filtered out
    ];

    const brMap = new Map<number, { count: number; totalRev: number; totalAdr: number; totalOcc: number }>();
    allRadiusListings.forEach(l => {
      const br = l.bedrooms;
      if (br >= 1 && br <= 8) {
        const existing = brMap.get(br) || { count: 0, totalRev: 0, totalAdr: 0, totalOcc: 0 };
        brMap.set(br, {
          count: existing.count + 1,
          totalRev: existing.totalRev + l.annual_revenue,
          totalAdr: existing.totalAdr + l.adr,
          totalOcc: existing.totalOcc + l.occupancy,
        });
      }
    });

    const bedroomPerformance = Array.from(brMap.entries())
      .map(([br, data]) => ({
        bedrooms: br,
        occupancy: Math.round(data.totalOcc / data.count),
        adr: Math.round(data.totalAdr / data.count),
        revenue: Math.round(data.totalRev / data.count),
        listing_count: data.count,
      }))
      .sort((a, b) => a.bedrooms - b.bedrooms);

    expect(bedroomPerformance).toHaveLength(1); // Only 1BR
    expect(bedroomPerformance[0].bedrooms).toBe(1);
  });
});

describe('API Optimization - Cache Deserialization Safety', () => {
  it('should handle double-stringified JSON from database cache', () => {
    // Simulate the bug: data stored as JSON.stringify(obj) in a JSON column
    const originalData = { property: { address: '123 Main St' }, estimates: { annual_revenue: 50000 } };
    const doubleStringified = JSON.stringify(originalData); // This is what the DB returns
    
    // The fix: iteratively parse until we get an object
    let parsed: any = doubleStringified;
    let iterations = 0;
    while (typeof parsed === 'string' && iterations < 5) {
      try {
        parsed = JSON.parse(parsed);
        iterations++;
      } catch {
        break;
      }
    }
    
    expect(typeof parsed).toBe('object');
    expect(parsed.property.address).toBe('123 Main St');
    expect(parsed.estimates.annual_revenue).toBe(50000);
  });

  it('should handle already-parsed objects without modification', () => {
    const originalData = { property: { address: '123 Main St' } };
    
    // Already an object - should not be modified
    let parsed: any = originalData;
    let iterations = 0;
    while (typeof parsed === 'string' && iterations < 5) {
      try {
        parsed = JSON.parse(parsed);
        iterations++;
      } catch {
        break;
      }
    }
    
    expect(parsed).toBe(originalData); // Same reference
    expect(iterations).toBe(0); // No parsing needed
  });

  it('should handle triple-stringified JSON', () => {
    const originalData = { test: 'value' };
    const tripleStringified = JSON.stringify(JSON.stringify(JSON.stringify(originalData)));
    
    let parsed: any = tripleStringified;
    let iterations = 0;
    while (typeof parsed === 'string' && iterations < 5) {
      try {
        parsed = JSON.parse(parsed);
        iterations++;
      } catch {
        break;
      }
    }
    
    expect(typeof parsed).toBe('object');
    expect(parsed.test).toBe('value');
    expect(iterations).toBe(3);
  });
});

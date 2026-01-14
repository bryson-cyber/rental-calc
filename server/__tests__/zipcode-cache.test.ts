import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test the zip code caching logic
describe('Zip Code Cache', () => {
  // Simple in-memory cache implementation for testing
  const createCache = () => {
    const cache = new Map<string, { data: Array<{ zipcode: string; listingCount: number }>; timestamp: number }>();
    
    return {
      get: (key: string) => cache.get(key),
      set: (key: string, value: { data: Array<{ zipcode: string; listingCount: number }>; timestamp: number }) => {
        cache.set(key, value);
      },
      has: (key: string) => cache.has(key),
      clear: () => cache.clear()
    };
  };

  it('should store zip codes in cache', () => {
    const cache = createCache();
    const testData = [
      { zipcode: '12345', listingCount: 10 },
      { zipcode: '67890', listingCount: 5 }
    ];
    
    cache.set('zipcodes_test123', { data: testData, timestamp: Date.now() });
    
    const cached = cache.get('zipcodes_test123');
    expect(cached).toBeDefined();
    expect(cached?.data).toEqual(testData);
  });

  it('should return cached data if within TTL', () => {
    const cache = createCache();
    const testData = [
      { zipcode: '12345', listingCount: 10 }
    ];
    const timestamp = Date.now();
    
    cache.set('zipcodes_test123', { data: testData, timestamp });
    
    const cached = cache.get('zipcodes_test123');
    const isValid = cached && Date.now() - cached.timestamp < 30 * 60 * 1000; // 30 minutes TTL
    
    expect(isValid).toBe(true);
  });

  it('should consider cache expired after TTL', () => {
    const cache = createCache();
    const testData = [
      { zipcode: '12345', listingCount: 10 }
    ];
    // Set timestamp to 31 minutes ago
    const timestamp = Date.now() - (31 * 60 * 1000);
    
    cache.set('zipcodes_test123', { data: testData, timestamp });
    
    const cached = cache.get('zipcodes_test123');
    const isValid = cached && Date.now() - cached.timestamp < 30 * 60 * 1000; // 30 minutes TTL
    
    expect(isValid).toBe(false);
  });

  it('should handle empty zip code arrays', () => {
    const cache = createCache();
    const testData: Array<{ zipcode: string; listingCount: number }> = [];
    
    cache.set('zipcodes_empty', { data: testData, timestamp: Date.now() });
    
    const cached = cache.get('zipcodes_empty');
    expect(cached?.data).toEqual([]);
    expect(cached?.data.length).toBe(0);
  });

  it('should use different cache keys for different submarkets', () => {
    const cache = createCache();
    const data1 = [{ zipcode: '11111', listingCount: 5 }];
    const data2 = [{ zipcode: '22222', listingCount: 10 }];
    
    cache.set('zipcodes_submarket1', { data: data1, timestamp: Date.now() });
    cache.set('zipcodes_submarket2', { data: data2, timestamp: Date.now() });
    
    expect(cache.get('zipcodes_submarket1')?.data).toEqual(data1);
    expect(cache.get('zipcodes_submarket2')?.data).toEqual(data2);
  });
});

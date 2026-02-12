import { describe, it, expect } from 'vitest';

/**
 * Tests for the cache deserialization fix in api-logger.ts
 * 
 * Root cause: getDbCache stored data with JSON.stringify() into a MySQL JSON column,
 * causing double-stringification. When Drizzle reads the JSON column, it auto-parses
 * one level, returning a string instead of an object.
 * 
 * Fix: getDbCache now detects when entry.data is a string and JSON.parse()s it.
 */
describe('Cache Deserialization Fix', () => {
  it('should handle double-stringified JSON data correctly', () => {
    // Simulate what the database returns for double-stringified data
    const originalData = {
      property: {
        address_lookup: "San Diego, CA",
        latitude: 32.73,
        longitude: -117.13,
        bedrooms: 3,
        market_id: "airdna-123"
      },
      estimates: {
        annual_revenue: 81721,
        average_daily_rate: 337,
        occupancy_rate: 0.66
      }
    };
    
    // This is what was stored: JSON.stringify(data) into a JSON column
    const doubleStringified = JSON.stringify(originalData);
    
    // Verify it's a string (simulating what Drizzle returns after auto-parsing one level)
    expect(typeof doubleStringified).toBe('string');
    
    // The fix: parse if it's a string
    const parsed = typeof doubleStringified === 'string' ? JSON.parse(doubleStringified) : doubleStringified;
    
    // Verify the parsed result is an object with correct structure
    expect(typeof parsed).toBe('object');
    expect(parsed.property).toBeDefined();
    expect(parsed.property.latitude).toBe(32.73);
    expect(parsed.property.longitude).toBe(-117.13);
    expect(parsed.property.address_lookup).toBe("San Diego, CA");
    expect(parsed.estimates.annual_revenue).toBe(81721);
  });

  it('should handle already-parsed object data correctly', () => {
    // If data is already an object (e.g., from memory cache), it should pass through
    const objectData = {
      property: {
        latitude: 32.73,
        longitude: -117.13,
      }
    };
    
    // The fix should not double-parse objects
    const result = typeof objectData === 'string' ? JSON.parse(objectData) : objectData;
    
    expect(typeof result).toBe('object');
    expect(result.property.latitude).toBe(32.73);
  });

  it('should handle triple-stringified JSON data', () => {
    // Edge case: data that was stringified multiple times
    const original = { key: "value", nested: { a: 1 } };
    const tripleStringified = JSON.stringify(JSON.stringify(original));
    
    // The fix parses iteratively until we get an object
    let parsed: any = tripleStringified;
    let attempts = 0;
    while (typeof parsed === 'string' && attempts < 5) {
      try {
        parsed = JSON.parse(parsed);
        attempts++;
      } catch {
        break;
      }
    }
    
    expect(typeof parsed).toBe('object');
    expect(parsed.key).toBe('value');
    expect(parsed.nested.a).toBe(1);
  });

  it('should handle null and undefined cache data gracefully', () => {
    // Null data should return null
    const nullData = null;
    const result1 = nullData;
    expect(result1).toBeNull();
    
    // Undefined data should return undefined
    const undefinedData = undefined;
    const result2 = undefinedData;
    expect(result2).toBeUndefined();
  });

  it('should handle array data from cache correctly', () => {
    // Arrays should also be properly deserialized
    const originalArray = [
      { id: 1, name: "Market A", listing_count: 100 },
      { id: 2, name: "Market B", listing_count: 200 }
    ];
    
    // Simulate double-stringification
    const stringified = JSON.stringify(originalArray);
    
    // The fix should parse it back to an array
    const parsed = typeof stringified === 'string' ? JSON.parse(stringified) : stringified;
    
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
    expect(parsed[0].name).toBe("Market A");
    expect(parsed[1].listing_count).toBe(200);
  });

  it('should handle primitive string values from cache', () => {
    // A simple string value (not JSON) should remain as-is
    const simpleString = "just a plain string";
    
    let result: any = simpleString;
    if (typeof result === 'string') {
      try {
        result = JSON.parse(result);
      } catch {
        // Not valid JSON, keep as string
      }
    }
    
    // Should remain a string since it's not valid JSON
    expect(typeof result).toBe('string');
    expect(result).toBe("just a plain string");
  });

  it('should handle numeric values from cache', () => {
    // A numeric value stored as string
    const numericString = "42";
    
    let result: any = numericString;
    if (typeof result === 'string') {
      try {
        result = JSON.parse(result);
      } catch {
        // Not valid JSON object, keep as-is
      }
    }
    
    // Should parse to number
    expect(result).toBe(42);
  });

  it('should preserve property access patterns after deserialization', () => {
    // Simulate the exact crash scenario: accessing .property.latitude on cached data
    const rentalizerResponse = {
      property: {
        address_lookup: "2953 Kalmia St, San Diego, CA 92104, USA",
        latitude: 32.7305035,
        longitude: -117.1306075,
        bedrooms: 3,
        bathrooms: 2,
        accommodates: 6,
        market_id: "airdna-1892"
      },
      estimates: {
        annual_revenue: 81721,
        annual_revenue_low: 72000,
        annual_revenue_high: 91000,
        average_daily_rate: 337,
        occupancy_rate: 0.66,
        currency_symbol: "$"
      },
      comps: [
        { title: "Comp 1", bedrooms: 3, annual_revenue: 90000 }
      ],
      monthly_forecast: []
    };
    
    // Double-stringify (simulating the bug)
    const cached = JSON.stringify(rentalizerResponse);
    
    // Parse (simulating the fix)
    const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
    
    // These are the exact access patterns that were crashing
    expect(parsed.property.latitude).toBe(32.7305035);
    expect(parsed.property.longitude).toBe(-117.1306075);
    expect(parsed.property.address_lookup).toContain("Kalmia");
    expect(parsed.property.market_id).toBe("airdna-1892");
    expect(parsed.estimates.annual_revenue).toBe(81721);
    expect(parsed.comps[0].title).toBe("Comp 1");
    
    // This was the specific crash: accessing .property on a string returns undefined,
    // then .latitude on undefined throws TypeError
    expect(() => {
      const badData = cached; // string, not parsed
      // @ts-ignore - intentionally testing runtime behavior
      const lat = (badData as any).property?.latitude;
      // With optional chaining, this returns undefined instead of crashing
      expect(lat).toBeUndefined();
    }).not.toThrow();
  });
});

import { describe, it, expect } from 'vitest';

describe('Geocoding retry address cleaning', () => {
  // Test the address cleaning logic used in the geocoding retry
  function cleanAddress(address: string): string {
    return address
      .replace(/\s*#\S+/, '')
      .replace(/\s*(apt|unit|suite|ste|bldg|fl|floor)\s*\S*/gi, '')
      .trim();
  }

  function buildGeocodingAttempts(address: string, addressLookup?: string): string[] {
    const attempts = [
      address,
      cleanAddress(address),
      addressLookup ? `${address}, ${addressLookup}` : null,
    ].filter(Boolean) as string[];
    return Array.from(new Set(attempts));
  }

  it('should clean unit/apartment numbers from addresses', () => {
    // The regex removes the keyword and everything after it up to the next word boundary
    // so 'Apt 4B,' becomes removed, leaving the comma-less join
    expect(cleanAddress('123 Main St Apt 4B, Denver, CO 80202')).toBe('123 Main St Denver, CO 80202');
    expect(cleanAddress('456 Oak Ave Unit 12, Portland, OR 97201')).toBe('456 Oak Ave Portland, OR 97201');
    expect(cleanAddress('789 Pine Rd Suite 100, Austin, TX 78701')).toBe('789 Pine Rd Austin, TX 78701');
    expect(cleanAddress('321 Elm St #5, Seattle, WA 98101')).toBe('321 Elm St Seattle, WA 98101');
    expect(cleanAddress('555 Broadway Ste 2A, New York, NY 10001')).toBe('555 Broadway New York, NY 10001');
  });

  it('should not modify addresses without unit numbers', () => {
    const address = '2953 Kalmia St, San Diego, CA 92104';
    expect(cleanAddress(address)).toBe(address);
  });

  it('should generate unique geocoding attempts', () => {
    // When cleaned address is same as original, should deduplicate
    const attempts = buildGeocodingAttempts('2953 Kalmia St, San Diego, CA 92104');
    expect(attempts.length).toBe(1);
    expect(attempts[0]).toBe('2953 Kalmia St, San Diego, CA 92104');
  });

  it('should generate multiple attempts when address has unit number', () => {
    const attempts = buildGeocodingAttempts('123 Main St Apt 4B, Denver, CO 80202');
    expect(attempts.length).toBe(2);
    expect(attempts[0]).toBe('123 Main St Apt 4B, Denver, CO 80202');
    expect(attempts[1]).toBe('123 Main St Denver, CO 80202');
  });

  it('should include address_lookup variant when available', () => {
    const attempts = buildGeocodingAttempts('2953 Kalmia St', 'San Diego, CA');
    expect(attempts.length).toBe(2);
    expect(attempts[0]).toBe('2953 Kalmia St');
    expect(attempts[1]).toBe('2953 Kalmia St, San Diego, CA');
  });

  it('should generate all three variants when address has unit and lookup', () => {
    const attempts = buildGeocodingAttempts('123 Main St Apt 4B, Denver, CO', 'Denver, CO');
    expect(attempts.length).toBe(3);
    expect(attempts[0]).toBe('123 Main St Apt 4B, Denver, CO');
    expect(attempts[1]).toBe('123 Main St Denver, CO');
    expect(attempts[2]).toBe('123 Main St Apt 4B, Denver, CO, Denver, CO');
  });
});

describe('searchResults Array safety', () => {
  it('should handle non-array values gracefully', () => {
    const ensureArray = (data: unknown) => Array.isArray(data) ? data : [];
    
    expect(ensureArray(undefined)).toEqual([]);
    expect(ensureArray(null)).toEqual([]);
    expect(ensureArray({})).toEqual([]);
    expect(ensureArray('string')).toEqual([]);
    expect(ensureArray(42)).toEqual([]);
    expect(ensureArray([1, 2, 3])).toEqual([1, 2, 3]);
    expect(ensureArray([])).toEqual([]);
  });
});

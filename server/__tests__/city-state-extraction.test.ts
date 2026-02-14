/**
 * Tests for city/state extraction from address_lookup strings.
 * 
 * The AirDNA API returns address_lookup in two formats:
 * 1. Short: "City, ST" (e.g., "San Diego, CA")
 * 2. Full: "Street, City, ST ZIP" (e.g., "1622 HALLIARD DR, LAWRENCEVILLE, GA 30043")
 * 
 * Bug: The old code did address_lookup.split(',')[0] for city and [1] for state,
 * which gave wrong results for full addresses (street as city, city as state).
 */
import { describe, it, expect } from 'vitest';

// Re-implement the function here for testing (it's private in shared-reports.ts)
function extractCityStateFromAddress(addr: string | undefined | null): { city: string; state: string } {
  if (!addr) return { city: '', state: '' };
  const parts = addr.split(',').map(p => p.trim());
  if (parts.length >= 3) {
    // Format: "Street, City, ST 12345" or "Street, City, ST 12345, USA"
    const hasCountry = /^(USA|US|United States)$/i.test(parts[parts.length - 1]);
    const cityIdx = hasCountry ? parts.length - 3 : parts.length - 2;
    const stateIdx = hasCountry ? parts.length - 2 : parts.length - 1;
    const city = parts[cityIdx] || '';
    const state = (parts[stateIdx] || '').replace(/\s*\d{5}(-\d{4})?\s*$/, '').trim();
    return { city, state };
  } else if (parts.length === 2) {
    // Format: "City, ST" or "City, ST 12345"
    const city = parts[0];
    const state = parts[1].replace(/\s*\d{5}(-\d{4})?\s*$/, '').trim();
    return { city, state };
  }
  return { city: addr, state: '' };
}

describe('extractCityStateFromAddress', () => {
  it('should handle short format "City, ST"', () => {
    const result = extractCityStateFromAddress('San Diego, CA');
    expect(result.city).toBe('San Diego');
    expect(result.state).toBe('CA');
  });

  it('should handle short format with zip "City, ST 12345"', () => {
    const result = extractCityStateFromAddress('Lawrenceville, GA 30043');
    expect(result.city).toBe('Lawrenceville');
    expect(result.state).toBe('GA');
  });

  it('should handle full address format "Street, City, ST ZIP"', () => {
    const result = extractCityStateFromAddress('1622 HALLIARD DR, LAWRENCEVILLE, GA 30043');
    expect(result.city).toBe('LAWRENCEVILLE');
    expect(result.state).toBe('GA');
  });

  it('should handle full address with USA suffix', () => {
    const result = extractCityStateFromAddress('1622 Halliard Dr, Lawrenceville, GA 30043, USA');
    expect(result.city).toBe('Lawrenceville');
    expect(result.state).toBe('GA'); // zip is stripped
  });

  it('should handle Google Places format "Street, City, ST ZIP, USA"', () => {
    const result = extractCityStateFromAddress('1321 15th St, Denver, CO 80202, USA');
    expect(result.city).toBe('Denver');
    expect(result.state).toBe('CO'); // zip is stripped
  });

  it('should handle standard Google Places format "Street, City, ST ZIP"', () => {
    const result = extractCityStateFromAddress('1321 15th St, Denver, CO 80202');
    expect(result.city).toBe('Denver');
    expect(result.state).toBe('CO');
  });

  it('should handle null/undefined', () => {
    expect(extractCityStateFromAddress(null)).toEqual({ city: '', state: '' });
    expect(extractCityStateFromAddress(undefined)).toEqual({ city: '', state: '' });
    expect(extractCityStateFromAddress('')).toEqual({ city: '', state: '' });
  });

  it('should handle single value (no commas)', () => {
    const result = extractCityStateFromAddress('Atlanta');
    expect(result.city).toBe('Atlanta');
    expect(result.state).toBe('');
  });

  it('should handle address with extended zip code', () => {
    const result = extractCityStateFromAddress('456 Oak Ave, Miami, FL 33139-1234');
    expect(result.city).toBe('Miami');
    expect(result.state).toBe('FL');
  });

  // BUG REGRESSION TEST: The old code would return city="1622 HALLIARD DR" and state="LAWRENCEVILLE"
  it('should NOT return street address as city (Halliard Dr regression)', () => {
    const result = extractCityStateFromAddress('1622 HALLIARD DR, LAWRENCEVILLE, GA 30043');
    expect(result.city).not.toBe('1622 HALLIARD DR');
    expect(result.state).not.toBe('LAWRENCEVILLE');
    expect(result.city).toBe('LAWRENCEVILLE');
    expect(result.state).toBe('GA');
  });
});

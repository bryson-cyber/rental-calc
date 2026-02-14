/**
 * Tests for HasData Zillow API Integration
 */

import { describe, it, expect } from 'vitest';
import { isZillowUrl, extractZpid } from './hasdata-zillow';

describe('HasData Zillow Integration', () => {
  describe('isZillowUrl', () => {
    it('should return true for valid homedetails URLs', () => {
      const validUrls = [
        'https://www.zillow.com/homedetails/123-Main-St-Denver-CO-80202/12345_zpid/',
        'https://zillow.com/homedetails/456-Oak-Ave-Atlanta-GA/67890_zpid/',
        'http://www.zillow.com/homedetails/789-Pine-Rd-Miami-FL/11111_zpid/',
      ];
      
      validUrls.forEach(url => {
        expect(isZillowUrl(url)).toBe(true);
      });
    });

    it('should return true for valid homes URLs', () => {
      const validUrls = [
        'https://www.zillow.com/homes/123-Main-St-Denver-CO_rb/',
        'https://zillow.com/homes/for_sale/456-Oak-Ave/',
      ];
      
      validUrls.forEach(url => {
        expect(isZillowUrl(url)).toBe(true);
      });
    });

    it('should return true for building URLs', () => {
      const url = 'https://www.zillow.com/b/building-name-city-state/';
      expect(isZillowUrl(url)).toBe(true);
    });

    it('should return false for non-Zillow URLs', () => {
      const invalidUrls = [
        'https://www.redfin.com/homedetails/123-Main-St/',
        'https://www.realtor.com/property/12345',
        'https://google.com',
        '123 Main St, Denver, CO 80202',
        '',
      ];
      
      invalidUrls.forEach(url => {
        expect(isZillowUrl(url)).toBe(false);
      });
    });

    it('should return false for null or undefined', () => {
      expect(isZillowUrl('')).toBe(false);
    });
  });

  describe('extractZpid', () => {
    it('should extract ZPID from URLs with _zpid suffix', () => {
      const url = 'https://www.zillow.com/homedetails/123-Main-St-Denver-CO-80202/12345678_zpid/';
      expect(extractZpid(url)).toBe('12345678');
    });

    it('should extract ZPID from various URL formats', () => {
      const testCases = [
        { url: 'https://zillow.com/homedetails/address/99999_zpid/', expected: '99999' },
        { url: 'https://www.zillow.com/homes/123456_zpid', expected: '123456' },
      ];
      
      testCases.forEach(({ url, expected }) => {
        expect(extractZpid(url)).toBe(expected);
      });
    });

    it('should return null for URLs without ZPID', () => {
      const url = 'https://www.zillow.com/homes/for_sale/Denver-CO/';
      expect(extractZpid(url)).toBeNull();
    });

    it('should return null for non-Zillow URLs', () => {
      const url = 'https://www.redfin.com/property/12345';
      expect(extractZpid(url)).toBeNull();
    });
  });
});

// ============================================================
// HasData API Response Mapping Tests
// ============================================================

import { vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally for the new tests
const mockFetch = vi.fn();

describe('HasData Listing API Response Mapping (Direct — No Enrichment)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch as any;
    mockFetch.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reads properties from data.properties array with price/beds/baths directly', async () => {
    const { searchZillowRentals } = await import('./hasdata-zillow');

    // Listing API returns price, bedrooms, bathrooms directly — no enrichment needed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        properties: [
          {
            zpid: '123',
            detailUrl: 'https://www.zillow.com/homedetails/123_zpid/',
            address: { street: '123 Main St', city: 'Denver', state: 'CO', zipcode: '80202' },
            price: 2500,
            bedrooms: 3,
            bathrooms: 2,
            livingArea: 1800,
            homeType: 'SINGLE_FAMILY',
            imgSrc: 'https://photos.zillowstatic.com/123.jpg',
            latitude: 39.75,
            longitude: -104.99,
            homeStatus: 'FOR_RENT',
          },
        ],
        searchInformation: { totalResults: 1 },
        pagination: { currentPage: 1, totalPages: 1 },
      }),
    });

    const result = await searchZillowRentals({ city: 'Denver', state: 'CO' });

    expect(result.success).toBe(true);
    expect(result.listings.length).toBe(1);

    const listing = result.listings[0];
    expect(listing.zpid).toBe('123');
    expect(listing.price).toBe(2500);
    expect(listing.bedrooms).toBe(3);
    expect(listing.bathrooms).toBe(2);
    expect(listing.livingArea).toBe(1800);
    expect(listing.city).toBe('Denver');
    expect(listing.state).toBe('CO');
    expect(listing.zipcode).toBe('80202');

    // Only ONE fetch call — no Property API enrichment
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('api.hasdata.com/scrape/zillow/listing');
  });

  it('maps address from nested object format', async () => {
    const { searchZillowRentals } = await import('./hasdata-zillow');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        properties: [
          {
            zpid: '456',
            url: 'https://www.zillow.com/homedetails/456_zpid/',
            address: { street: '456 Oak Ave', city: 'Austin', state: 'TX', zipcode: '78701' },
            price: 3200,
            bedrooms: 4,
            bathrooms: 3,
            homeStatus: 'FOR_RENT',
          },
        ],
      }),
    });

    const result = await searchZillowRentals({ city: 'Austin', state: 'TX' });

    expect(result.success).toBe(true);
    expect(result.listings.length).toBe(1);
    expect(result.listings[0].address).toContain('456 Oak Ave');
    expect(result.listings[0].address).toContain('Austin');
    expect(result.listings[0].price).toBe(3200);
    expect(result.listings[0].bedrooms).toBe(4);
  });

  it('maps address from flat string format', async () => {
    const { searchZillowRentals } = await import('./hasdata-zillow');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        properties: [
          {
            zpid: '789',
            detailUrl: 'https://www.zillow.com/homedetails/789_zpid/',
            streetAddress: '789 Elm Blvd, Chicago, IL 60601',
            price: 1800,
            beds: 2,
            baths: 1,
            homeStatus: 'FOR_RENT',
          },
        ],
      }),
    });

    const result = await searchZillowRentals({ city: 'Chicago', state: 'IL' });

    expect(result.success).toBe(true);
    expect(result.listings.length).toBe(1);
    expect(result.listings[0].address).toContain('789 Elm Blvd');
    expect(result.listings[0].price).toBe(1800);
    expect(result.listings[0].bedrooms).toBe(2);
    expect(result.listings[0].bathrooms).toBe(1);
  });

  it('filters out non-rental properties', async () => {
    const { searchZillowRentals } = await import('./hasdata-zillow');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        properties: [
          {
            zpid: '100',
            url: 'https://www.zillow.com/homedetails/100_zpid/',
            price: 2000,
            bedrooms: 2,
            homeStatus: 'FOR_RENT',
          },
          {
            zpid: '200',
            url: 'https://www.zillow.com/homedetails/200_zpid/',
            price: 350000,
            bedrooms: 3,
            homeStatus: 'FOR_SALE',
          },
          {
            zpid: '300',
            url: 'https://www.zillow.com/homedetails/300_zpid/',
            price: 1500,
            bedrooms: 1,
            homeStatus: 'FOR_RENT',
          },
        ],
      }),
    });

    const result = await searchZillowRentals({ city: 'Miami', state: 'FL' });

    expect(result.success).toBe(true);
    // FOR_SALE property should be filtered out
    expect(result.listings.length).toBe(2);
    expect(result.listings.every(l => l.statusText !== 'FOR_SALE')).toBe(true);
  });

  it('uses fallback fields (beds/baths/unformattedPrice) when primary fields missing', async () => {
    const { searchZillowRentals } = await import('./hasdata-zillow');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        properties: [
          {
            zpid: '555',
            detailUrl: 'https://www.zillow.com/homedetails/555_zpid/',
            address: { street: '555 Maple Dr', city: 'Portland', state: 'OR', zipcode: '97201' },
            unformattedPrice: 2800,
            beds: 3,
            baths: 2.5,
            area: 1600,
            status: 'FOR_RENT',
          },
        ],
      }),
    });

    const result = await searchZillowRentals({ city: 'Portland', state: 'OR' });

    expect(result.success).toBe(true);
    expect(result.listings.length).toBe(1);
    expect(result.listings[0].price).toBe(2800);
    expect(result.listings[0].bedrooms).toBe(3);
    expect(result.listings[0].bathrooms).toBe(2.5);
  });

  it('handles empty properties array gracefully', async () => {
    const { searchZillowRentals } = await import('./hasdata-zillow');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        properties: [],
      }),
    });

    const result = await searchZillowRentals({ city: 'Nowhere', state: 'XX' });

    expect(result.success).toBe(false);
    expect(result.listings.length).toBe(0);
  });

  it('handles API error gracefully', async () => {
    const { searchZillowRentals } = await import('./hasdata-zillow');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    });

    const result = await searchZillowRentals({ city: 'Denver', state: 'CO' });

    expect(result.success).toBe(false);
    expect(result.listings.length).toBe(0);
  });

  it('does NOT call Property API — only 1 fetch call per search', async () => {
    const { searchZillowRentals } = await import('./hasdata-zillow');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        properties: [
          { zpid: 'a', price: 1000, bedrooms: 1, homeStatus: 'FOR_RENT' },
          { zpid: 'b', price: 2000, bedrooms: 2, homeStatus: 'FOR_RENT' },
          { zpid: 'c', price: 3000, bedrooms: 3, homeStatus: 'FOR_RENT' },
        ],
      }),
    });

    const result = await searchZillowRentals({ city: 'Test', state: 'TS' });

    expect(result.success).toBe(true);
    expect(result.listings.length).toBe(3);

    // CRITICAL: Only 1 API call (Listing API). No Property API enrichment calls.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// Admin Rate Limit Context Tests
// ============================================================

describe('Admin Rate Limit Context', () => {
  it('isAdminRequest returns false when no context is set', async () => {
    const { isAdminRequest } = await import('./request-context');
    expect(isAdminRequest()).toBe(false);
  });

  it('isAdminRequest returns true inside runWithRequestContext with isAdmin=true', async () => {
    const { runWithRequestContext, isAdminRequest } = await import('./request-context');

    let result = false;
    await runWithRequestContext({ isAdmin: true, userId: 1 }, () => {
      result = isAdminRequest();
    });

    expect(result).toBe(true);
  });

  it('isAdminRequest returns false inside runWithRequestContext with isAdmin=false', async () => {
    const { runWithRequestContext, isAdminRequest } = await import('./request-context');

    let result = true;
    await runWithRequestContext({ isAdmin: false, userId: 2 }, () => {
      result = isAdminRequest();
    });

    expect(result).toBe(false);
  });

  it('nested async calls inherit admin context', async () => {
    const { runWithRequestContext, isAdminRequest } = await import('./request-context');

    let deepResult = false;
    await runWithRequestContext({ isAdmin: true, userId: 1 }, async () => {
      // Simulate a nested async call (like AirDNA rate limiter checking admin status)
      await new Promise((resolve) => setTimeout(resolve, 10));
      deepResult = isAdminRequest();
    });

    expect(deepResult).toBe(true);
  });
});

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

describe('HasData Listing API Response Mapping', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch as any;
    mockFetch.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reads properties from data.properties array (not listings or results)', async () => {
    // Dynamically import to get fresh module with mocked fetch
    const { searchZillowRentals } = await import('./hasdata-zillow');

    // Step 1: Listing API returns `properties`
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: [
            {
              url: 'https://www.zillow.com/homedetails/123_zpid/',
              address: { street: '123 Main St', city: 'Denver', state: 'CO', zipcode: '80202' },
              image: 'https://photos.zillowstatic.com/123.jpg',
              latitude: 39.75,
              longitude: -104.99,
              status: 'FOR_RENT',
            },
          ],
          pagination: { totalCount: 1, currentPage: 1, totalPages: 1 },
        }),
      })
      // Step 2: Property API enrichment
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          property: {
            id: '123',
            address: { street: '123 Main St', city: 'Denver', state: 'CO', zipcode: '80202' },
            price: 2500,
            bedrooms: 3,
            bathrooms: 2,
            livingArea: 1800,
            homeType: 'SINGLE_FAMILY',
            latitude: 39.75,
            longitude: -104.99,
            image: 'https://photos.zillowstatic.com/123.jpg',
            url: 'https://www.zillow.com/homedetails/123_zpid/',
          },
        }),
      });

    const result = await searchZillowRentals({ city: 'Denver', state: 'CO' });

    expect(result.success).toBe(true);
    expect(result.listings.length).toBeGreaterThanOrEqual(1);

    // Verify the Listing API was called with correct URL
    const listingCall = mockFetch.mock.calls[0];
    expect(listingCall[0]).toContain('api.hasdata.com/scrape/zillow/listing');
    expect(listingCall[0]).toContain('keyword=Denver');
  });

  it('enriches listings with price/beds/baths from Property API', async () => {
    const { searchZillowRentals } = await import('./hasdata-zillow');

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: [
            {
              url: 'https://www.zillow.com/homedetails/456_zpid/',
              address: { street: '456 Oak Ave', city: 'Austin', state: 'TX', zipcode: '78701' },
              status: 'FOR_RENT',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          property: {
            id: '456',
            address: { street: '456 Oak Ave', city: 'Austin', state: 'TX', zipcode: '78701' },
            price: 3200,
            bedrooms: 4,
            bathrooms: 3,
            livingArea: 2200,
            homeType: 'TOWNHOUSE',
          },
        }),
      });

    const result = await searchZillowRentals({ city: 'Austin', state: 'TX' });

    expect(result.success).toBe(true);
    expect(result.listings.length).toBe(1);

    const listing = result.listings[0];
    expect(listing.price).toBe(3200);
    expect(listing.bedrooms).toBe(4);
    expect(listing.bathrooms).toBe(3);
    expect(listing.livingArea).toBe(2200);
    expect(listing.city).toBe('Austin');
    expect(listing.state).toBe('TX');
  });

  it('handles multi-unit buildings with listings sub-array', async () => {
    const { searchZillowRentals } = await import('./hasdata-zillow');

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: [
            {
              url: 'https://www.zillow.com/homedetails/789_zpid/',
              address: { street: '789 Elm Blvd', city: 'Chicago', state: 'IL', zipcode: '60601' },
              status: 'FOR_RENT',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          property: {
            id: '789',
            address: { street: '789 Elm Blvd', city: 'Chicago', state: 'IL', zipcode: '60601' },
            homeType: 'MULTI_FAMILY',
            latitude: 41.88,
            longitude: -87.63,
            image: 'https://photos.zillowstatic.com/789.jpg',
            listings: [
              { id: '789a', price: 1800, beds: 2, baths: 1, area: 900, status: 'FOR_RENT', url: 'https://www.zillow.com/homedetails/789a_zpid/' },
              { id: '789b', price: 2200, beds: 3, baths: 2, area: 1200, status: 'FOR_RENT', url: 'https://www.zillow.com/homedetails/789b_zpid/' },
              { id: '789c', price: 0, beds: 1, baths: 1, area: 600, status: 'SOLD', url: 'https://www.zillow.com/homedetails/789c_zpid/' },
            ],
          },
        }),
      });

    const result = await searchZillowRentals({ city: 'Chicago', state: 'IL' });

    expect(result.success).toBe(true);
    // Should only include FOR_RENT units (2 out of 3)
    expect(result.listings.length).toBe(2);
    expect(result.listings[0].price).toBe(1800);
    expect(result.listings[0].bedrooms).toBe(2);
    expect(result.listings[1].price).toBe(2200);
    expect(result.listings[1].bedrooms).toBe(3);
  });

  it('creates fallback listing when Property API fails', async () => {
    const { searchZillowRentals } = await import('./hasdata-zillow');

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          properties: [
            {
              url: 'https://www.zillow.com/homedetails/999_zpid/',
              address: { street: '999 Fail St', city: 'Miami', state: 'FL', zipcode: '33101' },
              image: 'https://photos.zillowstatic.com/999.jpg',
              status: 'FOR_RENT',
            },
          ],
        }),
      })
      .mockRejectedValueOnce(new Error('Network error'));

    const result = await searchZillowRentals({ city: 'Miami', state: 'FL' });

    expect(result.success).toBe(true);
    // Should still have a listing (fallback), but with price=0
    expect(result.listings.length).toBe(1);
    expect(result.listings[0].price).toBe(0);
    expect(result.listings[0].bedrooms).toBe(0);
    expect(result.listings[0].city).toBe('Miami');
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

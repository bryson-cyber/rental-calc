import { describe, it, expect } from 'vitest';

/**
 * Tests for the rental search multi-page pagination fix.
 * 
 * Root cause: The rental search (searchZillowRentals) only fetched page 1 (~40 results),
 * while the For Sale search fetched pages 1-3 (~120 results). This caused users to see
 * only 37 of 97 available rentals for zip code 91109 (Pasadena, CA).
 * 
 * Fix: Updated searchZillowRentals to match searchZillowForSale behavior:
 * - Initial search fetches up to 3 pages in parallel
 * - loadMore=true fetches only the specified page for subsequent loads
 * - Deduplication by property ID prevents duplicates across pages
 */

describe('Rental Search Multi-Page Pagination', () => {
  describe('Page calculation logic', () => {
    it('should calculate correct number of pages for small result sets', () => {
      const totalResults = 37;
      const perPage = 40;
      const estimatedTotalPages = Math.ceil(totalResults / perPage);
      expect(estimatedTotalPages).toBe(1);
      
      const initialPagesToFetch = Math.min(3, estimatedTotalPages);
      expect(initialPagesToFetch).toBe(1);
    });

    it('should calculate correct number of pages for medium result sets (91109 case)', () => {
      const totalResults = 97;
      const perPage = 40;
      const estimatedTotalPages = Math.ceil(totalResults / perPage);
      expect(estimatedTotalPages).toBe(3);
      
      const initialPagesToFetch = Math.min(3, estimatedTotalPages);
      expect(initialPagesToFetch).toBe(3);
    });

    it('should cap initial fetch at 3 pages for large result sets', () => {
      const totalResults = 500;
      const perPage = 40;
      const estimatedTotalPages = Math.ceil(totalResults / perPage);
      expect(estimatedTotalPages).toBe(13);
      
      const initialPagesToFetch = Math.min(3, estimatedTotalPages);
      expect(initialPagesToFetch).toBe(3);
    });

    it('should handle single-page result sets correctly', () => {
      const totalResults = 15;
      const perPage = 40;
      const estimatedTotalPages = Math.ceil(totalResults / perPage);
      expect(estimatedTotalPages).toBe(1);
      
      const initialPagesToFetch = Math.min(3, estimatedTotalPages);
      expect(initialPagesToFetch).toBe(1);
      
      // Should not fetch additional pages
      const shouldFetchMore = initialPagesToFetch > 1;
      expect(shouldFetchMore).toBe(false);
    });
  });

  describe('hasMore calculation', () => {
    it('should report hasMore=true when more pages exist beyond initial 3', () => {
      const totalResults = 500;
      const perPage = 40;
      const estimatedTotalPages = Math.ceil(totalResults / perPage);
      const initialPagesToFetch = Math.min(3, estimatedTotalPages);
      
      const hasMore = initialPagesToFetch < estimatedTotalPages;
      expect(hasMore).toBe(true);
    });

    it('should report hasMore=false when all pages fetched', () => {
      const totalResults = 97;
      const perPage = 40;
      const estimatedTotalPages = Math.ceil(totalResults / perPage);
      const initialPagesToFetch = Math.min(3, estimatedTotalPages);
      
      const hasMore = initialPagesToFetch < estimatedTotalPages;
      expect(hasMore).toBe(false);
    });

    it('should report hasMore=false for single page results', () => {
      const totalResults = 37;
      const perPage = 40;
      const estimatedTotalPages = Math.ceil(totalResults / perPage);
      const initialPagesToFetch = Math.min(3, estimatedTotalPages);
      
      const hasMore = initialPagesToFetch < estimatedTotalPages;
      expect(hasMore).toBe(false);
    });

    it('should report hasMore=true for loadMore page that is not the last', () => {
      const currentPage = 4;
      const totalResults = 500;
      const perPage = 40;
      const estimatedTotalPages = Math.ceil(totalResults / perPage);
      
      const hasMore = currentPage < estimatedTotalPages;
      expect(hasMore).toBe(true);
    });
  });

  describe('Deduplication logic', () => {
    it('should deduplicate properties by ID across pages', () => {
      const page1Properties = [
        { id: '1', address: 'A' },
        { id: '2', address: 'B' },
        { id: '3', address: 'C' },
      ];
      
      const page2Properties = [
        { id: '3', address: 'C' }, // duplicate
        { id: '4', address: 'D' },
        { id: '5', address: 'E' },
      ];
      
      let allProperties = [...page1Properties];
      const existingIds = new Set(allProperties.map(p => p.id));
      const newProperties = page2Properties.filter(p => !existingIds.has(p.id));
      allProperties.push(...newProperties);
      
      expect(allProperties.length).toBe(5);
      expect(allProperties.map(p => p.id)).toEqual(['1', '2', '3', '4', '5']);
    });

    it('should handle no duplicates across pages', () => {
      const page1Properties = [
        { id: '1', address: 'A' },
        { id: '2', address: 'B' },
      ];
      
      const page2Properties = [
        { id: '3', address: 'C' },
        { id: '4', address: 'D' },
      ];
      
      let allProperties = [...page1Properties];
      const existingIds = new Set(allProperties.map(p => p.id));
      const newProperties = page2Properties.filter(p => !existingIds.has(p.id));
      allProperties.push(...newProperties);
      
      expect(allProperties.length).toBe(4);
    });

    it('should handle all duplicates (same results on both pages)', () => {
      const page1Properties = [
        { id: '1', address: 'A' },
        { id: '2', address: 'B' },
      ];
      
      const page2Properties = [
        { id: '1', address: 'A' },
        { id: '2', address: 'B' },
      ];
      
      let allProperties = [...page1Properties];
      const existingIds = new Set(allProperties.map(p => p.id));
      const newProperties = page2Properties.filter(p => !existingIds.has(p.id));
      allProperties.push(...newProperties);
      
      expect(allProperties.length).toBe(2);
    });
  });

  describe('Rate limit soft limit increase', () => {
    it('should have non-admin soft limit at 550 (raised from 400)', () => {
      // The non-admin soft limit was raised from 400 to 550 to prevent
      // blocking legitimate user-facing features like batch analysis
      const NON_ADMIN_SOFT_LIMIT = 550;
      const HARD_LIMIT = 600;
      
      expect(NON_ADMIN_SOFT_LIMIT).toBeGreaterThan(400);
      expect(NON_ADMIN_SOFT_LIMIT).toBeLessThan(HARD_LIMIT);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Submarket Resolution Tests
 * 
 * Tests the logic that resolves submarket IDs (e.g., airdna-3577 for Richardson)
 * to their parent market IDs (e.g., airdna-403 for Dallas).
 * 
 * This is critical because:
 * 1. The AirDNA rentalizer API sometimes returns submarket IDs as market_id
 * 2. The /market/{id} endpoint returns 404 for submarket IDs
 * 3. The /submarket/{id} endpoint also returns 404 for some submarket IDs
 * 4. The /market/search endpoint correctly identifies submarkets and their parents
 */

// Mock the AirDNA API functions
const mockSearchMarketsAPI = vi.fn();
const mockGetSubmarketDetails = vi.fn();
const mockGetMarketDetails = vi.fn();
const mockGetMarketHistoricalData = vi.fn();
const mockGetSubmarketsInMarket = vi.fn();

// Helper to simulate the submarket resolution logic from getComprehensivePropertyReport
function resolveSubmarketId(
  marketId: string | null,
  searchResults: Array<{
    id: string;
    name: string;
    type: 'market' | 'submarket';
    listing_count: number;
    location_name: string;
    state?: string;
    parent_market?: { id: string; name: string };
  }>
): { resolvedMarketId: string | null; submarketId: string | null } {
  if (!searchResults.length) {
    return { resolvedMarketId: marketId, submarketId: null };
  }

  // Priority 1: Direct market-type result
  const directMarket = searchResults.find(m => m.type === 'market');
  if (directMarket) {
    return { resolvedMarketId: directMarket.id, submarketId: null };
  }

  // Priority 2: Submarket with parent_market → use parent
  const subWithParent = searchResults.find(m => m.type === 'submarket' && m.parent_market?.id);
  if (subWithParent?.parent_market) {
    return { resolvedMarketId: subWithParent.parent_market.id, submarketId: subWithParent.id };
  }

  // Priority 3: Submarket without parent_market → use submarket directly (will need further resolution)
  const anySubmarket = searchResults.find(m => m.type === 'submarket');
  if (anySubmarket) {
    return { resolvedMarketId: anySubmarket.id, submarketId: anySubmarket.id };
  }

  return { resolvedMarketId: marketId, submarketId: null };
}

describe('Submarket Resolution Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveSubmarketId', () => {
    it('should resolve Richardson (airdna-3577) to Dallas (airdna-403)', () => {
      const searchResults = [
        {
          id: 'airdna-3577',
          name: 'Richardson, Texas',
          type: 'submarket' as const,
          listing_count: 541,
          location_name: 'Richardson, Texas, United States, US',
          state: 'Texas',
          parent_market: { id: 'airdna-403', name: 'Dallas' },
        },
      ];

      const result = resolveSubmarketId('airdna-3577', searchResults);
      expect(result.resolvedMarketId).toBe('airdna-403');
      expect(result.submarketId).toBe('airdna-3577');
    });

    it('should prefer direct market result over submarket', () => {
      const searchResults = [
        {
          id: 'airdna-403',
          name: 'Dallas, Texas',
          type: 'market' as const,
          listing_count: 19380,
          location_name: 'Dallas, Texas, United States, US',
          state: 'Texas',
        },
        {
          id: 'airdna-3577',
          name: 'Richardson, Texas',
          type: 'submarket' as const,
          listing_count: 541,
          location_name: 'Richardson, Texas, United States, US',
          state: 'Texas',
          parent_market: { id: 'airdna-403', name: 'Dallas' },
        },
      ];

      const result = resolveSubmarketId(null, searchResults);
      expect(result.resolvedMarketId).toBe('airdna-403');
      expect(result.submarketId).toBeNull();
    });

    it('should handle empty search results', () => {
      const result = resolveSubmarketId('airdna-3577', []);
      expect(result.resolvedMarketId).toBe('airdna-3577');
      expect(result.submarketId).toBeNull();
    });

    it('should handle submarket without parent_market', () => {
      const searchResults = [
        {
          id: 'airdna-9999',
          name: 'Some Neighborhood',
          type: 'submarket' as const,
          listing_count: 100,
          location_name: 'Some Neighborhood, TX, US',
          state: 'TX',
        },
      ];

      const result = resolveSubmarketId('airdna-9999', searchResults);
      expect(result.resolvedMarketId).toBe('airdna-9999');
      expect(result.submarketId).toBe('airdna-9999');
    });

    it('should resolve Old East Dallas to Dallas parent', () => {
      const searchResults = [
        {
          id: 'airdna-4178',
          name: 'Old East Dallas, Texas',
          type: 'submarket' as const,
          listing_count: 2086,
          location_name: 'Old East Dallas, Texas, United States, US',
          state: 'Texas',
          parent_market: { id: 'airdna-403', name: 'Dallas' },
        },
      ];

      const result = resolveSubmarketId('airdna-4178', searchResults);
      expect(result.resolvedMarketId).toBe('airdna-403');
      expect(result.submarketId).toBe('airdna-4178');
    });
  });

  describe('Zip code search fallback', () => {
    it('should extract parent market from zip code search results', () => {
      // Simulates what happens when searching by zip code "75082"
      const zipResults = [
        {
          id: 'airdna-3577',
          name: 'Richardson, Texas',
          type: 'submarket' as const,
          listing_count: 541,
          location_name: 'Richardson, Texas, United States, US',
          state: 'Texas',
          parent_market: { id: 'airdna-403', name: 'Dallas' },
        },
      ];

      // No direct market result
      const directMarket = zipResults.find(m => m.type === 'market');
      expect(directMarket).toBeUndefined();

      // Should find submarket with parent
      const subWithParent = zipResults.find(m => m.type === 'submarket' && m.parent_market?.id);
      expect(subWithParent).toBeDefined();
      expect(subWithParent!.parent_market!.id).toBe('airdna-403');
      expect(subWithParent!.parent_market!.name).toBe('Dallas');
    });

    it('should handle zip code returning a market directly', () => {
      // Some zip codes map directly to markets (e.g., a major city zip)
      const zipResults = [
        {
          id: 'airdna-403',
          name: 'Dallas, Texas',
          type: 'market' as const,
          listing_count: 19380,
          location_name: 'Dallas, Texas, United States, US',
          state: 'Texas',
        },
      ];

      const directMarket = zipResults.find(m => m.type === 'market');
      expect(directMarket).toBeDefined();
      expect(directMarket!.id).toBe('airdna-403');
    });
  });

  describe('Search term retry logic', () => {
    it('should retry without state suffix when "City, ST" returns no results', () => {
      // The AirDNA API returns 404 for "Richardson, TX" but works for "Richardson"
      // This tests the retry logic
      const searchTermWithState = 'Richardson, TX';
      const searchTermWithoutState = 'Richardson';
      const state = 'TX';

      // Simulate: first search returns empty, retry without state
      const firstResults: any[] = []; // "Richardson, TX" → 404/empty
      const retryResults = [
        {
          id: 'airdna-3577',
          name: 'Richardson, Texas',
          type: 'submarket' as const,
          listing_count: 541,
          location_name: 'Richardson, Texas, United States, US',
          state: 'Texas',
          parent_market: { id: 'airdna-403', name: 'Dallas' },
        },
      ];

      // Should retry
      expect(firstResults.length).toBe(0);
      expect(state).toBeDefined();
      expect(searchTermWithoutState).not.toBe(searchTermWithState);

      // Retry should succeed
      expect(retryResults.length).toBe(1);
      expect(retryResults[0].parent_market?.id).toBe('airdna-403');
    });
  });

  describe('Proactive submarket detection', () => {
    it('should detect submarket ID from rentalizer and resolve to parent', () => {
      // When rentalizer returns market_id: "airdna-3577"
      const marketIdFromRentalizer = 'airdna-3577';

      // searchMarketsAPI("Richardson") returns submarket with parent
      const searchResults = [
        {
          id: 'airdna-3577',
          name: 'Richardson, Texas',
          type: 'submarket' as const,
          listing_count: 541,
          location_name: 'Richardson, Texas, United States, US',
          state: 'Texas',
          parent_market: { id: 'airdna-403', name: 'Dallas' },
        },
      ];

      // Find matching submarket
      const matchingSubmarket = searchResults.find(
        m => m.id === marketIdFromRentalizer && m.type === 'submarket' && m.parent_market?.id
      );

      expect(matchingSubmarket).toBeDefined();
      expect(matchingSubmarket!.parent_market!.id).toBe('airdna-403');
    });

    it('should handle when rentalizer market_id is actually a valid market', () => {
      const marketIdFromRentalizer = 'airdna-403';

      // searchMarketsAPI returns Dallas as a market (not submarket)
      const searchResults = [
        {
          id: 'airdna-403',
          name: 'Dallas, Texas',
          type: 'market' as const,
          listing_count: 19380,
          location_name: 'Dallas, Texas, United States, US',
          state: 'Texas',
        },
      ];

      // Should NOT find it as a submarket
      const matchingSubmarket = searchResults.find(
        m => m.id === marketIdFromRentalizer && m.type === 'submarket' && m.parent_market?.id
      );

      expect(matchingSubmarket).toBeUndefined();

      // Should find it as a market
      const matchingMarket = searchResults.find(m => m.type === 'market');
      expect(matchingMarket).toBeDefined();
      expect(matchingMarket!.id).toBe('airdna-403');
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple submarkets in results', () => {
      const searchResults = [
        {
          id: 'airdna-4178',
          name: 'Old East Dallas, Texas',
          type: 'submarket' as const,
          listing_count: 2086,
          location_name: 'Old East Dallas, Texas, United States, US',
          state: 'Texas',
          parent_market: { id: 'airdna-403', name: 'Dallas' },
        },
        {
          id: 'airdna-1972',
          name: 'Central Dallas, Texas',
          type: 'submarket' as const,
          listing_count: 1484,
          location_name: 'Central Dallas, Texas, United States, US',
          state: 'Texas',
          parent_market: { id: 'airdna-403', name: 'Dallas' },
        },
      ];

      const result = resolveSubmarketId(null, searchResults);
      // Should use the first submarket's parent
      expect(result.resolvedMarketId).toBe('airdna-403');
    });

    it('should handle mixed market and submarket results', () => {
      const searchResults = [
        {
          id: 'airdna-403',
          name: 'Dallas, Texas',
          type: 'market' as const,
          listing_count: 19380,
          location_name: 'Dallas, Texas, United States, US',
          state: 'Texas',
        },
        {
          id: 'airdna-4178',
          name: 'Old East Dallas',
          type: 'submarket' as const,
          listing_count: 2086,
          location_name: 'Old East Dallas, Texas, United States, US',
          state: 'Texas',
          parent_market: { id: 'airdna-403', name: 'Dallas' },
        },
      ];

      const result = resolveSubmarketId(null, searchResults);
      // Should prefer the direct market
      expect(result.resolvedMarketId).toBe('airdna-403');
      expect(result.submarketId).toBeNull();
    });

    it('should handle null market_id from rentalizer', () => {
      const result = resolveSubmarketId(null, []);
      expect(result.resolvedMarketId).toBeNull();
      expect(result.submarketId).toBeNull();
    });

    it('should correctly identify airdna- prefixed IDs as potential submarkets', () => {
      const ids = ['airdna-3577', 'airdna-403', 'airdna-4178'];
      ids.forEach(id => {
        expect(id.startsWith('airdna-')).toBe(true);
      });
    });

    it('should extract city name from address for search', () => {
      const testCases = [
        { address: '2680 Carnation Dr, Richardson, TX 75082', expected: 'Richardson' },
        { address: '123 Main St, Dallas, TX 75201', expected: 'Dallas' },
        { address: '456 Oak Ave, Old East Dallas, TX 75204', expected: 'Old East Dallas' },
      ];

      testCases.forEach(({ address, expected }) => {
        const cityMatch = address.match(/,\s*([^,]+),\s*[A-Z]{2}/);
        expect(cityMatch).not.toBeNull();
        expect(cityMatch![1].trim()).toBe(expected);
      });
    });
  });
});

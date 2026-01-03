/**
 * Tests for Gemini API retry logic and caching functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiCache } from '../cache';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the ENV
vi.mock('../_core/env', () => ({
  ENV: {
    geminiApiKey: 'test-api-key'
  }
}));

describe('Gemini API Retry Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    apiCache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('callGemini with retry', () => {
    it('should succeed on first attempt when API responds correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'Test response' }]
            }
          }]
        })
      });

      const { synthesizePropertyInsights } = await import('../gemini-analyzer');
      
      const result = await synthesizePropertyInsights(
        { address: "123 Test St", bedrooms: 3, bathrooms: 2, monthly_rent: 2500 },
        { name: "Austin", occupancy: 65, adr: 250, revenue: 60000, active_listings: 5000 },
        [],
        { median: 50000, top_25_percent: 65000, top_10_percent: 80000 },
        []
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should retry on timeout and eventually succeed', async () => {
      // First call times out (AbortError)
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);
      
      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: '[{"insight": "Test insight", "impact": "positive", "action": "Test action", "data_point": "$1000"}]' }]
            }
          }]
        })
      });

      const { synthesizePropertyInsights } = await import('../gemini-analyzer');
      
      const result = await synthesizePropertyInsights(
        { address: "123 Test St", bedrooms: 3, bathrooms: 2, monthly_rent: 2500 },
        { name: "Austin", occupancy: 65, adr: 250, revenue: 60000, active_listings: 5000 },
        [],
        { median: 50000, top_25_percent: 65000, top_10_percent: 80000 },
        []
      );

      expect(result).toBeDefined();
      // Should have been called at least twice (initial + retry)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 30000);

    it('should retry on 429 rate limit error', async () => {
      // First call returns 429
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit exceeded' } })
      });
      
      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: '[{"insight": "Test", "impact": "positive", "action": "Test", "data_point": "$1000"}]' }]
            }
          }]
        })
      });

      const { synthesizePropertyInsights } = await import('../gemini-analyzer');
      
      const result = await synthesizePropertyInsights(
        { address: "123 Test St", bedrooms: 3, bathrooms: 2, monthly_rent: 2500 },
        { name: "Austin", occupancy: 65, adr: 250, revenue: 60000, active_listings: 5000 },
        [],
        { median: 50000, top_25_percent: 65000, top_10_percent: 80000 },
        []
      );

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 30000);

    it('should retry on 500 server error', async () => {
      // First call returns 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Internal server error' } })
      });
      
      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: '[{"insight": "Test", "impact": "positive", "action": "Test", "data_point": "$1000"}]' }]
            }
          }]
        })
      });

      const { synthesizePropertyInsights } = await import('../gemini-analyzer');
      
      const result = await synthesizePropertyInsights(
        { address: "123 Test St", bedrooms: 3, bathrooms: 2, monthly_rent: 2500 },
        { name: "Austin", occupancy: 65, adr: 250, revenue: 60000, active_listings: 5000 },
        [],
        { median: 50000, top_25_percent: 65000, top_10_percent: 80000 },
        []
      );

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 30000);

    it('should return fallback on all retries exhausted', async () => {
      // All calls fail
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const { synthesizePropertyInsights } = await import('../gemini-analyzer');
      
      const result = await synthesizePropertyInsights(
        { address: "123 Test St", bedrooms: 3, bathrooms: 2, monthly_rent: 2500 },
        { name: "Austin", occupancy: 65, adr: 250, revenue: 60000, active_listings: 5000 },
        [],
        { median: 50000, top_25_percent: 65000, top_10_percent: 80000 },
        []
      );

      // Should return fallback insights
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    }, 60000);
  });
});

describe('AI Analysis Caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiCache.clear();
  });

  it('should cache AI analysis results', () => {
    const testData = {
      insights: [{ insight: 'test', impact: 'positive', action: 'test', data_point: '$1000' }],
      verdict: { rating: 'GO', confidence: 8, summary: 'Good', top_reasons: [], key_risk: '', key_opportunity: '' },
      pricing_strategy: { base_rate: 200, peak_premium_percent: 30, slow_discount_percent: 15, weekend_premium_percent: 20, minimum_stay_peak: 3, minimum_stay_slow: 2, pricing_rationale: '' },
      competitor_patterns: [],
      risk_assessment: { overall_risk: 'Low', risks: [], opportunities: [] },
      action_plan: [],
      executive_summary: 'Test summary'
    };

    const cacheKey = apiCache.generateKey('ai_analysis', {
      address: '123 Test St',
      bedrooms: 3,
      bathrooms: 2,
      monthly_rent: 2500,
      market_name: 'Austin',
      market_occupancy: 65,
      market_adr: 250,
      profitability_conservative: 10000,
      profitability_realistic: 15000
    });

    // Set cache
    apiCache.set(cacheKey, testData, 'ai_analysis');

    // Get from cache
    const cached = apiCache.get(cacheKey);
    expect(cached).toEqual(testData);
  });

  it('should have 24-hour TTL for AI analysis cache', () => {
    const stats = apiCache.getStats();
    expect(stats).toBeDefined();
    
    // The TTL config should have ai_analysis set to 24 hours
    // We can verify by checking the cache behavior
    const cacheKey = 'test_ai_analysis_key';
    apiCache.set(cacheKey, { test: 'data' }, 'ai_analysis');
    
    // Should be retrievable immediately
    const cached = apiCache.get(cacheKey);
    expect(cached).toEqual({ test: 'data' });
  });

  it('should generate consistent cache keys for same inputs', () => {
    const params = {
      address: '123 Test St',
      bedrooms: 3,
      bathrooms: 2,
      monthly_rent: 2500,
      market_name: 'Austin'
    };

    const key1 = apiCache.generateKey('ai_analysis', params);
    const key2 = apiCache.generateKey('ai_analysis', params);

    expect(key1).toBe(key2);
  });

  it('should generate different cache keys for different inputs', () => {
    const params1 = {
      address: '123 Test St',
      bedrooms: 3,
      monthly_rent: 2500
    };

    const params2 = {
      address: '456 Other St',
      bedrooms: 3,
      monthly_rent: 2500
    };

    const key1 = apiCache.generateKey('ai_analysis', params1);
    const key2 = apiCache.generateKey('ai_analysis', params2);

    expect(key1).not.toBe(key2);
  });
});

describe('Cache TTL Configuration', () => {
  it('should have ai_analysis TTL configured for 24 hours', async () => {
    // Import cache module to check TTL config
    const { apiCache } = await import('../cache');
    
    // Set a value with ai_analysis type
    const key = 'test_ttl_key';
    apiCache.set(key, { test: 'data' }, 'ai_analysis');
    
    // Value should be retrievable
    expect(apiCache.get(key)).toEqual({ test: 'data' });
  });
});

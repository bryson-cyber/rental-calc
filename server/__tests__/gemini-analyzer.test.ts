/**
 * Tests for Gemini Analyzer AI Functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the ENV before importing the module
vi.mock('../_core/env', () => ({
  ENV: {
    geminiApiKey: 'test-api-key'
  }
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Gemini Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module cache to ensure fresh imports
    vi.resetModules();
  });

  describe('synthesizePropertyInsights', () => {
    it('should generate insights from property and market data', async () => {
      // Mock successful Gemini response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify([
                  {
                    title: "Strong Market Position",
                    insight: "This property is positioned in the top quartile of the market",
                    impact: "High",
                    action: "Price aggressively to capture market share"
                  },
                  {
                    title: "Seasonality Advantage",
                    insight: "Peak season aligns with school holidays",
                    impact: "Medium",
                    action: "Implement dynamic pricing for peak periods"
                  }
                ])
              }]
            }
          }]
        })
      });

      const { synthesizePropertyInsights } = await import('../gemini-analyzer');
      
      const result = await synthesizePropertyInsights(
        {
          address: "123 Test St, Austin, TX",
          bedrooms: 3,
          bathrooms: 2,
          monthly_rent: 2500
        },
        {
          name: "Austin",
          occupancy: 65,
          adr: 250,
          revenue: 60000,
          active_listings: 5000
        },
        [
          { name: "Top Performer 1", annual_revenue: 80000, occupancy: 75, adr: 300, rating: 4.9, reviews: 100, success_factor: "Great location" },
          { name: "Top Performer 2", annual_revenue: 70000, occupancy: 70, adr: 275, rating: 4.8, reviews: 80, success_factor: "Modern design" }
        ],
        {
          top_10_percent: 80000,
          top_25_percent: 65000,
          median: 50000,
          average: 55000
        },
        [
          { month: "June", season_type: "Peak", revenue: 8000, occupancy: 80, adr: 300 },
          { month: "January", season_type: "Slow", revenue: 4000, occupancy: 50, adr: 200 }
        ]
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('insight');
      expect(result[0]).toHaveProperty('impact');
      expect(result[0]).toHaveProperty('action');
    });

    it('should return fallback insights on API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      const { synthesizePropertyInsights } = await import('../gemini-analyzer');
      
      const result = await synthesizePropertyInsights(
        { address: "123 Test St", bedrooms: 3, bathrooms: 2, monthly_rent: 2500 },
        { name: "Austin", occupancy: 65, adr: 250, revenue: 60000, active_listings: 5000 },
        [],
        { top_10_percent: 80000, top_25_percent: 65000, median: 50000, average: 55000 },
        []
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('generateInvestmentVerdict', () => {
    it('should generate a verdict with rating and confidence', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  rating: "BUY",
                  confidence: 7,
                  summary: "Solid arbitrage opportunity with good profit margins",
                  top_reasons: [
                    "Strong market fundamentals",
                    "Competitive rent-to-revenue ratio",
                    "Growing demand in area"
                  ],
                  key_risk: "Seasonal fluctuations may impact winter months",
                  key_opportunity: "Premium pricing potential during SXSW"
                })
              }]
            }
          }]
        })
      });

      const { generateInvestmentVerdict } = await import('../gemini-analyzer');
      
      const result = await generateInvestmentVerdict(
        { address: "123 Test St", bedrooms: 3, bathrooms: 2, monthly_rent: 2500 },
        { name: "Austin", occupancy: 65, adr: 250, revenue: 60000, active_listings: 5000 },
        [
          { name: "Comp 1", annual_revenue: 70000, occupancy: 70, adr: 275, rating: 4.8, reviews: 80, success_factor: "Good" }
        ],
        { top_10_percent: 80000, top_25_percent: 65000, median: 50000, average: 55000 },
        { conservative: 5000, realistic: 15000, optimistic: 25000 }
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('rating');
      expect(['STRONG BUY', 'BUY', 'HOLD', 'PASS']).toContain(result.rating);
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThanOrEqual(1);
      expect(result.confidence).toBeLessThanOrEqual(10);
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('top_reasons');
      expect(Array.isArray(result.top_reasons)).toBe(true);
    });
  });

  describe('generatePricingStrategy', () => {
    it('should generate pricing recommendations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  base_rate: 200,
                  peak_premium_percent: 30,
                  slow_discount_percent: 15,
                  weekend_premium_percent: 20,
                  minimum_stay_peak: 3,
                  minimum_stay_slow: 2,
                  pricing_rationale: "Based on competitor analysis and market positioning"
                })
              }]
            }
          }]
        })
      });

      const { generatePricingStrategy } = await import('../gemini-analyzer');
      
      const result = await generatePricingStrategy(
        { address: "123 Test St", bedrooms: 3, bathrooms: 2, monthly_rent: 2500 },
        { name: "Austin", occupancy: 65, adr: 250, revenue: 60000, active_listings: 5000 },
        [
          { name: "Comp 1", adr: 275, occupancy: 70, annual_revenue: 70000, rating: 4.8, reviews: 80, success_factor: "Good" },
          { name: "Comp 2", adr: 225, occupancy: 75, annual_revenue: 65000, rating: 4.7, reviews: 60, success_factor: "Value" }
        ],
        [
          { month: "June", season_type: "Peak", revenue: 8000, occupancy: 80, adr: 300 },
          { month: "January", season_type: "Slow", revenue: 4000, occupancy: 50, adr: 200 }
        ]
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('base_rate');
      expect(typeof result.base_rate).toBe('number');
      expect(result).toHaveProperty('peak_premium_percent');
      expect(result).toHaveProperty('slow_discount_percent');
      expect(result).toHaveProperty('weekend_premium_percent');
      expect(result).toHaveProperty('minimum_stay_peak');
      expect(result).toHaveProperty('minimum_stay_slow');
      expect(result).toHaveProperty('pricing_rationale');
    });
  });

  describe('assessRisks', () => {
    it('should identify risks and opportunities', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  overall_risk: "Medium",
                  risks: [
                    {
                      category: "Market",
                      description: "High competition in area",
                      severity: "Medium",
                      mitigation: "Differentiate through unique amenities"
                    }
                  ],
                  opportunities: [
                    {
                      category: "Timing",
                      description: "New convention center opening nearby",
                      potential_impact: "20% revenue increase",
                      action: "Target business travelers"
                    }
                  ]
                })
              }]
            }
          }]
        })
      });

      const { assessRisks } = await import('../gemini-analyzer');
      
      const result = await assessRisks(
        { address: "123 Test St", bedrooms: 3, bathrooms: 2, monthly_rent: 2500 },
        { name: "Austin", occupancy: 65, adr: 250, revenue: 60000, active_listings: 5000 },
        [{ name: "Comp 1", annual_revenue: 70000, occupancy: 70, adr: 275, rating: 4.8, reviews: 80, success_factor: "Good" }],
        [{ month: "June", season_type: "Peak", revenue: 8000, occupancy: 80, adr: 300 }]
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('overall_risk');
      expect(['Low', 'Medium', 'High']).toContain(result.overall_risk);
      expect(result).toHaveProperty('risks');
      expect(Array.isArray(result.risks)).toBe(true);
      expect(result).toHaveProperty('opportunities');
      expect(Array.isArray(result.opportunities)).toBe(true);
    });
  });

  describe('generateActionPlan', () => {
    it('should generate a phased action plan', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify([
                  {
                    phase: "Setup",
                    timeline: "Week 1-2",
                    tasks: ["Sign lease", "Order furniture", "Set up utilities"],
                    estimated_cost: "$5,000-$8,000",
                    expected_outcome: "Property ready for furnishing"
                  },
                  {
                    phase: "Launch",
                    timeline: "Week 3-4",
                    tasks: ["Professional photos", "Create listing", "Set pricing"],
                    estimated_cost: "$500-$1,000",
                    expected_outcome: "Live listing ready for bookings"
                  }
                ])
              }]
            }
          }]
        })
      });

      const { generateActionPlan } = await import('../gemini-analyzer');
      
      const result = await generateActionPlan(
        { address: "123 Test St", bedrooms: 3, bathrooms: 2, monthly_rent: 2500 },
        { rating: "BUY", confidence: 7, summary: "Good opportunity", top_reasons: [], key_risk: "", key_opportunity: "" },
        { base_rate: 200, peak_premium_percent: 30, slow_discount_percent: 15, weekend_premium_percent: 20, minimum_stay_peak: 3, minimum_stay_slow: 2, pricing_rationale: "" }
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('phase');
      expect(result[0]).toHaveProperty('timeline');
      expect(result[0]).toHaveProperty('tasks');
      expect(Array.isArray(result[0].tasks)).toBe(true);
    });
  });
});

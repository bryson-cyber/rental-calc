/**
 * Tests for Enhanced AI Analyzer
 * 
 * Tests the improved narrative quality, caching, and performance features
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  generateEnhancedNarrativeReport,
  clearAllCaches,
  type EnhancedNarrativeReport
} from '../ai-analyzer-enhanced';

// Test data representing a typical property analysis
const testInput = {
  address: '123 Main St, St. Louis, MO 63101',
  monthly_rent: 1500,
  bedrooms: 3,
  bathrooms: 2,
  market_name: 'St. Louis',
  market_occupancy: 0.65,
  market_adr: 145,
  active_listings: 2500,
  revenue_low: 28000,
  revenue_mid: 38000,
  revenue_high: 52000,
  monthly_expenses: 2280,
  annual_profit_conservative: 800,
  annual_profit_realistic: 10640,
  annual_profit_optimistic: 24640,
  competitors: [
    {
      name: 'Cozy Downtown Loft',
      annual_revenue: 48000,
      occupancy: 0.72,
      adr: 165,
      rating: 4.8,
      reviews: 125,
      airbnb_url: 'https://airbnb.com/rooms/12345',
      success_factor: 'Prime location near attractions'
    },
    {
      name: 'Modern City Retreat',
      annual_revenue: 42000,
      occupancy: 0.68,
      adr: 155,
      rating: 4.6,
      reviews: 89,
      airbnb_url: 'https://airbnb.com/rooms/23456',
      success_factor: 'Professional photos and staging'
    },
    {
      name: 'Family-Friendly Home',
      annual_revenue: 38000,
      occupancy: 0.65,
      adr: 140,
      rating: 4.9,
      reviews: 156,
      airbnb_url: 'https://airbnb.com/rooms/34567',
      success_factor: 'Excellent reviews and responsiveness'
    }
  ],
  seasonality: [
    { month: 'Jan', revenue: 2800, occupancy: 0.55, adr: 130, season_type: 'off' as const },
    { month: 'Feb', revenue: 2900, occupancy: 0.56, adr: 132, season_type: 'off' as const },
    { month: 'Mar', revenue: 3200, occupancy: 0.62, adr: 140, season_type: 'shoulder' as const },
    { month: 'Apr', revenue: 3500, occupancy: 0.68, adr: 145, season_type: 'shoulder' as const },
    { month: 'May', revenue: 3800, occupancy: 0.72, adr: 150, season_type: 'peak' as const },
    { month: 'Jun', revenue: 4200, occupancy: 0.78, adr: 160, season_type: 'peak' as const },
    { month: 'Jul', revenue: 4500, occupancy: 0.82, adr: 165, season_type: 'peak' as const },
    { month: 'Aug', revenue: 4300, occupancy: 0.80, adr: 162, season_type: 'peak' as const },
    { month: 'Sep', revenue: 3600, occupancy: 0.70, adr: 148, season_type: 'shoulder' as const },
    { month: 'Oct', revenue: 3400, occupancy: 0.66, adr: 145, season_type: 'shoulder' as const },
    { month: 'Nov', revenue: 3000, occupancy: 0.58, adr: 135, season_type: 'off' as const },
    { month: 'Dec', revenue: 2800, occupancy: 0.55, adr: 130, season_type: 'off' as const }
  ],
  five_year_summary: {
    years_of_data: 5,
    occupancy: {
      current_year_avg: 65,
      five_year_avg: 62,
      trend: 'increasing' as const,
      percent_change: 8.5
    },
    adr: {
      current_year_avg: 145,
      five_year_avg: 128,
      trend: 'increasing' as const,
      percent_change: 13.3
    },
    revenue: {
      current_year_avg: 3167,
      five_year_avg: 2850,
      trend: 'increasing' as const,
      percent_change: 11.1
    },
    market_maturity: 'growing' as const
  },
  professional_stats: {
    professional_percentage: 35,
    superhost_percentage: 22,
    revenue_premium_percent: 18
  }
};

describe('Enhanced AI Analyzer', () => {
  beforeAll(() => {
    clearAllCaches();
  });

  afterAll(() => {
    clearAllCaches();
  });

  describe('generateEnhancedNarrativeReport', () => {
    it('should generate a complete enhanced narrative report', async () => {
      const report = await generateEnhancedNarrativeReport(testInput);
      
      // Check all main sections exist
      expect(report.executive_summary).toBeTruthy();
      expect(report.executive_summary.length).toBeGreaterThan(100);
      
      expect(report.market_overview).toBeTruthy();
      expect(report.revenue_analysis).toBeTruthy();
      expect(report.competitive_landscape).toBeTruthy();
      expect(report.seasonal_strategy).toBeTruthy();
      expect(report.historical_context).toBeTruthy();
      expect(report.risk_assessment).toBeTruthy();
      expect(report.financial_outlook).toBeTruthy();
      expect(report.conclusion).toBeTruthy();
    }, 180000); // 3 minute timeout for API call

    it('should include what_this_means explanations', async () => {
      const report = await generateEnhancedNarrativeReport(testInput);
      
      expect(report.what_this_means).toBeDefined();
      expect(report.what_this_means.revenue).toBeTruthy();
      expect(report.what_this_means.competition).toBeTruthy();
      expect(report.what_this_means.seasonality).toBeTruthy();
      expect(report.what_this_means.overall).toBeTruthy();
    }, 180000);

    it('should include action items with priorities', async () => {
      const report = await generateEnhancedNarrativeReport(testInput);
      
      expect(report.action_items).toBeDefined();
      expect(Array.isArray(report.action_items)).toBe(true);
      expect(report.action_items.length).toBeGreaterThan(0);
      
      // Check action item structure
      const firstAction = report.action_items[0];
      expect(firstAction.priority).toMatch(/^(high|medium|low)$/);
      expect(firstAction.action).toBeTruthy();
      expect(firstAction.why).toBeTruthy();
      expect(firstAction.timeline).toBeTruthy();
    }, 180000);

    it('should calculate correct key metrics', async () => {
      const report = await generateEnhancedNarrativeReport(testInput);
      
      expect(report.key_metrics).toBeDefined();
      expect(report.key_metrics.projected_annual_revenue).toBeGreaterThan(0);
      expect(report.key_metrics.projected_monthly_profit).toBeDefined();
      expect(report.key_metrics.market_occupancy).toBeGreaterThan(0);
      expect(report.key_metrics.market_occupancy).toBeLessThanOrEqual(1);
      expect(report.key_metrics.market_adr).toBeGreaterThan(0);
      expect(report.key_metrics.break_even_months).toBeGreaterThan(0);
      expect(report.key_metrics.confidence_level).toMatch(/^(high|medium|low)$/);
      expect(report.key_metrics.revenue_to_rent_ratio).toBeGreaterThan(0);
    }, 180000);

    it('should include market context detection', async () => {
      const report = await generateEnhancedNarrativeReport(testInput);
      
      expect(report.market_context).toBeDefined();
      expect(report.market_context.type).toMatch(/^(tourist|business|mixed|suburban|urban|rural)$/);
      expect(report.market_context.seasonality).toMatch(/^(high|moderate|low)$/);
      expect(report.market_context.competition).toMatch(/^(high|moderate|low)$/);
      expect(report.market_context.pricePoint).toMatch(/^(luxury|mid-range|budget)$/);
      expect(report.market_context.description).toBeTruthy();
    }, 180000);

    it('should generate quick facts', async () => {
      const report = await generateEnhancedNarrativeReport(testInput);
      
      expect(report.quick_facts).toBeDefined();
      expect(Array.isArray(report.quick_facts)).toBe(true);
      expect(report.quick_facts.length).toBeGreaterThan(0);
      
      // Check that quick facts contain specific data
      const factsText = report.quick_facts.join(' ');
      expect(factsText).toMatch(/\d/); // Should contain numbers
    }, 180000);

    it('should use caching for repeated requests', async () => {
      // First request
      const startTime1 = Date.now();
      const report1 = await generateEnhancedNarrativeReport(testInput);
      const duration1 = Date.now() - startTime1;
      
      // Second request (should be cached)
      const startTime2 = Date.now();
      const report2 = await generateEnhancedNarrativeReport(testInput);
      const duration2 = Date.now() - startTime2;
      
      // Cached request should be much faster
      expect(duration2).toBeLessThan(duration1 / 2);
      
      // Results should be identical
      expect(report2.executive_summary).toBe(report1.executive_summary);
    }, 300000);
  });

  describe('Revenue-to-Rent Ratio Analysis', () => {
    it('should correctly identify properties meeting 2x rule', async () => {
      const goodInput = {
        ...testInput,
        monthly_rent: 1200, // Lower rent = better ratio
        revenue_mid: 42000  // Higher revenue
      };
      
      const report = await generateEnhancedNarrativeReport(goodInput);
      
      // Revenue-to-rent ratio should be > 2
      const ratio = goodInput.revenue_mid / (goodInput.monthly_rent * 12);
      expect(ratio).toBeGreaterThan(2);
      expect(report.key_metrics.revenue_to_rent_ratio).toBeGreaterThan(2);
    }, 180000);

    it('should correctly identify properties NOT meeting 2x rule', async () => {
      const poorInput = {
        ...testInput,
        monthly_rent: 2500, // Higher rent = worse ratio
        revenue_mid: 38000  // Same revenue
      };
      
      const report = await generateEnhancedNarrativeReport(poorInput);
      
      // Revenue-to-rent ratio should be < 2
      const ratio = poorInput.revenue_mid / (poorInput.monthly_rent * 12);
      expect(ratio).toBeLessThan(2);
      expect(report.key_metrics.revenue_to_rent_ratio).toBeLessThan(2);
    }, 180000);
  });

  describe('Error Handling', () => {
    it('should return fallback report on API failure', async () => {
      // Clear cache to ensure fresh request
      clearAllCaches();
      
      // Even with minimal input, should return a valid report structure
      const minimalInput = {
        address: 'Test Address',
        monthly_rent: 1000,
        bedrooms: 2,
        bathrooms: 1,
        market_name: 'Test Market',
        market_occupancy: 0.5,
        market_adr: 100,
        active_listings: 100,
        revenue_low: 15000,
        revenue_mid: 20000,
        revenue_high: 25000,
        monthly_expenses: 1500,
        annual_profit_conservative: -3000,
        annual_profit_realistic: 2000,
        annual_profit_optimistic: 7000,
        competitors: [],
        seasonality: []
      };
      
      const report = await generateEnhancedNarrativeReport(minimalInput);
      
      // Should still have all required fields
      expect(report.executive_summary).toBeTruthy();
      expect(report.key_metrics).toBeDefined();
      expect(report.what_this_means).toBeDefined();
      expect(report.action_items).toBeDefined();
    }, 180000);
  });
});

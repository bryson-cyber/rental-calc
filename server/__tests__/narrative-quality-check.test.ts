/**
 * Quick Narrative Quality Check
 * Tests the AI narrative output for quality issues
 */

import { describe, it, expect, vi } from 'vitest';
import { generateEnhancedNarrativeWithPoe } from '../poe-narrative';
import type { EnhancedNarrativeReportInput } from '../gemini-analyzer-enhanced';

vi.setConfig({ testTimeout: 120000 });

// Sample input data for testing
const TEST_INPUT: EnhancedNarrativeReportInput = {
  address: '1321 15th St, Denver, CO 80202',
  bedrooms: 3,
  bathrooms: 2,
  monthly_rent: 2500,
  monthly_expenses: 3200,
  market_name: 'Denver, Colorado',
  market_occupancy: 0.56,
  market_adr: 503,
  active_listings: 10,
  revenue_low: 76907,
  revenue_mid: 96134,
  revenue_high: 115361,
  annual_profit_conservative: 28507,
  annual_profit_realistic: 47734,
  annual_profit_optimistic: 66961,
  competitors: [
    {
      name: 'Luxury Downtown Condo',
      annual_revenue: 115000,
      occupancy: 0.65,
      adr: 485,
      rating: 4.9,
      reviews: 120,
    },
    {
      name: 'Modern 3BR Near Convention Center',
      annual_revenue: 98000,
      occupancy: 0.58,
      adr: 462,
      rating: 4.7,
      reviews: 85,
    },
    {
      name: 'Cozy Downtown Retreat',
      annual_revenue: 82000,
      occupancy: 0.52,
      adr: 432,
      rating: 4.5,
      reviews: 45,
    },
  ],
  seasonality: [
    { month: 'January', revenue: 6500, occupancy: 0.45, adr: 480, season_type: 'off' },
    { month: 'February', revenue: 7000, occupancy: 0.48, adr: 485, season_type: 'off' },
    { month: 'March', revenue: 8500, occupancy: 0.55, adr: 520, season_type: 'shoulder' },
    { month: 'April', revenue: 8200, occupancy: 0.54, adr: 510, season_type: 'shoulder' },
    { month: 'May', revenue: 9000, occupancy: 0.58, adr: 520, season_type: 'peak' },
    { month: 'June', revenue: 10500, occupancy: 0.68, adr: 515, season_type: 'peak' },
    { month: 'July', revenue: 11000, occupancy: 0.72, adr: 510, season_type: 'peak' },
    { month: 'August', revenue: 10800, occupancy: 0.70, adr: 515, season_type: 'peak' },
    { month: 'September', revenue: 9200, occupancy: 0.60, adr: 510, season_type: 'shoulder' },
    { month: 'October', revenue: 8800, occupancy: 0.58, adr: 505, season_type: 'shoulder' },
    { month: 'November', revenue: 7200, occupancy: 0.48, adr: 500, season_type: 'off' },
    { month: 'December', revenue: 7500, occupancy: 0.50, adr: 500, season_type: 'off' },
  ],
};

describe('Narrative Quality Check', () => {
  it('should generate high-quality executive summary', async () => {
    console.log('\n=== Testing Narrative Generation ===');
    
    const report = await generateEnhancedNarrativeWithPoe(TEST_INPUT);
    
    console.log('\n--- Executive Summary ---');
    console.log(report.executive_summary);
    console.log('\n--- Analysis ---');
    
    const summary = report.executive_summary;
    
    // Word count check
    const wordCount = summary.split(/\s+/).length;
    console.log(`Word count: ${wordCount}`);
    
    // Check for investment advice (should NOT be present)
    const hasInvestmentAdvice = /\b(GO|STRONG GO|NO GO|sign the lease|proceed with|recommend signing)\b/i.test(summary);
    console.log(`Contains investment advice: ${hasInvestmentAdvice}`);
    
    // Check for placeholders
    const hasPlaceholders = /\[.*?\]|undefined|null|NaN/i.test(summary);
    console.log(`Contains placeholders: ${hasPlaceholders}`);
    
    // Check for key metrics
    const hasRevenue = /revenue/i.test(summary);
    const hasProfit = /profit/i.test(summary);
    const hasRatio = /ratio/i.test(summary);
    const hasOccupancy = /occupancy/i.test(summary);
    console.log(`Mentions revenue: ${hasRevenue}`);
    console.log(`Mentions profit: ${hasProfit}`);
    console.log(`Mentions ratio: ${hasRatio}`);
    console.log(`Mentions occupancy: ${hasOccupancy}`);
    
    // Check key metrics values
    console.log('\n--- Key Metrics ---');
    console.log(`Revenue: $${report.key_metrics.projected_annual_revenue.toLocaleString()}`);
    console.log(`Monthly Profit: $${report.key_metrics.projected_monthly_profit.toLocaleString()}`);
    console.log(`Ratio: ${report.key_metrics.revenue_to_rent_ratio.toFixed(2)}x`);
    console.log(`Occupancy: ${report.key_metrics.market_occupancy}%`);
    
    // Assertions
    expect(summary).toBeDefined();
    expect(summary.length).toBeGreaterThan(100);
    expect(hasInvestmentAdvice).toBe(false);
    expect(hasPlaceholders).toBe(false);
    expect(hasRevenue).toBe(true);
    expect(hasProfit).toBe(true);
  });

  it('should handle low-ratio property correctly', async () => {
    console.log('\n=== Testing Low-Ratio Property ===');
    
    // Modify input for low ratio scenario
    const lowRatioInput = {
      ...TEST_INPUT,
      monthly_rent: 4000, // Higher rent = lower ratio
      revenue_mid: 60000, // Lower revenue
      annual_profit_realistic: 8000,
    };
    
    const report = await generateEnhancedNarrativeWithPoe(lowRatioInput);
    
    console.log('\n--- Executive Summary (Low Ratio) ---');
    console.log(report.executive_summary);
    
    const ratio = report.key_metrics.revenue_to_rent_ratio;
    console.log(`\nRatio: ${ratio.toFixed(2)}x`);
    
    // Should not recommend signing lease for low ratio
    const hasPositiveAdvice = /sign the lease|proceed with|strong go/i.test(report.executive_summary);
    console.log(`Contains positive advice: ${hasPositiveAdvice}`);
    
    expect(hasPositiveAdvice).toBe(false);
  });

  it('should handle high-ratio property correctly', async () => {
    console.log('\n=== Testing High-Ratio Property ===');
    
    // Modify input for high ratio scenario
    const highRatioInput = {
      ...TEST_INPUT,
      monthly_rent: 1500, // Lower rent = higher ratio
      revenue_mid: 120000, // Higher revenue
      annual_profit_realistic: 80000,
    };
    
    const report = await generateEnhancedNarrativeWithPoe(highRatioInput);
    
    console.log('\n--- Executive Summary (High Ratio) ---');
    console.log(report.executive_summary);
    
    const ratio = report.key_metrics.revenue_to_rent_ratio;
    console.log(`\nRatio: ${ratio.toFixed(2)}x`);
    
    // Should still not give explicit investment advice
    const hasExplicitAdvice = /sign the lease|proceed with|recommend/i.test(report.executive_summary);
    console.log(`Contains explicit advice: ${hasExplicitAdvice}`);
    
    expect(hasExplicitAdvice).toBe(false);
  });
});

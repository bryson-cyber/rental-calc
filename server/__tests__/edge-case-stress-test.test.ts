/**
 * Edge Case Stress Test
 * Tests extreme scenarios to find prompt weaknesses
 */

import { describe, it, expect, vi } from 'vitest';
import { generateEnhancedNarrativeWithPoe } from '../poe-narrative';
import type { EnhancedNarrativeReportInput } from '../gemini-analyzer-enhanced';

vi.setConfig({ testTimeout: 120000 });

// Base input for modifications
const BASE_INPUT: EnhancedNarrativeReportInput = {
  address: '123 Test St, Denver, CO 80202',
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
    { name: 'Top Performer', annual_revenue: 115000, occupancy: 0.65, adr: 485, rating: 4.9, reviews: 120 },
    { name: 'Mid Performer', annual_revenue: 98000, occupancy: 0.58, adr: 462, rating: 4.7, reviews: 85 },
    { name: 'Lower Performer', annual_revenue: 82000, occupancy: 0.52, adr: 432, rating: 4.5, reviews: 45 },
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

describe('Edge Case Stress Tests', () => {
  
  it('should handle ZERO competitors gracefully', async () => {
    console.log('\n=== EDGE CASE: Zero Competitors ===');
    
    const input = {
      ...BASE_INPUT,
      active_listings: 0,
      competitors: [],
    };
    
    const report = await generateEnhancedNarrativeWithPoe(input);
    
    console.log('Summary:', report.executive_summary.substring(0, 200) + '...');
    console.log('Competitors mentioned:', report.executive_summary.includes('competitor'));
    
    // Should not crash and should handle gracefully
    expect(report.executive_summary).toBeDefined();
    expect(report.executive_summary.length).toBeGreaterThan(50);
  });

  it('should handle VERY HIGH rent (negative profit)', async () => {
    console.log('\n=== EDGE CASE: Very High Rent ===');
    
    const input = {
      ...BASE_INPUT,
      monthly_rent: 8000, // Very high rent
      annual_profit_conservative: -20000,
      annual_profit_realistic: -10000,
      annual_profit_optimistic: 5000,
    };
    
    const report = await generateEnhancedNarrativeWithPoe(input);
    
    console.log('Summary:', report.executive_summary.substring(0, 200) + '...');
    console.log('Ratio:', report.key_metrics.revenue_to_rent_ratio.toFixed(2) + 'x');
    
    // Should handle negative profits
    expect(report.executive_summary).toBeDefined();
    expect(report.key_metrics.revenue_to_rent_ratio).toBeLessThan(2);
  });

  it('should handle VERY LOW rent (extremely profitable)', async () => {
    console.log('\n=== EDGE CASE: Very Low Rent ===');
    
    const input = {
      ...BASE_INPUT,
      monthly_rent: 800, // Very low rent
      revenue_mid: 150000, // High revenue
      annual_profit_realistic: 130000,
    };
    
    const report = await generateEnhancedNarrativeWithPoe(input);
    
    console.log('Summary:', report.executive_summary.substring(0, 200) + '...');
    console.log('Ratio:', report.key_metrics.revenue_to_rent_ratio.toFixed(2) + 'x');
    
    // Should handle very high ratios
    expect(report.executive_summary).toBeDefined();
    expect(report.key_metrics.revenue_to_rent_ratio).toBeGreaterThan(10);
  });

  it('should handle NO seasonality data', async () => {
    console.log('\n=== EDGE CASE: No Seasonality ===');
    
    const input = {
      ...BASE_INPUT,
      seasonality: [],
    };
    
    const report = await generateEnhancedNarrativeWithPoe(input);
    
    console.log('Summary:', report.executive_summary.substring(0, 200) + '...');
    
    // Should handle missing seasonality
    expect(report.executive_summary).toBeDefined();
    expect(report.executive_summary.length).toBeGreaterThan(50);
  });

  it('should handle 1 BEDROOM property', async () => {
    console.log('\n=== EDGE CASE: 1 Bedroom ===');
    
    const input = {
      ...BASE_INPUT,
      bedrooms: 1,
      bathrooms: 1,
      monthly_rent: 1800,
      revenue_mid: 45000,
    };
    
    const report = await generateEnhancedNarrativeWithPoe(input);
    
    console.log('Summary:', report.executive_summary.substring(0, 200) + '...');
    
    expect(report.executive_summary).toBeDefined();
    expect(report.executive_summary).toContain('1-bedroom');
  });

  it('should handle LARGE property (6+ bedrooms)', async () => {
    console.log('\n=== EDGE CASE: Large Property ===');
    
    const input = {
      ...BASE_INPUT,
      bedrooms: 6,
      bathrooms: 4,
      monthly_rent: 5000,
      revenue_mid: 200000,
      annual_profit_realistic: 120000,
    };
    
    const report = await generateEnhancedNarrativeWithPoe(input);
    
    console.log('Summary:', report.executive_summary.substring(0, 200) + '...');
    
    expect(report.executive_summary).toBeDefined();
    expect(report.executive_summary).toContain('6-bedroom');
  });

  it('should handle EXTREME seasonality (100%+ swing)', async () => {
    console.log('\n=== EDGE CASE: Extreme Seasonality ===');
    
    const input = {
      ...BASE_INPUT,
      seasonality: [
        { month: 'January', revenue: 2000, occupancy: 0.20, adr: 300, season_type: 'off' as const },
        { month: 'February', revenue: 2500, occupancy: 0.25, adr: 320, season_type: 'off' as const },
        { month: 'March', revenue: 5000, occupancy: 0.40, adr: 400, season_type: 'shoulder' as const },
        { month: 'April', revenue: 6000, occupancy: 0.45, adr: 420, season_type: 'shoulder' as const },
        { month: 'May', revenue: 12000, occupancy: 0.80, adr: 500, season_type: 'peak' as const },
        { month: 'June', revenue: 15000, occupancy: 0.95, adr: 520, season_type: 'peak' as const },
        { month: 'July', revenue: 16000, occupancy: 0.98, adr: 540, season_type: 'peak' as const },
        { month: 'August', revenue: 15500, occupancy: 0.96, adr: 530, season_type: 'peak' as const },
        { month: 'September', revenue: 8000, occupancy: 0.55, adr: 480, season_type: 'shoulder' as const },
        { month: 'October', revenue: 5000, occupancy: 0.40, adr: 400, season_type: 'shoulder' as const },
        { month: 'November', revenue: 3000, occupancy: 0.28, adr: 350, season_type: 'off' as const },
        { month: 'December', revenue: 2500, occupancy: 0.25, adr: 330, season_type: 'off' as const },
      ],
    };
    
    const report = await generateEnhancedNarrativeWithPoe(input);
    
    console.log('Summary:', report.executive_summary.substring(0, 200) + '...');
    
    expect(report.executive_summary).toBeDefined();
    // Should mention high seasonality
    expect(report.executive_summary.toLowerCase()).toMatch(/season|swing|peak|off-peak/);
  });

  it('should handle LUXURY market (high ADR)', async () => {
    console.log('\n=== EDGE CASE: Luxury Market ===');
    
    const input = {
      ...BASE_INPUT,
      market_name: 'Aspen, Colorado',
      market_adr: 1200,
      monthly_rent: 8000,
      revenue_mid: 250000,
      annual_profit_realistic: 100000,
    };
    
    const report = await generateEnhancedNarrativeWithPoe(input);
    
    console.log('Summary:', report.executive_summary.substring(0, 200) + '...');
    console.log('ADR mentioned:', report.executive_summary.includes('$1,200'));
    
    expect(report.executive_summary).toBeDefined();
  });
});

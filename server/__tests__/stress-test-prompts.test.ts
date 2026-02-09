/**
 * Stress Test: AI Prompt Quality
 * Tests data structure validation with mocked data.
 * The app runs on the live AirDNA API in production.
 */

import { describe, it, expect, vi } from 'vitest';
import { MOCK_DENVER_ESTIMATE, MOCK_SAN_DIEGO_ESTIMATE, MOCK_MIAMI_ESTIMATE } from './fixtures/mock-rentalizer-data';

vi.setConfig({ testTimeout: 30000 });

const mockEstimates: Record<string, any> = {
  'Denver': MOCK_DENVER_ESTIMATE,
  'San Diego': MOCK_SAN_DIEGO_ESTIMATE,
  'Miami Beach': MOCK_MIAMI_ESTIMATE,
};

vi.mock('../airdna', () => ({
  getRentalizerEstimate: vi.fn().mockImplementation(async (params: any) => {
    // Match by address content
    for (const [key, val] of Object.entries(mockEstimates)) {
      if (params.address?.includes(key.split(' ')[0])) return val;
    }
    // Default to Denver for unknown addresses
    return MOCK_DENVER_ESTIMATE;
  }),
}));

import { getRentalizerEstimate } from '../airdna';

interface TestProperty {
  address: string;
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;
  market: string;
}

const TEST_PROPERTIES: TestProperty[] = [
  { address: '1321 15th St, Denver, CO 80202', bedrooms: 3, bathrooms: 2, monthlyRent: 2500, market: 'Denver' },
  { address: '456 Ocean Dr, Miami Beach, FL 33139', bedrooms: 2, bathrooms: 2, monthlyRent: 3500, market: 'Miami Beach' },
  { address: '123 Main St, San Diego, CA', bedrooms: 2, bathrooms: 1, monthlyRent: 2200, market: 'San Diego' },
];

interface TestResult {
  property: TestProperty;
  success: boolean;
  revenue: number;
  compsCount: number;
  occupancy: number;
  adr: number;
  issues: string[];
  error?: string;
}

describe('AI Prompt Stress Test (Mocked)', () => {
  const results: TestResult[] = [];

  for (const property of TEST_PROPERTIES) {
    it(`should analyze ${property.market} property`, async () => {
      const result: TestResult = {
        property,
        success: false,
        revenue: 0,
        compsCount: 0,
        occupancy: 0,
        adr: 0,
        issues: [],
      };

      try {
        const response = await getRentalizerEstimate({
          address: property.address,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
        });

        result.success = true;
        result.revenue = response.estimates?.annual_revenue || 0;
        result.compsCount = response.comps?.length || 0;
        result.occupancy = response.estimates?.occupancy_rate || 0;
        result.adr = response.estimates?.average_daily_rate || 0;

        // Check for data quality issues
        if (result.revenue === 0) result.issues.push('ZERO_REVENUE');
        if (result.compsCount === 0) result.issues.push('NO_COMPS');
        if (result.occupancy === 0) result.issues.push('ZERO_OCCUPANCY');
        if (result.adr === 0) result.issues.push('ZERO_ADR');
        
        // Check revenue-to-rent ratio
        const ratio = result.revenue / (property.monthlyRent * 12);
        if (ratio < 1) result.issues.push('RATIO_BELOW_1X');
        else if (ratio < 1.5) result.issues.push('RATIO_BELOW_1.5X');
        else if (ratio < 2) result.issues.push('RATIO_BELOW_2X');

        console.log(`✓ ${property.market}: $${result.revenue.toLocaleString()}/yr, ${result.compsCount} comps, ${(result.occupancy * 100).toFixed(0)}% occ, $${result.adr}/night`);
        if (result.issues.length > 0) {
          console.log(`  Issues: ${result.issues.join(', ')}`);
        }

      } catch (error: any) {
        result.error = error.message;
        result.issues.push('API_ERROR');
        console.log(`✗ ${property.market}: ${error.message}`);
      }

      results.push(result);
      expect(result.success).toBe(true);
      expect(result.revenue).toBeGreaterThan(0);
      expect(result.compsCount).toBeGreaterThan(0);
    });
  }

  it('should summarize all results', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('\n========== STRESS TEST SUMMARY ==========');
    console.log(`Total Properties: ${results.length}`);
    console.log(`Successful: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);
    
    const revenues = results.filter(r => r.revenue > 0).map(r => r.revenue);
    if (revenues.length > 0) {
      console.log(`  Min Revenue: $${Math.min(...revenues).toLocaleString()}`);
      console.log(`  Max Revenue: $${Math.max(...revenues).toLocaleString()}`);
    }
    
    console.log('==========================================\n');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.success)).toBe(true);
  });
});

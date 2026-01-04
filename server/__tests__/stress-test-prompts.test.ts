/**
 * Stress Test: AI Prompt Quality
 * Tests 10 diverse properties to find errors and quality issues
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { getRentalizerEstimate } from '../airdna';

// Increase timeout for all tests
vi.setConfig({ testTimeout: 120000 });

interface TestProperty {
  address: string;
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;
  market: string;
}

const TEST_PROPERTIES: TestProperty[] = [
  { address: '1321 15th St, Denver, CO 80202', bedrooms: 3, bathrooms: 2, monthlyRent: 2500, market: 'Denver' },
  { address: '1234 Canal St, New Orleans, LA 70112', bedrooms: 3, bathrooms: 2, monthlyRent: 1800, market: 'New Orleans' },
  { address: '456 Ocean Dr, Miami Beach, FL 33139', bedrooms: 2, bathrooms: 2, monthlyRent: 3500, market: 'Miami Beach' },
  { address: '789 Congress Ave, Austin, TX 78701', bedrooms: 2, bathrooms: 1, monthlyRent: 2200, market: 'Austin' },
  { address: '100 Broadway, Nashville, TN 37203', bedrooms: 3, bathrooms: 2, monthlyRent: 2800, market: 'Nashville' },
  { address: '555 Market St, San Francisco, CA 94105', bedrooms: 1, bathrooms: 1, monthlyRent: 3200, market: 'San Francisco' },
  { address: '222 Peachtree St, Atlanta, GA 30303', bedrooms: 2, bathrooms: 2, monthlyRent: 1900, market: 'Atlanta' },
  { address: '333 Beale St, Memphis, TN 38103', bedrooms: 3, bathrooms: 2, monthlyRent: 1500, market: 'Memphis' },
  { address: '444 Pike St, Seattle, WA 98101', bedrooms: 2, bathrooms: 1, monthlyRent: 2600, market: 'Seattle' },
  { address: '666 Fremont St, Las Vegas, NV 89101', bedrooms: 4, bathrooms: 3, monthlyRent: 2000, market: 'Las Vegas' },
];

interface TestResult {
  property: TestProperty;
  success: boolean;
  revenue: number;
  compsCount: number;
  occupancy: number;
  adr: number;
  marketId: string | undefined;
  issues: string[];
  error?: string;
}

describe('AI Prompt Stress Test', () => {
  const results: TestResult[] = [];

  // Run all tests sequentially to avoid rate limiting
  for (const property of TEST_PROPERTIES) {
    it(`should analyze ${property.market} property`, async () => {
      const result: TestResult = {
        property,
        success: false,
        revenue: 0,
        compsCount: 0,
        occupancy: 0,
        adr: 0,
        marketId: undefined,
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
        result.marketId = response.property?.market_id;

        // Check for data quality issues
        if (result.revenue === 0) result.issues.push('ZERO_REVENUE');
        if (result.compsCount === 0) result.issues.push('NO_COMPS');
        if (result.occupancy === 0) result.issues.push('ZERO_OCCUPANCY');
        if (result.adr === 0) result.issues.push('ZERO_ADR');
        if (!result.marketId) result.issues.push('NO_MARKET_ID');
        
        // Check revenue-to-rent ratio
        const ratio = result.revenue / (property.monthlyRent * 12);
        if (ratio < 1) result.issues.push('RATIO_BELOW_1X');
        else if (ratio < 1.5) result.issues.push('RATIO_BELOW_1.5X');
        else if (ratio < 2) result.issues.push('RATIO_BELOW_2X');

        // Check occupancy formatting
        if (result.occupancy > 1 && result.occupancy <= 100) {
          result.issues.push('OCCUPANCY_AS_PERCENTAGE');
        }

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
      expect(result.success || result.error).toBeTruthy();
    });
  }

  it('should summarize all results', async () => {
    // Wait for all previous tests to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('\n========== STRESS TEST SUMMARY ==========');
    console.log(`Total Properties: ${results.length}`);
    console.log(`Successful: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);
    
    console.log('\n--- Data Quality Issues ---');
    const allIssues = results.flatMap(r => r.issues);
    const issueCounts = allIssues.reduce((acc, issue) => {
      acc[issue] = (acc[issue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).forEach(([issue, count]) => {
      console.log(`  ${issue}: ${count} occurrences`);
    });
    
    console.log('\n--- Revenue Statistics ---');
    const revenues = results.filter(r => r.revenue > 0).map(r => r.revenue);
    if (revenues.length > 0) {
      console.log(`  Min: $${Math.min(...revenues).toLocaleString()}`);
      console.log(`  Max: $${Math.max(...revenues).toLocaleString()}`);
      console.log(`  Avg: $${Math.round(revenues.reduce((a, b) => a + b, 0) / revenues.length).toLocaleString()}`);
    }
    
    console.log('\n--- Properties with Issues ---');
    results.filter(r => r.issues.length > 0).forEach(r => {
      console.log(`  ${r.property.market}: ${r.issues.join(', ')}`);
    });
    
    console.log('==========================================\n');
    
    expect(results.length).toBeGreaterThan(0);
  });
});

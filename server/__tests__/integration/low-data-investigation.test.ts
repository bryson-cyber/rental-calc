/**
 * Investigation: Low-data market scenarios
 * This test investigates what happens when AirDNA returns limited or no data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRentalizerEstimate, searchByZipcode, getComprehensiveMarketReport } from '../airdna';

// Test with a known low-data address (New Orleans)
const LOW_DATA_ADDRESS = '1234 Canal St, New Orleans, LA 70112';
const LOW_DATA_ZIPCODE = '70112';

// Test with a known high-data address (Denver)
const HIGH_DATA_ADDRESS = '1321 15th St, Denver, CO 80202';
const HIGH_DATA_ZIPCODE = '80202';

describe('Low Data Market Investigation', () => {
  // Increase timeout for API calls
  vi.setConfig({ testTimeout: 60000 });

  describe('New Orleans (potentially low-data market)', () => {
    it('should investigate Rentalizer response for New Orleans', async () => {
      console.log('\n=== INVESTIGATING NEW ORLEANS ===');
      
      try {
        const result = await getRentalizerEstimate({
          address: LOW_DATA_ADDRESS,
          bedrooms: 3,
          bathrooms: 2
        });
        
        console.log('Rentalizer Response:');
        console.log('- Property found:', !!result.property);
        console.log('- Estimates found:', !!result.estimates);
        console.log('- Annual revenue:', result.estimates?.annual_revenue);
        console.log('- Comps count:', result.comps?.length || 0);
        console.log('- Market ID:', result.property?.market_id);
        console.log('- Zipcode:', result.property?.zipcode);
        
        if (result.comps && result.comps.length > 0) {
          console.log('- First comp:', result.comps[0].title, '- Revenue:', result.comps[0].annual_revenue);
        }
        
        // Record findings
        expect(result).toBeDefined();
        
      } catch (error: any) {
        console.log('ERROR:', error.message);
        console.log('This indicates the API returned an error for this address');
      }
    });

    it('should investigate ZIP code search for New Orleans', async () => {
      console.log('\n=== INVESTIGATING NEW ORLEANS ZIP CODE ===');
      
      try {
        const result = await searchByZipcode(LOW_DATA_ZIPCODE, { bedrooms: 3 });
        
        console.log('ZIP Search Response:');
        console.log('- Market found:', !!result?.market);
        console.log('- Market name:', result?.market?.name);
        console.log('- Listing count:', result?.market?.listing_count);
        console.log('- Top performers count:', result?.top_performers?.length || 0);
        
        if (result?.top_performers && result.top_performers.length > 0) {
          console.log('- First performer:', result.top_performers[0].title, '- Revenue:', result.top_performers[0].annual_revenue);
        }
        
        expect(result).toBeDefined();
        
      } catch (error: any) {
        console.log('ERROR:', error.message);
      }
    });
  });

  describe('Denver (known high-data market)', () => {
    it('should investigate Rentalizer response for Denver', async () => {
      console.log('\n=== INVESTIGATING DENVER (CONTROL) ===');
      
      try {
        const result = await getRentalizerEstimate({
          address: HIGH_DATA_ADDRESS,
          bedrooms: 3,
          bathrooms: 2
        });
        
        console.log('Rentalizer Response:');
        console.log('- Property found:', !!result.property);
        console.log('- Estimates found:', !!result.estimates);
        console.log('- Annual revenue:', result.estimates?.annual_revenue);
        console.log('- Comps count:', result.comps?.length || 0);
        console.log('- Market ID:', result.property?.market_id);
        
        expect(result.estimates?.annual_revenue).toBeGreaterThan(0);
        expect(result.comps?.length).toBeGreaterThan(0);
        
      } catch (error: any) {
        console.log('ERROR:', error.message);
      }
    });
  });

  describe('Compare data availability', () => {
    it('should compare New Orleans vs Denver data availability', async () => {
      console.log('\n=== COMPARISON SUMMARY ===');
      
      let nolaData: any = null;
      let denverData: any = null;
      
      try {
        nolaData = await getRentalizerEstimate({
          address: LOW_DATA_ADDRESS,
          bedrooms: 3,
          bathrooms: 2
        });
      } catch (e: any) {
        console.log('New Orleans failed:', e.message);
      }
      
      try {
        denverData = await getRentalizerEstimate({
          address: HIGH_DATA_ADDRESS,
          bedrooms: 3,
          bathrooms: 2
        });
      } catch (e: any) {
        console.log('Denver failed:', e.message);
      }
      
      console.log('\nComparison:');
      console.log('| Metric | New Orleans | Denver |');
      console.log('|--------|-------------|--------|');
      console.log(`| Revenue | $${nolaData?.estimates?.annual_revenue || 'N/A'} | $${denverData?.estimates?.annual_revenue || 'N/A'} |`);
      console.log(`| Comps | ${nolaData?.comps?.length || 0} | ${denverData?.comps?.length || 0} |`);
      console.log(`| Occupancy | ${nolaData?.estimates?.occupancy_rate || 'N/A'} | ${denverData?.estimates?.occupancy_rate || 'N/A'} |`);
      console.log(`| ADR | $${nolaData?.estimates?.average_daily_rate || 'N/A'} | $${denverData?.estimates?.average_daily_rate || 'N/A'} |`);
      
      // The test passes regardless - we're just investigating
      expect(true).toBe(true);
    });
  });
});

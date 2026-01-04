/**
 * Audit what fields are actually returned from AirDNA API
 */
import { describe, it, expect, vi } from 'vitest';
import { getRentalizerEstimate, getListingsInRadius } from '../airdna';

vi.setConfig({ testTimeout: 60000 });

describe('API Fields Audit', () => {
  it('should show all available fields from Rentalizer', async () => {
    const result = await getRentalizerEstimate({
      address: '1321 15th St, Denver, CO 80202',
      bedrooms: 3,
      bathrooms: 2,
    });
    
    console.log('\n=== RENTALIZER RESPONSE FIELDS ===');
    console.log('Property fields:', Object.keys(result?.property || {}));
    console.log('Estimates fields:', Object.keys(result?.estimates || {}));
    console.log('Monthly forecast sample:', result?.monthly_forecast?.[0]);
    
    if (result?.comps?.[0]) {
      console.log('\n=== COMP FIELDS (first competitor) ===');
      const comp = result.comps[0];
      Object.entries(comp).forEach(([key, value]) => {
        console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
      });
    }
    
    expect(result).toBeDefined();
  });
  
  it('should show all available fields from radius search', async () => {
    const listings = await getListingsInRadius({
      address: '1321 15th St, Denver, CO 80202',
      radiusMeters: 2000,
      bedrooms: 3,
      limit: 5,
    });
    
    console.log('\n=== RADIUS SEARCH LISTING FIELDS ===');
    if (listings?.[0]) {
      Object.entries(listings[0]).forEach(([key, value]) => {
        console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
      });
    }
    
    expect(listings).toBeDefined();
  });
});

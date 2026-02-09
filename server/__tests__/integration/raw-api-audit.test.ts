/**
 * Audit RAW API response to see ALL available fields
 */
import { describe, it, expect, vi } from 'vitest';
import { ENV } from '../_core/env';

vi.setConfig({ testTimeout: 60000 });

const AIRDNA_API_BASE = "https://api.airdna.co/api/enterprise/v2";

async function makeRawRequest(endpoint: string, body: any) {
  const response = await fetch(`${AIRDNA_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ENV.airdnaApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

describe('Raw API Audit', () => {
  it('should show ALL fields from rentalizer/estimate', async () => {
    const response = await makeRawRequest('/rentalizer/estimate', {
      address: '1321 15th St, Denver, CO 80202',
      bedrooms: 3,
      bathrooms: 2,
      currency: 'usd',
    });
    
    console.log('\n=== RAW RENTALIZER PAYLOAD STRUCTURE ===');
    console.log('Top level keys:', Object.keys(response.payload || {}));
    
    if (response.payload?.details) {
      console.log('\nDetails:', Object.keys(response.payload.details));
    }
    if (response.payload?.location) {
      console.log('Location:', response.payload.location);
    }
    if (response.payload?.stats) {
      console.log('Stats keys:', Object.keys(response.payload.stats));
      if (response.payload.stats.future) {
        console.log('Stats.future keys:', Object.keys(response.payload.stats.future));
        console.log('Stats.future.summary:', response.payload.stats.future.summary);
      }
    }
    
    // Check for any additional top-level fields we might be missing
    if (response.payload?.comps?.[0]) {
      const comp = response.payload.comps[0];
      console.log('\n=== RAW COMP STRUCTURE ===');
      console.log('Comp top-level keys:', Object.keys(comp));
      console.log('Comp.details:', comp.details);
      console.log('Comp.stats:', comp.stats);
      console.log('Comp.platforms:', comp.platforms);
      
      // Check for any fields we're not using
      Object.entries(comp).forEach(([key, value]) => {
        if (!['property_id', 'details', 'distance_meters', 'platforms', 'stats'].includes(key)) {
          console.log(`UNUSED FIELD: ${key} =`, value);
        }
      });
    }
    
    expect(response.payload).toBeDefined();
  });
  
  it('should show ALL fields from listing/comps/area', async () => {
    const response = await makeRawRequest('/listing/comps/area', {
      address: '1321 15th St, Denver, CO 80202',
      radius: 2000,
      pagination: { page_size: 5, offset: 0 },
      sort_order: 'revenue',
      sort_direction: 'descending',
    });
    
    console.log('\n=== RAW LISTING COMPS/AREA STRUCTURE ===');
    
    if (response.payload?.listings?.[0]) {
      const listing = response.payload.listings[0];
      console.log('Listing keys:', Object.keys(listing));
      Object.entries(listing).forEach(([key, value]) => {
        const display = typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : value;
        console.log(`  ${key}: ${display}`);
      });
    }
    
    expect(response.payload).toBeDefined();
  });
});

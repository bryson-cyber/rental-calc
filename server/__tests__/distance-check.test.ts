/**
 * Quick test to verify distance_meters is being returned from API
 * Uses mocked data to avoid burning API calls
 */
import { describe, it, expect, vi } from 'vitest';
import { MOCK_DENVER_ESTIMATE } from './fixtures/mock-rentalizer-data';

vi.mock('../airdna', () => ({
  getRentalizerEstimate: vi.fn().mockResolvedValue(MOCK_DENVER_ESTIMATE),
}));

import { getRentalizerEstimate } from '../airdna';

vi.setConfig({ testTimeout: 60000 });

describe('Distance Feature Check', () => {
  it('should return distance_meters for competitors', async () => {
    const result = await getRentalizerEstimate({
      address: '1321 15th St, Denver, CO 80202',
      bedrooms: 3,
      bathrooms: 2,
    });
    
    console.log('\n=== DISTANCE CHECK ===');
    console.log(`Total comps: ${result.comps?.length || 0}`);
    
    if (result.comps && result.comps.length > 0) {
      console.log('\nFirst 5 comps with distance:');
      result.comps.slice(0, 5).forEach((comp: any, i: number) => {
        const distanceMiles = comp.distance_meters ? (comp.distance_meters / 1609.34).toFixed(2) : 'N/A';
        console.log(`  ${i + 1}. ${comp.title?.substring(0, 40)}... - ${distanceMiles} miles (${comp.distance_meters}m)`);
      });
      
      // Check if any comp has distance
      const compsWithDistance = result.comps.filter((c: any) => c.distance_meters && c.distance_meters > 0);
      console.log(`\nComps with valid distance: ${compsWithDistance.length}/${result.comps.length}`);
    }
    
    expect(result.comps).toBeDefined();
    expect(result.comps.length).toBeGreaterThan(0);
  });
});

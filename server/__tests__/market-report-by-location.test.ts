import { describe, it, expect } from 'vitest';
import { getRentalizerEstimate } from '../airdna';

describe('Market Report By Location', () => {
  it('should get market data for San Diego using Rentalizer', async () => {
    // Test the core functionality - getting Rentalizer data for San Diego
    const estimate = await getRentalizerEstimate({
      address: '123 Main St, San Diego, CA',
      bedrooms: 2,
      bathrooms: 1
    });
    
    console.log('San Diego estimate:', {
      address_lookup: estimate?.property?.address_lookup,
      annual_revenue: estimate?.estimates?.annual_revenue,
      comps_count: estimate?.comps?.length
    });
    
    expect(estimate).not.toBeNull();
    expect(estimate?.property?.address_lookup).toContain('San Diego');
    expect(estimate?.estimates?.annual_revenue).toBeGreaterThan(0);
    expect(estimate?.comps?.length).toBeGreaterThan(0);
  }, 60000);

  it('should get market data for multiple bedroom configurations', async () => {
    const configs = [
      { address: '123 Main St, San Diego, CA', bedrooms: 1, bathrooms: 1 },
      { address: '456 Oak Ave, San Diego, CA', bedrooms: 3, bathrooms: 2 },
    ];
    
    const results = await Promise.all(
      configs.map(config => getRentalizerEstimate(config).catch(() => null))
    );
    
    const validResults = results.filter(r => r !== null);
    console.log('Valid results:', validResults.length);
    
    // Collect all comps
    const allComps: any[] = [];
    validResults.forEach(est => {
      if (est?.comps) {
        allComps.push(...est.comps);
      }
    });
    
    console.log('Total comps collected:', allComps.length);
    
    // Remove duplicates
    const uniqueComps = allComps.filter((comp, index, self) =>
      index === self.findIndex(c => c.title === comp.title)
    );
    
    console.log('Unique comps:', uniqueComps.length);
    
    expect(validResults.length).toBeGreaterThan(0);
    expect(uniqueComps.length).toBeGreaterThan(0);
  }, 90000);
});

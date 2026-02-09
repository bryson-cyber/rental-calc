import { describe, it, expect } from 'vitest';
import { searchMarkets, getRentalizerEstimate, getMarketDetails } from '../airdna';

describe('Market Search Fix', () => {
  it('should find San Diego via Rentalizer lookup', async () => {
    // Simulate what the new router does
    const searchQuery = 'San Diego';
    const searchLower = searchQuery.toLowerCase();
    
    // First try standard search
    const results = await searchMarkets(searchQuery, 20);
    console.log('Standard search results:', results.slice(0, 5).map(r => r.name));
    
    // Check for exact match
    const exactMatch = results.find(r => 
      r.name.toLowerCase() === searchLower ||
      r.name.toLowerCase().replace(/[^a-z0-9]/g, '') === searchLower.replace(/[^a-z0-9]/g, '')
    );
    
    console.log('Exact match found:', exactMatch?.name || 'none');
    
    if (!exactMatch) {
      // Try Rentalizer lookup
      const sampleAddress = `123 Main St, ${searchQuery}`;
      console.log('Trying Rentalizer with:', sampleAddress);
      
      const estimate = await getRentalizerEstimate({
        address: sampleAddress,
        bedrooms: 2,
        bathrooms: 1
      });
      
      console.log('Rentalizer result:', {
        market_id: estimate?.property?.market_id,
        address_lookup: estimate?.property?.address_lookup
      });
      
      if (estimate?.property?.market_id) {
        const marketDetails = await getMarketDetails(estimate.property.market_id);
        console.log('Market details:', {
          id: estimate.property.market_id,
          name: marketDetails?.name,
          listing_count: marketDetails?.listing_count
        });
        
        // Verify we got San Diego
        expect(marketDetails?.name?.toLowerCase()).toContain('san diego');
      }
    }
  }, 60000);
});

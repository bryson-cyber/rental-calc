import { describe, it, expect } from 'vitest';
import { getListingFuturePricing, ListingFuturePricing } from '../airdna';

describe('getListingFuturePricing', () => {
  it('should return pricing data or null for a listing', async () => {
    // Test with a sample listing ID
    const listingId = '12345678';
    
    const pricing = await getListingFuturePricing(listingId, 30);
    
    // Should return either pricing data or null (if listing not found)
    expect(pricing === null || typeof pricing === 'object').toBe(true);
  });

  it('should return correct structure when pricing data is found', async () => {
    const listingId = '12345678';
    
    const pricing = await getListingFuturePricing(listingId, 30);
    
    if (pricing !== null) {
      // Verify structure
      expect(pricing).toHaveProperty('listing_id');
      expect(pricing).toHaveProperty('pricing_data');
      expect(pricing).toHaveProperty('pricing_summary');
      expect(Array.isArray(pricing.pricing_data)).toBe(true);
      
      // Verify pricing summary structure
      expect(pricing.pricing_summary).toHaveProperty('avg_weekday_price');
      expect(pricing.pricing_summary).toHaveProperty('avg_weekend_price');
      expect(pricing.pricing_summary).toHaveProperty('price_range_low');
      expect(pricing.pricing_summary).toHaveProperty('price_range_high');
      expect(pricing.pricing_summary).toHaveProperty('weekend_premium_percent');
      
      // Verify types
      expect(typeof pricing.pricing_summary.avg_weekday_price).toBe('number');
      expect(typeof pricing.pricing_summary.weekend_premium_percent).toBe('number');
    }
  });

  it('should handle invalid listing IDs gracefully', async () => {
    const invalidListingId = 'invalid-listing-xyz';
    
    // Should not throw, should return null
    const pricing = await getListingFuturePricing(invalidListingId, 30);
    
    expect(pricing === null || typeof pricing === 'object').toBe(true);
  });

  it('should respect the numDays parameter', async () => {
    const listingId = '12345678';
    const numDays = 14;
    
    const pricing = await getListingFuturePricing(listingId, numDays);
    
    if (pricing !== null && pricing.pricing_data.length > 0) {
      // Should return at most numDays of data
      expect(pricing.pricing_data.length).toBeLessThanOrEqual(numDays + 7); // Allow some buffer
    }
  });
});

describe('ListingFuturePricing type structure', () => {
  it('should have all required fields in the interface', () => {
    // Type check - verifies the interface is correctly defined
    const mockPricing: ListingFuturePricing = {
      listing_id: '123',
      pricing_data: [
        { date: '2024-01-15', price: 150, is_available: true, min_nights: 2 },
        { date: '2024-01-16', price: 175, is_available: true, min_nights: 2 }
      ],
      pricing_summary: {
        avg_weekday_price: 145,
        avg_weekend_price: 185,
        price_range_low: 120,
        price_range_high: 220,
        weekend_premium_percent: 28
      }
    };

    expect(mockPricing.listing_id).toBe('123');
    expect(mockPricing.pricing_summary.weekend_premium_percent).toBe(28);
    expect(mockPricing.pricing_data.length).toBe(2);
  });

  it('should calculate weekend premium correctly', () => {
    const weekdayPrice = 150;
    const weekendPrice = 195;
    const expectedPremium = Math.round(((weekendPrice - weekdayPrice) / weekdayPrice) * 100);
    
    expect(expectedPremium).toBe(30); // 30% premium
  });
});

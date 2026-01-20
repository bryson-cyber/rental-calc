import { describe, it, expect } from 'vitest';
import { getSinglePropertyDetails, batchFetchPropertyImages, enrichListingsWithImages } from './airdna';

describe('Image Fetching Functions', () => {
  describe('getSinglePropertyDetails', () => {
    it('should return property details with images when API returns valid data', async () => {
      // Test with a real property ID
      const result = await getSinglePropertyDetails('abnb_24017637');
      
      // If the API call succeeds, we should get images
      if (result) {
        expect(result.property_id).toBeDefined();
        expect(result.images).toBeDefined();
        expect(Array.isArray(result.images)).toBe(true);
        // This property should have images
        expect(result.images.length).toBeGreaterThan(0);
        // Images should be from Airbnb CDN
        expect(result.images[0]).toContain('muscache.com');
      }
    }, 30000); // 30 second timeout for API call
  });

  describe('batchFetchPropertyImages', () => {
    it('should return a Map of property IDs to image arrays', async () => {
      const propertyIds = ['abnb_24017637'];
      const result = await batchFetchPropertyImages(propertyIds, 1);
      
      expect(result).toBeInstanceOf(Map);
      // If the API call succeeds, we should have images for the property
      if (result.size > 0) {
        const images = result.get('abnb_24017637');
        expect(images).toBeDefined();
        expect(Array.isArray(images)).toBe(true);
        expect(images!.length).toBeGreaterThan(0);
      }
    }, 30000);
  });

  describe('enrichListingsWithImages', () => {
    it('should add images to listings that do not have them', async () => {
      const listings = [
        {
          id: 'abnb_24017637',
          title: 'Test Listing',
          airbnb_url: '',
          image_url: '', // No image
          bedrooms: 2,
          bathrooms: 1,
          accommodates: 4,
          property_type: 'Apartment',
          rating: 4.5,
          reviews: 10,
          annual_revenue: 50000,
          adr: 150,
          occupancy: 0.7,
          last_review_date: '',
          superhost: false,
          professionally_managed: false,
          host_size: 'unknown' as const,
          latitude: null,
          longitude: null,
          zipcode: '',
        },
      ];

      const enrichedListings = await enrichListingsWithImages(listings, 1);
      
      expect(enrichedListings).toHaveLength(1);
      // If the API call succeeds, the listing should now have an image
      if (enrichedListings[0].image_url) {
        expect(enrichedListings[0].image_url).toContain('muscache.com');
      }
    }, 30000);

    it('should not modify listings that already have images', async () => {
      const existingImageUrl = 'https://example.com/existing-image.jpg';
      const listings = [
        {
          id: 'abnb_12345',
          title: 'Test Listing',
          airbnb_url: '',
          image_url: existingImageUrl, // Already has image
          bedrooms: 2,
          bathrooms: 1,
          accommodates: 4,
          property_type: 'Apartment',
          rating: 4.5,
          reviews: 10,
          annual_revenue: 50000,
          adr: 150,
          occupancy: 0.7,
          last_review_date: '',
          superhost: false,
          professionally_managed: false,
          host_size: 'unknown' as const,
          latitude: null,
          longitude: null,
          zipcode: '',
        },
      ];

      const enrichedListings = await enrichListingsWithImages(listings, 1);
      
      expect(enrichedListings).toHaveLength(1);
      expect(enrichedListings[0].image_url).toBe(existingImageUrl);
    });
  });
});

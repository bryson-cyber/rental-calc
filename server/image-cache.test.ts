import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  getCachedPropertyImages, 
  cachePropertyImages, 
  getBatchCachedPropertyImages,
  batchCachePropertyImages,
  cleanupExpiredImageCache
} from './db';

describe('Image Cache Database Functions', () => {
  const testPropertyId = 'test_abnb_12345';
  const testImages = [
    'https://example.com/image1.jpg',
    'https://example.com/image2.jpg',
    'https://example.com/image3.jpg'
  ];

  afterAll(async () => {
    // Clean up test data
    // Note: In a real test environment, we'd use a test database
  });

  describe('cachePropertyImages', () => {
    it('should cache images for a property', async () => {
      await cachePropertyImages(testPropertyId, testImages, 'airbnb', 7);
      
      // Verify the cache was created
      const cached = await getCachedPropertyImages(testPropertyId);
      expect(cached).not.toBeNull();
      expect(cached).toHaveLength(3);
      expect(cached).toContain('https://example.com/image1.jpg');
    });

    it('should update existing cache entry', async () => {
      const newImages = ['https://example.com/new-image.jpg'];
      await cachePropertyImages(testPropertyId, newImages, 'airbnb', 7);
      
      const cached = await getCachedPropertyImages(testPropertyId);
      expect(cached).not.toBeNull();
      expect(cached).toHaveLength(1);
      expect(cached).toContain('https://example.com/new-image.jpg');
    });
  });

  describe('getCachedPropertyImages', () => {
    it('should return null for non-existent property', async () => {
      const cached = await getCachedPropertyImages('non_existent_property_xyz');
      expect(cached).toBeNull();
    });

    it('should return cached images for existing property', async () => {
      // First cache some images
      await cachePropertyImages(testPropertyId, testImages, 'airbnb', 7);
      
      const cached = await getCachedPropertyImages(testPropertyId);
      expect(cached).not.toBeNull();
      expect(Array.isArray(cached)).toBe(true);
    });
  });

  describe('getBatchCachedPropertyImages', () => {
    it('should return empty map for empty input', async () => {
      const result = await getBatchCachedPropertyImages([]);
      expect(result.size).toBe(0);
    });

    it('should return cached images for multiple properties', async () => {
      // Cache multiple properties
      await cachePropertyImages('batch_test_1', ['img1.jpg'], 'airbnb', 7);
      await cachePropertyImages('batch_test_2', ['img2.jpg'], 'airbnb', 7);
      
      const result = await getBatchCachedPropertyImages(['batch_test_1', 'batch_test_2', 'non_existent']);
      
      expect(result.has('batch_test_1')).toBe(true);
      expect(result.has('batch_test_2')).toBe(true);
      expect(result.has('non_existent')).toBe(false);
    });
  });

  describe('batchCachePropertyImages', () => {
    it('should cache multiple properties at once', async () => {
      const imageMap = new Map<string, string[]>();
      imageMap.set('batch_cache_1', ['img1.jpg', 'img2.jpg']);
      imageMap.set('batch_cache_2', ['img3.jpg']);
      
      await batchCachePropertyImages(imageMap, 'airbnb', 7);
      
      const cached1 = await getCachedPropertyImages('batch_cache_1');
      const cached2 = await getCachedPropertyImages('batch_cache_2');
      
      expect(cached1).not.toBeNull();
      expect(cached1).toHaveLength(2);
      expect(cached2).not.toBeNull();
      expect(cached2).toHaveLength(1);
    });

    it('should handle empty map gracefully', async () => {
      const emptyMap = new Map<string, string[]>();
      await batchCachePropertyImages(emptyMap);
      // Should not throw
    });
  });
});

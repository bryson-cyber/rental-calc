import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractAirbnbListingId,
  scrapeAirbnbImages,
  batchScrapeAirbnbImages,
  clearImageCache,
} from './airbnb-scraper';

describe('Airbnb Image Scraper', () => {
  beforeEach(() => {
    clearImageCache();
  });

  describe('extractAirbnbListingId', () => {
    it('should extract listing ID from standard Airbnb URL', () => {
      const url = 'https://www.airbnb.com/rooms/12345678';
      expect(extractAirbnbListingId(url)).toBe('12345678');
    });

    it('should extract listing ID from URL with query params', () => {
      const url = 'https://www.airbnb.com/rooms/12345678?check_in=2024-01-01&guests=2';
      expect(extractAirbnbListingId(url)).toBe('12345678');
    });

    it('should extract listing ID from URL without www', () => {
      const url = 'https://airbnb.com/rooms/12345678';
      expect(extractAirbnbListingId(url)).toBe('12345678');
    });

    it('should return null for invalid URLs', () => {
      expect(extractAirbnbListingId('')).toBeNull();
      expect(extractAirbnbListingId('https://google.com')).toBeNull();
      expect(extractAirbnbListingId('https://airbnb.com/experiences/123')).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(extractAirbnbListingId(undefined as unknown as string)).toBeNull();
    });
  });

  describe('scrapeAirbnbImages', () => {
    it('should return empty array for invalid URL', async () => {
      const images = await scrapeAirbnbImages('https://google.com');
      expect(images).toEqual([]);
    });

    it('should return empty array for empty URL', async () => {
      const images = await scrapeAirbnbImages('');
      expect(images).toEqual([]);
    });

    // Note: Real scraping tests would require mocking fetch
    // These tests verify the function handles edge cases gracefully
  });

  describe('batchScrapeAirbnbImages', () => {
    it('should filter out invalid URLs', async () => {
      const urls = [
        'https://google.com',
        'invalid-url',
        '',
      ];
      const results = await batchScrapeAirbnbImages(urls);
      expect(results.size).toBe(0);
    });

    it('should handle empty array', async () => {
      const results = await batchScrapeAirbnbImages([]);
      expect(results.size).toBe(0);
    });
  });
});

/**
 * Tests for HasData Zillow API Integration
 */

import { describe, it, expect } from 'vitest';
import { isZillowUrl, extractZpid } from './hasdata-zillow';

describe('HasData Zillow Integration', () => {
  describe('isZillowUrl', () => {
    it('should return true for valid homedetails URLs', () => {
      const validUrls = [
        'https://www.zillow.com/homedetails/123-Main-St-Denver-CO-80202/12345_zpid/',
        'https://zillow.com/homedetails/456-Oak-Ave-Atlanta-GA/67890_zpid/',
        'http://www.zillow.com/homedetails/789-Pine-Rd-Miami-FL/11111_zpid/',
      ];
      
      validUrls.forEach(url => {
        expect(isZillowUrl(url)).toBe(true);
      });
    });

    it('should return true for valid homes URLs', () => {
      const validUrls = [
        'https://www.zillow.com/homes/123-Main-St-Denver-CO_rb/',
        'https://zillow.com/homes/for_sale/456-Oak-Ave/',
      ];
      
      validUrls.forEach(url => {
        expect(isZillowUrl(url)).toBe(true);
      });
    });

    it('should return true for building URLs', () => {
      const url = 'https://www.zillow.com/b/building-name-city-state/';
      expect(isZillowUrl(url)).toBe(true);
    });

    it('should return false for non-Zillow URLs', () => {
      const invalidUrls = [
        'https://www.redfin.com/homedetails/123-Main-St/',
        'https://www.realtor.com/property/12345',
        'https://google.com',
        '123 Main St, Denver, CO 80202',
        '',
      ];
      
      invalidUrls.forEach(url => {
        expect(isZillowUrl(url)).toBe(false);
      });
    });

    it('should return false for null or undefined', () => {
      expect(isZillowUrl('')).toBe(false);
    });
  });

  describe('extractZpid', () => {
    it('should extract ZPID from URLs with _zpid suffix', () => {
      const url = 'https://www.zillow.com/homedetails/123-Main-St-Denver-CO-80202/12345678_zpid/';
      expect(extractZpid(url)).toBe('12345678');
    });

    it('should extract ZPID from various URL formats', () => {
      const testCases = [
        { url: 'https://zillow.com/homedetails/address/99999_zpid/', expected: '99999' },
        { url: 'https://www.zillow.com/homes/123456_zpid', expected: '123456' },
      ];
      
      testCases.forEach(({ url, expected }) => {
        expect(extractZpid(url)).toBe(expected);
      });
    });

    it('should return null for URLs without ZPID', () => {
      const url = 'https://www.zillow.com/homes/for_sale/Denver-CO/';
      expect(extractZpid(url)).toBeNull();
    });

    it('should return null for non-Zillow URLs', () => {
      const url = 'https://www.redfin.com/property/12345';
      expect(extractZpid(url)).toBeNull();
    });
  });
});

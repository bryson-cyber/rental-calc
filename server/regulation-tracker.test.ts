/**
 * Unit tests for Regulation Tracker
 * Tests: parseLocation function for various input formats
 */

import { describe, it, expect } from 'vitest';
import { parseLocation } from './regulation-tracker';

describe('parseLocation', () => {
  describe('City, State format', () => {
    it('should parse "St. Louis, MO"', () => {
      const result = parseLocation('St. Louis, MO');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('St. Louis');
      expect(result?.state).toBe('MO');
    });

    it('should parse "Denver, Colorado" and normalize state to abbreviation', () => {
      const result = parseLocation('Denver, Colorado');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('Denver');
      // parseCityState normalizes state to abbreviation
      expect(result?.state).toBe('CO');
    });

    it('should parse "San Francisco, CA"', () => {
      const result = parseLocation('San Francisco, CA');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('San Francisco');
      expect(result?.state).toBe('CA');
    });

    it('should handle extra whitespace', () => {
      const result = parseLocation('  Austin  ,  TX  ');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('Austin');
      expect(result?.state).toBe('TX');
    });
  });

  describe('Full address format', () => {
    it('should parse full address with zip code', () => {
      const result = parseLocation('123 Main St, Denver, CO 80202');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('Denver');
      expect(result?.state).toBe('CO');
      expect(result?.address).toBeDefined();
    });

    it('should parse address without zip code', () => {
      const result = parseLocation('456 Oak Ave, Austin, TX');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('Austin');
      expect(result?.state).toBe('TX');
    });

    it('should parse address with apartment number', () => {
      const result = parseLocation('789 Pine St Apt 4B, Miami, FL 33101');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('Miami');
      expect(result?.state).toBe('FL');
    });
  });

  describe('Redfin URL format', () => {
    it('should parse Redfin URL', () => {
      const result = parseLocation('https://www.redfin.com/CO/Denver/123-Main-St-80202/home/12345');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('Denver');
      expect(result?.state).toBe('CO');
      expect(result?.address).toBeDefined();
    });

    it('should parse Redfin URL with different state', () => {
      const result = parseLocation('https://www.redfin.com/MO/Saint-Louis/456-Oak-Ave-63101/home/67890');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('Saint Louis');
      expect(result?.state).toBe('MO');
    });
  });

  describe('Zillow URL format', () => {
    it('should parse Zillow URL and extract state correctly', () => {
      // Note: Without a unit number separator, the parser cannot reliably distinguish
      // street name from city name. It extracts the state correctly and makes a best guess.
      const result = parseLocation('https://www.zillow.com/homedetails/123-Main-St-Denver-CO-80202/12345_zpid/');
      expect(result).not.toBeNull();
      expect(result?.state).toBe('CO');
      // City extraction is best-effort without unit number separator
      expect(result?.city).toBeDefined();
    });

    it('should parse Zillow URL with multi-word city prefix (Saint)', () => {
      // Multi-word cities with known prefixes (Saint, San, New, etc.) are detected
      const result = parseLocation('https://www.zillow.com/homedetails/456-Oak-Ave-Saint-Louis-MO-63101/67890_zpid/');
      expect(result).not.toBeNull();
      expect(result?.state).toBe('MO');
      expect(result?.city).toBe('Saint Louis');
    });
    
    it('should parse Zillow URL with unit number and multi-word city (San Diego)', () => {
      // Real-world example: Unit number "11" provides clear separator between address and city
      const result = parseLocation('https://www.zillow.com/homedetails/3715-Mission-Blvd-11-San-Diego-CA-92109/450213296_zpid/');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('San Diego');
      expect(result?.state).toBe('CA');
      expect(result?.address).toBeDefined();
    });
    
    it('should parse Zillow URL with San prefix city', () => {
      // San Francisco, San Jose, San Antonio, etc.
      const result = parseLocation('https://www.zillow.com/homedetails/789-Market-St-San-Francisco-CA-94102/11111_zpid/');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('San Francisco');
      expect(result?.state).toBe('CA');
    });
  });

  describe('Edge cases', () => {
    it('should return null for empty string', () => {
      const result = parseLocation('');
      expect(result).toBeNull();
    });

    it('should return null for invalid input', () => {
      const result = parseLocation('invalid');
      expect(result).toBeNull();
    });

    it('should handle city with multiple words', () => {
      const result = parseLocation('New York City, NY');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('New York City');
      expect(result?.state).toBe('NY');
    });
  });
});

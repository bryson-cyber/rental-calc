import { describe, it, expect } from 'vitest';
import { getTimezoneFromPhone, getLocalWebinarTime, AREA_CODE_MAP } from '../area-code-timezone';

describe('Area Code Timezone Lookup', () => {
  describe('getTimezoneFromPhone', () => {
    it('should detect Pacific timezone from Las Vegas area code (702)', () => {
      expect(getTimezoneFromPhone('7025218792')).toBe('Pacific');
    });

    it('should detect Eastern timezone from New York area code (212)', () => {
      expect(getTimezoneFromPhone('2125551234')).toBe('Eastern');
    });

    it('should detect Central timezone from Chicago area code (312)', () => {
      expect(getTimezoneFromPhone('3125551234')).toBe('Central');
    });

    it('should detect Mountain timezone from Denver area code (303)', () => {
      expect(getTimezoneFromPhone('3035551234')).toBe('Mountain');
    });

    it('should detect Alaska timezone from 907 area code', () => {
      expect(getTimezoneFromPhone('9075551234')).toBe('Alaska');
    });

    it('should detect Hawaii timezone from 808 area code', () => {
      expect(getTimezoneFromPhone('8085551234')).toBe('Hawaii');
    });

    it('should handle +1 prefix', () => {
      expect(getTimezoneFromPhone('+17025218792')).toBe('Pacific');
      expect(getTimezoneFromPhone('17025218792')).toBe('Pacific');
    });

    it('should handle formatted phone numbers', () => {
      expect(getTimezoneFromPhone('(702) 521-8792')).toBe('Pacific');
      expect(getTimezoneFromPhone('702-521-8792')).toBe('Pacific');
    });

    it('should return null for unknown area codes', () => {
      expect(getTimezoneFromPhone('0005551234')).toBeNull();
    });

    it('should return null for short numbers', () => {
      expect(getTimezoneFromPhone('12')).toBeNull();
    });

    // Spot-check various area codes across timezones
    it('should correctly map Florida (305) to Eastern', () => {
      expect(getTimezoneFromPhone('3055551234')).toBe('Eastern');
    });

    it('should correctly map Texas (214) to Central', () => {
      expect(getTimezoneFromPhone('2145551234')).toBe('Central');
    });

    it('should correctly map California (415) to Pacific', () => {
      expect(getTimezoneFromPhone('4155551234')).toBe('Pacific');
    });

    it('should correctly map Utah (801) to Mountain', () => {
      expect(getTimezoneFromPhone('8015551234')).toBe('Mountain');
    });

    it('should correctly map Arizona (602) to Mountain', () => {
      expect(getTimezoneFromPhone('6025551234')).toBe('Mountain');
    });
  });

  describe('getLocalWebinarTime', () => {
    // Webinar is at 4 PM Pacific (hour 16)
    it('should return 4 PM Pacific for Pacific timezone phone', () => {
      expect(getLocalWebinarTime('7025551234', 16)).toBe('4 PM Pacific');
    });

    it('should return 7 PM Eastern for Eastern timezone phone', () => {
      expect(getLocalWebinarTime('2125551234', 16)).toBe('7 PM Eastern');
    });

    it('should return 6 PM Central for Central timezone phone', () => {
      expect(getLocalWebinarTime('3125551234', 16)).toBe('6 PM Central');
    });

    it('should return 5 PM Mountain for Mountain timezone phone', () => {
      expect(getLocalWebinarTime('3035551234', 16)).toBe('5 PM Mountain');
    });

    it('should return 3 PM Alaska for Alaska timezone phone', () => {
      expect(getLocalWebinarTime('9075551234', 16)).toBe('3 PM Alaska');
    });

    it('should return 2 PM Hawaii for Hawaii timezone phone', () => {
      expect(getLocalWebinarTime('8085551234', 16)).toBe('2 PM Hawaii');
    });

    it('should return both Pacific and Eastern for unknown area code', () => {
      expect(getLocalWebinarTime('0005551234', 16)).toBe('4 PM Pacific / 7 PM Eastern');
    });
  });

  describe('AREA_CODE_MAP coverage', () => {
    it('should have at least 200 area codes mapped', () => {
      expect(Object.keys(AREA_CODE_MAP).length).toBeGreaterThan(200);
    });

    it('should have all four major US timezones represented', () => {
      const timezones = new Set(Object.values(AREA_CODE_MAP));
      expect(timezones.has('Eastern')).toBe(true);
      expect(timezones.has('Central')).toBe(true);
      expect(timezones.has('Mountain')).toBe(true);
      expect(timezones.has('Pacific')).toBe(true);
      expect(timezones.has('Alaska')).toBe(true);
      expect(timezones.has('Hawaii')).toBe(true);
    });

    it('should only contain 3-digit area codes', () => {
      for (const code of Object.keys(AREA_CODE_MAP)) {
        expect(code).toMatch(/^\d{3}$/);
      }
    });
  });
});

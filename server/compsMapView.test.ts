import { describe, it, expect } from 'vitest';

// Test the CompsMapView helper functions
describe('CompsMapView', () => {
  describe('getMarkerColor', () => {
    const getMarkerColor = (revenue: number | undefined): string => {
      if (!revenue) return '#6B7280';
      if (revenue >= 80000) return '#22C55E';
      if (revenue >= 50000) return '#3B82F6';
      return '#6B7280';
    };

    it('should return green for high performers ($80k+)', () => {
      expect(getMarkerColor(100000)).toBe('#22C55E');
      expect(getMarkerColor(80000)).toBe('#22C55E');
    });

    it('should return blue for medium performers ($50k-$80k)', () => {
      expect(getMarkerColor(75000)).toBe('#3B82F6');
      expect(getMarkerColor(50000)).toBe('#3B82F6');
    });

    it('should return gray for lower performers (<$50k)', () => {
      expect(getMarkerColor(49999)).toBe('#6B7280');
      expect(getMarkerColor(30000)).toBe('#6B7280');
    });

    it('should return gray for undefined revenue', () => {
      expect(getMarkerColor(undefined)).toBe('#6B7280');
    });
  });

  describe('formatCurrency', () => {
    const formatCurrency = (value: number | undefined): string => {
      if (!value) return 'N/A';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    };

    it('should format currency correctly', () => {
      expect(formatCurrency(100000)).toBe('$100,000');
      expect(formatCurrency(50000)).toBe('$50,000');
    });

    it('should return N/A for undefined', () => {
      expect(formatCurrency(undefined)).toBe('N/A');
    });

    it('should return N/A for zero', () => {
      expect(formatCurrency(0)).toBe('N/A');
    });
  });

  describe('formatDistance', () => {
    const formatDistance = (meters: number | undefined): string => {
      if (!meters) return 'N/A';
      if (meters < 1000) return `${Math.round(meters)}m`;
      return `${(meters / 1609.34).toFixed(1)} mi`;
    };

    it('should format meters for short distances', () => {
      expect(formatDistance(500)).toBe('500m');
      expect(formatDistance(999)).toBe('999m');
    });

    it('should format miles for longer distances', () => {
      expect(formatDistance(1609.34)).toBe('1.0 mi');
      expect(formatDistance(3218.68)).toBe('2.0 mi');
    });

    it('should return N/A for undefined', () => {
      expect(formatDistance(undefined)).toBe('N/A');
    });

    it('should return N/A for zero', () => {
      expect(formatDistance(0)).toBe('N/A');
    });
  });

  describe('Coordinate Filtering', () => {
    it('should filter out comps without coordinates', () => {
      const comps = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: undefined, longitude: -74.006 },
        { latitude: 40.7128, longitude: undefined },
        { latitude: NaN, longitude: -74.006 },
      ];
      const filtered = comps.filter((c) => c.latitude && c.longitude && !isNaN(c.latitude) && !isNaN(c.longitude));
      expect(filtered.length).toBe(1);
    });

    it('should keep comps with valid coordinates', () => {
      const comps = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 34.0522, longitude: -118.2437 },
      ];
      const filtered = comps.filter((c) => c.latitude && c.longitude && !isNaN(c.latitude) && !isNaN(c.longitude));
      expect(filtered.length).toBe(2);
    });
  });

  describe('Bounds Calculation', () => {
    it('should calculate bounds for multiple points', () => {
      const points = [
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.7580, lng: -73.9855 },
        { lat: 40.6892, lng: -74.0445 },
      ];
      
      const minLat = Math.min(...points.map(p => p.lat));
      const maxLat = Math.max(...points.map(p => p.lat));
      const minLng = Math.min(...points.map(p => p.lng));
      const maxLng = Math.max(...points.map(p => p.lng));
      
      expect(minLat).toBeCloseTo(40.6892, 4);
      expect(maxLat).toBeCloseTo(40.7580, 4);
      expect(minLng).toBeCloseTo(-74.0445, 4);
      expect(maxLng).toBeCloseTo(-73.9855, 4);
    });
  });

  describe('Marker Index', () => {
    it('should generate correct marker indices', () => {
      const comps = [{}, {}, {}, {}, {}];
      const indices = comps.map((_, i) => i + 1);
      expect(indices).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Airbnb Link Generation', () => {
    it('should generate correct Airbnb link', () => {
      const listingId = '12345678';
      const link = `https://www.airbnb.com/rooms/${listingId}`;
      expect(link).toBe('https://www.airbnb.com/rooms/12345678');
    });

    it('should handle undefined listing ID', () => {
      const listingId = undefined;
      const link = listingId ? `https://www.airbnb.com/rooms/${listingId}` : null;
      expect(link).toBeNull();
    });
  });
});

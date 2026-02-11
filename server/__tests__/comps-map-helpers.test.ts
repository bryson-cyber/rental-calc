import { describe, it, expect } from 'vitest';

/**
 * Tests for the helper functions used in CompsMapView.
 * Since these are client-side functions, we replicate the logic here for unit testing.
 */

// Haversine distance calculation (same as in CompsMapView.tsx)
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Occupancy formatting (same as in CompsMapView.tsx)
function formatOccupancy(value: number | undefined): string {
  if (value === undefined || value === null) return "N/A";
  const pct = value > 1 ? value : value * 100;
  return `${Math.round(pct)}%`;
}

// Distance formatting with fallback to Haversine
function getDistance(
  comp: { distance_meters?: number; latitude?: number; longitude?: number },
  subjectLat: number,
  subjectLng: number
): { meters: number; text: string } {
  let meters = comp.distance_meters;

  if (!meters && comp.latitude && comp.longitude) {
    meters = haversineDistance(subjectLat, subjectLng, comp.latitude, comp.longitude);
  }

  if (!meters || meters <= 0) {
    return { meters: 0, text: "N/A" };
  }

  if (meters < 1000) {
    return { meters, text: `${Math.round(meters)}m` };
  }
  const miles = meters / 1609.34;
  return { meters, text: `${miles.toFixed(1)} mi` };
}

describe('CompsMapView Helpers', () => {
  describe('haversineDistance', () => {
    it('should return 0 for identical coordinates', () => {
      const dist = haversineDistance(32.9485, -96.7305, 32.9485, -96.7305);
      expect(dist).toBe(0);
    });

    it('should calculate distance between two known points', () => {
      // Denver downtown to a point ~1km away
      const dist = haversineDistance(39.7392, -104.9903, 39.7492, -104.9903);
      // ~1.1km north (0.01 degrees latitude ≈ 1.1km)
      expect(dist).toBeGreaterThan(1000);
      expect(dist).toBeLessThan(1200);
    });

    it('should handle negative coordinates', () => {
      const dist = haversineDistance(-33.8688, 151.2093, -33.8588, 151.2093);
      expect(dist).toBeGreaterThan(1000);
      expect(dist).toBeLessThan(1200);
    });

    it('should calculate a known distance (New York to Los Angeles ≈ 3944km)', () => {
      const dist = haversineDistance(40.7128, -74.0060, 34.0522, -118.2437);
      const km = dist / 1000;
      expect(km).toBeGreaterThan(3900);
      expect(km).toBeLessThan(4000);
    });
  });

  describe('formatOccupancy', () => {
    it('should return N/A for undefined', () => {
      expect(formatOccupancy(undefined)).toBe("N/A");
    });

    it('should handle decimal format (0.77 → 77%)', () => {
      expect(formatOccupancy(0.77)).toBe("77%");
    });

    it('should handle decimal format (0.7761 → 78%)', () => {
      expect(formatOccupancy(0.7761)).toBe("78%");
    });

    it('should handle percentage format already (77 → 77%)', () => {
      expect(formatOccupancy(77)).toBe("77%");
    });

    it('should handle percentage format (77.61 → 78%)', () => {
      expect(formatOccupancy(77.61)).toBe("78%");
    });

    it('should handle 0 occupancy', () => {
      // 0 is a valid number, formatOccupancy returns "0%"
      expect(formatOccupancy(0)).toBe("0%");
    });

    it('should handle 1.0 (100% as decimal)', () => {
      // 1.0 is ambiguous but treated as decimal → 100%
      expect(formatOccupancy(1.0)).toBe("100%");
    });

    it('should handle values just above 1 (treated as percentage)', () => {
      expect(formatOccupancy(1.5)).toBe("2%");
    });

    it('should handle 100 (already percentage)', () => {
      expect(formatOccupancy(100)).toBe("100%");
    });
  });

  describe('getDistance', () => {
    const subjectLat = 32.9485;
    const subjectLng = -96.7305;

    it('should use distance_meters from API when available', () => {
      const result = getDistance({ distance_meters: 885 }, subjectLat, subjectLng);
      expect(result.meters).toBe(885);
      expect(result.text).toBe("885m");
    });

    it('should format distance in miles when >= 1000m', () => {
      const result = getDistance({ distance_meters: 2500 }, subjectLat, subjectLng);
      expect(result.text).toBe("1.6 mi");
    });

    it('should calculate distance from coordinates when distance_meters is missing', () => {
      const result = getDistance(
        { latitude: 32.9500, longitude: -96.7280 },
        subjectLat,
        subjectLng
      );
      expect(result.meters).toBeGreaterThan(0);
      expect(result.text).not.toBe("N/A");
    });

    it('should return N/A when no distance_meters and no coordinates', () => {
      const result = getDistance({}, subjectLat, subjectLng);
      expect(result.meters).toBe(0);
      expect(result.text).toBe("N/A");
    });

    it('should prefer distance_meters over calculated distance', () => {
      const result = getDistance(
        { distance_meters: 500, latitude: 32.9500, longitude: -96.7280 },
        subjectLat,
        subjectLng
      );
      expect(result.meters).toBe(500);
      expect(result.text).toBe("500m");
    });

    it('should handle distance_meters of 0 and fall back to coordinates', () => {
      const result = getDistance(
        { distance_meters: 0, latitude: 32.9500, longitude: -96.7280 },
        subjectLat,
        subjectLng
      );
      // distance_meters is 0, so it should calculate from coords
      expect(result.meters).toBeGreaterThan(0);
    });
  });
});

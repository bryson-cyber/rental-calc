import { describe, it, expect } from 'vitest';

/**
 * Tests for Comp Set Strength Indicator logic
 * The actual component is in TeslaDashboard.tsx, but we test the calculation logic here
 */

interface Comparable {
  distanceMeters?: number;
  [key: string]: unknown;
}

// Replicate the calculation logic from CompStrengthIndicator
function calculateCompStrength(comparables: Comparable[]): {
  label: string;
  level: 'high' | 'good' | 'limited';
  compCount: number;
  avgDistanceMiles: number | null;
} {
  if (!comparables || comparables.length === 0) {
    return { label: 'No Data', level: 'limited', compCount: 0, avgDistanceMiles: null };
  }

  const compCount = comparables.length;
  const compsWithDistance = comparables.filter(c => c.distanceMeters !== undefined);
  const avgDistanceMeters = compsWithDistance.length > 0
    ? compsWithDistance.reduce((sum, c) => sum + (c.distanceMeters || 0), 0) / compsWithDistance.length
    : null;
  const avgDistanceMiles = avgDistanceMeters ? (avgDistanceMeters / 1609.34) : null;

  let label: string;
  let level: 'high' | 'good' | 'limited';

  if (compCount >= 10 && avgDistanceMiles && avgDistanceMiles < 1) {
    label = 'High Confidence';
    level = 'high';
  } else if (compCount >= 5 && avgDistanceMiles && avgDistanceMiles < 2) {
    label = 'Good Confidence';
    level = 'good';
  } else {
    label = 'Limited Data';
    level = 'limited';
  }

  return { label, level, compCount, avgDistanceMiles };
}

describe('Comp Set Strength Indicator', () => {
  it('should return High Confidence for 10+ comps within 1 mile', () => {
    const comps = Array(12).fill({ distanceMeters: 800 }); // ~0.5 miles
    const result = calculateCompStrength(comps);
    expect(result.level).toBe('high');
    expect(result.label).toBe('High Confidence');
    expect(result.compCount).toBe(12);
  });

  it('should return Good Confidence for 5-9 comps within 2 miles', () => {
    const comps = Array(7).fill({ distanceMeters: 2400 }); // ~1.5 miles
    const result = calculateCompStrength(comps);
    expect(result.level).toBe('good');
    expect(result.label).toBe('Good Confidence');
    expect(result.compCount).toBe(7);
  });

  it('should return Limited Data for fewer than 5 comps', () => {
    const comps = Array(3).fill({ distanceMeters: 500 });
    const result = calculateCompStrength(comps);
    expect(result.level).toBe('limited');
    expect(result.label).toBe('Limited Data');
  });

  it('should return Limited Data for comps beyond 2 miles', () => {
    const comps = Array(10).fill({ distanceMeters: 5000 }); // ~3.1 miles
    const result = calculateCompStrength(comps);
    expect(result.level).toBe('limited');
  });

  it('should handle empty comparables array', () => {
    const result = calculateCompStrength([]);
    expect(result.level).toBe('limited');
    expect(result.compCount).toBe(0);
    expect(result.avgDistanceMiles).toBeNull();
  });

  it('should handle comps without distance data', () => {
    const comps = Array(10).fill({});
    const result = calculateCompStrength(comps);
    expect(result.avgDistanceMiles).toBeNull();
    expect(result.level).toBe('limited');
  });

  it('should calculate average distance correctly', () => {
    const comps = [
      { distanceMeters: 1609.34 }, // 1 mile
      { distanceMeters: 3218.68 }, // 2 miles
    ];
    const result = calculateCompStrength(comps);
    expect(result.avgDistanceMiles).toBeCloseTo(1.5, 1);
  });

  it('should handle mixed comps with and without distance', () => {
    const comps = [
      { distanceMeters: 1609.34 },
      { distanceMeters: 1609.34 },
      {},
      {},
    ];
    const result = calculateCompStrength(comps);
    expect(result.compCount).toBe(4);
    expect(result.avgDistanceMiles).toBeCloseTo(1, 1);
  });

  it('should return Good Confidence at exactly 5 comps within 2 miles', () => {
    const comps = Array(5).fill({ distanceMeters: 2400 }); // ~1.5 miles
    const result = calculateCompStrength(comps);
    expect(result.level).toBe('good');
  });

  it('should return High Confidence at exactly 10 comps within 1 mile', () => {
    const comps = Array(10).fill({ distanceMeters: 1500 }); // ~0.93 miles
    const result = calculateCompStrength(comps);
    expect(result.level).toBe('high');
  });
});

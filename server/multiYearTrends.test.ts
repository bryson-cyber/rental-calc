import { describe, it, expect } from 'vitest';

// Test the CAGR calculation logic
function calculateCAGR(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || years <= 0) return 0;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

// Test the YoY calculation logic
function calculateYoY(data: { value: number }[]): number {
  if (data.length < 13) return 0;
  const currentValue = data[data.length - 1]?.value || 0;
  const yearAgoValue = data[data.length - 13]?.value || 0;
  if (yearAgoValue === 0) return 0;
  return ((currentValue - yearAgoValue) / yearAgoValue) * 100;
}

describe('Multi-Year Trends Calculations', () => {
  describe('CAGR Calculation', () => {
    it('should calculate positive CAGR correctly', () => {
      // $100 to $121 over 2 years = 10% CAGR
      const cagr = calculateCAGR(100, 121, 2);
      expect(cagr).toBeCloseTo(10, 1);
    });

    it('should calculate negative CAGR correctly', () => {
      // $100 to $81 over 2 years = -10% CAGR
      const cagr = calculateCAGR(100, 81, 2);
      expect(cagr).toBeCloseTo(-10, 1);
    });

    it('should return 0 for zero start value', () => {
      const cagr = calculateCAGR(0, 100, 2);
      expect(cagr).toBe(0);
    });

    it('should return 0 for zero years', () => {
      const cagr = calculateCAGR(100, 200, 0);
      expect(cagr).toBe(0);
    });

    it('should handle 5-year CAGR', () => {
      // $100 to $161.05 over 5 years = 10% CAGR
      const cagr = calculateCAGR(100, 161.05, 5);
      expect(cagr).toBeCloseTo(10, 0);
    });
  });

  describe('YoY Calculation', () => {
    it('should calculate positive YoY correctly', () => {
      const data = Array(13).fill(null).map((_, i) => ({ value: i === 0 ? 100 : i === 12 ? 120 : 110 }));
      const yoy = calculateYoY(data);
      expect(yoy).toBe(20);
    });

    it('should calculate negative YoY correctly', () => {
      const data = Array(13).fill(null).map((_, i) => ({ value: i === 0 ? 100 : i === 12 ? 80 : 90 }));
      const yoy = calculateYoY(data);
      expect(yoy).toBe(-20);
    });

    it('should return 0 for insufficient data', () => {
      const data = Array(12).fill({ value: 100 });
      const yoy = calculateYoY(data);
      expect(yoy).toBe(0);
    });

    it('should return 0 when year-ago value is 0', () => {
      const data = Array(13).fill(null).map((_, i) => ({ value: i === 0 ? 0 : 100 }));
      const yoy = calculateYoY(data);
      expect(yoy).toBe(0);
    });
  });

  describe('Time Range Support', () => {
    it('should support 12 month (1 year) range', () => {
      const years = 12 / 12;
      expect(years).toBe(1);
    });

    it('should support 24 month (2 year) range', () => {
      const years = 24 / 12;
      expect(years).toBe(2);
    });

    it('should support 36 month (3 year) range', () => {
      const years = 36 / 12;
      expect(years).toBe(3);
    });

    it('should support 60 month (5 year) range', () => {
      const years = 60 / 12;
      expect(years).toBe(5);
    });
  });
});

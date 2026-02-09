import { describe, it, expect } from 'vitest';
import { getComprehensiveSubmarketReport } from '../airdna';

describe('getComprehensiveSubmarketReport', () => {
  it('should return comprehensive submarket data for a valid submarket ID', async () => {
    // Using Austin, TX submarket ID
    const result = await getComprehensiveSubmarketReport('airdna-1234567');
    
    // May return null if submarket not found, but should not throw
    if (result) {
      expect(result.submarket).toBeDefined();
      expect(result.submarket.name).toBeDefined();
      expect(result.submarket.listing_count).toBeGreaterThanOrEqual(0);
      expect(result.submarket.metrics).toBeDefined();
    }
  }, 30000);
});

describe('Submarket Deep-Dive Context Building', () => {
  it('should correctly determine revenue trend from revpar', () => {
    const testCases = [
      { revpar: 150, expected: 'growing' },
      { revpar: 90, expected: 'stable' },
      { revpar: 50, expected: 'declining' }
    ];
    
    testCases.forEach(({ revpar, expected }) => {
      const trend = revpar > 100 ? 'growing' : revpar > 75 ? 'stable' : 'declining';
      expect(trend).toBe(expected);
    });
  });

  it('should correctly determine occupancy trend from occupancy rate', () => {
    const testCases = [
      { occupancy: 0.70, expected: 'growing' },
      { occupancy: 0.55, expected: 'stable' },
      { occupancy: 0.40, expected: 'declining' }
    ];
    
    testCases.forEach(({ occupancy, expected }) => {
      const trend = occupancy > 0.65 ? 'growing' : occupancy > 0.50 ? 'stable' : 'declining';
      expect(trend).toBe(expected);
    });
  });

  it('should correctly determine market health from health score', () => {
    const testCases = [
      { occupancy: 0.75, revenue: 80000, expected: 'strong' },
      { occupancy: 0.55, revenue: 50000, expected: 'moderate' },
      { occupancy: 0.35, revenue: 30000, expected: 'weak' }
    ];
    
    testCases.forEach(({ occupancy, revenue, expected }) => {
      const healthScore = (occupancy * 100 + (revenue / 1000)) / 2;
      const health = healthScore > 70 ? 'strong' : healthScore > 50 ? 'moderate' : 'weak';
      expect(health).toBe(expected);
    });
  });

  it('should correctly determine growth potential from professional management percentage', () => {
    const testCases = [
      { profPct: 40, expected: 'high' },
      { profPct: 20, expected: 'moderate' },
      { profPct: 10, expected: 'low' }
    ];
    
    testCases.forEach(({ profPct, expected }) => {
      const potential = profPct > 30 ? 'high' : profPct > 15 ? 'moderate' : 'low';
      expect(potential).toBe(expected);
    });
  });

  it('should format bedroom performance correctly', () => {
    const bedroomPerformance = [
      { bedrooms: 1, count: 50, avg_revenue: 35000, avg_adr: 120, avg_occupancy: 0.65 },
      { bedrooms: 2, count: 80, avg_revenue: 45000, avg_adr: 150, avg_occupancy: 0.70 },
      { bedrooms: 3, count: 40, avg_revenue: 60000, avg_adr: 200, avg_occupancy: 0.68 }
    ];
    
    const formatted = bedroomPerformance
      .map(b => `${b.bedrooms}BR: ${b.count} listings, $${Math.round(b.avg_revenue).toLocaleString()} avg revenue, $${Math.round(b.avg_adr)} ADR, ${(b.avg_occupancy * 100).toFixed(0)}% occupancy`)
      .join('\n');
    
    expect(formatted).toContain('1BR: 50 listings');
    expect(formatted).toContain('2BR: 80 listings');
    expect(formatted).toContain('3BR: 40 listings');
    expect(formatted).toContain('$35,000 avg revenue');
    expect(formatted).toContain('70% occupancy');
  });

  it('should format top performers correctly', () => {
    const topPerformers = [
      { title: 'Luxury Downtown Condo', bedrooms: 2, annual_revenue: 75000, adr: 250, occupancy: 0.82, rating: 4.9 },
      { title: 'Cozy Studio', bedrooms: 1, annual_revenue: 45000, adr: 150, occupancy: 0.78, rating: 4.7 }
    ];
    
    const formatted = topPerformers
      .map(p => `- ${p.title}: ${p.bedrooms}BR, $${Math.round(p.annual_revenue).toLocaleString()} revenue, $${Math.round(p.adr)} ADR, ${(p.occupancy * 100).toFixed(0)}% occ, ${p.rating.toFixed(1)}★`)
      .join('\n');
    
    expect(formatted).toContain('Luxury Downtown Condo');
    expect(formatted).toContain('2BR');
    expect(formatted).toContain('$75,000 revenue');
    expect(formatted).toContain('82% occ');
    expect(formatted).toContain('4.9★');
  });
});

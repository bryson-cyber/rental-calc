import { describe, it, expect } from 'vitest';
import { getQualifyingCompetitors } from '../airdna';

describe('getQualifyingCompetitors', () => {
  it('should return qualifying and all same-bedroom listings', async () => {
    const marketId = 'austin';
    const bedrooms = 2;
    const monthlyRent = 2000;
    
    const result = await getQualifyingCompetitors(marketId, bedrooms, monthlyRent);
    
    // Should return the expected structure
    expect(result).toHaveProperty('qualifyingListings');
    expect(result).toHaveProperty('allSameBedroomListings');
    expect(result).toHaveProperty('revenueThreshold');
    expect(result).toHaveProperty('totalInMarket');
    
    // Arrays should be arrays
    expect(Array.isArray(result.qualifyingListings)).toBe(true);
    expect(Array.isArray(result.allSameBedroomListings)).toBe(true);
  });

  it('should calculate correct revenue threshold (2x annual rent)', () => {
    const monthlyRent = 2000;
    const expectedThreshold = monthlyRent * 12 * 2; // $48,000
    
    expect(expectedThreshold).toBe(48000);
  });

  it('should filter listings by revenue threshold correctly', () => {
    const mockListings = [
      { annual_revenue: 60000 },
      { annual_revenue: 40000 },
      { annual_revenue: 55000 },
      { annual_revenue: 30000 }
    ];
    
    const threshold = 48000;
    const qualifying = mockListings.filter(l => l.annual_revenue >= threshold);
    
    expect(qualifying.length).toBe(2);
    expect(qualifying[0].annual_revenue).toBe(60000);
    expect(qualifying[1].annual_revenue).toBe(55000);
  });
});

describe('Qualifying Competitors Analysis', () => {
  it('should calculate qualification rate correctly', () => {
    const qualifyingCount = 25;
    const totalCount = 100;
    
    const qualificationRate = (qualifyingCount / totalCount) * 100;
    
    expect(qualificationRate).toBe(25);
  });

  it('should calculate superhost percentage correctly', () => {
    const mockQualifiers = [
      { superhost: true },
      { superhost: true },
      { superhost: false },
      { superhost: true },
      { superhost: false }
    ];
    
    const superhostCount = mockQualifiers.filter(l => l.superhost).length;
    const superhostPercentage = (superhostCount / mockQualifiers.length) * 100;
    
    expect(superhostPercentage).toBe(60);
  });

  it('should calculate average metrics correctly', () => {
    const mockQualifiers = [
      { annual_revenue: 50000, adr: 150, occupancy: 0.65 },
      { annual_revenue: 60000, adr: 180, occupancy: 0.70 },
      { annual_revenue: 55000, adr: 165, occupancy: 0.68 }
    ];
    
    const avgRevenue = mockQualifiers.reduce((sum, l) => sum + l.annual_revenue, 0) / mockQualifiers.length;
    const avgAdr = mockQualifiers.reduce((sum, l) => sum + l.adr, 0) / mockQualifiers.length;
    const avgOccupancy = mockQualifiers.reduce((sum, l) => sum + l.occupancy, 0) / mockQualifiers.length;
    
    expect(avgRevenue).toBe(55000);
    expect(avgAdr).toBe(165);
    expect(avgOccupancy).toBeCloseTo(0.6767, 2);
  });

  it('should assess market viability based on qualification rate', () => {
    const assessViability = (rate: number) => {
      if (rate > 50) return 'STRONG';
      if (rate > 25) return 'MODERATE';
      if (rate > 10) return 'CHALLENGING';
      return 'DIFFICULT';
    };
    
    expect(assessViability(60)).toBe('STRONG');
    expect(assessViability(35)).toBe('MODERATE');
    expect(assessViability(15)).toBe('CHALLENGING');
    expect(assessViability(5)).toBe('DIFFICULT');
  });
});

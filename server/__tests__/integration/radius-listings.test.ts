import { describe, it, expect } from 'vitest';
import { getListingsInRadius } from '../airdna';

describe('getListingsInRadius', () => {
  it('should return listings within specified radius', async () => {
    // Austin, TX coordinates
    const latitude = 30.2672;
    const longitude = -97.7431;
    const radiusMeters = 1000;
    
    const result = await getListingsInRadius(latitude, longitude, radiusMeters, {
      limit: 10,
      sort_by: 'revenue',
      sort_direction: 'desc'
    });
    
    // Should return the expected structure
    expect(result).toHaveProperty('listings');
    expect(result).toHaveProperty('total_count');
    expect(result).toHaveProperty('center');
    expect(result).toHaveProperty('radius_meters');
    
    // Center should match input
    expect(result.center.latitude).toBe(latitude);
    expect(result.center.longitude).toBe(longitude);
    expect(result.radius_meters).toBe(radiusMeters);
    
    // Listings should be an array
    expect(Array.isArray(result.listings)).toBe(true);
  });
});

describe('Radius Listings Analysis', () => {
  it('should calculate listings per square kilometer correctly', () => {
    const totalCount = 50;
    const radiusKm = 1; // 1km radius
    const areaInSqKm = Math.PI * Math.pow(radiusKm, 2); // π * r² ≈ 3.14 sq km
    
    const listingsPerSqKm = totalCount / areaInSqKm;
    
    expect(listingsPerSqKm).toBeCloseTo(15.92, 1);
  });

  it('should assess density correctly', () => {
    const assessDensity = (listingsPerSqKm: number) => {
      if (listingsPerSqKm > 100) return 'VERY HIGH';
      if (listingsPerSqKm > 50) return 'HIGH';
      if (listingsPerSqKm > 20) return 'MODERATE';
      if (listingsPerSqKm > 10) return 'LOW';
      return 'VERY LOW';
    };
    
    expect(assessDensity(150)).toBe('VERY HIGH');
    expect(assessDensity(75)).toBe('HIGH');
    expect(assessDensity(30)).toBe('MODERATE');
    expect(assessDensity(15)).toBe('LOW');
    expect(assessDensity(5)).toBe('VERY LOW');
  });

  it('should calculate superhost percentage correctly', () => {
    const mockListings = [
      { superhost: true },
      { superhost: true },
      { superhost: false },
      { superhost: true },
      { superhost: false }
    ];
    
    const superhostCount = mockListings.filter(l => l.superhost).length;
    const superhostPercentage = (superhostCount / mockListings.length) * 100;
    
    expect(superhostPercentage).toBe(60);
  });

  it('should count same-bedroom competitors correctly', () => {
    const mockListings = [
      { bedrooms: 2 },
      { bedrooms: 3 },
      { bedrooms: 2 },
      { bedrooms: 1 },
      { bedrooms: 2 }
    ];
    
    const targetBedrooms = 2;
    const sameBedroomCount = mockListings.filter(l => l.bedrooms === targetBedrooms).length;
    
    expect(sameBedroomCount).toBe(3);
  });

  it('should calculate neighborhood averages correctly', () => {
    const mockListings = [
      { annual_revenue: 50000, adr: 150, occupancy: 0.65 },
      { annual_revenue: 60000, adr: 180, occupancy: 0.70 },
      { annual_revenue: 55000, adr: 165, occupancy: 0.68 }
    ];
    
    const avgRevenue = mockListings.reduce((sum, l) => sum + l.annual_revenue, 0) / mockListings.length;
    const avgAdr = mockListings.reduce((sum, l) => sum + l.adr, 0) / mockListings.length;
    const avgOccupancy = mockListings.reduce((sum, l) => sum + l.occupancy, 0) / mockListings.length;
    
    expect(avgRevenue).toBe(55000);
    expect(avgAdr).toBe(165);
    expect(avgOccupancy).toBeCloseTo(0.6767, 2);
  });
});

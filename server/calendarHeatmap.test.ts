import { describe, it, expect } from 'vitest';

/**
 * Tests for Calendar Heatmap / Seasonality logic
 * The actual component is in SeasonalityCalendar.tsx
 */

interface SeasonalityData {
  month: string;
  month_name: string;
  occupancy: number;
  adr: number;
  revenue: number;
  season_type: 'peak' | 'shoulder' | 'off';
}

// Replicate the heatmap intensity calculation
function calculateHeatmapIntensity(revenue: number, maxRevenue: number): number {
  return revenue / maxRevenue;
}

// Determine season type based on occupancy
function determineSeasonType(occupancy: number): 'peak' | 'shoulder' | 'off' {
  if (occupancy >= 70) return 'peak';
  if (occupancy >= 50) return 'shoulder';
  return 'off';
}

// Calculate RevPAR (Revenue Per Available Room)
function calculateRevPAR(adr: number, occupancy: number): number {
  return adr * (occupancy / 100);
}

// Get color class based on season type
function getSeasonColor(seasonType: 'peak' | 'shoulder' | 'off'): string {
  const colors = {
    peak: 'bg-green-100',
    shoulder: 'bg-amber-100',
    off: 'bg-blue-100',
  };
  return colors[seasonType];
}

describe('Calendar Heatmap / Seasonality', () => {
  it('should calculate heatmap intensity correctly', () => {
    expect(calculateHeatmapIntensity(10000, 20000)).toBe(0.5);
    expect(calculateHeatmapIntensity(20000, 20000)).toBe(1);
    expect(calculateHeatmapIntensity(5000, 20000)).toBe(0.25);
  });

  it('should determine peak season for high occupancy', () => {
    expect(determineSeasonType(75)).toBe('peak');
    expect(determineSeasonType(70)).toBe('peak');
    expect(determineSeasonType(90)).toBe('peak');
  });

  it('should determine shoulder season for medium occupancy', () => {
    expect(determineSeasonType(60)).toBe('shoulder');
    expect(determineSeasonType(50)).toBe('shoulder');
    expect(determineSeasonType(69)).toBe('shoulder');
  });

  it('should determine off season for low occupancy', () => {
    expect(determineSeasonType(40)).toBe('off');
    expect(determineSeasonType(30)).toBe('off');
    expect(determineSeasonType(49)).toBe('off');
  });

  it('should calculate RevPAR correctly', () => {
    // RevPAR = ADR * Occupancy Rate
    expect(calculateRevPAR(200, 70)).toBe(140);
    expect(calculateRevPAR(300, 50)).toBe(150);
    expect(calculateRevPAR(150, 100)).toBe(150);
  });

  it('should return correct color class for each season type', () => {
    expect(getSeasonColor('peak')).toBe('bg-green-100');
    expect(getSeasonColor('shoulder')).toBe('bg-amber-100');
    expect(getSeasonColor('off')).toBe('bg-blue-100');
  });

  it('should handle edge case of zero revenue', () => {
    expect(calculateHeatmapIntensity(0, 20000)).toBe(0);
  });

  it('should handle edge case of zero occupancy', () => {
    expect(determineSeasonType(0)).toBe('off');
    expect(calculateRevPAR(200, 0)).toBe(0);
  });

  it('should process monthly data array correctly', () => {
    const monthlyData: SeasonalityData[] = [
      { month: '2024-01', month_name: 'January', occupancy: 45, adr: 180, revenue: 8000, season_type: 'off' },
      { month: '2024-06', month_name: 'June', occupancy: 75, adr: 250, revenue: 15000, season_type: 'peak' },
      { month: '2024-09', month_name: 'September', occupancy: 55, adr: 200, revenue: 10000, season_type: 'shoulder' },
    ];
    
    const maxRevenue = Math.max(...monthlyData.map(d => d.revenue));
    expect(maxRevenue).toBe(15000);
    
    const peakMonths = monthlyData.filter(d => d.season_type === 'peak');
    expect(peakMonths.length).toBe(1);
    expect(peakMonths[0].month_name).toBe('June');
  });

  it('should calculate average metrics correctly', () => {
    const data = [
      { occupancy: 60, adr: 200, revenue: 10000 },
      { occupancy: 70, adr: 250, revenue: 15000 },
      { occupancy: 50, adr: 180, revenue: 8000 },
    ];
    
    const avgOccupancy = data.reduce((sum, d) => sum + d.occupancy, 0) / data.length;
    const avgAdr = data.reduce((sum, d) => sum + d.adr, 0) / data.length;
    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
    
    expect(avgOccupancy).toBe(60);
    expect(avgAdr).toBeCloseTo(210, 0);
    expect(totalRevenue).toBe(33000);
  });
});

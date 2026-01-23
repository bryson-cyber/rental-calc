import { describe, it, expect } from 'vitest';

/**
 * Tests for Forward-Looking Demand Indicators
 */

interface FutureDailyData {
  date: string;
  supply: number;
  demand: number;
  adr: number;
  occupancy: number;
}

interface ForwardDemandIndicators {
  next30Days: {
    avgOccupancy: number;
    avgAdr: number;
    avgSupply: number;
    avgDemand: number;
    trend: 'hot' | 'warm' | 'cool' | 'cold';
    trendLabel: string;
  };
  next180Days: {
    avgOccupancy: number;
    avgAdr: number;
    avgSupply: number;
    avgDemand: number;
    trend: 'hot' | 'warm' | 'cool' | 'cold';
    trendLabel: string;
  };
  peakPeriod: {
    startDate: string;
    endDate: string;
    avgOccupancy: number;
  } | null;
  lowPeriod: {
    startDate: string;
    endDate: string;
    avgOccupancy: number;
  } | null;
}

function classifyDemandTrend(occupancy: number): { trend: 'hot' | 'warm' | 'cool' | 'cold'; label: string } {
  if (occupancy >= 75) return { trend: 'hot', label: 'Hot Market' };
  if (occupancy >= 55) return { trend: 'warm', label: 'Warm Market' };
  if (occupancy >= 35) return { trend: 'cool', label: 'Cool Market' };
  return { trend: 'cold', label: 'Cold Market' };
}

function calculateForwardLookingDemand(
  futureDailyData: FutureDailyData[]
): ForwardDemandIndicators | null {
  if (!futureDailyData || futureDailyData.length === 0) {
    return null;
  }

  const sortedData = [...futureDailyData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // For testing, use first date as "today"
  const today = new Date(sortedData[0].date);
  const next30DaysEnd = new Date(today);
  next30DaysEnd.setDate(next30DaysEnd.getDate() + 30);
  
  const next30DaysData = sortedData.filter(d => {
    const date = new Date(d.date);
    return date >= today && date <= next30DaysEnd;
  });

  const next180DaysEnd = new Date(today);
  next180DaysEnd.setDate(next180DaysEnd.getDate() + 180);
  
  const next180DaysData = sortedData.filter(d => {
    const date = new Date(d.date);
    return date >= today && date <= next180DaysEnd;
  });

  const calc30 = next30DaysData.length > 0 ? {
    avgOccupancy: next30DaysData.reduce((sum, d) => sum + (d.occupancy || 0), 0) / next30DaysData.length,
    avgAdr: next30DaysData.reduce((sum, d) => sum + (d.adr || 0), 0) / next30DaysData.length,
    avgSupply: next30DaysData.reduce((sum, d) => sum + (d.supply || 0), 0) / next30DaysData.length,
    avgDemand: next30DaysData.reduce((sum, d) => sum + (d.demand || 0), 0) / next30DaysData.length,
  } : { avgOccupancy: 0, avgAdr: 0, avgSupply: 0, avgDemand: 0 };

  const calc180 = next180DaysData.length > 0 ? {
    avgOccupancy: next180DaysData.reduce((sum, d) => sum + (d.occupancy || 0), 0) / next180DaysData.length,
    avgAdr: next180DaysData.reduce((sum, d) => sum + (d.adr || 0), 0) / next180DaysData.length,
    avgSupply: next180DaysData.reduce((sum, d) => sum + (d.supply || 0), 0) / next180DaysData.length,
    avgDemand: next180DaysData.reduce((sum, d) => sum + (d.demand || 0), 0) / next180DaysData.length,
  } : { avgOccupancy: 0, avgAdr: 0, avgSupply: 0, avgDemand: 0 };

  let peakPeriod: ForwardDemandIndicators['peakPeriod'] = null;
  let lowPeriod: ForwardDemandIndicators['lowPeriod'] = null;
  let maxAvgOccupancy = -Infinity;
  let minAvgOccupancy = Infinity;

  for (let i = 0; i <= sortedData.length - 7; i++) {
    const window = sortedData.slice(i, i + 7);
    const avgOcc = window.reduce((sum, d) => sum + (d.occupancy || 0), 0) / 7;
    
    if (avgOcc > maxAvgOccupancy) {
      maxAvgOccupancy = avgOcc;
      peakPeriod = {
        startDate: window[0].date,
        endDate: window[6].date,
        avgOccupancy: avgOcc,
      };
    }
    
    if (avgOcc < minAvgOccupancy) {
      minAvgOccupancy = avgOcc;
      lowPeriod = {
        startDate: window[0].date,
        endDate: window[6].date,
        avgOccupancy: avgOcc,
      };
    }
  }

  const trend30 = classifyDemandTrend(calc30.avgOccupancy);
  const trend180 = classifyDemandTrend(calc180.avgOccupancy);

  return {
    next30Days: {
      ...calc30,
      trend: trend30.trend,
      trendLabel: trend30.label,
    },
    next180Days: {
      ...calc180,
      trend: trend180.trend,
      trendLabel: trend180.label,
    },
    peakPeriod,
    lowPeriod,
  };
}

// Helper to generate test data
function generateTestData(days: number, baseOccupancy: number): FutureDailyData[] {
  const data: FutureDailyData[] = [];
  const startDate = new Date('2024-01-01');
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    data.push({
      date: date.toISOString().split('T')[0],
      supply: 100,
      demand: Math.round(baseOccupancy),
      adr: 200,
      occupancy: baseOccupancy + (Math.sin(i / 10) * 10), // Add some variation
    });
  }
  return data;
}

describe('Forward-Looking Demand Indicators', () => {
  it('should classify Hot trend for 75%+ occupancy', () => {
    const result = classifyDemandTrend(80);
    expect(result.trend).toBe('hot');
    expect(result.label).toBe('Hot Market');
  });

  it('should classify Warm trend for 55-75% occupancy', () => {
    const result = classifyDemandTrend(65);
    expect(result.trend).toBe('warm');
    expect(result.label).toBe('Warm Market');
  });

  it('should classify Cool trend for 35-55% occupancy', () => {
    const result = classifyDemandTrend(45);
    expect(result.trend).toBe('cool');
    expect(result.label).toBe('Cool Market');
  });

  it('should classify Cold trend for <35% occupancy', () => {
    const result = classifyDemandTrend(25);
    expect(result.trend).toBe('cold');
    expect(result.label).toBe('Cold Market');
  });

  it('should return null for empty data', () => {
    const result = calculateForwardLookingDemand([]);
    expect(result).toBeNull();
  });

  it('should calculate 30-day average occupancy correctly', () => {
    const data = generateTestData(60, 70);
    const result = calculateForwardLookingDemand(data);
    expect(result).not.toBeNull();
    expect(result!.next30Days.avgOccupancy).toBeGreaterThan(0);
  });

  it('should calculate 180-day average occupancy correctly', () => {
    const data = generateTestData(200, 60);
    const result = calculateForwardLookingDemand(data);
    expect(result).not.toBeNull();
    expect(result!.next180Days.avgOccupancy).toBeGreaterThan(0);
  });

  it('should identify peak period correctly', () => {
    const data: FutureDailyData[] = [];
    const startDate = new Date('2024-01-01');
    
    // Low occupancy first 10 days
    for (let i = 0; i < 10; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      data.push({
        date: date.toISOString().split('T')[0],
        supply: 100, demand: 40, adr: 200, occupancy: 40,
      });
    }
    
    // High occupancy next 10 days
    for (let i = 10; i < 20; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      data.push({
        date: date.toISOString().split('T')[0],
        supply: 100, demand: 90, adr: 200, occupancy: 90,
      });
    }
    
    const result = calculateForwardLookingDemand(data);
    expect(result).not.toBeNull();
    expect(result!.peakPeriod).not.toBeNull();
    expect(result!.peakPeriod!.avgOccupancy).toBeGreaterThan(80);
  });

  it('should identify low period correctly', () => {
    const data: FutureDailyData[] = [];
    const startDate = new Date('2024-01-01');
    
    // High occupancy first 10 days
    for (let i = 0; i < 10; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      data.push({
        date: date.toISOString().split('T')[0],
        supply: 100, demand: 80, adr: 200, occupancy: 80,
      });
    }
    
    // Low occupancy next 10 days
    for (let i = 10; i < 20; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      data.push({
        date: date.toISOString().split('T')[0],
        supply: 100, demand: 30, adr: 200, occupancy: 30,
      });
    }
    
    const result = calculateForwardLookingDemand(data);
    expect(result).not.toBeNull();
    expect(result!.lowPeriod).not.toBeNull();
    expect(result!.lowPeriod!.avgOccupancy).toBeLessThan(40);
  });

  it('should handle data with missing occupancy values', () => {
    const data: FutureDailyData[] = [
      { date: '2024-01-01', supply: 100, demand: 50, adr: 200, occupancy: 0 },
      { date: '2024-01-02', supply: 100, demand: 50, adr: 200, occupancy: 60 },
    ];
    
    const result = calculateForwardLookingDemand(data);
    expect(result).not.toBeNull();
    expect(result!.next30Days.avgOccupancy).toBe(30); // (0 + 60) / 2
  });

  it('should calculate average ADR correctly', () => {
    const data: FutureDailyData[] = [
      { date: '2024-01-01', supply: 100, demand: 50, adr: 200, occupancy: 50 },
      { date: '2024-01-02', supply: 100, demand: 50, adr: 300, occupancy: 50 },
    ];
    
    const result = calculateForwardLookingDemand(data);
    expect(result).not.toBeNull();
    expect(result!.next30Days.avgAdr).toBe(250);
  });
});

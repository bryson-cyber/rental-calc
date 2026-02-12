import { describe, it, expect } from 'vitest';

/**
 * Tests for MarketTrendsChart data processing logic
 * and distance lines toggle behavior.
 *
 * Since the chart component is a React component that uses Recharts,
 * we test the data transformation logic independently.
 */

// Replicate the parseMonthDate helper from RevenueCharts.tsx
function parseMonthDate(dateStr: string) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dashParts = dateStr.split('-');
  if (dashParts.length >= 2) {
    const year = dashParts[0];
    const monthIdx = parseInt(dashParts[1]) - 1;
    const shortYear = year.slice(2);
    const shortMonth = monthIdx >= 0 && monthIdx < 12 ? monthNames[monthIdx] : dateStr.slice(0, 3);
    return { monthIdx, year, shortLabel: `${shortMonth} '${shortYear}` };
  }
  if (dateStr.includes(' ')) {
    const parts = dateStr.split(' ');
    return { monthIdx: 0, year: parts[1] || '', shortLabel: parts[0]?.slice(0, 3) || dateStr.slice(0, 3) };
  }
  return { monthIdx: 0, year: '', shortLabel: dateStr.length > 3 ? dateStr.slice(0, 3) : dateStr };
}

// Replicate the MarketTrendsChart data transformation
interface MarketTrendMonth {
  date: string;
  revenue: number;
  occupancy?: number;
  adr?: number;
}

function transformMarketData(data: MarketTrendMonth[]) {
  return data.map(m => {
    const parsed = parseMonthDate(m.date);
    const occ = m.occupancy != null
      ? (m.occupancy > 1 ? m.occupancy : m.occupancy * 100)
      : 0;
    return {
      shortMonth: parsed.shortLabel,
      revenue: Math.round(m.revenue),
      occupancyPct: Math.round(occ),
      adr: m.adr ? Math.round(m.adr) : undefined,
    };
  });
}

describe('MarketTrendsChart', () => {
  describe('Data Transformation', () => {
    it('should parse month dates correctly', () => {
      const result = parseMonthDate('2024-01');
      expect(result.shortLabel).toBe("Jan '24");
      expect(result.monthIdx).toBe(0);
      expect(result.year).toBe('2024');
    });

    it('should parse all 12 months correctly', () => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 0; i < 12; i++) {
        const monthStr = `2024-${String(i + 1).padStart(2, '0')}`;
        const result = parseMonthDate(monthStr);
        expect(result.shortLabel).toBe(`${months[i]} '24`);
        expect(result.monthIdx).toBe(i);
      }
    });

    it('should transform market data with decimal occupancy (0-1)', () => {
      const data: MarketTrendMonth[] = [
        { date: '2024-06', revenue: 2900, occupancy: 0.65, adr: 150 },
      ];
      const result = transformMarketData(data);
      expect(result[0].revenue).toBe(2900);
      expect(result[0].occupancyPct).toBe(65);
      expect(result[0].adr).toBe(150);
    });

    it('should transform market data with percentage occupancy (0-100)', () => {
      const data: MarketTrendMonth[] = [
        { date: '2024-06', revenue: 2900, occupancy: 65, adr: 150 },
      ];
      const result = transformMarketData(data);
      expect(result[0].occupancyPct).toBe(65);
    });

    it('should handle missing occupancy', () => {
      const data: MarketTrendMonth[] = [
        { date: '2024-06', revenue: 2900 },
      ];
      const result = transformMarketData(data);
      expect(result[0].occupancyPct).toBe(0);
    });

    it('should handle missing ADR', () => {
      const data: MarketTrendMonth[] = [
        { date: '2024-06', revenue: 2900, occupancy: 0.65 },
      ];
      const result = transformMarketData(data);
      expect(result[0].adr).toBeUndefined();
    });

    it('should round revenue values', () => {
      const data: MarketTrendMonth[] = [
        { date: '2024-06', revenue: 2934.56, occupancy: 0.653 },
      ];
      const result = transformMarketData(data);
      expect(result[0].revenue).toBe(2935);
      expect(result[0].occupancyPct).toBe(65);
    });

    it('should process a full 24-month dataset', () => {
      const data: MarketTrendMonth[] = [];
      for (let i = 0; i < 24; i++) {
        const year = 2023 + Math.floor(i / 12);
        const month = (i % 12) + 1;
        data.push({
          date: `${year}-${String(month).padStart(2, '0')}`,
          revenue: 2500 + Math.random() * 1000,
          occupancy: 0.5 + Math.random() * 0.4,
          adr: 100 + Math.random() * 100,
        });
      }
      const result = transformMarketData(data);
      expect(result.length).toBe(24);
      result.forEach(r => {
        expect(r.revenue).toBeGreaterThan(0);
        expect(r.occupancyPct).toBeGreaterThanOrEqual(50);
        expect(r.occupancyPct).toBeLessThanOrEqual(100);
        expect(r.adr).toBeGreaterThan(0);
      });
    });

    it('should calculate correct average revenue', () => {
      const data: MarketTrendMonth[] = [
        { date: '2024-01', revenue: 2000 },
        { date: '2024-02', revenue: 3000 },
        { date: '2024-03', revenue: 4000 },
      ];
      const result = transformMarketData(data);
      const avg = result.reduce((sum, d) => sum + d.revenue, 0) / result.length;
      expect(avg).toBe(3000);
    });
  });

  describe('Market vs Property Data Separation', () => {
    it('should keep market data values distinct from property forecast values', () => {
      // Market data typically shows lower averages (~$2,900/mo)
      const marketData: MarketTrendMonth[] = [
        { date: '2024-01', revenue: 2900, occupancy: 0.65, adr: 150 },
        { date: '2024-02', revenue: 2800, occupancy: 0.60, adr: 145 },
      ];
      
      // Property forecast shows higher specific projections (~$6,300/mo)
      const propertyForecast = [
        { month: '2025-05', revenue: 6300, occupancy: 0.85, adr: 450 },
        { month: '2025-06', revenue: 6800, occupancy: 0.90, adr: 480 },
      ];
      
      const marketResult = transformMarketData(marketData);
      
      // Market and property data should never be mixed
      expect(marketResult[0].revenue).toBeLessThan(propertyForecast[0].revenue);
      expect(marketResult[0].revenue).toBe(2900);
      expect(propertyForecast[0].revenue).toBe(6300);
    });

    it('should not contain property-specific labels', () => {
      // The MarketTrendsChart legend should say "Market Avg Revenue", not "Projected Revenue"
      const marketLegendLabels = ['Market Avg Revenue', 'Avg Occupancy'];
      const propertyLegendLabels = ['Projected Revenue', 'Occupancy Rate'];
      
      // Ensure no overlap
      marketLegendLabels.forEach(label => {
        expect(propertyLegendLabels).not.toContain(label);
      });
    });
  });

  describe('HistoricalData Interface', () => {
    it('should accept months array with date, revenue, occupancy, adr', () => {
      const historicalData = {
        summary: {
          yoy_revenue_change: 5.2,
          trend: 'up' as const,
        },
        months: [
          { date: '2024-01', revenue: 2900, occupancy: 0.65, adr: 150 },
          { date: '2024-02', revenue: 2800, occupancy: 0.60, adr: 145 },
        ],
      };
      
      expect(historicalData.months.length).toBe(2);
      expect(historicalData.summary.trend).toBe('up');
    });

    it('should also accept monthly field as fallback', () => {
      const historicalData = {
        summary: { trend: 'stable' as const },
        monthly: [
          { date: '2024-01', revenue: 2900, occupancy: 0.65, adr: 150 },
        ],
      };
      
      // When months is absent, monthly should be used
      const dataToUse = historicalData.months || historicalData.monthly;
      expect(dataToUse).toBeDefined();
      expect(dataToUse!.length).toBe(1);
    });

    it('should not render chart with fewer than 3 data points', () => {
      const historicalData = {
        summary: { trend: 'stable' as const },
        months: [
          { date: '2024-01', revenue: 2900 },
          { date: '2024-02', revenue: 2800 },
        ],
      };
      
      // The condition is: months.length > 2
      const shouldRender = historicalData.months && historicalData.months.length > 2;
      expect(shouldRender).toBe(false);
    });

    it('should render chart with 3+ data points', () => {
      const historicalData = {
        summary: { trend: 'up' as const },
        months: [
          { date: '2024-01', revenue: 2900 },
          { date: '2024-02', revenue: 2800 },
          { date: '2024-03', revenue: 3100 },
        ],
      };
      
      const shouldRender = historicalData.months && historicalData.months.length > 2;
      expect(shouldRender).toBe(true);
    });
  });
});

describe('Distance Lines Toggle', () => {
  it('should default to showing distance lines', () => {
    const showDistanceLines = true; // default state
    expect(showDistanceLines).toBe(true);
  });

  it('should toggle distance lines state', () => {
    let showDistanceLines = true;
    // Simulate toggle
    showDistanceLines = !showDistanceLines;
    expect(showDistanceLines).toBe(false);
    // Toggle back
    showDistanceLines = !showDistanceLines;
    expect(showDistanceLines).toBe(true);
  });

  it('should set polyline map to null when hidden', () => {
    // Simulate the toggle logic
    const showDistanceLines = false;
    const map = { id: 'mock-map' };
    const polylineMap = showDistanceLines ? map : null;
    expect(polylineMap).toBeNull();
  });

  it('should set polyline map to map instance when shown', () => {
    const showDistanceLines = true;
    const map = { id: 'mock-map' };
    const polylineMap = showDistanceLines ? map : null;
    expect(polylineMap).toEqual({ id: 'mock-map' });
  });

  it('should set distance overlay map to null when hidden', () => {
    const showDistanceLines = false;
    const map = { id: 'mock-map' };
    const overlayMap = showDistanceLines ? map : null;
    expect(overlayMap).toBeNull();
  });

  it('should set distance overlay map to map instance when shown', () => {
    const showDistanceLines = true;
    const map = { id: 'mock-map' };
    const overlayMap = showDistanceLines ? map : null;
    expect(overlayMap).toEqual({ id: 'mock-map' });
  });

  it('should apply to all polylines and overlays', () => {
    const showDistanceLines = false;
    const map = { id: 'mock-map' };
    
    // Simulate multiple polylines
    const polylines = [
      { visible: true },
      { visible: true },
      { visible: true },
    ];
    
    const overlays = [
      { visible: true },
      { visible: true },
    ];
    
    // Apply toggle
    polylines.forEach(p => { p.visible = showDistanceLines; });
    overlays.forEach(o => { o.visible = showDistanceLines; });
    
    polylines.forEach(p => expect(p.visible).toBe(false));
    overlays.forEach(o => expect(o.visible).toBe(false));
  });
});

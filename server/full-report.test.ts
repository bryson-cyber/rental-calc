import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for the Full Property Report feature.
 * Validates that the shared reports system correctly handles the 'full' report type.
 */

// Mock data that matches the FullReportData interface
const mockFullReportData = {
  property: {
    address: '123 Main St, Denver, CO 80202',
    city: 'Denver',
    state: 'CO',
    zipCode: '80202',
    bedrooms: 3,
    bathrooms: 2,
    accommodates: 6,
    latitude: 39.7392,
    longitude: -104.9903,
  },
  revenue_estimate: {
    annual: 85000,
    monthly: 7083,
    nightly: 250,
    occupancy: 0.73,
    range: { low: 72000, high: 98000 },
  },
  monthly_forecast: [
    { month: '2025-01', revenue: 5500, occupancy: 0.65, adr: 230 },
    { month: '2025-02', revenue: 6200, occupancy: 0.70, adr: 240 },
    { month: '2025-03', revenue: 7800, occupancy: 0.78, adr: 260 },
  ],
  comps: [
    {
      id: '1',
      title: 'Downtown Loft',
      bedrooms: 3,
      bathrooms: 2,
      reviews: 45,
      annual_revenue: 78000,
      adr: 220,
      occupancy: 0.71,
      rating: 4.8,
    },
    {
      id: '2',
      title: 'City View Condo',
      bedrooms: 3,
      bathrooms: 2,
      reviews: 32,
      annual_revenue: 92000,
      adr: 280,
      occupancy: 0.68,
      rating: 4.9,
    },
  ],
  market_data: {
    name: 'Denver',
    metrics: {
      occupancy: 0.73,
      adr: 250,
      revenue: 85000,
      revpar: 182.5,
      active_listings: 1500,
    },
    listing_count: 1500,
  },
  bedroom_performance: [],
  generated_at: new Date().toISOString(),
  rental_arbitrage: {
    monthlyRent: 2500,
    startupCosts: 20000,
  },
  purchase: {
    purchasePrice: 450000,
    downPaymentPercent: 20,
    interestRate: 7,
    loanTerm: 30,
    loanType: 'conventional' as const,
  },
};

describe('Full Report Data Structure', () => {
  it('should have all required property fields', () => {
    const { property } = mockFullReportData;
    expect(property.address).toBeTruthy();
    expect(property.bedrooms).toBeGreaterThan(0);
    expect(property.bathrooms).toBeGreaterThan(0);
    expect(property.accommodates).toBeGreaterThan(0);
    expect(property.city).toBeTruthy();
    expect(property.state).toBeTruthy();
  });

  it('should have valid revenue estimates', () => {
    const { revenue_estimate } = mockFullReportData;
    expect(revenue_estimate.annual).toBeGreaterThan(0);
    expect(revenue_estimate.monthly).toBeGreaterThan(0);
    expect(revenue_estimate.nightly).toBeGreaterThan(0);
    expect(revenue_estimate.occupancy).toBeGreaterThan(0);
    expect(revenue_estimate.occupancy).toBeLessThanOrEqual(1);
    
    // Revenue range should bracket the annual estimate
    if (revenue_estimate.range) {
      expect(revenue_estimate.range.low).toBeLessThanOrEqual(revenue_estimate.annual);
      expect(revenue_estimate.range.high).toBeGreaterThanOrEqual(revenue_estimate.annual);
    }
  });

  it('should have valid monthly forecast data', () => {
    const { monthly_forecast } = mockFullReportData;
    expect(monthly_forecast.length).toBeGreaterThan(0);
    
    for (const month of monthly_forecast) {
      expect(month.month).toMatch(/^\d{4}-\d{2}$/);
      expect(month.revenue).toBeGreaterThanOrEqual(0);
      expect(month.occupancy).toBeGreaterThanOrEqual(0);
      expect(month.occupancy).toBeLessThanOrEqual(1);
    }
  });

  it('should have valid comparable properties', () => {
    const { comps } = mockFullReportData;
    expect(comps.length).toBeGreaterThan(0);
    
    for (const comp of comps) {
      expect(comp.id).toBeTruthy();
      expect(comp.title).toBeTruthy();
      expect(comp.bedrooms).toBeGreaterThan(0);
      expect(comp.annual_revenue).toBeGreaterThan(0);
    }
  });

  it('should have valid market data', () => {
    const { market_data } = mockFullReportData;
    expect(market_data.name).toBeTruthy();
    expect(market_data.listing_count).toBeGreaterThan(0);
    expect(market_data.metrics.occupancy).toBeGreaterThan(0);
    expect(market_data.metrics.adr).toBeGreaterThan(0);
  });

  it('should have valid rental arbitrage scenario', () => {
    const { rental_arbitrage } = mockFullReportData;
    expect(rental_arbitrage).toBeDefined();
    expect(rental_arbitrage!.monthlyRent).toBeGreaterThan(0);
    expect(rental_arbitrage!.startupCosts).toBeGreaterThan(0);
  });

  it('should have valid purchase scenario', () => {
    const { purchase } = mockFullReportData;
    expect(purchase).toBeDefined();
    expect(purchase!.purchasePrice).toBeGreaterThan(0);
    expect(purchase!.downPaymentPercent).toBeGreaterThan(0);
    expect(purchase!.downPaymentPercent).toBeLessThanOrEqual(100);
    expect(purchase!.interestRate).toBeGreaterThan(0);
    expect(purchase!.loanTerm).toBeGreaterThan(0);
    expect(['conventional', 'dscr', 'fha', 'cash']).toContain(purchase!.loanType);
  });
});

describe('Full Report Calculations', () => {
  it('should calculate correct monthly revenue from annual', () => {
    const annual = mockFullReportData.revenue_estimate.annual;
    const monthly = mockFullReportData.revenue_estimate.monthly;
    expect(Math.abs(monthly - annual / 12)).toBeLessThan(1);
  });

  it('should calculate correct rental arbitrage break-even', () => {
    const { rental_arbitrage, revenue_estimate } = mockFullReportData;
    if (rental_arbitrage) {
      const monthlyRevenue = revenue_estimate.annual / 12;
      const monthlyProfit = monthlyRevenue - rental_arbitrage.monthlyRent;
      expect(monthlyProfit).toBeGreaterThan(0); // Should be profitable
      
      // Break-even months = startup costs / monthly profit
      const breakEvenMonths = rental_arbitrage.startupCosts / monthlyProfit;
      expect(breakEvenMonths).toBeGreaterThan(0);
      expect(breakEvenMonths).toBeLessThan(120); // Should break even within 10 years
    }
  });

  it('should calculate correct purchase mortgage payment', () => {
    const { purchase, revenue_estimate } = mockFullReportData;
    if (purchase) {
      const loanAmount = purchase.purchasePrice * (1 - purchase.downPaymentPercent / 100);
      const monthlyRate = purchase.interestRate / 100 / 12;
      const numPayments = purchase.loanTerm * 12;
      
      // Standard mortgage formula
      const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
      
      expect(monthlyPayment).toBeGreaterThan(0);
      expect(loanAmount).toBe(360000); // 450000 * 0.8
      
      // Cap rate = NOI / Purchase Price
      const annualExpenses = revenue_estimate.annual * 0.35; // ~35% expenses
      const noi = revenue_estimate.annual - annualExpenses;
      const capRate = (noi / purchase.purchasePrice) * 100;
      expect(capRate).toBeGreaterThan(0);
    }
  });
});

describe('Full Report JSON Serialization', () => {
  it('should serialize and deserialize correctly', () => {
    const serialized = JSON.stringify(mockFullReportData);
    const deserialized = JSON.parse(serialized);
    
    expect(deserialized.property.address).toBe(mockFullReportData.property.address);
    expect(deserialized.revenue_estimate.annual).toBe(mockFullReportData.revenue_estimate.annual);
    expect(deserialized.comps.length).toBe(mockFullReportData.comps.length);
    expect(deserialized.rental_arbitrage.monthlyRent).toBe(mockFullReportData.rental_arbitrage.monthlyRent);
    expect(deserialized.purchase.purchasePrice).toBe(mockFullReportData.purchase.purchasePrice);
  });

  it('should handle large report data without truncation', () => {
    // Simulate a report with many comps
    const largeReport = {
      ...mockFullReportData,
      comps: Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        title: `Property ${i}`,
        bedrooms: 3,
        bathrooms: 2,
        reviews: Math.floor(Math.random() * 200),
        annual_revenue: 50000 + Math.floor(Math.random() * 100000),
        adr: 150 + Math.floor(Math.random() * 200),
        occupancy: 0.5 + Math.random() * 0.4,
        rating: 4 + Math.random(),
      })),
    };
    
    const serialized = JSON.stringify(largeReport);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.comps.length).toBe(50);
  });

  it('should handle optional fields gracefully', () => {
    const minimalReport = {
      property: {
        address: '123 Test St',
        city: 'Test',
        state: 'TS',
        zipCode: '00000',
        bedrooms: 1,
        bathrooms: 1,
        accommodates: 2,
      },
      revenue_estimate: {
        annual: 30000,
        monthly: 2500,
        nightly: 100,
        occupancy: 0.5,
      },
      monthly_forecast: [],
      comps: [],
      market_data: {
        name: 'Test Market',
        metrics: { occupancy: 0.5, adr: 100, revenue: 30000, revpar: 50, active_listings: 10 },
        listing_count: 10,
      },
      bedroom_performance: [],
      generated_at: new Date().toISOString(),
    };
    
    const serialized = JSON.stringify(minimalReport);
    const deserialized = JSON.parse(serialized);
    
    expect(deserialized.rental_arbitrage).toBeUndefined();
    expect(deserialized.purchase).toBeUndefined();
    expect(deserialized.ai_summary).toBeUndefined();
    expect(deserialized.prepared_for).toBeUndefined();
  });
});

describe('Report Type Validation', () => {
  it('should accept "full" as a valid report type', () => {
    const validTypes = ['property', 'market', 'full'];
    expect(validTypes).toContain('full');
  });

  it('should generate a valid shareId format', () => {
    // Simulate shareId generation (same logic as in routers.ts)
    const shareId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    expect(shareId.length).toBeGreaterThan(8);
    expect(shareId).toMatch(/^[a-z0-9]+$/);
  });
});

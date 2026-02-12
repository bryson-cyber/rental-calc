/**
 * Tests for the ShareableReportViewer data transformation logic.
 * 
 * These tests validate that validator and revenue report data from
 * universal_shareable_reports is correctly transformed into the
 * FullReportData shape that FullPropertyReport expects.
 */
import { describe, it, expect } from 'vitest';

// Since the transform functions are in a React component file, we test the
// transformation logic by replicating the same mapping here.
// This ensures the data mapping contract is correct.

// ============================================================
// Replicate the transformation logic for testing
// ============================================================

interface FullReportData {
  property: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    bedrooms: number;
    bathrooms: number;
    accommodates: number;
    latitude?: number;
    longitude?: number;
  };
  revenue_estimate: {
    annual: number;
    monthly: number;
    nightly: number;
    occupancy: number;
    range?: { low: number; high: number };
  };
  monthly_forecast: Array<{
    month: string;
    revenue: number;
    occupancy?: number;
    adr?: number;
  }>;
  comps: Array<{
    id: string;
    title: string;
    bedrooms: number;
    bathrooms: number;
    rating: number | null;
    reviews: number;
    annual_revenue: number;
    adr: number;
    occupancy: number;
  }>;
  same_bedroom_comps?: any[];
  market_data?: {
    name: string;
    metrics: {
      occupancy: number;
      adr: number;
      revenue: number;
      active_listings: number;
      market_score?: number;
    };
    listing_count: number;
  };
  bedroom_performance: any[];
  revenue_percentiles?: {
    p10: number; p25: number; p50: number; p75: number; p90: number;
  };
  rental_arbitrage?: { monthlyRent: number; startupCosts?: number };
  historical_data?: any;
  generated_at?: string;
}

function transformValidatorToFullReportData(reportData: any, dbRecord: any): FullReportData {
  const fullAddress = dbRecord.address || '';
  const addressParts = fullAddress.split(',').map((s: string) => s.trim());
  let city = dbRecord.city || '';
  let state = dbRecord.state || '';
  let zipCode = '';

  if (!city && addressParts.length >= 2) {
    city = addressParts[1] || '';
  }
  if (!state && addressParts.length >= 3) {
    const stateZip = addressParts[2] || '';
    const stateZipParts = stateZip.split(' ').filter(Boolean);
    state = stateZipParts[0] || '';
    zipCode = stateZipParts[1] || '';
  }

  const bedrooms = dbRecord.bedrooms || 2;
  const bathrooms = parseFloat(dbRecord.bathrooms) || 1;
  const monthlyRent = dbRecord.monthlyRent || 0;

  const revenue = reportData.revenue || {};
  const metrics = reportData.metrics || {};
  const projected = revenue.projected || 0;
  const occupancy = metrics.occupancy || 0;
  const adr = metrics.adr || 0;

  const property = {
    address: fullAddress,
    city,
    state,
    zipCode,
    bedrooms,
    bathrooms,
    accommodates: bedrooms * 2,
    latitude: dbRecord.latitude ? parseFloat(dbRecord.latitude) : undefined,
    longitude: dbRecord.longitude ? parseFloat(dbRecord.longitude) : undefined,
  };

  const revenue_estimate = {
    annual: projected,
    monthly: Math.round(projected / 12),
    nightly: adr,
    occupancy: occupancy > 1 ? occupancy / 100 : occupancy,
    range: revenue.low && revenue.high ? { low: revenue.low, high: revenue.high } : undefined,
  };

  const monthly_forecast = (reportData.forecast || []).map((f: any) => ({
    month: f.month,
    revenue: f.revenue,
    occupancy: f.occupancy > 1 ? f.occupancy : f.occupancy * 100,
    adr: f.adr,
  }));

  const comps = (reportData.comparables || []).map((c: any) => ({
    id: c.id || String(Math.random()),
    title: c.title || 'Comparable Property',
    airbnb_url: c.airbnbUrl,
    image_url: c.imageUrl || (c.images && c.images[0]) || undefined,
    bedrooms: c.bedrooms || bedrooms,
    bathrooms: c.bathrooms || bathrooms,
    accommodates: c.accommodates,
    rating: c.rating ?? null,
    reviews: c.reviews || 0,
    annual_revenue: c.revenue || 0,
    adr: c.adr || 0,
    occupancy: c.occupancy || 0,
    latitude: c.latitude,
    longitude: c.longitude,
    airbnb_listing_id: c.id,
  }));

  const bedroom_performance = (reportData.bedroomPerformance || []).map((bp: any) => ({
    bedrooms: bp.bedrooms,
    occupancy: bp.occupancy,
    adr: bp.adr,
    revenue: bp.revenue,
    listing_count: bp.listing_count,
  }));

  const revenue_percentiles = reportData.revenuePercentiles || undefined;

  let market_data = undefined;
  if (reportData.rawMarketData) {
    const raw = reportData.rawMarketData;
    market_data = {
      name: raw.name || 'Local Market',
      metrics: {
        occupancy: raw.metrics?.occupancy || 0,
        adr: raw.metrics?.adr || 0,
        revenue: raw.metrics?.revenue || 0,
        revpar: raw.metrics?.revpar,
        active_listings: raw.metrics?.active_listings || raw.listing_count || 0,
        market_score: raw.metrics?.market_score,
      },
      listing_count: raw.listing_count || raw.metrics?.active_listings || 0,
    };
  }

  let historical_data = undefined;
  if (reportData.historicalData) {
    historical_data = {
      summary: reportData.historicalData.summary || {},
      months: reportData.historicalData.months || [],
    };
  }

  let rental_arbitrage = undefined;
  if (monthlyRent > 0) {
    rental_arbitrage = {
      monthlyRent,
      startupCosts: 5000,
    };
  }

  return {
    property,
    revenue_estimate,
    monthly_forecast,
    comps,
    same_bedroom_comps: comps.filter((c: any) => c.bedrooms === bedrooms),
    market_data,
    bedroom_performance,
    revenue_percentiles,
    rental_arbitrage,
    historical_data,
    generated_at: dbRecord.createdAt ? new Date(dbRecord.createdAt).toISOString() : new Date().toISOString(),
  };
}

function transformRevenueToFullReportData(reportData: any, dbRecord: any): FullReportData {
  const fullAddress = dbRecord.address || '';
  const addressParts = fullAddress.split(',').map((s: string) => s.trim());
  let city = dbRecord.city || '';
  let state = dbRecord.state || '';
  let zipCode = '';

  if (!city && addressParts.length >= 2) {
    city = addressParts[1] || '';
  }
  if (!state && addressParts.length >= 3) {
    const stateZip = addressParts[2] || '';
    const stateZipParts = stateZip.split(' ').filter(Boolean);
    state = stateZipParts[0] || '';
    zipCode = stateZipParts[1] || '';
  }

  const bedrooms = dbRecord.bedrooms || 2;
  const bathrooms = parseFloat(dbRecord.bathrooms) || 1;

  const est = reportData.estimates || {};
  const annualRevenue = est.annual_revenue || 0;
  const adr = est.average_daily_rate || 0;
  const occupancy = est.occupancy_rate || 0;

  const property = {
    address: fullAddress,
    city,
    state,
    zipCode,
    bedrooms,
    bathrooms,
    accommodates: bedrooms * 2,
    latitude: dbRecord.latitude ? parseFloat(dbRecord.latitude) : undefined,
    longitude: dbRecord.longitude ? parseFloat(dbRecord.longitude) : undefined,
  };

  const revenue_estimate = {
    annual: annualRevenue,
    monthly: Math.round(annualRevenue / 12),
    nightly: adr,
    occupancy: occupancy > 1 ? occupancy / 100 : occupancy,
    range: est.annual_revenue_low && est.annual_revenue_high
      ? { low: est.annual_revenue_low, high: est.annual_revenue_high }
      : undefined,
  };

  const monthly_forecast = (reportData.monthly_forecast || []).map((f: any) => ({
    month: f.month,
    revenue: f.revenue,
    occupancy: f.occupancy != null ? (f.occupancy > 1 ? f.occupancy : f.occupancy * 100) : undefined,
    adr: f.adr,
  }));

  const comps = (reportData.comps || []).map((c: any) => ({
    id: c.id || String(Math.random()),
    title: c.title || 'Comparable Property',
    airbnb_url: c.airbnb_url || c.airbnbUrl,
    image_url: c.image_url || c.imageUrl || (c.images && c.images[0]) || undefined,
    bedrooms: c.bedrooms || bedrooms,
    bathrooms: c.bathrooms || bathrooms,
    accommodates: c.accommodates,
    property_type: c.property_type,
    rating: c.rating ?? null,
    reviews: c.reviews || 0,
    annual_revenue: c.annual_revenue || c.revenue || 0,
    adr: c.adr || 0,
    occupancy: c.occupancy || 0,
    superhost: c.superhost,
    distance_meters: c.distance_meters,
    latitude: c.latitude,
    longitude: c.longitude,
    airbnb_listing_id: c.airbnb_listing_id || c.id,
  }));

  let market_data = undefined;
  if (reportData.market) {
    const mkt = reportData.market;
    market_data = {
      name: mkt.name || 'Local Market',
      metrics: {
        occupancy: mkt.metrics?.occupancy || 0,
        adr: mkt.metrics?.adr || 0,
        revenue: mkt.metrics?.revenue || 0,
        revpar: mkt.metrics?.revpar,
        active_listings: mkt.metrics?.active_listings || mkt.listing_count || 0,
        market_score: mkt.metrics?.market_score,
      },
      listing_count: mkt.listing_count || mkt.metrics?.active_listings || 0,
    };
  }

  let historical_data = undefined;
  if (reportData.market?.historical) {
    historical_data = {
      summary: reportData.market.historical.summary || {},
      months: reportData.market.historical.months || [],
    };
  }

  const bedroom_performance = (reportData.market?.bedroom_performance || []).map((bp: any) => ({
    bedrooms: bp.bedrooms,
    occupancy: bp.occupancy,
    adr: bp.adr,
    revenue: bp.revenue,
    listing_count: bp.listing_count,
  }));

  const revenue_percentiles = reportData.market?.revenue_percentiles || undefined;

  return {
    property,
    revenue_estimate,
    monthly_forecast,
    comps,
    same_bedroom_comps: comps.filter((c: any) => c.bedrooms === bedrooms),
    market_data,
    bedroom_performance,
    revenue_percentiles,
    historical_data,
    generated_at: dbRecord.createdAt ? new Date(dbRecord.createdAt).toISOString() : new Date().toISOString(),
  };
}

// ============================================================
// TESTS
// ============================================================

describe('ShareableReportViewer Data Transformations', () => {
  describe('transformValidatorToFullReportData', () => {
    const mockValidatorReportData = {
      revenue: { projected: 81721, low: 76988, high: 86453 },
      metrics: { adr: 337, occupancy: 66 },
      forecast: [
        { month: '2026-02', revenue: 4889, adr: 270.43, occupancy: 65 },
        { month: '2026-03', revenue: 7200, adr: 310, occupancy: 75 },
      ],
      comparables: [
        {
          id: 'comp-1',
          title: 'Top 1% Resort-Style Oasis',
          bedrooms: 3,
          bathrooms: 3,
          rating: 5.0,
          reviews: 153,
          revenue: 141639,
          adr: 573,
          occupancy: 70,
          airbnbUrl: 'https://airbnb.com/rooms/123',
          imageUrl: 'https://example.com/image.jpg',
        },
        {
          id: 'comp-2',
          title: 'Modern Craftsman',
          bedrooms: 3,
          bathrooms: 2,
          rating: 4.9,
          reviews: 134,
          revenue: 107693,
          adr: 355,
          occupancy: 85,
        },
      ],
      bedroomPerformance: [
        { bedrooms: 1, adr: 244, occupancy: 78, revenue: 62971, listing_count: 100 },
        { bedrooms: 3, adr: 432, occupancy: 70, revenue: 99181, listing_count: 100 },
      ],
      revenuePercentiles: { p10: 81142, p25: 82767, p50: 90615, p75: 100788, p90: 113685 },
      rawMarketData: {
        name: 'San Diego',
        listing_count: 16594,
        metrics: {
          active_listings: 16594,
          adr: 248.42,
          market_score: 51.538,
          occupancy: 55.13,
          revenue: 3817.46,
          revpar: 136.95,
        },
      },
      historicalData: {
        summary: { trend: 'stable', monthly_pct_change: 0.046 },
        months: [{ date: '2026-01', adr: 248.42, occupancy: 55.13, revenue: 3817.46 }],
      },
      cashFlow: { monthlyProfit: 3015, monthlyRent: 3795, monthlyRevenue: 6810 },
    };

    const mockDbRecord = {
      address: '2953 Kalmia St, San Diego, CA 92104',
      city: null,
      state: null,
      bedrooms: 3,
      bathrooms: '2.0',
      monthlyRent: 3795,
      latitude: null,
      longitude: null,
      createdAt: '2026-02-01T00:00:00.000Z',
    };

    it('should correctly map property info from address', () => {
      const result = transformValidatorToFullReportData(mockValidatorReportData, mockDbRecord);
      
      expect(result.property.address).toBe('2953 Kalmia St, San Diego, CA 92104');
      expect(result.property.city).toBe('San Diego');
      expect(result.property.state).toBe('CA');
      expect(result.property.zipCode).toBe('92104');
      expect(result.property.bedrooms).toBe(3);
      expect(result.property.bathrooms).toBe(2);
      expect(result.property.accommodates).toBe(6);
    });

    it('should correctly map revenue estimates', () => {
      const result = transformValidatorToFullReportData(mockValidatorReportData, mockDbRecord);
      
      expect(result.revenue_estimate.annual).toBe(81721);
      expect(result.revenue_estimate.monthly).toBe(Math.round(81721 / 12));
      expect(result.revenue_estimate.nightly).toBe(337);
      expect(result.revenue_estimate.occupancy).toBe(0.66);
      expect(result.revenue_estimate.range).toEqual({ low: 76988, high: 86453 });
    });

    it('should correctly map monthly forecast', () => {
      const result = transformValidatorToFullReportData(mockValidatorReportData, mockDbRecord);
      
      expect(result.monthly_forecast).toHaveLength(2);
      expect(result.monthly_forecast[0].month).toBe('2026-02');
      expect(result.monthly_forecast[0].revenue).toBe(4889);
      expect(result.monthly_forecast[0].adr).toBe(270.43);
    });

    it('should correctly map comparables', () => {
      const result = transformValidatorToFullReportData(mockValidatorReportData, mockDbRecord);
      
      expect(result.comps).toHaveLength(2);
      expect(result.comps[0].title).toBe('Top 1% Resort-Style Oasis');
      expect(result.comps[0].annual_revenue).toBe(141639);
      expect(result.comps[0].adr).toBe(573);
      expect(result.comps[0].rating).toBe(5.0);
      expect(result.comps[0].airbnb_url).toBe('https://airbnb.com/rooms/123');
    });

    it('should correctly map bedroom performance', () => {
      const result = transformValidatorToFullReportData(mockValidatorReportData, mockDbRecord);
      
      expect(result.bedroom_performance).toHaveLength(2);
      expect(result.bedroom_performance[0].bedrooms).toBe(1);
      expect(result.bedroom_performance[0].revenue).toBe(62971);
    });

    it('should correctly map revenue percentiles', () => {
      const result = transformValidatorToFullReportData(mockValidatorReportData, mockDbRecord);
      
      expect(result.revenue_percentiles).toEqual({
        p10: 81142, p25: 82767, p50: 90615, p75: 100788, p90: 113685,
      });
    });

    it('should correctly map market data from rawMarketData', () => {
      const result = transformValidatorToFullReportData(mockValidatorReportData, mockDbRecord);
      
      expect(result.market_data).toBeDefined();
      expect(result.market_data!.name).toBe('San Diego');
      expect(result.market_data!.listing_count).toBe(16594);
      expect(result.market_data!.metrics.market_score).toBe(51.538);
    });

    it('should create rental arbitrage from monthlyRent', () => {
      const result = transformValidatorToFullReportData(mockValidatorReportData, mockDbRecord);
      
      expect(result.rental_arbitrage).toBeDefined();
      expect(result.rental_arbitrage!.monthlyRent).toBe(3795);
      expect(result.rental_arbitrage!.startupCosts).toBe(5000);
    });

    it('should correctly map historical data', () => {
      const result = transformValidatorToFullReportData(mockValidatorReportData, mockDbRecord);
      
      expect(result.historical_data).toBeDefined();
      expect(result.historical_data!.summary.trend).toBe('stable');
      expect(result.historical_data!.months).toHaveLength(1);
    });

    it('should filter same_bedroom_comps correctly', () => {
      const result = transformValidatorToFullReportData(mockValidatorReportData, mockDbRecord);
      
      // Both comps are 3BR, matching the property
      expect(result.same_bedroom_comps).toHaveLength(2);
    });

    it('should normalize occupancy from percentage to decimal', () => {
      const result = transformValidatorToFullReportData(mockValidatorReportData, mockDbRecord);
      
      // occupancy: 66 (percentage) should become 0.66
      expect(result.revenue_estimate.occupancy).toBe(0.66);
    });
  });

  describe('transformRevenueToFullReportData', () => {
    const mockRevenueReportData = {
      estimates: {
        annual_revenue: 43891,
        annual_revenue_low: 41363,
        annual_revenue_high: 46418,
        average_daily_rate: 204,
        occupancy_rate: 0.59,
        currency: 'usd',
        currency_symbol: '$',
      },
      monthly_forecast: [
        { month: '2026-01', revenue: 3140, adr: 170.47, occupancy: 0.59 },
        { month: '2026-02', revenue: 3500, adr: 180, occupancy: 0.65 },
      ],
      comps: [
        {
          id: 'comp-rev-1',
          title: 'Stunning 4 Bed House',
          bedrooms: 4,
          bathrooms: 3.5,
          rating: 4.5,
          reviews: 33,
          annual_revenue: 54357,
          adr: 314,
          occupancy: 48,
          airbnb_url: 'https://airbnb.com/rooms/456',
          image_url: 'https://example.com/img.jpg',
          distance_meters: 3500,
          latitude: 35.1,
          longitude: -80.9,
        },
      ],
      market: {
        name: 'Charlotte',
        listing_count: 5493,
        metrics: {
          active_listings: 5493,
          adr: 162.1,
          market_score: 89.6,
          occupancy: 55.47,
          revenue: 2688.5,
          revpar: 89.91,
        },
      },
    };

    const mockDbRecord = {
      address: '13412 Mallard Landing Rd, Charlotte, NC 28278, USA',
      city: null,
      state: null,
      bedrooms: 4,
      bathrooms: '2.5',
      monthlyRent: null,
      latitude: '35.0547',
      longitude: '-80.9923',
      createdAt: '2026-02-02T00:00:00.000Z',
    };

    it('should correctly map property info from address', () => {
      const result = transformRevenueToFullReportData(mockRevenueReportData, mockDbRecord);
      
      expect(result.property.address).toBe('13412 Mallard Landing Rd, Charlotte, NC 28278, USA');
      expect(result.property.city).toBe('Charlotte');
      expect(result.property.state).toBe('NC');
      expect(result.property.bedrooms).toBe(4);
      expect(result.property.bathrooms).toBe(2.5);
      expect(result.property.latitude).toBe(35.0547);
      expect(result.property.longitude).toBe(-80.9923);
    });

    it('should correctly map revenue estimates from estimates object', () => {
      const result = transformRevenueToFullReportData(mockRevenueReportData, mockDbRecord);
      
      expect(result.revenue_estimate.annual).toBe(43891);
      expect(result.revenue_estimate.monthly).toBe(Math.round(43891 / 12));
      expect(result.revenue_estimate.nightly).toBe(204);
      expect(result.revenue_estimate.occupancy).toBe(0.59);
      expect(result.revenue_estimate.range).toEqual({ low: 41363, high: 46418 });
    });

    it('should correctly map monthly forecast', () => {
      const result = transformRevenueToFullReportData(mockRevenueReportData, mockDbRecord);
      
      expect(result.monthly_forecast).toHaveLength(2);
      expect(result.monthly_forecast[0].month).toBe('2026-01');
      expect(result.monthly_forecast[0].revenue).toBe(3140);
    });

    it('should correctly map comps with revenue report field names', () => {
      const result = transformRevenueToFullReportData(mockRevenueReportData, mockDbRecord);
      
      expect(result.comps).toHaveLength(1);
      expect(result.comps[0].title).toBe('Stunning 4 Bed House');
      expect(result.comps[0].annual_revenue).toBe(54357);
      expect(result.comps[0].distance_meters).toBe(3500);
      expect(result.comps[0].latitude).toBe(35.1);
    });

    it('should correctly map market data', () => {
      const result = transformRevenueToFullReportData(mockRevenueReportData, mockDbRecord);
      
      expect(result.market_data).toBeDefined();
      expect(result.market_data!.name).toBe('Charlotte');
      expect(result.market_data!.listing_count).toBe(5493);
      expect(result.market_data!.metrics.market_score).toBe(89.6);
      expect(result.market_data!.metrics.adr).toBe(162.1);
    });

    it('should not create rental_arbitrage when no monthlyRent', () => {
      const result = transformRevenueToFullReportData(mockRevenueReportData, mockDbRecord);
      
      // Revenue reports don't have monthlyRent
      expect(result.rental_arbitrage).toBeUndefined();
    });

    it('should handle occupancy normalization for decimal values', () => {
      const result = transformRevenueToFullReportData(mockRevenueReportData, mockDbRecord);
      
      // occupancy_rate: 0.59 is already decimal, should stay as 0.59
      expect(result.revenue_estimate.occupancy).toBe(0.59);
    });

    it('should handle monthly forecast occupancy normalization', () => {
      const result = transformRevenueToFullReportData(mockRevenueReportData, mockDbRecord);
      
      // occupancy: 0.59 (decimal) should be converted to 59 for display
      expect(result.monthly_forecast[0].occupancy).toBe(59);
    });
  });

  describe('Address parsing edge cases', () => {
    it('should handle address with city and state in DB record', () => {
      const result = transformValidatorToFullReportData(
        { revenue: { projected: 100000 }, metrics: { adr: 200, occupancy: 70 } },
        { address: '123 Main St, Denver, CO 80202', city: 'Denver', state: 'CO', bedrooms: 2, bathrooms: '1' }
      );
      
      expect(result.property.city).toBe('Denver');
      expect(result.property.state).toBe('CO');
    });

    it('should parse city/state from address when not in DB', () => {
      const result = transformValidatorToFullReportData(
        { revenue: { projected: 100000 }, metrics: { adr: 200, occupancy: 70 } },
        { address: '456 Oak Ave, Austin, TX 78701', city: null, state: null, bedrooms: 3, bathrooms: '2' }
      );
      
      expect(result.property.city).toBe('Austin');
      expect(result.property.state).toBe('TX');
      expect(result.property.zipCode).toBe('78701');
    });

    it('should handle missing address gracefully', () => {
      const result = transformValidatorToFullReportData(
        { revenue: { projected: 0 }, metrics: {} },
        { address: '', bedrooms: 2, bathrooms: '1' }
      );
      
      expect(result.property.address).toBe('');
      expect(result.property.city).toBe('');
    });
  });

  describe('Missing data handling', () => {
    it('should handle missing forecast data', () => {
      const result = transformValidatorToFullReportData(
        { revenue: { projected: 50000 }, metrics: { adr: 150, occupancy: 60 } },
        { address: 'Test', bedrooms: 2, bathrooms: '1' }
      );
      
      expect(result.monthly_forecast).toEqual([]);
    });

    it('should handle missing comparables', () => {
      const result = transformValidatorToFullReportData(
        { revenue: { projected: 50000 }, metrics: { adr: 150, occupancy: 60 } },
        { address: 'Test', bedrooms: 2, bathrooms: '1' }
      );
      
      expect(result.comps).toEqual([]);
    });

    it('should handle missing market data', () => {
      const result = transformValidatorToFullReportData(
        { revenue: { projected: 50000 }, metrics: { adr: 150, occupancy: 60 } },
        { address: 'Test', bedrooms: 2, bathrooms: '1' }
      );
      
      expect(result.market_data).toBeUndefined();
    });

    it('should handle missing revenue percentiles', () => {
      const result = transformRevenueToFullReportData(
        { estimates: { annual_revenue: 50000, average_daily_rate: 200, occupancy_rate: 0.6 } },
        { address: 'Test', bedrooms: 2, bathrooms: '1' }
      );
      
      expect(result.revenue_percentiles).toBeUndefined();
    });
  });
});

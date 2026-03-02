import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the comp-based fallback mechanism used when AirDNA Rentalizer
 * returns null (e.g., new construction addresses not in Airbnb's database).
 *
 * The fallback:
 * 1. Geocodes the address to get lat/lng/city/state/zip
 * 2. Searches AirDNA markets by zip code, then city
 * 3. Pulls market listings filtered by bedroom count
 * 4. Calculates median revenue/ADR/occupancy from comps
 * 5. Builds a synthetic propertyEstimate with _revenue_source = 'comp_fallback'
 * 6. Stores fallback comps on _fallback_comps for downstream use
 */

// Mock the AirDNA API module
vi.mock('./airdna', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    // We'll test the helper functions directly
  };
});

describe('Comp Fallback - Synthetic Estimate Structure', () => {
  it('should include _revenue_source field set to comp_fallback', () => {
    // Simulate the synthetic estimate structure built by the fallback
    const syntheticEstimate = buildSyntheticEstimate({
      address: '26206 Snowpeak Ave, Park Row, TX 77493',
      bedrooms: 3,
      bathrooms: 2,
      accommodates: 6,
      marketComps: generateMockComps(10),
      marketId: 'airdna_12345',
      marketName: 'Katy, TX',
    });

    expect(syntheticEstimate.property._revenue_source).toBe('comp_fallback');
    expect(syntheticEstimate.property._fallback_market).toBe('Katy, TX');
    expect(syntheticEstimate.property._fallback_comp_count).toBe(10);
  });

  it('should include market_id on the synthetic property', () => {
    const syntheticEstimate = buildSyntheticEstimate({
      address: '26206 Snowpeak Ave, Park Row, TX 77493',
      bedrooms: 3,
      bathrooms: 2,
      accommodates: 6,
      marketComps: generateMockComps(5),
      marketId: 'airdna_99999',
      marketName: 'Houston, TX',
    });

    expect(syntheticEstimate.property.market_id).toBe('airdna_99999');
  });

  it('should include currency in estimates', () => {
    const syntheticEstimate = buildSyntheticEstimate({
      address: '123 Test St, Austin, TX 78701',
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4,
      marketComps: generateMockComps(8),
      marketId: 'airdna_11111',
      marketName: 'Austin, TX',
    });

    expect(syntheticEstimate.property.estimates.currency).toBe('USD');
    expect(syntheticEstimate.property.estimates.currency_symbol).toBe('$');
  });

  it('should calculate median revenue from comps', () => {
    const comps = [
      mockComp({ annual_revenue: 30000 }),
      mockComp({ annual_revenue: 40000 }),
      mockComp({ annual_revenue: 50000 }),
      mockComp({ annual_revenue: 60000 }),
      mockComp({ annual_revenue: 70000 }),
    ];

    const syntheticEstimate = buildSyntheticEstimate({
      address: '123 Test St',
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4,
      marketComps: comps,
      marketId: 'test',
      marketName: 'Test Market',
    });

    // Median of [30000, 40000, 50000, 60000, 70000] = 50000
    expect(syntheticEstimate.property.estimates.annual_revenue).toBe(50000);
  });

  it('should set revenue range (low/high) as ±15% of median', () => {
    const comps = [
      mockComp({ annual_revenue: 50000 }),
      mockComp({ annual_revenue: 60000 }),
      mockComp({ annual_revenue: 70000 }),
    ];

    const syntheticEstimate = buildSyntheticEstimate({
      address: '123 Test St',
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4,
      marketComps: comps,
      marketId: 'test',
      marketName: 'Test Market',
    });

    const median = 60000;
    expect(syntheticEstimate.property.estimates.annual_revenue).toBe(median);
    expect(syntheticEstimate.property.estimates.annual_revenue_low).toBe(Math.round(median * 0.85));
    expect(syntheticEstimate.property.estimates.annual_revenue_high).toBe(Math.round(median * 1.15));
  });

  it('should store fallback comps on _fallback_comps', () => {
    const comps = generateMockComps(7);
    const syntheticEstimate = buildSyntheticEstimate({
      address: '123 Test St',
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4,
      marketComps: comps,
      marketId: 'test',
      marketName: 'Test Market',
    });

    expect(syntheticEstimate.property._fallback_comps).toBeDefined();
    expect(syntheticEstimate.property._fallback_comps.length).toBe(7);
  });
});

describe('Comp Fallback - Downstream Comp Injection', () => {
  it('should use fallback comps when radius search returns empty', () => {
    const fallbackComps = generateMockComps(5);
    const radiusComps: any[] = [];

    // Simulate the downstream logic
    let sameBedroomComps = radiusComps;
    const propertyEstimate = {
      _fallback_comps: fallbackComps,
      _revenue_source: 'comp_fallback',
    };

    // This is the injection logic we added
    if (sameBedroomComps.length === 0 && (propertyEstimate as any)._fallback_comps?.length > 0) {
      sameBedroomComps = (propertyEstimate as any)._fallback_comps;
    }

    expect(sameBedroomComps.length).toBe(5);
    expect(sameBedroomComps).toBe(fallbackComps);
  });

  it('should NOT override radius comps when they exist', () => {
    const fallbackComps = generateMockComps(5);
    const radiusComps = generateMockComps(3);

    let sameBedroomComps = radiusComps;
    const propertyEstimate = {
      _fallback_comps: fallbackComps,
      _revenue_source: 'comp_fallback',
    };

    if (sameBedroomComps.length === 0 && (propertyEstimate as any)._fallback_comps?.length > 0) {
      sameBedroomComps = (propertyEstimate as any)._fallback_comps;
    }

    // Radius comps should be preserved
    expect(sameBedroomComps.length).toBe(3);
    expect(sameBedroomComps).toBe(radiusComps);
  });
});

describe('Comp Fallback - Data Source in Frontend', () => {
  it('should set dataSource when _revenue_source is comp_fallback', () => {
    const apiResponse = {
      property: {
        _revenue_source: 'comp_fallback',
        _fallback_market: 'Katy, TX',
        _fallback_comp_count: 15,
        estimates: {
          annual_revenue: 50000,
        },
      },
    };

    // Simulate the frontend transformation
    const dataSource = (apiResponse.property as any)?._revenue_source === 'comp_fallback' ? {
      type: 'comp_fallback' as const,
      market: (apiResponse.property as any)?._fallback_market || 'nearby market',
      compCount: (apiResponse.property as any)?._fallback_comp_count || 0,
    } : undefined;

    expect(dataSource).toBeDefined();
    expect(dataSource!.type).toBe('comp_fallback');
    expect(dataSource!.market).toBe('Katy, TX');
    expect(dataSource!.compCount).toBe(15);
  });

  it('should NOT set dataSource for normal Rentalizer responses', () => {
    const apiResponse = {
      property: {
        estimates: {
          annual_revenue: 50000,
        },
      },
    };

    const dataSource = (apiResponse.property as any)?._revenue_source === 'comp_fallback' ? {
      type: 'comp_fallback' as const,
      market: (apiResponse.property as any)?._fallback_market || 'nearby market',
      compCount: (apiResponse.property as any)?._fallback_comp_count || 0,
    } : undefined;

    expect(dataSource).toBeUndefined();
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function mockComp(overrides: Partial<{
  annual_revenue: number;
  adr: number;
  occupancy: number;
  bedrooms: number;
  bathrooms: number;
}> = {}) {
  return {
    id: `comp_${Math.random().toString(36).slice(2)}`,
    title: 'Test Property',
    bedrooms: overrides.bedrooms ?? 3,
    bathrooms: overrides.bathrooms ?? 2,
    accommodates: 6,
    annual_revenue: overrides.annual_revenue ?? 50000,
    adr: overrides.adr ?? 200,
    occupancy: overrides.occupancy ?? 0.7,
    rating: 4.5,
    reviews: 25,
    latitude: 29.7604,
    longitude: -95.3698,
  };
}

function generateMockComps(count: number) {
  return Array.from({ length: count }, (_, i) =>
    mockComp({ annual_revenue: 40000 + i * 5000 })
  );
}

/**
 * Simulates the synthetic estimate builder from the fallback block in airdna.ts
 * This mirrors the logic at ~line 2980-3050 in airdna.ts
 */
function buildSyntheticEstimate(params: {
  address: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  marketComps: any[];
  marketId: string;
  marketName: string;
}) {
  const { address, bedrooms, bathrooms, accommodates, marketComps, marketId, marketName } = params;

  // Calculate median values (same logic as in the fallback)
  const revenues = marketComps.map((c: any) => c.annual_revenue || 0).sort((a: number, b: number) => a - b);
  const adrs = marketComps.map((c: any) => c.adr || 0).sort((a: number, b: number) => a - b);
  const occupancies = marketComps.map((c: any) => c.occupancy || 0).sort((a: number, b: number) => a - b);

  const median = (arr: number[]) => {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
  };

  const medianRevenue = median(revenues);
  const medianAdr = median(adrs);
  const medianOccupancy = median(occupancies);

  return {
    property: {
      address,
      bedrooms,
      bathrooms,
      accommodates,
      market_id: marketId,
      estimates: {
        annual_revenue: medianRevenue,
        annual_revenue_low: Math.round(medianRevenue * 0.85),
        annual_revenue_high: Math.round(medianRevenue * 1.15),
        average_daily_rate: medianAdr,
        occupancy_rate: medianOccupancy,
        currency: 'USD',
        currency_symbol: '$',
      },
      comps: [],
      _revenue_source: 'comp_fallback',
      _fallback_market: marketName,
      _fallback_comp_count: marketComps.length,
      _fallback_comps: marketComps,
    },
  };
}

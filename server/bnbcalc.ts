/**
 * BNB Calc API Integration
 * 
 * Replaces AirDNA's Rentalizer endpoint for property revenue estimates.
 * Maps BNB Calc response to the existing RentalizerResponse interface
 * so the rest of the codebase (routers, frontend) doesn't need changes.
 * 
 * API Docs: https://www.bnbcalc.com/rest-api/docs
 * Base URL: https://atlas.bnbcalc.com
 * Auth: x-bnbcalc-api-key header
 */
import { ENV } from './_core/env';
import { apiCache } from './cache';
import { logApiCall } from './api-logger';
import { REVENUE_BOOST_FACTOR } from './airdna';
import type { RentalizerResponse } from './airdna';

const BNBCALC_BASE_URL = 'https://atlas.bnbcalc.com';

// ============================================
// TYPE DEFINITIONS (BNB Calc actual API response)
// ============================================

interface BnbCalcQuartile {
  average_daily_rate: number;
  occupancy_rate: number;
  revenue: number;
}

interface BnbCalcRevenueMonth {
  average_daily_rate: number;
  average_occupancy_rate: number;
  average_revenue: number;
}

interface BnbCalcCompMetrics {
  ttm?: {
    revenue: number;
    occupancy: number;
    adjusted_occupancy: number;
    adr: number;
    revpar: number;
    adjusted_revpar: number;
    total_days: number;
    days_reserved: number;
    available_days: number;
    blocked_days: number;
  };
  l90d?: {
    revenue: number;
    occupancy: number;
    adjusted_occupancy: number;
    adr: number;
    revpar: number;
    adjusted_revpar: number;
    total_days: number;
    days_reserved: number;
    available_days: number;
    blocked_days: number;
  };
}

interface BnbCalcComparable {
  listing_id?: string;
  airbnbId?: string;
  vrboId?: string | null;
  name?: string;
  thumbnail_url?: string;
  latitude?: number;
  longitude?: number;
  room_type?: string;
  property_type?: string;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  accommodates?: number;
  host_name?: string;
  superhost?: boolean;
  professional_management?: boolean;
  minimum_nights?: number;
  photos_count?: number;
  cleaning_fee?: number;
  review_scores_rating?: number;
  amenities?: Record<string, boolean>;
  amenities_raw?: string[];
  visible_review_count?: number;
  cancellation_policy?: string;
  is_pet_friendly?: boolean;
  average_occupancy_rate_ltm?: number;
  average_daily_rate_ltm?: number;
  annual_revenue_ltm?: number;
  annual_revenue_potential?: number;
  annual_revenue_potential_adj?: number;
  active_days_count_ltm?: number;
  reviews?: number;
  rating?: number;
  distance_meters?: number | null;
  metrics?: BnbCalcCompMetrics;
  guest_favorite?: boolean;
  exact_location?: boolean;
  source?: string;
}

interface BnbCalcResponse {
  success: boolean;
  data: {
    _id: string;
    url: string;
    currency: string;
    ratePerNightUSD: number;
    occupancyRatePercentage: number;
    bedrooms: number;
    bathrooms: number;
    accomodates: number;
    fullAddress: string;
    county?: string;
    marketId?: string;
    location: {
      type: string;
      coordinates: [number, number]; // [lng, lat]
    };
    quartiles: {
      '25th_percentile': BnbCalcQuartile;
      '50th_percentile': BnbCalcQuartile;
      '75th_percentile': BnbCalcQuartile;
      '90th_percentile': BnbCalcQuartile;
      average: BnbCalcQuartile;
    };
    revenueData: Record<string, BnbCalcRevenueMonth>;
    comparables: BnbCalcComparable[];
  };
  error?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function logCacheHit(endpoint: string): void {
  logApiCall({
    provider: 'bnbcalc',
    endpoint,
    statusCode: 200,
    success: true,
    responseTimeMs: 0,
    cacheHit: true,
    source: 'cache',
  });
}

// ============================================
// MAIN API FUNCTION
// ============================================

interface BnbCalcEstimateRequest {
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  accommodates?: number;
  currency?: string;
}

/**
 * Get a property revenue estimate from BNB Calc API.
 * Uses the "cohost" endpoint (simplest — only needs location + bed/bath/accommodates).
 * Maps the response to the existing RentalizerResponse interface.
 */
export async function getBnbCalcEstimate(
  request: BnbCalcEstimateRequest
): Promise<RentalizerResponse | null> {
  const apiKey = ENV.bnbcalcApiKey;
  if (!apiKey) {
    console.error('[BnbCalc] No API key configured (BNBCALC_API_KEY)');
    return null;
  }

  // Generate cache key (same format as before for compatibility)
  const cacheKey = apiCache.generateKey('rentalizer', {
    address: request.address,
    bedrooms: request.bedrooms,
    bathrooms: request.bathrooms,
    accommodates: request.accommodates,
  });

  // Check cache first
  const cached = await apiCache.getAsync<RentalizerResponse>(cacheKey);
  if (cached) {
    logCacheHit('bnbcalc_cohost');
    return cached;
  }

  const startTime = Date.now();

  try {
    // BNB Calc uses fullAddress for geocoding
    const body: Record<string, unknown> = {
      fullAddress: request.address,
      bedrooms: request.bedrooms ?? 2,
      bathrooms: request.bathrooms ?? 1,
      accomodates: request.accommodates ?? 4, // NOTE: BNB Calc API has typo (single 'm')
    };

    console.log(`[BnbCalc] Calling cohost endpoint for: ${request.address} (${request.bedrooms}BR/${request.bathrooms}BA)`);

    const response = await fetch(`${BNBCALC_BASE_URL}/v1/external/analysis/create/cohost`, {
      method: 'POST',
      headers: {
        'x-bnbcalc-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseTimeMs = Date.now() - startTime;

    // Log the API call
    logApiCall({
      provider: 'bnbcalc',
      endpoint: '/v1/external/analysis/create/cohost',
      statusCode: response.status,
      success: response.ok,
      responseTimeMs,
      cacheHit: false,
      source: 'bnbcalc_cohost',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BnbCalc] API error ${response.status}: ${errorText}`);
      return null;
    }

    const apiResponse: BnbCalcResponse = await response.json();

    if (!apiResponse.success || !apiResponse.data) {
      console.error('[BnbCalc] API returned success=false:', apiResponse.error);
      return null;
    }

    const data = apiResponse.data;

    // ============================================
    // MAP BNB CALC RESPONSE → RentalizerResponse
    // ============================================

    const q = data.quartiles;
    // Use 75th percentile as primary estimate (top quartile performer — matches boost philosophy)
    const annualRevenue = q['75th_percentile'].revenue;
    const annualRevenueLow = q['25th_percentile'].revenue;
    const annualRevenueHigh = q['90th_percentile'].revenue;
    const averageDailyRate = q['75th_percentile'].average_daily_rate;
    const occupancyRate = q['75th_percentile'].occupancy_rate / 100; // Convert percentage to decimal

    // Extract lat/lng from GeoJSON coordinates [lng, lat]
    const longitude = data.location?.coordinates?.[0];
    const latitude = data.location?.coordinates?.[1];

    // Map monthly revenue data to forecast format
    const revenueEntries = Object.entries(data.revenueData || {}).sort(([a], [b]) => a.localeCompare(b));
    const monthly_forecast = revenueEntries.map(([month, monthData]) => ({
      month,
      revenue: Math.round(monthData.average_revenue * REVENUE_BOOST_FACTOR),
      adr: Math.round(monthData.average_daily_rate * REVENUE_BOOST_FACTOR),
      occupancy: monthData.average_occupancy_rate / 100, // Convert percentage to decimal
    }));

    // Map comparables to existing Comp format
    const comps = (data.comparables || []).slice(0, 25).map((comp) => {
      // Use TTM metrics if available, otherwise fall back to LTM fields
      const compRevenue = comp.metrics?.ttm?.revenue ?? comp.annual_revenue_ltm ?? 0;
      const compAdr = comp.metrics?.ttm?.adr ?? comp.average_daily_rate_ltm ?? 0;
      const compOccupancy = (comp.metrics?.ttm?.adjusted_occupancy ?? comp.average_occupancy_rate_ltm ?? 0) / 100;

      return {
        title: comp.name || 'Comparable Property',
        bedrooms: comp.bedrooms ?? request.bedrooms ?? 2,
        bathrooms: comp.bathrooms ?? request.bathrooms ?? 1,
        rating: comp.rating ?? comp.review_scores_rating ?? null,
        reviews: comp.reviews ?? comp.visible_review_count ?? 0,
        annual_revenue: Math.round(compRevenue * REVENUE_BOOST_FACTOR),
        adr: Math.round(compAdr * REVENUE_BOOST_FACTOR),
        occupancy: compOccupancy, // Already decimal — NOT boosted
        distance_meters: comp.distance_meters ?? 0,
        latitude: comp.latitude ?? null,
        longitude: comp.longitude ?? null,
        airbnb_listing_id: comp.airbnbId || comp.listing_id,
        airbnb_url: comp.airbnbId
          ? `https://www.airbnb.com/rooms/${comp.airbnbId}`
          : comp.listing_id
            ? `https://www.airbnb.com/rooms/${comp.listing_id}`
            : undefined,
        image_url: comp.thumbnail_url,
        property_type: comp.property_type,
        accommodates: comp.accommodates,
        // BNB Calc doesn't provide per-comp monthly metrics in the same format
        monthly_metrics: undefined as Array<{ date: string; occupancy: number; adr: number; revenue: number; revenue_potential: number }> | undefined,
      };
    });

    // Build the RentalizerResponse
    const result: RentalizerResponse = {
      property: {
        address: data.fullAddress || request.address,
        address_lookup: data.fullAddress,
        zipcode: undefined, // BNB Calc doesn't return zipcode separately
        bedrooms: data.bedrooms ?? request.bedrooms ?? 2,
        bathrooms: data.bathrooms ?? request.bathrooms ?? 1,
        accommodates: data.accomodates ?? request.accommodates ?? 4,
        latitude,
        longitude,
        market_id: data.marketId,
        submarket_id: undefined,
      },
      estimates: {
        annual_revenue: Math.round(annualRevenue * REVENUE_BOOST_FACTOR),
        annual_revenue_low: Math.round(annualRevenueLow * REVENUE_BOOST_FACTOR),
        annual_revenue_high: Math.round(annualRevenueHigh * REVENUE_BOOST_FACTOR),
        average_daily_rate: Math.round(averageDailyRate * REVENUE_BOOST_FACTOR),
        occupancy_rate: occupancyRate, // Occupancy is a rate — NOT boosted
        currency: data.currency || 'USD',
        currency_symbol: '$',
      },
      monthly_forecast,
      comps,
      // BNB Calc doesn't provide historical valuation data
      historical: undefined,
    };

    // Cache the result
    apiCache.set(cacheKey, result, 'rentalizer');

    console.log(`[BnbCalc] Success: ${data.fullAddress} → $${result.estimates.annual_revenue}/yr (${comps.length} comps, ${monthly_forecast.length} months)`);
    return result;
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    logApiCall({
      provider: 'bnbcalc',
      endpoint: '/v1/external/analysis/create/cohost',
      statusCode: 500,
      success: false,
      responseTimeMs,
      cacheHit: false,
      source: 'bnbcalc_cohost',
    });
    console.error('[BnbCalc] Request failed:', error);
    return null;
  }
}

import { ENV } from "./_core/env";

const AIRDNA_API_BASE = "https://api.airdna.co/api/enterprise/v2";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface RentalizerRequest {
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  accommodates?: number;
  currency?: string;
}

interface MonthlyForecast {
  month: string;
  revenue: number;
  adr: number;
  occupancy: number;
}

interface Comp {
  title: string;
  bedrooms: number;
  bathrooms: number;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  distance_meters: number;
  airbnb_listing_id?: string;
  airbnb_url?: string;
  image_url?: string;
  property_type?: string;
}

export interface RentalizerResponse {
  property: {
    address: string;
    address_lookup: string;
    zipcode: string;
    bedrooms: number;
    bathrooms: number;
    accommodates: number;
    latitude: number;
    longitude: number;
  };
  estimates: {
    annual_revenue: number;
    annual_revenue_low: number;
    annual_revenue_high: number;
    average_daily_rate: number;
    occupancy_rate: number;
    currency: string;
    currency_symbol: string;
  };
  monthly_forecast: MonthlyForecast[];
  comps: Comp[];
}

export interface MarketSearchResult {
  id: string;
  name: string;
  type: "market" | "submarket";
  listing_count: number;
  location_name: string;
  state?: string;
  country?: string;
}

export interface MarketMetrics {
  occupancy: number;
  adr: number;
  revenue: number;
  revpar: number;
  active_listings: number;
  average_los?: number;
  booking_lead_time?: number;
}

export interface MarketData {
  market_id: string;
  market_name: string;
  metrics: MarketMetrics;
  historical_trends?: {
    occupancy: Array<{ date: string; value: number }>;
    adr: Array<{ date: string; value: number }>;
    revenue: Array<{ date: string; value: number }>;
  };
  bedroom_performance?: Array<{
    bedrooms: number;
    occupancy: number;
    adr: number;
    revenue: number;
    listing_count: number;
  }>;
}

// ============================================
// API RESPONSE INTERFACES
// ============================================

interface AirDNAApiResponse {
  payload?: {
    details?: {
      address: string;
      address_lookup: string;
      zipcode: string;
      accommodates: number;
      bedrooms: number;
      bathrooms: number;
    };
    location?: {
      lat: number;
      lng: number;
    };
    stats?: {
      currency: string;
      currency_symbol: string;
      property_value: number | null;
      future?: {
        summary?: {
          adr: number;
          occupancy: number;
          revenue: number;
          revenue_upper: number;
          revenue_lower: number;
        };
        metrics?: Array<{
          date: string;
          occupancy: number;
          adr: number;
          revenue: number;
          revenue_lower?: number;
          revenue_upper?: number;
        }>;
      };
      historical?: {
        summary?: {
          revenue_valuation?: {
            monthly_pct_change: number;
            yearly_pct_change: number;
          };
        };
        metrics?: Array<{
          date: string;
          revenue_valuation: number;
        }>;
      };
    };
    comps?: Array<{
      property_id: string;
      details: {
        title: string;
        accommodates: number;
        bedrooms: number;
        bathrooms: number;
        reviews: number;
        rating: number | null;
        images: string[];
        property_type: string;
        listing_type: string;
      };
      location: {
        lat: number;
        lng: number;
      };
      distance_meters: number;
      platforms: {
        airbnb_property_id: string | null;
        airbnb_property_url: string | null;
        vrbo_property_id: string | null;
        vrbo_property_url: string | null;
      };
      stats: {
        summary: {
          occupancy: number;
          days_available: number;
          days_reserved: number;
          adr: number;
          revenue: number;
          revenue_potential: number;
        };
        metrics: Array<{
          date: string;
          occupancy: number;
          adr: number;
          revenue: number;
          revenue_potential: number;
        }>;
      };
    }>;
  };
  status?: {
    type: string;
    response_id: string;
    message: string;
  };
  error?: {
    type: string;
    message: string;
  };
}

interface MarketSearchResponse {
  payload?: {
    page_info: {
      page_size: number;
      offset: number;
    };
    results: Array<{
      id: string;
      name: string;
      type: "market" | "submarket";
      listing_count: number;
      location_name: string;
      location: {
        state?: string;
        country?: string;
        country_code?: string;
      };
    }>;
  };
  status?: {
    type: string;
    response_id: string;
    message: string;
  };
  error?: {
    type: string;
    message: string;
  };
}

interface MarketMetricsResponse {
  payload?: {
    market_id?: string;
    metrics: Array<{
      date: string;
      // Different endpoints return different field names
      value?: number;
      occupancy_rate?: number;
      adr?: number;
      revenue?: number;
      revpar?: number;
      active_listings?: number;
      listing_count?: number;
    }>;
    summary?: {
      avg: number;
      min: number;
      max: number;
    };
    monthly_pct_change?: number;
    yearly_pct_change?: number;
  };
  status?: {
    type: string;
    response_id?: string;
    message: string;
  };
  error?: {
    type: string;
    message: string;
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function makeAirDNARequest<T>(
  endpoint: string,
  method: "GET" | "POST" = "POST",
  body?: object
): Promise<T> {
  const apiKey = ENV.airdnaApiKey;
  
  if (!apiKey) {
    throw new Error("AirDNA API key is not configured");
  }

  const url = `${AIRDNA_API_BASE}${endpoint}`;
  console.log(`[AirDNA] ${method} ${endpoint}`);

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  };

  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("[AirDNA] API error:", response.status, errorData);
    
    if (response.status === 401) {
      throw new Error("Invalid AirDNA API credentials");
    }
    if (response.status === 403) {
      throw new Error("AirDNA API access denied - check your subscription");
    }
    if (response.status === 400) {
      throw new Error(errorData?.error?.message || "Invalid request to AirDNA API");
    }
    
    throw new Error(`AirDNA API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// RENTALIZER (PROPERTY VALUATION)
// ============================================

export async function getRentalizerEstimate(
  request: RentalizerRequest
): Promise<RentalizerResponse> {
  console.log("[AirDNA] Making rentalizer request for address:", request.address);

  const data = await makeAirDNARequest<AirDNAApiResponse>("/rentalizer/estimate", "POST", {
    address: request.address,
    bedrooms: request.bedrooms ?? null,
    bathrooms: request.bathrooms ?? null,
    accommodates: request.accommodates ?? null,
    currency: request.currency ?? "usd",
  });
  
  console.log("[AirDNA] Response status:", data.status?.type);
  
  if (data.status?.type !== "success" || !data.payload) {
    throw new Error(data.status?.message || "Failed to get rental estimate");
  }

  const { details, location, stats, comps } = data.payload;
  
  if (!details || !stats) {
    throw new Error("Incomplete data received from AirDNA API");
  }

  // Extract future estimates from the correct structure
  const futureStats = stats.future;
  const futureSummary = futureStats?.summary;
  
  const annualRevenue = futureSummary?.revenue ?? 0;
  const adr = futureSummary?.adr ?? 0;
  const occupancy = futureSummary?.occupancy ?? 0;
  
  // Revenue range from the API response
  const revenueLow = futureSummary?.revenue_lower ?? Math.round(annualRevenue * 0.85);
  const revenueHigh = futureSummary?.revenue_upper ?? Math.round(annualRevenue * 1.15);

  // Get monthly forecast from future metrics
  const futureMetrics = futureStats?.metrics ?? [];
  
  const monthlyForecast: MonthlyForecast[] = futureMetrics.slice(0, 12).map((m) => ({
    month: m.date,
    revenue: Math.round(m.revenue),
    adr: Math.round(m.adr),
    occupancy: m.occupancy,
  }));

  // Transform comps data - filter to Airbnb only and sort by revenue
  const transformedComps: Comp[] = (comps ?? [])
    .filter(comp => comp.platforms?.airbnb_property_id) // Airbnb only
    .sort((a, b) => (b.stats?.summary?.revenue ?? 0) - (a.stats?.summary?.revenue ?? 0))
    .slice(0, 10)
    .map((comp) => ({
      title: comp.details?.title || "Comparable Property",
      bedrooms: comp.details?.bedrooms ?? 0,
      bathrooms: comp.details?.bathrooms ?? 0,
      rating: comp.details?.rating ?? null,
      reviews: comp.details?.reviews ?? 0,
      annual_revenue: Math.round(comp.stats?.summary?.revenue ?? 0),
      adr: Math.round(comp.stats?.summary?.adr ?? 0),
      occupancy: comp.stats?.summary?.occupancy ?? 0,
      distance_meters: Math.round(comp.distance_meters ?? 0),
      airbnb_listing_id: comp.platforms?.airbnb_property_id ?? undefined,
      airbnb_url: comp.platforms?.airbnb_property_url ?? undefined,
      image_url: comp.details?.images?.[0] ?? undefined,
      property_type: comp.details?.property_type ?? undefined,
    }));

  console.log("[AirDNA] Parsed data - Revenue:", annualRevenue, "ADR:", adr, "Occupancy:", occupancy);
  console.log("[AirDNA] Monthly forecast count:", monthlyForecast.length);
  console.log("[AirDNA] Comps count:", transformedComps.length);

  return {
    property: {
      address: details.address,
      address_lookup: details.address_lookup,
      zipcode: details.zipcode,
      bedrooms: details.bedrooms ?? request.bedrooms ?? 2,
      bathrooms: details.bathrooms ?? request.bathrooms ?? 1,
      accommodates: details.accommodates ?? request.accommodates ?? 4,
      latitude: location?.lat ?? 0,
      longitude: location?.lng ?? 0,
    },
    estimates: {
      annual_revenue: Math.round(annualRevenue),
      annual_revenue_low: Math.round(revenueLow),
      annual_revenue_high: Math.round(revenueHigh),
      average_daily_rate: Math.round(adr),
      occupancy_rate: occupancy,
      currency: stats.currency,
      currency_symbol: stats.currency_symbol,
    },
    monthly_forecast: monthlyForecast,
    comps: transformedComps,
  };
}

// ============================================
// MARKET SEARCH
// ============================================

export async function searchMarket(
  searchTerm?: string,
  lat?: number,
  lng?: number
): Promise<MarketSearchResult[]> {
  const body: Record<string, unknown> = {
    pagination: {
      page_size: 5,
      offset: 0,
    },
  };

  if (searchTerm) {
    body.search_term = searchTerm;
  } else if (lat !== undefined && lng !== undefined) {
    body.lat = lat;
    body.lng = lng;
  } else {
    throw new Error("Either search_term or coordinates (lat/lng) required");
  }

  const data = await makeAirDNARequest<MarketSearchResponse>("/market/search", "POST", body);

  if (data.status?.type !== "success" || !data.payload?.results) {
    throw new Error(data.status?.message || "Failed to search markets");
  }

  return data.payload.results.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    listing_count: r.listing_count,
    location_name: r.location_name,
    state: r.location?.state,
    country: r.location?.country,
  }));
}

// ============================================
// MARKET METRICS
// ============================================

export async function getMarketOccupancy(
  marketId: string,
  bedrooms?: number
): Promise<{ metrics: Array<{ date: string; value: number }>; average: number }> {
  const body: Record<string, unknown> = {
    num_months: 12,
  };
  
  if (bedrooms !== undefined) {
    body.filters = [
      { type: "select", field: "bedrooms", value: bedrooms }
    ];
  }

  const data = await makeAirDNARequest<MarketMetricsResponse>(
    `/market/${marketId}/metrics/occupancy`,
    "POST",
    body
  );

  if (data.status?.type !== "success" || !data.payload) {
    throw new Error(data.status?.message || "Failed to fetch occupancy metrics");
  }

  // Map occupancy_rate field to value
  const metrics = (data.payload.metrics || []).map(m => ({
    date: m.date,
    value: m.occupancy_rate ?? m.value ?? 0
  }));
  
  const average = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length 
    : 0;

  return { metrics, average };
}

export async function getMarketRevenue(
  marketId: string,
  bedrooms?: number
): Promise<{ metrics: Array<{ date: string; value: number }>; average: number }> {
  const body: Record<string, unknown> = {
    num_months: 12,
  };
  
  if (bedrooms !== undefined) {
    body.filters = [
      { type: "select", field: "bedrooms", value: bedrooms }
    ];
  }

  // Use avg_revenue endpoint (not revenue)
  const data = await makeAirDNARequest<MarketMetricsResponse>(
    `/market/${marketId}/metrics/avg_revenue`,
    "POST",
    body
  );

  if (data.status?.type !== "success" || !data.payload) {
    throw new Error(data.status?.message || "Failed to fetch revenue metrics");
  }

  // The avg_revenue endpoint returns 'adr' field (confusingly named)
  const metrics = (data.payload.metrics || []).map(m => ({
    date: m.date,
    value: m.adr ?? m.revenue ?? m.value ?? 0
  }));
  
  const average = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length 
    : 0;

  return { metrics, average };
}

export async function getMarketADR(
  marketId: string,
  bedrooms?: number
): Promise<{ metrics: Array<{ date: string; value: number }>; average: number }> {
  const body: Record<string, unknown> = {
    num_months: 12,
  };
  
  if (bedrooms !== undefined) {
    body.filters = [
      { type: "select", field: "bedrooms", value: bedrooms }
    ];
  }

  const data = await makeAirDNARequest<MarketMetricsResponse>(
    `/market/${marketId}/metrics/adr`,
    "POST",
    body
  );

  if (data.status?.type !== "success" || !data.payload) {
    throw new Error(data.status?.message || "Failed to fetch ADR metrics");
  }

  // Map adr field to value
  const metrics = (data.payload.metrics || []).map(m => ({
    date: m.date,
    value: m.adr ?? m.value ?? 0
  }));
  
  const average = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length 
    : 0;

  return { metrics, average };
}

export async function getMarketRevPAR(
  marketId: string,
  bedrooms?: number
): Promise<{ metrics: Array<{ date: string; value: number }>; average: number }> {
  const body: Record<string, unknown> = {
    num_months: 12,
  };
  
  if (bedrooms !== undefined) {
    body.filters = [
      { type: "select", field: "bedrooms", value: bedrooms }
    ];
  }

  const data = await makeAirDNARequest<MarketMetricsResponse>(
    `/market/${marketId}/metrics/revpar`,
    "POST",
    body
  );

  if (data.status?.type !== "success" || !data.payload) {
    throw new Error(data.status?.message || "Failed to fetch RevPAR metrics");
  }

  // Map revpar field to value
  const metrics = (data.payload.metrics || []).map(m => ({
    date: m.date,
    value: m.revpar ?? m.value ?? 0
  }));
  
  const average = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length 
    : 0;

  return { metrics, average };
}

// Response type for market search (for listing count)
interface MarketListingCountResponse {
  payload?: {
    results?: Array<{
      id: string;
      name: string;
      listing_count?: number;
    }>;
  };
  status?: {
    type: string;
    message: string;
  };
}

export async function getMarketActiveListings(
  marketId: string,
  _bedrooms?: number // Not used for this endpoint
): Promise<{ metrics: Array<{ date: string; value: number }>; current: number }> {
  // Extract market name from marketId (e.g., "airdna-166" -> search for that market)
  // Use market search to get listing_count which is the most reliable source
  try {
    // First get the market name from GET /market/{marketId}
    const marketDetails = await makeAirDNARequest<{
      payload?: { name?: string };
      status?: { type: string };
    }>(`/market/${marketId}`, "GET");
    
    const marketName = marketDetails.payload?.name || "";
    
    if (marketName) {
      // Search for the market to get listing_count
      const searchData = await makeAirDNARequest<MarketListingCountResponse>(
        `/market/search`,
        "POST",
        {
          search_term: marketName,
          pagination: { page_size: 1, offset: 0 }
        }
      );
      
      if (searchData.status?.type === "success" && searchData.payload?.results?.[0]) {
        const listingCount = searchData.payload.results[0].listing_count || 0;
        return {
          metrics: [{ date: new Date().toISOString().slice(0, 7), value: listingCount }],
          current: listingCount
        };
      }
    }
  } catch (error) {
    console.log("[AirDNA] Failed to get listing count via search, falling back to 0", error);
  }
  
  return { metrics: [], current: 0 };
}

// ============================================
// COMPREHENSIVE MARKET DATA
// ============================================

export async function getComprehensiveMarketData(
  marketId: string,
  bedrooms?: number
): Promise<MarketData> {
  console.log(`[AirDNA] Fetching comprehensive market data for ${marketId}`);

  // Fetch all metrics in parallel
  const [occupancy, revenue, adr, revpar, listings] = await Promise.all([
    getMarketOccupancy(marketId, bedrooms).catch(() => ({ metrics: [], average: 0 })),
    getMarketRevenue(marketId, bedrooms).catch(() => ({ metrics: [], average: 0 })),
    getMarketADR(marketId, bedrooms).catch(() => ({ metrics: [], average: 0 })),
    getMarketRevPAR(marketId, bedrooms).catch(() => ({ metrics: [], average: 0 })),
    getMarketActiveListings(marketId, bedrooms).catch(() => ({ metrics: [], current: 0 })),
  ]);

  return {
    market_id: marketId,
    market_name: "", // Will be filled by caller if needed
    metrics: {
      occupancy: occupancy.average,
      adr: adr.average,
      revenue: revenue.average,
      revpar: revpar.average,
      active_listings: listings.current,
    },
    historical_trends: {
      occupancy: occupancy.metrics,
      adr: adr.metrics,
      revenue: revenue.metrics,
    },
  };
}

// ============================================
// BEDROOM PERFORMANCE ANALYSIS
// ============================================

export async function getBedroomPerformance(
  marketId: string
): Promise<Array<{ bedrooms: number; occupancy: number; adr: number; revenue: number }>> {
  const bedroomCounts = [1, 2, 3, 4, 5];
  
  const results = await Promise.all(
    bedroomCounts.map(async (bedrooms) => {
      try {
        const [occupancy, adr, revenue] = await Promise.all([
          getMarketOccupancy(marketId, bedrooms),
          getMarketADR(marketId, bedrooms),
          getMarketRevenue(marketId, bedrooms),
        ]);

        return {
          bedrooms,
          occupancy: occupancy.average,
          adr: adr.average,
          revenue: revenue.average,
        };
      } catch {
        return {
          bedrooms,
          occupancy: 0,
          adr: 0,
          revenue: 0,
        };
      }
    })
  );

  return results.filter((r) => r.occupancy > 0 || r.adr > 0 || r.revenue > 0);
}

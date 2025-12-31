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
  last_review_date?: string;
  amenities?: string[];
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
    market_id?: string;
    submarket_id?: string;
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
  parent_market?: {
    id: string;
    name: string;
  };
  zipcodes?: string[];
}

export interface MarketMetrics {
  occupancy: number;
  adr: number;
  revenue: number;
  revpar: number;
  active_listings: number;
  market_score?: number;
  average_los?: number;
  booking_lead_time?: number;
}

export interface HistoricalDataPoint {
  date: string;
  value: number;
}

export interface MarketData {
  market_id: string;
  market_name: string;
  metrics: MarketMetrics;
  listing_count?: number;
  historical?: {
    occupancy: HistoricalDataPoint[];
    adr: HistoricalDataPoint[];
    revenue: HistoricalDataPoint[];
    revpar: HistoricalDataPoint[];
    active_listings: HistoricalDataPoint[];
  };
  bedroom_performance?: Array<{
    bedrooms: number;
    occupancy: number;
    adr: number;
    revenue: number;
    listing_count: number;
  }>;
}

export interface SubmarketData {
  id: string;
  name: string;
  listing_count: number;
  metrics?: {
    occupancy: number;
    adr: number;
    revenue: number;
    revpar: number;
    market_score?: number;
  };
  zipcodes?: string[];
}

export interface ListingData {
  id: string;
  title: string;
  airbnb_url?: string;
  image_url?: string;
  images?: string[]; // Array of all listing images for gallery
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  property_type: string;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  last_review_date?: string;
  amenities?: string[];
  superhost?: boolean;
  professionally_managed?: boolean;
  host_size?: string;
  latitude?: number;
  longitude?: number;
  zipcode?: string;
  days_available?: number;
  days_reserved?: number;
  distance_meters?: number;
}

export interface MarketInsights {
  total_listings: number;
  professionally_managed_count: number;
  professionally_managed_pct: number;
  superhost_count: number;
  superhost_pct: number;
  avg_rating: number;
  avg_reviews: number;
  avg_days_available: number;
  avg_days_reserved: number;
  property_type_breakdown: Array<{
    type: string;
    count: number;
    pct: number;
    avg_revenue: number;
  }>;
  host_size_breakdown: Array<{
    size: string;
    count: number;
    pct: number;
    avg_revenue: number;
  }>;
  revenue_percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
}

export interface ComprehensiveMarketReport {
  market: {
    id: string;
    name: string;
    listing_count: number;
    location_name: string;
    market_type?: string;
    metrics: MarketMetrics;
    historical?: {
      occupancy: HistoricalDataPoint[];
      adr: HistoricalDataPoint[];
      revenue: HistoricalDataPoint[];
      revpar: HistoricalDataPoint[];
      active_listings: HistoricalDataPoint[];
    };
  };
  submarkets: SubmarketData[];
  top_listings: ListingData[];
  bedroom_performance: Array<{
    bedrooms: number;
    count: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
  }>;
  insights?: MarketInsights;
  generated_at: string;
}

// ============================================
// API HELPER FUNCTIONS
// ============================================

async function makeApiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" = "POST",
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${AIRDNA_API_BASE}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${ENV.airdnaApiKey}`,
      "Content-Type": "application/json",
    },
  };
  
  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AirDNA API error (${response.status}): ${errorText}`);
  }
  
  return response.json();
}

// ============================================
// MARKET SEARCH
// ============================================

export async function searchMarkets(searchTerm: string, limit: number = 10): Promise<MarketSearchResult[]> {
  try {
    const response = await makeApiRequest<{
      payload: {
        results: Array<{
          id: string;
          name: string;
          type: "market" | "submarket";
          listing_count: number;
          location_name: string;
          location?: {
            state?: string;
            country?: string;
          };
          parent_market?: {
            id: string;
            name: string;
          };
          legacy_location?: {
            zipcodes?: string[];
          };
        }>;
      };
    }>("/market/search", "POST", {
      search_term: searchTerm,
      pagination: {
        page_size: Math.min(limit, 25), // API max is 25
        offset: 0,
      },
    });
    
    return response.payload.results.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      listing_count: r.listing_count,
      location_name: r.location_name,
      state: r.location?.state,
      country: r.location?.country,
      parent_market: r.parent_market,
      zipcodes: r.legacy_location?.zipcodes,
    }));
  } catch (error) {
    console.error("Error searching markets:", error);
    return [];
  }
}

// Detect search type from input
export function detectSearchType(input: string): "address" | "city" | "zipcode" | "market" {
  const trimmed = input.trim();
  
  // Check for zip code (5 digits)
  if (/^\d{5}$/.test(trimmed)) {
    return "zipcode";
  }
  
  // Check for address (contains street number or common street suffixes)
  if (/^\d+\s/.test(trimmed) || /\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|way|pl|place)\b/i.test(trimmed)) {
    return "address";
  }
  
  // Check for city, state format
  if (/,\s*[A-Z]{2}\s*$/i.test(trimmed) || /,\s*[A-Za-z]+\s*$/i.test(trimmed)) {
    return "city";
  }
  
  // Default to market search
  return "market";
}

// ============================================
// MARKET DETAILS
// ============================================

export async function getMarketDetails(marketId: string): Promise<{
  id: string;
  name: string;
  listing_count: number;
  location_name: string;
  market_type?: string;
  metrics?: {
    market_score: number;
    revenue: number;
    booked: number;
    daily_rate: number;
    revpar: number;
  };
} | null> {
  try {
    const response = await makeApiRequest<{
      payload: {
        id: string;
        name: string;
        listing_count?: number;
        location_name?: string;
        market_type?: string;
        metrics?: {
          market_score: number;
          revenue: number;
          booked: number;
          daily_rate: number;
          revpar: number;
        };
      };
    }>(`/market/${marketId}`, "GET");
    
    return {
      id: response.payload.id,
      name: response.payload.name,
      listing_count: response.payload.listing_count || 0,
      location_name: response.payload.location_name || response.payload.name,
      market_type: response.payload.market_type,
      metrics: response.payload.metrics,
    };
  } catch (error) {
    console.error("Error fetching market details:", error);
    return null;
  }
}

// ============================================
// SUBMARKET DETAILS
// ============================================

export async function getSubmarketDetails(submarketId: string): Promise<{
  id: string;
  name: string;
  listing_count?: number;
  parent_market_name?: string;
  market_id?: string;
  market_type?: string;
  metrics?: {
    market_score: number;
    revenue: number;
    booked: number;
    daily_rate: number;
    revpar: number;
  };
} | null> {
  try {
    const response = await makeApiRequest<{
      payload: {
        id: string;
        name: string;
        listing_count?: number;
        parent_market_name?: string;
        market_id?: string;
        market_type?: string;
        metrics?: {
          market_score: number;
          revenue: number;
          booked: number;
          daily_rate: number;
          revpar: number;
        };
      };
    }>(`/submarket/${submarketId}`, "GET");
    
    return {
      id: response.payload.id,
      name: response.payload.name,
      listing_count: response.payload.listing_count,
      parent_market_name: response.payload.parent_market_name,
      market_id: response.payload.market_id,
      market_type: response.payload.market_type,
      metrics: response.payload.metrics,
    };
  } catch (error) {
    console.error("Error fetching submarket details:", error);
    return null;
  }
}

// ============================================
// MARKET METRICS (Historical Data)
// ============================================

async function getMarketMetric(
  marketId: string,
  metricType: "occupancy" | "avg_revenue" | "adr" | "revpar" | "active_listings_count" | "booking_lead_time" | "los",
  numMonths: number = 12
): Promise<HistoricalDataPoint[]> {
  try {
    const response = await makeApiRequest<{
      payload: {
        results?: Array<{
          month?: string;
          date?: string;
          value?: number;
          occupancy?: number;
          occupancy_rate?: number;
          avg_revenue?: number;
          adr?: number;
          revpar?: number;
          active_listings_count?: number;
          active_listings?: number;
          booking_lead_time?: number;
          los?: number;
        }>;
      };
    }>(`/market/${marketId}/metrics/${metricType}`, "POST", {
      num_months: numMonths,
    });
    
    const results = response.payload.results || [];
    
    return results.map((r) => {
      const date = r.month || r.date || "";
      let value = r.value;
      
      // Handle different response field names
      if (value === undefined) {
        switch (metricType) {
          case "occupancy": value = r.occupancy_rate || r.occupancy; break;
          case "avg_revenue": value = r.avg_revenue; break;
          case "adr": value = r.adr; break;
          case "revpar": value = r.revpar; break;
          case "active_listings_count": value = r.active_listings || r.active_listings_count; break;
          case "booking_lead_time": value = r.booking_lead_time; break;
          case "los": value = r.los; break;
        }
      }
      
      return { date, value: value || 0 };
    });
  } catch (error) {
    console.error(`Error fetching ${metricType} for market ${marketId}:`, error);
    return [];
  }
}

export async function getMarketHistoricalData(marketId: string, numMonths: number = 12): Promise<{
  occupancy: HistoricalDataPoint[];
  adr: HistoricalDataPoint[];
  revenue: HistoricalDataPoint[];
  revpar: HistoricalDataPoint[];
  active_listings: HistoricalDataPoint[];
}> {
  const [occupancy, adr, revenue, revpar, active_listings] = await Promise.all([
    getMarketMetric(marketId, "occupancy", numMonths),
    getMarketMetric(marketId, "adr", numMonths),
    getMarketMetric(marketId, "avg_revenue", numMonths),
    getMarketMetric(marketId, "revpar", numMonths),
    getMarketMetric(marketId, "active_listings_count", numMonths),
  ]);
  
  return { occupancy, adr, revenue, revpar, active_listings };
}

// ============================================
// SUBMARKET DATA
// ============================================

export async function getSubmarketsInMarket(marketId: string): Promise<SubmarketData[]> {
  try {
    // First, get the market name to search for its submarkets
    const marketDetails = await getMarketDetails(marketId);
    if (!marketDetails) {
      return [];
    }
    
    // Search for markets with the same name - this returns both the market and its submarkets
    const searchResults = await searchMarkets(marketDetails.name, 50);
    
    // Filter to only submarkets (neighborhoods) that are related to this market
    // Submarkets typically have the parent market name in their location_name or are of type 'submarket'
    const submarkets = searchResults.filter(m => 
      m.type === 'submarket' && 
      m.id !== marketId &&
      m.listing_count > 0
    );
    
    // Sort by listing count descending (most active first)
    submarkets.sort((a, b) => b.listing_count - a.listing_count);
    
    return submarkets.slice(0, 20).map(s => ({
      id: s.id,
      name: s.name,
      listing_count: s.listing_count,
    }));
  } catch (error) {
    console.error("Error fetching submarkets:", error);
    return [];
  }
}

export async function getSubmarketMetrics(submarketId: string): Promise<{
  occupancy: number;
  adr: number;
  revenue: number;
  revpar: number;
} | null> {
  try {
    const [occupancyData, adrData, revenueData, revparData] = await Promise.all([
      getMarketMetric(submarketId.replace("airdna-", "submarket-"), "occupancy", 1),
      getMarketMetric(submarketId.replace("airdna-", "submarket-"), "adr", 1),
      getMarketMetric(submarketId.replace("airdna-", "submarket-"), "avg_revenue", 1),
      getMarketMetric(submarketId.replace("airdna-", "submarket-"), "revpar", 1),
    ]);
    
    return {
      occupancy: occupancyData[0]?.value || 0,
      adr: adrData[0]?.value || 0,
      revenue: revenueData[0]?.value || 0,
      revpar: revparData[0]?.value || 0,
    };
  } catch (error) {
    console.error("Error fetching submarket metrics:", error);
    return null;
  }
}

// ============================================
// MARKET LISTINGS
// ============================================

export async function getMarketListings(
  marketId: string,
  options?: {
    limit?: number;
    offset?: number;
    orderBy?: "revenue" | "adr" | "occupancy" | "rating";
    orderDirection?: "asc" | "desc";
  }
): Promise<{ listings: ListingData[]; total_count: number }> {
  try {
    const response = await makeApiRequest<{
      payload: {
        listings: Array<{
          property_id: string;
          title: string;
          airbnb_property_id?: string;
          airbnb_property_url?: string;
          bedrooms: number;
          bathrooms: number;
          accommodates: number;
          property_type: string;
          rating: number | null;
          reviews: number;
          revenue_ltm: number;
          average_daily_rate_ltm: number;
          occupancy_rate_ltm: number;
          days_available_ltm?: number;
          days_reserved_ltm?: number;
          last_scraped_date?: string;
          superhost?: boolean;
          professionally_managed?: boolean;
          host_size?: string;
          location?: { lat?: number; lng?: number };
          zipcode?: string;
          images?: string[];
        }>;
        page_info: {
          total_count: number;
          page_size: number;
          offset: number;
        };
      };
    }>(`/market/${marketId}/listings`, "POST", {
      pagination: {
        page_size: Math.min(options?.limit || 25, 25),
        offset: options?.offset || 0,
      },
      order_by: {
        field: options?.orderBy || "revenue",
        method: options?.orderDirection || "desc",
      },
    });
    
    const listings: ListingData[] = response.payload.listings.map((r) => ({
      id: r.property_id || '',
      title: r.title || 'Untitled Listing',
      airbnb_url: r.airbnb_property_url || (r.airbnb_property_id ? `https://www.airbnb.com/rooms/${r.airbnb_property_id}` : ''),
      image_url: r.images?.[0] || '',
      bedrooms: r.bedrooms || 0,
      bathrooms: r.bathrooms || 0,
      accommodates: r.accommodates || 0,
      property_type: r.property_type || 'Unknown',
      rating: r.rating ?? null,
      reviews: r.reviews || 0,
      annual_revenue: r.revenue_ltm || 0,
      adr: r.average_daily_rate_ltm || 0,
      occupancy: r.occupancy_rate_ltm || 0,
      last_review_date: r.last_scraped_date || '',
      superhost: r.superhost ?? false,
      professionally_managed: r.professionally_managed ?? false,
      host_size: r.host_size || 'unknown',
      latitude: r.location?.lat ?? 0,
      longitude: r.location?.lng ?? 0,
      zipcode: r.zipcode || '',
      days_available: r.days_available_ltm || 0,
      days_reserved: r.days_reserved_ltm || 0,
    }));
    
    return {
      listings,
      total_count: response.payload.page_info.total_count,
    };
  } catch (error) {
    console.error("Error fetching market listings:", error);
    return { listings: [], total_count: 0 };
  }
}

// ============================================
// SUBMARKET LISTINGS
// ============================================

export async function getSubmarketListings(
  submarketId: string,
  options?: {
    limit?: number;
    offset?: number;
    orderBy?: "revenue" | "adr" | "occupancy" | "rating";
    orderDirection?: "asc" | "desc";
  }
): Promise<{ listings: ListingData[]; total_count: number }> {
  try {
    const response = await makeApiRequest<{
      payload: {
        listings: Array<{
          property_id: string;
          title: string;
          airbnb_property_id?: string;
          airbnb_property_url?: string;
          bedrooms: number;
          bathrooms: number;
          accommodates: number;
          property_type: string;
          rating: number | null;
          reviews: number;
          revenue_ltm: number;
          average_daily_rate_ltm: number;
          occupancy_rate_ltm: number;
          days_available_ltm?: number;
          days_reserved_ltm?: number;
          last_scraped_date?: string;
          superhost?: boolean;
          professionally_managed?: boolean;
          host_size?: string;
          location?: { lat?: number; lng?: number };
          zipcode?: string;
          images?: string[];
        }>;
        page_info: {
          total_count: number;
          page_size: number;
          offset: number;
        };
      };
    }>(`/submarket/${submarketId}/listings`, "POST", {
      pagination: {
        page_size: Math.min(options?.limit || 25, 25),
        offset: options?.offset || 0,
      },
      order_by: {
        field: options?.orderBy || "revenue",
        method: options?.orderDirection || "desc",
      },
    });
    
    const listings: ListingData[] = response.payload.listings.map((r) => ({
      id: r.property_id || '',
      title: r.title || 'Untitled Listing',
      airbnb_url: r.airbnb_property_url || (r.airbnb_property_id ? `https://www.airbnb.com/rooms/${r.airbnb_property_id}` : ''),
      image_url: r.images?.[0] || '',
      bedrooms: r.bedrooms || 0,
      bathrooms: r.bathrooms || 0,
      accommodates: r.accommodates || 0,
      property_type: r.property_type || 'Unknown',
      rating: r.rating ?? null,
      reviews: r.reviews || 0,
      annual_revenue: r.revenue_ltm || 0,
      adr: r.average_daily_rate_ltm || 0,
      occupancy: r.occupancy_rate_ltm || 0,
      last_review_date: r.last_scraped_date || '',
      superhost: r.superhost ?? false,
      professionally_managed: r.professionally_managed ?? false,
      host_size: r.host_size || 'unknown',
      latitude: r.location?.lat ?? 0,
      longitude: r.location?.lng ?? 0,
      zipcode: r.zipcode || '',
      days_available: r.days_available_ltm || 0,
      days_reserved: r.days_reserved_ltm || 0,
    }));
    
    return {
      listings,
      total_count: response.payload.page_info.total_count,
    };
  } catch (error) {
    console.error("Error fetching submarket listings:", error);
    return { listings: [], total_count: 0 };
  }
}

// ============================================
// CALCULATE MARKET INSIGHTS FROM LISTINGS
// ============================================

export function calculateMarketInsights(listings: ListingData[]): MarketInsights {
  if (listings.length === 0) {
    return {
      total_listings: 0,
      professionally_managed_count: 0,
      professionally_managed_pct: 0,
      superhost_count: 0,
      superhost_pct: 0,
      avg_rating: 0,
      avg_reviews: 0,
      avg_days_available: 0,
      avg_days_reserved: 0,
      property_type_breakdown: [],
      host_size_breakdown: [],
      revenue_percentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 },
    };
  }
  
  const total = listings.length;
  
  // Count professionally managed and superhosts
  const professionallyManaged = listings.filter(l => l.professionally_managed).length;
  const superhosts = listings.filter(l => l.superhost).length;
  
  // Calculate averages
  const avgRating = listings.filter(l => l.rating !== null).reduce((sum, l) => sum + (l.rating || 0), 0) / 
    (listings.filter(l => l.rating !== null).length || 1);
  const avgReviews = listings.reduce((sum, l) => sum + l.reviews, 0) / total;
  const avgDaysAvailable = listings.reduce((sum, l) => sum + (l.days_available || 0), 0) / total;
  const avgDaysReserved = listings.reduce((sum, l) => sum + (l.days_reserved || 0), 0) / total;
  
  // Property type breakdown
  const propertyTypes = new Map<string, { count: number; totalRevenue: number }>();
  listings.forEach(l => {
    const type = l.property_type || 'Unknown';
    const existing = propertyTypes.get(type) || { count: 0, totalRevenue: 0 };
    propertyTypes.set(type, {
      count: existing.count + 1,
      totalRevenue: existing.totalRevenue + l.annual_revenue,
    });
  });
  
  const propertyTypeBreakdown = Array.from(propertyTypes.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      pct: Math.round((data.count / total) * 100),
      avg_revenue: Math.round(data.totalRevenue / data.count),
    }))
    .sort((a, b) => b.count - a.count);
  
  // Host size breakdown
  const hostSizes = new Map<string, { count: number; totalRevenue: number }>();
  listings.forEach(l => {
    const size = l.host_size || 'unknown';
    const existing = hostSizes.get(size) || { count: 0, totalRevenue: 0 };
    hostSizes.set(size, {
      count: existing.count + 1,
      totalRevenue: existing.totalRevenue + l.annual_revenue,
    });
  });
  
  const hostSizeBreakdown = Array.from(hostSizes.entries())
    .map(([size, data]) => ({
      size,
      count: data.count,
      pct: Math.round((data.count / total) * 100),
      avg_revenue: Math.round(data.totalRevenue / data.count),
    }))
    .sort((a, b) => b.count - a.count);
  
  // Revenue percentiles
  const revenues = listings.map(l => l.annual_revenue).sort((a, b) => a - b);
  const getPercentile = (arr: number[], p: number) => {
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)] || 0;
  };
  
  return {
    total_listings: total,
    professionally_managed_count: professionallyManaged,
    professionally_managed_pct: Math.round((professionallyManaged / total) * 100),
    superhost_count: superhosts,
    superhost_pct: Math.round((superhosts / total) * 100),
    avg_rating: Math.round(avgRating * 10) / 10,
    avg_reviews: Math.round(avgReviews),
    avg_days_available: Math.round(avgDaysAvailable),
    avg_days_reserved: Math.round(avgDaysReserved),
    property_type_breakdown: propertyTypeBreakdown,
    host_size_breakdown: hostSizeBreakdown,
    revenue_percentiles: {
      p10: Math.round(getPercentile(revenues, 10)),
      p25: Math.round(getPercentile(revenues, 25)),
      p50: Math.round(getPercentile(revenues, 50)),
      p75: Math.round(getPercentile(revenues, 75)),
      p90: Math.round(getPercentile(revenues, 90)),
    },
  };
}

// ============================================
// LISTING DATA (Radius-based)
// ============================================

// Note: The /listing/explore/market endpoint returns 404, so we use a workaround
// by getting market details and using comps/area with a central location
export async function exploreListingsInMarket(
  marketId: string,
  filters?: {
    bedrooms?: number;
    minRevenue?: number;
    listingType?: string;
  },
  limit: number = 50
): Promise<ListingData[]> {
  try {
    // The explore/market endpoint doesn't work, so we'll return empty
    // The bedroom performance data will be calculated from comps instead
    console.log(`[exploreListingsInMarket] Market listing exploration not available for ${marketId}`);
    return [];
  } catch (error) {
    console.error("Error exploring listings:", error);
    return [];
  }
}

export async function exploreListingsInRadius(
  address: string,
  radiusMeters: number = 3000,
  filters?: {
    bedrooms?: number;
    bathrooms?: number;
    minRevenue?: number;
  },
  limit: number = 50
): Promise<ListingData[]> {
  try {
    const filterArray: Array<{ type: string; field: string; value: unknown }> = [];
    
    if (filters?.bedrooms !== undefined) {
      filterArray.push({
        type: "select",
        field: "bedrooms",
        value: filters.bedrooms,
      });
    }
    
    if (filters?.bathrooms !== undefined) {
      filterArray.push({
        type: "select",
        field: "bathrooms",
        value: filters.bathrooms,
      });
    }
    
    const response = await makeApiRequest<{
      payload: {
        listings?: Array<{
          property_id: string;
          title: string;
          airbnb_property_id?: string;
          airbnb_property_url?: string;
          bedrooms: number;
          bathrooms: number;
          accommodates: number;
          property_type: string;
          rating: number | null;
          reviews: number;
          revenue_ltm?: number;
          average_daily_rate_ltm?: number;
          occupancy_rate_ltm?: number;
          last_scraped_date?: string;
          superhost?: boolean;
          professionally_managed?: boolean;
          host_size?: string;
          location?: { lat?: number; lng?: number };
          zipcode?: string;
          market_name?: string;
          images?: string[];
        }>;
      };
    }>("/listing/comps/area", "POST", {
      address,
      radius: radiusMeters,
      filters: filterArray.length > 0 ? filterArray : undefined,
      pagination: {
        page_size: Math.min(limit, 25), // API max is 25
        offset: 0,
      },
      sort_order: "revenue",
      sort_direction: "descending",
    });
    
    let listings: ListingData[] = (response.payload.listings || []).map((r) => ({
      id: r.property_id || '',
      title: r.title || 'Untitled Listing',
      airbnb_url: r.airbnb_property_url || (r.airbnb_property_id ? `https://www.airbnb.com/rooms/${r.airbnb_property_id}` : ''),
      image_url: r.images?.[0] || '',
      bedrooms: r.bedrooms || 0,
      bathrooms: r.bathrooms || 0,
      accommodates: r.accommodates || 0,
      property_type: r.property_type || 'Unknown',
      rating: r.rating ?? null,
      reviews: r.reviews || 0,
      annual_revenue: r.revenue_ltm || 0,
      adr: r.average_daily_rate_ltm || 0,
      occupancy: r.occupancy_rate_ltm || 0,
      last_review_date: r.last_scraped_date || '',
      superhost: r.superhost ?? false,
      professionally_managed: r.professionally_managed ?? false,
      host_size: r.host_size || 'unknown',
      latitude: r.location?.lat ?? 0,
      longitude: r.location?.lng ?? 0,
      zipcode: r.zipcode || '',
    }));
    
    // Filter by minimum revenue if specified
    if (filters?.minRevenue) {
      listings = listings.filter((l: ListingData) => l.annual_revenue >= filters.minRevenue!);
    }
    
    // Sort by revenue (highest first)
    listings.sort((a: ListingData, b: ListingData) => b.annual_revenue - a.annual_revenue);
    
    return listings;
  } catch (error) {
    console.error("Error exploring listings in radius:", error);
    return [];
  }
}

// ============================================
// RENTALIZER (Property Estimate)
// ============================================

export async function getRentalizerEstimate(
  request: RentalizerRequest
): Promise<RentalizerResponse | null> {
  try {
    const response = await makeApiRequest<{
      payload: {
        details: {
          address: string;
          address_lookup: string;
          zipcode: string;
          bedrooms: number;
          bathrooms: number;
          accommodates: number;
        };
        location: {
          lat: number;
          lng: number;
          market_id?: string;
          submarket_id?: string;
        };
        stats: {
          currency: string;
          currency_symbol: string;
          future: {
            summary: {
              adr: number;
              occupancy: number;
              revenue: number;
              revenue_upper: number;
              revenue_lower: number;
            };
            metrics: Array<{
              date: string;
              occupancy: number;
              adr: number;
              revenue: number;
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
            images?: string[];
            property_type?: string;
          };
          distance_meters: number;
          platforms?: {
            airbnb_property_id?: string;
            airbnb_property_url?: string;
          };
          stats: {
            summary: {
              occupancy: number;
              adr: number;
              revenue: number;
            };
          };
        }>;
      };
    }>("/rentalizer/estimate", "POST", {
      address: request.address,
      bedrooms: request.bedrooms,
      bathrooms: request.bathrooms,
      accommodates: request.accommodates,
      currency: request.currency || "usd",
    });
    
    const payload = response.payload;
    
    // Map comps to our format
    const comps: Comp[] = (payload.comps || []).map((comp) => ({
      title: comp.details.title,
      bedrooms: comp.details.bedrooms,
      bathrooms: comp.details.bathrooms,
      rating: comp.details.rating,
      reviews: comp.details.reviews,
      annual_revenue: comp.stats.summary.revenue,
      adr: comp.stats.summary.adr,
      occupancy: comp.stats.summary.occupancy,
      distance_meters: comp.distance_meters,
      airbnb_listing_id: comp.platforms?.airbnb_property_id,
      airbnb_url: comp.platforms?.airbnb_property_url || 
        (comp.platforms?.airbnb_property_id ? `https://www.airbnb.com/rooms/${comp.platforms.airbnb_property_id}` : undefined),
      image_url: comp.details.images?.[0],
      property_type: comp.details.property_type,
    }));
    
    // Map monthly forecast
    const monthly_forecast: MonthlyForecast[] = payload.stats.future.metrics.map((m) => ({
      month: m.date,
      revenue: m.revenue,
      adr: m.adr,
      occupancy: m.occupancy,
    }));
    
    return {
      property: {
        address: payload.details.address,
        address_lookup: payload.details.address_lookup,
        zipcode: payload.details.zipcode,
        bedrooms: payload.details.bedrooms,
        bathrooms: payload.details.bathrooms,
        accommodates: payload.details.accommodates,
        latitude: payload.location.lat,
        longitude: payload.location.lng,
        market_id: payload.location.market_id,
        submarket_id: payload.location.submarket_id,
      },
      estimates: {
        annual_revenue: payload.stats.future.summary.revenue,
        annual_revenue_low: payload.stats.future.summary.revenue_lower,
        annual_revenue_high: payload.stats.future.summary.revenue_upper,
        average_daily_rate: payload.stats.future.summary.adr,
        occupancy_rate: payload.stats.future.summary.occupancy,
        currency: payload.stats.currency,
        currency_symbol: payload.stats.currency_symbol,
      },
      monthly_forecast,
      comps,
    };
  } catch (error) {
    console.error("Error getting rentalizer estimate:", error);
    return null;
  }
}

// ============================================
// COMPREHENSIVE PROPERTY REPORT
// ============================================

export async function getComprehensivePropertyReport(
  address: string,
  bedrooms?: number,
  bathrooms?: number,
  accommodates?: number
): Promise<{
  property: RentalizerResponse;
  market: {
    id: string;
    name: string;
    listing_count: number;
    metrics: MarketMetrics;
    historical?: {
      occupancy: HistoricalDataPoint[];
      adr: HistoricalDataPoint[];
      revenue: HistoricalDataPoint[];
      revpar: HistoricalDataPoint[];
      active_listings: HistoricalDataPoint[];
    };
  } | null;
  submarkets: SubmarketData[];
  same_bedroom_comps: ListingData[];
  bedroom_performance: Array<{
    bedrooms: number;
    occupancy: number;
    adr: number;
    revenue: number;
    listing_count: number;
  }>;
  insights?: MarketInsights;
  generated_at: string;
} | null> {
  // Step 1: Get property estimate from Rentalizer
  const propertyEstimate = await getRentalizerEstimate({
    address,
    bedrooms,
    bathrooms,
    accommodates,
  });
  
  if (!propertyEstimate) {
    console.error("[Property Report] Failed to get property estimate");
    return null;
  }
  
  const propertyBedrooms = bedrooms || propertyEstimate.property.bedrooms;
  
  // Step 2: Find market ID
  let marketId = propertyEstimate.property.market_id;
  let marketListingCount = 0;
  
  // If no market_id from rentalizer, search for it
  if (!marketId) {
    // Try to extract city from address for market search
    const cityMatch = address.match(/,\s*([^,]+),\s*[A-Z]{2}/);
    const searchTerm = cityMatch ? cityMatch[1].trim() : address.split(',')[1]?.trim() || address;
    
    if (searchTerm) {
      const markets = await searchMarkets(searchTerm, 20); // Increased limit for better matching
      if (markets.length > 0) {
        console.log('[Market Search] Found markets:', JSON.stringify(markets.map(m => ({ id: m.id, name: m.name, type: m.type, state: m.state, location_name: m.location_name, listing_count: m.listing_count })), null, 2));
        // Find a market (not submarket) that matches the state
        const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d{5}/);
        const state = stateMatch ? stateMatch[1] : null;
        console.log('[Market Search] Looking for state:', state);
        
        // First try to find a parent market in the same state
        let parentMarket = markets.find(m => 
          m.type === 'market' && 
          (!state || m.state?.toLowerCase().includes(state.toLowerCase()) || m.location_name?.includes(state))
        );
        
        // If no parent market found, try to find any market (not submarket) that matches the search term
        if (!parentMarket) {
          parentMarket = markets.find(m => m.type === 'market');
        }
        
        // If still no market, use the first result regardless of type
        if (!parentMarket && markets.length > 0) {
          // Use the first market-type result, or first submarket if no markets
          const anyMarket = markets.find(m => m.type === 'market') || markets[0];
          if (anyMarket) {
            parentMarket = anyMarket;
          }
        }
        
        console.log('[Market Search] Found parent market:', parentMarket);
        
        if (parentMarket) {
          marketId = parentMarket.id;
          marketListingCount = parentMarket.listing_count; // Get listing count from search
          console.log('[Market Search] Using market ID:', marketId, 'with listing count:', marketListingCount);
        } else {
          // Fall back to first market with parent_market in same state
          const submarketWithParent = markets.find(m => 
            m.type === 'submarket' && 
            (!state || m.state?.toLowerCase().includes(state.toLowerCase()) || m.location_name?.includes(state))
          );
          if (submarketWithParent) {
            // Search for the parent market name
            const parentSearch = await searchMarkets(submarketWithParent.name, 5);
            const parent = parentSearch.find(m => m.type === 'market');
            if (parent) {
              marketId = parent.id;
              marketListingCount = parent.listing_count;
            }
          }
        }
      }
    }
  }
  
  // Step 3: Get market data (if market_id available)
  let marketData = null;
  let submarkets: SubmarketData[] = [];
  let marketInsights: MarketInsights | undefined;
  
  if (marketId) {
    const [marketDetails, historicalData, submarketList] = await Promise.all([
      getMarketDetails(marketId),
      getMarketHistoricalData(marketId, 12),
      getSubmarketsInMarket(marketId),
    ]);
    
    if (marketDetails) {
      // Calculate current metrics from historical data, fall back to market details metrics
      let latestOccupancy = historicalData.occupancy[historicalData.occupancy.length - 1]?.value || 0;
      let latestAdr = historicalData.adr[historicalData.adr.length - 1]?.value || 0;
      let latestRevenue = historicalData.revenue[historicalData.revenue.length - 1]?.value || 0;
      let latestRevpar = historicalData.revpar[historicalData.revpar.length - 1]?.value || 0;
      let latestListings = historicalData.active_listings[historicalData.active_listings.length - 1]?.value || marketDetails.listing_count;
      
      // If historical data is empty, use market details metrics
      if (latestOccupancy === 0 && marketDetails.metrics) {
        latestOccupancy = Math.round(marketDetails.metrics.booked * 100); // Convert decimal to percentage
        latestAdr = Math.round(marketDetails.metrics.daily_rate);
        latestRevenue = Math.round(marketDetails.metrics.revenue);
        latestRevpar = Math.round(marketDetails.metrics.revpar);
        console.log('[Market Data] Using market details metrics:', { latestOccupancy, latestAdr, latestRevenue, latestRevpar });
      }
      
      marketData = {
        id: marketId,
        name: marketDetails.name,
        listing_count: marketListingCount || marketDetails.listing_count || latestListings,
        metrics: {
          occupancy: latestOccupancy,
          adr: latestAdr,
          revenue: latestRevenue,
          revpar: latestRevpar,
          active_listings: marketListingCount || latestListings,
          market_score: marketDetails.metrics?.market_score,
        },
        historical: historicalData,
      };
      
      // Get market insights from listings sample
      try {
        const { listings } = await getMarketListings(marketId, { limit: 25 });
        if (listings.length > 0) {
          marketInsights = calculateMarketInsights(listings);
        }
      } catch (e) {
        console.error('[Market Insights] Error calculating insights:', e);
      }
    }
    
    submarkets = submarketList;
  }
  
  // Step 4: Get same-bedroom comps in radius (apples-to-apples)
  const sameBedroomComps = await exploreListingsInRadius(address, 3000, {
    bedrooms: propertyBedrooms,
    minRevenue: 10000, // Filter out very low performers
  }, 20);
  
  // Step 5: Get bedroom performance data from comps in radius
  const bedroomPerformance: Array<{
    bedrooms: number;
    occupancy: number;
    adr: number;
    revenue: number;
    listing_count: number;
  }> = [];
  
  // Get listings for different bedroom counts from radius comps
  for (let br = 1; br <= 5; br++) {
    const listings = await exploreListingsInRadius(address, 5000, { bedrooms: br }, 100);
    if (listings.length > 0) {
      const avgRevenue = listings.reduce((sum, l) => sum + l.annual_revenue, 0) / listings.length;
      const avgAdr = listings.reduce((sum, l) => sum + l.adr, 0) / listings.length;
      const avgOccupancy = listings.reduce((sum, l) => sum + l.occupancy, 0) / listings.length;
      
      bedroomPerformance.push({
        bedrooms: br,
        occupancy: Math.round(avgOccupancy),
        adr: Math.round(avgAdr),
        revenue: Math.round(avgRevenue),
        listing_count: listings.length,
      });
    }
  }
  
  return {
    property: propertyEstimate,
    market: marketData,
    submarkets,
    same_bedroom_comps: sameBedroomComps,
    bedroom_performance: bedroomPerformance,
    insights: marketInsights,
    generated_at: new Date().toISOString(),
  };
}

// ============================================
// COMPREHENSIVE MARKET REPORT
// ============================================

export async function getComprehensiveMarketReport(
  marketId: string
): Promise<ComprehensiveMarketReport | null> {
  // Step 1: Get market details
  const marketDetails = await getMarketDetails(marketId);
  if (!marketDetails) {
    return null;
  }
  
  // Step 2: Get all market data in parallel
  const [historicalData, submarkets, listingsResult] = await Promise.all([
    getMarketHistoricalData(marketId, 12),
    getSubmarketsInMarket(marketId),
    getMarketListings(marketId, { limit: 25, orderBy: "revenue", orderDirection: "desc" }),
  ]);
  
  // Calculate current metrics from market details
  let latestOccupancy = 0;
  let latestAdr = 0;
  let latestRevenue = 0;
  let latestRevpar = 0;
  
  if (marketDetails.metrics) {
    latestOccupancy = Math.round(marketDetails.metrics.booked * 100);
    latestAdr = Math.round(marketDetails.metrics.daily_rate);
    latestRevenue = Math.round(marketDetails.metrics.revenue);
    latestRevpar = Math.round(marketDetails.metrics.revpar);
  }
  
  // Calculate market insights from listings
  const insights = calculateMarketInsights(listingsResult.listings);
  
  // Step 3: Calculate bedroom performance from listings
  const bedroomMap = new Map<number, { count: number; totalRevenue: number; totalAdr: number; totalOccupancy: number }>();
  listingsResult.listings.forEach(l => {
    const br = l.bedrooms;
    const existing = bedroomMap.get(br) || { count: 0, totalRevenue: 0, totalAdr: 0, totalOccupancy: 0 };
    bedroomMap.set(br, {
      count: existing.count + 1,
      totalRevenue: existing.totalRevenue + l.annual_revenue,
      totalAdr: existing.totalAdr + l.adr,
      totalOccupancy: existing.totalOccupancy + l.occupancy,
    });
  });
  
  const bedroomPerformance = Array.from(bedroomMap.entries())
    .map(([bedrooms, data]) => ({
      bedrooms,
      count: data.count,
      avg_revenue: Math.round(data.totalRevenue / data.count),
      avg_adr: Math.round(data.totalAdr / data.count),
      avg_occupancy: Math.round(data.totalOccupancy / data.count),
    }))
    .sort((a, b) => a.bedrooms - b.bedrooms);
  
  return {
    market: {
      id: marketId,
      name: marketDetails.name,
      listing_count: listingsResult.total_count || marketDetails.listing_count,
      location_name: marketDetails.location_name,
      market_type: marketDetails.market_type,
      metrics: {
        occupancy: latestOccupancy,
        adr: latestAdr,
        revenue: latestRevenue,
        revpar: latestRevpar,
        active_listings: listingsResult.total_count || marketDetails.listing_count,
        market_score: marketDetails.metrics?.market_score,
      },
      historical: historicalData,
    },
    submarkets,
    top_listings: listingsResult.listings,
    bedroom_performance: bedroomPerformance,
    insights,
    generated_at: new Date().toISOString(),
  };
}

// ============================================
// COMPREHENSIVE SUBMARKET/ZIP CODE REPORT
// ============================================

export async function getComprehensiveSubmarketReport(
  submarketId: string
): Promise<{
  submarket: {
    id: string;
    name: string;
    listing_count: number;
    parent_market?: string;
    market_type?: string;
    metrics: MarketMetrics;
  };
  top_listings: ListingData[];
  bedroom_performance: Array<{
    bedrooms: number;
    count: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
  }>;
  insights: MarketInsights;
  generated_at: string;
} | null> {
  // Step 1: Get submarket details
  const submarketDetails = await getSubmarketDetails(submarketId);
  if (!submarketDetails) {
    return null;
  }
  
  // Step 2: Get listings - fetch more to get better bedroom representation
  // First fetch by revenue for top performers
  const topListingsResult = await getSubmarketListings(submarketId, {
    limit: 25,
    orderBy: "revenue",
    orderDirection: "desc",
  });
  
  // Also fetch a broader sample for bedroom statistics
  const allListingsResult = await getSubmarketListings(submarketId, {
    limit: 25,
    offset: 0,
    orderBy: "occupancy",
    orderDirection: "desc",
  });
  
  // Combine unique listings for bedroom analysis
  const listingIds = new Set<string>();
  const combinedListings = [...topListingsResult.listings];
  allListingsResult.listings.forEach(l => {
    if (!listingIds.has(l.id)) {
      listingIds.add(l.id);
      combinedListings.push(l);
    }
  });
  topListingsResult.listings.forEach(l => listingIds.add(l.id));
  
  const listingsResult = {
    listings: combinedListings,
    total_count: topListingsResult.total_count,
  };
  
  // Calculate metrics from submarket details
  let occupancy = 0;
  let adr = 0;
  let revenue = 0;
  let revpar = 0;
  let marketScore = 0;
  
  if (submarketDetails.metrics) {
    occupancy = Math.round(submarketDetails.metrics.booked * 100);
    adr = Math.round(submarketDetails.metrics.daily_rate);
    revenue = Math.round(submarketDetails.metrics.revenue);
    revpar = Math.round(submarketDetails.metrics.revpar);
    marketScore = submarketDetails.metrics.market_score;
  }
  
  // Calculate insights from listings
  const insights = calculateMarketInsights(listingsResult.listings);
  
  // Calculate bedroom performance
  const bedroomMap = new Map<number, { count: number; totalRevenue: number; totalAdr: number; totalOccupancy: number }>();
  listingsResult.listings.forEach(l => {
    const br = l.bedrooms;
    const existing = bedroomMap.get(br) || { count: 0, totalRevenue: 0, totalAdr: 0, totalOccupancy: 0 };
    bedroomMap.set(br, {
      count: existing.count + 1,
      totalRevenue: existing.totalRevenue + l.annual_revenue,
      totalAdr: existing.totalAdr + l.adr,
      totalOccupancy: existing.totalOccupancy + l.occupancy,
    });
  });
  
  const bedroomPerformance = Array.from(bedroomMap.entries())
    .map(([bedrooms, data]) => ({
      bedrooms,
      count: data.count,
      avg_revenue: Math.round(data.totalRevenue / data.count),
      avg_adr: Math.round(data.totalAdr / data.count),
      avg_occupancy: Math.round(data.totalOccupancy / data.count),
    }))
    .sort((a, b) => a.bedrooms - b.bedrooms);
  
  return {
    submarket: {
      id: submarketId,
      name: submarketDetails.name,
      listing_count: listingsResult.total_count || submarketDetails.listing_count || 0,
      parent_market: submarketDetails.parent_market_name,
      market_type: submarketDetails.market_type,
      metrics: {
        occupancy,
        adr,
        revenue,
        revpar,
        active_listings: listingsResult.total_count || submarketDetails.listing_count || 0,
        market_score: marketScore,
      },
    },
    top_listings: topListingsResult.listings,
    bedroom_performance: bedroomPerformance,
    insights,
    generated_at: new Date().toISOString(),
  };
}


// ============================================
// FETCH ALL MARKET LISTINGS (Paginated)
// ============================================

export async function getAllMarketListings(
  marketId: string,
  options?: {
    bedrooms?: number;
    minRevenue?: number;
    maxListings?: number;
  }
): Promise<ListingData[]> {
  const allListings: ListingData[] = [];
  const pageSize = 25; // API max
  let offset = 0;
  let totalCount = 0;
  const maxListings = options?.maxListings || 500; // Safety limit
  
  console.log(`[getAllMarketListings] Fetching listings for market ${marketId}, bedrooms: ${options?.bedrooms}, minRevenue: ${options?.minRevenue}`);
  
  try {
    // First request to get total count
    const firstResult = await getMarketListings(marketId, {
      limit: pageSize,
      offset: 0,
      orderBy: "revenue",
      orderDirection: "desc",
    });
    
    totalCount = firstResult.total_count;
    console.log(`[getAllMarketListings] Total listings in market: ${totalCount}`);
    
    // Add first batch
    allListings.push(...firstResult.listings);
    offset += pageSize;
    
    // Fetch remaining pages (up to maxListings)
    while (offset < totalCount && allListings.length < maxListings) {
      const result = await getMarketListings(marketId, {
        limit: pageSize,
        offset,
        orderBy: "revenue",
        orderDirection: "desc",
      });
      
      if (result.listings.length === 0) break;
      
      allListings.push(...result.listings);
      offset += pageSize;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`[getAllMarketListings] Fetched ${allListings.length} total listings`);
    
    // Filter by bedroom count if specified
    let filtered = allListings;
    if (options?.bedrooms !== undefined) {
      filtered = filtered.filter(l => l.bedrooms === options.bedrooms);
      console.log(`[getAllMarketListings] After bedroom filter (${options.bedrooms}BR): ${filtered.length} listings`);
      // Log image availability
      const withImages = filtered.filter(l => l.image_url && l.image_url.length > 0).length;
      console.log(`[getAllMarketListings] Listings with images: ${withImages}/${filtered.length}`);
    }
    
    // Filter by minimum revenue if specified
    if (options?.minRevenue !== undefined) {
      filtered = filtered.filter(l => l.annual_revenue >= options.minRevenue!);
      console.log(`[getAllMarketListings] After revenue filter (>=$${options.minRevenue}): ${filtered.length} listings`);
    }
    
    // Sort by revenue (highest first)
    filtered.sort((a, b) => b.annual_revenue - a.annual_revenue);
    
    return filtered;
  } catch (error) {
    console.error("[getAllMarketListings] Error:", error);
    return [];
  }
}

// ============================================
// GET QUALIFYING COMPETITORS FOR ARBITRAGE
// ============================================

export async function getQualifyingCompetitors(
  marketId: string,
  bedrooms: number,
  monthlyRent: number
): Promise<{
  qualifyingListings: ListingData[];
  allSameBedroomListings: ListingData[];
  revenueThreshold: number;
  totalInMarket: number;
}> {
  const revenueThreshold = monthlyRent * 12 * 2; // 2x annual rent
  
  console.log(`[getQualifyingCompetitors] Market: ${marketId}, Bedrooms: ${bedrooms}, Threshold: $${revenueThreshold}`);
  
  // Get all listings for this bedroom count
  const allSameBedroomListings = await getAllMarketListings(marketId, {
    bedrooms,
    maxListings: 200, // Get up to 200 same-bedroom listings
  });
  
  // Filter to those meeting revenue threshold
  const qualifyingListings = allSameBedroomListings.filter(
    l => l.annual_revenue >= revenueThreshold
  );
  
  console.log(`[getQualifyingCompetitors] Found ${qualifyingListings.length} qualifying listings out of ${allSameBedroomListings.length} same-bedroom listings`);
  
  return {
    qualifyingListings,
    allSameBedroomListings,
    revenueThreshold,
    totalInMarket: allSameBedroomListings.length,
  };
}


// ============================================
// SINGLE PROPERTY IMAGE FETCHING
// ============================================

interface SinglePropertyResponse {
  property_id: string;
  title: string;
  images: string[];
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  property_type: string;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
}

/**
 * Fetch single property details including images from AirDNA
 */
export async function getSinglePropertyDetails(propertyId: string): Promise<SinglePropertyResponse | null> {
  try {
    const response = await makeApiRequest<{
      payload: {
        property_id: string;
        title: string;
        images?: string[];
        bedrooms: number;
        bathrooms: number;
        accommodates: number;
        property_type: string;
        rating?: number;
        reviews?: number;
        stats?: {
          summary?: {
            annual_revenue?: number;
            adr?: number;
            occupancy?: number;
          };
        };
      };
    }>(`/listing/${propertyId}`, "GET");
    
    const p = response.payload;
    return {
      property_id: p.property_id,
      title: p.title,
      images: p.images || [],
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      accommodates: p.accommodates,
      property_type: p.property_type,
      rating: p.rating || null,
      reviews: p.reviews || 0,
      annual_revenue: p.stats?.summary?.annual_revenue || 0,
      adr: p.stats?.summary?.adr || 0,
      occupancy: p.stats?.summary?.occupancy || 0,
    };
  } catch (error) {
    console.error(`[getSinglePropertyDetails] Error fetching property ${propertyId}:`, error);
    return null;
  }
}

/**
 * Batch fetch images for multiple properties
 * Returns a map of property_id -> image_url
 */
export async function batchFetchPropertyImages(
  propertyIds: string[],
  maxConcurrent: number = 5
): Promise<Map<string, string[]>> {
  const imageMap = new Map<string, string[]>();
  
  console.log(`[batchFetchPropertyImages] Starting with ${propertyIds.length} property IDs`);
  console.log(`[batchFetchPropertyImages] Sample IDs: ${propertyIds.slice(0, 3).join(', ')}`);
  
  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < propertyIds.length; i += maxConcurrent) {
    const batch = propertyIds.slice(i, i + maxConcurrent);
    console.log(`[batchFetchPropertyImages] Processing batch ${i / maxConcurrent + 1}: ${batch.join(', ')}`);
    
    const results = await Promise.all(
      batch.map(id => getSinglePropertyDetails(id))
    );
    
    results.forEach((result, index) => {
      if (result) {
        console.log(`[batchFetchPropertyImages] Property ${batch[index]}: ${result.images.length} images`);
        if (result.images.length > 0) {
          imageMap.set(batch[index], result.images);
        }
      } else {
        console.log(`[batchFetchPropertyImages] Property ${batch[index]}: FAILED to fetch`);
      }
    });
  }
  
  console.log(`[batchFetchPropertyImages] Fetched images for ${imageMap.size}/${propertyIds.length} properties`);
  return imageMap;
}

/**
 * Enrich listings with images from single property endpoint
 */
export async function enrichListingsWithImages(
  listings: ListingData[],
  maxListings: number = 20
): Promise<ListingData[]> {
  console.log(`[enrichListingsWithImages] Starting with ${listings.length} listings, maxListings: ${maxListings}`);
  
  // Only fetch images for listings that don't already have them
  const listingsNeedingImages = listings
    .slice(0, maxListings)
    .filter(l => !l.image_url || l.image_url.length === 0);
  
  console.log(`[enrichListingsWithImages] Listings needing images: ${listingsNeedingImages.length}`);
  
  if (listingsNeedingImages.length === 0) {
    console.log('[enrichListingsWithImages] All listings already have images');
    return listings;
  }
  
  const propertyIds = listingsNeedingImages
    .map(l => l.id)
    .filter(id => id && id.length > 0);
  
  if (propertyIds.length === 0) {
    console.log('[enrichListingsWithImages] No valid property IDs to fetch images for');
    return listings;
  }
  
  console.log(`[enrichListingsWithImages] Fetching images for ${propertyIds.length} listings`);
  const imageMap = await batchFetchPropertyImages(propertyIds);
  
  // Update listings with fetched images
  return listings.map(l => {
    if ((!l.image_url || l.image_url.length === 0) && imageMap.has(l.id)) {
      const images = imageMap.get(l.id)!;
      return {
        ...l,
        image_url: images[0],
        images: images, // Store all images for gallery
      };
    }
    return l;
  });
}

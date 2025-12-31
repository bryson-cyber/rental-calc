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
    // First, get the market/submarket details
    // Check if this is a submarket ID (starts with 'submarket-') or a market ID
    const isSubmarket = marketId.startsWith('submarket-');
    
    let marketDetails: { id: string; name: string; listing_count: number; location_name: string } | null = null;
    
    if (isSubmarket) {
      // Use getSubmarketDetails for submarket IDs
      const submarketDetails = await getSubmarketDetails(marketId);
      if (submarketDetails) {
        marketDetails = {
          id: submarketDetails.id,
          name: submarketDetails.name,
          listing_count: submarketDetails.listing_count || 0,
          location_name: submarketDetails.parent_market_name || submarketDetails.name,
        };
      }
    } else {
      // Use getMarketDetails for market IDs
      marketDetails = await getMarketDetails(marketId);
    }
    
    if (!marketDetails) {
      console.log(`[getSubmarketsInMarket] No market details found for ${marketId}`);
      return [];
    }
    
    console.log(`[getSubmarketsInMarket] Looking for submarkets of ${marketDetails.name} (${marketId})`);
    console.log(`[getSubmarketsInMarket] Market details:`, JSON.stringify(marketDetails, null, 2));
    
    // Extract the base city name for searching related neighborhoods
    // For "Austin", "East Austin", "Downtown Austin", etc.
    const fullName = marketDetails.name;
    const nameParts = fullName.split(' ');
    
    // Try to identify the city name - usually the last word or the whole name
    // "Austin" -> "Austin", "East Austin" -> "Austin", "Downtown Austin" -> "Austin"
    let baseName = nameParts[nameParts.length - 1]; // Last word
    
    // If the name is a single word, use it as-is
    if (nameParts.length === 1) {
      baseName = fullName;
    }
    
    console.log(`[getSubmarketsInMarket] Base name: ${baseName}, Full name: ${fullName}`);
    
    // Search using multiple strategies to find related neighborhoods
    const searchTerms = [
      baseName, // "Austin" - most likely to find related neighborhoods
      fullName, // "Austin" or "East Austin"
    ].filter((term, index, arr) => arr.indexOf(term) === index); // Remove duplicates
    
    console.log(`[getSubmarketsInMarket] Search terms:`, searchTerms);
    
    let allResults: MarketSearchResult[] = [];
    
    for (const term of searchTerms) {
      console.log(`[getSubmarketsInMarket] Searching for: ${term}`);
      const results = await searchMarkets(term, 50); // Increased limit
      console.log(`[getSubmarketsInMarket] Found ${results.length} results for "${term}"`);
      allResults.push(...results);
    }
    
    // Deduplicate by ID
    const uniqueResults = Array.from(new Map(allResults.map(r => [r.id, r])).values());
    
    console.log(`[getSubmarketsInMarket] Found ${uniqueResults.length} unique results from searches`);
    console.log(`[getSubmarketsInMarket] Sample results:`, uniqueResults.slice(0, 5).map(r => ({ id: r.id, name: r.name, type: r.type, listings: r.listing_count })));
    
    // Filter to find related submarkets/neighborhoods
    const submarkets = uniqueResults.filter(m => {
      // Exclude the current market
      if (m.id === marketId) {
        console.log(`[getSubmarketsInMarket] Excluding ${m.name} - same as current market`);
        return false;
      }
      
      // Must have some listings (lowered threshold)
      if (m.listing_count < 50) {
        return false; // Minimum 50 listings for meaningful data
      }
      
      // Check if this is a related neighborhood:
      const mNameLower = m.name.toLowerCase();
      const baseNameLower = baseName.toLowerCase();
      const fullNameLower = fullName.toLowerCase();
      
      // 1. Name contains the base city name (e.g., "East Austin" contains "Austin")
      if (mNameLower.includes(baseNameLower)) {
        console.log(`[getSubmarketsInMarket] Including ${m.name} - contains base name`);
        return true;
      }
      
      // 2. Base name contains this market's name
      if (baseNameLower.includes(mNameLower)) {
        console.log(`[getSubmarketsInMarket] Including ${m.name} - base name contains this`);
        return true;
      }
      
      // 3. Same parent market (if available)
      if (m.parent_market?.name?.toLowerCase().includes(baseNameLower)) {
        console.log(`[getSubmarketsInMarket] Including ${m.name} - same parent market`);
        return true;
      }
      
      // 4. Check location_name similarity
      const mLocation = m.location_name?.toLowerCase() || '';
      const marketLocation = marketDetails.location_name?.toLowerCase() || '';
      if (mLocation && marketLocation) {
        // Extract city/state from location (e.g., "Austin, TX" -> "austin")
        const mCity = mLocation.split(',')[0].trim();
        const marketCity = marketLocation.split(',')[0].trim();
        if (mCity === marketCity || mCity.includes(baseNameLower) || baseNameLower.includes(mCity)) {
          console.log(`[getSubmarketsInMarket] Including ${m.name} - same location`);
          return true;
        }
      }
      
      return false;
    });
    
    console.log(`[getSubmarketsInMarket] Filtered to ${submarkets.length} related submarkets`);
    
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
    // Use getSubmarketDetails which calls the correct /submarket/{id} endpoint
    // The /market/{id}/metrics endpoint doesn't work with submarket IDs
    const details = await getSubmarketDetails(submarketId);
    
    if (!details || !details.metrics) {
      console.log(`[getSubmarketMetrics] No metrics found for submarket ${submarketId}`);
      return null;
    }
    
    return {
      occupancy: details.metrics.booked || 0, // 'booked' is the occupancy percentage
      adr: details.metrics.daily_rate || 0,
      revenue: details.metrics.revenue || 0,
      revpar: details.metrics.revpar || 0,
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


// ============================================
// SUBMARKET EXPLORATION (for market → submarket → zip code recommendations)
// ============================================

export interface SubmarketExplorationResult {
  id: string;
  name: string;
  type: 'submarket';
  listing_count: number;
  metrics: {
    occupancy: number;
    adr: number;
    revenue: number;
    revpar: number;
  };
  ranking: {
    revenue_rank: number;
    occupancy_rank: number;
    revpar_rank: number;
    overall_score: number;
  };
  recommendation?: string;
}

export async function exploreSubmarketsWithMetrics(
  marketId: string,
  options?: {
    sortBy?: 'revenue' | 'occupancy' | 'revpar' | 'overall';
    limit?: number;
  }
): Promise<{
  market: {
    id: string;
    name: string;
    metrics: MarketMetrics;
  };
  submarkets: SubmarketExplorationResult[];
  topRecommendation?: SubmarketExplorationResult;
}> {
  const sortBy = options?.sortBy || 'overall';
  const limit = options?.limit || 15;

  console.log(`[exploreSubmarketsWithMetrics] Exploring submarkets for market ${marketId}`);

  // Get market details first
  const marketDetails = await getMarketDetails(marketId);
  if (!marketDetails) {
    throw new Error(`Market ${marketId} not found`);
  }

  // Get market metrics
  const marketMetrics = await getMarketMetrics(marketId);

  // Get all submarkets in this market
  const submarkets = await getSubmarketsInMarket(marketId);
  console.log(`[exploreSubmarketsWithMetrics] Found ${submarkets.length} submarkets`);

  if (submarkets.length === 0) {
    return {
      market: {
        id: marketId,
        name: marketDetails.name,
        metrics: marketMetrics || {
          occupancy: 0,
          adr: 0,
          revenue: 0,
          revpar: 0,
          active_listings: 0,
        },
      },
      submarkets: [],
    };
  }

  // Fetch metrics for each submarket in parallel (with rate limiting)
  const submarketResults: SubmarketExplorationResult[] = [];
  
  // Process in batches of 5 to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < submarkets.length && submarketResults.length < limit; i += batchSize) {
    const batch = submarkets.slice(i, Math.min(i + batchSize, submarkets.length));
    
    const batchResults = await Promise.all(
      batch.map(async (submarket) => {
        try {
          const metrics = await getSubmarketMetrics(submarket.id);
          if (!metrics || metrics.revenue === 0) {
            return null;
          }
          
          return {
            id: submarket.id,
            name: submarket.name,
            type: 'submarket' as const,
            listing_count: submarket.listing_count,
            metrics: {
              occupancy: metrics.occupancy,
              adr: metrics.adr,
              revenue: metrics.revenue,
              revpar: metrics.revpar,
            },
            ranking: {
              revenue_rank: 0,
              occupancy_rank: 0,
              revpar_rank: 0,
              overall_score: 0,
            },
          };
        } catch (error) {
          console.error(`Error fetching metrics for submarket ${submarket.id}:`, error);
          return null;
        }
      })
    );
    
    submarketResults.push(...batchResults.filter((r): r is SubmarketExplorationResult => r !== null));
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < submarkets.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Calculate rankings
  const sortedByRevenue = [...submarketResults].sort((a, b) => b.metrics.revenue - a.metrics.revenue);
  const sortedByOccupancy = [...submarketResults].sort((a, b) => b.metrics.occupancy - a.metrics.occupancy);
  const sortedByRevpar = [...submarketResults].sort((a, b) => b.metrics.revpar - a.metrics.revpar);

  submarketResults.forEach(submarket => {
    submarket.ranking.revenue_rank = sortedByRevenue.findIndex(s => s.id === submarket.id) + 1;
    submarket.ranking.occupancy_rank = sortedByOccupancy.findIndex(s => s.id === submarket.id) + 1;
    submarket.ranking.revpar_rank = sortedByRevpar.findIndex(s => s.id === submarket.id) + 1;
    
    // Calculate overall score (lower is better - average of ranks)
    const avgRank = (submarket.ranking.revenue_rank + submarket.ranking.occupancy_rank + submarket.ranking.revpar_rank) / 3;
    submarket.ranking.overall_score = Math.round((1 - (avgRank - 1) / submarketResults.length) * 100);
  });

  // Sort by selected criteria
  let sortedResults: SubmarketExplorationResult[];
  switch (sortBy) {
    case 'revenue':
      sortedResults = sortedByRevenue;
      break;
    case 'occupancy':
      sortedResults = sortedByOccupancy;
      break;
    case 'revpar':
      sortedResults = sortedByRevpar;
      break;
    case 'overall':
    default:
      sortedResults = [...submarketResults].sort((a, b) => b.ranking.overall_score - a.ranking.overall_score);
  }

  // Add recommendations to top performers
  sortedResults.slice(0, 3).forEach((submarket, index) => {
    if (index === 0) {
      submarket.recommendation = 'Top Pick - Best overall performance across all metrics';
    } else if (submarket.ranking.revenue_rank === 1) {
      submarket.recommendation = 'Highest Revenue - Best earning potential';
    } else if (submarket.ranking.occupancy_rank === 1) {
      submarket.recommendation = 'Highest Occupancy - Most consistent bookings';
    } else if (submarket.ranking.revpar_rank === 1) {
      submarket.recommendation = 'Best RevPAR - Optimal price/occupancy balance';
    }
  });

  const topRecommendation = sortedResults[0];

  return {
    market: {
      id: marketId,
      name: marketDetails.name,
      metrics: marketMetrics || {
        occupancy: 0,
        adr: 0,
        revenue: 0,
        revpar: 0,
        active_listings: 0,
      },
    },
    submarkets: sortedResults.slice(0, limit),
    topRecommendation,
  };
}

// Helper to get market metrics
async function getMarketMetrics(marketId: string): Promise<MarketMetrics | null> {
  try {
    // API requires minimum 12 months, so we fetch 12 and take the latest
    const [occupancyData, adrData, revenueData, revparData, listingCountData] = await Promise.all([
      getMarketMetric(marketId, "occupancy", 12),
      getMarketMetric(marketId, "adr", 12),
      getMarketMetric(marketId, "avg_revenue", 12),
      getMarketMetric(marketId, "revpar", 12),
      getMarketMetric(marketId, "active_listings_count", 12),
    ]);
    
    return {
      occupancy: occupancyData[0]?.value || 0,
      adr: adrData[0]?.value || 0,
      revenue: revenueData[0]?.value || 0,
      revpar: revparData[0]?.value || 0,
      active_listings: listingCountData[0]?.value || 0,
    };
  } catch (error) {
    console.error("Error fetching market metrics:", error);
    return null;
  }
}


// ============================================
// COUNTRY-LEVEL MARKET DATA (Market Scorecard)
// ============================================

export interface CountryMarket {
  id: string;
  name: string;
  market_type: string;
  listing_count: number;
  location: {
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  scores: {
    market_score: number;
    investability: number;
    rental_demand: number;
    revenue_growth: number;
    seasonality: number;
    regulation: number;
  };
  metrics: {
    occupancy: number;
    adr: number;
    revenue: number;
    revpar: number;
  };
  geometry?: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
}

export interface CountryMarketsResponse {
  markets: CountryMarket[];
  total_count: number;
}

export async function getCountryMarkets(
  countryCode: string = "us",
  options?: {
    limit?: number;
    offset?: number;
    market_type?: "coastal" | "urban_metro" | "mountains_lakes" | "suburban" | "rural" | "mid_size_city";
    min_market_score?: number;
    min_investability?: number;
    min_rental_demand?: number;
    min_revenue_growth?: number;
    min_seasonality?: number;
    min_regulation?: number;
    sort_by?: "market_score" | "investability" | "rental_demand" | "revenue_growth" | "seasonality" | "regulation" | "listing_count" | "revenue";
    sort_direction?: "asc" | "desc";
    include_geoms?: boolean;
  }
): Promise<CountryMarketsResponse> {
  try {
    const filters: Record<string, unknown> = {};
    
    if (options?.market_type) {
      filters.market_type = options.market_type;
    }
    if (options?.min_market_score) {
      filters.min_market_score = options.min_market_score;
    }
    if (options?.min_investability) {
      filters.min_investability = options.min_investability;
    }
    if (options?.min_rental_demand) {
      filters.min_rental_demand = options.min_rental_demand;
    }
    if (options?.min_revenue_growth) {
      filters.min_revenue_growth = options.min_revenue_growth;
    }
    if (options?.min_seasonality) {
      filters.min_seasonality = options.min_seasonality;
    }
    if (options?.min_regulation) {
      filters.min_regulation = options.min_regulation;
    }

    const requestBody: Record<string, unknown> = {
      pagination: {
        page_size: Math.min(options?.limit || 25, 25),
        offset: options?.offset || 0,
      },
    };

    if (Object.keys(filters).length > 0) {
      requestBody.filters = filters;
    }

    if (options?.sort_by) {
      requestBody.order_by = {
        field: options.sort_by,
        method: options.sort_direction || "desc",
      };
    }

    if (options?.include_geoms) {
      requestBody.include_geoms = true;
    }

    const response = await makeApiRequest<{
      payload: {
        markets: Array<{
          id: string;
          name: string;
          market_type?: string;
          listing_count?: number;
          location?: {
            state?: string;
            country?: string;
            lat?: number;
            lng?: number;
          };
          metrics?: {
            market_score?: number;
            investability_score?: number;
            rental_demand_score?: number;
            revenue_growth_score?: number;
            seasonality_score?: number;
            regulation_score?: number;
            booked?: number;
            daily_rate?: number;
            revenue?: number;
            revpar?: number;
          };
          geom?: {
            type: string;
            coordinates: number[][][] | number[][][][];
          };
        }>;
        page_info: {
          total_count: number;
        };
      };
    }>(`/country/${countryCode}/markets`, "POST", requestBody);

    const markets: CountryMarket[] = response.payload.markets.map(m => ({
      id: m.id,
      name: m.name,
      market_type: m.market_type || "unknown",
      listing_count: m.listing_count || 0,
      location: {
        state: m.location?.state,
        country: m.location?.country,
        latitude: m.location?.lat,
        longitude: m.location?.lng,
      },
      scores: {
        market_score: m.metrics?.market_score || 0,
        investability: m.metrics?.investability_score || 0,
        rental_demand: m.metrics?.rental_demand_score || 0,
        revenue_growth: m.metrics?.revenue_growth_score || 0,
        seasonality: m.metrics?.seasonality_score || 0,
        regulation: m.metrics?.regulation_score || 0,
      },
      metrics: {
        occupancy: m.metrics?.booked || 0,
        adr: m.metrics?.daily_rate || 0,
        revenue: m.metrics?.revenue || 0,
        revpar: m.metrics?.revpar || 0,
      },
      geometry: m.geom,
    }));

    return {
      markets,
      total_count: response.payload.page_info.total_count,
    };
  } catch (error) {
    console.error("Error fetching country markets:", error);
    return { markets: [], total_count: 0 };
  }
}

// ============================================
// RADIUS-BASED LISTING SEARCH
// ============================================

export interface RadiusSearchResult {
  listings: ListingData[];
  total_count: number;
  center: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  radius_meters: number;
}

export async function getListingsInRadius(
  latitude: number,
  longitude: number,
  radiusMeters: number = 2000,
  options?: {
    limit?: number;
    offset?: number;
    bedrooms?: number;
    sort_by?: "revenue" | "adr" | "occupancy" | "rating" | "distance";
    sort_direction?: "asc" | "desc";
  }
): Promise<RadiusSearchResult> {
  try {
    const requestBody: Record<string, unknown> = {
      location: {
        lat: latitude,
        lng: longitude,
      },
      radius: radiusMeters,
      pagination: {
        page_size: Math.min(options?.limit || 25, 25),
        offset: options?.offset || 0,
      },
    };

    if (options?.bedrooms) {
      requestBody.filters = [
        {
          field: 'bedrooms',
          operator: 'eq',
          value: options.bedrooms,
        }
      ];
    }

    if (options?.sort_by) {
      requestBody.order_by = {
        field: options.sort_by === "distance" ? "distance" : options.sort_by,
        method: options.sort_direction || (options.sort_by === "distance" ? "asc" : "desc"),
      };
    }

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
          superhost?: boolean;
          professionally_managed?: boolean;
          location?: { lat?: number; lng?: number };
          distance_meters?: number;
        }>;
        page_info: {
          total_count: number;
        };
      };
    }>("/listing/comps/area", "POST", requestBody);

    const listings: ListingData[] = response.payload.listings.map(r => ({
      id: r.property_id || '',
      title: r.title || 'Untitled Listing',
      airbnb_url: r.airbnb_property_url || (r.airbnb_property_id ? `https://www.airbnb.com/rooms/${r.airbnb_property_id}` : ''),
      bedrooms: r.bedrooms || 0,
      bathrooms: r.bathrooms || 0,
      accommodates: r.accommodates || 0,
      property_type: r.property_type || 'Unknown',
      rating: r.rating ?? null,
      reviews: r.reviews || 0,
      annual_revenue: r.revenue_ltm || 0,
      adr: r.average_daily_rate_ltm || 0,
      occupancy: r.occupancy_rate_ltm || 0,
      superhost: r.superhost ?? false,
      professionally_managed: r.professionally_managed ?? false,
      latitude: r.location?.lat ?? 0,
      longitude: r.location?.lng ?? 0,
      distance_meters: r.distance_meters,
    }));

    return {
      listings,
      total_count: response.payload.page_info.total_count,
      center: {
        latitude,
        longitude,
      },
      radius_meters: radiusMeters,
    };
  } catch (error) {
    console.error("Error fetching listings in radius:", error);
    return {
      listings: [],
      total_count: 0,
      center: { latitude, longitude },
      radius_meters: radiusMeters,
    };
  }
}

// ============================================
// SEASONALITY DATA
// ============================================

export interface SeasonalityData {
  month: string;
  month_name: string;
  occupancy: number;
  adr: number;
  revenue: number;
  season_type: "peak" | "shoulder" | "off";
  pricing_recommendation?: string;
}

export async function getMarketSeasonality(
  marketId: string
): Promise<SeasonalityData[]> {
  try {
    // Fetch 12 months of historical data
    const [occupancyData, adrData, revenueData] = await Promise.all([
      getMarketMetric(marketId, "occupancy", 12),
      getMarketMetric(marketId, "adr", 12),
      getMarketMetric(marketId, "avg_revenue", 12),
    ]);

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // Calculate average values for season classification
    const avgOccupancy = occupancyData.reduce((sum, d) => sum + d.value, 0) / occupancyData.length;
    const avgRevenue = revenueData.reduce((sum, d) => sum + d.value, 0) / revenueData.length;

    const seasonalityData: SeasonalityData[] = [];

    for (let i = 0; i < 12; i++) {
      const monthOccupancy = occupancyData[i]?.value || 0;
      const monthAdr = adrData[i]?.value || 0;
      const monthRevenue = revenueData[i]?.value || 0;

      // Classify season based on occupancy and revenue
      let seasonType: "peak" | "shoulder" | "off";
      let pricingRecommendation: string;

      if (monthOccupancy > avgOccupancy * 1.15 && monthRevenue > avgRevenue * 1.15) {
        seasonType = "peak";
        pricingRecommendation = "Premium pricing - high demand period. Consider 15-25% above base rate.";
      } else if (monthOccupancy < avgOccupancy * 0.85 || monthRevenue < avgRevenue * 0.85) {
        seasonType = "off";
        pricingRecommendation = "Discount pricing - lower demand. Consider 10-20% below base rate or longer minimum stays.";
      } else {
        seasonType = "shoulder";
        pricingRecommendation = "Standard pricing - moderate demand. Maintain base rates with flexibility.";
      }

      const date = occupancyData[i]?.date || '';
      const monthIndex = date ? new Date(date).getMonth() : i;

      seasonalityData.push({
        month: date,
        month_name: monthNames[monthIndex],
        occupancy: monthOccupancy,
        adr: monthAdr,
        revenue: monthRevenue,
        season_type: seasonType,
        pricing_recommendation: pricingRecommendation,
      });
    }

    return seasonalityData;
  } catch (error) {
    console.error("Error fetching market seasonality:", error);
    return [];
  }
}

// ============================================
// TOP PERFORMERS FINDER
// ============================================

export interface TopPerformersOptions {
  marketId: string;
  limit?: number;
  sort_by?: "revenue" | "adr" | "occupancy" | "rating" | "reviews";
  filters?: {
    superhost_only?: boolean;
    professionally_managed?: boolean;
    bedrooms?: number;
    min_rating?: number;
    instant_book?: boolean;
  };
}

export async function getTopPerformers(
  options: TopPerformersOptions
): Promise<{ listings: ListingData[]; total_count: number }> {
  try {
    const requestBody: Record<string, unknown> = {
      pagination: {
        page_size: Math.min(options.limit || 25, 25),
        offset: 0,
      },
      order_by: {
        field: options.sort_by || "revenue",
        method: "desc",
      },
    };

    if (options.filters) {
      const filters: Record<string, unknown> = {};
      if (options.filters.superhost_only) filters.superhost = true;
      if (options.filters.professionally_managed) filters.professionally_managed = true;
      if (options.filters.bedrooms) filters.bedrooms = options.filters.bedrooms;
      if (options.filters.min_rating) filters.min_rating = options.filters.min_rating;
      if (options.filters.instant_book !== undefined) filters.instant_book = options.filters.instant_book;
      
      if (Object.keys(filters).length > 0) {
        requestBody.filters = filters;
      }
    }

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
          superhost?: boolean;
          professionally_managed?: boolean;
          host_size?: string;
          location?: { lat?: number; lng?: number };
          zipcode?: string;
        }>;
        page_info: {
          total_count: number;
        };
      };
    }>(`/market/${options.marketId}/listings`, "POST", requestBody);

    const listings: ListingData[] = response.payload.listings.map(r => ({
      id: r.property_id || '',
      title: r.title || 'Untitled Listing',
      airbnb_url: r.airbnb_property_url || (r.airbnb_property_id ? `https://www.airbnb.com/rooms/${r.airbnb_property_id}` : ''),
      bedrooms: r.bedrooms || 0,
      bathrooms: r.bathrooms || 0,
      accommodates: r.accommodates || 0,
      property_type: r.property_type || 'Unknown',
      rating: r.rating ?? null,
      reviews: r.reviews || 0,
      annual_revenue: r.revenue_ltm || 0,
      adr: r.average_daily_rate_ltm || 0,
      occupancy: r.occupancy_rate_ltm || 0,
      superhost: r.superhost ?? false,
      professionally_managed: r.professionally_managed ?? false,
      host_size: r.host_size || 'unknown',
      latitude: r.location?.lat ?? 0,
      longitude: r.location?.lng ?? 0,
      zipcode: r.zipcode || '',
    }));

    return {
      listings,
      total_count: response.payload.page_info.total_count,
    };
  } catch (error) {
    console.error("Error fetching top performers:", error);
    return { listings: [], total_count: 0 };
  }
}

// ============================================
// RENTAL ARBITRAGE FEASIBILITY
// ============================================

export interface ArbitrageFeasibility {
  property: {
    address: string;
    bedrooms: number;
    bathrooms: number;
    monthly_rent: number;
  };
  projections: {
    annual_str_revenue: number;
    annual_str_revenue_low: number;
    annual_str_revenue_high: number;
    monthly_str_revenue: number;
    break_even_occupancy: number;
    projected_monthly_profit: number;
    projected_annual_profit: number;
    roi_percentage: number;
  };
  risk_assessment: {
    overall_risk: "low" | "medium" | "high";
    seasonality_risk: "low" | "medium" | "high";
    regulation_risk: "low" | "medium" | "high";
    market_saturation: "low" | "medium" | "high";
    factors: string[];
  };
  recommendation: string;
  market_context: {
    market_name: string;
    avg_occupancy: number;
    avg_adr: number;
    avg_revenue: number;
    seasonality_score?: number;
    regulation_score?: number;
  };
}

export async function calculateArbitrageFeasibility(
  address: string,
  monthlyRent: number,
  bedrooms?: number,
  bathrooms?: number
): Promise<ArbitrageFeasibility | null> {
  try {
    // Get property estimate from Rentalizer
    const estimate = await getRentalizerEstimate({
      address,
      bedrooms,
      bathrooms,
    });

    if (!estimate) {
      return null;
    }

    const annualRent = monthlyRent * 12;
    const annualRevenue = estimate.estimates.annual_revenue;
    const annualRevenueLow = estimate.estimates.annual_revenue_low;
    const annualRevenueHigh = estimate.estimates.annual_revenue_high;
    const monthlyRevenue = annualRevenue / 12;
    const occupancyRate = estimate.estimates.occupancy_rate;
    const adr = estimate.estimates.average_daily_rate;

    // Calculate break-even occupancy (what occupancy needed to cover rent)
    const daysPerYear = 365;
    const breakEvenOccupancy = (annualRent / (adr * daysPerYear)) * 100;

    // Calculate profit projections (assuming 30% operating expenses)
    const operatingExpenses = annualRevenue * 0.30;
    const annualProfit = annualRevenue - annualRent - operatingExpenses;
    const monthlyProfit = annualProfit / 12;
    const roiPercentage = ((annualProfit / annualRent) * 100);

    // Risk assessment
    const factors: string[] = [];
    let seasonalityRisk: "low" | "medium" | "high" = "low";
    let regulationRisk: "low" | "medium" | "high" = "medium"; // Default to medium without specific data
    let saturationRisk: "low" | "medium" | "high" = "low";

    // Assess seasonality risk based on monthly forecast variance
    if (estimate.monthly_forecast.length > 0) {
      const revenues = estimate.monthly_forecast.map(m => m.revenue);
      const maxRev = Math.max(...revenues);
      const minRev = Math.min(...revenues);
      const variance = (maxRev - minRev) / maxRev;
      
      if (variance > 0.5) {
        seasonalityRisk = "high";
        factors.push("High seasonal variance - revenue drops significantly in off-season");
      } else if (variance > 0.3) {
        seasonalityRisk = "medium";
        factors.push("Moderate seasonal variance - plan for slower months");
      } else {
        factors.push("Stable year-round demand");
      }
    }

    // Assess profitability risk
    if (annualProfit < 0) {
      factors.push("WARNING: Projected annual loss - property may not be viable for arbitrage");
    } else if (roiPercentage < 20) {
      factors.push("Low ROI - consider negotiating lower rent or finding higher-revenue property");
    } else if (roiPercentage > 50) {
      factors.push("Strong ROI potential - property appears well-suited for arbitrage");
    }

    // Break-even assessment
    if (breakEvenOccupancy > occupancyRate * 100) {
      factors.push("WARNING: Break-even occupancy exceeds market average - high risk");
    } else if (breakEvenOccupancy > 50) {
      factors.push("Break-even requires above-average occupancy");
    } else {
      factors.push("Comfortable break-even point below market average");
    }

    // Overall risk calculation
    let overallRisk: "low" | "medium" | "high";
    if (annualProfit < 0 || breakEvenOccupancy > occupancyRate * 100) {
      overallRisk = "high";
    } else if (roiPercentage < 20 || seasonalityRisk === "high") {
      overallRisk = "medium";
    } else {
      overallRisk = "low";
    }

    // Generate recommendation
    let recommendation: string;
    if (overallRisk === "high") {
      recommendation = "This property presents significant risk for rental arbitrage. Consider negotiating a lower rent, finding a different property, or exploring other investment strategies.";
    } else if (overallRisk === "medium") {
      recommendation = "This property has moderate potential for rental arbitrage. Success will depend on achieving above-average occupancy and managing seasonal fluctuations carefully.";
    } else {
      recommendation = "This property shows strong potential for rental arbitrage. The numbers suggest a viable investment with good profit margins and manageable risk.";
    }

    return {
      property: {
        address: estimate.property.address,
        bedrooms: estimate.property.bedrooms,
        bathrooms: estimate.property.bathrooms,
        monthly_rent: monthlyRent,
      },
      projections: {
        annual_str_revenue: annualRevenue,
        annual_str_revenue_low: annualRevenueLow,
        annual_str_revenue_high: annualRevenueHigh,
        monthly_str_revenue: monthlyRevenue,
        break_even_occupancy: breakEvenOccupancy,
        projected_monthly_profit: monthlyProfit,
        projected_annual_profit: annualProfit,
        roi_percentage: roiPercentage,
      },
      risk_assessment: {
        overall_risk: overallRisk,
        seasonality_risk: seasonalityRisk,
        regulation_risk: regulationRisk,
        market_saturation: saturationRisk,
        factors,
      },
      recommendation,
      market_context: {
        market_name: estimate.property.address_lookup || address,
        avg_occupancy: occupancyRate,
        avg_adr: adr,
        avg_revenue: annualRevenue,
      },
    };
  } catch (error) {
    console.error("Error calculating arbitrage feasibility:", error);
    return null;
  }
}

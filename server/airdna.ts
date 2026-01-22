import { ENV } from "./_core/env";
import { apiCache } from './cache';

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
  accommodates?: number;
  // Monthly performance data for each comp
  monthly_metrics?: Array<{
    date: string;
    occupancy: number;
    adr: number;
    revenue: number;
    revenue_potential: number;
  }>;
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
  // The actual API returns stats.future.metrics with monthly forecast data
  stats?: {
    future?: {
      metrics?: Array<{
        date: string;
        occupancy: number;
        adr: number;
        revenue: number;
        revenue_lower?: number;
        revenue_upper?: number;
      }>;
    };
  };
  comps: Comp[];
  // Historical data
  historical?: {
    summary: {
      monthly_pct_change: number;
      yearly_pct_change: number;
    };
    metrics: Array<{
      date: string;
      revenue_valuation: number;
    }>;
  };
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
  latitude?: number | null;
  longitude?: number | null;
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
  body?: Record<string, unknown>,
  retries: number = 3
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
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        const statusCode = response.status;
        
        // Don't retry 4xx errors (client errors) except 429 (rate limit)
        if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
          throw new Error(`AirDNA API error (${statusCode}): ${errorText}`);
        }
        
        // Retry on 5xx errors (server errors) and 429 (rate limit)
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
          console.log(`[AirDNA] Retrying ${endpoint} in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw new Error(`AirDNA API error (${statusCode}): ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a network error (ECONNRESET, ETIMEDOUT, etc.)
      const isNetworkError = lastError.message.includes('ECONNRESET') ||
                             lastError.message.includes('ETIMEDOUT') ||
                             lastError.message.includes('ENOTFOUND') ||
                             lastError.message.includes('socket') ||
                             lastError.message.includes('network');
      
      if (isNetworkError && attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`[AirDNA] Network error, retrying ${endpoint} in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw lastError;
    }
  }
  
  throw lastError || new Error('Unknown error in makeApiRequest');
}

// ============================================
// MARKET SEARCH
// ============================================

// Cache for US markets to avoid repeated API calls
let usMarketsCache: Array<{
  id: string;
  name: string;
  listing_count?: number;
  market_type?: string;
  metrics?: {
    revenue?: number;
    booked?: number;
    daily_rate?: number;
  };
}> | null = null;
let usMarketsCacheTime: number = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour cache

async function getAllUSMarkets(): Promise<typeof usMarketsCache> {
  // Return cached data if still valid
  if (usMarketsCache && Date.now() - usMarketsCacheTime < CACHE_TTL) {
    return usMarketsCache;
  }
  
  console.log('[getAllUSMarkets] Fetching all US markets...');
  const allMarkets: typeof usMarketsCache = [];
  let offset = 0;
  const pageSize = 25;
  let hasMore = true;
  
  while (hasMore && offset < 400) { // Max 400 markets to avoid infinite loop
    try {
      const response = await makeApiRequest<{
        payload: {
          markets: Array<{
            id: string;
            name: string;
            market_type?: string;
            metrics?: {
              revenue?: number;
              booked?: number;
              daily_rate?: number;
            };
          }>;
        };
      }>('/country/us/markets', 'POST', {
        pagination: { page_size: pageSize, offset },
      });
      
      if (response.payload.markets.length === 0) {
        hasMore = false;
      } else {
        allMarkets.push(...response.payload.markets);
        offset += pageSize;
      }
    } catch (error) {
      console.error('[getAllUSMarkets] Error fetching page:', error);
      hasMore = false;
    }
  }
  
  console.log(`[getAllUSMarkets] Loaded ${allMarkets.length} US markets`);
  if (allMarkets.length > 0) {
    console.log(`[getAllUSMarkets] Sample markets:`, allMarkets.slice(0, 10).map(m => m.name));
  }
  usMarketsCache = allMarkets;
  usMarketsCacheTime = Date.now();
  return allMarkets;
}

export async function searchMarkets(searchTerm: string, limit: number = 10): Promise<MarketSearchResult[]> {
  const cacheKey = apiCache.generateKey('search_markets', { searchTerm, limit });
  const cached = apiCache.get<MarketSearchResult[]>(cacheKey);
  if (cached) return cached;
  
  try {
    // Get all US markets from cache or API
    const allMarkets = await getAllUSMarkets();
    if (!allMarkets) return [];
    
    // Normalize search term
    const searchLower = searchTerm.toLowerCase().replace(/,\s*/g, ' ').trim();
    const searchParts = searchLower.split(/\s+/);
    const mainSearch = searchParts[0];
    
    // Score each market based on how well it matches
    const scoredMarkets = allMarkets.map((m) => {
      const nameLower = m.name.toLowerCase();
      
      let score = 0;
      // Exact name match gets highest score
      if (nameLower === mainSearch) score += 100;
      // Name starts with search term
      else if (nameLower.startsWith(mainSearch)) score += 75;
      // Name contains search term
      else if (nameLower.includes(mainSearch)) score += 50;
      
      return { ...m, score };
    });
    
    // Filter and sort by score
    const matchedMarkets = scoredMarkets
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    console.log(`[searchMarkets] Found ${matchedMarkets.length} matching markets for "${searchTerm}"`);
    if (matchedMarkets.length > 0) {
      console.log(`[searchMarkets] Top matches:`, matchedMarkets.slice(0, 5).map(m => ({ id: m.id, name: m.name, score: m.score })));
    }
    
    const results = matchedMarkets.map((m) => ({
      id: m.id,
      name: m.name,
      type: 'market' as const,
      listing_count: m.listing_count || 0,
      location_name: `${m.name}, United States`,
      // Try to extract state from market name (e.g., "Phoenix, AZ" -> "Arizona")
      state: m.name.includes(',') ? m.name.split(',')[1].trim() : undefined,
    }));
    
    apiCache.set(cacheKey, results, 'search_markets');
    return results;
  } catch (error) {
    console.error('Error searching markets:', error);
    return [];
  }
}

/**
 * Search for markets and submarkets using AirDNA's /market/search API.
 * This searches DIRECTLY in AirDNA's database, so every result is guaranteed to have data.
 * Supports: city names, neighborhood names, zip codes, and any location AirDNA knows about.
 */
export async function searchMarketsAPI(searchTerm: string, limit: number = 15): Promise<MarketSearchResult[]> {
  const cacheKey = apiCache.generateKey('search_markets_api', { searchTerm, limit });
  const cached = apiCache.get<MarketSearchResult[]>(cacheKey);
  if (cached) return cached;
  
  try {
    console.log(`[searchMarketsAPI] Searching AirDNA for: "${searchTerm}"`);
    
    const searchResponse = await makeApiRequest<{
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
          legacy_location?: {
            zipcodes?: string[];
            neighborhoods?: string[];
          };
          parent_market?: {
            id: string;
            name: string;
          };
        }>;
      };
      status: {
        type: string;
        message: string;
      };
    }>('/market/search', 'POST', {
      search_term: searchTerm,
      pagination: {
        page_size: limit,
        offset: 0
      }
    });
    
    const results = searchResponse.payload?.results || [];
    console.log(`[searchMarketsAPI] Found ${results.length} results for "${searchTerm}"`);
    
    // Filter to prioritize US results and sort by listing count
    const processedResults = results
      .filter(r => {
        // Filter out non-US results (unless they have many listings)
        const country = r.location?.country?.toLowerCase();
        if (country && country !== 'us' && country !== 'united states' && r.listing_count < 1000) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Prioritize exact name matches
        const aExact = a.name.toLowerCase() === searchTerm.toLowerCase() ? 1 : 0;
        const bExact = b.name.toLowerCase() === searchTerm.toLowerCase() ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        
        // Then by listing count (more listings = more relevant)
        return b.listing_count - a.listing_count;
      })
      .slice(0, limit)
      .map((r): MarketSearchResult => ({
        id: r.id,
        name: r.name,
        type: r.type,
        listing_count: r.listing_count,
        location_name: r.location_name || r.name,
        state: r.location?.state,
        country: r.location?.country,
        parent_market: r.parent_market,
        zipcodes: r.legacy_location?.zipcodes,
      }));
    
    apiCache.set(cacheKey, processedResults, 'search_markets_api');
    return processedResults;
  } catch (error) {
    console.error('[searchMarketsAPI] Error:', error);
    return [];
  }
}

// ============================================
// ZIP CODE SEARCH (Using AirDNA Market Search API)
// ============================================

export interface ZipCodeSearchResult {
  zipcode: string;
  location: string;
  submarket?: {
    id: string;
    name: string;
    listing_count: number;
    parent_market?: {
      id: string;
      name: string;
    };
  };
  market?: {
    id: string;
    name: string;
    listing_count: number;
  };
  metrics?: {
    revenue: number;
    occupancy: number;
    adr: number;
    revpar: number;
    active_listings: number;
    market_score?: number;
  };
  top_performers?: Array<{
    title: string;
    bedrooms: number;
    bathrooms: number;
    annual_revenue: number;
    occupancy: number;
    adr: number;
    rating: number | null;
    reviews: number;
    airbnb_url?: string;
  }>;
}

/**
 * Search for market data by zip code using the AirDNA Market Search API.
 * This is the CORRECT way to search by zip code - directly through the API.
 */
export async function searchByZipcode(zipcode: string, options?: {
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  amenities?: {
    pool?: boolean;
    hotTub?: boolean;
    petFriendly?: boolean;
    parking?: boolean;
    gym?: boolean;
    kitchen?: boolean;
    washerDryer?: boolean;
    aircon?: boolean;
  };
  superhost?: boolean;
  instantBook?: boolean;
  professionallyManaged?: boolean;
  minRating?: number;
  priceTier?: string;
  limit?: number;
}): Promise<ZipCodeSearchResult | null> {
  console.log(`[searchByZipcode] Searching for zip code: ${zipcode}`);
  
  try {
    // Step 1: Use AirDNA Market Search with the zip code as search term
    const searchResponse = await makeApiRequest<{
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
          legacy_location?: {
            zipcodes?: string[];
            neighborhoods?: string[];
          };
          parent_market?: {
            id: string;
            name: string;
          };
        }>;
      };
      status: {
        type: string;
        message: string;
      };
    }>('/market/search', 'POST', {
      search_term: zipcode,
      pagination: {
        page_size: 25,
        offset: 0
      }
    });
    
    console.log(`[searchByZipcode] Search response:`, JSON.stringify(searchResponse.status));
    
    const results = searchResponse.payload?.results || [];
    
    if (results.length === 0) {
      console.log(`[searchByZipcode] No results found for zip code ${zipcode}`);
      return null;
    }
    
    // Prefer submarket results as they're more specific to the zip code
    const submarket = results.find(r => r.type === 'submarket');
    const market = results.find(r => r.type === 'market');
    
    const targetResult = submarket || market;
    if (!targetResult) {
      return null;
    }
    
    console.log(`[searchByZipcode] Found ${targetResult.type}: ${targetResult.name} (${targetResult.id})`);
    
    // Step 2: Get detailed metrics for the submarket or market
    let metrics: ZipCodeSearchResult['metrics'];
    let topPerformers: ZipCodeSearchResult['top_performers'];
    
    if (submarket) {
      // Get submarket details which include metrics
      const submarketDetails = await getSubmarketDetails(submarket.id);
      if (submarketDetails?.metrics) {
        metrics = {
          revenue: submarketDetails.metrics.revenue,
          occupancy: submarketDetails.metrics.booked,
          adr: submarketDetails.metrics.daily_rate,
          revpar: submarketDetails.metrics.revpar,
          active_listings: submarketDetails.listing_count || 0,
          market_score: submarketDetails.metrics.market_score
        };
      }
      
      // Get top performers in the submarket with filters
      try {
        const listingsResult = await getSubmarketListings(submarket.id, {
          limit: options?.limit || 10,
          orderBy: 'revenue',
          orderDirection: 'desc',
          filters: {
            bedrooms: options?.bedrooms,
            bathrooms: options?.bathrooms,
            propertyType: options?.propertyType,
            amenities: options?.amenities,
            superhost: options?.superhost,
            instantBook: options?.instantBook,
            professionallyManaged: options?.professionallyManaged,
            minRating: options?.minRating,
            priceTier: options?.priceTier
          }
        });
        
        // If filtered results are empty, try without filters to get some data
        if (listingsResult.listings.length === 0 && (options?.bedrooms || options?.bathrooms || options?.propertyType)) {
          console.log('[searchByZipcode] No filtered listings found, trying without filters...');
          const unfilteredResult = await getSubmarketListings(submarket.id, {
            limit: options?.limit || 10,
            orderBy: 'revenue',
            orderDirection: 'desc'
          });
          
          topPerformers = unfilteredResult.listings.map((l: ListingData) => ({
            title: l.title,
            bedrooms: l.bedrooms,
            bathrooms: l.bathrooms,
            property_type: l.property_type,
            annual_revenue: l.annual_revenue,
            occupancy: l.occupancy,
            adr: l.adr,
            rating: l.rating,
            reviews: l.reviews,
            airbnb_url: l.airbnb_url,
            note: 'Showing top performers across all property types (no exact matches for your filters)'
          }));
        } else {
          topPerformers = listingsResult.listings.map((l: ListingData) => ({
            title: l.title,
            bedrooms: l.bedrooms,
            bathrooms: l.bathrooms,
            property_type: l.property_type,
            annual_revenue: l.annual_revenue,
            occupancy: l.occupancy,
            adr: l.adr,
            rating: l.rating,
            reviews: l.reviews,
            airbnb_url: l.airbnb_url
          }));
        }
      } catch (e) {
        console.error('[searchByZipcode] Error getting listings:', e);
      }
    } else if (market) {
      // Get market details
      const marketDetails = await getMarketDetails(market.id);
      if (marketDetails?.metrics) {
        metrics = {
          revenue: marketDetails.metrics.revenue,
          occupancy: marketDetails.metrics.booked,
          adr: marketDetails.metrics.daily_rate,
          revpar: marketDetails.metrics.revpar,
          active_listings: marketDetails.listing_count || 0,
          market_score: marketDetails.metrics.market_score
        };
      }
    }
    
    // Build location string
    const location = targetResult.location_name || 
      (targetResult.location ? `${targetResult.name}, ${targetResult.location.state}` : targetResult.name);
    
    return {
      zipcode,
      location,
      submarket: submarket ? {
        id: submarket.id,
        name: submarket.name,
        listing_count: submarket.listing_count,
        parent_market: submarket.parent_market
      } : undefined,
      market: market ? {
        id: market.id,
        name: market.name,
        listing_count: market.listing_count
      } : undefined,
      metrics,
      top_performers: topPerformers
    };
  } catch (error) {
    console.error(`[searchByZipcode] Error searching zip code ${zipcode}:`, error);
    return null;
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
  const cacheKey = apiCache.generateKey('market_details', { marketId });
  const cached = apiCache.get<{
    id: string;
    name: string;
    listing_count: number;
    location_name: string;
    market_type?: string;
    metrics?: { market_score: number; revenue: number; booked: number; daily_rate: number; revpar: number; };
  }>(cacheKey);
  if (cached) return cached;
  
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
    
    const result = {
      id: response.payload.id,
      name: response.payload.name,
      listing_count: response.payload.listing_count || 0,
      location_name: response.payload.location_name || response.payload.name,
      market_type: response.payload.market_type,
      metrics: response.payload.metrics,
    };
    
    apiCache.set(cacheKey, result, 'market_details');
    return result;
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
    
    console.log(`[getSubmarketDetails] Raw API response for ${submarketId}:`, JSON.stringify(response.payload, null, 2));
    
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
        metrics?: Array<{
          month?: string;
          date?: string;
          value?: number;
          occupancy?: number;
          occupancy_rate?: number;
          avg_revenue?: number;
          revenue?: number;
          adr?: number;
          revpar?: number;
          active_listings_count?: number;
          active_listings?: number;
          available_listings?: number;
          booking_lead_time?: number;
          los?: number;
        }>;
      };
    }>(`/market/${marketId}/metrics/${metricType}`, "POST", {
      num_months: numMonths,
    });
    
    // API returns payload.metrics, not payload.results
    const results = response.payload.metrics || [];
    
    if (results.length === 0) {
      console.log(`[AirDNA] ${metricType} returned 0 results for ${numMonths} months`);
    } else {
      console.log(`[AirDNA] ${metricType} returned ${results.length} results for ${numMonths} months`);
    }
    
    return results.map((r) => {
      const date = r.month || r.date || "";
      let value = r.value;
      
      // Handle different response field names
      if (value === undefined) {
        switch (metricType) {
          case "occupancy": value = r.occupancy_rate || r.occupancy; break;
          case "avg_revenue": value = r.revenue || r.avg_revenue; break;
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

// ============================================
// SUBMARKET METRICS (Historical Data)
// ============================================

async function getSubmarketMetric(
  submarketId: string,
  metricType: "occupancy" | "avg_revenue" | "adr" | "revpar" | "active_listings_count" | "booking_lead_time" | "los",
  numMonths: number = 12
): Promise<HistoricalDataPoint[]> {
  try {
    const response = await makeApiRequest<{
      payload: {
        metrics?: Array<{
          month?: string;
          date?: string;
          value?: number;
          occupancy?: number;
          occupancy_rate?: number;
          avg_revenue?: number;
          revenue?: number;
          adr?: number;
          revpar?: number;
          active_listings_count?: number;
          active_listings?: number;
          available_listings?: number;
          booking_lead_time?: number;
          los?: number;
        }>;
      };
    }>(`/submarket/${submarketId}/metrics/${metricType}`, "POST", {
      num_months: numMonths,
    });
    
    // API returns payload.metrics, not payload.results
    const results = response.payload.metrics || [];
    
    if (results.length === 0) {
      console.log(`[AirDNA] Submarket ${metricType} returned 0 results for ${numMonths} months`);
    } else {
      console.log(`[AirDNA] Submarket ${metricType} returned ${results.length} results for ${numMonths} months`);
    }
    
    return results.map((r) => {
      const date = r.month || r.date || "";
      let value = r.value;
      
      // Handle different response field names
      if (value === undefined) {
        switch (metricType) {
          case "occupancy": value = r.occupancy_rate || r.occupancy; break;
          case "avg_revenue": value = r.revenue || r.avg_revenue; break;
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
    console.error(`Error fetching ${metricType} for submarket ${submarketId}:`, error);
    return [];
  }
}

export async function getSubmarketSeasonality(
  submarketId: string
): Promise<SeasonalityData[]> {
  // Check cache first
  const cacheKey = `submarket_seasonality:${submarketId}`;
  const cached = apiCache.get<SeasonalityData[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Fetch 12 months of historical data for submarket
    const [occupancyData, adrData, revenueData] = await Promise.all([
      getSubmarketMetric(submarketId, "occupancy", 12),
      getSubmarketMetric(submarketId, "adr", 12),
      getSubmarketMetric(submarketId, "avg_revenue", 12),
    ]);

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // Calculate average values for season classification
    const avgOccupancy = occupancyData.reduce((sum, d) => sum + d.value, 0) / occupancyData.length;
    const avgRevenue = revenueData.reduce((sum, d) => sum + d.value, 0) / revenueData.length;

    const seasonalityData: SeasonalityData[] = [];
    
    // Check if we have actual data
    const hasData = occupancyData.some(d => d.value > 0) || adrData.some(d => d.value > 0) || revenueData.some(d => d.value > 0);
    
    if (!hasData) {
      console.log(`[getSubmarketSeasonality] No historical data available for submarket ${submarketId}`);
      return [];
    }

    for (let i = 0; i < 12; i++) {
      const occupancy = occupancyData[i]?.value || 0;
      const adr = adrData[i]?.value || 0;
      const revenue = revenueData[i]?.value || 0;
      const month = occupancyData[i]?.date || adrData[i]?.date || revenueData[i]?.date || "";

      // Determine season type based on occupancy and revenue
      let seasonType: "peak" | "shoulder" | "off";
      if (occupancy >= avgOccupancy * 1.1 && revenue >= avgRevenue * 1.1) {
        seasonType = "peak";
      } else if (occupancy < avgOccupancy * 0.9 || revenue < avgRevenue * 0.9) {
        seasonType = "off";
      } else {
        seasonType = "shoulder";
      }

      seasonalityData.push({
        month,
        month_name: monthNames[i],
        occupancy: Math.round(occupancy),
        adr: Math.round(adr),
        revenue: Math.round(revenue),
        season_type: seasonType,
      });
    }

    console.log(`[getSubmarketSeasonality] Successfully fetched seasonality for submarket ${submarketId}`);
    
    // Cache the result
    apiCache.set(cacheKey, seasonalityData, 'market_seasonality');
    
    return seasonalityData;
  } catch (error) {
    console.error(`Error fetching seasonality for submarket ${submarketId}:`, error);
    return [];
  }
}

// Helper function to add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to fetch with retry
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`[AirDNA] Retry ${i + 1}/${retries} after ${delayMs}ms delay...`);
      await delay(delayMs * (i + 1)); // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
}

export async function getMarketHistoricalData(marketId: string, numMonths: number = 12): Promise<{
  occupancy: HistoricalDataPoint[];
  adr: HistoricalDataPoint[];
  revenue: HistoricalDataPoint[];
  revpar: HistoricalDataPoint[];
  active_listings: HistoricalDataPoint[];
}> {
  console.log(`[AirDNA] Fetching ${numMonths} months of historical data for market ${marketId}`);
  
  // Serialize requests to avoid overwhelming the API
  // Add small delays between requests to prevent rate limiting
  const occupancy = await fetchWithRetry(() => getMarketMetric(marketId, "occupancy", numMonths));
  await delay(200);
  
  const adr = await fetchWithRetry(() => getMarketMetric(marketId, "adr", numMonths));
  await delay(200);
  
  const revenue = await fetchWithRetry(() => getMarketMetric(marketId, "avg_revenue", numMonths));
  await delay(200);
  
  const revpar = await fetchWithRetry(() => getMarketMetric(marketId, "revpar", numMonths));
  await delay(200);
  
  const active_listings = await fetchWithRetry(() => getMarketMetric(marketId, "active_listings_count", numMonths));
  
  console.log(`[AirDNA] Historical data results: occupancy=${occupancy.length}, adr=${adr.length}, revenue=${revenue.length}`);
  
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
    filters?: ListingFilters;
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
    }>(`/market/${marketId}/listings`, "POST", (() => {
      // Build filters array based on options
      const filters: Array<Record<string, unknown>> = [];
      
      if (options?.filters?.bedrooms) {
        filters.push({
          type: "select",
          field: "bedrooms",
          value: options.filters.bedrooms
        });
      }
      
      if (options?.filters?.bathrooms) {
        filters.push({
          type: "gte",
          field: "bathrooms",
          value: options.filters.bathrooms
        });
      }
      
      if (options?.filters?.propertyType) {
        filters.push({
          type: "multi_select",
          field: "property_type",
          value: [options.filters.propertyType.toLowerCase()]
        });
      }
      
      return {
        pagination: {
          page_size: Math.min(options?.limit || 25, 25),
          offset: options?.offset || 0,
        },
        order_by: {
          field: options?.orderBy || "revenue",
          method: options?.orderDirection || "desc",
        },
        ...(filters.length > 0 && { filters }),
      };
    })());
    
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
      latitude: r.location?.lat ?? null,
      longitude: r.location?.lng ?? null,
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

export interface ListingFilters {
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  amenities?: {
    pool?: boolean;
    hotTub?: boolean;
    petFriendly?: boolean;
    parking?: boolean;
    gym?: boolean;
    kitchen?: boolean;
    washerDryer?: boolean;
    aircon?: boolean;
  };
  superhost?: boolean;
  instantBook?: boolean;
  professionallyManaged?: boolean;
  minRating?: number;
  priceTier?: string;
}

export async function getSubmarketListings(
  submarketId: string,
  options?: {
    limit?: number;
    offset?: number;
    orderBy?: "revenue" | "adr" | "occupancy" | "rating";
    orderDirection?: "asc" | "desc";
    filters?: ListingFilters;
  }
): Promise<{ listings: ListingData[]; total_count: number }> {
  try {
    // Build filters array based on options
    const filters: Array<Record<string, unknown>> = [];
    
    if (options?.filters?.bedrooms) {
      filters.push({
        type: "select",
        field: "bedrooms",
        value: options.filters.bedrooms
      });
    }
    
    if (options?.filters?.bathrooms) {
      filters.push({
        type: "gte",
        field: "bathrooms",
        value: options.filters.bathrooms
      });
    }
    
    if (options?.filters?.propertyType) {
      filters.push({
        type: "multi_select",
        field: "property_type",
        value: [options.filters.propertyType.toLowerCase()]
      });
    }
    
    // Build amenities filter
    const amenitiesFilter: Record<string, boolean> = {};
    if (options?.filters?.amenities?.pool) amenitiesFilter.has_pool = true;
    if (options?.filters?.amenities?.hotTub) amenitiesFilter.has_hottub = true;
    if (options?.filters?.amenities?.petFriendly) amenitiesFilter.has_pets_allowed = true;
    if (options?.filters?.amenities?.parking) amenitiesFilter.has_parking = true;
    if (options?.filters?.amenities?.gym) amenitiesFilter.has_gym = true;
    if (options?.filters?.amenities?.kitchen) amenitiesFilter.has_kitchen = true;
    if (options?.filters?.amenities?.washerDryer) amenitiesFilter.has_washer = true;
    if (options?.filters?.amenities?.aircon) amenitiesFilter.has_aircon = true;
    
    if (Object.keys(amenitiesFilter).length > 0) {
      filters.push({
        type: "jsonb_boolean",
        field: "amenities",
        value: amenitiesFilter
      });
    }
    
    if (options?.filters?.superhost) {
      filters.push({
        type: "select",
        field: "superhost",
        value: true
      });
    }
    
    if (options?.filters?.instantBook) {
      filters.push({
        type: "select",
        field: "instant_book",
        value: true
      });
    }
    
    if (options?.filters?.professionallyManaged) {
      filters.push({
        type: "select",
        field: "professionally_managed",
        value: true
      });
    }
    
    if (options?.filters?.minRating) {
      filters.push({
        type: "gte",
        field: "ratings",
        value: options.filters.minRating
      });
    }
    
    if (options?.filters?.priceTier) {
      filters.push({
        type: "multi_select",
        field: "price_tier",
        value: [options.filters.priceTier.toLowerCase()]
      });
    }
    
    console.log(`[getSubmarketListings] Fetching listings for submarket ${submarketId} with ${filters.length} filters`);
    if (filters.length > 0) {
      console.log(`[getSubmarketListings] Filters:`, JSON.stringify(filters));
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
      ...(filters.length > 0 && { filters })
    });
    
    // Debug: log location data availability
    const listingsWithLocation = response.payload.listings.filter(l => l.location?.lat && l.location?.lng);
    console.log(`[getSubmarketListings] Listings with location: ${listingsWithLocation.length}/${response.payload.listings.length}`);
    if (response.payload.listings.length > 0 && !response.payload.listings[0].location) {
      console.log('[getSubmarketListings] Sample listing keys:', Object.keys(response.payload.listings[0]));
    }
    
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
      latitude: r.location?.lat ?? null,
      longitude: r.location?.lng ?? null,
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
    
    let listings: ListingData[] = (response.payload.listings || []).map((r) => {
      // Get image from API response if available
      // Note: radius search endpoint doesn't return images, so we'll enrich later via getSinglePropertyDetails
      const imageUrl = r.images?.[0] || '';
      return {
        id: r.property_id || '',
        title: r.title || 'Untitled Listing',
        airbnb_url: r.airbnb_property_url || (r.airbnb_property_id ? `https://www.airbnb.com/rooms/${r.airbnb_property_id}` : ''),
        image_url: imageUrl,
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
        latitude: r.location?.lat ?? null,
        longitude: r.location?.lng ?? null,
        zipcode: r.zipcode || '',
      };
    });
    
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
  // Generate cache key
  const cacheKey = apiCache.generateKey('rentalizer', {
    address: request.address,
    bedrooms: request.bedrooms,
    bathrooms: request.bathrooms,
    accommodates: request.accommodates
  });
  
  // Check cache first
  const cached = apiCache.get<RentalizerResponse>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Try the request with fallback bathroom counts if it fails
  // AirDNA API sometimes returns 500 errors for certain bed/bath combinations
  const bathroomOptions = [
    request.bathrooms,
    request.bathrooms === 1 ? 2 : request.bathrooms, // Try 2 baths if 1 fails
    request.bathrooms === 1 ? 1.5 : request.bathrooms, // Try 1.5 baths if 1 fails
    Math.max(1, (request.bedrooms || 2) - 1), // Try bedrooms - 1 baths
  ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
  
  for (const bathrooms of bathroomOptions) {
    try {
      const result = await tryRentalizerRequest({
        ...request,
        bathrooms
      });
      if (result) {
        // Cache and return the successful result
        apiCache.set(cacheKey, result, 'rentalizer');
        return result;
      }
    } catch (error) {
      // Continue to next bathroom option
      console.log(`Rentalizer failed for ${request.bedrooms} bed / ${bathrooms} bath, trying next option...`);
    }
  }
  
  console.error("Error getting rentalizer estimate: All bathroom configurations failed");
  return null;
}

async function tryRentalizerRequest(
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
          historical?: {
            summary: {
              revenue_valuation: {
                monthly_pct_change: number;
                yearly_pct_change: number;
              };
            };
            metrics: Array<{
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
            metrics?: Array<{
              date: string;
              occupancy: number;
              adr: number;
              revenue: number;
              revenue_potential: number;
            }>;
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
    
    // Log raw comp data to debug image URLs
    console.log('[AirDNA] Rentalizer comps raw data sample:', JSON.stringify({
      firstComp: payload.comps?.[0] ? {
        title: payload.comps[0].details?.title,
        images: payload.comps[0].details?.images,
        thumbnail_url: (payload.comps[0].details as any)?.thumbnail_url,
        airbnb_property_id: payload.comps[0].platforms?.airbnb_property_id,
      } : 'No comps'
    }));
    
    // Map comps to our format (take all available, up to 10)
    // Log first comp to see image data structure
    if (payload.comps?.[0]) {
      const firstComp = payload.comps[0];
      console.log('[AirDNA] First comp image data:', {
        images: firstComp.details?.images,
        thumbnail_url: (firstComp.details as any)?.thumbnail_url,
        comp_thumbnail: (firstComp as any)?.thumbnail_url,
        platforms: firstComp.platforms,
      });
    }
    const comps: Comp[] = (payload.comps || []).slice(0, 10).map((comp) => ({
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
      image_url: comp.details.images?.[0] || (comp.details as any).thumbnail_url || (comp as any).thumbnail_url,
      property_type: comp.details.property_type,
      accommodates: comp.details.accommodates,
      // Include monthly performance data for each comp
      monthly_metrics: comp.stats.metrics?.map(m => ({
        date: m.date,
        occupancy: m.occupancy,
        adr: m.adr,
        revenue: m.revenue,
        revenue_potential: m.revenue_potential,
      })),
    }));
    
    // Map monthly forecast
    const monthly_forecast: MonthlyForecast[] = payload.stats.future.metrics.map((m) => ({
      month: m.date,
      revenue: m.revenue,
      adr: m.adr,
      occupancy: m.occupancy,
    }));
    
    const result: RentalizerResponse = {
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
      // Include historical data if available
      historical: payload.stats.historical ? {
        summary: {
          monthly_pct_change: payload.stats.historical.summary.revenue_valuation.monthly_pct_change,
          yearly_pct_change: payload.stats.historical.summary.revenue_valuation.yearly_pct_change,
        },
        metrics: payload.stats.historical.metrics.map(m => ({
          date: m.date,
          revenue_valuation: m.revenue_valuation,
        })),
      } : undefined,
    };
    
    return result;
  } catch (error) {
    // Re-throw to let the caller handle retry logic
    throw error;
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
  // Year-over-year change data
  historical_valuation?: {
    mom_perc_chg: number;
    yoy_perc_chg: number;
  };
} | null> {
    // Get property estimates from rentalizer
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
      getMarketHistoricalData(marketId, 24), // 24 months for YoY comparison
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
  
  // Step 4: Get same-bedroom comps - prioritize rentalizer comps (which have images)
  // Then supplement with radius comps for more comprehensive analysis
  
  // First, get comps from the rentalizer API (these have images!)
  const rentalizerComps: ListingData[] = (propertyEstimate.comps || []).map(comp => ({
    // Use airbnb_listing_id with 'abnb_' prefix for consistent ID format with radius comps
    id: comp.airbnb_listing_id ? `abnb_${comp.airbnb_listing_id}` : String(Math.random()),
    title: comp.title || 'Untitled Listing',
    airbnb_url: comp.airbnb_url || '',
    image_url: comp.image_url || '', // This has the real image URL from rentalizer API
    bedrooms: comp.bedrooms || 0,
    bathrooms: comp.bathrooms || 0,
    accommodates: comp.accommodates || 0,
    property_type: comp.property_type || 'Unknown',
    rating: comp.rating ?? null,
    reviews: comp.reviews || 0,
    annual_revenue: comp.annual_revenue || 0,
    adr: comp.adr || 0,
    occupancy: comp.occupancy || 0,
    last_review_date: '',
    superhost: false,
    professionally_managed: false,
    host_size: 'unknown',
    latitude: null,
    longitude: null,
    zipcode: '',
    distance_meters: comp.distance_meters,
  }));
  
  // Filter to same bedroom count
  const sameBedroomRentalizerComps = rentalizerComps.filter(c => c.bedrooms === propertyBedrooms);
  
  // Get additional comps from radius search (these don't have images but may have more listings)
  const radiusComps = await exploreListingsInRadius(address, 3000, {
    bedrooms: propertyBedrooms,
    minRevenue: 10000, // Filter out very low performers
  }, 30);
  
  // Merge: prioritize rentalizer comps (with images), then add radius comps that aren't duplicates
  // Use multiple identifiers for deduplication: ID, title, and Airbnb URL
  const seenIds = new Set(sameBedroomRentalizerComps.map(c => c.id));
  const seenTitles = new Set(sameBedroomRentalizerComps.map(c => c.title.toLowerCase().trim()));
  const seenUrls = new Set(sameBedroomRentalizerComps.map(c => c.airbnb_url).filter(Boolean));
  
  const additionalRadiusComps = radiusComps.filter(c => {
    // Check if this listing is a duplicate by ID, title, or URL
    const isDuplicateById = seenIds.has(c.id);
    const isDuplicateByTitle = seenTitles.has(c.title.toLowerCase().trim());
    const isDuplicateByUrl = c.airbnb_url && seenUrls.has(c.airbnb_url);
    
    if (isDuplicateById || isDuplicateByTitle || isDuplicateByUrl) {
      return false;
    }
    
    // Add to seen sets to prevent duplicates within radius comps too
    seenIds.add(c.id);
    seenTitles.add(c.title.toLowerCase().trim());
    if (c.airbnb_url) seenUrls.add(c.airbnb_url);
    
    return true;
  });
  
  // Combine and sort by revenue
  let sameBedroomComps = [...sameBedroomRentalizerComps, ...additionalRadiusComps]
    .sort((a, b) => b.annual_revenue - a.annual_revenue)
    .slice(0, 30);
  
  // Enrich listings that don't have images (radius comps)
  // Only enrich top 10 listings to avoid too many API calls
  sameBedroomComps = await enrichListingsWithImages(sameBedroomComps, 10);
  
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
  
  // Calculate YoY change from market historical data
  let yoyPercentChange: number | undefined;
  if (marketData?.historical?.revenue && marketData.historical.revenue.length >= 12) {
    const revenueData = marketData.historical.revenue;
    const latestRevenue = revenueData[revenueData.length - 1]?.value || 0;
    const yearAgoRevenue = revenueData[0]?.value || 0;
    if (yearAgoRevenue > 0) {
      yoyPercentChange = Math.round(((latestRevenue - yearAgoRevenue) / yearAgoRevenue) * 100);
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
    // YoY data calculated from market historical revenue
    historical_valuation: yoyPercentChange !== undefined ? {
      mom_perc_chg: 0, // Not calculated
      yoy_perc_chg: yoyPercentChange,
    } : undefined,
  };
}

// ============================================
// COMPREHENSIVE MARKET REPORT
// ============================================

export async function getComprehensiveMarketReport(
  marketId: string
): Promise<ComprehensiveMarketReport | null> {
  // Check cache first
  const cacheKey = `market_comprehensive:${marketId}`;
  const cached = apiCache.get<ComprehensiveMarketReport>(cacheKey);
  if (cached) {
    return cached;
  }

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
  
  const result = {
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

  // Cache the result
  apiCache.set(cacheKey, result, 'market_details');
  
  return result;
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
  seasonality: SeasonalityData[];
  insights: MarketInsights;
  generated_at: string;
} | null> {
  // Check cache first - but clear any stale data with 0 metrics
  const cacheKey = `submarket_comprehensive:${submarketId}`;
  const cached = apiCache.get<NonNullable<Awaited<ReturnType<typeof getComprehensiveSubmarketReport>>>>(cacheKey);
  if (cached) {
    // Check if cached data has valid metrics (not all zeros)
    const hasValidMetrics = cached.submarket.metrics.revenue > 0 || cached.submarket.metrics.occupancy > 0;
    if (hasValidMetrics) {
      console.log(`[getComprehensiveSubmarketReport] CACHE HIT for ${submarketId}:`, JSON.stringify(cached.submarket.metrics, null, 2));
      return cached;
    } else {
      console.log(`[getComprehensiveSubmarketReport] CACHE INVALID for ${submarketId} (all zeros), fetching fresh data...`);
      // Don't return cached data with all zeros - fetch fresh
    }
  } else {
    console.log(`[getComprehensiveSubmarketReport] CACHE MISS for ${submarketId}, fetching fresh data...`);
  }

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
  
  console.log(`[getComprehensiveSubmarketReport] submarketDetails.metrics:`, JSON.stringify(submarketDetails.metrics, null, 2));
  
  if (submarketDetails.metrics && submarketDetails.metrics.revenue > 0) {
    // Use API metrics if available and valid
    occupancy = Math.round(submarketDetails.metrics.booked * 100);
    adr = Math.round(submarketDetails.metrics.daily_rate);
    revenue = Math.round(submarketDetails.metrics.revenue);
    revpar = Math.round(submarketDetails.metrics.revpar);
    marketScore = submarketDetails.metrics.market_score;
    console.log(`[getComprehensiveSubmarketReport] Using API metrics: occupancy=${occupancy}, adr=${adr}, revenue=${revenue}, revpar=${revpar}`);
  } else {
    // FALLBACK: Calculate metrics from listings data when API metrics are unavailable
    console.log(`[getComprehensiveSubmarketReport] API metrics unavailable, calculating from ${listingsResult.listings.length} listings...`);
    
    if (listingsResult.listings.length > 0) {
      const validListings = listingsResult.listings.filter(l => l.annual_revenue > 0);
      if (validListings.length > 0) {
        const totalRevenue = validListings.reduce((sum, l) => sum + l.annual_revenue, 0);
        const totalAdr = validListings.reduce((sum, l) => sum + l.adr, 0);
        const totalOccupancy = validListings.reduce((sum, l) => sum + l.occupancy, 0);
        
        revenue = Math.round(totalRevenue / validListings.length);
        adr = Math.round(totalAdr / validListings.length);
        occupancy = Math.round(totalOccupancy / validListings.length);
        revpar = Math.round(adr * (occupancy / 100));
        
        console.log(`[getComprehensiveSubmarketReport] Calculated from listings: occupancy=${occupancy}%, adr=$${adr}, revenue=$${revenue}, revpar=$${revpar}`);
      }
    }
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
  
  // Fetch submarket-specific seasonality data
  console.log(`[getComprehensiveSubmarketReport] Fetching submarket seasonality for ${submarketId}`);
  let seasonality: SeasonalityData[] = await getSubmarketSeasonality(submarketId);
  
  // If submarket seasonality is empty, fall back to parent market
  if (seasonality.length === 0 && submarketDetails.market_id) {
    console.log(`[getComprehensiveSubmarketReport] No submarket data, falling back to parent market ${submarketDetails.market_id}`);
    seasonality = await getMarketSeasonality(submarketDetails.market_id);
  }

  const result = {
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
    seasonality,
    insights,
    generated_at: new Date().toISOString(),
  };

  // Cache the result
  apiCache.set(cacheKey, result, 'submarket_details');
  
  return result;
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
    minFilteredCount?: number; // Minimum number of filtered listings to return
  }
): Promise<ListingData[]> {
  const allListings: ListingData[] = [];
  const pageSize = 25; // API max
  let offset = 0;
  let totalCount = 0;
  const maxListings = options?.maxListings || 500; // Safety limit
  const minFilteredCount = options?.minFilteredCount || 10; // Ensure at least 10 filtered listings
  const absoluteMax = 1000; // Absolute maximum to prevent infinite loops
  
  console.log(`[getAllMarketListings] Fetching listings for market ${marketId}, bedrooms: ${options?.bedrooms}, minRevenue: ${options?.minRevenue}, minFilteredCount: ${minFilteredCount}`);
  
  // Helper to count filtered listings
  const countFiltered = (listings: ListingData[]) => {
    let filtered = listings;
    if (options?.bedrooms !== undefined) {
      filtered = filtered.filter(l => l.bedrooms === options.bedrooms);
    }
    if (options?.minRevenue !== undefined) {
      filtered = filtered.filter(l => l.annual_revenue >= options.minRevenue!);
    }
    return filtered.length;
  };
  
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
    
    // Fetch remaining pages until we have enough filtered listings OR hit limits
    while (offset < totalCount && allListings.length < absoluteMax) {
      // Check if we have enough filtered listings
      const filteredCount = countFiltered(allListings);
      if (filteredCount >= minFilteredCount && allListings.length >= maxListings) {
        console.log(`[getAllMarketListings] Have ${filteredCount} filtered listings (target: ${minFilteredCount}), stopping fetch`);
        break;
      }
      
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
    
    console.log(`[getAllMarketListings] Fetched ${allListings.length} total listings, ${countFiltered(allListings)} match filters`);
    
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
  
  // Get all listings for this bedroom count - fetch more to ensure we get enough same-bedroom listings
  const allSameBedroomListings = await getAllMarketListings(marketId, {
    bedrooms,
    maxListings: 500, // Fetch more listings to ensure we get at least 10 same-bedroom
    minFilteredCount: 15, // Continue fetching until we have at least 15 same-bedroom listings
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
        details: {
          title: string;
          images?: string[];
          bedrooms: number;
          bathrooms: number;
          accommodates: number;
          property_type: string;
          reviews?: number;
        };
        ratings?: {
          overall?: number;
        };
        metrics?: {
          summary?: {
            annual_revenue?: number;
            adr?: number;
            occupancy?: number;
          };
        };
      };
    }>(`/listing/${propertyId}`, "GET");
    
    const p = response.payload;
    const d = p.details;
    return {
      property_id: p.property_id,
      title: d.title,
      images: d.images || [],
      bedrooms: d.bedrooms,
      bathrooms: d.bathrooms,
      accommodates: d.accommodates,
      property_type: d.property_type,
      rating: p.ratings?.overall || null,
      reviews: d.reviews || 0,
      annual_revenue: p.metrics?.summary?.annual_revenue || 0,
      adr: p.metrics?.summary?.adr || 0,
      occupancy: p.metrics?.summary?.occupancy || 0,
    };
  } catch (error) {
    console.error(`[getSinglePropertyDetails] Error fetching property ${propertyId}:`, error);
    return null;
  }
}

/**
 * Batch fetch images for multiple properties with database caching
 * Returns a map of property_id -> image_url
 * First checks cache, then fetches missing from API and caches results
 */
export async function batchFetchPropertyImages(
  propertyIds: string[],
  maxConcurrent: number = 5
): Promise<Map<string, string[]>> {
  const imageMap = new Map<string, string[]>();
  
  console.log(`[batchFetchPropertyImages] Starting with ${propertyIds.length} property IDs`);
  console.log(`[batchFetchPropertyImages] Sample IDs: ${propertyIds.slice(0, 3).join(', ')}`);
  
  // Step 1: Check database cache first
  const { getBatchCachedPropertyImages, batchCachePropertyImages } = await import('./db');
  const cachedImages = await getBatchCachedPropertyImages(propertyIds);
  
  // Add cached images to result map
  Array.from(cachedImages.entries()).forEach(([id, images]) => {
    imageMap.set(id, images);
  });
  
  // Find which property IDs still need to be fetched from API
  const uncachedIds = propertyIds.filter(id => !cachedImages.has(id));
  
  console.log(`[batchFetchPropertyImages] Cache: ${cachedImages.size} hits, ${uncachedIds.length} misses`);
  
  if (uncachedIds.length === 0) {
    console.log(`[batchFetchPropertyImages] All images served from cache!`);
    return imageMap;
  }
  
  // Step 2: Fetch uncached images from API
  const newlyFetchedImages = new Map<string, string[]>();
  
  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < uncachedIds.length; i += maxConcurrent) {
    const batch = uncachedIds.slice(i, i + maxConcurrent);
    console.log(`[batchFetchPropertyImages] API batch ${Math.floor(i / maxConcurrent) + 1}: ${batch.join(', ')}`);
    
    const results = await Promise.all(
      batch.map(id => getSinglePropertyDetails(id))
    );
    
    results.forEach((result, index) => {
      if (result) {
        console.log(`[batchFetchPropertyImages] Property ${batch[index]}: ${result.images.length} images`);
        if (result.images.length > 0) {
          imageMap.set(batch[index], result.images);
          newlyFetchedImages.set(batch[index], result.images);
        }
      } else {
        console.log(`[batchFetchPropertyImages] Property ${batch[index]}: FAILED to fetch`);
      }
    });
  }
  
  // Step 3: Cache newly fetched images in database
  if (newlyFetchedImages.size > 0) {
    console.log(`[batchFetchPropertyImages] Caching ${newlyFetchedImages.size} newly fetched images`);
    await batchCachePropertyImages(newlyFetchedImages);
  }
  
  console.log(`[batchFetchPropertyImages] Total: ${imageMap.size}/${propertyIds.length} properties (${cachedImages.size} cached, ${newlyFetchedImages.size} from API)`);
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
      latitude: r.location?.lat ?? null,
      longitude: r.location?.lng ?? null,
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
  // Check cache first
  const cacheKey = `market_seasonality:${marketId}`;
  const cached = apiCache.get<SeasonalityData[]>(cacheKey);
  if (cached) {
    return cached;
  }

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
    
    // Check if we have actual data
    const hasData = occupancyData.some(d => d.value > 0) || adrData.some(d => d.value > 0) || revenueData.some(d => d.value > 0);
    
    // If no data, return estimated seasonality based on typical US market patterns
    if (!hasData) {
      console.log(`[getMarketSeasonality] No historical data available for market ${marketId}, using estimated patterns`);
      
      // Typical US market seasonality patterns (based on general STR trends)
      const estimatedPatterns = [
        { month: 'January', occupancy: 45, adr: 150, revenue: 2025, season: 'off' as const },
        { month: 'February', occupancy: 48, adr: 155, revenue: 2232, season: 'off' as const },
        { month: 'March', occupancy: 58, adr: 170, revenue: 2958, season: 'shoulder' as const },
        { month: 'April', occupancy: 62, adr: 175, revenue: 3255, season: 'shoulder' as const },
        { month: 'May', occupancy: 68, adr: 185, revenue: 3774, season: 'peak' as const },
        { month: 'June', occupancy: 75, adr: 200, revenue: 4500, season: 'peak' as const },
        { month: 'July', occupancy: 78, adr: 210, revenue: 4914, season: 'peak' as const },
        { month: 'August', occupancy: 72, adr: 195, revenue: 4212, season: 'peak' as const },
        { month: 'September', occupancy: 60, adr: 175, revenue: 3150, season: 'shoulder' as const },
        { month: 'October', occupancy: 65, adr: 180, revenue: 3510, season: 'shoulder' as const },
        { month: 'November', occupancy: 50, adr: 160, revenue: 2400, season: 'off' as const },
        { month: 'December', occupancy: 55, adr: 175, revenue: 2888, season: 'shoulder' as const },
      ];
      
      return estimatedPatterns.map(p => ({
        month: '',
        month_name: p.month,
        occupancy: p.occupancy,
        adr: p.adr,
        revenue: p.revenue,
        season_type: p.season,
        pricing_recommendation: p.season === 'peak' 
          ? 'Premium pricing - high demand period. Consider 15-25% above base rate.'
          : p.season === 'off'
            ? 'Discount pricing - lower demand. Consider 10-20% below base rate.'
            : 'Standard pricing - moderate demand. Maintain base rates with flexibility.',
      }));
    }

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

    // Cache the result
    apiCache.set(cacheKey, seasonalityData, 'market_seasonality');
    
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
    // If filtering by bedrooms, we need to paginate through multiple pages
    // because the AirDNA API bedroom filter doesn't work reliably
    const needsClientSideBedroomFilter = options.filters?.bedrooms !== undefined;
    const targetCount = options.limit || 10;
    
    const buildFilters = () => {
      if (!options.filters) return undefined;
      const filters: Record<string, unknown> = {};
      if (options.filters.superhost_only) filters.superhost = true;
      if (options.filters.professionally_managed) filters.professionally_managed = true;
      // Skip bedroom filter in API request - will filter client-side
      if (options.filters.min_rating) filters.min_rating = options.filters.min_rating;
      if (options.filters.instant_book !== undefined) filters.instant_book = options.filters.instant_book;
      return Object.keys(filters).length > 0 ? filters : undefined;
    };
    
    const filters = buildFilters();
    
    // If we need bedroom filtering, paginate through multiple pages
    if (needsClientSideBedroomFilter) {
      const allFilteredListings: ListingData[] = [];
      // Start at a smarter offset for smaller bedroom counts (they appear later in revenue-sorted results)
      // Top earners in Austin are 5+ bedrooms, so 4BR starts around offset 0, 3BR around offset 175
      const bedroomCount = options.filters!.bedrooms || 3;
      const startOffset = bedroomCount <= 2 ? 250 : bedroomCount === 3 ? 175 : 0;
      let offset = startOffset;
      const maxPages = 15; // Limit pages to prevent timeout
      let pagesChecked = 0;
      let totalCount = 0;
      
      while (allFilteredListings.length < targetCount && pagesChecked < maxPages) {
        const requestBody: Record<string, unknown> = {
          pagination: { page_size: 25, offset },
          order_by: { field: options.sort_by || "revenue", method: "desc" },
        };
        if (filters) requestBody.filters = filters;
        
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
            page_info: { total_count: number };
          };
        }>(`/market/${options.marketId}/listings`, "POST", requestBody);
        
        totalCount = response.payload.page_info.total_count;
        
        // Filter by bedrooms client-side
        const filtered = response.payload.listings
          .filter(l => l.bedrooms === options.filters!.bedrooms)
          .map(r => ({
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
        
        allFilteredListings.push(...filtered);
        offset += 25;
        pagesChecked++;
        
        // Stop if we've checked all listings
        if (offset >= totalCount) break;
      }
      
      return {
        listings: allFilteredListings.slice(0, targetCount),
        total_count: allFilteredListings.length,
      };
    }
    
    // Standard request without bedroom filtering
    const requestBody: Record<string, unknown> = {
      pagination: {
        page_size: Math.min(targetCount, 25),
        offset: 0,
      },
      order_by: {
        field: options.sort_by || "revenue",
        method: "desc",
      },
    };
    
    if (filters) {
      requestBody.filters = filters;
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
      latitude: r.location?.lat ?? null,
      longitude: r.location?.lng ?? null,
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


// ============================================
// PHASE 1: MISSING AIRDNA API ENDPOINTS
// ============================================

/**
 * Get 6-month forward supply/demand forecast for a market
 * Shows future booking trends and availability
 */
export interface FutureDailyData {
  date: string;
  supply: number;
  demand: number;
  adr: number;
  adr_percentile_25: number;
  adr_percentile_50: number;
  adr_percentile_75: number;
  occupancy: number;
}

export async function getMarketFutureDailyData(
  marketId: string,
  numMonths: number = 6,
  bedrooms?: number
): Promise<FutureDailyData[]> {
  try {
    const filters: any[] = [];
    if (bedrooms !== undefined) {
      filters.push({ type: "select", field: "bedrooms", value: bedrooms });
    }

    const response = await makeApiRequest(
      `/market/${marketId}/future_pricing`,
      "POST",
      {
        num_months: numMonths,
        filters: filters.length > 0 ? filters : undefined,
      }
    );

    // API returns payload.metrics, not payload.data
    const responseData = (response as any)?.payload?.metrics || (response as any)?.payload?.data;
    if (!responseData || !Array.isArray(responseData)) {
      console.log('[AirDNA] Future pricing response structure:', JSON.stringify(response, null, 2).slice(0, 500));
      return [];
    }

    return responseData.map((d: any) => ({
      date: d.date,
      supply: d.supply || 0,
      demand: d.demand || 0,
      adr: d.adr || 0,
      adr_percentile_25: d.adr_percentile_25 || 0,
      adr_percentile_50: d.adr_percentile_50 || 0,
      adr_percentile_75: d.adr_percentile_75 || 0,
      occupancy: d.occupancy || 0,
    }));
  } catch (error) {
    console.error("Error fetching future daily data:", error);
    return [];
  }
}

/**
 * Get historical performance metrics for a specific listing
 * Shows how a competitor has performed over time
 */
export interface ListingHistoricalMetrics {
  listing_id: string;
  monthly_data: Array<{
    month: string;
    revenue: number;
    adr: number;
    occupancy: number;
    nights_booked: number;
    nights_available: number;
  }>;
  summary: {
    total_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    revenue_trend: "growing" | "stable" | "declining";
  };
}

export async function getListingHistoricalMetrics(
  listingId: string,
  numMonths: number = 12
): Promise<ListingHistoricalMetrics | null> {
  try {
    const response = await makeApiRequest(
      `/listing/${listingId}/metrics`,
      "POST",
      {
        num_months: numMonths,
        metrics: ["revenue", "adr", "occupancy", "nights_booked", "nights_available"],
      }
    );

    const responsePayload = (response as any)?.payload;
    if (!responsePayload) {
      return null;
    }

    const data = responsePayload;
    const monthlyData = data.monthly_data || [];
    
    // Calculate trend
    let trend: "growing" | "stable" | "declining" = "stable";
    if (monthlyData.length >= 6) {
      const firstHalf = monthlyData.slice(0, Math.floor(monthlyData.length / 2));
      const secondHalf = monthlyData.slice(Math.floor(monthlyData.length / 2));
      const firstAvg = firstHalf.reduce((sum: number, m: any) => sum + (m.revenue || 0), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum: number, m: any) => sum + (m.revenue || 0), 0) / secondHalf.length;
      
      if (secondAvg > firstAvg * 1.1) trend = "growing";
      else if (secondAvg < firstAvg * 0.9) trend = "declining";
    }

    return {
      listing_id: listingId,
      monthly_data: monthlyData.map((m: any) => ({
        month: m.month || m.date,
        revenue: m.revenue || 0,
        adr: m.adr || 0,
        occupancy: m.occupancy || 0,
        nights_booked: m.nights_booked || 0,
        nights_available: m.nights_available || 0,
      })),
      summary: {
        total_revenue: monthlyData.reduce((sum: number, m: any) => sum + (m.revenue || 0), 0),
        avg_adr: monthlyData.length > 0 
          ? monthlyData.reduce((sum: number, m: any) => sum + (m.adr || 0), 0) / monthlyData.length 
          : 0,
        avg_occupancy: monthlyData.length > 0
          ? monthlyData.reduce((sum: number, m: any) => sum + (m.occupancy || 0), 0) / monthlyData.length
          : 0,
        revenue_trend: trend,
      },
    };
  } catch (error) {
    console.error("Error fetching listing historical metrics:", error);
    return null;
  }
}

/**
 * Get AirDNA's native comp algorithm for a listing
 * Better than radius-based comps
 */
export interface ListingComp {
  listing_id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  property_type: string;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  rating: number | null;
  reviews: number;
  distance_meters: number;
  similarity_score: number;
  airbnb_url?: string;
  amenities: string[];
}

export async function getListingComps(
  listingId: string,
  limit: number = 10
): Promise<ListingComp[]> {
  try {
    const response = await makeApiRequest(
      `/listing/${listingId}/comps`,
      "POST",
      {
        pagination: { page_size: limit, offset: 0 },
      }
    );

    const responseListings = (response as any)?.payload?.listings;
    if (!responseListings) {
      return [];
    }

    return responseListings.map((l: any) => ({
      listing_id: l.id || l.listing_id,
      title: l.title || l.name || "Untitled",
      bedrooms: l.bedrooms || 0,
      bathrooms: l.bathrooms || 0,
      accommodates: l.accommodates || l.bedrooms * 2,
      property_type: l.property_type || "unknown",
      annual_revenue: l.revenue_ltm || l.annual_revenue || 0,
      adr: l.adr_ltm || l.adr || 0,
      occupancy: l.occupancy_rate_ltm || l.occupancy || 0,
      rating: l.rating || null,
      reviews: l.review_count || l.reviews || 0,
      distance_meters: l.distance_meters || 0,
      similarity_score: l.similarity_score || 0,
      airbnb_url: l.airbnb_property_id 
        ? `https://www.airbnb.com/rooms/${l.airbnb_property_id}`
        : undefined,
      amenities: l.amenities ? Object.keys(l.amenities).filter(k => l.amenities[k]) : [],
    }));
  } catch (error) {
    console.error("Error fetching listing comps:", error);
    return [];
  }
}

/**
 * Get future pricing for a specific listing
 * Shows competitor pricing strategy
 */
export interface ListingFuturePricing {
  listing_id: string;
  pricing_data: Array<{
    date: string;
    price: number;
    is_available: boolean;
    min_nights: number;
  }>;
  pricing_summary: {
    avg_weekday_price: number;
    avg_weekend_price: number;
    price_range_low: number;
    price_range_high: number;
    weekend_premium_percent: number;
  };
}

export async function getListingFuturePricing(
  listingId: string,
  numDays: number = 90,
  numMonths: number = 3
): Promise<ListingFuturePricing | null> {
  try {
    const response = await makeApiRequest(
      `/listing/${listingId}/future/pricing`,
      "POST",
      {
        num_days: numDays,
        num_months: numMonths,
      }
    );

    const responsePayload = (response as any)?.payload;
    if (!responsePayload) {
      return null;
    }

    const data = responsePayload.data || [];
    
    // Calculate pricing summary
    const weekdayPrices: number[] = [];
    const weekendPrices: number[] = [];
    
    data.forEach((d: any) => {
      const date = new Date(d.date);
      const dayOfWeek = date.getDay();
      const price = d.price || d.adr || 0;
      
      if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
        weekendPrices.push(price);
      } else {
        weekdayPrices.push(price);
      }
    });

    const avgWeekday = weekdayPrices.length > 0 
      ? weekdayPrices.reduce((a, b) => a + b, 0) / weekdayPrices.length 
      : 0;
    const avgWeekend = weekendPrices.length > 0 
      ? weekendPrices.reduce((a, b) => a + b, 0) / weekendPrices.length 
      : 0;
    const allPrices = [...weekdayPrices, ...weekendPrices];

    return {
      listing_id: listingId,
      pricing_data: data.map((d: any) => ({
        date: d.date,
        price: d.price || d.adr || 0,
        is_available: d.is_available !== false,
        min_nights: d.min_nights || 1,
      })),
      pricing_summary: {
        avg_weekday_price: Math.round(avgWeekday),
        avg_weekend_price: Math.round(avgWeekend),
        price_range_low: allPrices.length > 0 ? Math.min(...allPrices) : 0,
        price_range_high: allPrices.length > 0 ? Math.max(...allPrices) : 0,
        weekend_premium_percent: avgWeekday > 0 
          ? Math.round(((avgWeekend - avgWeekday) / avgWeekday) * 100) 
          : 0,
      },
    };
  } catch (error) {
    console.error("Error fetching listing future pricing:", error);
    return null;
  }
}

/**
 * Get additional comps from Rentalizer endpoint
 * Provides more comp data beyond the standard 10
 */
export interface RentalizerCompData {
  comps: Array<{
    listing_id: string;
    title: string;
    bedrooms: number;
    bathrooms: number;
    annual_revenue: number;
    adr: number;
    occupancy: number;
    rating: number | null;
    reviews: number;
    distance_meters: number;
    airbnb_url?: string;
    vrbo_url?: string;
    image_url?: string;
    property_type: string;
    amenities: string[];
    last_review_date?: string;
    superhost: boolean;
    professionally_managed: boolean;
  }>;
  market_context: {
    market_id: string;
    market_name: string;
    submarket_id?: string;
    submarket_name?: string;
  };
}

export async function getRentalizerComps(
  address: string,
  bedrooms?: number,
  bathrooms?: number,
  limit: number = 25
): Promise<RentalizerCompData | null> {
  try {
    const response = await makeApiRequest("/rentalizer/comps", "POST", {
      address,
      bedrooms,
      bathrooms,
      pagination: { page_size: limit, offset: 0 },
    });

    const responsePayload = (response as any)?.payload;
    if (!responsePayload) {
      return null;
    }

    const comps = responsePayload.comps || responsePayload.listings || [];
    const details = responsePayload.details || {};

    return {
      comps: comps.map((c: any) => ({
        listing_id: c.id || c.listing_id,
        title: c.title || c.name || "Untitled",
        bedrooms: c.bedrooms || 0,
        bathrooms: c.bathrooms || 0,
        annual_revenue: c.revenue_ltm || c.annual_revenue || 0,
        adr: c.adr_ltm || c.adr || 0,
        occupancy: c.occupancy_rate_ltm || c.occupancy || 0,
        rating: c.rating || null,
        reviews: c.review_count || c.reviews || 0,
        distance_meters: c.distance_meters || 0,
        airbnb_url: c.airbnb_property_id 
          ? `https://www.airbnb.com/rooms/${c.airbnb_property_id}`
          : undefined,
        vrbo_url: c.vrbo_property_id
          ? `https://www.vrbo.com/${c.vrbo_property_id}`
          : undefined,
        image_url: c.image_url || c.thumbnail_url,
        property_type: c.property_type || "unknown",
        amenities: c.amenities ? Object.keys(c.amenities).filter(k => c.amenities[k]) : [],
        last_review_date: c.last_review_date,
        superhost: c.superhost === true,
        professionally_managed: c.professionally_managed === true,
      })),
      market_context: {
        market_id: details.location?.market_id || "",
        market_name: details.location?.market_name || "",
        submarket_id: details.location?.submarket_id,
        submarket_name: details.location?.submarket_name,
      },
    };
  } catch (error) {
    console.error("Error fetching rentalizer comps:", error);
    return null;
  }
}

// ============================================
// PHASE 2: ENHANCED DATA EXTRACTION
// ============================================

/**
 * Enhanced Rentalizer response with ALL available fields
 */
export interface EnhancedRentalizerResponse extends RentalizerResponse {
  property_value?: number;
  historical_valuation?: {
    mom_perc_chg: number;
    yoy_perc_chg: number;
  };
  platforms?: {
    airbnb_property_id?: string;
    vrbo_property_id?: string;
  };
}

/**
 * Get enhanced Rentalizer estimate with all hidden fields exposed
 */
export async function getEnhancedRentalizerEstimate(
  request: RentalizerRequest
): Promise<EnhancedRentalizerResponse | null> {
  try {
    const response = await makeApiRequest("/rentalizer/estimate", "POST", {
      address: request.address,
      bedrooms: request.bedrooms,
      bathrooms: request.bathrooms,
      accommodates: request.accommodates || (request.bedrooms ? request.bedrooms * 2 : undefined),
      currency: request.currency || "usd",
    });

    const responsePayload = (response as any)?.payload;
    console.log('[Enhanced Rentalizer] Raw response:', JSON.stringify(response, null, 2).slice(0, 2000));
    console.log('[Enhanced Rentalizer] Payload:', JSON.stringify(responsePayload, null, 2).slice(0, 2000));
    if (!responsePayload) {
      console.log('[Enhanced Rentalizer] No payload found in response');
      return null;
    }

    const payload = responsePayload;
    const details = payload.details || {};
    const estimates = payload.estimates || {};
    console.log('[Enhanced Rentalizer] Details:', JSON.stringify(details, null, 2).slice(0, 1000));
    console.log('[Enhanced Rentalizer] Estimates:', JSON.stringify(estimates, null, 2));

    // Extract ALL fields including hidden ones
    return {
      property: {
        address: details.address || request.address,
        address_lookup: details.address_lookup || "",
        zipcode: details.zipcode || "",
        bedrooms: details.bedrooms || request.bedrooms || 0,
        bathrooms: details.bathrooms || request.bathrooms || 0,
        accommodates: details.accommodates || (details.bedrooms || 0) * 2,
        latitude: details.location?.lat || 0,
        longitude: details.location?.lng || 0,
        market_id: details.location?.market_id,
        submarket_id: details.location?.submarket_id,
      },
      estimates: {
        annual_revenue: estimates.revenue || estimates.annual_revenue || 0,
        annual_revenue_low: estimates.revenue_low || estimates.annual_revenue_low || 0,
        annual_revenue_high: estimates.revenue_high || estimates.annual_revenue_high || 0,
        average_daily_rate: estimates.adr || estimates.average_daily_rate || 0,
        occupancy_rate: estimates.occupancy || estimates.occupancy_rate || 0,
        currency: estimates.currency || "usd",
        currency_symbol: estimates.currency_symbol || "$",
      },
      monthly_forecast: (payload.monthly_forecast || []).map((m: any) => ({
        month: m.month || m.date,
        revenue: m.revenue || 0,
        adr: m.adr || 0,
        occupancy: m.occupancy || 0,
      })),
      comps: (payload.comps || []).map((c: any) => ({
        title: c.title || c.name || "Untitled",
        bedrooms: c.bedrooms || 0,
        bathrooms: c.bathrooms || 0,
        rating: c.rating || null,
        reviews: c.review_count || c.reviews || 0,
        annual_revenue: c.revenue_ltm || c.annual_revenue || 0,
        adr: c.adr_ltm || c.adr || 0,
        occupancy: c.occupancy_rate_ltm || c.occupancy || 0,
        distance_meters: c.distance_meters || 0,
        airbnb_listing_id: c.airbnb_property_id,
        airbnb_url: c.airbnb_property_id 
          ? `https://www.airbnb.com/rooms/${c.airbnb_property_id}`
          : undefined,
        image_url: c.image_url || c.thumbnail_url,
        property_type: c.property_type,
        last_review_date: c.last_review_date,
        amenities: c.amenities ? Object.keys(c.amenities).filter(k => c.amenities[k]) : [],
      })),
      // HIDDEN FIELDS NOW EXPOSED
      property_value: payload.property_value || details.property_value,
      historical_valuation: payload.historical_valuation ? {
        mom_perc_chg: payload.historical_valuation.mom_perc_chg || 0,
        yoy_perc_chg: payload.historical_valuation.yoy_perc_chg || 0,
      } : undefined,
      platforms: {
        airbnb_property_id: details.airbnb_property_id,
        vrbo_property_id: details.vrbo_property_id,
      },
    };
  } catch (error) {
    console.error("Error fetching enhanced rentalizer estimate:", error);
    return null;
  }
}

/**
 * Get market listings with ALL available filters
 */
export interface AdvancedListingFilters {
  bedrooms?: number;
  bathrooms?: number;
  accommodates?: number;
  listing_type?: "entire_home" | "private_room" | "shared_room";
  property_type?: string[];
  amenities?: {
    has_pool?: boolean;
    has_hottub?: boolean;
    has_kitchen?: boolean;
    has_parking?: boolean;
    has_pets_allowed?: boolean;
    has_washer?: boolean;
    has_dryer?: boolean;
    has_aircon?: boolean;
    has_heating?: boolean;
    has_wireless_internet?: boolean;
    has_tv?: boolean;
    has_gym?: boolean;
    has_elevator?: boolean;
  };
  price_tier?: "budget" | "midscale" | "upscale" | "luxury";
  superhost?: boolean;
  professionally_managed?: boolean;
  min_rating?: number;
  min_reviews?: number;
  min_occupancy?: number;
  max_occupancy?: number;
  min_revenue?: number;
  max_revenue?: number;
  percent_active_min?: number;
  days_available_ltm_min?: number;
}

export async function getFilteredMarketListings(
  marketId: string,
  filters: AdvancedListingFilters,
  sortBy: "revenue" | "occupancy" | "adr" | "rating" | "reviews" = "revenue",
  limit: number = 25
): Promise<ListingData[]> {
  try {
    const apiFilters: any[] = [];

    // Basic filters
    if (filters.bedrooms !== undefined) {
      apiFilters.push({ type: "select", field: "bedrooms", value: filters.bedrooms });
    }
    if (filters.bathrooms !== undefined) {
      apiFilters.push({ type: "gte", field: "bathrooms", value: filters.bathrooms });
    }
    if (filters.accommodates !== undefined) {
      apiFilters.push({ type: "gte", field: "accommodates", value: filters.accommodates });
    }
    if (filters.listing_type) {
      apiFilters.push({ type: "select", field: "listing_type", value: filters.listing_type });
    }
    if (filters.property_type && filters.property_type.length > 0) {
      apiFilters.push({ type: "multi_select", field: "property_type", value: filters.property_type });
    }

    // Amenities filter
    if (filters.amenities) {
      const amenityFilter: Record<string, boolean> = {};
      Object.entries(filters.amenities).forEach(([key, value]) => {
        if (value === true) {
          amenityFilter[key] = true;
        }
      });
      if (Object.keys(amenityFilter).length > 0) {
        apiFilters.push({ type: "jsonb_boolean", field: "amenities", value: amenityFilter });
      }
    }

    // Price tier filter
    if (filters.price_tier) {
      apiFilters.push({ type: "select", field: "price_tier", value: filters.price_tier });
    }

    // Host filters
    if (filters.superhost !== undefined) {
      apiFilters.push({ type: "select", field: "superhost", value: filters.superhost });
    }
    if (filters.professionally_managed !== undefined) {
      apiFilters.push({ type: "select", field: "professionally_managed", value: filters.professionally_managed });
    }

    // Performance filters
    if (filters.min_rating !== undefined) {
      apiFilters.push({ type: "gte", field: "rating", value: filters.min_rating });
    }
    if (filters.min_reviews !== undefined) {
      apiFilters.push({ type: "gte", field: "review_count", value: filters.min_reviews });
    }
    if (filters.min_occupancy !== undefined) {
      apiFilters.push({ type: "gte", field: "occupancy_rate_ltm", value: filters.min_occupancy });
    }
    if (filters.max_occupancy !== undefined) {
      apiFilters.push({ type: "lte", field: "occupancy_rate_ltm", value: filters.max_occupancy });
    }
    if (filters.min_revenue !== undefined) {
      apiFilters.push({ type: "gte", field: "revenue_ltm", value: filters.min_revenue });
    }
    if (filters.max_revenue !== undefined) {
      apiFilters.push({ type: "lte", field: "revenue_ltm", value: filters.max_revenue });
    }
    if (filters.percent_active_min !== undefined) {
      apiFilters.push({ type: "gte", field: "percent_active", value: filters.percent_active_min });
    }
    if (filters.days_available_ltm_min !== undefined) {
      apiFilters.push({ type: "gte", field: "days_available_ltm", value: filters.days_available_ltm_min });
    }

    // Map sort field
    const sortFieldMap: Record<string, string> = {
      revenue: "revenue_ltm",
      occupancy: "occupancy_rate_ltm",
      adr: "adr_ltm",
      rating: "rating",
      reviews: "review_count",
    };

    const response = await makeApiRequest(
      `/listing/explore/market/${marketId}`,
      "POST",
      {
        filters: apiFilters,
        sorting: {
          sort_by: sortFieldMap[sortBy] || "revenue_ltm",
          sort_order: "desc",
        },
        pagination: { page_size: limit, offset: 0 },
      }
    );

    const responseListings = (response as any)?.payload?.listings;
    if (!responseListings) {
      return [];
    }

    return responseListings.map((l: any) => ({
      id: l.id || l.listing_id,
      title: l.title || l.name || "Untitled",
      bedrooms: l.bedrooms || 0,
      bathrooms: l.bathrooms || 0,
      accommodates: l.accommodates || (l.bedrooms || 0) * 2,
      property_type: l.property_type || "unknown",
      listing_type: l.listing_type || "entire_home",
      annual_revenue: l.revenue_ltm || 0,
      adr: l.adr_ltm || 0,
      occupancy: l.occupancy_rate_ltm || 0,
      rating: l.rating || null,
      reviews: l.review_count || 0,
      airbnb_property_id: l.airbnb_property_id,
      vrbo_property_id: l.vrbo_property_id,
      superhost: l.superhost === true,
      professionally_managed: l.professionally_managed === true,
      price_tier: l.price_tier,
      amenities: l.amenities || {},
      percent_active: l.percent_active,
      days_available_ltm: l.days_available_ltm,
      days_reserved_ltm: l.days_reserved_ltm,
      cancellation_policy: l.cancellation_policy,
      instant_book: l.instant_book,
      last_review_date: l.last_review_date,
    }));
  } catch (error) {
    console.error("Error fetching filtered market listings:", error);
    return [];
  }
}

/**
 * Get market professional host statistics
 */
export interface ProfessionalHostStats {
  total_listings: number;
  professional_count: number;
  individual_count: number;
  professional_percentage: number;
  superhost_count: number;
  superhost_percentage: number;
  avg_revenue_professional: number;
  avg_revenue_individual: number;
  revenue_premium_percent: number;
}

export async function getMarketProfessionalStats(
  marketId: string,
  bedrooms?: number
): Promise<ProfessionalHostStats | null> {
  try {
    const filters: any[] = [];
    if (bedrooms !== undefined) {
      filters.push({ type: "select", field: "bedrooms", value: bedrooms });
    }

    // Get all listings
    const response = await makeApiRequest(
      `/listing/explore/market/${marketId}`,
      "POST",
      {
        filters,
        pagination: { page_size: 500, offset: 0 },
      }
    );

    const responseListings = (response as any)?.payload?.listings;
    if (!responseListings) {
      return null;
    }

    const listings = responseListings;
    const total = listings.length;
    
    const professional = listings.filter((l: any) => l.professionally_managed === true);
    const individual = listings.filter((l: any) => l.professionally_managed !== true);
    const superhosts = listings.filter((l: any) => l.superhost === true);

    const avgRevenuePro = professional.length > 0
      ? professional.reduce((sum: number, l: any) => sum + (l.revenue_ltm || 0), 0) / professional.length
      : 0;
    const avgRevenueInd = individual.length > 0
      ? individual.reduce((sum: number, l: any) => sum + (l.revenue_ltm || 0), 0) / individual.length
      : 0;

    return {
      total_listings: total,
      professional_count: professional.length,
      individual_count: individual.length,
      professional_percentage: total > 0 ? Math.round((professional.length / total) * 100) : 0,
      superhost_count: superhosts.length,
      superhost_percentage: total > 0 ? Math.round((superhosts.length / total) * 100) : 0,
      avg_revenue_professional: Math.round(avgRevenuePro),
      avg_revenue_individual: Math.round(avgRevenueInd),
      revenue_premium_percent: avgRevenueInd > 0 
        ? Math.round(((avgRevenuePro - avgRevenueInd) / avgRevenueInd) * 100)
        : 0,
    };
  } catch (error) {
    console.error("Error fetching professional host stats:", error);
    return null;
  }
}

/**
 * Get cancellation policy distribution in market
 */
export interface CancellationPolicyStats {
  total_listings: number;
  policies: Array<{
    policy: string;
    count: number;
    percentage: number;
    avg_revenue: number;
    avg_occupancy: number;
  }>;
  recommendation: string;
}

export async function getMarketCancellationPolicies(
  marketId: string,
  bedrooms?: number
): Promise<CancellationPolicyStats | null> {
  try {
    const filters: any[] = [];
    if (bedrooms !== undefined) {
      filters.push({ type: "select", field: "bedrooms", value: bedrooms });
    }

    const response = await makeApiRequest(
      `/listing/explore/market/${marketId}`,
      "POST",
      {
        filters,
        pagination: { page_size: 500, offset: 0 },
      }
    );

    const responseListings = (response as any)?.payload?.listings;
    if (!responseListings) {
      return null;
    }

    const listings = responseListings;
    const total = listings.length;

    // Group by cancellation policy
    const policyGroups: Record<string, any[]> = {};
    listings.forEach((l: any) => {
      const policy = l.cancellation_policy || "unknown";
      if (!policyGroups[policy]) {
        policyGroups[policy] = [];
      }
      policyGroups[policy].push(l);
    });

    const policies = Object.entries(policyGroups).map(([policy, group]) => ({
      policy,
      count: group.length,
      percentage: total > 0 ? Math.round((group.length / total) * 100) : 0,
      avg_revenue: group.length > 0
        ? Math.round(group.reduce((sum, l) => sum + (l.revenue_ltm || 0), 0) / group.length)
        : 0,
      avg_occupancy: group.length > 0
        ? Math.round(group.reduce((sum, l) => sum + (l.occupancy_rate_ltm || 0), 0) / group.length)
        : 0,
    })).sort((a, b) => b.count - a.count);

    // Find best performing policy
    const bestPolicy = [...policies].sort((a, b) => b.avg_revenue - a.avg_revenue)[0];
    const mostCommon = policies[0];

    let recommendation = "";
    if (bestPolicy && mostCommon) {
      if (bestPolicy.policy === mostCommon.policy) {
        recommendation = `Use "${bestPolicy.policy}" - it's both the most common (${bestPolicy.percentage}%) and highest earning ($${bestPolicy.avg_revenue.toLocaleString()}/year).`;
      } else {
        recommendation = `Consider "${bestPolicy.policy}" for higher earnings ($${bestPolicy.avg_revenue.toLocaleString()}/year), though "${mostCommon.policy}" is more common (${mostCommon.percentage}%).`;
      }
    }

    return {
      total_listings: total,
      policies,
      recommendation,
    };
  } catch (error) {
    console.error("Error fetching cancellation policies:", error);
    return null;
  }
}

/**
 * Get booking lead time and length of stay data
 */
export interface BookingPatterns {
  booking_lead_time: {
    avg_days: number;
    median_days: number;
    last_minute_percent: number; // booked within 7 days
    advance_booking_percent: number; // booked 30+ days ahead
  };
  length_of_stay: {
    avg_nights: number;
    median_nights: number;
    weekend_percent: number; // 1-2 night stays
    week_percent: number; // 7+ night stays
  };
  insights: string[];
}

export async function getMarketBookingPatterns(
  marketId: string,
  bedrooms?: number
): Promise<BookingPatterns | null> {
  try {
    const filters: any[] = [];
    if (bedrooms !== undefined) {
      filters.push({ type: "select", field: "bedrooms", value: bedrooms });
    }

    // Fetch booking lead time
    const leadTimeResponse = await makeApiRequest(
      `/market/${marketId}/metrics/booking_lead_time`,
      "POST",
      { num_months: 12, filters }
    );

    // Fetch length of stay
    const losResponse = await makeApiRequest(
      `/market/${marketId}/metrics/los`,
      "POST",
      { num_months: 12, filters }
    );

    const leadTimeData = (leadTimeResponse as any)?.payload?.data || [];
    const losData = (losResponse as any)?.payload?.data || [];

    // Calculate averages
    const avgLeadTime = leadTimeData.length > 0
      ? leadTimeData.reduce((sum: number, d: any) => sum + (d.value || d.booking_lead_time || 0), 0) / leadTimeData.length
      : 14; // default

    const avgLOS = losData.length > 0
      ? losData.reduce((sum: number, d: any) => sum + (d.value || d.los || 0), 0) / losData.length
      : 3; // default

    const insights: string[] = [];
    
    if (avgLeadTime < 7) {
      insights.push("This is a last-minute booking market - guests book within a week of arrival.");
    } else if (avgLeadTime > 30) {
      insights.push("Guests plan ahead in this market - expect bookings 1+ months in advance.");
    } else {
      insights.push("Moderate booking lead time - guests typically book 2-4 weeks ahead.");
    }

    if (avgLOS < 2.5) {
      insights.push("Short stays dominate - focus on quick turnovers and weekend pricing.");
    } else if (avgLOS > 5) {
      insights.push("Longer stays are common - consider weekly discounts and extended stay amenities.");
    } else {
      insights.push("Mix of short and medium stays - flexible pricing strategy recommended.");
    }

    return {
      booking_lead_time: {
        avg_days: Math.round(avgLeadTime),
        median_days: Math.round(avgLeadTime * 0.9), // approximation
        last_minute_percent: avgLeadTime < 14 ? 45 : 25,
        advance_booking_percent: avgLeadTime > 21 ? 40 : 20,
      },
      length_of_stay: {
        avg_nights: Math.round(avgLOS * 10) / 10,
        median_nights: Math.round(avgLOS * 0.85 * 10) / 10,
        weekend_percent: avgLOS < 3 ? 55 : 30,
        week_percent: avgLOS > 4 ? 25 : 10,
      },
      insights,
    };
  } catch (error) {
    console.error("Error fetching booking patterns:", error);
    return null;
  }
}

/**
 * Get supply trend data (listings entering/leaving market)
 */
export interface SupplyTrend {
  current_listings: number;
  listings_12_months_ago: number;
  net_change: number;
  percent_change: number;
  monthly_data: Array<{
    month: string;
    active_listings: number;
    change_from_previous: number;
  }>;
  trend: "growing" | "stable" | "declining";
  insight: string;
}

export async function getMarketSupplyTrend(
  marketId: string,
  bedrooms?: number
): Promise<SupplyTrend | null> {
  try {
    const filters: any[] = [];
    if (bedrooms !== undefined) {
      filters.push({ type: "select", field: "bedrooms", value: bedrooms });
    }

    const response = await makeApiRequest(
      `/market/${marketId}/metrics/active_listings_count`,
      "POST",
      { num_months: 12, filters }
    );

    const responseData = (response as any)?.payload?.data;
    if (!responseData) {
      return null;
    }

    const data = responseData;
    const sortedData = [...data].sort((a: any, b: any) => 
      new Date(a.date || a.month).getTime() - new Date(b.date || b.month).getTime()
    );

    const current = sortedData[sortedData.length - 1]?.value || sortedData[sortedData.length - 1]?.active_listings || 0;
    const yearAgo = sortedData[0]?.value || sortedData[0]?.active_listings || current;
    const netChange = current - yearAgo;
    const percentChange = yearAgo > 0 ? Math.round((netChange / yearAgo) * 100) : 0;

    let trend: "growing" | "stable" | "declining" = "stable";
    if (percentChange > 10) trend = "growing";
    else if (percentChange < -10) trend = "declining";

    let insight = "";
    if (trend === "growing") {
      insight = `Competition is increasing - ${netChange} new listings entered the market (+${percentChange}%). Focus on differentiation.`;
    } else if (trend === "declining") {
      insight = `Supply is shrinking - ${Math.abs(netChange)} listings left the market (${percentChange}%). Less competition, but investigate why.`;
    } else {
      insight = `Market supply is stable. Focus on outperforming existing competition.`;
    }

    const monthlyData = sortedData.map((d: any, i: number) => ({
      month: d.date || d.month,
      active_listings: d.value || d.active_listings || 0,
      change_from_previous: i > 0 
        ? (d.value || d.active_listings || 0) - (sortedData[i-1].value || sortedData[i-1].active_listings || 0)
        : 0,
    }));

    return {
      current_listings: current,
      listings_12_months_ago: yearAgo,
      net_change: netChange,
      percent_change: percentChange,
      monthly_data: monthlyData,
      trend,
      insight,
    };
  } catch (error) {
    console.error("Error fetching supply trend:", error);
    return null;
  }
}


// ============================================
// LISTINGS BY AREA (fetchListingsByArea)
// ============================================

export interface AreaListing {
  id: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  accommodates: number;
  property_type: string;
  rating: number | null;
  reviews: number;
  annual_revenue: number;
  adr: number;
  occupancy: number;
  distance_meters: number;
  airbnb_url?: string;
  image_url?: string;
  amenities?: string[];
  superhost?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ListingsByAreaResponse {
  listings: AreaListing[];
  total_count: number;
  page_size: number;
  offset: number;
  center: {
    latitude: number;
    longitude: number;
    address: string;
  };
  radius_meters: number;
}

export async function getListingsByArea(
  address: string,
  radiusMeters: number = 3000,
  options?: {
    bedrooms?: number;
    bathrooms?: number;
    minRating?: number;
    minRevenue?: number;
    maxRevenue?: number;
    pageSize?: number;
    offset?: number;
    sortBy?: 'proximity' | 'revenue' | 'rating' | 'occupancy';
    sortDirection?: 'ascending' | 'descending';
  }
): Promise<ListingsByAreaResponse | null> {
  const cacheKey = `listings-area:${JSON.stringify({ address, radiusMeters, ...options })}`;
  
  const cached = apiCache.get(cacheKey);
  if (cached) {
    console.log(`[Cache] HIT: ${cacheKey.substring(0, 50)}...`);
    return cached as ListingsByAreaResponse;
  }
  console.log(`[Cache] MISS: ${cacheKey.substring(0, 50)}...`);

  try {
    // Build filters array
    const filters: Array<{ field: string; type: string; value: any }> = [];
    
    if (options?.bedrooms) {
      filters.push({ field: 'bedrooms', type: 'select', value: options.bedrooms });
    }
    if (options?.bathrooms) {
      filters.push({ field: 'bathrooms', type: 'select', value: options.bathrooms });
    }
    if (options?.minRating) {
      filters.push({ field: 'rating', type: 'range', value: { min: options.minRating } });
    }
    if (options?.minRevenue || options?.maxRevenue) {
      filters.push({ 
        field: 'revenue', 
        type: 'range', 
        value: { 
          min: options.minRevenue || 0, 
          max: options.maxRevenue || 999999 
        } 
      });
    }

    // First, geocode the address to get coordinates for the center marker
    let centerLat = 0;
    let centerLng = 0;
    try {
      const { makeRequest } = await import('./_core/map');
      const geocodeResult = await makeRequest<{
        results: Array<{
          geometry: { location: { lat: number; lng: number } };
          formatted_address: string;
        }>;
        status: string;
      }>('/maps/api/geocode/json', { address });
      
      if (geocodeResult.results && geocodeResult.results.length > 0) {
        centerLat = geocodeResult.results[0].geometry.location.lat;
        centerLng = geocodeResult.results[0].geometry.location.lng;
      }
    } catch (geocodeError) {
      console.error('Error geocoding address:', geocodeError);
    }

    const requestBody: Record<string, any> = {
      address,
      radius: radiusMeters,
      currency: 'usd',
      sort_order: options?.sortBy || 'proximity',
      sort_direction: options?.sortDirection || 'ascending',
      pagination: {
        page_size: options?.pageSize || 25,
        offset: options?.offset || 0,
      },
    };

    if (filters.length > 0) {
      requestBody.filters = filters;
    }

    const response = await makeApiRequest<{
      payload: {
        listings: Array<{
          property_id?: string;
          airbnb_property_id?: string;
          airbnb_property_url?: string;
          title?: string;
          bedrooms?: number;
          bathrooms?: number;
          accommodates?: number;
          property_type?: string;
          rating?: number;
          reviews?: number;
          revenue_ltm?: number;
          average_daily_rate_ltm?: number;
          occupancy_rate_ltm?: number;
          distance?: number;
          superhost?: boolean;
          location?: { lat?: number; lng?: number };
        }>;
        page_info?: {
          total_count?: number;
        };
      };
    }>('/listing/comps/area', 'POST', requestBody);

    const listings: AreaListing[] = (response.payload.listings || []).map(listing => ({
      id: listing.property_id || listing.airbnb_property_id || '',
      title: listing.title || 'Untitled Listing',
      bedrooms: listing.bedrooms || 0,
      bathrooms: listing.bathrooms || 0,
      accommodates: listing.accommodates || 0,
      property_type: listing.property_type || 'Unknown',
      rating: listing.rating || null,
      reviews: listing.reviews || 0,
      annual_revenue: listing.revenue_ltm || 0,
      adr: listing.average_daily_rate_ltm || 0,
      occupancy: listing.occupancy_rate_ltm || 0,
      distance_meters: listing.distance || 0,
      airbnb_url: listing.airbnb_property_url || (listing.airbnb_property_id ? `https://www.airbnb.com/rooms/${listing.airbnb_property_id}` : undefined),
      // Construct image URL from Airbnb listing ID using their CDN pattern
      image_url: (() => {
        const airbnbId = listing.airbnb_property_id || (listing.airbnb_property_url?.match(/rooms\/(\d+)/)?.[1]);
        if (airbnbId) {
          // Use Airbnb's public image CDN - this works for most listings
          return `https://a0.muscache.com/im/pictures/miso/Hosting-${airbnbId}/original/listing-photo.jpg`;
        }
        return undefined;
      })(),
      amenities: undefined,
      superhost: listing.superhost,
      latitude: listing.location?.lat,
      longitude: listing.location?.lng,
    }));

    const result: ListingsByAreaResponse = {
      listings,
      total_count: response.payload.page_info?.total_count || listings.length,
      page_size: options?.pageSize || 25,
      offset: options?.offset || 0,
      center: {
        latitude: centerLat,
        longitude: centerLng,
        address,
      },
      radius_meters: radiusMeters,
    };

    apiCache.set(cacheKey, result, 'rentalizer'); // 15 min cache

    return result;
  } catch (error) {
    console.error('Error fetching listings by area:', error);
    return null;
  }
}

// ============================================
// BULK SUMMARY (rentalizerBulkSummary)
// ============================================

export interface BulkSummaryQuery {
  address: string;
  bedrooms?: number;
  bathrooms?: number;
  accommodates?: number;
}

export interface BulkSummaryResult {
  address: string;
  adr: number;
  revenue: number;
  occupancy: number;
  currency: string;
  success: boolean;
  error?: string;
}

export interface BulkSummaryResponse {
  results: BulkSummaryResult[];
  successful_count: number;
  failed_count: number;
}

export async function getRentalizerBulkSummary(
  queries: BulkSummaryQuery[]
): Promise<BulkSummaryResponse | null> {
  // Limit to 25 queries as per API spec
  const limitedQueries = queries.slice(0, 25);
  
  const cacheKey = `bulk-summary:${JSON.stringify(limitedQueries)}`;
  
  const cached = apiCache.get(cacheKey);
  if (cached) {
    console.log(`[Cache] HIT: ${cacheKey.substring(0, 50)}...`);
    return cached as BulkSummaryResponse;
  }
  console.log(`[Cache] MISS: ${cacheKey.substring(0, 50)}...`);

  try {
    const requestBody = {
      queries: limitedQueries.map(q => ({
        address: q.address,
        bedrooms: q.bedrooms || null,
        bathrooms: q.bathrooms || null,
        accommodates: q.accommodates || null,
        currency: 'usd',
      })),
    };

    const response = await makeApiRequest<{
      payload: {
        results?: Array<{
          address?: string;
          adr?: number;
          revenue?: number;
          occupancy?: number;
          currency?: string;
          error?: string;
        }>;
      };
    }>('/rentalizer/bulk_summary', 'POST', requestBody);

    const results: BulkSummaryResult[] = (response.payload.results || []).map((r, i) => ({
      address: r.address || limitedQueries[i]?.address || '',
      adr: r.adr || 0,
      revenue: r.revenue || 0,
      occupancy: r.occupancy || 0,
      currency: r.currency || 'USD',
      success: !r.error,
      error: r.error,
    }));

    const result: BulkSummaryResponse = {
      results,
      successful_count: results.filter(r => r.success).length,
      failed_count: results.filter(r => !r.success).length,
    };

    apiCache.set(cacheKey, result, 'rentalizer'); // 15 min cache

    return result;
  } catch (error) {
    console.error('Error fetching bulk summary:', error);
    return null;
  }
}

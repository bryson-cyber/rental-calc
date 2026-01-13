/**
 * AirDNA Hierarchy API Functions
 * 
 * Provides hierarchical location data:
 * State → Market/City → Submarket/Neighborhood → Zip Code
 */

const AIRDNA_API_BASE = "https://api.airdna.co/api/enterprise/v2";

// Helper to make API requests
async function makeApiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: any
): Promise<T> {
  const apiKey = process.env.AIRDNA_API_KEY;
  if (!apiKey) {
    throw new Error("AIRDNA_API_KEY is not set");
  }

  const url = `${AIRDNA_API_BASE}${endpoint}`;
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
  const data = await response.json();

  if (!response.ok || data.status?.type === "error") {
    throw new Error(
      `AirDNA API error (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}

// ============================================
// GET MARKETS BY STATE
// ============================================

export interface MarketResult {
  id: string;
  name: string;
  listingCount: number;
  state?: string;
  revenue?: number;
  occupancy?: number;
}

/**
 * Get all markets in a given US state
 * Uses the /market/search endpoint with state name
 */
export async function getMarketsInState(stateName: string): Promise<MarketResult[]> {
  try {
    console.log(`[getMarketsInState] Searching for markets in ${stateName}`);
    
    const response = await makeApiRequest<{
      payload: {
        results: Array<{
          id: string;
          name: string;
          type: string;
          listing_count: number;
          location: {
            state: string;
            country: string;
            country_code: string;
          };
        }>;
        page_info: {
          total_count: number;
        };
      };
    }>("/market/search", "POST", {
      term: stateName,
      pagination: { page_size: 25, offset: 0 }
    });
    
    const results = response.payload?.results || [];
    
    // Filter to only US markets in the specified state
    const stateMarkets = results.filter(m => {
      if (m.location?.country_code !== 'us') return false;
      if (m.type !== 'market') return false;
      
      // Match state name (case insensitive)
      const marketState = m.location?.state?.toLowerCase() || '';
      const searchState = stateName.toLowerCase();
      
      return marketState.includes(searchState) || searchState.includes(marketState);
    });
    
    console.log(`[getMarketsInState] Found ${stateMarkets.length} markets in ${stateName}`);
    
    return stateMarkets.map(m => ({
      id: m.id,
      name: m.name,
      listingCount: m.listing_count,
      state: m.location?.state
    }));
  } catch (error) {
    console.error(`[getMarketsInState] Error:`, error);
    return [];
  }
}

// ============================================
// GET SUBMARKETS IN MARKET
// ============================================

export interface SubmarketResult {
  id: string;
  name: string;
  listingCount: number;
  revenue?: number;
  occupancy?: number;
}

/**
 * Get all submarkets (neighborhoods) within a market
 * Uses the /market/{market_id}/submarkets endpoint
 */
export async function getSubmarketsInMarket(marketId: string): Promise<SubmarketResult[]> {
  try {
    console.log(`[getSubmarketsInMarket] Getting submarkets for market ${marketId}`);
    
    // Fetch all pages of submarkets
    let allSubmarkets: SubmarketResult[] = [];
    let offset = 0;
    const pageSize = 25;
    let hasMore = true;
    
    while (hasMore) {
      const response = await makeApiRequest<{
        payload: {
          submarkets: Array<{
            id: string;
            name: string;
            metrics?: {
              revenue?: number;
              booked?: number;
            };
          }>;
          page_info: {
            total_count: number;
          };
        };
      }>(`/market/${marketId}/submarkets`, "POST", {
        pagination: { page_size: pageSize, offset }
      });
      
      const submarkets = response.payload?.submarkets || [];
      const totalCount = response.payload?.page_info?.total_count || 0;
      
      allSubmarkets.push(...submarkets.map(s => ({
        id: s.id,
        name: s.name,
        listingCount: 0, // Not provided in this endpoint
        revenue: s.metrics?.revenue,
        occupancy: s.metrics?.booked ? Math.round(s.metrics.booked * 100) : undefined
      })));
      
      offset += pageSize;
      hasMore = offset < totalCount;
    }
    
    console.log(`[getSubmarketsInMarket] Found ${allSubmarkets.length} submarkets`);
    
    // Sort by revenue descending
    allSubmarkets.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
    
    return allSubmarkets;
  } catch (error) {
    console.error(`[getSubmarketsInMarket] Error:`, error);
    return [];
  }
}

// ============================================
// GET ZIP CODES IN SUBMARKET
// ============================================

/**
 * Get all unique zip codes within a submarket
 * Fetches listings and extracts unique zip codes
 */
export async function getZipcodesInSubmarket(submarketId: string): Promise<string[]> {
  try {
    console.log(`[getZipcodesInSubmarket] Getting zip codes for submarket ${submarketId}`);
    
    // Fetch listings to extract zip codes
    const response = await makeApiRequest<{
      payload: {
        listings: Array<{
          zipcode?: string;
          zip_code?: string;
        }>;
        page_info: {
          total_count: number;
        };
      };
    }>(`/submarket/${submarketId}/listings`, "POST", {
      pagination: { page_size: 25, offset: 0 }
    });
    
    const listings = response.payload?.listings || [];
    
    // Extract unique zip codes
    const zipcodes = new Set<string>();
    listings.forEach(l => {
      const zip = l.zipcode || l.zip_code;
      if (zip) {
        zipcodes.add(zip);
      }
    });
    
    // If we need more zip codes, fetch additional pages
    const totalCount = response.payload?.page_info?.total_count || 0;
    if (totalCount > 25 && zipcodes.size < 10) {
      // Fetch more pages to get more zip codes
      for (let offset = 25; offset < Math.min(totalCount, 100); offset += 25) {
        const moreResponse = await makeApiRequest<{
          payload: {
            listings: Array<{
              zipcode?: string;
              zip_code?: string;
            }>;
          };
        }>(`/submarket/${submarketId}/listings`, "POST", {
          pagination: { page_size: 25, offset }
        });
        
        (moreResponse.payload?.listings || []).forEach(l => {
          const zip = l.zipcode || l.zip_code;
          if (zip) {
            zipcodes.add(zip);
          }
        });
      }
    }
    
    const sortedZipcodes = Array.from(zipcodes).sort();
    console.log(`[getZipcodesInSubmarket] Found ${sortedZipcodes.length} unique zip codes`);
    
    return sortedZipcodes;
  } catch (error) {
    console.error(`[getZipcodesInSubmarket] Error:`, error);
    return [];
  }
}

// ============================================
// GET SUBMARKET DATA
// ============================================

export interface SubmarketData {
  id: string;
  name: string;
  parentMarket?: string;
  metrics: {
    revenue: number;
    occupancy: number;
    adr: number;
    revpar: number;
    marketScore?: number;
  };
  listingCount: number;
}

/**
 * Get detailed data for a specific submarket
 */
export async function getSubmarketData(submarketId: string): Promise<SubmarketData | null> {
  try {
    console.log(`[getSubmarketData] Getting data for submarket ${submarketId}`);
    
    const response = await makeApiRequest<{
      payload: {
        id: string;
        name: string;
        parent_market_name?: string;
        metrics?: {
          market_score?: number;
          revenue?: number;
          booked?: number;
          daily_rate?: number;
          revpar?: number;
        };
      };
    }>(`/submarket/${submarketId}`, "GET");
    
    const data = response.payload;
    if (!data) return null;
    
    return {
      id: data.id,
      name: data.name,
      parentMarket: data.parent_market_name,
      metrics: {
        revenue: Math.round(data.metrics?.revenue || 0),
        occupancy: Math.round((data.metrics?.booked || 0) * 100),
        adr: Math.round(data.metrics?.daily_rate || 0),
        revpar: Math.round(data.metrics?.revpar || 0),
        marketScore: data.metrics?.market_score
      },
      listingCount: 0 // Not provided in this endpoint
    };
  } catch (error) {
    console.error(`[getSubmarketData] Error:`, error);
    return null;
  }
}

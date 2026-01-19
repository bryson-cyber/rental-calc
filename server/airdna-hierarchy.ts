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


// ============================================
// GEOCODE ZIP CODE TO FIND MARKET
// ============================================

import { makeRequest as makeGoogleMapsRequest, GeocodingResult } from "./_core/map";

export interface ZipCodeLookupResult {
  success: boolean;
  zipcode: string;
  city?: string;
  state?: string;
  stateCode?: string;
  market?: {
    id: string;
    name: string;
    listingCount: number;
  };
  submarket?: {
    id: string;
    name: string;
    listingCount: number;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
  error?: string;
}

/**
 * Geocode a US zip code to find the city, state, and corresponding AirDNA market
 * This enables the "Quick Search by Zip Code" feature to work with any US zip code
 */
export async function geocodeZipCodeToMarket(zipcode: string): Promise<ZipCodeLookupResult> {
  try {
    console.log(`[geocodeZipCodeToMarket] Looking up zip code: ${zipcode}`);
    
    // Step 1: Use Google Geocoding API to get city/state from zip code
    const geocodeResult = await makeGoogleMapsRequest<GeocodingResult>(
      "/maps/api/geocode/json",
      { address: `${zipcode}, USA` }
    );
    
    if (geocodeResult.status !== "OK" || !geocodeResult.results?.[0]) {
      console.log(`[geocodeZipCodeToMarket] Geocoding failed for ${zipcode}: ${geocodeResult.status}`);
      return {
        success: false,
        zipcode,
        error: `Could not find location for zip code ${zipcode}. Please verify the zip code is correct.`
      };
    }
    
    const result = geocodeResult.results[0];
    const coordinates = {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng
    };
    
    // Extract city and state from address components
    let city = "";
    let state = "";
    let stateCode = "";
    
    for (const component of result.address_components) {
      if (component.types.includes("locality")) {
        city = component.long_name;
      } else if (component.types.includes("administrative_area_level_1")) {
        state = component.long_name;
        stateCode = component.short_name;
      }
    }
    
    // If no locality found, try sublocality or neighborhood
    if (!city) {
      for (const component of result.address_components) {
        if (component.types.includes("sublocality") || 
            component.types.includes("neighborhood") ||
            component.types.includes("administrative_area_level_2")) {
          city = component.long_name;
          break;
        }
      }
    }
    
    console.log(`[geocodeZipCodeToMarket] Geocoded ${zipcode} to: ${city}, ${state} (${stateCode})`);
    
    // Step 2: Search for the market using multiple search term variations
    const apiKey = process.env.AIRDNA_API_KEY;
    if (!apiKey) {
      throw new Error("AIRDNA_API_KEY is not set");
    }
    
    // Generate search term variations to improve matching
    const searchTerms: string[] = [];
    if (city) {
      searchTerms.push(city);
      // Handle abbreviations like "St." -> "Saint"
      if (city.includes("St.")) {
        searchTerms.push(city.replace(/St\./g, "Saint"));
      }
      if (city.includes("St ")) {
        searchTerms.push(city.replace(/St /g, "Saint "));
      }
      // Try city + state
      if (state) {
        searchTerms.push(`${city} ${state}`);
        searchTerms.push(`${city} ${stateCode}`);
      }
    }
    if (state) {
      searchTerms.push(state);
    }
    
    if (searchTerms.length === 0) {
      return {
        success: false,
        zipcode,
        city,
        state,
        stateCode,
        coordinates,
        error: `Could not determine city/state for zip code ${zipcode}.`
      };
    }
    
    // Try each search term until we find a match
    let markets: any[] = [];
    for (const searchTerm of searchTerms) {
      console.log(`[geocodeZipCodeToMarket] Trying search term: "${searchTerm}"`);
      
      const searchResponse = await fetch(`${AIRDNA_API_BASE}/market/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          term: searchTerm,
          pagination: { page_size: 25, offset: 0 }
        })
      });
      
      const searchData = await searchResponse.json();
      const results = searchData.payload?.results || [];
      
      // Filter to US markets only
      const usMarkets = results.filter((m: any) => 
        m.type === "market" && m.location?.country_code === "us"
      );
      
      if (usMarkets.length > 0) {
        markets = results;
        break;
      }
    }
    
    // Find a market that matches the city/state
    let matchedMarket = null;
    for (const m of markets) {
      if (m.type !== "market") continue;
      if (m.location?.country_code !== "us") continue;
      
      // Check if market name contains the city name
      const marketName = m.name.toLowerCase();
      const cityLower = city.toLowerCase();
      const stateLower = state.toLowerCase();
      
      if (marketName.includes(cityLower) || 
          (m.location?.state?.toLowerCase() === stateLower && marketName.includes(cityLower.split(" ")[0]))) {
        matchedMarket = m;
        break;
      }
    }
    
    // If no exact match, try to find a market in the same state
    if (!matchedMarket) {
      for (const m of markets) {
        if (m.type !== "market") continue;
        if (m.location?.country_code !== "us") continue;
        if (m.location?.state?.toLowerCase() === state.toLowerCase()) {
          matchedMarket = m;
          break;
        }
      }
    }
    
    if (!matchedMarket) {
      console.log(`[geocodeZipCodeToMarket] No market found for ${city}, ${state}`);
      return {
        success: false,
        zipcode,
        city,
        state,
        stateCode,
        coordinates,
        error: `No AirDNA market data available for ${city}, ${state}. Try browsing by state using the dropdown menu above, or search for a nearby major city.`
      };
    }
    
    console.log(`[geocodeZipCodeToMarket] Found market: ${matchedMarket.name} (${matchedMarket.id})`);
    
    // Step 3: Get submarkets in this market and find one that might contain this zip code
    const submarketResponse = await fetch(`${AIRDNA_API_BASE}/market/${matchedMarket.id}/submarkets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pagination: { page_size: 25, offset: 0 }
      })
    });
    
    const submarketData = await submarketResponse.json();
    const submarkets = submarketData.payload?.submarkets || [];
    
    // Try to find a submarket that matches the city name or neighborhood
    let matchedSubmarket = null;
    for (const sm of submarkets) {
      const smName = sm.name.toLowerCase();
      const cityLower = city.toLowerCase();
      
      if (smName.includes(cityLower) || cityLower.includes(smName)) {
        matchedSubmarket = sm;
        break;
      }
    }
    
    // If no submarket match, use the first one (or none)
    if (!matchedSubmarket && submarkets.length > 0) {
      // Just return the market without a specific submarket
      matchedSubmarket = null;
    }
    
    return {
      success: true,
      zipcode,
      city,
      state,
      stateCode,
      coordinates,
      market: {
        id: matchedMarket.id,
        name: matchedMarket.name,
        listingCount: matchedMarket.listing_count || 0
      },
      submarket: matchedSubmarket ? {
        id: matchedSubmarket.id,
        name: matchedSubmarket.name,
        listingCount: matchedSubmarket.listing_count || 0
      } : undefined
    };
    
  } catch (error) {
    console.error(`[geocodeZipCodeToMarket] Error:`, error);
    return {
      success: false,
      zipcode,
      error: `An error occurred while looking up zip code ${zipcode}. Please try again.`
    };
  }
}

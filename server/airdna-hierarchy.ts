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
    
    // If no state-specific results, return all US markets as fallback
    if (stateMarkets.length === 0) {
      console.log(`[getMarketsInState] No state-specific results, returning all US markets`);
      const usMarkets = results.filter(m => 
        m.location?.country_code === 'us' && m.type === 'market'
      );
      return usMarkets.map(m => ({
        id: m.id,
        name: m.name,
        listingCount: m.listing_count,
        state: m.location?.state
      }));
    }
    
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
  zipcodes?: string[];
}

/**
 * Get all submarkets in a given market
 */
export async function getSubmarketsInMarket(marketId: string): Promise<SubmarketResult[]> {
  try {
    console.log(`[getSubmarketsInMarket] Getting submarkets for market ${marketId}`);
    
    // Use the market/search endpoint to find submarkets
    // The API returns submarkets when searching for the market name
    const response = await makeApiRequest<{
      payload: {
        results: Array<{
          id: string;
          name: string;
          type: string;
          listing_count: number;
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
      search_term: marketId,
      pagination: { page_size: 50, offset: 0 }
    });
    
    const results = response.payload?.results || [];
    
    // Filter to submarkets that belong to this market
    const submarkets = results.filter(r => 
      r.type === 'submarket' && r.parent_market?.id === marketId
    );
    
    return submarkets.map(sm => ({
      id: sm.id,
      name: sm.name,
      listingCount: sm.listing_count,
      zipcodes: sm.legacy_location?.zipcodes
    }));
    
  } catch (error) {
    console.error(`[getSubmarketsInMarket] Error:`, error);
    return [];
  }
}

// ============================================
// SEARCH MARKETS
// ============================================

export interface SearchResult {
  id: string;
  name: string;
  type: 'market' | 'submarket';
  listingCount: number;
  state?: string;
  parentMarket?: {
    id: string;
    name: string;
  };
  zipcodes?: string[];
}

/**
 * Search for markets and submarkets by name
 */
export async function searchMarkets(query: string): Promise<SearchResult[]> {
  try {
    console.log(`[searchMarkets] Searching for: ${query}`);
    
    const response = await makeApiRequest<{
      payload: {
        results: Array<{
          id: string;
          name: string;
          type: string;
          listing_count: number;
          location?: {
            state: string;
            country_code: string;
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
      search_term: query,
      pagination: { page_size: 25, offset: 0 }
    });
    
    const results = response.payload?.results || [];
    
    // Filter to US results only
    const usResults = results.filter(r => 
      r.location?.country_code === 'us' || r.parent_market
    );
    
    return usResults.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type as 'market' | 'submarket',
      listingCount: r.listing_count,
      state: r.location?.state,
      parentMarket: r.parent_market,
      zipcodes: r.legacy_location?.zipcodes
    }));
    
  } catch (error) {
    console.error(`[searchMarkets] Error:`, error);
    return [];
  }
}

// ============================================
// GEOCODE ZIP CODE TO MARKET
// ============================================

// Google Maps API helper
const GOOGLE_MAPS_BASE = "https://maps.googleapis.com";

async function makeGoogleMapsRequest<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  const baseUrl = process.env.BUILT_IN_FORGE_API_URL;
  
  if (!apiKey || !baseUrl) {
    throw new Error("Google Maps API credentials not configured");
  }
  
  const searchParams = new URLSearchParams(params);
  const url = `${baseUrl}/google${endpoint}?${searchParams.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Google Maps API error: ${response.status}`);
  }
  
  return response.json();
}

interface GeocodingResult {
  status: string;
  results: Array<{
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
}

export interface ZipCodeLookupResult {
  success: boolean;
  zipcode: string;
  city?: string;
  state?: string;
  stateCode?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
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
  error?: string;
}

/**
 * Geocode a US zip code to find the city, state, and corresponding AirDNA market
 * This enables the "Quick Search by Zip Code" feature to work with any US zip code
 * 
 * IMPROVED: Now searches for the zip code directly in AirDNA first, which is more accurate
 * than geocoding and then searching for the city name.
 */
export async function geocodeZipCodeToMarket(zipcode: string): Promise<ZipCodeLookupResult> {
  try {
    console.log(`[geocodeZipCodeToMarket] Looking up zip code: ${zipcode}`);
    
    const apiKey = process.env.AIRDNA_API_KEY;
    if (!apiKey) {
      throw new Error("AIRDNA_API_KEY is not set");
    }
    
    // Step 1: Search for the zip code directly in AirDNA
    // This is more accurate than geocoding first because AirDNA's search
    // can find submarkets that contain specific zip codes
    console.log(`[geocodeZipCodeToMarket] Searching AirDNA for zip code: ${zipcode}`);
    
    const zipSearchResponse = await fetch(`${AIRDNA_API_BASE}/market/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        search_term: zipcode,
        pagination: { page_size: 10, offset: 0 }
      })
    });
    
    const zipSearchData = await zipSearchResponse.json();
    const zipResults = zipSearchData.payload?.results || [];
    
    // Look for a US submarket or market that contains this zip code
    let foundSubmarket = null;
    let foundMarket = null;
    
    for (const result of zipResults) {
      // Check if this result is in the US
      if (result.location?.country_code !== 'us') continue;
      
      // Check if this submarket contains the zip code
      const zipcodes = result.legacy_location?.zipcodes || [];
      if (zipcodes.includes(zipcode)) {
        if (result.type === 'submarket') {
          foundSubmarket = result;
          // Get the parent market
          if (result.parent_market) {
            foundMarket = result.parent_market;
          }
          break;
        } else if (result.type === 'market') {
          foundMarket = result;
          break;
        }
      }
      
      // If no exact zip match, take the first US result as a fallback
      if (!foundSubmarket && !foundMarket) {
        if (result.type === 'submarket') {
          foundSubmarket = result;
          if (result.parent_market) {
            foundMarket = result.parent_market;
          }
        } else if (result.type === 'market') {
          foundMarket = result;
        }
      }
    }
    
    // If we found a result from AirDNA, use it
    if (foundSubmarket || foundMarket) {
      console.log(`[geocodeZipCodeToMarket] Found AirDNA result for ${zipcode}:`, {
        submarket: foundSubmarket?.name,
        market: foundMarket?.name
      });
      
      // Get coordinates from Google Geocoding for map centering
      let coordinates: { lat: number; lng: number } | undefined;
      let city = "";
      let state = "";
      let stateCode = "";
      
      try {
        const geocodeResult = await makeGoogleMapsRequest<GeocodingResult>(
          "/maps/api/geocode/json",
          { address: `${zipcode}, USA` }
        );
        
        if (geocodeResult.status === "OK" && geocodeResult.results?.[0]) {
          const result = geocodeResult.results[0];
          coordinates = {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng
          };
          
          for (const component of result.address_components) {
            if (component.types.includes("locality")) {
              city = component.long_name;
            } else if (component.types.includes("administrative_area_level_1")) {
              state = component.long_name;
              stateCode = component.short_name;
            }
          }
        }
      } catch (geoError) {
        console.log(`[geocodeZipCodeToMarket] Geocoding failed, continuing without coordinates`);
      }
      
      // Use state from AirDNA result if not found via geocoding
      if (!state && foundSubmarket?.location?.state) {
        state = foundSubmarket.location.state;
      } else if (!state && foundMarket?.location?.state) {
        state = foundMarket.location?.state;
      }
      
      return {
        success: true,
        zipcode,
        city: city || foundSubmarket?.name || foundMarket?.name,
        state,
        stateCode,
        coordinates,
        market: foundMarket ? {
          id: foundMarket.id,
          name: foundMarket.name,
          listingCount: foundMarket.listing_count || 0
        } : undefined,
        submarket: foundSubmarket ? {
          id: foundSubmarket.id,
          name: foundSubmarket.name,
          listingCount: foundSubmarket.listing_count || 0
        } : undefined
      };
    }
    
    // Step 2: If no AirDNA result, fall back to geocoding and city search
    console.log(`[geocodeZipCodeToMarket] No direct AirDNA result, falling back to geocoding`);
    
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
    
    // Step 3: Search for the market using city + state
    const searchTerms: string[] = [];
    if (city) {
      // Try city + state first (most specific)
      if (state) {
        searchTerms.push(`${city} ${state}`);
      }
      searchTerms.push(city);
      // Handle abbreviations like "St." -> "Saint"
      if (city.includes("St.")) {
        searchTerms.push(city.replace(/St\./g, "Saint"));
        if (state) {
          searchTerms.push(`${city.replace(/St\./g, "Saint")} ${state}`);
        }
      }
    }
    
    let matchedMarket = null;
    let matchedSubmarket = null;
    
    for (const searchTerm of searchTerms) {
      console.log(`[geocodeZipCodeToMarket] Trying search term: "${searchTerm}"`);
      
      const searchResponse = await fetch(`${AIRDNA_API_BASE}/market/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          search_term: searchTerm,
          pagination: { page_size: 25, offset: 0 }
        })
      });
      
      const searchData = await searchResponse.json();
      const results = searchData.payload?.results || [];
      
      // Look for US markets/submarkets in the correct state
      for (const r of results) {
        if (r.location?.country_code !== 'us') continue;
        
        // Check if the state matches
        const resultState = r.location?.state?.toLowerCase() || '';
        const targetState = state.toLowerCase();
        
        if (resultState !== targetState) continue;
        
        if (r.type === 'submarket' && !matchedSubmarket) {
          matchedSubmarket = r;
          if (r.parent_market) {
            matchedMarket = r.parent_market;
          }
        } else if (r.type === 'market' && !matchedMarket) {
          matchedMarket = r;
        }
        
        if (matchedSubmarket && matchedMarket) break;
      }
      
      if (matchedSubmarket || matchedMarket) break;
    }
    
    if (!matchedMarket && !matchedSubmarket) {
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
    
    console.log(`[geocodeZipCodeToMarket] Found market: ${matchedMarket?.name || matchedSubmarket?.parent_market?.name}`);
    
    return {
      success: true,
      zipcode,
      city,
      state,
      stateCode,
      coordinates,
      market: matchedMarket ? {
        id: matchedMarket.id,
        name: matchedMarket.name,
        listingCount: matchedMarket.listing_count || 0
      } : undefined,
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

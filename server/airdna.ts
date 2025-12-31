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

export interface HistoricalDataPoint {
  date: string;
  value: number;
}

export interface MarketData {
  market_id: string;
  market_name: string;
  metrics: MarketMetrics;
  historical_trends?: {
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
  };
}

export interface ListingData {
  id: string;
  title: string;
  airbnb_url?: string;
  image_url?: string;
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
  latitude?: number;
  longitude?: number;
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
    }));
  } catch (error) {
    console.error("Error searching markets:", error);
    return [];
  }
}

// ============================================
// MARKET DETAILS
// ============================================

export async function getMarketDetails(marketId: string): Promise<{
  id: string;
  name: string;
  listing_count: number;
  location_name: string;
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
      metrics: response.payload.metrics,
    };
  } catch (error) {
    console.error("Error fetching market details:", error);
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
    const response = await makeApiRequest<{
      payload: {
        results: Array<{
          id: string;
          name: string;
          listing_count: number;
        }>;
      };
    }>(`/submarket/explore/market/${marketId}`, "POST", {
      pagination: {
        page_size: 100,
        offset: 0,
      },
    });
    
    return response.payload.results.map((r) => ({
      id: r.id,
      name: r.name,
      listing_count: r.listing_count,
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
// LISTING DATA
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
          location?: { lat?: number; lng?: number };
          zipcode?: string;
          market_name?: string;
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
      image_url: '',
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
      latitude: r.location?.lat ?? 0,
      longitude: r.location?.lng ?? 0,
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
    
    const { details, location, stats, comps } = response.payload;
    
    return {
      property: {
        address: details.address,
        address_lookup: details.address_lookup,
        zipcode: details.zipcode,
        bedrooms: details.bedrooms,
        bathrooms: details.bathrooms,
        accommodates: details.accommodates,
        latitude: location.lat,
        longitude: location.lng,
        market_id: location.market_id,
        submarket_id: location.submarket_id,
      },
      estimates: {
        annual_revenue: stats.future.summary.revenue,
        annual_revenue_low: stats.future.summary.revenue_lower,
        annual_revenue_high: stats.future.summary.revenue_upper,
        average_daily_rate: stats.future.summary.adr,
        occupancy_rate: stats.future.summary.occupancy,
        currency: stats.currency,
        currency_symbol: stats.currency_symbol,
      },
      monthly_forecast: (stats.future.metrics || []).map((m) => ({
        month: m.date,
        revenue: m.revenue,
        adr: m.adr,
        occupancy: m.occupancy,
      })),
      comps: (comps || []).map((c) => ({
        title: c.details.title,
        bedrooms: c.details.bedrooms,
        bathrooms: c.details.bathrooms,
        rating: c.details.rating,
        reviews: c.details.reviews,
        annual_revenue: c.stats.summary.revenue,
        adr: c.stats.summary.adr,
        occupancy: c.stats.summary.occupancy,
        distance_meters: c.distance_meters,
        airbnb_listing_id: c.platforms?.airbnb_property_id,
        airbnb_url: c.platforms?.airbnb_property_url,
        image_url: c.details.images?.[0],
        property_type: c.details.property_type,
      })),
    };
  } catch (error) {
    console.error("Error getting rentalizer estimate:", error);
    return null;
  }
}

// ============================================
// COMPREHENSIVE REPORT DATA
// ============================================

export interface ComprehensivePropertyReport {
  property: RentalizerResponse;
  market: {
    id: string;
    name: string;
    listing_count: number;
    metrics: MarketMetrics;
    historical: {
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
  generated_at: string;
}

export interface ComprehensiveMarketReport {
  market: {
    id: string;
    name: string;
    listing_count: number;
    location_name: string;
    metrics: MarketMetrics;
    historical: {
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
  generated_at: string;
}

export async function getComprehensivePropertyReport(
  address: string,
  bedrooms?: number,
  bathrooms?: number,
  accommodates?: number
): Promise<ComprehensivePropertyReport | null> {
  // Step 1: Get property estimate
  const propertyEstimate = await getRentalizerEstimate({
    address,
    bedrooms,
    bathrooms,
    accommodates,
  });
  
  if (!propertyEstimate) {
    return null;
  }
  
  let marketId = propertyEstimate.property.market_id;
  const propertyBedrooms = propertyEstimate.property.bedrooms;
  const lat = propertyEstimate.property.latitude;
  const lng = propertyEstimate.property.longitude;
  const zipcode = propertyEstimate.property.zipcode;
  
  // Step 2: Find market ID if not provided by rentalizer
  // Extract city from address (format: "123 Main St, City, ST 12345")
  let marketListingCount = 0; // Store listing count from search results
  
  if (!marketId) {
    const addressParts = address.split(',');
    if (addressParts.length >= 2) {
      // Try to get city name from address
      const cityPart = addressParts[1]?.trim();
      if (cityPart) {
        console.log('[Market Search] Searching for city:', cityPart);
        const markets = await searchMarkets(cityPart, 10);
        console.log('[Market Search] Found markets:', JSON.stringify(markets.map(m => ({ id: m.id, name: m.name, type: m.type, state: m.state, location_name: m.location_name, listing_count: m.listing_count })), null, 2));
        // Find a market (not submarket) that matches the state
        const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d{5}/);
        const state = stateMatch ? stateMatch[1] : null;
        console.log('[Market Search] Looking for state:', state);
        
        // First try to find a parent market in the same state
        const parentMarket = markets.find(m => 
          m.type === 'market' && 
          (!state || m.state?.toLowerCase().includes(state.toLowerCase()) || m.location_name?.includes(state))
        );
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
        },
        historical: historicalData,
      };
    }
    
    submarkets = submarketList;
  }
  
  // Step 3: Get same-bedroom comps in radius (apples-to-apples)
  const sameBedroomComps = await exploreListingsInRadius(address, 3000, {
    bedrooms: propertyBedrooms,
    bathrooms: propertyEstimate.property.bathrooms,
    minRevenue: 10000, // Filter out very low performers
  }, 20);
  
  // Step 4: Get bedroom performance data from comps in radius
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
    generated_at: new Date().toISOString(),
  };
}

export async function getComprehensiveMarketReport(
  marketId: string
): Promise<ComprehensiveMarketReport | null> {
  // Step 1: Get market details
  const marketDetails = await getMarketDetails(marketId);
  if (!marketDetails) {
    return null;
  }
  
  // Step 2: Get all market data in parallel
  const [historicalData, submarkets, topListings] = await Promise.all([
    getMarketHistoricalData(marketId, 12),
    getSubmarketsInMarket(marketId),
    exploreListingsInMarket(marketId, { minRevenue: 30000 }, 50),
  ]);
  
  // Calculate current metrics
  const latestOccupancy = historicalData.occupancy[historicalData.occupancy.length - 1]?.value || 0;
  const latestAdr = historicalData.adr[historicalData.adr.length - 1]?.value || 0;
  const latestRevenue = historicalData.revenue[historicalData.revenue.length - 1]?.value || 0;
  const latestRevpar = historicalData.revpar[historicalData.revpar.length - 1]?.value || 0;
  const latestListings = historicalData.active_listings[historicalData.active_listings.length - 1]?.value || marketDetails.listing_count;
  
  // Step 3: Calculate bedroom performance
  const bedroomPerformance: Array<{
    bedrooms: number;
    count: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
  }> = [];
  
  for (let br = 1; br <= 5; br++) {
    const listings = await exploreListingsInMarket(marketId, { bedrooms: br }, 100);
    if (listings.length > 0) {
      bedroomPerformance.push({
        bedrooms: br,
        count: listings.length,
        avg_revenue: Math.round(listings.reduce((sum, l) => sum + l.annual_revenue, 0) / listings.length),
        avg_adr: Math.round(listings.reduce((sum, l) => sum + l.adr, 0) / listings.length),
        avg_occupancy: Math.round(listings.reduce((sum, l) => sum + l.occupancy, 0) / listings.length),
      });
    }
  }
  
  return {
    market: {
      id: marketId,
      name: marketDetails.name,
      listing_count: marketDetails.listing_count,
      location_name: marketDetails.location_name,
      metrics: {
        occupancy: latestOccupancy,
        adr: latestAdr,
        revenue: latestRevenue,
        revpar: latestRevpar,
        active_listings: latestListings,
      },
      historical: historicalData,
    },
    submarkets,
    top_listings: topListings,
    bedroom_performance: bedroomPerformance,
    generated_at: new Date().toISOString(),
  };
}

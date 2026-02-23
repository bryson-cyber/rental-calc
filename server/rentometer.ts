/**
 * Rentometer API Integration
 * Endpoints: Summary (QuickView), Property Rents, Nearby Comps
 */

const RENTOMETER_API_KEY = process.env.RENTOMETER_API_KEY || "";
const BASE_URL = "https://www.rentometer.com/api/v1";

// ─── Summary (QuickView) ─────────────────────────────────────────────

export interface RentSummaryParams {
  address: string;
  bedrooms: number;
  baths?: string; // "1" or "1.5+"
  buildingType?: "apartment" | "house";
  lookBackDays?: number; // 90-1460, default 365
}

export interface RentSummaryResponse {
  address: string;
  latitude: string;
  longitude: string;
  bedrooms: number;
  baths: string;
  building_type: string;
  look_back_days: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  percentile_25: number;
  percentile_75: number;
  std_dev: number;
  samples: number;
  radius_miles: number;
  quickview_url: string;
  credits_remaining: number;
  token: string;
}

export interface RentAnalysis {
  marketData: {
    median: number;
    mean: number;
    percentile25: number;
    percentile75: number;
    min: number;
    max: number;
    samples: number;
    radiusMiles: number;
  };
  userRentComparison: {
    userRent: number;
    percentilePosition: string;
    rentAdvantage: number;
    rentAdvantagePercent: number;
    isGoodDeal: boolean;
    summary: string;
  };
}

/**
 * Fetch rent summary from Rentometer QuickView API
 */
export async function getRentSummary(
  params: RentSummaryParams
): Promise<RentSummaryResponse> {
  const queryParams = new URLSearchParams({
    api_key: RENTOMETER_API_KEY,
    address: params.address,
    bedrooms: params.bedrooms.toString(),
  });

  if (params.baths) {
    queryParams.append("baths", params.baths);
  }
  if (params.buildingType) {
    queryParams.append("building_type", params.buildingType);
  }
  if (params.lookBackDays) {
    queryParams.append("look_back_days", params.lookBackDays.toString());
  }

  const url = `${BASE_URL}/summary?${queryParams.toString()}`;
  
  console.log(`[Rentometer] Fetching rent summary for: ${params.address}`);

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Rentometer] API error: ${response.status} - ${errorText}`);
    throw new Error(`Rentometer API error: ${response.status}`);
  }

  const data = await response.json();
  
  console.log(`[Rentometer] Got rent data: median=$${data.median}, samples=${data.samples}`);
  
  return data as RentSummaryResponse;
}

/**
 * Analyze user's rent compared to market data
 */
export async function analyzeRentVsMarket(
  address: string,
  bedrooms: number,
  userRent: number
): Promise<RentAnalysis> {
  const rentData = await getRentSummary({ address, bedrooms });

  // Calculate percentile position
  let percentilePosition: string;
  if (userRent <= rentData.percentile_25) {
    percentilePosition = "bottom 25%";
  } else if (userRent <= rentData.median) {
    percentilePosition = "below median";
  } else if (userRent <= rentData.percentile_75) {
    percentilePosition = "above median";
  } else {
    percentilePosition = "top 25%";
  }

  // Calculate rent advantage (positive = saving money)
  const rentAdvantage = rentData.median - userRent;
  const rentAdvantagePercent = Math.round((rentAdvantage / rentData.median) * 100);
  const isGoodDeal = userRent <= rentData.median;

  // Generate summary
  let summary: string;
  if (rentAdvantage > 0) {
    summary = `Your rent is $${rentAdvantage.toLocaleString()}/mo below market median (${Math.abs(rentAdvantagePercent)}% savings)`;
  } else if (rentAdvantage < 0) {
    summary = `Your rent is $${Math.abs(rentAdvantage).toLocaleString()}/mo above market median (${Math.abs(rentAdvantagePercent)}% premium)`;
  } else {
    summary = "Your rent is at the market median";
  }

  return {
    marketData: {
      median: rentData.median,
      mean: rentData.mean,
      percentile25: rentData.percentile_25,
      percentile75: rentData.percentile_75,
      min: rentData.min,
      max: rentData.max,
      samples: rentData.samples,
      radiusMiles: rentData.radius_miles,
    },
    userRentComparison: {
      userRent,
      percentilePosition,
      rentAdvantage,
      rentAdvantagePercent,
      isGoodDeal,
      summary,
    },
  };
}

// ─── Property Rents ──────────────────────────────────────────────────

export interface PropertyRentsParams {
  address: string;
  maxAge?: number; // max days to look back, default 30
}

export interface PropertyListing {
  id: number;
  bedrooms: number;
  baths: string;
  price: number;
  sqft: number;
  last_seen: string;
  price_per_sqft: number;
}

export interface PropertyRentsResponse {
  formatted_address: string;
  latitude: number;
  longitude: number;
  average_update_days: number;
  count: number;
  property_listings: PropertyListing[];
  premium_credits_remaining: number;
}

/**
 * Fetch recently seen listed rents at a given address
 * Returns individual unit-level rent listings at the property
 */
export async function getPropertyRents(
  params: PropertyRentsParams
): Promise<PropertyRentsResponse> {
  const queryParams = new URLSearchParams({
    api_key: RENTOMETER_API_KEY,
    address: params.address,
  });

  if (params.maxAge) {
    queryParams.append("max_age", params.maxAge.toString());
  }

  const url = `${BASE_URL}/property_rents?${queryParams.toString()}`;
  
  console.log(`[Rentometer] Fetching property rents for: ${params.address}`);

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Rentometer] Property rents API error: ${response.status} - ${errorText}`);
    throw new Error(`Rentometer property_rents API error: ${response.status}`);
  }

  const data = await response.json();
  
  console.log(`[Rentometer] Got ${data.count || 0} property listings`);
  
  return data as PropertyRentsResponse;
}

// ─── Nearby Comps ────────────────────────────────────────────────────

export interface NearbyCompsParams {
  address: string;
  bedrooms: number;
  baths?: string;
  buildingType?: "apartment" | "house";
  latitude?: number;
  longitude?: number;
}

export interface NearbyProperty {
  address: string;
  latitude: number;
  longitude: number;
  distance: number; // miles
  price: number;
  bedrooms: number;
  baths: string;
  property_type: string;
  last_seen: string;
  sqft: number;
  dollar_sqft: number;
}

export interface NearbyCompsResponse {
  search_address: string;
  search_latitude: string;
  search_longitude: string;
  count: number;
  nearby_properties: NearbyProperty[];
  credits_remaining: number;
}

/**
 * Fetch nearby comparable rental properties sorted by distance
 */
export async function getNearbyComps(
  params: NearbyCompsParams
): Promise<NearbyCompsResponse> {
  const queryParams = new URLSearchParams({
    api_key: RENTOMETER_API_KEY,
    address: params.address,
    bedrooms: params.bedrooms.toString(),
  });

  if (params.baths) {
    queryParams.append("baths", params.baths);
  }
  if (params.buildingType) {
    queryParams.append("building_type", params.buildingType);
  }
  if (params.latitude && params.longitude) {
    queryParams.append("latitude", params.latitude.toString());
    queryParams.append("longitude", params.longitude.toString());
  }

  const url = `${BASE_URL}/nearby_comps?${queryParams.toString()}`;
  
  console.log(`[Rentometer] Fetching nearby comps for: ${params.address}, ${params.bedrooms}BR`);

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Rentometer] Nearby comps API error: ${response.status} - ${errorText}`);
    throw new Error(`Rentometer nearby_comps API error: ${response.status}`);
  }

  const data = await response.json();
  
  console.log(`[Rentometer] Got ${data.count || 0} nearby comps`);
  
  return data as NearbyCompsResponse;
}

// ─── Comprehensive Rentometer Data ──────────────────────────────────

export interface ComprehensiveRentometerData {
  summary: RentSummaryResponse | null;
  propertyRents: PropertyRentsResponse | null;
  nearbyComps: NearbyCompsResponse | null;
  analysis: RentAnalysis | null;
  errors: string[];
}

/**
 * Fetch all available Rentometer data for a property in one call.
 * Calls Summary, Property Rents, and Nearby Comps in parallel.
 * If userRent is provided, also calculates rent-vs-market analysis.
 * Gracefully handles individual endpoint failures.
 */
export async function getComprehensiveRentometerData(params: {
  address: string;
  bedrooms: number;
  baths?: string;
  buildingType?: "apartment" | "house";
  userRent?: number;
}): Promise<ComprehensiveRentometerData> {
  const errors: string[] = [];
  
  console.log(`[Rentometer] Fetching comprehensive data for: ${params.address}`);

  // Run all three endpoints in parallel
  const [summaryResult, propertyRentsResult, nearbyCompsResult] = await Promise.allSettled([
    getRentSummary({
      address: params.address,
      bedrooms: params.bedrooms,
      baths: params.baths,
      buildingType: params.buildingType,
    }),
    getPropertyRents({
      address: params.address,
      maxAge: 30,
    }),
    getNearbyComps({
      address: params.address,
      bedrooms: params.bedrooms,
      baths: params.baths,
      buildingType: params.buildingType,
    }),
  ]);

  const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;
  if (summaryResult.status === "rejected") {
    errors.push(`Summary: ${summaryResult.reason?.message || "Unknown error"}`);
  }

  const propertyRents = propertyRentsResult.status === "fulfilled" ? propertyRentsResult.value : null;
  if (propertyRentsResult.status === "rejected") {
    errors.push(`Property Rents: ${propertyRentsResult.reason?.message || "Unknown error"}`);
  }

  const nearbyComps = nearbyCompsResult.status === "fulfilled" ? nearbyCompsResult.value : null;
  if (nearbyCompsResult.status === "rejected") {
    errors.push(`Nearby Comps: ${nearbyCompsResult.reason?.message || "Unknown error"}`);
  }

  // Calculate analysis if we have summary data and user rent
  let analysis: RentAnalysis | null = null;
  if (summary && params.userRent && params.userRent > 0) {
    const rentAdvantage = summary.median - params.userRent;
    const rentAdvantagePercent = summary.median > 0 
      ? Math.round((rentAdvantage / summary.median) * 100)
      : 0;
    
    let percentilePosition: string;
    if (params.userRent <= summary.percentile_25) {
      percentilePosition = "bottom 25%";
    } else if (params.userRent <= summary.median) {
      percentilePosition = "below median";
    } else if (params.userRent <= summary.percentile_75) {
      percentilePosition = "above median";
    } else {
      percentilePosition = "top 25%";
    }

    analysis = {
      marketData: {
        median: summary.median,
        mean: summary.mean,
        percentile25: summary.percentile_25,
        percentile75: summary.percentile_75,
        min: summary.min,
        max: summary.max,
        samples: summary.samples,
        radiusMiles: summary.radius_miles,
      },
      userRentComparison: {
        userRent: params.userRent,
        percentilePosition,
        rentAdvantage,
        rentAdvantagePercent,
        isGoodDeal: params.userRent <= summary.median,
        summary: rentAdvantage > 0
          ? `Your rent is $${rentAdvantage.toLocaleString()}/mo below market median (${Math.abs(rentAdvantagePercent)}% savings)`
          : rentAdvantage < 0
          ? `Your rent is $${Math.abs(rentAdvantage).toLocaleString()}/mo above market median (${Math.abs(rentAdvantagePercent)}% premium)`
          : "Your rent is at the market median",
      },
    };
  }

  console.log(`[Rentometer] Comprehensive data complete. Summary: ${!!summary}, PropertyRents: ${!!propertyRents}, NearbyComps: ${!!nearbyComps}, Errors: ${errors.length}`);

  return {
    summary,
    propertyRents,
    nearbyComps,
    analysis,
    errors,
  };
}

// ─── Auth Check ──────────────────────────────────────────────────────

/**
 * Check API authentication and credits remaining
 */
export async function checkRentometerAuth(): Promise<{
  authorized: boolean;
  creditsRemaining: number;
  email: string;
}> {
  const url = `${BASE_URL}/auth?api_key=${RENTOMETER_API_KEY}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    return { authorized: false, creditsRemaining: 0, email: "" };
  }
  
  const data = await response.json();
  
  return {
    authorized: data.authorized,
    creditsRemaining: data.credits_remaining,
    email: data.account_email,
  };
}

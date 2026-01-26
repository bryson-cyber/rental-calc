/**
 * Rentometer API Integration
 * QuickView endpoint for rent market data
 */

const RENTOMETER_API_KEY = process.env.RENTOMETER_API_KEY || "";
const BASE_URL = "https://www.rentometer.com/api/v1";

// Helper to URL encode address properly
function encodeAddress(address: string): string {
  return encodeURIComponent(address);
}

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

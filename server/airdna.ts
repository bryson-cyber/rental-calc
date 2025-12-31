import { ENV } from "./_core/env";

const AIRDNA_API_BASE = "https://api.airdna.co/api/enterprise/v2";

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

// Updated interface to match actual AirDNA API response structure
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

export async function getRentalizerEstimate(
  request: RentalizerRequest
): Promise<RentalizerResponse> {
  const apiKey = ENV.airdnaApiKey;
  
  if (!apiKey) {
    throw new Error("AirDNA API key is not configured");
  }

  console.log("[AirDNA] Making request for address:", request.address);

  const response = await fetch(`${AIRDNA_API_BASE}/rentalizer/estimate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address: request.address,
      bedrooms: request.bedrooms ?? null,
      bathrooms: request.bathrooms ?? null,
      accommodates: request.accommodates ?? null,
      currency: request.currency ?? "usd",
    }),
  });

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

  const data: AirDNAApiResponse = await response.json();
  
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

  // Transform comps data from the new structure
  const transformedComps: Comp[] = (comps ?? []).slice(0, 10).map((comp) => ({
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

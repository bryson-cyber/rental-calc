/**
 * DEV_MOCK_API - Development Mock API Layer
 * 
 * When DEV_MOCK_API=true, this module intercepts all outbound fetch() calls
 * and returns pre-recorded fixture data instead of hitting live external APIs.
 * 
 * This eliminates API usage during UI development, testing, and building.
 * 
 * Usage:
 *   1. Set DEV_MOCK_API=true in your environment
 *   2. Import and call installMockApi() early in server startup
 *   3. All external API calls will return fixture data
 * 
 * To record new fixtures from live API responses:
 *   1. Set DEV_MOCK_API=false (or unset)
 *   2. Set DEV_MOCK_RECORD=true
 *   3. Run the flow you want to capture
 *   4. Fixtures are saved to server/fixtures/
 */

import { ENV } from "./_core/env";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Works in both ESM and CJS (tsx) contexts
const currentDir = (() => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return __dirname ?? process.cwd();
  }
})();
const FIXTURES_DIR = path.join(currentDir, "fixtures");

// Ensure fixtures directory exists
if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

/**
 * URL pattern matchers for each external service.
 * Each matcher returns a fixture key if the URL matches, or null if not.
 */
interface MockRoute {
  /** Human-readable service name for logging */
  service: string;
  /** Test if a URL matches this route */
  match: (url: string) => boolean;
  /** Generate a fixture key from the URL and request body */
  fixtureKey: (url: string, body?: string) => string;
  /** Default fixture response if no recorded fixture exists */
  defaultResponse: (url: string, body?: string) => MockResponse;
}

interface MockResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
}

// ============================================================
// Fixture Data - Pre-recorded responses for common API calls
// ============================================================

/**
 * Raw AirDNA Rentalizer API response shape.
 * This matches what `makeApiRequest` returns from the /rentalizer/estimate endpoint.
 * The airdna.ts code then parses this into the internal RentalizerResponse type.
 */
const MOCK_RENTALIZER_RESPONSE = {
  payload: {
    details: {
      address: "1234 Mock St, Richardson, TX 75082",
      address_lookup: "Richardson, TX",
      zipcode: "75082",
      bedrooms: 3,
      bathrooms: 2,
      accommodates: 6,
    },
    location: {
      lat: 32.9483,
      lng: -96.7299,
      market_id: "airdna-403",
      submarket_id: "airdna-3577",
    },
    stats: {
      currency: "USD",
      currency_symbol: "$",
      future: {
        summary: {
          adr: 285,
          occupancy: 0.68,
          revenue: 85000,
          revenue_upper: 98000,
          revenue_lower: 72000,
        },
        metrics: [
          { date: "2025-01", occupancy: 0.75, adr: 250, revenue: 5800 },
          { date: "2025-02", occupancy: 0.78, adr: 260, revenue: 6200 },
          { date: "2025-03", occupancy: 0.82, adr: 280, revenue: 7500 },
          { date: "2025-04", occupancy: 0.80, adr: 290, revenue: 7800 },
          { date: "2025-05", occupancy: 0.85, adr: 300, revenue: 8200 },
          { date: "2025-06", occupancy: 0.88, adr: 320, revenue: 9000 },
          { date: "2025-07", occupancy: 0.90, adr: 340, revenue: 9500 },
          { date: "2025-08", occupancy: 0.86, adr: 310, revenue: 8800 },
          { date: "2025-09", occupancy: 0.78, adr: 275, revenue: 7200 },
          { date: "2025-10", occupancy: 0.72, adr: 265, revenue: 6500 },
          { date: "2025-11", occupancy: 0.68, adr: 240, revenue: 5500 },
          { date: "2025-12", occupancy: 0.65, adr: 235, revenue: 5200 },
        ],
      },
      historical: {
        summary: {
          revenue_valuation: {
            monthly_pct_change: 0.02,
            yearly_pct_change: 0.08,
          },
        },
        metrics: [
          { date: "2024-01", revenue_valuation: 78000 },
          { date: "2024-06", revenue_valuation: 82000 },
          { date: "2024-12", revenue_valuation: 85000 },
        ],
      },
    },
    comps: [
      {
        property_id: "mock-comp-1",
        details: {
          title: "Mock Luxury Villa",
          accommodates: 6,
          bedrooms: 3,
          bathrooms: 2,
          reviews: 120,
          rating: 4.9,
          images: ["https://placehold.co/400x300/C9A962/0F172A?text=Mock+Villa"],
          property_type: "Entire home/apt",
        },
        distance_meters: 500,
        platforms: {
          airbnb_property_id: "mock-1",
          airbnb_property_url: "https://www.airbnb.com/rooms/mock-1",
        },
        stats: {
          summary: {
            occupancy: 0.72,
            adr: 310,
            revenue: 92000,
          },
          metrics: [
            { date: "2025-01", occupancy: 0.70, adr: 290, revenue: 6200, revenue_potential: 8900 },
            { date: "2025-02", occupancy: 0.75, adr: 305, revenue: 7000, revenue_potential: 9300 },
            { date: "2025-03", occupancy: 0.80, adr: 320, revenue: 7800, revenue_potential: 9900 },
          ],
        },
      },
      {
        property_id: "mock-comp-2",
        details: {
          title: "Mock Downtown Condo",
          accommodates: 6,
          bedrooms: 3,
          bathrooms: 2.5,
          reviews: 85,
          rating: 4.7,
          images: ["https://placehold.co/400x300/C9A962/0F172A?text=Mock+Condo"],
          property_type: "Entire home/apt",
        },
        distance_meters: 800,
        platforms: {
          airbnb_property_id: "mock-2",
          airbnb_property_url: "https://www.airbnb.com/rooms/mock-2",
        },
        stats: {
          summary: {
            occupancy: 0.70,
            adr: 265,
            revenue: 78000,
          },
          metrics: [
            { date: "2025-01", occupancy: 0.68, adr: 250, revenue: 5200, revenue_potential: 7700 },
            { date: "2025-02", occupancy: 0.72, adr: 260, revenue: 5700, revenue_potential: 7900 },
            { date: "2025-03", occupancy: 0.75, adr: 275, revenue: 6300, revenue_potential: 8500 },
          ],
        },
      },
      {
        property_id: "mock-comp-3",
        details: {
          title: "Mock Cozy Retreat",
          accommodates: 5,
          bedrooms: 3,
          bathrooms: 2,
          reviews: 60,
          rating: 4.8,
          images: ["https://placehold.co/400x300/C9A962/0F172A?text=Mock+Retreat"],
          property_type: "Entire home/apt",
        },
        distance_meters: 1200,
        platforms: {
          airbnb_property_id: "mock-3",
          airbnb_property_url: "https://www.airbnb.com/rooms/mock-3",
        },
        stats: {
          summary: {
            occupancy: 0.65,
            adr: 245,
            revenue: 68000,
          },
          metrics: [
            { date: "2025-01", occupancy: 0.62, adr: 230, revenue: 4400, revenue_potential: 7100 },
            { date: "2025-02", occupancy: 0.66, adr: 240, revenue: 4800, revenue_potential: 7400 },
            { date: "2025-03", occupancy: 0.70, adr: 255, revenue: 5500, revenue_potential: 7900 },
          ],
        },
      },
      {
        property_id: "mock-comp-4",
        details: {
          title: "Mock Family Home",
          accommodates: 8,
          bedrooms: 3,
          bathrooms: 2,
          reviews: 45,
          rating: 4.6,
          images: ["https://placehold.co/400x300/C9A962/0F172A?text=Mock+Family"],
          property_type: "Entire home/apt",
        },
        distance_meters: 1500,
        platforms: {
          airbnb_property_id: "mock-4",
          airbnb_property_url: "https://www.airbnb.com/rooms/mock-4",
        },
        stats: {
          summary: {
            occupancy: 0.68,
            adr: 255,
            revenue: 72000,
          },
          metrics: [
            { date: "2025-01", occupancy: 0.65, adr: 240, revenue: 4800, revenue_potential: 7400 },
            { date: "2025-02", occupancy: 0.70, adr: 250, revenue: 5400, revenue_potential: 7700 },
            { date: "2025-03", occupancy: 0.72, adr: 265, revenue: 5800, revenue_potential: 8200 },
          ],
        },
      },
      {
        property_id: "mock-comp-5",
        details: {
          title: "Mock Modern Apartment",
          accommodates: 4,
          bedrooms: 3,
          bathrooms: 2,
          reviews: 30,
          rating: 4.5,
          images: ["https://placehold.co/400x300/C9A962/0F172A?text=Mock+Modern"],
          property_type: "Entire home/apt",
        },
        distance_meters: 2000,
        platforms: {
          airbnb_property_id: "mock-5",
          airbnb_property_url: "https://www.airbnb.com/rooms/mock-5",
        },
        stats: {
          summary: {
            occupancy: 0.62,
            adr: 230,
            revenue: 65000,
          },
          metrics: [
            { date: "2025-01", occupancy: 0.60, adr: 215, revenue: 3900, revenue_potential: 6600 },
            { date: "2025-02", occupancy: 0.63, adr: 225, revenue: 4300, revenue_potential: 6900 },
            { date: "2025-03", occupancy: 0.67, adr: 240, revenue: 4900, revenue_potential: 7400 },
          ],
        },
      },
    ],
  },
};

const MOCK_MARKET_SEARCH_RESPONSE = {
  payload: {
    results: [
      {
        id: "airdna-403",
        name: "Dallas",
        type: "market",
        listing_count: 11500,
        location_name: "Dallas, Texas",
        location: {
          state: "Texas",
          country: "US",
        },
        legacy_location: {
          zipcodes: ["75001", "75080", "75081", "75082"],
          neighborhoods: [],
        },
      },
    ],
  },
  status: {
    type: "success",
    message: "OK",
  },
};

const MOCK_MARKET_DETAILS_RESPONSE = {
  payload: {
    id: "airdna-403",
    name: "Dallas",
    listing_count: 11500,
    location_name: "Dallas, Texas",
    market_type: "market",
    metrics: {
      market_score: 72,
      revenue: 44000,
      booked: 0.62,
      daily_rate: 195,
      revpar: 121,
    },
  },
};

/**
 * Mock market metrics response (for /market/{id}/metrics/{type} endpoints).
 * Each metric type returns payload.metrics array.
 */
const MOCK_MARKET_METRICS_RESPONSE = {
  payload: {
    metrics: [
      { month: "2024-01", date: "2024-01", value: 0.58, occupancy: 0.58, occupancy_rate: 0.58, avg_revenue: 3100, revenue: 3100, adr: 175, revpar: 101, active_listings_count: 10800, active_listings: 10800, booking_lead_time: 14, los: 3.2 },
      { month: "2024-02", date: "2024-02", value: 0.60, occupancy: 0.60, occupancy_rate: 0.60, avg_revenue: 3300, revenue: 3300, adr: 180, revpar: 108, active_listings_count: 10900, active_listings: 10900, booking_lead_time: 15, los: 3.1 },
      { month: "2024-03", date: "2024-03", value: 0.63, occupancy: 0.63, occupancy_rate: 0.63, avg_revenue: 3700, revenue: 3700, adr: 190, revpar: 120, active_listings_count: 11000, active_listings: 11000, booking_lead_time: 16, los: 3.3 },
      { month: "2024-04", date: "2024-04", value: 0.65, occupancy: 0.65, occupancy_rate: 0.65, avg_revenue: 3900, revenue: 3900, adr: 195, revpar: 127, active_listings_count: 11100, active_listings: 11100, booking_lead_time: 17, los: 3.4 },
      { month: "2024-05", date: "2024-05", value: 0.68, occupancy: 0.68, occupancy_rate: 0.68, avg_revenue: 4300, revenue: 4300, adr: 205, revpar: 139, active_listings_count: 11200, active_listings: 11200, booking_lead_time: 18, los: 3.5 },
      { month: "2024-06", date: "2024-06", value: 0.72, occupancy: 0.72, occupancy_rate: 0.72, avg_revenue: 4800, revenue: 4800, adr: 220, revpar: 158, active_listings_count: 11300, active_listings: 11300, booking_lead_time: 20, los: 3.6 },
      { month: "2024-07", date: "2024-07", value: 0.70, occupancy: 0.70, occupancy_rate: 0.70, avg_revenue: 4600, revenue: 4600, adr: 215, revpar: 151, active_listings_count: 11400, active_listings: 11400, booking_lead_time: 19, los: 3.5 },
      { month: "2024-08", date: "2024-08", value: 0.67, occupancy: 0.67, occupancy_rate: 0.67, avg_revenue: 4100, revenue: 4100, adr: 200, revpar: 134, active_listings_count: 11500, active_listings: 11500, booking_lead_time: 17, los: 3.3 },
      { month: "2024-09", date: "2024-09", value: 0.64, occupancy: 0.64, occupancy_rate: 0.64, avg_revenue: 3700, revenue: 3700, adr: 190, revpar: 122, active_listings_count: 11500, active_listings: 11500, booking_lead_time: 15, los: 3.2 },
      { month: "2024-10", date: "2024-10", value: 0.61, occupancy: 0.61, occupancy_rate: 0.61, avg_revenue: 3500, revenue: 3500, adr: 185, revpar: 113, active_listings_count: 11400, active_listings: 11400, booking_lead_time: 14, los: 3.1 },
      { month: "2024-11", date: "2024-11", value: 0.58, occupancy: 0.58, occupancy_rate: 0.58, avg_revenue: 3200, revenue: 3200, adr: 178, revpar: 103, active_listings_count: 11300, active_listings: 11300, booking_lead_time: 13, los: 3.0 },
      { month: "2024-12", date: "2024-12", value: 0.55, occupancy: 0.55, occupancy_rate: 0.55, avg_revenue: 2800, revenue: 2800, adr: 170, revpar: 94, active_listings_count: 11200, active_listings: 11200, booking_lead_time: 12, los: 2.9 },
    ],
  },
};

// Supply trend uses the same /market/{id}/metrics/active_listings_count endpoint
// which is handled by MOCK_MARKET_METRICS_RESPONSE above

// Bedroom performance is calculated from comps/listings, not a separate API endpoint

// Generate deterministic mock listings (seeded, not random)
const MOCK_LISTINGS_DATA = [
  { id: "mock-listing-1", title: "Charming Downtown Loft", bedrooms: 2, bathrooms: 1, accommodates: 4, rating: 4.8, reviews: 142, annual_revenue: 62000, adr: 195, occupancy: 0.72, latitude: 32.9485, longitude: -96.7305, property_type: "Entire home/apt" },
  { id: "mock-listing-2", title: "Spacious Family Home", bedrooms: 4, bathrooms: 3, accommodates: 10, rating: 4.9, reviews: 98, annual_revenue: 95000, adr: 340, occupancy: 0.68, latitude: 32.9492, longitude: -96.7290, property_type: "Entire home/apt" },
  { id: "mock-listing-3", title: "Modern Studio Near Park", bedrooms: 1, bathrooms: 1, accommodates: 2, rating: 4.6, reviews: 67, annual_revenue: 35000, adr: 125, occupancy: 0.75, latitude: 32.9478, longitude: -96.7315, property_type: "Entire home/apt" },
  { id: "mock-listing-4", title: "Luxury Pool House", bedrooms: 3, bathrooms: 2, accommodates: 8, rating: 4.9, reviews: 210, annual_revenue: 88000, adr: 295, occupancy: 0.70, latitude: 32.9500, longitude: -96.7280, property_type: "Entire home/apt" },
  { id: "mock-listing-5", title: "Cozy Cottage Retreat", bedrooms: 2, bathrooms: 1, accommodates: 4, rating: 4.7, reviews: 55, annual_revenue: 48000, adr: 165, occupancy: 0.65, latitude: 32.9470, longitude: -96.7330, property_type: "Entire home/apt" },
  { id: "mock-listing-6", title: "Executive Suite", bedrooms: 3, bathrooms: 2, accommodates: 6, rating: 4.5, reviews: 38, annual_revenue: 72000, adr: 250, occupancy: 0.62, latitude: 32.9510, longitude: -96.7260, property_type: "Entire home/apt" },
  { id: "mock-listing-7", title: "Artist's Bungalow", bedrooms: 1, bathrooms: 1, accommodates: 3, rating: 4.8, reviews: 180, annual_revenue: 42000, adr: 145, occupancy: 0.78, latitude: 32.9465, longitude: -96.7295, property_type: "Entire home/apt" },
  { id: "mock-listing-8", title: "Suburban Oasis", bedrooms: 4, bathrooms: 2, accommodates: 8, rating: 4.4, reviews: 25, annual_revenue: 78000, adr: 275, occupancy: 0.60, latitude: 32.9520, longitude: -96.7340, property_type: "Entire home/apt" },
  { id: "mock-listing-9", title: "Historic District Gem", bedrooms: 2, bathrooms: 2, accommodates: 5, rating: 4.9, reviews: 320, annual_revenue: 58000, adr: 200, occupancy: 0.73, latitude: 32.9488, longitude: -96.7270, property_type: "Entire home/apt" },
  { id: "mock-listing-10", title: "Penthouse Views", bedrooms: 3, bathrooms: 2, accommodates: 6, rating: 4.7, reviews: 88, annual_revenue: 105000, adr: 365, occupancy: 0.71, latitude: 32.9495, longitude: -96.7250, property_type: "Entire home/apt" },
];

const MOCK_LISTINGS_RESPONSE = {
  payload: {
    listings: MOCK_LISTINGS_DATA.map((l) => ({
      property_id: l.id,
      title: l.title,
      airbnb_property_id: l.id,
      airbnb_property_url: `https://www.airbnb.com/rooms/${l.id}`,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      accommodates: l.accommodates,
      property_type: l.property_type,
      rating: l.rating,
      reviews: l.reviews,
      revenue_ltm: l.annual_revenue,
      average_daily_rate_ltm: l.adr,
      occupancy_rate_ltm: l.occupancy,
      location: { lat: l.latitude, lng: l.longitude },
      zipcode: "75082",
      images: [`https://placehold.co/400x300/C9A962/0F172A?text=${encodeURIComponent(l.title)}`],
    })),
    page_info: {
      total_count: 10,
      page_size: 25,
      offset: 0,
    },
  },
};

const MOCK_RENTOMETER_RESPONSE = {
  address: "1234 Mock St, Richardson, TX 75082",
  latitude: "32.9483",
  longitude: "-96.7299",
  bedrooms: 3,
  baths: "2",
  building_type: "house",
  look_back_days: 365,
  mean: 2200,
  median: 2100,
  min: 1200,
  max: 3500,
  percentile_25: 1800,
  percentile_75: 2600,
  std_dev: 380,
  samples: 45,
  radius_miles: 1.5,
  quickview_url: "https://www.rentometer.com/analysis/mock",
  credits_remaining: 999,
  token: "mock-token",
};

const MOCK_CLAUDE_RESPONSE = {
  id: "msg_mock_001",
  type: "message",
  role: "assistant",
  content: [
    {
      type: "text",
      text: `## Executive Summary\n\nThe subject property at **1234 Mock St, Richardson, TX 75082** presents a compelling short-term rental opportunity in the Dallas metropolitan area. This 3-bedroom, 2-bathroom property with capacity for 6 guests is projected to generate **$85,000 in annual revenue** with an average daily rate of **$285** and an occupancy rate of **68%**.\n\n### Revenue Outlook\n\nThe property's projected annual revenue of **$85,000** places it well above the market average of **$44,000**, suggesting strong earning potential. The revenue range spans from **$72,000** to **$98,000**, providing a reasonable confidence interval. Peak revenue months are projected for June-August, with the strongest month generating approximately **$9,500** in revenue at a **90% occupancy rate**.\n\n### Market Position\n\nThe Dallas market hosts approximately **11,500 active listings** with a market score of **72/100**. The market average occupancy of **62%** is notably lower than this property's projected **68%**, indicating above-average performance potential. The 3-bedroom segment in this market generates an average revenue of **$49,800**, making this property's **$85,000** projection approximately **71% above** the bedroom-type average.\n\n### Competitive Landscape\n\n**5 comparable properties** were analyzed within the immediate vicinity. The top performer generates **$92,000** annually, while the average comp revenue is **$75,000**. The subject property's projected revenue of **$85,000** positions it in the **upper quartile** of comparable properties. Average competitor ratings hover around **4.7 stars**, indicating a high-quality competitive environment.\n\n### Key Takeaways\n\n- The property's projected **$85,000 annual revenue** significantly outperforms the market average of **$44,000**\n- At **68% projected occupancy**, the property exceeds the market average of **62%** by 6 percentage points\n- The **$285 average daily rate** is competitive with top-performing comparables in the area\n- Seasonal variation shows a **$4,300 spread** between peak and trough months, suggesting manageable seasonality\n\n*Note: This is mock data generated for development purposes.*`,
    },
  ],
  model: "claude-sonnet-4-6",
  stop_reason: "end_turn",
  usage: { input_tokens: 500, output_tokens: 800 },
};

const MOCK_HUBSPOT_CONTACT_RESPONSE = {
  results: [],
  total: 0,
};

const MOCK_HASDATA_RESPONSE = {
  status: "ok",
  data: {
    address: "1234 Mock St, Richardson, TX 75082",
    price: 450000,
    bedrooms: 3,
    bathrooms: 2,
    sqft: 2000,
    lot_size: 7500,
    year_built: 2005,
    property_type: "Single Family",
    zestimate: 460000,
    rent_zestimate: 2400,
    tax_assessed_value: 380000,
    annual_tax: 8500,
  },
};

const MOCK_SUBMARKET_DETAILS_RESPONSE = {
  payload: {
    id: "airdna-3577",
    name: "Richardson",
    listing_count: 450,
    parent_market_name: "Dallas",
    market_id: "airdna-403",
    market_type: "submarket",
    metrics: {
      market_score: 68,
      revenue: 49800,
      booked: 0.65,
      daily_rate: 210,
      revpar: 137,
    },
  },
};

const MOCK_SUBMARKETS_RESPONSE = {
  payload: {
    submarkets: [
      { id: "airdna-3577", name: "Richardson", listing_count: 450, metrics: { occupancy: 0.65, adr: 210, revenue: 49800, revpar: 137 } },
      { id: "airdna-3578", name: "Plano", listing_count: 620, metrics: { occupancy: 0.63, adr: 225, revenue: 51700, revpar: 142 } },
      { id: "airdna-3579", name: "Frisco", listing_count: 380, metrics: { occupancy: 0.67, adr: 240, revenue: 58700, revpar: 161 } },
      { id: "airdna-3580", name: "McKinney", listing_count: 290, metrics: { occupancy: 0.61, adr: 195, revenue: 43400, revpar: 119 } },
    ],
    total: 4,
  },
};

// ============================================================
// Mock Routes - Pattern matching for each external service
// ============================================================

const mockRoutes: MockRoute[] = [
  // AirDNA Rentalizer
  {
    service: "AirDNA Rentalizer",
    match: (url) => url.includes("airdna.co") && url.includes("rentalizer"),
    fixtureKey: (url) => "airdna-rentalizer",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_RENTALIZER_RESPONSE,
    }),
  },
  // AirDNA Market Search
  {
    service: "AirDNA Market Search",
    match: (url) => url.includes("airdna.co") && url.includes("market/search"),
    fixtureKey: (url) => "airdna-market-search",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_MARKET_SEARCH_RESPONSE,
    }),
  },
  // AirDNA Submarkets
  {
    service: "AirDNA Submarkets",
    match: (url) => url.includes("airdna.co") && /\/market\/[^/]+\/submarkets/.test(url),
    fixtureKey: (url) => "airdna-submarkets",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_SUBMARKETS_RESPONSE,
    }),
  },
  // AirDNA Submarket Details
  {
    service: "AirDNA Submarket Details",
    match: (url) => url.includes("airdna.co") && /\/submarket\/[^/]+$/.test(url),
    fixtureKey: (url) => "airdna-submarket-details",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_SUBMARKET_DETAILS_RESPONSE,
    }),
  },
  // AirDNA Listing Comps / Radius Search
  {
    service: "AirDNA Listing Comps",
    match: (url) => url.includes("airdna.co") && url.includes("/listing/comps"),
    fixtureKey: (url) => "airdna-listing-comps",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_LISTINGS_RESPONSE,
    }),
  },
  // AirDNA Market Listings
  {
    service: "AirDNA Listings",
    match: (url) => url.includes("airdna.co") && url.includes("/listings"),
    fixtureKey: (url) => "airdna-listings",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_LISTINGS_RESPONSE,
    }),
  },
  // AirDNA Market/Submarket Metrics (occupancy, revenue, adr, supply, etc.)
  {
    service: "AirDNA Market Metrics",
    match: (url) => url.includes("airdna.co") && url.includes("/metrics/"),
    fixtureKey: (url) => "airdna-market-metrics",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_MARKET_METRICS_RESPONSE,
    }),
  },
  // AirDNA Market Details (catch-all for /market/{id} endpoints)
  {
    service: "AirDNA Market",
    match: (url) => url.includes("airdna.co") && url.includes("/market/"),
    fixtureKey: (url) => "airdna-market-details",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_MARKET_DETAILS_RESPONSE,
    }),
  },
  // AirDNA catch-all
  {
    service: "AirDNA",
    match: (url) => url.includes("airdna.co"),
    fixtureKey: (url) => "airdna-generic",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: { status: "ok", data: {} },
    }),
  },
  // Rentometer
  {
    service: "Rentometer",
    match: (url) => url.includes("rentometer.com"),
    fixtureKey: (url) => "rentometer",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_RENTOMETER_RESPONSE,
    }),
  },
  // AI (Claude)
  {
    service: "Claude AI",
    match: (url) => url.includes("api.anthropic.com"),
    fixtureKey: (url) => "claude",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_CLAUDE_RESPONSE,
    }),
  },
  // HubSpot
  {
    service: "HubSpot",
    match: (url) => url.includes("hubapi.com") || url.includes("hubspot.com"),
    fixtureKey: (url) => "hubspot",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_HUBSPOT_CONTACT_RESPONSE,
    }),
  },
  // HasData (Zillow/Redfin scraper)
  {
    service: "HasData",
    match: (url) => url.includes("hasdata.com"),
    fixtureKey: (url) => "hasdata",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_HASDATA_RESPONSE,
    }),
  },
  // SimpleTexting
  {
    service: "SimpleTexting",
    match: (url) => url.includes("simpletexting.com"),
    fixtureKey: (url) => "simpletexting",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: { success: true, message_id: "mock-sms-123" },
    }),
  },
  // Zapier
  {
    service: "Zapier",
    match: (url) => url.includes("zapier.com") || url.includes("hooks.zapier.com"),
    fixtureKey: (url) => "zapier",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: { status: "success", id: "mock-zap-123" },
    }),
  },
  // Airbnb
  {
    service: "Airbnb",
    match: (url) => url.includes("airbnb.com"),
    fixtureKey: (url) => "airbnb",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/html" },
      body: "<html><body>Mock Airbnb listing page</body></html>",
    }),
  },
  // Google Vertex AI Search (regulation tracker)
  {
    service: "Google Vertex AI Search",
    match: (url) => url.includes("vertexaisearch.cloud.google.com"),
    fixtureKey: (url) => "vertex-ai-search",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/html" },
      body: "<html><body>Mock search result page</body></html>",
    }),
  },
  // Government / regulation URLs (HEAD requests for URL validation)
  {
    service: "URL Validation",
    match: (url) => url.includes(".gov") || url.includes(".org") || url.includes(".edu"),
    fixtureKey: (url) => "url-validation",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/html" },
      body: "",
    }),
  },
  // Google Search (regulation tracker fallback links)
  {
    service: "Google Search",
    match: (url) => url.includes("google.com/search"),
    fixtureKey: (url) => "google-search",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/html" },
      body: "<html><body>Mock search results</body></html>",
    }),
  },
];

// ============================================================
// Fixture File Management
// ============================================================

function loadFixture(key: string): MockResponse | null {
  const filePath = path.join(FIXTURES_DIR, `${key}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return data;
    }
  } catch (e) {
    console.warn(`[DEV_MOCK] Failed to load fixture: ${key}`, e);
  }
  return null;
}

function saveFixture(key: string, response: MockResponse): void {
  const filePath = path.join(FIXTURES_DIR, `${key}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(response, null, 2), "utf-8");
    console.log(`[DEV_MOCK] Recorded fixture: ${key}`);
  } catch (e) {
    console.warn(`[DEV_MOCK] Failed to save fixture: ${key}`, e);
  }
}

// ============================================================
// Fetch Interceptor
// ============================================================

let originalFetch: typeof globalThis.fetch | null = null;
let mockInstalled = false;
let interceptCount = 0;
let passCount = 0;

function createMockResponse(mockResp: MockResponse): Response {
  const body = typeof mockResp.body === "string"
    ? mockResp.body
    : JSON.stringify(mockResp.body);

  return new Response(body, {
    status: mockResp.status,
    statusText: mockResp.statusText,
    headers: new Headers(mockResp.headers),
  });
}

/**
 * Install the mock API interceptor.
 * Call this early in server startup (e.g., in server/_core/index.ts).
 * Only activates when DEV_MOCK_API=true.
 */
export function installMockApi(): void {
  // CRITICAL SAFEGUARD: Never allow mock API in production, regardless of DEV_MOCK_API value.
  // This prevents mock data from leaking into customer-facing reports.
  if (ENV.isProduction) {
    if (ENV.devMockApi) {
      console.error(
        "[DEV_MOCK] \u26d4 BLOCKED: DEV_MOCK_API=true is set but NODE_ENV=production. " +
        "Mock API will NOT activate in production. Remove or set DEV_MOCK_API=false."
      );
    }
    return;
  }
  if (!ENV.devMockApi) {
    console.log("[DEV_MOCK] Mock API disabled (DEV_MOCK_API != true)");
    return;
  }
  if (mockInstalled) {
    console.log("[DEV_MOCK] Mock API already installed");
    return;
  }

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  🔶 DEV_MOCK_API MODE ACTIVE                    ║");
  console.log("║  All external API calls return fixture data.     ║");
  console.log("║  No live API calls will be made.                 ║");
  console.log("║  Set DEV_MOCK_API=false to use real APIs.        ║");
  console.log("╚══════════════════════════════════════════════════╝");

  originalFetch = globalThis.fetch;

  globalThis.fetch = async function mockFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    // Only intercept external URLs — pass through internal/localhost calls
    if (
      url.startsWith("/") ||
      url.includes("localhost") ||
      url.includes("127.0.0.1") ||
      url.includes("manus.computer") ||
      url.includes("manus.im") ||
      url.includes("forge.manus") ||
      url.includes("tidbcloud.com")
    ) {
      passCount++;
      return originalFetch!(input, init);
    }

    // Find matching mock route
    for (const route of mockRoutes) {
      if (route.match(url)) {
        interceptCount++;
        const bodyStr = init?.body ? String(init.body) : undefined;
        const fixtureKey = route.fixtureKey(url, bodyStr);

        // Try to load a recorded fixture first
        const recorded = loadFixture(fixtureKey);
        if (recorded) {
          console.log(`[DEV_MOCK] ✓ ${route.service} (fixture: ${fixtureKey})`);
          return createMockResponse(recorded);
        }

        // Fall back to default mock response
        const defaultResp = route.defaultResponse(url, bodyStr);
        console.log(`[DEV_MOCK] ✓ ${route.service} (default mock)`);
        return createMockResponse(defaultResp);
      }
    }

    // Unmatched external URL — log warning and pass through
    console.warn(`[DEV_MOCK] ⚠ Unmatched external URL (passing through): ${url.substring(0, 100)}`);
    passCount++;
    return originalFetch!(input, init);
  } as typeof globalThis.fetch;

  mockInstalled = true;
}

/**
 * Uninstall the mock API interceptor and restore original fetch.
 */
export function uninstallMockApi(): void {
  if (!mockInstalled || !originalFetch) return;

  globalThis.fetch = originalFetch;
  originalFetch = null;
  mockInstalled = false;

  console.log(`[DEV_MOCK] Mock API uninstalled. Stats: ${interceptCount} intercepted, ${passCount} passed through`);
  interceptCount = 0;
  passCount = 0;
}

/**
 * Check if mock API is currently active.
 */
export function isMockApiActive(): boolean {
  return mockInstalled;
}

/**
 * Get mock API stats.
 */
export function getMockApiStats() {
  return {
    active: mockInstalled,
    intercepted: interceptCount,
    passedThrough: passCount,
  };
}

/**
 * Record a live API response as a fixture for future mock use.
 * Use this when DEV_MOCK_RECORD=true to capture real responses.
 */
export function recordFixture(key: string, response: MockResponse): void {
  saveFixture(key, response);
}

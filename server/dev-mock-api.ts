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

const MOCK_RENTALIZER_RESPONSE = {
  property: {
    address: "1234 Mock St, Richardson, TX 75082",
    address_lookup: "1234 Mock St, Richardson, TX 75082, USA",
    zipcode: "75082",
    bedrooms: 3,
    bathrooms: 2,
    accommodates: 6,
    latitude: 32.9483,
    longitude: -96.7299,
    market_id: "airdna-403",
    submarket_id: "airdna-3577",
  },
  estimates: {
    annual_revenue: 85000,
    annual_revenue_low: 72000,
    annual_revenue_high: 98000,
    average_daily_rate: 285,
    occupancy_rate: 0.68,
    currency: "USD",
    currency_symbol: "$",
  },
  monthly_forecast: [
    { month: "2025-01", revenue: 5800, adr: 250, occupancy: 0.75 },
    { month: "2025-02", revenue: 6200, adr: 260, occupancy: 0.78 },
    { month: "2025-03", revenue: 7500, adr: 280, occupancy: 0.82 },
    { month: "2025-04", revenue: 7800, adr: 290, occupancy: 0.80 },
    { month: "2025-05", revenue: 8200, adr: 300, occupancy: 0.85 },
    { month: "2025-06", revenue: 9000, adr: 320, occupancy: 0.88 },
    { month: "2025-07", revenue: 9500, adr: 340, occupancy: 0.90 },
    { month: "2025-08", revenue: 8800, adr: 310, occupancy: 0.86 },
    { month: "2025-09", revenue: 7200, adr: 275, occupancy: 0.78 },
    { month: "2025-10", revenue: 6500, adr: 265, occupancy: 0.72 },
    { month: "2025-11", revenue: 5500, adr: 240, occupancy: 0.68 },
    { month: "2025-12", revenue: 5200, adr: 235, occupancy: 0.65 },
  ],
  comps: [
    {
      title: "Mock Luxury Villa",
      bedrooms: 3,
      bathrooms: 2,
      rating: 4.9,
      reviews: 120,
      annual_revenue: 92000,
      adr: 310,
      occupancy: 0.72,
      distance_meters: 500,
      latitude: 32.9490,
      longitude: -96.7310,
      airbnb_listing_id: "mock-1",
    },
    {
      title: "Mock Downtown Condo",
      bedrooms: 3,
      bathrooms: 2.5,
      rating: 4.7,
      reviews: 85,
      annual_revenue: 78000,
      adr: 265,
      occupancy: 0.70,
      distance_meters: 800,
      latitude: 32.9475,
      longitude: -96.7280,
      airbnb_listing_id: "mock-2",
    },
    {
      title: "Mock Cozy Retreat",
      bedrooms: 3,
      bathrooms: 2,
      rating: 4.8,
      reviews: 60,
      annual_revenue: 68000,
      adr: 245,
      occupancy: 0.65,
      distance_meters: 1200,
      latitude: 32.9500,
      longitude: -96.7260,
      airbnb_listing_id: "mock-3",
    },
    {
      title: "Mock Family Home",
      bedrooms: 3,
      bathrooms: 2,
      rating: 4.6,
      reviews: 45,
      annual_revenue: 72000,
      adr: 255,
      occupancy: 0.68,
      distance_meters: 1500,
      latitude: 32.9460,
      longitude: -96.7320,
      airbnb_listing_id: "mock-4",
    },
    {
      title: "Mock Modern Apartment",
      bedrooms: 3,
      bathrooms: 2,
      rating: 4.5,
      reviews: 30,
      annual_revenue: 65000,
      adr: 230,
      occupancy: 0.62,
      distance_meters: 2000,
      latitude: 32.9510,
      longitude: -96.7340,
      airbnb_listing_id: "mock-5",
    },
  ],
  market_id: "airdna-403",
};

const MOCK_MARKET_SEARCH_RESPONSE = {
  results: [
    {
      id: "airdna-403",
      name: "Dallas",
      type: "market",
      listing_count: 11500,
      location_name: "Dallas, Texas",
      state: "Texas",
      country: "US",
    },
  ],
};

const MOCK_MARKET_DETAILS_RESPONSE = {
  market_id: "airdna-403",
  market_name: "Dallas",
  metrics: {
    occupancy: 0.62,
    adr: 195,
    revenue: 44000,
    revpar: 121,
    active_listings: 11500,
    market_score: 72,
    average_los: 3.2,
    booking_lead_time: 14,
  },
  listing_count: 11500,
  historical: {
    occupancy: [
      { date: "2024-01", value: 0.58 },
      { date: "2024-02", value: 0.60 },
      { date: "2024-03", value: 0.63 },
      { date: "2024-04", value: 0.65 },
      { date: "2024-05", value: 0.68 },
      { date: "2024-06", value: 0.72 },
      { date: "2024-07", value: 0.70 },
      { date: "2024-08", value: 0.67 },
      { date: "2024-09", value: 0.64 },
      { date: "2024-10", value: 0.61 },
      { date: "2024-11", value: 0.58 },
      { date: "2024-12", value: 0.55 },
    ],
    adr: [
      { date: "2024-01", value: 175 },
      { date: "2024-02", value: 180 },
      { date: "2024-03", value: 190 },
      { date: "2024-04", value: 195 },
      { date: "2024-05", value: 205 },
      { date: "2024-06", value: 220 },
      { date: "2024-07", value: 215 },
      { date: "2024-08", value: 200 },
      { date: "2024-09", value: 190 },
      { date: "2024-10", value: 185 },
      { date: "2024-11", value: 178 },
      { date: "2024-12", value: 170 },
    ],
    revenue: [
      { date: "2024-01", value: 3100 },
      { date: "2024-02", value: 3300 },
      { date: "2024-03", value: 3700 },
      { date: "2024-04", value: 3900 },
      { date: "2024-05", value: 4300 },
      { date: "2024-06", value: 4800 },
      { date: "2024-07", value: 4600 },
      { date: "2024-08", value: 4100 },
      { date: "2024-09", value: 3700 },
      { date: "2024-10", value: 3500 },
      { date: "2024-11", value: 3200 },
      { date: "2024-12", value: 2800 },
    ],
    revpar: [
      { date: "2024-01", value: 101 },
      { date: "2024-02", value: 108 },
      { date: "2024-03", value: 120 },
      { date: "2024-04", value: 127 },
      { date: "2024-05", value: 139 },
      { date: "2024-06", value: 158 },
      { date: "2024-07", value: 151 },
      { date: "2024-08", value: 134 },
      { date: "2024-09", value: 122 },
      { date: "2024-10", value: 113 },
      { date: "2024-11", value: 103 },
      { date: "2024-12", value: 94 },
    ],
    active_listings: [
      { date: "2024-01", value: 10800 },
      { date: "2024-02", value: 10900 },
      { date: "2024-03", value: 11000 },
      { date: "2024-04", value: 11100 },
      { date: "2024-05", value: 11200 },
      { date: "2024-06", value: 11300 },
      { date: "2024-07", value: 11400 },
      { date: "2024-08", value: 11500 },
      { date: "2024-09", value: 11500 },
      { date: "2024-10", value: 11400 },
      { date: "2024-11", value: 11300 },
      { date: "2024-12", value: 11200 },
    ],
  },
  bedroom_performance: [
    { bedrooms: 1, occupancy: 0.72, adr: 120, revenue: 31500, listing_count: 3200 },
    { bedrooms: 2, occupancy: 0.68, adr: 165, revenue: 41000, listing_count: 4100 },
    { bedrooms: 3, occupancy: 0.65, adr: 210, revenue: 49800, listing_count: 2800 },
    { bedrooms: 4, occupancy: 0.60, adr: 280, revenue: 61300, listing_count: 900 },
    { bedrooms: 5, occupancy: 0.55, adr: 350, revenue: 70200, listing_count: 350 },
    { bedrooms: 6, occupancy: 0.50, adr: 420, revenue: 76600, listing_count: 150 },
  ],
};

const MOCK_MARKET_SUPPLY_RESPONSE = {
  data: [
    { date: "2024-01", total_listings: 10800, entire_home: 7200, private_room: 3600 },
    { date: "2024-02", total_listings: 10900, entire_home: 7300, private_room: 3600 },
    { date: "2024-03", total_listings: 11000, entire_home: 7400, private_room: 3600 },
    { date: "2024-04", total_listings: 11100, entire_home: 7500, private_room: 3600 },
    { date: "2024-05", total_listings: 11200, entire_home: 7600, private_room: 3600 },
    { date: "2024-06", total_listings: 11300, entire_home: 7700, private_room: 3600 },
    { date: "2024-07", total_listings: 11400, entire_home: 7800, private_room: 3600 },
    { date: "2024-08", total_listings: 11500, entire_home: 7900, private_room: 3600 },
  ],
};

const MOCK_BEDROOM_PERFORMANCE = {
  data: [
    { bedrooms: 1, adr: 120, occupancy: 0.72, revenue: 31500 },
    { bedrooms: 2, adr: 165, occupancy: 0.68, revenue: 41000 },
    { bedrooms: 3, adr: 210, occupancy: 0.65, revenue: 49800 },
    { bedrooms: 4, adr: 280, occupancy: 0.60, revenue: 61300 },
    { bedrooms: 5, adr: 350, occupancy: 0.55, revenue: 70200 },
    { bedrooms: 6, adr: 420, occupancy: 0.50, revenue: 76600 },
  ],
};

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
  listings: MOCK_LISTINGS_DATA.map((l) => ({
    ...l,
    airbnb_url: `https://www.airbnb.com/rooms/${l.id}`,
    image_url: null,
    zipcode: "75082",
  })),
  total_count: 10,
  page: 1,
  page_size: 25,
};

const MOCK_RENTOMETER_RESPONSE = {
  mean: 2200,
  median: 2100,
  percentile_25: 1800,
  percentile_75: 2600,
  min: 1200,
  max: 3500,
  samples: 45,
  address: "1234 Mock St, Richardson, TX 75082",
};

const MOCK_GEMINI_RESPONSE = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              summary: "This is a mock AI-generated summary for development purposes. The property shows strong rental potential based on comparable market data.",
              highlights: [
                "Strong occupancy rates in the area",
                "Above-average daily rates for the bedroom count",
                "Growing market with increasing supply",
              ],
              risks: [
                "Seasonal fluctuations in demand",
                "Increasing competition from new listings",
              ],
              recommendation: "The property appears to be a solid investment opportunity based on current market conditions.",
            }),
          },
        ],
        role: "model",
      },
      finishReason: "STOP",
    },
  ],
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
  id: "airdna-3577",
  name: "Richardson",
  listing_count: 450,
  metrics: {
    occupancy: 0.65,
    adr: 210,
    revenue: 49800,
    revpar: 137,
    market_score: 68,
  },
  zipcodes: ["75080", "75081", "75082"],
  parent_market: {
    id: "airdna-403",
    name: "Dallas",
  },
};

const MOCK_SUBMARKETS_RESPONSE = {
  submarkets: [
    { id: "airdna-3577", name: "Richardson", listing_count: 450, metrics: { occupancy: 0.65, adr: 210, revenue: 49800, revpar: 137 } },
    { id: "airdna-3578", name: "Plano", listing_count: 620, metrics: { occupancy: 0.63, adr: 225, revenue: 51700, revpar: 142 } },
    { id: "airdna-3579", name: "Frisco", listing_count: 380, metrics: { occupancy: 0.67, adr: 240, revenue: 58700, revpar: 161 } },
    { id: "airdna-3580", name: "McKinney", listing_count: 290, metrics: { occupancy: 0.61, adr: 195, revenue: 43400, revpar: 119 } },
  ],
  total: 4,
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
  // AirDNA Market Supply
  {
    service: "AirDNA Market Supply",
    match: (url) => url.includes("airdna.co") && url.includes("/supply"),
    fixtureKey: (url) => "airdna-market-supply",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_MARKET_SUPPLY_RESPONSE,
    }),
  },
  // AirDNA Bedroom Performance
  {
    service: "AirDNA Bedroom Performance",
    match: (url) => url.includes("airdna.co") && (url.includes("/bedroom") || url.includes("/performance")),
    fixtureKey: (url) => "airdna-bedroom-performance",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_BEDROOM_PERFORMANCE,
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
  // Gemini AI
  {
    service: "Gemini AI",
    match: (url) => url.includes("generativelanguage.googleapis.com"),
    fixtureKey: (url) => "gemini",
    defaultResponse: () => ({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: MOCK_GEMINI_RESPONSE,
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

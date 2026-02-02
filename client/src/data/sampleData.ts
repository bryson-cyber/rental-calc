/**
 * Sample Data for Sandbox Training Mode
 * 
 * This data allows new users to practice with the tools
 * without needing to enter real property information.
 */

// Sample property for validation tool
export const SAMPLE_PROPERTY = {
  address: '1234 Training Lane, Nashville, TN 37203',
  city: 'Nashville',
  state: 'TN',
  zipCode: '37203',
  bedrooms: 2,
  bathrooms: 1,
  accommodates: 4,
  monthlyRent: 1800,
  lat: 36.1627,
  lng: -86.7816,
};

// Sample market for research tool
export const SAMPLE_MARKET = {
  city: 'Nashville',
  state: 'TN',
  displayName: 'Nashville, TN',
};

// Sample revenue estimate result
export const SAMPLE_REVENUE_RESULT = {
  property: {
    address: SAMPLE_PROPERTY.address,
    bedrooms: SAMPLE_PROPERTY.bedrooms,
    bathrooms: SAMPLE_PROPERTY.bathrooms,
    accommodates: SAMPLE_PROPERTY.accommodates,
  },
  estimates: {
    annual_revenue: 52000,
    annual_revenue_low: 45000,
    annual_revenue_high: 58000,
    average_daily_rate: 185,
    occupancy_rate: 0.72,
    currency_symbol: '$',
  },
  profitAnalysis: {
    monthlyRevenue: 4333,
    monthlyRent: SAMPLE_PROPERTY.monthlyRent,
    monthlyProfit: 2533,
    profitMargin: 58.5,
    annualProfit: 30400,
    breakEvenOccupancy: 0.42,
  },
  monthly_forecast: [
    { month: '2026-01', revenue: 3800, adr: 175, occupancy: 0.70 },
    { month: '2026-02', revenue: 4100, adr: 180, occupancy: 0.73 },
    { month: '2026-03', revenue: 4500, adr: 185, occupancy: 0.78 },
    { month: '2026-04', revenue: 4800, adr: 190, occupancy: 0.81 },
    { month: '2026-05', revenue: 5200, adr: 195, occupancy: 0.86 },
    { month: '2026-06', revenue: 5500, adr: 200, occupancy: 0.88 },
    { month: '2026-07', revenue: 5300, adr: 195, occupancy: 0.87 },
    { month: '2026-08', revenue: 4900, adr: 190, occupancy: 0.83 },
    { month: '2026-09', revenue: 4200, adr: 180, occupancy: 0.75 },
    { month: '2026-10', revenue: 4000, adr: 175, occupancy: 0.73 },
    { month: '2026-11', revenue: 3600, adr: 170, occupancy: 0.68 },
    { month: '2026-12', revenue: 4100, adr: 185, occupancy: 0.71 },
  ],
  comps: [
    {
      title: 'Cozy Downtown Loft',
      bedrooms: 2,
      bathrooms: 1,
      rating: 4.9,
      reviews: 127,
      annual_revenue: 48000,
      adr: 175,
      occupancy: 0.70,
      distance_meters: 450,
    },
    {
      title: 'Modern Music Row Apartment',
      bedrooms: 2,
      bathrooms: 1.5,
      rating: 4.8,
      reviews: 89,
      annual_revenue: 55000,
      adr: 195,
      occupancy: 0.72,
      distance_meters: 680,
    },
    {
      title: 'Charming Midtown Retreat',
      bedrooms: 2,
      bathrooms: 1,
      rating: 4.7,
      reviews: 156,
      annual_revenue: 51000,
      adr: 180,
      occupancy: 0.73,
      distance_meters: 890,
    },
  ],
};

// Sample market research result
export const SAMPLE_MARKET_RESEARCH = {
  market: SAMPLE_MARKET.displayName,
  summary: {
    totalListings: 4523,
    averageRevenue: 48500,
    medianRevenue: 42000,
    averageADR: 175,
    averageOccupancy: 0.68,
    topPerformerRevenue: 125000,
  },
  propertyTypes: [
    { type: '1 Bedroom', count: 1245, avgRevenue: 35000, avgADR: 145, avgOccupancy: 0.65 },
    { type: '2 Bedroom', count: 1890, avgRevenue: 48000, avgADR: 175, avgOccupancy: 0.70 },
    { type: '3 Bedroom', count: 987, avgRevenue: 62000, avgADR: 210, avgOccupancy: 0.72 },
    { type: '4+ Bedroom', count: 401, avgRevenue: 85000, avgADR: 285, avgOccupancy: 0.68 },
  ],
  seasonalTrends: [
    { month: 'Jan', occupancy: 0.58, adr: 155 },
    { month: 'Feb', occupancy: 0.62, adr: 160 },
    { month: 'Mar', occupancy: 0.72, adr: 175 },
    { month: 'Apr', occupancy: 0.78, adr: 185 },
    { month: 'May', occupancy: 0.82, adr: 195 },
    { month: 'Jun', occupancy: 0.85, adr: 200 },
    { month: 'Jul', occupancy: 0.83, adr: 195 },
    { month: 'Aug', occupancy: 0.75, adr: 180 },
    { month: 'Sep', occupancy: 0.68, adr: 170 },
    { month: 'Oct', occupancy: 0.72, adr: 175 },
    { month: 'Nov', occupancy: 0.65, adr: 165 },
    { month: 'Dec', occupancy: 0.70, adr: 180 },
  ],
};

// Sample listings for explore tool
export const SAMPLE_LISTINGS = [
  {
    id: 'sample-1',
    title: 'Stunning Downtown Nashville Loft',
    address: '456 Broadway Ave, Nashville, TN 37203',
    bedrooms: 2,
    bathrooms: 1,
    rating: 4.92,
    reviews: 234,
    annual_revenue: 58000,
    adr: 195,
    occupancy: 0.76,
    imageUrl: '/images/sample-listing-1.jpg',
    amenities: ['WiFi', 'Kitchen', 'Parking', 'AC'],
  },
  {
    id: 'sample-2',
    title: 'Cozy Midtown Retreat',
    address: '789 Music Row, Nashville, TN 37212',
    bedrooms: 1,
    bathrooms: 1,
    rating: 4.85,
    reviews: 156,
    annual_revenue: 42000,
    adr: 155,
    occupancy: 0.70,
    imageUrl: '/images/sample-listing-2.jpg',
    amenities: ['WiFi', 'Kitchen', 'Washer/Dryer'],
  },
  {
    id: 'sample-3',
    title: 'Spacious East Nashville Home',
    address: '321 Porter Rd, Nashville, TN 37206',
    bedrooms: 3,
    bathrooms: 2,
    rating: 4.95,
    reviews: 312,
    annual_revenue: 72000,
    adr: 245,
    occupancy: 0.75,
    imageUrl: '/images/sample-listing-3.jpg',
    amenities: ['WiFi', 'Kitchen', 'Parking', 'Pool', 'Hot Tub'],
  },
];

// Sample regulations data
export const SAMPLE_REGULATIONS = {
  city: 'Nashville',
  state: 'TN',
  status: 'Regulated',
  summary: 'Nashville allows short-term rentals with a permit. Owner-occupied properties have fewer restrictions than non-owner-occupied.',
  requirements: [
    'Must obtain a Short-Term Rental Property (STRP) permit',
    'Annual permit fee of $313',
    'Property must pass safety inspection',
    'Must collect and remit hotel occupancy tax (6%)',
    'Non-owner-occupied rentals restricted to certain zones',
  ],
  restrictions: [
    'Maximum occupancy: 2 per bedroom + 2 additional guests',
    'Quiet hours: 10 PM - 7 AM',
    'No events or parties without special permit',
    'Must display permit number in all listings',
  ],
  permitLink: 'https://www.nashville.gov/departments/codes/short-term-rental-permits',
  lastUpdated: '2025-12-15',
};

// Training mode context
export interface TrainingModeContext {
  isTrainingMode: boolean;
  currentTool: string | null;
  sampleDataLoaded: boolean;
}

export const DEFAULT_TRAINING_CONTEXT: TrainingModeContext = {
  isTrainingMode: false,
  currentTool: null,
  sampleDataLoaded: false,
};

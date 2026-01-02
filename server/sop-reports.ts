/**
 * SOP-Aligned Report Generation Module
 * 
 * This module generates professional investment reports following the exact
 * templates defined in Coach Inayah's Standard Operating Procedures.
 */

import {
  searchMarkets,
  getComprehensiveMarketReport,
  getTopPerformers,
  getRentalizerEstimate,
  searchByZipcode,
  getMarketBookingPatterns,
  getMarketSupplyTrend,
  getMarketProfessionalStats,
  getMarketCancellationPolicies,
  getEnhancedRentalizerEstimate,
  getMarketSeasonality,
  getMarketFutureDailyData,
  getMarketHistoricalData,
  getMarketDetails,
  getListingHistoricalMetrics,
  exploreSubmarketsWithMetrics,
  getListingComps,
  getListingFuturePricing,
  getRentalizerComps,
  getSinglePropertyDetails,
  getSubmarketListings,
  getQualifyingCompetitors,
  getListingsInRadius,
  getAllMarketListings,
  getFilteredMarketListings,
  AdvancedListingFilters,
  RadiusSearchResult,
  ListingData,
  ListingComp,
  ListingFuturePricing,
  RentalizerCompData,
  RentalizerResponse,
  ComprehensiveMarketReport,
  BookingPatterns,
  SupplyTrend,
  ProfessionalHostStats,
  CancellationPolicyStats,
  SeasonalityData,
  ListingHistoricalMetrics,
  FutureDailyData
} from './airdna';

import {
  runFullAIAnalysis,
  synthesizePropertyInsights,
  analyzeCompetitorPatterns,
  generateInvestmentVerdict,
  generatePricingStrategy,
  assessRisks,
  generateActionPlan,
  generateExecutiveSummary,
  analyzeCompetitorPhotos,
  analyzeListingPhoto,
  getLocalRegulations,
  generateWhatThisMeans,
  analyzeHistoricalMarketTrends,
  generateNarrativeReport,
  type FullAIAnalysis,
  type HistoricalMarketAnalysis,
  type AIInsight,
  type InvestmentVerdict,
  type PricingStrategy,
  type CompetitorPattern,
  type RiskAssessment,
  type ActionPlan,
  type PhotoAnalysis,
  type RegulationInfo,
  type NarrativeReport
} from './gemini-analyzer';

import {
  generateEnhancedNarrativeReport,
  type EnhancedNarrativeReport
} from './gemini-analyzer-enhanced';

import { scrapeAirbnbImages, batchScrapeAirbnbImages, batchCheckAirbnbListingsActive } from './airbnb-scraper';
import { progressTracker, withProgress } from './progress-tracker';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface PropertyInput {
  address: string;
  monthly_rent: number;
  bedrooms?: number;
  bathrooms?: number;
  square_footage?: number;
  property_type?: string;
  attractive_features?: string[];
  zillow_url?: string;
}

export interface MarketPercentiles {
  top_10_percent: number;  // 90th percentile
  top_25_percent: number;  // 75th percentile
  median: number;          // 50th percentile
  average: number;
}

export interface CompetitorAnalysis {
  name: string;
  airbnb_url: string;
  image_url?: string;
  annual_revenue: number;
  occupancy: number;
  adr: number;
  key_success_factor: string;
  amenities: string[];
  rating: number | null;
  reviews: number;
  bedrooms?: number;
  property_type?: string;
  last_review_date?: string;
  is_superhost?: boolean;
  is_professional?: boolean;
  distance_meters?: number;
}

export interface ProfitabilityScenario {
  name: string;
  projected_revenue: number;
  annual_operating_costs: number;
  estimated_profit: number;
  monthly_cash_flow: number;
}

export interface SOPProfitability {
  startup_costs: number;
  monthly_expenses: {
    rent: number;
    utilities: number;
    internet: number;
    supplies: number;
    maintenance: number;
    total: number;
  };
  annual_operating_costs: number;
  minimum_revenue_threshold: number;  // Monthly Rent × 12 × 2
  scenarios: {
    conservative: ProfitabilityScenario;
    realistic: ProfitabilityScenario;
    optimistic: ProfitabilityScenario;
  };
}

// SeasonalityData is imported from airdna.ts
// Using lowercase season_type values: 'peak' | 'shoulder' | 'off'

export interface BookingMetrics {
  average_length_of_stay: number; // nights
  booking_lead_time: number; // days in advance
  peak_booking_months: string[];
  slow_booking_months: string[];
}

export interface AmenityAnalysis {
  amenity: string;
  percentage_of_top_performers: number;
  revenue_impact: 'High' | 'Medium' | 'Low';
  recommendation: string;
}

// NEW: Booking patterns analysis
export interface BookingPatternsData {
  booking_lead_time: {
    avg_days: number;
    median_days: number;
    last_minute_percent: number;
    advance_booking_percent: number;
  };
  length_of_stay: {
    avg_nights: number;
    median_nights: number;
    weekend_percent: number;
    week_percent: number;
  };
  insights: string[];
  what_this_means: string;
}

// NEW: Supply trend analysis
export interface SupplyTrendData {
  current_listings: number;
  listings_12_months_ago: number;
  net_change: number;
  percent_change: number;
  trend: 'growing' | 'stable' | 'declining';
  insight: string;
  what_this_means: string;
}

// NEW: Professional host statistics
export interface ProfessionalHostData {
  total_listings: number;
  professional_count: number;
  individual_count: number;
  professional_percentage: number;
  superhost_count: number;
  superhost_percentage: number;
  avg_revenue_professional: number;
  avg_revenue_individual: number;
  revenue_premium_percent: number;
  what_this_means: string;
}

// NEW: Cancellation policy analysis
export interface CancellationPolicyData {
  total_listings: number;
  policies: Array<{
    policy: string;
    count: number;
    percentage: number;
    avg_revenue: number;
    avg_occupancy: number;
  }>;
  recommendation: string;
  what_this_means: string;
}

// NEW: Property value and ROI analysis
export interface PropertyROIData {
  property_value?: number;
  historical_valuation?: {
    mom_perc_chg: number;
    yoy_perc_chg: number;
  };
  startup_costs: {
    furniture_low: number;
    furniture_high: number;
    supplies: number;
    photos_and_listing: number;
    first_month_buffer: number;
    total_low: number;
    total_high: number;
  };
  break_even: {
    months_conservative: number;
    months_realistic: number;
    months_optimistic: number;
  };
  annual_roi: {
    conservative: number;
    realistic: number;
    optimistic: number;
  };
  what_this_means: string;
}

// NEW: Local regulations
export interface RegulationsData {
  city: string;
  state: string;
  str_allowed: 'yes' | 'no' | 'restricted' | 'unknown';
  permit_required: boolean;
  permit_cost_estimate: string;
  key_restrictions: string[];
  enforcement_level: 'strict' | 'moderate' | 'minimal' | 'unknown';
  recommendation: string;
  disclaimer: string;
}

export interface ArbitrageReport {
  title: string;
  prepared_for: string;
  prepared_by: string;
  date: string;
  sections: {
    executive_summary: string;
    property_analysis: string;
    market_analysis: string;
    seasonality_analysis: string;
    competitor_analysis: string;
    amenity_analysis: string;
    profitability_projections: string;
    references: string;
  };
  full_report: string;
  seasonality?: SeasonalityData[];
  booking_metrics?: BookingMetrics;
  amenity_analysis?: AmenityAnalysis[];
  // AI-Powered Analysis
  ai_analysis?: FullAIAnalysis;
  // Photo Analysis
  photo_analysis?: {
    competitor_photos: Array<{
      name: string;
      imageUrl: string;
      analysis: PhotoAnalysis;
    }>;
    design_insights: {
      common_themes: string[];
      design_recommendations: string[];
      must_have_shots: string[];
      differentiation_opportunities: string[];
    };
  };
  // NEW: Additional Report Sections
  booking_patterns?: BookingPatternsData;
  supply_trend?: SupplyTrendData;
  professional_host_stats?: ProfessionalHostData;
  cancellation_policies?: CancellationPolicyData;
  property_roi?: PropertyROIData;
  regulations?: RegulationsData;
  // COMPREHENSIVE DATA: Market-level seasonality from API
  market_seasonality?: SeasonalityData[];
  // COMPREHENSIVE DATA: Future pricing forecasts
  future_pricing?: FutureDailyData[];
  // COMPREHENSIVE DATA: Historical performance trends
  historical_trends?: {
    occupancy: Array<{ date: string; value: number }>;
    adr: Array<{ date: string; value: number }>;
    revenue: Array<{ date: string; value: number }>;
  };
  // 5-YEAR HISTORICAL SUMMARY
  five_year_summary?: {
    years_of_data: number;
    occupancy: {
      current_year_avg: number;
      five_year_avg: number;
      trend: 'increasing' | 'stable' | 'decreasing';
      percent_change: number;
      yearly_data: Array<{ year: number; avg: number }>;
    };
    adr: {
      current_year_avg: number;
      five_year_avg: number;
      trend: 'increasing' | 'stable' | 'decreasing';
      percent_change: number;
      yearly_data: Array<{ year: number; avg: number }>;
    };
    revenue: {
      current_year_avg: number;
      five_year_avg: number;
      trend: 'increasing' | 'stable' | 'decreasing';
      percent_change: number;
      yearly_data: Array<{ year: number; avg: number }>;
    };
    market_maturity: 'emerging' | 'growing' | 'mature' | 'saturated';
    insight: string;
  };
  // GEMINI HISTORICAL ANALYSIS
  historical_analysis?: HistoricalMarketAnalysis;
  // COMPREHENSIVE NARRATIVE REPORT
  narrative_report?: NarrativeReport;
  // ENHANCED NARRATIVE REPORT (with action items and plain-language explanations)
  enhanced_narrative_report?: EnhancedNarrativeReport;
  // TOP PERFORMER COMPS: AirDNA's native comp algorithm for top performer
  top_performer_comps?: ListingComp[];
  // TOP PERFORMER PRICING: Future pricing strategy from top performer
  top_performer_pricing?: ListingFuturePricing;
  // RENTALIZER COMPS: Enhanced competitor data with superhost/professional flags
  rentalizer_comps?: RentalizerCompData;
  // EXISTING LISTING DATA: If property was previously listed on Airbnb
  existing_listing_data?: {
    property_id: string;
    title: string;
    annual_revenue: number;
    adr: number;
    occupancy: number;
    rating: number | null;
    reviews: number;
  };
  // SUBMARKET LISTINGS: Hyper-local competition within the submarket
  submarket_listings?: {
    submarket_id: string;
    submarket_name: string;
    total_listings: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    top_listings: ListingData[];
  };
}

// ============================================
// SOP CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate profitability using SOP formulas
 * - Monthly expenses: Rent + $250 (utilities) + $80 (internet) + $250 (supplies) + $200 (maintenance)
 * - Startup costs removed - varies by property and investor situation
 */
export function calculateSOPProfitability(
  monthly_rent: number,
  percentiles: MarketPercentiles
): SOPProfitability {
  // Startup costs removed - too variable to estimate accurately
  const startup_costs = 0; // Not included in calculations
  
  const monthly_expenses = {
    rent: monthly_rent,
    utilities: 250,
    internet: 80,
    supplies: 250,
    maintenance: 200,
    total: monthly_rent + 250 + 80 + 250 + 200
  };
  
  const annual_operating_costs = monthly_expenses.total * 12;
  const minimum_revenue_threshold = monthly_rent * 12 * 2; // 2x annual rent for 30%+ profit
  
  const scenarios = {
    conservative: {
      name: 'Conservative (Average)',
      projected_revenue: percentiles.median,
      annual_operating_costs,
      estimated_profit: percentiles.median - annual_operating_costs,
      monthly_cash_flow: (percentiles.median - annual_operating_costs) / 12
    },
    realistic: {
      name: 'Realistic (Our Target)',
      projected_revenue: percentiles.top_25_percent,
      annual_operating_costs,
      estimated_profit: percentiles.top_25_percent - annual_operating_costs,
      monthly_cash_flow: (percentiles.top_25_percent - annual_operating_costs) / 12
    },
    optimistic: {
      name: 'Optimistic (Superstar)',
      projected_revenue: percentiles.top_10_percent,
      annual_operating_costs,
      estimated_profit: percentiles.top_10_percent - annual_operating_costs,
      monthly_cash_flow: (percentiles.top_10_percent - annual_operating_costs) / 12
    }
  };
  
  return {
    startup_costs,
    monthly_expenses,
    annual_operating_costs,
    minimum_revenue_threshold,
    scenarios
  };
}

/**
 * Calculate market percentiles from listing data
 */
export function calculateMarketPercentiles(listings: ListingData[]): MarketPercentiles {
  if (listings.length === 0) {
    return { top_10_percent: 0, top_25_percent: 0, median: 0, average: 0 };
  }
  
  // Sort by revenue descending
  const sorted = [...listings].sort((a, b) => b.annual_revenue - a.annual_revenue);
  const revenues = sorted.map(l => l.annual_revenue);
  
  const getPercentile = (arr: number[], percentile: number): number => {
    const index = Math.ceil((percentile / 100) * arr.length) - 1;
    return arr[Math.max(0, index)] || 0;
  };
  
  const average = revenues.reduce((a, b) => a + b, 0) / revenues.length;
  
  return {
    top_10_percent: getPercentile(revenues, 10),  // Top 10% = 90th percentile
    top_25_percent: getPercentile(revenues, 25),  // Top 25% = 75th percentile
    median: getPercentile(revenues, 50),          // Median = 50th percentile
    average: Math.round(average)
  };
}

/**
 * Calculate 5-year historical summary from monthly data
 */
function calculate5YearSummary(historical_trends: {
  occupancy: Array<{ date: string; value: number }>;
  adr: Array<{ date: string; value: number }>;
  revenue: Array<{ date: string; value: number }>;
}): ArbitrageReport['five_year_summary'] {
  // Group data by year
  const groupByYear = (data: Array<{ date: string; value: number }>) => {
    const yearMap = new Map<number, number[]>();
    
    data.forEach(item => {
      const year = new Date(item.date).getFullYear();
      if (!yearMap.has(year)) {
        yearMap.set(year, []);
      }
      yearMap.get(year)!.push(item.value);
    });
    
    // Calculate yearly averages
    const yearlyData: Array<{ year: number; avg: number }> = [];
    yearMap.forEach((values, year) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      yearlyData.push({ year, avg: Math.round(avg * 100) / 100 });
    });
    
    return yearlyData.sort((a, b) => a.year - b.year);
  };
  
  const occupancyByYear = groupByYear(historical_trends.occupancy);
  const adrByYear = groupByYear(historical_trends.adr);
  const revenueByYear = groupByYear(historical_trends.revenue);
  
  const yearsOfData = Math.max(occupancyByYear.length, adrByYear.length, revenueByYear.length);
  
  // Calculate trends
  const calculateTrend = (yearlyData: Array<{ year: number; avg: number }>) => {
    if (yearlyData.length < 2) {
      return { trend: 'stable' as const, percent_change: 0, current_year_avg: yearlyData[0]?.avg || 0, five_year_avg: yearlyData[0]?.avg || 0 };
    }
    
    const currentYear = yearlyData[yearlyData.length - 1];
    const firstYear = yearlyData[0];
    const fiveYearAvg = yearlyData.reduce((sum, y) => sum + y.avg, 0) / yearlyData.length;
    
    const percentChange = firstYear.avg > 0 
      ? ((currentYear.avg - firstYear.avg) / firstYear.avg) * 100 
      : 0;
    
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (percentChange > 5) trend = 'increasing';
    else if (percentChange < -5) trend = 'decreasing';
    
    return {
      trend,
      percent_change: Math.round(percentChange * 10) / 10,
      current_year_avg: currentYear.avg,
      five_year_avg: Math.round(fiveYearAvg * 100) / 100
    };
  };
  
  const occupancyTrend = calculateTrend(occupancyByYear);
  const adrTrend = calculateTrend(adrByYear);
  const revenueTrend = calculateTrend(revenueByYear);
  
  // Determine market maturity based on trends
  let market_maturity: 'emerging' | 'growing' | 'mature' | 'saturated' = 'mature';
  
  if (revenueTrend.percent_change > 15 && occupancyTrend.percent_change > 5) {
    market_maturity = 'emerging';
  } else if (revenueTrend.percent_change > 5 && occupancyTrend.percent_change > 0) {
    market_maturity = 'growing';
  } else if (revenueTrend.percent_change < -5 || occupancyTrend.percent_change < -10) {
    market_maturity = 'saturated';
  }
  
  // Generate insight
  let insight = `Based on ${yearsOfData} years of historical data: `;
  
  if (revenueTrend.trend === 'increasing') {
    insight += `Revenue has grown ${Math.abs(revenueTrend.percent_change)}% over this period. `;
  } else if (revenueTrend.trend === 'decreasing') {
    insight += `Revenue has declined ${Math.abs(revenueTrend.percent_change)}% over this period. `;
  } else {
    insight += `Revenue has remained relatively stable. `;
  }
  
  if (occupancyTrend.trend === 'increasing') {
    insight += `Occupancy rates are trending upward (${Math.abs(occupancyTrend.percent_change)}% increase), indicating growing demand.`;
  } else if (occupancyTrend.trend === 'decreasing') {
    insight += `Occupancy rates have declined ${Math.abs(occupancyTrend.percent_change)}%, which may indicate increased competition or market saturation.`;
  } else {
    insight += `Occupancy rates have been consistent, suggesting a stable market.`;
  }
  
  return {
    years_of_data: yearsOfData,
    occupancy: {
      current_year_avg: occupancyTrend.current_year_avg,
      five_year_avg: occupancyTrend.five_year_avg,
      trend: occupancyTrend.trend,
      percent_change: occupancyTrend.percent_change,
      yearly_data: occupancyByYear
    },
    adr: {
      current_year_avg: adrTrend.current_year_avg,
      five_year_avg: adrTrend.five_year_avg,
      trend: adrTrend.trend,
      percent_change: adrTrend.percent_change,
      yearly_data: adrByYear
    },
    revenue: {
      current_year_avg: revenueTrend.current_year_avg,
      five_year_avg: revenueTrend.five_year_avg,
      trend: revenueTrend.trend,
      percent_change: revenueTrend.percent_change,
      yearly_data: revenueByYear
    },
    market_maturity,
    insight
  };
}

/**
 * Filter competitors above minimum revenue threshold and remove inactive properties
 */
export function filterCompetitorsAboveThreshold(
  listings: ListingData[],
  monthly_rent: number
): ListingData[] {
  const threshold = monthly_rent * 12 * 2;
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  return listings.filter(l => {
    // Must meet revenue threshold
    if (l.annual_revenue < threshold) return false;
    
    // Filter out inactive properties (no recent activity)
    // Check last_review_date - if older than 1 year, likely inactive
    if (l.last_review_date) {
      const lastReview = new Date(l.last_review_date);
      if (lastReview < oneYearAgo) {
        console.log(`[FilterCompetitors] Excluding ${l.title} - last review ${l.last_review_date} is too old`);
        return false;
      }
    }
    
    // Check days_available - if 0 or very low, likely inactive
    if (l.days_available !== undefined && l.days_available < 30) {
      console.log(`[FilterCompetitors] Excluding ${l.title} - only ${l.days_available} days available`);
      return false;
    }
    
    // Check occupancy - if 0 or very low, likely inactive
    if (l.occupancy !== undefined && l.occupancy < 0.05) {
      console.log(`[FilterCompetitors] Excluding ${l.title} - occupancy ${l.occupancy} too low`);
      return false;
    }
    
    return true;
  });
}

/**
 * Analyze competitor success factors using AI-like heuristics
 */
export function analyzeCompetitorSuccessFactors(listing: ListingData): CompetitorAnalysis {
  const amenities = listing.amenities || [];
  
  // Determine key success factor based on amenities and metrics
  let key_success_factor = 'Professional Management';
  
  if (amenities.includes('hot_tub') || amenities.includes('Hot tub')) {
    key_success_factor = 'A Private Hot Tub';
  } else if (amenities.includes('pool') || amenities.includes('Pool')) {
    key_success_factor = 'A Private Pool';
  } else if (listing.rating && listing.rating >= 4.9 && listing.reviews > 100) {
    key_success_factor = 'Exceptional Reviews & 5-Star Rating';
  } else if (listing.superhost) {
    key_success_factor = 'Superhost Status & Trust';
  } else if (amenities.includes('game_room') || amenities.includes('Game room')) {
    key_success_factor = 'Entertainment Amenities (Game Room)';
  } else if (listing.occupancy > 80) {
    key_success_factor = 'High Demand Location';
  } else if (listing.adr > 300) {
    key_success_factor = 'Premium Pricing & Luxury Experience';
  } else if (listing.professionally_managed) {
    key_success_factor = 'Professional Management & Consistency';
  }
  
  return {
    name: listing.title,
    airbnb_url: listing.airbnb_url || `https://www.airbnb.com/rooms/${listing.id}`,
    image_url: listing.image_url,
    annual_revenue: listing.annual_revenue,
    occupancy: listing.occupancy,
    adr: listing.adr,
    key_success_factor,
    amenities,
    rating: listing.rating,
    reviews: listing.reviews,
    bedrooms: listing.bedrooms,
    property_type: listing.property_type,
    last_review_date: (listing as any).last_review_date,
    is_superhost: listing.superhost || false,
    is_professional: listing.professionally_managed || false,
    distance_meters: (listing as any).distance_meters
  };
}

// ============================================
// REPORT GENERATION FUNCTIONS
// ============================================

/**
 * Generate Simplified Arbitrage Report (5 sections)
 * For clients NEW to the arbitrage business model
 */
export async function generateSimplifiedReport(
  property: PropertyInput,
  marketData: ComprehensiveMarketReport,
  competitors: CompetitorAnalysis[],
  percentiles: MarketPercentiles,
  profitability: SOPProfitability
): Promise<string> {
  const date = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const attractiveFeatures = property.attractive_features || [
    'Modern updates and finishes',
    'Spacious layout',
    'Convenient location',
    'In-unit laundry'
  ];
  
  // Build the report following exact SOP template
  let report = `# Understanding the Airbnb Arbitrage Opportunity

**Prepared for:** Investment Client
**Prepared by:** Coach Inayah AI Property Analysis Unit
**Date:** ${date}

---

### What is This Report?

This report is a sample analysis to show you how we evaluate a property for an **Airbnb Arbitrage** business. The idea is simple: we rent a regular, long-term property, and then we furnish it and re-rent it for short stays on Airbnb. The goal is to make more money from the short-term Airbnb guests than we pay in rent and other expenses.

This process helps us decide if a property is a good investment *before* signing a lease. Let's break down the process using a real example.

---

## 1. First, We Look at the Property Itself

Our analysis starts with the property we might rent. We need to understand its basic details and what makes it special for potential Airbnb guests.

**Subject Property:** [${property.address}](${property.zillow_url || '#'})

| Property Detail | Information |
| :--- | :--- |
| **Full Address** | ${property.address} |
| **Property Type** | ${property.property_type || 'Single Family Residence'} |
| **Bedrooms / Bathrooms** | ${property.bedrooms || 'N/A'} Bedrooms / ${property.bathrooms || 'N/A'} Bathrooms |
| **Size** | ${property.square_footage || 'N/A'} sqft |
| **Monthly Rent** | $${property.monthly_rent.toLocaleString()} |

### What Makes This Property Attractive for Airbnb?

We look for features that will stand out to guests. This property has several good ones:

${attractiveFeatures.map((f, i) => `- **Attractive Feature ${i + 1}:** ${f}`).join('\n')}

**The Thought Process:** We are looking for features that make a property more like a home and less like a generic hotel room. These unique comforts are what allow us to charge a premium on Airbnb.

---

## 2. Next, We Analyze the Local Market

Now that we know about the property, we need to understand the local Airbnb market. How much money are similar properties actually making? For this, we use special data tools that track Airbnb performance. We focus on other ${property.bedrooms || 'similar'}-bedroom properties in the same **${marketData.market.name}** area to get a clear picture.

### What Do Similar Airbnbs Earn?

Here are the average numbers for ${property.bedrooms || 'similar'}-bedroom properties in this area:

| Metric | Average Value | What This Means |
| :--- | :--- | :--- |
| **Annual Revenue** | $${percentiles.average.toLocaleString()} | This is the total money the average ${property.bedrooms || 'similar'}-bedroom Airbnb in this area makes in a year. |
| **Occupancy Rate** | ${marketData.market.metrics.occupancy < 1 ? Math.round(marketData.market.metrics.occupancy * 100) : Math.round(marketData.market.metrics.occupancy)}% | This means that, on average, properties are booked and paid for about ${Math.round((marketData.market.metrics.occupancy < 1 ? marketData.market.metrics.occupancy * 100 : marketData.market.metrics.occupancy) * 3.65)} nights in a year. |
| **Average Daily Rate (ADR)** | $${marketData.market.metrics.adr} | This is the average price guests pay per night. |

### How Much is Possible? (Good, Better, Best)

Not all Airbnbs perform the same. Some are average, while others are run by expert hosts who make much more. We look at these different levels to understand the full potential.

**Revenue Potential (How much money can be made in a year?)**

| Performance Level | Annual Revenue | Who Achieves This? |
| :--- | :--- | :--- |
| **Top 10% (Best)** | $${percentiles.top_10_percent.toLocaleString()} | These are the superstar hosts with amazing photos, perfect reviews, and top-notch design. |
| **Top 25% (Better)** | $${percentiles.top_25_percent.toLocaleString()} | These are professionally run properties with great design and solid marketing. **This is our target.** |
| **Median (Good)** | $${percentiles.median.toLocaleString()} | This is the average, standard Airbnb in the area. |

**The Thought Process:** We don't aim to be average. Our goal is to make our property perform in the **Top 25%** by using professional design, great photos, and smart pricing. This data shows us what is realistically achievable if we do our job well.

---

## 3. Then, We Study the Competition

To get into the Top 25%, we need to understand what the best are doing right. We study the top-earning Airbnbs in the area to learn their secrets. These are properties earning at least **$${profitability.minimum_revenue_threshold.toLocaleString()}** a year (which is 2x our annual rent—the minimum needed to hit our profit goals).

### What Do the Top Competitors Have in Common?

Here's a quick look at what makes the best properties stand out. We look at their design, their special features, and how they market themselves.

| # | Property | Revenue | Occ% | ADR | Rating | Reviews | Success Factor |
| :--- | :--- | ---: | ---: | ---: | :---: | ---: | :--- |
${competitors.map((c, idx) => {
  const cleanName = c.name.replace(/[\|\[\]]/g, '').substring(0, 40);
  const displayName = cleanName.length > 35 ? cleanName.substring(0, 35) + '...' : cleanName;
  const occPercent = c.occupancy < 1 ? Math.round(c.occupancy * 100) : Math.round(c.occupancy);
  const ratingDisplay = c.rating ? c.rating.toFixed(1) + '⭐' : 'N/A';
  return `| ${idx + 1} | [${displayName}](${c.airbnb_url}) | $${c.annual_revenue.toLocaleString()} | ${occPercent}% | $${Math.round(c.adr)} | ${ratingDisplay} | ${c.reviews} | ${c.key_success_factor} |`;
}).join('\n')}

**The Thought Process:** We are not just providing a place to sleep; we are selling an **experience**. The most successful Airbnbs have a unique personality or a special feature that makes them memorable. Our job is to create that for our property.

---

## 4. Finally, We Project the Profit

This is where we put it all together to see if the business model makes sense financially. We estimate the costs and subtract them from the potential revenue.

### What Are the Monthly Expenses?

Every month, we have to pay for the costs of running the business.

| Expense Item | Estimated Monthly Cost | Notes |
| :--- | :--- | :--- |
| Monthly Rent | $${profitability.monthly_expenses.rent.toLocaleString()} | This is our biggest and most consistent expense. |
| Utilities (Gas, Electric, Water) | $${profitability.monthly_expenses.utilities} | We have to pay for the utilities our guests use. |
| High-Speed Internet | $${profitability.monthly_expenses.internet} | Fast, reliable Wi-Fi is a must-have for guests. |
| Supplies & Subscriptions | $${profitability.monthly_expenses.supplies} | This covers restocking things like coffee, soap, and paper towels, plus software for managing bookings and pricing. |
| Maintenance & Repairs | $${profitability.monthly_expenses.maintenance} | A small budget for fixing anything that breaks. |
| **Total Estimated Monthly Expenses** | **$${profitability.monthly_expenses.total.toLocaleString()}** | This is our estimated total cost per month to operate. |

### What is the Potential Profit?

Here we compare our revenue goals with our annual costs to see the potential profit.

| Scenario | Projected Annual Revenue | Annual Operating Costs | **Estimated Annual Profit** |
| :--- | :--- | :--- | :--- |
| **Conservative (Average)** | $${profitability.scenarios.conservative.projected_revenue.toLocaleString()} | $${profitability.annual_operating_costs.toLocaleString()} | **$${profitability.scenarios.conservative.estimated_profit.toLocaleString()}** |
| **Realistic (Our Target)** | $${profitability.scenarios.realistic.projected_revenue.toLocaleString()} | $${profitability.annual_operating_costs.toLocaleString()} | **$${profitability.scenarios.realistic.estimated_profit.toLocaleString()}** |
| **Optimistic (Superstar)** | $${profitability.scenarios.optimistic.projected_revenue.toLocaleString()} | $${profitability.annual_operating_costs.toLocaleString()} | **$${profitability.scenarios.optimistic.estimated_profit.toLocaleString()}** |

**The Thought Process:** The goal is to earn enough revenue to comfortably cover all our expenses and generate a healthy profit. These numbers show that if we operate the property professionally and hit our **Realistic** target, there is a strong potential for profit. This entire process, from property selection to competitive analysis, is designed to give us the confidence to invest.

---

## 5. References

[1]: ${property.zillow_url || property.address} "Zillow Listing"
[2]: https://coachinayah.com/market-charts "Coach Inayah Market Charts"
`;

  return report;
}

/**
 * Generate full arbitrage analysis with all data
 * @param sessionId - Optional session ID for progress tracking
 */
export async function generateFullArbitrageAnalysis(
  address: string,
  monthly_rent: number,
  bedrooms?: number,
  bathrooms?: number,
  zillow_url?: string,
  attractive_features?: string[],
  sessionId?: string
): Promise<{
  report: string;
  percentiles: MarketPercentiles;
  profitability: SOPProfitability;
  competitors: CompetitorAnalysis[];
  property_estimate: RentalizerResponse | null;
  seasonality: SeasonalityData[];
  booking_metrics: BookingMetrics;
  amenity_analysis: AmenityAnalysis[];
  ai_analysis: FullAIAnalysis | null;
  photo_analysis: {
    competitor_photos: Array<{ name: string; imageUrl: string; analysis: PhotoAnalysis }>;
    design_insights: {
      common_themes: string[];
      design_recommendations: string[];
      must_have_shots: string[];
      differentiation_opportunities: string[];
    };
  } | null;
  // NEW: Additional market intelligence
  booking_patterns?: BookingPatternsData;
  supply_trend?: SupplyTrendData;
  professional_host_stats?: ProfessionalHostData;
  cancellation_policies?: CancellationPolicyData;
  property_roi?: PropertyROIData;
  regulations?: RegulationsData;
  // COMPREHENSIVE DATA
  market_seasonality?: SeasonalityData[];
  future_pricing?: FutureDailyData[];
  historical_trends?: {
    occupancy: Array<{ date: string; value: number }>;
    adr: Array<{ date: string; value: number }>;
    revenue: Array<{ date: string; value: number }>;
  };
  // 5-YEAR HISTORICAL SUMMARY
  five_year_summary?: ArbitrageReport['five_year_summary'];
  // GEMINI HISTORICAL ANALYSIS
  historical_analysis?: HistoricalMarketAnalysis;
  // COMPREHENSIVE NARRATIVE REPORT
  narrative_report?: NarrativeReport;
  // ENHANCED NARRATIVE REPORT
  enhanced_narrative_report?: EnhancedNarrativeReport;
  // TOP PERFORMER COMPS
  top_performer_comps?: ListingComp[];
  // TOP PERFORMER PRICING
  top_performer_pricing?: ListingFuturePricing;
  // RENTALIZER COMPS
  rentalizer_comps?: RentalizerCompData;
  // EXISTING LISTING DATA
  existing_listing_data?: {
    property_id: string;
    title: string;
    annual_revenue: number;
    adr: number;
    occupancy: number;
    rating: number | null;
    reviews: number;
  };
  // SUBMARKET LISTINGS
  submarket_listings?: {
    submarket_id: string;
    submarket_name: string;
    total_listings: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    top_listings: ListingData[];
  };
  // QUALIFYING COMPETITORS (filtered by revenue threshold)
  qualifying_competitors?: {
    qualifying_count: number;
    total_same_bedroom: number;
    qualification_rate: number;
    revenue_threshold: number;
    avg_qualifying_revenue: number;
    avg_qualifying_occupancy: number;
    avg_qualifying_adr: number;
    superhost_percentage: number;
    professional_percentage: number;
    top_qualifiers: ListingData[];
  };
  // RADIUS LISTINGS (hyper-local competition within 1km)
  radius_listings?: {
    total_count: number;
    radius_meters: number;
    listings_per_sqkm: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    superhost_percentage: number;
    professional_percentage: number;
    same_bedroom_count: number;
    top_nearby: ListingData[];
  };
  // MARKET SATURATION (complete market analysis)
  market_saturation?: {
    total_listings: number;
    same_bedroom_count: number;
    bedroom_distribution: Array<{ bedrooms: number; count: number; percentage: number }>;
    revenue_percentiles: { p25: number; p50: number; p75: number; p90: number };
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    superhost_percentage: number;
    professional_percentage: number;
    market_concentration: 'fragmented' | 'moderate' | 'concentrated';
  };
  // PROPERTY TYPE ANALYSIS (entire home vs private room performance)
  property_type_analysis?: {
    entire_home: {
      count: number;
      avg_revenue: number;
      avg_adr: number;
      avg_occupancy: number;
      superhost_percentage: number;
    };
    private_room: {
      count: number;
      avg_revenue: number;
      avg_adr: number;
      avg_occupancy: number;
      superhost_percentage: number;
    };
    revenue_premium: number; // % premium entire home earns over private room
    recommended_type: 'entire_home' | 'private_room';
    recommendation_reason: string;
  };
}> {
  // Initialize progress tracking if sessionId provided
  if (sessionId) {
    progressTracker.createSession(sessionId);
    progressTracker.startStep(sessionId, 'property', `Analyzing ${address}`);
  }
  
  // Step 1: Get property estimate from Rentalizer
  let property_estimate: RentalizerResponse | null = null;
  try {
    property_estimate = await getRentalizerEstimate({
      address,
      bedrooms,
      bathrooms
    });
    if (sessionId) progressTracker.completeStep(sessionId, 'property', 'Property details retrieved');
  } catch (error) {
    console.error('Error getting Rentalizer estimate:', error);
    if (sessionId) progressTracker.errorStep(sessionId, 'property', 'Could not retrieve property estimate');
  }
  
  // Use property estimate data or defaults
  const actualBedrooms = property_estimate?.property.bedrooms || bedrooms || 3;
  const actualBathrooms = property_estimate?.property.bathrooms || bathrooms || 2;
  const zipcode = property_estimate?.property.zipcode;
  
  // Step 2: Get market data and ALL available listings
  if (sessionId) progressTracker.startStep(sessionId, 'market', 'Fetching market data...');
  let marketData: ComprehensiveMarketReport | null = null;
  let listings: ListingData[] = [];
  
  // First, always get comps from Rentalizer (these are the closest to the property)
  if (property_estimate?.comps && property_estimate.comps.length > 0) {
    listings = property_estimate.comps.map(c => ({
      id: c.airbnb_listing_id || '',
      title: c.title,
      airbnb_url: c.airbnb_url,
      image_url: c.image_url,
      bedrooms: c.bedrooms,
      bathrooms: c.bathrooms,
      accommodates: 0,
      property_type: c.property_type || 'house',
      rating: c.rating,
      reviews: c.reviews,
      annual_revenue: c.annual_revenue,
      adr: c.adr,
      occupancy: c.occupancy,
      amenities: c.amenities,
      distance_meters: c.distance_meters
    }));
    console.log(`[ArbitrageAnalysis] Got ${listings.length} comps from Rentalizer`);
  }
  
  // Then try to get more listings from ZIP code search
  if (zipcode) {
    try {
      const zipData = await searchByZipcode(zipcode, { bedrooms: actualBedrooms });
      if (zipData) {
        // Add listings from top_performers that aren't already in our list
        if (zipData.top_performers) {
          const existingTitles = new Set(listings.map(l => l.title));
          const existingUrls = new Set(listings.map(l => l.airbnb_url).filter(Boolean));
          
          const newListings = zipData.top_performers
            .filter(p => !existingTitles.has(p.title) && !existingUrls.has(p.airbnb_url))
            .map(p => ({
              id: '',
              title: p.title,
              airbnb_url: p.airbnb_url,
              image_url: (p as any).image_url,
              bedrooms: p.bedrooms,
              bathrooms: p.bathrooms,
              accommodates: 0,
              property_type: (p as any).property_type || 'house',
              rating: p.rating,
              reviews: p.reviews,
              annual_revenue: p.annual_revenue,
              adr: p.adr,
              occupancy: p.occupancy
            }));
          
          listings = [...listings, ...newListings];
          console.log(`[ArbitrageAnalysis] Added ${newListings.length} more from ZIP search, total: ${listings.length}`);
        }
        
        // Try to get comprehensive market report
        // First try direct market, then try submarket's parent market
        const zipMarketId = zipData.market?.id || zipData.submarket?.parent_market?.id;
        if (zipMarketId) {
          console.log(`[ArbitrageAnalysis] Found market ID from ZIP search: ${zipMarketId}`);
          marketData = await getComprehensiveMarketReport(zipMarketId);
        }
      }
    } catch (error) {
      console.error('Error getting ZIP data:', error);
    }
  }
  
  // Filter to same bedroom count for apples-to-apples comparison
  const sameBedroomListings = listings.filter(l => l.bedrooms === actualBedrooms);
  console.log(`[ArbitrageAnalysis] Same bedroom (${actualBedrooms}BR) listings: ${sameBedroomListings.length}`);
  
  // Use same-bedroom listings if we have enough, otherwise use all
  if (sameBedroomListings.length >= 5) {
    listings = sameBedroomListings;
  }
  
  // Step 3: Calculate percentiles
  if (sessionId) progressTracker.completeStep(sessionId, 'market', `Found ${listings.length} listings`);
  if (sessionId) progressTracker.startStep(sessionId, 'competitors', 'Analyzing competitors...');
  const percentiles = calculateMarketPercentiles(listings);
  
  // Step 4: Filter competitors above threshold and analyze - show ALL viable competitors
  const viableCompetitors = filterCompetitorsAboveThreshold(listings, monthly_rent);
  // Remove duplicates by title and show ALL viable competitors (not limited)
  const uniqueCompetitors = viableCompetitors.filter((comp, index, self) => 
    index === self.findIndex(c => c.title === comp.title || c.airbnb_url === comp.airbnb_url)
  );
  
  // Step 4b: Filter out inactive listings by checking if they actually load on Airbnb
  let activeCompetitors = uniqueCompetitors;
  const airbnbUrls = uniqueCompetitors
    .map(c => c.airbnb_url)
    .filter((url): url is string => !!url);
  
  if (airbnbUrls.length > 0) {
    try {
      console.log(`[ArbitrageAnalysis] Checking ${airbnbUrls.length} Airbnb listings for availability...`);
      const activeUrls = await batchCheckAirbnbListingsActive(airbnbUrls);
      
      // Filter to only include listings that are actually active on Airbnb
      activeCompetitors = uniqueCompetitors.filter(c => {
        if (!c.airbnb_url) return true; // Keep listings without URLs (can't verify)
        return activeUrls.has(c.airbnb_url);
      });
      
      console.log(`[ArbitrageAnalysis] ${activeCompetitors.length}/${uniqueCompetitors.length} listings are active on Airbnb`);
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error checking Airbnb listing availability:', error);
      // If check fails, keep all competitors
    }
  }
  
  const competitors = activeCompetitors.map(analyzeCompetitorSuccessFactors);
  
  // Step 5: Calculate profitability
  const profitability = calculateSOPProfitability(monthly_rent, percentiles);
  
  // Step 6: Generate report
  const property: PropertyInput = {
    address,
    monthly_rent,
    bedrooms: actualBedrooms,
    bathrooms: actualBathrooms,
    zillow_url,
    attractive_features
  };
  
  // Create a default market data structure if we don't have one
  const defaultMarketData: ComprehensiveMarketReport = marketData || {
    market: {
      id: 'unknown',
      name: zipcode ? `ZIP ${zipcode}` : 'Local Market',
      listing_count: listings.length,
      location_name: address.split(',').slice(-2).join(',').trim(),
      metrics: {
        occupancy: property_estimate?.estimates.occupancy_rate || 65,
        adr: property_estimate?.estimates.average_daily_rate || 200,
        revenue: property_estimate?.estimates.annual_revenue || percentiles.average,
        revpar: 0,
        active_listings: listings.length
      }
    },
    submarkets: [],
    top_listings: listings,
    bedroom_performance: [],
    generated_at: new Date().toISOString()
  };
  
  // Calculate bedroom performance from all listings
  const bedroomPerformanceMap = new Map<number, { count: number; totalRevenue: number; totalAdr: number; totalOccupancy: number }>();
  listings.forEach(l => {
    const br = l.bedrooms || 0;
    const existing = bedroomPerformanceMap.get(br) || { count: 0, totalRevenue: 0, totalAdr: 0, totalOccupancy: 0 };
    existing.count++;
    existing.totalRevenue += l.annual_revenue || 0;
    existing.totalAdr += l.adr || 0;
    existing.totalOccupancy += l.occupancy || 0;
    bedroomPerformanceMap.set(br, existing);
  });
  
  const bedroom_performance = Array.from(bedroomPerformanceMap.entries())
    .map(([bedrooms, data]) => ({
      bedrooms,
      count: data.count,
      avg_revenue: Math.round(data.totalRevenue / data.count),
      avg_adr: Math.round(data.totalAdr / data.count),
      avg_occupancy: Math.round(data.totalOccupancy / data.count * 10) / 10
    }))
    .sort((a, b) => a.bedrooms - b.bedrooms);
  
  // Step 6.5: Fetch historical metrics for top 5 competitors
  let competitor_historical: Array<{
    name: string;
    listing_id: string;
    total_revenue_12mo: number;
    avg_adr: number;
    avg_occupancy: number;
    revenue_trend: 'growing' | 'stable' | 'declining';
  }> = [];
  
  const top5Competitors = listings
    .filter(l => l.airbnb_url)
    .sort((a, b) => (b.annual_revenue || 0) - (a.annual_revenue || 0))
    .slice(0, 5);
  
  if (top5Competitors.length > 0) {
    try {
      const historicalPromises = top5Competitors.map(async (comp) => {
        // Extract listing ID from Airbnb URL
        const urlMatch = comp.airbnb_url?.match(/rooms\/(\d+)/);
        const listingId = urlMatch ? urlMatch[1] : null;
        
        if (!listingId) return null;
        
        const historical = await getListingHistoricalMetrics(listingId, 12);
        if (!historical) return null;
        
        return {
          name: comp.title || 'Competitor',
          listing_id: listingId,
          total_revenue_12mo: historical.summary.total_revenue,
          avg_adr: historical.summary.avg_adr,
          avg_occupancy: historical.summary.avg_occupancy,
          revenue_trend: historical.summary.revenue_trend
        };
      });
      
      const results = await Promise.all(historicalPromises);
      competitor_historical = results.filter((r): r is NonNullable<typeof r> => r !== null);
      console.log(`[ArbitrageAnalysis] Fetched historical data for ${competitor_historical.length} competitors`);
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error fetching competitor historical data:', error);
    }
  }
  
  // Step 6.6: Fetch daily pricing intelligence
  let daily_pricing: {
    avg_adr: number;
    adr_percentile_25: number;
    adr_percentile_50: number;
    adr_percentile_75: number;
    avg_occupancy: number;
    peak_dates: string[];
    low_dates: string[];
    pricing_volatility: 'low' | 'medium' | 'high';
  } | undefined;
  
  if (marketData?.market?.id) {
    try {
      const futurePricing = await getMarketFutureDailyData(marketData.market.id, 6, actualBedrooms);
      
      if (futurePricing.length > 0) {
        // Calculate averages
        const avgAdr = futurePricing.reduce((sum, d) => sum + d.adr, 0) / futurePricing.length;
        const avgP25 = futurePricing.reduce((sum, d) => sum + d.adr_percentile_25, 0) / futurePricing.length;
        const avgP50 = futurePricing.reduce((sum, d) => sum + d.adr_percentile_50, 0) / futurePricing.length;
        const avgP75 = futurePricing.reduce((sum, d) => sum + d.adr_percentile_75, 0) / futurePricing.length;
        const avgOcc = futurePricing.reduce((sum, d) => sum + d.occupancy, 0) / futurePricing.length;
        
        // Find peak and low dates (top/bottom 10%)
        const sortedByAdr = [...futurePricing].sort((a, b) => b.adr - a.adr);
        const topCount = Math.max(3, Math.floor(futurePricing.length * 0.1));
        const peakDates = sortedByAdr.slice(0, topCount).map(d => d.date);
        const lowDates = sortedByAdr.slice(-topCount).map(d => d.date);
        
        // Calculate volatility (coefficient of variation)
        const adrMean = avgAdr;
        const adrStdDev = Math.sqrt(futurePricing.reduce((sum, d) => sum + Math.pow(d.adr - adrMean, 2), 0) / futurePricing.length);
        const cv = adrStdDev / adrMean;
        const volatility: 'low' | 'medium' | 'high' = cv < 0.15 ? 'low' : cv < 0.3 ? 'medium' : 'high';
        
        daily_pricing = {
          avg_adr: Math.round(avgAdr),
          adr_percentile_25: Math.round(avgP25),
          adr_percentile_50: Math.round(avgP50),
          adr_percentile_75: Math.round(avgP75),
          avg_occupancy: Math.round(avgOcc * 100) / 100,
          peak_dates: peakDates,
          low_dates: lowDates,
          pricing_volatility: volatility
        };
        console.log(`[ArbitrageAnalysis] Daily pricing intelligence: avg ADR $${daily_pricing.avg_adr}, volatility: ${volatility}`);
      }
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error fetching daily pricing:', error);
    }
  }
  
  // Step 6.7: Fetch submarket analysis
  let submarket_analysis: {
    property_submarket?: {
      name: string;
      revenue: number;
      occupancy: number;
      adr: number;
      listing_count: number;
    };
    top_submarkets: Array<{
      name: string;
      revenue: number;
      occupancy: number;
      adr: number;
      listing_count: number;
    }>;
    market_avg_revenue: number;
  } | undefined;
  
  if (marketData?.market?.id) {
    try {
      const submarketData = await exploreSubmarketsWithMetrics(marketData.market.id, {
        sortBy: 'revenue',
        limit: 10
      });
      
      if (submarketData.submarkets.length > 0) {
        submarket_analysis = {
          top_submarkets: submarketData.submarkets.slice(0, 5).map(s => ({
            name: s.name,
            revenue: s.metrics.revenue,
            occupancy: s.metrics.occupancy,
            adr: s.metrics.adr,
            listing_count: s.listing_count
          })),
          market_avg_revenue: submarketData.market.metrics.revenue || 0
        };
        
        // Try to find property's submarket based on location
        // For now, just use the top recommendation if available
        if (submarketData.topRecommendation) {
          submarket_analysis.property_submarket = {
            name: submarketData.topRecommendation.name,
            revenue: submarketData.topRecommendation.metrics.revenue,
            occupancy: submarketData.topRecommendation.metrics.occupancy,
            adr: submarketData.topRecommendation.metrics.adr,
            listing_count: submarketData.topRecommendation.listing_count
          };
        }
        
        console.log(`[ArbitrageAnalysis] Submarket analysis: ${submarketData.submarkets.length} submarkets found`);
      }
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error fetching submarket analysis:', error);
    }
  }
  
  // Step 6.8: Fetch top performer comps using AirDNA's native comp algorithm
  let top_performer_comps: ListingComp[] = [];
  
  // Get the top performer's listing ID from Airbnb URL
  const topPerformer = listings
    .filter(l => l.airbnb_url)
    .sort((a, b) => (b.annual_revenue || 0) - (a.annual_revenue || 0))[0];
  
  if (topPerformer?.airbnb_url) {
    try {
      // Extract listing ID from Airbnb URL
      const urlMatch = topPerformer.airbnb_url.match(/rooms\/(\d+)/);
      const listingId = urlMatch ? urlMatch[1] : null;
      
      if (listingId) {
        console.log(`[ArbitrageAnalysis] Fetching comps for top performer (ID: ${listingId})...`);
        const comps = await getListingComps(listingId, 10);
        
        if (comps.length > 0) {
          top_performer_comps = comps;
          console.log(`[ArbitrageAnalysis] Got ${comps.length} comps from AirDNA's native algorithm for top performer`);
        }
      }
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error fetching top performer comps:', error);
    }
  }
  
  // Step 6.9: Fetch top performer's pricing strategy
  let top_performer_pricing: ListingFuturePricing | null = null;
  
  if (topPerformer?.airbnb_url) {
    try {
      const urlMatch = topPerformer.airbnb_url.match(/rooms\/(\d+)/);
      const listingId = urlMatch ? urlMatch[1] : null;
      
      if (listingId) {
        console.log(`[ArbitrageAnalysis] Fetching pricing strategy for top performer (ID: ${listingId})...`);
        const pricing = await getListingFuturePricing(listingId, 90);
        
        if (pricing && pricing.pricing_data.length > 0) {
          top_performer_pricing = pricing;
          console.log(`[ArbitrageAnalysis] Got ${pricing.pricing_data.length} days of pricing data. Weekday: $${pricing.pricing_summary.avg_weekday_price}, Weekend: $${pricing.pricing_summary.avg_weekend_price}, Premium: ${pricing.pricing_summary.weekend_premium_percent}%`);
        }
      }
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error fetching top performer pricing:', error);
    }
  }
  
  // Step 6.10: Fetch Rentalizer comps for enhanced competitor data
  let rentalizer_comps: RentalizerCompData | null = null;
  
  try {
    console.log(`[ArbitrageAnalysis] Fetching Rentalizer comps for ${address}...`);
    const comps = await getRentalizerComps(address, actualBedrooms, actualBathrooms, 25);
    
    if (comps && comps.comps.length > 0) {
      rentalizer_comps = comps;
      const superhostCount = comps.comps.filter(c => c.superhost).length;
      const professionalCount = comps.comps.filter(c => c.professionally_managed).length;
      const avgDistance = comps.comps.reduce((sum, c) => sum + c.distance_meters, 0) / comps.comps.length;
      console.log(`[ArbitrageAnalysis] Got ${comps.comps.length} Rentalizer comps. Superhosts: ${superhostCount}/${comps.comps.length}, Professional: ${professionalCount}/${comps.comps.length}, Avg Distance: ${Math.round(avgDistance)}m`);
    }
  } catch (error) {
    console.error('[ArbitrageAnalysis] Error fetching Rentalizer comps:', error);
  }
  
  // Step 6.11: Check if property already exists in AirDNA database (was previously listed)
  let existing_listing_data: {
    property_id: string;
    title: string;
    annual_revenue: number;
    adr: number;
    occupancy: number;
    rating: number | null;
    reviews: number;
  } | undefined = undefined;
  
  // Try to find existing listing from rentalizer comps or competitors that match the address
  if (rentalizer_comps && rentalizer_comps.comps.length > 0) {
    // Check if any comp is at distance 0 (same property)
    const samePropertyComp = rentalizer_comps.comps.find(c => c.distance_meters === 0);
    if (samePropertyComp) {
      try {
        console.log(`[ArbitrageAnalysis] Found existing listing at same address (ID: ${samePropertyComp.listing_id}), fetching details...`);
        const details = await getSinglePropertyDetails(samePropertyComp.listing_id);
        if (details) {
          existing_listing_data = {
            property_id: details.property_id,
            title: details.title,
            annual_revenue: details.annual_revenue,
            adr: details.adr,
            occupancy: details.occupancy,
            rating: details.rating,
            reviews: details.reviews
          };
          console.log(`[ArbitrageAnalysis] Got existing listing data: Revenue $${details.annual_revenue}/yr, ADR $${details.adr}, ${details.reviews} reviews`);
        }
      } catch (error) {
        console.error('[ArbitrageAnalysis] Error fetching existing listing details:', error);
      }
    }
  }
  
  // Step 6.12: Fetch submarket listings for hyper-local competition analysis
  let submarket_listings: {
    submarket_id: string;
    submarket_name: string;
    total_listings: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    top_listings: ListingData[];
  } | undefined = undefined;
  
  // Get submarket ID from rentalizer comps or property estimate
  const submarketId = rentalizer_comps?.market_context?.submarket_id || 
    (property_estimate as any)?.property?.submarket_id;
  const submarketName = rentalizer_comps?.market_context?.submarket_name || 'Local Submarket';
  
  if (submarketId) {
    try {
      console.log(`[ArbitrageAnalysis] Fetching submarket listings for ${submarketName} (ID: ${submarketId})...`);
      const submarketResult = await getSubmarketListings(submarketId, {
        limit: 50,
        orderBy: 'revenue',
        orderDirection: 'desc'
      });
      
      if (submarketResult.listings.length > 0) {
        const listings = submarketResult.listings;
        const avgRevenue = listings.reduce((sum, l) => sum + (l.annual_revenue || 0), 0) / listings.length;
        const avgAdr = listings.reduce((sum, l) => sum + (l.adr || 0), 0) / listings.length;
        const avgOccupancy = listings.reduce((sum, l) => sum + (l.occupancy || 0), 0) / listings.length;
        
        submarket_listings = {
          submarket_id: submarketId,
          submarket_name: submarketName,
          total_listings: submarketResult.total_count,
          avg_revenue: avgRevenue,
          avg_adr: avgAdr,
          avg_occupancy: avgOccupancy,
          top_listings: listings.slice(0, 10)
        };
        console.log(`[ArbitrageAnalysis] Got ${submarketResult.total_count} submarket listings. Avg Revenue: $${Math.round(avgRevenue)}/yr, Avg ADR: $${Math.round(avgAdr)}`);
      }
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error fetching submarket listings:', error);
    }
  }
  
  // Step 6.13: Qualifying competitors will be fetched after marketId is determined
  let qualifying_competitors: {
    qualifying_count: number;
    total_same_bedroom: number;
    qualification_rate: number;
    revenue_threshold: number;
    avg_qualifying_revenue: number;
    avg_qualifying_occupancy: number;
    avg_qualifying_adr: number;
    superhost_percentage: number;
    professional_percentage: number;
    top_qualifiers: ListingData[];
  } | undefined = undefined;
  
  // Step 7: Analyze seasonality from monthly forecast
  const seasonality = property_estimate?.monthly_forecast 
    ? analyzeSeasonality(property_estimate.monthly_forecast)
    : [];
  
  // Step 8: Calculate booking metrics
  const booking_metrics = calculateBookingMetrics(seasonality);
  
  // Step 9: Analyze amenities from competitors
  const amenity_analysis = analyzeAmenities(competitors);
  
  // Step 10: Generate base report
  let report = await generateSimplifiedReport(
    property,
    defaultMarketData,
    competitors,
    percentiles,
    profitability
  );
  
  // Step 11: Add seasonality section if we have data
  if (seasonality.length > 0) {
    const seasonalitySection = generateSeasonalitySection(seasonality);
    // Insert after market analysis section
    const marketAnalysisEnd = report.indexOf('## 3. Then, We Study the Competition');
    if (marketAnalysisEnd > 0) {
      report = report.slice(0, marketAnalysisEnd) + seasonalitySection + '\n\n' + report.slice(marketAnalysisEnd);
    }
  }
  
  // Step 12: Add amenity analysis section if we have data
  if (amenity_analysis.length > 0) {
    const amenitySection = generateAmenitySection(amenity_analysis);
    // Insert after competitor analysis section
    const competitorAnalysisEnd = report.indexOf('## 4. Finally, We Project the Profit');
    if (competitorAnalysisEnd > 0) {
      report = report.slice(0, competitorAnalysisEnd) + amenitySection + '\n\n' + report.slice(competitorAnalysisEnd);
    }
  }
  
  // Mark competitors step complete, start AI analysis
  if (sessionId) progressTracker.completeStep(sessionId, 'competitors', `Analyzed ${competitors.length} competitors`);
  if (sessionId) progressTracker.startStep(sessionId, 'ai_analysis', 'Running AI analysis...');
  
  // Step 13: Run FULL AI ANALYSIS using Gemini
  let ai_analysis: FullAIAnalysis | null = null;
  try {
    console.log('[ArbitrageAnalysis] Running full AI analysis with Gemini...');
    
    // Prepare data for AI analysis
    const propertyData = {
      address,
      bedrooms: actualBedrooms,
      bathrooms: actualBathrooms,
      monthly_rent,
      zillow_url,
      attractive_features
    };
    
    const marketData = {
      name: defaultMarketData.market.name,
      occupancy: defaultMarketData.market.metrics.occupancy,
      adr: defaultMarketData.market.metrics.adr,
      revenue: defaultMarketData.market.metrics.revenue,
      active_listings: defaultMarketData.market.metrics.active_listings || defaultMarketData.market.listing_count
    };
    
    const competitorData = competitors.map(c => ({
      name: c.name,
      airbnb_url: c.airbnb_url,
      annual_revenue: c.annual_revenue,
      occupancy: c.occupancy,
      adr: c.adr,
      rating: c.rating,
      reviews: c.reviews,
      success_factor: c.key_success_factor,
      amenities: c.amenities
    }));
    
    const profitabilityData = {
      conservative: profitability.scenarios.conservative.estimated_profit,
      realistic: profitability.scenarios.realistic.estimated_profit,
      optimistic: profitability.scenarios.optimistic.estimated_profit
    };
    
    ai_analysis = await runFullAIAnalysis(
      propertyData,
      marketData,
      competitorData,
      percentiles,
      seasonality,
      profitabilityData
    );
    
    console.log('[ArbitrageAnalysis] AI analysis complete');
    
    // Step 14: Add AI Analysis section to report
    if (ai_analysis) {
      const aiSection = generateAIAnalysisSection(ai_analysis);
      // Insert after profitability section, before references
      const referencesStart = report.indexOf('## 5. References');
      if (referencesStart > 0) {
        report = report.slice(0, referencesStart) + aiSection + '\n\n' + report.slice(referencesStart);
      } else {
        report += '\n\n' + aiSection;
      }
    }
  } catch (error) {
    console.error('[ArbitrageAnalysis] Error running AI analysis:', error);
    // Continue without AI analysis - the base report is still valuable
  }
  
  // Step 15: Fetch additional market intelligence data
  let booking_patterns: BookingPatternsData | undefined;
  let supply_trend: SupplyTrendData | undefined;
  let professional_host_stats: ProfessionalHostData | undefined;
  let cancellation_policies: CancellationPolicyData | undefined;
  let property_roi: PropertyROIData | undefined;
  let regulations: RegulationsData | undefined;
  let radius_listings: {
    total_count: number;
    radius_meters: number;
    listings_per_sqkm: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    superhost_percentage: number;
    professional_percentage: number;
    same_bedroom_count: number;
    top_nearby: ListingData[];
  } | undefined;
  let market_saturation: {
    total_listings: number;
    same_bedroom_count: number;
    bedroom_distribution: Array<{ bedrooms: number; count: number; percentage: number }>;
    revenue_percentiles: { p25: number; p50: number; p75: number; p90: number };
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    superhost_percentage: number;
    professional_percentage: number;
    market_concentration: 'fragmented' | 'moderate' | 'concentrated';
  } | undefined;
  let property_type_analysis: {
    entire_home: {
      count: number;
      avg_revenue: number;
      avg_adr: number;
      avg_occupancy: number;
      superhost_percentage: number;
    };
    private_room: {
      count: number;
      avg_revenue: number;
      avg_adr: number;
      avg_occupancy: number;
      superhost_percentage: number;
    };
    revenue_premium: number;
    recommended_type: 'entire_home' | 'private_room';
    recommendation_reason: string;
  } | undefined;
  
  // Try to get market ID from multiple sources
  let marketId = defaultMarketData.market.id;
  
  // If marketId is 'unknown', try multiple fallbacks
  if (marketId === 'unknown') {
    // Try property estimate's market_id
    if (property_estimate?.property?.market_id) {
      marketId = property_estimate.property.market_id;
      console.log(`[ArbitrageAnalysis] Using market ID from property estimate: ${marketId}`);
    }
    // Try property estimate's submarket_id (some API calls work with submarket IDs)
    else if (property_estimate?.property?.submarket_id) {
      marketId = property_estimate.property.submarket_id;
      console.log(`[ArbitrageAnalysis] Using submarket ID from property estimate: ${marketId}`);
    }
  }
  
  console.log(`[ArbitrageAnalysis] Final market ID: ${marketId}`);
  console.log(`[ArbitrageAnalysis] Property estimate market_id: ${property_estimate?.property?.market_id}`);
  console.log(`[ArbitrageAnalysis] Property estimate submarket_id: ${property_estimate?.property?.submarket_id}`);
  console.log(`[ArbitrageAnalysis] defaultMarketData.market.id: ${defaultMarketData.market.id}`);
  
  if (marketId && marketId !== 'unknown') {
    try {
      console.log('[ArbitrageAnalysis] Fetching additional market intelligence...');
      
      // Fetch all additional data in parallel
      const [bookingData, supplyData, professionalData, cancellationData] = await Promise.all([
        getMarketBookingPatterns(marketId, actualBedrooms).catch(() => null),
        getMarketSupplyTrend(marketId, actualBedrooms).catch(() => null),
        getMarketProfessionalStats(marketId, actualBedrooms).catch(() => null),
        getMarketCancellationPolicies(marketId, actualBedrooms).catch(() => null)
      ]);
      
      // Process booking patterns
      if (bookingData) {
        booking_patterns = {
          ...bookingData,
          what_this_means: bookingData.insights.join(' ')
        };
        console.log('[ArbitrageAnalysis] Got booking patterns data');
      }
      
      // Process supply trend
      if (supplyData) {
        supply_trend = {
          ...supplyData,
          what_this_means: supplyData.insight
        };
        console.log('[ArbitrageAnalysis] Got supply trend data');
      }
      
      // Process professional host stats
      if (professionalData) {
        const whatThisMeans = professionalData.professional_percentage > 50
          ? `This market is ${professionalData.professional_percentage}% professionally managed. You're competing against experienced operators who know how to maximize revenue. Professional hosts earn ${professionalData.revenue_premium_percent}% more on average.`
          : `Only ${professionalData.professional_percentage}% of hosts are professional. This means most of your competition are individual hosts - a good opportunity if you operate professionally.`;
        
        professional_host_stats = {
          ...professionalData,
          what_this_means: whatThisMeans
        };
        console.log('[ArbitrageAnalysis] Got professional host stats');
      }
      
      // Process cancellation policies
      if (cancellationData) {
        cancellation_policies = {
          ...cancellationData,
          what_this_means: cancellationData.recommendation
        };
        console.log('[ArbitrageAnalysis] Got cancellation policy data');
      }
      
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error fetching additional market data:', error);
    }
    
    // Step 15.5: Fetch qualifying competitors (those meeting 2x rent revenue threshold)
    try {
      console.log(`[ArbitrageAnalysis] Fetching qualifying competitors for market ${marketId}...`);
      const qualifyingResult = await getQualifyingCompetitors(marketId, actualBedrooms, monthly_rent);
      
      if (qualifyingResult.qualifyingListings.length > 0) {
        const qualifiers = qualifyingResult.qualifyingListings;
        const superhostCount = qualifiers.filter(l => l.superhost).length;
        const professionalCount = qualifiers.filter(l => l.professionally_managed).length;
        const avgRevenue = qualifiers.reduce((sum, l) => sum + l.annual_revenue, 0) / qualifiers.length;
        const avgOccupancy = qualifiers.reduce((sum, l) => sum + (l.occupancy || 0), 0) / qualifiers.length;
        const avgAdr = qualifiers.reduce((sum, l) => sum + (l.adr || 0), 0) / qualifiers.length;
        
        qualifying_competitors = {
          qualifying_count: qualifiers.length,
          total_same_bedroom: qualifyingResult.totalInMarket,
          qualification_rate: (qualifiers.length / qualifyingResult.totalInMarket) * 100,
          revenue_threshold: qualifyingResult.revenueThreshold,
          avg_qualifying_revenue: avgRevenue,
          avg_qualifying_occupancy: avgOccupancy,
          avg_qualifying_adr: avgAdr,
          superhost_percentage: (superhostCount / qualifiers.length) * 100,
          professional_percentage: (professionalCount / qualifiers.length) * 100,
          top_qualifiers: qualifiers.slice(0, 10)
        };
        console.log(`[ArbitrageAnalysis] Found ${qualifiers.length}/${qualifyingResult.totalInMarket} (${qualifying_competitors.qualification_rate.toFixed(1)}%) listings meeting $${qualifyingResult.revenueThreshold}/yr threshold. Avg Revenue: $${Math.round(avgRevenue)}/yr`);
      } else {
        console.log(`[ArbitrageAnalysis] No qualifying competitors found meeting threshold`);
      }
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error fetching qualifying competitors:', error);
    }
    
    // Step 15.6: Fetch listings within 1km radius for hyper-local density analysis
    try {
      const propertyLat = property_estimate?.property?.latitude;
      const propertyLng = property_estimate?.property?.longitude;
      
      if (propertyLat && propertyLng) {
        console.log(`[ArbitrageAnalysis] Fetching listings within 1km of (${propertyLat}, ${propertyLng})...`);
        const radiusResult = await getListingsInRadius(propertyLat, propertyLng, 1000, {
          limit: 25,
          sort_by: 'revenue',
          sort_direction: 'desc'
        });
        
        if (radiusResult.listings.length > 0) {
          const listings = radiusResult.listings;
          const superhostCount = listings.filter(l => l.superhost).length;
          const professionalCount = listings.filter(l => l.professionally_managed).length;
          const sameBedroomCount = listings.filter(l => l.bedrooms === actualBedrooms).length;
          const avgRevenue = listings.reduce((sum, l) => sum + (l.annual_revenue || 0), 0) / listings.length;
          const avgAdr = listings.reduce((sum, l) => sum + (l.adr || 0), 0) / listings.length;
          const avgOccupancy = listings.reduce((sum, l) => sum + (l.occupancy || 0), 0) / listings.length;
          
          // Calculate listings per square kilometer (1km radius = ~3.14 sq km)
          const areaInSqKm = Math.PI * Math.pow(1, 2); // π * r²
          const listingsPerSqKm = radiusResult.total_count / areaInSqKm;
          
          radius_listings = {
            total_count: radiusResult.total_count,
            radius_meters: 1000,
            listings_per_sqkm: Math.round(listingsPerSqKm * 10) / 10,
            avg_revenue: avgRevenue,
            avg_adr: avgAdr,
            avg_occupancy: avgOccupancy,
            superhost_percentage: (superhostCount / listings.length) * 100,
            professional_percentage: (professionalCount / listings.length) * 100,
            same_bedroom_count: sameBedroomCount,
            top_nearby: listings.slice(0, 10)
          };
          console.log(`[ArbitrageAnalysis] Found ${radiusResult.total_count} listings within 1km (${listingsPerSqKm.toFixed(1)} per sq km). ${sameBedroomCount} same-bedroom. Avg Revenue: $${Math.round(avgRevenue)}/yr`);
        } else {
          console.log(`[ArbitrageAnalysis] No listings found within 1km radius`);
        }
      } else {
        console.log(`[ArbitrageAnalysis] No coordinates available for radius search`);
      }
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error fetching radius listings:', error);
    }
    
    // Step 15.7: Fetch complete market listings for saturation analysis
    try {
      console.log(`[ArbitrageAnalysis] Fetching complete market listings for saturation analysis...`);
      const allListings = await getAllMarketListings(marketId, { maxListings: 200 });
      
      if (allListings.length > 0) {
        // Calculate bedroom distribution
        const bedroomCounts = new Map<number, number>();
        allListings.forEach(l => {
          const br = l.bedrooms || 0;
          bedroomCounts.set(br, (bedroomCounts.get(br) || 0) + 1);
        });
        const bedroomDistribution = Array.from(bedroomCounts.entries())
          .map(([bedrooms, count]) => ({
            bedrooms,
            count,
            percentage: (count / allListings.length) * 100
          }))
          .sort((a, b) => a.bedrooms - b.bedrooms);
        
        // Calculate revenue percentiles
        const revenues = allListings.map(l => l.annual_revenue || 0).filter(r => r > 0).sort((a, b) => a - b);
        const getPercentile = (arr: number[], p: number) => {
          const idx = Math.floor(arr.length * p);
          return arr[Math.min(idx, arr.length - 1)] || 0;
        };
        
        // Calculate averages
        const avgRevenue = allListings.reduce((sum, l) => sum + (l.annual_revenue || 0), 0) / allListings.length;
        const avgAdr = allListings.reduce((sum, l) => sum + (l.adr || 0), 0) / allListings.length;
        const avgOccupancy = allListings.reduce((sum, l) => sum + (l.occupancy || 0), 0) / allListings.length;
        const superhostCount = allListings.filter(l => l.superhost).length;
        const professionalCount = allListings.filter(l => l.professionally_managed).length;
        const sameBedroomCount = allListings.filter(l => l.bedrooms === actualBedrooms).length;
        
        // Determine market concentration (top 10% revenue share)
        const top10Percent = Math.ceil(allListings.length * 0.1);
        const totalRevenue = revenues.reduce((sum, r) => sum + r, 0);
        const top10Revenue = revenues.slice(-top10Percent).reduce((sum, r) => sum + r, 0);
        const top10Share = totalRevenue > 0 ? (top10Revenue / totalRevenue) * 100 : 0;
        const concentration: 'fragmented' | 'moderate' | 'concentrated' = 
          top10Share > 50 ? 'concentrated' : top10Share > 30 ? 'moderate' : 'fragmented';
        
        market_saturation = {
          total_listings: allListings.length,
          same_bedroom_count: sameBedroomCount,
          bedroom_distribution: bedroomDistribution,
          revenue_percentiles: {
            p25: getPercentile(revenues, 0.25),
            p50: getPercentile(revenues, 0.50),
            p75: getPercentile(revenues, 0.75),
            p90: getPercentile(revenues, 0.90)
          },
          avg_revenue: avgRevenue,
          avg_adr: avgAdr,
          avg_occupancy: avgOccupancy,
          superhost_percentage: (superhostCount / allListings.length) * 100,
          professional_percentage: (professionalCount / allListings.length) * 100,
          market_concentration: concentration
        };
        console.log(`[ArbitrageAnalysis] Market saturation: ${allListings.length} listings, ${sameBedroomCount} same-bedroom, ${concentration} concentration. Top 10% hold ${top10Share.toFixed(0)}% of revenue.`);
      }
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error fetching market saturation data:', error);
    }
    
    // Step 15.8: Fetch property type analysis (entire home vs private room)
    try {
      console.log(`[ArbitrageAnalysis] Fetching property type analysis...`);
      
      // Fetch entire home listings
      const entireHomeListings = await getFilteredMarketListings(marketId, {
        listing_type: 'entire_home',
        bedrooms: actualBedrooms
      }, 'revenue', 50);
      
      // Fetch private room listings
      const privateRoomListings = await getFilteredMarketListings(marketId, {
        listing_type: 'private_room'
      }, 'revenue', 50);
      
      const calcStats = (listings: ListingData[]) => {
        if (listings.length === 0) return { count: 0, avg_revenue: 0, avg_adr: 0, avg_occupancy: 0, superhost_percentage: 0 };
        return {
          count: listings.length,
          avg_revenue: listings.reduce((sum, l) => sum + (l.annual_revenue || 0), 0) / listings.length,
          avg_adr: listings.reduce((sum, l) => sum + (l.adr || 0), 0) / listings.length,
          avg_occupancy: listings.reduce((sum, l) => sum + (l.occupancy || 0), 0) / listings.length,
          superhost_percentage: (listings.filter(l => l.superhost).length / listings.length) * 100
        };
      };
      
      const entireHomeStats = calcStats(entireHomeListings);
      const privateRoomStats = calcStats(privateRoomListings);
      
      // Calculate revenue premium
      const revenuePremium = privateRoomStats.avg_revenue > 0 
        ? ((entireHomeStats.avg_revenue - privateRoomStats.avg_revenue) / privateRoomStats.avg_revenue) * 100 
        : 0;
      
      // Determine recommendation
      const recommendedType: 'entire_home' | 'private_room' = revenuePremium > 50 ? 'entire_home' : 
        entireHomeStats.avg_occupancy > privateRoomStats.avg_occupancy ? 'entire_home' : 'private_room';
      
      const reason = recommendedType === 'entire_home' 
        ? `Entire homes earn ${revenuePremium.toFixed(0)}% more revenue with ${(entireHomeStats.avg_occupancy * 100).toFixed(0)}% occupancy vs ${(privateRoomStats.avg_occupancy * 100).toFixed(0)}% for private rooms`
        : `Private rooms have higher occupancy (${(privateRoomStats.avg_occupancy * 100).toFixed(0)}%) and lower competition in this market`;
      
      property_type_analysis = {
        entire_home: entireHomeStats,
        private_room: privateRoomStats,
        revenue_premium: revenuePremium,
        recommended_type: recommendedType,
        recommendation_reason: reason
      };
      
      console.log(`[ArbitrageAnalysis] Property type analysis: Entire homes ($${Math.round(entireHomeStats.avg_revenue)}/yr) vs Private rooms ($${Math.round(privateRoomStats.avg_revenue)}/yr). Premium: ${revenuePremium.toFixed(0)}%`);
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error fetching property type analysis:', error);
    }
  }
  
  // Calculate property ROI
  const startupBase = actualBedrooms * 3000;
  property_roi = {
    startup_costs: {
      furniture_low: startupBase,
      furniture_high: Math.round(startupBase * 1.5),
      supplies: 750,
      photos_and_listing: 500,
      first_month_buffer: monthly_rent * 2,
      total_low: startupBase + 750 + 500 + monthly_rent * 2,
      total_high: Math.round(startupBase * 1.5) + 750 + 500 + monthly_rent * 2
    },
    break_even: {
      months_conservative: profitability.scenarios.conservative.estimated_profit > 0 
        ? Math.ceil((startupBase + 1250) / (profitability.scenarios.conservative.estimated_profit / 12)) 
        : 24,
      months_realistic: profitability.scenarios.realistic.estimated_profit > 0 
        ? Math.ceil((startupBase + 1250) / (profitability.scenarios.realistic.estimated_profit / 12)) 
        : 18,
      months_optimistic: profitability.scenarios.optimistic.estimated_profit > 0 
        ? Math.ceil((startupBase + 1250) / (profitability.scenarios.optimistic.estimated_profit / 12)) 
        : 12
    },
    annual_roi: {
      conservative: startupBase > 0 ? Math.round((profitability.scenarios.conservative.estimated_profit / startupBase) * 100) : 0,
      realistic: startupBase > 0 ? Math.round((profitability.scenarios.realistic.estimated_profit / startupBase) * 100) : 0,
      optimistic: startupBase > 0 ? Math.round((profitability.scenarios.optimistic.estimated_profit / startupBase) * 100) : 0
    },
    what_this_means: `You'll need $${(startupBase + 1250 + monthly_rent * 2).toLocaleString()}-$${(Math.round(startupBase * 1.5) + 1250 + monthly_rent * 2).toLocaleString()} to get started. At realistic projections, you'll make your money back in ${profitability.scenarios.realistic.estimated_profit > 0 ? Math.ceil((startupBase + 1250) / (profitability.scenarios.realistic.estimated_profit / 12)) : 18} months.`
  };
  
  // Get local regulations
  try {
    const addressParts = address.split(',').map(p => p.trim());
    const city = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : '';
    const state = addressParts.length >= 1 ? addressParts[addressParts.length - 1].replace(/\d+/g, '').trim() : '';
    
    if (city && state) {
      const regData = await getLocalRegulations(city, state);
      regulations = {
        ...regData,
        disclaimer: regData.disclaimer || 'Always verify regulations with local authorities before operating.'
      };
      console.log('[ArbitrageAnalysis] Got local regulations');
    }
  } catch (error) {
    console.error('[ArbitrageAnalysis] Error fetching regulations:', error);
  }
  
  // Step 16: Analyze competitor photos using Gemini Vision
  let photo_analysis: {
    competitor_photos: Array<{ name: string; imageUrl: string; analysis: PhotoAnalysis }>;
    design_insights: {
      common_themes: string[];
      design_recommendations: string[];
      must_have_shots: string[];
      differentiation_opportunities: string[];
    };
  } | null = null;
  
  try {
    console.log('[ArbitrageAnalysis] Analyzing competitor photos with Gemini Vision...');
    
    // Get Airbnb URLs from top competitors
    const competitorsWithUrls = competitors
      .filter(c => c.airbnb_url && c.airbnb_url.includes('airbnb.com'))
      .slice(0, 5); // Analyze top 5 competitors
    
    if (competitorsWithUrls.length > 0) {
      // Scrape images from competitor listings
      const urlsToScrape = competitorsWithUrls.map(c => c.airbnb_url);
      const scrapedImages = await batchScrapeAirbnbImages(urlsToScrape, 2);
      
      // Analyze photos for competitors that have images
      const competitor_photos: Array<{ name: string; imageUrl: string; analysis: PhotoAnalysis }> = [];
      
      for (const comp of competitorsWithUrls) {
        const images = scrapedImages.get(comp.airbnb_url);
        if (images && images.length > 0) {
          try {
            const analysis = await analyzeListingPhoto(images[0], comp.name);
            competitor_photos.push({
              name: comp.name,
              imageUrl: images[0],
              analysis
            });
          } catch (photoError) {
            console.error(`[ArbitrageAnalysis] Error analyzing photo for ${comp.name}:`, photoError);
          }
        }
      }
      
      // Generate design insights from analyzed photos
      if (competitor_photos.length > 0) {
        const themes = competitor_photos.map(p => p.analysis.design_theme).filter(t => t !== 'Unable to analyze');
        const allStrengths = competitor_photos.flatMap(p => p.analysis.strengths);
        const allImprovements = competitor_photos.flatMap(p => p.analysis.improvements);
        
        photo_analysis = {
          competitor_photos,
          design_insights: {
            common_themes: Array.from(new Set(themes)),
            design_recommendations: Array.from(new Set(allStrengths)).slice(0, 5),
            must_have_shots: ['Hero living room shot', 'Kitchen with staging', 'Each bedroom', 'Clean bathroom', 'Outdoor/patio area'],
            differentiation_opportunities: Array.from(new Set(allImprovements)).slice(0, 3)
          }
        };
        
        console.log(`[ArbitrageAnalysis] Analyzed ${competitor_photos.length} competitor photos`);
        
        // Add photo analysis section to report
        const photoSection = generatePhotoAnalysisSection(photo_analysis);
        const aiSectionStart = report.indexOf('## AI-Powered Investment Analysis');
        if (aiSectionStart > 0) {
          report = report.slice(0, aiSectionStart) + photoSection + '\n\n' + report.slice(aiSectionStart);
        }
      }
    }
  } catch (error) {
    console.error('[ArbitrageAnalysis] Error analyzing photos:', error);
    // Continue without photo analysis
  }
  
  // Mark AI analysis complete, start historical data
  if (sessionId) progressTracker.completeStep(sessionId, 'ai_analysis', 'AI analysis complete');
  if (sessionId) progressTracker.startStep(sessionId, 'historical', 'Processing historical data...');
  
  // Step 17: Fetch comprehensive market data (seasonality, future pricing, historical trends)
  let market_seasonality: SeasonalityData[] | undefined;
  let future_pricing: FutureDailyData[] | undefined;
  let historical_trends: {
    occupancy: Array<{ date: string; value: number }>;
    adr: Array<{ date: string; value: number }>;
    revenue: Array<{ date: string; value: number }>;
  } | undefined;
  
  if (marketId && marketId !== 'unknown') {
    try {
      console.log('[ArbitrageAnalysis] Fetching comprehensive market data...');
      
      // For historical data, prefer the parent market_id over submarket_id
      // The metrics API works better with parent market IDs (e.g., airdna-429 for St. Louis)
      let historicalMarketId = marketId;
      if (property_estimate?.property?.market_id && property_estimate.property.market_id !== marketId) {
        historicalMarketId = property_estimate.property.market_id;
        console.log(`[ArbitrageAnalysis] Using parent market ID for historical data: ${historicalMarketId}`);
      }
      
      // Fetch all comprehensive data in parallel
      const [seasonalityData, futurePricingData, historicalData] = await Promise.all([
        getMarketSeasonality(marketId).catch(() => []),
        getMarketFutureDailyData(marketId, 6, actualBedrooms).catch(() => []),
        getMarketHistoricalData(historicalMarketId, 60).catch((err) => {
          console.error(`[ArbitrageAnalysis] Historical data fetch failed for ${historicalMarketId}:`, err);
          return null;
        })
      ]);
      
      if (seasonalityData && seasonalityData.length > 0) {
        market_seasonality = seasonalityData;
        console.log(`[ArbitrageAnalysis] Got ${seasonalityData.length} months of market seasonality`);
      }
      
      if (futurePricingData && futurePricingData.length > 0) {
        future_pricing = futurePricingData;
        console.log(`[ArbitrageAnalysis] Got ${futurePricingData.length} days of future pricing`);
      }
      
      if (historicalData) {
        historical_trends = {
          occupancy: historicalData.occupancy || [],
          adr: historicalData.adr || [],
          revenue: historicalData.revenue || []
        };
        console.log(`[ArbitrageAnalysis] Got ${historicalData.occupancy?.length || 0} months of historical trends data`);
      } else {
        console.log(`[ArbitrageAnalysis] historicalData is null/undefined - API may not support 60 months for this market`);
      }
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error fetching comprehensive market data:', error);
    }
  }
  
  // Step 18: Calculate 5-year historical summary
  let five_year_summary: ArbitrageReport['five_year_summary'] | undefined;
  
  if (historical_trends && historical_trends.occupancy.length > 12) {
    try {
      five_year_summary = calculate5YearSummary(historical_trends);
      if (five_year_summary) {
        console.log(`[ArbitrageAnalysis] Generated 5-year summary with ${five_year_summary.years_of_data} years of data`);
      }
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error calculating 5-year summary:', error);
    }
  }
  
  // Step 19: Generate Gemini historical analysis
  let historical_analysis: HistoricalMarketAnalysis | undefined;
  
  if (five_year_summary && five_year_summary.years_of_data >= 2) {
    try {
      const marketName = property_estimate?.property?.market_id 
        ? (await getMarketDetails(property_estimate.property.market_id))?.name || 'Local Market'
        : 'Local Market';
      
      console.log('[ArbitrageAnalysis] Generating Gemini historical analysis...');
      historical_analysis = await analyzeHistoricalMarketTrends(
        marketName,
        five_year_summary,
        { monthly_rent, bedrooms: actualBedrooms }
      );
      console.log('[ArbitrageAnalysis] Gemini historical analysis complete');
    } catch (error) {
      console.error('[ArbitrageAnalysis] Error generating historical analysis:', error);
    }
  }
  
  // Mark historical complete, start narrative generation
  if (sessionId) progressTracker.completeStep(sessionId, 'historical', 'Historical data processed');
  if (sessionId) progressTracker.startStep(sessionId, 'narrative', 'Generating narrative report...');
  
  // Step 20: Generate comprehensive narrative report with retry logic
  let narrative_report: NarrativeReport | undefined;
  const MAX_RETRIES = 2;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[ArbitrageAnalysis] Generating comprehensive narrative report (attempt ${attempt}/${MAX_RETRIES})...`);
    
    // Get market name for the report
    const marketName = property_estimate?.property?.market_id 
      ? (await getMarketDetails(property_estimate.property.market_id))?.name || 'Local Market'
      : 'Local Market';
    
    narrative_report = await generateNarrativeReport({
      address,
      monthly_rent,
      bedrooms: actualBedrooms,
      bathrooms: actualBathrooms,
      market_name: marketName,
      market_occupancy: marketData?.market?.metrics?.occupancy || 0.65,
      market_adr: marketData?.market?.metrics?.adr || 150,
      active_listings: competitors.length,
      revenue_low: percentiles.median,
      revenue_mid: percentiles.top_25_percent,
      revenue_high: percentiles.top_10_percent,
      monthly_expenses: profitability.monthly_expenses.total,
      annual_profit_conservative: profitability.scenarios.conservative.estimated_profit,
      annual_profit_realistic: profitability.scenarios.realistic.estimated_profit,
      annual_profit_optimistic: profitability.scenarios.optimistic.estimated_profit,
      competitors: competitors.slice(0, 10).map(c => ({
        name: c.name,
        annual_revenue: c.annual_revenue,
        occupancy: c.occupancy,
        adr: c.adr,
        rating: c.rating,
        reviews: c.reviews || 0,
        amenities: c.amenities || [],
        property_type: (c as any).property_type || 'Unknown',
        last_review_date: (c as any).last_review_date,
        is_superhost: (c as any).is_superhost || false,
        is_professional: (c as any).is_professional || false,
        distance_meters: (c as any).distance_meters
      })),
      seasonality: seasonality.map(s => ({
        month: s.month,
        revenue: s.revenue,
        occupancy: s.occupancy,
        adr: s.adr,
        season_type: s.season_type
      })),
      five_year_summary: five_year_summary ? {
        years_of_data: five_year_summary.years_of_data,
        occupancy: {
          current_year_avg: five_year_summary.occupancy.current_year_avg,
          five_year_avg: five_year_summary.occupancy.five_year_avg,
          trend: five_year_summary.occupancy.trend,
          percent_change: five_year_summary.occupancy.percent_change
        },
        adr: {
          current_year_avg: five_year_summary.adr.current_year_avg,
          five_year_avg: five_year_summary.adr.five_year_avg,
          trend: five_year_summary.adr.trend,
          percent_change: five_year_summary.adr.percent_change
        },
        revenue: {
          current_year_avg: five_year_summary.revenue.current_year_avg,
          five_year_avg: five_year_summary.revenue.five_year_avg,
          trend: five_year_summary.revenue.trend,
          percent_change: five_year_summary.revenue.percent_change
        },
        market_maturity: five_year_summary.market_maturity
      } : undefined,
      supply_trend: supply_trend ? {
        current_listings: supply_trend.current_listings,
        net_change: supply_trend.net_change,
        percent_change: supply_trend.percent_change,
        trend: supply_trend.trend
      } : undefined,
      professional_stats: professional_host_stats ? {
        professional_percentage: professional_host_stats.professional_percentage,
        superhost_percentage: professional_host_stats.superhost_percentage,
        revenue_premium_percent: professional_host_stats.revenue_premium_percent
      } : undefined,
      booking_patterns: booking_patterns ? {
        avg_lead_time_days: booking_patterns.booking_lead_time.avg_days,
        avg_length_of_stay: booking_patterns.length_of_stay.avg_nights
      } : undefined,
      amenities: amenity_analysis?.slice(0, 8).map(a => ({
        amenity: a.amenity,
        percentage_of_top_performers: a.percentage_of_top_performers
      })),
      risks: ai_analysis?.risk_assessment?.risks?.slice(0, 5).map(r => ({
        category: r.category,
        description: r.description,
        severity: r.severity
      })),
      bedroom_performance: bedroom_performance,
      property_bedrooms: actualBedrooms,
      competitor_historical: competitor_historical,
      daily_pricing: daily_pricing,
      submarket_analysis: submarket_analysis,
      top_performer_comps: top_performer_comps.length > 0 ? top_performer_comps.map(c => ({
        title: c.title,
        bedrooms: c.bedrooms,
        bathrooms: c.bathrooms,
        property_type: c.property_type,
        annual_revenue: c.annual_revenue,
        adr: c.adr,
        occupancy: c.occupancy,
        rating: c.rating,
        reviews: c.reviews,
        similarity_score: c.similarity_score,
        amenities: c.amenities
      })) : undefined,
      top_performer_pricing: top_performer_pricing ? {
        avg_weekday_price: top_performer_pricing.pricing_summary.avg_weekday_price,
        avg_weekend_price: top_performer_pricing.pricing_summary.avg_weekend_price,
        price_range_low: top_performer_pricing.pricing_summary.price_range_low,
        price_range_high: top_performer_pricing.pricing_summary.price_range_high,
        weekend_premium_percent: top_performer_pricing.pricing_summary.weekend_premium_percent,
        days_of_data: top_performer_pricing.pricing_data.length
      } : undefined,
      rentalizer_comps: rentalizer_comps ? (() => {
        const comps = rentalizer_comps.comps;
        const superhostCount = comps.filter(c => c.superhost).length;
        const professionalCount = comps.filter(c => c.professionally_managed).length;
        const avgDistance = comps.reduce((sum, c) => sum + c.distance_meters, 0) / comps.length;
        const avgRevenue = comps.reduce((sum, c) => sum + c.annual_revenue, 0) / comps.length;
        const ratingsWithValue = comps.filter(c => c.rating !== null);
        const avgRating = ratingsWithValue.length > 0 ? ratingsWithValue.reduce((sum, c) => sum + (c.rating || 0), 0) / ratingsWithValue.length : 0;
        const avgReviews = comps.reduce((sum, c) => sum + c.reviews, 0) / comps.length;
        
        return {
          total_comps: comps.length,
          superhost_count: superhostCount,
          superhost_percentage: (superhostCount / comps.length) * 100,
          professional_count: professionalCount,
          professional_percentage: (professionalCount / comps.length) * 100,
          avg_distance_meters: avgDistance,
          avg_revenue: avgRevenue,
          avg_rating: avgRating,
          avg_reviews: avgReviews,
          top_comps: comps.slice(0, 8).map(c => ({
            title: c.title,
            bedrooms: c.bedrooms,
            annual_revenue: c.annual_revenue,
            rating: c.rating,
            reviews: c.reviews,
            distance_meters: c.distance_meters,
            superhost: c.superhost,
            professionally_managed: c.professionally_managed
          }))
        };
      })() : undefined,
      existing_listing_data: existing_listing_data,
      submarket_listings: submarket_listings ? {
        submarket_name: submarket_listings.submarket_name,
        total_listings: submarket_listings.total_listings,
        avg_revenue: submarket_listings.avg_revenue,
        avg_adr: submarket_listings.avg_adr,
        avg_occupancy: submarket_listings.avg_occupancy,
        top_listings: submarket_listings.top_listings.slice(0, 5).map(l => ({
          name: l.title || 'Unnamed Listing',
          bedrooms: l.bedrooms,
          annual_revenue: l.annual_revenue || 0,
          adr: l.adr || 0,
          occupancy: l.occupancy || 0,
          rating: l.rating || null
        }))
      } : undefined,
      qualifying_competitors: qualifying_competitors ? {
        qualifying_count: qualifying_competitors.qualifying_count,
        total_same_bedroom: qualifying_competitors.total_same_bedroom,
        qualification_rate: qualifying_competitors.qualification_rate,
        revenue_threshold: qualifying_competitors.revenue_threshold,
        avg_qualifying_revenue: qualifying_competitors.avg_qualifying_revenue,
        avg_qualifying_occupancy: qualifying_competitors.avg_qualifying_occupancy,
        avg_qualifying_adr: qualifying_competitors.avg_qualifying_adr,
        superhost_percentage: qualifying_competitors.superhost_percentage,
        professional_percentage: qualifying_competitors.professional_percentage,
        top_qualifiers: qualifying_competitors.top_qualifiers.slice(0, 5).map(l => ({
          title: l.title || 'Unnamed Listing',
          bedrooms: l.bedrooms,
          annual_revenue: l.annual_revenue,
          adr: l.adr,
          occupancy: l.occupancy,
          rating: l.rating,
          superhost: l.superhost || false,
          professionally_managed: l.professionally_managed || false
        }))
      } : undefined,
      radius_listings: radius_listings ? {
        total_count: radius_listings.total_count,
        radius_meters: radius_listings.radius_meters,
        listings_per_sqkm: radius_listings.listings_per_sqkm,
        avg_revenue: radius_listings.avg_revenue,
        avg_adr: radius_listings.avg_adr,
        avg_occupancy: radius_listings.avg_occupancy,
        superhost_percentage: radius_listings.superhost_percentage,
        professional_percentage: radius_listings.professional_percentage,
        same_bedroom_count: radius_listings.same_bedroom_count,
        top_nearby: radius_listings.top_nearby.slice(0, 5).map(l => ({
          title: l.title || 'Unnamed Listing',
          bedrooms: l.bedrooms,
          annual_revenue: l.annual_revenue,
          adr: l.adr,
          occupancy: l.occupancy,
          rating: l.rating,
          distance_meters: l.distance_meters
        }))
      } : undefined,
      market_saturation: market_saturation ? {
        total_listings: market_saturation.total_listings,
        same_bedroom_count: market_saturation.same_bedroom_count,
        bedroom_distribution: market_saturation.bedroom_distribution,
        revenue_percentiles: market_saturation.revenue_percentiles,
        avg_revenue: market_saturation.avg_revenue,
        avg_adr: market_saturation.avg_adr,
        avg_occupancy: market_saturation.avg_occupancy,
        superhost_percentage: market_saturation.superhost_percentage,
        professional_percentage: market_saturation.professional_percentage,
        market_concentration: market_saturation.market_concentration
      } : undefined,
      property_type_analysis: property_type_analysis ? {
        entire_home: property_type_analysis.entire_home,
        private_room: property_type_analysis.private_room,
        revenue_premium: property_type_analysis.revenue_premium,
        recommended_type: property_type_analysis.recommended_type,
        recommendation_reason: property_type_analysis.recommendation_reason
      } : undefined
    });
    
    console.log('[ArbitrageAnalysis] Narrative report generation complete');
    break; // Success, exit retry loop
  } catch (error: any) {
    console.error(`[ArbitrageAnalysis] Error generating narrative report (attempt ${attempt}/${MAX_RETRIES}):`, error?.message || error);
    
    if (attempt < MAX_RETRIES) {
      console.log(`[ArbitrageAnalysis] Retrying narrative report generation in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.error('[ArbitrageAnalysis] All narrative report generation attempts failed');
    }
  }
  }
  
  // Mark narrative complete, start enhanced report
  if (sessionId) progressTracker.completeStep(sessionId, 'narrative', 'Narrative report complete');
  if (sessionId) progressTracker.startStep(sessionId, 'enhanced', 'Creating enhanced insights...');
  
  // Step 21: Generate ENHANCED narrative report with better prompts and action items
  let enhanced_narrative_report: EnhancedNarrativeReport | undefined;
  
  try {
    console.log('[ArbitrageAnalysis] Generating enhanced narrative report...');
    
    // Get market name for the report
    const marketNameForEnhanced = property_estimate?.property?.market_id 
      ? (await getMarketDetails(property_estimate.property.market_id))?.name || 'Local Market'
      : 'Local Market';
    
    enhanced_narrative_report = await generateEnhancedNarrativeReport({
      address,
      monthly_rent,
      bedrooms: actualBedrooms,
      bathrooms: actualBathrooms,
      market_name: marketNameForEnhanced,
      market_occupancy: marketData?.market?.metrics?.occupancy || 0.65,
      market_adr: marketData?.market?.metrics?.adr || 150,
      active_listings: marketData?.market?.listing_count || competitors.length,
      revenue_low: percentiles.median,
      revenue_mid: percentiles.top_25_percent,
      revenue_high: percentiles.top_10_percent,
      monthly_expenses: profitability.monthly_expenses.total,
      annual_profit_conservative: profitability.scenarios.conservative.estimated_profit,
      annual_profit_realistic: profitability.scenarios.realistic.estimated_profit,
      annual_profit_optimistic: profitability.scenarios.optimistic.estimated_profit,
      competitors: competitors.slice(0, 8).map(c => ({
        name: c.name,
        annual_revenue: c.annual_revenue,
        occupancy: c.occupancy,
        adr: c.adr,
        rating: c.rating,
        reviews: c.reviews,
        airbnb_url: c.airbnb_url,
        success_factor: c.key_success_factor
      })),
      seasonality: seasonality.map(s => ({
        month: s.month,
        revenue: s.revenue,
        occupancy: s.occupancy,
        adr: s.adr,
        season_type: s.season_type
      })),
      five_year_summary: five_year_summary ? {
        years_of_data: five_year_summary.years_of_data,
        occupancy: {
          current_year_avg: five_year_summary.occupancy.current_year_avg,
          five_year_avg: five_year_summary.occupancy.five_year_avg,
          trend: five_year_summary.occupancy.trend,
          percent_change: five_year_summary.occupancy.percent_change
        },
        adr: {
          current_year_avg: five_year_summary.adr.current_year_avg,
          five_year_avg: five_year_summary.adr.five_year_avg,
          trend: five_year_summary.adr.trend,
          percent_change: five_year_summary.adr.percent_change
        },
        revenue: {
          current_year_avg: five_year_summary.revenue.current_year_avg,
          five_year_avg: five_year_summary.revenue.five_year_avg,
          trend: five_year_summary.revenue.trend,
          percent_change: five_year_summary.revenue.percent_change
        },
        market_maturity: five_year_summary.market_maturity
      } : undefined,
      supply_trend: supply_trend ? {
        current_listings: supply_trend.current_listings,
        net_change: supply_trend.net_change,
        percent_change: supply_trend.percent_change,
        trend: supply_trend.trend
      } : undefined,
      professional_stats: professional_host_stats ? {
        professional_percentage: professional_host_stats.professional_percentage,
        superhost_percentage: professional_host_stats.superhost_percentage,
        revenue_premium_percent: professional_host_stats.revenue_premium_percent
      } : undefined,
      booking_patterns: booking_patterns ? {
        avg_lead_time_days: booking_patterns.booking_lead_time.avg_days,
        avg_length_of_stay: booking_patterns.length_of_stay.avg_nights
      } : undefined,
      amenities: amenity_analysis?.slice(0, 10).map(a => ({
        amenity: a.amenity,
        percentage_of_top_performers: a.percentage_of_top_performers
      })),
      risks: ai_analysis?.risk_assessment?.risks?.slice(0, 5).map(r => ({
        category: r.category,
        description: r.description,
        severity: r.severity
      })),
      bedroom_performance: bedroom_performance,
      property_bedrooms: actualBedrooms
    });
    
    console.log('[ArbitrageAnalysis] Enhanced narrative report generation complete');
    if (sessionId) progressTracker.completeStep(sessionId, 'enhanced', 'Enhanced insights created');
  } catch (error: any) {
    console.error('[ArbitrageAnalysis] Error generating enhanced narrative report:', error?.message || error);
    if (sessionId) progressTracker.errorStep(sessionId, 'enhanced', 'Could not generate enhanced report');
    // Continue without enhanced report - the standard narrative report is still available
  }
  
  // Finalize progress
  if (sessionId) {
    progressTracker.startStep(sessionId, 'finalize', 'Finalizing your report...');
    progressTracker.completeStep(sessionId, 'finalize', 'Report complete!');
    // Clean up session after a delay to allow final progress to be sent
    setTimeout(() => progressTracker.endSession(sessionId), 5000);
  }
  
  return {
    report,
    percentiles,
    profitability,
    competitors,
    property_estimate,
    seasonality,
    booking_metrics,
    amenity_analysis,
    ai_analysis,
    photo_analysis,
    // NEW: Additional market intelligence
    booking_patterns,
    supply_trend,
    professional_host_stats,
    cancellation_policies,
    property_roi,
    regulations,
    // COMPREHENSIVE DATA
    market_seasonality,
    future_pricing,
    historical_trends,
    five_year_summary,
    // GEMINI HISTORICAL ANALYSIS
    historical_analysis,
    // COMPREHENSIVE NARRATIVE REPORT
    narrative_report,
    // ENHANCED NARRATIVE REPORT
    enhanced_narrative_report,
    // TOP PERFORMER COMPS
    top_performer_comps,
    // TOP PERFORMER PRICING
    top_performer_pricing: top_performer_pricing || undefined,
    // RENTALIZER COMPS
    rentalizer_comps: rentalizer_comps || undefined,
    // EXISTING LISTING DATA
    existing_listing_data,
    // SUBMARKET LISTINGS
    submarket_listings,
    // QUALIFYING COMPETITORS
    qualifying_competitors,
    // RADIUS LISTINGS
    radius_listings,
    // MARKET SATURATION
    market_saturation,
    // PROPERTY TYPE ANALYSIS
    property_type_analysis
  };
}

// ============================================
// NEIGHBORHOOD TIERING
// ============================================

export interface NeighborhoodTier {
  tier: 'Premier' | 'High-Occupancy' | 'Up-and-Coming' | 'Caution';
  name: string;
  revpar: number;
  occupancy: number;
  revenue: number;
  growth_signal: number;
  rationale: string;
}

export function tierNeighborhoods(submarkets: Array<{
  name: string;
  metrics?: {
    occupancy: number;
    adr: number;
    revenue: number;
    revpar: number;
  };
}>): NeighborhoodTier[] {
  if (!submarkets || submarkets.length === 0) return [];
  
  // Calculate averages for comparison
  const withMetrics = submarkets.filter(s => s.metrics);
  if (withMetrics.length === 0) return [];
  
  const avgRevpar = withMetrics.reduce((sum, s) => sum + (s.metrics?.revpar || 0), 0) / withMetrics.length;
  const avgOccupancy = withMetrics.reduce((sum, s) => sum + (s.metrics?.occupancy || 0), 0) / withMetrics.length;
  
  return withMetrics.map(submarket => {
    const metrics = submarket.metrics!;
    const revparRatio = metrics.revpar / avgRevpar;
    const occRatio = metrics.occupancy / avgOccupancy;
    
    let tier: NeighborhoodTier['tier'];
    let rationale: string;
    
    if (revparRatio >= 1.2 && occRatio >= 1.0) {
      tier = 'Premier';
      rationale = 'Top revenue per available night with strong occupancy - best all-around performer';
    } else if (occRatio >= 1.15) {
      tier = 'High-Occupancy';
      rationale = 'Consistently booked - reliable demand even if not highest revenue';
    } else if (revparRatio >= 0.9 && occRatio >= 0.9) {
      tier = 'Up-and-Coming';
      rationale = 'Solid fundamentals with room for growth';
    } else {
      tier = 'Caution';
      rationale = 'Below-average metrics - may indicate declining demand or oversaturation';
    }
    
    return {
      tier,
      name: submarket.name,
      revpar: metrics.revpar,
      occupancy: metrics.occupancy,
      revenue: metrics.revenue,
      growth_signal: revparRatio,
      rationale
    };
  }).sort((a, b) => {
    const tierOrder = { 'Premier': 0, 'High-Occupancy': 1, 'Up-and-Coming': 2, 'Caution': 3 };
    return tierOrder[a.tier] - tierOrder[b.tier];
  });
}

// ============================================
// SEASONALITY ANALYSIS
// ============================================

/**
 * Analyze seasonality from monthly forecast data
 */
export function analyzeSeasonality(monthlyForecast: Array<{
  month: string;
  revenue: number;
  occupancy: number;
  adr: number;
}>): SeasonalityData[] {
  if (!monthlyForecast || monthlyForecast.length === 0) return [];
  
  const avgRevenue = monthlyForecast.reduce((sum, m) => sum + m.revenue, 0) / monthlyForecast.length;
  
  return monthlyForecast.map(m => {
    let season_type: 'peak' | 'shoulder' | 'off';
    if (m.revenue > avgRevenue * 1.15) {
      season_type = 'peak';
    } else if (m.revenue < avgRevenue * 0.85) {
      season_type = 'off';
    } else {
      season_type = 'shoulder';
    }
    
    return {
      month: m.month,
      month_name: '', // Will be populated from date parsing
      revenue: m.revenue,
      occupancy: m.occupancy < 1 ? Math.round(m.occupancy * 100) : Math.round(m.occupancy),
      adr: Math.round(m.adr),
      season_type
    };
  });
}

/**
 * Calculate booking metrics from seasonality data
 */
export function calculateBookingMetrics(seasonality: SeasonalityData[]): BookingMetrics {
  const peakMonths = seasonality.filter(s => s.season_type === 'peak').map(s => s.month);
  const slowMonths = seasonality.filter(s => s.season_type === 'off').map(s => s.month);
  
  // Default booking metrics (these would come from AirDNA API if available)
  return {
    average_length_of_stay: 3.2, // nights - typical for vacation rentals
    booking_lead_time: 21, // days - typical advance booking
    peak_booking_months: peakMonths,
    slow_booking_months: slowMonths
  };
}

// ============================================
// AMENITY ANALYSIS
// ============================================

/**
 * Analyze amenities from top performers to identify what drives success
 */
export function analyzeAmenities(competitors: CompetitorAnalysis[]): AmenityAnalysis[] {
  if (!competitors || competitors.length === 0) return [];
  
  // Count amenity frequency among top performers
  const amenityCounts: Record<string, number> = {};
  const totalCompetitors = competitors.length;
  
  // Define key amenities to track
  const keyAmenities = [
    'pool', 'heated pool', 'hot tub', 'spa', 'jacuzzi',
    'game room', 'pool table', 'arcade',
    'outdoor kitchen', 'bbq', 'grill',
    'fire pit', 'fireplace',
    'gym', 'fitness',
    'theater', 'home theater', 'projector',
    'ev charger', 'electric vehicle',
    'pet friendly', 'pets allowed',
    'mountain view', 'ocean view', 'lake view', 'city view'
  ];
  
  // Analyze success factors to infer amenities
  competitors.forEach(comp => {
    const successFactor = comp.key_success_factor.toLowerCase();
    const name = comp.name.toLowerCase();
    
    // Pool detection
    if (successFactor.includes('pool') || name.includes('pool')) {
      amenityCounts['Pool'] = (amenityCounts['Pool'] || 0) + 1;
    }
    if (successFactor.includes('heated') || name.includes('heated')) {
      amenityCounts['Heated Pool'] = (amenityCounts['Heated Pool'] || 0) + 1;
    }
    
    // Hot tub detection
    if (successFactor.includes('hot tub') || successFactor.includes('spa') || 
        name.includes('hot tub') || name.includes('spa')) {
      amenityCounts['Hot Tub/Spa'] = (amenityCounts['Hot Tub/Spa'] || 0) + 1;
    }
    
    // Game room detection
    if (successFactor.includes('game') || name.includes('game') || 
        name.includes('arcade') || name.includes('pool table')) {
      amenityCounts['Game Room'] = (amenityCounts['Game Room'] || 0) + 1;
    }
    
    // Outdoor features
    if (successFactor.includes('outdoor') || name.includes('bbq') || 
        name.includes('grill') || name.includes('fire pit')) {
      amenityCounts['Outdoor Entertainment'] = (amenityCounts['Outdoor Entertainment'] || 0) + 1;
    }
    
    // Luxury indicators
    if (successFactor.includes('luxury') || successFactor.includes('premium') ||
        name.includes('luxury') || name.includes('luxe')) {
      amenityCounts['Luxury Finishes'] = (amenityCounts['Luxury Finishes'] || 0) + 1;
    }
    
    // Views
    if (name.includes('view') || name.includes('mountain') || 
        name.includes('ocean') || name.includes('lake')) {
      amenityCounts['Scenic Views'] = (amenityCounts['Scenic Views'] || 0) + 1;
    }
    
    // Location
    if (successFactor.includes('location') || name.includes('downtown') ||
        name.includes('old town') || name.includes('steps from')) {
      amenityCounts['Prime Location'] = (amenityCounts['Prime Location'] || 0) + 1;
    }
  });
  
  // Convert to analysis with recommendations
  const analysis: AmenityAnalysis[] = Object.entries(amenityCounts)
    .map(([amenity, count]) => {
      const percentage = Math.round((count / totalCompetitors) * 100);
      let revenue_impact: 'High' | 'Medium' | 'Low';
      let recommendation: string;
      
      if (percentage >= 60) {
        revenue_impact = 'High';
        recommendation = `Essential - ${percentage}% of top performers have this. Strongly consider adding.`;
      } else if (percentage >= 30) {
        revenue_impact = 'Medium';
        recommendation = `Valuable differentiator - ${percentage}% of top performers have this.`;
      } else {
        revenue_impact = 'Low';
        recommendation = `Nice to have - ${percentage}% of top performers have this.`;
      }
      
      return {
        amenity,
        percentage_of_top_performers: percentage,
        revenue_impact,
        recommendation
      };
    })
    .sort((a, b) => b.percentage_of_top_performers - a.percentage_of_top_performers);
  
  return analysis;
}

/**
 * Generate seasonality section for the report
 */
export function generateSeasonalitySection(seasonality: SeasonalityData[]): string {
  if (!seasonality || seasonality.length === 0) {
    return '';
  }
  
  const peakMonths = seasonality.filter(s => s.season_type === 'peak');
  const slowMonths = seasonality.filter(s => s.season_type === 'off');
  const avgRevenue = seasonality.reduce((sum, s) => sum + s.revenue, 0) / seasonality.length;
  
  let section = `
---

## Seasonality Analysis

Understanding when demand is high vs. low helps you price strategically and plan for cash flow.

### Monthly Revenue Forecast

| Month | Revenue | Occupancy | ADR | Season |
| :--- | ---: | ---: | ---: | :---: |
${seasonality.map(s => 
  `| ${s.month_name || s.month} | $${s.revenue.toLocaleString()} | ${s.occupancy}% | $${s.adr} | ${s.season_type === 'peak' ? '🔥 Peak' : s.season_type === 'off' ? '❄️ Slow' : '➡️ Shoulder'} |`
).join('\n')}

### What This Means for You

`;

  if (peakMonths.length > 0) {
    section += `**Peak Season (${peakMonths.map(p => p.month.split(' ')[0]).join(', ')}):** This is when you'll make the most money. Raise your prices 20-30% above your base rate. Book early guests at premium rates.\n\n`;
  }
  
  if (slowMonths.length > 0) {
    section += `**Slow Season (${slowMonths.map(s => s.month.split(' ')[0]).join(', ')}):** Expect lower bookings. Consider offering discounts for longer stays (7+ nights) or targeting different guest types (remote workers, snowbirds).\n\n`;
  }
  
  section += `**Average Monthly Revenue:** $${Math.round(avgRevenue).toLocaleString()} - Use this as your baseline for budgeting.`;
  
  return section;
}

/**
 * Generate amenity analysis section for the report
 */
export function generateAmenitySection(amenityAnalysis: AmenityAnalysis[]): string {
  if (!amenityAnalysis || amenityAnalysis.length === 0) {
    return '';
  }
  
  const highImpact = amenityAnalysis.filter(a => a.revenue_impact === 'High');
  const mediumImpact = amenityAnalysis.filter(a => a.revenue_impact === 'Medium');
  
  let section = `
---

## What Makes Top Performers Successful?

We analyzed the amenities and features of the highest-earning properties in this market. Here's what they have in common:

### Amenity Analysis

| Amenity | % of Top Performers | Impact | Recommendation |
| :--- | ---: | :---: | :--- |
${amenityAnalysis.slice(0, 8).map(a => 
  `| ${a.amenity} | ${a.percentage_of_top_performers}% | ${a.revenue_impact} | ${a.recommendation.split(' - ')[0]} |`
).join('\n')}

`;

  if (highImpact.length > 0) {
    section += `### Must-Have Features\n\nThese amenities appear in most top performers and significantly impact revenue:\n\n`;
    highImpact.forEach(a => {
      section += `- **${a.amenity}:** ${a.recommendation}\n`;
    });
    section += '\n';
  }
  
  if (mediumImpact.length > 0) {
    section += `### Valuable Differentiators\n\nThese features help properties stand out from the competition:\n\n`;
    mediumImpact.forEach(a => {
      section += `- **${a.amenity}:** ${a.recommendation}\n`;
    });
  }
  
  return section;
}

/**
 * Generate AI Analysis section for the report
 */
export function generateAIAnalysisSection(aiAnalysis: FullAIAnalysis): string {
  let section = `
---

## AI-Powered Investment Analysis

*This section was generated by our AI analyst using Gemini, synthesizing all the data above into actionable insights specific to YOUR property.*

### Executive Summary

${aiAnalysis.executive_summary}

---

### Investment Verdict

| Rating | Confidence | Summary |
| :---: | :---: | :--- |
| **${aiAnalysis.verdict.rating}** | ${aiAnalysis.verdict.confidence}/10 | ${aiAnalysis.verdict.summary} |

**Top Reasons:**
${aiAnalysis.verdict.top_reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

**Key Risk:** ${aiAnalysis.verdict.key_risk}

**Key Opportunity:** ${aiAnalysis.verdict.key_opportunity}

---

### Unique Insights for This Property

`;

  // Add insights
  aiAnalysis.insights.forEach((insight, i) => {
    section += `#### ${i + 1}. ${insight.title}\n\n`;
    section += `${insight.insight}\n\n`;
    section += `**Impact:** ${insight.impact} | **Action:** ${insight.action}\n\n`;
  });

  // Add competitor patterns
  if (aiAnalysis.competitor_patterns.length > 0) {
    section += `---\n\n### What Makes Winners Win\n\nOur AI analyzed your top competitors and identified these patterns:\n\n`;
    section += `| Pattern | Frequency | Revenue Impact | Recommendation |\n`;
    section += `| :--- | :--- | :--- | :--- |\n`;
    aiAnalysis.competitor_patterns.forEach(p => {
      section += `| ${p.pattern} | ${p.frequency} | ${p.revenue_impact} | ${p.recommendation} |\n`;
    });
    section += '\n';
  }

  // Add pricing strategy
  section += `---\n\n### Recommended Pricing Strategy\n\n`;
  section += `| Metric | Recommendation |\n`;
  section += `| :--- | :--- |\n`;
  section += `| **Base Rate** | $${aiAnalysis.pricing_strategy.base_rate}/night |\n`;
  section += `| **Peak Season Premium** | +${aiAnalysis.pricing_strategy.peak_premium_percent}% |\n`;
  section += `| **Slow Season Discount** | -${aiAnalysis.pricing_strategy.slow_discount_percent}% |\n`;
  section += `| **Weekend Premium** | +${aiAnalysis.pricing_strategy.weekend_premium_percent}% |\n`;
  section += `| **Min Stay (Peak)** | ${aiAnalysis.pricing_strategy.minimum_stay_peak} nights |\n`;
  section += `| **Min Stay (Slow)** | ${aiAnalysis.pricing_strategy.minimum_stay_slow} nights |\n`;
  section += `\n**Rationale:** ${aiAnalysis.pricing_strategy.pricing_rationale}\n\n`;

  // Add risk assessment
  section += `---\n\n### Risk Assessment\n\n`;
  section += `**Overall Risk Level:** ${aiAnalysis.risk_assessment.overall_risk}\n\n`;
  
  if (aiAnalysis.risk_assessment.risks.length > 0) {
    section += `**Risks to Watch:**\n\n`;
    section += `| Category | Risk | Severity | Mitigation |\n`;
    section += `| :--- | :--- | :---: | :--- |\n`;
    aiAnalysis.risk_assessment.risks.forEach(r => {
      section += `| ${r.category} | ${r.description} | ${r.severity} | ${r.mitigation} |\n`;
    });
    section += '\n';
  }
  
  if (aiAnalysis.risk_assessment.opportunities.length > 0) {
    section += `**Opportunities to Capture:**\n\n`;
    section += `| Category | Opportunity | Potential Impact | Action |\n`;
    section += `| :--- | :--- | :--- | :--- |\n`;
    aiAnalysis.risk_assessment.opportunities.forEach(o => {
      section += `| ${o.category} | ${o.description} | ${o.potential_impact} | ${o.action} |\n`;
    });
    section += '\n';
  }

  // Add action plan
  if (aiAnalysis.action_plan.length > 0) {
    section += `---\n\n### Your Action Plan\n\n`;
    section += `Here's a step-by-step roadmap to launch this property:\n\n`;
    
    aiAnalysis.action_plan.forEach((phase, i) => {
      section += `#### Phase ${i + 1}: ${phase.phase} (${phase.timeline})\n\n`;
      phase.tasks.forEach(task => {
        section += `- [ ] ${task}\n`;
      });
      if (phase.estimated_cost) {
        section += `\n**Estimated Cost:** ${phase.estimated_cost}\n`;
      }
      section += `\n**Expected Outcome:** ${phase.expected_outcome}\n\n`;
    });
  }

  section += `---\n\n*This AI analysis is based on real market data and is specific to this property. For personalized guidance on executing this plan, contact Coach Inayah's team.*\n`;

  return section;
}

/**
 * Generate Photo Analysis section for the report
 */
export function generatePhotoAnalysisSection(photoAnalysis: {
  competitor_photos: Array<{ name: string; imageUrl: string; analysis: PhotoAnalysis }>;
  design_insights: {
    common_themes: string[];
    design_recommendations: string[];
    must_have_shots: string[];
    differentiation_opportunities: string[];
  };
}): string {
  let section = `
---

## Visual Analysis: What Top Performers Look Like

*Our AI analyzed photos from your top competitors using Gemini Vision to identify design patterns that drive bookings.*

`;

  // Design themes
  if (photoAnalysis.design_insights.common_themes.length > 0) {
    section += `### Common Design Themes\n\n`;
    section += `The most successful listings in your market share these design approaches:\n\n`;
    photoAnalysis.design_insights.common_themes.forEach(theme => {
      section += `- **${theme}**\n`;
    });
    section += '\n';
  }

  // Individual photo analyses
  if (photoAnalysis.competitor_photos.length > 0) {
    section += `### Competitor Photo Analysis\n\n`;
    section += `| Listing | Design Theme | Quality | Guest Appeal |\n`;
    section += `| :--- | :--- | :---: | :--- |\n`;
    photoAnalysis.competitor_photos.forEach(p => {
      const cleanName = p.name.replace(/[\|\[\]]/g, '').substring(0, 35);
      section += `| ${cleanName} | ${p.analysis.design_theme} | ${p.analysis.quality_score}/10 | ${p.analysis.guest_appeal} |\n`;
    });
    section += '\n';
    
    // Strengths observed
    const allStrengths = photoAnalysis.competitor_photos.flatMap(p => p.analysis.strengths);
    const uniqueStrengths = Array.from(new Set(allStrengths)).slice(0, 5);
    if (uniqueStrengths.length > 0) {
      section += `### What Makes Their Photos Effective\n\n`;
      uniqueStrengths.forEach(s => {
        section += `- ${s}\n`;
      });
      section += '\n';
    }
    
    // Amenities visible in photos
    const allAmenities = photoAnalysis.competitor_photos.flatMap(p => p.analysis.amenities_visible);
    const uniqueAmenities = Array.from(new Set(allAmenities)).slice(0, 8);
    if (uniqueAmenities.length > 0) {
      section += `### Amenities Visible in Top Listings\n\n`;
      section += `These amenities appear prominently in competitor photos:\n\n`;
      uniqueAmenities.forEach(a => {
        section += `- ${a}\n`;
      });
      section += '\n';
    }
  }

  // Recommendations
  section += `### Your Photo Strategy\n\n`;
  
  section += `**Must-Have Shots:**\n`;
  photoAnalysis.design_insights.must_have_shots.forEach(shot => {
    section += `- [ ] ${shot}\n`;
  });
  section += '\n';
  
  if (photoAnalysis.design_insights.design_recommendations.length > 0) {
    section += `**Design Recommendations:**\n`;
    photoAnalysis.design_insights.design_recommendations.forEach(rec => {
      section += `- ${rec}\n`;
    });
    section += '\n';
  }
  
  if (photoAnalysis.design_insights.differentiation_opportunities.length > 0) {
    section += `**Differentiation Opportunities:**\n`;
    section += `Areas where you can stand out from competitors:\n\n`;
    photoAnalysis.design_insights.differentiation_opportunities.forEach(opp => {
      section += `- ${opp}\n`;
    });
  }

  return section;
}

// Export all functions for use in AI advisor
export const SOPReports = {
  calculateSOPProfitability,
  calculateMarketPercentiles,
  filterCompetitorsAboveThreshold,
  analyzeCompetitorSuccessFactors,
  generateSimplifiedReport,
  generateFullArbitrageAnalysis,
  tierNeighborhoods,
  analyzeSeasonality,
  calculateBookingMetrics,
  analyzeAmenities,
  generateSeasonalitySection,
  generateAmenitySection
};

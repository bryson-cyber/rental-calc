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
  ListingData,
  RentalizerResponse,
  ComprehensiveMarketReport
} from './airdna';

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
  annual_revenue: number;
  occupancy: number;
  adr: number;
  key_success_factor: string;
  amenities: string[];
  rating: number | null;
  reviews: number;
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

export interface SeasonalityData {
  month: string;
  revenue: number;
  occupancy: number;
  adr: number;
  season_type: 'Peak' | 'Shoulder' | 'Slow';
}

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
 * Filter competitors above minimum revenue threshold
 */
export function filterCompetitorsAboveThreshold(
  listings: ListingData[],
  monthly_rent: number
): ListingData[] {
  const threshold = monthly_rent * 12 * 2;
  return listings.filter(l => l.annual_revenue >= threshold);
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
    annual_revenue: listing.annual_revenue,
    occupancy: listing.occupancy,
    adr: listing.adr,
    key_success_factor,
    amenities,
    rating: listing.rating,
    reviews: listing.reviews
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
 */
export async function generateFullArbitrageAnalysis(
  address: string,
  monthly_rent: number,
  bedrooms?: number,
  bathrooms?: number,
  zillow_url?: string,
  attractive_features?: string[]
): Promise<{
  report: string;
  percentiles: MarketPercentiles;
  profitability: SOPProfitability;
  competitors: CompetitorAnalysis[];
  property_estimate: RentalizerResponse | null;
  seasonality: SeasonalityData[];
  booking_metrics: BookingMetrics;
  amenity_analysis: AmenityAnalysis[];
}> {
  // Step 1: Get property estimate from Rentalizer
  let property_estimate: RentalizerResponse | null = null;
  try {
    property_estimate = await getRentalizerEstimate({
      address,
      bedrooms,
      bathrooms
    });
  } catch (error) {
    console.error('Error getting Rentalizer estimate:', error);
  }
  
  // Use property estimate data or defaults
  const actualBedrooms = property_estimate?.property.bedrooms || bedrooms || 3;
  const actualBathrooms = property_estimate?.property.bathrooms || bathrooms || 2;
  const zipcode = property_estimate?.property.zipcode;
  
  // Step 2: Get market data and ALL available listings
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
        if (zipData.market?.id) {
          marketData = await getComprehensiveMarketReport(zipData.market.id);
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
  const percentiles = calculateMarketPercentiles(listings);
  
  // Step 4: Filter competitors above threshold and analyze - show ALL viable competitors
  const viableCompetitors = filterCompetitorsAboveThreshold(listings, monthly_rent);
  // Remove duplicates by title and show ALL viable competitors (not limited)
  const uniqueCompetitors = viableCompetitors.filter((comp, index, self) => 
    index === self.findIndex(c => c.title === comp.title || c.airbnb_url === comp.airbnb_url)
  );
  const competitors = uniqueCompetitors.map(analyzeCompetitorSuccessFactors);
  
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
  
  return {
    report,
    percentiles,
    profitability,
    competitors,
    property_estimate,
    seasonality,
    booking_metrics,
    amenity_analysis
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
    let season_type: 'Peak' | 'Shoulder' | 'Slow';
    if (m.revenue > avgRevenue * 1.15) {
      season_type = 'Peak';
    } else if (m.revenue < avgRevenue * 0.85) {
      season_type = 'Slow';
    } else {
      season_type = 'Shoulder';
    }
    
    return {
      month: m.month,
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
  const peakMonths = seasonality.filter(s => s.season_type === 'Peak').map(s => s.month);
  const slowMonths = seasonality.filter(s => s.season_type === 'Slow').map(s => s.month);
  
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
  
  const peakMonths = seasonality.filter(s => s.season_type === 'Peak');
  const slowMonths = seasonality.filter(s => s.season_type === 'Slow');
  const avgRevenue = seasonality.reduce((sum, s) => sum + s.revenue, 0) / seasonality.length;
  
  let section = `
---

## Seasonality Analysis

Understanding when demand is high vs. low helps you price strategically and plan for cash flow.

### Monthly Revenue Forecast

| Month | Revenue | Occupancy | ADR | Season |
| :--- | ---: | ---: | ---: | :---: |
${seasonality.map(s => 
  `| ${s.month} | $${s.revenue.toLocaleString()} | ${s.occupancy}% | $${s.adr} | ${s.season_type === 'Peak' ? '🔥 Peak' : s.season_type === 'Slow' ? '❄️ Slow' : '➡️ Shoulder'} |`
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

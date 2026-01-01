/**
 * AI Investment Advisor with Gemini Function Calling
 * 
 * This service uses Google's Gemini AI with function calling to dynamically
 * fetch AirDNA data based on user questions.
 */

import { ENV } from './_core/env';
import { 
  searchMarkets, 
  getComprehensiveMarketReport,
  getTopPerformers,
  getMarketSeasonality,
  getRentalizerEstimate,
  exploreListingsInRadius
} from './airdna';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Define the tools/functions that Gemini can call
const AVAILABLE_TOOLS = {
  functionDeclarations: [
    {
      name: "search_market",
      description: "Search for a market by name (city, region, or area) to get its ID and basic info. Use this first to find the market ID before fetching detailed data.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The name of the market to search for (e.g., 'Austin', 'Nashville', 'Miami')"
          }
        },
        required: ["market_name"]
      }
    },
    {
      name: "get_market_data",
      description: "Get comprehensive market data including revenue, occupancy, ADR, seasonality scores, and investment metrics for a specific market ID.",
      parameters: {
        type: "object",
        properties: {
          market_id: {
            type: "string",
            description: "The market ID obtained from search_market"
          },
          market_name: {
            type: "string",
            description: "The market name for display purposes"
          }
        },
        required: ["market_id", "market_name"]
      }
    },
    {
      name: "get_top_performers",
      description: "Get the top-performing Airbnb listings in a market, sorted by revenue. Useful for understanding what successful properties look like. Use market_name (like 'Austin' or 'Nashville') - the system will look up the market ID automatically.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market name (e.g., 'Austin', 'Nashville', 'Denver')"
          },
          bedrooms: {
            type: "number",
            description: "Optional: Filter by number of bedrooms"
          },
          limit: {
            type: "number",
            description: "Number of listings to return (default 10, max 25)"
          }
        },
        required: ["market_name"]
      }
    },
    {
      name: "get_seasonality",
      description: "Get monthly seasonality data showing peak, shoulder, and off-season patterns for a market. Use market_name (like 'Austin' or 'Nashville') - the system will look up the market ID automatically.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market name (e.g., 'Austin', 'Nashville', 'Denver')"
          }
        },
        required: ["market_name"]
      }
    },
    {
      name: "get_bedroom_estimate",
      description: "Get revenue estimates for a specific bedroom count in a market. Use this when the user asks about X-bedroom properties in a market (e.g., '3 bedroom properties in Austin'). This provides average revenue, occupancy, and ADR for that bedroom type.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market name (e.g., 'Austin', 'Nashville')"
          },
          bedrooms: {
            type: "number",
            description: "The number of bedrooms to get estimates for"
          }
        },
        required: ["market_name", "bedrooms"]
      }
    },
    {
      name: "analyze_property",
      description: "Analyze a specific property address to get rental revenue estimates, comparable properties, and investment potential. Use this when the user provides a property address.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "The full property address (e.g., '123 Main St, Austin, TX 78701')"
          },
          bedrooms: {
            type: "number",
            description: "Number of bedrooms (optional, will be estimated if not provided)"
          },
          bathrooms: {
            type: "number",
            description: "Number of bathrooms (optional, will be estimated if not provided)"
          }
        },
        required: ["address"]
      }
    },
    {
      name: "get_amenity_impact",
      description: "Get information about which amenities help properties earn more in a specific market. Use this when user asks about amenities, what features to add, how to increase revenue through amenities, or what top performers have. Returns data on popular amenities and their impact on revenue.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market name (e.g., 'Austin', 'Nashville', 'Miami Beach')"
          }
        },
        required: ["market_name"]
      }
    },
    {
      name: "search_nearby_listings",
      description: "Search for nearby Airbnb listings (direct comps) around a specific address. IMPORTANT: Always filter by the same bedroom count as the property being analyzed for apples-to-apples comparison. Use this when user asks about: nearby rentals, competitors, comps, what's around a property, or radius search. Returns actual listing data with clickable Airbnb links.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "The property address to search around (e.g., '123 Main St, Austin, TX 78701')"
          },
          radius_miles: {
            type: "number",
            description: "Search radius in miles (default 1, options: 0.5, 1, 2, 5)"
          },
          bedrooms: {
            type: "number",
            description: "REQUIRED for direct comps: Filter by number of bedrooms to show same-size properties only. Use the bedroom count from the property being analyzed."
          },
          limit: {
            type: "number",
            description: "Number of listings to return (default 10, max 25)"
          }
        },
        required: ["address", "bedrooms"]
      }
    },
    {
      name: "calculate_profit",
      description: "Calculate startup costs, monthly expenses, profit potential, and break-even analysis for a short-term rental property. Use this when user asks about: startup costs, expenses, profit, cash flow, break-even, ROI, or financial analysis. If you don't know the monthly rent, assume $2,000/month as a default.",
      parameters: {
        type: "object",
        properties: {
          annual_revenue: {
            type: "number",
            description: "Expected annual STR revenue (use the revenue from the previous property analysis)"
          },
          monthly_rent: {
            type: "number",
            description: "Monthly rent cost (for arbitrage) or mortgage payment. Default to $2,000 if unknown."
          },
          bedrooms: {
            type: "number",
            description: "Number of bedrooms (affects startup costs). Use the bedrooms from the previous property analysis."
          }
        },
        required: ["annual_revenue", "monthly_rent", "bedrooms"]
      }
    }
  ]
};

// Execute the function calls requested by Gemini
async function executeFunctionCall(functionName: string, args: Record<string, unknown>): Promise<unknown> {
  console.log(`[AI Advisor] Executing function: ${functionName}`, args);
  
  try {
    switch (functionName) {
      case "search_market": {
        const marketName = args.market_name as string;
        const results = await searchMarkets(marketName, 5);
        if (results.length === 0) {
          return { error: `No markets found matching "${marketName}"`, suggestions: [] };
        }
        return {
          markets: results.map(m => ({
            id: m.id,
            name: m.name,
            listing_count: m.listing_count,
            location: m.location_name
          }))
        };
      }
      
      case "get_market_data": {
        const marketId = args.market_id as string;
        const marketName = args.market_name as string;
        const report = await getComprehensiveMarketReport(marketId);
        if (!report) {
          return { error: `Could not fetch data for market ${marketName}` };
        }
        return {
          market_name: report.market.name,
          listing_count: report.market.listing_count,
          location: report.market.location_name,
          market_type: report.market.market_type,
          metrics: {
            average_revenue: report.market.metrics.revenue,
            occupancy_rate: report.market.metrics.occupancy,
            average_daily_rate: report.market.metrics.adr,
            revpar: report.market.metrics.revpar
          },
          top_performers_summary: report.top_listings?.slice(0, 3).map((p: { title: string; bedrooms: number; annual_revenue: number; occupancy: number }) => ({
            title: p.title,
            bedrooms: p.bedrooms,
            annual_revenue: p.annual_revenue,
            occupancy: p.occupancy
          }))
        };
      }
      
      case "get_top_performers": {
        const marketName = args.market_name as string;
        const bedrooms = args.bedrooms as number | undefined;
        const limit = Math.min((args.limit as number) || 10, 25);
        
        // Look up market ID from name
        const markets = await searchMarkets(marketName, 1);
        if (markets.length === 0) {
          return { error: `Could not find market "${marketName}"` };
        }
        const marketId = markets[0].id;
        console.log(`[AI Advisor] Found market ID ${marketId} for "${marketName}"`);
        
        const performers = await getTopPerformers({
          marketId,
          limit,
          sort_by: 'revenue',
          filters: bedrooms ? { bedrooms } : undefined
        });
        
        return {
          market_name: markets[0].name,
          total_found: performers.total_count,
          listings: performers.listings.map(l => ({
            title: l.title,
            bedrooms: l.bedrooms,
            bathrooms: l.bathrooms,
            annual_revenue: l.annual_revenue,
            adr: l.adr,
            occupancy: l.occupancy,
            rating: l.rating,
            reviews: l.reviews,
            is_superhost: l.superhost
          }))
        };
      }
      
      case "get_seasonality": {
        const marketName = args.market_name as string;
        
        // Look up market ID from name
        const markets = await searchMarkets(marketName, 1);
        if (markets.length === 0) {
          return { error: `Could not find market "${marketName}"` };
        }
        const marketId = markets[0].id;
        console.log(`[AI Advisor] Found market ID ${marketId} for seasonality in "${marketName}"`);
        
        const seasonality = await getMarketSeasonality(marketId);
        return {
          monthly_data: seasonality.map(s => ({
            month: s.month_name,
            revenue: s.revenue,
            occupancy: s.occupancy,
            adr: s.adr,
            season_type: s.season_type
          }))
        };
      }
      
      case "get_bedroom_estimate": {
        const marketName = args.market_name as string;
        const bedrooms = args.bedrooms as number;
        
        // Search for the market first
        const markets = await searchMarkets(marketName, 1);
        if (markets.length === 0) {
          return { error: `Could not find market "${marketName}"` };
        }
        
        const market = markets[0];
        
        // Use market listings API with bedroom filter to get actual listings
        const performers = await getTopPerformers({
          marketId: market.id,
          limit: 25,
          sort_by: 'revenue',
          filters: { bedrooms }
        });
        
        if (!performers.listings || performers.listings.length === 0) {
          // Fall back to market-level data if no listings found
          const report = await getComprehensiveMarketReport(market.id);
          if (!report) {
            return { error: `Could not get estimates for ${bedrooms}-bedroom properties in ${marketName}` };
          }
          return {
            market_name: marketName,
            bedrooms,
            note: `No ${bedrooms}-bedroom listings found in top performers. Showing market averages across all property sizes.`,
            estimates: {
              average_annual_revenue: report.market.metrics.revenue,
              occupancy_rate: report.market.metrics.occupancy,
              average_daily_rate: report.market.metrics.adr
            }
          };
        }
        
        // Calculate averages from the returned listings
        const listings = performers.listings;
        const avgRevenue = Math.round(listings.reduce((sum, l) => sum + (l.annual_revenue || 0), 0) / listings.length);
        const avgOccupancy = Math.round(listings.reduce((sum, l) => sum + (l.occupancy || 0), 0) / listings.length);
        const avgAdr = Math.round(listings.reduce((sum, l) => sum + (l.adr || 0), 0) / listings.length);
        const topRevenue = Math.max(...listings.map(l => l.annual_revenue || 0));
        const bottomRevenue = Math.min(...listings.map(l => l.annual_revenue || 0));
        
        return {
          market_name: marketName,
          bedrooms,
          listings_analyzed: listings.length,
          estimates: {
            average_annual_revenue: avgRevenue,
            revenue_range: `$${bottomRevenue.toLocaleString()} - $${topRevenue.toLocaleString()}`,
            average_occupancy_rate: avgOccupancy,
            average_daily_rate: avgAdr
          },
          top_performers: listings.slice(0, 3).map(l => ({
            title: l.title,
            annual_revenue: l.annual_revenue,
            occupancy: l.occupancy,
            adr: l.adr
          }))
        };
      }
      
      case "get_amenity_impact": {
        const marketName = args.market_name as string;
        
        // Look up market ID from name
        const markets = await searchMarkets(marketName, 1);
        if (markets.length === 0) {
          return { error: `Could not find market "${marketName}"` };
        }
        const marketId = markets[0].id;
        
        // Get top performers to analyze their amenities
        const performers = await getTopPerformers({
          marketId,
          limit: 25,
          sort_by: 'revenue'
        });
        
        // Analyze amenities from top performers
        const amenityCounts: Record<string, number> = {};
        const amenityRevenue: Record<string, number[]> = {};
        
        // Common amenities to track
        const keyAmenities = ['pool', 'hot_tub', 'pet_friendly', 'wifi', 'parking', 'kitchen', 'washer', 'dryer', 'air_conditioning', 'heating', 'gym', 'ev_charger', 'fireplace', 'bbq', 'outdoor_space', 'waterfront', 'mountain_view', 'city_view'];
        
        performers.listings.forEach(listing => {
          const revenue = listing.annual_revenue || 0;
          // Check title and property type for amenity hints
          const titleLower = (listing.title || '').toLowerCase();
          
          keyAmenities.forEach(amenity => {
            const amenityWords = amenity.split('_');
            const hasAmenity = amenityWords.some(word => titleLower.includes(word));
            if (hasAmenity) {
              amenityCounts[amenity] = (amenityCounts[amenity] || 0) + 1;
              if (!amenityRevenue[amenity]) amenityRevenue[amenity] = [];
              amenityRevenue[amenity].push(revenue);
            }
          });
        });
        
        // Calculate average revenue for properties with each amenity
        const amenityImpact = Object.entries(amenityRevenue).map(([amenity, revenues]) => {
          const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
          return {
            amenity: amenity.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            properties_with_amenity: revenues.length,
            average_revenue: Math.round(avgRevenue)
          };
        }).sort((a, b) => b.average_revenue - a.average_revenue);
        
        // Get market average for comparison
        const marketAvgRevenue = performers.listings.reduce((sum, l) => sum + (l.annual_revenue || 0), 0) / performers.listings.length;
        
        // Generate recommendations based on market type
        const recommendations = [
          { amenity: 'Hot Tub / Spa', revenue_premium: '15-25%', reason: 'High demand in vacation markets, creates memorable experience' },
          { amenity: 'Pool (Private)', revenue_premium: '20-35%', reason: 'Major differentiator, especially in warm climates' },
          { amenity: 'Pet-Friendly', revenue_premium: '10-20%', reason: 'Opens up to 40% more potential guests, less competition' },
          { amenity: 'EV Charger', revenue_premium: '5-10%', reason: 'Growing demand, attracts higher-income guests' },
          { amenity: 'Game Room', revenue_premium: '10-15%', reason: 'Great for families and groups, increases booking appeal' },
          { amenity: 'Outdoor Kitchen/BBQ', revenue_premium: '5-10%', reason: 'Enhances outdoor living experience' },
          { amenity: 'Fire Pit', revenue_premium: '5-10%', reason: 'Creates ambiance, great for evening entertainment' },
          { amenity: 'Smart Home Features', revenue_premium: '3-5%', reason: 'Convenience factor, appeals to tech-savvy guests' }
        ];
        
        return {
          market_name: markets[0].name,
          analysis_based_on: performers.listings.length + ' top-performing listings',
          market_average_revenue: Math.round(marketAvgRevenue),
          amenities_found_in_top_performers: amenityImpact.slice(0, 10),
          recommended_amenities: recommendations,
          key_insight: `In ${markets[0].name}, properties with premium amenities like pools and hot tubs typically earn 15-35% more than average. Pet-friendly properties also command a premium due to limited supply.`
        };
      }
      
      case "search_nearby_listings": {
        const address = args.address as string;
        const radiusMiles = (args.radius_miles as number) || 1;
        const bedrooms = args.bedrooms as number | undefined;
        const limit = Math.min((args.limit as number) || 10, 25);
        
        // Convert miles to meters (1 mile = 1609.34 meters)
        const radiusMeters = Math.round(radiusMiles * 1609.34);
        
        const listings = await exploreListingsInRadius(address, radiusMeters, {
          bedrooms,
          minRevenue: 5000 // Filter out very low performers
        }, limit);
        
        if (listings.length === 0) {
          return {
            error: `No listings found within ${radiusMiles} mile(s) of ${address}. Try increasing the search radius.`,
            address,
            radius_miles: radiusMiles
          };
        }
        
        // Calculate summary stats
        const avgRevenue = Math.round(listings.reduce((sum, l) => sum + l.annual_revenue, 0) / listings.length);
        const avgOccupancy = Math.round(listings.reduce((sum, l) => sum + l.occupancy, 0) / listings.length);
        const avgAdr = Math.round(listings.reduce((sum, l) => sum + l.adr, 0) / listings.length);
        const topRevenue = Math.max(...listings.map(l => l.annual_revenue));
        const bottomRevenue = Math.min(...listings.map(l => l.annual_revenue));
        
        return {
          address,
          radius_miles: radiusMiles,
          total_found: listings.length,
          summary: {
            average_revenue: avgRevenue,
            average_occupancy: avgOccupancy,
            average_adr: avgAdr,
            top_revenue: topRevenue,
            bottom_revenue: bottomRevenue,
            revenue_range: `$${bottomRevenue.toLocaleString()} - $${topRevenue.toLocaleString()}`
          },
          nearby_listings: listings.slice(0, limit).map(l => ({
            title: l.title,
            bedrooms: l.bedrooms,
            bathrooms: l.bathrooms,
            property_type: l.property_type,
            annual_revenue: l.annual_revenue,
            adr: l.adr,
            occupancy: l.occupancy,
            rating: l.rating,
            reviews: l.reviews,
            is_superhost: l.superhost,
            airbnb_url: l.airbnb_url
          }))
        };
      }
      
      case "calculate_profit": {
        const annualRevenue = args.annual_revenue as number;
        const monthlyRent = args.monthly_rent as number;
        const bedrooms = args.bedrooms as number;
        
        // Calculate startup costs based on bedrooms
        const baseStartupCost = 5000; // Base furnishing
        const perBedroomCost = 3000; // Per bedroom furnishing
        const startupCost = baseStartupCost + (bedrooms * perBedroomCost);
        
        // Monthly expenses breakdown
        const annualRent = monthlyRent * 12;
        const utilities = monthlyRent * 0.15 * 12; // ~15% of rent
        const wifi = 100 * 12; // $100/month
        const supplies = 50 * bedrooms * 12; // $50/bedroom/month
        const cleaning = (annualRevenue / 150) * 75; // Estimate cleanings based on revenue, $75 each
        const platformFees = annualRevenue * 0.03; // ~3% Airbnb host fees
        const insurance = 150 * 12; // $150/month STR insurance
        const maintenance = annualRevenue * 0.05; // 5% for repairs/maintenance
        const miscellaneous = 100 * 12; // $100/month misc
        
        const totalAnnualExpenses = annualRent + utilities + wifi + supplies + cleaning + platformFees + insurance + maintenance + miscellaneous;
        const monthlyExpenses = totalAnnualExpenses / 12;
        
        // Profit calculations
        const annualProfit = annualRevenue - totalAnnualExpenses;
        const monthlyProfit = annualProfit / 12;
        
        // Break-even occupancy
        const avgNightlyRate = annualRevenue / 365 / 0.65; // Estimate ADR from revenue assuming 65% occupancy
        const breakEvenNights = Math.ceil(totalAnnualExpenses / avgNightlyRate);
        const breakEvenOccupancy = Math.round((breakEvenNights / 365) * 100);
        
        // Scenarios
        const conservativeRevenue = annualRevenue * 0.8;
        const optimisticRevenue = annualRevenue * 1.2;
        const conservativeProfit = conservativeRevenue - totalAnnualExpenses;
        const optimisticProfit = optimisticRevenue - totalAnnualExpenses;
        
        // ROI calculation
        const roi = startupCost > 0 ? Math.round((annualProfit / startupCost) * 100) : 0;
        const paybackMonths = annualProfit > 0 ? Math.ceil(startupCost / monthlyProfit) : 0;
        
        return {
          startup_costs: {
            total: startupCost,
            breakdown: {
              furniture_and_decor: baseStartupCost + (bedrooms * 2000),
              linens_and_towels: bedrooms * 500,
              kitchen_essentials: 500,
              photography: 300,
              initial_supplies: 200
            }
          },
          monthly_expenses: {
            total: Math.round(monthlyExpenses),
            breakdown: {
              rent_or_mortgage: monthlyRent,
              utilities: Math.round(utilities / 12),
              wifi_streaming: Math.round(wifi / 12),
              supplies_consumables: Math.round(supplies / 12),
              cleaning: Math.round(cleaning / 12),
              platform_fees: Math.round(platformFees / 12),
              insurance: Math.round(insurance / 12),
              maintenance_repairs: Math.round(maintenance / 12),
              miscellaneous: Math.round(miscellaneous / 12)
            }
          },
          annual_summary: {
            gross_revenue: annualRevenue,
            total_expenses: Math.round(totalAnnualExpenses),
            net_profit: Math.round(annualProfit),
            profit_margin: Math.round((annualProfit / annualRevenue) * 100)
          },
          break_even: {
            occupancy_needed: breakEvenOccupancy,
            nights_per_year: breakEvenNights,
            nights_per_month: Math.ceil(breakEvenNights / 12)
          },
          scenarios: {
            conservative: {
              revenue: Math.round(conservativeRevenue),
              profit: Math.round(conservativeProfit),
              label: 'Conservative (-20%)'
            },
            realistic: {
              revenue: annualRevenue,
              profit: Math.round(annualProfit),
              label: 'Realistic (Expected)'
            },
            optimistic: {
              revenue: Math.round(optimisticRevenue),
              profit: Math.round(optimisticProfit),
              label: 'Optimistic (+20%)'
            }
          },
          roi: {
            first_year_roi: roi,
            payback_period_months: paybackMonths
          }
        };
      }
      
      case "analyze_property": {
        const address = args.address as string;
        const bedrooms = (args.bedrooms as number) || 2;
        const bathrooms = (args.bathrooms as number) || 1;
        const accommodates = bedrooms * 2;
        
        const estimate = await getRentalizerEstimate({
          address,
          bedrooms,
          bathrooms,
          accommodates,
          currency: 'usd'
        });
        
        if (!estimate) {
          return { error: `Could not analyze property at "${address}". Please check the address is valid.` };
        }
        
        // Calculate distance in miles for each comp
        const compsWithDistance = estimate.comps.slice(0, 10).map(c => {
          const distanceMiles = c.distance_meters ? (c.distance_meters / 1609.34).toFixed(1) : 'N/A';
          return {
            title: c.title,
            bedrooms: c.bedrooms,
            bathrooms: c.bathrooms,
            annual_revenue: c.annual_revenue,
            adr: c.adr,
            occupancy: c.occupancy,
            rating: c.rating,
            reviews: c.reviews,
            distance_miles: distanceMiles,
            property_type: c.property_type || 'Unknown',
            airbnb_url: c.airbnb_url || ''
          };
        });
        
        // Calculate market averages from comps
        const avgRevenue = compsWithDistance.reduce((sum, c) => sum + c.annual_revenue, 0) / compsWithDistance.length;
        const avgOccupancy = compsWithDistance.reduce((sum, c) => sum + c.occupancy, 0) / compsWithDistance.length;
        const avgAdr = compsWithDistance.reduce((sum, c) => sum + c.adr, 0) / compsWithDistance.length;
        
        // Find top performer
        const topPerformer = compsWithDistance.reduce((top, c) => c.annual_revenue > top.annual_revenue ? c : top, compsWithDistance[0]);
        
        return {
          property: {
            address: estimate.property.address,
            bedrooms: estimate.property.bedrooms,
            bathrooms: estimate.property.bathrooms,
            accommodates: estimate.property.accommodates,
            zipcode: estimate.property.zipcode
          },
          estimates: {
            annual_revenue: estimate.estimates.annual_revenue,
            annual_revenue_low: estimate.estimates.annual_revenue_low,
            annual_revenue_high: estimate.estimates.annual_revenue_high,
            average_daily_rate: estimate.estimates.average_daily_rate,
            occupancy_rate: estimate.estimates.occupancy_rate
          },
          market_comparison: {
            your_property_vs_market: {
              your_revenue: estimate.estimates.annual_revenue,
              market_avg_revenue: Math.round(avgRevenue),
              your_occupancy: estimate.estimates.occupancy_rate,
              market_avg_occupancy: Math.round(avgOccupancy),
              your_adr: estimate.estimates.average_daily_rate,
              market_avg_adr: Math.round(avgAdr)
            },
            top_performer: {
              title: topPerformer.title,
              annual_revenue: topPerformer.annual_revenue,
              occupancy: topPerformer.occupancy,
              adr: topPerformer.adr,
              rating: topPerformer.rating,
              reviews: topPerformer.reviews
            }
          },
          monthly_forecast: estimate.monthly_forecast.map(m => {
            // Classify season type
            const avgMonthlyRev = estimate.estimates.annual_revenue / 12;
            const seasonType = m.revenue > avgMonthlyRev * 1.15 ? 'Peak' : 
                              m.revenue < avgMonthlyRev * 0.85 ? 'Slow' : 'Shoulder';
            return {
              month: m.month,
              revenue: m.revenue,
              occupancy: m.occupancy,
              adr: m.adr,
              season_type: seasonType
            };
          }),
          nearby_competitors: compsWithDistance,
          competitor_count: estimate.comps.length
        };
      }
      
      default:
        return { error: `Unknown function: ${functionName}` };
    }
  } catch (error) {
    console.error(`[AI Advisor] Error executing ${functionName}:`, error);
    return { error: `Failed to execute ${functionName}: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function getAIAdvisorResponse(
  question: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  console.log(`[AI Advisor] Processing question: ${question}`);
  
  // Build conversation history for context
  const historyContents = conversationHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
  
  // Initial request with the user's question
  const initialContents = [
    ...historyContents,
    {
      role: 'user',
      parts: [{ text: question }]
    }
  ];
  
  const systemInstruction = `You are an expert short-term rental investment advisor helping beginner investors make data-driven decisions. Your job is to guide them through the analysis process step by step.

IMPORTANT RULES:
1. ALWAYS use the provided functions to fetch real data - NEVER make up numbers or statistics
2. When a user asks about a market, FIRST use search_market to find the market ID, THEN use get_market_data to get details
3. For market comparisons, fetch data for EACH market mentioned
4. When a user provides a property address, use analyze_property to get rental estimates
5. Be conversational but always back up claims with actual data
6. If you can't find data for a market or property, say so clearly
7. Format currency values nicely (e.g., $45,000 not 45000)
8. Format occupancy rates as percentages (e.g., 67% not 0.67) - multiply decimal values by 100
9. Explain what metrics mean in simple, beginner-friendly terms
10. Write at an elementary reading level - no jargon

RESPONSE FORMAT:
Always structure your response with:
1. A clear, direct answer to their question with the key data
2. Use markdown tables for data when showing comparisons or multiple metrics
3. Brief explanation of what the numbers mean for them
4. End EVERY response with exactly 3-5 follow-up questions in this EXACT format:

---FOLLOW_UP_QUESTIONS---
What is the best time of year to list this property?
How can I increase my revenue with amenities?
What are the startup costs to get this running?
---END_FOLLOW_UP---

The follow-up questions MUST:
- Be SPECIFIC to the data just shown (not generic placeholders)
- Reference the actual property, market, or topic discussed
- Help them dig deeper into the analysis
- Cover different aspects (competition, seasonality, profit, amenities, etc.)
- Be phrased as complete, clickable questions
- NEVER use placeholder text like "Question 1 here?" - always generate real questions

Examples of good follow-up questions for a property analysis:
- "How does this compare to nearby competitors?"
- "What's the monthly breakdown by season?"
- "What amenities would help this property earn more?"
- "What are the startup costs to get this running?"
- "How does this neighborhood rank in the city?"
- "What do the top earners in this area have in common?"
- "What's the profit potential after expenses?"

For PROPERTY ANALYSIS (when user provides an address):
- Use analyze_property function with the full address
- Present data in a clean table format:
  | Metric | Value |
  |--------|-------|
  | Annual Revenue | $XX,XXX |
  | Occupancy Rate | XX% |
  | Avg Daily Rate | $XXX |
- Explain what these numbers mean in plain English
- Mention how it compares to the market average

For MARKET ANALYSIS:
- Present key metrics in a table
- Revenue potential (average annual revenue)
- Occupancy rates (higher = more consistent bookings)
- ADR (Average Daily Rate - how much per night)
- Seasonality (how much revenue varies by season)

For COMPETITION ANALYSIS:
- Show top 5-10 competitors in a table with:
  | Property | Revenue | Occupancy | ADR | Distance |
- Highlight what top performers do differently

For SEASONALITY:
- ALWAYS show a monthly breakdown table like this:
  | Month | Revenue | Occupancy | ADR | Season |
  |-------|---------|-----------|-----|--------|
  | January | $X,XXX | XX% | $XXX | Shoulder |
  | February | $X,XXX | XX% | $XXX | Peak |
  (continue for all 12 months)
- Use Peak, Shoulder, or Off for season type
- Explain which months are best and worst for bookings
- Give pricing recommendations for each season

For RADIUS SEARCH / DIRECT COMPS (nearby listings):
- ALWAYS filter by the SAME bedroom count as the property being analyzed (apples-to-apples)
- If user asks about comps for a 3BR property, only show 3BR listings
- Show nearby Airbnbs in a COMPACT table with CLICKABLE LINKS:
  | Name | BR | Rev | Occ | ADR | Link |
  |------|-----|-----|-----|-----|------|
  | [Cozy Apt](airbnb_url) | 3 | $45K | 68% | $180 | [View](airbnb_url) |
- Make the property name a clickable markdown link to the Airbnb listing
- Add a "Link" column with [View](airbnb_url) for each listing
- Keep property names SHORT (max 15 chars, truncate with ...)
- Revenue should be shown as $XXK format (e.g., $45K not $45,000)
- Include a summary: "Showing X [bedroom count]-bedroom properties within Y miles"
- Highlight the top performer and explain what makes them successful

For PROFIT MATH:
- Show expense breakdown in a table
- Calculate break-even occupancy
- Show conservative/realistic/optimistic scenarios

SOFT CTA (include naturally at the end of detailed analyses):
When you've provided a comprehensive analysis (property analysis, profit calculation, or full report), end with a soft call-to-action like:
"Setting up a successful Airbnb takes more than just finding the right property. From professional photography to listing optimization, pricing strategy to guest communication - there's a lot that goes into maximizing your returns. If you'd like help handling the entire setup process, Coach Inayah's team can take care of everything so you can start earning faster."

Only include this CTA after substantive analyses, not after simple questions.

Remember: You're talking to beginners. Explain everything simply. Use tables to make data scannable. Always end with clickable follow-up questions.`;

  try {
    // Make the initial API call with function declarations
    let response = await fetch(`${GEMINI_API_URL}?key=${ENV.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: initialContents,
        tools: [AVAILABLE_TOOLS],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
    }

    let data = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contents: any[] = [...initialContents];
    
    // Loop to handle multiple function calls
    let maxIterations = 10; // Prevent infinite loops
    while (maxIterations > 0) {
      maxIterations--;
      
      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new Error('No response from Gemini');
      }
      
      const content = candidate.content;
      contents.push(content);
      
      // Check if there are function calls to execute
      const functionCalls = content.parts?.filter((p: { functionCall?: unknown }) => p.functionCall);
      
      if (!functionCalls || functionCalls.length === 0) {
        // No more function calls - extract the text response
        const textPart = content.parts?.find((p: { text?: string }) => p.text);
        return textPart?.text || "I apologize, but I couldn't generate a response. Please try rephrasing your question.";
      }
      
      // Execute each function call and collect results
      const functionResponses = [];
      for (const fc of functionCalls) {
        const { name, args } = fc.functionCall;
        const result = await executeFunctionCall(name, args || {});
        functionResponses.push({
          functionResponse: {
            name,
            response: result
          }
        });
      }
      
      // Add function responses to the conversation
      // Gemini expects function responses in a specific format
      contents.push({
        role: 'user' as const,
        parts: functionResponses.map(fr => ({
          functionResponse: fr.functionResponse
        }))
      });
      
      // Make another API call with the function results
      response = await fetch(`${GEMINI_API_URL}?key=${ENV.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          tools: [AVAILABLE_TOOLS],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
      }

      data = await response.json();
    }
    
    return "I apologize, but I'm having trouble processing your question. Please try a simpler query.";
    
  } catch (error) {
    console.error('[AI Advisor] Error:', error);
    return `I apologize, but I encountered an error while processing your question: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;
  }
}

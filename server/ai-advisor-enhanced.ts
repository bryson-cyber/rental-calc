/**
 * Enhanced AI Investment Advisor with Advanced Gemini Features
 * 
 * This module extends the base AI advisor with:
 * - Multi-market comparison and synthesis
 * - Cross-property analysis
 * - Advanced scenario modeling
 * - Sophisticated market intelligence
 * - Investment decision framework
 */

import { ENV } from './_core/env';
import { 
  searchMarkets, 
  getComprehensiveMarketReport,
  getTopPerformers,
  getMarketSeasonality,
  getRentalizerEstimate,
  exploreListingsInRadius,
  searchByZipcode,
  getCountryMarkets,
  exploreSubmarketsWithMetrics,
  calculateArbitrageFeasibility,
  getMarketDetails,
  getSubmarketDetails,
  type CountryMarket,
} from './airdna';
import { makeRequest, GeocodingResult } from './_core/map';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ============================================
// ENHANCED FUNCTION DECLARATIONS
// ============================================

export const ENHANCED_TOOLS = {
  functionDeclarations: [
    // ============================================
    // EXISTING FUNCTIONS (Enhanced)
    // ============================================
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
      description: "Get the top-performing Airbnb listings in a market, sorted by revenue. Useful for understanding what successful properties look like.",
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
      description: "Get monthly seasonality data showing peak, shoulder, and off-season patterns for a market.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market name (e.g., 'Austin', 'Nashville', 'Atlanta')"
          }
        },
        required: ["market_name"]
      }
    },
    {
      name: "analyze_property",
      description: "Analyze a specific property address to get rental revenue estimates, comparable properties, and investment potential.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "The full property address (e.g., '123 Main St, Austin, TX 78701')"
          },
          bedrooms: {
            type: "number",
            description: "Number of bedrooms (optional)"
          },
          bathrooms: {
            type: "number",
            description: "Number of bathrooms (optional)"
          }
        },
        required: ["address"]
      }
    },
    {
      name: "search_nearby_listings",
      description: "Search for nearby Airbnb listings around a specific address. Always filter by same bedroom count for apples-to-apples comparison.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "The property address to search around"
          },
          radius_miles: {
            type: "number",
            description: "Search radius in miles (default 1, options: 0.5, 1, 2, 5)"
          },
          bedrooms: {
            type: "number",
            description: "Filter by number of bedrooms for direct comps"
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
      description: "Calculate startup costs, monthly expenses, profit potential, and break-even analysis for a short-term rental property.",
      parameters: {
        type: "object",
        properties: {
          annual_revenue: {
            type: "number",
            description: "Expected annual STR revenue"
          },
          monthly_rent: {
            type: "number",
            description: "Monthly rent cost (for arbitrage) or mortgage payment"
          },
          bedrooms: {
            type: "number",
            description: "Number of bedrooms (affects startup costs)"
          }
        },
        required: ["annual_revenue", "monthly_rent", "bedrooms"]
      }
    },
    {
      name: "search_by_zipcode",
      description: "Search for short-term rental market data by US zip code. Pass filter selections for accurate filtered results.",
      parameters: {
        type: "object",
        properties: {
          zipcode: {
            type: "string",
            description: "The 5-digit US zip code"
          },
          bedrooms: {
            type: "number",
            description: "Filter by number of bedrooms"
          },
          bathrooms: {
            type: "number",
            description: "Filter by minimum bathrooms"
          },
          property_type: {
            type: "string",
            description: "Filter by property type: house, apartment, condominium, townhouse"
          },
          has_pool: { type: "boolean", description: "Filter for properties with a pool" },
          has_hot_tub: { type: "boolean", description: "Filter for properties with a hot tub" },
          pet_friendly: { type: "boolean", description: "Filter for pet-friendly properties" },
          superhost: { type: "boolean", description: "Filter for Superhost properties only" }
        },
        required: ["zipcode"]
      }
    },
    {
      name: "calculate_investment_score",
      description: "Calculate an investment score (1-100) for a property or market based on revenue potential, occupancy rates, competition, and seasonality.",
      parameters: {
        type: "object",
        properties: {
          annual_revenue: { type: "number", description: "Expected annual revenue" },
          occupancy_rate: { type: "number", description: "Occupancy rate as percentage" },
          adr: { type: "number", description: "Average daily rate" },
          competition_count: { type: "number", description: "Number of competing listings" },
          market_name: { type: "string", description: "Name of the market" }
        },
        required: ["annual_revenue", "occupancy_rate", "adr"]
      }
    },
    {
      name: "calculate_amenity_impact",
      description: "Calculate the revenue impact of adding specific amenities (pool, hot tub, extra bedroom, etc.) to a property.",
      parameters: {
        type: "object",
        properties: {
          base_revenue: { type: "number", description: "Current or projected annual revenue" },
          amenity_type: { type: "string", description: "The amenity: 'pool', 'hot_tub', 'extra_bedroom', 'game_room', 'outdoor_kitchen', 'ev_charger'" },
          market_type: { type: "string", description: "Market type: 'beach', 'mountain', 'urban', 'suburban', 'lake', 'desert'" },
          current_bedrooms: { type: "number", description: "Current number of bedrooms" }
        },
        required: ["base_revenue", "amenity_type"]
      }
    },
    {
      name: "find_markets_for_budget",
      description: "Find the best STR markets for a given investment budget.",
      parameters: {
        type: "object",
        properties: {
          budget: { type: "number", description: "Total investment budget in dollars" },
          investment_type: { type: "string", description: "'purchase' or 'arbitrage'" },
          preferred_region: { type: "string", description: "Region: 'southeast', 'southwest', 'midwest', 'northeast', 'west_coast', 'any'" }
        },
        required: ["budget", "investment_type"]
      }
    },
    
    // ============================================
    // NEW ADVANCED FUNCTIONS
    // ============================================
    
    {
      name: "compare_multiple_markets",
      description: "Compare 2-5 markets side-by-side with detailed metrics, scores, and investment recommendations. Use this when user wants to compare cities or decide between markets.",
      parameters: {
        type: "object",
        properties: {
          market_names: {
            type: "array",
            items: { type: "string" },
            description: "Array of 2-5 market names to compare (e.g., ['Austin', 'Nashville', 'Denver'])"
          },
          comparison_focus: {
            type: "string",
            description: "What to prioritize: 'revenue' (highest earning), 'stability' (consistent occupancy), 'growth' (emerging markets), 'entry_cost' (affordable entry), 'balanced' (overall best)"
          },
          bedrooms: {
            type: "number",
            description: "Optional: Compare performance for specific bedroom count"
          }
        },
        required: ["market_names"]
      }
    },
    
    {
      name: "analyze_market_submarkets",
      description: "Deep dive into a market's neighborhoods/submarkets to find the best areas to invest. Shows ranking by revenue, occupancy, and overall score.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market name to explore (e.g., 'Atlanta', 'Nashville')"
          },
          sort_by: {
            type: "string",
            description: "How to rank submarkets: 'revenue', 'occupancy', 'revpar', 'overall'"
          },
          limit: {
            type: "number",
            description: "Number of submarkets to return (default 10)"
          }
        },
        required: ["market_name"]
      }
    },
    
    {
      name: "find_top_markets_nationwide",
      description: "Find the best STR markets in the US based on specific criteria. Use this for market discovery and identifying opportunities.",
      parameters: {
        type: "object",
        properties: {
          criteria: {
            type: "string",
            description: "What to optimize for: 'market_score' (overall best), 'investability' (best for investors), 'rental_demand' (highest demand), 'revenue_growth' (fastest growing), 'regulation' (STR-friendly)"
          },
          market_type: {
            type: "string",
            description: "Optional filter: 'coastal', 'urban_metro', 'mountains_lakes', 'suburban', 'rural', 'mid_size_city'"
          },
          min_score: {
            type: "number",
            description: "Minimum score threshold (0-100)"
          },
          limit: {
            type: "number",
            description: "Number of markets to return (default 10, max 25)"
          }
        },
        required: ["criteria"]
      }
    },
    
    {
      name: "analyze_arbitrage_feasibility",
      description: "Comprehensive rental arbitrage analysis for a property. Calculates profitability, break-even, risk assessment, and provides recommendation.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "The property address"
          },
          monthly_rent: {
            type: "number",
            description: "The monthly rent amount"
          },
          bedrooms: {
            type: "number",
            description: "Number of bedrooms"
          },
          bathrooms: {
            type: "number",
            description: "Number of bathrooms"
          }
        },
        required: ["address", "monthly_rent"]
      }
    },
    
    {
      name: "compare_property_configurations",
      description: "Compare different bedroom configurations in the same market to find the optimal property size. Shows revenue, occupancy, and ROI by bedroom count.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market to analyze"
          },
          bedroom_range: {
            type: "array",
            items: { type: "number" },
            description: "Array of bedroom counts to compare (e.g., [2, 3, 4, 5])"
          }
        },
        required: ["market_name", "bedroom_range"]
      }
    },
    
    {
      name: "analyze_competition_landscape",
      description: "Deep analysis of the competitive landscape in a market or around a property. Identifies gaps, opportunities, and success patterns.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market to analyze (use this OR address)"
          },
          address: {
            type: "string",
            description: "Property address for hyperlocal analysis (use this OR market_name)"
          },
          bedrooms: {
            type: "number",
            description: "Focus on specific bedroom count"
          },
          analysis_depth: {
            type: "string",
            description: "'quick' (top 10), 'standard' (top 25), 'deep' (comprehensive)"
          }
        },
        required: []
      }
    },
    
    {
      name: "generate_investment_thesis",
      description: "Generate a comprehensive investment thesis for a specific property or market. Synthesizes all available data into actionable recommendations.",
      parameters: {
        type: "object",
        properties: {
          target_type: {
            type: "string",
            description: "'property' or 'market'"
          },
          target: {
            type: "string",
            description: "Property address or market name"
          },
          investor_profile: {
            type: "string",
            description: "'conservative' (low risk), 'moderate' (balanced), 'aggressive' (high growth)"
          },
          investment_type: {
            type: "string",
            description: "'arbitrage' or 'purchase'"
          },
          budget: {
            type: "number",
            description: "Investment budget (optional)"
          }
        },
        required: ["target_type", "target"]
      }
    },
    
    {
      name: "calculate_scenario_analysis",
      description: "Run multiple what-if scenarios for an investment. Shows outcomes under different conditions (occupancy changes, rate changes, expense variations).",
      parameters: {
        type: "object",
        properties: {
          base_revenue: {
            type: "number",
            description: "Expected annual revenue"
          },
          base_occupancy: {
            type: "number",
            description: "Expected occupancy rate (%)"
          },
          base_adr: {
            type: "number",
            description: "Expected average daily rate"
          },
          monthly_costs: {
            type: "number",
            description: "Monthly fixed costs (rent/mortgage + utilities)"
          },
          scenarios: {
            type: "array",
            items: { type: "string" },
            description: "Scenarios to model: 'recession', 'competition_increase', 'seasonality_shift', 'rate_war', 'best_case', 'worst_case'"
          }
        },
        required: ["base_revenue", "monthly_costs"]
      }
    },
    
    {
      name: "identify_market_gaps",
      description: "Identify underserved niches and opportunities in a market. Finds gaps in property types, amenities, or price points.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market to analyze"
          },
          focus_areas: {
            type: "array",
            items: { type: "string" },
            description: "Areas to analyze: 'property_type', 'bedroom_count', 'amenities', 'price_tier', 'guest_type'"
          }
        },
        required: ["market_name"]
      }
    },
    
    {
      name: "get_bedroom_performance_breakdown",
      description: "Get detailed performance metrics broken down by bedroom count for a market. Shows which property sizes perform best.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market to analyze"
          }
        },
        required: ["market_name"]
      }
    }
  ]
};

// ============================================
// ENHANCED FUNCTION EXECUTION
// ============================================

export async function executeEnhancedFunction(functionName: string, args: Record<string, unknown>): Promise<unknown> {
  console.log(`[Enhanced AI Advisor] Executing function: ${functionName}`, args);
  
  try {
    switch (functionName) {
      // ============================================
      // NEW ADVANCED FUNCTIONS
      // ============================================
      
      case "compare_multiple_markets": {
        const marketNames = args.market_names as string[];
        const focus = (args.comparison_focus as string) || 'balanced';
        const bedrooms = args.bedrooms as number | undefined;
        
        if (marketNames.length < 2 || marketNames.length > 5) {
          return { error: "Please provide 2-5 markets to compare" };
        }
        
        // Fetch data for all markets in parallel
        const marketDataPromises = marketNames.map(async (name) => {
          const markets = await searchMarkets(name, 1);
          if (markets.length === 0) return null;
          
          const report = await getComprehensiveMarketReport(markets[0].id);
          if (!report) return null;
          
          // Get bedroom-specific data if requested
          let bedroomData = null;
          if (bedrooms) {
            const performers = await getTopPerformers({
              marketId: markets[0].id,
              limit: 25,
              sort_by: 'revenue',
              filters: { bedrooms }
            });
            if (performers.listings.length > 0) {
              const avgRevenue = performers.listings.reduce((sum, l) => sum + l.annual_revenue, 0) / performers.listings.length;
              const avgOccupancy = performers.listings.reduce((sum, l) => sum + l.occupancy, 0) / performers.listings.length;
              const avgAdr = performers.listings.reduce((sum, l) => sum + l.adr, 0) / performers.listings.length;
              bedroomData = {
                bedrooms,
                avg_revenue: Math.round(avgRevenue),
                avg_occupancy: Math.round(avgOccupancy),
                avg_adr: Math.round(avgAdr),
                sample_size: performers.listings.length
              };
            }
          }
          
          return {
            name: report.market.name,
            id: markets[0].id,
            listing_count: report.market.listing_count,
            market_type: report.market.market_type,
            metrics: report.market.metrics,
            bedroom_specific: bedroomData
          };
        });
        
        const marketData = (await Promise.all(marketDataPromises)).filter(m => m !== null);
        
        if (marketData.length < 2) {
          return { error: "Could not fetch data for enough markets. Please check market names." };
        }
        
        // Calculate rankings based on focus
        const rankings = calculateMarketRankings(marketData, focus);
        
        return {
          comparison_focus: focus,
          markets_compared: marketData.length,
          markets: marketData.map((m, i) => ({
            ...m,
            rank: rankings[i].rank,
            score: rankings[i].score,
            strengths: rankings[i].strengths,
            weaknesses: rankings[i].weaknesses
          })),
          recommendation: generateComparisonRecommendation(marketData, rankings, focus),
          winner: rankings[0].name
        };
      }
      
      case "analyze_market_submarkets": {
        const marketName = args.market_name as string;
        const sortBy = (args.sort_by as 'revenue' | 'occupancy' | 'revpar' | 'overall') || 'overall';
        const limit = Math.min((args.limit as number) || 10, 15);
        
        // Find market ID
        const markets = await searchMarkets(marketName, 1);
        if (markets.length === 0) {
          return { error: `Could not find market "${marketName}"` };
        }
        
        const result = await exploreSubmarketsWithMetrics(markets[0].id, { sortBy, limit });
        
        // Handle case where result or market is missing
        if (!result || !result.market) {
          // Fallback: return basic market info
          const report = await getComprehensiveMarketReport(markets[0].id);
          return {
            market_name: markets[0].name,
            market_metrics: report?.market?.metrics || { revenue: 0, occupancy: 0, adr: 0 },
            submarkets_found: 0,
            submarkets: [],
            top_recommendation: null,
            note: 'Submarket data not available for this market. Try analyzing the main market instead.'
          };
        }
        
        return {
          market_name: result.market.name,
          market_metrics: result.market.metrics,
          submarkets_found: result.submarkets?.length || 0,
          submarkets: (result.submarkets || []).map(s => ({
            name: s.name,
            listing_count: s.listing_count,
            metrics: s.metrics,
            ranking: s.ranking,
            recommendation: generateSubmarketRecommendation(s, result.market.metrics)
          })),
          top_recommendation: result.topRecommendation ? {
            name: result.topRecommendation.name,
            reason: `Best overall score with ${result.topRecommendation.metrics.revenue > result.market.metrics.revenue ? 'above-market' : 'competitive'} revenue and ${result.topRecommendation.metrics.occupancy > result.market.metrics.occupancy ? 'strong' : 'stable'} occupancy`
          } : null
        };
      }
      
      case "find_top_markets_nationwide": {
        const criteria = args.criteria as string;
        const marketType = args.market_type as string | undefined;
        const minScore = (args.min_score as number) || 60;
        const limit = Math.min((args.limit as number) || 10, 25);
        
        const sortByMap: Record<string, 'market_score' | 'investability' | 'rental_demand' | 'revenue_growth' | 'seasonality' | 'regulation'> = {
          'market_score': 'market_score',
          'investability': 'investability',
          'rental_demand': 'rental_demand',
          'revenue_growth': 'revenue_growth',
          'regulation': 'regulation'
        };
        
        const result = await getCountryMarkets('us', {
          limit,
          sort_by: sortByMap[criteria] || 'market_score',
          sort_direction: 'desc',
          market_type: marketType as any,
          min_market_score: criteria === 'market_score' ? minScore : undefined,
          min_investability: criteria === 'investability' ? minScore : undefined,
          min_rental_demand: criteria === 'rental_demand' ? minScore : undefined,
          min_revenue_growth: criteria === 'revenue_growth' ? minScore : undefined,
          min_regulation: criteria === 'regulation' ? minScore : undefined
        });
        
        // Handle case where result or markets is missing
        if (!result || !result.markets) {
          return {
            criteria,
            market_type_filter: marketType || 'all',
            min_score: minScore,
            total_markets_matching: 0,
            top_markets: [],
            note: 'Could not fetch nationwide market data. Please try again.'
          };
        }
        
        return {
          criteria,
          market_type_filter: marketType || 'all',
          min_score: minScore,
          total_markets_matching: result.total_count || result.markets.length,
          top_markets: result.markets.map((m, i) => ({
            rank: i + 1,
            name: m.name,
            state: m.location?.state || 'Unknown',
            market_type: m.market_type || 'Unknown',
            listing_count: m.listing_count || 0,
            scores: m.scores || { market_score: 0 },
            metrics: m.metrics || {},
            investment_grade: getInvestmentGrade(m.scores?.market_score || 0)
          }))
        };
      }
      
      case "analyze_arbitrage_feasibility": {
        const address = args.address as string;
        const monthlyRent = args.monthly_rent as number;
        const bedrooms = args.bedrooms as number | undefined;
        const bathrooms = args.bathrooms as number | undefined;
        
        const result = await calculateArbitrageFeasibility(address, monthlyRent, bedrooms, bathrooms);
        
        if (!result) {
          return { error: `Could not analyze property at "${address}". Please check the address.` };
        }
        
        return {
          property: result.property,
          projections: result.projections,
          risk_assessment: result.risk_assessment,
          recommendation: result.recommendation,
          key_metrics: {
            monthly_profit: Math.round(result.projections.projected_monthly_profit),
            annual_profit: Math.round(result.projections.projected_annual_profit),
            roi_percentage: Math.round(result.projections.roi_percentage),
            break_even_occupancy: Math.round(result.projections.break_even_occupancy),
            revenue_to_rent_ratio: Math.round(result.projections.annual_str_revenue / (monthlyRent * 12) * 100) / 100
          },
          verdict: result.projections.projected_annual_profit > 0 ? 
            (result.projections.roi_percentage > 50 ? 'STRONG_BUY' : 
             result.projections.roi_percentage > 20 ? 'BUY' : 'HOLD') : 'AVOID'
        };
      }
      
      case "compare_property_configurations": {
        const marketName = args.market_name as string;
        const bedroomRange = args.bedroom_range as number[];
        
        // Find market ID
        const markets = await searchMarkets(marketName, 1);
        if (markets.length === 0) {
          return { error: `Could not find market "${marketName}"` };
        }
        
        // Fetch data for each bedroom count
        const configDataPromises = bedroomRange.map(async (bedrooms) => {
          const performers = await getTopPerformers({
            marketId: markets[0].id,
            limit: 25,
            sort_by: 'revenue',
            filters: { bedrooms }
          });
          
          if (performers.listings.length === 0) {
            return { bedrooms, data: null };
          }
          
          const listings = performers.listings;
          const avgRevenue = listings.reduce((sum, l) => sum + l.annual_revenue, 0) / listings.length;
          const avgOccupancy = listings.reduce((sum, l) => sum + l.occupancy, 0) / listings.length;
          const avgAdr = listings.reduce((sum, l) => sum + l.adr, 0) / listings.length;
          const topRevenue = Math.max(...listings.map(l => l.annual_revenue));
          const bottomRevenue = Math.min(...listings.map(l => l.annual_revenue));
          
          return {
            bedrooms,
            data: {
              sample_size: listings.length,
              avg_revenue: Math.round(avgRevenue),
              avg_occupancy: Math.round(avgOccupancy),
              avg_adr: Math.round(avgAdr),
              revenue_range: { min: bottomRevenue, max: topRevenue },
              top_performer: {
                title: listings[0].title,
                revenue: listings[0].annual_revenue,
                occupancy: listings[0].occupancy
              }
            }
          };
        });
        
        const configData = await Promise.all(configDataPromises);
        const validConfigs = configData.filter(c => c.data !== null);
        
        // Find optimal configuration
        const optimal = validConfigs.reduce((best, current) => {
          if (!best.data) return current;
          if (!current.data) return best;
          // Score based on revenue and occupancy
          const bestScore = best.data.avg_revenue * (best.data.avg_occupancy / 100);
          const currentScore = current.data.avg_revenue * (current.data.avg_occupancy / 100);
          return currentScore > bestScore ? current : best;
        });
        
        return {
          market_name: markets[0].name,
          configurations: configData,
          optimal_configuration: {
            bedrooms: optimal.bedrooms,
            reason: `${optimal.bedrooms}BR properties offer the best balance of revenue ($${optimal.data?.avg_revenue?.toLocaleString()}) and occupancy (${optimal.data?.avg_occupancy}%)`
          },
          analysis: generateConfigurationAnalysis(configData)
        };
      }
      
      case "analyze_competition_landscape": {
        const marketName = args.market_name as string | undefined;
        const address = args.address as string | undefined;
        const bedrooms = args.bedrooms as number | undefined;
        const depth = (args.analysis_depth as string) || 'standard';
        
        const limit = depth === 'quick' ? 10 : depth === 'deep' ? 50 : 25;
        
        let listings: any[] = [];
        let contextName = '';
        
        if (address) {
          // Hyperlocal analysis
          const radiusMeters = depth === 'deep' ? 3218 : 1609; // 2 miles or 1 mile
          const result = await exploreListingsInRadius(address, radiusMeters, { bedrooms }, limit);
          listings = result;
          contextName = `within ${depth === 'deep' ? '2' : '1'} mile(s) of ${address}`;
        } else if (marketName) {
          // Market-wide analysis
          const markets = await searchMarkets(marketName, 1);
          if (markets.length === 0) {
            return { error: `Could not find market "${marketName}"` };
          }
          const result = await getTopPerformers({
            marketId: markets[0].id,
            limit,
            sort_by: 'revenue',
            filters: bedrooms ? { bedrooms } : undefined
          });
          listings = result.listings;
          contextName = marketName;
        } else {
          return { error: "Please provide either market_name or address" };
        }
        
        if (listings.length === 0) {
          return { error: `No listings found ${contextName}` };
        }
        
        // Analyze competition patterns
        const analysis = analyzeCompetitionPatterns(listings);
        
        return {
          context: contextName,
          total_competitors: listings.length,
          bedroom_filter: bedrooms || 'all',
          analysis_depth: depth,
          market_overview: {
            avg_revenue: analysis.avgRevenue,
            avg_occupancy: analysis.avgOccupancy,
            avg_adr: analysis.avgAdr,
            revenue_spread: analysis.revenueSpread
          },
          success_patterns: analysis.successPatterns,
          gaps_and_opportunities: analysis.gaps,
          competitive_positioning: analysis.positioning,
          top_competitors: listings.slice(0, 5).map(l => ({
            title: l.title,
            revenue: l.annual_revenue,
            occupancy: l.occupancy,
            adr: l.adr,
            rating: l.rating,
            superhost: l.superhost,
            airbnb_url: l.airbnb_url
          }))
        };
      }
      
      case "generate_investment_thesis": {
        const targetType = args.target_type as string;
        const target = args.target as string;
        const investorProfile = (args.investor_profile as string) || 'moderate';
        const investmentType = (args.investment_type as string) || 'arbitrage';
        const budget = args.budget as number | undefined;
        
        let data: any = {};
        
        if (targetType === 'property') {
          // Get property analysis
          const estimate = await getRentalizerEstimate({ address: target });
          if (!estimate) {
            return { error: `Could not analyze property at "${target}"` };
          }
          
          // Get nearby competitors
          const comps = await exploreListingsInRadius(target, 1609, { bedrooms: estimate.property.bedrooms }, 10);
          
          data = {
            type: 'property',
            property: estimate.property,
            estimates: estimate.estimates,
            monthly_forecast: estimate.monthly_forecast,
            competitors: comps.slice(0, 5),
            competitor_count: comps.length
          };
        } else {
          // Get market analysis
          const markets = await searchMarkets(target, 1);
          if (markets.length === 0) {
            return { error: `Could not find market "${target}"` };
          }
          
          const report = await getComprehensiveMarketReport(markets[0].id);
          if (!report) {
            return { error: `Could not fetch data for market "${target}"` };
          }
          
          const seasonality = await getMarketSeasonality(markets[0].id);
          
          data = {
            type: 'market',
            market: report.market,
            seasonality,
            top_performers: report.top_listings?.slice(0, 5)
          };
        }
        
        // Generate thesis based on data and investor profile
        const thesis = generateInvestmentThesis(data, investorProfile, investmentType, budget);
        
        return {
          target_type: targetType,
          target,
          investor_profile: investorProfile,
          investment_type: investmentType,
          budget: budget || 'not specified',
          data_summary: data,
          thesis: thesis.summary,
          key_points: thesis.keyPoints,
          risks: thesis.risks,
          opportunities: thesis.opportunities,
          action_items: thesis.actionItems,
          confidence_level: thesis.confidence,
          recommendation: thesis.recommendation
        };
      }
      
      case "calculate_scenario_analysis": {
        const baseRevenue = args.base_revenue as number;
        const baseOccupancy = (args.base_occupancy as number) || 65;
        const baseAdr = (args.base_adr as number) || Math.round(baseRevenue / 365 / (baseOccupancy / 100));
        const monthlyCosts = args.monthly_costs as number;
        const scenarios = (args.scenarios as string[]) || ['best_case', 'worst_case', 'recession'];
        
        const annualCosts = monthlyCosts * 12;
        const operatingExpenses = baseRevenue * 0.30;
        const baseProfit = baseRevenue - annualCosts - operatingExpenses;
        
        const scenarioResults: Record<string, any> = {
          baseline: {
            revenue: baseRevenue,
            occupancy: baseOccupancy,
            adr: baseAdr,
            profit: Math.round(baseProfit),
            roi: Math.round((baseProfit / annualCosts) * 100)
          }
        };
        
        scenarios.forEach(scenario => {
          let multipliers = { revenue: 1, occupancy: 1, adr: 1, expenses: 1 };
          let description = '';
          
          switch (scenario) {
            case 'recession':
              multipliers = { revenue: 0.75, occupancy: 0.85, adr: 0.88, expenses: 1.05 };
              description = 'Economic downturn: 25% revenue drop, lower demand';
              break;
            case 'competition_increase':
              multipliers = { revenue: 0.85, occupancy: 0.90, adr: 0.95, expenses: 1 };
              description = '20% more competitors enter market';
              break;
            case 'seasonality_shift':
              multipliers = { revenue: 0.90, occupancy: 0.88, adr: 1.02, expenses: 1 };
              description = 'Demand shifts to different seasons';
              break;
            case 'rate_war':
              multipliers = { revenue: 0.80, occupancy: 1.05, adr: 0.76, expenses: 1 };
              description = 'Competitors slash prices, occupancy up but ADR down';
              break;
            case 'best_case':
              multipliers = { revenue: 1.25, occupancy: 1.10, adr: 1.14, expenses: 0.95 };
              description = 'Superhost status, premium pricing, high demand';
              break;
            case 'worst_case':
              multipliers = { revenue: 0.60, occupancy: 0.70, adr: 0.86, expenses: 1.15 };
              description = 'Multiple negative factors combine';
              break;
          }
          
          const scenarioRevenue = baseRevenue * multipliers.revenue;
          const scenarioExpenses = operatingExpenses * multipliers.expenses;
          const scenarioProfit = scenarioRevenue - annualCosts - scenarioExpenses;
          
          scenarioResults[scenario] = {
            description,
            revenue: Math.round(scenarioRevenue),
            occupancy: Math.round(baseOccupancy * multipliers.occupancy),
            adr: Math.round(baseAdr * multipliers.adr),
            profit: Math.round(scenarioProfit),
            roi: Math.round((scenarioProfit / annualCosts) * 100),
            vs_baseline: {
              revenue_change: Math.round((multipliers.revenue - 1) * 100),
              profit_change: Math.round(((scenarioProfit - baseProfit) / baseProfit) * 100)
            },
            viable: scenarioProfit > 0
          };
        });
        
        // Calculate break-even point
        const breakEvenOccupancy = Math.round((annualCosts + operatingExpenses) / (baseAdr * 365) * 100);
        
        return {
          base_assumptions: {
            annual_revenue: baseRevenue,
            monthly_costs: monthlyCosts,
            operating_expenses: Math.round(operatingExpenses),
            occupancy: baseOccupancy,
            adr: baseAdr
          },
          scenarios: scenarioResults,
          break_even: {
            occupancy_needed: breakEvenOccupancy,
            buffer_from_baseline: baseOccupancy - breakEvenOccupancy
          },
          risk_summary: {
            worst_case_viable: scenarioResults['worst_case']?.viable ?? true,
            recession_viable: scenarioResults['recession']?.viable ?? true,
            scenarios_profitable: Object.values(scenarioResults).filter((s: any) => s.viable !== false).length,
            total_scenarios: Object.keys(scenarioResults).length
          }
        };
      }
      
      case "identify_market_gaps": {
        const marketName = args.market_name as string;
        const focusAreas = (args.focus_areas as string[]) || ['property_type', 'bedroom_count', 'amenities'];
        
        // Find market ID
        const markets = await searchMarkets(marketName, 1);
        if (markets.length === 0) {
          return { error: `Could not find market "${marketName}"` };
        }
        
        // Get top performers for analysis
        const performers = await getTopPerformers({
          marketId: markets[0].id,
          limit: 50,
          sort_by: 'revenue'
        });
        
        const gaps: Record<string, any> = {};
        
        if (focusAreas.includes('bedroom_count')) {
          const bedroomDist = analyzeBedroomDistribution(performers.listings);
          gaps.bedroom_count = {
            distribution: bedroomDist.distribution,
            underserved: bedroomDist.underserved,
            opportunity: bedroomDist.opportunity
          };
        }
        
        if (focusAreas.includes('property_type')) {
          const typeDist = analyzePropertyTypeDistribution(performers.listings);
          gaps.property_type = {
            distribution: typeDist.distribution,
            underserved: typeDist.underserved,
            opportunity: typeDist.opportunity
          };
        }
        
        if (focusAreas.includes('amenities')) {
          const amenityAnalysis = analyzeAmenityGaps(performers.listings);
          gaps.amenities = {
            common_in_top_performers: amenityAnalysis.common,
            missing_opportunities: amenityAnalysis.missing,
            differentiators: amenityAnalysis.differentiators
          };
        }
        
        if (focusAreas.includes('price_tier')) {
          const priceTiers = analyzePriceTiers(performers.listings);
          gaps.price_tier = {
            distribution: priceTiers.distribution,
            sweet_spot: priceTiers.sweetSpot,
            opportunity: priceTiers.opportunity
          };
        }
        
        return {
          market_name: markets[0].name,
          listings_analyzed: performers.listings.length,
          focus_areas: focusAreas,
          gaps_identified: gaps,
          top_opportunities: generateTopOpportunities(gaps),
          action_items: generateGapActionItems(gaps)
        };
      }
      
      case "get_bedroom_performance_breakdown": {
        const marketName = args.market_name as string;
        
        // Find market ID
        const markets = await searchMarkets(marketName, 1);
        if (markets.length === 0) {
          return { error: `Could not find market "${marketName}"` };
        }
        
        // Fetch data for bedroom counts 1-6
        const bedroomData = await Promise.all(
          [1, 2, 3, 4, 5, 6].map(async (bedrooms) => {
            const performers = await getTopPerformers({
              marketId: markets[0].id,
              limit: 25,
              sort_by: 'revenue',
              filters: { bedrooms }
            });
            
            if (performers.listings.length === 0) {
              return { bedrooms, data: null };
            }
            
            const listings = performers.listings;
            return {
              bedrooms,
              data: {
                count: listings.length,
                avg_revenue: Math.round(listings.reduce((s, l) => s + l.annual_revenue, 0) / listings.length),
                avg_occupancy: Math.round(listings.reduce((s, l) => s + l.occupancy, 0) / listings.length),
                avg_adr: Math.round(listings.reduce((s, l) => s + l.adr, 0) / listings.length),
                top_revenue: Math.max(...listings.map(l => l.annual_revenue)),
                avg_rating: Math.round(listings.reduce((s, l) => s + (l.rating || 0), 0) / listings.length * 10) / 10
              }
            };
          })
        );
        
        const validData = bedroomData.filter(b => b.data !== null);
        
        // Find best performing bedroom count
        const best = validData.reduce((best, current) => {
          if (!best.data) return current;
          if (!current.data) return best;
          return current.data.avg_revenue > best.data.avg_revenue ? current : best;
        });
        
        return {
          market_name: markets[0].name,
          breakdown: bedroomData,
          best_performing: {
            bedrooms: best.bedrooms,
            avg_revenue: best.data?.avg_revenue,
            reason: `${best.bedrooms}BR properties have the highest average revenue at $${best.data?.avg_revenue?.toLocaleString()}`
          },
          insights: generateBedroomInsights(bedroomData)
        };
      }
      
      default:
        return { error: `Unknown function: ${functionName}` };
    }
  } catch (error) {
    console.error(`[Enhanced AI Advisor] Error executing ${functionName}:`, error);
    return { error: `Failed to execute ${functionName}: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateMarketRankings(markets: any[], focus: string): any[] {
  const weights = {
    balanced: { revenue: 0.3, occupancy: 0.25, adr: 0.2, score: 0.25 },
    revenue: { revenue: 0.5, occupancy: 0.2, adr: 0.2, score: 0.1 },
    stability: { revenue: 0.2, occupancy: 0.5, adr: 0.1, score: 0.2 },
    growth: { revenue: 0.2, occupancy: 0.2, adr: 0.2, score: 0.4 },
    entry_cost: { revenue: 0.3, occupancy: 0.3, adr: 0.1, score: 0.3 }
  };
  
  const w = weights[focus as keyof typeof weights] || weights.balanced;
  
  return markets.map(m => {
    const revenueScore = Math.min(m.metrics.revenue / 100000 * 100, 100);
    const occupancyScore = m.metrics.occupancy;
    const adrScore = Math.min(m.metrics.adr / 300 * 100, 100);
    const marketScore = m.metrics.market_score || 70;
    
    const totalScore = 
      revenueScore * w.revenue +
      occupancyScore * w.occupancy +
      adrScore * w.adr +
      marketScore * w.score;
    
    const strengths = [];
    const weaknesses = [];
    
    if (m.metrics.revenue > 60000) strengths.push('High revenue potential');
    else if (m.metrics.revenue < 40000) weaknesses.push('Lower revenue potential');
    
    if (m.metrics.occupancy > 65) strengths.push('Strong occupancy');
    else if (m.metrics.occupancy < 55) weaknesses.push('Lower occupancy');
    
    if (m.metrics.adr > 200) strengths.push('Premium pricing power');
    else if (m.metrics.adr < 150) weaknesses.push('Lower ADR');
    
    return {
      name: m.name,
      score: Math.round(totalScore),
      rank: 0,
      strengths,
      weaknesses
    };
  }).sort((a, b) => b.score - a.score).map((m, i) => ({ ...m, rank: i + 1 }));
}

function generateComparisonRecommendation(markets: any[], rankings: any[], focus: string): string {
  const winner = rankings[0];
  const runnerUp = rankings[1];
  
  return `Based on ${focus} criteria, **${winner.name}** is the top choice with a score of ${winner.score}/100. ` +
    `Key strengths: ${winner.strengths.join(', ') || 'balanced performance'}. ` +
    `${runnerUp.name} is a close second (${runnerUp.score}/100) and may be better if you prioritize ${runnerUp.strengths[0] || 'different factors'}.`;
}

function generateSubmarketRecommendation(submarket: any, marketMetrics: any): string {
  const revDiff = ((submarket.metrics.revenue - marketMetrics.revenue) / marketMetrics.revenue * 100).toFixed(0);
  const occDiff = ((submarket.metrics.occupancy - marketMetrics.occupancy) / marketMetrics.occupancy * 100).toFixed(0);
  
  if (parseInt(revDiff) > 10 && parseInt(occDiff) > 5) {
    return 'HIGHLY RECOMMENDED - Above-market revenue and occupancy';
  } else if (parseInt(revDiff) > 0 || parseInt(occDiff) > 0) {
    return 'RECOMMENDED - Competitive metrics';
  } else {
    return 'CONSIDER - Below market average, may have lower competition';
  }
}

function getInvestmentGrade(score: number): string {
  if (score >= 80) return 'A - Excellent';
  if (score >= 70) return 'B - Good';
  if (score >= 60) return 'C - Average';
  if (score >= 50) return 'D - Below Average';
  return 'F - Poor';
}

function analyzeCompetitionPatterns(listings: any[]): any {
  const avgRevenue = Math.round(listings.reduce((s, l) => s + l.annual_revenue, 0) / listings.length);
  const avgOccupancy = Math.round(listings.reduce((s, l) => s + l.occupancy, 0) / listings.length);
  const avgAdr = Math.round(listings.reduce((s, l) => s + l.adr, 0) / listings.length);
  
  const revenues = listings.map(l => l.annual_revenue);
  const revenueSpread = {
    min: Math.min(...revenues),
    max: Math.max(...revenues),
    median: revenues.sort((a, b) => a - b)[Math.floor(revenues.length / 2)]
  };
  
  // Analyze success patterns
  const topPerformers = listings.slice(0, Math.ceil(listings.length * 0.2));
  const superhostRate = topPerformers.filter(l => l.superhost).length / topPerformers.length * 100;
  const avgTopRating = topPerformers.reduce((s, l) => s + (l.rating || 0), 0) / topPerformers.length;
  
  const successPatterns = [];
  if (superhostRate > 50) successPatterns.push(`${Math.round(superhostRate)}% of top performers are Superhosts`);
  if (avgTopRating > 4.8) successPatterns.push(`Top performers average ${avgTopRating.toFixed(1)}★ rating`);
  
  const gaps = [];
  if (listings.filter(l => l.bedrooms === 1).length < listings.length * 0.1) {
    gaps.push('Studio/1BR properties are underrepresented');
  }
  if (listings.filter(l => l.bedrooms >= 5).length < listings.length * 0.1) {
    gaps.push('Large properties (5+ BR) are scarce');
  }
  
  return {
    avgRevenue,
    avgOccupancy,
    avgAdr,
    revenueSpread,
    successPatterns,
    gaps,
    positioning: {
      premium_threshold: Math.round(avgAdr * 1.2),
      budget_threshold: Math.round(avgAdr * 0.8),
      target_occupancy: avgOccupancy + 5
    }
  };
}

function generateInvestmentThesis(data: any, profile: string, investmentType: string, budget?: number): any {
  const isProperty = data.type === 'property';
  
  const keyPoints = [];
  const risks = [];
  const opportunities = [];
  const actionItems = [];
  
  if (isProperty) {
    const revenue = data.estimates.annual_revenue;
    const occupancy = data.estimates.occupancy_rate;
    
    keyPoints.push(`Projected annual revenue: $${revenue.toLocaleString()}`);
    keyPoints.push(`Expected occupancy: ${occupancy}%`);
    keyPoints.push(`${data.competitor_count} direct competitors within 1 mile`);
    
    if (occupancy > 65) opportunities.push('Above-average occupancy indicates strong demand');
    else risks.push('Below-average occupancy may indicate weak demand');
    
    if (data.competitors.length > 0) {
      const avgCompRevenue = data.competitors.reduce((s: number, c: any) => s + c.annual_revenue, 0) / data.competitors.length;
      if (revenue > avgCompRevenue) opportunities.push('Revenue projection exceeds local competition');
      else risks.push('Revenue projection below local competition average');
    }
    
    actionItems.push('Verify property details and condition');
    actionItems.push('Analyze top competitor listings for differentiation ideas');
    actionItems.push('Calculate detailed P&L with actual rent/mortgage');
  } else {
    const metrics = data.market.metrics;
    
    keyPoints.push(`Market average revenue: $${metrics.revenue.toLocaleString()}`);
    keyPoints.push(`Market occupancy: ${metrics.occupancy}%`);
    keyPoints.push(`${data.market.listing_count.toLocaleString()} active listings`);
    
    if (metrics.occupancy > 65) opportunities.push('Strong market demand');
    if (metrics.market_score > 70) opportunities.push('High market score indicates good investment potential');
    
    if (data.market.listing_count > 5000) risks.push('High competition with many listings');
    
    actionItems.push('Identify specific neighborhoods within this market');
    actionItems.push('Analyze bedroom configurations for optimal entry');
    actionItems.push('Research local STR regulations');
  }
  
  // Adjust based on investor profile
  if (profile === 'conservative') {
    risks.push('Consider starting with lower-risk property type');
    actionItems.push('Build 6-month cash reserve before launching');
  } else if (profile === 'aggressive') {
    opportunities.push('Consider premium positioning for higher ADR');
    actionItems.push('Explore multiple property acquisitions');
  }
  
  const confidence = calculateConfidence(data, profile);
  
  return {
    summary: generateThesisSummary(data, profile, investmentType, confidence),
    keyPoints,
    risks,
    opportunities,
    actionItems,
    confidence,
    recommendation: confidence >= 70 ? 'PROCEED' : confidence >= 50 ? 'PROCEED WITH CAUTION' : 'RECONSIDER'
  };
}

function calculateConfidence(data: any, profile: string): number {
  let score = 60; // Base score
  
  if (data.type === 'property') {
    if (data.estimates.occupancy_rate > 65) score += 10;
    if (data.competitor_count < 20) score += 5;
    if (data.estimates.annual_revenue > 50000) score += 10;
  } else {
    if (data.market.metrics.occupancy > 65) score += 10;
    if (data.market.metrics.market_score > 70) score += 10;
    if (data.market.listing_count < 3000) score += 5;
  }
  
  if (profile === 'conservative') score -= 5;
  if (profile === 'aggressive') score += 5;
  
  return Math.min(Math.max(score, 30), 95);
}

function generateThesisSummary(data: any, profile: string, investmentType: string, confidence: number): string {
  const target = data.type === 'property' ? 'This property' : 'This market';
  const verdict = confidence >= 70 ? 'presents a strong opportunity' : 
                  confidence >= 50 ? 'has potential but requires careful analysis' : 
                  'may not be ideal for investment';
  
  return `${target} ${verdict} for ${profile} ${investmentType} investors. ` +
    `Confidence level: ${confidence}%. ` +
    `Key factors include ${data.type === 'property' ? 
      `projected revenue of $${data.estimates.annual_revenue.toLocaleString()} and ${data.estimates.occupancy_rate}% occupancy` :
      `market score of ${data.market.metrics.market_score || 'N/A'} and ${data.market.metrics.occupancy}% average occupancy`}.`;
}

function generateConfigurationAnalysis(configData: any[]): string[] {
  const insights = [];
  const validConfigs = configData.filter(c => c.data !== null);
  
  if (validConfigs.length === 0) return ['Insufficient data for analysis'];
  
  // Revenue trend
  const revenueByBedroom = validConfigs.map(c => ({ br: c.bedrooms, rev: c.data.avg_revenue }));
  const revenueTrend = revenueByBedroom[revenueByBedroom.length - 1].rev > revenueByBedroom[0].rev ? 'increases' : 'varies';
  insights.push(`Revenue generally ${revenueTrend} with bedroom count`);
  
  // Occupancy trend
  const highestOccupancy = validConfigs.reduce((best, c) => 
    c.data.avg_occupancy > (best.data?.avg_occupancy || 0) ? c : best
  );
  insights.push(`${highestOccupancy.bedrooms}BR properties have the highest occupancy at ${highestOccupancy.data.avg_occupancy}%`);
  
  // Revenue per bedroom efficiency
  const efficiency = validConfigs.map(c => ({
    br: c.bedrooms,
    efficiency: Math.round(c.data.avg_revenue / c.bedrooms)
  }));
  const mostEfficient = efficiency.reduce((best, c) => c.efficiency > best.efficiency ? c : best);
  insights.push(`${mostEfficient.br}BR is most efficient at $${mostEfficient.efficiency.toLocaleString()} revenue per bedroom`);
  
  return insights;
}

function analyzeBedroomDistribution(listings: any[]): any {
  const distribution: Record<number, number> = {};
  listings.forEach(l => {
    distribution[l.bedrooms] = (distribution[l.bedrooms] || 0) + 1;
  });
  
  const total = listings.length;
  const percentages = Object.entries(distribution).map(([br, count]) => ({
    bedrooms: parseInt(br),
    count,
    percentage: Math.round(count / total * 100)
  }));
  
  // Find underserved (less than 10% of market)
  const underserved = percentages.filter(p => p.percentage < 10).map(p => p.bedrooms);
  
  return {
    distribution: percentages,
    underserved,
    opportunity: underserved.length > 0 ? 
      `${underserved.join(', ')}BR properties are underrepresented - potential opportunity` :
      'Market has balanced bedroom distribution'
  };
}

function analyzePropertyTypeDistribution(listings: any[]): any {
  const distribution: Record<string, number> = {};
  listings.forEach(l => {
    const type = l.property_type || 'Unknown';
    distribution[type] = (distribution[type] || 0) + 1;
  });
  
  const total = listings.length;
  const percentages = Object.entries(distribution).map(([type, count]) => ({
    type,
    count,
    percentage: Math.round(count / total * 100)
  })).sort((a, b) => b.count - a.count);
  
  const dominant = percentages[0];
  const underserved = percentages.filter(p => p.percentage < 5).map(p => p.type);
  
  return {
    distribution: percentages,
    underserved,
    opportunity: dominant.percentage > 60 ?
      `Market dominated by ${dominant.type} (${dominant.percentage}%) - differentiation opportunity with other types` :
      'Market has diverse property types'
  };
}

function analyzeAmenityGaps(listings: any[]): any {
  // Analyze titles for amenity mentions
  const amenityKeywords = ['pool', 'hot tub', 'spa', 'lake', 'beach', 'mountain', 'view', 'downtown', 'pet', 'game'];
  const amenityCounts: Record<string, number> = {};
  
  listings.forEach(l => {
    const title = (l.title || '').toLowerCase();
    amenityKeywords.forEach(keyword => {
      if (title.includes(keyword)) {
        amenityCounts[keyword] = (amenityCounts[keyword] || 0) + 1;
      }
    });
  });
  
  const total = listings.length;
  const common = Object.entries(amenityCounts)
    .filter(([_, count]) => count / total > 0.2)
    .map(([amenity, count]) => ({ amenity, percentage: Math.round(count / total * 100) }));
  
  const missing = amenityKeywords.filter(k => !amenityCounts[k] || amenityCounts[k] / total < 0.1);
  
  return {
    common,
    missing,
    differentiators: missing.slice(0, 3).map(a => `Adding ${a} could differentiate your listing`)
  };
}

function analyzePriceTiers(listings: any[]): any {
  const adrs = listings.map(l => l.adr).sort((a, b) => a - b);
  const median = adrs[Math.floor(adrs.length / 2)];
  
  const tiers = {
    budget: listings.filter(l => l.adr < median * 0.8).length,
    mid: listings.filter(l => l.adr >= median * 0.8 && l.adr <= median * 1.2).length,
    premium: listings.filter(l => l.adr > median * 1.2).length
  };
  
  const total = listings.length;
  const distribution = {
    budget: Math.round(tiers.budget / total * 100),
    mid: Math.round(tiers.mid / total * 100),
    premium: Math.round(tiers.premium / total * 100)
  };
  
  // Find sweet spot (tier with best revenue)
  const tierRevenues = {
    budget: listings.filter(l => l.adr < median * 0.8).reduce((s, l) => s + l.annual_revenue, 0) / (tiers.budget || 1),
    mid: listings.filter(l => l.adr >= median * 0.8 && l.adr <= median * 1.2).reduce((s, l) => s + l.annual_revenue, 0) / (tiers.mid || 1),
    premium: listings.filter(l => l.adr > median * 1.2).reduce((s, l) => s + l.annual_revenue, 0) / (tiers.premium || 1)
  };
  
  const sweetSpot = Object.entries(tierRevenues).reduce((best, [tier, rev]) => 
    rev > best.rev ? { tier, rev } : best, { tier: 'mid', rev: 0 });
  
  return {
    distribution,
    sweetSpot: {
      tier: sweetSpot.tier,
      avg_revenue: Math.round(sweetSpot.rev),
      adr_range: sweetSpot.tier === 'budget' ? `Under $${Math.round(median * 0.8)}` :
                 sweetSpot.tier === 'premium' ? `Over $${Math.round(median * 1.2)}` :
                 `$${Math.round(median * 0.8)} - $${Math.round(median * 1.2)}`
    },
    opportunity: distribution.premium < 20 ? 
      'Premium tier underserved - opportunity for luxury positioning' :
      distribution.budget < 20 ?
      'Budget tier underserved - opportunity for value positioning' :
      'Market has balanced price distribution'
  };
}

function generateTopOpportunities(gaps: Record<string, any>): string[] {
  const opportunities = [];
  
  if (gaps.bedroom_count?.underserved?.length > 0) {
    opportunities.push(`Enter with ${gaps.bedroom_count.underserved[0]}BR property - underserved segment`);
  }
  
  if (gaps.property_type?.underserved?.length > 0) {
    opportunities.push(`Consider ${gaps.property_type.underserved[0]} property type - low competition`);
  }
  
  if (gaps.amenities?.missing?.length > 0) {
    opportunities.push(`Add ${gaps.amenities.missing[0]} to differentiate from competition`);
  }
  
  if (gaps.price_tier?.sweetSpot) {
    opportunities.push(`Target ${gaps.price_tier.sweetSpot.tier} tier for optimal revenue`);
  }
  
  return opportunities.slice(0, 5);
}

function generateGapActionItems(gaps: Record<string, any>): string[] {
  const actions = [];
  
  actions.push('Research specific properties matching identified opportunities');
  actions.push('Analyze top performers in underserved segments');
  actions.push('Calculate ROI for recommended configurations');
  actions.push('Visit market to validate data-driven insights');
  
  return actions;
}

function generateBedroomInsights(bedroomData: any[]): string[] {
  const insights = [];
  const validData = bedroomData.filter(b => b.data !== null);
  
  if (validData.length === 0) return ['Insufficient data'];
  
  // Revenue per bedroom
  const efficiencies = validData.map(b => ({
    br: b.bedrooms,
    efficiency: Math.round(b.data.avg_revenue / b.bedrooms)
  }));
  const mostEfficient = efficiencies.reduce((best, c) => c.efficiency > best.efficiency ? c : best);
  insights.push(`${mostEfficient.br}BR is most efficient: $${mostEfficient.efficiency.toLocaleString()} per bedroom`);
  
  // Occupancy comparison
  const highestOcc = validData.reduce((best, c) => 
    c.data.avg_occupancy > (best.data?.avg_occupancy || 0) ? c : best);
  insights.push(`${highestOcc.bedrooms}BR has highest occupancy at ${highestOcc.data.avg_occupancy}%`);
  
  // Revenue ceiling
  const highestRev = validData.reduce((best, c) => 
    c.data.top_revenue > (best.data?.top_revenue || 0) ? c : best);
  insights.push(`Highest earner is a ${highestRev.bedrooms}BR at $${highestRev.data.top_revenue.toLocaleString()}/year`);
  
  return insights;
}


// ============================================
// ADDITIONAL ADVANCED ANALYSIS FUNCTIONS
// ============================================

/**
 * Property Type Performance Comparison
 * Compares house vs condo vs apartment performance in a market
 */
export async function comparePropertyTypes(marketName: string): Promise<any> {
  const markets = await searchMarkets(marketName, 1);
  if (markets.length === 0) {
    return { error: `Could not find market "${marketName}"` };
  }
  
  const performers = await getTopPerformers({
    marketId: markets[0].id,
    limit: 50,
    sort_by: 'revenue'
  });
  
  const typeData: Record<string, { count: number; totalRevenue: number; totalOccupancy: number; totalAdr: number }> = {};
  
  performers.listings.forEach(listing => {
    const type = listing.property_type || 'Unknown';
    if (!typeData[type]) {
      typeData[type] = { count: 0, totalRevenue: 0, totalOccupancy: 0, totalAdr: 0 };
    }
    typeData[type].count++;
    typeData[type].totalRevenue += listing.annual_revenue;
    typeData[type].totalOccupancy += listing.occupancy;
    typeData[type].totalAdr += listing.adr;
  });
  
  const comparison = Object.entries(typeData).map(([type, data]) => ({
    property_type: type,
    count: data.count,
    avg_revenue: Math.round(data.totalRevenue / data.count),
    avg_occupancy: Math.round(data.totalOccupancy / data.count),
    avg_adr: Math.round(data.totalAdr / data.count),
    market_share: Math.round(data.count / performers.listings.length * 100)
  })).sort((a, b) => b.avg_revenue - a.avg_revenue);
  
  return {
    market_name: markets[0].name,
    listings_analyzed: performers.listings.length,
    property_types: comparison,
    best_performing: comparison[0],
    recommendation: `${comparison[0].property_type} properties generate the highest average revenue at $${comparison[0].avg_revenue.toLocaleString()}/year`
  };
}

/**
 * Amenity Correlation Analysis
 * Identifies which amenities correlate with highest revenue
 */
export async function analyzeAmenityCorrelation(marketName: string): Promise<any> {
  const markets = await searchMarkets(marketName, 1);
  if (markets.length === 0) {
    return { error: `Could not find market "${marketName}"` };
  }
  
  const performers = await getTopPerformers({
    marketId: markets[0].id,
    limit: 50,
    sort_by: 'revenue'
  });
  
  // Analyze titles for amenity mentions
  const amenityKeywords = [
    'pool', 'hot tub', 'spa', 'lake', 'beach', 'mountain', 'view', 'downtown',
    'pet', 'game', 'theater', 'gym', 'sauna', 'fireplace', 'deck', 'patio',
    'bbq', 'grill', 'ev charger', 'garage', 'parking'
  ];
  
  const amenityPerformance: Record<string, { count: number; totalRevenue: number; listings: any[] }> = {};
  
  performers.listings.forEach(listing => {
    const title = (listing.title || '').toLowerCase();
    amenityKeywords.forEach(amenity => {
      if (title.includes(amenity)) {
        if (!amenityPerformance[amenity]) {
          amenityPerformance[amenity] = { count: 0, totalRevenue: 0, listings: [] };
        }
        amenityPerformance[amenity].count++;
        amenityPerformance[amenity].totalRevenue += listing.annual_revenue;
        amenityPerformance[amenity].listings.push(listing);
      }
    });
  });
  
  const avgMarketRevenue = performers.listings.reduce((sum, l) => sum + l.annual_revenue, 0) / performers.listings.length;
  
  const correlations = Object.entries(amenityPerformance)
    .filter(([_, data]) => data.count >= 3) // Need at least 3 samples
    .map(([amenity, data]) => {
      const avgRevenue = data.totalRevenue / data.count;
      const premium = ((avgRevenue - avgMarketRevenue) / avgMarketRevenue) * 100;
      return {
        amenity: amenity.replace(/\b\w/g, l => l.toUpperCase()),
        properties_with_amenity: data.count,
        avg_revenue: Math.round(avgRevenue),
        revenue_premium: Math.round(premium),
        market_penetration: Math.round(data.count / performers.listings.length * 100)
      };
    })
    .sort((a, b) => b.revenue_premium - a.revenue_premium);
  
  return {
    market_name: markets[0].name,
    market_avg_revenue: Math.round(avgMarketRevenue),
    listings_analyzed: performers.listings.length,
    amenity_correlations: correlations,
    top_amenities: correlations.slice(0, 5).map(a => a.amenity),
    insights: correlations.slice(0, 3).map(a => 
      `Properties with "${a.amenity}" earn ${a.revenue_premium > 0 ? '+' : ''}${a.revenue_premium}% vs market average`
    )
  };
}

/**
 * Revenue Percentile Calculator
 * Determines where a property ranks in its market
 */
export async function calculateRevenuePercentile(
  marketName: string,
  targetRevenue: number,
  bedrooms?: number
): Promise<any> {
  const markets = await searchMarkets(marketName, 1);
  if (markets.length === 0) {
    return { error: `Could not find market "${marketName}"` };
  }
  
  const performers = await getTopPerformers({
    marketId: markets[0].id,
    limit: 100,
    sort_by: 'revenue',
    filters: bedrooms ? { bedrooms } : undefined
  });
  
  if (performers.listings.length === 0) {
    return { error: `No listings found in ${marketName}${bedrooms ? ` with ${bedrooms} bedrooms` : ''}` };
  }
  
  const revenues = performers.listings.map(l => l.annual_revenue).sort((a, b) => a - b);
  const belowCount = revenues.filter(r => r < targetRevenue).length;
  const percentile = Math.round((belowCount / revenues.length) * 100);
  
  // Find similar performers
  const similarPerformers = performers.listings
    .filter(l => Math.abs(l.annual_revenue - targetRevenue) < targetRevenue * 0.15)
    .slice(0, 5);
  
  return {
    market_name: markets[0].name,
    target_revenue: targetRevenue,
    bedrooms: bedrooms || 'all',
    percentile,
    interpretation: percentile >= 75 ? 'Top Performer' :
                    percentile >= 50 ? 'Above Average' :
                    percentile >= 25 ? 'Below Average' : 'Bottom Quartile',
    market_context: {
      listings_analyzed: revenues.length,
      min_revenue: revenues[0],
      max_revenue: revenues[revenues.length - 1],
      median_revenue: revenues[Math.floor(revenues.length / 2)],
      avg_revenue: Math.round(revenues.reduce((a, b) => a + b, 0) / revenues.length)
    },
    similar_performers: similarPerformers.map(p => ({
      title: p.title,
      revenue: p.annual_revenue,
      occupancy: p.occupancy,
      airbnb_url: p.airbnb_url
    })),
    recommendation: percentile >= 75 
      ? 'Excellent projection! You would be among the top performers in this market.'
      : percentile >= 50
      ? 'Good projection. Focus on optimization to reach top quartile.'
      : 'Consider ways to improve - study top performers for differentiation ideas.'
  };
}

/**
 * Seasonality-Adjusted Revenue Projection
 * Provides more accurate estimates factoring in seasonal patterns
 */
export async function calculateSeasonalityAdjustedRevenue(
  marketName: string,
  baseRevenue: number,
  startMonth: number = 1
): Promise<any> {
  const markets = await searchMarkets(marketName, 1);
  if (markets.length === 0) {
    return { error: `Could not find market "${marketName}"` };
  }
  
  const seasonality = await getMarketSeasonality(markets[0].id);
  
  if (seasonality.length === 0) {
    return { error: `Could not fetch seasonality data for ${marketName}` };
  }
  
  // Calculate seasonal adjustment factors
  const avgMonthlyRevenue = seasonality.reduce((sum, m) => sum + m.revenue, 0) / 12;
  const adjustmentFactors = seasonality.map(m => ({
    month: m.month_name,
    factor: m.revenue / avgMonthlyRevenue,
    season_type: m.season_type
  }));
  
  // Project revenue for 12 months starting from startMonth
  const monthlyProjections = [];
  let totalProjected = 0;
  
  for (let i = 0; i < 12; i++) {
    const monthIndex = (startMonth - 1 + i) % 12;
    const factor = adjustmentFactors[monthIndex];
    const projectedRevenue = Math.round((baseRevenue / 12) * factor.factor);
    totalProjected += projectedRevenue;
    
    monthlyProjections.push({
      month: factor.month,
      projected_revenue: projectedRevenue,
      season_type: factor.season_type,
      adjustment_factor: Math.round(factor.factor * 100) / 100,
      strategy: factor.season_type === 'peak' 
        ? 'Premium pricing, longer minimum stays'
        : factor.season_type === 'off'
        ? 'Discount rates, flexible minimums'
        : 'Standard pricing'
    });
  }
  
  // Calculate variance from base
  const variance = ((totalProjected - baseRevenue) / baseRevenue) * 100;
  
  return {
    market_name: markets[0].name,
    base_annual_revenue: baseRevenue,
    seasonality_adjusted_revenue: totalProjected,
    variance_from_base: Math.round(variance),
    monthly_projections: monthlyProjections,
    peak_months: monthlyProjections.filter(m => m.season_type === 'peak').map(m => m.month),
    off_season_months: monthlyProjections.filter(m => m.season_type === 'off').map(m => m.month),
    insights: [
      `Peak season (${monthlyProjections.filter(m => m.season_type === 'peak').length} months) contributes ${Math.round(monthlyProjections.filter(m => m.season_type === 'peak').reduce((s, m) => s + m.projected_revenue, 0) / totalProjected * 100)}% of annual revenue`,
      `Off-season requires ${Math.round(100 - monthlyProjections.filter(m => m.season_type === 'off').reduce((s, m) => s + m.projected_revenue, 0) / totalProjected * 100)}% occupancy to hit targets`,
      variance > 5 ? `Seasonality adds ${Math.round(variance)}% to your base projection` : 
        variance < -5 ? `Seasonality reduces your projection by ${Math.abs(Math.round(variance))}%` :
        'Seasonality has minimal impact on your projection'
    ]
  };
}

// Add these to the enhanced function execution
export async function executeAdditionalFunction(functionName: string, args: Record<string, unknown>): Promise<unknown> {
  switch (functionName) {
    case 'compare_property_types':
      return comparePropertyTypes(args.market_name as string);
    
    case 'analyze_amenity_correlation':
      return analyzeAmenityCorrelation(args.market_name as string);
    
    case 'calculate_revenue_percentile':
      return calculateRevenuePercentile(
        args.market_name as string,
        args.target_revenue as number,
        args.bedrooms as number | undefined
      );
    
    case 'calculate_seasonality_adjusted_revenue':
      return calculateSeasonalityAdjustedRevenue(
        args.market_name as string,
        args.base_revenue as number,
        args.start_month as number | undefined
      );
    
    default:
      return { error: `Unknown additional function: ${functionName}` };
  }
}


// ============================================
// INVESTMENT DECISION FRAMEWORK
// Advanced AI Reasoning for Investment Decisions
// ============================================

/**
 * Investment Decision Matrix
 * Comprehensive scoring system for investment decisions
 */
export interface InvestmentDecision {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendation: 'STRONG BUY' | 'BUY' | 'HOLD' | 'AVOID' | 'STRONG AVOID';
  confidence: number;
  factors: {
    name: string;
    score: number;
    weight: number;
    impact: 'positive' | 'neutral' | 'negative';
    reasoning: string;
  }[];
  risks: string[];
  opportunities: string[];
  action_items: string[];
}

/**
 * Calculate comprehensive investment decision score
 */
export function calculateInvestmentDecision(
  revenue: number,
  occupancy: number,
  adr: number,
  competition: number,
  marketScore: number,
  monthlyExpenses: number
): InvestmentDecision {
  const factors: InvestmentDecision['factors'] = [];
  
  // Revenue Factor (25% weight)
  const revenueScore = revenue >= 80000 ? 100 :
                       revenue >= 60000 ? 85 :
                       revenue >= 45000 ? 70 :
                       revenue >= 30000 ? 55 :
                       revenue >= 20000 ? 40 : 25;
  factors.push({
    name: 'Revenue Potential',
    score: revenueScore,
    weight: 0.25,
    impact: revenueScore >= 70 ? 'positive' : revenueScore >= 50 ? 'neutral' : 'negative',
    reasoning: revenue >= 60000 
      ? `Strong revenue at $${revenue.toLocaleString()}/year puts you in top tier`
      : revenue >= 40000
      ? `Moderate revenue at $${revenue.toLocaleString()}/year - room for optimization`
      : `Lower revenue at $${revenue.toLocaleString()}/year requires careful expense management`
  });
  
  // Occupancy Factor (20% weight)
  const occupancyScore = occupancy >= 75 ? 100 :
                         occupancy >= 65 ? 85 :
                         occupancy >= 55 ? 70 :
                         occupancy >= 45 ? 55 :
                         occupancy >= 35 ? 40 : 25;
  factors.push({
    name: 'Demand Stability',
    score: occupancyScore,
    weight: 0.20,
    impact: occupancyScore >= 70 ? 'positive' : occupancyScore >= 50 ? 'neutral' : 'negative',
    reasoning: occupancy >= 65 
      ? `${occupancy}% occupancy indicates strong, consistent demand`
      : occupancy >= 50
      ? `${occupancy}% occupancy is moderate - seasonal optimization needed`
      : `${occupancy}% occupancy is concerning - investigate demand drivers`
  });
  
  // ADR Factor (15% weight)
  const adrScore = adr >= 300 ? 100 :
                   adr >= 200 ? 85 :
                   adr >= 150 ? 70 :
                   adr >= 100 ? 55 :
                   adr >= 75 ? 40 : 25;
  factors.push({
    name: 'Pricing Power',
    score: adrScore,
    weight: 0.15,
    impact: adrScore >= 70 ? 'positive' : adrScore >= 50 ? 'neutral' : 'negative',
    reasoning: adr >= 200 
      ? `$${adr}/night ADR shows premium market positioning`
      : adr >= 125
      ? `$${adr}/night ADR is competitive - differentiation can increase`
      : `$${adr}/night ADR limits profit margins - focus on volume`
  });
  
  // Competition Factor (15% weight)
  const competitionScore = competition < 50 ? 100 :
                           competition < 100 ? 80 :
                           competition < 200 ? 60 :
                           competition < 400 ? 40 : 25;
  factors.push({
    name: 'Competition Level',
    score: competitionScore,
    weight: 0.15,
    impact: competitionScore >= 70 ? 'positive' : competitionScore >= 50 ? 'neutral' : 'negative',
    reasoning: competition < 100 
      ? `Low competition (${competition} listings) = easier market entry`
      : competition < 250
      ? `Moderate competition (${competition} listings) - differentiation important`
      : `High competition (${competition} listings) - need strong USP to succeed`
  });
  
  // Market Score Factor (15% weight)
  const marketFactor = marketScore >= 80 ? 100 :
                       marketScore >= 70 ? 85 :
                       marketScore >= 60 ? 70 :
                       marketScore >= 50 ? 55 : 40;
  factors.push({
    name: 'Market Health',
    score: marketFactor,
    weight: 0.15,
    impact: marketFactor >= 70 ? 'positive' : marketFactor >= 50 ? 'neutral' : 'negative',
    reasoning: marketScore >= 75 
      ? `Market score of ${marketScore}/100 indicates excellent fundamentals`
      : marketScore >= 60
      ? `Market score of ${marketScore}/100 shows solid market conditions`
      : `Market score of ${marketScore}/100 suggests challenging conditions`
  });
  
  // Profitability Factor (10% weight)
  const annualExpenses = monthlyExpenses * 12;
  const netIncome = revenue - annualExpenses;
  const profitMargin = (netIncome / revenue) * 100;
  const profitScore = profitMargin >= 40 ? 100 :
                      profitMargin >= 30 ? 85 :
                      profitMargin >= 20 ? 70 :
                      profitMargin >= 10 ? 50 :
                      profitMargin >= 0 ? 30 : 10;
  factors.push({
    name: 'Profitability',
    score: profitScore,
    weight: 0.10,
    impact: profitScore >= 70 ? 'positive' : profitScore >= 50 ? 'neutral' : 'negative',
    reasoning: profitMargin >= 30 
      ? `${Math.round(profitMargin)}% profit margin is excellent`
      : profitMargin >= 15
      ? `${Math.round(profitMargin)}% profit margin is acceptable`
      : `${Math.round(profitMargin)}% profit margin is tight - watch expenses`
  });
  
  // Calculate weighted score
  const totalScore = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
  
  // Determine grade and recommendation
  let grade: InvestmentDecision['grade'];
  let recommendation: InvestmentDecision['recommendation'];
  let confidence: number;
  
  if (totalScore >= 85) {
    grade = 'A';
    recommendation = 'STRONG BUY';
    confidence = 90;
  } else if (totalScore >= 75) {
    grade = 'B';
    recommendation = 'BUY';
    confidence = 80;
  } else if (totalScore >= 60) {
    grade = 'C';
    recommendation = 'HOLD';
    confidence = 70;
  } else if (totalScore >= 45) {
    grade = 'D';
    recommendation = 'AVOID';
    confidence = 65;
  } else {
    grade = 'F';
    recommendation = 'STRONG AVOID';
    confidence = 60;
  }
  
  // Generate risks based on weak factors
  const risks: string[] = [];
  factors.filter(f => f.impact === 'negative').forEach(f => {
    if (f.name === 'Revenue Potential') risks.push('Revenue may not cover expenses in slow periods');
    if (f.name === 'Demand Stability') risks.push('Low occupancy increases cash flow volatility');
    if (f.name === 'Competition Level') risks.push('High competition may lead to price wars');
    if (f.name === 'Profitability') risks.push('Thin margins leave no room for unexpected costs');
  });
  if (risks.length === 0) risks.push('No major risks identified - maintain current strategy');
  
  // Generate opportunities based on strong factors
  const opportunities: string[] = [];
  factors.filter(f => f.impact === 'positive').forEach(f => {
    if (f.name === 'Revenue Potential') opportunities.push('Strong revenue base supports expansion');
    if (f.name === 'Demand Stability') opportunities.push('Consistent demand allows premium pricing');
    if (f.name === 'Pricing Power') opportunities.push('Premium positioning enables upselling');
    if (f.name === 'Competition Level') opportunities.push('Low competition allows market share growth');
  });
  if (opportunities.length === 0) opportunities.push('Focus on operational improvements first');
  
  // Generate action items
  const action_items: string[] = [];
  if (recommendation === 'STRONG BUY' || recommendation === 'BUY') {
    action_items.push('Proceed with investment - fundamentals are strong');
    action_items.push('Focus on optimizing operations to maximize returns');
    action_items.push('Consider scaling with additional properties in this market');
  } else if (recommendation === 'HOLD') {
    action_items.push('Conduct deeper due diligence before committing');
    action_items.push('Identify specific improvements to strengthen weak areas');
    action_items.push('Compare with 2-3 alternative markets before deciding');
  } else {
    action_items.push('Look for better opportunities in other markets');
    action_items.push('If proceeding, have a clear plan to address weaknesses');
    action_items.push('Ensure you have reserves for potential underperformance');
  }
  
  return {
    score: Math.round(totalScore),
    grade,
    recommendation,
    confidence,
    factors,
    risks,
    opportunities,
    action_items
  };
}

/**
 * Generate comprehensive deal analysis with AI reasoning
 */
export async function generateDealAnalysis(
  address: string,
  purchasePrice: number,
  downPaymentPercent: number = 20,
  interestRate: number = 7,
  bedrooms: number = 3,
  bathrooms: number = 2
): Promise<any> {
  // Get property estimate
  const estimate = await getRentalizerEstimate({
    address,
    bedrooms,
    bathrooms,
    accommodates: bedrooms * 2,
    currency: 'usd'
  });
  
  if (!estimate) {
    return { error: `Could not analyze property at "${address}"` };
  }
  
  const revenue = estimate.estimates.annual_revenue;
  const occupancy = estimate.estimates.occupancy_rate;
  const adr = estimate.estimates.average_daily_rate;
  
  // Calculate mortgage
  const downPayment = purchasePrice * (downPaymentPercent / 100);
  const loanAmount = purchasePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = 30 * 12;
  const monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  // Calculate expenses
  const monthlyExpenses = {
    mortgage: Math.round(monthlyMortgage),
    property_tax: Math.round(purchasePrice * 0.012 / 12),
    insurance: Math.round(purchasePrice * 0.005 / 12),
    utilities: Math.round(200 + bedrooms * 50),
    maintenance: Math.round(revenue * 0.05 / 12),
    management: Math.round(revenue * 0.10 / 12),
    supplies: Math.round(50 * bedrooms),
    platform_fees: Math.round(revenue * 0.03 / 12)
  };
  
  const totalMonthlyExpenses = Object.values(monthlyExpenses).reduce((a, b) => a + b, 0);
  const annualExpenses = totalMonthlyExpenses * 12;
  const netOperatingIncome = revenue - annualExpenses;
  const cashOnCash = (netOperatingIncome / downPayment) * 100;
  const capRate = (netOperatingIncome / purchasePrice) * 100;
  
  // Get competition count
  const comps = estimate.comps || [];
  const competition = comps.length;
  
  // Calculate investment decision
  const decision = calculateInvestmentDecision(
    revenue,
    occupancy,
    adr,
    competition,
    70, // Default market score
    totalMonthlyExpenses
  );
  
  return {
    property: {
      address: estimate.property.address,
      bedrooms,
      bathrooms,
      purchase_price: purchasePrice
    },
    financing: {
      down_payment: downPayment,
      down_payment_percent: downPaymentPercent,
      loan_amount: loanAmount,
      interest_rate: interestRate,
      monthly_mortgage: Math.round(monthlyMortgage),
      total_cash_needed: Math.round(downPayment + purchasePrice * 0.03 + 15000) // Down + closing + startup
    },
    revenue_projections: {
      annual_revenue: revenue,
      monthly_revenue: Math.round(revenue / 12),
      occupancy_rate: occupancy,
      average_daily_rate: adr,
      revenue_range: {
        low: estimate.estimates.annual_revenue_low,
        expected: revenue,
        high: estimate.estimates.annual_revenue_high
      }
    },
    expenses: {
      monthly_breakdown: monthlyExpenses,
      total_monthly: totalMonthlyExpenses,
      total_annual: annualExpenses,
      expense_ratio: Math.round((annualExpenses / revenue) * 100)
    },
    returns: {
      net_operating_income: netOperatingIncome,
      monthly_cash_flow: Math.round(netOperatingIncome / 12),
      cash_on_cash_return: Math.round(cashOnCash * 10) / 10,
      cap_rate: Math.round(capRate * 10) / 10,
      payback_period_years: Math.round((downPayment / netOperatingIncome) * 10) / 10
    },
    investment_decision: decision,
    comparable_properties: comps.slice(0, 5).map((c: any) => ({
      title: c.title,
      revenue: c.annual_revenue,
      occupancy: c.occupancy,
      adr: c.adr,
      airbnb_url: c.airbnb_url
    }))
  };
}

// Add deal analysis to enhanced function execution
export async function executeDealFunction(functionName: string, args: Record<string, unknown>): Promise<unknown> {
  switch (functionName) {
    case 'generate_deal_analysis':
      return generateDealAnalysis(
        args.address as string,
        args.purchase_price as number,
        args.down_payment_percent as number | undefined,
        args.interest_rate as number | undefined,
        args.bedrooms as number | undefined,
        args.bathrooms as number | undefined
      );
    
    default:
      return { error: `Unknown deal function: ${functionName}` };
  }
}

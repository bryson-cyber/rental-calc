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
  exploreListingsInRadius,
  searchByZipcode,
  getCountryMarkets,
  exploreSubmarketsWithMetrics,
  calculateArbitrageFeasibility
} from './airdna';
import { makeRequest, GeocodingResult } from './_core/map';
import { ENHANCED_TOOLS, executeEnhancedFunction, executeAdditionalFunction, executeDealFunction } from './ai-advisor-enhanced';
import { SOPReports, generateFullArbitrageAnalysis } from './sop-reports';

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
      description: "Get monthly seasonality data showing peak, shoulder, and off-season patterns for a market. Use market_name (like 'Austin' or 'Nashville') - the system will look up the market ID automatically. IMPORTANT: If the user asks about a submarket/neighborhood (like 'Cumberland' or 'Central West End'), use the PARENT MARKET name instead (e.g., 'Atlanta' for Cumberland, 'St. Louis' for Central West End).",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The PARENT MARKET name (e.g., 'Austin', 'Nashville', 'Atlanta', 'St. Louis'). If user asks about a submarket/neighborhood, use the parent market name."
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
      description: "Get information about which amenities help properties earn more in a specific market. Use this when user asks about amenities, what features to add, how to increase revenue through amenities, or what top performers have. Returns data on popular amenities and their impact on revenue. IMPORTANT: If the user asks about a submarket/neighborhood (like 'Cumberland' or 'Central West End'), use the PARENT MARKET name instead (e.g., 'Atlanta' for Cumberland, 'St. Louis' for Central West End).",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The PARENT MARKET name (e.g., 'Austin', 'Nashville', 'Atlanta', 'St. Louis'). If user asks about a submarket/neighborhood, use the parent market name."
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
    },
    {
      name: "search_by_zipcode",
      description: "Search for short-term rental market data by US zip code. Use this when the user provides a 5-digit zip code. IMPORTANT: Always pass the user's filter selections (bedrooms, bathrooms, property_type, amenities) to get accurate filtered results. This will return market data and top performers matching the filters.",
      parameters: {
        type: "object",
        properties: {
          zipcode: {
            type: "string",
            description: "The 5-digit US zip code to search (e.g., '78701', '90210', '10001')"
          },
          bedrooms: {
            type: "number",
            description: "Filter results by number of bedrooms (e.g., 3 for 3BR properties)"
          },
          bathrooms: {
            type: "number",
            description: "Filter results by minimum number of bathrooms (e.g., 2 for 2+ BA)"
          },
          property_type: {
            type: "string",
            description: "Filter by property type: house, apartment, condominium, townhouse, cabin, villa, cottage"
          },
          has_pool: {
            type: "boolean",
            description: "Filter for properties with a pool"
          },
          has_hot_tub: {
            type: "boolean",
            description: "Filter for properties with a hot tub"
          },
          pet_friendly: {
            type: "boolean",
            description: "Filter for pet-friendly properties"
          },
          has_parking: {
            type: "boolean",
            description: "Filter for properties with parking"
          },
          superhost: {
            type: "boolean",
            description: "Filter for Superhost properties only"
          },
          professionally_managed: {
            type: "boolean",
            description: "Filter for professionally managed properties"
          },
          min_rating: {
            type: "number",
            description: "Filter for properties with minimum rating (e.g., 4.5)"
          }
        },
        required: ["zipcode"]
      }
    },
    {
      name: "generate_listing_description",
      description: "Generate an optimized Airbnb listing title and description for a property. Use this when the user asks for help writing their listing, wants listing copy, or asks how to describe their property.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "The property address"
          },
          bedrooms: {
            type: "number",
            description: "Number of bedrooms"
          },
          bathrooms: {
            type: "number",
            description: "Number of bathrooms"
          },
          property_type: {
            type: "string",
            description: "Type of property (house, apartment, condo, etc.)"
          },
          amenities: {
            type: "string",
            description: "Comma-separated list of amenities (pool, hot tub, parking, etc.)"
          },
          unique_features: {
            type: "string",
            description: "Any unique features or selling points of the property"
          }
        },
        required: ["address", "bedrooms", "bathrooms"]
      }
    },
    {
      name: "calculate_investment_score",
      description: "Calculate an investment score (1-100) for a property or market based on revenue potential, occupancy rates, competition, and seasonality. Use this when user asks about investment potential, whether something is a good investment, or wants a score/rating.",
      parameters: {
        type: "object",
        properties: {
          annual_revenue: {
            type: "number",
            description: "Expected annual revenue"
          },
          occupancy_rate: {
            type: "number",
            description: "Occupancy rate as a percentage (e.g., 65 for 65%)"
          },
          adr: {
            type: "number",
            description: "Average daily rate"
          },
          competition_count: {
            type: "number",
            description: "Number of competing listings in the area"
          },
          market_name: {
            type: "string",
            description: "Name of the market for context"
          }
        },
        required: ["annual_revenue", "occupancy_rate", "adr"]
      }
    },
    {
      name: "calculate_amenity_impact",
      description: "Calculate the revenue impact of adding specific amenities (pool, hot tub, extra bedroom, etc.) to a property. Use this when user asks 'what if I add a pool?' or 'how much more could I make with a hot tub?' or 'should I add an extra bedroom?'",
      parameters: {
        type: "object",
        properties: {
          base_revenue: {
            type: "number",
            description: "Current or projected annual revenue without the amenity"
          },
          amenity_type: {
            type: "string",
            description: "The amenity to evaluate: 'pool', 'hot_tub', 'extra_bedroom', 'game_room', 'outdoor_kitchen', 'ev_charger', 'home_theater', 'sauna'"
          },
          market_type: {
            type: "string",
            description: "Market type: 'beach', 'mountain', 'urban', 'suburban', 'lake', 'desert'"
          },
          current_bedrooms: {
            type: "number",
            description: "Current number of bedrooms (for extra bedroom calculation)"
          }
        },
        required: ["base_revenue", "amenity_type"]
      }
    },
    {
      name: "find_markets_for_budget",
      description: "Find the best STR markets for a given investment budget. Use this when user asks 'where can I invest with $X?' or 'best markets for my budget' or 'what can I afford?'",
      parameters: {
        type: "object",
        properties: {
          budget: {
            type: "number",
            description: "Total investment budget in dollars"
          },
          investment_type: {
            type: "string",
            description: "'purchase' for buying property or 'arbitrage' for rental arbitrage"
          },
          preferred_region: {
            type: "string",
            description: "Optional preferred region: 'southeast', 'southwest', 'midwest', 'northeast', 'west_coast', 'any'"
          }
        },
        required: ["budget", "investment_type"]
      }
    },
    // ============================================
    // ENHANCED FUNCTIONS - Advanced Analysis
    // ============================================
    {
      name: "compare_multiple_markets",
      description: "Compare 2-5 markets side-by-side with detailed metrics, scores, and investment recommendations. Use this when user wants to compare cities or decide between markets (e.g., 'compare Austin vs Nashville vs Denver').",
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
      description: "Deep dive into a market's neighborhoods/submarkets to find the best areas to invest. Shows ranking by revenue, occupancy, and overall score. Use when user asks about neighborhoods or best areas within a city.",
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
      description: "Find the best STR markets in the US based on specific criteria. Use for market discovery and identifying opportunities (e.g., 'best markets for investors', 'top STR-friendly markets').",
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
      description: "Comprehensive rental arbitrage analysis for a property. Calculates profitability, break-even, risk assessment, and provides recommendation. Use when user asks about arbitrage viability for a specific property.",
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
      description: "Compare different bedroom configurations in the same market to find the optimal property size. Shows revenue, occupancy, and ROI by bedroom count. Use when user asks 'what size property should I get?' or 'is 3BR or 4BR better?'",
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
      description: "Deep analysis of the competitive landscape in a market or around a property. Identifies gaps, opportunities, and success patterns. Use when user asks about competition or how to stand out.",
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
      description: "Generate a comprehensive investment thesis for a specific property or market. Synthesizes all available data into actionable recommendations. Use for detailed investment analysis.",
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
      description: "Run multiple what-if scenarios for an investment. Shows outcomes under different conditions (recession, competition increase, best/worst case). Use when user asks 'what if' questions or wants risk analysis.",
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
      description: "Identify underserved niches and opportunities in a market. Finds gaps in property types, amenities, or price points. Use when user asks about opportunities or how to differentiate.",
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
      description: "Get detailed performance metrics broken down by bedroom count for a market. Shows which property sizes perform best. Use when user asks about optimal bedroom count or property size.",
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
    },
    {
      name: "compare_property_types",
      description: "Compare performance of different property types (house, condo, apartment, townhouse) in a market. Use when user asks 'house vs condo' or 'which property type performs best'.",
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
    },
    {
      name: "analyze_amenity_correlation",
      description: "Analyze which amenities correlate with highest revenue in a market. Use when user asks about amenity impact, what amenities to add, or which features drive revenue.",
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
    },
    {
      name: "calculate_revenue_percentile",
      description: "Calculate where a property's revenue ranks compared to the market. Use when user asks 'how does this compare?' or 'where would I rank?'",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market to compare against"
          },
          target_revenue: {
            type: "number",
            description: "The revenue to rank"
          },
          bedrooms: {
            type: "number",
            description: "Optional: Filter by bedroom count for apples-to-apples comparison"
          }
        },
        required: ["market_name", "target_revenue"]
      }
    },
    {
      name: "calculate_seasonality_adjusted_revenue",
      description: "Calculate revenue projection adjusted for seasonal patterns. Use when user wants accurate monthly projections or asks about seasonality impact.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market to analyze"
          },
          base_revenue: {
            type: "number",
            description: "The base annual revenue estimate"
          },
          start_month: {
            type: "number",
            description: "Month to start projection (1-12, default 1 for January)"
          }
        },
        required: ["market_name", "base_revenue"]
      }
    },
    {
      name: "generate_deal_analysis",
      description: "Generate comprehensive investment deal analysis with financing, returns, and AI-powered recommendation. Use when user provides a property address with purchase price or asks 'should I buy this property?'",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "The property address"
          },
          purchase_price: {
            type: "number",
            description: "The purchase price of the property"
          },
          down_payment_percent: {
            type: "number",
            description: "Down payment percentage (default 20)"
          },
          interest_rate: {
            type: "number",
            description: "Mortgage interest rate (default 7)"
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
        required: ["address", "purchase_price"]
      }
    },
    {
      name: "generate_arbitrage_report",
      description: "Generate a comprehensive Airbnb arbitrage analysis report following Coach Inayah's SOP. This creates a professional investment report with property analysis, market data, competitor analysis with Airbnb URLs, and profitability projections with 3 scenarios (Conservative, Realistic, Optimistic). Use when user provides a property address and monthly rent for arbitrage analysis.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "The full property address"
          },
          monthly_rent: {
            type: "number",
            description: "The monthly rent for the property"
          },
          bedrooms: {
            type: "number",
            description: "Number of bedrooms (optional, will be detected)"
          },
          bathrooms: {
            type: "number",
            description: "Number of bathrooms (optional, will be detected)"
          },
          zillow_url: {
            type: "string",
            description: "Optional Zillow listing URL for reference"
          },
          attractive_features: {
            type: "array",
            items: { type: "string" },
            description: "List of attractive features (e.g., 'Private backyard', 'Modern kitchen', 'In-unit laundry')"
          }
        },
        required: ["address", "monthly_rent"]
      }
    },
    {
      name: "get_market_percentiles",
      description: "Get revenue percentiles (Top 10%, Top 25%, Median, Average) for a market filtered by bedroom count. Use this to understand revenue potential and set realistic expectations.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market name (e.g., 'Austin', 'Nashville')"
          },
          bedrooms: {
            type: "number",
            description: "Filter by bedroom count for accurate comparison"
          }
        },
        required: ["market_name"]
      }
    },
    {
      name: "get_competitors_above_threshold",
      description: "Get top-performing competitors that earn at least 2x the annual rent (the minimum for 30%+ profit margin). Use this to find viable comps for arbitrage analysis.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market name"
          },
          monthly_rent: {
            type: "number",
            description: "The monthly rent - competitors must earn 2x this annually"
          },
          bedrooms: {
            type: "number",
            description: "Filter by bedroom count for apples-to-apples comparison"
          },
          limit: {
            type: "number",
            description: "Number of competitors to return (default 5)"
          }
        },
        required: ["market_name", "monthly_rent"]
      }
    },
    {
      name: "calculate_sop_profitability",
      description: "Calculate profitability using Coach Inayah's SOP formulas: $20K startup costs, Rent + $780/month expenses, and 3 profit scenarios. Use when user asks about profit potential or arbitrage viability.",
      parameters: {
        type: "object",
        properties: {
          monthly_rent: {
            type: "number",
            description: "The monthly rent"
          },
          top_10_revenue: {
            type: "number",
            description: "Top 10% (90th percentile) annual revenue in the market"
          },
          top_25_revenue: {
            type: "number",
            description: "Top 25% (75th percentile) annual revenue in the market"
          },
          median_revenue: {
            type: "number",
            description: "Median (50th percentile) annual revenue in the market"
          }
        },
        required: ["monthly_rent", "top_10_revenue", "top_25_revenue", "median_revenue"]
      }
    },
    {
      name: "tier_neighborhoods",
      description: "Categorize neighborhoods into investment tiers: Premier (best all-around), High-Occupancy (always booked), Up-and-Coming (growth signals), and Caution (declining). Use for market-level neighborhood analysis.",
      parameters: {
        type: "object",
        properties: {
          market_name: {
            type: "string",
            description: "The market to analyze neighborhoods for"
          }
        },
        required: ["market_name"]
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
            is_superhost: l.superhost,
            airbnb_url: l.airbnb_url || '',
            property_type: l.property_type || 'Unknown',
            professionally_managed: l.professionally_managed || false
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
      
      case "search_by_zipcode": {
        const zipcode = args.zipcode as string;
        const bedrooms = args.bedrooms as number | undefined;
        const bathrooms = args.bathrooms as number | undefined;
        const propertyType = args.property_type as string | undefined;
        const hasPool = args.has_pool as boolean | undefined;
        const hasHotTub = args.has_hot_tub as boolean | undefined;
        const petFriendly = args.pet_friendly as boolean | undefined;
        const hasParking = args.has_parking as boolean | undefined;
        const superhost = args.superhost as boolean | undefined;
        const professionallyManaged = args.professionally_managed as boolean | undefined;
        const minRating = args.min_rating as number | undefined;
        
        console.log(`[AI Advisor] Searching by zip code: ${zipcode} with filters:`, {
          bedrooms, bathrooms, propertyType, hasPool, hasHotTub, petFriendly, hasParking, superhost, professionallyManaged, minRating
        });
        
        try {
          // Use the searchByZipcode function with all filters
          const result = await searchByZipcode(zipcode, {
            bedrooms,
            bathrooms,
            propertyType,
            amenities: {
              pool: hasPool,
              hotTub: hasHotTub,
              petFriendly: petFriendly,
              parking: hasParking
            },
            superhost,
            professionallyManaged,
            minRating,
            limit: 10
          });
          
          if (!result) {
            // Fallback: try to find the market by geocoding the zip code
            const geocodeResult = await makeRequest<GeocodingResult>(
              '/maps/api/geocode/json',
              { address: zipcode }
            );
            
            if (geocodeResult.results && geocodeResult.results.length > 0) {
              const location = geocodeResult.results[0];
              let city = '';
              let state = '';
              for (const component of location.address_components) {
                if (component.types.includes('locality')) {
                  city = component.long_name;
                }
                if (component.types.includes('administrative_area_level_1')) {
                  state = component.short_name;
                }
              }
              
              // Try searching by city name
              const marketResults = await searchMarkets(city, 1);
              if (marketResults.length > 0) {
                const report = await getComprehensiveMarketReport(marketResults[0].id);
                if (report) {
                  return {
                    zipcode,
                    location: `${city}, ${state}`,
                    market_name: report.market.name,
                    market_data: {
                      average_revenue: report.market.metrics.revenue,
                      occupancy_rate: report.market.metrics.occupancy,
                      average_daily_rate: report.market.metrics.adr,
                      active_listings: report.market.metrics.active_listings,
                      market_score: report.market.metrics.market_score
                    },
                    note: `Data shown is for the ${report.market.name} market area. The specific zip code ${zipcode} may be a smaller submarket within this region.`
                  };
                }
              }
            }
            
            return { 
              error: `Could not find rental data for zip code ${zipcode}. This zip code may not have enough short-term rental activity in the AirDNA database.`,
              suggestion: "Try searching for the city name instead (e.g., 'St. Louis, MO' or 'Austin, TX')"
            };
          }
          
          // Format the successful response
          return {
            zipcode: result.zipcode,
            location: result.location,
            submarket: result.submarket ? {
              name: result.submarket.name,
              listing_count: result.submarket.listing_count,
              parent_market: result.submarket.parent_market?.name
            } : undefined,
            market: result.market ? {
              name: result.market.name,
              listing_count: result.market.listing_count
            } : undefined,
            market_data: result.metrics ? {
              average_revenue: result.metrics.revenue,
              occupancy_rate: result.metrics.occupancy,
              average_daily_rate: result.metrics.adr,
              revpar: result.metrics.revpar,
              active_listings: result.metrics.active_listings,
              market_score: result.metrics.market_score
            } : undefined,
            top_performers: result.top_performers?.slice(0, 5).map(p => ({
              title: p.title,
              bedrooms: p.bedrooms,
              bathrooms: p.bathrooms,
              property_type: (p as any).property_type || 'Unknown',
              annual_revenue: p.annual_revenue,
              occupancy: p.occupancy,
              adr: p.adr,
              rating: p.rating,
              reviews: p.reviews,
              airbnb_url: p.airbnb_url,
              note: (p as any).note
            }))
          };
        } catch (error) {
          console.error(`[AI Advisor] Zip code search error:`, error);
          return { error: `Failed to search zip code ${zipcode}: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }
      }
      
      case "generate_listing_description": {
        const address = args.address as string;
        const bedrooms = args.bedrooms as number;
        const bathrooms = args.bathrooms as number;
        const propertyType = (args.property_type as string) || 'home';
        const amenities = (args.amenities as string) || '';
        const uniqueFeatures = (args.unique_features as string) || '';
        
        // Extract location from address
        const addressParts = address.split(',');
        const city = addressParts.length >= 2 ? addressParts[1].trim() : 'the area';
        
        // Generate title options
        const titleOptions = [
          `Stunning ${bedrooms}BR ${propertyType} in ${city}`,
          `Modern ${bedrooms}-Bedroom Retreat | Perfect Location`,
          `Cozy ${propertyType} with ${bedrooms}BR/${bathrooms}BA | ${city}`,
          `Charming ${city} ${propertyType} | Sleeps ${bedrooms * 2}`
        ];
        
        // Build description sections
        const welcomeSection = `Welcome to your perfect getaway in ${city}! This beautifully appointed ${bedrooms}-bedroom, ${bathrooms}-bathroom ${propertyType} offers everything you need for an unforgettable stay.`;
        
        const spaceSection = `THE SPACE:\nStep inside to discover a thoughtfully designed space that comfortably accommodates up to ${bedrooms * 2} guests. Each of the ${bedrooms} bedroom(s) features premium bedding and ample storage. The ${bathrooms} bathroom(s) are stocked with fresh towels and essential toiletries.`;
        
        let amenitiesSection = 'AMENITIES:\n';
        if (amenities) {
          const amenityList = amenities.split(',').map(a => a.trim());
          amenitiesSection += amenityList.map(a => `• ${a}`).join('\n');
        } else {
          amenitiesSection += '• High-speed WiFi\n• Fully equipped kitchen\n• Smart TV with streaming\n• Washer/dryer\n• Free parking\n• Climate control';
        }
        
        let featuresSection = '';
        if (uniqueFeatures) {
          featuresSection = `\n\nWHAT MAKES US SPECIAL:\n${uniqueFeatures}`;
        }
        
        const closingSection = `\n\nWe're committed to making your stay exceptional. Book now and experience the best of ${city}!`;
        
        return {
          title_options: titleOptions,
          recommended_title: titleOptions[0],
          description: welcomeSection + '\n\n' + spaceSection + '\n\n' + amenitiesSection + featuresSection + closingSection,
          tips: [
            'Use high-quality photos showing natural light',
            'Highlight your best amenity in the first sentence',
            'Mention nearby attractions and restaurants',
            'Keep your title under 50 characters for mobile',
            'Update your description seasonally'
          ]
        };
      }
      
      case "calculate_investment_score": {
        const annualRevenue = args.annual_revenue as number;
        const occupancyRate = args.occupancy_rate as number;
        const adr = args.adr as number;
        const competitionCount = (args.competition_count as number) || 50;
        const marketName = (args.market_name as string) || 'this market';
        
        // Calculate component scores (each 0-25 points)
        
        // Revenue Score (0-25): Based on annual revenue potential
        // $100K+ = 25, $75K = 20, $50K = 15, $30K = 10, <$20K = 5
        let revenueScore = 0;
        if (annualRevenue >= 100000) revenueScore = 25;
        else if (annualRevenue >= 75000) revenueScore = 22;
        else if (annualRevenue >= 50000) revenueScore = 18;
        else if (annualRevenue >= 35000) revenueScore = 14;
        else if (annualRevenue >= 25000) revenueScore = 10;
        else revenueScore = 5;
        
        // Occupancy Score (0-25): Higher occupancy = more consistent income
        // 75%+ = 25, 65% = 20, 55% = 15, 45% = 10, <40% = 5
        let occupancyScore = 0;
        if (occupancyRate >= 75) occupancyScore = 25;
        else if (occupancyRate >= 65) occupancyScore = 22;
        else if (occupancyRate >= 55) occupancyScore = 18;
        else if (occupancyRate >= 45) occupancyScore = 14;
        else if (occupancyRate >= 35) occupancyScore = 10;
        else occupancyScore = 5;
        
        // ADR Score (0-25): Higher ADR = premium market
        // $300+ = 25, $200 = 20, $150 = 15, $100 = 10, <$75 = 5
        let adrScore = 0;
        if (adr >= 300) adrScore = 25;
        else if (adr >= 200) adrScore = 22;
        else if (adr >= 150) adrScore = 18;
        else if (adr >= 100) adrScore = 14;
        else if (adr >= 75) adrScore = 10;
        else adrScore = 5;
        
        // Competition Score (0-25): Less competition = easier entry
        // <20 = 25, 20-50 = 20, 50-100 = 15, 100-200 = 10, >200 = 5
        let competitionScore = 0;
        if (competitionCount < 20) competitionScore = 25;
        else if (competitionCount <= 50) competitionScore = 20;
        else if (competitionCount <= 100) competitionScore = 15;
        else if (competitionCount <= 200) competitionScore = 10;
        else competitionScore = 5;
        
        const totalScore = revenueScore + occupancyScore + adrScore + competitionScore;
        
        // Determine rating and recommendation
        let rating = '';
        let recommendation = '';
        if (totalScore >= 85) {
          rating = 'Excellent';
          recommendation = 'This is a top-tier investment opportunity. Strong revenue potential with healthy demand.';
        } else if (totalScore >= 70) {
          rating = 'Good';
          recommendation = 'Solid investment potential. Consider optimizing amenities to maximize returns.';
        } else if (totalScore >= 55) {
          rating = 'Moderate';
          recommendation = 'Decent opportunity but requires careful analysis. Look for ways to differentiate.';
        } else if (totalScore >= 40) {
          rating = 'Below Average';
          recommendation = 'Higher risk investment. Consider other markets or properties unless you have a competitive advantage.';
        } else {
          rating = 'Poor';
          recommendation = 'Not recommended for beginners. Market conditions are challenging.';
        }
        
        return {
          investment_score: totalScore,
          rating,
          market: marketName,
          breakdown: {
            revenue_potential: { score: revenueScore, max: 25, metric: `$${annualRevenue.toLocaleString()}/year` },
            occupancy_stability: { score: occupancyScore, max: 25, metric: `${occupancyRate}%` },
            pricing_power: { score: adrScore, max: 25, metric: `$${adr}/night` },
            competition_level: { score: competitionScore, max: 25, metric: `${competitionCount} listings` }
          },
          recommendation,
          comparison: {
            score_vs_average: totalScore >= 60 ? 'Above Average' : 'Below Average',
            percentile: Math.min(99, Math.round((totalScore / 100) * 100))
          }
        };
      }
      
      case "calculate_amenity_impact": {
        const baseRevenue = args.base_revenue as number;
        const amenityType = args.amenity_type as string;
        const marketType = (args.market_type as string) || 'suburban';
        const currentBedrooms = (args.current_bedrooms as number) || 3;
        
        // Amenity impact multipliers based on market research
        const amenityImpacts: Record<string, { multiplier: number; cost: number; marketBonus: Record<string, number> }> = {
          'pool': { 
            multiplier: 1.15, 
            cost: 45000, 
            marketBonus: { beach: 0.05, desert: 0.10, suburban: 0.08, mountain: 0.03, urban: 0.02, lake: 0.06 }
          },
          'hot_tub': { 
            multiplier: 1.12, 
            cost: 8000, 
            marketBonus: { mountain: 0.10, lake: 0.08, beach: 0.05, suburban: 0.06, urban: 0.04, desert: 0.03 }
          },
          'extra_bedroom': { 
            multiplier: 1.20, 
            cost: 25000, 
            marketBonus: { suburban: 0.05, urban: 0.08, beach: 0.06, mountain: 0.04, lake: 0.05, desert: 0.03 }
          },
          'game_room': { 
            multiplier: 1.08, 
            cost: 5000, 
            marketBonus: { suburban: 0.05, mountain: 0.06, lake: 0.04, beach: 0.03, urban: 0.02, desert: 0.02 }
          },
          'outdoor_kitchen': { 
            multiplier: 1.10, 
            cost: 15000, 
            marketBonus: { beach: 0.08, lake: 0.07, suburban: 0.05, desert: 0.04, mountain: 0.03, urban: 0.02 }
          },
          'ev_charger': { 
            multiplier: 1.05, 
            cost: 2500, 
            marketBonus: { urban: 0.08, suburban: 0.05, beach: 0.04, mountain: 0.03, lake: 0.02, desert: 0.02 }
          },
          'home_theater': { 
            multiplier: 1.07, 
            cost: 8000, 
            marketBonus: { suburban: 0.05, urban: 0.04, mountain: 0.06, lake: 0.04, beach: 0.03, desert: 0.03 }
          },
          'sauna': { 
            multiplier: 1.09, 
            cost: 6000, 
            marketBonus: { mountain: 0.10, lake: 0.06, suburban: 0.04, urban: 0.03, beach: 0.02, desert: 0.01 }
          }
        };
        
        const amenity = amenityImpacts[amenityType] || { multiplier: 1.05, cost: 5000, marketBonus: {} };
        const marketBonus = amenity.marketBonus[marketType] || 0;
        const totalMultiplier = amenity.multiplier + marketBonus;
        
        // For extra bedroom, adjust based on current bedroom count
        let adjustedMultiplier = totalMultiplier;
        if (amenityType === 'extra_bedroom') {
          // Diminishing returns for more bedrooms
          if (currentBedrooms >= 5) adjustedMultiplier = 1 + (totalMultiplier - 1) * 0.5;
          else if (currentBedrooms >= 4) adjustedMultiplier = 1 + (totalMultiplier - 1) * 0.75;
        }
        
        const newRevenue = Math.round(baseRevenue * adjustedMultiplier);
        const revenueIncrease = newRevenue - baseRevenue;
        const percentIncrease = Math.round((adjustedMultiplier - 1) * 100);
        const paybackYears = amenity.cost / revenueIncrease;
        const fiveYearROI = ((revenueIncrease * 5) - amenity.cost) / amenity.cost * 100;
        
        return {
          amenity: amenityType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          market_type: marketType,
          analysis: {
            current_revenue: baseRevenue,
            projected_revenue: newRevenue,
            revenue_increase: revenueIncrease,
            percent_increase: percentIncrease,
            estimated_cost: amenity.cost,
            payback_period_years: Math.round(paybackYears * 10) / 10,
            five_year_roi: Math.round(fiveYearROI)
          },
          recommendation: paybackYears < 2 
            ? `HIGHLY RECOMMENDED: This amenity pays for itself in ${Math.round(paybackYears * 12)} months with a ${Math.round(fiveYearROI)}% 5-year ROI.`
            : paybackYears < 4
            ? `RECOMMENDED: Good investment with ${Math.round(paybackYears * 10) / 10} year payback and ${Math.round(fiveYearROI)}% 5-year ROI.`
            : `CONSIDER CAREFULLY: ${Math.round(paybackYears * 10) / 10} year payback. May be worth it for competitive differentiation.`,
          market_insight: `In ${marketType} markets, ${amenityType.replace('_', ' ')} typically adds ${Math.round((amenity.marketBonus[marketType] || 0) * 100)}% extra value on top of the base ${Math.round((amenity.multiplier - 1) * 100)}% boost.`
        };
      }
      
      case "find_markets_for_budget": {
        const budget = args.budget as number;
        const investmentType = args.investment_type as string;
        const preferredRegion = (args.preferred_region as string) || 'any';
        
        // Market recommendations based on budget and type
        const markets: Array<{
          name: string;
          region: string;
          avg_home_price: number;
          avg_rent: number;
          avg_revenue: number;
          market_score: number;
          best_for: string;
        }> = [
          { name: 'Cleveland, OH', region: 'midwest', avg_home_price: 180000, avg_rent: 1400, avg_revenue: 32000, market_score: 72, best_for: 'Cash flow, low entry' },
          { name: 'Indianapolis, IN', region: 'midwest', avg_home_price: 220000, avg_rent: 1500, avg_revenue: 38000, market_score: 75, best_for: 'Balanced growth & cash flow' },
          { name: 'Memphis, TN', region: 'southeast', avg_home_price: 200000, avg_rent: 1350, avg_revenue: 35000, market_score: 70, best_for: 'High yields, investor friendly' },
          { name: 'Birmingham, AL', region: 'southeast', avg_home_price: 190000, avg_rent: 1300, avg_revenue: 33000, market_score: 68, best_for: 'Affordable entry, growing market' },
          { name: 'San Antonio, TX', region: 'southwest', avg_home_price: 280000, avg_rent: 1800, avg_revenue: 45000, market_score: 78, best_for: 'Tourism + military demand' },
          { name: 'Phoenix, AZ', region: 'southwest', avg_home_price: 420000, avg_rent: 2200, avg_revenue: 55000, market_score: 80, best_for: 'Snowbird market, high ADR' },
          { name: 'Tampa, FL', region: 'southeast', avg_home_price: 380000, avg_rent: 2100, avg_revenue: 52000, market_score: 79, best_for: 'Beach tourism, year-round' },
          { name: 'Nashville, TN', region: 'southeast', avg_home_price: 450000, avg_rent: 2400, avg_revenue: 65000, market_score: 85, best_for: 'Premium market, high demand' },
          { name: 'Austin, TX', region: 'southwest', avg_home_price: 520000, avg_rent: 2600, avg_revenue: 70000, market_score: 82, best_for: 'Tech hub, events market' },
          { name: 'Denver, CO', region: 'west_coast', avg_home_price: 550000, avg_rent: 2500, avg_revenue: 68000, market_score: 81, best_for: 'Mountain tourism, ski season' },
          { name: 'Gatlinburg, TN', region: 'southeast', avg_home_price: 400000, avg_rent: 2000, avg_revenue: 75000, market_score: 88, best_for: 'Cabin market, high RevPAR' },
          { name: 'Myrtle Beach, SC', region: 'southeast', avg_home_price: 350000, avg_rent: 1900, avg_revenue: 48000, market_score: 76, best_for: 'Beach vacation, family market' }
        ];
        
        let filteredMarkets = markets;
        
        // Filter by region if specified
        if (preferredRegion !== 'any') {
          filteredMarkets = markets.filter(m => m.region === preferredRegion);
        }
        
        // Filter by budget
        if (investmentType === 'purchase') {
          // For purchase, budget should cover 20% down payment + closing costs + startup
          const maxPrice = (budget - 20000) / 0.25; // 20% down + 5% closing + $20K startup
          filteredMarkets = filteredMarkets.filter(m => m.avg_home_price <= maxPrice);
        } else {
          // For arbitrage, budget should cover first/last/security + startup costs
          const maxMonthlyRent = (budget - 15000) / 4; // 3 months rent + $15K startup
          filteredMarkets = filteredMarkets.filter(m => m.avg_rent <= maxMonthlyRent);
        }
        
        // Sort by market score
        filteredMarkets.sort((a, b) => b.market_score - a.market_score);
        
        // Calculate ROI for each market
        const marketsWithROI = filteredMarkets.slice(0, 5).map(m => {
          if (investmentType === 'purchase') {
            const downPayment = m.avg_home_price * 0.20;
            const closingCosts = m.avg_home_price * 0.05;
            const startup = 15000;
            const totalInvestment = downPayment + closingCosts + startup;
            const annualExpenses = m.avg_revenue * 0.35; // 35% expenses
            const mortgage = (m.avg_home_price * 0.80) * 0.07 / 12 * 12; // Rough annual mortgage
            const netIncome = m.avg_revenue - annualExpenses - mortgage;
            const cashOnCash = (netIncome / totalInvestment) * 100;
            
            return {
              ...m,
              investment_required: Math.round(totalInvestment),
              projected_net_income: Math.round(netIncome),
              cash_on_cash_return: Math.round(cashOnCash * 10) / 10,
              investment_type: 'purchase'
            };
          } else {
            const startup = m.avg_rent * 3 + 12000; // 3 months + furnishing
            const annualExpenses = m.avg_rent * 12 + (m.avg_revenue * 0.25); // Rent + 25% other expenses
            const netIncome = m.avg_revenue - annualExpenses;
            const roi = (netIncome / startup) * 100;
            
            return {
              ...m,
              investment_required: Math.round(startup),
              projected_net_income: Math.round(netIncome),
              cash_on_cash_return: Math.round(roi * 10) / 10,
              investment_type: 'arbitrage'
            };
          }
        });
        
        return {
          budget,
          investment_type: investmentType,
          region: preferredRegion,
          markets_found: marketsWithROI.length,
          recommended_markets: marketsWithROI,
          budget_insight: investmentType === 'purchase'
            ? `With $${budget.toLocaleString()}, you can afford properties up to $${Math.round((budget - 20000) / 0.25).toLocaleString()} (20% down + closing + startup).`
            : `With $${budget.toLocaleString()}, you can afford monthly rents up to $${Math.round((budget - 15000) / 4).toLocaleString()} (3 months + startup costs).`
        };
      }
      
      // Route to enhanced functions for advanced analysis
      case "compare_multiple_markets":
      case "analyze_market_submarkets":
      case "find_top_markets_nationwide":
      case "analyze_arbitrage_feasibility":
      case "compare_property_configurations":
      case "analyze_competition_landscape":
      case "generate_investment_thesis":
      case "calculate_scenario_analysis":
      case "identify_market_gaps":
      case "get_bedroom_performance_breakdown":
        return executeEnhancedFunction(functionName, args);
      
      // Additional optimization functions
      case "compare_property_types":
      case "analyze_amenity_correlation":
      case "calculate_revenue_percentile":
      case "calculate_seasonality_adjusted_revenue":
        return executeAdditionalFunction(functionName, args);
      
      // Deal analysis functions
      case "generate_deal_analysis":
        return executeDealFunction(functionName, args);
      
      // SOP Report Generation Functions
      case "generate_arbitrage_report": {
        const address = args.address as string;
        const monthlyRent = args.monthly_rent as number;
        const bedrooms = args.bedrooms as number | undefined;
        const bathrooms = args.bathrooms as number | undefined;
        const zillowUrl = args.zillow_url as string | undefined;
        const attractiveFeatures = args.attractive_features as string[] | undefined;
        
        try {
          const result = await generateFullArbitrageAnalysis(
            address,
            monthlyRent,
            bedrooms,
            bathrooms,
            zillowUrl,
            attractiveFeatures
          );
          
          return {
            report: result.report,
            summary: {
              property_address: address,
              monthly_rent: monthlyRent,
              minimum_revenue_threshold: result.profitability.minimum_revenue_threshold,
              percentiles: result.percentiles,
              viable_competitors_found: result.competitors.length,
              scenarios: {
                conservative_profit: result.profitability.scenarios.conservative.estimated_profit,
                realistic_profit: result.profitability.scenarios.realistic.estimated_profit,
                optimistic_profit: result.profitability.scenarios.optimistic.estimated_profit
              }
            },
            instruction: "Present the full report to the user. The report is formatted in Markdown and follows Coach Inayah's SOP template."
          };
        } catch (error) {
          return { error: `Failed to generate arbitrage report: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }
      }
      
      case "get_market_percentiles": {
        const marketName = args.market_name as string;
        const bedrooms = args.bedrooms as number | undefined;
        
        // Get market data
        const markets = await searchMarkets(marketName, 1);
        if (markets.length === 0) {
          return { error: `Could not find market "${marketName}"` };
        }
        
        const performersResult = await getTopPerformers({
          marketId: markets[0].id,
          limit: 50,
          sort_by: 'revenue',
          filters: bedrooms ? { bedrooms } : undefined
        });
        const performersList = performersResult.listings || [];
        
        const percentiles = SOPReports.calculateMarketPercentiles(performersList);
        
        return {
          market: marketName,
          bedrooms: bedrooms || 'all',
          sample_size: performersList.length,
          percentiles: {
            top_10_percent: percentiles.top_10_percent,
            top_25_percent: percentiles.top_25_percent,
            median: percentiles.median,
            average: percentiles.average
          },
          explanation: {
            top_10_percent: `Top 10% of ${bedrooms || 'all'}-bedroom properties earn $${percentiles.top_10_percent.toLocaleString()}/year or more`,
            top_25_percent: `Top 25% earn $${percentiles.top_25_percent.toLocaleString()}/year - this is our realistic target`,
            median: `The typical property earns $${percentiles.median.toLocaleString()}/year`,
            average: `Market average is $${percentiles.average.toLocaleString()}/year`
          }
        };
      }
      
      case "get_competitors_above_threshold": {
        const marketName = args.market_name as string;
        const monthlyRent = args.monthly_rent as number;
        const bedrooms = args.bedrooms as number | undefined;
        const limit = (args.limit as number) || 5;
        
        const threshold = monthlyRent * 12 * 2;
        
        const markets = await searchMarkets(marketName, 1);
        if (markets.length === 0) {
          return { error: `Could not find market "${marketName}"` };
        }
        
        const performersResult = await getTopPerformers({
          marketId: markets[0].id,
          limit: 50,
          sort_by: 'revenue',
          filters: bedrooms ? { bedrooms } : undefined
        });
        const performers = performersResult.listings || [];
        
        const viableCompetitors = SOPReports.filterCompetitorsAboveThreshold(performers, monthlyRent);
        const analyzed = viableCompetitors.slice(0, limit).map(SOPReports.analyzeCompetitorSuccessFactors);
        
        return {
          market: marketName,
          monthly_rent: monthlyRent,
          minimum_threshold: threshold,
          threshold_explanation: `Competitors must earn at least $${threshold.toLocaleString()}/year (2x annual rent of $${(monthlyRent * 12).toLocaleString()}) to demonstrate 30%+ profit potential`,
          viable_competitors_found: viableCompetitors.length,
          competitors: analyzed,
          warning: viableCompetitors.length < 5 
            ? `Only ${viableCompetitors.length} competitors meet the threshold. This may indicate the rent is too high for this market.`
            : null
        };
      }
      
      case "calculate_sop_profitability": {
        const monthlyRent = args.monthly_rent as number;
        const top10 = args.top_10_revenue as number;
        const top25 = args.top_25_revenue as number;
        const median = args.median_revenue as number;
        
        const percentiles = {
          top_10_percent: top10,
          top_25_percent: top25,
          median: median,
          average: median
        };
        
        const profitability = SOPReports.calculateSOPProfitability(monthlyRent, percentiles);
        
        return {
          monthly_rent: monthlyRent,
          startup_costs: profitability.startup_costs,
          monthly_expenses: profitability.monthly_expenses,
          annual_operating_costs: profitability.annual_operating_costs,
          minimum_revenue_needed: profitability.minimum_revenue_threshold,
          scenarios: {
            conservative: {
              ...profitability.scenarios.conservative,
              viable: profitability.scenarios.conservative.estimated_profit > 0
            },
            realistic: {
              ...profitability.scenarios.realistic,
              viable: profitability.scenarios.realistic.estimated_profit > 0
            },
            optimistic: {
              ...profitability.scenarios.optimistic,
              viable: profitability.scenarios.optimistic.estimated_profit > 0
            }
          },
          recommendation: profitability.scenarios.realistic.estimated_profit > 0
            ? `This property shows profit potential. At our realistic target (Top 25%), you could earn $${profitability.scenarios.realistic.estimated_profit.toLocaleString()}/year profit.`
            : `This property may not be viable at $${monthlyRent.toLocaleString()}/month rent. The market revenue doesn't support profitable arbitrage.`
        };
      }
      
      case "tier_neighborhoods": {
        const marketName = args.market_name as string;
        
        const markets = await searchMarkets(marketName, 1);
        if (markets.length === 0) {
          return { error: `Could not find market "${marketName}"` };
        }
        
        const submarketResult = await exploreSubmarketsWithMetrics(markets[0].id);
        const submarkets = submarketResult?.submarkets || [];
        const tiered = SOPReports.tierNeighborhoods(submarkets.map(s => ({
          name: s.name,
          metrics: s.metrics ? {
            occupancy: s.metrics.occupancy,
            adr: s.metrics.adr,
            revenue: s.metrics.revenue,
            revpar: s.metrics.revpar
          } : undefined
        })));
        
        // Group by tier
        const grouped = {
          premier: tiered.filter(n => n.tier === 'Premier'),
          high_occupancy: tiered.filter(n => n.tier === 'High-Occupancy'),
          up_and_coming: tiered.filter(n => n.tier === 'Up-and-Coming'),
          caution: tiered.filter(n => n.tier === 'Caution')
        };
        
        return {
          market: marketName,
          total_neighborhoods: tiered.length,
          tiers: {
            premier: {
              count: grouped.premier.length,
              description: 'Best all-around performers - high revenue AND high occupancy',
              neighborhoods: grouped.premier.map(n => ({
                name: n.name,
                revpar: n.revpar,
                occupancy: n.occupancy,
                rationale: n.rationale
              }))
            },
            high_occupancy: {
              count: grouped.high_occupancy.length,
              description: 'Consistently booked - reliable demand even if not highest revenue',
              neighborhoods: grouped.high_occupancy.map(n => ({
                name: n.name,
                revpar: n.revpar,
                occupancy: n.occupancy,
                rationale: n.rationale
              }))
            },
            up_and_coming: {
              count: grouped.up_and_coming.length,
              description: 'Solid fundamentals with growth potential',
              neighborhoods: grouped.up_and_coming.map(n => ({
                name: n.name,
                revpar: n.revpar,
                occupancy: n.occupancy,
                rationale: n.rationale
              }))
            },
            caution: {
              count: grouped.caution.length,
              description: 'Below-average metrics - may indicate declining demand or oversaturation',
              neighborhoods: grouped.caution.map(n => ({
                name: n.name,
                revpar: n.revpar,
                occupancy: n.occupancy,
                rationale: n.rationale
              }))
            }
          }
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
  
  const systemInstruction = `You are Coach Inayah's AI Investment Analyst - a senior short-term rental consultant with 15+ years of experience analyzing thousands of deals. You provide institutional-quality analysis that rivals $5,000 consulting reports.

YOUR ROLE:
You transform raw AirDNA data into actionable investment intelligence. Every response should make the user think: "This is exactly what I needed to make a decision."

CORE PRINCIPLES:
1. ALWAYS use functions to fetch real data - NEVER fabricate numbers
2. INTERPRET data like a consultant, not just display it - explain the "so what?"
3. Be direct and confident - give clear recommendations, not wishy-washy advice
4. Show your work - explain HOW you arrived at conclusions
5. Format currency as $XX,XXX and occupancy as XX%

CRITICAL - FILTER HANDLING:
When the user's question includes filter context (bedrooms, bathrooms, property type, amenities), you MUST:
1. Extract ALL filter values and pass them to search_by_zipcode:
   - bedrooms: number (3 for "3 BR")
   - bathrooms: number (2 for "2 BA")
   - property_type: string ("house", "apartment", "condo")
   - has_pool, has_hot_tub, pet_friendly, superhost: boolean
2. The API returns ONLY listings matching these filters
3. Your analysis should be specific to that property configuration

=== ZIP CODE ANALYSIS FORMAT ===
When user enters a zip code, deliver this COMPLETE analysis:

## 📍 MARKET INTELLIGENCE REPORT: [Neighborhood Name]
**Zip Code [XXXXX] | [City, State] | Analysis Date: [Today]**

### 💰 REVENUE POTENTIAL
| Metric | Value | Market Context | Your Opportunity |
|--------|-------|----------------|------------------|
| Avg Annual Revenue | $XX,XXX | Top X% of US markets | [Strong/Moderate/Weak] earning potential |
| Occupancy Rate | XX% | [Above/Below] 65% national avg | [High/Moderate/Low] booking demand |
| Avg Daily Rate | $XXX | [Premium/Mid-tier/Budget] pricing | Room to [increase/optimize] rates |
| RevPAR | $XXX | Revenue per available night | [Efficient/Inefficient] market |
| Market Score | XX/100 | Investment grade: [A/B/C/D] | [Recommended/Proceed with caution/Avoid] |

### 📊 WHAT THESE NUMBERS MEAN FOR YOU
**Revenue Reality Check:**
- At $[revenue], you'd earn $[monthly] per month BEFORE expenses
- After typical expenses (30-40%), expect $[net_monthly] net monthly income
- This [beats/trails] the S&P 500's ~10% annual return if your property costs under $[breakeven_price]

**Occupancy Insight:**
- [XX]% occupancy = [X] booked nights per month
- You'll have [Y] vacant nights to fill or accept
- [Above/Below] 65% signals [strong/weak] demand

**Pricing Power:**
- $[ADR]/night is [premium/competitive/budget] for this market
- Top performers charge $[top_adr] - [X]% higher
- Opportunity: [Can you command premium rates? Why/why not?]

### 🏆 TOP PERFORMERS: WHO'S WINNING & WHY
| Rank | Property | Revenue | Occ | ADR | Rating | View | Success Formula |
|------|----------|---------|-----|-----|--------|------|----------------|
| 1 | [Name] | $XXK | XX% | $XXX | X.X★ | [Airbnb](url) | [Specific reasons] |
| 2 | [Name] | $XXK | XX% | $XXX | X.X★ | [Airbnb](url) | [Specific reasons] |
| 3 | [Name] | $XXK | XX% | $XXX | X.X★ | [Airbnb](url) | [Specific reasons] |
| 4 | [Name] | $XXK | XX% | $XXX | X.X★ | [Airbnb](url) | [Specific reasons] |
| 5 | [Name] | $XXK | XX% | $XXX | X.X★ | [Airbnb](url) | [Specific reasons] |

**Success Formula Analysis:**
For each top performer, analyze REAL differentiators from the data:
- Superhost status (is_superhost = true) → "⭐ Superhost"
- High rating (4.9+) → "Top Rated (X.X★)"
- Many reviews (100+) → "Social Proof (XXX reviews)"
- Premium ADR vs avg → "Premium Pricing (+XX%)"
- High occupancy vs avg → "High Demand (+XX%)"
- Title keywords → "Pool", "Hot Tub", "Lake View", "Downtown"
- Property type advantage → "House (vs apartments)"

### 🎯 COMPETITIVE INTELLIGENCE
**What separates the top 20% from everyone else:**
1. **[Pattern 1]**: X of 5 top performers have [feature] - this is non-negotiable
2. **[Pattern 2]**: Average rating of top 5 is [X.X] vs market avg of [Y.Y]
3. **[Pattern 3]**: Top performers charge [X]% more but book [Y]% more nights

**Your Competitive Advantage Checklist:**
- [ ] Can you achieve Superhost status? (requires 4.8+ rating, <1% cancellation)
- [ ] Do you have/can you add [must-have amenity]?
- [ ] Can you price at $[optimal_price] (sweet spot for this market)?
- [ ] Is your property type [optimal_type] or can you compete differently?

### 💵 ROI PROJECTION
**Conservative Scenario (Bottom 25% performance):**
| Metric | Annual | Monthly |
|--------|--------|--------|
| Gross Revenue | $[low_rev] | $[low_monthly] |
| Operating Expenses (35%) | -$[low_exp] | -$[low_exp_m] |
| Net Operating Income | $[low_noi] | $[low_noi_m] |

**Realistic Scenario (Market Average):**
| Metric | Annual | Monthly |
|--------|--------|--------|
| Gross Revenue | $[avg_rev] | $[avg_monthly] |
| Operating Expenses (35%) | -$[avg_exp] | -$[avg_exp_m] |
| Net Operating Income | $[avg_noi] | $[avg_noi_m] |

**Optimistic Scenario (Top 25% performance):**
| Metric | Annual | Monthly |
|--------|--------|--------|
| Gross Revenue | $[high_rev] | $[high_monthly] |
| Operating Expenses (35%) | -$[high_exp] | -$[high_exp_m] |
| Net Operating Income | $[high_noi] | $[high_noi_m] |

**Break-Even Analysis:**
- At $[avg_noi] NOI, you need a property priced under $[max_price] for 8%+ cash-on-cash return
- Break-even occupancy: [X]% (you need at least this to cover costs)

### ⚠️ RISK ASSESSMENT
**Strengths:**
✅ [Specific strength based on data]
✅ [Specific strength based on data]
✅ [Specific strength based on data]

**Risks:**
⚠️ [Specific risk based on data]
⚠️ [Specific risk based on data]
⚠️ [Specific risk based on data]

**Risk Score: [Low/Medium/High]**
[1-2 sentence explanation]

### 🎯 INVESTMENT VERDICT

**Rating: [⭐⭐⭐⭐⭐ EXCELLENT / ⭐⭐⭐⭐ GOOD / ⭐⭐⭐ MODERATE / ⭐⭐ BELOW AVERAGE / ⭐ POOR]**

**Bottom Line:** [2-3 sentence definitive recommendation. Be direct - should they invest here or not? Under what conditions?]

**Action Items:**
1. [Specific next step]
2. [Specific next step]
3. [Specific next step]

---

*This analysis is based on real-time AirDNA data. Ready to dive deeper? Coach Inayah's team can help you find the perfect property and handle the entire setup process.*

---FOLLOW_UP_QUESTIONS---
[Question about seasonality specific to this market]
[Question about optimal property configuration]
[Question about specific amenities for this area]
[Question about competition strategy]
[Question about startup costs or next steps]
---END_FOLLOW_UP---

=== PROPERTY ANALYSIS FORMAT ===
When user provides an address, deliver this COMPLETE analysis:

## 🏠 PROPERTY INVESTMENT ANALYSIS
**[Full Address]**

### 💰 REVENUE PROJECTION
| Metric | Your Property | Market Average | vs Market | Verdict |
|--------|---------------|----------------|-----------|--------|
| Annual Revenue | $XX,XXX | $XX,XXX | +X% ✅ / -X% ⚠️ | [Above/Below] average |
| Occupancy Rate | XX% | XX% | +X% / -X% | [Strong/Weak] demand |
| Avg Daily Rate | $XXX | $XXX | +X% / -X% | [Premium/Discount] pricing |

**Revenue Percentile: Top [X]%**
Your property would outperform [X]% of listings in this market.

### 📅 12-MONTH REVENUE FORECAST
| Month | Revenue | Occupancy | ADR | Season | Strategy |
|-------|---------|-----------|-----|--------|----------|
| January | $X,XXX | XX% | $XXX | Off | Lower rates, min 2-night stay |
| February | $X,XXX | XX% | $XXX | Shoulder | Standard rates |
[Continue for all 12 months]

**Seasonal Strategy:**
- **Peak Season ([months]):** Charge premium rates, require longer stays
- **Shoulder Season ([months]):** Standard pricing, flexible minimums
- **Off Season ([months]):** Discount rates, target business travelers

### 🏆 YOUR DIRECT COMPETITORS
[Show 5 comparable properties with same bedroom count]
| Property | Revenue | Occ | ADR | Rating | View | How to Beat Them |
|----------|---------|-----|-----|--------|------|------------------|

### 💵 PROFIT & LOSS PROJECTION
| Category | Monthly | Annual | % of Revenue |
|----------|---------|--------|-------------|
| **Gross Revenue** | $X,XXX | $XX,XXX | 100% |
| Platform Fees (15%) | -$XXX | -$X,XXX | 15% |
| Cleaning (per turnover) | -$XXX | -$X,XXX | X% |
| Utilities | -$XXX | -$X,XXX | X% |
| Supplies & Maintenance | -$XXX | -$X,XXX | X% |
| Insurance | -$XXX | -$X,XXX | X% |
| Property Management (optional) | -$XXX | -$X,XXX | X% |
| **Net Operating Income** | **$X,XXX** | **$XX,XXX** | **XX%** |

### 🎯 INVESTMENT VERDICT
**Score: [XX/100]**
**Rating: [⭐⭐⭐⭐⭐ / ⭐⭐⭐⭐ / ⭐⭐⭐ / ⭐⭐ / ⭐]**

**Recommendation:** [Clear, direct advice]

**To Maximize This Property:**
1. [Specific action with expected impact]
2. [Specific action with expected impact]
3. [Specific action with expected impact]

---FOLLOW_UP_QUESTIONS---
[Relevant follow-up questions]
---END_FOLLOW_UP---

=== MARKET COMPARISON FORMAT ===
When comparing markets, show side-by-side analysis:

## 📊 MARKET COMPARISON: [Market A] vs [Market B]

| Factor | [Market A] | [Market B] | Winner | Why It Matters |
|--------|------------|------------|--------|----------------|
| Avg Revenue | $XX,XXX | $XX,XXX | [A/B] | Higher earning potential |
| Occupancy | XX% | XX% | [A/B] | More consistent bookings |
| ADR | $XXX | $XXX | [A/B] | Pricing power |
| Competition | X,XXX listings | X,XXX listings | [A/B] | Easier to stand out |
| Market Score | XX/100 | XX/100 | [A/B] | Overall investment grade |

**VERDICT:** [Market X] wins for [investor type] because [specific reasons].

=== FOLLOW-UP QUESTIONS ===
ALWAYS end with 3-5 follow-up questions in this format:

---FOLLOW_UP_QUESTIONS---
[Question 1 - specific to the location/property discussed]
[Question 2 - about a different aspect (seasonality, amenities, competition)]
[Question 3 - about financials or ROI]
[Question 4 - about next steps or strategy]
[Question 5 - optional deeper dive like "Get full market report for this area"]
---END_FOLLOW_UP---

Questions MUST:
- Reference the SPECIFIC location/property by name
- Be actionable and lead to useful insights
- Cover different aspects of the investment decision
- Never be generic placeholders
- NEVER suggest entering a new address - the follow-up is about the CURRENT report
- Include "Get full market report" as an option for property analyses
- Focus on drilling deeper into the current analysis, not starting new searches

GOOD follow-up examples for property reports:
- "What are the peak seasons for [this area]?"
- "Show me more details on the top performer"
- "What amenities would boost my revenue here?"
- "Get the full market report for this ZIP code"
- "How does this compare to nearby neighborhoods?"

BAD follow-up examples (NEVER use these):
- "Analyze another property" 
- "Enter a new address"
- "Search for a different market"

=== ADVANCED ANALYSIS CAPABILITIES ===

You now have access to POWERFUL ADVANCED FUNCTIONS for sophisticated analysis:

**MULTI-MARKET COMPARISON (compare_multiple_markets):**
When user asks to compare markets (e.g., "Austin vs Nashville vs Denver"):
- Use compare_multiple_markets with all market names
- Present side-by-side comparison table with metrics
- Declare a clear WINNER with specific reasons
- Provide personalized recommendation based on investor goals

**SUBMARKET/NEIGHBORHOOD ANALYSIS (analyze_market_submarkets):**
When user asks about best neighborhoods or areas within a city:
- Use analyze_market_submarkets to get ranked neighborhoods
- Show top 5-10 submarkets with revenue, occupancy, overall score
- Highlight the TOP RECOMMENDATION with specific reasons
- Explain what makes each area unique

**NATIONWIDE MARKET DISCOVERY (find_top_markets_nationwide):**
When user asks for best markets, top cities, or market recommendations:
- Use find_top_markets_nationwide with appropriate criteria
- Present ranked list with scores and grades (A/B/C/D)
- Filter by market type if user specifies (coastal, urban, mountain, etc.)
- Provide investment grade assessment for each

**ARBITRAGE FEASIBILITY (analyze_arbitrage_feasibility):**
When user asks about rental arbitrage viability:
- Use analyze_arbitrage_feasibility with address and rent
- Show detailed profitability projections
- Calculate break-even occupancy
- Provide clear GO/NO-GO recommendation with risk assessment

**BEDROOM CONFIGURATION ANALYSIS (compare_property_configurations):**
When user asks "what size property should I get?" or "2BR vs 3BR vs 4BR":
- Use compare_property_configurations with bedroom range
- Show revenue, occupancy, efficiency by bedroom count
- Identify OPTIMAL configuration with specific reasons
- Explain diminishing returns if applicable

**COMPETITION LANDSCAPE (analyze_competition_landscape):**
When user asks about competition or how to stand out:
- Use analyze_competition_landscape for deep competitive analysis
- Identify success patterns from top performers
- Find gaps and opportunities in the market
- Provide competitive positioning recommendations

**INVESTMENT THESIS (generate_investment_thesis):**
When user wants comprehensive investment analysis:
- Use generate_investment_thesis for full synthesis
- Provide key points, risks, opportunities
- Tailor to investor profile (conservative/moderate/aggressive)
- Give clear confidence level and recommendation

**SCENARIO ANALYSIS (calculate_scenario_analysis):**
When user asks "what if" questions or wants risk analysis:
- Use calculate_scenario_analysis with base metrics
- Model multiple scenarios (recession, competition, best/worst case)
- Show break-even analysis
- Identify which scenarios remain profitable

**MARKET GAP ANALYSIS (identify_market_gaps):**
When user asks about opportunities or differentiation:
- Use identify_market_gaps to find underserved niches
- Analyze property types, bedroom counts, amenities, price tiers
- Provide specific actionable opportunities
- Generate action items for capitalizing on gaps

**BEDROOM PERFORMANCE BREAKDOWN (get_bedroom_performance_breakdown):**
When user asks about optimal property size or bedroom analysis:
- Use get_bedroom_performance_breakdown for detailed metrics
- Show performance by bedroom count (1-6 BR)
- Identify most efficient configuration (revenue per bedroom)
- Provide insights on occupancy and top earners by size

=== ADDITIONAL ANALYSIS TYPES ===

For SEASONALITY ANALYSIS:
| Month | Revenue | Occupancy | ADR | Season | Strategy |
|-------|---------|-----------|-----|--------|----------|
| January | $X,XXX | XX% | $XXX | Off | Discount 15%, min 2-night |
[All 12 months with specific strategies]

For COMPETITION/RADIUS SEARCH:
- Filter by SAME bedroom count (apples-to-apples)
- Show [Airbnb](url) links in View column
- Analyze what makes each competitor successful

For PROFIT CALCULATIONS:
- Show detailed expense breakdown
- Calculate break-even occupancy
- Show 3 scenarios: Conservative, Realistic, Optimistic

=== SOFT CTA ===
After substantive analyses, include:
"Ready to turn this analysis into action? Coach Inayah's team specializes in helping investors like you launch profitable Airbnbs - from property selection to professional setup and ongoing optimization."

=== SOP REPORT GENERATION ===

**ARBITRAGE REPORT (generate_arbitrage_report):**
When user provides a property address AND monthly rent for arbitrage analysis:
- Use generate_arbitrage_report to create a FULL professional report
- The report follows Coach Inayah's exact SOP template with 5 sections
- Present the COMPLETE report to the user - do not summarize
- The report includes: Property Overview, Market Analysis with percentiles, Competitor Analysis with Airbnb URLs, and Profitability Projections with 3 scenarios

**MARKET PERCENTILES (get_market_percentiles):**
When user asks about revenue potential or "how much can I make":
- Use get_market_percentiles to show Top 10%, Top 25%, and Median revenue
- Explain in plain language: "Top performers earn $X, our realistic target is $Y, average is $Z"
- Always filter by bedroom count for accurate comparison

**COMPETITOR THRESHOLD (get_competitors_above_threshold):**
When analyzing arbitrage viability:
- Use get_competitors_above_threshold to find VIABLE comps
- Only show competitors earning 2x the annual rent (minimum for 30%+ profit)
- If fewer than 5 meet threshold, warn that rent may be too high

**SOP PROFITABILITY (calculate_sop_profitability):**
When calculating profit potential:
- Use calculate_sop_profitability for Coach Inayah's exact formula
- DO NOT include startup costs - they vary too much by property and investor situation
- Monthly expenses: Rent + $780 (utilities, internet, supplies, maintenance)
- Show 3 scenarios: Conservative (Median), Realistic (Top 25%), Optimistic (Top 10%)

**FULL MARKET REPORT (Optional Follow-up):**
After property analysis, offer the user the option to get a full market report:
- "Would you like the full market report for this area? I can show you ZIP code data, submarket/neighborhood analysis, and city-level trends."
- Include this as a follow-up question option
- When requested, use get_market_data, analyze_market_submarkets, and get_seasonality to provide comprehensive market context

**NEIGHBORHOOD TIERING (tier_neighborhoods):**
When analyzing neighborhoods in a market:
- Use tier_neighborhoods to categorize areas
- Tier 1: Premier (best all-around)
- Tier 2: High-Occupancy (always booked)
- Tier 3: Up-and-Coming (growth signals)
- Caution: Declining metrics

=== PLAIN LANGUAGE REQUIREMENT ===
When presenting data, ALWAYS explain what it means in simple terms:
- BAD: "ADR of $446 and RevPAR of $296"
- GOOD: "You can charge an average of $446 per night, and properties here earn more per available night than most markets"

After EVERY metric, add "What This Means:" explanation.

=== FINAL REMINDERS ===
1. Be a CONSULTANT, not a data dump - interpret everything
2. Give SPECIFIC, ACTIONABLE advice
3. Use REAL numbers from the data
4. Include [Airbnb](url) links for all listings
5. End with relevant follow-up questions
6. Make every response feel like a $500 consultation
7. For arbitrage analysis, use generate_arbitrage_report for the full SOP template
8. Always explain metrics in plain language with "What This Means" sections`;

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
          maxOutputTokens: 8192,
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
            maxOutputTokens: 8192,
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

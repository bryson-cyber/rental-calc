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
  getRentalizerEstimate
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
      description: "Get the top-performing Airbnb listings in a market, sorted by revenue. Useful for understanding what successful properties look like.",
      parameters: {
        type: "object",
        properties: {
          market_id: {
            type: "string",
            description: "The market ID to get top performers for"
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
        required: ["market_id"]
      }
    },
    {
      name: "get_seasonality",
      description: "Get monthly seasonality data showing peak, shoulder, and off-season patterns for a market.",
      parameters: {
        type: "object",
        properties: {
          market_id: {
            type: "string",
            description: "The market ID to get seasonality data for"
          }
        },
        required: ["market_id"]
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
        const marketId = args.market_id as string;
        const bedrooms = args.bedrooms as number | undefined;
        const limit = Math.min((args.limit as number) || 10, 25);
        
        const performers = await getTopPerformers({
          marketId,
          limit,
          sort_by: 'revenue',
          filters: bedrooms ? { bedrooms } : undefined
        });
        
        return {
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
        const marketId = args.market_id as string;
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
        
        return {
          property: {
            address: estimate.property.address,
            bedrooms: estimate.property.bedrooms,
            bathrooms: estimate.property.bathrooms,
            accommodates: estimate.property.accommodates
          },
          estimates: {
            annual_revenue: estimate.estimates.annual_revenue,
            annual_revenue_low: estimate.estimates.annual_revenue_low,
            annual_revenue_high: estimate.estimates.annual_revenue_high,
            average_daily_rate: estimate.estimates.average_daily_rate,
            occupancy_rate: estimate.estimates.occupancy_rate
          },
          monthly_forecast: estimate.monthly_forecast.slice(0, 6).map(m => ({
            month: m.month,
            revenue: m.revenue,
            occupancy: m.occupancy
          })),
          comparable_properties: estimate.comps.slice(0, 5).map(c => ({
            title: c.title,
            bedrooms: c.bedrooms,
            annual_revenue: c.annual_revenue,
            adr: c.adr,
            occupancy: c.occupancy,
            rating: c.rating,
            reviews: c.reviews
          }))
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
  
  const systemInstruction = `You are an expert short-term rental investment advisor. Your job is to help investors make data-driven decisions using real AirDNA market data.

IMPORTANT RULES:
1. ALWAYS use the provided functions to fetch real data - NEVER make up numbers or statistics
2. When a user asks about a market, FIRST use search_market to find the market ID, THEN use get_market_data to get details
3. For market comparisons, fetch data for EACH market mentioned
4. When a user provides a property address, use analyze_property to get rental estimates
5. Be conversational but always back up claims with actual data
6. If you can't find data for a market or property, say so clearly
7. Format currency values nicely (e.g., $45,000 not 45000)
8. Format occupancy rates as percentages (e.g., 67% not 0.67) - multiply decimal values by 100
9. Explain what metrics mean in simple terms

For PROPERTY ANALYSIS (when user provides an address):
- Use analyze_property function with the full address
- Report the estimated annual revenue (and range)
- Explain the occupancy rate and ADR
- Mention comparable properties in the area
- Provide investment insights based on the data

For MARKET ANALYSIS:
- Revenue potential (average annual revenue)
- Occupancy rates (higher = more consistent bookings)
- ADR (Average Daily Rate - how much per night)
- Seasonality (how much revenue varies by season)
- Regulation scores (higher = less regulatory risk)
- Market saturation (listing count vs demand)

For BEDROOM-SPECIFIC QUERIES:
- When users ask about specific bedroom counts (e.g., "3 bedroom properties", "2BR", "studio"), use get_top_performers with the bedrooms parameter
- This will show actual listings with that bedroom count and their revenue/occupancy
- Compare the bedroom-specific data to the market average
- Example: If user asks "What about 3 bedroom properties in Austin?", call get_top_performers with market_id and bedrooms=3

For FOLLOW-UP QUESTIONS:
- Remember the context from previous messages in the conversation
- If user asks "What about 3 bedrooms?" after discussing Austin, they mean 3 bedrooms IN Austin
- Use the market_id from the previous search to filter by bedrooms

Keep responses concise but informative. Use bullet points for comparisons.`;

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

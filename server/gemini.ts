/**
 * Gemini AI Service for Property Analysis
 * 
 * This service uses Google's Gemini AI to generate educational,
 * easy-to-understand content for rental property analysis reports.
 */

import { ENV } from './_core/env';

// Use Gemini 3 Pro Preview - the most capable model
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
  }>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface InvestmentAdvisorContext {
  markets?: Array<{
    name: string;
    scores: {
      market_score: number;
      investability: number;
      rental_demand: number;
      revenue_growth: number;
      seasonality: number;
      regulation: number;
    };
    metrics: {
      occupancy: number;
      revenue: number;
      adr: number;
    };
    listing_count: number;
  }>;
}

async function callGemini(prompt: string, options?: { maxTokens?: number; temperature?: number; thinkingLevel?: 'low' | 'high' }): Promise<string> {
  const controller = new AbortController();
  // Gemini 3 with thinking enabled can take longer - 3 minute timeout
  const timeoutId = setTimeout(() => controller.abort(), 180000);
  
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${ENV.geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          // Gemini 3 recommends temperature 1.0 for optimal reasoning
          temperature: options?.temperature ?? 1.0,
          maxOutputTokens: options?.maxTokens ?? 8192,
        },
        // Gemini 3 thinking configuration for advanced reasoning
        thinkingConfig: {
          thinkingLevel: options?.thinkingLevel ?? 'high' // Use high for complex property analysis
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data: GeminiResponse = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || '';
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getInvestmentAdvice(
  question: string,
  conversationHistory: ChatMessage[],
  context?: InvestmentAdvisorContext
): Promise<string> {
  // Build context string from market data if available
  let marketContext = '';
  if (context?.markets && context.markets.length > 0) {
    marketContext = `\n\nAvailable Market Data:\n${context.markets.map(m => 
      `- ${m.name}: Score ${m.scores.market_score}/100, Investability ${m.scores.investability}, Demand ${m.scores.rental_demand}, Revenue Growth ${m.scores.revenue_growth}, Seasonality ${m.scores.seasonality}, Regulation ${m.scores.regulation}, Avg Revenue $${m.metrics.revenue.toLocaleString()}, Occupancy ${m.metrics.occupancy}%, ADR $${m.metrics.adr}, ${m.listing_count.toLocaleString()} listings`
    ).join('\n')}`;
  }

  // Build conversation history
  const historyText = conversationHistory.length > 0 
    ? `\n\nConversation History:\n${conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Advisor'}: ${m.content}`).join('\n')}`
    : '';

  const prompt = `You are a short-term rental investment advisor. Your ONLY source of information is the AirDNA market data provided below.

CRITICAL RULE: You MUST ONLY use the AirDNA data provided. Do NOT use general knowledge, assumptions, or external information.

If a user asks about markets or data NOT in the provided dataset:
- Say "I don't have data on that market yet" or "That information isn't in my current dataset"
- Suggest analyzing markets you DO have data for
- Do NOT make up or assume information

Your role:
- Compare markets using ONLY the provided data
- Analyze revenue, occupancy, ADR, seasonality, and investment scores
- Help investors understand what the data shows
- Be conversational but always data-driven

Guidelines:
1. ONLY reference markets in the dataset provided
2. Use specific numbers and percentages from the data
3. If data is missing for a market, say so clearly
4. Keep responses concise (2-4 paragraphs)
5. Use bullet points for market comparisons
6. Explain what each metric means
7. Never provide investment advice beyond what the data shows
${marketContext}${historyText}

User Question: ${question}

Respond based ONLY on the AirDNA data above. If the data doesn't cover the question, say so clearly.`;

  try {
    const response = await callGemini(prompt);
    return response.trim();
  } catch (error) {
    console.error('Error getting investment advice:', error);
    return "I apologize, but I'm having trouble processing your question right now. Please try again in a moment, or feel free to rephrase your question.";
  }
}


export async function generateEnhancedPropertyReport(
  address: string,
  features: Record<string, unknown>
): Promise<string> {
  const prompt = `Generate a brief, professional property analysis for: ${address}
  
Features: ${JSON.stringify(features)}

Provide 2-3 paragraphs highlighting key investment potential.`;

  try {
    return await callGemini(prompt);
  } catch (error) {
    console.error('Error generating property report:', error);
    return 'Unable to generate report at this time.';
  }
}

export async function generateEnhancedMarketReport(
  marketName: string,
  marketData: Record<string, unknown>
): Promise<string> {
  const prompt = `Generate a brief market analysis for ${marketName}:
  
Data: ${JSON.stringify(marketData)}

Provide 2-3 paragraphs on market opportunity, trends, and investment potential.`;

  try {
    return await callGemini(prompt);
  } catch (error) {
    console.error('Error generating market report:', error);
    return 'Unable to generate report at this time.';
  }
}

/**
 * Market Trend Narrator - Converts YoY data into natural language insights
 * Explains what the numbers mean in plain English for beginners
 */
export async function generateMarketTrendNarrative(
  marketData: {
    marketName: string;
    currentYearRevenue: number;
    lastYearRevenue: number;
    yoyChange: number;
    occupancy: number;
    adr: number;
    monthlyData: Array<{
      month: string;
      currentRevenue: number;
      lastYearRevenue: number;
      yoyChange: number;
    }>;
    marketGrade: string;
    marketScore: number;
  }
): Promise<string> {
  const { marketName, currentYearRevenue, lastYearRevenue, yoyChange, occupancy, adr, monthlyData, marketGrade, marketScore } = marketData;
  
  // Identify best and worst performing months
  const sortedMonths = [...monthlyData].sort((a, b) => b.yoyChange - a.yoyChange);
  const bestMonths = sortedMonths.slice(0, 3);
  const worstMonths = sortedMonths.slice(-3).reverse();
  
  const prompt = `You are a friendly real estate investment advisor explaining market trends to someone new to Airbnb investing. Use simple language a third-grader could understand.

Market: ${marketName}
Market Grade: ${marketGrade} (${marketScore}/100)

Annual Performance:
- This Year's Projected Revenue: $${currentYearRevenue.toLocaleString()}
- Last Year's Revenue: $${lastYearRevenue.toLocaleString()}
- Year-over-Year Change: ${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(1)}%
- Current Occupancy: ${occupancy}%
- Average Daily Rate: $${adr}

Best Performing Months (YoY Growth):
${bestMonths.map(m => `- ${m.month}: ${m.yoyChange >= 0 ? '+' : ''}${m.yoyChange.toFixed(1)}% ($${m.currentRevenue.toLocaleString()} vs $${m.lastYearRevenue.toLocaleString()})`).join('\n')}

Slowest Months (YoY Change):
${worstMonths.map(m => `- ${m.month}: ${m.yoyChange >= 0 ? '+' : ''}${m.yoyChange.toFixed(1)}% ($${m.currentRevenue.toLocaleString()} vs $${m.lastYearRevenue.toLocaleString()})`).join('\n')}

Write a 3-4 paragraph analysis that:
1. Explains whether this market is growing, stable, or declining in simple terms
2. Highlights the best times of year to earn money and why
3. Points out any concerning trends or opportunities
4. Gives a simple "bottom line" recommendation

Use phrases like "Think of it this way..." or "In simple terms..." to make it accessible. Avoid jargon. Use specific numbers from the data.`;

  try {
    return await callGemini(prompt);
  } catch (error) {
    console.error('Error generating market trend narrative:', error);
    return 'Unable to generate market trend analysis at this time.';
  }
}

export async function compareMarketsForInvestment(
  markets: Array<{ name: string; scores: Record<string, number>; metrics: Record<string, number> }>,
  investorProfile?: { budget?: number; goals?: string; riskTolerance?: string }
): Promise<string> {
  const marketSummary = markets.map(m => 
    `${m.name}: Score ${m.scores.market_score}/100, Revenue $${m.metrics.revenue}, Occupancy ${m.metrics.occupancy}%`
  ).join('\n');

  const prompt = `Compare these markets for short-term rental investment:

${marketSummary}

${investorProfile ? `Investor Profile: Budget $${investorProfile.budget}, Goals: ${investorProfile.goals}, Risk: ${investorProfile.riskTolerance}` : ''}

Provide a brief comparison with recommendation.`;

  try {
    return await callGemini(prompt);
  } catch (error) {
    console.error('Error comparing markets:', error);
    return 'Unable to compare markets at this time.';
  }
}


/**
 * Comprehensive AI Property Advisor
 * 
 * Takes ALL available AirDNA data and synthesizes it into a clear,
 * actionable analysis that beginners can understand and act on.
 * 
 * This is the main AI feature - it replaces the need to interpret
 * all the technical data by providing a synthesized recommendation.
 */
export interface PropertyAdvisorInput {
  // Property Details
  property: {
    address: string;
    bedrooms: number;
    bathrooms: number;
    accommodates?: number;
    monthlyRent?: number;
  };
  
  // Revenue Projections
  revenue: {
    projected: number;
    low: number;
    high: number;
    adr: number;
    occupancy: number;
  };
  
  // Cash Flow (if rent provided)
  cashFlow?: {
    monthlyRevenue: number;
    monthlyRent: number;
    monthlyProfit: number;
    annualProfit: number;
    profitMargin: number;
  };
  
  // Comparable Properties (competitors)
  comparables: Array<{
    title: string;
    bedrooms: number;
    bathrooms: number;
    revenue: number;
    adr: number;
    occupancy: number;
    rating: number;
    reviews: number;
    distanceMeters?: number;
    isSuperhost?: boolean;
    isProfessionallyManaged?: boolean;
  }>;
  
  // Market Insights
  marketInsights?: {
    professionallyManagedPct: number;
    superhostPct: number;
    avgRating?: number;
    totalListings?: number;
    marketScore?: number;
  };
  
  // Historical Data (YoY comparison)
  historicalData?: {
    yoyChange: number;
    trend: 'up' | 'down' | 'stable';
    months: Array<{
      date: string;
      revenue: number;
      occupancy: number;
      adr: number;
    }>;
  };
  
  // Seasonality (12-month forecast)
  seasonality: Array<{
    month: string;
    revenue: number;
    adr: number;
    occupancy: number;
  }>;
  
  // Market Grade
  marketGrade?: {
    grade: string;
    score: number;
    description: string;
  };
}

export async function generateComprehensivePropertyAdvice(
  input: PropertyAdvisorInput
): Promise<string> {
  const { property, revenue, cashFlow, comparables, marketInsights, historicalData, seasonality, marketGrade } = input;
  
  // Calculate key metrics for the prompt
  const avgCompRevenue = comparables.length > 0 
    ? comparables.reduce((sum, c) => sum + c.revenue, 0) / comparables.length 
    : 0;
  const revenueVsComps = avgCompRevenue > 0 
    ? ((revenue.projected - avgCompRevenue) / avgCompRevenue * 100).toFixed(1) 
    : 'N/A';
  
  const superhostComps = comparables.filter(c => c.isSuperhost).length;
  const professionalComps = comparables.filter(c => c.isProfessionallyManaged).length;
  
  const bestMonths = [...seasonality].sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  const worstMonths = [...seasonality].sort((a, b) => a.revenue - b.revenue).slice(0, 3);
  
  const highRatedComps = comparables.filter(c => c.rating >= 4.8);
  const lowRatedComps = comparables.filter(c => c.rating < 4.5 && c.rating > 0);

  const prompt = `You are an expert short-term rental investment advisor. Your job is to analyze this property opportunity and provide clear, actionable advice that someone new to Airbnb investing can understand and act on.

IMPORTANT RULES:
1. ONLY use the data provided below - do not make assumptions or use external knowledge
2. Be specific with numbers - cite the actual figures from the data
3. Write for a beginner - explain what metrics mean and why they matter
4. Be honest about risks - don't oversell the opportunity
5. Give a clear recommendation at the end

═══════════════════════════════════════════════════════════════════════════════
PROPERTY ANALYSIS DATA
═══════════════════════════════════════════════════════════════════════════════

PROPERTY DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Address: ${property.address}
Bedrooms: ${property.bedrooms} | Bathrooms: ${property.bathrooms}
${property.accommodates ? `Max Guests: ${property.accommodates}` : ''}
${property.monthlyRent ? `Monthly Rent: $${property.monthlyRent.toLocaleString()}` : ''}

REVENUE PROJECTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Projected Annual Revenue: $${revenue.projected.toLocaleString()}
Conservative Estimate: $${revenue.low.toLocaleString()}
Optimistic Estimate: $${revenue.high.toLocaleString()}
Average Daily Rate (ADR): $${revenue.adr.toLocaleString()}
Projected Occupancy: ${revenue.occupancy}%

${cashFlow ? `
CASH FLOW ANALYSIS (Based on $${property.monthlyRent?.toLocaleString()}/month rent)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Monthly Revenue: $${cashFlow.monthlyRevenue.toLocaleString()}
Monthly Rent: $${cashFlow.monthlyRent.toLocaleString()}
Monthly Profit: $${cashFlow.monthlyProfit.toLocaleString()}
Annual Profit: $${cashFlow.annualProfit.toLocaleString()}
Profit Margin: ${cashFlow.profitMargin.toFixed(1)}%
Revenue-to-Rent Ratio: ${(cashFlow.monthlyRevenue / cashFlow.monthlyRent).toFixed(2)}x
` : ''}

MARKET HEALTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${marketGrade ? `Market Grade: ${marketGrade.grade} (${marketGrade.score}/100) - ${marketGrade.description}` : 'Market Grade: Not available'}
${marketInsights ? `
Total Listings in Area: ${marketInsights.totalListings?.toLocaleString() || 'Unknown'}
Professionally Managed: ${marketInsights.professionallyManagedPct.toFixed(1)}%
Superhost Percentage: ${marketInsights.superhostPct.toFixed(1)}%
Average Rating: ${marketInsights.avgRating?.toFixed(2) || 'N/A'}
${marketInsights.marketScore ? `Market Score: ${marketInsights.marketScore}/100` : ''}
` : ''}

${historicalData ? `
YEAR-OVER-YEAR TRENDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YoY Revenue Change: ${historicalData.yoyChange >= 0 ? '+' : ''}${historicalData.yoyChange.toFixed(1)}%
Market Trend: ${historicalData.trend.toUpperCase()}
Historical Data Points: ${historicalData.months.length} months
` : ''}

🏠 COMPETITOR ANALYSIS (${comparables.length} similar properties)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average Competitor Revenue: $${avgCompRevenue.toLocaleString()}
Your Projected Revenue vs Competitors: ${revenueVsComps}%
Superhosts in Area: ${superhostComps} of ${comparables.length} (${(superhostComps/comparables.length*100).toFixed(0)}%)
Professionally Managed: ${professionalComps} of ${comparables.length} (${(professionalComps/comparables.length*100).toFixed(0)}%)
High-Rated Competitors (4.8+): ${highRatedComps.length}
Lower-Rated Competitors (<4.5): ${lowRatedComps.length}

Top 5 Competitors by Revenue:
${comparables.slice(0, 5).map((c, i) => 
  `${i+1}. ${c.title.substring(0, 40)}... | $${c.revenue.toLocaleString()}/yr | ${c.occupancy}% occ | ${c.rating} stars | ${c.reviews} reviews`
).join('\n')}

SEASONALITY (Monthly Revenue Forecast)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Best Months: ${bestMonths.map(m => `${m.month.split('-')[1] || m.month} ($${m.revenue.toLocaleString()})`).join(', ')}
Slowest Months: ${worstMonths.map(m => `${m.month.split('-')[1] || m.month} ($${m.revenue.toLocaleString()})`).join(', ')}
Revenue Variance: ${((Math.max(...seasonality.map(s => s.revenue)) - Math.min(...seasonality.map(s => s.revenue))) / (seasonality.reduce((sum, s) => sum + s.revenue, 0) / seasonality.length) * 100).toFixed(0)}% between peak and slow seasons

Monthly Breakdown:
${seasonality.map(m => `${m.month}: $${m.revenue.toLocaleString()} | ADR $${m.adr} | ${m.occupancy}% occ`).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
YOUR ANALYSIS TASK
═══════════════════════════════════════════════════════════════════════════════

Write a comprehensive analysis with these sections:

## Executive Summary
A 2-3 sentence overview of whether this is a good opportunity and why.

## The Opportunity
- What makes this property attractive (or not)?
- How does the revenue compare to competitors?
- What's the profit potential?

## Key Risks & Challenges
- What could go wrong?
- What competition challenges exist?
- Are there concerning trends in the data?

## Competitive Positioning
- How does this property stack up against competitors?
- What would it take to succeed in this market?
- Is the market saturated or is there room for new listings?

## Seasonality Strategy
- When are the best and worst times to earn?
- How should the owner plan for slow seasons?
- What pricing strategy does the data suggest?

## Bottom Line Recommendation
Give a clear YES, NO, or MAYBE recommendation with specific reasoning based on the data. Include:
- Who this opportunity is best suited for
- Key success factors
- What to watch out for

Remember: Be specific, cite the actual numbers, and write for someone who is new to short-term rental investing.`;

  try {
    const response = await callGemini(prompt, { maxTokens: 8192, temperature: 0.7 });
    return response.trim();
  } catch (error) {
    console.error('Error generating comprehensive property advice:', error);
    return 'Unable to generate property analysis at this time. Please try again.';
  }
}


/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MAXIMUM CAPACITY AI ADVISORS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * These functions maximize Gemini 2.5 Pro's full capacity:
 * - Input: Up to 1,048,576 tokens (1 million)
 * - Output: Up to 65,536 tokens (~50,000 words / 50+ pages)
 * 
 * We send ALL available AirDNA data and request comprehensive analysis.
 */

// Extended timeout for max capacity calls (3 minutes)
async function callGeminiMax(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout
  
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${ENV.geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 65536, // Maximum output capacity
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data: GeminiResponse = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || '';
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Maximum Capacity Property Advisor Input
 * Includes ALL available data from AirDNA
 */
export interface MaxPropertyAdvisorInput {
  // Property Details
  property: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    bedrooms: number;
    bathrooms: number;
    accommodates: number;
    monthlyRent?: number;
    latitude?: number;
    longitude?: number;
  };
  
  // Revenue Projections
  revenue: {
    projected: number;
    low: number;
    high: number;
    adr: number;
    occupancy: number;
    revpar: number;
  };
  
  // Cash Flow Analysis
  cashFlow?: {
    monthlyRevenue: number;
    monthlyRent: number;
    monthlyProfit: number;
    annualProfit: number;
    profitMargin: number;
    breakEvenOccupancy: number;
  };
  
  // ALL Comparables (30+ properties)
  comparables: Array<{
    title: string;
    bedrooms: number;
    bathrooms: number;
    accommodates: number;
    revenue: number;
    adr: number;
    occupancy: number;
    revpar: number;
    rating: number;
    reviews: number;
    distanceMeters?: number;
    isSuperhost: boolean;
    isProfessionallyManaged: boolean;
    propertyType?: string;
    amenities?: string[];
    lastReviewDate?: string;
    listingUrl?: string;
    photoCount?: number;
  }>;
  
  // Market Insights
  marketInsights: {
    professionallyManagedPct: number;
    superhostPct: number;
    avgRating: number;
    totalListings: number;
    marketScore: number;
    investabilityScore?: number;
    rentalDemandScore?: number;
    revenueGrowthScore?: number;
    seasonalityScore?: number;
    regulationScore?: number;
  };
  
  // 24 Months Historical Data
  historicalData: {
    yoyChange: number;
    trend: 'up' | 'down' | 'stable';
    months: Array<{
      date: string;
      revenue: number;
      occupancy: number;
      adr: number;
      revpar: number;
      listingCount?: number;
    }>;
  };
  
  // 12-Month Seasonality Forecast
  seasonality: Array<{
    month: string;
    revenue: number;
    adr: number;
    occupancy: number;
    revpar: number;
    yoyChange?: number;
  }>;
  
  // Market Grade
  marketGrade: {
    grade: string;
    score: number;
    description: string;
    factors: Array<{
      name: string;
      score: number;
      weight: number;
    }>;
  };
  
  // Market Position
  marketPosition: {
    percentile: number;
    rank: number;
    totalListings: number;
    vsAverage: number;
  };
}

/**
 * Generate Maximum Capacity Property Analysis
 * 
 * This is the most comprehensive property analysis possible.
 * It sends ALL available data and requests a full investment report.
 */
export async function generateMaxPropertyAdvice(
  input: MaxPropertyAdvisorInput
): Promise<string> {
  const { property, revenue, cashFlow, comparables, marketInsights, historicalData, seasonality, marketGrade, marketPosition } = input;
  
  // Calculate comprehensive metrics
  const avgCompRevenue = comparables.length > 0 
    ? comparables.reduce((sum, c) => sum + c.revenue, 0) / comparables.length 
    : 0;
  const avgCompOccupancy = comparables.length > 0
    ? comparables.reduce((sum, c) => sum + c.occupancy, 0) / comparables.length
    : 0;
  const avgCompAdr = comparables.length > 0
    ? comparables.reduce((sum, c) => sum + c.adr, 0) / comparables.length
    : 0;
  const avgCompRating = comparables.filter(c => c.rating > 0).length > 0
    ? comparables.filter(c => c.rating > 0).reduce((sum, c) => sum + c.rating, 0) / comparables.filter(c => c.rating > 0).length
    : 0;
  const avgCompReviews = comparables.length > 0
    ? comparables.reduce((sum, c) => sum + c.reviews, 0) / comparables.length
    : 0;
  
  const superhostComps = comparables.filter(c => c.isSuperhost).length;
  const professionalComps = comparables.filter(c => c.isProfessionallyManaged).length;
  const highRatedComps = comparables.filter(c => c.rating >= 4.8);
  const topEarners = [...comparables].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const bottomEarners = [...comparables].sort((a, b) => a.revenue - b.revenue).slice(0, 10);
  
  const bestMonths = [...seasonality].sort((a, b) => b.revenue - a.revenue).slice(0, 4);
  const worstMonths = [...seasonality].sort((a, b) => a.revenue - b.revenue).slice(0, 4);
  
  const revenueVariance = seasonality.length > 0
    ? ((Math.max(...seasonality.map(s => s.revenue)) - Math.min(...seasonality.map(s => s.revenue))) / (seasonality.reduce((sum, s) => sum + s.revenue, 0) / seasonality.length) * 100)
    : 0;

  // Get current date for the report
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Filter comparables to ONLY same bedroom count for apples-to-apples comparison
  const sameBedroomComps = comparables.filter(c => c.bedrooms === property.bedrooms);
  const otherBedroomComps = comparables.filter(c => c.bedrooms !== property.bedrooms);
  
  // Recalculate averages for same-bedroom comparables only
  const sameBRAvgRevenue = sameBedroomComps.length > 0 
    ? Math.round(sameBedroomComps.reduce((sum, c) => sum + c.revenue, 0) / sameBedroomComps.length)
    : avgCompRevenue;
  const sameBRAvgOccupancy = sameBedroomComps.length > 0
    ? sameBedroomComps.reduce((sum, c) => sum + c.occupancy, 0) / sameBedroomComps.length
    : avgCompOccupancy;
  const sameBRAvgAdr = sameBedroomComps.length > 0
    ? Math.round(sameBedroomComps.reduce((sum, c) => sum + c.adr, 0) / sameBedroomComps.length)
    : avgCompAdr;
  
  // Get top earners from SAME bedroom count only
  const sameBRTopEarners = [...sameBedroomComps].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const sameBRBottomEarners = [...sameBedroomComps].sort((a, b) => a.revenue - b.revenue).slice(0, 5);

  const prompt = `You are a world-class RENTAL ARBITRAGE analyst. Your job is to help someone decide if they should RENT this property and sublease it on Airbnb for profit.

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                    RENTAL ARBITRAGE PROPERTY ANALYSIS REPORT
                                           Report Date: ${currentDate}
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

CRITICAL CONTEXT - RENTAL ARBITRAGE MODEL:
This analysis is for RENTAL ARBITRAGE - where someone:
1. Signs a lease to RENT this property (pays monthly rent to landlord)
2. Furnishes and lists it on Airbnb/VRBO
3. Earns short-term rental income from guests
4. Keeps the profit (STR income minus rent and expenses)

This is NOT about purchasing property. Focus on:
- Can the STR revenue cover the monthly rent?
- What's the monthly cash flow after rent?
- Is there enough profit margin to be worth the effort?
- What's the break-even occupancy needed?

IMPORTANT TONE GUIDANCE:
- The user is RESEARCHING this opportunity - they have NOT signed a lease yet
- They don't have the property yet, so you don't know what amenities they'll have
- DO NOT assume they lack amenities or discourage them
- Instead, SHOW THEM what top performers have so they know what to aim for
- Be EDUCATIONAL and ENCOURAGING - "Here's the blueprint for success" not "You can't compete"
- Focus on OPPORTUNITY and HOW TO SUCCEED, not barriers or limitations

CRITICAL INSTRUCTIONS:
1. ONLY use the data provided below - do not make assumptions or use external knowledge
2. ONLY compare to properties with the SAME BEDROOM COUNT (${property.bedrooms}BR) - this is an apples-to-apples comparison
3. Do NOT compare to luxury hotel residences, branded properties, or properties with different bedroom counts
4. Be extremely specific with numbers - cite actual figures from the data
5. Write for someone who is new to Airbnb arbitrage - explain what metrics mean
6. Be honest about risks but also highlight genuine opportunities
7. Focus on CASH FLOW and PROFIT MARGIN, not property appreciation
8. This should be a complete arbitrage analysis that could stand alone

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 1: PROPERTY OVERVIEW
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

PROPERTY DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Address: ${property.address}
City: ${property.city}, ${property.state} ${property.zipCode}
Configuration: ${property.bedrooms} Bedrooms | ${property.bathrooms} Bathrooms | Sleeps ${property.accommodates}
${property.monthlyRent ? `Monthly Rent: $${property.monthlyRent.toLocaleString()}` : 'Monthly Rent: Not specified'}
${property.latitude && property.longitude ? `Coordinates: ${property.latitude}, ${property.longitude}` : ''}

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 2: REVENUE PROJECTIONS
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

PROJECTED EARNINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Annual Revenue (Projected): $${revenue.projected.toLocaleString()}
Annual Revenue (Conservative): $${revenue.low.toLocaleString()}
Annual Revenue (Optimistic): $${revenue.high.toLocaleString()}
Monthly Revenue (Average): $${Math.round(revenue.projected / 12).toLocaleString()}

Key Metrics:
• Average Daily Rate (ADR): $${revenue.adr.toLocaleString()}
• Projected Occupancy Rate: ${revenue.occupancy}%
• Revenue Per Available Room (RevPAR): $${revenue.revpar.toLocaleString()}

${cashFlow ? `
CASH FLOW ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Monthly Revenue: $${cashFlow.monthlyRevenue.toLocaleString()}
Monthly Rent: $${cashFlow.monthlyRent.toLocaleString()}
Monthly Profit: $${cashFlow.monthlyProfit.toLocaleString()}
Annual Profit: $${cashFlow.annualProfit.toLocaleString()}
Profit Margin: ${cashFlow.profitMargin.toFixed(1)}%
Revenue-to-Rent Ratio: ${(cashFlow.monthlyRevenue / cashFlow.monthlyRent).toFixed(2)}x
Break-Even Occupancy: ${cashFlow.breakEvenOccupancy.toFixed(1)}%
Safety Cushion: ${(revenue.occupancy - cashFlow.breakEvenOccupancy).toFixed(1)} percentage points above break-even
` : ''}

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 3: MARKET HEALTH & POSITION
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

MARKET GRADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall Grade: ${marketGrade.grade} (${marketGrade.score}/100)
Assessment: ${marketGrade.description}

Score Breakdown:
${marketGrade.factors.map(f => `• ${f.name}: ${f.score}/100 (${f.weight}% weight)`).join('\n')}

MARKET POSITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Percentile Rank: ${marketPosition.percentile}th percentile
Market Rank: #${marketPosition.rank} of ${marketPosition.totalListings} similar properties
Performance vs Average: ${marketPosition.vsAverage >= 0 ? '+' : ''}${marketPosition.vsAverage.toFixed(1)}%

MARKET LANDSCAPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Listings in Area: ${marketInsights.totalListings.toLocaleString()}
Professionally Managed: ${marketInsights.professionallyManagedPct.toFixed(1)}%
Superhost Percentage: ${marketInsights.superhostPct.toFixed(1)}%
Average Rating: ${marketInsights.avgRating.toFixed(2)} stars
Market Score: ${marketInsights.marketScore}/100
${marketInsights.investabilityScore ? `Investability Score: ${marketInsights.investabilityScore}/100` : ''}
${marketInsights.rentalDemandScore ? `Rental Demand Score: ${marketInsights.rentalDemandScore}/100` : ''}
${marketInsights.revenueGrowthScore ? `Revenue Growth Score: ${marketInsights.revenueGrowthScore}/100` : ''}
${marketInsights.seasonalityScore ? `Seasonality Score: ${marketInsights.seasonalityScore}/100` : ''}
${marketInsights.regulationScore ? `Regulation Score: ${marketInsights.regulationScore}/100` : ''}

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 4: HISTORICAL TRENDS (24 MONTHS)
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

YEAR-OVER-YEAR PERFORMANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YoY Revenue Change: ${historicalData.yoyChange >= 0 ? '+' : ''}${historicalData.yoyChange.toFixed(1)}%
Market Trend: ${historicalData.trend.toUpperCase()}
Data Points: ${historicalData.months.length} months of historical data

Monthly Historical Data:
${historicalData.months.map(m => 
  `${m.date}: Revenue $${m.revenue.toLocaleString()} | Occupancy ${m.occupancy}% | ADR $${m.adr} | RevPAR $${m.revpar}${m.listingCount ? ` | ${m.listingCount} listings` : ''}`
).join('\n')}

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 5: SEASONALITY ANALYSIS
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

12-MONTH REVENUE FORECAST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Revenue Variance: ${revenueVariance.toFixed(0)}% between peak and slow seasons

BEST MONTHS (Peak Season):
${bestMonths.map(m => `• ${m.month}: $${m.revenue.toLocaleString()} | ADR $${m.adr} | ${m.occupancy}% occupancy${m.yoyChange !== undefined ? ` | YoY: ${m.yoyChange >= 0 ? '+' : ''}${m.yoyChange.toFixed(1)}%` : ''}`).join('\n')}

SLOWEST MONTHS (Off Season):
${worstMonths.map(m => `• ${m.month}: $${m.revenue.toLocaleString()} | ADR $${m.adr} | ${m.occupancy}% occupancy${m.yoyChange !== undefined ? ` | YoY: ${m.yoyChange >= 0 ? '+' : ''}${m.yoyChange.toFixed(1)}%` : ''}`).join('\n')}

FULL MONTHLY BREAKDOWN:
${seasonality.map(m => 
  `${m.month}: Revenue $${m.revenue.toLocaleString()} | ADR $${m.adr} | Occupancy ${m.occupancy}% | RevPAR $${m.revpar}${m.yoyChange !== undefined ? ` | YoY ${m.yoyChange >= 0 ? '+' : ''}${m.yoyChange.toFixed(1)}%` : ''}`
).join('\n')}

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 6: SAME-BEDROOM COMPETITOR ANALYSIS (${sameBedroomComps.length} ${property.bedrooms}BR PROPERTIES)
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

IMPORTANT: This analysis ONLY compares to other ${property.bedrooms}-bedroom properties for a fair apples-to-apples comparison.
We found ${sameBedroomComps.length} properties with ${property.bedrooms} bedrooms in this area.
${otherBedroomComps.length > 0 ? `(${otherBedroomComps.length} properties with different bedroom counts were excluded from this comparison)` : ''}

${property.bedrooms}BR COMPETITOR STATISTICS (APPLES-TO-APPLES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total ${property.bedrooms}BR Competitors: ${sameBedroomComps.length}
Average ${property.bedrooms}BR Revenue: $${sameBRAvgRevenue.toLocaleString()}
Average ${property.bedrooms}BR Occupancy: ${sameBRAvgOccupancy.toFixed(1)}%
Average ${property.bedrooms}BR ADR: $${sameBRAvgAdr.toLocaleString()}

YOUR PROPERTY VS SAME-BEDROOM COMPETITORS:
• Revenue: ${((revenue.projected - sameBRAvgRevenue) / sameBRAvgRevenue * 100).toFixed(1)}% ${revenue.projected >= sameBRAvgRevenue ? 'above' : 'below'} ${property.bedrooms}BR average
• Occupancy: ${(revenue.occupancy - sameBRAvgOccupancy).toFixed(1)} percentage points ${revenue.occupancy >= sameBRAvgOccupancy ? 'above' : 'below'} average
• ADR: ${((revenue.adr - sameBRAvgAdr) / sameBRAvgAdr * 100).toFixed(1)}% ${revenue.adr >= sameBRAvgAdr ? 'above' : 'below'} average

COMPETITOR BREAKDOWN:
• Superhosts: ${superhostComps} of ${comparables.length} (${(superhostComps/comparables.length*100).toFixed(0)}%)
• Professionally Managed: ${professionalComps} of ${comparables.length} (${(professionalComps/comparables.length*100).toFixed(0)}%)
• High-Rated (4.8+ stars): ${highRatedComps.length} of ${comparables.length} (${(highRatedComps.length/comparables.length*100).toFixed(0)}%)

TOP 5 ${property.bedrooms}BR EARNERS (Learn from the best in your category):
${sameBRTopEarners.map((c, i) => 
  `${i+1}. "${c.title.substring(0, 50)}${c.title.length > 50 ? '...' : ''}"
     Revenue: $${c.revenue.toLocaleString()}/yr | ADR: $${c.adr} | Occupancy: ${c.occupancy}%
     Rating: ${c.rating} stars (${c.reviews} reviews) | ${c.bedrooms}BR/${c.bathrooms}BA | Sleeps ${c.accommodates}
     ${c.isSuperhost ? 'Superhost' : ''} ${c.isProfessionallyManaged ? 'Pro Managed' : ''}
     ${c.distanceMeters ? `Distance: ${(c.distanceMeters/1000).toFixed(1)}km away` : ''}
     ${c.propertyType ? `Type: ${c.propertyType}` : ''}`
).join('\n\n')}

BOTTOM 5 ${property.bedrooms}BR EARNERS (Learn what to avoid):
${sameBRBottomEarners.map((c, i) => 
  `${i+1}. "${c.title.substring(0, 50)}${c.title.length > 50 ? '...' : ''}"
     Revenue: $${c.revenue.toLocaleString()}/yr | ADR: $${c.adr} | Occupancy: ${c.occupancy}%
     Rating: ${c.rating} stars (${c.reviews} reviews) | ${c.bedrooms}BR/${c.bathrooms}BA | Sleeps ${c.accommodates}`
).join('\n\n')}

COMPLETE ${property.bedrooms}BR COMPETITOR LIST:
${sameBedroomComps.map((c, i) => 
  `${i+1}. ${c.title.substring(0, 40)}... | $${c.revenue.toLocaleString()}/yr | ${c.occupancy}% occ | $${c.adr} ADR | ${c.rating}★ (${c.reviews}) | ${c.bedrooms}BR/${c.bathrooms}BA ${c.isSuperhost ? '[SH]' : ''} ${c.isProfessionallyManaged ? '[PM]' : ''}`
).join('\n')}

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
YOUR ANALYSIS TASK - PRODUCE A COMPREHENSIVE RENTAL ARBITRAGE ANALYSIS
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

IMPORTANT CONTEXT:
- This analysis is for RENTAL ARBITRAGE investors (people who rent a property long-term and sublet it on Airbnb/VRBO)
- The user is NOT buying this property - they would be RENTING it and subletting as a short-term rental
- Compare ONLY to properties with the SAME BEDROOM COUNT (${property.bedrooms}BR) - this is critical for accurate analysis
- Today's date is ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
- Focus on: Can the STR revenue cover the monthly rent + expenses and generate profit?

Write a comprehensive rental arbitrage analysis report. Be specific with numbers and provide actionable insights.

# EXECUTIVE SUMMARY
Provide a clear, 3-5 sentence summary of the arbitrage opportunity. Include:
- Overall recommendation (GO / PROCEED WITH CAUTION / PASS)
- Projected monthly profit (if rent provided) or break-even rent threshold
- How this property compares to other ${property.bedrooms}BR properties in the area
- Who this opportunity is best suited for (new vs experienced arbitrage investors)

# RENTAL ARBITRAGE FINANCIAL ANALYSIS

## Revenue vs Same-Bedroom Competitors
- Compare projected revenue ONLY to other ${property.bedrooms}BR properties
- Average revenue for ${property.bedrooms}BR properties in this market: calculate from the data
- Where does this property rank among ${property.bedrooms}BR competitors?
- Revenue gap or advantage vs ${property.bedrooms}BR average

## Monthly Cash Flow Analysis
${property.monthlyRent ? `- Monthly Rent: $${property.monthlyRent}
- Projected Monthly Revenue: $${Math.round(revenue.projected / 12).toLocaleString()}
- Estimated Expenses (supplies, utilities, cleaning): ~20-25% of revenue
- Projected Monthly Profit: Calculate this
- Annual Profit Projection: Calculate this` : `- No rent provided - calculate the MAXIMUM RENT this property could support
- Break-even rent range (revenue - 25% expenses): $${Math.round((revenue.low * 0.75) / 12 / 100) * 100} - $${Math.round((revenue.high * 0.75) / 12 / 100) * 100}/month
- Recommended max rent range for healthy profit margin: $${Math.round((revenue.low * 0.60) / 12 / 100) * 100} - $${Math.round((revenue.high * 0.60) / 12 / 100) * 100}/month`}

## Break-Even & Risk Scenarios
- What occupancy rate is needed to break even?
- What happens if occupancy drops 20% in slow season?
- Safety margin analysis

# COMPETITIVE ANALYSIS (${property.bedrooms}BR PROPERTIES ONLY)

## Your Position Among ${property.bedrooms}BR Competitors
- Rank this property among the ${sameBedroomComps.length} same-bedroom competitors
- What separates top-earning ${property.bedrooms}BR properties from bottom earners?
- Specific lessons from the top 5 ${property.bedrooms}BR performers
- Warning signs from the bottom 5 ${property.bedrooms}BR performers

## What Top ${property.bedrooms}BR Earners Have (Your Blueprint for Success)
- What amenities do the highest earners offer? (Be specific: pools, hot tubs, game rooms, outdoor spaces, etc.)
- What design/decor elements appear in top listings?
- Why do some charge higher ADR? What justifies premium pricing?
- Why do some book more nights? What drives higher occupancy?
- Review and rating patterns - what do guests love most?

IMPORTANT: Present this as a ROADMAP - "Here's what top performers have, so you know what to aim for" - NOT as "you don't have this so you can't compete."

## How to Position for Success
- What amenities and features do the top ${property.bedrooms}BR earners have? (pools, hot tubs, game rooms, etc.)
- What makes top performers stand out in their listings?
- What's the path to reaching top 25% of ${property.bedrooms}BR earners?
- Realistic timeline to profitability

IMPORTANT: The user is RESEARCHING this opportunity - they haven't signed a lease yet. Focus on WHAT IT TAKES TO SUCCEED, not assumptions about what they lack. Show them the blueprint for success based on what top performers do.

# SEASONALITY & TIMING STRATEGY

## Seasonal Revenue Patterns
- Detailed analysis of peak vs slow seasons
- Month-by-month strategy recommendations
- Pricing strategy for each season
- Minimum stay recommendations by season

## Cash Flow Management
- How to prepare for slow months
- Reserve requirements based on seasonality
- When to invest in improvements vs save cash

## Year-Over-Year Trends
- Is this market growing, stable, or declining?
- What do the historical trends suggest for the future?
- Are there concerning patterns in the data?

# RISK ASSESSMENT

## Market Risks
- Competition level and saturation
- Professional management competition
- Market health concerns
- Regulatory risks (based on regulation score if available)

## Property-Specific Risks
- Underperformance risk vs competitors
- Seasonality exposure
- Break-even vulnerability
- Dependency on high occupancy

## Mitigation Strategies
- How to reduce each identified risk
- What insurance or reserves are needed
- Exit strategy considerations

# ACTION PLAN & RECOMMENDATIONS

## Immediate Actions (First 30 Days)
- Specific steps to take before listing
- Setup and preparation checklist
- Initial pricing strategy

## Short-Term Goals (First 6 Months)
- Review and rating targets
- Occupancy and revenue milestones
- Key performance indicators to track

## Long-Term Strategy (6-24 Months)
- Path to Superhost status
- Revenue optimization strategies
- When to consider professional management

## Final Verdict
- Clear YES, NO, or CONDITIONAL recommendation
- Specific conditions for success
- Who should pursue this opportunity
- Who should avoid this opportunity

Remember:
- Be specific with numbers - cite actual figures from the data
- Explain what metrics mean for someone new to investing
- Be honest about risks - don't oversell
- Provide actionable, specific recommendations
- This should be comprehensive enough to be a standalone investment report`;

  try {
    const response = await callGeminiMax(prompt);
    return response.trim();
  } catch (error) {
    console.error('Error generating max property advice:', error);
    return 'Unable to generate comprehensive property analysis at this time. Please try again.';
  }
}

/**
 * Maximum Capacity Market Advisor Input
 * For analyzing an entire market without a specific property
 */
export interface MaxMarketAdvisorInput {
  // Market Details
  market: {
    name: string;
    city: string;
    state: string;
    country: string;
  };
  
  // Applied Filters (for context in AI analysis)
  appliedFilters?: {
    bedrooms?: number;
    amenities?: {
      pool?: boolean;
      hotTub?: boolean;
      petFriendly?: boolean;
      parking?: boolean;
      kitchen?: boolean;
      washerDryer?: boolean;
    };
    propertyType?: string;
    minRating?: number;
    minReviews?: number;
    superhostOnly?: boolean;
    professionalOnly?: boolean;
    instantBookOnly?: boolean;
    listingType?: string;
  };
  
  // Market Scores
  scores: {
    marketScore: number;
    investabilityScore: number;
    rentalDemandScore: number;
    revenueGrowthScore: number;
    seasonalityScore: number;
    regulationScore: number;
  };
  
  // Market Metrics
  metrics: {
    avgRevenue: number;
    avgOccupancy: number;
    avgAdr: number;
    avgRevpar: number;
    totalListings: number;
    professionallyManagedPct: number;
    superhostPct: number;
    avgRating: number;
  };
  
  // Revenue by Bedroom Count
  revenueByBedroom: Array<{
    bedrooms: number;
    avgRevenue: number;
    avgOccupancy: number;
    avgAdr: number;
    listingCount: number;
  }>;
  
  // 24 Months Historical Data
  historicalData: {
    yoyChange: number;
    trend: 'up' | 'down' | 'stable';
    months: Array<{
      date: string;
      revenue: number;
      occupancy: number;
      adr: number;
      listingCount: number;
    }>;
  };
  
  // Seasonality
  seasonality: Array<{
    month: string;
    revenue: number;
    occupancy: number;
    adr: number;
    yoyChange?: number;
  }>;
  
  // Top Performers (sample of best listings)
  topPerformers: Array<{
    title: string;
    bedrooms: number;
    bathrooms: number;
    revenue: number;
    occupancy: number;
    adr: number;
    rating: number;
    reviews: number;
    isSuperhost: boolean;
    isProfessionallyManaged: boolean;
  }>;
  
  // Property Type Distribution
  propertyTypes?: Array<{
    type: string;
    count: number;
    avgRevenue: number;
    avgOccupancy: number;
  }>;
  
  // Booking Patterns (NEW)
  bookingPatterns?: {
    avgLeadTimeDays: number;
    lastMinutePercent: number;
    advanceBookingPercent: number;
    avgLengthOfStay: number;
    weekendPercent: number;
    weekPlusPercent: number;
    insights: string[];
  };
  
  // Supply Trend (NEW)
  supplyTrend?: {
    currentListings: number;
    listings12MonthsAgo: number;
    netChange: number;
    percentChange: number;
    trend: 'growing' | 'declining' | 'stable';
    insight: string;
    monthlyData: Array<{
      month: string;
      activeListings: number;
      changeFromPrevious: number;
    }>;
  };
  
  // Submarkets (NEW) - matches AirDNA structure
  submarkets?: Array<{
    id: string;
    name: string;
    listingCount: number;
    metrics?: {
      occupancy: number;
      adr: number;
      revenue: number;
      revpar: number;
      marketScore?: number;
    };
  }>;
  
  // Cancellation Policies (NEW)
  cancellationPolicies?: {
    totalListings: number;
    policies: Array<{
      policy: string;
      count: number;
      percentage: number;
      avgRevenue: number;
      avgOccupancy: number;
    }>;
    recommendation: string;
  };
  
  // Professional Stats (NEW) - matches AirDNA structure
  professionalStats?: {
    totalListings: number;
    professionalCount: number;
    individualCount: number;
    professionalPercentage: number;
    superhostCount: number;
    superhostPercentage: number;
    avgRevenueProfessional: number;
    avgRevenueIndividual: number;
    revenuePremiumPercent: number;
  };
}

/**
 * Generate Maximum Capacity Market Analysis
 * 
 * Comprehensive market analysis for investors looking at a new market.
 */
export async function generateMaxMarketAdvice(
  input: MaxMarketAdvisorInput
): Promise<string> {
  const { market, scores, metrics, revenueByBedroom, historicalData, seasonality, topPerformers, propertyTypes, bookingPatterns, supplyTrend, submarkets, cancellationPolicies, professionalStats, appliedFilters } = input;
  
  // Build filter context string for the prompt
  const filterContextParts: string[] = [];
  if (appliedFilters?.bedrooms) {
    filterContextParts.push(`${appliedFilters.bedrooms}-bedroom properties only`);
  }
  if (appliedFilters?.amenities) {
    const amenityLabels: string[] = [];
    if (appliedFilters.amenities.pool) amenityLabels.push('Pool');
    if (appliedFilters.amenities.hotTub) amenityLabels.push('Hot Tub');
    if (appliedFilters.amenities.petFriendly) amenityLabels.push('Pet Friendly');
    if (appliedFilters.amenities.parking) amenityLabels.push('Parking');
    if (appliedFilters.amenities.kitchen) amenityLabels.push('Kitchen');
    if (appliedFilters.amenities.washerDryer) amenityLabels.push('Washer/Dryer');
    if (amenityLabels.length > 0) {
      filterContextParts.push(`with amenities: ${amenityLabels.join(', ')}`);
    }
  }
  if (appliedFilters?.propertyType) {
    filterContextParts.push(`property type: ${appliedFilters.propertyType}`);
  }
  if (appliedFilters?.minRating) {
    filterContextParts.push(`minimum rating: ${appliedFilters.minRating}+`);
  }
  if (appliedFilters?.minReviews) {
    filterContextParts.push(`minimum ${appliedFilters.minReviews}+ reviews`);
  }
  if (appliedFilters?.superhostOnly) {
    filterContextParts.push('Superhosts only');
  }
  if (appliedFilters?.professionalOnly) {
    filterContextParts.push('Professionally managed properties only');
  }
  if (appliedFilters?.instantBookOnly) {
    filterContextParts.push('Instant Book enabled properties only');
  }
  if (appliedFilters?.listingType) {
    const listingTypeLabels: Record<string, string> = {
      'entire_home': 'Entire home/apt',
      'private_room': 'Private room',
      'shared_room': 'Shared room'
    };
    filterContextParts.push(`listing type: ${listingTypeLabels[appliedFilters.listingType] || appliedFilters.listingType}`);
  }
  const filterContext = filterContextParts.length > 0 
    ? `\n\nAPPLIED FILTERS: This analysis is filtered to show ${filterContextParts.join(' ')}. All metrics and comparisons are specific to properties matching these criteria.`
    : '';
  
  const bestMonths = [...seasonality].sort((a, b) => b.revenue - a.revenue).slice(0, 4);
  const worstMonths = [...seasonality].sort((a, b) => a.revenue - b.revenue).slice(0, 4);
  const bestBedrooms = [...revenueByBedroom].sort((a, b) => b.avgRevenue - a.avgRevenue);
  
  const revenueVariance = seasonality.length > 0
    ? ((Math.max(...seasonality.map(s => s.revenue)) - Math.min(...seasonality.map(s => s.revenue))) / (seasonality.reduce((sum, s) => sum + s.revenue, 0) / seasonality.length) * 100)
    : 0;

  const prompt = `<PERSONA>
You are a world-class SHORT-TERM RENTAL MARKET ANALYST with 15+ years of experience analyzing Airbnb and VRBO markets. You specialize in helping new investors understand market opportunities. Your communication style is:
- Clear and educational (explain jargon)
- Data-driven (cite specific numbers)
- Honest and balanced (acknowledge risks)
- Actionable (provide specific next steps)
</PERSONA>

<TASK>
Analyze the market data below and produce a COMPREHENSIVE MARKET INVESTMENT REPORT. This report should help a beginner investor decide whether to enter this market.
</TASK>

<TONE>
- Professional but approachable
- Educational without being condescending
- Confident but not overselling
- Use plain English, avoid industry jargon unless explained
</TONE>

<CONSTRAINTS>
- ONLY use the data provided below - DO NOT make assumptions or use external knowledge
- ALWAYS cite specific numbers from the data (e.g., "$45,000/year" not "good revenue")
- NEVER provide prescriptive advice like "you should buy" - present data and let reader decide
- DO NOT include startup costs or furnishing budgets
- Keep each section focused and scannable
- Maximum 2,500 words total
</CONSTRAINTS>

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                           COMPREHENSIVE MARKET INVESTMENT ANALYSIS
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 1: MARKET OVERVIEW
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

MARKET DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Market Name: ${market.name}
Location: ${market.city}, ${market.state}, ${market.country}
Total Active Listings: ${metrics.totalListings.toLocaleString()}${filterContext}

MARKET SCORES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall Market Score: ${scores.marketScore}/100
Investability Score: ${scores.investabilityScore}/100
Rental Demand Score: ${scores.rentalDemandScore}/100
Revenue Growth Score: ${scores.revenueGrowthScore}/100
Seasonality Score: ${scores.seasonalityScore}/100
Regulation Score: ${scores.regulationScore}/100

MARKET METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average Annual Revenue: $${metrics.avgRevenue.toLocaleString()}
Average Occupancy Rate: ${metrics.avgOccupancy}%
Average Daily Rate (ADR): $${metrics.avgAdr.toLocaleString()}
Average RevPAR: $${metrics.avgRevpar.toLocaleString()}
Professionally Managed: ${metrics.professionallyManagedPct.toFixed(1)}%
Superhost Percentage: ${metrics.superhostPct.toFixed(1)}%
Average Rating: ${metrics.avgRating.toFixed(2)} stars

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 2: REVENUE BY PROPERTY SIZE
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

🏠 REVENUE BY BEDROOM COUNT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${revenueByBedroom.map(r => 
  `${r.bedrooms} Bedroom: $${r.avgRevenue.toLocaleString()}/yr avg | ${r.avgOccupancy}% occupancy | $${r.avgAdr} ADR | ${r.listingCount.toLocaleString()} listings`
).join('\n')}

BEST PERFORMING PROPERTY SIZES:
${bestBedrooms.slice(0, 3).map((r, i) => 
  `${i+1}. ${r.bedrooms} Bedroom properties: $${r.avgRevenue.toLocaleString()}/yr average`
).join('\n')}

${propertyTypes ? `
PROPERTY TYPE DISTRIBUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${propertyTypes.map(p => 
  `${p.type}: ${p.count.toLocaleString()} listings | $${p.avgRevenue.toLocaleString()}/yr avg | ${p.avgOccupancy}% occupancy`
).join('\n')}
` : ''}

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 3: HISTORICAL TRENDS (24 MONTHS)
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

YEAR-OVER-YEAR PERFORMANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YoY Revenue Change: ${historicalData.yoyChange >= 0 ? '+' : ''}${historicalData.yoyChange.toFixed(1)}%
Market Trend: ${historicalData.trend.toUpperCase()}
Data Points: ${historicalData.months.length} months of historical data

MONTHLY HISTORICAL DATA:
${historicalData.months.map(m => 
  `${m.date}: Revenue $${m.revenue.toLocaleString()} | Occupancy ${m.occupancy}% | ADR $${m.adr} | ${m.listingCount.toLocaleString()} listings`
).join('\n')}

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 4: SEASONALITY ANALYSIS
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

SEASONAL PATTERNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Revenue Variance: ${revenueVariance.toFixed(0)}% between peak and slow seasons

BEST MONTHS (Peak Season):
${bestMonths.map(m => `• ${m.month}: $${m.revenue.toLocaleString()} | ${m.occupancy}% occupancy | $${m.adr} ADR${m.yoyChange !== undefined ? ` | YoY: ${m.yoyChange >= 0 ? '+' : ''}${m.yoyChange.toFixed(1)}%` : ''}`).join('\n')}

SLOWEST MONTHS (Off Season):
${worstMonths.map(m => `• ${m.month}: $${m.revenue.toLocaleString()} | ${m.occupancy}% occupancy | $${m.adr} ADR${m.yoyChange !== undefined ? ` | YoY: ${m.yoyChange >= 0 ? '+' : ''}${m.yoyChange.toFixed(1)}%` : ''}`).join('\n')}

FULL MONTHLY BREAKDOWN:
${seasonality.map(m => 
  `${m.month}: Revenue $${m.revenue.toLocaleString()} | Occupancy ${m.occupancy}% | ADR $${m.adr}${m.yoyChange !== undefined ? ` | YoY ${m.yoyChange >= 0 ? '+' : ''}${m.yoyChange.toFixed(1)}%` : ''}`
).join('\n')}

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 5: TOP PERFORMERS IN THIS MARKET
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

TOP EARNING PROPERTIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${topPerformers.map((p, i) => 
  `${i+1}. "${p.title.substring(0, 50)}${p.title.length > 50 ? '...' : ''}"
     Revenue: $${p.revenue.toLocaleString()}/yr | ADR: $${p.adr} | Occupancy: ${p.occupancy}%
     Rating: ${p.rating} stars (${p.reviews} reviews) | ${p.bedrooms}BR/${p.bathrooms}BA
     ${p.isSuperhost ? 'Superhost' : ''} ${p.isProfessionallyManaged ? 'Pro Managed' : ''}`
).join('\n\n')}

${bookingPatterns ? `
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 6: BOOKING PATTERNS
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

GUEST BOOKING BEHAVIOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average Booking Lead Time: ${bookingPatterns.avgLeadTimeDays} days in advance
Last-Minute Bookings (0-7 days): ${bookingPatterns.lastMinutePercent}%
Advance Bookings (30+ days): ${bookingPatterns.advanceBookingPercent}%
Average Length of Stay: ${bookingPatterns.avgLengthOfStay} nights
Weekend Stays: ${bookingPatterns.weekendPercent}%
Week+ Stays: ${bookingPatterns.weekPlusPercent}%

KEY INSIGHTS:
${bookingPatterns.insights.map(i => `• ${i}`).join('\n')}
` : ''}

${supplyTrend ? `
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 7: SUPPLY TREND (MARKET SATURATION)
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

MARKET SUPPLY ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current Active Listings: ${supplyTrend.currentListings.toLocaleString()}
Listings 12 Months Ago: ${supplyTrend.listings12MonthsAgo.toLocaleString()}
Net Change: ${supplyTrend.netChange >= 0 ? '+' : ''}${supplyTrend.netChange.toLocaleString()} listings
Percent Change: ${supplyTrend.percentChange >= 0 ? '+' : ''}${supplyTrend.percentChange.toFixed(1)}%
Trend: ${supplyTrend.trend.toUpperCase()}

INSIGHT: ${supplyTrend.insight}

MONTHLY SUPPLY DATA:
${supplyTrend.monthlyData.slice(0, 12).map(m => 
  `${m.month}: ${m.activeListings.toLocaleString()} listings (${m.changeFromPrevious >= 0 ? '+' : ''}${m.changeFromPrevious} from prev month)`
).join('\n')}
` : ''}

${submarkets && submarkets.length > 0 ? `
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 8: SUBMARKETS / NEIGHBORHOODS
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

NEIGHBORHOOD BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${submarkets.slice(0, 15).map((s, i) => 
  `${i+1}. ${s.name}\n   Listings: ${s.listingCount.toLocaleString()}${s.metrics ? ` | Revenue: $${s.metrics.revenue.toLocaleString()}/yr | ADR: $${s.metrics.adr} | Occupancy: ${s.metrics.occupancy}%${s.metrics.marketScore ? ` | Score: ${s.metrics.marketScore}` : ''}` : ''}`
).join('\n\n')}
` : ''}

${cancellationPolicies ? `
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 9: CANCELLATION POLICY ANALYSIS
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

POLICY DISTRIBUTION & PERFORMANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Listings Analyzed: ${cancellationPolicies.totalListings.toLocaleString()}

${cancellationPolicies.policies.map(p => 
  `${p.policy.toUpperCase()} (${p.percentage}% of listings)\n   Avg Revenue: $${p.avgRevenue.toLocaleString()}/yr | Avg Occupancy: ${p.avgOccupancy}%`
).join('\n\n')}

RECOMMENDATION: ${cancellationPolicies.recommendation}
` : ''}

${professionalStats ? `
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 10: PROFESSIONAL VS INDIVIDUAL HOST ANALYSIS
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

HOST TYPE BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Listings: ${professionalStats.totalListings.toLocaleString()}
Professionally Managed: ${professionalStats.professionalCount.toLocaleString()} (${professionalStats.professionalPercentage}%)
Individual Hosts: ${professionalStats.individualCount.toLocaleString()} (${(100 - professionalStats.professionalPercentage).toFixed(1)}%)
Superhosts: ${professionalStats.superhostCount.toLocaleString()} (${professionalStats.superhostPercentage}%)

REVENUE COMPARISON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Avg Revenue (Professional): $${professionalStats.avgRevenueProfessional.toLocaleString()}/yr
Avg Revenue (Individual): $${professionalStats.avgRevenueIndividual.toLocaleString()}/yr
Professional Revenue Premium: ${professionalStats.revenuePremiumPercent >= 0 ? '+' : ''}${professionalStats.revenuePremiumPercent}%
` : ''}

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
YOUR ANALYSIS TASK - PRODUCE A COMPREHENSIVE MARKET REPORT
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

Write an extremely comprehensive market analysis report with the following sections. Be thorough - this should be a complete market report that could stand alone as a professional document.

# EXECUTIVE SUMMARY
Provide a clear, 3-5 sentence summary of this market opportunity. Include:
- Overall market rating (Excellent / Good / Fair / Poor)
- Key revenue potential
- Main opportunity and main risk
- Who this market is best suited for
# MARKET HEALTH ANALYSIS
## Score Breakdown
- Detailed analysis of each market score
- What each score means for investors
- Comparison to what would be considered "good" scores
- Red flags and green flags in the scores

## Market Maturity
- Is this an emerging, mature, or saturated market?
- What does the listing count trend suggest?
- Is there room for new entrants?

# REVENUE OPPORTUNITY

## Revenue Potential by Property Size
- Which bedroom counts offer the best opportunity?
- Revenue vs competition analysis
- Optimal property configuration for this market

## Earning Potential
- Realistic revenue expectations for new entrants
- What top performers are earning
- Path from average to top performer

# SEASONALITY STRATEGY

## Seasonal Patterns
- Detailed peak and slow season analysis
- Revenue variance and what it means
- Cash flow planning recommendations

## Timing Strategy
- Best time to enter this market
- Pricing strategy by season
- Occupancy optimization tips

# COMPETITIVE LANDSCAPE

## Market Composition
- Professional vs individual hosts
- Superhost prevalence and importance
- Quality standards in this market

## Success Factors
- What top performers have in common
- Minimum requirements to compete
- Differentiation opportunities

# RISKS & CHALLENGES

## Market Risks
- Saturation concerns
- Regulatory risks
- Seasonal volatility
- Competition from professionals

## Mitigation Strategies
- How to reduce each risk
- Market entry timing
- Positioning strategies

# RECOMMENDATIONS

## Market Entry Strategy
- Recommended property type and size
- Target revenue and occupancy
- Initial pricing strategy

## Success Roadmap
- First 90 days priorities
- 6-month milestones
- 12-month goals

## Final Verdict
- Clear recommendation on entering this market
- Best suited investor profile
- Key success factors

Remember:
- Be specific with numbers - cite actual figures from the data
- Explain what metrics mean for someone new to investing
- Be honest about risks - don't oversell
- Provide actionable, specific recommendations`;

  try {
    const response = await callGeminiMax(prompt);
    return response.trim();
  } catch (error) {
    console.error('Error generating max market advice:', error);
    return 'Unable to generate comprehensive market analysis at this time. Please try again.';
  }
}

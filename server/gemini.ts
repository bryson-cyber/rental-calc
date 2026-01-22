/**
 * Gemini AI Service for Property Analysis
 * 
 * This service uses Google's Gemini AI to generate educational,
 * easy-to-understand content for rental property analysis reports.
 */

import { ENV } from './_core/env';

// Use Gemini 2.5 Pro - the latest and most capable model
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

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

async function callGemini(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout for comprehensive analysis
  
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
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 8192, // Increased for comprehensive responses
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

📍 PROPERTY DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Address: ${property.address}
Bedrooms: ${property.bedrooms} | Bathrooms: ${property.bathrooms}
${property.accommodates ? `Max Guests: ${property.accommodates}` : ''}
${property.monthlyRent ? `Monthly Rent: $${property.monthlyRent.toLocaleString()}` : ''}

💰 REVENUE PROJECTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Projected Annual Revenue: $${revenue.projected.toLocaleString()}
Conservative Estimate: $${revenue.low.toLocaleString()}
Optimistic Estimate: $${revenue.high.toLocaleString()}
Average Daily Rate (ADR): $${revenue.adr.toLocaleString()}
Projected Occupancy: ${revenue.occupancy}%

${cashFlow ? `
💵 CASH FLOW ANALYSIS (Based on $${property.monthlyRent?.toLocaleString()}/month rent)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Monthly Revenue: $${cashFlow.monthlyRevenue.toLocaleString()}
Monthly Rent: $${cashFlow.monthlyRent.toLocaleString()}
Monthly Profit: $${cashFlow.monthlyProfit.toLocaleString()}
Annual Profit: $${cashFlow.annualProfit.toLocaleString()}
Profit Margin: ${cashFlow.profitMargin.toFixed(1)}%
Revenue-to-Rent Ratio: ${(cashFlow.monthlyRevenue / cashFlow.monthlyRent).toFixed(2)}x
` : ''}

📊 MARKET HEALTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${marketGrade ? `Market Grade: ${marketGrade.grade} (${marketGrade.score}/100) - ${marketGrade.description}` : 'Market Grade: Not available'}
${marketInsights ? `
Total Listings in Area: ${marketInsights.totalListings?.toLocaleString() || 'Unknown'}
Professionally Managed: ${marketInsights.professionallyManagedPct.toFixed(1)}%
Superhost Percentage: ${marketInsights.superhostPct.toFixed(1)}%
Average Rating: ${marketInsights.avgRating?.toFixed(2) || 'N/A'}
${marketInsights.marketScore ? `AirDNA Market Score: ${marketInsights.marketScore}/100` : ''}
` : ''}

${historicalData ? `
📈 YEAR-OVER-YEAR TRENDS
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

📅 SEASONALITY (Monthly Revenue Forecast)
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

## 🎯 Executive Summary
A 2-3 sentence overview of whether this is a good opportunity and why.

## 💡 The Opportunity
- What makes this property attractive (or not)?
- How does the revenue compare to competitors?
- What's the profit potential?

## ⚠️ Key Risks & Challenges
- What could go wrong?
- What competition challenges exist?
- Are there concerning trends in the data?

## 🏆 Competitive Positioning
- How does this property stack up against competitors?
- What would it take to succeed in this market?
- Is the market saturated or is there room for new listings?

## 📊 Seasonality Strategy
- When are the best and worst times to earn?
- How should the owner plan for slow seasons?
- What pricing strategy does the data suggest?

## ✅ Bottom Line Recommendation
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

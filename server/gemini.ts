/**
 * Gemini AI Service for Property Analysis
 * 
 * This service uses Google's Gemini 3 AI to generate educational,
 * easy-to-understand content for rental property analysis reports.
 * 
 * GEMINI 3 BEST PRACTICES APPLIED:
 * - Model: gemini-3-pro-preview for complex reasoning tasks
 * - Thinking: thinkingLevel 'high' for property/market analysis, 'low' for simple tasks
 * - Temperature: 1.0 (recommended by Gemini 3 for optimal reasoning)
 * - Prompts: PTCF framework (Persona, Task, Context, Format)
 */

import { ENV } from './_core/env';

/**
 * Post-process AI output to remove prescriptive language
 * This ensures the output is data-driven and non-advisory
 */
function stripPrescriptiveLanguage(text: string): string {
  let result = text;
  
  // Remove recommendation lines
  result = result.replace(/^.*Recommendation:.*$/gm, '');
  result = result.replace(/^.*RECOMMENDATION:.*$/gm, '');
  
  // Remove verdict language
  result = result.replace(/\b(PASS|GO|CAUTION|HIGH RISK|LOW RISK|MEDIUM RISK)\b/g, '');
  
  // Remove "Strategy:" sections - replace with "Data Point:"
  result = result.replace(/Strategy:/g, 'Data Point:');
  result = result.replace(/\*_Strategy:_\*/g, '*_Data Point:_*');
  result = result.replace(/_Strategy:_/g, '_Data Point:_');
  
  // Remove "Blueprint" language
  result = result.replace(/Your Blueprint for Success/g, 'Top Performer Characteristics');
  result = result.replace(/Blueprint for Success/g, 'Top Performer Characteristics');
  
  // Replace prescriptive verbs with data statements
  result = result.replace(/You must/g, 'Top performers');
  result = result.replace(/you must/g, 'top performers');
  result = result.replace(/You should/g, 'Top performers typically');
  result = result.replace(/you should/g, 'top performers typically');
  result = result.replace(/You will need to/g, 'Top performers');
  result = result.replace(/you will need to/g, 'top performers');
  result = result.replace(/You would need to/g, 'Top performers');
  result = result.replace(/you would need to/g, 'top performers');
  result = result.replace(/You need to/g, 'Top performers');
  result = result.replace(/you need to/g, 'top performers');
  
  // Remove "not recommended" language
  result = result.replace(/This opportunity is not recommended for beginners/g, 'This property shows metrics below market average');
  result = result.replace(/not recommended for beginners/g, 'metrics below market average');
  result = result.replace(/not recommended/g, 'shows challenging metrics');
  
  // Remove "Best/Worst" prescriptive timing
  result = result.replace(/Best Start Date:/g, 'Highest revenue months begin in');
  result = result.replace(/Worst Start Date:/g, 'Lowest revenue months begin in');
  
  // Remove "do not start" language
  result = result.replace(/do not start in the winter/g, 'winter months show lowest revenue');
  result = result.replace(/If you sign this lease,/g, '');
  
  // Remove "NOT for beginners" language
  result = result.replace(/This is NOT for a beginner/gi, 'This property shows challenging metrics for new operators');
  result = result.replace(/NOT for beginners/gi, 'challenging for new operators');
  result = result.replace(/not for beginners/gi, 'challenging for new operators');
  
  // Remove "only viable for" language
  result = result.replace(/This opportunity is only viable for an experienced operator/gi, 'Experienced operators in this market typically achieve higher returns');
  result = result.replace(/only viable for/gi, 'typically performed by');
  
  // Replace "top performers" prescriptive phrases with data statements
  result = result.replace(/top performers prove the algorithm wrong/gi, 'some properties outperform projections');
  result = result.replace(/Top performers execute a strategy/gi, 'High-earning properties demonstrate');
  result = result.replace(/top performers execute a strategy/gi, 'high-earning properties demonstrate');
  result = result.replace(/To make this deal work, top performers/gi, 'High-earning properties in this market');
  result = result.replace(/top performers mimic/gi, 'high earners share characteristics with');
  result = result.replace(/Top performers mimic/gi, 'High earners share characteristics with');
  result = result.replace(/top performers leverage/gi, 'high earners utilize');
  result = result.replace(/Top performers leverage/gi, 'High earners utilize');
  result = result.replace(/top performers book/gi, 'break-even requires');
  result = result.replace(/Top performers book/gi, 'Break-even requires');
  result = result.replace(/top performers generate/gi, 'profitable properties generate');
  result = result.replace(/Top performers generate/gi, 'Profitable properties generate');
  
  // Remove "you cannot" prescriptive language
  result = result.replace(/You cannot afford/gi, 'Early reviews significantly impact');
  result = result.replace(/you cannot afford/gi, 'early reviews significantly impact');
  result = result.replace(/You cannot/gi, 'Data shows');
  result = result.replace(/you cannot/gi, 'data shows');
  
  // Remove "Who is this for?" prescriptive sections
  result = result.replace(/Who is this for\?/gi, 'Market Context:');
  
  // Remove "The Lesson:" prescriptive language
  result = result.replace(/The Lesson:/gi, 'Data Insight:');
  
  // Remove "Warning:" prescriptive language
  result = result.replace(/Warning:/gi, 'Note:');
  
  // Remove decorative lines (═══, ━━━, ───) that appear in AI output
  result = result.replace(/^[═━─]+$/gm, '');
  result = result.replace(/^═+$/gm, '');
  result = result.replace(/^━+$/gm, '');
  result = result.replace(/^─+$/gm, '');
  
  // Clean up double spaces and empty lines
  result = result.replace(/  +/g, ' ');
  result = result.replace(/\n\n\n+/g, '\n\n');
  
  return result.trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEMINI 3 API CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
// 
// Model Selection (per Gemini 3 API skill):
// - gemini-3-pro-preview: Complex reasoning, multi-step analysis, comprehensive reports
// - gemini-3-flash-preview: Fast responses, chat, simple summarization
//
// Thinking Levels:
// - 'high': Maximum reasoning depth (default for Pro, recommended for analysis)
// - 'low': Minimizes latency and cost (for simpler tasks)
// - 'minimal': Lowest latency (Flash only)
//
// Temperature:
// - 1.0: Recommended by Gemini 3 for optimal reasoning
// - Lower values (0.1-0.3): For deterministic, consistent outputs

const GEMINI_3_PRO_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent';
const GEMINI_3_FLASH_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

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

interface GeminiCallOptions {
  maxTokens?: number;
  temperature?: number;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  model?: 'pro' | 'flash';
}

/**
 * Core Gemini 3 API call function with best practices
 * 
 * @param prompt - The prompt to send to Gemini
 * @param options - Configuration options
 * @returns The generated text response
 */
async function callGemini(prompt: string, options?: GeminiCallOptions): Promise<string> {
  const controller = new AbortController();
  // Gemini 3 with thinking enabled can take longer - 3 minute timeout
  const timeoutId = setTimeout(() => controller.abort(), 180000);
  
  const model = options?.model ?? 'pro';
  const apiUrl = model === 'flash' ? GEMINI_3_FLASH_URL : GEMINI_3_PRO_URL;
  
  // Gemini 3 best practices:
  // - Temperature 1.0 for optimal reasoning (per Gemini 3 docs)
  // - thinkingLevel 'high' for complex analysis (default for Pro)
  const temperature = options?.temperature ?? 1.0;
  const thinkingLevel = options?.thinkingLevel ?? (model === 'pro' ? 'high' : 'medium');
  
  try {
    const response = await fetch(`${apiUrl}?key=${ENV.geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature,
          maxOutputTokens: options?.maxTokens ?? 8192,
        },
        // Gemini 3 thinking configuration for advanced reasoning
        thinkingConfig: {
          thinkingLevel
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
 * Extended capacity Gemini 3 call for comprehensive analysis
 * Uses maximum output tokens (65K) for detailed reports
 */
async function callGeminiMax(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout
  
  try {
    const response = await fetch(`${GEMINI_3_PRO_URL}?key=${ENV.geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          // For comprehensive reports, use lower temperature for consistency
          // while still leveraging thinking capabilities
          temperature: 0.7,
          maxOutputTokens: 65536, // Maximum output capacity
        },
        // High thinking level for comprehensive analysis
        thinkingConfig: {
          thinkingLevel: 'high'
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
 * Investment Advisor Chat - Uses Gemini 3 Flash for faster responses
 * 
 * PTCF Framework Applied:
 * - Persona: Short-term rental investment advisor
 * - Task: Answer questions using ONLY provided market data
 * - Context: Market data with scores and metrics
 * - Format: Conversational, 2-4 paragraphs with bullet points
 */
export async function getInvestmentAdvice(
  question: string,
  conversationHistory: ChatMessage[],
  context?: InvestmentAdvisorContext
): Promise<string> {
  // Build context string from market data if available
  let marketContext = '';
  if (context?.markets && context.markets.length > 0) {
    marketContext = `\n\n<CONTEXT>\nAvailable Market Data:\n${context.markets.map(m => 
      `- ${m.name}: Score ${m.scores.market_score}/100, Investability ${m.scores.investability}, Demand ${m.scores.rental_demand}, Revenue Growth ${m.scores.revenue_growth}, Seasonality ${m.scores.seasonality}, Regulation ${m.scores.regulation}, Avg Revenue $${m.metrics.revenue.toLocaleString()}, Occupancy ${m.metrics.occupancy}%, ADR $${m.metrics.adr}, ${m.listing_count.toLocaleString()} listings`
    ).join('\n')}\n</CONTEXT>`;
  }

  // Build conversation history
  const historyText = conversationHistory.length > 0 
    ? `\n\nConversation History:\n${conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Advisor'}: ${m.content}`).join('\n')}`
    : '';

  // PTCF-structured prompt
  const prompt = `<PERSONA>
You are a short-term rental investment advisor. You ONLY use verified market data provided to you - never external knowledge or assumptions.
</PERSONA>

<TASK>
Answer the user's question about short-term rental markets using ONLY the data provided below. If data is missing, say so clearly.
</TASK>
${marketContext}${historyText}

<FORMAT>
- Keep responses concise (2-4 paragraphs)
- Use bullet points for market comparisons
- Cite specific numbers and percentages from the data
- Explain what each metric means for investors
- Never provide investment advice beyond what the data shows
</FORMAT>

<CONSTRAINTS>
- ONLY reference markets in the dataset provided
- If a user asks about markets NOT in the data, say "I don't have data on that market yet"
- Do NOT make up or assume information
</CONSTRAINTS>

User Question: ${question}

Respond based ONLY on the market data above. If the data doesn't cover the question, say so clearly.`;

  try {
    // Use Flash model for faster chat responses with medium thinking
    const response = await callGemini(prompt, { 
      model: 'flash',
      thinkingLevel: 'medium',
      temperature: 1.0
    });
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
  // PTCF-structured prompt for property reports
  const prompt = `<PERSONA>
You are a real estate analyst who explains Airbnb investment opportunities in simple, beginner-friendly language.
</PERSONA>

<TASK>
Generate a brief property analysis summary for the address: ${address}
</TASK>

<CONTEXT>
Property Features: ${JSON.stringify(features, null, 2)}
</CONTEXT>

<FORMAT>
- Write 2-3 paragraphs
- Use simple language anyone can understand
- Focus on key metrics and what they mean
- Avoid jargon without explanation
</FORMAT>`;

  try {
    const response = await callGemini(prompt, { 
      maxTokens: 2048,
      thinkingLevel: 'low' // Simple task, lower thinking
    });
    return response.trim();
  } catch (error) {
    console.error('Error generating enhanced property report:', error);
    return 'Unable to generate property report at this time.';
  }
}

export async function generateEnhancedMarketReport(
  marketName: string,
  metrics: Record<string, unknown>
): Promise<string> {
  // PTCF-structured prompt for market reports
  const prompt = `<PERSONA>
You are a real estate market analyst who explains Airbnb market conditions in simple, beginner-friendly language.
</PERSONA>

<TASK>
Generate a brief market analysis summary for: ${marketName}
</TASK>

<CONTEXT>
Market Metrics: ${JSON.stringify(metrics, null, 2)}
</CONTEXT>

<FORMAT>
- Write 2-3 paragraphs
- Use simple language anyone can understand
- Focus on key metrics and what they mean for investors
- Avoid jargon without explanation
</FORMAT>`;

  try {
    const response = await callGemini(prompt, { 
      maxTokens: 2048,
      thinkingLevel: 'low'
    });
    return response.trim();
  } catch (error) {
    console.error('Error generating enhanced market report:', error);
    return 'Unable to generate market report at this time.';
  }
}

export interface MarketTrendNarrativeInput {
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

export async function generateMarketTrendNarrative(
  input: MarketTrendNarrativeInput
): Promise<string> {
  const { marketName, currentYearRevenue, lastYearRevenue, yoyChange, occupancy, adr, monthlyData, marketGrade, marketScore } = input;
  
  // PTCF-structured prompt for trend analysis
  const prompt = `<PERSONA>
You are a data analyst who explains market trends in simple, easy-to-understand language.
</PERSONA>

<TASK>
Analyze the market trend data and explain what it means for ${marketName}.
</TASK>

<CONTEXT>
Market: ${marketName}
Market Grade: ${marketGrade} (Score: ${marketScore}/100)
Current Year Revenue: $${currentYearRevenue.toLocaleString()}
Last Year Revenue: $${lastYearRevenue.toLocaleString()}
Year-over-Year Change: ${yoyChange > 0 ? '+' : ''}${yoyChange.toFixed(1)}%
Current Occupancy: ${(occupancy * 100).toFixed(0)}%
Average Daily Rate: $${adr.toFixed(0)}

Monthly Breakdown (most recent first):
${monthlyData.slice(0, 6).map(d => `${d.month}: $${d.currentRevenue.toLocaleString()} (${d.yoyChange > 0 ? '+' : ''}${d.yoyChange.toFixed(1)}% YoY)`).join('\n')}
</CONTEXT>

<FORMAT>
- Write 1-2 paragraphs
- Identify the trend direction (growing, declining, stable)
- Explain what this means in practical terms
- Use simple comparisons (e.g., "up 10% from last year")
- Mention the market grade and what it indicates
</FORMAT>`;

  try {
    const response = await callGemini(prompt, { 
      maxTokens: 1024,
      thinkingLevel: 'low'
    });
    return response.trim();
  } catch (error) {
    console.error('Error generating market trend narrative:', error);
    return 'Unable to generate trend analysis at this time.';
  }
}

/**
 * Property Advisor Input Interface
 */
export interface PropertyAdvisorInput {
  property: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    bedrooms: number;
    bathrooms: number;
    accommodates: number;
    monthlyRent?: number;
  };
  revenue: {
    projected: number;
    low: number;
    high: number;
    adr: number;
    occupancy: number;
  };
  cashFlow?: {
    monthlyRevenue: number;
    monthlyRent: number;
    monthlyProfit: number;
    annualProfit: number;
    profitMargin: number;
  };
  comparables: Array<{
    title: string;
    bedrooms: number;
    bathrooms: number;
    revenue: number;
    adr: number;
    occupancy: number;
    rating: number;
    reviews: number;
    isSuperhost: boolean;
    isProfessionallyManaged: boolean;
  }>;
  marketGrade?: {
    grade: string;
    score: number;
    description: string;
  };
  marketInsights?: {
    totalListings: number;
    professionallyManagedPct: number;
    superhostPct: number;
    avgRating: number;
    marketScore?: number;
  };
  historicalData?: {
    yoyChange: number;
    trend: 'up' | 'down' | 'stable';
    months: Array<{ date: string; revenue: number; occupancy: number; adr: number }>;
  };
  seasonality: Array<{
    month: string;
    revenue: number;
    adr: number;
    occupancy: number;
  }>;
}

/**
 * Generate Comprehensive Property Advice
 * Uses PTCF framework for clear, actionable analysis
 */
export async function generateComprehensivePropertyAdvice(
  input: PropertyAdvisorInput
): Promise<string> {
  const { property, revenue, cashFlow, comparables, marketGrade, marketInsights, historicalData, seasonality } = input;
  
  // Calculate metrics for context
  const avgCompRevenue = comparables.length > 0 
    ? comparables.reduce((sum, c) => sum + c.revenue, 0) / comparables.length 
    : 0;
  const revenueVsComps = avgCompRevenue > 0 
    ? ((revenue.projected - avgCompRevenue) / avgCompRevenue * 100).toFixed(1)
    : 'N/A';
  const superhostComps = comparables.filter(c => c.isSuperhost).length;
  const professionalComps = comparables.filter(c => c.isProfessionallyManaged).length;
  const highRatedComps = comparables.filter(c => c.rating >= 4.8);
  const lowRatedComps = comparables.filter(c => c.rating < 4.5);
  
  const bestMonths = [...seasonality].sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  const worstMonths = [...seasonality].sort((a, b) => a.revenue - b.revenue).slice(0, 3);

  // PTCF-structured comprehensive prompt
  const prompt = `<PERSONA>
You are a rental arbitrage expert who helps beginners understand if a property is a good investment opportunity. You explain complex data in simple terms, like talking to a friend who's curious about Airbnb investing.
</PERSONA>

<TASK>
Analyze this property's potential as a rental arbitrage opportunity and write a comprehensive but easy-to-understand report.
</TASK>

<CONTEXT>
PROPERTY DETAILS
Address: ${property.address}
Location: ${property.city}, ${property.state} ${property.zipCode}
Configuration: ${property.bedrooms} BR | ${property.bathrooms} BA | Sleeps ${property.accommodates}
${property.monthlyRent ? `Monthly Rent: $${property.monthlyRent.toLocaleString()}` : 'Monthly Rent: Not specified'}

REVENUE PROJECTIONS
Projected Annual Revenue: $${revenue.projected.toLocaleString()}
Conservative Estimate: $${revenue.low.toLocaleString()}
Optimistic Estimate: $${revenue.high.toLocaleString()}
Average Daily Rate (ADR): $${revenue.adr.toLocaleString()}
Projected Occupancy: ${revenue.occupancy}%

${cashFlow ? `CASH FLOW ANALYSIS (Based on $${property.monthlyRent?.toLocaleString()}/month rent)
Monthly Revenue: $${cashFlow.monthlyRevenue.toLocaleString()}
Monthly Rent: $${cashFlow.monthlyRent.toLocaleString()}
Monthly Profit: $${cashFlow.monthlyProfit.toLocaleString()}
Annual Profit: $${cashFlow.annualProfit.toLocaleString()}
Profit Margin: ${cashFlow.profitMargin.toFixed(1)}%
Revenue-to-Rent Ratio: ${(cashFlow.monthlyRevenue / cashFlow.monthlyRent).toFixed(2)}x
` : ''}

MARKET HEALTH
${marketGrade ? `Market Grade: ${marketGrade.grade} (${marketGrade.score}/100) - ${marketGrade.description}` : 'Market Grade: Not available'}
${marketInsights ? `
Total Listings in Area: ${marketInsights.totalListings?.toLocaleString() || 'Unknown'}
Professionally Managed: ${marketInsights.professionallyManagedPct.toFixed(1)}%
Superhost Percentage: ${marketInsights.superhostPct.toFixed(1)}%
Average Rating: ${marketInsights.avgRating?.toFixed(2) || 'N/A'}
${marketInsights.marketScore ? `Market Score: ${marketInsights.marketScore}/100` : ''}
` : ''}

${historicalData ? `YEAR-OVER-YEAR TRENDS
YoY Revenue Change: ${historicalData.yoyChange >= 0 ? '+' : ''}${historicalData.yoyChange.toFixed(1)}%
Market Trend: ${historicalData.trend.toUpperCase()}
Historical Data Points: ${historicalData.months.length} months
` : ''}

COMPETITOR ANALYSIS (${comparables.length} similar properties)
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
Best Months: ${bestMonths.map(m => `${m.month.split('-')[1] || m.month} ($${m.revenue.toLocaleString()})`).join(', ')}
Slowest Months: ${worstMonths.map(m => `${m.month.split('-')[1] || m.month} ($${m.revenue.toLocaleString()})`).join(', ')}
Revenue Variance: ${((Math.max(...seasonality.map(s => s.revenue)) - Math.min(...seasonality.map(s => s.revenue))) / (seasonality.reduce((sum, s) => sum + s.revenue, 0) / seasonality.length) * 100).toFixed(0)}% between peak and slow seasons

Monthly Breakdown:
${seasonality.map(m => `${m.month}: $${m.revenue.toLocaleString()} | ADR $${m.adr} | ${m.occupancy}% occ`).join('\n')}
</CONTEXT>

<FORMAT>
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

Remember: Be specific, cite the actual numbers, and write for someone who is new to short-term rental investing.
</FORMAT>

<CONSTRAINTS>
- ONLY use the data provided - do not make assumptions
- Be honest about risks but also highlight genuine opportunities
- Use simple language - explain jargon when you use it
- Focus on CASH FLOW and PROFIT MARGIN, not property appreciation
</CONSTRAINTS>`;

  try {
    const response = await callGemini(prompt, { 
      maxTokens: 8192, 
      temperature: 0.7,
      thinkingLevel: 'high' // Complex analysis needs high thinking
    });
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
 * These functions maximize Gemini 3 Pro's full capacity:
 * - Input: Up to 1,048,576 tokens (1 million)
 * - Output: Up to 65,536 tokens (~50,000 words / 50+ pages)
 * - Thinking: High level for comprehensive reasoning
 * 
 * We send ALL available AirDNA data and request comprehensive analysis.
 */

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
  
  // Rentometer Data (Long-Term Rental Market Comparison)
  rentometerData?: {
    median: number;
    mean: number;
    percentile25: number;
    percentile75: number;
    min: number;
    max: number;
    samples: number;
    radiusMiles: number;
    userRent?: number;
    rentAdvantage?: number;
    rentAdvantagePercent?: number;
    percentilePosition?: string;
  };
}

/**
 * Generate Maximum Capacity Property Analysis
 * 
 * This is the most comprehensive property analysis possible.
 * It sends ALL available data and requests a full investment report.
 * 
 * PTCF Framework Applied:
 * - Persona: World-class rental arbitrage analyst
 * - Task: Comprehensive rental arbitrage analysis
 * - Context: All property, revenue, market, competitor, and historical data
 * - Format: Structured report with executive summary, analysis sections, and recommendations
 */
export async function generateMaxPropertyAdvice(
  input: MaxPropertyAdvisorInput
): Promise<string> {
  const { property, revenue, cashFlow, comparables, marketInsights, historicalData, seasonality, marketGrade, marketPosition, rentometerData } = input;
  
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
  
  const superhostComps = comparables.filter(c => c.isSuperhost).length;
  const professionalComps = comparables.filter(c => c.isProfessionallyManaged).length;
  const highRatedComps = comparables.filter(c => c.rating >= 4.8);
  
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

  // PTCF-structured maximum capacity prompt
  const prompt = `<PERSONA>
You are a world-class RENTAL ARBITRAGE analyst who helps beginners understand investment opportunities. You explain complex data in simple, friendly language - like talking to a smart friend who's curious about Airbnb investing but has never done it before.

Your communication style:
- Simple language (if a word is confusing, explain it)
- Real-life comparisons ("Think of it like..." or "Imagine if...")
- Friendly and encouraging (like talking to a friend)
- Always explain the "so what?" - why does this number matter?
</PERSONA>

<TASK>
Analyze this property's potential as a RENTAL ARBITRAGE opportunity and produce a comprehensive investment report.

IMPORTANT: This is for RENTAL ARBITRAGE - where someone:
1. Signs a lease to RENT this property (pays monthly rent to landlord)
2. Furnishes and lists it on Airbnb/VRBO
3. Earns short-term rental income from guests
4. Keeps the profit (STR income minus rent and expenses)

This is NOT about purchasing property. Focus on:
- Can the STR revenue cover the monthly rent?
- What's the monthly cash flow after rent?
- Is there enough profit margin to be worth the effort?
- What's the break-even occupancy needed?
</TASK>

<CONTEXT>
Report Date: ${currentDate}

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 1: PROPERTY OVERVIEW
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

PROPERTY DETAILS
Address: ${property.address}
City: ${property.city}, ${property.state} ${property.zipCode}
Configuration: ${property.bedrooms} Bedrooms | ${property.bathrooms} Bathrooms | Sleeps ${property.accommodates}
${property.monthlyRent ? `Monthly Rent: $${property.monthlyRent.toLocaleString()}` : 'Monthly Rent: Not specified'}
${property.latitude && property.longitude ? `Coordinates: ${property.latitude}, ${property.longitude}` : ''}

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 2: REVENUE PROJECTIONS
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

PROJECTED EARNINGS
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
Overall Grade: ${marketGrade.grade} (${marketGrade.score}/100)
Assessment: ${marketGrade.description}

Score Breakdown:
${marketGrade.factors.map(f => `• ${f.name}: ${f.score}/100 (${f.weight}% weight)`).join('\n')}

MARKET POSITION
Percentile Rank: ${marketPosition.percentile}th percentile
Market Rank: #${marketPosition.rank} of ${marketPosition.totalListings} similar properties
Performance vs Average: ${marketPosition.vsAverage >= 0 ? '+' : ''}${marketPosition.vsAverage.toFixed(1)}%

MARKET LANDSCAPE
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

${rentometerData ? `
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 7: LONG-TERM RENTAL MARKET COMPARISON (Rentometer Data)
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

TRADITIONAL RENTAL MARKET
Median Long-Term Rent: $${rentometerData.median.toLocaleString()}/month
Mean Long-Term Rent: $${rentometerData.mean.toLocaleString()}/month
25th Percentile: $${rentometerData.percentile25.toLocaleString()}/month
75th Percentile: $${rentometerData.percentile75.toLocaleString()}/month
Rent Range: $${rentometerData.min.toLocaleString()} - $${rentometerData.max.toLocaleString()}/month
Sample Size: ${rentometerData.samples} comparable rentals within ${rentometerData.radiusMiles} miles

${rentometerData.userRent ? `User's Proposed Rent: $${rentometerData.userRent.toLocaleString()}/month
Rent Position: ${rentometerData.percentilePosition}
Rent Advantage: ${rentometerData.rentAdvantage && rentometerData.rentAdvantage > 0 ? `$${rentometerData.rentAdvantage.toLocaleString()}/month below median (${rentometerData.rentAdvantagePercent}% savings)` : rentometerData.rentAdvantage && rentometerData.rentAdvantage < 0 ? `$${Math.abs(rentometerData.rentAdvantage).toLocaleString()}/month above median (${Math.abs(rentometerData.rentAdvantagePercent || 0)}% premium)` : 'At market median'}` : ''}

ARBITRAGE OPPORTUNITY ANALYSIS
- Compare the STR revenue potential to traditional rental market rates
- Is the rent being asked reasonable for this market?
- What's the spread between STR income and traditional rent?
- How does this affect the arbitrage opportunity?

` : ''}
</CONTEXT>

<FORMAT>
Write a comprehensive rental arbitrage analysis report with these sections:

# EXECUTIVE SUMMARY
Provide a clear, comprehensive summary of the arbitrage opportunity. Include:

1. **The Numbers That Matter**:
   - Projected Monthly Revenue: $${Math.round(revenue.projected / 12).toLocaleString()}
   ${property.monthlyRent ? `- Monthly Rent: $${property.monthlyRent.toLocaleString()}
   - Estimated Operating Costs (20%): $${Math.round((revenue.projected / 12) * 0.20).toLocaleString()}
   - **Estimated Net Monthly Cash Flow**: $${Math.round((revenue.projected / 12) - property.monthlyRent - ((revenue.projected / 12) * 0.20)).toLocaleString()}` : `- Monthly Rent: Not provided
   - Calculate the maximum rent this property could support while remaining profitable`}

2. **Quick Assessment**: Is this a good arbitrage opportunity? Why or why not?

3. **Key Success Factors**: What would it take to succeed with this property?

# DETAILED ANALYSIS

## Revenue Potential
- Explain the projected revenue in simple terms
- Compare to same-bedroom competitors
- Discuss the range (conservative to optimistic)

## Cash Flow Analysis
- Break down the monthly numbers
- Explain the profit margin
- Discuss the break-even occupancy

## Market Position
- How does this property compare to competitors?
- What does the market grade mean?
- Is the market growing or declining?

## Seasonality Strategy
- When are the best and worst months?
- How to plan for slow seasons?
- Revenue variance impact

## Competitive Landscape
- What are top performers doing differently?
- How saturated is the market?
- Professional vs individual hosts

# KEY METRICS SUMMARY
- Summarize the most important data points
- Highlight the key financial metrics
- Note any data limitations or gaps

# MARKET CONTEXT
- How does this property compare to the market?
- What are the key competitive factors?
- What does the historical data suggest?

Remember:
- Be specific with numbers - cite actual figures from the data
- Explain what metrics mean for someone new to investing
- Be honest about risks - don't oversell
- This should be comprehensive enough to be a standalone investment report
</FORMAT>

<CONSTRAINTS>
- ONLY use the data provided - do not make assumptions or use external knowledge
- ONLY compare to properties with the SAME BEDROOM COUNT (${property.bedrooms}BR) - this is critical for accurate analysis
- Do NOT compare to luxury hotel residences, branded properties, or properties with different bedroom counts
- Be extremely specific with numbers - cite actual figures from the data
- Write for someone who is new to Airbnb arbitrage - explain what metrics mean
- Be honest about risks but also highlight genuine opportunities
- Focus on CASH FLOW and PROFIT MARGIN, not property appreciation
- The user is RESEARCHING this opportunity - they have NOT signed a lease yet
- DO NOT assume they lack amenities or discourage them
- Instead, SHOW THEM what top performers have so they know what to aim for
- Be EDUCATIONAL and ENCOURAGING - "Here's the blueprint for success" not "You can't compete"
</CONSTRAINTS>`;

  try {
    const response = await callGeminiMax(prompt);
    // Post-process to remove any prescriptive language that slipped through
    return stripPrescriptiveLanguage(response.trim());
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
 * 
 * PTCF Framework Applied:
 * - Persona: Friendly real estate teacher for beginners
 * - Task: Beginner-friendly market report answering "How's this market for Airbnb?"
 * - Context: All market scores, metrics, historical data, seasonality, top performers
 * - Format: Simple language, real examples, explain "so what?" for every number
 */
export async function generateMaxMarketAdvice(
  input: MaxMarketAdvisorInput
): Promise<string> {
  const { market, scores, metrics, revenueByBedroom, historicalData, seasonality, topPerformers, propertyTypes, bookingPatterns, supplyTrend, submarkets, cancellationPolicies, professionalStats, appliedFilters } = input;
  
  // Build filter context string for the prompt
  const filterContextParts: string[] = [];
  // Use explicit undefined check to handle Studio (bedrooms=0)
  if (appliedFilters?.bedrooms !== undefined && appliedFilters?.bedrooms !== null) {
    const bedroomLabel = appliedFilters.bedrooms === 0 ? 'Studio' : `${appliedFilters.bedrooms}-bedroom`;
    filterContextParts.push(`${bedroomLabel} properties only`);
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

  // PTCF-structured maximum capacity market prompt
  const prompt = `<PERSONA>
You are a friendly real estate teacher explaining Airbnb investing to someone who has NEVER invested before. Imagine you're explaining to a smart friend who's curious but has no background in real estate. Your communication style is:
- Super simple language (if a word is confusing, explain it or use a simpler word)
- Use real-life comparisons ("Think of it like..." or "Imagine if...")
- Friendly and encouraging (like talking to a friend over coffee)
- Always explain the "so what?" - why does this number matter?
</PERSONA>

<TASK>
Analyze the market data below and produce a BEGINNER-FRIENDLY MARKET REPORT. This report should answer the simple question: "How's this market for Airbnb?" in a way that ANYONE can understand - even if they've never invested in real estate before.
</TASK>

<CONTEXT>
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
                                           COMPREHENSIVE MARKET INVESTMENT ANALYSIS
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 1: MARKET OVERVIEW
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

MARKET DETAILS
Market Name: ${market.name}
Location: ${market.city}, ${market.state}, ${market.country}
Total Active Listings: ${metrics.totalListings.toLocaleString()}${filterContext}

MARKET SCORES
Overall Market Score: ${scores.marketScore}/100
Investability Score: ${scores.investabilityScore}/100
Rental Demand Score: ${scores.rentalDemandScore}/100
Revenue Growth Score: ${scores.revenueGrowthScore}/100
Seasonality Score: ${scores.seasonalityScore}/100
Regulation Score: ${scores.regulationScore}/100

MARKET METRICS
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

REVENUE BY BEDROOM COUNT
${revenueByBedroom.map(r => 
  `${r.bedrooms} Bedroom: $${r.avgRevenue.toLocaleString()}/yr avg | ${r.avgOccupancy}% occupancy | $${r.avgAdr} ADR | ${r.listingCount.toLocaleString()} listings`
).join('\n')}

BEST PERFORMING PROPERTY SIZES:
${bestBedrooms.slice(0, 3).map((r, i) => 
  `${i+1}. ${r.bedrooms} Bedroom properties: $${r.avgRevenue.toLocaleString()}/yr average`
).join('\n')}

${propertyTypes ? `
PROPERTY TYPE DISTRIBUTION
${propertyTypes.map(p => 
  `${p.type}: ${p.count.toLocaleString()} listings | $${p.avgRevenue.toLocaleString()}/yr avg | ${p.avgOccupancy}% occupancy`
).join('\n')}
` : ''}

═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 3: HISTORICAL TRENDS (5 YEARS / 60 MONTHS)
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

YEAR-OVER-YEAR PERFORMANCE
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
${submarkets.slice(0, 15).map((s, i) => 
  `${i+1}. ${s.name}\n   Listings: ${s.listingCount.toLocaleString()}${s.metrics ? ` | Revenue: $${s.metrics.revenue.toLocaleString()}/yr | ADR: $${s.metrics.adr} | Occupancy: ${s.metrics.occupancy}%${s.metrics.marketScore ? ` | Score: ${s.metrics.marketScore}` : ''}` : ''}`
).join('\n\n')}
` : ''}

${cancellationPolicies ? `
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
SECTION 9: CANCELLATION POLICY ANALYSIS
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

POLICY DISTRIBUTION & PERFORMANCE
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
Total Listings: ${professionalStats.totalListings.toLocaleString()}
Professionally Managed: ${professionalStats.professionalCount.toLocaleString()} (${professionalStats.professionalPercentage}%)
Individual Hosts: ${professionalStats.individualCount.toLocaleString()} (${(100 - professionalStats.professionalPercentage).toFixed(1)}%)
Superhosts: ${professionalStats.superhostCount.toLocaleString()} (${professionalStats.superhostPercentage}%)

REVENUE COMPARISON
Avg Revenue (Professional): $${professionalStats.avgRevenueProfessional.toLocaleString()}/yr
Avg Revenue (Individual): $${professionalStats.avgRevenueIndividual.toLocaleString()}/yr
Professional Revenue Premium: ${professionalStats.revenuePremiumPercent >= 0 ? '+' : ''}${professionalStats.revenuePremiumPercent}%
` : ''}
</CONTEXT>

<FORMAT>
Write a BEGINNER-FRIENDLY market report that answers "How's this market for Airbnb?"

Write like you're explaining to a friend who's curious about Airbnb investing but has never done it before. Use simple words, real examples, and always explain WHY each number matters.

# THE QUICK ANSWER
${filterContextParts.length > 0 ? `Start with: "Let me tell you about ${filterContextParts.join(' ')} in this market..."` : ''}
In 2-3 sentences, give the "elevator pitch" answer to "How's this market?" Use a simple grade (A, B, C, D, F) and explain what it means. Example: "This market gets a B+ grade - that means it's pretty good but not amazing. Properties here make about $X per year on average."

# HOW MUCH MONEY CAN YOU MAKE HERE?

## The Numbers (Explained Simply)
Explain the revenue like this:
- "The average Airbnb here makes $X per year. That's about $X per month."
- "The best properties (top 25%) make $X per year - that's like earning $X every month!"
- "The typical property is booked X% of the time. Think of it like: out of every 10 nights, your place would be rented X nights."
- "Guests pay about $X per night on average."

Always add context: "Is $X good? Well, if your mortgage is $Y per month, you'd need to make at least that much to break even."

## Which Property Sizes Make the Most?
Explain each bedroom count simply:
- "Studios (no separate bedroom) make about $X/year"
- "1-bedrooms make about $X/year"
- "2-bedrooms make about $X/year" etc.
Then say which size seems to be the "sweet spot" and why.

# WHEN'S THE BEST TIME TO HAVE GUESTS?

## The Busy Season vs Slow Season
Explain seasonality like this:
- "The busiest months are [months] - this is when you'll make the most money (about $X/month)"
- "The slowest months are [months] - expect to make less (about $X/month)"
- "The difference between busy and slow season is about X%. Think of it like: in summer you might make $1000, but in winter only $600."

Explain WHY: "This market is busy in [season] because [reason - tourism, events, weather, etc.]"

# HOW CROWDED IS THIS MARKET?

## Your Competition
Explain simply:
- "There are X other Airbnbs in this area. That's [a lot/moderate/not many] for a market this size."
- "X% are run by professional companies (like property management firms). The rest are regular people like you."
- "X% of hosts have the 'Superhost' badge - that means they're really good at what they do."

## What the Top Earners Are Doing
Look at the top performers and explain:
- "The highest-earning property makes $X/year. Here's what makes it special: [features, location, etc.]"
- "Most top earners have [X bedrooms, certain amenities, etc.]"
- "They charge about $X per night and are booked X% of the time."

# IS THIS MARKET GETTING BETTER OR WORSE?

## The Trend
Explain year-over-year changes simply:
- "Compared to last year, properties are making [more/less/about the same] money."
- "The change is X% - that means if you made $10,000 last year, you'd make about $[calculated] this year."
- "More/fewer Airbnbs are opening up here, which means [more competition/less competition]."

# THINGS TO THINK ABOUT

## The Good Stuff
List 2-3 positive things about this market in simple terms.

## The Not-So-Good Stuff  
List 2-3 concerns or challenges, explained simply. Don't scare people, just be honest.

# THE BOTTOM LINE

End with a simple summary:
- "In plain English, this market [is great for beginners / has potential but needs work / might be challenging]."
- "The average property makes $X/year, which is [above/below/about average] for markets like this."
- "The market is [growing/stable/shrinking] based on the last 12 months of data."

IMPORTANT NOTE ABOUT MARKET GRADES: Even if a market has a lower overall grade (C, D, or F), that does NOT mean there are no good opportunities there. Market averages include many hosts who are doing a poor job - bad photos, wrong pricing, poor guest communication, etc. A skilled operator who does things right can often significantly outperform the market average. The top performers in ANY market prove this - look at how much more they earn than the average. So a "C grade" market might still be great for someone who's willing to put in the work to stand out from the crowd.
</FORMAT>

<CONSTRAINTS>
- Use simple words a third grader would understand
- Always explain what numbers MEAN, not just what they ARE
- Use comparisons like "That's like..." or "Think of it as..."
- Be honest but friendly - don't scare people, but don't sugarcoat problems
- DO NOT use jargon like "RevPAR", "ADR", "YoY" without explaining them
- DO NOT use emojis
- DO NOT give specific advice like "you should buy here" - just explain the data
- ONLY use the data provided - do not make assumptions or use external knowledge
- When displaying scores, always round to whole numbers (e.g., 73 not 73.567)
- Maximum 2,500 words total
- DO NOT include any placeholder text like "[Your Name]", dates, or "Market Analyst" headers - start directly with the analysis content
</CONSTRAINTS>`;

  try {
    const response = await callGeminiMax(prompt);
    // Post-process to remove any prescriptive language that slipped through
    return stripPrescriptiveLanguage(response.trim());
  } catch (error) {
    console.error('Error generating max market advice:', error);
    return 'Unable to generate comprehensive market analysis at this time. Please try again.';
  }
}

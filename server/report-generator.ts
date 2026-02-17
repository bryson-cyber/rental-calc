/**
 * AI Service for Property Analysis
 * 
 * Generates educational, easy-to-understand content for rental property
 * analysis reports using Claude AI.
 * 
 * Provider is controlled by LLM_PROVIDER env var:
 * - Claude Sonnet 4.6 for all operations
 * - "anthropic": Anthropic Claude Sonnet 4.6 (primary) / Haiku 4.5 (flash)
 * 
 * PROMPTING BEST PRACTICES APPLIED:
 * - PTCF framework (Persona, Task, Context, Format)
 * - Provider-appropriate thinking/effort settings
 * - Explicit instructions (per Claude best practices)
 * - XML tags for structure
 */

import { ENV } from './_core/env';
import { callLLM, callLLMMax } from './llm-provider';

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

// 
// LLM PROVIDER CONFIGURATION
// 
//
// All LLM calls are routed through llm-provider.ts which handles:
// - All calls route through Claude Sonnet 4.6
// - Model selection (pro vs flash tier)
// - Thinking/effort configuration
// - Retry logic with exponential backoff
//
// callLLM()    → standard call
// callLLMMax() → extended capacity with retries
// 

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

// All LLM calls use callLLM/callLLMMax from llm-provider.ts

/**
 * Investment Advisor Chat - Uses Flash model for faster responses
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
    marketContext = `\n\n<context>\nAvailable Market Data:\n${context.markets.map(m => 
      `- ${m.name}: Score ${m.scores.market_score}/100, Investability ${m.scores.investability}, Demand ${m.scores.rental_demand}, Revenue Growth ${m.scores.revenue_growth}, Seasonality ${m.scores.seasonality}, Regulation ${m.scores.regulation}, Avg Revenue $${m.metrics.revenue.toLocaleString()}, Occupancy ${m.metrics.occupancy}%, ADR $${m.metrics.adr}, ${m.listing_count.toLocaleString()} listings`
    ).join('\n')}\n</context>`;
  }

  // Build conversation history
  const historyText = conversationHistory.length > 0 
    ? `\n\nConversation History:\n${conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Advisor'}: ${m.content}`).join('\n')}`
    : '';

  // System prompt with persona (Claude best practice: separate system from user content)
  const systemPrompt = `You are David Wei Chen, a short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. Your communication style: data-first (every claim references specific numbers), "story before the stats" (lead with narrative, then data), analogy over jargon, warm but direct.`;

  // PTCF-structured prompt
  const prompt = `<task>
Answer the user's question about short-term rental markets. This is a live chat conversation — the user is actively researching markets and needs clear, data-grounded answers to make investment decisions.
</task>
${marketContext}${historyText}

<format>
Keep responses concise (2-4 paragraphs). Use bullet points for market comparisons. Cite specific numbers and percentages from the provided data. Explain what each metric means for investors. Present data and observations — let the reader draw their own conclusions.
</format>

<grounding_rules>
Reference only markets present in the dataset above. If a user asks about markets not in the data, say "I don't have data on that market yet." If data is missing for a specific metric, acknowledge the gap.
</grounding_rules>

User Question: ${question}`;

  try {
    // Use Flash model for faster chat responses with medium thinking
    const response = await callLLM(prompt, { 
      model: 'flash',
      thinkingLevel: 'low',
      systemPrompt,
    });
    return response.trim();
  } catch (error) {
    console.error('Error getting investment advice:', error);
    return "I apologize, but I'm having trouble processing your question right now. Please try again in a moment, or feel free to rephrase your question.";
  }
}
export async function generateEnhancedPropertyReport(
  address: string,
  features: Record<string, unknown>,
  reportMode: 'pro' | 'guided' = 'guided'
): Promise<string> {
  // Import pro mode overrides
  const { getProModeOverride, getAudienceDescription } = await import('./pro-mode-prompts');
  const proOverride = getProModeOverride(reportMode, 'property');
  const audience = getAudienceDescription(reportMode);
  
  // System prompt with persona (Claude best practice)
  const systemPrompt = reportMode === 'pro' 
    ? 'You are a senior real estate investment analyst who produces institutional-grade Airbnb market assessments with precise benchmarks.'
    : 'You are a real estate analyst who explains Airbnb investment opportunities in plain, beginner-friendly language.';

  // PTCF-structured prompt for property reports
  const prompt = `${proOverride}

<task>
Generate a brief property analysis summary for the address: ${address}
This summary will be the first thing a potential investor reads about this property, so make it clear and compelling.
</task>

<context>
Property Features: ${JSON.stringify(features, null, 2)}
</context>

<format>
Write 2-3 paragraphs. Use plain language and explain financial terms inline. Focus on key metrics and what they mean for someone evaluating this property as an investment.
</format>`;

  try {
    const response = await callLLM(prompt, { 
      maxTokens: 2048,
      thinkingLevel: 'low',
      systemPrompt,
    });
    return response.trim();
  } catch (error) {
    console.error('Error generating enhanced property report:', error);
    return 'Unable to generate property report at this time.';
  }
}

export async function generateEnhancedMarketReport(
  marketName: string,
  metrics: Record<string, unknown>,
  reportMode: 'pro' | 'guided' = 'guided'
): Promise<string> {
  // Import pro mode overrides
  const { getProModeOverride } = await import('./pro-mode-prompts');
  const proOverride = getProModeOverride(reportMode, 'market');
  
  // System prompt with persona (Claude best practice)
  const systemPrompt = reportMode === 'pro'
    ? 'You are a senior real estate market analyst who produces institutional-grade Airbnb market assessments with precise benchmarks.'
    : 'You are a real estate market analyst who explains Airbnb market conditions in plain, beginner-friendly language.';

  // PTCF-structured prompt for market reports
  const prompt = `${proOverride}

<task>
Generate a brief market analysis summary for: ${marketName}
This summary helps investors quickly understand whether this market is worth investigating further.
</task>

<context>
Market Metrics: ${JSON.stringify(metrics, null, 2)}
</context>

<format>
Write 2-3 paragraphs. Use plain language and explain financial terms inline. Focus on key metrics and what they mean for investors evaluating this market.
</format>`;

  try {
    const response = await callLLM(prompt, { 
      maxTokens: 2048,
      thinkingLevel: 'low',
      systemPrompt,
    });
    return response.trim();
  } catch (error) {
    console.error('Error generating enhanced market report:', error);
    return 'Unable to generate market report at this time.';
  }
}

export interface MarketTrendNarrativeInput {
  reportMode?: 'pro' | 'guided'; // Report style mode
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
  const { marketName, currentYearRevenue, lastYearRevenue, yoyChange, occupancy, adr, monthlyData, marketGrade, marketScore, reportMode = 'guided' } = input;
  
  // System prompt with persona (Claude best practice)
  const trendSystemPrompt = reportMode === 'pro'
    ? 'You are a quantitative market analyst who produces concise, benchmark-driven trend assessments for institutional investors.'
    : 'You are a data analyst who explains market trends in plain, easy-to-understand language.';

  // PTCF-structured prompt for trend analysis
  const prompt = `<task>
Analyze the market trend data for ${marketName} and explain what it means for someone considering entering this market.
</task>

<context>
Market: ${marketName}
Market Grade: ${marketGrade} (Score: ${marketScore}/100)
Current Year Revenue: $${currentYearRevenue.toLocaleString()}
Last Year Revenue: $${lastYearRevenue.toLocaleString()}
Year-over-Year Change: ${yoyChange > 0 ? '+' : ''}${yoyChange.toFixed(1)}%
Current Occupancy: ${(occupancy * 100).toFixed(0)}%
Average Daily Rate: $${adr.toFixed(0)}

Monthly Breakdown (most recent first):
${monthlyData.slice(0, 6).map(d => `${d.month}: $${d.currentRevenue.toLocaleString()} (${d.yoyChange > 0 ? '+' : ''}${d.yoyChange.toFixed(1)}% YoY)`).join('\n')}
</context>

<format>
Write 1-2 paragraphs. Identify the trend direction (growing, declining, stable). Explain what this means in practical terms using simple comparisons (e.g., "up 10% from last year"). Mention the market grade and what it indicates.
</format>`;

  try {
    const response = await callLLM(prompt, { 
      maxTokens: 1024,
      thinkingLevel: 'low',
      systemPrompt: trendSystemPrompt,
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
  mode?: 'rent' | 'purchase'; // Analysis mode
  reportMode?: 'pro' | 'guided'; // Report style mode
  property: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    bedrooms: number;
    bathrooms: number;
    accommodates: number;
    monthlyRent?: number;
    // Purchase mode fields
    purchasePrice?: number;
    loanType?: 'conventional' | 'dscr' | 'fha' | 'cash';
    downPaymentPercent?: number;
    interestRate?: number;
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
 * Supports both rent (arbitrage) and purchase (investment) modes
 */
export async function generateComprehensivePropertyAdvice(
  input: PropertyAdvisorInput
): Promise<string> {
  const { mode = 'rent', reportMode = 'guided', property, revenue, cashFlow, comparables, marketGrade, marketInsights, historicalData, seasonality } = input;
  
  // Import pro mode overrides
  const { getProModeOverride, getCommunicationStyle } = await import('./pro-mode-prompts');
  const proOverride = getProModeOverride(reportMode, 'property');
  const commStyle = getCommunicationStyle(reportMode);
  
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

  // Calculate purchase mode investment metrics
  const purchasePrice = property.purchasePrice || 0;
  const downPaymentPercent = property.downPaymentPercent || 20;
  const interestRate = property.interestRate || 7;
  const loanType = property.loanType || 'conventional';
  
  // Investment calculations for purchase mode
  const downPayment = purchasePrice * (downPaymentPercent / 100);
  const loanAmount = purchasePrice - downPayment;
  const closingCosts = purchasePrice * 0.03; // 3% closing costs
  const totalCashNeeded = downPayment + closingCosts;
  
  // Monthly mortgage calculation (30-year fixed)
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = 360; // 30 years
  const monthlyMortgage = loanType === 'cash' ? 0 : 
    loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  const annualMortgage = monthlyMortgage * 12;
  
  // Operating expenses (48% of revenue is industry standard)
  const operatingExpenses = revenue.projected * 0.48;
  const netOperatingIncome = revenue.projected - operatingExpenses;
  
  // Investment metrics
  const capRate = purchasePrice > 0 ? (netOperatingIncome / purchasePrice * 100) : 0;
  const annualCashFlow = netOperatingIncome - annualMortgage;
  const monthlyCashFlow = annualCashFlow / 12;
  const cashOnCashReturn = totalCashNeeded > 0 ? (annualCashFlow / totalCashNeeded * 100) : 0;
  const dscr = annualMortgage > 0 ? (netOperatingIncome / annualMortgage) : 0;
  const breakEvenOccupancy = annualMortgage > 0 ? 
    ((annualMortgage + operatingExpenses) / revenue.projected * revenue.occupancy) : 0;

  // Choose prompt based on mode
  const isPurchaseMode = mode === 'purchase' && purchasePrice > 0;
  
  // Build mode-specific context and prompt
  const purchaseContext = isPurchaseMode ? `
PURCHASE ANALYSIS
Purchase Price: $${purchasePrice.toLocaleString()}
Loan Type: ${loanType.toUpperCase()}
Down Payment: $${downPayment.toLocaleString()} (${downPaymentPercent}%)
Loan Amount: $${loanAmount.toLocaleString()}
Interest Rate: ${interestRate}%
Closing Costs: $${closingCosts.toLocaleString()}
Total Cash Needed: $${totalCashNeeded.toLocaleString()}

INVESTMENT METRICS
Cap Rate: ${capRate.toFixed(2)}%
Cash-on-Cash Return: ${cashOnCashReturn.toFixed(2)}%
DSCR (Debt Service Coverage Ratio): ${dscr.toFixed(2)}
Break-even Occupancy: ${breakEvenOccupancy.toFixed(0)}%

CASH FLOW ANALYSIS
Projected Annual Revenue: $${revenue.projected.toLocaleString()}
Operating Expenses (48%): -$${operatingExpenses.toLocaleString()}
Net Operating Income (NOI): $${netOperatingIncome.toLocaleString()}
Annual Mortgage Payment: -$${annualMortgage.toLocaleString()}
Annual Cash Flow: $${annualCashFlow.toLocaleString()}
Monthly Cash Flow: $${monthlyCashFlow.toLocaleString()}
` : '';

  const rentContext = !isPurchaseMode && property.monthlyRent ? `
CASH FLOW ANALYSIS (Based on $${property.monthlyRent.toLocaleString()}/month rent)
Monthly Revenue: $${cashFlow?.monthlyRevenue.toLocaleString() || 'N/A'}
Monthly Rent: $${cashFlow?.monthlyRent.toLocaleString() || 'N/A'}
Monthly Profit: $${cashFlow?.monthlyProfit.toLocaleString() || 'N/A'}
Annual Profit: $${cashFlow?.annualProfit.toLocaleString() || 'N/A'}
Profit Margin: ${cashFlow?.profitMargin.toFixed(1) || 'N/A'}%
Revenue-to-Rent Ratio: ${cashFlow ? (cashFlow.monthlyRevenue / cashFlow.monthlyRent).toFixed(2) : 'N/A'}x
` : '';

  // System prompt with persona (Claude best practice: separate system from user content)
  const systemPrompt = isPurchaseMode 
    ? `You are David Wei Chen, a short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. You evaluate properties for purchase using Cap Rate, Cash-on-Cash Return, and DSCR.${reportMode === 'pro' ? ' You speak to the reader as a peer investor with precise financial language.' : ' You use the "story before the stats" approach and analogy over jargon — like talking to a friend considering their first investment property.'}`
    : `You are David Wei Chen, a short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets.${reportMode === 'pro' ? ' You evaluate rental arbitrage opportunities with precise financial metrics and market benchmarks.' : ' You help beginners understand if a property is a good rental arbitrage opportunity. You use the "story before the stats" approach and analogy over jargon — like talking to a friend curious about Airbnb investing.'}`;

  // PTCF-structured comprehensive prompt
  const prompt = `${proOverride}

<task>
${isPurchaseMode
  ? `Analyze this property as a short-term rental investment purchase. The reader is deciding whether to commit $${totalCashNeeded.toLocaleString()} to this deal — focus on investment metrics (Cap Rate, Cash-on-Cash Return, DSCR) and whether the numbers justify the purchase.`
  : `Analyze this property's potential as a rental arbitrage opportunity. The reader is deciding whether to sign a lease and invest their time and money — write a comprehensive, honest assessment they can use to make that decision.`}
</task>

<context>
PROPERTY DETAILS
Address: ${property.address}
Location: ${property.city}, ${property.state} ${property.zipCode}
Configuration: ${property.bedrooms} BR | ${property.bathrooms} BA | Sleeps ${property.accommodates}
${isPurchaseMode ? purchaseContext : rentContext}

REVENUE PROJECTIONS
Projected Annual Revenue: $${revenue.projected.toLocaleString()}
Conservative Estimate: $${revenue.low.toLocaleString()}
Optimistic Estimate: $${revenue.high.toLocaleString()}
Average Daily Rate (ADR): $${revenue.adr.toLocaleString()}
Projected Occupancy: ${revenue.occupancy}%

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
</context>

<format>
${isPurchaseMode ? `Write a comprehensive investment analysis with these sections:

## Executive Summary
A 2-3 sentence overview of whether this is a good investment to purchase and why, based on the investment metrics.

## Investment Metrics Breakdown
Evaluate the ${capRate.toFixed(2)}% Cap Rate (benchmark: 8-12% for STR), ${cashOnCashReturn.toFixed(2)}% Cash-on-Cash Return (benchmark: 15%+ is excellent), DSCR of ${dscr.toFixed(2)} (benchmark: 1.25+ required by most lenders), and ${breakEvenOccupancy.toFixed(0)}% break-even occupancy cushion.

## The Numbers
Assess the $${monthlyCashFlow.toLocaleString()} monthly cash flow sustainability, $${totalCashNeeded.toLocaleString()} total cash needed and payback period, and revenue vs. competitors.

## Key Risks & Challenges
What could impact returns? Market saturation concerns? Regulatory or seasonal risks?

## Competitive Positioning
How does this property stack up? What would it take to achieve projected occupancy?

## Bottom Line Investment Recommendation
Give a clear BUY, PASS, or CONSIDER recommendation with specific reasoning. Include who this investment suits best (cash buyer, DSCR investor, house hacker), key success factors, and what to watch for.

Focus on investment metrics and cash flow — this is a purchase decision.` : `Write a comprehensive analysis with these sections:

## Executive Summary
A 2-3 sentence overview of whether this is a good opportunity and why.

## The Opportunity
What makes this property attractive (or not)? How does the revenue compare to competitors? What's the profit potential?

## Key Risks & Challenges
What could go wrong? What competition challenges exist? Any concerning trends?

## Competitive Positioning
How does this property stack up? Is the market saturated or is there room for new listings?

## Seasonality Strategy
When are the best and worst times to earn? How should the operator plan for slow seasons? What pricing strategy does the data suggest?

## Bottom Line Recommendation
Give a clear YES, NO, or MAYBE recommendation with specific reasoning. Include who this opportunity suits best, key success factors, and what to watch for.

Cite the actual numbers and write for someone evaluating their first rental arbitrage deal.`}
</format>

<grounding_rules>
Use only the data provided above. Be honest about risks while highlighting genuine opportunities. Use plain language and explain financial terms inline.
${isPurchaseMode ? `Focus on Cap Rate, Cash-on-Cash Return, DSCR, and monthly cash flow. Compare metrics to industry benchmarks. This is a purchase decision, not a rental arbitrage decision.` : `Focus on cash flow and profit margin, not property appreciation.`}
</grounding_rules>`;

  try {
    const response = await callLLM(prompt, { 
      maxTokens: 8192, 
      thinkingLevel: 'high',
      systemPrompt,
    });
    return response.trim();
  } catch (error) {
    console.error('Error generating comprehensive property advice:', error);
    return 'Unable to generate property analysis at this time. Please try again.';
  }
}
/**
 * MAXIMUM CAPACITY AI ADVISORS
 * 
 * These functions maximize Claude Sonnet 4.6's full capacity:
 * - Input: Up to 200K tokens
 * - Output: Up to 64K tokens (~50,000 words / 50+ pages)
 * - Effort: High for comprehensive reasoning
 * 
 * We send ALL available AirDNA data and request comprehensive analysis.
 */

/**
 * Maximum Capacity Property Advisor Input
 * Includes ALL available data from AirDNA
 */
export interface MaxPropertyAdvisorInput {
  // Analysis Mode
  mode?: 'rent' | 'purchase';
  reportMode?: 'pro' | 'guided'; // Report style mode
  
  // Purchase Mode Data (only used when mode === 'purchase')
  purchaseData?: {
    purchasePrice: number;
    downPaymentPercent: number;
    interestRate: number;
    loanType: 'conventional' | 'dscr' | 'fha' | 'cash';
    monthlyMortgage: number;
    downPayment: number;
    loanAmount: number;
    closingCosts: number;
    totalCashNeeded: number;
  };
  
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
  
  // Supply Trend Data (from market historical active_listings)
  supplyTrend?: {
    currentListings: number;
    listings12MonthsAgo: number;
    netChange: number;
    percentChange: number;
    trend: 'growing' | 'declining' | 'stable';
    insight: string;
    monthlyData?: Array<{
      month: string;
      activeListings: number;
      changeFromPrevious: number;
    }>;
  };
  
  // Submarket/Neighborhood Data
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
  const { mode = 'rent', reportMode = 'guided', purchaseData, property, revenue, cashFlow, comparables, marketInsights, historicalData, seasonality, marketGrade, marketPosition, rentometerData, supplyTrend, submarkets } = input;
  
  // Import pro mode overrides
  const { getProModeOverride, getCommunicationStyle } = await import('./pro-mode-prompts');
  const proOverride = getProModeOverride(reportMode, 'property');
  const commStyle = getCommunicationStyle(reportMode);
  
  // Determine if this is purchase mode analysis
  const isPurchaseMode = mode === 'purchase' && purchaseData;
  
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

  // Calculate purchase mode investment metrics if applicable
  let purchaseMetrics: {
    capRate: number;
    cashOnCash: number;
    dscr: number;
    breakEvenOccupancy: number;
    monthlyNOI: number;
    annualNOI: number;
    annualCashFlow: number;
    monthlyCashFlow: number;
  } | null = null;
  
  if (isPurchaseMode && purchaseData) {
    const operatingExpenses = revenue.projected * 0.35; // 35% operating expenses
    const annualNOI = revenue.projected - operatingExpenses;
    const monthlyNOI = annualNOI / 12;
    const annualMortgage = purchaseData.monthlyMortgage * 12;
    const annualCashFlow = annualNOI - annualMortgage;
    const monthlyCashFlow = annualCashFlow / 12;
    
    purchaseMetrics = {
      capRate: (annualNOI / purchaseData.purchasePrice) * 100,
      cashOnCash: (annualCashFlow / purchaseData.totalCashNeeded) * 100,
      dscr: annualNOI / annualMortgage,
      breakEvenOccupancy: ((purchaseData.monthlyMortgage + (operatingExpenses / 12)) / (revenue.projected / 12)) * 100,
      monthlyNOI,
      annualNOI,
      annualCashFlow,
      monthlyCashFlow,
    };
  }

  // System prompt with persona (Claude best practice: separate system from user content)
  const personaSection = isPurchaseMode ? `
${reportMode === 'pro' 
    ? `You are a world-class real estate investment analyst who produces institutional-grade property purchase assessments. You speak to the reader as a peer investor with precise financial language.

Your communication style:
${commStyle}` 
    : `You are a world-class real estate investment analyst who helps beginners understand property purchase opportunities. You explain complex investment metrics in simple, friendly language, like talking to a smart friend who's curious about buying rental properties but has never done it before.

Your communication style:
- Use simple language and explain any confusing terms inline
- Use real-life comparisons ("Think of it like..." or "Imagine if...")
- Be friendly and encouraging, like talking to a friend
- Always explain the "so what?" for every number
- Focus on investment returns: Cap Rate, Cash-on-Cash, DSCR`}
${proOverride}` : `
${reportMode === 'pro'
    ? `You are a world-class rental arbitrage analyst who produces institutional-grade opportunity assessments with precise financial metrics and market benchmarks.

Your communication style:
${commStyle}`
    : `You are a world-class rental arbitrage analyst who helps beginners understand investment opportunities. You explain complex data in simple, friendly language, like talking to a smart friend who's curious about Airbnb investing but has never done it before.

Your communication style:
- Use simple language and explain any confusing terms inline
- Use real-life comparisons ("Think of it like..." or "Imagine if...")
- Be friendly and encouraging, like talking to a friend
- Always explain the "so what?" for every number`}
${proOverride}`;

  const taskSection = isPurchaseMode ? `<task>
Analyze this property as a property purchase investment. Produce a comprehensive investment report.

This analysis is for a property purchase scenario where the investor:
1. Buys this property (pays purchase price, gets a mortgage)
2. Furnishes and lists it on Airbnb/VRBO as a short-term rental
3. Earns short-term rental income from guests
4. Keeps the profit (STR income minus mortgage, taxes, and expenses)

Focus your analysis on:
- Cap Rate (NOI / Purchase Price)
- Cash-on-Cash Return (Annual Cash Flow / Cash Invested)
- DSCR (Does the property income cover the mortgage?)
- Monthly cash flow after mortgage
- How STR income compares to traditional long-term rental
</task>` : `<task>
Analyze this property as a rental arbitrage opportunity. Produce a comprehensive investment report.

This analysis is for a rental arbitrage scenario where the investor:
1. Signs a lease to rent this property (pays monthly rent to landlord)
2. Furnishes and lists it on Airbnb/VRBO
3. Earns short-term rental income from guests
4. Keeps the profit (STR income minus rent and expenses)

Focus your analysis on:
- Whether the STR revenue can cover the monthly rent
- Monthly cash flow after rent
- Profit margin viability
- Break-even occupancy needed
</task>`;

  const prompt = `${personaSection}

${taskSection}

<context>
Report Date: ${currentDate}

SECTION 1: PROPERTY OVERVIEW

PROPERTY DETAILS
Address: ${property.address}
City: ${property.city}, ${property.state} ${property.zipCode}
Configuration: ${property.bedrooms} Bedrooms | ${property.bathrooms} Bathrooms | Sleeps ${property.accommodates}
${isPurchaseMode && purchaseData ? `
PURCHASE DETAILS
Purchase Price: $${purchaseData.purchasePrice.toLocaleString()}
Loan Type: ${purchaseData.loanType.toUpperCase()}
Down Payment: $${purchaseData.downPayment.toLocaleString()} (${purchaseData.downPaymentPercent}%)
Loan Amount: $${purchaseData.loanAmount.toLocaleString()}
Interest Rate: ${purchaseData.interestRate}%
Monthly Mortgage: $${purchaseData.monthlyMortgage.toLocaleString()}
Closing Costs: $${purchaseData.closingCosts.toLocaleString()}
Total Cash Needed: $${purchaseData.totalCashNeeded.toLocaleString()}
` : property.monthlyRent ? `Monthly Rent: $${property.monthlyRent.toLocaleString()}` : 'Monthly Rent: Not specified'}
${property.latitude && property.longitude ? `Coordinates: ${property.latitude}, ${property.longitude}` : ''}

SECTION 2: REVENUE PROJECTIONS

PROJECTED EARNINGS
Annual Revenue (Projected): $${revenue.projected.toLocaleString()}
Annual Revenue (Conservative): $${revenue.low.toLocaleString()}
Annual Revenue (Optimistic): $${revenue.high.toLocaleString()}
Monthly Revenue (Average): $${Math.round(revenue.projected / 12).toLocaleString()}

Key Metrics:
• Average Daily Rate (ADR): $${revenue.adr.toLocaleString()}
• Projected Occupancy Rate: ${revenue.occupancy}%
• Revenue Per Available Room (RevPAR): $${revenue.revpar.toLocaleString()}

${isPurchaseMode && purchaseMetrics ? `
INVESTMENT ANALYSIS (PURCHASE MODE)

KEY INVESTMENT METRICS
• Cap Rate: ${purchaseMetrics.capRate.toFixed(1)}% ${purchaseMetrics.capRate >= 8 ? '(Excellent - above 8% target)' : purchaseMetrics.capRate >= 6 ? '(Good - meets 6% minimum)' : '(Below typical 6% threshold)'}
• Cash-on-Cash Return: ${purchaseMetrics.cashOnCash.toFixed(1)}% ${purchaseMetrics.cashOnCash >= 15 ? '(Excellent - above 15% target)' : purchaseMetrics.cashOnCash >= 10 ? '(Good - meets 10% minimum)' : '(Below typical 10% threshold)'}
• DSCR (Debt Service Coverage Ratio): ${purchaseMetrics.dscr.toFixed(2)} ${purchaseMetrics.dscr >= 1.25 ? '(Strong - lenders prefer 1.25+)' : purchaseMetrics.dscr >= 1.0 ? '(Adequate - covers debt)' : '(Warning - income does not cover debt)'}
• Break-Even Occupancy: ${purchaseMetrics.breakEvenOccupancy.toFixed(1)}% ${purchaseMetrics.breakEvenOccupancy <= 50 ? '(Excellent - low risk)' : purchaseMetrics.breakEvenOccupancy <= 65 ? '(Good - manageable)' : '(High - risky in slow seasons)'}

CASH FLOW ANALYSIS
• Annual Net Operating Income (NOI): $${purchaseMetrics.annualNOI.toLocaleString()}
• Monthly NOI: $${purchaseMetrics.monthlyNOI.toLocaleString()}
• Annual Mortgage Payments: $${(purchaseData!.monthlyMortgage * 12).toLocaleString()}
• Annual Cash Flow (After Mortgage): $${purchaseMetrics.annualCashFlow.toLocaleString()}
• Monthly Cash Flow: $${purchaseMetrics.monthlyCashFlow.toLocaleString()}

INVESTMENT SUMMARY
• Total Cash Invested: $${purchaseData!.totalCashNeeded.toLocaleString()}
• Projected Annual Return: $${purchaseMetrics.annualCashFlow.toLocaleString()} (${purchaseMetrics.cashOnCash.toFixed(1)}% of cash invested)
• Time to Recover Investment: ${(purchaseData!.totalCashNeeded / purchaseMetrics.annualCashFlow).toFixed(1)} years
` : cashFlow ? `
CASH FLOW ANALYSIS (RENTAL ARBITRAGE)
Monthly Revenue: $${cashFlow.monthlyRevenue.toLocaleString()}
Monthly Rent: $${cashFlow.monthlyRent.toLocaleString()}
Monthly Profit: $${cashFlow.monthlyProfit.toLocaleString()}
Annual Profit: $${cashFlow.annualProfit.toLocaleString()}
Profit Margin: ${cashFlow.profitMargin.toFixed(1)}%
Revenue-to-Rent Ratio: ${(cashFlow.monthlyRevenue / cashFlow.monthlyRent).toFixed(2)}x
Break-Even Occupancy: ${cashFlow.breakEvenOccupancy.toFixed(1)}%
Safety Cushion: ${(revenue.occupancy - cashFlow.breakEvenOccupancy).toFixed(1)} percentage points above break-even
` : ''}

SECTION 3: MARKET HEALTH & POSITION

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

SECTION 4: HISTORICAL TRENDS (24 MONTHS)

YEAR-OVER-YEAR PERFORMANCE
YoY Revenue Change: ${historicalData.yoyChange >= 0 ? '+' : ''}${historicalData.yoyChange.toFixed(1)}%
Market Trend: ${historicalData.trend.toUpperCase()}
Data Points: ${historicalData.months.length} months of historical data

Monthly Historical Data:
${historicalData.months.map(m => 
  `${m.date}: Revenue $${m.revenue.toLocaleString()} | Occupancy ${m.occupancy}% | ADR $${m.adr} | RevPAR $${m.revpar}${m.listingCount ? ` | ${m.listingCount} listings` : ''}`
).join('\n')}

SECTION 5: SEASONALITY ANALYSIS

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

SECTION 6: SAME-BEDROOM COMPETITOR ANALYSIS (${sameBedroomComps.length} ${property.bedrooms}BR PROPERTIES)

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

SECTION 7: LONG-TERM RENTAL MARKET COMPARISON (Rentometer Data)
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

${supplyTrend ? `
SECTION: SUPPLY TREND ANALYSIS

Current Active Listings: ${supplyTrend.currentListings.toLocaleString()}
Listings 12 Months Ago: ${supplyTrend.listings12MonthsAgo.toLocaleString()}
Net Change: ${supplyTrend.netChange > 0 ? '+' : ''}${supplyTrend.netChange.toLocaleString()} listings
Percent Change: ${supplyTrend.percentChange > 0 ? '+' : ''}${supplyTrend.percentChange.toFixed(1)}%
Trend: ${supplyTrend.trend}
Insight: ${supplyTrend.insight}

Analyze what the supply trend means for a new entrant:
- Is the market getting more competitive or less?
- How does supply growth compare to demand indicators (occupancy, ADR trends)?
- What's the risk of oversaturation?
` : ''}

${submarkets && submarkets.length > 0 ? `
SECTION: NEIGHBORHOOD/SUBMARKET COMPARISON

${submarkets.map(s => `${s.name}: ${s.listingCount} listings${s.metrics ? ` | Revenue: $${s.metrics.revenue.toLocaleString()} | ADR: $${s.metrics.adr.toLocaleString()} | Occupancy: ${s.metrics.occupancy}% | RevPAR: $${s.metrics.revpar.toLocaleString()}${s.metrics.marketScore ? ` | Score: ${s.metrics.marketScore}` : ''}` : ''}`).join('\n')}

Analyze which neighborhoods are strongest for this property type and why.
Identify the best-performing submarket and explain what makes it stand out.
` : ''}
</context>

<format>
Write a comprehensive rental arbitrage analysis report as a clean narrative document. Use plain text formatting only - NO markdown, NO asterisks, NO bullet points, NO headers with # symbols. Write in flowing paragraphs like a professional consultant's report.

Structure your response as follows:

EXECUTIVE SUMMARY

Provide a clear, comprehensive summary of the arbitrage opportunity in narrative form. Include:

The Numbers That Matter: Start with the projected monthly revenue of $${Math.round(revenue.projected / 12).toLocaleString()}. ${property.monthlyRent ? `The monthly rent is $${property.monthlyRent.toLocaleString()}, with estimated operating costs around $${Math.round((revenue.projected / 12) * 0.20).toLocaleString()} (20% of revenue). This leaves an estimated net monthly cash flow of $${Math.round((revenue.projected / 12) - property.monthlyRent - ((revenue.projected / 12) * 0.20)).toLocaleString()}.` : `The monthly rent was not provided, so discuss what maximum rent this property could support while remaining profitable.`}

Quick Assessment: Explain whether this is a good arbitrage opportunity and why.

Key Success Factors: Describe what it would take to succeed with this property.

DETAILED ANALYSIS

Revenue Potential: Explain the projected revenue in simple terms. YOU MUST include all three revenue estimates:
- Projected Annual Revenue: $${revenue.projected.toLocaleString()}
- Conservative Estimate (Safe Bet): $${revenue.low.toLocaleString()}/year
- Optimistic Estimate (Best Case): $${revenue.high.toLocaleString()}/year

Explain what each estimate means and when an investor might expect to hit each level. Compare these figures to same-bedroom competitors.

Cash Flow Analysis: Break down the monthly numbers clearly. Explain the profit margin and what break-even occupancy means in practical terms.

Market Position: Describe how this property compares to competitors. Explain what the market grade means and whether the market is growing or declining.

Seasonality Strategy: Discuss when the best and worst months are. Explain how to plan for slow seasons and what the revenue variance impact means.

Competitive Landscape: Describe what top performers are doing differently. Discuss how saturated the market is and the balance between professional and individual hosts.

Supply Dynamics: If supply trend data is available, explain whether the market is getting more or less competitive. Discuss what the listing growth rate means for new entrants and whether demand is keeping up with supply.

Neighborhood Insights: If submarket data is available, identify which neighborhoods perform best and why. Explain how the property's location compares to top-performing submarkets in the area.

KEY METRICS SUMMARY

Summarize the most important data points in narrative form. Highlight the key financial metrics and note any data limitations.

MARKET CONTEXT

Explain how this property compares to the overall market. Discuss the key competitive factors and what the historical data suggests about future performance.

IMPORTANT FORMATTING RULES:
- Write everything in flowing paragraphs, not bullet points
- Do NOT use asterisks, hashtags, or markdown formatting
- Do NOT use headers with # symbols - just use CAPS for section titles
- Be specific with numbers - cite actual figures from the data
- Explain what metrics mean for someone new to investing
- Be honest about risks but also highlight genuine opportunities
- This should read like a professional consultant's narrative report
</format>

<guidelines>
Base every claim on the data provided above. Compare exclusively to ${property.bedrooms}BR properties for an apples-to-apples analysis. Cite specific dollar amounts, percentages, and competitor names throughout. Write for someone researching this opportunity who has not yet signed a lease — frame the analysis as educational and empowering. Highlight what top performers do so the reader knows what to aim for. Center the analysis on cash flow and profit margin rather than property appreciation. Present risks honestly alongside genuine opportunities.
</guidelines>`;

  try {
    const response = await callLLMMax(prompt, 3, { systemPrompt: personaSection });
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
  reportMode?: 'pro' | 'guided'; // Report style mode
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
  const { reportMode = 'guided', market, scores, metrics, revenueByBedroom, historicalData, seasonality, topPerformers, propertyTypes, bookingPatterns, supplyTrend, submarkets, cancellationPolicies, professionalStats, appliedFilters } = input;
  
  // Import pro mode overrides
  const { getProModeOverride, getCommunicationStyle } = await import('./pro-mode-prompts');
  const proOverride = getProModeOverride(reportMode, 'market');
  const commStyle = getCommunicationStyle(reportMode);
  
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

  // System prompt with persona (Claude best practice: separate system from user content)
  const marketSystemPrompt = reportMode === 'pro' 
    ? `You are a senior real estate market analyst who produces institutional-grade Airbnb market assessments. You speak to the reader as a peer investor evaluating market opportunities.

Your communication style:
${commStyle}`
    : `You are a friendly real estate teacher explaining Airbnb investing to someone who has NEVER invested before. Imagine you're explaining to a smart friend who's curious but has no background in real estate. Your communication style is:
- Super simple language (if a word is confusing, explain it or use a simpler word)
- Use real-life comparisons ("Think of it like..." or "Imagine if...")
- Friendly and encouraging (like talking to a friend over coffee)
- Always explain the "so what?" - why does this number matter?`;

  // PTCF-structured maximum capacity market prompt
  const prompt = `${proOverride}

<task>
${reportMode === 'pro' ? 'Analyze the market data below and produce an INSTITUTIONAL-GRADE MARKET REPORT with precise benchmarks and financial metrics.' : 'Analyze the market data below and produce a BEGINNER-FRIENDLY MARKET REPORT.'} This report should answer the simple question: "How's this market for Airbnb?" in a way that ANYONE can understand.
</task>

<context>

                                           COMPREHENSIVE MARKET INVESTMENT ANALYSIS

SECTION 1: MARKET OVERVIEW
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
SECTION 2: REVENUE BY PROPERTY SIZE
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
SECTION 3: HISTORICAL TRENDS (5 YEARS / 60 MONTHS)
YEAR-OVER-YEAR PERFORMANCE
YoY Revenue Change: ${historicalData.yoyChange >= 0 ? '+' : ''}${historicalData.yoyChange.toFixed(1)}%
Market Trend: ${historicalData.trend.toUpperCase()}
Data Points: ${historicalData.months.length} months of historical data

MONTHLY HISTORICAL DATA:
${historicalData.months.map(m => 
  `${m.date}: Revenue $${m.revenue.toLocaleString()} | Occupancy ${m.occupancy}% | ADR $${m.adr} | ${m.listingCount.toLocaleString()} listings`
).join('\n')}
SECTION 4: SEASONALITY ANALYSIS
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
SECTION 5: TOP PERFORMERS IN THIS MARKET
TOP EARNING PROPERTIES
${topPerformers.map((p, i) => 
  `${i+1}. "${p.title.substring(0, 50)}${p.title.length > 50 ? '...' : ''}"
     Revenue: $${p.revenue.toLocaleString()}/yr | ADR: $${p.adr} | Occupancy: ${p.occupancy}%
     Rating: ${p.rating} stars (${p.reviews} reviews) | ${p.bedrooms}BR/${p.bathrooms}BA
     ${p.isSuperhost ? 'Superhost' : ''} ${p.isProfessionallyManaged ? 'Pro Managed' : ''}`
).join('\n\n')}

${bookingPatterns ? `

SECTION 6: BOOKING PATTERNS
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

SECTION 7: SUPPLY TREND (MARKET SATURATION)
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

SECTION 8: SUBMARKETS / NEIGHBORHOODS
NEIGHBORHOOD BREAKDOWN
${submarkets.slice(0, 15).map((s, i) => 
  `${i+1}. ${s.name}\n   Listings: ${s.listingCount.toLocaleString()}${s.metrics ? ` | Revenue: $${s.metrics.revenue.toLocaleString()}/yr | ADR: $${s.metrics.adr} | Occupancy: ${s.metrics.occupancy}%${s.metrics.marketScore ? ` | Score: ${s.metrics.marketScore}` : ''}` : ''}`
).join('\n\n')}
` : ''}

${cancellationPolicies ? `

SECTION 9: CANCELLATION POLICY ANALYSIS
POLICY DISTRIBUTION & PERFORMANCE
Total Listings Analyzed: ${cancellationPolicies.totalListings.toLocaleString()}

${cancellationPolicies.policies.map(p => 
  `${p.policy.toUpperCase()} (${p.percentage}% of listings)\n   Avg Revenue: $${p.avgRevenue.toLocaleString()}/yr | Avg Occupancy: ${p.avgOccupancy}%`
).join('\n\n')}

RECOMMENDATION: ${cancellationPolicies.recommendation}
` : ''}

${professionalStats ? `

SECTION 10: PROFESSIONAL VS INDIVIDUAL HOST ANALYSIS
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
</context>

<format>
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
</format>

<guidelines>
Use simple, conversational language and explain what every number means in practical terms. Use comparisons ("That's like...") to make data tangible. When using terms like RevPAR, ADR, or YoY, define them inline on first use. Present data honestly — acknowledge challenges while highlighting genuine opportunities. Round scores to whole numbers. Base every claim on the data provided above. Keep the total under 2,500 words. Start directly with the analysis content.
</guidelines>`;

  try {
    const response = await callLLMMax(prompt, 3, { systemPrompt: marketSystemPrompt });
    // Post-process to remove any prescriptive language that slipped through
    return stripPrescriptiveLanguage(response.trim());
  } catch (error) {
    console.error('Error generating max market advice:', error);
    return 'Unable to generate comprehensive market analysis at this time. Please try again.';
  }
}
/**
 * Generate a comprehensive AI executive summary for the Full Property Report
 * Uses Claude Sonnet 4.6 with maximum output tokens for thorough analysis
 * 
 * This is specifically for the shared Full Property Report — it should be
 * a polished, professional summary that synthesizes ALL data points into
 * a compelling, non-prescriptive narrative.
 */
export interface FullReportSummaryInput {
  reportMode?: 'pro' | 'guided'; // Report style mode
  property: {
    address: string;
    city?: string;
    state?: string;
    bedrooms: number;
    bathrooms: number;
    accommodates: number;
  };
  revenue: {
    annual: number;
    monthly: number;
    nightly: number;
    occupancy: number;
    range?: { low: number; high: number };
  };
  monthlyForecast?: Array<{ month: string; revenue: number; occupancy?: number; adr?: number }>;
  marketData?: {
    name: string;
    occupancy: number;
    adr: number;
    revenue: number;
    listingCount: number;
    marketScore?: number;
  };
  bedroomPerformance?: Array<{
    bedrooms: number;
    revenue: number;
    adr: number;
    occupancy: number;
    count?: number;
  }>;
  competitors?: Array<{
    name: string;
    revenue: number;
    adr: number;
    occupancy: number;
    rating?: number;
    reviews?: number;
    bedrooms?: number;
    bathrooms?: number;
  }>;
  revenueSource?: 'comp_median' | 'p75_fallback' | 'rentalizer';
  exactMatchCompCount?: number;
  revenuePercentiles?: {
    p10: number; p25: number; p50: number; p75: number; p90: number;
  };
  historicalData?: {
    summary: { yearly_pct_change?: number; yoy_revenue_change?: number; trend?: string };
  };
  rentalArbitrage?: {
    monthlyRent: number;
    startupCosts?: number;
  };
  purchase?: {
    purchasePrice: number;
    downPaymentPercent?: number;
    interestRate?: number;
    loanTerm?: number;
    loanType?: string;
  };
  preparedFor?: string;
  stressTest?: Array<{
    occupancyRate: number;
    adrMultiplier: number;
    monthlyRevenue: number;
    monthlyProfit: number;
    annualProfit: number;
    cashFlow: string;
  }>;
  itemizedExpenses?: {
    cleaning: number;
    propertyManagement: number;
    platformFees: number;
    utilities: number;
    supplies: number;
    maintenance: number;
    insurance: number;
    licensePermits: number;
    totalMonthly: number;
    totalAnnual: number;
    effectiveRate: number;
  };
  regulation?: {
    status: string;
    permitRequired: boolean;
    summary: string;
  };
  comparableSales?: Array<{
    address: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    sqft?: number;
  }>;
  supplyTrend?: Array<{ date: string; value: number }>;
  submarkets?: Array<{
    name: string;
    listing_count: number;
    revenue: number;
    occupancy: number;
    adr: number;
  }>;
}

export async function generateFullReportSummary(input: FullReportSummaryInput): Promise<string> {
  const { reportMode = 'guided', property, revenue, monthlyForecast, marketData, bedroomPerformance, competitors, revenuePercentiles, historicalData, rentalArbitrage, purchase, preparedFor, stressTest, itemizedExpenses, regulation, comparableSales, revenueSource, exactMatchCompCount } = input;
  
  // Import pro mode overrides
  const { getProModeOverride } = await import('./pro-mode-prompts');
  const proOverride = getProModeOverride(reportMode, 'property');

  // Calculate derived metrics for the prompt
  const occRate = revenue.occupancy > 1 ? revenue.occupancy / 100 : revenue.occupancy;
  const revpar = revenue.nightly * occRate;

  // Comp stats
  const compCount = competitors?.length || 0;
  const topCompRevenue = competitors && competitors.length > 0 ? Math.max(...competitors.map(c => c.revenue)) : 0;
  const avgCompRevenue = competitors && competitors.length > 0 ? competitors.reduce((s, c) => s + c.revenue, 0) / competitors.length : 0;
  const avgCompRating = competitors && competitors.length > 0
    ? competitors.filter(c => c.rating && c.rating > 0).reduce((s, c) => s + (c.rating || 0), 0) / competitors.filter(c => c.rating && c.rating > 0).length
    : 0;

  // Rental arbitrage calcs
  let rentalSection = '';
  if (rentalArbitrage?.monthlyRent) {
    const rent = rentalArbitrage.monthlyRent;
    const startup = rentalArbitrage.startupCosts || (8000 + property.bedrooms * 4000);
    const monthlyProfit = revenue.monthly - rent;
    const annualProfit = monthlyProfit * 12;
    const breakEvenOcc = rent / (revenue.nightly * 30);
    const monthsToRecoup = monthlyProfit > 0 ? Math.ceil(startup / monthlyProfit) : -1;
    rentalSection = `
RENTAL ARBITRAGE SCENARIO:
- Monthly Rent: $${rent.toLocaleString()}
- Estimated Startup Costs: $${startup.toLocaleString()}
- Projected Monthly Profit: $${monthlyProfit.toLocaleString()}
- Projected Annual Profit: $${annualProfit.toLocaleString()}
- Break-Even Occupancy: ${(breakEvenOcc * 100).toFixed(0)}%
- Months to Recoup Startup: ${monthsToRecoup > 0 ? monthsToRecoup : 'N/A (negative cash flow)'}
- Occupancy Cushion: ${((occRate - breakEvenOcc) * 100).toFixed(0)} percentage points above break-even`;
  }

  // Purchase calcs
  let purchaseSection = '';
  if (purchase?.purchasePrice) {
    const price = purchase.purchasePrice;
    const downPct = (purchase.downPaymentPercent || 20) / 100;
    const downPayment = price * downPct;
    const loanAmount = price - downPayment;
    const rate = (purchase.interestRate || 7) / 100 / 12;
    const term = (purchase.loanTerm || 30) * 12;
    const monthlyMortgage = purchase.loanType === 'cash' ? 0 :
      loanAmount * (rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1);
    const operatingExpenses = revenue.annual * 0.35;
    const propertyTax = price * 0.012;
    const insurance = price * 0.005;
    const noi = revenue.annual - operatingExpenses - propertyTax - insurance;
    const capRate = (noi / price) * 100;
    const annualCashFlow = revenue.annual - (monthlyMortgage * 12) - operatingExpenses - propertyTax - insurance;
    const totalCashNeeded = downPayment + price * 0.03;
    const cashOnCash = totalCashNeeded > 0 ? (annualCashFlow / totalCashNeeded) * 100 : 0;
    const dscr = (monthlyMortgage * 12) > 0 ? noi / (monthlyMortgage * 12) : Infinity;

    purchaseSection = `
PURCHASE INVESTMENT SCENARIO:
- Purchase Price: $${price.toLocaleString()}
- Down Payment: $${downPayment.toLocaleString()} (${(downPct * 100).toFixed(0)}%)
- Total Cash Needed: $${totalCashNeeded.toLocaleString()}
- Monthly Mortgage: $${monthlyMortgage.toFixed(0)}
- Net Operating Income (NOI): $${noi.toFixed(0)}
- Cap Rate: ${capRate.toFixed(1)}%
- Cash-on-Cash Return: ${cashOnCash.toFixed(1)}%
- DSCR: ${dscr === Infinity ? 'N/A (cash purchase)' : dscr.toFixed(2)}
- Annual Cash Flow: $${annualCashFlow.toFixed(0)}`;
  }

  // Monthly forecast summary
  let forecastSection = '';
  if (monthlyForecast && monthlyForecast.length > 0) {
    const best = monthlyForecast.reduce((b, c) => c.revenue > b.revenue ? c : b, monthlyForecast[0]);
    const worst = monthlyForecast.reduce((w, c) => c.revenue < w.revenue ? c : w, monthlyForecast[0]);
    forecastSection = `
MONTHLY FORECAST:
- Peak Month: ${best.month} at $${best.revenue.toLocaleString()} revenue
- Slowest Month: ${worst.month} at $${worst.revenue.toLocaleString()} revenue
- Revenue Spread: $${(best.revenue - worst.revenue).toLocaleString()} between peak and trough`;
  }

  // Bedroom performance
  let bedroomSection = '';
  if (bedroomPerformance && bedroomPerformance.length > 0) {
    bedroomSection = `
BEDROOM PERFORMANCE IN MARKET:
${bedroomPerformance.map(bp => `- ${bp.bedrooms}BR: Revenue $${bp.revenue.toLocaleString()}, ADR $${bp.adr.toLocaleString()}, Occupancy ${(bp.occupancy > 1 ? bp.occupancy : bp.occupancy * 100).toFixed(0)}%, Count: ${bp.count || 'N/A'}`).join('\n')}`;
  }

  // Revenue percentiles
  let percentilesSection = '';
  if (revenuePercentiles) {
    percentilesSection = `
REVENUE DISTRIBUTION (PERCENTILES):
- 10th: $${revenuePercentiles.p10.toLocaleString()}
- 25th: $${revenuePercentiles.p25.toLocaleString()}
- 50th (Median): $${revenuePercentiles.p50.toLocaleString()}
- 75th: $${revenuePercentiles.p75.toLocaleString()}
- 90th: $${revenuePercentiles.p90.toLocaleString()}
- This property's projected revenue of $${revenue.annual.toLocaleString()} falls at approximately the ${revenue.annual >= revenuePercentiles.p75 ? '75th+' : revenue.annual >= revenuePercentiles.p50 ? '50th-75th' : revenue.annual >= revenuePercentiles.p25 ? '25th-50th' : '10th-25th'} percentile range`;
  }

  // Historical trends
  let historicalSection = '';
  if (historicalData?.summary) {
    const yoyChange = historicalData.summary.yoy_revenue_change ?? historicalData.summary.yearly_pct_change ?? 0;
    const trend = historicalData.summary.trend || (yoyChange > 2 ? 'Growing' : yoyChange < -2 ? 'Declining' : 'Stable');
    historicalSection = `
HISTORICAL TRENDS:
- Year-over-Year Revenue Change: ${yoyChange > 0 ? '+' : ''}${yoyChange.toFixed(1)}%
- Market Trend: ${trend}`;
  }

  // System prompt with persona (Claude best practice: separate system from user content)
  const summarySystemPrompt = reportMode === 'pro' 
    ? `You are David Wei Chen, a senior real estate investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. You write institutional-grade executive summaries with precise financial metrics, benchmarks, and quantitative analysis. Your communication style: data-first with exact figures, industry-standard terminology (Cap Rate, DSCR, RevPAR, NOI), and benchmark comparisons. Your tone is authoritative and direct — like a managing director presenting to an investment committee. You never give prescriptive investment advice but present data with analytical rigor.`
    : `You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist and founder of StayMetrics, managing $100M+ across 400+ properties in 35 U.S. markets. You write polished, professional executive summaries that synthesize complex data into clear, accessible insights. Your communication style: data-first (every claim references specific numbers), "story before the stats" (lead with narrative, then data), analogy over jargon. Your tone is warm but authoritative — like a trusted advisor explaining findings to a client over coffee. You never give prescriptive investment advice or tell the reader what to do. You never sugarcoat risks but always empower.`;

  const prompt = `${proOverride}

<task>
Write a comprehensive Executive Summary for a Full Property Investment Analysis Report.${preparedFor ? ` This report is prepared for ${preparedFor}.` : ''}

The summary must synthesize ALL of the following data into a cohesive, professional narrative. Cover every section that has data available. Do NOT skip any section.
</task>

<context>
SUBJECT PROPERTY:
- Address: ${property.address}
- City: ${property.city || 'Unknown'}, ${property.state || ''}
- Configuration: ${property.bedrooms} bedrooms, ${property.bathrooms} bathrooms, sleeps ${property.accommodates}

REVENUE DATA:
${revenueSource === 'comp_median' ? `- Revenue Basis: COMPARABLE PROPERTY MEDIAN — This figure represents what ${exactMatchCompCount || 'similar'} properties with the same bedroom/bathroom count are CURRENTLY earning. This is real operator data, not a prediction.
- Annual Revenue (Comp Median): $${revenue.annual.toLocaleString()}` : revenueSource === 'p75_fallback' ? `- Revenue Basis: 75TH PERCENTILE of comparable properties (fewer than 3 exact-match comps available)
- Annual Revenue (P75 Estimate): $${revenue.annual.toLocaleString()}` : `- Revenue Basis: Market algorithm estimate (insufficient comparable properties)
- Projected Annual Revenue: $${revenue.annual.toLocaleString()}`}
${revenue.range ? `- Revenue Range: $${revenue.range.low.toLocaleString()} – $${revenue.range.high.toLocaleString()}` : ''}
- Average Nightly Rate (ADR): $${revenue.nightly.toLocaleString()}
- Occupancy Rate: ${(occRate * 100).toFixed(0)}%
- Revenue Per Available Night (RevPAR): $${revpar.toFixed(0)}
- Monthly Average: $${revenue.monthly.toLocaleString()}
${forecastSection}

MARKET DATA:
- Market: ${marketData?.name || 'Local Market'}
- Active Listings: ${marketData?.listingCount?.toLocaleString() || 'N/A'}
- Market Avg Revenue: $${marketData?.revenue?.toLocaleString() || 'N/A'}
- Market Avg Occupancy: ${marketData ? (marketData.occupancy > 1 ? marketData.occupancy : marketData.occupancy * 100).toFixed(0) + '%' : 'N/A'}
- Market Avg ADR: $${marketData?.adr?.toLocaleString() || 'N/A'}
${marketData?.marketScore ? `- Market Score: ${marketData.marketScore}/100` : ''}
${historicalSection}
${bedroomSection}
${percentilesSection}

COMPETITION:
- ${compCount} comparable properties analyzed${exactMatchCompCount !== undefined ? ` (${exactMatchCompCount} exact bedroom/bathroom match)` : ''}
${compCount > 0 ? `- Top Performer Revenue: $${topCompRevenue.toLocaleString()}
- Average Comp Revenue: $${Math.round(avgCompRevenue).toLocaleString()}
- Median Comp Revenue: $${competitors && competitors.length > 0 ? Math.round(competitors.map(c => c.revenue).sort((a, b) => a - b)[Math.floor(competitors.length / 2)]).toLocaleString() : 'N/A'}
- Average Comp Rating: ${avgCompRating.toFixed(1)} stars` : ''}
${competitors && competitors.length > 0 ? `
INDIVIDUAL COMPARABLE PROPERTIES (top 10 by revenue):
${competitors.slice(0, 10).sort((a, b) => b.revenue - a.revenue).map((c, i) => `  ${i + 1}. ${c.name} — ${c.bedrooms || '?'}BR/${c.bathrooms || '?'}BA — $${c.revenue.toLocaleString()}/yr — $${c.adr}/night — ${(c.occupancy > 1 ? c.occupancy : c.occupancy * 100).toFixed(0)}% occ — ${c.rating ? c.rating.toFixed(1) + '★' : 'No rating'} (${c.reviews || 0} reviews)`).join('\n')}` : ''}
${rentalSection}
${purchaseSection}
${itemizedExpenses ? `
ITEMIZED EXPENSE BREAKDOWN:
- Cleaning: $${itemizedExpenses.cleaning.toLocaleString()}/mo
- Property Management: $${itemizedExpenses.propertyManagement.toLocaleString()}/mo
- Platform Fees: $${itemizedExpenses.platformFees.toLocaleString()}/mo
- Utilities: $${itemizedExpenses.utilities.toLocaleString()}/mo
- Supplies: $${itemizedExpenses.supplies.toLocaleString()}/mo
- Maintenance: $${itemizedExpenses.maintenance.toLocaleString()}/mo
- Insurance: $${itemizedExpenses.insurance.toLocaleString()}/mo
- License/Permits: $${itemizedExpenses.licensePermits.toLocaleString()}/mo
- Total Monthly Expenses: $${itemizedExpenses.totalMonthly.toLocaleString()}
- Total Annual Expenses: $${itemizedExpenses.totalAnnual.toLocaleString()}
- Effective Expense Rate: ${itemizedExpenses.effectiveRate.toFixed(1)}% of revenue` : ''}
${stressTest && stressTest.length > 0 ? `
STRESS TEST SCENARIOS:
${stressTest.filter(s => s.cashFlow === 'negative').length > 0 ? `- ${stressTest.filter(s => s.cashFlow === 'negative').length} of ${stressTest.length} scenarios result in negative cash flow` : `- All ${stressTest.length} scenarios remain cash flow positive`}
- Best case: $${Math.max(...stressTest.map(s => s.monthlyProfit)).toLocaleString()}/mo profit
- Worst case: $${Math.min(...stressTest.map(s => s.monthlyProfit)).toLocaleString()}/mo ${Math.min(...stressTest.map(s => s.monthlyProfit)) < 0 ? 'loss' : 'profit'}
- Break-even scenarios: occupancy/ADR combinations where profit approaches $0` : ''}
${regulation ? `
REGULATORY STATUS:
- Status: ${regulation.status}
- Permit Required: ${regulation.permitRequired ? 'Yes' : 'No'}
- Summary: ${regulation.summary}` : ''}
${comparableSales && comparableSales.length > 0 ? `
COMPARABLE SALES:
- ${comparableSales.length} recently sold properties analyzed
- Price Range: $${Math.min(...comparableSales.map(s => s.price)).toLocaleString()} – $${Math.max(...comparableSales.map(s => s.price)).toLocaleString()}
- Average Sale Price: $${Math.round(comparableSales.reduce((s, c) => s + c.price, 0) / comparableSales.length).toLocaleString()}` : ''}
</context>

<format>
Write the summary in Markdown format with the following structure:

## Executive Summary

Start with a brief overview paragraph that introduces the property and the key finding.

### Revenue Outlook
${revenueSource === 'comp_median' ? `IMPORTANT: The revenue figure is based on the MEDIAN of ${exactMatchCompCount || 'comparable'} properties with the same bedroom/bathroom count that are CURRENTLY operating. Frame this as fact, not prediction. Use language like "Properties like this one are currently earning..." or "The median of ${exactMatchCompCount || 'comparable'} same-configuration properties shows annual revenue of...". Do NOT say "projected" or "estimated" — this is what real operators are actually earning right now.` : revenueSource === 'p75_fallback' ? `The revenue figure is based on the 75th percentile of comparable properties (fewer than 3 exact bedroom/bathroom matches were available). Frame this as a strong-performer benchmark.` : `The revenue figure is an algorithm-based estimate. Use standard projection language.`}
Discuss how the revenue compares to the market, where the property falls in the revenue distribution, and the seasonality pattern.

### Market Position
Analyze the market context — how healthy is the market, how does this property compare to the market averages, and what the bedroom performance data shows about demand for this property type.

### Competitive Landscape
Summarize the competition — how many comps were analyzed, how this property compares to the top performers and the average, and what the ratings tell us. IMPORTANT: Reference specific comparable properties by name and their revenue figures from the INDIVIDUAL COMPARABLE PROPERTIES list. This makes the analysis concrete and verifiable. For example: "The top-performing comp, [Name], earns $X/year with a Y★ rating and Z reviews."

${itemizedExpenses ? `### Expense Analysis
Discuss the itemized expense breakdown — how the effective expense rate compares to the industry standard 35%, which categories are the largest cost drivers, and what this means for net income projections.` : ''}

${stressTest && stressTest.length > 0 ? `### Risk & Stress Test
Discuss the stress test results — how many scenarios remain profitable, what the worst-case scenario looks like, and how much cushion exists before the property becomes cash-flow negative. This is critical for investor confidence.` : ''}

${regulation ? `### Regulatory Environment
Discuss the regulatory status — whether STR is permitted, what permits are required, and any key regulatory considerations for this location.` : ''}

${rentalArbitrage?.monthlyRent ? `### Rental Arbitrage Analysis
Discuss the rental arbitrage scenario — monthly profit potential, break-even occupancy, startup cost recovery timeline, and the occupancy cushion.` : ''}

${purchase?.purchasePrice ? `### Purchase Investment Analysis
Discuss the purchase scenario — cap rate, cash-on-cash return, DSCR, monthly cash flow, and what these metrics indicate about the investment.` : ''}

${comparableSales && comparableSales.length > 0 ? `### Comparable Sales
Discuss the comparable sales data — how the asking/purchase price compares to recently sold properties in the area, and what this suggests about market value.` : ''}

### Key Takeaways
End with 3-4 bullet points summarizing the most important findings. These should be factual observations, NOT recommendations.

Present data and observations only — let the reader draw their own conclusions. Use simple, beginner-friendly language and explain financial terms inline. Cite specific numbers from the data throughout. Write in a warm, professional tone and use **bold** for key metrics. The reader is evaluating this opportunity independently; empower them with clear analysis rather than prescriptive advice.
</format>`;

  try {
    const response = await callLLMMax(prompt, 3, { systemPrompt: summarySystemPrompt });
    return response.trim();
  } catch (error) {
    console.error('Error generating full report summary:', error);
    // Fallback to the simpler function
    try {
      const fallbackResponse = await callLLM(prompt, { maxTokens: 4096, thinkingLevel: 'low', systemPrompt: summarySystemPrompt });
      return fallbackResponse.trim();
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      return '';
    }
  }
}

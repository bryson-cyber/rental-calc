/**
 * Gemini AI Service for Property Analysis
 * 
 * This service uses Google's Gemini AI to generate educational,
 * easy-to-understand content for rental property analysis reports.
 */

import { ENV } from './_core/env';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
  }>;
}

async function callGemini(prompt: string): Promise<string> {
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
        maxOutputTokens: 2048,
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data: GeminiResponse = await response.json();
  return data.candidates[0]?.content?.parts[0]?.text || '';
}

/**
 * Analyze property features and identify what makes it attractive for Airbnb
 */
export async function analyzePropertyFeatures(propertyData: {
  address: string;
  neighborhood: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage?: number;
}): Promise<{
  attractiveFeatures: string[];
  guestAppeal: string;
  uniqueSellingPoints: string;
}> {
  const prompt = `You are an Airbnb property analyst. Analyze this property and identify what would make it attractive to short-term rental guests.

Property Details:
- Address: ${propertyData.address}
- Neighborhood: ${propertyData.neighborhood}
- Type: ${propertyData.propertyType}
- Bedrooms: ${propertyData.bedrooms}
- Bathrooms: ${propertyData.bathrooms}
${propertyData.squareFootage ? `- Square Footage: ${propertyData.squareFootage}` : ''}

Based on the property type, size, and location, provide:

1. ATTRACTIVE_FEATURES: List 5 features that would appeal to Airbnb guests (based on typical properties of this type/size). Format as a JSON array of strings.

2. GUEST_APPEAL: Write 2-3 sentences explaining who this property would appeal to (families, business travelers, couples, etc.) and why. Write in simple, friendly language.

3. UNIQUE_SELLING_POINTS: Write 2-3 sentences about what makes this type of property stand out in the short-term rental market. Focus on the benefits for guests.

Respond in this exact JSON format:
{
  "attractiveFeatures": ["feature1", "feature2", "feature3", "feature4", "feature5"],
  "guestAppeal": "Your guest appeal text here",
  "uniqueSellingPoints": "Your unique selling points text here"
}`;

  try {
    const response = await callGemini(prompt);
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    // Fallback defaults
    return {
      attractiveFeatures: [
        'Spacious living area',
        'Modern amenities',
        'Great location',
        'Comfortable bedding',
        'Fully equipped kitchen'
      ],
      guestAppeal: `This ${propertyData.bedrooms}-bedroom ${propertyData.propertyType.toLowerCase()} is perfect for families and groups looking for a comfortable stay. The spacious layout provides plenty of room for everyone.`,
      uniqueSellingPoints: `Properties like this offer the comfort of home with the convenience of a hotel. Guests love having their own space, kitchen, and the ability to spread out during their stay.`
    };
  } catch (error) {
    console.error('Error analyzing property features:', error);
    return {
      attractiveFeatures: [
        'Spacious living area',
        'Modern amenities',
        'Great location',
        'Comfortable bedding',
        'Fully equipped kitchen'
      ],
      guestAppeal: `This ${propertyData.bedrooms}-bedroom ${propertyData.propertyType.toLowerCase()} is perfect for families and groups looking for a comfortable stay.`,
      uniqueSellingPoints: `Properties like this offer the comfort of home with the convenience of a hotel.`
    };
  }
}

/**
 * Analyze competitor success factors
 */
export async function analyzeCompetitorSuccessFactors(competitors: Array<{
  name: string;
  revenue: number;
  adr: number;
  occupancy: number;
  rating?: number;
  reviews?: number;
  propertyType?: string;
}>): Promise<{
  commonSuccessFactors: string[];
  keyInsights: string;
  actionableAdvice: string;
}> {
  const competitorSummary = competitors.map((c, i) => 
    `${i + 1}. ${c.name}: $${c.revenue.toLocaleString()}/year, $${c.adr}/night, ${Math.round(c.occupancy)}% occupancy${c.rating ? `, ${c.rating} rating` : ''}`
  ).join('\n');

  const avgRevenue = competitors.reduce((sum, c) => sum + c.revenue, 0) / competitors.length;
  const avgAdr = competitors.reduce((sum, c) => sum + c.adr, 0) / competitors.length;
  const avgOccupancy = competitors.reduce((sum, c) => sum + c.occupancy, 0) / competitors.length;

  const prompt = `You are an Airbnb business consultant helping a new host understand what makes top performers successful.

Top Performing Competitors in This Area:
${competitorSummary}

Averages:
- Average Revenue: $${Math.round(avgRevenue).toLocaleString()}/year
- Average Nightly Rate: $${Math.round(avgAdr)}
- Average Occupancy: ${Math.round(avgOccupancy)}%

Analyze these top performers and provide insights in simple, educational language that a beginner would understand:

1. COMMON_SUCCESS_FACTORS: What do these successful properties likely have in common? List 4-5 factors. Format as a JSON array of strings.

2. KEY_INSIGHTS: Write 2-3 sentences explaining what the data tells us about success in this market. Use simple language, avoid jargon. Explain what occupancy and ADR mean in context.

3. ACTIONABLE_ADVICE: Write 2-3 sentences of practical advice for someone wanting to compete with these properties. Be specific and encouraging.

Respond in this exact JSON format:
{
  "commonSuccessFactors": ["factor1", "factor2", "factor3", "factor4", "factor5"],
  "keyInsights": "Your insights here",
  "actionableAdvice": "Your advice here"
}`;

  try {
    const response = await callGemini(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return getDefaultCompetitorAnalysis(avgRevenue, avgAdr, avgOccupancy);
  } catch (error) {
    console.error('Error analyzing competitors:', error);
    return getDefaultCompetitorAnalysis(avgRevenue, avgAdr, avgOccupancy);
  }
}

function getDefaultCompetitorAnalysis(avgRevenue: number, avgAdr: number, avgOccupancy: number) {
  return {
    commonSuccessFactors: [
      'Professional photography that showcases the space',
      'Competitive pricing with dynamic adjustments',
      'Quick response times to guest inquiries',
      'Thoughtful amenities and welcome touches',
      'Consistent 5-star reviews from happy guests'
    ],
    keyInsights: `The top performers in this area earn an average of $${Math.round(avgRevenue).toLocaleString()} per year. They charge about $${Math.round(avgAdr)} per night and keep their properties booked ${Math.round(avgOccupancy)}% of the time. This shows there's strong demand in this market.`,
    actionableAdvice: `To compete with these top performers, focus on creating an exceptional guest experience. Invest in professional photos, respond to inquiries within an hour, and add thoughtful touches like local recommendations and quality toiletries.`
  };
}

/**
 * Generate market insights in plain language
 */
export async function generateMarketInsights(marketData: {
  marketName: string;
  occupancy: number;
  adr: number;
  revenue: number;
  listingCount: number;
  professionallyManaged: number;
  bedroomPerformance: Array<{ bedrooms: number; revenue: number; occupancy: number }>;
}): Promise<{
  marketSummary: string;
  demandAnalysis: string;
  competitionAnalysis: string;
  recommendations: string[];
}> {
  const bedroomSummary = marketData.bedroomPerformance
    .map(b => `${b.bedrooms}BR: $${b.revenue.toLocaleString()}/year, ${Math.round(b.occupancy)}% occupancy`)
    .join('; ');

  const prompt = `You are a real estate investment advisor explaining the short-term rental market to a beginner investor.

Market: ${marketData.marketName}
Key Statistics:
- Average Occupancy: ${marketData.occupancy}% (this means properties are booked ${marketData.occupancy}% of nights)
- Average Nightly Rate: $${marketData.adr}
- Average Annual Revenue: $${marketData.revenue.toLocaleString()}
- Total Active Listings: ${marketData.listingCount.toLocaleString()}
- Professionally Managed: ${marketData.professionallyManaged}%

Performance by Bedroom Count:
${bedroomSummary}

Write insights in simple, educational language that someone new to real estate investing would understand:

1. MARKET_SUMMARY: 2-3 sentences summarizing the market opportunity. Is this a good market? Why or why not?

2. DEMAND_ANALYSIS: 2-3 sentences about guest demand. What does the occupancy rate tell us? Is there enough demand?

3. COMPETITION_ANALYSIS: 2-3 sentences about the competition. With ${marketData.listingCount.toLocaleString()} listings, is it crowded? What does ${marketData.professionallyManaged}% professionally managed mean for individual hosts?

4. RECOMMENDATIONS: 3-4 specific, actionable recommendations for someone considering investing in this market. Format as a JSON array.

Respond in this exact JSON format:
{
  "marketSummary": "Your summary here",
  "demandAnalysis": "Your demand analysis here",
  "competitionAnalysis": "Your competition analysis here",
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"]
}`;

  try {
    const response = await callGemini(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return getDefaultMarketInsights(marketData);
  } catch (error) {
    console.error('Error generating market insights:', error);
    return getDefaultMarketInsights(marketData);
  }
}

function getDefaultMarketInsights(marketData: {
  marketName: string;
  occupancy: number;
  adr: number;
  revenue: number;
  listingCount: number;
  professionallyManaged: number;
  bedroomPerformance?: Array<{ bedrooms: number; revenue: number; occupancy: number }>;
}) {
  const isHighOccupancy = marketData.occupancy >= 60;
  const isHighRevenue = marketData.revenue >= 40000;
  
  return {
    marketSummary: `${marketData.marketName} ${isHighOccupancy && isHighRevenue ? 'shows strong potential' : 'has moderate potential'} for short-term rental investment. Properties earn an average of $${marketData.revenue.toLocaleString()} per year with ${marketData.occupancy}% occupancy.`,
    demandAnalysis: `With ${marketData.occupancy}% occupancy, properties in ${marketData.marketName} are booked about ${Math.round(marketData.occupancy * 3.65)} nights per year. ${isHighOccupancy ? 'This indicates strong guest demand.' : 'There may be room to improve demand through better marketing and pricing.'}`,
    competitionAnalysis: `There are ${marketData.listingCount.toLocaleString()} active listings in this market. ${marketData.professionallyManaged}% are professionally managed, which means ${marketData.professionallyManaged < 30 ? 'individual hosts can still compete effectively' : 'you\'ll be competing with experienced operators'}.`,
    recommendations: [
      `Focus on ${marketData.bedroomPerformance?.[1]?.bedrooms || 2}-bedroom properties which show the best balance of revenue and occupancy`,
      'Invest in professional photography to stand out from the competition',
      'Use dynamic pricing tools to maximize revenue during peak seasons',
      'Build a strong review profile by providing exceptional guest experiences'
    ]
  };
}

/**
 * Generate profitability analysis in plain language
 */
export async function generateProfitabilityAnalysis(data: {
  monthlyRent: number;
  projectedRevenue: {
    conservative: number;
    realistic: number;
    optimistic: number;
  };
  monthlyExpenses: number;
  startupCosts: number;
}): Promise<{
  viabilityAssessment: string;
  profitExplanation: string;
  riskFactors: string[];
  recommendation: string;
}> {
  const annualExpenses = data.monthlyExpenses * 12;
  const conservativeProfit = data.projectedRevenue.conservative - annualExpenses;
  const realisticProfit = data.projectedRevenue.realistic - annualExpenses;
  const optimisticProfit = data.projectedRevenue.optimistic - annualExpenses;
  
  const minRevenueThreshold = data.monthlyRent * 12 * 2;
  const meetsThreshold = data.projectedRevenue.realistic >= minRevenueThreshold;

  const prompt = `You are a financial advisor explaining an Airbnb arbitrage opportunity to a beginner.

Investment Analysis:
- Monthly Rent: $${data.monthlyRent.toLocaleString()}
- Minimum Revenue Needed (2x annual rent): $${minRevenueThreshold.toLocaleString()}
- Startup Costs: $${data.startupCosts.toLocaleString()}
- Monthly Operating Expenses: $${data.monthlyExpenses.toLocaleString()}

Projected Annual Revenue:
- Conservative (Median market): $${data.projectedRevenue.conservative.toLocaleString()}
- Realistic (Top 25%): $${data.projectedRevenue.realistic.toLocaleString()}
- Optimistic (Top 10%): $${data.projectedRevenue.optimistic.toLocaleString()}

Projected Annual Profit:
- Conservative: $${conservativeProfit.toLocaleString()}
- Realistic: $${realisticProfit.toLocaleString()}
- Optimistic: $${optimisticProfit.toLocaleString()}

Meets 2x Rent Threshold: ${meetsThreshold ? 'YES' : 'NO - RED FLAG'}

Write a clear, honest assessment in simple language:

1. VIABILITY_ASSESSMENT: 2-3 sentences on whether this is a viable investment. Be honest - if it doesn't meet the 2x threshold, say so clearly.

2. PROFIT_EXPLANATION: 2-3 sentences explaining what the profit numbers mean in practical terms. How much could they take home each month?

3. RISK_FACTORS: List 3-4 key risks to consider. Format as a JSON array.

4. RECOMMENDATION: 2-3 sentences with your honest recommendation. Should they pursue this? What should they do next?

Respond in this exact JSON format:
{
  "viabilityAssessment": "Your assessment here",
  "profitExplanation": "Your explanation here",
  "riskFactors": ["risk1", "risk2", "risk3"],
  "recommendation": "Your recommendation here"
}`;

  try {
    const response = await callGemini(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return getDefaultProfitabilityAnalysis(data, meetsThreshold, realisticProfit);
  } catch (error) {
    console.error('Error generating profitability analysis:', error);
    return getDefaultProfitabilityAnalysis(data, meetsThreshold, realisticProfit);
  }
}

function getDefaultProfitabilityAnalysis(
  data: { monthlyRent: number; projectedRevenue: { realistic: number } },
  meetsThreshold: boolean,
  realisticProfit: number
) {
  return {
    viabilityAssessment: meetsThreshold
      ? `This property shows strong potential for Airbnb arbitrage. The projected revenue comfortably exceeds the minimum threshold of 2x annual rent, indicating a viable investment opportunity.`
      : `⚠️ CAUTION: This property may not be ideal for Airbnb arbitrage. The projected revenue does not meet the recommended threshold of 2x annual rent ($${(data.monthlyRent * 24).toLocaleString()}), which increases the risk of losing money.`,
    profitExplanation: `If you operate at the realistic (Top 25%) level, you could earn approximately $${Math.round(realisticProfit / 12).toLocaleString()} per month in profit after all expenses. This assumes consistent bookings and no major unexpected costs.`,
    riskFactors: [
      'Vacancy periods during slow seasons could reduce income',
      'Unexpected repairs or guest damages may increase expenses',
      'Local regulations could change and affect short-term rentals',
      'Competition from new listings could impact your bookings'
    ],
    recommendation: meetsThreshold
      ? `This looks like a promising opportunity. We recommend scheduling a consultation to discuss the next steps, including property setup, pricing strategy, and how to achieve top-performer status.`
      : `We recommend looking for properties with lower rent or in markets with higher revenue potential. A good rule of thumb is to only pursue properties where you can realistically earn 2x the annual rent.`
  };
}

/**
 * Generate a complete AI-enhanced property report
 */
export async function generateEnhancedPropertyReport(data: {
  property: {
    address: string;
    neighborhood: string;
    propertyType: string;
    bedrooms: number;
    bathrooms: number;
    squareFootage?: number;
    monthlyRent: number;
  };
  marketData: {
    occupancy: number;
    adr: number;
    revenue: number;
    listingCount: number;
  };
  competitors: Array<{
    name: string;
    revenue: number;
    adr: number;
    occupancy: number;
    rating?: number;
  }>;
  revenueProjections: {
    conservative: number;
    realistic: number;
    optimistic: number;
  };
}): Promise<{
  propertyAnalysis: Awaited<ReturnType<typeof analyzePropertyFeatures>>;
  competitorAnalysis: Awaited<ReturnType<typeof analyzeCompetitorSuccessFactors>>;
  profitabilityAnalysis: Awaited<ReturnType<typeof generateProfitabilityAnalysis>>;
}> {
  // Run all AI analyses in parallel for speed
  const [propertyAnalysis, competitorAnalysis, profitabilityAnalysis] = await Promise.all([
    analyzePropertyFeatures(data.property),
    analyzeCompetitorSuccessFactors(data.competitors),
    generateProfitabilityAnalysis({
      monthlyRent: data.property.monthlyRent,
      projectedRevenue: data.revenueProjections,
      monthlyExpenses: data.property.monthlyRent + 780, // Rent + utilities/supplies/etc
      startupCosts: 20000
    })
  ]);

  return {
    propertyAnalysis,
    competitorAnalysis,
    profitabilityAnalysis
  };
}


/**
 * Generate AI-enhanced market report analysis
 * Similar to property reports but focused on market-level insights
 */
export async function generateEnhancedMarketReport(data: {
  market: {
    name: string;
    listingCount: number;
  };
  metrics: {
    occupancy: number;
    adr: number;
    revenue: number;
    revpar: number;
  };
  topListings: Array<{
    title: string;
    revenue: number;
    adr: number;
    occupancy: number;
    rating: number | null;
    bedrooms: number;
    propertyType: string;
  }>;
  bedroomPerformance: Array<{
    bedrooms: number;
    count: number;
    avgRevenue: number;
    avgOccupancy: number;
  }>;
  insights?: {
    professionallyManagedPct: number;
    superhostPct: number;
    revenuePercentiles?: {
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
    };
  };
}): Promise<{
  marketSummary: string;
  investmentThesis: string;
  topPerformersAnalysis: string;
  bedroomRecommendation: string;
  competitiveLandscape: string;
  actionItems: string[];
  riskAssessment: string;
}> {
  const topListingsSummary = data.topListings.slice(0, 5).map((l, i) => 
    `${i + 1}. "${l.title}" - ${l.bedrooms}BR ${l.propertyType}, $${l.revenue.toLocaleString()}/yr, ${Math.round(l.occupancy)}% occ, ${l.rating ? `${l.rating} rating` : 'no rating'}`
  ).join('\n');

  const bedroomSummary = data.bedroomPerformance.map(b => 
    `${b.bedrooms}BR: ${b.count} listings, $${b.avgRevenue.toLocaleString()}/yr avg, ${Math.round(b.avgOccupancy)}% occ`
  ).join('\n');

  const bestBedroom = data.bedroomPerformance.reduce((best, current) => 
    current.avgOccupancy > (best?.avgOccupancy || 0) ? current : best
  , data.bedroomPerformance[0]);

  const prompt = `You are a short-term rental investment advisor creating a comprehensive market analysis for ${data.market.name}.

MARKET OVERVIEW:
- Market: ${data.market.name}
- Total Active Listings: ${data.market.listingCount.toLocaleString()}
- Average Occupancy: ${Math.round(data.metrics.occupancy)}%
- Average Daily Rate: $${Math.round(data.metrics.adr)}
- Average Annual Revenue: $${Math.round(data.metrics.revenue).toLocaleString()}
- RevPAR: $${Math.round(data.metrics.revpar)}

TOP 5 PERFORMERS:
${topListingsSummary}

PERFORMANCE BY BEDROOM COUNT:
${bedroomSummary}

COMPETITIVE INSIGHTS:
- Professionally Managed: ${data.insights?.professionallyManagedPct || 0}%
- Superhosts: ${data.insights?.superhostPct || 0}%
${data.insights?.revenuePercentiles ? `
- Bottom 10% earn: $${data.insights.revenuePercentiles.p10.toLocaleString()}/yr
- Median earns: $${data.insights.revenuePercentiles.p50.toLocaleString()}/yr
- Top 25% earn: $${data.insights.revenuePercentiles.p75.toLocaleString()}/yr
- Top 10% earn: $${data.insights.revenuePercentiles.p90.toLocaleString()}/yr` : ''}

Write a comprehensive, educational analysis in simple language that a beginner investor would understand:

1. MARKET_SUMMARY: 3-4 sentences providing an executive summary of this market. Is it a good market to invest in? What's the overall opportunity?

2. INVESTMENT_THESIS: 2-3 sentences explaining WHY someone should (or shouldn't) invest in this market. Be specific about the opportunity.

3. TOP_PERFORMERS_ANALYSIS: 3-4 sentences analyzing what the top performers have in common. What can we learn from them? What makes them successful?

4. BEDROOM_RECOMMENDATION: 2-3 sentences recommending the optimal property size for this market. The data shows ${bestBedroom?.bedrooms || 2}-bedroom properties perform best - explain why.

5. COMPETITIVE_LANDSCAPE: 2-3 sentences about the competition. Is it crowded? Can individual hosts compete? What does the professional management percentage tell us?

6. ACTION_ITEMS: 5 specific, actionable steps for someone wanting to invest in this market. Format as a JSON array.

7. RISK_ASSESSMENT: 2-3 sentences about the key risks to consider in this market.

Respond in this exact JSON format:
{
  "marketSummary": "Your summary here",
  "investmentThesis": "Your thesis here",
  "topPerformersAnalysis": "Your analysis here",
  "bedroomRecommendation": "Your recommendation here",
  "competitiveLandscape": "Your analysis here",
  "actionItems": ["action1", "action2", "action3", "action4", "action5"],
  "riskAssessment": "Your assessment here"
}`;

  try {
    const response = await callGemini(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return getDefaultMarketReportAnalysis(data, bestBedroom);
  } catch (error) {
    console.error('Error generating enhanced market report:', error);
    return getDefaultMarketReportAnalysis(data, bestBedroom);
  }
}

function getDefaultMarketReportAnalysis(
  data: {
    market: { name: string; listingCount: number };
    metrics: { occupancy: number; adr: number; revenue: number };
    insights?: { professionallyManagedPct: number };
  },
  bestBedroom?: { bedrooms: number; avgOccupancy: number; avgRevenue: number }
) {
  const isStrongMarket = data.metrics.occupancy >= 55 && data.metrics.revenue >= 25000;
  const profManagedPct = data.insights?.professionallyManagedPct || 0;
  
  return {
    marketSummary: `${data.market.name} is ${isStrongMarket ? 'a strong' : 'a moderate'} short-term rental market with ${data.market.listingCount.toLocaleString()} active listings. Properties earn an average of $${Math.round(data.metrics.revenue).toLocaleString()} per year with ${Math.round(data.metrics.occupancy)}% occupancy. ${isStrongMarket ? 'The combination of solid occupancy and revenue indicates healthy demand from travelers.' : 'There may be opportunities to outperform the average with the right strategy.'}`,
    investmentThesis: `${isStrongMarket ? 'This market presents a compelling investment opportunity.' : 'This market requires careful property selection.'} With average nightly rates of $${Math.round(data.metrics.adr)}, there's ${data.metrics.adr >= 100 ? 'strong pricing power' : 'room to optimize pricing'} for well-positioned properties.`,
    topPerformersAnalysis: `The top performers in ${data.market.name} share common traits: professional presentation, strategic pricing, and excellent guest experiences. They consistently earn well above the market average by focusing on quality over quantity. Their success demonstrates that with the right approach, significant returns are achievable.`,
    bedroomRecommendation: `Based on the data, ${bestBedroom?.bedrooms || 2}-bedroom properties show the strongest performance with ${Math.round(bestBedroom?.avgOccupancy || data.metrics.occupancy)}% occupancy. This size hits the sweet spot between accommodating groups and maintaining high booking rates.`,
    competitiveLandscape: `With ${profManagedPct}% professionally managed listings, ${profManagedPct < 25 ? 'individual hosts have a significant opportunity to compete' : 'you\'ll be competing with experienced operators'}. ${data.market.listingCount > 1000 ? 'The market is established with strong demand' : 'The market has room for quality new listings'}.`,
    actionItems: [
      `Target ${bestBedroom?.bedrooms || 2}-bedroom properties for optimal occupancy`,
      'Invest in professional photography to stand out from competition',
      'Use dynamic pricing tools to maximize revenue during peak seasons',
      'Focus on earning Superhost status within your first year',
      'Build relationships with local service providers for reliable cleaning and maintenance'
    ],
    riskAssessment: `Key risks include seasonal fluctuations in demand, potential regulatory changes affecting short-term rentals, and competition from new listings. ${profManagedPct >= 30 ? 'The high percentage of professional managers means you\'ll need to maintain high standards to compete.' : 'The market is still accessible to individual hosts who provide quality experiences.'}`
  };
}


// ============================================
// AI INVESTMENT ADVISOR CHAT
// ============================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface InvestmentAdvisorContext {
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
      adr: number;
      revenue: number;
    };
    listing_count: number;
  }>;
  currentMarket?: string;
}

/**
 * AI Investment Advisor - answers questions about STR markets and investments
 */
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

  const prompt = `You are an expert short-term rental (STR) investment advisor with deep knowledge of Airbnb markets across the United States. You help investors make informed decisions about where and how to invest in vacation rentals.

Your expertise includes:
- Market analysis and comparison
- Revenue projections and ROI calculations
- Seasonality patterns and pricing strategies
- Regulatory environments and risks
- Property selection and optimization
- Rental arbitrage feasibility

Guidelines for your responses:
1. Be conversational but professional
2. Use data to support your recommendations when available
3. Explain concepts in simple terms for beginners
4. Provide specific, actionable advice
5. Acknowledge limitations and risks
6. If comparing markets, use the actual data provided
7. Keep responses concise but informative (2-4 paragraphs max)
8. Use bullet points for lists when helpful
${marketContext}${historyText}

User Question: ${question}

Provide a helpful, data-driven response:`;

  try {
    const response = await callGemini(prompt);
    return response.trim();
  } catch (error) {
    console.error('Error getting investment advice:', error);
    return "I apologize, but I'm having trouble processing your question right now. Please try again in a moment, or feel free to rephrase your question.";
  }
}

/**
 * Compare two or more markets for investment potential
 */
export async function compareMarketsForInvestment(
  markets: Array<{
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
      adr: number;
      revenue: number;
    };
    listing_count: number;
  }>,
  investorProfile?: {
    budget?: string;
    experience?: 'beginner' | 'intermediate' | 'experienced';
    goals?: string;
    riskTolerance?: 'low' | 'medium' | 'high';
  }
): Promise<{
  comparison: string;
  recommendation: string;
  winner: string;
  keyDifferences: string[];
}> {
  const marketDetails = markets.map(m => `
${m.name}:
- Overall Score: ${m.scores.market_score}/100
- Investability: ${m.scores.investability}/100
- Rental Demand: ${m.scores.rental_demand}/100
- Revenue Growth: ${m.scores.revenue_growth}/100
- Seasonality (stability): ${m.scores.seasonality}/100
- Regulation (friendliness): ${m.scores.regulation}/100
- Average Revenue: $${m.metrics.revenue.toLocaleString()}/year
- Occupancy Rate: ${m.metrics.occupancy}%
- Average Daily Rate: $${m.metrics.adr}
- Total Listings: ${m.listing_count.toLocaleString()}`
  ).join('\n');

  const investorContext = investorProfile ? `
Investor Profile:
- Budget: ${investorProfile.budget || 'Not specified'}
- Experience: ${investorProfile.experience || 'Not specified'}
- Goals: ${investorProfile.goals || 'Not specified'}
- Risk Tolerance: ${investorProfile.riskTolerance || 'Not specified'}` : '';

  const prompt = `You are an expert STR investment advisor comparing markets for a potential investor.

Markets to Compare:
${marketDetails}
${investorContext}

Provide a comprehensive comparison in JSON format:

1. COMPARISON: 2-3 paragraphs comparing these markets across key factors (revenue potential, stability, competition, growth, regulations). Be specific with numbers.

2. RECOMMENDATION: 1-2 paragraphs with your recommendation and reasoning. Consider the investor profile if provided.

3. WINNER: Name of the market you'd recommend (just the city name)

4. KEY_DIFFERENCES: 4-5 bullet points highlighting the most important differences between these markets

Respond in this exact JSON format:
{
  "comparison": "Your detailed comparison here",
  "recommendation": "Your recommendation here",
  "winner": "City Name",
  "keyDifferences": ["difference1", "difference2", "difference3", "difference4"]
}`;

  try {
    const response = await callGemini(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    // Fallback
    const winner = markets.reduce((best, m) => m.scores.market_score > best.scores.market_score ? m : best);
    return {
      comparison: `Comparing ${markets.map(m => m.name).join(' vs ')}: Each market has unique strengths. ${winner.name} leads with a market score of ${winner.scores.market_score}/100.`,
      recommendation: `Based on overall scores, ${winner.name} appears to be the stronger investment opportunity with better revenue potential and market fundamentals.`,
      winner: winner.name,
      keyDifferences: markets.map(m => `${m.name}: $${m.metrics.revenue.toLocaleString()}/yr avg revenue, ${m.metrics.occupancy}% occupancy`)
    };
  } catch (error) {
    console.error('Error comparing markets:', error);
    const winner = markets.reduce((best, m) => m.scores.market_score > best.scores.market_score ? m : best);
    return {
      comparison: `Unable to generate detailed comparison at this time.`,
      recommendation: `Based on market scores, ${winner.name} has the highest overall rating.`,
      winner: winner.name,
      keyDifferences: markets.map(m => `${m.name}: Score ${m.scores.market_score}/100`)
    };
  }
}

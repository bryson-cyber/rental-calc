/**
 * Enhanced Gemini AI Analyzer - Improved Narrative Quality & Performance
 * 
 * Key Improvements:
 * 1. Better prompts with market-specific context
 * 2. Caching for repeated market data requests
 * 3. Parallel processing where possible
 * 4. Exponential backoff for retries
 * 5. More actionable, specific insights
 * 6. Plain-language explanations throughout
 */

import { ENV } from './_core/env';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ============================================
// CACHING LAYER
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class SimpleCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTLMs: number = 5 * 60 * 1000) { // 5 minutes default
    this.defaultTTL = defaultTTLMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTTL;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global caches for different data types
const marketDataCache = new SimpleCache<any>(10 * 60 * 1000); // 10 minutes
const narrativeCache = new SimpleCache<any>(24 * 60 * 60 * 1000); // 24 hours - AI analysis is expensive

// ============================================
// ENHANCED GEMINI CALL WITH RETRY
// ============================================

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGeminiWithRetry(
  prompt: string, 
  maxTokens: number = 4096, 
  timeoutMs: number = 120000,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<string> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff with jitter
      const delay = Math.min(
        retryConfig.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
        retryConfig.maxDelayMs
      );
      console.log(`[GeminiEnhanced] Retry attempt ${attempt}/${retryConfig.maxRetries} after ${Math.round(delay)}ms delay`);
      await sleep(delay);
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${ENV.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: maxTokens,
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      if (!result) {
        throw new Error('Empty response from Gemini');
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      if (error.name === 'AbortError') {
        console.error(`[GeminiEnhanced] Timeout after ${timeoutMs / 1000}s on attempt ${attempt + 1}`);
      } else {
        console.error(`[GeminiEnhanced] Error on attempt ${attempt + 1}:`, error.message);
      }
      
      // Don't retry on certain errors
      if (error.message?.includes('API key') || error.message?.includes('quota')) {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

// ============================================
// MARKET CONTEXT DETECTION
// ============================================

interface MarketContext {
  type: 'tourist' | 'business' | 'mixed' | 'suburban' | 'urban' | 'rural';
  seasonality: 'high' | 'moderate' | 'low';
  competition: 'high' | 'moderate' | 'low';
  pricePoint: 'luxury' | 'mid-range' | 'budget';
  description: string;
}

function detectMarketContext(
  marketName: string,
  occupancy: number,
  adr: number,
  activeListings: number,
  seasonalityData: Array<{ revenue: number; season_type: string }>
): MarketContext {
  // Detect market type based on name patterns
  const lowerName = marketName.toLowerCase();
  let type: MarketContext['type'] = 'mixed';
  
  if (lowerName.includes('beach') || lowerName.includes('coast') || 
      lowerName.includes('mountain') || lowerName.includes('ski') ||
      lowerName.includes('lake') || lowerName.includes('resort')) {
    type = 'tourist';
  } else if (lowerName.includes('downtown') || lowerName.includes('financial') ||
             lowerName.includes('business')) {
    type = 'business';
  } else if (lowerName.includes('suburb') || lowerName.includes('heights') ||
             lowerName.includes('park') || lowerName.includes('hills')) {
    type = 'suburban';
  } else if (activeListings > 5000) {
    type = 'urban';
  } else if (activeListings < 500) {
    type = 'rural';
  }
  
  // Detect seasonality level
  const peakRevenue = seasonalityData.filter(s => s.season_type === 'peak')
    .reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, seasonalityData.filter(s => s.season_type === 'peak').length);
  const offRevenue = seasonalityData.filter(s => s.season_type === 'off')
    .reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, seasonalityData.filter(s => s.season_type === 'off').length);
  
  const seasonalSwing = offRevenue > 0 ? (peakRevenue - offRevenue) / offRevenue : 0;
  let seasonality: MarketContext['seasonality'] = 'moderate';
  if (seasonalSwing > 0.5) seasonality = 'high';
  else if (seasonalSwing < 0.2) seasonality = 'low';
  
  // Detect competition level
  let competition: MarketContext['competition'] = 'moderate';
  if (activeListings > 10000) competition = 'high';
  else if (activeListings < 1000) competition = 'low';
  
  // Detect price point
  let pricePoint: MarketContext['pricePoint'] = 'mid-range';
  if (adr > 300) pricePoint = 'luxury';
  else if (adr < 100) pricePoint = 'budget';
  
  // Generate description
  const descriptions: Record<MarketContext['type'], string> = {
    tourist: 'This is primarily a vacation destination market where guests are looking for memorable experiences.',
    business: 'This market serves primarily business travelers who value convenience and reliability.',
    mixed: 'This market serves a mix of leisure and business travelers, offering flexibility in your target audience.',
    suburban: 'This suburban market often attracts families and groups looking for space and value.',
    urban: 'This urban market has high demand but also significant competition from hotels and other rentals.',
    rural: 'This smaller market has less competition but also lower overall demand - success depends on standing out.'
  };
  
  return {
    type,
    seasonality,
    competition,
    pricePoint,
    description: descriptions[type]
  };
}

// ============================================
// ENHANCED NARRATIVE REPORT TYPES
// ============================================

export interface EnhancedNarrativeReportInput {
  // Property details
  address: string;
  monthly_rent: number;
  bedrooms: number;
  bathrooms: number;
  
  // Market data
  market_name: string;
  market_occupancy: number;
  market_adr: number;
  active_listings: number;
  
  // Revenue projections
  revenue_low: number;
  revenue_mid: number;
  revenue_high: number;
  
  // Profitability
  monthly_expenses: number;
  annual_profit_conservative: number;
  annual_profit_realistic: number;
  annual_profit_optimistic: number;
  
  // Competitors
  competitors: Array<{
    name: string;
    annual_revenue: number;
    occupancy: number;
    adr: number;
    rating: number | null;
    reviews: number;
    airbnb_url?: string;
    success_factor?: string;
  }>;
  
  // Seasonality
  seasonality: Array<{
    month: string;
    revenue: number;
    occupancy: number;
    adr: number;
    season_type: 'peak' | 'shoulder' | 'off';
  }>;
  
  // Historical data (5 years)
  five_year_summary?: {
    years_of_data: number;
    occupancy: { current_year_avg: number; five_year_avg: number; trend: string; percent_change: number };
    adr: { current_year_avg: number; five_year_avg: number; trend: string; percent_change: number };
    revenue: { current_year_avg: number; five_year_avg: number; trend: string; percent_change: number };
    market_maturity: 'emerging' | 'growing' | 'mature' | 'saturated';
  };
  
  // Supply trend
  supply_trend?: {
    current_listings: number;
    net_change: number;
    percent_change: number;
    trend: 'growing' | 'stable' | 'declining';
  };
  
  // Professional host stats
  professional_stats?: {
    professional_percentage: number;
    superhost_percentage: number;
    revenue_premium_percent?: number;
  };
  
  // Booking patterns - ENHANCED with all available data
  booking_patterns?: {
    avg_lead_time_days: number;
    median_lead_time_days: number;
    last_minute_booking_percent: number;
    advance_booking_percent: number;
    avg_length_of_stay: number;
    median_length_of_stay: number;
    weekend_stay_percent: number;
    week_plus_stay_percent: number;
    insights: string[];
  };
  
  // Top amenities
  amenities?: Array<{
    amenity: string;
    percentage_of_top_performers: number;
  }>;
  
  // Risks
  risks?: Array<{
    category: string;
    description: string;
    severity: string;
  }>;
  
  // Bedroom performance data
  bedroom_performance?: Array<{
    bedrooms: number;
    count: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
  }>;
  
  // Property's bedroom count for comparison
  property_bedrooms?: number;
}

export interface EnhancedNarrativeReport {
  // Main narrative sections
  executive_summary: string;
  market_overview: string;
  revenue_analysis: string;
  competitive_landscape: string;
  seasonal_strategy: string;
  historical_context: string;
  risk_assessment: string;
  financial_outlook: string;
  conclusion: string;
  
  // NEW: Plain-language explanations
  what_this_means: {
    revenue: string;
    competition: string;
    seasonality: string;
    overall: string;
  };
  
  // NEW: Specific action items
  action_items: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    why: string;
    timeline: string;
  }>;
  
  // Key metrics for display cards
  key_metrics: {
    projected_annual_revenue: number;
    projected_monthly_profit: number;
    market_occupancy: number;
    market_adr: number;
    break_even_months: number;
    confidence_level: 'high' | 'medium' | 'low';
    revenue_to_rent_ratio: number;
  };
  
  // Quick facts for sidebar
  quick_facts: string[];
  
  // Market context
  market_context: MarketContext;
}

// ============================================
// ENHANCED NARRATIVE GENERATION
// ============================================

export async function generateEnhancedNarrativeReport(
  input: EnhancedNarrativeReportInput
): Promise<EnhancedNarrativeReport> {
  // Check cache first
  const cacheKey = `narrative_${input.address}_${input.monthly_rent}_${input.bedrooms}`;
  const cached = narrativeCache.get(cacheKey);
  if (cached) {
    console.log('[GeminiEnhanced] Returning cached narrative report');
    return cached;
  }
  
  console.log('[GeminiEnhanced] Generating enhanced narrative report...');
  
  // Detect market context
  const marketContext = detectMarketContext(
    input.market_name,
    input.market_occupancy,
    input.market_adr,
    input.active_listings,
    input.seasonality
  );
  
  // Calculate key ratios
  const revenueToRentRatio = input.revenue_mid / (input.monthly_rent * 12);
  const occupancyNormalized = input.market_occupancy < 1 ? input.market_occupancy * 100 : input.market_occupancy;
  
  // Format competitor data with more detail
  const competitorAnalysis = input.competitors.slice(0, 8).map((c, i) => {
    const occupancyPct = c.occupancy < 1 ? Math.round(c.occupancy * 100) : Math.round(c.occupancy);
    return `${i + 1}. "${c.name}"
   - Revenue: $${c.annual_revenue.toLocaleString()}/year ($${Math.round(c.annual_revenue / 12).toLocaleString()}/month)
   - Occupancy: ${occupancyPct}% | ADR: $${Math.round(c.adr)}/night
   - Rating: ${c.rating ? `${c.rating}★ (${c.reviews} reviews)` : 'No rating'}
   - Success Factor: ${c.success_factor || 'Not identified'}`;
  }).join('\n\n');
  
  // Format seasonality with more context
  const peakMonths = input.seasonality.filter(s => s.season_type === 'peak');
  const offMonths = input.seasonality.filter(s => s.season_type === 'off');
  const avgPeakRevenue = peakMonths.reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, peakMonths.length);
  const avgOffRevenue = offMonths.reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, offMonths.length);
  const seasonalSwingPct = avgOffRevenue > 0 ? Math.round(((avgPeakRevenue - avgOffRevenue) / avgOffRevenue) * 100) : 0;
  
  const seasonalityTable = input.seasonality.map(s => {
    const occPct = s.occupancy < 1 ? Math.round(s.occupancy * 100) : Math.round(s.occupancy);
    return `| ${s.month} | $${s.revenue.toLocaleString()} | ${occPct}% | $${Math.round(s.adr)} | ${s.season_type.toUpperCase()} |`;
  }).join('\n');
  
  // Build historical context
  let historicalSection = 'No historical data available.';
  if (input.five_year_summary) {
    const fys = input.five_year_summary;
    historicalSection = `
MARKET HISTORY (${fys.years_of_data} years of data):
- Market Maturity: ${fys.market_maturity.toUpperCase()}
- Occupancy: ${fys.occupancy.trend} (${fys.occupancy.percent_change > 0 ? '+' : ''}${fys.occupancy.percent_change.toFixed(1)}% over 5 years)
  • Current Year: ${fys.occupancy.current_year_avg.toFixed(1)}%
  • 5-Year Average: ${fys.occupancy.five_year_avg.toFixed(1)}%
- ADR: ${fys.adr.trend} (${fys.adr.percent_change > 0 ? '+' : ''}${fys.adr.percent_change.toFixed(1)}% over 5 years)
  • Current Year: $${fys.adr.current_year_avg.toFixed(0)}/night
  • 5-Year Average: $${fys.adr.five_year_avg.toFixed(0)}/night
- Revenue: ${fys.revenue.trend} (${fys.revenue.percent_change > 0 ? '+' : ''}${fys.revenue.percent_change.toFixed(1)}% over 5 years)
  • Current Year: $${fys.revenue.current_year_avg.toFixed(0)}/month
  • 5-Year Average: $${fys.revenue.five_year_avg.toFixed(0)}/month`;
  }
  
  // Build supply context
  let supplySection = '';
  if (input.supply_trend) {
    supplySection = `
SUPPLY DYNAMICS:
- Current Active Listings: ${input.supply_trend.current_listings.toLocaleString()}
- Net Change: ${input.supply_trend.net_change > 0 ? '+' : ''}${input.supply_trend.net_change} listings
- Trend: ${input.supply_trend.trend.toUpperCase()} (${input.supply_trend.percent_change > 0 ? '+' : ''}${input.supply_trend.percent_change.toFixed(1)}%)`;
  }
  
  // Build professional host context
  let professionalSection = '';
  if (input.professional_stats) {
    professionalSection = `
HOST LANDSCAPE:
- Professional Hosts: ${input.professional_stats.professional_percentage.toFixed(1)}% of market
- Superhosts: ${input.professional_stats.superhost_percentage.toFixed(1)}%
${input.professional_stats.revenue_premium_percent ? `- Professional Revenue Premium: +${input.professional_stats.revenue_premium_percent.toFixed(0)}%` : ''}`;
  }
  
  // Build amenities context
  let amenitiesSection = '';
  if (input.amenities && input.amenities.length > 0) {
    amenitiesSection = `
TOP AMENITIES (% of top performers that have them):
${input.amenities.slice(0, 10).map(a => `- ${a.amenity}: ${a.percentage_of_top_performers}%`).join('\n')}`;
  }

  const prompt = `You are a senior short-term rental investment analyst writing a comprehensive report for an investor considering a rental arbitrage opportunity. Your reports are known for being specific, actionable, and honest.

CRITICAL INSTRUCTIONS:
1. Use SPECIFIC numbers from the data - never generalize
2. Calculate and explain what numbers MEAN for the investor
3. Compare this property to the market and competitors
4. Identify specific opportunities and specific risks
5. Write in flowing paragraphs, NOT bullet points
6. Be honest - if the numbers are weak, say so clearly
7. Include "What This Means For You" explanations in plain language

MARKET CONTEXT:
${marketContext.description}
- Market Type: ${marketContext.type}
- Seasonality Level: ${marketContext.seasonality}
- Competition Level: ${marketContext.competition}
- Price Point: ${marketContext.pricePoint}

PROPERTY DETAILS:
- Address: ${input.address}
- Monthly Rent: $${input.monthly_rent.toLocaleString()}
- Annual Rent Cost: $${(input.monthly_rent * 12).toLocaleString()}
- Configuration: ${input.bedrooms} bedrooms, ${input.bathrooms} bathrooms

MARKET OVERVIEW:
- Market: ${input.market_name}
- Market Occupancy: ${occupancyNormalized.toFixed(1)}%
- Market ADR: $${input.market_adr.toFixed(0)}/night
- Active Listings: ${input.active_listings.toLocaleString()}

REVENUE PROJECTIONS:
- Conservative (50th percentile): $${input.revenue_low.toLocaleString()}/year ($${Math.round(input.revenue_low / 12).toLocaleString()}/month)
- Realistic (75th percentile): $${input.revenue_mid.toLocaleString()}/year ($${Math.round(input.revenue_mid / 12).toLocaleString()}/month)
- Optimistic (90th percentile): $${input.revenue_high.toLocaleString()}/year ($${Math.round(input.revenue_high / 12).toLocaleString()}/month)

KEY RATIO:
- Revenue-to-Rent Ratio: ${revenueToRentRatio.toFixed(2)}x (${revenueToRentRatio >= 2 ? 'MEETS' : 'DOES NOT MEET'} the 2x rule)
- This means for every $1 in rent, you could generate $${revenueToRentRatio.toFixed(2)} in revenue

PROFITABILITY ANALYSIS:
- Monthly Operating Expenses: $${input.monthly_expenses.toLocaleString()}
- Annual Operating Costs: $${(input.monthly_expenses * 12).toLocaleString()}
- Annual Profit (Conservative): $${input.annual_profit_conservative.toLocaleString()} ($${Math.round(input.annual_profit_conservative / 12).toLocaleString()}/month)
- Annual Profit (Realistic): $${input.annual_profit_realistic.toLocaleString()} ($${Math.round(input.annual_profit_realistic / 12).toLocaleString()}/month)
- Annual Profit (Optimistic): $${input.annual_profit_optimistic.toLocaleString()} ($${Math.round(input.annual_profit_optimistic / 12).toLocaleString()}/month)

TOP COMPETITORS (${input.bedrooms}-bedroom properties):
${competitorAnalysis}

SEASONALITY:
- Seasonal Swing: ${seasonalSwingPct}% difference between peak and off-season
- Peak Months: ${peakMonths.map(s => s.month).join(', ') || 'Not identified'}
- Off-Season Months: ${offMonths.map(s => s.month).join(', ') || 'Not identified'}
- Average Peak Revenue: $${avgPeakRevenue.toFixed(0)}/month
- Average Off-Season Revenue: $${avgOffRevenue.toFixed(0)}/month

| Month | Revenue | Occupancy | ADR | Season |
|-------|---------|-----------|-----|--------|
${seasonalityTable}
${historicalSection}
${supplySection}
${professionalSection}
${amenitiesSection}

BOOKING PATTERNS:
- Average Lead Time: ${input.booking_patterns?.avg_lead_time_days || 'N/A'} days
- Average Stay Length: ${input.booking_patterns?.avg_length_of_stay || 'N/A'} nights

---

Generate a comprehensive investment report with the following structure. Each section should be 2-4 paragraphs of flowing narrative prose. Use specific numbers and explain what they mean.

Return your response as JSON with this exact structure:
{
  "executive_summary": "A compelling 3-paragraph overview. Start with the bottom line - state the revenue-to-rent ratio and whether this meets the 2x rule. Then summarize the market conditions and competitive position. End with the key factors that will determine success or failure.",
  
  "market_overview": "3 paragraphs analyzing ${input.market_name}. Discuss what type of market this is (${marketContext.type}), the ${occupancyNormalized.toFixed(1)}% occupancy rate and what it indicates, the $${input.market_adr.toFixed(0)} ADR and how it compares to similar markets, and the ${input.active_listings.toLocaleString()} active listings and what that means for competition.",
  
  "revenue_analysis": "3 paragraphs on revenue potential. Explain the three scenarios and what performance level each requires. Calculate the revenue-to-rent ratio (${revenueToRentRatio.toFixed(2)}x) and explain if this meets the 2x rule. Discuss what it would take to hit each revenue target.",
  
  "competitive_landscape": "3 paragraphs on competition. Analyze what the top performers are doing right. Identify specific success factors from the competitor data. Discuss the ${input.professional_stats?.professional_percentage?.toFixed(1) || 'N/A'}% professional host presence and what it means. Explain how this property can compete.",
  
  "seasonal_strategy": "3 paragraphs on seasonality. Discuss the ${seasonalSwingPct}% seasonal swing and what it means for cash flow. Identify specific pricing strategies for peak vs off-season. Provide concrete recommendations for each season.",
  
  "historical_context": "2-3 paragraphs on market trajectory. Discuss whether this market is ${input.five_year_summary?.market_maturity || 'unknown maturity'} and what that means. Analyze the 5-year trends in occupancy, ADR, and revenue. Explain what the historical data suggests about future performance.",
  
  "risk_assessment": "3 paragraphs honestly discussing risks. Identify specific market risks (competition, saturation, seasonality). Discuss financial risks (cash flow during slow months, startup costs). Address operational risks. For each risk, suggest a mitigation strategy.",
  
  "financial_outlook": "3 paragraphs on the financial picture. Calculate monthly cash flow in each scenario. Estimate break-even timeline on startup costs. Discuss whether this is a good use of capital compared to alternatives.",
  
  "conclusion": "2 strong paragraphs. Summarize whether this property meets the criteria for a successful rental arbitrage. Provide a clear, honest assessment with specific conditions for success.",
  
  "what_this_means": {
    "revenue": "One paragraph in plain language explaining what the revenue numbers mean for someone new to STR investing. Use analogies if helpful.",
    "competition": "One paragraph explaining what the competitive landscape means in practical terms.",
    "seasonality": "One paragraph explaining how seasonality will affect their monthly income and what to expect.",
    "overall": "One paragraph giving the honest bottom line - is this a good opportunity and for whom?"
  },
  
  "action_items": [
    {
      "priority": "high",
      "action": "Specific action to take",
      "why": "Why this matters",
      "timeline": "When to do this"
    }
  ],
  
  "key_metrics": {
    "projected_annual_revenue": ${input.revenue_mid},
    "projected_monthly_profit": ${Math.round(input.annual_profit_realistic / 12)},
    "market_occupancy": ${input.market_occupancy < 1 ? input.market_occupancy : input.market_occupancy / 100},
    "market_adr": ${input.market_adr},
    "break_even_months": <calculate based on startup costs and monthly profit>,
    "confidence_level": "<high if data is strong and market stable, medium if some uncertainty, low if significant data gaps or market volatility>",
    "revenue_to_rent_ratio": ${revenueToRentRatio.toFixed(2)}
  },
  
  "quick_facts": [
    "Revenue-to-rent ratio: ${revenueToRentRatio.toFixed(2)}x (${revenueToRentRatio >= 2 ? 'meets' : 'does not meet'} 2x rule)",
    "Market occupancy: ${occupancyNormalized.toFixed(1)}%",
    "Seasonal swing: ${seasonalSwingPct}% between peak and off-season",
    "Competition: ${input.active_listings.toLocaleString()} active listings",
    "Top performer revenue: $${input.competitors[0]?.annual_revenue?.toLocaleString() || 'N/A'}/year",
    "<2-3 more specific facts from the data>"
  ]
}

IMPORTANT:
- Write in flowing paragraphs, NOT bullet points
- Use SPECIFIC numbers from the data provided
- Explain what numbers MEAN, don't just state them
- Be honest about both opportunities AND risks
- Write for someone who may be new to STR investing
- The tone should be professional but accessible, like a trusted advisor
- Include 4-6 specific action items with clear priorities`;

  try {
    const response = await callGeminiWithRetry(prompt, 8192, 180000);
    
    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    const result: EnhancedNarrativeReport = {
      executive_summary: parsed.executive_summary || 'Analysis in progress...',
      market_overview: parsed.market_overview || '',
      revenue_analysis: parsed.revenue_analysis || '',
      competitive_landscape: parsed.competitive_landscape || '',
      seasonal_strategy: parsed.seasonal_strategy || '',
      historical_context: parsed.historical_context || '',
      risk_assessment: parsed.risk_assessment || '',
      financial_outlook: parsed.financial_outlook || '',
      conclusion: parsed.conclusion || '',
      what_this_means: {
        revenue: parsed.what_this_means?.revenue || '',
        competition: parsed.what_this_means?.competition || '',
        seasonality: parsed.what_this_means?.seasonality || '',
        overall: parsed.what_this_means?.overall || ''
      },
      action_items: parsed.action_items || [],
      key_metrics: {
        projected_annual_revenue: parsed.key_metrics?.projected_annual_revenue || input.revenue_mid,
        projected_monthly_profit: parsed.key_metrics?.projected_monthly_profit || Math.round(input.annual_profit_realistic / 12),
        market_occupancy: parsed.key_metrics?.market_occupancy || input.market_occupancy,
        market_adr: parsed.key_metrics?.market_adr || input.market_adr,
        break_even_months: parsed.key_metrics?.break_even_months || 12,
        confidence_level: parsed.key_metrics?.confidence_level || 'medium',
        revenue_to_rent_ratio: parsed.key_metrics?.revenue_to_rent_ratio || revenueToRentRatio
      },
      quick_facts: parsed.quick_facts || [],
      market_context: marketContext
    };
    
    // Cache the result
    narrativeCache.set(cacheKey, result);
    
    console.log('[GeminiEnhanced] Enhanced narrative report generated successfully');
    return result;
    
  } catch (error) {
    console.error('[GeminiEnhanced] Error generating enhanced narrative report:', error);
    
    // Return a comprehensive fallback report
    return generateFallbackReport(input, marketContext, revenueToRentRatio);
  }
}

// ============================================
// FALLBACK REPORT GENERATION
// ============================================

function generateFallbackReport(
  input: EnhancedNarrativeReportInput,
  marketContext: MarketContext,
  revenueToRentRatio: number
): EnhancedNarrativeReport {
  const occupancyNormalized = input.market_occupancy < 1 ? input.market_occupancy * 100 : input.market_occupancy;
  const meetsRule = revenueToRentRatio >= 2;
  
  return {
    executive_summary: `This ${input.bedrooms}-bedroom property at ${input.address} presents ${meetsRule ? 'a promising' : 'a challenging'} rental arbitrage opportunity in the ${input.market_name} market. With a monthly rent of $${input.monthly_rent.toLocaleString()} and projected annual revenue of $${input.revenue_mid.toLocaleString()}, the revenue-to-rent ratio is ${revenueToRentRatio.toFixed(2)}x, which ${meetsRule ? 'meets' : 'does not meet'} the recommended 2x threshold.

The ${input.market_name} market shows ${occupancyNormalized.toFixed(1)}% occupancy with an average daily rate of $${input.market_adr.toFixed(0)}. There are ${input.active_listings.toLocaleString()} active listings competing for guests, indicating ${marketContext.competition} competition levels.

${meetsRule ? 'The fundamentals suggest this property could be profitable with proper execution.' : 'The numbers suggest this property may struggle to achieve profitability without exceptional performance or rent negotiation.'}`,
    
    market_overview: `The ${input.market_name} market is characterized as a ${marketContext.type} destination with ${marketContext.seasonality} seasonality. ${marketContext.description}

With ${occupancyNormalized.toFixed(1)}% market-wide occupancy and a $${input.market_adr.toFixed(0)} average daily rate, this market generates approximately $${Math.round(occupancyNormalized * input.market_adr * 365 / 100).toLocaleString()} in potential annual revenue per listing at full market rates.

The ${input.active_listings.toLocaleString()} active listings indicate ${input.active_listings > 5000 ? 'a highly competitive environment where differentiation is crucial' : input.active_listings > 1000 ? 'moderate competition with room for well-positioned properties' : 'relatively limited competition, though this may also indicate limited demand'}.`,
    
    revenue_analysis: `Revenue projections for this property range from $${input.revenue_low.toLocaleString()} (conservative) to $${input.revenue_high.toLocaleString()} (optimistic), with a realistic target of $${input.revenue_mid.toLocaleString()} annually.

The revenue-to-rent ratio of ${revenueToRentRatio.toFixed(2)}x means that for every dollar spent on rent, the property could generate $${revenueToRentRatio.toFixed(2)} in revenue. The industry standard "2x rule" suggests properties should generate at least twice the rent in revenue to be viable. This property ${meetsRule ? 'meets this threshold' : 'falls short of this threshold'}.

At the realistic projection of $${input.revenue_mid.toLocaleString()}/year, monthly revenue would average $${Math.round(input.revenue_mid / 12).toLocaleString()}, compared to the $${input.monthly_rent.toLocaleString()} monthly rent obligation.`,
    
    competitive_landscape: `The competitive analysis reveals ${input.competitors.length} comparable ${input.bedrooms}-bedroom properties in the area. The top performer generates $${input.competitors[0]?.annual_revenue?.toLocaleString() || 'N/A'} annually, demonstrating the revenue ceiling in this market.

${input.professional_stats ? `Professional hosts represent ${input.professional_stats.professional_percentage.toFixed(1)}% of the market, with Superhosts at ${input.professional_stats.superhost_percentage.toFixed(1)}%. ${input.professional_stats.professional_percentage > 50 ? 'This high professional presence means you\'ll be competing against experienced operators.' : 'The relatively low professional presence suggests opportunity for well-managed properties to stand out.'}` : 'Professional host data is not available for this market.'}

Success in this market appears to depend on ${input.competitors[0]?.success_factor || 'factors that require further analysis'}.`,
    
    seasonal_strategy: `Seasonality analysis shows ${input.seasonality.filter(s => s.season_type === 'peak').length} peak months and ${input.seasonality.filter(s => s.season_type === 'off').length} off-season months. Peak season revenue averages $${Math.round(input.seasonality.filter(s => s.season_type === 'peak').reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, input.seasonality.filter(s => s.season_type === 'peak').length)).toLocaleString()}/month, while off-season drops to $${Math.round(input.seasonality.filter(s => s.season_type === 'off').reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, input.seasonality.filter(s => s.season_type === 'off').length)).toLocaleString()}/month.

This ${marketContext.seasonality} seasonality pattern means ${marketContext.seasonality === 'high' ? 'significant income variation throughout the year - plan for lean months' : marketContext.seasonality === 'low' ? 'relatively stable income throughout the year' : 'moderate income variation that requires some planning'}.

During peak season, maximize rates and enforce minimum stays. During off-season, consider discounts, weekly rates, and targeting different guest segments.`,
    
    historical_context: input.five_year_summary 
      ? `The ${input.market_name} market has ${input.five_year_summary.years_of_data} years of historical data showing ${input.five_year_summary.market_maturity} market conditions. Revenue has ${input.five_year_summary.revenue.trend} by ${input.five_year_summary.revenue.percent_change.toFixed(1)}% over this period.

Occupancy trends show ${input.five_year_summary.occupancy.trend} movement (${input.five_year_summary.occupancy.percent_change > 0 ? '+' : ''}${input.five_year_summary.occupancy.percent_change.toFixed(1)}%), while ADR has ${input.five_year_summary.adr.trend} (${input.five_year_summary.adr.percent_change > 0 ? '+' : ''}${input.five_year_summary.adr.percent_change.toFixed(1)}%).

This ${input.five_year_summary.market_maturity} market ${input.five_year_summary.market_maturity === 'growing' ? 'shows positive momentum' : input.five_year_summary.market_maturity === 'mature' ? 'offers stability but limited growth upside' : input.five_year_summary.market_maturity === 'saturated' ? 'may face increasing competition' : 'is still developing'}.`
      : 'Historical market data is not available for detailed trend analysis. This limits our ability to assess long-term market trajectory.',
    
    risk_assessment: `Key risks for this investment include market competition (${input.active_listings.toLocaleString()} active listings), seasonal income variation (${marketContext.seasonality} seasonality), and the ${meetsRule ? 'need to maintain strong performance' : 'challenging revenue-to-rent ratio'}.

Financial risks include the monthly rent obligation of $${input.monthly_rent.toLocaleString()} regardless of bookings, estimated monthly expenses of $${input.monthly_expenses.toLocaleString()}, and startup costs for furnishing and launching the property.

Operational risks include guest management, maintenance issues, and potential regulatory changes. Mitigation strategies include building a cash reserve for slow months, maintaining high review scores, and staying informed about local STR regulations.`,
    
    financial_outlook: `At realistic projections, this property would generate $${input.annual_profit_realistic.toLocaleString()} in annual profit, or approximately $${Math.round(input.annual_profit_realistic / 12).toLocaleString()} per month. This assumes consistent performance at the 75th percentile of comparable properties.

Monthly cash flow will vary significantly with seasonality. During peak months, expect stronger returns; during off-season, cash flow may be tight or negative. Building a reserve fund is essential.

${input.annual_profit_realistic > 0 ? `With estimated startup costs of $${(input.bedrooms * 3000 + 2000).toLocaleString()}-$${(input.bedrooms * 4500 + 2000).toLocaleString()}, break-even would occur in approximately ${Math.ceil((input.bedrooms * 3500 + 2000) / (input.annual_profit_realistic / 12))} months at realistic projections.` : 'The negative profit projection suggests this property may not be viable without rent negotiation or exceptional performance.'}`,
    
    conclusion: `This ${input.bedrooms}-bedroom property ${meetsRule ? 'shows potential as a rental arbitrage investment' : 'faces challenges as a rental arbitrage investment'}. The ${revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio ${meetsRule ? 'meets' : 'does not meet'} the recommended 2x threshold, and the ${input.market_name} market offers ${marketContext.competition} competition with ${marketContext.seasonality} seasonality.

${meetsRule ? 'Success will depend on achieving at least median market performance, managing seasonality effectively, and maintaining competitive positioning against ' + input.active_listings.toLocaleString() + ' other listings.' : 'Consider negotiating lower rent, finding a property with better fundamentals, or exploring markets with stronger revenue potential before proceeding.'}`,
    
    what_this_means: {
      revenue: `In simple terms, this property could bring in about $${Math.round(input.revenue_mid / 12).toLocaleString()} per month in bookings. After paying your $${input.monthly_rent.toLocaleString()} rent and about $${Math.round(input.monthly_expenses - input.monthly_rent).toLocaleString()} in other expenses, you'd keep around $${Math.round(input.annual_profit_realistic / 12).toLocaleString()} per month. That's ${meetsRule ? 'a reasonable return' : 'a tight margin'} for the work involved.`,
      competition: `You'll be competing against ${input.active_listings.toLocaleString()} other rentals in this area. ${input.active_listings > 5000 ? 'That\'s a lot of competition - you\'ll need great photos, competitive pricing, and excellent reviews to stand out.' : input.active_listings > 1000 ? 'That\'s moderate competition - a well-run property can succeed here.' : 'That\'s relatively light competition, which could work in your favor.'}`,
      seasonality: `Your income will ${marketContext.seasonality === 'high' ? 'swing dramatically' : marketContext.seasonality === 'low' ? 'stay relatively stable' : 'vary moderately'} throughout the year. ${marketContext.seasonality === 'high' ? 'Expect great months and tough months - save during the good times.' : 'This makes planning easier than highly seasonal markets.'}`,
      overall: meetsRule 
        ? `Overall, this property has the fundamentals to work as a rental arbitrage. It's not a slam dunk, but with solid execution and some luck, you could build a profitable operation here.`
        : `Honestly, the numbers are tight on this one. The rent is high relative to what you can earn. Unless you can negotiate the rent down or you're confident you can outperform the market, I'd keep looking.`
    },
    
    action_items: [
      {
        priority: 'high',
        action: 'Verify local STR regulations',
        why: 'Regulations can make or break your business - know the rules before signing a lease',
        timeline: 'Before making any commitment'
      },
      {
        priority: 'high',
        action: meetsRule ? 'Negotiate the lease terms' : 'Negotiate lower rent or find alternative property',
        why: meetsRule ? 'Even small rent reductions improve your margins significantly' : 'The current rent makes profitability challenging',
        timeline: 'During lease negotiation'
      },
      {
        priority: 'medium',
        action: 'Research top competitors on Airbnb',
        why: 'Understanding what makes top performers successful helps you compete',
        timeline: 'Before finalizing business plan'
      },
      {
        priority: 'medium',
        action: 'Build a 3-month cash reserve',
        why: 'Seasonality and slow periods are inevitable - be prepared',
        timeline: 'Before launch'
      },
      {
        priority: 'low',
        action: 'Connect with local STR hosts',
        why: 'Local knowledge about regulations, cleaners, and market dynamics is invaluable',
        timeline: 'Ongoing'
      }
    ],
    
    key_metrics: {
      projected_annual_revenue: input.revenue_mid,
      projected_monthly_profit: Math.round(input.annual_profit_realistic / 12),
      market_occupancy: input.market_occupancy,
      market_adr: input.market_adr,
      break_even_months: input.annual_profit_realistic > 0 ? Math.ceil((input.bedrooms * 3500 + 2000) / (input.annual_profit_realistic / 12)) : 24,
      confidence_level: 'medium',
      revenue_to_rent_ratio: revenueToRentRatio
    },
    
    quick_facts: [
      `Revenue-to-rent ratio: ${revenueToRentRatio.toFixed(2)}x (${meetsRule ? 'meets' : 'does not meet'} 2x rule)`,
      `Market occupancy: ${(input.market_occupancy < 1 ? input.market_occupancy * 100 : input.market_occupancy).toFixed(1)}%`,
      `Market ADR: $${input.market_adr.toFixed(0)}/night`,
      `Competition: ${input.active_listings.toLocaleString()} active listings`,
      `Top performer: $${input.competitors[0]?.annual_revenue?.toLocaleString() || 'N/A'}/year`,
      `Realistic monthly profit: $${Math.round(input.annual_profit_realistic / 12).toLocaleString()}`
    ],
    
    market_context: marketContext
  };
}

// ============================================
// PARALLEL DATA FETCHING HELPER
// ============================================

export async function fetchDataInParallel<T extends Record<string, Promise<any>>>(
  fetchers: T
): Promise<{ [K in keyof T]: Awaited<T[K]> | null }> {
  const keys = Object.keys(fetchers) as (keyof T)[];
  const promises = keys.map(key => 
    fetchers[key].catch(err => {
      console.error(`[GeminiEnhanced] Error fetching ${String(key)}:`, err.message);
      return null;
    })
  );
  
  const results = await Promise.all(promises);
  
  const output = {} as { [K in keyof T]: Awaited<T[K]> | null };
  keys.forEach((key, index) => {
    output[key] = results[index];
  });
  
  return output;
}

// ============================================
// CACHE MANAGEMENT
// ============================================

export function clearAllCaches(): void {
  marketDataCache.clear();
  narrativeCache.clear();
  console.log('[GeminiEnhanced] All caches cleared');
}

export function getCacheStats(): { marketData: number; narrative: number } {
  return {
    marketData: 0, // Would need to expose cache size
    narrative: 0
  };
}

/**
 * Gemini AI Analyzer - Maximized AI Integration for Arbitrage Analysis
 * 
 * This module transforms Gemini from a "data router" into an "AI analyst"
 * by using its analytical capabilities to synthesize insights, identify
 * patterns, and generate personalized recommendations.
 * 
 * Key Capabilities:
 * - Property insight synthesis (unique insights per property)
 * - Competitor pattern analysis (what makes winners win)
 * - Photo analysis using Gemini Vision (design themes, amenities)
 * - Lease decision generation (GO/CAUTION/PASS with confidence)
 * - Pricing strategy recommendations
 * - Risk and opportunity assessment
 * - Personalized action plans
 */

import { ENV } from './_core/env';
import { apiCache } from './cache';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent';  // Gemini 3 Pro for complex reasoning

// ============================================
// GLOBAL HELPER FUNCTIONS
// ============================================

/**
 * Formats occupancy values consistently.
 * AirDNA API returns occupancy in inconsistent formats:
 * - Sometimes as decimal (0.71 = 71%)
 * - Sometimes as percentage already (71 = 71%)
 * - Sometimes as percentage * 100 (7100 = 71%)
 * 
 * This function normalizes all formats to a percentage string.
 */
function formatOccupancy(occ: number | undefined | null): string {
  if (occ === undefined || occ === null || isNaN(occ)) return 'N/A';
  
  let normalized: number;
  
  // If value is > 100, it's likely already multiplied by 100 twice (e.g., 7135 should be 71.35%)
  if (occ > 100) {
    normalized = occ / 100;
  }
  // If value is > 1 but <= 100, it's already a percentage
  else if (occ > 1) {
    normalized = occ;
  }
  // If value is <= 1, it's a decimal that needs to be converted to percentage
  else {
    normalized = occ * 100;
  }
  
  // Cap at 100% - occupancy cannot exceed 100%
  // Values above 100% indicate data anomalies
  if (normalized > 100) {
    console.warn(`[formatOccupancy] Capping anomalous occupancy value: ${normalized}% -> 100%`);
    normalized = 100;
  }
  
  return normalized.toFixed(1);
}

/**
 * Returns occupancy as a number (percentage form, e.g., 71.35)
 * Use this when you need to do calculations with occupancy.
 */
function normalizeOccupancy(occ: number | undefined | null): number {
  if (occ === undefined || occ === null || isNaN(occ)) return 0;
  
  let normalized: number;
  
  // If value is > 100, it's likely already multiplied by 100 twice
  if (occ > 100) {
    normalized = occ / 100;
  }
  // If value is > 1 but <= 100, it's already a percentage
  else if (occ > 1) {
    normalized = occ;
  }
  // If value is <= 1, it's a decimal that needs to be converted to percentage
  else {
    normalized = occ * 100;
  }
  
  // Cap at 100% - occupancy cannot exceed 100%
  if (normalized > 100) {
    normalized = 100;
  }
  
  return normalized;
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface PropertyData {
  address: string;
  bedrooms: number;
  bathrooms: number;
  monthly_rent: number;
  property_type?: string;
  square_footage?: number;
  attractive_features?: string[];
  zillow_url?: string;
}

export interface MarketData {
  name: string;
  occupancy: number;
  adr: number;
  revenue: number;
  active_listings: number;
}

export interface CompetitorData {
  name: string;
  airbnb_url: string;
  annual_revenue: number;
  occupancy: number;
  adr: number;
  rating: number | null;
  reviews: number;
  success_factor: string;
  bedrooms?: number;
  amenities?: string[];
}

export interface SeasonalityData {
  month: string;
  month_name?: string;
  revenue: number;
  occupancy: number;
  adr: number;
  season_type: 'peak' | 'shoulder' | 'off';
  pricing_recommendation?: string;
}

export interface PercentileData {
  top_10_percent: number;
  top_25_percent: number;
  median: number;
  average: number;
}

export interface AIInsight {
  title: string;
  insight: string;
  impact: 'High' | 'Medium' | 'Low';
  action: string;
}

export interface InvestmentVerdict {
  rating: 'GO' | 'CAUTION' | 'PASS';
  confidence: number; // 1-10
  summary: string;
  top_reasons: string[];
  key_risk: string;
  key_opportunity: string;
}

export interface PricingStrategy {
  base_rate: number;
  peak_premium_percent: number;
  slow_discount_percent: number;
  weekend_premium_percent: number;
  minimum_stay_peak: number;
  minimum_stay_slow: number;
  pricing_rationale: string;
}

export interface CompetitorPattern {
  pattern: string;
  frequency: string;
  revenue_impact: string;
  recommendation: string;
}

export interface PhotoAnalysis {
  design_theme: string;
  quality_score: number; // 1-10
  amenities_visible: string[];
  strengths: string[];
  improvements: string[];
  guest_appeal: string;
}

export interface RiskAssessment {
  overall_risk: 'Low' | 'Medium' | 'High';
  risks: Array<{
    category: string;
    description: string;
    severity: 'Low' | 'Medium' | 'High';
    mitigation: string;
  }>;
  opportunities: Array<{
    category: string;
    description: string;
    potential_impact: string;
    action: string;
  }>;
}

export interface ActionPlan {
  phase: string;
  timeline: string;
  tasks: string[];
  estimated_cost?: string;
  expected_outcome: string;
}

export interface FullAIAnalysis {
  insights: AIInsight[];
  verdict: InvestmentVerdict;
  pricing_strategy: PricingStrategy;
  competitor_patterns: CompetitorPattern[];
  risk_assessment: RiskAssessment;
  action_plan: ActionPlan[];
  executive_summary: string;
}

// ============================================
// CORE GEMINI CALL FUNCTION WITH RETRY LOGIC
// ============================================

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call Gemini API with exponential backoff retry logic
 * @param prompt - The prompt to send to Gemini
 * @param maxTokens - Maximum tokens in the response
 * @param timeoutMs - Timeout for each attempt in milliseconds
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 */
interface CallGeminiOptions {
  prompt: string;
  systemInstruction?: string;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  responseSchema?: Record<string, unknown>;
}

async function callGemini(
  promptOrOptions: string | CallGeminiOptions, 
  maxTokens: number = 4096, 
  timeoutMs: number = 45000,
  maxRetries: number = 2
): Promise<string> {
  // Support both old signature and new options object
  const opts: CallGeminiOptions = typeof promptOrOptions === 'string'
    ? { prompt: promptOrOptions, maxTokens, timeoutMs, maxRetries }
    : { maxTokens: 4096, timeoutMs: 45000, maxRetries: 2, ...promptOrOptions };
  const prompt = opts.prompt;
  maxTokens = opts.maxTokens!;
  timeoutMs = opts.timeoutMs!;
  maxRetries = opts.maxRetries!;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      if (attempt > 0) {
        // Exponential backoff: 2^attempt * 1000ms (2s, 4s, 8s, ...)
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`[GeminiAnalyzer] Retry attempt ${attempt + 1}/${maxRetries} after ${backoffMs}ms backoff`);
        await sleep(backoffMs);
      }
      
      // Build request body with optional systemInstruction and responseSchema
      const requestBody: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: maxTokens,
          thinkingConfig: {
            thinkingLevel: 'high'
          },
          ...(opts.responseSchema ? {
            responseMimeType: 'application/json',
            responseSchema: opts.responseSchema
          } : {})
        }
      };

      // Add systemInstruction if provided
      if (opts.systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: opts.systemInstruction }]
        };
      }

      const response = await fetch(`${GEMINI_API_URL}?key=${ENV.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (!response.ok) {
        // Check if response is HTML (error page) before trying to parse as JSON
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = 'Unknown error';
        
        if (contentType.includes('text/html')) {
          const htmlText = await response.text();
          console.error(`[GeminiAnalyzer] Received HTML error page instead of JSON: ${htmlText.substring(0, 200)}`);
          errorMessage = `API returned HTML error page (status ${response.status}). This may indicate an invalid API key or service issue.`;
        } else {
          try {
            const error = await response.json();
            errorMessage = error.error?.message || 'Unknown error';
          } catch {
            errorMessage = `HTTP ${response.status} - Could not parse error response`;
          }
        }
        
        // Check if it's a retryable error (rate limit, server error)
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`Gemini API error (${response.status}): ${errorMessage}`);
          console.warn(`[GeminiAnalyzer] Retryable error on attempt ${attempt + 1}: ${errorMessage}`);
          continue; // Retry
        }
        
        // Non-retryable error, throw immediately
        throw new Error(`Gemini API error: ${errorMessage}`);
      }

      // Check content type before parsing
      const successContentType = response.headers.get('content-type') || '';
      if (successContentType.includes('text/html')) {
        const htmlText = await response.text();
        console.error(`[GeminiAnalyzer] Received HTML instead of JSON: ${htmlText.substring(0, 200)}`);
        throw new Error('API returned HTML instead of JSON. This may indicate an authentication or service issue.');
      }
      
      const data = await response.json();
      // Filter out thinking parts - only extract text parts (not thought parts)
      const parts = data.candidates?.[0]?.content?.parts || [];
      const result = parts
        .filter((p: any) => p.text && !p.thought)
        .map((p: any) => p.text)
        .join('') || '';
      
      if (attempt > 0) {
        console.log(`[GeminiAnalyzer] Success on retry attempt ${attempt + 1}`);
      }
      
      return result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        lastError = new Error(`Gemini API timeout after ${timeoutMs / 1000} seconds`);
        console.warn(`[GeminiAnalyzer] Timeout on attempt ${attempt + 1}/${maxRetries}`);
        continue; // Retry on timeout
      }
      
      // For other errors, check if retryable
      if (error.message?.includes('ECONNRESET') || 
          error.message?.includes('ETIMEDOUT') ||
          error.message?.includes('network')) {
        lastError = error;
        console.warn(`[GeminiAnalyzer] Network error on attempt ${attempt + 1}: ${error.message}`);
        continue; // Retry on network errors
      }
      
      // Non-retryable error
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  // All retries exhausted
  throw lastError || new Error('Gemini API failed after all retry attempts');
}

async function callGeminiWithImage(prompt: string, imageUrl: string, maxTokens: number = 2048): Promise<string> {
  // Fetch the image and convert to base64
  let imageData: string;
  let mimeType: string;
  
  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    mimeType = contentType.split(';')[0];
    
    const arrayBuffer = await imageResponse.arrayBuffer();
    imageData = Buffer.from(arrayBuffer).toString('base64');
  } catch (error) {
    console.error('[GeminiAnalyzer] Error fetching image:', error);
    throw new Error(`Could not fetch image from URL: ${imageUrl}`);
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${ENV.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. You specialize in visual assessment of rental listings. Analyze images objectively, identifying design themes, amenities, and guest appeal factors.' }]
      },
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageData
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: maxTokens,
        thinkingConfig: {
          thinkingLevel: 'medium'
        }
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini Vision API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  // Filter out thinking parts
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join('') || '';
}

// ============================================
// AI SYNTHESIS FUNCTIONS
// ============================================

/**
 * Generate unique, actionable insights specific to this property
 */
export async function synthesizePropertyInsights(
  property: PropertyData,
  market: MarketData,
  competitors: CompetitorData[],
  percentiles: PercentileData,
  seasonality: SeasonalityData[]
): Promise<AIInsight[]> {
  // Pre-calculate key metrics for the prompt
  const annualRent = property.monthly_rent * 12;
  const minimumRevenue = annualRent * 2;
  const revenueToRentRatio = percentiles.median / annualRent;
  const top25Ratio = percentiles.top_25_percent / annualRent;
  const competitorsMeetingThreshold = competitors.filter(c => c.annual_revenue >= minimumRevenue).length;
  const qualificationRate = competitors.length > 0 ? (competitorsMeetingThreshold / competitors.length) * 100 : 0;
  const topCompetitorRevenue = competitors[0]?.annual_revenue || 0;
  const revenueGapToTop = topCompetitorRevenue - percentiles.median;
  
  // Seasonality calculations
  const peakMonths = (seasonality || []).filter(s => s.season_type === 'peak');
  const offMonths = (seasonality || []).filter(s => s.season_type === 'off');
  const peakSeasonRevenue = peakMonths.length > 0 ? peakMonths.reduce((sum, s) => sum + s.revenue, 0) / peakMonths.length : 0;
  const offSeasonRevenue = offMonths.length > 0 ? offMonths.reduce((sum, s) => sum + s.revenue, 0) / offMonths.length : 0;
  const seasonalSwing = offSeasonRevenue > 0 ? ((peakSeasonRevenue - offSeasonRevenue) / offSeasonRevenue * 100) : 0;
  
  // Competitor analysis
  const avgCompetitorRating = competitors.filter(c => c.rating).reduce((sum, c) => sum + (c.rating || 0), 0) / Math.max(1, competitors.filter(c => c.rating).length);
  const avgCompetitorReviews = competitors.reduce((sum, c) => sum + c.reviews, 0) / Math.max(1, competitors.length);
  const avgCompetitorADR = competitors.reduce((sum, c) => sum + c.adr, 0) / Math.max(1, competitors.length);

  const prompt = `You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. Generate 5 UNIQUE, DATA-DRIVEN insights specific to THIS property.

PROPERTY FUNDAMENTALS:
- Address: ${property.address}
- Configuration: ${property.bedrooms}BR/${property.bathrooms}BA
- Monthly Rent: $${property.monthly_rent.toLocaleString()}
- Annual Rent: $${annualRent.toLocaleString()}
- Minimum Revenue Needed (2x rule): $${minimumRevenue.toLocaleString()}

KEY CALCULATED METRICS (USE THESE IN YOUR ANALYSIS):
- Revenue-to-Rent Ratio (Median): ${revenueToRentRatio.toFixed(2)}x ${revenueToRentRatio >= 2.5 ? '✓ ABOVE 2.5x threshold' : revenueToRentRatio >= 2.0 ? '~ MARGINAL' : '⚠ BELOW 2.0x threshold'}
- Revenue-to-Rent Ratio (Top 25%): ${top25Ratio.toFixed(2)}x
- Qualification Rate: ${qualificationRate.toFixed(1)}% of competitors meet 2x threshold (${competitorsMeetingThreshold}/${competitors.length})
- Revenue Gap to Top Performer: $${revenueGapToTop.toLocaleString()} between median and top
- Seasonal Revenue Swing: ${seasonalSwing.toFixed(0)}% difference between peak and off-season

MARKET CONTEXT:
- Market: ${market.name}
- Average Occupancy: ${formatOccupancy(market.occupancy)}%
- Average Daily Rate: $${market.adr}
- Average Annual Revenue: $${market.revenue.toLocaleString()}
- Active Listings: ${market.active_listings.toLocaleString()} (competition density)

REVENUE PERCENTILES (${property.bedrooms}BR properties):
- Top 10% (Optimistic): $${percentiles.top_10_percent.toLocaleString()}/year
- Top 25% (Realistic): $${percentiles.top_25_percent.toLocaleString()}/year  
- Median (Conservative): $${percentiles.median.toLocaleString()}/year
- Percentile Spread: $${(percentiles.top_10_percent - percentiles.median).toLocaleString()} between median and top 10%

COMPETITOR ANALYSIS:
${competitors.slice(0, 5).map((c, i) => `${i + 1}. "${c.name}"
   Revenue: $${c.annual_revenue.toLocaleString()}/yr | Occupancy: ${formatOccupancy(c.occupancy)}% | ADR: $${c.adr}
   Rating: ${c.rating || 'N/A'}★ (${c.reviews} reviews) | Success Factor: ${c.success_factor}`).join('\n')}
- Average Competitor Rating: ${avgCompetitorRating.toFixed(1)}★
- Average Competitor Reviews: ${Math.round(avgCompetitorReviews)}
- Average Competitor ADR: $${avgCompetitorADR.toFixed(0)}

SEASONALITY BREAKDOWN:
${(seasonality || []).map(s => `${s.month}: $${s.revenue.toLocaleString()} revenue, ${formatOccupancy(s.occupancy)}% occ, $${s.adr} ADR (${s.season_type.toUpperCase()})`).join('\n') || 'No seasonality data available'}
- Peak Season Avg: $${peakSeasonRevenue.toLocaleString()}/month
- Off-Season Avg: $${offSeasonRevenue.toLocaleString()}/month

GENERATE 5 INSIGHTS - EACH MUST ANSWER ONE OF THESE QUESTIONS:

1. PROFITABILITY INSIGHT: With a ${revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio and ${qualificationRate.toFixed(0)}% qualification rate, what is the realistic probability of profitability? What specific performance level is needed?

2. COMPETITIVE POSITION INSIGHT: The top performer earns $${topCompetitorRevenue.toLocaleString()}/yr while median is $${percentiles.median.toLocaleString()}/yr. What specific strategies do the top 3 competitors use that this property should replicate?

3. PRICING OPPORTUNITY INSIGHT: With ${seasonalSwing.toFixed(0)}% seasonal swing and $${market.adr} market ADR, what specific pricing strategy would maximize revenue? Should this property price above or below market?

4. REVIEW STRATEGY INSIGHT: Top competitors average ${avgCompetitorRating.toFixed(1)}★ with ${Math.round(avgCompetitorReviews)} reviews. How many reviews are needed to compete? At what booking rate, how long will this take?

5. RISK/OPPORTUNITY INSIGHT: With ${market.active_listings.toLocaleString()} active listings and ${formatOccupancy(market.occupancy)}% market occupancy, what is the biggest risk and the single best opportunity to exploit?

JSON FORMAT:
[
  {
    "title": "Brief title (5-7 words)",
    "insight": "Specific insight with NUMBERS from the data (2-3 sentences). MUST reference specific metrics.",
    "impact": "High/Medium/Low",
    "action": "Specific, actionable step with target numbers (1 sentence)"
  }
]

CRITICAL REQUIREMENTS:
- EVERY insight must include specific numbers from the data above
- NO generic advice - everything must be calculated from this property's data
- Compare to specific competitors by name when relevant
- Include dollar amounts, percentages, and timeframes in actions

Generate exactly 5 insights.`;

  const insightsSchema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Brief title (5-7 words)' },
        insight: { type: 'string', description: 'Specific insight with numbers from the data (2-3 sentences)' },
        impact: { type: 'string', enum: ['High', 'Medium', 'Low'] },
        action: { type: 'string', description: 'Specific actionable step with target numbers' }
      },
      required: ['title', 'insight', 'impact', 'action']
    }
  };

  try {
    const response = await callGemini({
      prompt,
      systemInstruction: 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. Generate unique, data-driven insights specific to each property. Every insight must include specific numbers from the provided data. Use the story-before-the-stats approach. Never give generic advice.',
      responseSchema: insightsSchema
    });
    return JSON.parse(response);
  } catch (error) {
    console.error('[GeminiAnalyzer] Error synthesizing insights:', error);
    // Return default insights on error
    return [
      {
        title: "Revenue Potential Assessment",
        insight: `This ${property.bedrooms}BR property in ${market.name} has median revenue of $${percentiles.median.toLocaleString()}/year. With your rent of $${property.monthly_rent.toLocaleString()}/month, you need at least $${(property.monthly_rent * 24).toLocaleString()}/year to hit the 2x rule.`,
        impact: "High",
        action: "Focus on reaching Top 25% performance ($" + percentiles.top_25_percent.toLocaleString() + "/year) through professional photos and optimized pricing."
      }
    ];
  }
}

/**
 * Analyze competitor patterns to identify what makes winners win
 */
export async function analyzeCompetitorPatterns(
  competitors: CompetitorData[],
  property: PropertyData
): Promise<CompetitorPattern[]> {
  // Pre-calculate statistical patterns
  const avgRevenue = competitors.reduce((sum, c) => sum + c.annual_revenue, 0) / Math.max(1, competitors.length);
  const avgADR = competitors.reduce((sum, c) => sum + c.adr, 0) / Math.max(1, competitors.length);
  const avgOccupancy = competitors.reduce((sum, c) => sum + normalizeOccupancy(c.occupancy), 0) / Math.max(1, competitors.length);
  const avgRating = competitors.filter(c => c.rating).reduce((sum, c) => sum + (c.rating || 0), 0) / Math.max(1, competitors.filter(c => c.rating).length);
  const avgReviews = competitors.reduce((sum, c) => sum + c.reviews, 0) / Math.max(1, competitors.length);
  
  // Identify strategy segments
  const highADRCompetitors = competitors.filter(c => c.adr > avgADR * 1.1);
  const highOccCompetitors = competitors.filter(c => normalizeOccupancy(c.occupancy) > avgOccupancy * 1.1);
  const highRatingCompetitors = competitors.filter(c => c.rating && c.rating >= 4.8);
  const highReviewCompetitors = competitors.filter(c => c.reviews > avgReviews * 1.5);
  
  // Top vs bottom analysis
  const top3 = competitors.slice(0, 3);
  const bottom3 = competitors.slice(-3);
  const top3AvgRevenue = top3.reduce((sum, c) => sum + c.annual_revenue, 0) / 3;
  const bottom3AvgRevenue = bottom3.reduce((sum, c) => sum + c.annual_revenue, 0) / 3;
  const revenueSpread = bottom3AvgRevenue > 0 ? ((top3AvgRevenue - bottom3AvgRevenue) / bottom3AvgRevenue * 100) : 0;
  const top3AvgADR = top3.reduce((sum, c) => sum + c.adr, 0) / 3;
  const top3AvgOcc = top3.reduce((sum, c) => sum + normalizeOccupancy(c.occupancy), 0) / 3;

  const prompt = `You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. Identify QUANTIFIED PATTERNS from this competition data.

COMPETITOR DATA (${competitors.length} listings, sorted by revenue):
${competitors.map((c, i) => `
${i + 1}. "${c.name}"
   Revenue: $${c.annual_revenue.toLocaleString()}/yr (${((c.annual_revenue / avgRevenue - 1) * 100).toFixed(0)}% vs avg)
   ADR: $${c.adr}/night (${((c.adr / avgADR - 1) * 100).toFixed(0)}% vs avg)
   Occupancy: ${formatOccupancy(c.occupancy)}%
   Rating: ${c.rating || 'N/A'}★ | Reviews: ${c.reviews}
   Success Factor: ${c.success_factor}`).join('')}

PRE-CALCULATED STATISTICS:
- Average Revenue: $${avgRevenue.toLocaleString()}/yr
- Average ADR: $${Math.round(avgADR)}/night
- Average Occupancy: ${avgOccupancy.toFixed(1)}%
- Average Rating: ${avgRating.toFixed(2)}★
- Average Reviews: ${Math.round(avgReviews)}
- Top 3 vs Bottom 3 Revenue Gap: ${revenueSpread.toFixed(0)}%
- High ADR Strategy (>10% above avg): ${highADRCompetitors.length}/${competitors.length} competitors
- High Occupancy Strategy (>10% above avg): ${highOccCompetitors.length}/${competitors.length} competitors
- Premium Rating (4.8+): ${highRatingCompetitors.length}/${competitors.length} competitors
- High Review Count (>1.5x avg): ${highReviewCompetitors.length}/${competitors.length} competitors
- Top 3 Average ADR: $${Math.round(top3AvgADR)}/night
- Top 3 Average Occupancy: ${top3AvgOcc.toFixed(1)}%

SUBJECT PROPERTY:
- ${property.bedrooms}BR/${property.bathrooms}BA at $${property.monthly_rent}/month rent
- Minimum Revenue Needed: $${(property.monthly_rent * 24).toLocaleString()}/yr (2x rule)

IDENTIFY 5 PATTERNS - EACH MUST BE QUANTIFIED:

1. PRICING STRATEGY: Do top earners use high ADR (${highADRCompetitors.length} listings) or high occupancy (${highOccCompetitors.length} listings)? What's the optimal balance?

2. RATING/REVIEW CORRELATION: ${highRatingCompetitors.length} have 4.8+ ratings. What rating threshold correlates with top revenue?

3. NAMING/BRANDING: Analyze listing names. What keywords appear in top performers vs bottom performers?

4. REVENUE DISTRIBUTION: Top 3 earn ${revenueSpread.toFixed(0)}% more than bottom 3. What separates them?

5. SUCCESS FACTOR THEMES: What common themes emerge in the "Success Factor" field?

JSON FORMAT:
[
  {
    "pattern": "Specific pattern with data (e.g., 'Premium ADR Strategy: $${Math.round(top3AvgADR)} avg among top 3')",
    "frequency": "X of ${competitors.length} top performers (X%)",
    "revenue_impact": "Quantified impact (e.g., '+$X,XXX/yr' or '+XX% revenue')",
    "recommendation": "Specific action for subject property with target numbers"
  }
]

CRITICAL: Every pattern MUST include specific numbers. No generic observations.`;

  const patternsSchema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Specific pattern with data and numbers' },
        frequency: { type: 'string', description: 'How many top performers exhibit this pattern' },
        revenue_impact: { type: 'string', description: 'Quantified revenue impact' },
        recommendation: { type: 'string', description: 'Specific action for subject property with target numbers' }
      },
      required: ['pattern', 'frequency', 'revenue_impact', 'recommendation']
    }
  };

  try {
    const response = await callGemini({
      prompt,
      systemInstruction: 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. Identify quantified patterns from competitor data. Every pattern must include specific numbers from the data provided. Use analogy over jargon. Never give generic observations.',
      responseSchema: patternsSchema
    });
    return JSON.parse(response);
  } catch (error) {
    console.error('[GeminiAnalyzer] Error analyzing patterns:', error);
    return [];
  }
}

/**
 * Generate investment verdict with confidence score
 */
export async function generateInvestmentVerdict(
  property: PropertyData,
  market: MarketData,
  competitors: CompetitorData[],
  percentiles: PercentileData,
  profitability: { conservative: number; realistic: number; optimistic: number }
): Promise<InvestmentVerdict> {
  const minimumRevenue = property.monthly_rent * 24;
  const annualRent = property.monthly_rent * 12;
  const competitorsList = competitors || [];
  const viableCompetitors = competitorsList.filter(c => c.annual_revenue >= minimumRevenue);
  
  // Calculate comprehensive scoring metrics
  const qualificationRate = competitorsList.length > 0 ? (viableCompetitors.length / competitorsList.length) * 100 : 0;
  const revenueToRentMedian = percentiles.median / annualRent;
  const revenueToRentTop25 = percentiles.top_25_percent / annualRent;
  const revenueToRentTop10 = percentiles.top_10_percent / annualRent;
  const marketOccupancy = normalizeOccupancy(market.occupancy);
  
  // Break-even calculations
  const monthlyExpenses = property.monthly_rent * 1.3; // Rent + ~30% operating costs
  const breakEvenOccupancy = market.adr > 0 ? ((monthlyExpenses * 12) / (market.adr * 365)) * 100 : 100;
  const cushionAboveBreakeven = marketOccupancy - breakEvenOccupancy;
  
  // Profit margins
  const profitMarginConservative = percentiles.median > 0 ? (profitability.conservative / percentiles.median) * 100 : 0;
  const profitMarginRealistic = percentiles.top_25_percent > 0 ? (profitability.realistic / percentiles.top_25_percent) * 100 : 0;
  
  // Score each factor (0-10 scale)
  const qualificationScore = qualificationRate >= 50 ? 10 : qualificationRate >= 30 ? 7 : qualificationRate >= 15 ? 4 : 1;
  const revenueRatioScore = revenueToRentTop25 >= 3.0 ? 10 : revenueToRentTop25 >= 2.5 ? 8 : revenueToRentTop25 >= 2.0 ? 5 : 2;
  const occupancyScore = marketOccupancy >= 70 ? 10 : marketOccupancy >= 55 ? 7 : marketOccupancy >= 40 ? 4 : 1;
  const profitScore = profitability.realistic >= 30000 ? 10 : profitability.realistic >= 15000 ? 7 : profitability.realistic >= 5000 ? 4 : 1;
  const compositeScore = (qualificationScore + revenueRatioScore + occupancyScore + profitScore) / 4;
  
  // Downside scenario calculation
  const occupancyDrop20 = marketOccupancy * 0.8;
  const revenueAtLowerOcc = market.adr * 365 * (occupancyDrop20 / 100);
  const monthlyLossAt20Drop = (monthlyExpenses * 12) - revenueAtLowerOcc;
  
  const prompt = `You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. Provide a QUANTIFIED investment verdict.

PROPERTY FUNDAMENTALS:
- Address: ${property.address}
- Configuration: ${property.bedrooms}BR/${property.bathrooms}BA
- Monthly Rent: $${property.monthly_rent.toLocaleString()}
- Annual Rent: $${annualRent.toLocaleString()}
- Minimum Revenue Needed (2x rule): $${minimumRevenue.toLocaleString()}/year

KEY DECISION METRICS (PRE-CALCULATED):
- Revenue-to-Rent Ratio (Median): ${revenueToRentMedian.toFixed(2)}x ${revenueToRentMedian >= 2.0 ? '✓' : '✗'}
- Revenue-to-Rent Ratio (Top 25%): ${revenueToRentTop25.toFixed(2)}x ${revenueToRentTop25 >= 2.5 ? '✓ STRONG' : revenueToRentTop25 >= 2.0 ? '~ MARGINAL' : '✗ WEAK'}
- Revenue-to-Rent Ratio (Top 10%): ${revenueToRentTop10.toFixed(2)}x
- Qualification Rate: ${qualificationRate.toFixed(1)}% (${viableCompetitors.length}/${competitorsList.length} meet 2x threshold)
- Break-Even Occupancy: ${breakEvenOccupancy.toFixed(1)}%
- Market Occupancy: ${marketOccupancy.toFixed(1)}%
- Cushion Above Break-Even: ${cushionAboveBreakeven.toFixed(1)} points ${cushionAboveBreakeven >= 15 ? '✓ SAFE' : cushionAboveBreakeven >= 5 ? '~ TIGHT' : '✗ RISKY'}

SCORING BREAKDOWN (0-10 scale):
- Qualification Score: ${qualificationScore}/10 (${qualificationRate.toFixed(0)}% profitable)
- Revenue Ratio Score: ${revenueRatioScore}/10 (${revenueToRentTop25.toFixed(2)}x at Top 25%)
- Occupancy Score: ${occupancyScore}/10 (${marketOccupancy.toFixed(0)}% market occ)
- Profit Score: ${profitScore}/10 ($${profitability.realistic.toLocaleString()} realistic)
- COMPOSITE SCORE: ${compositeScore.toFixed(1)}/10

MARKET CONTEXT:
- Market: ${market.name}
- Active Listings: ${market.active_listings.toLocaleString()}
- Market ADR: $${market.adr}

REVENUE PERCENTILES (${property.bedrooms}BR):
- Top 10%: $${percentiles.top_10_percent.toLocaleString()}/year
- Top 25%: $${percentiles.top_25_percent.toLocaleString()}/year
- Median: $${percentiles.median.toLocaleString()}/year

PROFIT PROJECTIONS:
- Conservative: $${profitability.conservative.toLocaleString()}/year (${profitMarginConservative.toFixed(0)}% margin)
- Realistic: $${profitability.realistic.toLocaleString()}/year (${profitMarginRealistic.toFixed(0)}% margin)
- Optimistic: $${profitability.optimistic.toLocaleString()}/year

DOWNSIDE SCENARIO:
- If occupancy drops 20% (to ${occupancyDrop20.toFixed(0)}%): ${monthlyLossAt20Drop > 0 ? 'LOSS of $' + Math.round(monthlyLossAt20Drop).toLocaleString() + '/year' : 'Still profitable'}

VERDICT DECISION FRAMEWORK:

GO (Composite ≥7):
✓ Qualification rate ≥30%
✓ Revenue-to-rent (Top 25%) ≥2.5x
✓ Cushion above break-even ≥10 points
✓ Realistic profit ≥$15,000/year

CAUTION (Composite 4-7):
~ Qualification rate 15-30%
~ Revenue-to-rent 2.0-2.5x
~ Tight margins requiring top-quartile performance

PASS (Composite <4):
✗ Qualification rate <15%
✗ Revenue-to-rent <2.0x
✗ Negative conservative profit

Based on composite score of ${compositeScore.toFixed(1)}/10:

{
  "rating": "GO" or "CAUTION" or "PASS",
  "confidence": <1-10, align with composite score>,
  "summary": "2-3 sentences with SPECIFIC NUMBERS from above",
  "top_reasons": [
    "Reason with specific metric (e.g., '${qualificationRate.toFixed(0)}% qualification rate...')",
    "Reason with specific metric",
    "Reason with specific metric"
  ],
  "key_risk": "Quantified risk (e.g., 'If occupancy drops 20%, annual loss of $X')",
  "key_opportunity": "Quantified opportunity (e.g., 'Reaching top 25% adds $X/year')"
}

Provide your verdict based on the composite score and data above.`;

  const verdictSchema = {
    type: 'object',
    properties: {
      rating: { type: 'string', enum: ['GO', 'CAUTION', 'PASS'] },
      confidence: { type: 'integer', description: 'Confidence score 1-10 aligned with composite score' },
      summary: { type: 'string', description: '2-3 sentences with specific numbers from the data' },
      top_reasons: {
        type: 'array',
        items: { type: 'string', description: 'Reason with specific metric' }
      },
      key_risk: { type: 'string', description: 'Quantified risk with dollar amounts' },
      key_opportunity: { type: 'string', description: 'Quantified opportunity with dollar amounts' }
    },
    required: ['rating', 'confidence', 'summary', 'top_reasons', 'key_risk', 'key_opportunity']
  };

  try {
    const response = await callGemini({
      prompt,
      systemInstruction: 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. Provide quantified investment verdicts based strictly on the data provided. Every statement must include specific numbers. Use the story-before-the-stats approach. Align your rating with the composite score: 7+ = GO, 4-7 = CAUTION, below 4 = PASS.',
      responseSchema: verdictSchema
    });
    return JSON.parse(response);
  } catch (error) {
    console.error('[GeminiAnalyzer] Error generating verdict:', error);
    // Return default verdict based on numbers
    const medianProfit = profitability.conservative;
    let rating: 'GO' | 'CAUTION' | 'PASS' = 'CAUTION';
    let confidence = 5;
    
    if (medianProfit > 25000) { rating = 'GO'; confidence = 8; }
    else if (medianProfit > 0) { rating = 'CAUTION'; confidence = 6; }
    else { rating = 'PASS'; confidence = 7; }
    
    return {
      rating,
      confidence,
      summary: `Based on the numbers, this lease shows ${rating === 'PASS' ? 'unfavorable' : rating === 'CAUTION' ? 'marginal' : 'strong'} profit potential with a conservative estimate of $${medianProfit.toLocaleString()}/year.`,
      top_reasons: [
        `${viableCompetitors.length} competitors prove the 2x revenue threshold is achievable`,
        `Market occupancy of ${formatOccupancy(market.occupancy)}% indicates ${normalizeOccupancy(market.occupancy) > 60 ? 'healthy' : 'moderate'} demand`,
        `Top 25% revenue of $${percentiles.top_25_percent.toLocaleString()} provides upside potential`
      ],
      key_risk: "Market saturation with " + market.active_listings.toLocaleString() + " active listings",
      key_opportunity: "Professional management could push revenue into Top 25% ($" + percentiles.top_25_percent.toLocaleString() + "/year)"
    };
  }
}

/**
 * Generate pricing strategy recommendations
 */
export async function generatePricingStrategy(
  property: PropertyData,
  market: MarketData,
  competitors: CompetitorData[],
  seasonality: SeasonalityData[]
): Promise<PricingStrategy> {
  const seasonalityData = seasonality || [];
  const competitorsList = competitors || [];
  const peakMonths = seasonalityData.filter(s => s.season_type === 'peak');
  const slowMonths = seasonalityData.filter(s => s.season_type === 'off');
  const shoulderMonths = seasonalityData.filter(s => s.season_type === 'shoulder');
  
  // Detailed seasonality calculations
  const avgPeakADR = peakMonths.length > 0 ? peakMonths.reduce((sum, m) => sum + m.adr, 0) / peakMonths.length : market.adr;
  const avgSlowADR = slowMonths.length > 0 ? slowMonths.reduce((sum, m) => sum + m.adr, 0) / slowMonths.length : market.adr * 0.8;
  const avgShoulderADR = shoulderMonths.length > 0 ? shoulderMonths.reduce((sum, m) => sum + m.adr, 0) / shoulderMonths.length : market.adr * 0.9;
  const seasonalSwing = avgSlowADR > 0 ? ((avgPeakADR - avgSlowADR) / avgSlowADR * 100) : 0;
  
  // Competitor pricing analysis
  const competitorADRs = competitorsList.map(c => c.adr).filter(a => a > 0).sort((a, b) => a - b);
  const minCompetitorADR = competitorADRs[0] || market.adr * 0.7;
  const maxCompetitorADR = competitorADRs[competitorADRs.length - 1] || market.adr * 1.3;
  const medianCompetitorADR = competitorADRs[Math.floor(competitorADRs.length / 2)] || market.adr;
  const avgCompetitorADR = competitorADRs.reduce((a, b) => a + b, 0) / Math.max(1, competitorADRs.length);
  
  // Occupancy and strategy analysis
  const avgCompetitorOccupancy = competitorsList.reduce((sum, c) => sum + normalizeOccupancy(c.occupancy), 0) / Math.max(1, competitorsList.length);
  const marketOccupancy = normalizeOccupancy(market.occupancy);
  const highADRCompetitors = competitorsList.filter(c => c.adr > avgCompetitorADR * 1.1);
  const highOccCompetitors = competitorsList.filter(c => normalizeOccupancy(c.occupancy) > avgCompetitorOccupancy * 1.1);
  const topRevenueStrategy = highADRCompetitors.length > highOccCompetitors.length ? 'HIGH_ADR' : 'HIGH_OCCUPANCY';
  
  // Break-even and revenue calculations
  const monthlyExpenses = property.monthly_rent * 1.3;
  const breakEvenADR = marketOccupancy > 0 ? (monthlyExpenses * 12) / (365 * (marketOccupancy / 100)) : market.adr;
  const targetOccupancy = marketOccupancy / 100;
  const revenueAtMarketADR = market.adr * 365 * targetOccupancy;
  const revenueAt10Above = market.adr * 1.1 * 365 * (targetOccupancy * 0.95);
  const revenueAt10Below = market.adr * 0.9 * 365 * (targetOccupancy * 1.05);
  const optimalStrategy = revenueAt10Above > revenueAtMarketADR ? 'PREMIUM' : 'VOLUME';
  
  const prompt = `You are a dynamic pricing expert for Airbnb. Create a DATA-DRIVEN pricing strategy.

PROPERTY CONTEXT:
- Configuration: ${property.bedrooms}BR/${property.bathrooms}BA in ${market.name}
- Monthly Rent: $${property.monthly_rent.toLocaleString()}
- Monthly Expenses (est): $${Math.round(monthlyExpenses).toLocaleString()}
- Break-Even ADR: $${breakEvenADR.toFixed(0)}/night (at ${marketOccupancy.toFixed(0)}% occupancy)

MARKET PRICING DATA:
- Market Average ADR: $${market.adr}
- Market Occupancy: ${marketOccupancy.toFixed(1)}%
- Competitor ADR Range: $${minCompetitorADR.toFixed(0)} - $${maxCompetitorADR.toFixed(0)}
- Competitor Median ADR: $${medianCompetitorADR.toFixed(0)}
- Competitor Average ADR: $${avgCompetitorADR.toFixed(0)}

COMPETITOR BREAKDOWN:
${competitorsList.slice(0, 7).map((c, i) => `${i + 1}. "${c.name}"
   ADR: $${c.adr} (${((c.adr / avgCompetitorADR - 1) * 100).toFixed(0)}% vs avg)
   Occupancy: ${formatOccupancy(c.occupancy)}%
   Revenue: $${c.annual_revenue.toLocaleString()}/yr
   Strategy: ${c.adr > avgCompetitorADR * 1.1 ? 'PREMIUM' : c.adr < avgCompetitorADR * 0.9 ? 'VALUE' : 'MID-MARKET'}`).join('\n')}

WINNING STRATEGY ANALYSIS:
- High ADR Competitors (>10% above avg): ${highADRCompetitors.length}/${competitorsList.length}
- High Occupancy Competitors (>10% above avg): ${highOccCompetitors.length}/${competitorsList.length}
- Top Revenue Strategy in Market: ${topRevenueStrategy}

SEASONALITY ANALYSIS:
- Peak Season: ${peakMonths.map(m => m.month).join(', ') || 'N/A'}
  Average ADR: $${avgPeakADR.toFixed(0)} | Swing: +${seasonalSwing.toFixed(0)}% vs slow
- Shoulder Season: ${shoulderMonths.map(m => m.month).join(', ') || 'N/A'}
  Average ADR: $${avgShoulderADR.toFixed(0)}
- Slow Season: ${slowMonths.map(m => m.month).join(', ') || 'N/A'}
  Average ADR: $${avgSlowADR.toFixed(0)}

REVENUE SCENARIOS (at ${marketOccupancy.toFixed(0)}% base occupancy):
- At Market ADR ($${market.adr}): $${revenueAtMarketADR.toLocaleString()}/yr
- At +10% Premium ($${(market.adr * 1.1).toFixed(0)}): $${revenueAt10Above.toLocaleString()}/yr (assumes 5% occ drop)
- At -10% Discount ($${(market.adr * 0.9).toFixed(0)}): $${revenueAt10Below.toLocaleString()}/yr (assumes 5% occ gain)
- OPTIMAL STRATEGY: ${optimalStrategy} pricing ${optimalStrategy === 'PREMIUM' ? 'wins (+$' + Math.round(revenueAt10Above - revenueAtMarketADR).toLocaleString() + '/yr)' : 'wins (+$' + Math.round(revenueAt10Below - revenueAtMarketADR).toLocaleString() + '/yr)'}

PRICING STRATEGY REQUIREMENTS:

1. BASE RATE: Position ${topRevenueStrategy === 'HIGH_ADR' ? 'at or above' : 'at or slightly below'} competitor median ($${medianCompetitorADR.toFixed(0)})

2. PEAK PREMIUM: Based on ${seasonalSwing.toFixed(0)}% seasonal swing

3. SLOW DISCOUNT: Calculate discount to maintain occupancy

4. WEEKEND PREMIUM: Market typically supports 10-25%

5. MINIMUM STAY: Balance booking frequency vs operational costs

Generate pricing strategy:
{
  "base_rate": <your recommended base rate>,
  "peak_premium_percent": <% increase for peak>,
  "slow_discount_percent": <% decrease for slow>,
  "weekend_premium_percent": <% increase for Fri-Sat>,
  "minimum_stay_peak": <min nights in peak>,
  "minimum_stay_slow": <min nights in slow>,
  "pricing_rationale": "3-4 sentences: (1) positioning vs competitors, (2) expected revenue impact, (3) seasonal adjustments"
}

Generate the pricing strategy based on the data above.`;

  const pricingSchema = {
    type: 'object',
    properties: {
      base_rate: { type: 'integer', description: 'Recommended base nightly rate in dollars' },
      peak_premium_percent: { type: 'integer', description: 'Percentage increase for peak season' },
      slow_discount_percent: { type: 'integer', description: 'Percentage decrease for slow season' },
      weekend_premium_percent: { type: 'integer', description: 'Percentage increase for Fri-Sat' },
      minimum_stay_peak: { type: 'integer', description: 'Minimum nights in peak season' },
      minimum_stay_slow: { type: 'integer', description: 'Minimum nights in slow season' },
      pricing_rationale: { type: 'string', description: '3-4 sentences covering positioning vs competitors, expected revenue impact, and seasonal adjustments' }
    },
    required: ['base_rate', 'peak_premium_percent', 'slow_discount_percent', 'weekend_premium_percent', 'minimum_stay_peak', 'minimum_stay_slow', 'pricing_rationale']
  };

  try {
    const response = await callGemini({
      prompt,
      systemInstruction: 'You are a dynamic pricing expert for Airbnb short-term rentals. Create data-driven pricing strategies based strictly on the market data, competitor analysis, and seasonality patterns provided. All recommendations must be backed by specific numbers.',
      responseSchema: pricingSchema
    });
    return JSON.parse(response);
  } catch (error) {
    console.error('[GeminiAnalyzer] Error generating pricing:', error);
    // Return calculated defaults
    const competitorADRs = competitors.map(c => c.adr).filter(a => a > 0);
    const avgCompetitorADR = competitorADRs.length > 0 
      ? competitorADRs.reduce((a, b) => a + b, 0) / competitorADRs.length 
      : market.adr;
    
    return {
      base_rate: Math.round(avgCompetitorADR * 0.95), // Slightly below average to start
      peak_premium_percent: 25,
      slow_discount_percent: 15,
      weekend_premium_percent: 10,
      minimum_stay_peak: 2,
      minimum_stay_slow: 3,
      pricing_rationale: `Base rate set at $${Math.round(avgCompetitorADR * 0.95)}/night (slightly below competitor average of $${Math.round(avgCompetitorADR)}) to build reviews quickly. Increase by 25% during peak season and add 10% weekend premium.`
    };
  }
}

/**
 * Analyze listing photos using AI Vision
 */
export async function analyzeListingPhoto(imageUrl: string, listingName: string): Promise<PhotoAnalysis> {
  const { invokeLLM } = await import('./_core/llm');
  
  const prompt = `You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. You also have deep expertise in listing photography and interior design. Analyze this listing photo and provide insights.

This photo is from the listing: "${listingName}"

Analyze the photo and provide your assessment in this JSON format:
{
  "design_theme": "Modern/Cozy/Luxury/Rustic/Minimalist/Eclectic/etc.",
  "quality_score": 1-10,
  "amenities_visible": ["List of amenities you can see in the photo"],
  "strengths": ["What makes this photo effective for bookings"],
  "improvements": ["What could be improved"],
  "guest_appeal": "Who would this appeal to (families, couples, business travelers, etc.)"
}

Consider:
- Lighting quality and staging
- Cleanliness and organization
- Unique features that stand out
- Professional vs amateur photography
- What emotions/feelings the space evokes

Return ONLY the JSON object, no other text.`;

  try {
    console.log(`[GeminiAnalyzer] Analyzing photo via AI: ${listingName}`);
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. You also have deep expertise in listing photography and interior design. Analyze listing photos and provide actionable insights. Always respond in valid JSON format.' },
        { role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ] }
      ],
    });
    const text = String(response.choices?.[0]?.message?.content || '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse photo analysis JSON');
  } catch (error) {
    console.error('[GeminiAnalyzer] Error analyzing photo:', error);
    return {
      design_theme: "Unable to analyze",
      quality_score: 0,
      amenities_visible: [],
      strengths: [],
      improvements: ["Could not analyze this image"],
      guest_appeal: "Unknown"
    };
  }
}

/**
 * Analyze multiple competitor photos to identify design patterns
 */
export async function analyzeCompetitorPhotos(
  competitors: Array<{ name: string; imageUrl: string; revenue: number }>
): Promise<{
  common_themes: string[];
  design_recommendations: string[];
  must_have_shots: string[];
  differentiation_opportunities: string[];
}> {
  // Analyze top 3 competitor photos
  const analyses: PhotoAnalysis[] = [];
  
  for (const comp of competitors.slice(0, 3)) {
    if (comp.imageUrl) {
      try {
        const analysis = await analyzeListingPhoto(comp.imageUrl, comp.name);
        analyses.push(analysis);
      } catch (error) {
        console.error(`[GeminiAnalyzer] Error analyzing photo for ${comp.name}:`, error);
      }
    }
  }
  
  if (analyses.length === 0) {
    return {
      common_themes: ["Unable to analyze competitor photos"],
      design_recommendations: ["Ensure you have high-quality professional photos"],
      must_have_shots: ["Living room", "Kitchen", "Bedrooms", "Bathrooms", "Outdoor space"],
      differentiation_opportunities: ["Focus on unique features of your property"]
    };
  }
  
  // Synthesize findings
  const themes = analyses.map(a => a.design_theme);
  const allAmenities = analyses.flatMap(a => a.amenities_visible);
  const allStrengths = analyses.flatMap(a => a.strengths);
  
  return {
    common_themes: Array.from(new Set(themes)),
    design_recommendations: Array.from(new Set(allStrengths)).slice(0, 5),
    must_have_shots: ["Hero living room shot", "Kitchen with staging", "Each bedroom", "Clean bathroom", "Outdoor/patio area"],
    differentiation_opportunities: analyses.flatMap(a => a.improvements).slice(0, 3)
  };
}

/**
 * Generate comprehensive risk assessment
 */
export async function assessRisks(
  property: PropertyData,
  market: MarketData,
  competitors: CompetitorData[],
  seasonality: SeasonalityData[]
): Promise<RiskAssessment> {
  const seasonalityData = seasonality || [];
  const competitorsList = competitors || [];
  const slowMonths = seasonalityData.filter(s => s.season_type === 'off');
  const peakMonths = seasonalityData.filter(s => s.season_type === 'peak');
  
  // Calculate detailed risk metrics
  const avgPeakRevenue = peakMonths.length > 0 ? peakMonths.reduce((sum, m) => sum + m.revenue, 0) / peakMonths.length : 0;
  const avgSlowRevenue = slowMonths.length > 0 ? slowMonths.reduce((sum, m) => sum + m.revenue, 0) / slowMonths.length : 0;
  const seasonalityVariance = avgPeakRevenue > 0 && avgSlowRevenue > 0 ? ((avgPeakRevenue - avgSlowRevenue) / avgPeakRevenue) : 0;
  
  // Financial risk calculations
  const monthlyExpenses = property.monthly_rent * 1.3;
  const annualExpenses = monthlyExpenses * 12;
  const marketOccupancy = normalizeOccupancy(market.occupancy);
  const expectedRevenue = market.adr * 365 * (marketOccupancy / 100);
  const breakEvenOccupancy = market.adr > 0 ? (annualExpenses / (market.adr * 365)) * 100 : 100;
  const cushionAboveBreakeven = marketOccupancy - breakEvenOccupancy;
  
  // Downside scenarios
  const revenueAt20PercentOccDrop = market.adr * 365 * ((marketOccupancy * 0.8) / 100);
  const lossAt20PercentDrop = annualExpenses - revenueAt20PercentOccDrop;
  const monthsOfSlowSeason = slowMonths.length;
  const slowSeasonCashNeeded = monthsOfSlowSeason * (monthlyExpenses - (avgSlowRevenue || monthlyExpenses * 0.5));
  
  // Competition risk
  const listingsPerThousandRevenue = market.revenue > 0 ? (market.active_listings / (market.revenue / 1000)) : 0;
  const competitorDensity = market.active_listings > 5000 ? 'HIGH' : market.active_listings > 2000 ? 'MEDIUM' : 'LOW';
  
  // Calculate minimum viable revenue
  const minimumRevenue = property.monthly_rent * 24;
  const viableCompetitors = competitorsList.filter(c => c.annual_revenue >= minimumRevenue);
  const qualificationRate = competitorsList.length > 0 ? (viableCompetitors.length / competitorsList.length) * 100 : 0;
  
  // Risk scoring (0-10, higher = more risky)
  const seasonalityRiskScore = seasonalityVariance > 0.5 ? 9 : seasonalityVariance > 0.3 ? 6 : 3;
  const competitionRiskScore = market.active_listings > 5000 ? 8 : market.active_listings > 2000 ? 5 : 2;
  const financialRiskScore = cushionAboveBreakeven < 5 ? 9 : cushionAboveBreakeven < 15 ? 5 : 2;
  const qualificationRiskScore = qualificationRate < 20 ? 9 : qualificationRate < 40 ? 5 : 2;
  const compositeRiskScore = (seasonalityRiskScore + competitionRiskScore + financialRiskScore + qualificationRiskScore) / 4;
  
  const prompt = `You are a risk analyst for short-term rental investments. Provide a QUANTIFIED risk assessment.

PROPERTY FUNDAMENTALS:
- ${property.bedrooms}BR/${property.bathrooms}BA at $${property.monthly_rent}/month
- Location: ${property.address}
- Annual Expenses (est): $${annualExpenses.toLocaleString()}
- Minimum Revenue Needed (2x): $${minimumRevenue.toLocaleString()}

MARKET RISK METRICS:
- Market: ${market.name}
- Active Listings: ${market.active_listings.toLocaleString()} (${competitorDensity} density)
- Market Occupancy: ${marketOccupancy.toFixed(1)}%
- Market ADR: $${market.adr}
- Expected Revenue: $${expectedRevenue.toLocaleString()}/year

FINANCIAL RISK METRICS:
- Break-Even Occupancy: ${breakEvenOccupancy.toFixed(1)}%
- Cushion Above Break-Even: ${cushionAboveBreakeven.toFixed(1)} points ${cushionAboveBreakeven >= 15 ? '✓ SAFE' : cushionAboveBreakeven >= 5 ? '~ TIGHT' : '✗ RISKY'}
- If Occupancy Drops 20%: ${lossAt20PercentDrop > 0 ? 'LOSS of $' + Math.round(lossAt20PercentDrop).toLocaleString() + '/year' : 'Still profitable'}
- Qualification Rate: ${qualificationRate.toFixed(1)}% of competitors are profitable

SEASONALITY RISK:
- Revenue Variance: ${(seasonalityVariance * 100).toFixed(0)}% between peak and slow
- Slow Months: ${slowMonths.map(m => m.month).join(', ') || 'None identified'} (${monthsOfSlowSeason} months)
- Peak Months: ${peakMonths.map(m => m.month).join(', ') || 'None identified'}
- Avg Peak Revenue: $${avgPeakRevenue.toLocaleString()}/month
- Avg Slow Revenue: $${avgSlowRevenue.toLocaleString()}/month
- Cash Reserves Needed for Slow Season: $${Math.max(0, Math.round(slowSeasonCashNeeded)).toLocaleString()}

RISK SCORING (0-10, higher = riskier):
- Seasonality Risk: ${seasonalityRiskScore}/10 (${(seasonalityVariance * 100).toFixed(0)}% variance)
- Competition Risk: ${competitionRiskScore}/10 (${market.active_listings.toLocaleString()} listings)
- Financial Risk: ${financialRiskScore}/10 (${cushionAboveBreakeven.toFixed(0)} pt cushion)
- Qualification Risk: ${qualificationRiskScore}/10 (${qualificationRate.toFixed(0)}% profitable)
- COMPOSITE RISK SCORE: ${compositeRiskScore.toFixed(1)}/10

COMPETITOR CONTEXT:
- ${competitorsList.length} comparable properties analyzed
- Top earner: $${competitorsList[0]?.annual_revenue.toLocaleString() || 'N/A'}/year
- ${viableCompetitors.length} competitors meet 2x threshold

PROVIDE RISK ASSESSMENT:

{
  "overall_risk": "${compositeRiskScore >= 7 ? 'High' : compositeRiskScore >= 4 ? 'Medium' : 'Low'}",
  "risks": [
    {
      "category": "Market/Financial/Operational/Regulatory",
      "description": "Specific risk with NUMBERS (e.g., '${market.active_listings.toLocaleString()} listings creates...')",
      "severity": "Low/Medium/High",
      "financial_impact": "$X,XXX potential loss or cost",
      "mitigation": "Specific action to reduce this risk"
    }
  ],
  "opportunities": [
    {
      "category": "Market/Pricing/Differentiation/Timing",
      "description": "Specific opportunity with NUMBERS",
      "potential_impact": "+$X,XXX/year or +X% revenue",
      "action": "Specific steps to capture this"
    }
  ]
}

INCLUDE 4 RISKS (one from each category) and 3 OPPORTUNITIES with specific dollar amounts.`;

  const riskSchema = {
    type: 'object',
    properties: {
      overall_risk: { type: 'string', enum: ['Low', 'Medium', 'High'] },
      risks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['Market', 'Financial', 'Operational', 'Regulatory'] },
            description: { type: 'string' },
            severity: { type: 'string', enum: ['Low', 'Medium', 'High'] },
            financial_impact: { type: 'string' },
            mitigation: { type: 'string' }
          },
          required: ['category', 'description', 'severity', 'financial_impact', 'mitigation']
        }
      },
      opportunities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['Market', 'Pricing', 'Differentiation', 'Timing'] },
            description: { type: 'string' },
            potential_impact: { type: 'string' },
            action: { type: 'string' }
          },
          required: ['category', 'description', 'potential_impact', 'action']
        }
      }
    },
    required: ['overall_risk', 'risks', 'opportunities']
  };

  try {
    const response = await callGemini({
      prompt,
      systemInstruction: 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. Assess risks and opportunities using specific numbers from the data provided. Every risk and opportunity must include quantified financial impacts. Never sugarcoat risks but always empower.',
      responseSchema: riskSchema
    });
    return JSON.parse(response);
  } catch (error) {
    console.error('[GeminiAnalyzer] Error assessing risks:', error);
    return {
      overall_risk: 'Medium',
      risks: [
        {
          category: 'Market',
          description: `${market.active_listings.toLocaleString()} active listings creates competitive pressure`,
          severity: market.active_listings > 5000 ? 'High' : 'Medium',
          mitigation: 'Differentiate through professional photos, unique amenities, and competitive pricing'
        },
        {
          category: 'Seasonality',
          description: `${Math.round(seasonalityVariance * 100)}% revenue variance between seasons`,
          severity: seasonalityVariance > 0.4 ? 'High' : 'Medium',
          mitigation: 'Build cash reserves during peak season to cover slow months'
        }
      ],
      opportunities: [
        {
          category: 'Pricing',
          description: 'Dynamic pricing optimization',
          potential_impact: '+15-25% revenue',
          action: 'Use pricing tools like PriceLabs or Wheelhouse'
        }
      ]
    };
  }
}

/**
 * Generate personalized action plan
 */
export async function generateActionPlan(
  property: PropertyData,
  verdict: InvestmentVerdict,
  pricingStrategy: PricingStrategy
): Promise<ActionPlan[]> {
  // Calculate ONLY what we actually know - monthly operating costs
  // We do NOT know startup costs (furniture, photos, supplies vary wildly by situation)
  const monthlyRevenueAtBase = pricingStrategy.base_rate * 30 * 0.6; // 60% occupancy estimate
  const operatingCosts = monthlyRevenueAtBase * 0.20; // 20% of revenue for operating costs
  const monthlyExpenses = property.monthly_rent + operatingCosts;
  const monthlyProfit = monthlyRevenueAtBase - monthlyExpenses;
  
  // Break-even occupancy (what % occupancy needed to cover monthly costs)
  const breakEvenOccupancy = monthlyExpenses / (pricingStrategy.base_rate * 30) * 100;
  
  // Review timeline calculations
  const avgStayLength = 3;
  const bookingsPerMonthAt60Occ = Math.floor((30 * 0.6) / avgStayLength);
  const reviewConversionRate = 0.5; // 50% of guests leave reviews
  const reviewsPerMonth = Math.floor(bookingsPerMonthAt60Occ * reviewConversionRate);
  const monthsTo10Reviews = reviewsPerMonth > 0 ? Math.ceil(10 / reviewsPerMonth) : 3;
  
  const prompt = `You are an Airbnb launch consultant. Create a DETAILED, QUANTIFIED action plan.

PROPERTY DETAILS:
- Configuration: ${property.bedrooms}BR/${property.bathrooms}BA
- Monthly Rent: $${property.monthly_rent.toLocaleString()}
- Investment Verdict: ${verdict.rating} (${verdict.confidence}/10 confidence)
- Key Risk: ${verdict.key_risk}
- Key Opportunity: ${verdict.key_opportunity}

PRICING STRATEGY:
- Base Rate: $${pricingStrategy.base_rate}/night
- Peak Premium: +${pricingStrategy.peak_premium_percent}%
- Slow Discount: -${pricingStrategy.slow_discount_percent}%
- Weekend Premium: +${pricingStrategy.weekend_premium_percent}%
- Minimum Stay: ${pricingStrategy.minimum_stay_peak}-${pricingStrategy.minimum_stay_slow} nights

MONTHLY OPERATING COSTS (what we actually know):
- Monthly Rent: $${property.monthly_rent.toLocaleString()}
- Operating Costs (20% of revenue): $${Math.round(operatingCosts).toLocaleString()}
- Total Monthly Expenses: $${Math.round(monthlyExpenses).toLocaleString()}
- Monthly Revenue (at 60% occ): $${Math.round(monthlyRevenueAtBase).toLocaleString()}
- Monthly Profit (at 60% occ): $${Math.round(monthlyProfit).toLocaleString()}
- Break-Even Occupancy: ${breakEvenOccupancy.toFixed(1)}% (to cover monthly costs)

NOTE: Startup costs (furniture, photos, supplies) are NOT included because they vary wildly.
The investor should determine their own startup budget based on property condition and strategy.

REVIEW TIMELINE:
- Est. Bookings/Month (at 60% occ): ${bookingsPerMonthAt60Occ}
- Est. Reviews/Month (50% conversion): ${reviewsPerMonth}
- Months to 10 Reviews: ${monthsTo10Reviews}

CREATE ACTION PLAN WITH 5 PHASES:

[
  {
    "phase": "Phase Name",
    "timeline": "Week X-Y or Month X",
    "tasks": [
      "Task 1 with specific details and costs",
      "Task 2 with specific details",
      "Task 3 with measurable outcome"
    ],
    "estimated_cost": "$X,XXX (itemized)",
    "expected_outcome": "Specific measurable outcome (e.g., 'Property live with X bookings')",
    "kpis": ["KPI 1 to track", "KPI 2 to track"]
  }
]

PHASE REQUIREMENTS:

1. PRE-LAUNCH (Weeks 1-3): Budget TBD by investor
   - Furnishing strategy for ${property.bedrooms}BR (costs vary by condition/style)
   - Photography checklist (hero shots, room shots, amenity shots)
   - Listing optimization (title formulas, description structure)

2. SOFT LAUNCH (Weeks 4-6): Launch pricing strategy
   - Set initial rate at $${Math.round(pricingStrategy.base_rate * 0.85)}/night (15% below target)
   - Instant Book settings
   - Response time targets

3. REVIEW BUILDING (Weeks 7-12): Target ${reviewsPerMonth * 2} reviews
   - Guest communication templates
   - Review request timing
   - 5-star experience checklist

4. OPTIMIZATION (Months 3-6): Reach target $${pricingStrategy.base_rate}/night
   - Pricing adjustment milestones
   - Amenity upgrades based on feedback
   - Dynamic pricing tool setup

5. SCALE/MAINTAIN (Month 6+): Maximize profitability
   - Superhost qualification checklist
   - Automation opportunities
   - Expansion criteria

Generate the 5-phase roadmap based on the data above.`;

  const roadmapSchema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        phase: { type: 'string', description: 'Phase name' },
        timeline: { type: 'string', description: 'Timeline (e.g., Weeks 1-3)' },
        tasks: { type: 'array', items: { type: 'string' }, description: 'Specific tasks with costs and details' },
        estimated_cost: { type: 'string', description: 'Itemized cost estimate' },
        expected_outcome: { type: 'string', description: 'Specific measurable outcome' },
        kpis: { type: 'array', items: { type: 'string' }, description: 'KPIs to track' }
      },
      required: ['phase', 'timeline', 'tasks', 'expected_outcome']
    }
  };

  try {
    const response = await callGemini({
      prompt,
      systemInstruction: 'You are an Airbnb launch strategist who creates actionable, phased roadmaps for new short-term rental properties. Each phase must include specific costs, timelines, and measurable outcomes based on the property and market data provided.',
      responseSchema: roadmapSchema
    });
    return JSON.parse(response);
  } catch (error) {
    console.error('[GeminiAnalyzer] Error generating action plan:', error);
    return [
      {
        phase: "Pre-Launch Setup",
        timeline: "Weeks 1-3",
        tasks: [
          "Sign lease and secure property",
          "Purchase furniture and essentials",
          "Hire professional photographer",
          "Create Airbnb listing with optimized title and description"
        ],
        estimated_cost: "$8,000-15,000",
        expected_outcome: "Property ready for first guests"
      },
      {
        phase: "Launch & First Reviews",
        timeline: "Weeks 4-8",
        tasks: [
          "Set competitive launch pricing (10-15% below target)",
          "Enable Instant Book",
          "Respond to inquiries within 1 hour",
          "Request reviews from every guest"
        ],
        expected_outcome: "5-10 five-star reviews"
      },
      {
        phase: "Optimization",
        timeline: "Months 3-6",
        tasks: [
          "Analyze booking patterns",
          "Adjust pricing based on demand",
          "Add amenities based on guest feedback",
          "Implement dynamic pricing tool"
        ],
        expected_outcome: "Reach Top 25% revenue performance"
      }
    ];
  }
}

/**
 * Generate executive summary combining all analyses
 */
export async function generateExecutiveSummary(
  property: PropertyData,
  insights: AIInsight[],
  verdict: InvestmentVerdict,
  pricingStrategy: PricingStrategy,
  riskAssessment: RiskAssessment,
  additionalMetrics?: {
    revenueToRentRatio?: number;
    qualificationRate?: number;
    breakEvenOccupancy?: number;
    cushionAboveBreakeven?: number;
    monthsToBreakeven?: number;
    topPerformerRevenue?: number;
    revenueGapToTop?: number;
  }
): Promise<string> {
  // Pre-calculate key metrics for the summary
  // Only calculate what we actually know - monthly operating costs
  const annualRent = property.monthly_rent * 12;
  const minimumRevenue = annualRent * 2;
  const estimatedUtilities = Math.round(property.monthly_rent * 0.15);
  const monthlyExpenses = property.monthly_rent + estimatedUtilities;
  const monthlyProfit = pricingStrategy.base_rate * 30 * 0.6 - monthlyExpenses;
  const breakEvenOccupancy = monthlyExpenses / (pricingStrategy.base_rate * 30) * 100;
  
  const prompt = `You are writing an executive summary for an Airbnb arbitrage investment report. This is the FIRST thing the investor reads - make it count.

PROPERTY FUNDAMENTALS:
- Address: ${property.address}
- Configuration: ${property.bedrooms}BR/${property.bathrooms}BA
- Monthly Rent: $${property.monthly_rent.toLocaleString()}
- Annual Rent: $${annualRent.toLocaleString()}
- Minimum Revenue Needed (2x rule): $${minimumRevenue.toLocaleString()}

INVESTMENT VERDICT: ${verdict.rating} (${verdict.confidence}/10 confidence)
${verdict.summary}

TOP REASONS:
${verdict.top_reasons?.map((r, i) => `${i + 1}. ${r}`).join('\n') || 'See detailed analysis'}

KEY METRICS (MUST INCLUDE IN SUMMARY):
- Revenue-to-Rent Ratio: ${additionalMetrics?.revenueToRentRatio?.toFixed(2) || 'N/A'}x ${(additionalMetrics?.revenueToRentRatio || 0) >= 2.5 ? '✓ ABOVE 2.5x' : '⚠ BELOW 2.5x'}
- Qualification Rate: ${additionalMetrics?.qualificationRate?.toFixed(1) || 'N/A'}% of similar properties are profitable
- Break-Even Occupancy: ${additionalMetrics?.breakEvenOccupancy?.toFixed(1) || 'N/A'}%
- Cushion Above Break-Even: ${additionalMetrics?.cushionAboveBreakeven?.toFixed(1) || 'N/A'} percentage points
- Break-Even Occupancy: ${breakEvenOccupancy.toFixed(1)}% (to cover monthly costs)
- Revenue Gap to Top Performer: $${additionalMetrics?.revenueGapToTop?.toLocaleString() || 'N/A'}

KEY INSIGHTS:
${insights.slice(0, 3).map(i => `- ${i.title}: ${i.insight} (Impact: ${i.impact})`).join('\n')}

PRICING STRATEGY:
- Recommended Base Rate: $${pricingStrategy.base_rate}/night
- Peak Premium: +${pricingStrategy.peak_premium_percent}%
- Slow Season Discount: -${pricingStrategy.slow_discount_percent}%
- Rationale: ${pricingStrategy.pricing_rationale}

RISK ASSESSMENT: ${riskAssessment.overall_risk}
- Key Risk: ${riskAssessment.risks[0]?.description || 'None identified'}
  Mitigation: ${riskAssessment.risks[0]?.mitigation || 'See detailed analysis'}
- Key Opportunity: ${riskAssessment.opportunities[0]?.description || 'None identified'}
  Potential Impact: ${riskAssessment.opportunities[0]?.potential_impact || 'See detailed analysis'}

MONTHLY OPERATING COSTS:
- Monthly Rent: $${property.monthly_rent.toLocaleString()}
- Estimated Utilities: $${estimatedUtilities.toLocaleString()}
- Total Monthly Expenses: $${Math.round(monthlyExpenses).toLocaleString()}
- Estimated Monthly Profit (at 60% occ): $${Math.round(monthlyProfit).toLocaleString()}
- Break-Even Occupancy: ${breakEvenOccupancy.toFixed(1)}% (to cover monthly costs)

NOTE: Startup costs are NOT estimated because they vary by property condition and investor strategy.

WRITE A 4-PARAGRAPH EXECUTIVE SUMMARY:

PARAGRAPH 1 - THE VERDICT (2-3 sentences):
Open with the clear recommendation: "${verdict.rating}" with confidence level.
State the single most important reason why.
Include the revenue-to-rent ratio and qualification rate.

PARAGRAPH 2 - THE OPPORTUNITY (2-3 sentences):
Highlight the most compelling opportunity from the data.
Quantify the upside (e.g., "Reaching top 25% adds $X/year").
Mention the pricing strategy that will capture this opportunity.

PARAGRAPH 3 - THE RISK (2-3 sentences):
Acknowledge the key risk honestly.
Quantify the downside (e.g., "If occupancy drops 20%, monthly loss of $X").
Provide the specific mitigation strategy.

PARAGRAPH 4 - THE ACTION (2-3 sentences):
State the break-even occupancy needed to cover monthly costs.
Provide the single most important first action.
End with a confident closing statement aligned with the verdict.

CRITICAL: Every paragraph MUST include specific numbers from the data above. No vague statements.`;

  try {
    return await callGemini(prompt, 1024);
  } catch (error) {
    console.error('[GeminiAnalyzer] Error generating executive summary:', error);
    return `**Investment Verdict: ${verdict.rating}** (Confidence: ${verdict.confidence}/10)

${verdict.summary}

The analysis identified ${insights.length} key insights specific to this property. The recommended base rate is $${pricingStrategy.base_rate}/night with seasonal adjustments. Overall risk is assessed as ${riskAssessment.overall_risk.toLowerCase()}.

${verdict.rating === 'PASS' ? 'We recommend NOT signing this lease based on the analysis.' : verdict.rating === 'CAUTION' ? 'This lease may work but proceed carefully and consider the risks.' : 'This lease looks promising for Airbnb arbitrage based on the analysis.'}`;
  }
}

/**
 * Run full AI analysis pipeline with 24-hour caching
 */
export async function runFullAIAnalysis(
  property: PropertyData,
  market: MarketData,
  competitors: CompetitorData[],
  percentiles: PercentileData,
  seasonality: SeasonalityData[],
  profitability: { conservative: number; realistic: number; optimistic: number }
): Promise<FullAIAnalysis> {
  // Generate cache key based on property and market data
  const cacheKey = apiCache.generateKey('ai_analysis', {
    address: property.address,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    monthly_rent: property.monthly_rent,
    market_name: market.name,
    market_occupancy: market.occupancy,
    market_adr: market.adr,
    profitability_conservative: profitability.conservative,
    profitability_realistic: profitability.realistic
  });
  
  // Check cache first (async for DB fallback)
  const cached = await apiCache.getAsync<FullAIAnalysis>(cacheKey);
  if (cached) {
    console.log('[GeminiAnalyzer] Returning cached AI analysis for:', property.address);
    return cached;
  }
  
  console.log('[GeminiAnalyzer] Starting full AI analysis for:', property.address);
  
  // Run analyses in parallel where possible
  const [insights, patterns, verdict] = await Promise.all([
    synthesizePropertyInsights(property, market, competitors, percentiles, seasonality),
    analyzeCompetitorPatterns(competitors, property),
    generateInvestmentVerdict(property, market, competitors, percentiles, profitability)
  ]);
  
  // These depend on previous results
  const pricingStrategy = await generatePricingStrategy(property, market, competitors, seasonality);
  const riskAssessment = await assessRisks(property, market, competitors, seasonality);
  const actionPlan = await generateActionPlan(property, verdict, pricingStrategy);
  const executiveSummary = await generateExecutiveSummary(property, insights, verdict, pricingStrategy, riskAssessment);
  
  console.log('[GeminiAnalyzer] Full AI analysis complete');
  
  const result: FullAIAnalysis = {
    insights,
    verdict,
    pricing_strategy: pricingStrategy,
    competitor_patterns: patterns,
    risk_assessment: riskAssessment,
    action_plan: actionPlan,
    executive_summary: executiveSummary
  };
  
  // Cache the result for 24 hours
  apiCache.set(cacheKey, result, 'ai_analysis');
  console.log('[GeminiAnalyzer] Cached AI analysis for:', property.address);
  
  return result;
}


// ============================================
// PHASE 3: GEMINI ADVANCED FEATURES
// ============================================

/**
 * Structured JSON Output Schema
 * Forces Gemini to return consistent, typed responses
 */
export interface StructuredAnalysisSchema {
  property_score: number; // 1-100
  market_score: number; // 1-100
  competition_score: number; // 1-100
  profitability_score: number; // 1-100
  overall_score: number; // 1-100
  verdict: 'GO' | 'CAUTION' | 'PASS';
  confidence: number; // 1-10
  key_insights: Array<{
    category: string;
    insight: string;
    impact: 'positive' | 'negative' | 'neutral';
    importance: number; // 1-10
  }>;
  risks: Array<{
    risk: string;
    severity: 'low' | 'medium' | 'high';
    mitigation: string;
  }>;
  opportunities: Array<{
    opportunity: string;
    potential_value: string;
    action: string;
  }>;
  // Note: We do NOT estimate startup costs (furniture, photos, supplies) because they vary wildly
  // We only show monthly operating costs which we can calculate from rent
  monthly_costs: {
    rent: number;
    utilities_estimate: number; // ~15% of rent
    total_monthly_expenses: number;
  };
  break_even_occupancy: {
    conservative: number; // % occupancy needed at conservative ADR
    realistic: number; // % occupancy needed at realistic ADR
    optimistic: number; // % occupancy needed at optimistic ADR
  };
  monthly_projections: {
    revenue_low: number;
    revenue_mid: number;
    revenue_high: number;
    expenses: number;
    profit_low: number;
    profit_mid: number;
    profit_high: number;
  };
}

/**
 * Call Gemini with structured JSON output schema and retry logic
 * @param prompt - The prompt to send to Gemini
 * @param schema - JSON schema for the expected output
 * @param maxTokens - Maximum tokens in the response
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param timeoutMs - Timeout for each attempt in milliseconds (default: 120000)
 */
export async function callGeminiStructured<T>(
  prompt: string,
  schema: object,
  maxTokens: number = 4096,
  maxRetries: number = 2,
  timeoutMs: number = 45000
): Promise<T> {
  const apiKey = ENV.geminiApiKey;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Use native systemInstruction instead of embedding in prompt
  const systemPrompt = 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. Analyze property data and market metrics to provide quantified, actionable investment analysis. Use the story-before-the-stats approach and analogy over jargon.';

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      if (attempt > 0) {
        // Exponential backoff: 2^attempt * 1000ms (2s, 4s, 8s, ...)
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`[GeminiAnalyzer] Structured retry attempt ${attempt + 1}/${maxRetries} after ${backoffMs}ms backoff`);
        await sleep(backoffMs);
      }
      
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
            responseSchema: schema,
            thinkingConfig: {
              thinkingLevel: 'high'
            }
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        // Check if response is HTML (error page) before trying to parse as JSON
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `HTTP ${response.status}`;
        
        if (contentType.includes('text/html')) {
          const htmlText = await response.text();
          console.error(`[GeminiAnalyzer] Structured: Received HTML error page: ${htmlText.substring(0, 200)}`);
          errorMessage = `API returned HTML error page (status ${response.status}). This may indicate an invalid API key or service issue.`;
        } else {
          const errorData = await response.json().catch(() => ({}));
          errorMessage = errorData.error?.message || errorMessage;
        }
        
        // Check if it's a retryable error (rate limit, server error)
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`Gemini API error (${response.status}): ${errorMessage}`);
          console.warn(`[GeminiAnalyzer] Retryable structured error on attempt ${attempt + 1}: ${errorMessage}`);
          continue; // Retry
        }
        
        throw new Error(`Gemini API error: ${errorMessage}`);
      }

      // Check content type before parsing successful response
      const successContentType = response.headers.get('content-type') || '';
      if (successContentType.includes('text/html')) {
        const htmlText = await response.text();
        console.error(`[GeminiAnalyzer] Structured: Received HTML instead of JSON: ${htmlText.substring(0, 200)}`);
        throw new Error('API returned HTML instead of JSON. This may indicate an authentication or service issue.');
      }
      
      const data = await response.json();
      // Filter out thinking parts - only extract text parts
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts
        .filter((p: any) => p.text && !p.thought)
        .map((p: any) => p.text)
        .join('') || '';

      if (attempt > 0) {
        console.log(`[GeminiAnalyzer] Structured success on retry attempt ${attempt + 1}`);
      }

      return JSON.parse(text.trim()) as T;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        lastError = new Error(`Gemini API timeout after ${timeoutMs / 1000} seconds`);
        console.warn(`[GeminiAnalyzer] Structured timeout on attempt ${attempt + 1}/${maxRetries}`);
        continue; // Retry on timeout
      }
      
      // For network errors, retry
      if (error.message?.includes('ECONNRESET') || 
          error.message?.includes('ETIMEDOUT') ||
          error.message?.includes('network')) {
        lastError = error;
        console.warn(`[GeminiAnalyzer] Structured network error on attempt ${attempt + 1}: ${error.message}`);
        continue; // Retry on network errors
      }
      
      // Non-retryable error
      console.error('[GeminiAnalyzer] Structured output error:', error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  // All retries exhausted
  throw lastError || new Error('Gemini structured API failed after all retry attempts');
}

/**
 * Generate comprehensive structured analysis
 */
export async function generateStructuredAnalysis(
  property: PropertyData,
  market: MarketData,
  competitors: CompetitorData[],
  percentiles: PercentileData,
  seasonality: SeasonalityData[],
  profitability: { conservative: number; realistic: number; optimistic: number }
): Promise<StructuredAnalysisSchema> {
  const schema: StructuredAnalysisSchema = {
    property_score: 0,
    market_score: 0,
    competition_score: 0,
    profitability_score: 0,
    overall_score: 0,
    verdict: 'CAUTION',
    confidence: 5,
    key_insights: [],
    risks: [],
    opportunities: [],
    monthly_costs: {
      rent: 0,
      utilities_estimate: 0,
      total_monthly_expenses: 0
    },
    break_even_occupancy: {
      conservative: 0,
      realistic: 0,
      optimistic: 0
    },
    monthly_projections: {
      revenue_low: 0,
      revenue_mid: 0,
      revenue_high: 0,
      expenses: 0,
      profit_low: 0,
      profit_mid: 0,
      profit_high: 0
    }
  };

  const prompt = `Analyze this Airbnb arbitrage opportunity and provide a comprehensive assessment:

PROPERTY:
- Address: ${property.address}
- Configuration: ${property.bedrooms}BR/${property.bathrooms}BA
- Monthly Rent: $${property.monthly_rent.toLocaleString()}

MARKET DATA:
- Market: ${market.name}
- Active Listings: ${market.active_listings.toLocaleString()}
- Average Occupancy: ${formatOccupancy(market.occupancy)}%
- Average Daily Rate: $${Math.round(market.adr)}
- Average Annual Revenue: $${Math.round(market.revenue).toLocaleString()}

COMPETITION (${competitors.length} comparable ${property.bedrooms}BR properties):
${competitors.slice(0, 5).map(c => `- ${c.name}: $${c.annual_revenue.toLocaleString()}/yr, ${formatOccupancy(c.occupancy)}% occ, ${c.rating || 'N/A'} rating`).join('\n')}

REVENUE PERCENTILES (${property.bedrooms}BR in this market):
- Top 10%: $${percentiles.top_10_percent.toLocaleString()}/yr
- Top 25%: $${percentiles.top_25_percent.toLocaleString()}/yr
- Median: $${percentiles.median.toLocaleString()}/yr
- Average: $${percentiles.average.toLocaleString()}/yr

PROFITABILITY SCENARIOS (after rent):
- Conservative: $${profitability.conservative.toLocaleString()}/yr
- Realistic: $${profitability.realistic.toLocaleString()}/yr
- Optimistic: $${profitability.optimistic.toLocaleString()}/yr

SEASONALITY:
${seasonality.map(s => `- ${s.month}: $${s.revenue.toLocaleString()} (${s.season_type})`).join('\n')}

Provide scores (1-100), verdict, insights, risks, opportunities, startup costs, break-even timeline, and monthly projections.
Be specific to THIS property and market. Use fifth-grade reading level for explanations.`;

  try {
    return await callGeminiStructured<StructuredAnalysisSchema>(prompt, schema);
  } catch (error) {
    console.error('[GeminiAnalyzer] Error generating structured analysis:', error);
    
    // Return calculated fallback
    const annualRent = property.monthly_rent * 12;
    const conservativeProfit = profitability.conservative;
    const realisticProfit = profitability.realistic;
    
    let verdict: 'GO' | 'CAUTION' | 'PASS' = 'CAUTION';
    let confidence = 5;
    
    if (realisticProfit > annualRent * 0.25) {
      verdict = 'GO';
      confidence = 8;
    } else if (realisticProfit > 0) {
      verdict = 'CAUTION';
      confidence = 6;
    } else {
      verdict = 'PASS';
      confidence = 7;
    }

    // Calculate monthly costs (what we actually know)
    const estimatedUtilities = Math.round(property.monthly_rent * 0.15);
    const totalMonthlyExpenses = property.monthly_rent + estimatedUtilities;
    
    // Calculate break-even occupancy at different ADR levels
    const conservativeADR = market.adr * 0.8;
    const realisticADR = market.adr;
    const optimisticADR = market.adr * 1.2;
    
    return {
      property_score: 70,
      market_score: market.occupancy > 0.6 ? 75 : 55,
      competition_score: competitors.length < 100 ? 70 : 50,
      profitability_score: realisticProfit > 0 ? 70 : 30,
      overall_score: Math.round((70 + (market.occupancy > 0.6 ? 75 : 55) + (competitors.length < 100 ? 70 : 50) + (realisticProfit > 0 ? 70 : 30)) / 4),
      verdict,
      confidence,
      key_insights: [
        {
          category: 'Revenue Potential',
          insight: `This ${property.bedrooms}BR can earn $${percentiles.median.toLocaleString()}-$${percentiles.top_25_percent.toLocaleString()}/year based on similar properties.`,
          impact: percentiles.median > annualRent * 2 ? 'positive' : 'neutral',
          importance: 9
        },
        {
          category: 'Competition',
          insight: `You're competing against ${competitors.length} similar ${property.bedrooms}BR properties in this market.`,
          impact: competitors.length < 50 ? 'positive' : 'negative',
          importance: 8
        }
      ],
      risks: [
        {
          risk: 'Seasonal revenue drops',
          severity: 'medium',
          mitigation: 'Save 3 months of rent during peak season for slow months'
        }
      ],
      opportunities: [
        {
          opportunity: 'Professional photos and listing optimization',
          potential_value: '+20-30% bookings',
          action: 'Hire professional photographer and copywriter'
        }
      ],
      monthly_costs: {
        rent: property.monthly_rent,
        utilities_estimate: estimatedUtilities,
        total_monthly_expenses: totalMonthlyExpenses
      },
      break_even_occupancy: {
        conservative: Math.round((totalMonthlyExpenses / (conservativeADR * 30)) * 100),
        realistic: Math.round((totalMonthlyExpenses / (realisticADR * 30)) * 100),
        optimistic: Math.round((totalMonthlyExpenses / (optimisticADR * 30)) * 100)
      },
      monthly_projections: {
        revenue_low: Math.round(percentiles.median / 12),
        revenue_mid: Math.round(percentiles.top_25_percent / 12),
        revenue_high: Math.round(percentiles.top_10_percent / 12),
        expenses: property.monthly_rent + 500,
        profit_low: Math.round(percentiles.median / 12) - property.monthly_rent - 500,
        profit_mid: Math.round(percentiles.top_25_percent / 12) - property.monthly_rent - 500,
        profit_high: Math.round(percentiles.top_10_percent / 12) - property.monthly_rent - 500
      }
    };
  }
}

/**
 * Parallel data fetching helper
 * Fetches multiple data sources simultaneously for faster analysis
 */
export async function fetchAnalysisDataParallel<T extends Record<string, Promise<any>>>(
  fetchers: T
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const keys = Object.keys(fetchers) as (keyof T)[];
  const promises = keys.map(key => fetchers[key]);
  
  const results = await Promise.allSettled(promises);
  
  const output: Partial<{ [K in keyof T]: Awaited<T[K]> }> = {};
  
  results.forEach((result, index) => {
    const key = keys[index];
    if (result.status === 'fulfilled') {
      output[key] = result.value;
    } else {
      console.error(`[GeminiAnalyzer] Failed to fetch ${String(key)}:`, result.reason);
      output[key] = null as any;
    }
  });
  
  return output as { [K in keyof T]: Awaited<T[K]> };
}

/**
 * Search for local STR regulations using Gemini's knowledge
 * Note: This uses Gemini's training data, not real-time search
 */
export interface RegulationInfo {
  city: string;
  state: string;
  str_allowed: 'yes' | 'no' | 'restricted' | 'unknown';
  permit_required: boolean;
  permit_cost_estimate: string;
  key_restrictions: string[];
  occupancy_limits: string;
  minimum_stay_requirements: string;
  tax_requirements: string[];
  enforcement_level: 'strict' | 'moderate' | 'minimal' | 'unknown';
  recent_changes: string;
  recommendation: string;
  disclaimer: string;
}

export async function getLocalRegulations(
  city: string,
  state: string
): Promise<RegulationInfo> {
  const prompt = `Provide information about short-term rental (Airbnb/VRBO) regulations in ${city}, ${state}.

Based on your knowledge, provide:
1. Are STRs allowed? (yes/no/restricted/unknown)
2. Is a permit required?
3. Estimated permit cost
4. Key restrictions (max nights, zones, etc.)
5. Occupancy limits
6. Minimum stay requirements
7. Tax requirements (TOT, sales tax, etc.)
8. Enforcement level (strict/moderate/minimal)
9. Any recent regulatory changes
10. Your recommendation for investors

Return as JSON:
{
  "city": "${city}",
  "state": "${state}",
  "str_allowed": "yes|no|restricted|unknown",
  "permit_required": true|false,
  "permit_cost_estimate": "$XXX-$XXX",
  "key_restrictions": ["restriction 1", "restriction 2"],
  "occupancy_limits": "description",
  "minimum_stay_requirements": "description",
  "tax_requirements": ["tax 1", "tax 2"],
  "enforcement_level": "strict|moderate|minimal|unknown",
  "recent_changes": "description or 'None known'",
  "recommendation": "your advice for investors",
  "disclaimer": "This information may be outdated. Always verify with local authorities."
}

Provide the regulation information based on your knowledge.`;

  const regulationSchema = {
    type: 'object',
    properties: {
      city: { type: 'string' },
      state: { type: 'string' },
      str_allowed: { type: 'string', enum: ['yes', 'no', 'restricted', 'unknown'] },
      permit_required: { type: 'boolean' },
      permit_cost_estimate: { type: 'string' },
      key_restrictions: { type: 'array', items: { type: 'string' } },
      occupancy_limits: { type: 'string' },
      minimum_stay_requirements: { type: 'string' },
      tax_requirements: { type: 'array', items: { type: 'string' } },
      enforcement_level: { type: 'string', enum: ['strict', 'moderate', 'minimal', 'unknown'] },
      recent_changes: { type: 'string' },
      recommendation: { type: 'string' },
      disclaimer: { type: 'string' }
    },
    required: ['city', 'state', 'str_allowed', 'permit_required', 'permit_cost_estimate', 'key_restrictions', 'occupancy_limits', 'minimum_stay_requirements', 'tax_requirements', 'enforcement_level', 'recent_changes', 'recommendation', 'disclaimer']
  };

  try {
    const response = await callGemini({
      prompt,
      systemInstruction: 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. You have deep knowledge of STR regulations across markets. Provide information about STR regulations based on your knowledge. Always include a disclaimer that information may be outdated and should be verified with local authorities.',
      responseSchema: regulationSchema,
      maxTokens: 2048
    });
    return JSON.parse(response);
  } catch (error) {
    console.error('[GeminiAnalyzer] Error fetching regulations:', error);
    return {
      city,
      state,
      str_allowed: 'unknown',
      permit_required: true,
      permit_cost_estimate: 'Varies - check local requirements',
      key_restrictions: ['Check local zoning laws', 'HOA restrictions may apply'],
      occupancy_limits: 'Typically 2 per bedroom + 2',
      minimum_stay_requirements: 'Varies by jurisdiction',
      tax_requirements: ['Transient Occupancy Tax (TOT)', 'State/local sales tax may apply'],
      enforcement_level: 'unknown',
      recent_changes: 'Unable to determine - verify with local authorities',
      recommendation: 'Research local regulations thoroughly before investing. Contact city planning department for current requirements.',
      disclaimer: 'This information could not be verified. Always check with local authorities before operating an STR.'
    };
  }
}

/**
 * Generate beginner-friendly explanation of complex data
 * Translates technical analysis into fifth-grade reading level
 */
export async function explainForBeginners(
  topic: string,
  data: any,
  context: string
): Promise<string> {
  const prompt = `Explain the following ${topic} data for someone thinking about starting an Airbnb business.

DATA:
${JSON.stringify(data, null, 2)}

CONTEXT: ${context}

Requirements:
- Use short sentences and simple words
- Give a real-world example or analogy
- Explain WHY this matters for their investment decision
- End with one specific action they should take
- Keep it under 150 words`;

  try {
    return await callGemini({
      prompt,
      systemInstruction: 'You are a friendly Airbnb investing mentor explaining concepts to a complete beginner. Write at a fifth-grade reading level. Never use jargon or technical terms without immediately explaining them. Use analogies to everyday situations.',
      maxTokens: 512
    });
  } catch (error) {
    console.error('[GeminiAnalyzer] Error explaining for beginners:', error);
    return `This data shows important information about ${topic}. It helps you understand if this investment makes sense for you.`;
  }
}

/**
 * Generate "What This Means For You" section for any data point
 */
export async function generateWhatThisMeans(
  dataPoint: string,
  value: string | number,
  context: {
    property_rent?: number;
    bedrooms?: number;
    market_name?: string;
  }
): Promise<string> {
  const prompt = `Explain what "${dataPoint}: ${value}" means for this Airbnb investment.
${context.property_rent ? `Monthly Rent: $${context.property_rent}` : ''}
${context.bedrooms ? `Bedrooms: ${context.bedrooms}` : ''}
${context.market_name ? `Market: ${context.market_name}` : ''}

Write 1-2 sentences starting with "This means..." or "This tells you..."
Be specific about what action they should take.`;

  try {
    return await callGemini({
      prompt,
      systemInstruction: 'You are a friendly Airbnb investing mentor. Write at a fifth-grade reading level. Be specific and actionable.',
      maxTokens: 256
    });
  } catch (error) {
    return `This is an important factor to consider for your investment decision.`;
  }
}

/**
 * Batch generate "What This Means" for multiple data points
 */
export async function batchGenerateExplanations(
  dataPoints: Array<{ name: string; value: string | number }>,
  context: {
    property_rent?: number;
    bedrooms?: number;
    market_name?: string;
  }
): Promise<Record<string, string>> {
  const prompt = `Explain what each of these data points means for someone researching an Airbnb arbitrage investment.

DATA POINTS:
${dataPoints.map(d => `- ${d.name}: ${d.value}`).join('\n')}

CONTEXT:
${context.property_rent ? `- Monthly Rent: $${context.property_rent}` : ''}
${context.bedrooms ? `- Bedrooms: ${context.bedrooms}` : ''}
${context.market_name ? `- Market: ${context.market_name}` : ''}

For EACH data point, write 1-2 sentences at a fifth-grade reading level explaining what it means.

Return as JSON:
{
  "data_point_name": "explanation",
  ...
}

Explain each data point in 1-2 simple sentences.`;

  // Build dynamic schema based on data points
  const explanationProperties: Record<string, any> = {};
  dataPoints.forEach(d => {
    explanationProperties[d.name] = { type: 'string', description: `Explanation of ${d.name}` };
  });
  const explanationSchema = {
    type: 'object',
    properties: explanationProperties,
    required: dataPoints.map(d => d.name)
  };

  try {
    const response = await callGemini({
      prompt,
      systemInstruction: 'You are explaining Airbnb investment data to a complete beginner. Write at a fifth-grade reading level. Use simple words. No jargon. Start each explanation with "This means..." or "This tells you..."',
      responseSchema: explanationSchema,
      maxTokens: 2048
    });
    return JSON.parse(response);
  } catch (error) {
    console.error('[GeminiAnalyzer] Error batch generating explanations:', error);
    const fallback: Record<string, string> = {};
    dataPoints.forEach(d => {
      fallback[d.name] = `This is an important factor to consider for your investment.`;
    });
    return fallback;
  }
}


// ============================================
// PHASE 5: LEAD MAGNET WOW FACTORS
// ============================================

/**
 * Time-to-Revenue Calculator
 * Shows how long it takes to go from signing lease to first booking
 */
export interface TimeToRevenueData {
  diy_timeline: {
    total_days: number;
    phases: Array<{
      phase: string;
      days: number;
      tasks: string[];
    }>;
    first_revenue_date: string;
  };
  professional_timeline: {
    total_days: number;
    phases: Array<{
      phase: string;
      days: number;
      tasks: string[];
    }>;
    first_revenue_date: string;
  };
  time_saved_days: number;
  revenue_lost_diy: number;
  what_this_means: string;
}

export async function calculateTimeToRevenue(
  bedrooms: number,
  monthly_rent: number,
  projected_monthly_revenue: number
): Promise<TimeToRevenueData> {
  const today = new Date();
  
  // DIY Timeline (doing it yourself)
  const diyPhases = [
    { phase: 'Sign Lease & Move In', days: 3, tasks: ['Sign lease', 'Get keys', 'Set up utilities'] },
    { phase: 'Research & Planning', days: 7, tasks: ['Research competitors', 'Create budget', 'Plan design'] },
    { phase: 'Furniture Shopping', days: 10, tasks: ['Shop for furniture', 'Compare prices', 'Wait for delivery'] },
    { phase: 'Furniture Assembly', days: 5, tasks: ['Assemble furniture', 'Arrange rooms', 'Add decor'] },
    { phase: 'Supplies & Essentials', days: 3, tasks: ['Buy linens', 'Stock kitchen', 'Get toiletries'] },
    { phase: 'Photography', days: 5, tasks: ['Clean everything', 'Take photos', 'Edit photos'] },
    { phase: 'Listing Creation', days: 3, tasks: ['Write description', 'Set pricing', 'Configure settings'] },
    { phase: 'First Booking Wait', days: 14, tasks: ['Wait for first booking', 'Respond to inquiries', 'Adjust pricing'] }
  ];
  
  const diyTotalDays = diyPhases.reduce((sum, p) => sum + p.days, 0);
  const diyFirstRevenue = new Date(today);
  diyFirstRevenue.setDate(diyFirstRevenue.getDate() + diyTotalDays);
  
  // Professional Timeline (with help)
  const professionalPhases = [
    { phase: 'Sign Lease & Handoff', days: 2, tasks: ['Sign lease', 'Hand keys to setup team'] },
    { phase: 'Professional Setup', days: 7, tasks: ['Team furnishes property', 'Professional staging', 'All supplies included'] },
    { phase: 'Pro Photography & Listing', days: 2, tasks: ['Professional photos', 'Optimized listing created', 'Pricing strategy set'] },
    { phase: 'Launch & First Booking', days: 7, tasks: ['Listing goes live', 'Launch promotion', 'First booking secured'] }
  ];
  
  const professionalTotalDays = professionalPhases.reduce((sum, p) => sum + p.days, 0);
  const professionalFirstRevenue = new Date(today);
  professionalFirstRevenue.setDate(professionalFirstRevenue.getDate() + professionalTotalDays);
  
  const timeSaved = diyTotalDays - professionalTotalDays;
  const dailyRevenue = projected_monthly_revenue / 30;
  const revenueLost = Math.round(timeSaved * dailyRevenue * 0.6); // Assume 60% occupancy during that time
  
  return {
    diy_timeline: {
      total_days: diyTotalDays,
      phases: diyPhases,
      first_revenue_date: diyFirstRevenue.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    },
    professional_timeline: {
      total_days: professionalTotalDays,
      phases: professionalPhases,
      first_revenue_date: professionalFirstRevenue.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    },
    time_saved_days: timeSaved,
    revenue_lost_diy: revenueLost,
    what_this_means: `Doing it yourself takes about ${diyTotalDays} days. With professional help, you could be earning ${timeSaved} days sooner. That's roughly $${revenueLost.toLocaleString()} in lost revenue while you're still setting up.`
  };
}

/**
 * Hidden Costs Reveal
 * Shows all the costs beginners don't think about
 */
export interface HiddenCostsData {
  obvious_costs: Array<{
    item: string;
    cost_low: number;
    cost_high: number;
    frequency: 'one-time' | 'monthly' | 'per-guest';
  }>;
  hidden_costs: Array<{
    item: string;
    cost_low: number;
    cost_high: number;
    frequency: 'one-time' | 'monthly' | 'per-guest';
    why_hidden: string;
  }>;
  total_obvious: { low: number; high: number };
  total_hidden: { low: number; high: number };
  total_first_year: { low: number; high: number };
  surprise_factor: string;
  what_this_means: string;
}

export function calculateHiddenCosts(
  bedrooms: number,
  monthly_rent: number
): HiddenCostsData {
  const obvious_costs = [
    { item: 'Monthly Rent', cost_low: monthly_rent, cost_high: monthly_rent, frequency: 'monthly' as const },
    { item: 'Furniture', cost_low: bedrooms * 2500, cost_high: bedrooms * 4000, frequency: 'one-time' as const },
    { item: 'Linens & Towels', cost_low: 300, cost_high: 600, frequency: 'one-time' as const },
    { item: 'Kitchen Supplies', cost_low: 200, cost_high: 400, frequency: 'one-time' as const },
    { item: 'Utilities', cost_low: 150, cost_high: 300, frequency: 'monthly' as const }
  ];
  
  const hidden_costs = [
    { item: 'Security Deposit', cost_low: monthly_rent, cost_high: monthly_rent * 2, frequency: 'one-time' as const, why_hidden: 'Often forgotten in startup budget' },
    { item: 'First/Last Month Rent', cost_low: monthly_rent, cost_high: monthly_rent * 2, frequency: 'one-time' as const, why_hidden: 'Due before you earn anything' },
    { item: 'Professional Photos', cost_low: 150, cost_high: 400, frequency: 'one-time' as const, why_hidden: 'Cheap photos = fewer bookings' },
    { item: 'Smart Lock & Tech', cost_low: 150, cost_high: 350, frequency: 'one-time' as const, why_hidden: 'Essential for self check-in' },
    { item: 'Cleaning Supplies', cost_low: 100, cost_high: 200, frequency: 'one-time' as const, why_hidden: 'Restocked constantly' },
    { item: 'Guest Consumables', cost_low: 30, cost_high: 60, frequency: 'per-guest' as const, why_hidden: 'Coffee, toiletries, snacks add up' },
    { item: 'Cleaning Fee Gap', cost_low: 20, cost_high: 50, frequency: 'per-guest' as const, why_hidden: 'Cleaners often cost more than you charge' },
    { item: 'Damaged/Missing Items', cost_low: 50, cost_high: 150, frequency: 'monthly' as const, why_hidden: 'Guests break things' },
    { item: 'Platform Fees (3%)', cost_low: 0, cost_high: 0, frequency: 'monthly' as const, why_hidden: 'Taken from every booking' },
    { item: 'Pricing Software', cost_low: 20, cost_high: 50, frequency: 'monthly' as const, why_hidden: 'PriceLabs, Wheelhouse, etc.' },
    { item: 'Channel Manager', cost_low: 0, cost_high: 30, frequency: 'monthly' as const, why_hidden: 'If listing on multiple platforms' },
    { item: 'Insurance Gap', cost_low: 30, cost_high: 100, frequency: 'monthly' as const, why_hidden: 'Airbnb coverage has limits' },
    { item: 'Permit/License Fees', cost_low: 0, cost_high: 500, frequency: 'one-time' as const, why_hidden: 'Varies by city' },
    { item: 'Occupancy Tax Setup', cost_low: 0, cost_high: 200, frequency: 'one-time' as const, why_hidden: 'Accountant/registration fees' },
    { item: 'Emergency Fund', cost_low: monthly_rent, cost_high: monthly_rent * 2, frequency: 'one-time' as const, why_hidden: 'For slow months or repairs' }
  ];
  
  // Calculate totals
  const obviousOneTime = obvious_costs.filter(c => c.frequency === 'one-time').reduce((sum, c) => sum + c.cost_low, 0);
  const obviousMonthly = obvious_costs.filter(c => c.frequency === 'monthly').reduce((sum, c) => sum + c.cost_low, 0);
  
  const hiddenOneTime = hidden_costs.filter(c => c.frequency === 'one-time').reduce((sum, c) => sum + c.cost_low, 0);
  const hiddenMonthly = hidden_costs.filter(c => c.frequency === 'monthly').reduce((sum, c) => sum + c.cost_low, 0);
  const hiddenPerGuest = hidden_costs.filter(c => c.frequency === 'per-guest').reduce((sum, c) => sum + c.cost_low, 0);
  
  const totalObviousLow = obviousOneTime + (obviousMonthly * 12);
  const totalObviousHigh = obvious_costs.filter(c => c.frequency === 'one-time').reduce((sum, c) => sum + c.cost_high, 0) + 
                          (obvious_costs.filter(c => c.frequency === 'monthly').reduce((sum, c) => sum + c.cost_high, 0) * 12);
  
  const totalHiddenLow = hiddenOneTime + (hiddenMonthly * 12) + (hiddenPerGuest * 50); // Assume 50 guests/year
  const totalHiddenHigh = hidden_costs.filter(c => c.frequency === 'one-time').reduce((sum, c) => sum + c.cost_high, 0) + 
                         (hidden_costs.filter(c => c.frequency === 'monthly').reduce((sum, c) => sum + c.cost_high, 0) * 12) +
                         (hidden_costs.filter(c => c.frequency === 'per-guest').reduce((sum, c) => sum + c.cost_high, 0) * 70);
  
  const surprisePercent = Math.round((totalHiddenLow / totalObviousLow) * 100);
  
  return {
    obvious_costs,
    hidden_costs,
    total_obvious: { low: totalObviousLow, high: totalObviousHigh },
    total_hidden: { low: totalHiddenLow, high: totalHiddenHigh },
    total_first_year: { low: totalObviousLow + totalHiddenLow, high: totalObviousHigh + totalHiddenHigh },
    surprise_factor: `${surprisePercent}% more than expected`,
    what_this_means: `Most beginners budget $${totalObviousLow.toLocaleString()} for their first year. The real cost is closer to $${(totalObviousLow + totalHiddenLow).toLocaleString()}-$${(totalObviousHigh + totalHiddenHigh).toLocaleString()}. That's ${surprisePercent}% more than they planned.`
  };
}

/**
 * Complexity Overwhelm Display
 * Shows everything they need to manage to succeed
 */
export interface ComplexityData {
  categories: Array<{
    category: string;
    tasks: string[];
    time_per_week_hours: number;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    can_outsource: boolean;
    outsource_cost_monthly: number;
  }>;
  total_weekly_hours: number;
  total_monthly_if_outsourced: number;
  overwhelm_score: number; // 1-10
  what_this_means: string;
}

export function calculateComplexity(bedrooms: number): ComplexityData {
  const categories = [
    {
      category: 'Guest Communication',
      tasks: ['Answer inquiries', 'Pre-arrival messages', 'Check-in instructions', 'Mid-stay check-ins', 'Review requests', 'Issue resolution'],
      time_per_week_hours: 5,
      difficulty: 'Medium' as const,
      can_outsource: true,
      outsource_cost_monthly: 200
    },
    {
      category: 'Cleaning Coordination',
      tasks: ['Schedule cleaners', 'Quality checks', 'Restock supplies', 'Handle same-day turnovers', 'Deep cleaning schedule'],
      time_per_week_hours: 3,
      difficulty: 'Medium' as const,
      can_outsource: true,
      outsource_cost_monthly: 150
    },
    {
      category: 'Pricing Management',
      tasks: ['Monitor competitors', 'Adjust daily rates', 'Set minimum stays', 'Event pricing', 'Last-minute discounts'],
      time_per_week_hours: 2,
      difficulty: 'Hard' as const,
      can_outsource: true,
      outsource_cost_monthly: 50
    },
    {
      category: 'Maintenance',
      tasks: ['Handle repairs', 'Coordinate vendors', 'Preventive maintenance', 'Emergency responses', 'Inventory management'],
      time_per_week_hours: 2,
      difficulty: 'Hard' as const,
      can_outsource: true,
      outsource_cost_monthly: 100
    },
    {
      category: 'Listing Optimization',
      tasks: ['Update photos', 'Refresh description', 'Respond to reviews', 'A/B test titles', 'Monitor ranking'],
      time_per_week_hours: 1,
      difficulty: 'Medium' as const,
      can_outsource: true,
      outsource_cost_monthly: 100
    },
    {
      category: 'Financial Management',
      tasks: ['Track income', 'Track expenses', 'Pay bills', 'Tax preparation', 'Profitability analysis'],
      time_per_week_hours: 1,
      difficulty: 'Medium' as const,
      can_outsource: true,
      outsource_cost_monthly: 150
    },
    {
      category: 'Compliance',
      tasks: ['Permit renewals', 'Tax filings', 'Insurance updates', 'Regulation monitoring', 'HOA communication'],
      time_per_week_hours: 0.5,
      difficulty: 'Hard' as const,
      can_outsource: true,
      outsource_cost_monthly: 50
    }
  ];
  
  const totalWeeklyHours = categories.reduce((sum, c) => sum + c.time_per_week_hours, 0);
  const totalOutsourceCost = categories.reduce((sum, c) => sum + c.outsource_cost_monthly, 0);
  const hardTasks = categories.filter(c => c.difficulty === 'Hard').length;
  const overwhelmScore = Math.min(10, Math.round((totalWeeklyHours / 2) + hardTasks));
  
  return {
    categories,
    total_weekly_hours: totalWeeklyHours,
    total_monthly_if_outsourced: totalOutsourceCost,
    overwhelm_score: overwhelmScore,
    what_this_means: `Running an Airbnb takes about ${totalWeeklyHours} hours per week. That's like a part-time job on top of your regular life. You can outsource most of it for around $${totalOutsourceCost}/month, but then you need to manage the people managing your property.`
  };
}

/**
 * DIY vs Professional Comparison
 * Shows the true cost of doing it yourself vs getting help
 */
export interface DIYvsProfessionalData {
  diy: {
    startup_cost: number;
    monthly_time_hours: number;
    learning_curve_months: number;
    common_mistakes: string[];
    first_year_revenue_estimate: number;
    stress_level: 'Low' | 'Medium' | 'High' | 'Very High';
  };
  professional: {
    startup_cost: number;
    monthly_time_hours: number;
    learning_curve_months: number;
    benefits: string[];
    first_year_revenue_estimate: number;
    stress_level: 'Low' | 'Medium' | 'High' | 'Very High';
  };
  cost_difference: number;
  revenue_difference: number;
  net_benefit: number;
  recommendation: string;
  what_this_means: string;
}

export function compareDIYvsProfessional(
  bedrooms: number,
  monthly_rent: number,
  projected_annual_revenue: number
): DIYvsProfessionalData {
  const baseStartupCost = bedrooms * 3000 + 1500;
  
  const diy = {
    startup_cost: baseStartupCost,
    monthly_time_hours: 60,
    learning_curve_months: 6,
    common_mistakes: [
      'Underpriced first 3 months (lost $2,000-5,000)',
      'Bad photos = 30% fewer bookings',
      'Wrong amenities purchased',
      'Cleaning issues = bad reviews',
      'Missed tax deductions'
    ],
    first_year_revenue_estimate: Math.round(projected_annual_revenue * 0.7), // 30% less due to mistakes
    stress_level: 'Very High' as const
  };
  
  const professional = {
    startup_cost: baseStartupCost + 5000, // Professional setup fee
    monthly_time_hours: 5,
    learning_curve_months: 0,
    benefits: [
      'Optimized from day one',
      'Professional photos included',
      'Proven pricing strategy',
      'Trained cleaning team',
      'Ongoing optimization'
    ],
    first_year_revenue_estimate: Math.round(projected_annual_revenue * 0.95), // Near full potential
    stress_level: 'Low' as const
  };
  
  const costDifference = professional.startup_cost - diy.startup_cost;
  const revenueDifference = professional.first_year_revenue_estimate - diy.first_year_revenue_estimate;
  const netBenefit = revenueDifference - costDifference;
  
  return {
    diy,
    professional,
    cost_difference: costDifference,
    revenue_difference: revenueDifference,
    net_benefit: netBenefit,
    recommendation: netBenefit > 0 
      ? 'Professional help pays for itself in the first year'
      : 'DIY might work if you have the time and experience',
    what_this_means: `Going professional costs $${costDifference.toLocaleString()} more upfront, but you'll likely earn $${revenueDifference.toLocaleString()} more in your first year. That's a net gain of $${netBenefit.toLocaleString()}. Plus, you save ${diy.monthly_time_hours - professional.monthly_time_hours} hours every month.`
  };
}

/**
 * Generate complete lead magnet wow data
 */
export interface LeadMagnetWowData {
  time_to_revenue: TimeToRevenueData;
  hidden_costs: HiddenCostsData;
  complexity: ComplexityData;
  diy_vs_professional: DIYvsProfessionalData;
}

export async function generateLeadMagnetWowData(
  bedrooms: number,
  monthly_rent: number,
  projected_monthly_revenue: number,
  projected_annual_revenue: number
): Promise<LeadMagnetWowData> {
  const [time_to_revenue, hidden_costs, complexity, diy_vs_professional] = await Promise.all([
    calculateTimeToRevenue(bedrooms, monthly_rent, projected_monthly_revenue),
    Promise.resolve(calculateHiddenCosts(bedrooms, monthly_rent)),
    Promise.resolve(calculateComplexity(bedrooms)),
    Promise.resolve(compareDIYvsProfessional(bedrooms, monthly_rent, projected_annual_revenue))
  ]);
  
  return {
    time_to_revenue,
    hidden_costs,
    complexity,
    diy_vs_professional
  };
}


// ============================================
// 5-YEAR HISTORICAL MARKET ANALYSIS
// ============================================

export interface HistoricalMarketAnalysis {
  executive_summary: string;
  market_trajectory: 'accelerating_growth' | 'steady_growth' | 'maturing' | 'plateauing' | 'declining';
  key_findings: string[];
  investment_implications: string[];
  timing_recommendation: string;
  confidence_level: 'high' | 'medium' | 'low';
}

export interface FiveYearSummaryInput {
  years_of_data: number;
  occupancy: {
    current_year_avg: number;
    five_year_avg: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    percent_change: number;
    yearly_data: Array<{ year: number; avg: number }>;
  };
  adr: {
    current_year_avg: number;
    five_year_avg: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    percent_change: number;
    yearly_data: Array<{ year: number; avg: number }>;
  };
  revenue: {
    current_year_avg: number;
    five_year_avg: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    percent_change: number;
    yearly_data: Array<{ year: number; avg: number }>;
  };
  market_maturity: 'emerging' | 'growing' | 'mature' | 'saturated';
}

/**
 * Generate AI-powered analysis of 5-year historical market data
 */
export async function analyzeHistoricalMarketTrends(
  marketName: string,
  fiveYearData: FiveYearSummaryInput,
  propertyContext?: {
    monthly_rent?: number;
    bedrooms?: number;
  }
): Promise<HistoricalMarketAnalysis> {
  const occupancyYearlyStr = fiveYearData.occupancy.yearly_data
    .map(y => `${y.year}: ${y.avg.toFixed(1)}%`)
    .join(', ');
  
  const adrYearlyStr = fiveYearData.adr.yearly_data
    .map(y => `${y.year}: $${y.avg.toFixed(0)}`)
    .join(', ');
  
  const revenueYearlyStr = fiveYearData.revenue.yearly_data
    .map(y => `${y.year}: $${y.avg.toFixed(0)}/mo`)
    .join(', ');

  const prompt = `You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. Analyze this ${fiveYearData.years_of_data}-year historical data for the ${marketName} market and provide investment insights.

HISTORICAL DATA:
- Years of data: ${fiveYearData.years_of_data}
- Market maturity classification: ${fiveYearData.market_maturity}

OCCUPANCY TRENDS:
- Current year average: ${fiveYearData.occupancy.current_year_avg.toFixed(1)}%
- 5-year average: ${fiveYearData.occupancy.five_year_avg.toFixed(1)}%
- Overall trend: ${fiveYearData.occupancy.trend} (${fiveYearData.occupancy.percent_change > 0 ? '+' : ''}${fiveYearData.occupancy.percent_change.toFixed(1)}%)
- Year-by-year: ${occupancyYearlyStr}

ADR (AVERAGE DAILY RATE) TRENDS:
- Current year average: $${fiveYearData.adr.current_year_avg.toFixed(0)}
- 5-year average: $${fiveYearData.adr.five_year_avg.toFixed(0)}
- Overall trend: ${fiveYearData.adr.trend} (${fiveYearData.adr.percent_change > 0 ? '+' : ''}${fiveYearData.adr.percent_change.toFixed(1)}%)
- Year-by-year: ${adrYearlyStr}

MONTHLY REVENUE TRENDS:
- Current year average: $${fiveYearData.revenue.current_year_avg.toFixed(0)}/month
- 5-year average: $${fiveYearData.revenue.five_year_avg.toFixed(0)}/month
- Overall trend: ${fiveYearData.revenue.trend} (${fiveYearData.revenue.percent_change > 0 ? '+' : ''}${fiveYearData.revenue.percent_change.toFixed(1)}%)
- Year-by-year: ${revenueYearlyStr}

${propertyContext?.monthly_rent ? `PROPERTY CONTEXT: Monthly rent $${propertyContext.monthly_rent}${propertyContext.bedrooms ? `, ${propertyContext.bedrooms} bedrooms` : ''}` : ''}

Respond in this exact JSON format:
{
  "executive_summary": "2-3 sentence summary of the market's historical performance and what it means for investors",
  "market_trajectory": "one of: accelerating_growth, steady_growth, maturing, plateauing, declining",
  "key_findings": ["finding 1", "finding 2", "finding 3"],
  "investment_implications": ["implication 1", "implication 2", "implication 3"],
  "timing_recommendation": "1-2 sentences on whether now is a good time to enter this market",
  "confidence_level": "high, medium, or low based on data quality and clarity of trends"
}

Focus on:
1. What the trends reveal about market health
2. Whether the market is becoming more or less competitive
3. If ADR growth is keeping pace with or outpacing occupancy changes
4. Signs of market saturation or continued opportunity
5. Specific actionable insights for an investor considering this market`;

  const historicalSchema = {
    type: 'object',
    properties: {
      executive_summary: { type: 'string', description: '2-3 sentence summary of market performance and investor implications' },
      market_trajectory: { type: 'string', enum: ['accelerating_growth', 'steady_growth', 'maturing', 'plateauing', 'declining'] },
      key_findings: { type: 'array', items: { type: 'string' } },
      investment_implications: { type: 'array', items: { type: 'string' } },
      timing_recommendation: { type: 'string', description: '1-2 sentences on market entry timing' },
      confidence_level: { type: 'string', enum: ['high', 'medium', 'low'] }
    },
    required: ['executive_summary', 'market_trajectory', 'key_findings', 'investment_implications', 'timing_recommendation', 'confidence_level']
  };

  try {
    const response = await callGemini({
      prompt,
      systemInstruction: 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. Analyze historical market data to identify trends, assess market health, and provide actionable investment insights. Every finding must reference specific numbers from the data. Use the story-before-the-stats approach.',
      responseSchema: historicalSchema,
      maxTokens: 1024
    });
    return JSON.parse(response);
  } catch (error) {
    console.error('[GeminiAnalyzer] Error analyzing historical trends:', error);
    
    // Return fallback analysis based on raw data
    return {
      executive_summary: `The ${marketName} market has shown ${fiveYearData.revenue.trend} revenue trends over ${fiveYearData.years_of_data} years, with occupancy ${fiveYearData.occupancy.trend === 'increasing' ? 'improving' : fiveYearData.occupancy.trend === 'decreasing' ? 'declining' : 'stable'}.`,
      market_trajectory: fiveYearData.revenue.percent_change > 10 ? 'steady_growth' : 
                         fiveYearData.revenue.percent_change > 0 ? 'maturing' : 
                         fiveYearData.revenue.percent_change > -5 ? 'plateauing' : 'declining',
      key_findings: [
        `Revenue has ${fiveYearData.revenue.trend === 'increasing' ? 'grown' : fiveYearData.revenue.trend === 'decreasing' ? 'declined' : 'remained stable'} by ${Math.abs(fiveYearData.revenue.percent_change).toFixed(1)}% over ${fiveYearData.years_of_data} years`,
        `Occupancy rates are ${fiveYearData.occupancy.trend} (${fiveYearData.occupancy.percent_change > 0 ? '+' : ''}${fiveYearData.occupancy.percent_change.toFixed(1)}%)`,
        `ADR has ${fiveYearData.adr.trend === 'increasing' ? 'increased' : fiveYearData.adr.trend === 'decreasing' ? 'decreased' : 'held steady'} to $${fiveYearData.adr.current_year_avg.toFixed(0)}`
      ],
      investment_implications: [
        fiveYearData.market_maturity === 'emerging' ? 'Early market entry opportunity with growth potential' :
        fiveYearData.market_maturity === 'growing' ? 'Active growth phase - good time for market entry' :
        fiveYearData.market_maturity === 'mature' ? 'Established market - focus on differentiation' :
        'Saturated market - requires careful property selection'
      ],
      timing_recommendation: fiveYearData.revenue.trend === 'increasing' 
        ? 'Market trends support entry, but conduct thorough property-level analysis.'
        : 'Exercise caution - ensure strong property fundamentals before committing.',
      confidence_level: fiveYearData.years_of_data >= 4 ? 'high' : fiveYearData.years_of_data >= 2 ? 'medium' : 'low'
    };
  }
}


// ============================================
// COMPREHENSIVE NARRATIVE REPORT GENERATION
// ============================================

/**
 * Input data for generating a comprehensive narrative report
 */
export interface NarrativeReportInput {
  // Report mode: 'pro' for experienced investors, 'guided' for beginners
  reportMode?: 'pro' | 'guided';
  
  // Property basics
  address: string;
  monthly_rent: number;
  bedrooms: number;
  bathrooms: number;
  
  // Market data
  market_name: string;
  market_occupancy: number;
  market_adr: number;
  active_listings: number;  // Number of direct competitors analyzed (local)
  regional_active_listings?: number;  // Total active listings in the broader regional market
  same_bedroom_regional_count?: number;  // Number of same-bedroom listings in the regional market
  
  // Revenue projections
  revenue_low: number;
  revenue_mid: number;
  revenue_high: number;
  
  // Profitability
  monthly_expenses: number;
  annual_profit_conservative: number;
  annual_profit_realistic: number;
  annual_profit_optimistic: number;
  
  // Competitors (top 10 with full data)
  competitors: Array<{
    name: string;
    annual_revenue: number;
    occupancy: number;
    adr: number;
    rating: number | null;
    reviews: number;
    amenities: string[];
    property_type: string;
    last_review_date?: string;
    is_superhost: boolean;
    is_professional: boolean;
    distance_meters?: number;
  }>;
  
  // Seasonality (12 months)
  seasonality: Array<{
    month: string;
    revenue: number;
    occupancy: number;
    adr: number;
    season_type: 'peak' | 'shoulder' | 'off';
  }>;
  
  // 5-year historical data (if available)
  five_year_summary?: {
    years_of_data: number;
    occupancy: {
      current_year_avg: number;
      five_year_avg: number;
      trend: 'increasing' | 'stable' | 'decreasing';
      percent_change: number;
    };
    adr: {
      current_year_avg: number;
      five_year_avg: number;
      trend: 'increasing' | 'stable' | 'decreasing';
      percent_change: number;
    };
    revenue: {
      current_year_avg: number;
      five_year_avg: number;
      trend: 'increasing' | 'stable' | 'decreasing';
      percent_change: number;
    };
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
    last_minute_booking_percent: number;
    advance_booking_percent: number;
    avg_length_of_stay: number;
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
  
  // Competitor historical performance (top 5)
  competitor_historical?: Array<{
    name: string;
    listing_id: string;
    total_revenue_12mo: number;
    avg_adr: number;
    avg_occupancy: number;
    revenue_trend: 'growing' | 'stable' | 'declining';
  }>;
  
  // Daily pricing intelligence (6-month forward)
  daily_pricing?: {
    avg_adr: number;
    adr_percentile_25: number;
    adr_percentile_50: number;
    adr_percentile_75: number;
    avg_occupancy: number;
    peak_dates: string[];
    low_dates: string[];
    pricing_volatility: 'low' | 'medium' | 'high';
  };
  
  // Submarket analysis
  submarket_analysis?: {
    property_submarket?: {
      name: string;
      revenue: number;
      occupancy: number;
      adr: number;
      listing_count: number;
    };
    top_submarkets: Array<{
      name: string;
      revenue: number;
      occupancy: number;
      adr: number;
      listing_count: number;
    }>;
    market_avg_revenue: number;
  };
  
  // Top performer comps (AirDNA's native comp algorithm)
  top_performer_comps?: Array<{
    title: string;
    bedrooms: number;
    bathrooms: number;
    property_type: string;
    annual_revenue: number;
    adr: number;
    occupancy: number;
    rating: number | null;
    reviews: number;
    similarity_score: number;
    amenities: string[];
  }>;
  
  // Top performer pricing strategy (90-day forward)
  top_performer_pricing?: {
    avg_weekday_price: number;
    avg_weekend_price: number;
    price_range_low: number;
    price_range_high: number;
    weekend_premium_percent: number;
    days_of_data: number;
  };
  
  // Rentalizer comps with enhanced host quality data
  rentalizer_comps?: {
    total_comps: number;
    superhost_count: number;
    superhost_percentage: number;
    professional_count: number;
    professional_percentage: number;
    avg_distance_meters: number;
    avg_revenue: number;
    avg_rating: number;
    avg_reviews: number;
    top_comps: Array<{
      title: string;
      bedrooms: number;
      annual_revenue: number;
      rating: number | null;
      reviews: number;
      distance_meters: number;
      superhost: boolean;
      professionally_managed: boolean;
    }>;
  };
  
  // Existing listing data if property was previously on Airbnb
  existing_listing_data?: {
    property_id: string;
    title: string;
    annual_revenue: number;
    adr: number;
    occupancy: number;
    rating: number | null;
    reviews: number;
  };
  
  // Submarket listings for hyper-local competition
  submarket_listings?: {
    submarket_name: string;
    total_listings: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    top_listings: Array<{
      name: string;
      bedrooms: number;
      annual_revenue: number;
      adr: number;
      occupancy: number;
      rating: number | null;
    }>;
  };
  
  // Qualifying competitors (those meeting 2x rent revenue threshold)
  qualifying_competitors?: {
    qualifying_count: number;
    total_same_bedroom: number;
    qualification_rate: number;
    revenue_threshold: number;
    avg_qualifying_revenue: number;
    avg_qualifying_occupancy: number;
    avg_qualifying_adr: number;
    superhost_percentage: number;
    professional_percentage: number;
    top_qualifiers: Array<{
      title: string;
      bedrooms: number;
      annual_revenue: number;
      adr: number;
      occupancy: number;
      rating: number | null;
      superhost: boolean;
      professionally_managed: boolean;
    }>;
  };
  
  // Radius listings (hyper-local competition within 1km)
  radius_listings?: {
    total_count: number;
    radius_meters: number;
    listings_per_sqkm: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    superhost_percentage: number;
    professional_percentage: number;
    same_bedroom_count: number;
    top_nearby: Array<{
      title: string;
      bedrooms: number;
      annual_revenue: number;
      adr: number;
      occupancy: number;
      rating: number | null;
      distance_meters?: number;
    }>;
  };
  
  // Market saturation (complete market analysis)
  market_saturation?: {
    total_listings: number;
    same_bedroom_count: number;
    bedroom_distribution: Array<{ bedrooms: number; count: number; percentage: number }>;
    revenue_percentiles: { p25: number; p50: number; p75: number; p90: number };
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    superhost_percentage: number;
    professional_percentage: number;
    market_concentration: 'fragmented' | 'moderate' | 'concentrated';
  };
  
  // Property type analysis (entire home vs private room)
  property_type_analysis?: {
    entire_home: {
      count: number;
      avg_revenue: number;
      avg_adr: number;
      avg_occupancy: number;
      superhost_percentage: number;
    };
    private_room: {
      count: number;
      avg_revenue: number;
      avg_adr: number;
      avg_occupancy: number;
      superhost_percentage: number;
    };
    revenue_premium: number;
    recommended_type: 'entire_home' | 'private_room';
    recommendation_reason: string;
  };
  
  // Nearby markets comparison
  nearby_markets?: {
    current_market: {
      name: string;
      market_score: number;
      revenue: number;
      occupancy: number;
      regulation_score: number;
    };
    alternatives: Array<{
      name: string;
      market_score: number;
      revenue: number;
      occupancy: number;
      regulation_score: number;
      revenue_vs_current: number;
      distance_estimate: string;
    }>;
    best_alternative: string;
    recommendation: string;
  };
  
  // AirDNA's built-in feasibility assessment (second opinion)
  airdna_feasibility?: {
    projections: {
      annual_revenue: number;
      annual_profit: number;
      monthly_profit: number;
      roi_percentage: number;
      break_even_occupancy: number;
    };
    risk_assessment: {
      overall_risk: 'low' | 'medium' | 'high';
      seasonality_risk: 'low' | 'medium' | 'high';
      regulation_risk: 'low' | 'medium' | 'high';
      market_saturation: 'low' | 'medium' | 'high';
      factors: string[];
    };
    recommendation: string;
    comparison: {
      our_annual_profit: number;
      airdna_annual_profit: number;
      profit_difference: number;
      profit_difference_pct: number;
      assessment_match: boolean;
    };
  };
  
  // Submarket deep-dive analysis
  submarket_deep_dive?: {
    submarket_name: string;
    listing_count: number;
    metrics: {
      revenue: number;
      adr: number;
      occupancy: number;
      revpar: number;
    };
    bedroom_performance: Array<{
      bedrooms: number;
      count: number;
      avg_revenue: number;
      avg_adr: number;
      avg_occupancy: number;
    }>;
    top_performers: Array<{
      title: string;
      bedrooms: number;
      annual_revenue: number;
      adr: number;
      occupancy: number;
      rating: number;
    }>;
    insights: {
      revenue_trend: string;
      occupancy_trend: string;
      market_health: string;
      growth_potential: string;
    };
  };
  
  // Competitor imagery analysis
  competitor_imagery?: {
    total_competitors_analyzed: number;
    competitors_with_images: number;
    avg_image_count: number;
    max_image_count: number;
    min_image_count: number;
    top_competitors: Array<{
      name: string;
      image_count: number;
      has_professional_photos: boolean;
    }>;
    photo_quality_insights: {
      high_photo_count_threshold: number;
      competitors_above_threshold: number;
      recommendation: string;
    };
  };
  
  // Submarket details (geographic context and parent market)
  submarket_details?: {
    submarket_id: string;
    submarket_name: string;
    parent_market_name: string | null;
    parent_market_id: string | null;
    market_type: string | null;
    metrics: {
      market_score: number;
      revenue: number;
      occupancy: number;
      adr: number;
      revpar: number;
    } | null;
  };
  
  // All submarkets in the parent market (neighborhood comparison)
  all_submarkets?: {
    property_submarket_name: string;
    property_submarket_rank: number;
    total_submarkets: number;
    submarkets: Array<{
      name: string;
      listing_count: number;
      revenue: number;
      occupancy: number;
      adr: number;
      revpar: number;
    }>;
  };
  
  // Enhanced submarket exploration with rankings and recommendations
  submarket_exploration?: {
    market_name: string;
    market_metrics: {
      occupancy: number;
      adr: number;
      revenue: number;
      revpar: number;
      active_listings: number;
    };
    property_submarket_name: string;
    property_submarket_rank: number;
    property_submarket_overall_score: number;
    top_recommendation: {
      name: string;
      overall_score: number;
      revenue: number;
      occupancy: number;
      recommendation: string;
    } | null;
    submarkets: Array<{
      name: string;
      listing_count: number;
      metrics: {
        occupancy: number;
        adr: number;
        revenue: number;
        revpar: number;
      };
      ranking: {
        revenue_rank: number;
        occupancy_rank: number;
        revpar_rank: number;
        overall_score: number;
      };
      recommendation?: string;
    }>;
  };
  
  // Market insights derived from listings
  market_insights?: {
    total_listings: number;
    professionally_managed_count: number;
    professionally_managed_pct: number;
    superhost_count: number;
    superhost_pct: number;
    avg_rating: number;
    avg_reviews: number;
    property_type_breakdown: Array<{
      type: string;
      count: number;
      pct: number;
      avg_revenue: number;
    }>;
    host_size_breakdown: Array<{
      size: string;
      count: number;
      pct: number;
      avg_revenue: number;
    }>;
    revenue_percentiles: {
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
    };
  };
  
  // Same bedroom radius listings (filtered competitors)
  same_bedroom_radius_listings?: {
    search_radius_meters: number;
    bedroom_filter: number;
    total_found: number;
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    superhost_count: number;
    professional_count: number;
    top_performers: Array<{
      title: string;
      bedrooms: number;
      bathrooms: number;
      property_type: string;
      annual_revenue: number;
      adr: number;
      occupancy: number;
      rating: number | null;
      reviews: number;
      superhost: boolean;
      professionally_managed: boolean;
    }>;
  };
  
  // Superhost top performers (filtered by superhost status)
  superhost_top_performers?: {
    total_superhosts_in_market: number;
    avg_superhost_revenue: number;
    avg_superhost_rating: number;
    avg_superhost_reviews: number;
    revenue_premium_vs_market: number;
    top_superhosts: Array<{
      title: string;
      bedrooms: number;
      property_type: string;
      annual_revenue: number;
      adr: number;
      occupancy: number;
      rating: number | null;
      reviews: number;
    }>;
  };
}

/**
 * The narrative report output structure
 */
export interface NarrativeReport {
  // Main narrative sections (Gemini-generated prose)
  executive_summary: string;
  market_overview: string;
  revenue_analysis: string;
  competitive_landscape: string;
  seasonal_strategy: string;
  historical_context: string;
  risk_assessment: string;
  financial_outlook: string;
  conclusion: string;
  
  // Key metrics for display cards
  key_metrics: {
    projected_annual_revenue: number;
    projected_monthly_profit: number;
    market_occupancy: number;
    market_adr: number;
    break_even_months: number;
    confidence_level: 'high' | 'medium' | 'low';
    revenue_to_rent_ratio?: number;
    qualification_rate?: number;
    neighborhood_rank?: string;
    superhost_premium?: number;
    direct_competitor_count?: number;
    // New enhanced metrics
    break_even_occupancy?: number;
    cushion_above_breakeven?: number;
    seasonal_swing_percent?: number;
    time_to_superhost_months?: number;
    revpar_vs_market?: number;
    top_performer_gap?: number;
    cash_reserves_needed?: number;
    year_1_roi?: number;
    year_2_roi?: number;
  };
  
  // Quick facts for sidebar
  quick_facts: string[];
}

/**
 * Generate a comprehensive narrative investment report using Gemini
 * This transforms raw data into a professional, readable document
 */
export async function generateNarrativeReport(
  input: NarrativeReportInput
): Promise<NarrativeReport> {
  // Helper function to format occupancy consistently
  // AirDNA returns occupancy as decimal (0.63) but sometimes it's already percentage (63)
  const formatOccupancy = (occ: number): string => {
    if (occ > 1) return occ.toFixed(1); // Already a percentage
    return (occ * 100).toFixed(1); // Convert decimal to percentage
  };

  // Format competitor data for the prompt - now with full details
  const competitorSummary = input.competitors.slice(0, 10).map((c, i) => {
    const superhostBadge = c.is_superhost ? ' [SUPERHOST]' : '';
    const proBadge = c.is_professional ? ' [PRO]' : '';
    const reviewInfo = c.reviews ? `, ${c.reviews} reviews` : '';
    const distanceInfo = c.distance_meters ? ` (${(c.distance_meters / 1609).toFixed(1)} mi away)` : '';
    const amenityList = c.amenities?.length > 0 ? `\n   Amenities: ${c.amenities.slice(0, 8).join(', ')}` : '';
    const lastReview = c.last_review_date ? `\n   Last Review: ${c.last_review_date}` : '';
    
    return `${i + 1}. "${c.name}"${superhostBadge}${proBadge}${distanceInfo}
   Type: ${c.property_type || 'Unknown'} | Revenue: $${c.annual_revenue.toLocaleString()}/yr | Occupancy: ${formatOccupancy(c.occupancy)}%
   ADR: $${Math.round(c.adr)}/night${c.rating ? ` | Rating: ${c.rating}★` : ''}${reviewInfo}${amenityList}${lastReview}`;
  }).join('\n\n');
  
  // Analyze amenity patterns across competitors
  const amenityFrequency: Record<string, number> = {};
  input.competitors.forEach(c => {
    (c.amenities || []).forEach(a => {
      amenityFrequency[a] = (amenityFrequency[a] || 0) + 1;
    });
  });
  const topCompetitorAmenities = Object.entries(amenityFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([amenity, count]) => `${amenity} (${Math.round(count / input.competitors.length * 100)}% of competitors)`)
    .join(', ');
  
  // Analyze superhost/professional patterns
  const superhostCount = input.competitors.filter(c => c.is_superhost).length;
  const proCount = input.competitors.filter(c => c.is_professional).length;
  const superhostAvgRevenue = input.competitors.filter(c => c.is_superhost).reduce((sum, c) => sum + c.annual_revenue, 0) / Math.max(1, superhostCount);
  const nonSuperhostAvgRevenue = input.competitors.filter(c => !c.is_superhost).reduce((sum, c) => sum + c.annual_revenue, 0) / Math.max(1, input.competitors.length - superhostCount);
  
  // Format seasonality for the prompt
  const peakMonths = input.seasonality.filter(s => s.season_type === 'peak').map(s => s.month).join(', ');
  const offMonths = input.seasonality.filter(s => s.season_type === 'off').map(s => s.month).join(', ');
  const avgPeakRevenue = input.seasonality.filter(s => s.season_type === 'peak').reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, input.seasonality.filter(s => s.season_type === 'peak').length);
  const avgOffRevenue = input.seasonality.filter(s => s.season_type === 'off').reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, input.seasonality.filter(s => s.season_type === 'off').length);
  
  // Build historical context if available
  let historicalContext = '';
  if (input.five_year_summary) {
    const fys = input.five_year_summary;
    historicalContext = `
5-YEAR TRENDS: ${fys.market_maturity} market. Revenue ${fys.revenue.trend} (${fys.revenue.percent_change > 0 ? '+' : ''}${fys.revenue.percent_change.toFixed(0)}%), Occupancy ${fys.occupancy.trend} (${fys.occupancy.percent_change > 0 ? '+' : ''}${fys.occupancy.percent_change.toFixed(0)}%)`;
  }
  
  // Build supply trend context
  let supplyContext = '';
  if (input.supply_trend) {
    supplyContext = `
SUPPLY DYNAMICS:
- Current Active Listings: ${input.supply_trend.current_listings}
- Net Change: ${input.supply_trend.net_change > 0 ? '+' : ''}${input.supply_trend.net_change} listings
- Trend: ${input.supply_trend.trend} (${input.supply_trend.percent_change > 0 ? '+' : ''}${input.supply_trend.percent_change.toFixed(1)}%)`;
  }
  
  // Build professional stats context
  let professionalContext = '';
  if (input.professional_stats) {
    professionalContext = `
HOST LANDSCAPE:
- Professional Hosts: ${input.professional_stats.professional_percentage.toFixed(1)}% of market
- Superhosts: ${input.professional_stats.superhost_percentage.toFixed(1)}%
${input.professional_stats.revenue_premium_percent ? `- Professional Revenue Premium: +${input.professional_stats.revenue_premium_percent.toFixed(0)}%` : ''}`;
  }
  
  // Build amenities context
  let amenitiesContext = '';
  if (input.amenities && input.amenities.length > 0) {
    amenitiesContext = `
TOP AMENITIES (% of top performers):
${input.amenities.slice(0, 8).map(a => `- ${a.amenity}: ${a.percentage_of_top_performers}%`).join('\n')}`;
  }
  
  // Build risks context
  let risksContext = '';
  if (input.risks && input.risks.length > 0) {
    risksContext = `
IDENTIFIED RISKS:
${input.risks.slice(0, 5).map(r => `- ${r.category}: ${r.description} (${r.severity})`).join('\n')}`;
  }
  
  // Build bedroom performance context
  let bedroomContext = '';
  if (input.bedroom_performance && input.bedroom_performance.length > 0) {
    const propertyBr = input.property_bedrooms || input.bedrooms;
    const propertyBrData = input.bedroom_performance.find(b => b.bedrooms === propertyBr);
    const bestBrData = [...input.bedroom_performance].sort((a, b) => b.avg_revenue - a.avg_revenue)[0];
    
    bedroomContext = `
BEDROOM PERFORMANCE ANALYSIS:
${input.bedroom_performance.map(b => 
  `- ${b.bedrooms}BR: ${b.count} listings, $${b.avg_revenue.toLocaleString()}/yr avg, $${b.avg_adr}/night, ${b.avg_occupancy}% occupancy`
).join('\n')}

Property Configuration: ${propertyBr}BR
${propertyBrData ? `- Your config avg revenue: $${propertyBrData.avg_revenue.toLocaleString()}/yr` : ''}
${bestBrData && bestBrData.bedrooms !== propertyBr ? `- Best performing: ${bestBrData.bedrooms}BR at $${bestBrData.avg_revenue.toLocaleString()}/yr` : ''}`;
  }
  
  // Build competitor historical context
  let competitorHistoricalContext = '';
  if (input.competitor_historical && input.competitor_historical.length > 0) {
    const growingCount = input.competitor_historical.filter(c => c.revenue_trend === 'growing').length;
    const decliningCount = input.competitor_historical.filter(c => c.revenue_trend === 'declining').length;
    const avgRevenue = input.competitor_historical.reduce((sum, c) => sum + c.total_revenue_12mo, 0) / input.competitor_historical.length;
    
    competitorHistoricalContext = `
TOP COMPETITOR HISTORICAL PERFORMANCE (12 months):
${input.competitor_historical.map(c => 
  `- ${c.name.substring(0, 40)}: $${c.total_revenue_12mo.toLocaleString()} total, $${Math.round(c.avg_adr)}/night, ${Math.round(c.avg_occupancy)}% occ, Trend: ${c.revenue_trend}`
).join('\n')}

Competitor Trends Summary:
- Growing: ${growingCount} of ${input.competitor_historical.length}
- Declining: ${decliningCount} of ${input.competitor_historical.length}
- Avg 12-Month Revenue: $${Math.round(avgRevenue).toLocaleString()}`;
  }
  
  // Build daily pricing context
  let dailyPricingContext = '';
  if (input.daily_pricing) {
    const dp = input.daily_pricing;
    dailyPricingContext = `
DAILY PRICING INTELLIGENCE (6-Month Forward):
- Average ADR: $${dp.avg_adr}
- Pricing Percentiles: 25th: $${dp.adr_percentile_25} | 50th: $${dp.adr_percentile_50} | 75th: $${dp.adr_percentile_75}
- Average Occupancy: ${formatOccupancy(dp.avg_occupancy)}%
- Pricing Volatility: ${dp.pricing_volatility}
- Peak Pricing Dates: ${dp.peak_dates.slice(0, 5).join(', ')}
- Low Pricing Dates: ${dp.low_dates.slice(0, 5).join(', ')}

Pricing Strategy Insight: ${dp.pricing_volatility === 'high' ? 'High volatility suggests significant seasonal swings - dynamic pricing is essential' : dp.pricing_volatility === 'medium' ? 'Moderate volatility - adjust pricing for peak/off seasons' : 'Low volatility - stable pricing with minor seasonal adjustments'}`;
  }
  
  // Build submarket analysis context
  let submarketContext = '';
  if (input.submarket_analysis) {
    const sa = input.submarket_analysis;
    submarketContext = `
SUBMARKET ANALYSIS:
${sa.property_submarket ? `Property's Neighborhood: ${sa.property_submarket.name}
- Revenue: $${sa.property_submarket.revenue.toLocaleString()}/yr
- Occupancy: ${formatOccupancy(sa.property_submarket.occupancy)}%
- ADR: $${Math.round(sa.property_submarket.adr)}
- Listings: ${sa.property_submarket.listing_count}` : ''}

Top Performing Neighborhoods in Market:
${sa.top_submarkets.map((s, i) => 
  `${i + 1}. ${s.name}: $${s.revenue.toLocaleString()}/yr, ${formatOccupancy(s.occupancy)}% occ, $${Math.round(s.adr)}/night, ${s.listing_count} listings`
).join('\n')}

Market Average Revenue: $${sa.market_avg_revenue.toLocaleString()}/yr`;
  }
  
  // Build top performer comps context
  let topPerformerCompsContext = '';
  if (input.top_performer_comps && input.top_performer_comps.length > 0) {
    const comps = input.top_performer_comps;
    const avgRevenue = comps.reduce((sum, c) => sum + c.annual_revenue, 0) / comps.length;
    const avgSimilarity = comps.reduce((sum, c) => sum + c.similarity_score, 0) / comps.length;
    const topAmenities: Record<string, number> = {};
    comps.forEach(c => {
      (c.amenities || []).forEach(a => {
        topAmenities[a] = (topAmenities[a] || 0) + 1;
      });
    });
    const commonAmenities = Object.entries(topAmenities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([amenity, count]) => `${amenity} (${Math.round(count / comps.length * 100)}%)`)
      .join(', ');
    
    topPerformerCompsContext = `
TOP PERFORMER'S COMPETITIVE SET:
These are the listings identified as most similar to the market's top performer:
${comps.slice(0, 8).map((c, i) => 
  `${i + 1}. "${c.title}" (${c.property_type})
   ${c.bedrooms}BR/${c.bathrooms}BA | Revenue: $${c.annual_revenue.toLocaleString()}/yr | ADR: $${Math.round(c.adr)}
   Occupancy: ${formatOccupancy(c.occupancy)}% | Rating: ${c.rating || 'N/A'}★ | Reviews: ${c.reviews}
   Similarity Score: ${Math.round(c.similarity_score * 100)}%`
).join('\n\n')}

Top Performer Comp Insights:
- Average Revenue in Comp Set: $${Math.round(avgRevenue).toLocaleString()}/yr
- Average Similarity Score: ${Math.round(avgSimilarity * 100)}%
- Common Amenities Among Comps: ${commonAmenities || 'Not available'}
- This reveals what the top performer is competing against and what makes them successful`;
  }
  
  // Build top performer pricing context
  let topPerformerPricingContext = '';
  if (input.top_performer_pricing) {
    const pricing = input.top_performer_pricing;
    const priceDiff = pricing.avg_weekend_price - pricing.avg_weekday_price;
    const priceRange = pricing.price_range_high - pricing.price_range_low;
    const volatilityLevel = priceRange > pricing.avg_weekday_price * 0.5 ? 'high' : priceRange > pricing.avg_weekday_price * 0.25 ? 'moderate' : 'low';
    
    topPerformerPricingContext = `
TOP PERFORMER'S PRICING STRATEGY (${pricing.days_of_data}-Day Forward):
This is how the market's #1 revenue earner prices their listing:
- Weekday Average: $${pricing.avg_weekday_price}/night
- Weekend Average: $${pricing.avg_weekend_price}/night (${pricing.weekend_premium_percent > 0 ? '+' : ''}${pricing.weekend_premium_percent}% premium)
- Price Range: $${pricing.price_range_low} - $${pricing.price_range_high}/night
- Price Volatility: ${volatilityLevel} (${priceRange > 0 ? `$${priceRange} spread` : 'stable'})

Pricing Strategy Insights:
- Weekend premium of ${pricing.weekend_premium_percent}% ${pricing.weekend_premium_percent > 20 ? 'indicates strong weekend demand - consider similar or higher weekend pricing' : pricing.weekend_premium_percent > 10 ? 'shows moderate weekend demand' : 'suggests consistent demand throughout the week'}
- Price range of $${priceRange} ${volatilityLevel === 'high' ? 'indicates significant seasonal/event-based pricing - dynamic pricing is essential' : volatilityLevel === 'moderate' ? 'shows some seasonal variation' : 'suggests stable year-round pricing'}
- To compete, consider pricing weekdays at $${Math.round(pricing.avg_weekday_price * 0.9)}-$${Math.round(pricing.avg_weekday_price * 1.1)} and weekends at $${Math.round(pricing.avg_weekend_price * 0.9)}-$${Math.round(pricing.avg_weekend_price * 1.1)}`;
  }
  
  // Build rentalizer comps context
  let rentalizerCompsContext = '';
  if (input.rentalizer_comps && input.rentalizer_comps.total_comps > 0) {
    const comps = input.rentalizer_comps;
    const competitionLevel = comps.superhost_percentage > 50 ? 'high' : comps.superhost_percentage > 25 ? 'moderate' : 'low';
    const professionalLevel = comps.professional_percentage > 40 ? 'highly professionalized' : comps.professional_percentage > 20 ? 'moderately professionalized' : 'mostly individual hosts';
    
    rentalizerCompsContext = `
HOST QUALITY ANALYSIS (${comps.total_comps} nearby competitors):
This data reveals the quality and professionalism of your direct competition:
- Superhost Presence: ${comps.superhost_count}/${comps.total_comps} (${comps.superhost_percentage.toFixed(0)}%) - ${competitionLevel} competition quality
- Professional Managers: ${comps.professional_count}/${comps.total_comps} (${comps.professional_percentage.toFixed(0)}%) - market is ${professionalLevel}
- Average Distance: ${Math.round(comps.avg_distance_meters)}m from subject property
- Competitor Avg Revenue: $${comps.avg_revenue.toLocaleString()}/yr
- Competitor Avg Rating: ${comps.avg_rating.toFixed(1)}★ (${comps.avg_reviews.toFixed(0)} avg reviews)

Top Nearby Competitors:
${comps.top_comps.slice(0, 5).map((c, i) => 
  `${i + 1}. "${c.title}" - ${c.bedrooms}BR | $${c.annual_revenue.toLocaleString()}/yr | ${c.rating || 'N/A'}★ | ${c.reviews} reviews | ${Math.round(c.distance_meters)}m away${c.superhost ? ' [SUPERHOST]' : ''}${c.professionally_managed ? ' [PRO]' : ''}`
).join('\n')}

Host Quality Insights:
- ${comps.superhost_percentage > 50 ? 'High superhost concentration means guests have high expectations - achieving superhost status is critical' : comps.superhost_percentage > 25 ? 'Moderate superhost presence - quality service will help differentiate' : 'Lower superhost concentration - opportunity to stand out with excellent service'}
- ${comps.professional_percentage > 40 ? 'Many professional managers - expect sophisticated competition with optimized pricing and operations' : comps.professional_percentage > 20 ? 'Mix of professional and individual hosts - room for both approaches' : 'Mostly individual hosts - professional operations could be a competitive advantage'}`;
  }
  
  // Build existing listing context (if property was previously on Airbnb)
  let existingListingContext = '';
  if (input.existing_listing_data) {
    const listing = input.existing_listing_data;
    const performanceLevel = listing.annual_revenue > input.revenue_mid ? 'above average' : listing.annual_revenue > input.revenue_low ? 'average' : 'below average';
    
    existingListingContext = `
EXISTING LISTING DATA (Property was previously on Airbnb):
IMPORTANT: This property has historical performance data from when it was previously listed:
- Previous Listing Title: "${listing.title}"
- Historical Annual Revenue: $${listing.annual_revenue.toLocaleString()}/yr (${performanceLevel} for this market)
- Historical ADR: $${Math.round(listing.adr)}/night
- Historical Occupancy: ${formatOccupancy(listing.occupancy)}%
- Guest Rating: ${listing.rating || 'N/A'}★
- Total Reviews: ${listing.reviews}

This historical data is GOLD - it shows exactly how this property performed before. ${listing.reviews > 50 ? 'With ' + listing.reviews + ' reviews, this is a well-established listing with proven demand.' : listing.reviews > 20 ? 'The review count suggests moderate guest history.' : 'Limited reviews suggest the property may have been listed briefly or recently.'}`;
  }
  
  // Build submarket listings context (hyper-local competition)
  let submarketListingsContext = '';
  if (input.submarket_listings && input.submarket_listings.total_listings > 0) {
    const sub = input.submarket_listings;
    const competitionDensity = sub.total_listings > 100 ? 'highly competitive' : sub.total_listings > 50 ? 'moderately competitive' : 'less saturated';
    const revenueComparison = sub.avg_revenue > input.revenue_mid ? 'above your projections' : sub.avg_revenue > input.revenue_low ? 'in line with your projections' : 'below your projections';
    
    submarketListingsContext = `
HYPER-LOCAL COMPETITION (${sub.submarket_name} Submarket):
This is the immediate neighborhood competition - the listings guests will compare you against:
- Total Listings in Submarket: ${sub.total_listings} (${competitionDensity})
- Submarket Avg Revenue: $${Math.round(sub.avg_revenue).toLocaleString()}/yr (${revenueComparison})
- Submarket Avg ADR: $${Math.round(sub.avg_adr)}/night
- Submarket Avg Occupancy: ${formatOccupancy(sub.avg_occupancy)}%

Top Performers in Your Immediate Area:
${sub.top_listings.slice(0, 5).map((l, i) => 
  `${i + 1}. "${l.name}" - ${l.bedrooms}BR | $${l.annual_revenue.toLocaleString()}/yr | ADR $${Math.round(l.adr)} | ${formatOccupancy(l.occupancy)}% occ | ${l.rating || 'N/A'}★`
).join('\n')}

Submarket Insights:
- ${sub.total_listings > 100 ? 'High listing density means strong competition - differentiation is critical' : sub.total_listings > 50 ? 'Moderate competition - quality and pricing will determine success' : 'Lower competition density - opportunity to capture market share'}
- Submarket average revenue of $${Math.round(sub.avg_revenue).toLocaleString()}/yr ${revenueComparison}`;
  }
  
  // Build qualifying competitors context (those meeting 2x rent threshold)
  let qualifyingCompetitorsContext = '';
  if (input.qualifying_competitors && input.qualifying_competitors.qualifying_count > 0) {
    const qc = input.qualifying_competitors;
    qualifyingCompetitorsContext = `
QUALIFICATION RATE: ${qc.qualification_rate.toFixed(0)}% of ${qc.total_same_bedroom} same-bedroom listings meet $${qc.revenue_threshold.toLocaleString()}/yr threshold (2x rent). Qualifying avg: $${Math.round(qc.avg_qualifying_revenue).toLocaleString()}/yr, ${qc.superhost_percentage.toFixed(0)}% superhosts.`;
  }
  
  // Build radius listings context (hyper-local density within 1km)
  let radiusListingsContext = '';
  if (input.radius_listings && input.radius_listings.total_count > 0) {
    const rl = input.radius_listings;
    const densityAssessment = rl.listings_per_sqkm > 100 ? 'VERY HIGH - extremely competitive micro-market' : 
      rl.listings_per_sqkm > 50 ? 'HIGH - crowded immediate area' : 
      rl.listings_per_sqkm > 20 ? 'MODERATE - typical urban density' : 
      rl.listings_per_sqkm > 10 ? 'LOW - less competitive immediate area' : 
      'VERY LOW - limited nearby competition';
    
    const revenueComparison = rl.avg_revenue > input.revenue_mid ? 
      `Local competitors average $${Math.round(rl.avg_revenue).toLocaleString()}/yr - ABOVE your realistic projection` :
      `Local competitors average $${Math.round(rl.avg_revenue).toLocaleString()}/yr - BELOW your realistic projection`;
    
    radiusListingsContext = `
HYPER-LOCAL COMPETITION (Within 1km / 0.6mi of Property):
This shows the IMMEDIATE neighborhood competition - your closest rivals:
- Total Listings Within 1km: ${rl.total_count}
- Density: ${rl.listings_per_sqkm.toFixed(1)} listings per sq km (${densityAssessment})
- Same-Bedroom Competitors: ${rl.same_bedroom_count} (direct competition)

Neighborhood Averages:
- Average Revenue: $${Math.round(rl.avg_revenue).toLocaleString()}/yr (${revenueComparison})
- Average ADR: $${Math.round(rl.avg_adr)}/night
- Average Occupancy: ${formatOccupancy(rl.avg_occupancy)}%
- Superhost Rate: ${rl.superhost_percentage.toFixed(0)}%
- Professionally Managed: ${rl.professional_percentage.toFixed(0)}%

Top Nearby Competitors:
${rl.top_nearby.slice(0, 5).map((l, i) => 
  `${i + 1}. "${l.title}" (${l.bedrooms}BR) - $${l.annual_revenue.toLocaleString()}/yr | ADR $${Math.round(l.adr)} | ${formatOccupancy(l.occupancy)}% occ${l.distance_meters ? ` | ${l.distance_meters}m away` : ''}`
).join('\n')}

Key Insight: ${rl.listings_per_sqkm > 50 ? 
  `With ${rl.listings_per_sqkm.toFixed(0)} listings per sq km, this is a highly competitive micro-market. Differentiation through amenities, photos, and pricing will be critical.` : 
  `With only ${rl.listings_per_sqkm.toFixed(0)} listings per sq km nearby, there's room to capture local demand without intense immediate competition.`}`;
  }
  
  // Build market saturation context (complete market analysis)
  let marketSaturationContext = '';
  if (input.market_saturation) {
    const ms = input.market_saturation;
    const concentrationDesc = ms.market_concentration === 'concentrated' ? 
      'CONCENTRATED - top performers dominate, hard to break in' :
      ms.market_concentration === 'moderate' ? 
      'MODERATE - balanced competition, room for quality operators' :
      'FRAGMENTED - many small players, opportunity for consolidation';
    
    const bedroomMix = ms.bedroom_distribution.slice(0, 5)
      .map(b => `${b.bedrooms}BR: ${b.count} (${b.percentage.toFixed(0)}%)`)
      .join(', ');
    
    const yourPosition = input.revenue_mid > ms.revenue_percentiles.p75 ? 
      'Your realistic projection puts you in the TOP 25% of the market' :
      input.revenue_mid > ms.revenue_percentiles.p50 ? 
      'Your realistic projection puts you ABOVE MEDIAN but below top quartile' :
      'Your realistic projection is BELOW MEDIAN - you need to outperform to succeed';
    
    marketSaturationContext = `
MARKET SATURATION ANALYSIS (Complete Market Picture):
This shows the ENTIRE market structure and where you'd fit:
- Total Active Listings: ${ms.total_listings}
- Same-Bedroom Competitors: ${ms.same_bedroom_count} (${((ms.same_bedroom_count / ms.total_listings) * 100).toFixed(0)}% of market)
- Market Concentration: ${concentrationDesc}

Bedroom Distribution: ${bedroomMix}

Revenue Distribution:
- 25th Percentile: $${ms.revenue_percentiles.p25.toLocaleString()}/yr (bottom quarter)
- 50th Percentile (Median): $${ms.revenue_percentiles.p50.toLocaleString()}/yr
- 75th Percentile: $${ms.revenue_percentiles.p75.toLocaleString()}/yr (top quarter)
- 90th Percentile: $${ms.revenue_percentiles.p90.toLocaleString()}/yr (top 10%)

Market Averages:
- Average Revenue: $${Math.round(ms.avg_revenue).toLocaleString()}/yr
- Average ADR: $${Math.round(ms.avg_adr)}/night
- Average Occupancy: ${formatOccupancy(ms.avg_occupancy)}%
- Superhost Rate: ${ms.superhost_percentage.toFixed(0)}%
- Professionally Managed: ${ms.professional_percentage.toFixed(0)}%

Your Positioning: ${yourPosition}`;
  }
  
  // Build property type analysis context
  let propertyTypeContext = '';
  if (input.property_type_analysis) {
    const pta = input.property_type_analysis;
    propertyTypeContext = `
PROPERTY TYPE ANALYSIS (Entire Home vs Private Room):
This compares performance between listing types to help you decide how to list:

Entire Home Performance (${pta.entire_home.count} listings analyzed):
- Average Revenue: $${Math.round(pta.entire_home.avg_revenue).toLocaleString()}/yr
- Average ADR: $${Math.round(pta.entire_home.avg_adr)}/night
- Average Occupancy: ${formatOccupancy(pta.entire_home.avg_occupancy)}%
- Superhost Rate: ${pta.entire_home.superhost_percentage.toFixed(0)}%

Private Room Performance (${pta.private_room.count} listings analyzed):
- Average Revenue: $${Math.round(pta.private_room.avg_revenue).toLocaleString()}/yr
- Average ADR: $${Math.round(pta.private_room.avg_adr)}/night
- Average Occupancy: ${formatOccupancy(pta.private_room.avg_occupancy)}%
- Superhost Rate: ${pta.private_room.superhost_percentage.toFixed(0)}%

Revenue Premium: Entire homes earn ${pta.revenue_premium.toFixed(0)}% more than private rooms
Recommended Listing Type: ${pta.recommended_type === 'entire_home' ? 'ENTIRE HOME' : 'PRIVATE ROOM'}
Reason: ${pta.recommendation_reason}`;
  }
  
  // Build nearby markets context
  let nearbyMarketsContext = '';
  if (input.nearby_markets) {
    const nm = input.nearby_markets;
    const alternativesText = nm.alternatives.map(a => 
      `- ${a.name}: Market Score ${a.market_score.toFixed(0)}, Revenue $${Math.round(a.revenue).toLocaleString()}/yr (${a.revenue_vs_current >= 0 ? '+' : ''}${a.revenue_vs_current.toFixed(0)}% vs current), Occupancy ${formatOccupancy(a.occupancy)}%, Regulation Score ${a.regulation_score.toFixed(0)}`
    ).join('\n');
    
    nearbyMarketsContext = `
NEARBY MARKETS COMPARISON:
This compares your market against top-performing alternatives in the country:

Your Current Market: ${nm.current_market.name}
- Market Score: ${nm.current_market.market_score.toFixed(0)}
- Average Revenue: $${Math.round(nm.current_market.revenue).toLocaleString()}/yr
- Occupancy: ${formatOccupancy(nm.current_market.occupancy)}%
- Regulation Score: ${nm.current_market.regulation_score.toFixed(0)} (higher = more STR-friendly)

Top Alternative Markets:
${alternativesText}

Best Alternative: ${nm.best_alternative}
Recommendation: ${nm.recommendation}`;
  }
  
  // Build AirDNA feasibility context
  let airdnaFeasibilityContext = '';
  if (input.airdna_feasibility) {
    const af = input.airdna_feasibility;
    const riskFactors = af.risk_assessment.factors.map(f => `- ${f}`).join('\n');
    const matchStatus = af.comparison.assessment_match 
      ? 'ALIGNED - Our analysis and market data agree within 20%' 
      : `DIVERGENT - Difference of ${Math.abs(af.comparison.profit_difference_pct).toFixed(0)}%`;
    
    airdnaFeasibilityContext = `
MARKET DATA FEASIBILITY ASSESSMENT (Second Opinion):
This is the market data arbitrage calculator providing an independent profitability assessment:

Projections:
- Annual Revenue: $${Math.round(af.projections.annual_revenue).toLocaleString()}
- Annual Profit: $${Math.round(af.projections.annual_profit).toLocaleString()}
- Monthly Profit: $${Math.round(af.projections.monthly_profit).toLocaleString()}
- ROI: ${af.projections.roi_percentage.toFixed(0)}%
- Break-Even Occupancy: ${af.projections.break_even_occupancy.toFixed(0)}%

Risk Assessment:
- Overall Risk: ${af.risk_assessment.overall_risk.toUpperCase()}
- Seasonality Risk: ${af.risk_assessment.seasonality_risk}
- Regulation Risk: ${af.risk_assessment.regulation_risk}
- Market Saturation: ${af.risk_assessment.market_saturation}

Risk Factors:
${riskFactors}

Market Data Recommendation: ${af.recommendation}

Comparison with Our Analysis:
- Our Annual Profit Estimate: $${Math.round(af.comparison.our_annual_profit).toLocaleString()}
- Market Data Annual Profit Estimate: $${Math.round(af.comparison.airdna_annual_profit).toLocaleString()}
- Difference: $${Math.round(af.comparison.profit_difference).toLocaleString()} (${af.comparison.profit_difference_pct >= 0 ? '+' : ''}${af.comparison.profit_difference_pct.toFixed(0)}%)
- Assessment Status: ${matchStatus}`;
  }
  
  // Build submarket deep-dive context
  let submarketDeepDiveContext = '';
  if (input.submarket_deep_dive) {
    const sd = input.submarket_deep_dive;
    const bedroomPerf = sd.bedroom_performance
      .map(b => `${b.bedrooms}BR: ${b.count} listings, $${Math.round(b.avg_revenue).toLocaleString()} avg revenue, $${Math.round(b.avg_adr)} ADR, ${formatOccupancy(b.avg_occupancy)}% occupancy`)
      .join('\n');
    const topPerformers = sd.top_performers
      .map(p => `- ${p.title}: ${p.bedrooms}BR, $${Math.round(p.annual_revenue).toLocaleString()} revenue, $${Math.round(p.adr)} ADR, ${formatOccupancy(p.occupancy)}% occ, ${p.rating.toFixed(1)}★`)
      .join('\n');
    
    submarketDeepDiveContext = `
SUBMARKET DEEP-DIVE (Neighborhood Analysis):
Submarket: ${sd.submarket_name}
Total Listings in Submarket: ${sd.listing_count}

Submarket Metrics:
- Average Revenue: $${Math.round(sd.metrics.revenue).toLocaleString()}
- Average ADR: $${Math.round(sd.metrics.adr)}
- Average Occupancy: ${formatOccupancy(sd.metrics.occupancy)}%
- RevPAR: $${Math.round(sd.metrics.revpar)}

Bedroom Performance in Submarket:
${bedroomPerf}

Top Performers in Submarket:
${topPerformers}

Submarket Insights:
- Revenue Trend: ${sd.insights.revenue_trend.toUpperCase()}
- Occupancy Trend: ${sd.insights.occupancy_trend.toUpperCase()}
- Market Health: ${sd.insights.market_health.toUpperCase()}
- Growth Potential: ${sd.insights.growth_potential.toUpperCase()}`;
  }
  
  // Build competitor imagery context
  let competitorImageryContext = '';
  if (input.competitor_imagery) {
    const ci = input.competitor_imagery;
    const topComps = ci.top_competitors
      .map(c => `- ${c.name}: ${c.image_count} photos${c.has_professional_photos ? ' (professional quality)' : ''}`)
      .join('\n');
    
    competitorImageryContext = `
COMPETITOR IMAGERY ANALYSIS:
Competitors Analyzed: ${ci.total_competitors_analyzed}
Competitors with Images: ${ci.competitors_with_images}

Photo Statistics:
- Average Photo Count: ${ci.avg_image_count}
- Maximum Photo Count: ${ci.max_image_count}
- Minimum Photo Count: ${ci.min_image_count}

Top Competitors by Photo Count:
${topComps}

Photo Quality Insights:
- High Photo Threshold: ${ci.photo_quality_insights.high_photo_count_threshold}+ photos
- Competitors Above Threshold: ${ci.photo_quality_insights.competitors_above_threshold}
- Recommendation: ${ci.photo_quality_insights.recommendation}`;
  }

  // Build submarket details section
  let submarketDetailsSection = '';
  if (input.submarket_details) {
    const sd = input.submarket_details;
    submarketDetailsSection = `

SUBMARKET GEOGRAPHIC CONTEXT:
- Submarket: ${sd.submarket_name}
- Parent Market: ${sd.parent_market_name || 'N/A'}
- Market Type: ${sd.market_type || 'N/A'}
${sd.metrics ? `
Submarket Metrics:
- Market Score: ${sd.metrics.market_score}/100
- Average Revenue: $${sd.metrics.revenue.toLocaleString()}/year
- Occupancy: ${formatOccupancy(sd.metrics.occupancy)}%
- ADR: $${sd.metrics.adr.toFixed(0)}/night
- RevPAR: $${sd.metrics.revpar.toFixed(0)}` : ''}`;
  }

  // Build all submarkets comparison section
  let allSubmarketsSection = '';
  if (input.all_submarkets && input.all_submarkets.submarkets.length > 0) {
    const as = input.all_submarkets;
    const submarketList = as.submarkets.map((s, i) => {
      const isPropertySubmarket = s.name.toLowerCase() === as.property_submarket_name.toLowerCase();
      const marker = isPropertySubmarket ? ' ← YOUR PROPERTY' : '';
      return `${i + 1}. ${s.name}${marker}: $${s.revenue.toLocaleString()}/yr revenue, ${formatOccupancy(s.occupancy)}% occupancy, $${s.adr.toFixed(0)} ADR, ${s.listing_count} listings`;
    }).join('\n');
    
    allSubmarketsSection = `

NEIGHBORHOOD COMPARISON (All Submarkets in Market):
Property's Submarket: ${as.property_submarket_name}
Property's Rank: #${as.property_submarket_rank} of ${as.total_submarkets} neighborhoods (by revenue)

All Neighborhoods Ranked by Revenue:
${submarketList}`;
  }

  // Build enhanced submarket exploration section
  let submarketExplorationSection = '';
  if (input.submarket_exploration && input.submarket_exploration.submarkets.length > 0) {
    const se = input.submarket_exploration;
    const submarketRankings = se.submarkets.map((s, i) => {
      const isPropertySubmarket = s.name.toLowerCase() === se.property_submarket_name.toLowerCase();
      const marker = isPropertySubmarket ? ' ← YOUR PROPERTY' : '';
      const recMarker = s.recommendation ? ` [${s.recommendation}]` : '';
      return `${i + 1}. ${s.name}${marker}${recMarker}
   Score: ${s.ranking.overall_score}/100 | Revenue Rank: #${s.ranking.revenue_rank} | Occupancy Rank: #${s.ranking.occupancy_rank} | RevPAR Rank: #${s.ranking.revpar_rank}
   $${s.metrics.revenue.toLocaleString()}/yr | ${formatOccupancy(s.metrics.occupancy)}% occ | $${s.metrics.adr.toFixed(0)} ADR | ${s.listing_count} listings`;
    }).join('\n\n');
    
    const topRec = se.top_recommendation;
    submarketExplorationSection = `

ENHANCED NEIGHBORHOOD ANALYSIS (Multi-Factor Ranking):
Market: ${se.market_name}
Market Metrics: $${se.market_metrics.revenue.toLocaleString()}/yr avg revenue, ${formatOccupancy(se.market_metrics.occupancy)}% occupancy, $${se.market_metrics.adr.toFixed(0)} ADR, ${se.market_metrics.active_listings} listings

Property's Neighborhood: ${se.property_submarket_name}
Property's Overall Score: ${se.property_submarket_overall_score}/100
Property's Rank: #${se.property_submarket_rank} of ${se.submarkets.length} neighborhoods

${topRec ? `TOP RECOMMENDATION: ${topRec.name}
- Overall Score: ${topRec.overall_score}/100
- Revenue: $${topRec.revenue.toLocaleString()}/year
- Occupancy: ${formatOccupancy(topRec.occupancy)}%
- Why: ${topRec.recommendation}\n\n` : ''}Neighborhood Rankings (by Overall Score):
${submarketRankings}`;
  }

  // Build market insights section
  let marketInsightsSection = '';
  if (input.market_insights) {
    const mi = input.market_insights;
    const propertyTypeList = mi.property_type_breakdown.map((pt, i) => 
      `${i + 1}. ${pt.type}: ${pt.count} listings (${pt.pct}%) - Avg Revenue: $${pt.avg_revenue.toLocaleString()}/yr`
    ).join('\n');
    
    const hostSizeList = mi.host_size_breakdown.map((hs, i) => 
      `${i + 1}. ${hs.size}: ${hs.count} hosts (${hs.pct}%) - Avg Revenue: $${hs.avg_revenue.toLocaleString()}/yr`
    ).join('\n');
    
    marketInsightsSection = `

MARKET COMPOSITION INSIGHTS (Derived from ${mi.total_listings} Listings):
Host Quality Metrics:
- Superhosts: ${mi.superhost_count} (${mi.superhost_pct}%)
- Professionally Managed: ${mi.professionally_managed_count} (${mi.professionally_managed_pct}%)
- Average Rating: ${mi.avg_rating}★
- Average Reviews: ${mi.avg_reviews}

Property Type Breakdown:
${propertyTypeList}

Host Size Distribution:
${hostSizeList}

Revenue Distribution (Percentiles):
- 10th percentile: $${mi.revenue_percentiles.p10.toLocaleString()}/yr (bottom performers)
- 25th percentile: $${mi.revenue_percentiles.p25.toLocaleString()}/yr
- 50th percentile (median): $${mi.revenue_percentiles.p50.toLocaleString()}/yr
- 75th percentile: $${mi.revenue_percentiles.p75.toLocaleString()}/yr
- 90th percentile: $${mi.revenue_percentiles.p90.toLocaleString()}/yr (top performers)`;
  }

  // Build same bedroom radius listings section
  let sameBedroomRadiusSection = '';
  if (input.same_bedroom_radius_listings) {
    const sbr = input.same_bedroom_radius_listings;
    const superhostPct = sbr.total_found > 0 ? Math.round((sbr.superhost_count / sbr.total_found) * 100) : 0;
    const professionalPct = sbr.total_found > 0 ? Math.round((sbr.professional_count / sbr.total_found) * 100) : 0;
    
    const topPerformersList = sbr.top_performers.map((tp, i) => 
      `${i + 1}. "${tp.title}" (${tp.property_type})
   Revenue: $${tp.annual_revenue.toLocaleString()}/yr | ADR: $${Math.round(tp.adr)} | Occupancy: ${formatOccupancy(tp.occupancy)}%
   Rating: ${tp.rating || 'N/A'}★ | Reviews: ${tp.reviews} | ${tp.superhost ? 'Superhost' : ''} ${tp.professionally_managed ? '| Professional' : ''}`
    ).join('\n\n');
    
    sameBedroomRadiusSection = `

DIRECT COMPETITOR ANALYSIS (Same ${sbr.bedroom_filter}BR within ${(sbr.search_radius_meters / 1000).toFixed(1)}km):
This shows ONLY ${sbr.bedroom_filter}-bedroom listings near the property - your direct competition.

Summary:
- Total Direct Competitors: ${sbr.total_found}
- Average Revenue: $${Math.round(sbr.avg_revenue).toLocaleString()}/yr
- Average ADR: $${Math.round(sbr.avg_adr)}/night
- Average Occupancy: ${formatOccupancy(sbr.avg_occupancy)}%
- Superhosts: ${sbr.superhost_count} (${superhostPct}%)
- Professionally Managed: ${sbr.professional_count} (${professionalPct}%)

Top ${sbr.bedroom_filter}BR Performers Nearby:
${topPerformersList}`;
  }

  // Build superhost top performers section
  let superhostTopPerformersSection = '';
  if (input.superhost_top_performers) {
    const stp = input.superhost_top_performers;
    
    const topSuperhostsList = stp.top_superhosts.map((sh, i) => 
      `${i + 1}. "${sh.title}" (${sh.property_type}, ${sh.bedrooms}BR)
   Revenue: $${sh.annual_revenue.toLocaleString()}/yr | ADR: $${Math.round(sh.adr)} | Occupancy: ${formatOccupancy(sh.occupancy)}%
   Rating: ${sh.rating || 'N/A'}★ | Reviews: ${sh.reviews}`
    ).join('\n\n');
    
    superhostTopPerformersSection = `

SUPERHOST EXCELLENCE BENCHMARK:
This shows what the TOP SUPERHOSTS in this market achieve - the gold standard for performance.

Superhost Market Overview:
- Total Superhosts in Market: ${stp.total_superhosts_in_market}
- Average Superhost Revenue: $${stp.avg_superhost_revenue.toLocaleString()}/yr
- Average Superhost Rating: ${stp.avg_superhost_rating}★
- Average Superhost Reviews: ${stp.avg_superhost_reviews}
- Revenue Premium vs Market: ${stp.revenue_premium_vs_market > 0 ? '+' : ''}${stp.revenue_premium_vs_market}%

Top Superhost Performers:
${topSuperhostsList}`;
  }

  // ============================================
  // PRE-COMPUTED CALCULATIONS FOR GEMINI
  // These reduce cognitive load and ensure consistent analysis
  // ============================================
  
  // 1. REVENUE-TO-RENT ANALYSIS
  const annualRent = input.monthly_rent * 12;
  const revenueToRentRatioConservative = input.revenue_low / annualRent;
  const revenueToRentRatioRealistic = input.revenue_mid / annualRent;
  const revenueToRentRatioOptimistic = input.revenue_high / annualRent;
  const meetsThreshold = revenueToRentRatioRealistic >= 2.5;
  const thresholdGap = meetsThreshold ? 0 : (annualRent * 2.5) - input.revenue_mid;
  
  // 2. REVPAR CALCULATIONS (Revenue Per Available Room-Night)
  const marketRevPAR = input.market_adr * (input.market_occupancy > 1 ? input.market_occupancy / 100 : input.market_occupancy);
  const projectedRevPAR = input.revenue_mid / 365;
  const revPARvsMarket = ((projectedRevPAR - marketRevPAR) / marketRevPAR * 100).toFixed(1);
  
  // 3. BREAK-EVEN ANALYSIS
  const monthlyExpenses = input.monthly_expenses;
  const breakEvenADR = monthlyExpenses / (30 * (input.market_occupancy > 1 ? input.market_occupancy / 100 : input.market_occupancy));
  const breakEvenOccupancy = monthlyExpenses / (input.market_adr * 30);
  const cushionAboveBreakEven = ((input.market_occupancy > 1 ? input.market_occupancy / 100 : input.market_occupancy) - breakEvenOccupancy) * 100;
  
  // 4. SENSITIVITY ANALYSIS (What if scenarios)
  const occupancyDrop10 = {
    newOccupancy: (input.market_occupancy > 1 ? input.market_occupancy / 100 : input.market_occupancy) * 0.9,
    newRevenue: input.revenue_mid * 0.9,
    newProfit: (input.revenue_mid * 0.9) - (input.monthly_expenses * 12),
    profitChange: input.annual_profit_realistic - ((input.revenue_mid * 0.9) - (input.monthly_expenses * 12))
  };
  const occupancyDrop20 = {
    newOccupancy: (input.market_occupancy > 1 ? input.market_occupancy / 100 : input.market_occupancy) * 0.8,
    newRevenue: input.revenue_mid * 0.8,
    newProfit: (input.revenue_mid * 0.8) - (input.monthly_expenses * 12),
    profitChange: input.annual_profit_realistic - ((input.revenue_mid * 0.8) - (input.monthly_expenses * 12))
  };
  const stillProfitableAt80Occ = occupancyDrop20.newProfit > 0;
  
  // 5. REVENUE GAP ANALYSIS
  const topPerformerRevenue = input.competitors[0]?.annual_revenue || input.revenue_high;
  const revenueGapToTop = topPerformerRevenue - input.revenue_mid;
  const revenueGapPercent = ((topPerformerRevenue - input.revenue_mid) / input.revenue_mid * 100).toFixed(1);
  
  // 6. TIME-TO-SUPERHOST CALCULATION
  const avgStayLength = input.booking_patterns?.avg_length_of_stay || 3;
  const estimatedOccupancy = input.market_occupancy > 1 ? input.market_occupancy / 100 : input.market_occupancy;
  const bookedNightsPerMonth = 30 * estimatedOccupancy;
  const bookingsPerMonth = bookedNightsPerMonth / avgStayLength;
  const reviewConversionRate = 0.5; // Industry average: 50% of guests leave reviews
  const reviewsPerMonth = bookingsPerMonth * reviewConversionRate;
  const monthsTo10Reviews = reviewsPerMonth > 0 ? Math.ceil(10 / reviewsPerMonth) : 12;
  const monthsTo50Reviews = reviewsPerMonth > 0 ? Math.ceil(50 / reviewsPerMonth) : 24;
  // Superhost requires: 10+ trips, 4.8+ rating, <1% cancellation, 90% response rate
  const monthsToSuperhostEligibility = Math.max(monthsTo10Reviews, 3); // Minimum 3 months
  
  // 7. QUALIFICATION RATE ANALYSIS
  const qualificationRate = input.qualifying_competitors?.qualification_rate || 0;
  const qualificationAssessment = qualificationRate > 50 ? 'STRONG' : 
    qualificationRate > 30 ? 'MODERATE' : 
    qualificationRate > 15 ? 'CHALLENGING' : 'DIFFICULT';
  
  // 8. SEASONAL SWING ANALYSIS
  const seasonalSwing = avgPeakRevenue > 0 && avgOffRevenue > 0 ? 
    ((avgPeakRevenue - avgOffRevenue) / avgOffRevenue * 100).toFixed(1) : '0';
  const cashReservesNeeded = avgOffRevenue > monthlyExpenses ? 0 : 
    (monthlyExpenses - avgOffRevenue) * (input.seasonality.filter(s => s.season_type === 'off').length || 3);
  
  // 9. COMPETITION DENSITY ANALYSIS
  const competitionDensity = input.radius_listings?.listings_per_sqkm || 0;
  const competitionLevel = competitionDensity > 100 ? 'VERY HIGH' : 
    competitionDensity > 50 ? 'HIGH' : 
    competitionDensity > 20 ? 'MODERATE' : 'LOW';
  
  // 10. AMENITY GAP ANALYSIS
  const topPerformerAmenities = new Set<string>();
  const avgPerformerAmenities = new Set<string>();
  input.competitors.slice(0, 3).forEach(c => {
    (c.amenities || []).forEach(a => topPerformerAmenities.add(a));
  });
  input.competitors.slice(-3).forEach(c => {
    (c.amenities || []).forEach(a => avgPerformerAmenities.add(a));
  });
  const amenityGaps = Array.from(topPerformerAmenities).filter(a => !avgPerformerAmenities.has(a));
  
  // Build pre-computed calculations context for prompt
  // Pre-computed values for key metrics (used in prompt)
  const preComputedSummary = `
KEY METRICS:
- Revenue-to-Rent: ${revenueToRentRatioRealistic.toFixed(2)}x (threshold: 2.5x) - ${meetsThreshold ? 'MEETS' : 'BELOW'}
- Break-even Occupancy: ${(breakEvenOccupancy * 100).toFixed(0)}%
- Qualification Rate: ${qualificationRate.toFixed(0)}% of similar properties profitable
- Competition: ${competitionLevel} (${competitionDensity.toFixed(0)} listings/sq km)`;

  const prompt = `You are a professional short-term rental investment analyst writing a comprehensive report for an investor. Your job is to synthesize all the data into a narrative document that tells the complete story of this investment opportunity.

Write in a professional but accessible tone. Use specific numbers from the data. Explain what the numbers mean and why they matter. Be honest about both opportunities and risks.

PROPERTY DETAILS:
- Address: ${input.address}
- Monthly Rent: $${input.monthly_rent.toLocaleString()}
- Configuration: ${input.bedrooms} bedrooms, ${input.bathrooms} bathrooms

MARKET OVERVIEW:
- Market: ${input.market_name}
- Regional Market Occupancy: ${formatOccupancy(input.market_occupancy)}% (broader market average)
- Regional Market ADR: $${input.market_adr.toFixed(0)} (broader market average)
- Direct Competitors Analyzed: ${input.active_listings} (nearby same-bedroom properties - THIS is your competitive set)
${input.regional_active_listings ? `- Regional Active Listings: ${input.regional_active_listings.toLocaleString()} (total in broader market area, all bedroom types)` : ''}
${input.same_bedroom_regional_count ? `- Same-Bedroom Regional Listings: ${input.same_bedroom_regional_count.toLocaleString()} (${input.bedrooms}-bedroom properties in the regional market)` : ''}

IMPORTANT DATA CONTEXT:
- When discussing "active listings" or "market size" in your analysis, use the Direct Competitors count (${input.active_listings}), NOT regional totals.
- The regional occupancy/ADR figures provide broader market context, but your revenue projections are based on the ${input.active_listings} direct competitors analyzed.
- Always be clear about which data you're referencing: local competitors vs regional market.

REVENUE PROJECTIONS:
- Conservative (50th percentile): $${input.revenue_low.toLocaleString()}/year
- Realistic (75th percentile): $${input.revenue_mid.toLocaleString()}/year  
- Optimistic (90th percentile): $${input.revenue_high.toLocaleString()}/year

PROFITABILITY:
- Monthly Operating Expenses: $${input.monthly_expenses.toLocaleString()}
- Annual Profit (Conservative): $${input.annual_profit_conservative.toLocaleString()}
- Annual Profit (Realistic): $${input.annual_profit_realistic.toLocaleString()}
- Annual Profit (Optimistic): $${input.annual_profit_optimistic.toLocaleString()}

TOP COMPETITORS (${input.competitors.length} analyzed):
${competitorSummary}

COMPETITOR INSIGHTS:
- Superhosts: ${superhostCount} of ${input.competitors.length} (${Math.round(superhostCount / input.competitors.length * 100)}%)
- Professional Hosts: ${proCount} of ${input.competitors.length} (${Math.round(proCount / input.competitors.length * 100)}%)
- Superhost Avg Revenue: $${Math.round(superhostAvgRevenue).toLocaleString()}/yr vs Non-Superhost: $${Math.round(nonSuperhostAvgRevenue).toLocaleString()}/yr
- Most Common Amenities: ${topCompetitorAmenities || 'Not available'}

SEASONALITY:
- Peak Months: ${peakMonths || 'Not identified'}
- Off-Season Months: ${offMonths || 'Not identified'}
- Average Peak Revenue: $${avgPeakRevenue.toFixed(0)}/month
- Average Off-Season Revenue: $${avgOffRevenue.toFixed(0)}/month
${historicalContext}
${qualifyingCompetitorsContext}
${preComputedSummary}

---

Generate a comprehensive investment report. Return JSON:
{
  "executive_summary": "Overview with revenue-to-rent ratio and qualification rate.",
  "market_overview": "Market size, competition, and bedroom distribution.",
  "revenue_analysis": "Revenue projections and profitability probability.",
  "competitive_landscape": "Competitor analysis and differentiation strategies.",
  "seasonal_strategy": "Peak/off-season patterns and pricing recommendations.",
  "historical_context": "5-year trends and market trajectory.",
  "risk_assessment": "Key risks and mitigation strategies.",
  "financial_outlook": "Cash flow, break-even, and scenarios.",
  "conclusion": "Summary with key considerations and action items.",
  
  "key_metrics": {
    "projected_annual_revenue": <number>,
    "projected_monthly_profit": <number>,
    "market_occupancy": <number 0.0-1.0>,
    "market_adr": <number>,
    "break_even_occupancy": <number>,
    "confidence_level": <"high"|"medium"|"low">,
    "revenue_to_rent_ratio": <number>,
    "qualification_rate": <number>,
    "direct_competitor_count": <number>
  },
  
  "quick_facts": [
    "Revenue-to-rent ratio: X.Xx",
    "Qualification rate: X% of Y similar properties profitable",
    "Break-even: X% occupancy needed",
    "Market trajectory: GROWING/STABLE/DECLINING"
  ]
}

CRITICAL FORMATTING RULES:
- Write in flowing paragraphs, NOT bullet points
- Use specific numbers from the data - never say 'high' or 'low' without a number
- Every claim must be backed by data from a specific section
- Explain what numbers mean, don't just state them
- Write for someone who may be new to STR investing
- The tone should be professional but accessible, like a trusted advisor

KEY DEFINITIONS (use these consistently):
- Revenue-to-Rent Ratio: Annual STR Revenue ÷ Annual Rent (target: 2.5x or higher for profitability)
- Monthly Profit: (Monthly Revenue) - (Monthly Rent + Operating Expenses)
- Break-even Occupancy: Minimum occupancy percentage needed to cover all costs
- Direct Competitors: The ${input.active_listings} nearby same-bedroom properties analyzed

DATA CONSISTENCY RULES:
1. When stating "active listings" or "competitors", use the exact count from TOP COMPETITORS section (${input.active_listings})
2. The occupancy and ADR figures are REGIONAL averages - note this context when referencing them
3. Revenue projections are based on LOCAL comparable performance, not regional averages
4. Always cross-reference numbers you cite with the data sections provided above
5. If occupancy exceeds 100%, note this as a data anomaly and use capped values
6. If metrics seem inconsistent, acknowledge the limitation rather than fabricating explanations

KEY REQUIREMENTS:
1. Use specific numbers from data - no vague terms
2. State revenue-to-rent ratio
3. State qualification rate (% of competitors profitable)
4. State break-even occupancy %
5. Calculate monthly profit = (revenue/12) - expenses
6. DO NOT include any GO/CAUTION/PASS verdict language - let the reader draw their own conclusions
7. When discussing market size, refer to the ${input.active_listings} direct competitors, not broader regional statistics`;

  const reportSchema = {
    type: 'object',
    properties: {
      executive_summary: { type: 'string' },
      market_overview: { type: 'string' },
      revenue_analysis: { type: 'string' },
      competitive_landscape: { type: 'string' },
      seasonal_strategy: { type: 'string' },
      historical_context: { type: 'string' },
      risk_assessment: { type: 'string' },
      financial_outlook: { type: 'string' },
      conclusion: { type: 'string' },
      key_metrics: {
        type: 'object',
        properties: {
          projected_annual_revenue: { type: 'number' },
          projected_monthly_profit: { type: 'number' },
          market_occupancy: { type: 'number' },
          market_adr: { type: 'number' },
          break_even_occupancy: { type: 'number' },
          confidence_level: { type: 'string', enum: ['high', 'medium', 'low'] },
          revenue_to_rent_ratio: { type: 'number' },
          qualification_rate: { type: 'number' },
          direct_competitor_count: { type: 'integer' }
        },
        required: ['projected_annual_revenue', 'projected_monthly_profit', 'market_occupancy', 'market_adr', 'confidence_level', 'revenue_to_rent_ratio']
      },
      quick_facts: { type: 'array', items: { type: 'string' } }
    },
    required: ['executive_summary', 'market_overview', 'revenue_analysis', 'competitive_landscape', 'seasonal_strategy', 'risk_assessment', 'financial_outlook', 'conclusion', 'key_metrics', 'quick_facts']
  };

  // Build mode-aware system instruction
  const baseSystemInstruction = 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist managing $100M+ across 400+ properties in 35 U.S. markets. You are writing a comprehensive property report. Write in flowing paragraphs, not bullet points. Every claim must reference specific numbers from the data.';
  const modeOverride = input.reportMode === 'pro'
    ? ' Address the reader as a peer investor. Use precise financial terminology (ADR, RevPAR, Cap Rate, DSCR, CoC) without explanation. Be concise and data-dense. Benchmark against industry standards. Focus on investment thesis and risk-adjusted returns.'
    : ' Use the story-before-the-stats approach. Write for someone who may be new to STR investing. Be professional but accessible, like a trusted advisor sharing insights over coffee. Never sugarcoat risks but always empower.';

  try {
    const response = await callGemini({
      prompt,
      systemInstruction: baseSystemInstruction + modeOverride,
      responseSchema: reportSchema,
      maxTokens: 8192
    });
    const parsed = JSON.parse(response);
    
    return {
      executive_summary: parsed.executive_summary || 'Analysis in progress...',
      market_overview: parsed.market_overview || '',
      revenue_analysis: parsed.revenue_analysis || '',
      competitive_landscape: parsed.competitive_landscape || '',
      seasonal_strategy: parsed.seasonal_strategy || '',
      historical_context: parsed.historical_context || '',
      risk_assessment: parsed.risk_assessment || '',
      financial_outlook: parsed.financial_outlook || '',
      conclusion: parsed.conclusion || '',
      key_metrics: {
        projected_annual_revenue: parsed.key_metrics?.projected_annual_revenue || input.revenue_mid,
        projected_monthly_profit: parsed.key_metrics?.projected_monthly_profit || Math.round(input.annual_profit_realistic / 12),
        market_occupancy: parsed.key_metrics?.market_occupancy || input.market_occupancy,
        market_adr: parsed.key_metrics?.market_adr || input.market_adr,
        break_even_months: parsed.key_metrics?.break_even_months || 12,
        confidence_level: parsed.key_metrics?.confidence_level || 'medium',
        revenue_to_rent_ratio: parsed.key_metrics?.revenue_to_rent_ratio || revenueToRentRatioRealistic,
        qualification_rate: parsed.key_metrics?.qualification_rate || qualificationRate,
        neighborhood_rank: parsed.key_metrics?.neighborhood_rank || (input.submarket_exploration ? `#${input.submarket_exploration.property_submarket_rank} of ${input.submarket_exploration.submarkets.length}` : undefined),
        superhost_premium: parsed.key_metrics?.superhost_premium || input.superhost_top_performers?.revenue_premium_vs_market,
        direct_competitor_count: parsed.key_metrics?.direct_competitor_count || input.same_bedroom_radius_listings?.total_found,
        // New enhanced metrics with fallbacks from pre-computed values
        break_even_occupancy: parsed.key_metrics?.break_even_occupancy || (breakEvenOccupancy * 100),
        cushion_above_breakeven: parsed.key_metrics?.cushion_above_breakeven || cushionAboveBreakEven,
        seasonal_swing_percent: parsed.key_metrics?.seasonal_swing_percent || parseFloat(seasonalSwing),
        time_to_superhost_months: parsed.key_metrics?.time_to_superhost_months || monthsToSuperhostEligibility,
        revpar_vs_market: parsed.key_metrics?.revpar_vs_market || parseFloat(revPARvsMarket),
        top_performer_gap: parsed.key_metrics?.top_performer_gap || revenueGapToTop,
        cash_reserves_needed: parsed.key_metrics?.cash_reserves_needed || cashReservesNeeded,
        year_1_roi: parsed.key_metrics?.year_1_roi,
        year_2_roi: parsed.key_metrics?.year_2_roi
      },
      quick_facts: parsed.quick_facts || []
    };
  } catch (error) {
    console.error('[GeminiAnalyzer] Error generating narrative report:', error);
    
    // Return a basic fallback report
    return {
      executive_summary: `This ${input.bedrooms}-bedroom property at ${input.address} presents a potential short-term rental opportunity in the ${input.market_name} market. With a monthly rent of $${input.monthly_rent.toLocaleString()}, the property could generate between $${input.revenue_low.toLocaleString()} and $${input.revenue_high.toLocaleString()} annually based on market comparables.`,
      market_overview: `The ${input.market_name} market shows an occupancy rate of ${formatOccupancy(input.market_occupancy)}% with an average daily rate of $${input.market_adr.toFixed(0)}. There are currently ${input.active_listings} active listings in the area.`,
      revenue_analysis: `Revenue projections range from $${input.revenue_low.toLocaleString()} (conservative) to $${input.revenue_high.toLocaleString()} (optimistic), with a realistic target of $${input.revenue_mid.toLocaleString()} annually.`,
      competitive_landscape: `The market includes ${input.competitors.length} comparable properties. Top performers are achieving annual revenues of $${input.competitors[0]?.annual_revenue?.toLocaleString() || 'N/A'}.`,
      seasonal_strategy: `Peak season months include ${peakMonths || 'varies by market'}. Off-season months are ${offMonths || 'varies by market'}.`,
      historical_context: input.five_year_summary 
        ? `The market has shown ${input.five_year_summary.revenue.trend} revenue trends over the past ${input.five_year_summary.years_of_data} years.`
        : 'Historical data analysis is pending.',
      risk_assessment: 'Key risks include market saturation, seasonal fluctuations, and regulatory changes. Proper management and competitive positioning can help mitigate these risks.',
      financial_outlook: `With monthly expenses of approximately $${input.monthly_expenses.toLocaleString()}, the realistic profit scenario projects $${input.annual_profit_realistic.toLocaleString()} annually.`,
      conclusion: 'This property warrants further investigation. Consider visiting the property, reviewing local regulations, and developing a detailed business plan before proceeding.',
      key_metrics: {
        projected_annual_revenue: input.revenue_mid,
        projected_monthly_profit: Math.round(input.annual_profit_realistic / 12),
        market_occupancy: input.market_occupancy,
        market_adr: input.market_adr,
        break_even_months: 12,
        confidence_level: 'medium',
        revenue_to_rent_ratio: revenueToRentRatioRealistic,
        qualification_rate: qualificationRate,
        neighborhood_rank: input.submarket_exploration ? `#${input.submarket_exploration.property_submarket_rank} of ${input.submarket_exploration.submarkets.length}` : undefined,
        superhost_premium: input.superhost_top_performers?.revenue_premium_vs_market,
        direct_competitor_count: input.same_bedroom_radius_listings?.total_found,
        // New enhanced metrics
        break_even_occupancy: breakEvenOccupancy * 100,
        cushion_above_breakeven: cushionAboveBreakEven,
        seasonal_swing_percent: parseFloat(seasonalSwing),
        time_to_superhost_months: monthsToSuperhostEligibility,
        revpar_vs_market: parseFloat(revPARvsMarket),
        top_performer_gap: revenueGapToTop,
        cash_reserves_needed: cashReservesNeeded
      },
      quick_facts: [
        `Revenue-to-rent ratio: ${revenueToRentRatioRealistic.toFixed(2)}x - ${meetsThreshold ? 'MEETS' : 'BELOW'} 2.5x threshold`,
        `Qualification rate: ${qualificationRate.toFixed(1)}% of similar properties are profitable - ${qualificationAssessment}`,
        `Break-even occupancy: ${(breakEvenOccupancy * 100).toFixed(1)}% - Cushion: ${cushionAboveBreakEven.toFixed(1)} points`,
        `Direct competitors: ${input.same_bedroom_radius_listings?.total_found || 'N/A'} same-bedroom listings nearby`,
        `Superhost premium: +${input.superhost_top_performers?.revenue_premium_vs_market || 'N/A'}% - Time to achieve: ~${monthsToSuperhostEligibility} months`,
        `Sensitivity: At 80% occupancy, profit is $${occupancyDrop20.newProfit.toLocaleString()}/year - ${stillProfitableAt80Occ ? 'STILL PROFITABLE' : 'LOSS'}`,
        `Cash reserves needed: $${cashReservesNeeded.toLocaleString()} for slow season`,
        `Market RevPAR comparison: ${revPARvsMarket}% vs market average`,
        `Top performer gap: $${revenueGapToTop.toLocaleString()}/year below top performer`,
        `Qualification assessment: ${qualificationAssessment}`
      ]
    };
  }
}

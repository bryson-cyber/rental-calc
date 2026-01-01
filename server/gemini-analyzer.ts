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
 * - Investment verdict generation (BUY/HOLD/PASS with confidence)
 * - Pricing strategy recommendations
 * - Risk and opportunity assessment
 * - Personalized action plans
 */

import { ENV } from './_core/env';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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
  revenue: number;
  occupancy: number;
  adr: number;
  season_type: 'Peak' | 'Shoulder' | 'Slow';
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
  rating: 'STRONG BUY' | 'BUY' | 'HOLD' | 'PASS';
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
// CORE GEMINI CALL FUNCTION
// ============================================

async function callGemini(prompt: string, maxTokens: number = 4096): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${ENV.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: maxTokens,
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
      contents: [{
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
        temperature: 0.7,
        maxOutputTokens: maxTokens,
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini Vision API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
  const prompt = `You are an expert Airbnb arbitrage analyst. Analyze this specific property opportunity and generate 4-5 UNIQUE insights that are specific to THIS property - not generic advice.

PROPERTY:
- Address: ${property.address}
- Configuration: ${property.bedrooms}BR/${property.bathrooms}BA
- Monthly Rent: $${property.monthly_rent.toLocaleString()}
- Annual Rent: $${(property.monthly_rent * 12).toLocaleString()}
- Minimum Revenue Needed (2x rule): $${(property.monthly_rent * 24).toLocaleString()}

MARKET DATA:
- Market: ${market.name}
- Average Occupancy: ${market.occupancy}%
- Average Daily Rate: $${market.adr}
- Average Annual Revenue: $${market.revenue.toLocaleString()}
- Active Listings: ${market.active_listings.toLocaleString()}

REVENUE PERCENTILES (${property.bedrooms}BR properties):
- Top 10%: $${percentiles.top_10_percent.toLocaleString()}/year
- Top 25%: $${percentiles.top_25_percent.toLocaleString()}/year
- Median: $${percentiles.median.toLocaleString()}/year

TOP COMPETITORS:
${competitors.slice(0, 5).map((c, i) => `${i + 1}. "${c.name}" - $${c.annual_revenue.toLocaleString()}/yr, ${c.occupancy}% occ, $${c.adr} ADR, ${c.rating || 'N/A'} rating, ${c.reviews} reviews - Success: ${c.success_factor}`).join('\n')}

SEASONALITY:
${(seasonality || []).map(s => `${s.month}: $${s.revenue.toLocaleString()} (${s.season_type})`).join(', ') || 'No seasonality data available'}

Generate exactly 5 insights in this JSON format:
[
  {
    "title": "Brief title (5-7 words)",
    "insight": "Specific insight about THIS property (2-3 sentences)",
    "impact": "High/Medium/Low",
    "action": "Specific action to take (1 sentence)"
  }
]

REQUIREMENTS:
- Each insight must be SPECIFIC to this property, not generic
- Reference actual numbers from the data
- Compare to specific competitors when relevant
- Focus on actionable intelligence
- Be direct and confident in your analysis

Return ONLY the JSON array, no other text.`;

  try {
    const response = await callGemini(prompt);
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse insights JSON');
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
  const prompt = `You are an expert at analyzing Airbnb competition. Study these top-performing listings and identify the PATTERNS that make them successful.

TOP PERFORMERS (sorted by revenue):
${competitors.map((c, i) => `
${i + 1}. "${c.name}"
   - Revenue: $${c.annual_revenue.toLocaleString()}/year
   - Occupancy: ${c.occupancy}%
   - ADR: $${c.adr}/night
   - Rating: ${c.rating || 'N/A'} (${c.reviews} reviews)
   - Success Factor: ${c.success_factor}
   - Airbnb URL: ${c.airbnb_url}
`).join('')}

SUBJECT PROPERTY:
- ${property.bedrooms}BR/${property.bathrooms}BA at $${property.monthly_rent}/month rent

Analyze these competitors and identify 4-5 patterns in this JSON format:
[
  {
    "pattern": "What the pattern is (e.g., 'Premium Pricing Strategy')",
    "frequency": "How many of the top performers exhibit this (e.g., '4 of 5 top earners')",
    "revenue_impact": "How this affects revenue (e.g., '+25% above market average')",
    "recommendation": "How to apply this to the subject property"
  }
]

Look for patterns in:
- Pricing strategies (high ADR vs high occupancy)
- Property naming/branding
- Success factors mentioned
- Rating and review patterns
- Occupancy vs ADR tradeoffs

Return ONLY the JSON array, no other text.`;

  try {
    const response = await callGemini(prompt);
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse patterns JSON');
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
  const competitorsList = competitors || [];
  const viableCompetitors = competitorsList.filter(c => c.annual_revenue >= minimumRevenue);
  
  const prompt = `You are a senior real estate investment analyst. Provide a definitive investment verdict for this Airbnb arbitrage opportunity.

PROPERTY:
- Address: ${property.address}
- Configuration: ${property.bedrooms}BR/${property.bathrooms}BA
- Monthly Rent: $${property.monthly_rent.toLocaleString()}
- Minimum Revenue Needed (2x rule): $${minimumRevenue.toLocaleString()}/year

MARKET CONTEXT:
- Market: ${market.name}
- Active Listings: ${market.active_listings.toLocaleString()}
- Market Occupancy: ${market.occupancy}%
- Market ADR: $${market.adr}

REVENUE POTENTIAL:
- Top 10%: $${percentiles.top_10_percent.toLocaleString()}/year
- Top 25%: $${percentiles.top_25_percent.toLocaleString()}/year
- Median: $${percentiles.median.toLocaleString()}/year

PROFIT PROJECTIONS:
- Conservative (Median): $${profitability.conservative.toLocaleString()}/year profit
- Realistic (Top 25%): $${profitability.realistic.toLocaleString()}/year profit
- Optimistic (Top 10%): $${profitability.optimistic.toLocaleString()}/year profit

COMPETITION:
- ${viableCompetitors.length} of ${competitors.length} competitors meet the 2x revenue threshold
- Top competitor earns: $${competitors[0]?.annual_revenue.toLocaleString() || 'N/A'}/year

Provide your verdict in this JSON format:
{
  "rating": "STRONG BUY" or "BUY" or "HOLD" or "PASS",
  "confidence": 1-10,
  "summary": "2-3 sentence summary of your verdict",
  "top_reasons": ["Reason 1", "Reason 2", "Reason 3"],
  "key_risk": "The single biggest risk to watch",
  "key_opportunity": "The single biggest opportunity to leverage"
}

RATING CRITERIA:
- STRONG BUY: Median revenue > 2.5x rent, strong market, low risk
- BUY: Top 25% revenue > 2x rent, good market fundamentals
- HOLD: Marginal profitability, needs specific conditions to work
- PASS: High risk, low profit potential, or unfavorable market

Return ONLY the JSON object, no other text.`;

  try {
    const response = await callGemini(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse verdict JSON');
  } catch (error) {
    console.error('[GeminiAnalyzer] Error generating verdict:', error);
    // Return default verdict based on numbers
    const medianProfit = profitability.conservative;
    let rating: 'STRONG BUY' | 'BUY' | 'HOLD' | 'PASS' = 'HOLD';
    let confidence = 5;
    
    if (medianProfit > 50000) { rating = 'STRONG BUY'; confidence = 8; }
    else if (medianProfit > 25000) { rating = 'BUY'; confidence = 7; }
    else if (medianProfit > 0) { rating = 'HOLD'; confidence = 5; }
    else { rating = 'PASS'; confidence = 7; }
    
    return {
      rating,
      confidence,
      summary: `Based on the numbers, this property shows ${rating === 'PASS' ? 'unfavorable' : rating === 'HOLD' ? 'marginal' : 'positive'} profit potential with a conservative estimate of $${medianProfit.toLocaleString()}/year.`,
      top_reasons: [
        `${viableCompetitors.length} competitors prove the 2x revenue threshold is achievable`,
        `Market occupancy of ${market.occupancy}% indicates ${market.occupancy > 60 ? 'healthy' : 'moderate'} demand`,
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
  const peakMonths = seasonalityData.filter(s => s.season_type === 'Peak');
  const slowMonths = seasonalityData.filter(s => s.season_type === 'Slow');
  const avgPeakADR = peakMonths.length > 0 ? peakMonths.reduce((sum, m) => sum + m.adr, 0) / peakMonths.length : market.adr;
  const avgSlowADR = slowMonths.length > 0 ? slowMonths.reduce((sum, m) => sum + m.adr, 0) / slowMonths.length : market.adr * 0.8;
  
  const prompt = `You are a dynamic pricing expert for Airbnb. Create a pricing strategy for this property.

PROPERTY:
- ${property.bedrooms}BR/${property.bathrooms}BA in ${market.name}
- Monthly Rent: $${property.monthly_rent.toLocaleString()}

MARKET DATA:
- Average ADR: $${market.adr}
- Average Occupancy: ${market.occupancy}%

COMPETITOR ADRs:
${competitorsList.slice(0, 5).map(c => `- "${c.name}": $${c.adr}/night (${c.occupancy}% occ)`).join('\n')}

SEASONALITY:
- Peak Season ADR: $${Math.round(avgPeakADR)} (${peakMonths.map(m => m.month).join(', ') || 'N/A'})
- Slow Season ADR: $${Math.round(avgSlowADR)} (${slowMonths.map(m => m.month).join(', ') || 'N/A'})

Generate a pricing strategy in this JSON format:
{
  "base_rate": 250,
  "peak_premium_percent": 30,
  "slow_discount_percent": 20,
  "weekend_premium_percent": 15,
  "minimum_stay_peak": 2,
  "minimum_stay_slow": 3,
  "pricing_rationale": "2-3 sentence explanation of this strategy"
}

Consider:
- Position relative to competitors (premium, mid-market, or value)
- Occupancy vs ADR tradeoff
- Seasonal demand patterns
- Weekend vs weekday demand

Return ONLY the JSON object, no other text.`;

  try {
    const response = await callGemini(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse pricing JSON');
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
 * Analyze listing photos using Gemini Vision
 */
export async function analyzeListingPhoto(imageUrl: string, listingName: string): Promise<PhotoAnalysis> {
  const prompt = `You are an expert Airbnb listing photographer and interior designer. Analyze this listing photo and provide insights.

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
    const response = await callGeminiWithImage(prompt, imageUrl);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
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
  const slowMonths = seasonalityData.filter(s => s.season_type === 'Slow');
  const peakMonths = seasonalityData.filter(s => s.season_type === 'Peak');
  const seasonalityVariance = peakMonths.length > 0 && slowMonths.length > 0
    ? (peakMonths[0].revenue - slowMonths[0].revenue) / peakMonths[0].revenue
    : 0;
  
  const prompt = `You are a risk analyst for short-term rental investments. Assess the risks and opportunities for this arbitrage deal.

PROPERTY:
- ${property.bedrooms}BR/${property.bathrooms}BA at $${property.monthly_rent}/month
- Location: ${property.address}

MARKET:
- ${market.name} with ${market.active_listings.toLocaleString()} active listings
- Occupancy: ${market.occupancy}%
- ADR: $${market.adr}

SEASONALITY:
- Revenue variance: ${Math.round(seasonalityVariance * 100)}% between peak and slow seasons
- Slow months: ${slowMonths.map(m => m.month).join(', ') || 'None identified'}
- Peak months: ${peakMonths.map(m => m.month).join(', ') || 'None identified'}

COMPETITION:
- ${competitorsList.length} comparable properties
- Top earner: $${competitorsList[0]?.annual_revenue.toLocaleString() || 'N/A'}/year

Provide risk assessment in this JSON format:
{
  "overall_risk": "Low/Medium/High",
  "risks": [
    {
      "category": "Market/Financial/Operational/Regulatory",
      "description": "Specific risk description",
      "severity": "Low/Medium/High",
      "mitigation": "How to mitigate this risk"
    }
  ],
  "opportunities": [
    {
      "category": "Market/Pricing/Differentiation/Timing",
      "description": "Specific opportunity",
      "potential_impact": "Revenue impact estimate",
      "action": "How to capture this opportunity"
    }
  ]
}

Include 3-4 risks and 2-3 opportunities. Be specific to this property and market.

Return ONLY the JSON object, no other text.`;

  try {
    const response = await callGemini(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse risk assessment JSON');
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
  const prompt = `You are an Airbnb launch consultant. Create a step-by-step action plan to launch this property.

PROPERTY:
- ${property.bedrooms}BR/${property.bathrooms}BA
- Monthly Rent: $${property.monthly_rent}
- Investment Verdict: ${verdict.rating} (${verdict.confidence}/10 confidence)

PRICING STRATEGY:
- Base Rate: $${pricingStrategy.base_rate}/night
- Peak Premium: +${pricingStrategy.peak_premium_percent}%
- Minimum Stay: ${pricingStrategy.minimum_stay_peak}-${pricingStrategy.minimum_stay_slow} nights

Create a launch action plan in this JSON format:
[
  {
    "phase": "Phase name (e.g., 'Pre-Launch Setup')",
    "timeline": "Week 1-2",
    "tasks": ["Task 1", "Task 2", "Task 3"],
    "estimated_cost": "$X,XXX",
    "expected_outcome": "What this phase achieves"
  }
]

Include 4-5 phases covering:
1. Pre-launch setup (furnishing, photos, listing creation)
2. Launch strategy (pricing, promotion)
3. First 30 days (building reviews)
4. Optimization (pricing adjustments, improvements)
5. Scaling (if applicable)

Return ONLY the JSON array, no other text.`;

  try {
    const response = await callGemini(prompt);
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse action plan JSON');
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
  riskAssessment: RiskAssessment
): Promise<string> {
  const prompt = `You are writing an executive summary for an Airbnb arbitrage investment report. Synthesize all the analysis into a compelling 3-4 paragraph summary.

PROPERTY: ${property.address} (${property.bedrooms}BR/${property.bathrooms}BA) at $${property.monthly_rent}/month

INVESTMENT VERDICT: ${verdict.rating} (${verdict.confidence}/10 confidence)
${verdict.summary}

KEY INSIGHTS:
${insights.map(i => `- ${i.title}: ${i.insight}`).join('\n')}

PRICING STRATEGY:
- Base Rate: $${pricingStrategy.base_rate}/night
- ${pricingStrategy.pricing_rationale}

RISK LEVEL: ${riskAssessment.overall_risk}
- Key Risk: ${riskAssessment.risks[0]?.description || 'None identified'}
- Key Opportunity: ${riskAssessment.opportunities[0]?.description || 'None identified'}

Write an executive summary that:
1. Opens with the bottom line (should they invest?)
2. Highlights the most compelling opportunity
3. Acknowledges the key risk and mitigation
4. Ends with a clear recommendation

Write in a confident, professional tone. Be direct and actionable.`;

  try {
    return await callGemini(prompt, 1024);
  } catch (error) {
    console.error('[GeminiAnalyzer] Error generating executive summary:', error);
    return `**Investment Verdict: ${verdict.rating}** (Confidence: ${verdict.confidence}/10)

${verdict.summary}

The analysis identified ${insights.length} key insights specific to this property. The recommended base rate is $${pricingStrategy.base_rate}/night with seasonal adjustments. Overall risk is assessed as ${riskAssessment.overall_risk.toLowerCase()}.

${verdict.rating === 'PASS' ? 'This opportunity does not meet our investment criteria at this time.' : 'This opportunity warrants further consideration based on the analysis.'}`;
  }
}

/**
 * Run full AI analysis pipeline
 */
export async function runFullAIAnalysis(
  property: PropertyData,
  market: MarketData,
  competitors: CompetitorData[],
  percentiles: PercentileData,
  seasonality: SeasonalityData[],
  profitability: { conservative: number; realistic: number; optimistic: number }
): Promise<FullAIAnalysis> {
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
  
  return {
    insights,
    verdict,
    pricing_strategy: pricingStrategy,
    competitor_patterns: patterns,
    risk_assessment: riskAssessment,
    action_plan: actionPlan,
    executive_summary: executiveSummary
  };
}

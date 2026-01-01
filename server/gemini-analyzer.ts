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
  "rating": "GO" or "CAUTION" or "PASS",
  "confidence": 1-10,
  "summary": "2-3 sentence summary of your verdict",
  "top_reasons": ["Reason 1", "Reason 2", "Reason 3"],
  "key_risk": "The single biggest risk to watch",
  "key_opportunity": "The single biggest opportunity to leverage"
}

RATING CRITERIA (for rental arbitrage - they're RENTING, not buying):
- GO: Revenue projections strongly support signing this lease. Top 25% revenue > 2x rent, good market.
- CAUTION: Marginal profitability, needs specific conditions to work. Proceed carefully.
- PASS: Don't sign this lease. High risk, low profit potential, or unfavorable market.

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

${verdict.rating === 'PASS' ? 'We recommend NOT signing this lease based on the analysis.' : verdict.rating === 'CAUTION' ? 'This lease may work but proceed carefully and consider the risks.' : 'This lease looks promising for Airbnb arbitrage based on the analysis.'}`;
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
  startup_estimate: {
    furniture_low: number;
    furniture_high: number;
    supplies_low: number;
    supplies_high: number;
    photos_and_listing: number;
    first_month_buffer: number;
    total_low: number;
    total_high: number;
  };
  break_even: {
    months_conservative: number;
    months_realistic: number;
    months_optimistic: number;
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
 * Call Gemini with structured JSON output schema
 */
export async function callGeminiStructured<T>(
  prompt: string,
  schema: object,
  maxTokens: number = 4096
): Promise<T> {
  const apiKey = ENV.geminiApiKey;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const systemPrompt = `You are an expert short-term rental investment analyst. 
You MUST respond with ONLY valid JSON that matches the provided schema exactly.
Do not include any text before or after the JSON.
Do not include markdown code blocks.
Return ONLY the raw JSON object.`;

  const fullPrompt = `${systemPrompt}

REQUIRED OUTPUT SCHEMA:
${JSON.stringify(schema, null, 2)}

ANALYSIS REQUEST:
${prompt}

Return ONLY the JSON object matching the schema above. No other text.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.3, // Lower temperature for more consistent structured output
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean up the response
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.slice(7);
    }
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();

    return JSON.parse(cleanedText) as T;
  } catch (error) {
    console.error('[GeminiAnalyzer] Structured output error:', error);
    throw error;
  }
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
    startup_estimate: {
      furniture_low: 0,
      furniture_high: 0,
      supplies_low: 0,
      supplies_high: 0,
      photos_and_listing: 0,
      first_month_buffer: 0,
      total_low: 0,
      total_high: 0
    },
    break_even: {
      months_conservative: 0,
      months_realistic: 0,
      months_optimistic: 0
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
- Average Occupancy: ${Math.round(market.occupancy * 100)}%
- Average Daily Rate: $${Math.round(market.adr)}
- Average Annual Revenue: $${Math.round(market.revenue).toLocaleString()}

COMPETITION (${competitors.length} comparable ${property.bedrooms}BR properties):
${competitors.slice(0, 5).map(c => `- ${c.name}: $${c.annual_revenue.toLocaleString()}/yr, ${Math.round(c.occupancy * 100)}% occ, ${c.rating || 'N/A'} rating`).join('\n')}

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

    const startupBase = property.bedrooms * 3000;
    
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
      startup_estimate: {
        furniture_low: startupBase,
        furniture_high: startupBase * 1.5,
        supplies_low: 500,
        supplies_high: 1000,
        photos_and_listing: 500,
        first_month_buffer: property.monthly_rent * 2,
        total_low: startupBase + 500 + 500 + property.monthly_rent * 2,
        total_high: startupBase * 1.5 + 1000 + 500 + property.monthly_rent * 2
      },
      break_even: {
        months_conservative: conservativeProfit > 0 ? Math.ceil((startupBase + 1000) / (conservativeProfit / 12)) : 24,
        months_realistic: realisticProfit > 0 ? Math.ceil((startupBase + 1000) / (realisticProfit / 12)) : 18,
        months_optimistic: profitability.optimistic > 0 ? Math.ceil((startupBase + 1000) / (profitability.optimistic / 12)) : 12
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

Return ONLY the JSON object.`;

  try {
    const response = await callGemini(prompt, 2048);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse regulation JSON');
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
  const prompt = `You are explaining Airbnb investing to a complete beginner. 
Write at a fifth-grade reading level. Use simple words. No jargon.

TOPIC: ${topic}

DATA:
${JSON.stringify(data, null, 2)}

CONTEXT: ${context}

Explain what this means for someone thinking about starting an Airbnb business.
- Use short sentences
- Give real examples
- Explain WHY it matters
- Tell them what to DO with this information

Keep it under 150 words.`;

  try {
    return await callGemini(prompt, 512);
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
  const prompt = `Explain what this data point means for someone researching an Airbnb arbitrage investment.

DATA POINT: ${dataPoint}
VALUE: ${value}
${context.property_rent ? `MONTHLY RENT: $${context.property_rent}` : ''}
${context.bedrooms ? `BEDROOMS: ${context.bedrooms}` : ''}
${context.market_name ? `MARKET: ${context.market_name}` : ''}

Write 1-2 sentences at a fifth-grade reading level.
Start with "This means..." or "This tells you..."
Be specific about what action they should take or what this indicates about the investment.`;

  try {
    return await callGemini(prompt, 256);
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

Return ONLY the JSON object.`;

  try {
    const response = await callGemini(prompt, 2048);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse explanations JSON');
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

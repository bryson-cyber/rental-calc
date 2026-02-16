/**
 * Multi-Provider AI Fallback Service
 * 
 * Provides robust AI narrative generation with automatic fallback between providers:
 * 1. Forge API (Gemini Flash) - Primary, fast and reliable
 * 2. Gemini Direct - Secondary fallback
 * 3. Template-based - Guaranteed fallback (no AI)
 * 
 * Each provider has a short timeout to fail fast and try the next one.
 */

import { invokeLLM } from './_core/llm';
import type { EnhancedNarrativeReport, EnhancedNarrativeReportInput } from './gemini-analyzer-enhanced';

// Timeout for each provider - strict 15s each for fast fallback
const FORGE_TIMEOUT_MS = 15000;  // 15 seconds - primary provider
const GEMINI_TIMEOUT_MS = 15000;  // 15 seconds - backup

// Maximum total time for all AI attempts before falling back to template
const MAX_TOTAL_AI_TIME_MS = 40000; // 40 seconds total max

/**
 * Generate enhanced narrative report with multi-provider fallback
 * Tries AI providers in sequence with strict timeouts:
 * 1. Forge API (15s) - Built-in, most reliable
 * 2. Gemini Direct (15s) - Fast backup
 * 3. Template - Guaranteed fallback
 */
export async function generateEnhancedNarrativeWithFallback(
  input: EnhancedNarrativeReportInput,
  onProviderAttempt?: (provider: string, status: 'trying' | 'success' | 'failed') => void
): Promise<EnhancedNarrativeReport> {
  const notify = onProviderAttempt || (() => {});
  
  // Calculate common metrics used by all providers
  const metrics = calculateMetrics(input);
  const prompt = buildPrompt(input, metrics);
  
  console.log('[AIFallback] Starting multi-provider AI generation...');
  
  const totalStart = Date.now();
  
  // Provider 1: Forge API
  try {
    if (Date.now() - totalStart < MAX_TOTAL_AI_TIME_MS) {
      notify('forge', 'trying');
      console.log('[AIFallback] Trying Forge API...');
      const report = await withTimeout(
        generateWithForge(prompt, input, metrics),
        FORGE_TIMEOUT_MS,
        'Forge API timeout'
      );
      notify('forge', 'success');
      console.log('[AIFallback] Forge API succeeded');
      return report;
    }
  } catch (err: any) {
    console.log(`[AIFallback] Forge API failed: ${err.message}`);
    notify('forge', 'failed');
  }
  
  // Provider 2: Gemini Direct
  try {
    if (Date.now() - totalStart < MAX_TOTAL_AI_TIME_MS) {
      notify('gemini', 'trying');
      console.log('[AIFallback] Trying Gemini Direct...');
      const report = await withTimeout(
        generateWithGeminiDirect(prompt, input, metrics),
        GEMINI_TIMEOUT_MS,
        'Gemini Direct timeout'
      );
      notify('gemini', 'success');
      console.log('[AIFallback] Gemini Direct succeeded');
      return report;
    }
  } catch (err: any) {
    console.log(`[AIFallback] Gemini Direct failed: ${err.message}`);
    notify('gemini', 'failed');
  }
  
  // Provider 3: Template (guaranteed)
  console.log('[AIFallback] All AI providers failed, using template');
  notify('template', 'trying');
  const report = generateTemplateReport(input, metrics);
  notify('template', 'success');
  return report;
}

// Helper: Add timeout to a promise
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMsg)), ms)
    )
  ]);
}

// Calculate common metrics
interface Metrics {
  revenueToRentRatio: number;
  occupancyNormalized: number;
  monthlyProfit: number;
  annualRent: number;
  breakEvenOccupancy: number;
  recommendation: string;
  confidenceScore: number;
  seasonalSwingPct: number;
  peakMonths: string[];
  offMonths: string[];
}

function calculateMetrics(input: EnhancedNarrativeReportInput): Metrics {
  const revenueToRentRatio = input.revenue_mid / (input.monthly_rent * 12);
  const occupancyNormalized = input.market_occupancy < 1 ? input.market_occupancy * 100 : input.market_occupancy;
  const monthlyProfit = Math.round(input.annual_profit_realistic / 12);
  const annualRent = input.monthly_rent * 12;
  
  // Break-even calculation
  const dailyRate = input.market_adr;
  const daysPerMonth = 30;
  const maxMonthlyRevenue = dailyRate * daysPerMonth;
  const breakEvenOccupancy = maxMonthlyRevenue > 0 
    ? Math.min(100, Math.round((input.monthly_expenses / maxMonthlyRevenue) * 100))
    : 100;
  
  // Recommendation
  const recommendation = revenueToRentRatio >= 2.5 ? 'STRONG GO' : 
                         revenueToRentRatio >= 2 ? 'GO' : 
                         revenueToRentRatio >= 1.5 ? 'CAUTION' : 'NO GO';
  const confidenceScore = revenueToRentRatio >= 2.5 ? 9 : 
                          revenueToRentRatio >= 2 ? 7 : 
                          revenueToRentRatio >= 1.5 ? 5 : 3;
  
  // Seasonality
  const peakSeasons = input.seasonality.filter(s => s.season_type === 'peak');
  const offSeasons = input.seasonality.filter(s => s.season_type === 'off');
  const avgPeakRevenue = peakSeasons.reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, peakSeasons.length);
  const avgOffRevenue = offSeasons.reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, offSeasons.length);
  const seasonalSwingPct = avgOffRevenue > 0 ? Math.round(((avgPeakRevenue - avgOffRevenue) / avgOffRevenue) * 100) : 0;
  
  return {
    revenueToRentRatio,
    occupancyNormalized,
    monthlyProfit,
    annualRent,
    breakEvenOccupancy,
    recommendation,
    confidenceScore,
    seasonalSwingPct,
    peakMonths: peakSeasons.map(s => s.month),
    offMonths: offSeasons.map(s => s.month),
  };
}

// Build the prompt for AI providers
function buildPrompt(input: EnhancedNarrativeReportInput, metrics: Metrics): string {
  const formatOccupancy = (occ: number | undefined) => {
    if (!occ) return 0;
    return occ > 1 ? Math.round(occ) : Math.round(occ * 100);
  };
  
  const topComp = input.competitors[0];
  const competitorList = input.competitors.slice(0, 5).map((c, i) => 
    `${i + 1}. ${c.name}: $${c.annual_revenue?.toLocaleString()}/yr, ${formatOccupancy(c.occupancy)}% occ, ${c.rating?.toFixed(1) || 'N/A'} rating`
  ).join('\n');
  
  return `You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist and founder of StayMetrics, managing $100M+ across 400+ properties in 35 U.S. markets. You have 30 years of experience in data science and real estate investment. Write a concise executive summary (150-200 words) for this rental arbitrage opportunity. Use the "story before the stats" approach — lead with a plain-language narrative, then back it with specific numbers. Be warm but direct, like a trusted advisor over coffee.

PROPERTY: ${input.address}
- ${input.bedrooms} bedrooms, ${input.bathrooms} bathrooms
- Monthly Rent: $${input.monthly_rent.toLocaleString()} ($${metrics.annualRent.toLocaleString()}/year)

MARKET: ${input.market_name}
- Occupancy: ${metrics.occupancyNormalized.toFixed(0)}%
- ADR: $${input.market_adr.toFixed(0)}/night
- Active Listings: ${input.active_listings}

REVENUE PROJECTIONS:
- Conservative: $${input.revenue_low.toLocaleString()}/year
- Realistic: $${input.revenue_mid.toLocaleString()}/year
- Optimistic: $${input.revenue_high.toLocaleString()}/year
- Revenue-to-Rent Ratio: ${metrics.revenueToRentRatio.toFixed(2)}x

PROFITABILITY:
- Monthly Expenses: $${input.monthly_expenses.toLocaleString()}
- Break-Even Occupancy: ${metrics.breakEvenOccupancy}%
- Realistic Profit: $${input.annual_profit_realistic.toLocaleString()}/year ($${metrics.monthlyProfit.toLocaleString()}/month)

TOP COMPETITORS:
${competitorList || 'No competitor data'}

SEASONALITY: ${metrics.seasonalSwingPct}% swing between peak and off-peak

Write a professional summary covering: revenue potential, profit projections, market comparison, and cash flow timing. Use **bold** for key terms. DO NOT give investment advice or recommendations like "GO" or "sign the lease". Just summarize the data objectively.`;
}

// Provider 1: Forge API (Gemini Flash) - with proper timeout
async function generateWithForge(
  prompt: string, 
  input: EnhancedNarrativeReportInput, 
  metrics: Metrics
): Promise<EnhancedNarrativeReport> {
  const { ENV } = await import('./_core/env');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FORGE_TIMEOUT_MS - 2000);
  
  try {
    const apiUrl = ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
      ? `${ENV.forgeApiUrl.replace(/\/$/, '')}/v1/chat/completions`
      : 'https://forge.manus.im/v1/chat/completions';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist and founder of StayMetrics, managing $100M+ across 400+ properties in 35 U.S. markets. Provide objective, data-driven market analysis. Every claim must reference specific numbers. Use the "story before the stats" approach. Be warm but direct — like a trusted advisor over coffee.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
    
    if (!response.ok) {
      throw new Error(`Forge API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : 
      Array.isArray(content) ? content.map((c: any) => 'text' in c ? c.text : '').join('') : '';
    
    if (!text) {
      throw new Error('Empty response from Forge API');
    }
    
    return buildReport(text.trim(), input, metrics);
  } finally {
    clearTimeout(timeoutId);
  }
}

// Provider 2: Gemini Direct
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

async function generateWithGeminiDirect(
  prompt: string, 
  input: EnhancedNarrativeReportInput, 
  metrics: Metrics
): Promise<EnhancedNarrativeReport> {
  const { ENV } = await import('./_core/env');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS - 5000);
  
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${ENV.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist and founder of StayMetrics, managing $100M+ across 400+ properties in 35 U.S. markets. Write a concise executive summary with specific numbers from the data. Use the "story before the stats" approach. Be warm but direct — like a trusted advisor over coffee.' }]
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingLevel: 'low' }
        }
      }),
      signal: controller.signal
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    // Filter out thinking parts
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts
      .filter((p: any) => p.text && !p.thought)
      .map((p: any) => p.text)
      .join('') || '';
    
    if (!text) {
      throw new Error('Empty response from Gemini');
    }
    
    return buildReport(text.trim(), input, metrics);
  } finally {
    clearTimeout(timeoutId);
  }
}

// Provider 3: Template-based (no AI)
function generateTemplateReport(
  input: EnhancedNarrativeReportInput, 
  metrics: Metrics
): EnhancedNarrativeReport {
  const topComp = input.competitors[0];
  const formatOccupancy = (occ: number | undefined) => {
    if (!occ) return 0;
    return occ > 1 ? Math.round(occ) : Math.round(occ * 100);
  };
  
  const executiveSummary = `This **${input.bedrooms}-bedroom** property at ${input.address.split(',')[0]} in **${input.market_name}** shows a **${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio**. The realistic annual revenue projection of **$${input.revenue_mid.toLocaleString()}** translates to approximately **$${metrics.monthlyProfit.toLocaleString()} monthly profit** after expenses. The market has ${input.active_listings.toLocaleString()} active listings with **${metrics.occupancyNormalized.toFixed(0)}% average occupancy** and **$${input.market_adr.toFixed(0)}/night ADR**. Break-even requires **${metrics.breakEvenOccupancy}% occupancy**, which is ${metrics.breakEvenOccupancy <= metrics.occupancyNormalized ? 'below' : 'above'} the market average. ${metrics.seasonalSwingPct > 30 ? `Expect significant seasonal variation (${metrics.seasonalSwingPct}% swing) with lower income during ${metrics.offMonths.join(', ') || 'off-peak months'}.` : `Income is relatively stable throughout the year (${metrics.seasonalSwingPct}% variation).`}`;
  
  return buildReport(executiveSummary, input, metrics);
}

// Build the full report structure
function buildReport(
  executiveSummary: string,
  input: EnhancedNarrativeReportInput,
  metrics: Metrics
): EnhancedNarrativeReport {
  const topComp = input.competitors[0];
  const formatOccupancy = (occ: number | undefined) => {
    if (!occ) return 0;
    return occ > 1 ? Math.round(occ) : Math.round(occ * 100);
  };
  
  return {
    executive_summary: executiveSummary,
    market_overview: `The ${input.market_name} market has ${input.active_listings.toLocaleString()} active short-term rental listings with an average occupancy of ${metrics.occupancyNormalized.toFixed(0)}% and ADR of $${input.market_adr.toFixed(0)}/night. This is a ${input.active_listings > 1000 ? 'highly competitive' : input.active_listings > 500 ? 'moderately competitive' : 'less saturated'} market.`,
    revenue_analysis: `Based on comparable properties, this ${input.bedrooms}-bedroom property could generate between $${input.revenue_low.toLocaleString()} (conservative) and $${input.revenue_high.toLocaleString()} (optimistic) annually. The realistic projection of $${input.revenue_mid.toLocaleString()}/year represents 75th percentile performance.`,
    competitive_landscape: `There are ${input.competitors.length} comparable ${input.bedrooms}-bedroom properties in the area. The top performer is ${topComp?.name || 'not identified'}, earning $${topComp?.annual_revenue?.toLocaleString() || 'N/A'}/year with ${formatOccupancy(topComp?.occupancy)}% occupancy.`,
    seasonal_strategy: `Revenue varies by ${metrics.seasonalSwingPct}% between peak and off-season. Peak months are ${metrics.peakMonths.join(', ') || 'year-round'}. Plan for lower income during ${metrics.offMonths.join(', ') || 'slower periods'}.`,
    historical_context: 'Historical trend data available in the detailed analysis below.',
    risk_assessment: generateRiskAssessment(input, metrics),
    financial_outlook: `With monthly expenses of $${input.monthly_expenses.toLocaleString()} and rent of $${input.monthly_rent.toLocaleString()}, break-even requires ${metrics.breakEvenOccupancy}% occupancy. The conservative scenario yields $${input.annual_profit_conservative.toLocaleString()}/year profit.`,
    conclusion: generateConclusion(metrics),
    what_this_means: {
      revenue: `You could earn about $${metrics.monthlyProfit.toLocaleString()} per month after all expenses.`,
      competition: `You'll compete with ${input.competitors.length} similar properties. ${topComp ? `The best one earns $${topComp.annual_revenue?.toLocaleString()}/year.` : ''}`,
      seasonality: metrics.seasonalSwingPct > 30 
        ? `Income will vary significantly (${metrics.seasonalSwingPct}%) - save during peak season for slower months.`
        : `Income is relatively stable throughout the year (${metrics.seasonalSwingPct}% variation).`,
      overall: metrics.revenueToRentRatio >= 2.0
        ? `The revenue-to-rent ratio of ${metrics.revenueToRentRatio.toFixed(2)}x meets the typical profitability threshold.`
        : metrics.revenueToRentRatio >= 1.5
        ? `The revenue-to-rent ratio of ${metrics.revenueToRentRatio.toFixed(2)}x is below the typical 2.0x threshold.`
        : `The revenue-to-rent ratio of ${metrics.revenueToRentRatio.toFixed(2)}x indicates narrow margins.`,
    },
    action_items: generateActionItems(metrics),
    key_metrics: {
      projected_annual_revenue: input.revenue_mid,
      projected_monthly_profit: metrics.monthlyProfit,
      market_occupancy: metrics.occupancyNormalized,
      market_adr: input.market_adr,
      break_even_months: Math.min(24, Math.round((input.bedrooms * 5000 + 3000) / Math.max(metrics.monthlyProfit, 1))),
      confidence_level: metrics.confidenceScore >= 7 ? 'high' : metrics.confidenceScore >= 5 ? 'medium' : 'low',
      revenue_to_rent_ratio: metrics.revenueToRentRatio,
    },
    quick_facts: [
      `Revenue-to-rent ratio: ${metrics.revenueToRentRatio.toFixed(2)}x`,
      `Projected profit: $${metrics.monthlyProfit.toLocaleString()}/month`,
      `Break-even occupancy: ${metrics.breakEvenOccupancy}%`,
      `${input.competitors.length} direct competitors analyzed`,
    ],
    market_context: {
      type: determineMarketType(input.market_name),
      seasonality: metrics.seasonalSwingPct > 50 ? 'high' : metrics.seasonalSwingPct > 25 ? 'moderate' : 'low',
      competition: input.active_listings > 1000 ? 'high' : input.active_listings > 500 ? 'moderate' : 'low',
      pricePoint: input.market_adr > 300 ? 'luxury' : input.market_adr > 100 ? 'mid-range' : 'budget',
      description: `${input.market_name} is a ${input.active_listings > 1000 ? 'highly competitive' : 'moderately competitive'} market.`,
    },
  };
}

function generateRiskAssessment(input: EnhancedNarrativeReportInput, metrics: Metrics): string {
  const risks: string[] = [];
  
  if (metrics.revenueToRentRatio < 2) risks.push('Revenue-to-rent ratio below 2x leaves thin margins for unexpected costs');
  if (metrics.seasonalSwingPct > 40) risks.push(`High seasonality (${metrics.seasonalSwingPct}% swing) means inconsistent monthly income`);
  if (input.active_listings > 1000) risks.push('High competition market with 1000+ listings');
  if (metrics.occupancyNormalized < 50) risks.push('Below-average market occupancy indicates soft demand');
  
  if (risks.length === 0) risks.push('Standard STR risks: regulatory changes, market saturation, economic downturns');
  
  return `Key risks: ${risks.join('. ')}. Mitigation: Verify local regulations, maintain cash reserves for 3+ months of expenses, and focus on guest experience to stand out.`;
}

function generateConclusion(metrics: Metrics): string {
  if (metrics.revenueToRentRatio >= 2.5) {
    return `This analysis shows a ${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio with projected monthly profit of $${metrics.monthlyProfit.toLocaleString()}. The ratio exceeds the typical 2.0x threshold often used to evaluate rental arbitrage viability.`;
  } else if (metrics.revenueToRentRatio >= 2.0) {
    return `This analysis shows a ${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio with projected monthly profit of $${metrics.monthlyProfit.toLocaleString()}. The ratio meets the typical 2.0x threshold.`;
  } else if (metrics.revenueToRentRatio >= 1.5) {
    return `This analysis shows a ${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio with projected monthly profit of $${metrics.monthlyProfit.toLocaleString()}. The ratio is below the typical 2.0x threshold, indicating tighter margins.`;
  } else {
    return `This analysis shows a ${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio with projected monthly profit of $${metrics.monthlyProfit.toLocaleString()}. The ratio is significantly below the typical 2.0x threshold.`;
  }
}

function generateActionItems(metrics: Metrics): Array<{priority: 'high' | 'medium' | 'low'; action: string; why: string; timeline: string}> {
  const items: Array<{priority: 'high' | 'medium' | 'low'; action: string; why: string; timeline: string}> = [
    { priority: 'high', action: 'Verify local STR regulations', why: 'Regulations can prohibit or restrict short-term rentals', timeline: 'Before signing lease' },
    { priority: 'high', action: 'Inspect property condition', why: 'Unexpected repairs can eliminate profits', timeline: 'Before signing lease' },
  ];
  
  if (metrics.revenueToRentRatio < 2) {
    items.push({ priority: 'high', action: 'Negotiate lower rent', why: `Current ratio of ${metrics.revenueToRentRatio.toFixed(2)}x is below the 2x threshold`, timeline: 'Before signing lease' });
  }
  
  items.push(
    { priority: 'medium', action: 'Research competitor amenities', why: 'Understand what drives bookings in this market', timeline: 'Week 1' },
    { priority: 'medium', action: 'Create furnishing budget', why: 'Control startup costs to protect ROI', timeline: 'Week 1' },
    { priority: 'low', action: 'Plan photography session', why: 'Professional photos increase bookings 20-40%', timeline: 'After furnishing' }
  );
  
  return items;
}

function determineMarketType(marketName: string): 'urban' | 'suburban' | 'rural' | 'tourist' | 'business' | 'mixed' {
  const lowerName = marketName.toLowerCase();
  
  if (lowerName.includes('beach') || lowerName.includes('mountain') || lowerName.includes('lake') || 
      lowerName.includes('ski') || lowerName.includes('resort')) {
    return 'tourist';
  }
  
  const majorCities = ['new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 
                       'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
                       'san francisco', 'columbus', 'fort worth', 'charlotte', 'seattle', 'denver',
                       'washington', 'boston', 'nashville', 'baltimore', 'detroit', 'portland',
                       'las vegas', 'memphis', 'louisville', 'milwaukee', 'atlanta', 'miami'];
  
  if (majorCities.some(city => lowerName.includes(city))) {
    return 'urban';
  }
  
  return 'suburban';
}

/**
 * Multi-Provider AI Fallback Service
 * 
 * Provides robust AI narrative generation with automatic fallback between providers:
 * 1. Forge API (Claude Sonnet) - Primary, fast and reliable
 * 2. Claude Direct (Sonnet) - Secondary fallback
 * 3. Template-based - Guaranteed fallback (no AI)
 * 
 * Each provider has a short timeout to fail fast and try the next one.
 */

import { callLLM } from './llm-provider';
import type { EnhancedNarrativeReport, EnhancedNarrativeReportInput } from './ai-analyzer-enhanced';

// Timeout for each provider - strict 15s each for fast fallback
const FORGE_TIMEOUT_MS = 15000;  // 15 seconds - primary provider
const CLAUDE_TIMEOUT_MS = 15000; // 15 seconds - backup

// Maximum total time for all AI attempts before falling back to template
const MAX_TOTAL_AI_TIME_MS = 40000; // 40 seconds total max

/**
 * Generate enhanced narrative report with multi-provider fallback
 * Tries AI providers in sequence with strict timeouts:
 * 1. Forge API (15s) - Built-in, most reliable
 * 2. Claude Direct (15s) - Fast backup
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
  
  // Provider 2: Claude Direct
  try {
    if (Date.now() - totalStart < MAX_TOTAL_AI_TIME_MS) {
      notify('claude', 'trying');
      console.log('[AIFallback] Trying Claude Direct...');
      const report = await withTimeout(
        generateWithClaudeDirect(prompt, input, metrics),
        CLAUDE_TIMEOUT_MS,
        'Claude Direct timeout'
      );
      notify('claude', 'success');
      console.log('[AIFallback] Claude Direct succeeded');
      return report;
    }
  } catch (err: any) {
    console.log(`[AIFallback] Claude Direct failed: ${err.message}`);
    notify('claude', 'failed');
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

// Provider 1: Forge API (Claude Sonnet) - with proper timeout
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
        model: 'claude-3-sonnet-20240229',
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

// Provider 2: Claude Direct
async function generateWithClaudeDirect(
  prompt: string, 
  input: EnhancedNarrativeReportInput, 
  metrics: Metrics
): Promise<EnhancedNarrativeReport> {
  console.log('[ClaudeFallback] Generating narrative with Claude Sonnet...');
  const text = await callLLM(prompt, {
    model: 'pro', // 'pro' for Sonnet
    thinkingLevel: 'high',
    maxTokens: 1024,
    systemPrompt: 'You are David Wei Chen, a 54-year-old AI-first short-term rental investment strategist and founder of StayMetrics, managing $100M+ across 400+ properties in 35 U.S. markets. Provide objective, data-driven market analysis. Every claim must reference specific numbers. Use the "story before the stats" approach. Be warm but direct — like a trusted advisor over coffee.'
  });

  if (!text) {
    throw new Error('Empty response from Claude API');
  }

  return buildReport(text.trim(), input, metrics);
}

// Fallback: Template-based report
function generateTemplateReport(
  input: EnhancedNarrativeReportInput,
  metrics: Metrics
): EnhancedNarrativeReport {
  const narrative = `Based on the provided data, this ${input.bedrooms}-bedroom property shows potential. With a realistic annual revenue projection of **$${input.revenue_mid.toLocaleString()}**, it achieves a revenue-to-rent ratio of **${metrics.revenueToRentRatio.toFixed(2)}x** against an annual rent of $${metrics.annualRent.toLocaleString()}.

The projected realistic annual profit is **$${input.annual_profit_realistic.toLocaleString()}**, averaging about **$${metrics.monthlyProfit.toLocaleString()}** per month. The property would need to maintain an occupancy rate of at least **${metrics.breakEvenOccupancy}%** to cover the estimated monthly expenses of $${input.monthly_expenses.toLocaleString()}.

In the **${input.market_name}** market, which has an average occupancy of **${metrics.occupancyNormalized.toFixed(0)}%**, this property is positioned to perform reasonably. Seasonality shows a **${metrics.seasonalSwingPct}%** revenue swing, indicating varied cash flow throughout the year.`;

  return buildReport(narrative, input, metrics);
}

// Build the final report object
function buildReport(
  narrative: string,
  input: EnhancedNarrativeReportInput,
  metrics: Metrics
): EnhancedNarrativeReport {
  return {
    ...input,
    executive_summary: narrative,
    market_overview: narrative,
    revenue_analysis: narrative,
    competitive_landscape: '',
    seasonal_strategy: '',
    historical_context: '',
    risk_assessment: '',
    financial_outlook: '',
    conclusion: '',
    what_this_means: {
      revenue: metrics.recommendation,
      competition: '',
      seasonality: '',
      overall: metrics.recommendation,
    },
    action_items: [],
    key_metrics: {
      projected_annual_revenue: 0,
      projected_monthly_profit: metrics.monthlyProfit ?? 0,
      market_occupancy: 0,
      market_adr: 0,
      break_even_months: 0,
      confidence_level: 'low' as const,
      revenue_to_rent_ratio: metrics.revenueToRentRatio ?? 0,
    },
    quick_facts: [],
    market_context: {
      type: 'mixed' as const,
      seasonality: 'moderate' as const,
      competition: 'moderate' as const,
      pricePoint: 'mid-range' as const,
      description: 'Fallback report — Claude was unavailable',
    },
  };
}

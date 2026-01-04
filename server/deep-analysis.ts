/**
 * Deep Analysis Service
 * 
 * Handles AI-heavy analysis features that run separately from the main analysis.
 * This allows the main analysis to complete quickly while deep analysis runs in background.
 * 
 * Features:
 * - Historical market context (5-year trends with AI interpretation)
 * - Investment thesis generation
 * - Risk assessment narrative
 * - Pricing strategy recommendations
 * - Competitor photo analysis
 */

import { getDb } from './db';
import { deepAnalysis, analysisReports } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { ENV } from './_core/env';

// AI provider timeout - give more time since this runs in background
const AI_TIMEOUT_MS = 60000; // 60 seconds per call

// Types
export interface DeepAnalysisResult {
  historicalContext: HistoricalContext | null;
  investmentThesis: InvestmentThesis | null;
  riskNarrative: RiskNarrative | null;
  pricingStrategy: PricingStrategy | null;
  competitorPhotoAnalysis: CompetitorPhotoAnalysis | null;
  executiveSummaryEnhanced: string | null;
  marketNarrative: string | null;
  actionPlan: ActionPlan | null;
}

export interface HistoricalContext {
  summary: string;
  yearOverYear: Array<{
    year: number;
    occupancy: number;
    adr: number;
    revenue: number;
    yoyChange: number;
  }>;
  marketMaturity: 'emerging' | 'growing' | 'mature' | 'declining';
  trajectory: string;
  keyFindings: string[];
  investmentImplications: string[];
}

export interface InvestmentThesis {
  summary: string;
  bullCase: string;
  bearCase: string;
  baseCase: string;
  keyAssumptions: string[];
  catalysts: string[];
  risks: string[];
  confidenceLevel: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface RiskNarrative {
  overallRisk: 'low' | 'medium' | 'high';
  riskScore: number;
  marketRisks: Array<{ risk: string; severity: 'low' | 'medium' | 'high'; mitigation: string }>;
  financialRisks: Array<{ risk: string; severity: 'low' | 'medium' | 'high'; mitigation: string }>;
  operationalRisks: Array<{ risk: string; severity: 'low' | 'medium' | 'high'; mitigation: string }>;
  regulatoryRisks: Array<{ risk: string; severity: 'low' | 'medium' | 'high'; mitigation: string }>;
  summary: string;
}

export interface PricingStrategy {
  baseRate: number;
  peakSeasonPremium: number;
  offSeasonDiscount: number;
  weekendPremium: number;
  minimumStay: { weekday: number; weekend: number; peak: number };
  dynamicPricingRecommendation: string;
  competitorPricing: { low: number; median: number; high: number };
  suggestedRange: { min: number; max: number };
  strategy: string;
}

export interface CompetitorPhotoAnalysis {
  totalAnalyzed: number;
  commonThemes: string[];
  designRecommendations: string[];
  mustHaveShots: string[];
  differentiationOpportunities: string[];
  averagePhotoCount: number;
  qualityAssessment: string;
}

export interface ActionPlan {
  phases: Array<{
    phase: number;
    name: string;
    duration: string;
    tasks: Array<{ task: string; priority: 'high' | 'medium' | 'low'; estimatedCost?: string }>;
    milestones: string[];
  }>;
  totalTimeline: string;
  totalBudget: string;
  criticalPath: string[];
}

/**
 * Start deep analysis for a report
 */
export async function startDeepAnalysis(reportId: number): Promise<{ id: number; status: string }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Check if report exists
  const report = await db.select().from(analysisReports).where(eq(analysisReports.id, reportId)).limit(1);
  if (!report.length) {
    throw new Error(`Report ${reportId} not found`);
  }

  // Check if deep analysis already exists
  const existing = await db.select().from(deepAnalysis).where(eq(deepAnalysis.reportId, reportId)).limit(1);
  if (existing.length) {
    return { id: existing[0].id, status: existing[0].status };
  }

  // Create new deep analysis record
  const result = await db.insert(deepAnalysis).values({
    reportId,
    status: 'pending',
  });

  const insertId = Number(result[0].insertId);

  // Start processing in background (don't await)
  processDeepAnalysis(insertId, reportId).catch(err => {
    console.error(`[DeepAnalysis] Background processing failed for report ${reportId}:`, err);
  });

  return { id: insertId, status: 'pending' };
}

/**
 * Get deep analysis status and results
 */
export async function getDeepAnalysis(reportId: number): Promise<{
  status: string;
  result: DeepAnalysisResult | null;
  error: string | null;
  processingTimeMs: number | null;
}> {
  const db = await getDb();
  if (!db) return { status: 'error', result: null, error: 'Database not available', processingTimeMs: null };
  
  const analysis = await db.select().from(deepAnalysis).where(eq(deepAnalysis.reportId, reportId)).limit(1);
  
  if (!analysis.length) {
    return { status: 'not_started', result: null, error: null, processingTimeMs: null };
  }

  const record = analysis[0];
  
  if (record.status === 'completed') {
    return {
      status: 'completed',
      result: {
        historicalContext: record.historicalContext as HistoricalContext | null,
        investmentThesis: record.investmentThesis as InvestmentThesis | null,
        riskNarrative: record.riskNarrative as RiskNarrative | null,
        pricingStrategy: record.pricingStrategy as PricingStrategy | null,
        competitorPhotoAnalysis: record.competitorPhotoAnalysis as CompetitorPhotoAnalysis | null,
        executiveSummaryEnhanced: record.executiveSummaryEnhanced,
        marketNarrative: record.marketNarrative,
        actionPlan: record.actionPlan as ActionPlan | null,
      },
      error: null,
      processingTimeMs: record.processingTimeMs,
    };
  }

  return {
    status: record.status,
    result: null,
    error: record.errorMessage,
    processingTimeMs: record.processingTimeMs,
  };
}

/**
 * Process deep analysis (runs in background)
 */
async function processDeepAnalysis(deepAnalysisId: number, reportId: number): Promise<void> {
  const startTime = Date.now();
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  try {
    // Update status to processing
    await db.update(deepAnalysis)
      .set({ status: 'processing' })
      .where(eq(deepAnalysis.id, deepAnalysisId));

    // Get the main report data
    const report = await db.select().from(analysisReports).where(eq(analysisReports.id, reportId)).limit(1);
    if (!report.length) {
      throw new Error(`Report ${reportId} not found`);
    }

    const reportData = report[0];
    const fullData = reportData.fullAnalysisData as any;

    // Run all AI analyses in parallel
    const [
      historicalContext,
      investmentThesis,
      riskNarrative,
      pricingStrategy,
      executiveSummaryEnhanced,
      marketNarrative,
      actionPlan,
    ] = await Promise.all([
      generateHistoricalContext(reportData, fullData).catch(err => {
        console.error('[DeepAnalysis] Historical context failed:', err);
        return null;
      }),
      generateInvestmentThesis(reportData, fullData).catch(err => {
        console.error('[DeepAnalysis] Investment thesis failed:', err);
        return null;
      }),
      generateRiskNarrative(reportData, fullData).catch(err => {
        console.error('[DeepAnalysis] Risk narrative failed:', err);
        return null;
      }),
      generatePricingStrategy(reportData, fullData).catch(err => {
        console.error('[DeepAnalysis] Pricing strategy failed:', err);
        return null;
      }),
      generateEnhancedExecutiveSummary(reportData, fullData).catch(err => {
        console.error('[DeepAnalysis] Enhanced summary failed:', err);
        return null;
      }),
      generateMarketNarrative(reportData, fullData).catch(err => {
        console.error('[DeepAnalysis] Market narrative failed:', err);
        return null;
      }),
      generateActionPlan(reportData, fullData).catch(err => {
        console.error('[DeepAnalysis] Action plan failed:', err);
        return null;
      }),
    ]);

    const processingTimeMs = Date.now() - startTime;

    // Update with results
    await db.update(deepAnalysis)
      .set({
        status: 'completed',
        historicalContext,
        investmentThesis,
        riskNarrative,
        pricingStrategy,
        executiveSummaryEnhanced,
        marketNarrative,
        actionPlan,
        processingTimeMs,
        aiProvider: 'forge',
        completedAt: new Date(),
      })
      .where(eq(deepAnalysis.id, deepAnalysisId));

    console.log(`[DeepAnalysis] Completed for report ${reportId} in ${processingTimeMs}ms`);

  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await db.update(deepAnalysis)
      .set({
        status: 'failed',
        errorMessage,
        processingTimeMs,
      })
      .where(eq(deepAnalysis.id, deepAnalysisId));

    console.error(`[DeepAnalysis] Failed for report ${reportId}:`, error);
  }
}

/**
 * Call AI with timeout
 */
async function callAI(prompt: string, systemPrompt: string = ''): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const apiUrl = ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
      ? `${ENV.forgeApiUrl.replace(/\/$/, '')}/v1/chat/completions`
      : 'https://forge.manus.im/v1/chat/completions';

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages,
        max_tokens: 2048,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (typeof content === 'string') {
      return content;
    } else if (Array.isArray(content)) {
      return content.map((c: any) => 'text' in c ? c.text : '').join('');
    }
    
    throw new Error('Empty response from AI');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
function parseAIJson<T>(text: string): T | null {
  try {
    // Remove markdown code blocks if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    return JSON.parse(cleaned.trim());
  } catch {
    console.error('[DeepAnalysis] Failed to parse AI JSON:', text.slice(0, 200));
    return null;
  }
}

// ============================================
// AI GENERATION FUNCTIONS
// ============================================

async function generateHistoricalContext(reportData: any, fullData: any): Promise<HistoricalContext | null> {
  const fiveYearSummary = fullData?.five_year_summary;
  const historicalTrends = fullData?.historical_trends;
  
  if (!fiveYearSummary && !historicalTrends) {
    console.log('[DeepAnalysis] No historical data available');
    return null;
  }

  const prompt = `Analyze this 5-year market history and provide insights in JSON format.

MARKET: ${reportData.marketName || 'Unknown'}
PROPERTY: ${reportData.bedrooms} bedrooms at ${reportData.address}

5-YEAR SUMMARY:
${JSON.stringify(fiveYearSummary, null, 2)}

HISTORICAL TRENDS:
${JSON.stringify(historicalTrends, null, 2)}

Return a JSON object with this exact structure:
{
  "summary": "2-3 sentence summary of market trajectory",
  "yearOverYear": [{"year": 2021, "occupancy": 65, "adr": 150, "revenue": 35000, "yoyChange": 5}],
  "marketMaturity": "emerging|growing|mature|declining",
  "trajectory": "Description of where market is heading",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "investmentImplications": ["Implication 1", "Implication 2"]
}`;

  const response = await callAI(prompt, 'You are a real estate market analyst. Respond only with valid JSON.');
  return parseAIJson<HistoricalContext>(response);
}

async function generateInvestmentThesis(reportData: any, fullData: any): Promise<InvestmentThesis | null> {
  const revenueToRentRatio = reportData.annualRevenueRealistic / (reportData.monthlyRent * 12);
  const occupancy = reportData.occupancyRate;
  const competitors = fullData?.competitors?.length || 0;
  
  const prompt = `Generate an investment thesis for this rental arbitrage opportunity in JSON format.

PROPERTY: ${reportData.bedrooms} bedrooms at ${reportData.address}
MARKET: ${reportData.marketName}
MONTHLY RENT: $${reportData.monthlyRent}
PROJECTED REVENUE: $${reportData.annualRevenueRealistic}/year
REVENUE-TO-RENT RATIO: ${revenueToRentRatio.toFixed(2)}x
MARKET OCCUPANCY: ${occupancy}%
COMPETITORS: ${competitors} similar properties

PROFIT PROJECTIONS:
- Conservative: $${reportData.annualProfitConservative}/year
- Realistic: $${reportData.annualProfitRealistic}/year
- Optimistic: $${reportData.annualProfitOptimistic}/year

Return a JSON object with this exact structure:
{
  "summary": "2-3 sentence investment thesis summary",
  "bullCase": "Best case scenario description",
  "bearCase": "Worst case scenario description",
  "baseCase": "Most likely scenario description",
  "keyAssumptions": ["Assumption 1", "Assumption 2", "Assumption 3"],
  "catalysts": ["What could drive outperformance"],
  "risks": ["Key risks to thesis"],
  "confidenceLevel": "high|medium|low",
  "recommendation": "Clear recommendation based on analysis"
}`;

  const response = await callAI(prompt, 'You are a real estate investment analyst. Respond only with valid JSON.');
  return parseAIJson<InvestmentThesis>(response);
}

async function generateRiskNarrative(reportData: any, fullData: any): Promise<RiskNarrative | null> {
  const feasibility = fullData?.airdna_feasibility;
  const marketSaturation = fullData?.market_saturation;
  
  const prompt = `Analyze risks for this rental arbitrage opportunity and return JSON.

PROPERTY: ${reportData.bedrooms} bedrooms at ${reportData.address}
MARKET: ${reportData.marketName}
MONTHLY RENT: $${reportData.monthlyRent}
PROJECTED PROFIT: $${reportData.annualProfitRealistic}/year

MARKET DATA:
- Active Listings: ${marketSaturation?.total_listings || 'Unknown'}
- Same Bedroom Count: ${marketSaturation?.same_bedroom_count || 'Unknown'}

AIRDNA FEASIBILITY:
${JSON.stringify(feasibility, null, 2)}

Return a JSON object with this exact structure:
{
  "overallRisk": "low|medium|high",
  "riskScore": 1-10,
  "marketRisks": [{"risk": "Description", "severity": "low|medium|high", "mitigation": "How to mitigate"}],
  "financialRisks": [{"risk": "Description", "severity": "low|medium|high", "mitigation": "How to mitigate"}],
  "operationalRisks": [{"risk": "Description", "severity": "low|medium|high", "mitigation": "How to mitigate"}],
  "regulatoryRisks": [{"risk": "Description", "severity": "low|medium|high", "mitigation": "How to mitigate"}],
  "summary": "2-3 sentence risk summary"
}`;

  const response = await callAI(prompt, 'You are a risk analyst specializing in real estate. Respond only with valid JSON.');
  return parseAIJson<RiskNarrative>(response);
}

async function generatePricingStrategy(reportData: any, fullData: any): Promise<PricingStrategy | null> {
  const competitors = fullData?.competitors || [];
  const seasonality = fullData?.seasonality || [];
  const topPerformerPricing = fullData?.top_performer_pricing;
  
  const competitorADRs = competitors.map((c: any) => c.adr).filter((a: number) => a > 0);
  const avgADR = competitorADRs.length ? competitorADRs.reduce((a: number, b: number) => a + b, 0) / competitorADRs.length : reportData.averageDailyRate;
  
  const prompt = `Create a pricing strategy for this rental property and return JSON.

PROPERTY: ${reportData.bedrooms} bedrooms at ${reportData.address}
MARKET ADR: $${reportData.averageDailyRate}/night
COMPETITOR ADRs: ${competitorADRs.slice(0, 5).map((a: number) => `$${a}`).join(', ')}

SEASONALITY:
${seasonality.slice(0, 6).map((s: any) => `${s.month}: $${s.revenue} revenue, ${s.occupancy}% occupancy`).join('\n')}

TOP PERFORMER PRICING:
${JSON.stringify(topPerformerPricing, null, 2)}

Return a JSON object with this exact structure:
{
  "baseRate": 150,
  "peakSeasonPremium": 25,
  "offSeasonDiscount": 15,
  "weekendPremium": 20,
  "minimumStay": {"weekday": 2, "weekend": 2, "peak": 3},
  "dynamicPricingRecommendation": "Recommendation for dynamic pricing tools",
  "competitorPricing": {"low": 100, "median": 150, "high": 200},
  "suggestedRange": {"min": 120, "max": 180},
  "strategy": "2-3 sentence pricing strategy summary"
}`;

  const response = await callAI(prompt, 'You are a revenue management expert for short-term rentals. Respond only with valid JSON.');
  return parseAIJson<PricingStrategy>(response);
}

async function generateEnhancedExecutiveSummary(reportData: any, fullData: any): Promise<string | null> {
  const revenueToRentRatio = reportData.annualRevenueRealistic / (reportData.monthlyRent * 12);
  const competitors = fullData?.competitors?.length || 0;
  const qualifyingCompetitors = fullData?.qualifying_competitors;
  
  const prompt = `Write a comprehensive executive summary (300-400 words) for this rental arbitrage analysis.

PROPERTY: ${reportData.bedrooms} bedrooms, ${reportData.bathrooms} bathrooms at ${reportData.address}
MARKET: ${reportData.marketName}

FINANCIALS:
- Monthly Rent: $${reportData.monthlyRent}
- Projected Revenue: $${reportData.annualRevenueRealistic}/year (range: $${reportData.annualRevenueConservative} - $${reportData.annualRevenueOptimistic})
- Revenue-to-Rent Ratio: ${revenueToRentRatio.toFixed(2)}x
- Projected Profit: $${reportData.annualProfitRealistic}/year

MARKET CONTEXT:
- Market Occupancy: ${reportData.occupancyRate}%
- Market ADR: $${reportData.averageDailyRate}/night
- Direct Competitors: ${competitors}
- Qualifying Competitors (meeting 2x threshold): ${qualifyingCompetitors?.qualifying_count || 'Unknown'}

Write a professional summary covering:
1. Property overview and market position
2. Revenue potential and profit projections
3. Competitive landscape analysis
4. Key opportunities and risks
5. Overall assessment

Use **bold** for key metrics. Be specific with numbers. Do NOT give investment advice or recommendations.`;

  return await callAI(prompt, 'You are a senior real estate analyst writing for sophisticated investors.');
}

async function generateMarketNarrative(reportData: any, fullData: any): Promise<string | null> {
  const marketSaturation = fullData?.market_saturation;
  const submarketExploration = fullData?.submarket_exploration;
  const supplyTrend = fullData?.supply_trend;
  
  const prompt = `Write a detailed market analysis narrative (400-500 words) for this market.

MARKET: ${reportData.marketName}

MARKET METRICS:
- Total Listings: ${marketSaturation?.total_listings || 'Unknown'}
- Average Revenue: $${marketSaturation?.avg_revenue || 'Unknown'}
- Average ADR: $${marketSaturation?.avg_adr || 'Unknown'}
- Average Occupancy: ${marketSaturation?.avg_occupancy || 'Unknown'}%

SUPPLY TREND:
${JSON.stringify(supplyTrend, null, 2)}

SUBMARKET ANALYSIS:
${JSON.stringify(submarketExploration, null, 2)}

Write a comprehensive market analysis covering:
1. Market overview and size
2. Supply and demand dynamics
3. Neighborhood/submarket comparison
4. Competition landscape
5. Market trajectory and outlook

Use **bold** for key metrics. Be specific with numbers. Focus on facts, not recommendations.`;

  return await callAI(prompt, 'You are a market research analyst specializing in short-term rentals.');
}

async function generateActionPlan(reportData: any, fullData: any): Promise<ActionPlan | null> {
  const prompt = `Create a detailed action plan for launching this rental arbitrage property and return JSON.

PROPERTY: ${reportData.bedrooms} bedrooms at ${reportData.address}
MONTHLY RENT: $${reportData.monthlyRent}
PROJECTED MONTHLY PROFIT: $${Math.round(reportData.annualProfitRealistic / 12)}

Create a phased launch plan with specific tasks, timelines, and costs.

Return a JSON object with this exact structure:
{
  "phases": [
    {
      "phase": 1,
      "name": "Pre-Launch",
      "duration": "2 weeks",
      "tasks": [
        {"task": "Sign lease", "priority": "high", "estimatedCost": "$0"},
        {"task": "Verify STR regulations", "priority": "high", "estimatedCost": "$0"}
      ],
      "milestones": ["Lease signed", "Regulations verified"]
    }
  ],
  "totalTimeline": "6-8 weeks",
  "totalBudget": "$15,000-$25,000",
  "criticalPath": ["Sign lease", "Furnish property", "Professional photos", "Go live"]
}`;

  const response = await callAI(prompt, 'You are a project manager specializing in short-term rental launches. Respond only with valid JSON.');
  return parseAIJson<ActionPlan>(response);
}

export { processDeepAnalysis };

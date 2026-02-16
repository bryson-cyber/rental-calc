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
 * 
 * OPTIMIZATION: Runs AI sections in parallel for faster generation (~20-30s instead of ~100s)
 */

import { getDb } from './db';
import { deepAnalysis, analysisReports } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { ENV } from './_core/env';
import { invokeLLM } from './_core/llm';

// AI provider timeout - reduced for faster failure
const AI_TIMEOUT_MS = 45000; // 45 seconds per call (reduced from 120s)

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
  currentStep: string | null;
  completedSteps: string[];
}> {
  const db = await getDb();
  if (!db) return { status: 'error', result: null, error: 'Database not available', processingTimeMs: null, currentStep: null, completedSteps: [] };
  
  const analysis = await db.select().from(deepAnalysis).where(eq(deepAnalysis.reportId, reportId)).limit(1);
  
  if (!analysis.length) {
    return { status: 'not_started', result: null, error: null, processingTimeMs: null, currentStep: null, completedSteps: [] };
  }

  const record = analysis[0];
  const completedSteps = record.completedSteps ? (typeof record.completedSteps === 'string' ? JSON.parse(record.completedSteps) : record.completedSteps) : [];
  
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
      currentStep: null,
      completedSteps: ['executiveSummary', 'marketScenarios', 'historicalContext', 'riskAssessment', 'pricingData', 'marketDeepDive'],
    };
  }

  return {
    status: record.status,
    result: null,
    error: record.errorMessage,
    processingTimeMs: record.processingTimeMs,
    currentStep: record.currentStep,
    completedSteps,
  };
}

/**
 * Process deep analysis (runs in background) - OPTIMIZED FOR PARALLEL EXECUTION
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

    // Extract key metrics from fullData
    const profitability = fullData?.profitability;
    const propertyEstimate = fullData?.property_estimate;
    const monthlyRent = reportData.monthlyRent || profitability?.monthly_expenses?.rent || 0;
    
    const extractedData = {
      address: reportData.address || fullData?.address || 'Unknown',
      bedrooms: (reportData.bedrooms ?? propertyEstimate?.bedrooms) ?? 0,
      bathrooms: (reportData.bathrooms ?? propertyEstimate?.bathrooms) ?? 0,
      monthlyRent: monthlyRent,
      marketName: reportData.marketName || propertyEstimate?.market_name || 'Unknown',
      annualRevenueRealistic: reportData.annualRevenueRealistic || profitability?.scenarios?.realistic?.projected_revenue || propertyEstimate?.revenue || 0,
      annualRevenueConservative: reportData.annualRevenueConservative || profitability?.scenarios?.conservative?.projected_revenue || 0,
      annualRevenueOptimistic: reportData.annualRevenueOptimistic || profitability?.scenarios?.optimistic?.projected_revenue || 0,
      annualProfitRealistic: reportData.annualProfitRealistic || profitability?.scenarios?.realistic?.estimated_profit || 0,
      annualProfitConservative: reportData.annualProfitConservative || profitability?.scenarios?.conservative?.estimated_profit || 0,
      annualProfitOptimistic: reportData.annualProfitOptimistic || profitability?.scenarios?.optimistic?.estimated_profit || 0,
      occupancyRate: reportData.occupancyRate || 
        propertyEstimate?.occupancy || 
        fullData?.submarket_exploration?.market_metrics?.occupancy ||
        fullData?.historical_context?.occupancy?.current_year_avg ||
        fullData?.same_bedroom_competitors?.avg_occupancy ||
        fullData?.market_overview?.avg_occupancy ||
        57,
      averageDailyRate: reportData.averageDailyRate || propertyEstimate?.adr || 0,
      breakEvenOccupancy: reportData.breakEvenOccupancy || 0,
      revenueToRentRatio: monthlyRent > 0 
        ? (profitability?.scenarios?.realistic?.projected_revenue || propertyEstimate?.revenue || 0) / (monthlyRent * 12) 
        : 0,
    };

    console.log('[DeepAnalysis] Starting PARALLEL generation for report', reportId);

    // Helper to update progress
    const updateProgress = async (step: string, completedSteps: string[]) => {
      await db.update(deepAnalysis)
        .set({ currentStep: step, completedSteps: JSON.stringify(completedSteps) })
        .where(eq(deepAnalysis.id, deepAnalysisId));
    };

    // PARALLEL EXECUTION: Run all 6 sections at once
    await updateProgress('Generating all sections in parallel...', []);

    // Create promises for all sections
    const sectionPromises = [
      // Section 1: Executive Summary
      generateEnhancedExecutiveSummary(extractedData, fullData)
        .then(result => {
          console.log('[DeepAnalysis] Executive Summary completed');
          return { key: 'executiveSummary', result };
        })
        .catch(err => {
          console.error('[DeepAnalysis] Executive Summary failed:', err.message);
          return { key: 'executiveSummary', result: null };
        }),
      
      // Section 2: Market Scenarios (Investment Thesis)
      generateInvestmentThesis(extractedData, fullData)
        .then(result => {
          console.log('[DeepAnalysis] Market Scenarios completed');
          return { key: 'marketScenarios', result };
        })
        .catch(err => {
          console.error('[DeepAnalysis] Market Scenarios failed:', err.message);
          return { key: 'marketScenarios', result: null };
        }),
      
      // Section 3: Historical Context
      generateHistoricalContext(extractedData, fullData)
        .then(result => {
          console.log('[DeepAnalysis] Historical Context completed');
          return { key: 'historicalContext', result };
        })
        .catch(err => {
          console.error('[DeepAnalysis] Historical Context failed:', err.message);
          return { key: 'historicalContext', result: null };
        }),
      
      // Section 4: Risk Assessment
      generateRiskNarrative(extractedData, fullData)
        .then(result => {
          console.log('[DeepAnalysis] Risk Assessment completed');
          return { key: 'riskAssessment', result };
        })
        .catch(err => {
          console.error('[DeepAnalysis] Risk Assessment failed:', err.message);
          return { key: 'riskAssessment', result: null };
        }),
      
      // Section 5: Pricing Data
      generatePricingStrategy(extractedData, fullData)
        .then(result => {
          console.log('[DeepAnalysis] Pricing Data completed');
          return { key: 'pricingData', result };
        })
        .catch(err => {
          console.error('[DeepAnalysis] Pricing Data failed:', err.message);
          return { key: 'pricingData', result: null };
        }),
      
      // Section 6: Market Deep Dive
      generateMarketNarrative(extractedData, fullData)
        .then(result => {
          console.log('[DeepAnalysis] Market Deep Dive completed');
          return { key: 'marketDeepDive', result };
        })
        .catch(err => {
          console.error('[DeepAnalysis] Market Deep Dive failed:', err.message);
          return { key: 'marketDeepDive', result: null };
        }),
    ];

    // Wait for all sections to complete
    const results = await Promise.all(sectionPromises);
    
    // Extract results
    const executiveSummaryEnhanced = results.find(r => r.key === 'executiveSummary')?.result as string | null;
    const investmentThesis = results.find(r => r.key === 'marketScenarios')?.result as InvestmentThesis | null;
    const historicalContext = results.find(r => r.key === 'historicalContext')?.result as HistoricalContext | null;
    const riskNarrative = results.find(r => r.key === 'riskAssessment')?.result as RiskNarrative | null;
    const pricingStrategy = results.find(r => r.key === 'pricingData')?.result as PricingStrategy | null;
    const marketNarrative = results.find(r => r.key === 'marketDeepDive')?.result as string | null;

    // Action plan is removed
    const actionPlan = null;

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
        completedSteps: JSON.stringify(['executiveSummary', 'marketScenarios', 'historicalContext', 'riskAssessment', 'pricingData', 'marketDeepDive']),
      })
      .where(eq(deepAnalysis.id, deepAnalysisId));

    console.log(`[DeepAnalysis] Completed for report ${reportId} in ${processingTimeMs}ms (${(processingTimeMs / 1000).toFixed(1)}s)`);

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
 * Call AI using Forge/LLM API for high-quality narratives
 */
async function callAI(prompt: string, systemPrompt: string = ''): Promise<string> {
  console.log('[DeepAnalysis] Calling AI via Forge...');
  
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt || 'You are a market data analyst for Coach Inayah. Present data and insights clearly and objectively.' },
        { role: 'user', content: prompt }
      ],
    });
    
    const text = String(response.choices?.[0]?.message?.content || '');
    console.log(`[DeepAnalysis] AI response received: ${text.length} chars`);
    return text;
  } catch (error: any) {
    console.error('[DeepAnalysis] AI error:', error.message);
    throw error;
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

  const response = await callAI(prompt, 'You are a market data analyst for Coach Inayah. Present historical data and trends only - do not give recommendations. Respond only with valid JSON.');
  return parseAIJson<HistoricalContext>(response);
}

async function generateInvestmentThesis(reportData: any, fullData: any): Promise<InvestmentThesis | null> {
  const revenueToRentRatio = reportData.revenueToRentRatio || 
    (reportData.monthlyRent > 0 ? reportData.annualRevenueRealistic / (reportData.monthlyRent * 12) : 0);
  const occupancy = reportData.occupancyRate;
  const competitors = fullData?.competitors?.length || 0;
  
  const prompt = `Generate market scenarios for this rental arbitrage opportunity in JSON format.

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
  "summary": "2-3 sentence market scenario summary",
  "bullCase": "Best case scenario description",
  "bearCase": "Worst case scenario description",
  "baseCase": "Most likely scenario description",
  "keyAssumptions": ["Assumption 1", "Assumption 2", "Assumption 3"],
  "catalysts": ["What could drive outperformance"],
  "risks": ["Key risks to thesis"],
  "confidenceLevel": "high|medium|low",
  "recommendation": "Summary of the data - do not give prescriptive advice"
}`;

  const response = await callAI(prompt, 'You are a real estate data analyst. Present data and insights only - do not give investment advice or tell people what to do. Respond only with valid JSON.');
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

FEASIBILITY DATA:
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

  const response = await callAI(prompt, 'You are a risk data analyst for Coach Inayah. Present risk factors and data only - do not give recommendations. Respond only with valid JSON.');
  return parseAIJson<RiskNarrative>(response);
}

async function generatePricingStrategy(reportData: any, fullData: any): Promise<PricingStrategy | null> {
  const competitors = fullData?.competitors || [];
  const seasonality = fullData?.seasonality || [];
  const topPerformerPricing = fullData?.top_performer_pricing;
  
  const competitorADRs = competitors.map((c: any) => c.adr).filter((a: number) => a > 0);
  const avgADR = competitorADRs.length ? competitorADRs.reduce((a: number, b: number) => a + b, 0) / competitorADRs.length : reportData.averageDailyRate;
  
  const prompt = `Create a pricing analysis for this rental property and return JSON.

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
  "dynamicPricingRecommendation": "Insight about dynamic pricing tools",
  "competitorPricing": {"low": 100, "median": 150, "high": 200},
  "suggestedRange": {"min": 120, "max": 180},
  "strategy": "2-3 sentence pricing analysis summary"
}`;

  const response = await callAI(prompt, 'You are a pricing data analyst for Coach Inayah. Present pricing data and market comparisons only - do not give recommendations. Respond only with valid JSON.');
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

  return await callAI(prompt, 'You are a real estate data analyst for Coach Inayah. Present data and insights only - do not give investment advice or recommendations. Do not tell people what to do.');
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

  return await callAI(prompt, 'You are a market data analyst for Coach Inayah. Present data and insights only - do not give recommendations or tell people what to do.');
}

// Action Plan generation removed - we only present data and insights, not prescriptive advice
async function generateActionPlan(_reportData: any, _fullData: any): Promise<ActionPlan | null> {
  return null;
}

export { processDeepAnalysis };

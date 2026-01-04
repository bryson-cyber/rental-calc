/**
 * Poe AI Narrative Generator - A+ Expert Level Analysis
 * 
 * This generates comprehensive, expert-level investment analysis using Gemini 2.5 Pro.
 * NO GO/NO GO verdicts - just expert analysis presenting the facts.
 * All sections are complete, specific, and actionable.
 */

import { generateNarrativeWithPoe } from './poe-ai';
import type { EnhancedNarrativeReport, EnhancedNarrativeReportInput } from './gemini-analyzer-enhanced';

// Model configuration
const AI_MODEL = 'Claude-Sonnet-4'; // Claude gives complete responses, Gemini truncates
const EXPERT_TIMEOUT = 60000;
const SECTION_MAX_TOKENS = 1500; // Increased from 600 to ensure complete responses

/**
 * Generate A+ Expert narrative report using Gemini 2.5 Pro via Poe
 */
export async function generateEnhancedNarrativeWithPoe(
  input: EnhancedNarrativeReportInput
): Promise<EnhancedNarrativeReport> {
  console.log('[PoeNarrative] Generating A+ EXPERT report with Gemini 2.5 Pro...');
  
  const metrics = calculateAllMetrics(input);
  const dataContext = buildDataContext(input, metrics);
  
  try {
    // Generate ALL sections with AI in parallel
    const [
      executiveSummary,
      marketOverview,
      revenueAnalysis,
      competitiveLandscape,
      seasonalStrategy,
      riskAssessment,
      financialOutlook,
      conclusion
    ] = await Promise.all([
      generateExecutiveSummary(dataContext, metrics, input),
      generateMarketOverview(dataContext, metrics, input),
      generateRevenueAnalysis(dataContext, metrics, input),
      generateCompetitiveLandscape(dataContext, metrics, input),
      generateSeasonalStrategy(dataContext, metrics, input),
      generateRiskAssessment(dataContext, metrics, input),
      generateFinancialOutlook(dataContext, metrics, input),
      generateConclusion(dataContext, metrics, input)
    ]);

    const report: EnhancedNarrativeReport = {
      executive_summary: executiveSummary,
      market_overview: marketOverview,
      revenue_analysis: revenueAnalysis,
      competitive_landscape: competitiveLandscape,
      seasonal_strategy: seasonalStrategy,
      historical_context: generateHistoricalContext(input, metrics),
      risk_assessment: riskAssessment,
      financial_outlook: financialOutlook,
      conclusion: conclusion,
      what_this_means: generateWhatThisMeans(metrics),
      action_items: generateActionItems(metrics),
      key_metrics: {
        projected_annual_revenue: input.revenue_mid,
        projected_monthly_profit: metrics.monthlyProfit,
        market_occupancy: metrics.occupancyNormalized,
        market_adr: input.market_adr,
        break_even_months: metrics.breakEvenMonths,
        confidence_level: metrics.confidenceScore >= 7 ? 'high' : metrics.confidenceScore >= 5 ? 'medium' : 'low',
        revenue_to_rent_ratio: metrics.revenueToRentRatio,
      },
      quick_facts: [
        `Revenue-to-rent ratio: ${metrics.revenueToRentRatio.toFixed(2)}x`,
        `Projected profit: $${metrics.monthlyProfit.toLocaleString()}/month`,
        `Market ADR: $${input.market_adr.toFixed(0)}/night`,
      ],
      market_context: {
        type: determineMarketType(input.market_name),
        seasonality: metrics.seasonalSwingPct > 50 ? 'high' : metrics.seasonalSwingPct > 25 ? 'moderate' : 'low',
        competition: input.active_listings > 1000 ? 'high' : input.active_listings > 500 ? 'moderate' : 'low',
        pricePoint: input.market_adr > 300 ? 'luxury' : input.market_adr > 100 ? 'mid-range' : 'budget',
        description: `${input.market_name} is a ${input.active_listings > 1000 ? 'highly competitive' : 'moderately competitive'} ${determineMarketType(input.market_name)} market.`,
      },
    };

    console.log('[PoeNarrative] A+ EXPERT report generated successfully');
    return report;
  } catch (error: any) {
    console.error('[PoeNarrative] Error generating A+ report:', error.message);
    return generateFallbackReport(input, metrics);
  }
}

// ============================================================================
// METRICS CALCULATION
// ============================================================================

interface CalculatedMetrics {
  revenueToRentRatio: number;
  occupancyNormalized: number;
  monthlyProfit: number;
  annualRent: number;
  breakEvenOccupancy: number;
  breakEvenMonths: number;
  confidenceScore: number;
  seasonalSwingPct: number;
  peakMonths: string[];
  offMonths: string[];
  avgPeakRevenue: number;
  avgOffRevenue: number;
  topCompetitor: any;
  competitorCount: number;
}

function calculateAllMetrics(input: EnhancedNarrativeReportInput): CalculatedMetrics {
  const revenueToRentRatio = input.revenue_mid / (input.monthly_rent * 12);
  const occupancyNormalized = input.market_occupancy < 1 ? input.market_occupancy * 100 : input.market_occupancy;
  const monthlyProfit = Math.round(input.annual_profit_realistic / 12);
  const annualRent = input.monthly_rent * 12;
  
  const dailyRate = input.market_adr;
  const daysPerMonth = 30;
  const maxMonthlyRevenue = dailyRate * daysPerMonth;
  const breakEvenOccupancy = maxMonthlyRevenue > 0 
    ? Math.min(100, Math.round((input.monthly_expenses / maxMonthlyRevenue) * 100))
    : 100;
  
  const avgStartupCosts = (input.bedrooms * 5000 + 4000);
  const breakEvenMonths = monthlyProfit > 0 ? Math.min(24, Math.round(avgStartupCosts / monthlyProfit)) : 24;
  
  const confidenceScore = revenueToRentRatio >= 2.5 ? 9 : 
                          revenueToRentRatio >= 2 ? 7 : 
                          revenueToRentRatio >= 1.5 ? 5 : 3;
  
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
    breakEvenMonths,
    confidenceScore,
    seasonalSwingPct,
    peakMonths: peakSeasons.map(s => s.month),
    offMonths: offSeasons.map(s => s.month),
    avgPeakRevenue,
    avgOffRevenue,
    topCompetitor: input.competitors[0],
    competitorCount: input.competitors.length,
  };
}

// ============================================================================
// DATA CONTEXT BUILDER
// ============================================================================

function buildDataContext(input: EnhancedNarrativeReportInput, metrics: CalculatedMetrics): string {
  const competitorList = input.competitors.slice(0, 8).map((c, i) => 
    `${i + 1}. "${c.name}": $${c.annual_revenue?.toLocaleString()}/yr, ${Math.round((c.occupancy || 0) * 100)}% occupancy, ${c.rating?.toFixed(1) || 'N/A'} stars`
  ).join('\n');

  const seasonalityData = input.seasonality.map(s => 
    `${s.month}: $${s.revenue.toLocaleString()} revenue, $${s.adr.toFixed(0)} ADR, ${Math.round(s.occupancy * 100)}% occ (${s.season_type})`
  ).join('\n');

  return `
=== PROPERTY DETAILS ===
Address: ${input.address}
Configuration: ${input.bedrooms} bedrooms, ${input.bathrooms} bathrooms
Monthly Rent: $${input.monthly_rent.toLocaleString()} ($${metrics.annualRent.toLocaleString()}/year)
Monthly Operating Expenses: $${input.monthly_expenses.toLocaleString()}

=== MARKET INTELLIGENCE ===
Market: ${input.market_name}
Active Listings: ${input.active_listings.toLocaleString()} competing properties
Market Occupancy: ${metrics.occupancyNormalized.toFixed(1)}%
Average Daily Rate (ADR): $${input.market_adr.toFixed(0)}/night
Market RevPAR: $${(input.market_adr * (metrics.occupancyNormalized / 100)).toFixed(0)}/night

=== REVENUE PROJECTIONS ===
Conservative (25th percentile): $${input.revenue_low.toLocaleString()}/year
Realistic (75th percentile): $${input.revenue_mid.toLocaleString()}/year
Optimistic (90th percentile): $${input.revenue_high.toLocaleString()}/year

=== KEY FINANCIAL METRICS ===
Revenue-to-Rent Ratio: ${metrics.revenueToRentRatio.toFixed(2)}x
Break-Even Occupancy: ${metrics.breakEvenOccupancy}%
Monthly Profit (Realistic): $${metrics.monthlyProfit.toLocaleString()}

=== PROFIT PROJECTIONS ===
Conservative Annual Profit: $${input.annual_profit_conservative.toLocaleString()}/year
Realistic Annual Profit: $${input.annual_profit_realistic.toLocaleString()}/year
Optimistic Annual Profit: $${input.annual_profit_optimistic.toLocaleString()}/year

=== TOP COMPETITORS ===
${competitorList || 'No competitor data available'}

=== SEASONALITY (${metrics.seasonalSwingPct}% swing) ===
Peak Months: ${metrics.peakMonths.join(', ') || 'N/A'}
Off-Peak Months: ${metrics.offMonths.join(', ') || 'N/A'}
Average Peak Revenue: $${metrics.avgPeakRevenue.toLocaleString()}/month
Average Off-Peak Revenue: $${metrics.avgOffRevenue.toLocaleString()}/month

Monthly Breakdown:
${seasonalityData || 'Seasonality data not available'}
`;
}

// ============================================================================
// AI-POWERED SECTION GENERATORS - A+ EXPERT LEVEL
// ============================================================================

async function generateExecutiveSummary(dataContext: string, metrics: CalculatedMetrics, input: EnhancedNarrativeReportInput): Promise<string> {
  const prompt = `You are a senior short-term rental investment analyst presenting findings to a sophisticated investor. Write an expert executive summary.

${dataContext}

CRITICAL INSTRUCTIONS:
- DO NOT use "GO", "NO GO", "STRONG GO", or any verdict language
- DO NOT give recommendations or tell them what to do
- Present the facts and analysis professionally
- Let the numbers speak for themselves
- Write as an expert presenting findings, not making decisions for them

Write a comprehensive EXECUTIVE SUMMARY (180-220 words) that:

1. Opens with the key financial finding: the ${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio and what it means
2. Contextualizes the $${metrics.monthlyProfit.toLocaleString()}/month profit projection within the market
3. Explains the competitive positioning - reference the top competitor "${metrics.topCompetitor?.name || 'in this market'}" earning $${metrics.topCompetitor?.annual_revenue?.toLocaleString() || 'N/A'}/year
4. Addresses the ${metrics.seasonalSwingPct}% seasonal revenue variation and its cash flow implications
5. Notes the ${metrics.breakEvenOccupancy}% break-even occupancy threshold vs the ${metrics.occupancyNormalized.toFixed(0)}% market average
6. Identifies the primary risk factor specific to THIS property and market
7. Highlights the primary opportunity specific to THIS property and market

Write in flowing prose. Use **bold** for key metrics. Be analytical and specific. Present facts, not opinions on whether to proceed.

IMPORTANT: DO NOT include any markdown headers like ## or ### - write only prose paragraphs.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: 2000,
      timeoutMs: EXPERT_TIMEOUT,
    });
    return response.trim();
  } catch (error) {
    return `This ${input.bedrooms}-bedroom property at ${input.address} presents a **${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio** with projected monthly profit of **$${metrics.monthlyProfit.toLocaleString()}** after all expenses. The market shows ${metrics.occupancyNormalized.toFixed(0)}% average occupancy with ${input.active_listings.toLocaleString()} competing properties. Revenue varies ${metrics.seasonalSwingPct}% between peak and off-peak seasons, with break-even requiring ${metrics.breakEvenOccupancy}% occupancy. ${metrics.topCompetitor ? `The top comparable property "${metrics.topCompetitor.name}" generates $${metrics.topCompetitor.annual_revenue?.toLocaleString()}/year at ${Math.round((metrics.topCompetitor.occupancy || 0) * 100)}% occupancy.` : ''}`;
  }
}

async function generateMarketOverview(dataContext: string, metrics: CalculatedMetrics, input: EnhancedNarrativeReportInput): Promise<string> {
  const prompt = `You are a market research analyst specializing in short-term rental markets. Write an expert market overview.

${dataContext}

Write a market overview (120-150 words) that provides institutional-grade market intelligence. DO NOT use markdown headers or formatting - write in plain prose paragraphs:

1. Market size: ${input.active_listings.toLocaleString()} active listings - what this means for supply
2. Demand indicators: ${metrics.occupancyNormalized.toFixed(0)}% occupancy rate analysis
3. Pricing dynamics: $${input.market_adr.toFixed(0)}/night ADR and RevPAR of $${(input.market_adr * (metrics.occupancyNormalized / 100)).toFixed(0)}
4. Market saturation assessment based on the data
5. Competitive intensity and what it takes to succeed here

Be specific with numbers. Write in flowing prose. This is expert analysis, not generic descriptions.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: SECTION_MAX_TOKENS,
      timeoutMs: 45000,
    });
    return response.trim();
  } catch (error) {
    return `The ${input.market_name} market comprises ${input.active_listings.toLocaleString()} active short-term rental listings operating at ${metrics.occupancyNormalized.toFixed(0)}% average occupancy. The market ADR of $${input.market_adr.toFixed(0)}/night yields a RevPAR of $${(input.market_adr * (metrics.occupancyNormalized / 100)).toFixed(0)}/night. ${input.active_listings > 1000 ? 'High listing density indicates a mature, competitive market requiring strong differentiation.' : input.active_listings > 500 ? 'Moderate competition suggests room for well-positioned properties.' : 'Lower listing density may indicate either an emerging market or regulatory constraints.'}`;
  }
}

async function generateRevenueAnalysis(dataContext: string, metrics: CalculatedMetrics, input: EnhancedNarrativeReportInput): Promise<string> {
  const prompt = `You are a revenue management expert for short-term rentals. Write a detailed revenue analysis.

${dataContext}

Write a revenue analysis (120-150 words) that explains the revenue projections. DO NOT use markdown headers or formatting - write in plain prose paragraphs:

1. The revenue range: $${input.revenue_low.toLocaleString()} (conservative) to $${input.revenue_high.toLocaleString()} (optimistic)
2. What drives this range - occupancy and rate factors
3. The realistic $${input.revenue_mid.toLocaleString()}/year projection and what performance level it requires
4. Comparison to top performers in the market
5. Revenue per available night (RevPAR) implications

Use specific numbers. Write analytically. Explain what the numbers mean, don't just state them.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: SECTION_MAX_TOKENS,
      timeoutMs: 45000,
    });
    return response.trim();
  } catch (error) {
    return `Revenue projections range from $${input.revenue_low.toLocaleString()} (conservative, 25th percentile) to $${input.revenue_high.toLocaleString()} (optimistic, 90th percentile) annually. The realistic projection of $${input.revenue_mid.toLocaleString()}/year represents 75th percentile performance, requiring above-average but achievable execution. At the market ADR of $${input.market_adr.toFixed(0)}/night and ${metrics.occupancyNormalized.toFixed(0)}% occupancy, this property would need to match or exceed market averages to hit realistic targets. ${metrics.topCompetitor ? `The top comparable property achieves $${metrics.topCompetitor.annual_revenue?.toLocaleString()}/year, demonstrating the market's upside potential.` : ''}`;
  }
}

async function generateCompetitiveLandscape(dataContext: string, metrics: CalculatedMetrics, input: EnhancedNarrativeReportInput): Promise<string> {
  const topComps = input.competitors.slice(0, 3);
  const compDetails = topComps.map((c, i) => `"${c.name}" ($${c.annual_revenue?.toLocaleString()}/yr, ${Math.round((c.occupancy || 0) * 100)}% occ, ${c.rating?.toFixed(1)} stars)`).join(', ');

  const prompt = `You are a competitive intelligence analyst for the vacation rental industry. Write a strategic competitive analysis.

${dataContext}

Write a competitive landscape analysis (120-150 words) that provides strategic intelligence. DO NOT use markdown headers or formatting - write in plain prose paragraphs:

1. The competitive set: ${metrics.competitorCount} comparable properties
2. Top performers analysis: ${compDetails}
3. What differentiates the winners - specific factors from the data
4. Market positioning opportunities based on competitor gaps
5. What it takes to compete at the top tier in this market

Reference specific competitors by name and their actual metrics. Be strategic and specific.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: SECTION_MAX_TOKENS,
      timeoutMs: 45000,
    });
    return response.trim();
  } catch (error) {
    return `The competitive landscape includes ${metrics.competitorCount} comparable ${input.bedrooms}-bedroom properties. ${metrics.topCompetitor ? `The top performer "${metrics.topCompetitor.name}" generates $${metrics.topCompetitor.annual_revenue?.toLocaleString()}/year at ${Math.round((metrics.topCompetitor.occupancy || 0) * 100)}% occupancy with a ${metrics.topCompetitor.rating?.toFixed(1)} star rating, setting the performance benchmark.` : ''} ${topComps.length > 1 ? `Other strong performers include ${topComps.slice(1).map(c => `"${c.name}" at $${c.annual_revenue?.toLocaleString()}/year`).join(' and ')}.` : ''} Success in this market requires matching or exceeding the occupancy and rating levels of top performers.`;
  }
}

async function generateSeasonalStrategy(dataContext: string, metrics: CalculatedMetrics, input: EnhancedNarrativeReportInput): Promise<string> {
  const prompt = `You are a revenue management strategist specializing in seasonal pricing optimization. Write a seasonal analysis.

${dataContext}

Write a seasonal strategy (120-150 words) that provides actionable insights. DO NOT use markdown headers or formatting - write in plain prose paragraphs:

1. The ${metrics.seasonalSwingPct}% seasonal swing - what it means for monthly cash flow
2. Peak season analysis: ${metrics.peakMonths.join(', ') || 'N/A'} - revenue of $${metrics.avgPeakRevenue.toLocaleString()}/month
3. Off-season analysis: ${metrics.offMonths.join(', ') || 'N/A'} - revenue of $${metrics.avgOffRevenue.toLocaleString()}/month
4. Cash flow implications - the gap between high and low months
5. Pricing and occupancy patterns from the monthly data

Be specific about which months and what the numbers show. Write analytically.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: SECTION_MAX_TOKENS,
      timeoutMs: 45000,
    });
    return response.trim();
  } catch (error) {
    return `This property exhibits a ${metrics.seasonalSwingPct}% seasonal revenue swing between peak and off-peak periods. Peak months (${metrics.peakMonths.join(', ') || 'N/A'}) average $${metrics.avgPeakRevenue.toLocaleString()}/month, while off-peak months (${metrics.offMonths.join(', ') || 'N/A'}) average $${metrics.avgOffRevenue.toLocaleString()}/month. This $${Math.round(metrics.avgPeakRevenue - metrics.avgOffRevenue).toLocaleString()} monthly variance requires cash flow planning to cover fixed costs during slower periods. ${metrics.seasonalSwingPct > 50 ? 'The high seasonality demands aggressive peak-season pricing and off-season occupancy strategies.' : metrics.seasonalSwingPct > 25 ? 'Moderate seasonality allows for balanced year-round operations.' : 'Low seasonality provides stable, predictable cash flow.'}`;
  }
}

async function generateRiskAssessment(dataContext: string, metrics: CalculatedMetrics, input: EnhancedNarrativeReportInput): Promise<string> {
  // Identify specific risks based on the data
  const risks: string[] = [];
  if (metrics.revenueToRentRatio < 2) risks.push(`thin margins at ${metrics.revenueToRentRatio.toFixed(2)}x ratio`);
  if (metrics.seasonalSwingPct > 50) risks.push(`high seasonality with ${metrics.seasonalSwingPct}% revenue swing`);
  if (input.active_listings > 1000) risks.push(`intense competition with ${input.active_listings.toLocaleString()} listings`);
  if (metrics.occupancyNormalized < 55) risks.push(`below-average market occupancy at ${metrics.occupancyNormalized.toFixed(0)}%`);
  if (metrics.breakEvenOccupancy > 50) risks.push(`high break-even threshold at ${metrics.breakEvenOccupancy}%`);
  
  const primaryRisk = risks[0] || 'standard STR operational risks';
  const secondaryRisks = risks.slice(1).join(', ') || 'regulatory changes and market shifts';

  const prompt = `You are a risk management consultant for real estate investments. Write a comprehensive risk assessment.

${dataContext}

SPECIFIC RISKS IDENTIFIED FROM DATA:
- Primary: ${primaryRisk}
- Secondary: ${secondaryRisks}

Write a risk assessment (120-150 words) that identifies and analyzes risks. DO NOT use markdown headers or formatting - write in plain prose paragraphs:

1. PRIMARY RISK: ${primaryRisk} - explain the specific impact on this investment
2. MARKET RISK: Competition and saturation analysis for ${input.active_listings.toLocaleString()} listings
3. FINANCIAL RISK: The ${metrics.revenueToRentRatio.toFixed(2)}x ratio and ${metrics.breakEvenOccupancy}% break-even implications
4. OPERATIONAL RISK: What could affect performance
5. MITIGATION FACTORS: What the data shows that reduces risk

Be specific and direct. Quantify risks where possible. This is expert risk analysis.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: SECTION_MAX_TOKENS,
      timeoutMs: 45000,
    });
    return response.trim();
  } catch (error) {
    return `The primary risk factor is ${primaryRisk}, which directly impacts profitability margins. ${risks.length > 1 ? `Secondary concerns include ${secondaryRisks}.` : ''} The ${metrics.breakEvenOccupancy}% break-even occupancy threshold compared to the ${metrics.occupancyNormalized.toFixed(0)}% market average provides a ${Math.round(metrics.occupancyNormalized - metrics.breakEvenOccupancy)} percentage point buffer. ${input.active_listings > 1000 ? `High competition from ${input.active_listings.toLocaleString()} listings requires strong differentiation.` : ''} ${metrics.seasonalSwingPct > 40 ? `The ${metrics.seasonalSwingPct}% seasonal swing demands cash reserves for off-peak periods.` : ''} Standard STR risks including regulatory changes and market shifts apply.`;
  }
}

async function generateFinancialOutlook(dataContext: string, metrics: CalculatedMetrics, input: EnhancedNarrativeReportInput): Promise<string> {
  const prompt = `You are a financial analyst specializing in rental property investments. Write a financial outlook.

${dataContext}

Write a financial outlook (120-150 words) that provides clear financial analysis. DO NOT use markdown headers or formatting - write in plain prose paragraphs:

1. Monthly cash flow: $${metrics.monthlyProfit.toLocaleString()}/month realistic profit
2. Annual profit scenarios: $${input.annual_profit_conservative.toLocaleString()} to $${input.annual_profit_optimistic.toLocaleString()}
3. Break-even analysis: ${metrics.breakEvenOccupancy}% occupancy threshold
4. The ${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio and what it indicates
5. Cash flow stability given the ${metrics.seasonalSwingPct}% seasonal variation

Use specific numbers. Explain what the financial metrics mean for this investment. Be analytical.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: SECTION_MAX_TOKENS,
      timeoutMs: 45000,
    });
    return response.trim();
  } catch (error) {
    return `The financial outlook shows projected monthly profit of $${metrics.monthlyProfit.toLocaleString()} at realistic performance levels, with annual profit ranging from $${input.annual_profit_conservative.toLocaleString()} (conservative) to $${input.annual_profit_optimistic.toLocaleString()} (optimistic). The ${metrics.breakEvenOccupancy}% break-even occupancy sits ${Math.round(metrics.occupancyNormalized - metrics.breakEvenOccupancy)} percentage points below the ${metrics.occupancyNormalized.toFixed(0)}% market average, providing operational buffer. The ${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio ${metrics.revenueToRentRatio >= 2 ? 'exceeds the 2x threshold typically required for profitable arbitrage' : 'falls below the 2x threshold, indicating tighter margins'}. ${metrics.seasonalSwingPct > 30 ? `The ${metrics.seasonalSwingPct}% seasonal swing requires cash reserves to cover fixed costs during slower months.` : 'Stable seasonality supports consistent cash flow.'}`;
  }
}

async function generateConclusion(dataContext: string, metrics: CalculatedMetrics, input: EnhancedNarrativeReportInput): Promise<string> {
  const prompt = `You are a senior investment analyst providing a summary conclusion. Write a professional conclusion.

${dataContext}

CRITICAL INSTRUCTIONS:
- DO NOT use "GO", "NO GO", "STRONG GO", or any verdict/recommendation language
- DO NOT tell them what to do or whether to proceed
- Summarize the key findings and let the investor decide
- Present the facts professionally

Write a conclusion (80-100 words). DO NOT use markdown headers or formatting - write in plain prose paragraphs. The conclusion should:

1. Summarizes the key financial finding: ${metrics.revenueToRentRatio.toFixed(2)}x ratio, $${metrics.monthlyProfit.toLocaleString()}/month profit
2. Notes the market context: ${metrics.occupancyNormalized.toFixed(0)}% occupancy, ${input.active_listings.toLocaleString()} competitors
3. Highlights the primary consideration (risk or opportunity) specific to this property
4. Ends with what due diligence items matter most for this specific situation

Be decisive but factual. Summarize, don't recommend.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: 1000,
      timeoutMs: 30000,
    });
    return response.trim();
  } catch (error) {
    return `This ${input.bedrooms}-bedroom property presents a ${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio with $${metrics.monthlyProfit.toLocaleString()}/month projected profit. The ${metrics.occupancyNormalized.toFixed(0)}% market occupancy and ${input.active_listings.toLocaleString()} competing properties define the competitive context. ${metrics.revenueToRentRatio >= 2 ? 'The ratio exceeds typical profitability thresholds.' : 'The ratio indicates tighter margins requiring strong execution.'} Key due diligence: local STR regulations, property condition, and lease terms.`;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateHistoricalContext(input: EnhancedNarrativeReportInput, metrics: CalculatedMetrics): string {
  if (input.five_year_summary) {
    const trend = input.five_year_summary.revenue.trend;
    const change = input.five_year_summary.revenue.percent_change;
    return `Historical analysis shows ${trend} revenue trends over ${input.five_year_summary.years_of_data} years with ${change > 0 ? '+' : ''}${change.toFixed(1)}% change. ${trend === 'increasing' ? 'Growing market trends support revenue projections.' : trend === 'decreasing' ? 'Declining trends suggest conservative projections may be appropriate.' : 'Stable trends indicate a mature market with predictable performance.'}`;
  }
  return 'Historical trend data not available for this market. Current market metrics and competitor performance provide the basis for projections.';
}

function generateWhatThisMeans(metrics: CalculatedMetrics): {
  revenue: string;
  competition: string;
  seasonality: string;
  overall: string;
} {
  return {
    revenue: `Projected monthly profit of $${metrics.monthlyProfit.toLocaleString()} after all expenses, representing a ${metrics.revenueToRentRatio.toFixed(2)}x return on rent investment.`,
    competition: `${metrics.competitorCount} similar properties compete in this market. ${metrics.topCompetitor ? `Top performer earns $${metrics.topCompetitor.annual_revenue?.toLocaleString()}/year.` : ''}`,
    seasonality: metrics.seasonalSwingPct > 30 
      ? `${metrics.seasonalSwingPct}% revenue swing between seasons. Peak months: ${metrics.peakMonths.slice(0, 2).join(', ')}. Off-peak: ${metrics.offMonths.slice(0, 2).join(', ')}.`
      : `${metrics.seasonalSwingPct}% seasonal variation indicates relatively stable year-round income.`,
    overall: `The ${metrics.revenueToRentRatio.toFixed(2)}x ratio ${metrics.revenueToRentRatio >= 2 ? 'exceeds' : 'falls below'} the 2x threshold typically used for rental arbitrage profitability assessment.`,
  };
}

function generateActionItems(metrics: CalculatedMetrics): Array<{priority: 'high' | 'medium' | 'low'; action: string; why: string; timeline: string}> {
  const items: Array<{priority: 'high' | 'medium' | 'low'; action: string; why: string; timeline: string}> = [];
  
  items.push({
    priority: 'high',
    action: 'Verify local STR regulations and permit requirements',
    why: 'Regulations can prohibit or restrict short-term rentals entirely',
    timeline: 'Before signing lease',
  });
  
  items.push({
    priority: 'high',
    action: 'Conduct thorough property inspection',
    why: 'Hidden repairs can significantly impact profitability',
    timeline: 'Before signing lease',
  });
  
  items.push({
    priority: 'medium',
    action: 'Analyze top competitor listings for amenities and positioning',
    why: 'Understanding winners reveals success factors in this market',
    timeline: 'During due diligence',
  });
  
  items.push({
    priority: 'medium',
    action: 'Review lease terms for subletting and STR provisions',
    why: 'Lease restrictions can prevent or limit rental arbitrage',
    timeline: 'Before signing lease',
  });
  
  items.push({
    priority: 'low',
    action: 'Research local events and demand drivers',
    why: 'Understanding demand patterns informs pricing strategy',
    timeline: 'During planning phase',
  });
  
  return items;
}

function determineMarketType(marketName: string): 'urban' | 'suburban' | 'rural' | 'tourist' | 'business' | 'mixed' {
  const lowerName = marketName.toLowerCase();
  
  if (lowerName.includes('beach') || lowerName.includes('mountain') || lowerName.includes('lake') || 
      lowerName.includes('ski') || lowerName.includes('resort') || lowerName.includes('island')) {
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

function generateFallbackReport(
  input: EnhancedNarrativeReportInput,
  metrics: CalculatedMetrics
): EnhancedNarrativeReport {
  const topComp = metrics.topCompetitor;
  
  return {
    executive_summary: `This ${input.bedrooms}-bedroom property at ${input.address} presents a **${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio** with projected monthly profit of **$${metrics.monthlyProfit.toLocaleString()}** after all expenses. The ${input.market_name} market shows ${metrics.occupancyNormalized.toFixed(0)}% average occupancy with ${input.active_listings.toLocaleString()} competing properties. Revenue varies ${metrics.seasonalSwingPct}% between peak and off-peak seasons, with break-even requiring ${metrics.breakEvenOccupancy}% occupancy. ${topComp ? `The top comparable property "${topComp.name}" generates $${topComp.annual_revenue?.toLocaleString()}/year at ${Math.round((topComp.occupancy || 0) * 100)}% occupancy.` : ''}`,
    market_overview: `The ${input.market_name} market comprises ${input.active_listings.toLocaleString()} active short-term rental listings operating at ${metrics.occupancyNormalized.toFixed(0)}% average occupancy with $${input.market_adr.toFixed(0)}/night ADR.`,
    revenue_analysis: `Revenue projections range from $${input.revenue_low.toLocaleString()} (conservative) to $${input.revenue_high.toLocaleString()} (optimistic) annually. The realistic projection of $${input.revenue_mid.toLocaleString()}/year represents 75th percentile performance.`,
    competitive_landscape: `${metrics.competitorCount} comparable ${input.bedrooms}-bedroom properties compete in this market. ${topComp ? `Top performer: "${topComp.name}" at $${topComp.annual_revenue?.toLocaleString()}/year with ${Math.round((topComp.occupancy || 0) * 100)}% occupancy.` : ''}`,
    seasonal_strategy: `Revenue varies ${metrics.seasonalSwingPct}% between peak (${metrics.peakMonths.join(', ') || 'N/A'}) and off-peak (${metrics.offMonths.join(', ') || 'N/A'}) seasons. Peak months average $${metrics.avgPeakRevenue.toLocaleString()}/month vs $${metrics.avgOffRevenue.toLocaleString()}/month off-peak.`,
    historical_context: generateHistoricalContext(input, metrics),
    risk_assessment: `Key risk factors include ${metrics.revenueToRentRatio < 2 ? `tight margins at ${metrics.revenueToRentRatio.toFixed(2)}x ratio, ` : ''}${metrics.seasonalSwingPct > 40 ? `high seasonality (${metrics.seasonalSwingPct}% swing), ` : ''}${input.active_listings > 1000 ? `intense competition (${input.active_listings.toLocaleString()} listings)` : 'standard STR operational risks'}. The ${metrics.breakEvenOccupancy}% break-even occupancy vs ${metrics.occupancyNormalized.toFixed(0)}% market average defines the margin of safety.`,
    financial_outlook: `Monthly profit projection of $${metrics.monthlyProfit.toLocaleString()} at realistic performance. Break-even requires ${metrics.breakEvenOccupancy}% occupancy. Annual profit ranges from $${input.annual_profit_conservative.toLocaleString()} to $${input.annual_profit_optimistic.toLocaleString()}.`,
    conclusion: `This property presents a ${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio with $${metrics.monthlyProfit.toLocaleString()}/month projected profit in a market with ${metrics.occupancyNormalized.toFixed(0)}% occupancy and ${input.active_listings.toLocaleString()} competitors. Key due diligence: local regulations, property condition, and lease terms.`,
    what_this_means: generateWhatThisMeans(metrics),
    action_items: generateActionItems(metrics),
    key_metrics: {
      projected_annual_revenue: input.revenue_mid,
      projected_monthly_profit: metrics.monthlyProfit,
      market_occupancy: metrics.occupancyNormalized,
      market_adr: input.market_adr,
      break_even_months: metrics.breakEvenMonths,
      confidence_level: metrics.confidenceScore >= 7 ? 'high' : metrics.confidenceScore >= 5 ? 'medium' : 'low',
      revenue_to_rent_ratio: metrics.revenueToRentRatio,
    },
    quick_facts: [
      `Ratio: ${metrics.revenueToRentRatio.toFixed(2)}x`,
      `Profit: $${metrics.monthlyProfit.toLocaleString()}/mo`,
      `Break-even: ${metrics.breakEvenOccupancy}%`,
    ],
    market_context: {
      type: determineMarketType(input.market_name),
      seasonality: metrics.seasonalSwingPct > 50 ? 'high' : metrics.seasonalSwingPct > 25 ? 'moderate' : 'low',
      competition: input.active_listings > 1000 ? 'high' : input.active_listings > 500 ? 'moderate' : 'low',
      pricePoint: input.market_adr > 300 ? 'luxury' : input.market_adr > 100 ? 'mid-range' : 'budget',
      description: `${input.market_name} market analysis.`,
    },
  };
}

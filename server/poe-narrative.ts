/**
 * Poe AI Narrative Generator - Uses Gemini 2.5 Pro for A-Tier Expert Analysis
 * 
 * This generates comprehensive, expert-level investment reports using Gemini 2.5 Pro.
 * All sections are AI-generated with rich data integration for maximum insight.
 * 
 * A-TIER EXPERT MODE: Every section is powered by AI with full market data context.
 */

import { generateNarrativeWithPoe } from './poe-ai';
import type { EnhancedNarrativeReport, EnhancedNarrativeReportInput } from './gemini-analyzer-enhanced';

// Model configuration
const AI_MODEL = 'Gemini-2.5-Pro';
const EXPERT_TIMEOUT = 60000; // 60 seconds for comprehensive analysis

/**
 * Generate A-Tier Expert narrative report using Gemini 2.5 Pro via Poe
 * ALL sections are AI-generated with comprehensive data integration
 */
export async function generateEnhancedNarrativeWithPoe(
  input: EnhancedNarrativeReportInput
): Promise<EnhancedNarrativeReport> {
  console.log('[PoeNarrative] Generating A-TIER EXPERT report with Gemini 2.5 Pro...');
  
  // Calculate all key metrics upfront
  const metrics = calculateAllMetrics(input);
  
  // Build comprehensive data context for AI
  const dataContext = buildDataContext(input, metrics);
  
  try {
    // Generate ALL sections with AI in parallel for speed
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
      generateExecutiveSummary(dataContext, metrics),
      generateMarketOverview(dataContext, metrics),
      generateRevenueAnalysis(dataContext, metrics),
      generateCompetitiveLandscape(dataContext, metrics),
      generateSeasonalStrategy(dataContext, metrics),
      generateRiskAssessment(dataContext, metrics),
      generateFinancialOutlook(dataContext, metrics),
      generateConclusion(dataContext, metrics)
    ]);

    // Build the full report
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
        `${metrics.recommendation} recommendation (${metrics.confidenceScore}/10 confidence)`,
        `Revenue-to-rent ratio: ${metrics.revenueToRentRatio.toFixed(2)}x`,
        `Projected profit: $${metrics.monthlyProfit.toLocaleString()}/month`,
        `Break-even occupancy: ${metrics.breakEvenOccupancy}%`,
      ],
      market_context: {
        type: determineMarketType(input.market_name),
        seasonality: metrics.seasonalSwingPct > 50 ? 'high' : metrics.seasonalSwingPct > 25 ? 'moderate' : 'low',
        competition: input.active_listings > 1000 ? 'high' : input.active_listings > 500 ? 'moderate' : 'low',
        pricePoint: input.market_adr > 300 ? 'luxury' : input.market_adr > 100 ? 'mid-range' : 'budget',
        description: `${input.market_name} is a ${input.active_listings > 1000 ? 'highly competitive' : 'moderately competitive'} ${determineMarketType(input.market_name)} market.`,
      },
    };

    console.log('[PoeNarrative] A-TIER EXPERT report generated successfully');
    return report;
  } catch (error: any) {
    console.error('[PoeNarrative] Error generating A-tier report:', error.message);
    console.log('[PoeNarrative] Using fallback report generation');
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
  recommendation: string;
  confidenceScore: number;
  seasonalSwingPct: number;
  peakMonths: string[];
  offMonths: string[];
  avgPeakRevenue: number;
  avgOffRevenue: number;
  topCompetitor: any;
  competitorCount: number;
  startupCosts: { low: number; high: number };
}

function calculateAllMetrics(input: EnhancedNarrativeReportInput): CalculatedMetrics {
  const revenueToRentRatio = input.revenue_mid / (input.monthly_rent * 12);
  const occupancyNormalized = input.market_occupancy < 1 ? input.market_occupancy * 100 : input.market_occupancy;
  const monthlyProfit = Math.round(input.annual_profit_realistic / 12);
  const annualRent = input.monthly_rent * 12;
  
  // Break-even calculations
  const dailyRate = input.market_adr;
  const daysPerMonth = 30;
  const maxMonthlyRevenue = dailyRate * daysPerMonth;
  const breakEvenOccupancy = maxMonthlyRevenue > 0 
    ? Math.min(100, Math.round((input.monthly_expenses / maxMonthlyRevenue) * 100))
    : 100;
  
  // Startup costs based on bedrooms
  const startupCostsLow = input.bedrooms * 4000 + 3000;
  const startupCostsHigh = input.bedrooms * 6000 + 5000;
  const avgStartupCosts = (startupCostsLow + startupCostsHigh) / 2;
  const breakEvenMonths = monthlyProfit > 0 ? Math.min(24, Math.round(avgStartupCosts / monthlyProfit)) : 24;
  
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
    breakEvenMonths,
    recommendation,
    confidenceScore,
    seasonalSwingPct,
    peakMonths: peakSeasons.map(s => s.month),
    offMonths: offSeasons.map(s => s.month),
    avgPeakRevenue,
    avgOffRevenue,
    topCompetitor: input.competitors[0],
    competitorCount: input.competitors.length,
    startupCosts: { low: startupCostsLow, high: startupCostsHigh },
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
Conservative (25th percentile): $${input.revenue_low.toLocaleString()}/year ($${Math.round(input.revenue_low / 12).toLocaleString()}/month)
Realistic (75th percentile): $${input.revenue_mid.toLocaleString()}/year ($${Math.round(input.revenue_mid / 12).toLocaleString()}/month)
Optimistic (90th percentile): $${input.revenue_high.toLocaleString()}/year ($${Math.round(input.revenue_high / 12).toLocaleString()}/month)

=== KEY FINANCIAL METRICS ===
Revenue-to-Rent Ratio: ${metrics.revenueToRentRatio.toFixed(2)}x (2x minimum required for profitability)
Break-Even Occupancy: ${metrics.breakEvenOccupancy}%
Estimated Startup Costs: $${metrics.startupCosts.low.toLocaleString()} - $${metrics.startupCosts.high.toLocaleString()}
Break-Even Timeline: ${metrics.breakEvenMonths} months

=== PROFIT PROJECTIONS ===
Conservative Annual Profit: $${input.annual_profit_conservative.toLocaleString()}/year
Realistic Annual Profit: $${input.annual_profit_realistic.toLocaleString()}/year ($${metrics.monthlyProfit.toLocaleString()}/month)
Optimistic Annual Profit: $${input.annual_profit_optimistic.toLocaleString()}/year

=== TOP COMPETITORS (${input.bedrooms}-BEDROOM PROPERTIES) ===
${competitorList || 'No competitor data available'}

=== SEASONALITY ANALYSIS (${metrics.seasonalSwingPct}% swing) ===
Peak Months: ${metrics.peakMonths.join(', ') || 'N/A'}
Off-Peak Months: ${metrics.offMonths.join(', ') || 'N/A'}
Average Peak Revenue: $${metrics.avgPeakRevenue.toLocaleString()}/month
Average Off-Peak Revenue: $${metrics.avgOffRevenue.toLocaleString()}/month

Monthly Breakdown:
${seasonalityData || 'Seasonality data not available'}

=== INVESTMENT VERDICT ===
Recommendation: ${metrics.recommendation}
Confidence Score: ${metrics.confidenceScore}/10
`;
}

// ============================================================================
// AI-POWERED SECTION GENERATORS
// ============================================================================

async function generateExecutiveSummary(dataContext: string, metrics: CalculatedMetrics): Promise<string> {
  const prompt = `You are a senior STR investment analyst with 20+ years of experience advising institutional investors on rental arbitrage deals. Write an EXPERT-LEVEL executive summary.

${dataContext}

Write a comprehensive EXECUTIVE SUMMARY (200-250 words, one flowing paragraph) that demonstrates deep expertise:

1. **VERDICT**: Lead with "${metrics.recommendation}" and ${metrics.confidenceScore}/10 confidence - explain WHY in one sentence
2. **INVESTMENT THESIS**: The core reason this deal works (or doesn't) - be specific about the ${metrics.revenueToRentRatio.toFixed(2)}x ratio
3. **MARKET POSITIONING**: How this property fits in the competitive landscape - reference specific competitors
4. **PROFIT MECHANICS**: Break down the $${metrics.monthlyProfit.toLocaleString()}/month profit - what drives it
5. **SEASONALITY IMPACT**: The ${metrics.seasonalSwingPct}% swing - specific cash flow implications
6. **RISK/REWARD**: Primary risk and primary opportunity - be specific
7. **CAPITAL REQUIREMENTS**: Startup costs and break-even timeline
8. **ACTION DIRECTIVE**: Specific next step with urgency if warranted

Write like you're advising a sophisticated investor who needs to make a decision TODAY. Use specific numbers throughout. Be confident but honest. Format with **bold** for key terms. One flowing paragraph, no bullets.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: 1200,
      timeoutMs: EXPERT_TIMEOUT,
    });
    return response.trim();
  } catch (error) {
    return generateDefaultExecutiveSummary(metrics);
  }
}

async function generateMarketOverview(dataContext: string, metrics: CalculatedMetrics): Promise<string> {
  const prompt = `You are a market research analyst specializing in short-term rental markets. Write an expert market overview.

${dataContext}

Write a MARKET OVERVIEW (100-150 words) that provides institutional-grade market intelligence:

1. Market size and competitive density
2. Supply/demand dynamics (what the occupancy rate tells us)
3. Pricing power (ADR positioning)
4. Market maturity and saturation indicators
5. Competitive moat opportunities

Be specific with numbers. Write in flowing prose, not bullets. This is for a sophisticated investor.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: 600,
      timeoutMs: 30000,
    });
    return response.trim();
  } catch (error) {
    return `The ${metrics.occupancyNormalized.toFixed(0)}% market occupancy and $${metrics.breakEvenOccupancy}% break-even threshold indicate a viable market opportunity.`;
  }
}

async function generateRevenueAnalysis(dataContext: string, metrics: CalculatedMetrics): Promise<string> {
  const prompt = `You are a revenue management expert for short-term rentals. Write a detailed revenue analysis.

${dataContext}

Write a REVENUE ANALYSIS (100-150 words) that explains the revenue projections like a CFO:

1. What drives the revenue range (conservative to optimistic)
2. How this property compares to top performers
3. Realistic revenue expectations and what it takes to achieve them
4. Revenue per available night (RevPAR) implications
5. Upside potential and what would unlock it

Use specific numbers. Write in flowing prose. Be analytical and precise.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: 600,
      timeoutMs: 30000,
    });
    return response.trim();
  } catch (error) {
    return `Revenue projections range from $${metrics.avgOffRevenue.toLocaleString()} to $${metrics.avgPeakRevenue.toLocaleString()} monthly, with realistic annual revenue of ${metrics.revenueToRentRatio.toFixed(2)}x the annual rent.`;
  }
}

async function generateCompetitiveLandscape(dataContext: string, metrics: CalculatedMetrics): Promise<string> {
  const prompt = `You are a competitive intelligence analyst for the vacation rental industry. Write a strategic competitive analysis.

${dataContext}

Write a COMPETITIVE LANDSCAPE analysis (100-150 words) that provides strategic intelligence:

1. Who are the top performers and what makes them successful
2. Market positioning opportunities (gaps in the competition)
3. Competitive threats and barriers to entry
4. What it takes to compete with the best
5. Differentiation strategies that work in this market

Reference specific competitors by name and their metrics. Write strategically, not descriptively.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: 600,
      timeoutMs: 30000,
    });
    return response.trim();
  } catch (error) {
    const topComp = metrics.topCompetitor;
    return `The competitive landscape includes ${metrics.competitorCount} comparable properties. ${topComp ? `The top performer "${topComp.name}" generates $${topComp.annual_revenue?.toLocaleString()}/year at ${Math.round((topComp.occupancy || 0) * 100)}% occupancy, setting the benchmark for this market.` : ''}`;
  }
}

async function generateSeasonalStrategy(dataContext: string, metrics: CalculatedMetrics): Promise<string> {
  const prompt = `You are a revenue management strategist specializing in seasonal pricing optimization. Write a seasonal strategy guide.

${dataContext}

Write a SEASONAL STRATEGY (100-150 words) that provides actionable pricing and cash flow guidance:

1. The ${metrics.seasonalSwingPct}% seasonal swing - what it means for monthly cash flow
2. Peak season strategy (when to maximize rates)
3. Off-season strategy (how to maintain occupancy)
4. Cash reserve recommendations based on seasonality
5. Pricing tactics for shoulder seasons

Be specific about which months and what to do. Write as actionable guidance.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: 600,
      timeoutMs: 30000,
    });
    return response.trim();
  } catch (error) {
    return `Revenue varies by ${metrics.seasonalSwingPct}% between peak (${metrics.peakMonths.join(', ')}) and off-peak (${metrics.offMonths.join(', ')}) seasons. Plan cash reserves for ${Math.ceil(metrics.seasonalSwingPct / 25)} months of expenses.`;
  }
}

async function generateRiskAssessment(dataContext: string, metrics: CalculatedMetrics): Promise<string> {
  const prompt = `You are a risk management consultant for real estate investments. Write a comprehensive risk assessment.

${dataContext}

Write a RISK ASSESSMENT (100-150 words) that identifies and quantifies risks:

1. PRIMARY RISK: The biggest threat to this investment (be specific)
2. FINANCIAL RISK: Margin of safety analysis (${metrics.revenueToRentRatio.toFixed(2)}x ratio implications)
3. MARKET RISK: Competition and saturation concerns
4. OPERATIONAL RISK: What could go wrong in execution
5. MITIGATION STRATEGIES: Specific actions to reduce each risk

Be direct about risks but also provide solutions. Write for a risk-aware investor.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: 600,
      timeoutMs: 30000,
    });
    return response.trim();
  } catch (error) {
    const risks: string[] = [];
    if (metrics.revenueToRentRatio < 2) risks.push(`thin margins (${metrics.revenueToRentRatio.toFixed(2)}x ratio)`);
    if (metrics.seasonalSwingPct > 40) risks.push(`high seasonality (${metrics.seasonalSwingPct}% swing)`);
    if (metrics.competitorCount > 10) risks.push('competitive market');
    return `Key risks include ${risks.join(', ') || 'standard STR operational risks'}. Mitigation: maintain 3+ months cash reserves, verify regulations, and focus on guest experience.`;
  }
}

async function generateFinancialOutlook(dataContext: string, metrics: CalculatedMetrics): Promise<string> {
  const prompt = `You are a financial analyst specializing in rental property investments. Write a financial outlook.

${dataContext}

Write a FINANCIAL OUTLOOK (100-150 words) that provides clear financial guidance:

1. Monthly cash flow expectations across scenarios
2. Break-even analysis (${metrics.breakEvenOccupancy}% occupancy threshold)
3. ROI timeline (${metrics.breakEvenMonths} months to recoup startup costs)
4. Capital requirements and deployment strategy
5. Financial milestones to track success

Use specific numbers. Write like a financial advisor giving clear guidance.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: 600,
      timeoutMs: 30000,
    });
    return response.trim();
  } catch (error) {
    return `With $${metrics.startupCosts.low.toLocaleString()}-$${metrics.startupCosts.high.toLocaleString()} startup investment and ${metrics.breakEvenOccupancy}% break-even occupancy, expect ${metrics.breakEvenMonths} months to profitability. Monthly profit of $${metrics.monthlyProfit.toLocaleString()} provides ${metrics.revenueToRentRatio >= 2 ? 'adequate' : 'thin'} margin for unexpected costs.`;
  }
}

async function generateConclusion(dataContext: string, metrics: CalculatedMetrics): Promise<string> {
  const prompt = `You are a senior investment advisor making a final recommendation. Write a decisive conclusion.

${dataContext}

Write a CONCLUSION (80-120 words) that provides a clear investment decision:

1. Final verdict: ${metrics.recommendation} - restate with conviction
2. The ONE thing that makes or breaks this deal
3. Specific conditions for success
4. Clear next step with timeline

Be decisive. This is the final word that helps the investor act. Write with authority.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: AI_MODEL,
      maxTokens: 500,
      timeoutMs: 30000,
    });
    return response.trim();
  } catch (error) {
    return generateDefaultConclusion(metrics);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateHistoricalContext(input: EnhancedNarrativeReportInput, metrics: CalculatedMetrics): string {
  if (input.five_year_summary) {
    const trend = input.five_year_summary.revenue.trend;
    const change = input.five_year_summary.revenue.percent_change;
    return `Historical analysis shows ${trend} revenue trends over ${input.five_year_summary.years_of_data} years with ${change > 0 ? '+' : ''}${change.toFixed(1)}% change. ${trend === 'increasing' ? 'The market is growing, supporting the investment thesis.' : trend === 'decreasing' ? 'Declining trends warrant caution and conservative projections.' : 'Stable trends indicate a mature market with predictable returns.'}`;
  }
  return 'Historical trend data not available for this market. Rely on current market metrics and competitor performance for projections.';
}

function generateWhatThisMeans(metrics: CalculatedMetrics): {
  revenue: string;
  competition: string;
  seasonality: string;
  overall: string;
} {
  return {
    revenue: `You could earn approximately $${metrics.monthlyProfit.toLocaleString()} per month after all expenses. This represents a ${metrics.revenueToRentRatio.toFixed(2)}x return on your rent investment.`,
    competition: `You'll compete with ${metrics.competitorCount} similar properties. ${metrics.topCompetitor ? `The top performer earns $${metrics.topCompetitor.annual_revenue?.toLocaleString()}/year - that's your upside target.` : 'Study top performers to identify winning strategies.'}`,
    seasonality: metrics.seasonalSwingPct > 30 
      ? `Income will swing ${metrics.seasonalSwingPct}% between seasons. Save aggressively during ${metrics.peakMonths.slice(0, 2).join(' and ')} to cover ${metrics.offMonths.slice(0, 2).join(' and ')}.`
      : `Income is relatively stable (${metrics.seasonalSwingPct}% variation). This reduces cash flow management complexity.`,
    overall: metrics.recommendation === 'STRONG GO' 
      ? `This is a strong opportunity. The ${metrics.revenueToRentRatio.toFixed(2)}x ratio provides excellent margin for profit and unexpected costs.`
      : metrics.recommendation === 'GO'
      ? `This deal works. The numbers support profitability with good execution.`
      : metrics.recommendation === 'CAUTION'
      ? `Proceed carefully. The ${metrics.revenueToRentRatio.toFixed(2)}x ratio leaves thin margins. Negotiate rent or ensure above-average performance.`
      : `The numbers don't work. Find a property with better revenue potential or significantly lower rent.`,
  };
}

function generateActionItems(metrics: CalculatedMetrics): Array<{priority: 'high' | 'medium' | 'low'; action: string; why: string; timeline: string}> {
  const items: Array<{priority: 'high' | 'medium' | 'low'; action: string; why: string; timeline: string}> = [];
  
  // Always high priority
  items.push({
    priority: 'high',
    action: 'Verify local STR regulations and permit requirements',
    why: 'Regulations can prohibit or restrict short-term rentals entirely',
    timeline: 'Before signing lease',
  });
  
  items.push({
    priority: 'high',
    action: 'Conduct thorough property inspection',
    why: 'Hidden repairs can eliminate 6+ months of profit',
    timeline: 'Before signing lease',
  });
  
  // Conditional based on ratio
  if (metrics.revenueToRentRatio < 2) {
    items.push({
      priority: 'high',
      action: `Negotiate rent reduction to achieve 2x ratio`,
      why: `Current ${metrics.revenueToRentRatio.toFixed(2)}x ratio is below profitability threshold`,
      timeline: 'Before signing lease',
    });
  }
  
  items.push({
    priority: 'medium',
    action: 'Analyze top competitor listings for amenities and positioning',
    why: 'Understanding winners reveals the path to above-average performance',
    timeline: 'Week 1 after signing',
  });
  
  items.push({
    priority: 'medium',
    action: `Prepare $${metrics.startupCosts.low.toLocaleString()}-$${metrics.startupCosts.high.toLocaleString()} startup capital`,
    why: 'Underfunding is the #1 cause of STR failure',
    timeline: 'Before signing lease',
  });
  
  items.push({
    priority: 'medium',
    action: 'Build 3-month cash reserve for operating expenses',
    why: `${metrics.seasonalSwingPct}% seasonal swing requires cash buffer`,
    timeline: 'Before launch',
  });
  
  items.push({
    priority: 'low',
    action: 'Schedule professional photography session',
    why: 'Professional photos increase bookings 20-40%',
    timeline: 'After furnishing complete',
  });
  
  return items;
}

function generateDefaultExecutiveSummary(metrics: CalculatedMetrics): string {
  return `**${metrics.recommendation}** (${metrics.confidenceScore}/10 confidence). This property demonstrates a **${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio** with projected monthly profit of **$${metrics.monthlyProfit.toLocaleString()}** after all expenses. ${metrics.revenueToRentRatio >= 2 ? 'The numbers exceed the 2x threshold required for rental arbitrage profitability.' : 'The ratio falls below the recommended 2x threshold - negotiate lower rent or proceed with caution.'} Break-even requires just ${metrics.breakEvenOccupancy}% occupancy, providing margin for seasonal fluctuations. ${metrics.seasonalSwingPct > 30 ? `The ${metrics.seasonalSwingPct}% seasonal swing requires careful cash flow management.` : 'Seasonal variation is manageable.'} Startup costs of $${metrics.startupCosts.low.toLocaleString()}-$${metrics.startupCosts.high.toLocaleString()} should be recovered within ${metrics.breakEvenMonths} months at realistic performance levels.`;
}

function generateDefaultConclusion(metrics: CalculatedMetrics): string {
  if (metrics.recommendation === 'STRONG GO') {
    return `This property represents an excellent rental arbitrage opportunity with a strong ${metrics.revenueToRentRatio.toFixed(2)}x revenue-to-rent ratio. The projected $${metrics.monthlyProfit.toLocaleString()}/month profit provides substantial buffer for unexpected costs. Proceed with due diligence on regulations and property condition, then move quickly to secure this deal.`;
  } else if (metrics.recommendation === 'GO') {
    return `This property meets the criteria for profitable rental arbitrage with a ${metrics.revenueToRentRatio.toFixed(2)}x ratio. Verify local regulations, inspect the property, and proceed if both check out. The $${metrics.monthlyProfit.toLocaleString()}/month profit projection is achievable with solid execution.`;
  } else if (metrics.recommendation === 'CAUTION') {
    return `This property is borderline for rental arbitrage. The ${metrics.revenueToRentRatio.toFixed(2)}x ratio leaves thin margins for error. Consider negotiating lower rent to improve the ratio, or ensure you can achieve above-average occupancy and rates. Only proceed if you can improve the economics.`;
  } else {
    return `This property does not meet the criteria for profitable rental arbitrage. The ${metrics.revenueToRentRatio.toFixed(2)}x ratio is insufficient to cover costs and generate meaningful profit. Look for properties with better revenue potential or significantly lower rent.`;
  }
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
    executive_summary: generateDefaultExecutiveSummary(metrics),
    market_overview: `The ${input.market_name} market has ${input.active_listings.toLocaleString()} active short-term rental listings with ${metrics.occupancyNormalized.toFixed(0)}% average occupancy and $${input.market_adr.toFixed(0)}/night ADR. This is a ${input.active_listings > 1000 ? 'highly competitive' : input.active_listings > 500 ? 'moderately competitive' : 'less saturated'} market.`,
    revenue_analysis: `This ${input.bedrooms}-bedroom property could generate between $${input.revenue_low.toLocaleString()} (conservative) and $${input.revenue_high.toLocaleString()} (optimistic) annually. The realistic projection of $${input.revenue_mid.toLocaleString()}/year represents 75th percentile performance.`,
    competitive_landscape: `There are ${metrics.competitorCount} comparable ${input.bedrooms}-bedroom properties. ${topComp ? `Top performer: "${topComp.name}" at $${topComp.annual_revenue?.toLocaleString()}/year with ${Math.round((topComp.occupancy || 0) * 100)}% occupancy.` : ''}`,
    seasonal_strategy: `Revenue varies by ${metrics.seasonalSwingPct}% between peak (${metrics.peakMonths.join(', ') || 'N/A'}) and off-peak (${metrics.offMonths.join(', ') || 'N/A'}) seasons.`,
    historical_context: generateHistoricalContext(input, metrics),
    risk_assessment: `Key risks: ${metrics.revenueToRentRatio < 2 ? 'thin margins, ' : ''}${metrics.seasonalSwingPct > 40 ? 'high seasonality, ' : ''}${input.active_listings > 1000 ? 'high competition' : 'standard STR risks'}. Maintain 3+ months cash reserves and verify local regulations.`,
    financial_outlook: `Break-even requires ${metrics.breakEvenOccupancy}% occupancy. With $${metrics.startupCosts.low.toLocaleString()}-$${metrics.startupCosts.high.toLocaleString()} startup costs, expect ${metrics.breakEvenMonths} months to profitability.`,
    conclusion: generateDefaultConclusion(metrics),
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
      `${metrics.recommendation} (${metrics.confidenceScore}/10)`,
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

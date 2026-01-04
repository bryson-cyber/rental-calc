/**
 * Poe AI Narrative Generator - Uses Claude Sonnet 4 for expert-level narrative reports
 * 
 * This uses Poe AI's Claude Sonnet 4 model for comprehensive, expert-level analysis.
 * Claude Sonnet 4 gives direct responses without thinking artifacts.
 * 
 * EXPERT MODE: Generates comprehensive investment analysis with detailed insights.
 */

import { generateNarrativeWithPoe } from './poe-ai';
import type { EnhancedNarrativeReport, EnhancedNarrativeReportInput } from './gemini-analyzer-enhanced';

/**
 * Generate enhanced narrative report using Claude Sonnet 4 via Poe
 * EXPERT MODE: Comprehensive analysis with detailed insights
 */
export async function generateEnhancedNarrativeWithPoe(
  input: EnhancedNarrativeReportInput
): Promise<EnhancedNarrativeReport> {
  console.log('[PoeNarrative] Generating EXPERT-LEVEL narrative report with Claude Sonnet 4...');
  
  // Calculate key metrics
  const revenueToRentRatio = input.revenue_mid / (input.monthly_rent * 12);
  const occupancyNormalized = input.market_occupancy < 1 ? input.market_occupancy * 100 : input.market_occupancy;
  const monthlyProfit = Math.round(input.annual_profit_realistic / 12);
  const annualRent = input.monthly_rent * 12;
  const breakEvenOccupancy = calculateBreakEvenOccupancy(input);
  
  // Determine recommendation based on ratio
  const recommendation = revenueToRentRatio >= 2.5 ? 'STRONG GO' : 
                         revenueToRentRatio >= 2 ? 'GO' : 
                         revenueToRentRatio >= 1.5 ? 'CAUTION' : 'NO GO';
  const confidenceScore = revenueToRentRatio >= 2.5 ? 9 : 
                          revenueToRentRatio >= 2 ? 7 : 
                          revenueToRentRatio >= 1.5 ? 5 : 3;
  
  // Format competitor info
  const topComp = input.competitors[0];
  const topCompInfo = topComp 
    ? `${topComp.name} ($${topComp.annual_revenue?.toLocaleString()}/yr, ${Math.round((topComp.occupancy || 0) * 100)}% occ)`
    : 'No comparable data';
  
  // Format all competitors for analysis with ratings and reviews
  const competitorList = input.competitors.slice(0, 5).map((c, i) => 
    `${i + 1}. ${c.name}: $${c.annual_revenue?.toLocaleString()}/yr, ${Math.round((c.occupancy || 0) * 100)}% occ, ${c.rating?.toFixed(1) || 'N/A'} rating (${c.reviews || 0} reviews)`
  ).join('\n');
  
  // Calculate benchmarking metrics for "So What?" context
  const topPerformerRevenue = input.competitors[0]?.annual_revenue || input.revenue_high;
  const realisticVsTopPct = Math.round((input.revenue_mid / topPerformerRevenue) * 100);
  const breakEvenVsMarketMargin = Math.round(occupancyNormalized - breakEvenOccupancy);
  const avgCompRating = input.competitors.length > 0 
    ? (input.competitors.reduce((sum, c) => sum + (c.rating || 0), 0) / input.competitors.length).toFixed(1)
    : 'N/A';
  
  // Calculate seasonality info
  const peakMonths = input.seasonality.filter(s => s.season_type === 'peak');
  const offMonths = input.seasonality.filter(s => s.season_type === 'off');
  const avgPeakRevenue = peakMonths.reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, peakMonths.length);
  const avgOffRevenue = offMonths.reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, offMonths.length);
  const seasonalSwingPct = avgOffRevenue > 0 ? Math.round(((avgPeakRevenue - avgOffRevenue) / avgOffRevenue) * 100) : 0;
  
  // Format seasonality data
  const seasonalityBreakdown = input.seasonality.map(s => 
    `${s.month}: $${s.revenue.toLocaleString()} (${s.season_type})`
  ).join(', ');

  // Build EXPERT-LEVEL prompt for comprehensive analysis
  // Calculate regional listings for context
  const regionalListings = (input as any).regional_active_listings;
  
  const prompt = `You are a senior STR (short-term rental) investment analyst with 15+ years of experience in rental arbitrage. Write a comprehensive executive summary for this investment opportunity.

KEY DEFINITIONS (use these consistently):
- Revenue-to-Rent Ratio: Annual STR Revenue ÷ Annual Rent (target: 2x or higher for profitability)
- Monthly Profit: (Monthly Revenue) - (Monthly Rent + Operating Expenses)
- Break-even Occupancy: Minimum occupancy percentage needed to cover all costs
- Direct Competitors: The ${input.active_listings} nearby same-bedroom properties analyzed
- Average Daily Rate (ADR): The average nightly price guests pay

PROPERTY ANALYSIS:
- Address: ${input.address}
- Configuration: ${input.bedrooms} bedrooms, ${input.bathrooms} bathrooms
- Monthly Rent: $${input.monthly_rent.toLocaleString()} ($${annualRent.toLocaleString()}/year)

MARKET DATA:
- Market: ${input.market_name}
- Regional Market Occupancy: ${occupancyNormalized.toFixed(0)}% (broader market average)
- Regional Average Daily Rate (ADR): $${input.market_adr.toFixed(0)}/night (broader market average)
- Direct Competitors Analyzed: ${input.active_listings} (nearby same-bedroom properties - THIS is your competitive set)
- Average Competitor Rating: ${avgCompRating} stars
${regionalListings ? `- Regional Active Listings: ${regionalListings.toLocaleString()} (total in broader market area)` : ''}

DATA SOURCE CLARITY:
- All revenue projections are based on ACTUAL PERFORMANCE DATA from ${input.active_listings} comparable properties
- These are not estimates or guesses - they reflect what similar properties are actually earning
- The "Direct Competitors Analyzed" count represents nearby same-bedroom properties with verified revenue data

REVENUE PROJECTIONS:
- Conservative (25th %ile): $${input.revenue_low.toLocaleString()}/year
- Realistic (75th %ile): $${input.revenue_mid.toLocaleString()}/year  
- Optimistic (90th %ile): $${input.revenue_high.toLocaleString()}/year
- Revenue-to-Rent Ratio: ${revenueToRentRatio.toFixed(2)}x (minimum 2x required for profitability)

BENCHMARKING CONTEXT ("So What?" for beginners):
- Your realistic projection ($${input.revenue_mid.toLocaleString()}) captures ${realisticVsTopPct}% of what the top performer earns
- Break-even occupancy (${breakEvenOccupancy}%) vs market average (${occupancyNormalized.toFixed(0)}%) = ${breakEvenVsMarketMargin}% margin of safety
- Revenue-to-rent ratio of ${revenueToRentRatio.toFixed(2)}x is ${revenueToRentRatio >= 2.5 ? 'EXCELLENT (well above 2x threshold)' : revenueToRentRatio >= 2 ? 'GOOD (meets 2x threshold)' : revenueToRentRatio >= 1.5 ? 'MARGINAL (below 2x threshold)' : 'CHALLENGING (significantly below 2x threshold)'}

PROFITABILITY:
- Monthly Expenses: $${input.monthly_expenses.toLocaleString()}
- Break-Even Occupancy: ${breakEvenOccupancy}% (you need this occupancy just to cover costs)
- Conservative Profit: $${input.annual_profit_conservative.toLocaleString()}/year
- Realistic Profit: $${input.annual_profit_realistic.toLocaleString()}/year ($${monthlyProfit.toLocaleString()}/month)
- Optimistic Profit: $${input.annual_profit_optimistic.toLocaleString()}/year

TOP COMPETITORS (with ratings):
${competitorList || 'No competitor data available'}

SEASONALITY & CASH FLOW TIMING:
- Seasonal swing: ${seasonalSwingPct}% difference between peak and off-peak
- Peak months (higher income): ${peakMonths.map(s => s.month).join(', ') || 'N/A'}
- Off-peak months (lower income): ${offMonths.map(s => s.month).join(', ') || 'N/A'}
- Expect ${offMonths.length} months of below-average income each year

DATA CONSISTENCY RULES:
1. When stating "active listings" or "competitors", use the Direct Competitors count (${input.active_listings}), NOT regional totals
2. The occupancy and ADR figures are REGIONAL averages - note this context when referencing them
3. Revenue projections are based on LOCAL comparable performance, not regional averages
4. Always cross-reference numbers you cite with the data sections provided above
5. If any metrics seem inconsistent, acknowledge the limitation rather than fabricating explanations

Write an EXECUTIVE SUMMARY (one comprehensive paragraph, 150-200 words) that SUMMARIZES the key findings. DO NOT give investment advice, verdicts, or recommendations like "GO", "STRONG GO", or "sign the lease". DO NOT suggest budgets or reserve amounts.

The summary should cover:
1. **REVENUE POTENTIAL**: The projected revenue range and revenue-to-rent ratio with context (is ${revenueToRentRatio.toFixed(2)}x good or bad?)
2. **PROFIT PROJECTIONS**: Monthly profit potential with context on what that means
3. **HOW YOU COMPARE**: The realistic projection captures ${realisticVsTopPct}% of top performer revenue
4. **MARKET PRICING**: The $${input.market_adr.toFixed(0)}/night ADR and what it means for pricing strategy
5. **COMPETITOR QUALITY**: The ${avgCompRating}-star average rating among competitors and what top performers achieve
6. **SAFETY MARGIN**: Break-even of ${breakEvenOccupancy}% vs market occupancy of ${occupancyNormalized.toFixed(0)}% (${breakEvenVsMarketMargin}% cushion)
7. **CASH FLOW TIMING**: Expect ${offMonths.length} months of lower income (${seasonalSwingPct}% seasonal swing)

IMPORTANT RULES:
- DO NOT say "GO", "STRONG GO", "sign the lease", "proceed", or any investment recommendation
- DO NOT suggest specific dollar amounts for reserves, budgets, or startup costs
- DO NOT use phrases like "we recommend", "you should", "consider signing"
- ONLY summarize the data and findings objectively
- Write in a professional, informative tone - like a market research report
- Help beginners understand if the numbers are GOOD or BAD by providing context

Format as a single flowing paragraph with **bold** for key terms. No bullet points, no JSON.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: 'Claude-Opus-4.5',  // Upgraded to best quality model
      maxTokens: 2048, // Increased for comprehensive expert-level response
      timeoutMs: 90000, // 90 second timeout for expert analysis (Opus is slower but better)
    });

    // Use the AI response as the executive summary
    const aiSummary = response.trim();
    
    // Build the full report using the AI summary + calculated data
    const report: EnhancedNarrativeReport = {
      executive_summary: aiSummary || generateDefaultSummary(input, revenueToRentRatio, recommendation, confidenceScore),
      market_overview: `The ${input.market_name} market has ${input.active_listings.toLocaleString()} active short-term rental listings with an average occupancy of ${occupancyNormalized.toFixed(0)}% and ADR of $${input.market_adr.toFixed(0)}/night. This is a ${input.active_listings > 1000 ? 'highly competitive' : input.active_listings > 500 ? 'moderately competitive' : 'less saturated'} market.`,
      revenue_analysis: `Based on comparable properties, this ${input.bedrooms}-bedroom property could generate between $${input.revenue_low.toLocaleString()} (conservative) and $${input.revenue_high.toLocaleString()} (optimistic) annually. The realistic projection of $${input.revenue_mid.toLocaleString()}/year represents 75th percentile performance.`,
      competitive_landscape: `There are ${input.competitors.length} comparable ${input.bedrooms}-bedroom properties in the area. The top performer is ${topComp?.name || 'not identified'}, earning $${topComp?.annual_revenue?.toLocaleString() || 'N/A'}/year with ${Math.round((topComp?.occupancy || 0) * 100)}% occupancy.`,
      seasonal_strategy: `Revenue varies by ${seasonalSwingPct}% between peak and off-season. Peak months are ${peakMonths.map(s => s.month).join(', ') || 'year-round'}. Plan for lower income during ${offMonths.map(s => s.month).join(', ') || 'slower periods'}.`,
      historical_context: input.five_year_summary 
        ? `The market has shown ${input.five_year_summary.revenue.trend} revenue trends over the past ${input.five_year_summary.years_of_data} years with ${input.five_year_summary.revenue.percent_change > 0 ? '+' : ''}${input.five_year_summary.revenue.percent_change.toFixed(1)}% change.`
        : 'Historical trend data not available for this market.',
      risk_assessment: generateRiskAssessment(input, revenueToRentRatio, seasonalSwingPct),
      financial_outlook: `With monthly expenses of $${input.monthly_expenses.toLocaleString()} and rent of $${input.monthly_rent.toLocaleString()}, break-even requires ${breakEvenOccupancy}% occupancy. The conservative scenario yields $${input.annual_profit_conservative.toLocaleString()}/year profit.`,
      conclusion: generateConclusion(recommendation, revenueToRentRatio, monthlyProfit),
      what_this_means: {
        revenue: `You could earn about $${monthlyProfit.toLocaleString()} per month after all expenses.`,
        competition: `You'll compete with ${input.competitors.length} similar properties. ${topComp ? `The best one earns $${topComp.annual_revenue?.toLocaleString()}/year.` : ''}`,
        seasonality: seasonalSwingPct > 30 
          ? `Income will vary significantly (${seasonalSwingPct}%) - save during peak season for slower months.`
          : `Income is relatively stable throughout the year (${seasonalSwingPct}% variation).`,
        overall: revenueToRentRatio >= 2.0
          ? `The revenue-to-rent ratio of ${revenueToRentRatio.toFixed(2)}x meets the typical profitability threshold.`
          : revenueToRentRatio >= 1.5
          ? `The revenue-to-rent ratio of ${revenueToRentRatio.toFixed(2)}x is below the typical 2.0x threshold.`
          : `The revenue-to-rent ratio of ${revenueToRentRatio.toFixed(2)}x indicates narrow margins.`,
      },
      action_items: generateActionItems(recommendation, revenueToRentRatio),
      key_metrics: {
        projected_annual_revenue: input.revenue_mid,
        projected_monthly_profit: monthlyProfit,
        market_occupancy: occupancyNormalized,
        market_adr: input.market_adr,
        break_even_months: calculateBreakEvenMonths(input),
        confidence_level: confidenceScore >= 7 ? 'high' : confidenceScore >= 5 ? 'medium' : 'low',
        revenue_to_rent_ratio: revenueToRentRatio,
      },
      quick_facts: [
        `Revenue-to-rent ratio: ${revenueToRentRatio.toFixed(2)}x`,
        `Projected profit: $${monthlyProfit.toLocaleString()}/month`,
        `Break-even occupancy: ${breakEvenOccupancy}%`,
        `${input.competitors.length} direct competitors analyzed`,
      ],
      market_context: {
        type: determineMarketType(input.market_name),
        seasonality: seasonalSwingPct > 50 ? 'high' : seasonalSwingPct > 25 ? 'moderate' : 'low',
        competition: input.active_listings > 1000 ? 'high' : input.active_listings > 500 ? 'moderate' : 'low',
        pricePoint: input.market_adr > 300 ? 'luxury' : input.market_adr > 100 ? 'mid-range' : 'budget',
        description: `${input.market_name} is a ${input.active_listings > 1000 ? 'highly competitive' : 'moderately competitive'} market.`,
      },
    };

    console.log('[PoeNarrative] Expert-level narrative report generated successfully');
    return report;
  } catch (error: any) {
    console.error('[PoeNarrative] Error generating narrative:', error.message);
    console.log('[PoeNarrative] Using fallback report generation');
    return generateFallbackReport(input, revenueToRentRatio);
  }
}

function generateDefaultSummary(
  input: EnhancedNarrativeReportInput, 
  ratio: number, 
  recommendation: string, 
  confidence: number
): string {
  const monthlyProfit = Math.round(input.annual_profit_realistic / 12);
  return `**${recommendation}** (${confidence}/10 confidence). This ${input.bedrooms}-bedroom property at ${input.address} shows a ${ratio.toFixed(2)}x revenue-to-rent ratio with projected annual profit of $${input.annual_profit_realistic.toLocaleString()} ($${monthlyProfit.toLocaleString()}/month). ${ratio >= 2 ? 'The numbers meet the 2x rule threshold for rental arbitrage.' : 'The ratio falls below the recommended 2x threshold - proceed with caution or negotiate lower rent.'}`;
}

function generateRiskAssessment(
  input: EnhancedNarrativeReportInput, 
  ratio: number, 
  seasonalSwing: number
): string {
  const risks: string[] = [];
  
  if (ratio < 2) risks.push('Revenue-to-rent ratio below 2x leaves thin margins for unexpected costs');
  if (seasonalSwing > 40) risks.push(`High seasonality (${seasonalSwing}% swing) means inconsistent monthly income`);
  if (input.active_listings > 1000) risks.push('High competition market with 1000+ listings');
  if (input.market_occupancy < 0.5) risks.push('Below-average market occupancy indicates soft demand');
  
  if (risks.length === 0) risks.push('Standard STR risks: regulatory changes, market saturation, economic downturns');
  
  return `Key risks: ${risks.join('. ')}. Mitigation: Verify local regulations, maintain cash reserves for 3+ months of expenses, and focus on guest experience to stand out.`;
}

function generateConclusion(recommendation: string, ratio: number, monthlyProfit: number): string {
  // Objective summary without investment advice
  if (ratio >= 2.5) {
    return `This analysis shows a ${ratio.toFixed(2)}x revenue-to-rent ratio with projected monthly profit of $${monthlyProfit.toLocaleString()}. The ratio exceeds the typical 2.0x threshold often used to evaluate rental arbitrage viability. Local regulations and property condition should be verified independently.`;
  } else if (ratio >= 2.0) {
    return `This analysis shows a ${ratio.toFixed(2)}x revenue-to-rent ratio with projected monthly profit of $${monthlyProfit.toLocaleString()}. The ratio meets the typical 2.0x threshold. Actual results will depend on execution, market conditions, and local regulations.`;
  } else if (ratio >= 1.5) {
    return `This analysis shows a ${ratio.toFixed(2)}x revenue-to-rent ratio with projected monthly profit of $${monthlyProfit.toLocaleString()}. The ratio is below the typical 2.0x threshold, indicating tighter margins. Performance would need to exceed projections to achieve strong profitability.`;
  } else {
    return `This analysis shows a ${ratio.toFixed(2)}x revenue-to-rent ratio with projected monthly profit of $${monthlyProfit.toLocaleString()}. The ratio is significantly below the typical 2.0x threshold. The projected margins are narrow based on comparable property performance.`;
  }
}

function generateActionItems(recommendation: string, ratio: number): Array<{priority: 'high' | 'medium' | 'low'; action: string; why: string; timeline: string}> {
  const items: Array<{priority: 'high' | 'medium' | 'low'; action: string; why: string; timeline: string}> = [
    {
      priority: 'high',
      action: 'Verify local STR regulations',
      why: 'Regulations can prohibit or restrict short-term rentals',
      timeline: 'Before signing lease',
    },
    {
      priority: 'high',
      action: 'Inspect property condition',
      why: 'Unexpected repairs can eliminate profits',
      timeline: 'Before signing lease',
    },
  ];
  
  if (ratio < 2) {
    items.push({
      priority: 'high',
      action: 'Negotiate lower rent',
      why: `Current ratio of ${ratio.toFixed(2)}x is below the 2x threshold`,
      timeline: 'Before signing lease',
    });
  }
  
  items.push(
    {
      priority: 'medium',
      action: 'Research competitor amenities',
      why: 'Understand what drives bookings in this market',
      timeline: 'Week 1',
    },
    {
      priority: 'medium',
      action: 'Create furnishing budget',
      why: 'Control startup costs to protect ROI',
      timeline: 'Week 1',
    },
    {
      priority: 'low',
      action: 'Plan photography session',
      why: 'Professional photos increase bookings 20-40%',
      timeline: 'After furnishing',
    }
  );
  
  return items;
}

function calculateBreakEvenOccupancy(input: EnhancedNarrativeReportInput): number {
  const monthlyExpenses = input.monthly_expenses;
  const dailyRate = input.market_adr;
  const daysPerMonth = 30;
  const maxMonthlyRevenue = dailyRate * daysPerMonth;
  
  if (maxMonthlyRevenue <= 0) return 100;
  
  const breakEven = (monthlyExpenses / maxMonthlyRevenue) * 100;
  return Math.min(100, Math.round(breakEven));
}

function calculateBreakEvenMonths(input: EnhancedNarrativeReportInput): number {
  const startupCosts = input.bedrooms * 5000 + 3000; // Rough estimate
  const monthlyProfit = input.annual_profit_realistic / 12;
  
  if (monthlyProfit <= 0) return 24; // Cap at 24 months if not profitable
  
  return Math.min(24, Math.round(startupCosts / monthlyProfit));
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

function generateFallbackReport(
  input: EnhancedNarrativeReportInput,
  revenueToRentRatio: number
): EnhancedNarrativeReport {
  const recommendation = revenueToRentRatio >= 2.5 ? 'STRONG GO' : 
                         revenueToRentRatio >= 2 ? 'GO' : 
                         revenueToRentRatio >= 1.5 ? 'CAUTION' : 'NO GO';
  const confidenceScore = revenueToRentRatio >= 2.5 ? 9 : 
                          revenueToRentRatio >= 2 ? 7 : 
                          revenueToRentRatio >= 1.5 ? 5 : 3;
  const monthlyProfit = Math.round(input.annual_profit_realistic / 12);
  const occupancyNormalized = input.market_occupancy < 1 ? input.market_occupancy * 100 : input.market_occupancy;
  const breakEvenOccupancy = calculateBreakEvenOccupancy(input);
  
  const peakMonths = input.seasonality.filter(s => s.season_type === 'peak');
  const offMonths = input.seasonality.filter(s => s.season_type === 'off');
  const avgPeakRevenue = peakMonths.reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, peakMonths.length);
  const avgOffRevenue = offMonths.reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, offMonths.length);
  const seasonalSwingPct = avgOffRevenue > 0 ? Math.round(((avgPeakRevenue - avgOffRevenue) / avgOffRevenue) * 100) : 0;
  
  const topComp = input.competitors[0];
  
  return {
    executive_summary: generateDefaultSummary(input, revenueToRentRatio, recommendation, confidenceScore),
    market_overview: `The ${input.market_name} market has ${input.active_listings.toLocaleString()} active short-term rental listings with an average occupancy of ${occupancyNormalized.toFixed(0)}% and ADR of $${input.market_adr.toFixed(0)}/night.`,
    revenue_analysis: `This ${input.bedrooms}-bedroom property could generate between $${input.revenue_low.toLocaleString()} and $${input.revenue_high.toLocaleString()} annually.`,
    competitive_landscape: `There are ${input.competitors.length} comparable properties. Top performer: ${topComp?.name || 'N/A'}.`,
    seasonal_strategy: `Revenue varies by ${seasonalSwingPct}% between seasons.`,
    historical_context: 'Historical data not available.',
    risk_assessment: generateRiskAssessment(input, revenueToRentRatio, seasonalSwingPct),
    financial_outlook: `Break-even requires ${breakEvenOccupancy}% occupancy.`,
    conclusion: generateConclusion(recommendation, revenueToRentRatio, monthlyProfit),
    what_this_means: {
      revenue: `Projected monthly profit: $${monthlyProfit.toLocaleString()}`,
      competition: `${input.competitors.length} similar properties in the area.`,
      seasonality: `${seasonalSwingPct}% seasonal variation.`,
      overall: `Revenue-to-rent ratio: ${revenueToRentRatio.toFixed(2)}x. See detailed analysis above.`,
    },
    action_items: generateActionItems(recommendation, revenueToRentRatio),
    key_metrics: {
      projected_annual_revenue: input.revenue_mid,
      projected_monthly_profit: monthlyProfit,
      market_occupancy: occupancyNormalized,
      market_adr: input.market_adr,
      break_even_months: calculateBreakEvenMonths(input),
      confidence_level: confidenceScore >= 7 ? 'high' : confidenceScore >= 5 ? 'medium' : 'low',
      revenue_to_rent_ratio: revenueToRentRatio,
    },
    quick_facts: [
      `Ratio: ${revenueToRentRatio.toFixed(2)}x`,
      `Profit: $${monthlyProfit.toLocaleString()}/mo`,
      `Break-even: ${breakEvenOccupancy}%`,
      `${input.competitors.length} competitors`,
    ],
    market_context: {
      type: determineMarketType(input.market_name),
      seasonality: seasonalSwingPct > 50 ? 'high' : seasonalSwingPct > 25 ? 'moderate' : 'low',
      competition: input.active_listings > 1000 ? 'high' : input.active_listings > 500 ? 'moderate' : 'low',
      pricePoint: input.market_adr > 300 ? 'luxury' : input.market_adr > 100 ? 'mid-range' : 'budget',
      description: `${input.market_name} market analysis.`,
    },
  };
}

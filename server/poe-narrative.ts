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
  
  // Format all competitors for analysis
  const competitorList = input.competitors.slice(0, 5).map((c, i) => 
    `${i + 1}. ${c.name}: $${c.annual_revenue?.toLocaleString()}/yr, ${Math.round((c.occupancy || 0) * 100)}% occ, ${c.rating?.toFixed(1) || 'N/A'} rating`
  ).join('\n');
  
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
  const prompt = `You are a senior STR (short-term rental) investment analyst with 15+ years of experience in rental arbitrage. Write a comprehensive executive summary for this investment opportunity.

PROPERTY ANALYSIS:
- Address: ${input.address}
- Configuration: ${input.bedrooms} bedrooms, ${input.bathrooms} bathrooms
- Monthly Rent: $${input.monthly_rent.toLocaleString()} ($${annualRent.toLocaleString()}/year)

MARKET DATA:
- Market: ${input.market_name}
- Market Occupancy: ${occupancyNormalized.toFixed(0)}%
- Average Daily Rate: $${input.market_adr.toFixed(0)}
- Active Listings: ${input.active_listings.toLocaleString()} competing properties

REVENUE PROJECTIONS:
- Conservative (25th %ile): $${input.revenue_low.toLocaleString()}/year
- Realistic (75th %ile): $${input.revenue_mid.toLocaleString()}/year  
- Optimistic (90th %ile): $${input.revenue_high.toLocaleString()}/year
- Revenue-to-Rent Ratio: ${revenueToRentRatio.toFixed(2)}x (minimum 2x required for profitability)

PROFITABILITY:
- Monthly Expenses: $${input.monthly_expenses.toLocaleString()}
- Break-Even Occupancy: ${breakEvenOccupancy}%
- Conservative Profit: $${input.annual_profit_conservative.toLocaleString()}/year
- Realistic Profit: $${input.annual_profit_realistic.toLocaleString()}/year ($${monthlyProfit.toLocaleString()}/month)
- Optimistic Profit: $${input.annual_profit_optimistic.toLocaleString()}/year

TOP COMPETITORS:
${competitorList || 'No competitor data available'}

SEASONALITY (${seasonalSwingPct}% swing):
Peak months: ${peakMonths.map(s => s.month).join(', ') || 'N/A'}
Off-peak months: ${offMonths.map(s => s.month).join(', ') || 'N/A'}

Write a detailed EXECUTIVE SUMMARY (one comprehensive paragraph, 150-200 words) that includes:

1. **VERDICT**: Start with "${recommendation}" recommendation and ${confidenceScore}/10 confidence score
2. **KEY NUMBERS**: Revenue-to-rent ratio (${revenueToRentRatio.toFixed(2)}x), projected annual profit ($${input.annual_profit_realistic.toLocaleString()}), and monthly cash flow ($${monthlyProfit.toLocaleString()})
3. **MARKET CONTEXT**: How this property fits in the ${input.market_name} market with ${input.active_listings.toLocaleString()} listings and ${occupancyNormalized.toFixed(0)}% average occupancy
4. **COMPETITIVE EDGE**: What the top competitor (${topCompInfo}) tells us about the opportunity
5. **SEASONALITY RISK**: The ${seasonalSwingPct}% seasonal swing and its impact on cash flow
6. **PRIMARY RISK**: The biggest concern for this investment
7. **PRIMARY OPPORTUNITY**: The biggest upside potential
8. **ACTIONABLE RECOMMENDATION**: Clear next steps for the investor

Write in a confident, expert tone. Be specific with numbers. This is for someone deciding whether to sign a lease TODAY. Make it compelling but honest.

Format as a single flowing paragraph with **bold** for key terms. No bullet points, no JSON.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: 'Claude-Sonnet-4',
      maxTokens: 1024, // Increased for comprehensive response
      timeoutMs: 45000, // 45 second timeout for expert analysis
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
        overall: recommendation === 'STRONG GO' || recommendation === 'GO'
          ? `The numbers look good. This property has solid profit potential.`
          : recommendation === 'CAUTION'
          ? `The margins are tight. Success requires excellent execution and cost control.`
          : `The numbers don't work well. Consider negotiating lower rent or finding another property.`,
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
        `${recommendation} recommendation (${confidenceScore}/10 confidence)`,
        `Revenue-to-rent ratio: ${revenueToRentRatio.toFixed(2)}x`,
        `Projected profit: $${monthlyProfit.toLocaleString()}/month`,
        `Break-even occupancy: ${breakEvenOccupancy}%`,
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
  if (recommendation === 'STRONG GO') {
    return `This property shows excellent potential for rental arbitrage with a strong ${ratio.toFixed(2)}x revenue-to-rent ratio. Proceed with due diligence on local regulations and property condition. Expected monthly profit of $${monthlyProfit.toLocaleString()} provides good buffer for unexpected costs.`;
  } else if (recommendation === 'GO') {
    return `This property meets the criteria for rental arbitrage with a ${ratio.toFixed(2)}x ratio. Verify local STR regulations and inspect the property before signing. The projected $${monthlyProfit.toLocaleString()}/month profit is achievable with good execution.`;
  } else if (recommendation === 'CAUTION') {
    return `This property is borderline for rental arbitrage. The ${ratio.toFixed(2)}x ratio leaves thin margins. Consider negotiating lower rent, or ensure you can achieve above-average occupancy and rates to make the numbers work.`;
  } else {
    return `This property does not meet the criteria for profitable rental arbitrage. The ${ratio.toFixed(2)}x ratio is too low. Look for properties with better revenue potential or negotiate significantly lower rent.`;
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
      overall: recommendation === 'GO' || recommendation === 'STRONG GO' 
        ? 'This property has good potential.'
        : 'Proceed with caution.',
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
      `${recommendation} (${confidenceScore}/10)`,
      `Ratio: ${revenueToRentRatio.toFixed(2)}x`,
      `Profit: $${monthlyProfit.toLocaleString()}/mo`,
      `Break-even: ${breakEvenOccupancy}%`,
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

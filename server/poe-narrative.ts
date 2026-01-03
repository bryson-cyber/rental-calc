/**
 * Poe AI Narrative Generator - Uses Gemini 3 Pro for fast narrative reports
 * 
 * This uses Poe AI's Gemini 3 Pro model for fast, reliable narrative generation.
 * Gemini 3 Pro is significantly faster than Claude Opus while maintaining good quality.
 * 
 * OPTIMIZED: Uses a simplified prompt for 10-20 second responses instead of 90+ seconds.
 */

import { generateNarrativeWithPoe } from './poe-ai';
import type { EnhancedNarrativeReport, EnhancedNarrativeReportInput } from './gemini-analyzer-enhanced';

/**
 * Generate enhanced narrative report using Gemini 3 Pro via Poe
 * OPTIMIZED: Simplified prompt for faster responses (target: <30 seconds)
 */
export async function generateEnhancedNarrativeWithPoe(
  input: EnhancedNarrativeReportInput
): Promise<EnhancedNarrativeReport> {
  console.log('[PoeNarrative] Generating enhanced narrative report with Gemini 3 Pro (optimized)...');
  
  // Calculate key metrics
  const revenueToRentRatio = input.revenue_mid / (input.monthly_rent * 12);
  const occupancyNormalized = input.market_occupancy < 1 ? input.market_occupancy * 100 : input.market_occupancy;
  const monthlyProfit = Math.round(input.annual_profit_realistic / 12);
  
  // Determine recommendation based on ratio
  const recommendation = revenueToRentRatio >= 2.5 ? 'STRONG GO' : 
                         revenueToRentRatio >= 2 ? 'GO' : 
                         revenueToRentRatio >= 1.5 ? 'CAUTION' : 'NO GO';
  const confidenceScore = revenueToRentRatio >= 2.5 ? 9 : 
                          revenueToRentRatio >= 2 ? 7 : 
                          revenueToRentRatio >= 1.5 ? 5 : 3;
  
  // Format top competitor info
  const topComp = input.competitors[0];
  const topCompInfo = topComp 
    ? `${topComp.name} ($${topComp.annual_revenue?.toLocaleString()}/yr, ${Math.round((topComp.occupancy || 0) * 100)}% occ)`
    : 'No comparable data';
  
  // Calculate seasonality info
  const peakMonths = input.seasonality.filter(s => s.season_type === 'peak');
  const offMonths = input.seasonality.filter(s => s.season_type === 'off');
  const avgPeakRevenue = peakMonths.reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, peakMonths.length);
  const avgOffRevenue = offMonths.reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, offMonths.length);
  const seasonalSwingPct = avgOffRevenue > 0 ? Math.round(((avgPeakRevenue - avgOffRevenue) / avgOffRevenue) * 100) : 0;

  // Build a SIMPLIFIED prompt for faster AI responses
  const prompt = `You are an STR investment analyst. Analyze this rental arbitrage deal and write a brief executive summary.

DEAL SUMMARY:
- Property: ${input.address} (${input.bedrooms}BR/${input.bathrooms}BA)
- Monthly Rent: $${input.monthly_rent.toLocaleString()}
- Market: ${input.market_name} (${occupancyNormalized.toFixed(0)}% avg occupancy, $${input.market_adr.toFixed(0)} ADR)
- Projected Revenue: $${input.revenue_mid.toLocaleString()}/year
- Revenue-to-Rent Ratio: ${revenueToRentRatio.toFixed(2)}x (need 2x minimum)
- Projected Profit: $${input.annual_profit_realistic.toLocaleString()}/year ($${monthlyProfit.toLocaleString()}/month)
- Top Competitor: ${topCompInfo}
- Seasonality: ${seasonalSwingPct}% swing between peak and off-season

Write a 3-4 sentence executive summary that:
1. States the verdict (${recommendation}) and confidence (${confidenceScore}/10)
2. Highlights the key numbers
3. Gives one main risk and one main opportunity
4. Ends with a clear recommendation

Keep it concise and actionable. No JSON, just plain text.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: 'Gemini-3-Pro',
      maxTokens: 512, // Short response for speed
      timeoutMs: 30000, // 30 second timeout - fail fast
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
      financial_outlook: `With monthly expenses of $${input.monthly_expenses.toLocaleString()} and rent of $${input.monthly_rent.toLocaleString()}, break-even requires ${calculateBreakEvenOccupancy(input)}% occupancy. The conservative scenario yields $${input.annual_profit_conservative.toLocaleString()}/year profit.`,
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
        `Break-even occupancy: ${calculateBreakEvenOccupancy(input)}%`,
      ],
      market_context: {
        type: determineMarketType(input.market_name),
        seasonality: seasonalSwingPct > 50 ? 'high' : seasonalSwingPct > 25 ? 'moderate' : 'low',
        competition: input.active_listings > 1000 ? 'high' : input.active_listings > 500 ? 'moderate' : 'low',
        pricePoint: input.market_adr > 300 ? 'luxury' : input.market_adr > 100 ? 'mid-range' : 'budget',
        description: `${input.market_name} is a ${input.active_listings > 1000 ? 'highly competitive' : 'moderately competitive'} market.`,
      },
    };

    console.log('[PoeNarrative] Enhanced narrative report generated successfully');
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
      timeline: 'During lease negotiation',
    });
  }
  
  items.push({
    priority: 'medium',
    action: 'Create detailed furnishing budget',
    why: 'Startup costs affect break-even timeline',
    timeline: 'Within first week',
  });
  
  return items;
}

function calculateBreakEvenMonths(input: EnhancedNarrativeReportInput): number {
  const startupCosts = input.monthly_rent * 3; // First/last/deposit estimate
  const monthlyProfit = input.annual_profit_realistic / 12;
  if (monthlyProfit <= 0) return 999;
  return Math.ceil(startupCosts / monthlyProfit);
}

function calculateBreakEvenOccupancy(input: EnhancedNarrativeReportInput): number {
  const monthlyFixedCosts = input.monthly_rent + input.monthly_expenses;
  const avgNightlyRate = input.market_adr;
  const nightsNeeded = monthlyFixedCosts / avgNightlyRate;
  const occupancyNeeded = (nightsNeeded / 30) * 100;
  return Math.round(Math.min(occupancyNeeded, 100));
}

function determineMarketType(marketName: string): 'tourist' | 'business' | 'mixed' | 'suburban' | 'urban' | 'rural' {
  const name = marketName.toLowerCase();
  if (name.includes('beach') || name.includes('coast') || name.includes('shore') || 
      name.includes('mountain') || name.includes('ski') || name.includes('lake') ||
      name.includes('resort')) return 'tourist';
  if (name.includes('downtown') || name.includes('financial') || name.includes('business')) return 'business';
  if (name.includes('suburb') || name.includes('heights') || name.includes('park')) return 'suburban';
  if (name.includes('rural') || name.includes('country')) return 'rural';
  return 'urban';
}

function generateFallbackReport(
  input: EnhancedNarrativeReportInput,
  revenueToRentRatio: number
): EnhancedNarrativeReport {
  const occupancyNormalized = input.market_occupancy < 1 ? input.market_occupancy * 100 : input.market_occupancy;
  const monthlyProfit = Math.round(input.annual_profit_realistic / 12);
  const meetsRule = revenueToRentRatio >= 2;
  const recommendation = revenueToRentRatio >= 2.5 ? 'STRONG GO' : 
                         revenueToRentRatio >= 2 ? 'GO' : 
                         revenueToRentRatio >= 1.5 ? 'CAUTION' : 'NO GO';
  const confidenceScore = revenueToRentRatio >= 2.5 ? 9 : 
                          revenueToRentRatio >= 2 ? 7 : 
                          revenueToRentRatio >= 1.5 ? 5 : 3;

  return {
    executive_summary: `**${recommendation}** (${confidenceScore}/10 confidence). This ${input.bedrooms}-bedroom property at ${input.address} shows ${meetsRule ? 'promising' : 'moderate'} potential for rental arbitrage. With projected annual revenue of $${input.revenue_mid.toLocaleString()} against annual rent of $${(input.monthly_rent * 12).toLocaleString()}, the revenue-to-rent ratio is ${revenueToRentRatio.toFixed(2)}x, which ${meetsRule ? 'meets' : 'falls short of'} the recommended 2x threshold. The realistic profit scenario projects $${input.annual_profit_realistic.toLocaleString()} annually ($${monthlyProfit.toLocaleString()}/month).`,
    market_overview: `The ${input.market_name} market has ${input.active_listings.toLocaleString()} active listings with an average occupancy of ${occupancyNormalized.toFixed(0)}% and ADR of $${input.market_adr.toFixed(0)}/night.`,
    revenue_analysis: `Conservative projections suggest $${input.revenue_low.toLocaleString()}/year, while optimistic scenarios could reach $${input.revenue_high.toLocaleString()}/year. The realistic projection of $${input.revenue_mid.toLocaleString()}/year is based on 75th percentile performance.`,
    competitive_landscape: `There are ${input.competitors.length} comparable properties in the immediate area. Top performers are achieving $${input.competitors[0]?.annual_revenue?.toLocaleString() || 'N/A'}/year in revenue.`,
    seasonal_strategy: `Revenue varies throughout the year. Plan for lower income during off-season months and capitalize on peak season demand.`,
    historical_context: input.five_year_summary 
      ? `The market has shown ${input.five_year_summary.revenue.trend} revenue trends over the past ${input.five_year_summary.years_of_data} years.`
      : 'Historical data not available for this market.',
    risk_assessment: `Key risks include market saturation, regulatory changes, and seasonal revenue fluctuations. The ${meetsRule ? 'strong' : 'moderate'} revenue-to-rent ratio provides ${meetsRule ? 'good' : 'limited'} buffer against these risks.`,
    financial_outlook: `With monthly expenses of $${input.monthly_expenses.toLocaleString()}, break-even requires consistent bookings. The conservative scenario still yields $${input.annual_profit_conservative.toLocaleString()} annually.`,
    conclusion: generateConclusion(recommendation, revenueToRentRatio, monthlyProfit),
    what_this_means: {
      revenue: `You could earn about $${monthlyProfit.toLocaleString()} per month from short-term rentals.`,
      competition: `You'll be competing with ${input.competitors.length} similar properties nearby.`,
      seasonality: `Expect income to vary throughout the year based on local demand patterns.`,
      overall: meetsRule 
        ? `The numbers look good - this property could be profitable.`
        : `The margins are tight - success will require excellent execution.`,
    },
    action_items: generateActionItems(recommendation, revenueToRentRatio),
    key_metrics: {
      projected_annual_revenue: input.revenue_mid,
      projected_monthly_profit: monthlyProfit,
      market_occupancy: occupancyNormalized,
      market_adr: input.market_adr,
      break_even_months: calculateBreakEvenMonths(input),
      confidence_level: meetsRule ? 'high' : revenueToRentRatio >= 1.5 ? 'medium' : 'low',
      revenue_to_rent_ratio: revenueToRentRatio,
    },
    quick_facts: [
      `${recommendation} recommendation (${confidenceScore}/10 confidence)`,
      `Revenue-to-rent ratio: ${revenueToRentRatio.toFixed(2)}x`,
      `Projected profit: $${monthlyProfit.toLocaleString()}/month`,
      `${input.competitors.length} competing properties nearby`,
    ],
    market_context: {
      type: determineMarketType(input.market_name),
      seasonality: 'moderate',
      competition: input.active_listings > 1000 ? 'high' : input.active_listings > 500 ? 'moderate' : 'low',
      pricePoint: input.market_adr > 300 ? 'luxury' : input.market_adr > 100 ? 'mid-range' : 'budget',
      description: `${input.market_name} market analysis`,
    },
  };
}

/**
 * Poe AI Narrative Generator - Uses Claude Opus for high-quality narrative reports
 * 
 * This replaces the Gemini-based narrative generation with Poe AI's Claude Opus
 * for faster, more reliable, and higher quality narrative generation.
 */

import { generateNarrativeWithPoe } from './poe-ai';
import type { EnhancedNarrativeReport, EnhancedNarrativeReportInput } from './gemini-analyzer-enhanced';

/**
 * Generate enhanced narrative report using Claude Opus via Poe
 */
export async function generateEnhancedNarrativeWithPoe(
  input: EnhancedNarrativeReportInput
): Promise<EnhancedNarrativeReport> {
  console.log('[PoeNarrative] Generating enhanced narrative report with Claude Opus...');
  
  // Calculate key metrics
  const revenueToRentRatio = input.revenue_mid / (input.monthly_rent * 12);
  const occupancyNormalized = input.market_occupancy < 1 ? input.market_occupancy * 100 : input.market_occupancy;
  
  // Format competitor data
  const competitorAnalysis = input.competitors.slice(0, 8).map((c, i) => {
    const occupancyPct = c.occupancy < 1 ? Math.round(c.occupancy * 100) : Math.round(c.occupancy);
    return `${i + 1}. "${c.name}"
   - Revenue: $${c.annual_revenue.toLocaleString()}/year ($${Math.round(c.annual_revenue / 12).toLocaleString()}/month)
   - Occupancy: ${occupancyPct}% | ADR: $${Math.round(c.adr)}/night
   - Rating: ${c.rating ? `${c.rating}★ (${c.reviews} reviews)` : 'No rating'}`;
  }).join('\n\n');
  
  // Format seasonality
  const peakMonths = input.seasonality.filter(s => s.season_type === 'peak');
  const offMonths = input.seasonality.filter(s => s.season_type === 'off');
  const avgPeakRevenue = peakMonths.reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, peakMonths.length);
  const avgOffRevenue = offMonths.reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, offMonths.length);
  const seasonalSwingPct = avgOffRevenue > 0 ? Math.round(((avgPeakRevenue - avgOffRevenue) / avgOffRevenue) * 100) : 0;
  
  const seasonalityTable = input.seasonality.map(s => {
    const occPct = s.occupancy < 1 ? Math.round(s.occupancy * 100) : Math.round(s.occupancy);
    return `| ${s.month} | $${s.revenue.toLocaleString()} | ${occPct}% | $${Math.round(s.adr)} | ${s.season_type.toUpperCase()} |`;
  }).join('\n');

  // Build the prompt
  const prompt = `You are a senior short-term rental investment analyst writing a comprehensive report for an investor considering a rental arbitrage opportunity.

CRITICAL INSTRUCTIONS:
1. Use SPECIFIC numbers from the data provided
2. Calculate and explain what numbers MEAN for the investor
3. Compare this property to the market and competitors
4. Be honest - if the numbers are weak, say so clearly
5. Write in flowing paragraphs, NOT bullet points

PROPERTY DETAILS:
- Address: ${input.address}
- Monthly Rent: $${input.monthly_rent.toLocaleString()}
- Annual Rent Cost: $${(input.monthly_rent * 12).toLocaleString()}
- Configuration: ${input.bedrooms} bedrooms, ${input.bathrooms} bathrooms

MARKET OVERVIEW:
- Market: ${input.market_name}
- Market Occupancy: ${occupancyNormalized.toFixed(1)}%
- Market ADR: $${input.market_adr.toFixed(0)}/night
- Active Listings: ${input.active_listings.toLocaleString()}

REVENUE PROJECTIONS:
- Conservative (50th percentile): $${input.revenue_low.toLocaleString()}/year ($${Math.round(input.revenue_low / 12).toLocaleString()}/month)
- Realistic (75th percentile): $${input.revenue_mid.toLocaleString()}/year ($${Math.round(input.revenue_mid / 12).toLocaleString()}/month)
- Optimistic (90th percentile): $${input.revenue_high.toLocaleString()}/year ($${Math.round(input.revenue_high / 12).toLocaleString()}/month)

KEY RATIO:
- Revenue-to-Rent Ratio: ${revenueToRentRatio.toFixed(2)}x (${revenueToRentRatio >= 2 ? 'MEETS' : 'DOES NOT MEET'} the 2x rule)

PROFITABILITY:
- Monthly Operating Expenses: $${input.monthly_expenses.toLocaleString()}
- Annual Profit (Conservative): $${input.annual_profit_conservative.toLocaleString()}
- Annual Profit (Realistic): $${input.annual_profit_realistic.toLocaleString()}
- Annual Profit (Optimistic): $${input.annual_profit_optimistic.toLocaleString()}

TOP COMPETITORS:
${competitorAnalysis}

SEASONALITY:
- Seasonal Swing: ${seasonalSwingPct}% difference between peak and off-season
- Peak Months: ${peakMonths.map(s => s.month).join(', ') || 'Not identified'}
- Off-Season Months: ${offMonths.map(s => s.month).join(', ') || 'Not identified'}

| Month | Revenue | Occupancy | ADR | Season |
|-------|---------|-----------|-----|--------|
${seasonalityTable}

---

Please write a comprehensive investment analysis report with the following sections. Output as JSON with these exact keys:

{
  "executive_summary": "2-3 paragraph summary of the opportunity, key numbers, and recommendation",
  "market_overview": "Analysis of the local short-term rental market conditions",
  "revenue_analysis": "Detailed breakdown of revenue projections and what they mean",
  "competitive_landscape": "Analysis of competitors and how this property compares",
  "seasonal_strategy": "Recommendations for handling seasonality",
  "historical_context": "Market trends and historical performance context",
  "risk_assessment": "Key risks and mitigation strategies",
  "financial_outlook": "Financial projections and break-even analysis",
  "conclusion": "Final recommendation with specific action items",
  "what_this_means": {
    "revenue": "Plain language explanation of revenue potential",
    "competition": "Plain language explanation of competitive position",
    "seasonality": "Plain language explanation of seasonal patterns",
    "overall": "Plain language overall assessment"
  },
  "action_items": [
    {"priority": "high", "action": "Specific action to take", "why": "Reason for this action", "timeline": "When to do it"}
  ],
  "quick_facts": ["Key fact 1", "Key fact 2", "Key fact 3"]
}

Be specific, use the actual numbers, and provide actionable insights.`;

  try {
    const response = await generateNarrativeWithPoe(prompt, {
      model: 'Claude-Opus-4.1',
      maxTokens: 4096,
      timeoutMs: 90000, // 90 second timeout
    });

    // Parse the JSON response
    let parsed: any;
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[PoeNarrative] Failed to parse JSON response, using fallback');
      return generateFallbackReport(input, revenueToRentRatio);
    }

    // Build the enhanced narrative report
    const report: EnhancedNarrativeReport = {
      executive_summary: parsed.executive_summary || 'Analysis complete.',
      market_overview: parsed.market_overview || '',
      revenue_analysis: parsed.revenue_analysis || '',
      competitive_landscape: parsed.competitive_landscape || '',
      seasonal_strategy: parsed.seasonal_strategy || '',
      historical_context: parsed.historical_context || '',
      risk_assessment: parsed.risk_assessment || '',
      financial_outlook: parsed.financial_outlook || '',
      conclusion: parsed.conclusion || '',
      what_this_means: {
        revenue: parsed.what_this_means?.revenue || `This property could generate $${Math.round(input.revenue_mid / 12).toLocaleString()}/month in revenue.`,
        competition: parsed.what_this_means?.competition || `There are ${input.competitors.length} similar properties in the area.`,
        seasonality: parsed.what_this_means?.seasonality || `Revenue varies by ${seasonalSwingPct}% between peak and off-season.`,
        overall: parsed.what_this_means?.overall || `Revenue-to-rent ratio is ${revenueToRentRatio.toFixed(2)}x.`,
      },
      action_items: (parsed.action_items || []).map((item: any) => ({
        priority: item.priority || 'medium',
        action: item.action || '',
        why: item.why || '',
        timeline: item.timeline || '',
      })),
      key_metrics: {
        projected_annual_revenue: input.revenue_mid,
        projected_monthly_profit: Math.round(input.annual_profit_realistic / 12),
        market_occupancy: occupancyNormalized,
        market_adr: input.market_adr,
        break_even_months: calculateBreakEvenMonths(input),
        confidence_level: revenueToRentRatio >= 2 ? 'high' : revenueToRentRatio >= 1.5 ? 'medium' : 'low',
        revenue_to_rent_ratio: revenueToRentRatio,
      },
      quick_facts: parsed.quick_facts || [
        `Revenue-to-rent ratio: ${revenueToRentRatio.toFixed(2)}x`,
        `Projected annual profit: $${input.annual_profit_realistic.toLocaleString()}`,
        `Market occupancy: ${occupancyNormalized.toFixed(0)}%`,
      ],
      market_context: {
        type: determineMarketType(input.market_name),
        seasonality: seasonalSwingPct > 50 ? 'high' : seasonalSwingPct > 25 ? 'moderate' : 'low',
        competition: input.active_listings > 1000 ? 'high' : input.active_listings > 500 ? 'moderate' : 'low',
        pricePoint: input.market_adr > 300 ? 'luxury' : input.market_adr > 100 ? 'mid-range' : 'budget',
        description: `${input.market_name} is a ${input.active_listings > 1000 ? 'highly competitive' : 'moderately competitive'} market with ${occupancyNormalized.toFixed(0)}% occupancy.`,
      },
    };

    console.log('[PoeNarrative] Enhanced narrative report generated successfully');
    return report;
  } catch (error: any) {
    console.error('[PoeNarrative] Error generating narrative:', error.message);
    return generateFallbackReport(input, revenueToRentRatio);
  }
}

function calculateBreakEvenMonths(input: EnhancedNarrativeReportInput): number {
  const startupCosts = input.monthly_rent * 3; // First/last/deposit estimate
  const monthlyProfit = input.annual_profit_realistic / 12;
  if (monthlyProfit <= 0) return 999;
  return Math.ceil(startupCosts / monthlyProfit);
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

  return {
    executive_summary: `This ${input.bedrooms}-bedroom property at ${input.address} shows ${meetsRule ? 'promising' : 'moderate'} potential for rental arbitrage. With projected annual revenue of $${input.revenue_mid.toLocaleString()} against annual rent of $${(input.monthly_rent * 12).toLocaleString()}, the revenue-to-rent ratio is ${revenueToRentRatio.toFixed(2)}x, which ${meetsRule ? 'meets' : 'falls short of'} the recommended 2x threshold. The realistic profit scenario projects $${input.annual_profit_realistic.toLocaleString()} annually ($${monthlyProfit.toLocaleString()}/month).`,
    market_overview: `The ${input.market_name} market has ${input.active_listings.toLocaleString()} active listings with an average occupancy of ${occupancyNormalized.toFixed(0)}% and ADR of $${input.market_adr.toFixed(0)}/night.`,
    revenue_analysis: `Conservative projections suggest $${input.revenue_low.toLocaleString()}/year, while optimistic scenarios could reach $${input.revenue_high.toLocaleString()}/year. The realistic projection of $${input.revenue_mid.toLocaleString()}/year is based on 75th percentile performance.`,
    competitive_landscape: `There are ${input.competitors.length} comparable properties in the immediate area. Top performers are achieving $${input.competitors[0]?.annual_revenue?.toLocaleString() || 'N/A'}/year in revenue.`,
    seasonal_strategy: `Revenue varies throughout the year. Plan for lower income during off-season months and capitalize on peak season demand.`,
    historical_context: input.five_year_summary 
      ? `The market has shown ${input.five_year_summary.revenue.trend} revenue trends over the past ${input.five_year_summary.years_of_data} years.`
      : 'Historical data not available for this market.',
    risk_assessment: `Key risks include market saturation, regulatory changes, and seasonal revenue fluctuations. The ${meetsRule ? 'strong' : 'moderate'} revenue-to-rent ratio provides ${meetsRule ? 'good' : 'limited'} buffer against these risks.`,
    financial_outlook: `With monthly expenses of $${input.monthly_expenses.toLocaleString()}, break-even requires consistent bookings. The conservative scenario still yields $${input.annual_profit_conservative.toLocaleString()} annually.`,
    conclusion: meetsRule 
      ? `This property shows strong potential for rental arbitrage. Proceed with due diligence on local regulations and property condition.`
      : `This property shows moderate potential. Consider negotiating lower rent or finding a property with better revenue potential.`,
    what_this_means: {
      revenue: `You could earn about $${Math.round(input.revenue_mid / 12).toLocaleString()} per month from short-term rentals.`,
      competition: `You'll be competing with ${input.competitors.length} similar properties nearby.`,
      seasonality: `Expect income to vary throughout the year based on local demand patterns.`,
      overall: meetsRule 
        ? `The numbers look good - this property could be profitable.`
        : `The margins are tight - success will require excellent execution.`,
    },
    action_items: [
      {
        priority: 'high',
        action: 'Verify local STR regulations',
        why: 'Regulations can significantly impact profitability',
        timeline: 'Before signing lease',
      },
      {
        priority: 'high',
        action: 'Inspect property condition',
        why: 'Unexpected repairs can eat into profits',
        timeline: 'Before signing lease',
      },
      {
        priority: 'medium',
        action: 'Create detailed furnishing budget',
        why: 'Startup costs affect break-even timeline',
        timeline: 'Within first week',
      },
    ],
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
      `Revenue-to-rent ratio: ${revenueToRentRatio.toFixed(2)}x`,
      `Projected annual profit: $${input.annual_profit_realistic.toLocaleString()}`,
      `Market occupancy: ${occupancyNormalized.toFixed(0)}%`,
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

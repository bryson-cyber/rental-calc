/**
 * Excel Export Service
 * 
 * Generates Excel workbooks from analysis data using xlsx library
 */

import * as XLSX from 'xlsx';

// Use inline type to avoid circular dependency
interface AnalysisData {
  property_estimate?: {
    property: {
      address: string;
      bedrooms: number;
      bathrooms: number;
      zipcode?: string;
    };
    estimates: {
      annual_revenue: number;
      annual_revenue_low: number;
      annual_revenue_high: number;
      average_daily_rate: number;
      occupancy_rate: number;
    };
    monthly_forecast?: Array<{
      month: string;
      revenue: number;
      adr: number;
      occupancy: number;
    }>;
    comps?: Array<{
      title: string;
      bedrooms: number;
      bathrooms: number;
      annual_revenue: number;
      adr: number;
      occupancy: number;
      rating: number | null;
      reviews: number;
    }>;
  } | null;
  monthly_rent: number;
  market_details?: {
    name: string;
    listing_count?: number;
  };
  property_roi?: {
    annual_profit_conservative: number;
    annual_profit_realistic: number;
    annual_profit_optimistic: number;
    monthly_profit_realistic: number;
    startup_costs: number;
    break_even_months: number;
  };
  market_saturation?: {
    total_listings: number;
    same_bedroom_count: number;
    bedroom_distribution: Array<{ bedrooms: number; count: number; percentage: number }>;
    revenue_percentiles: { p25: number; p50: number; p75: number; p90: number };
    avg_revenue: number;
    avg_adr: number;
    avg_occupancy: number;
    superhost_percentage: number;
    professional_percentage: number;
  };
  seasonality?: Array<{
    month: string;
    revenue: number;
    occupancy: number;
    adr: number;
  }>;
  ai_analysis?: {
    verdict?: {
      rating: string;
      confidence: number;
      summary: string;
    };
  } | null;
  narrative_report?: {
    executive_summary: string;
    market_overview: string;
    revenue_analysis: string;
    competitive_landscape: string;
    risk_assessment: string;
    investment_recommendation: string;
  };
  enhanced_narrative_report?: {
    executive_summary: string;
    action_items?: Array<{
      priority: string;
      action: string;
      timeline: string;
    }>;
  };
}

/**
 * Generate Excel workbook from analysis data
 */
export function generateExcelReport(analysis: AnalysisData): Buffer {
  const workbook = XLSX.utils.book_new();
  
  // Sheet 1: Executive Summary
  const summaryData = [
    ['RENTAL ARBITRAGE ANALYSIS REPORT'],
    ['Generated:', new Date().toLocaleString()],
    [''],
    ['PROPERTY DETAILS'],
    ['Address', analysis.property_estimate?.property.address || 'N/A'],
    ['Bedrooms', analysis.property_estimate?.property.bedrooms || 'N/A'],
    ['Bathrooms', analysis.property_estimate?.property.bathrooms || 'N/A'],
    ['ZIP Code', analysis.property_estimate?.property.zipcode || 'N/A'],
    ['Monthly Rent', analysis.monthly_rent],
    ['Market', analysis.market_details?.name || 'N/A'],
    [''],
    ['REVENUE PROJECTIONS'],
    ['Conservative (50th %ile)', analysis.property_estimate?.estimates.annual_revenue_low || 0],
    ['Realistic (75th %ile)', analysis.property_estimate?.estimates.annual_revenue || 0],
    ['Optimistic (90th %ile)', analysis.property_estimate?.estimates.annual_revenue_high || 0],
    ['Average Daily Rate', analysis.property_estimate?.estimates.average_daily_rate || 0],
    ['Occupancy Rate', analysis.property_estimate?.estimates.occupancy_rate || 0],
    [''],
    ['PROFITABILITY'],
    ['Annual Profit (Conservative)', analysis.property_roi?.annual_profit_conservative || 0],
    ['Annual Profit (Realistic)', analysis.property_roi?.annual_profit_realistic || 0],
    ['Annual Profit (Optimistic)', analysis.property_roi?.annual_profit_optimistic || 0],
    ['Monthly Profit (Realistic)', analysis.property_roi?.monthly_profit_realistic || 0],
    ['Startup Costs', analysis.property_roi?.startup_costs || 0],
    ['Break-Even (Months)', analysis.property_roi?.break_even_months || 0],
    [''],
    ['INVESTMENT VERDICT'],
    ['Rating', analysis.ai_analysis?.verdict?.rating || 'PENDING'],
    ['Confidence', analysis.ai_analysis?.verdict?.confidence || 'N/A'],
    ['Summary', analysis.ai_analysis?.verdict?.summary || 'N/A'],
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  
  // Set column widths
  summarySheet['!cols'] = [
    { wch: 30 },
    { wch: 50 }
  ];
  
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  // Sheet 2: Monthly Forecast
  if (analysis.property_estimate?.monthly_forecast && analysis.property_estimate.monthly_forecast.length > 0) {
    const forecastData = [
      ['Month', 'Revenue', 'ADR', 'Occupancy'],
      ...analysis.property_estimate.monthly_forecast.map(m => [
        m.month,
        m.revenue,
        m.adr,
        m.occupancy
      ])
    ];
    
    const forecastSheet = XLSX.utils.aoa_to_sheet(forecastData);
    forecastSheet['!cols'] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(workbook, forecastSheet, 'Monthly Forecast');
  }
  
  // Sheet 3: Comparable Properties
  if (analysis.property_estimate?.comps && analysis.property_estimate.comps.length > 0) {
    const compsData = [
      ['Property', 'Bedrooms', 'Bathrooms', 'Annual Revenue', 'ADR', 'Occupancy', 'Rating', 'Reviews'],
      ...analysis.property_estimate.comps.map(c => [
        c.title,
        c.bedrooms,
        c.bathrooms,
        c.annual_revenue,
        c.adr,
        c.occupancy,
        c.rating || 'N/A',
        c.reviews
      ])
    ];
    
    const compsSheet = XLSX.utils.aoa_to_sheet(compsData);
    compsSheet['!cols'] = [
      { wch: 40 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
      { wch: 8 },
      { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(workbook, compsSheet, 'Comparables');
  }
  
  // Sheet 4: Market Analysis
  if (analysis.market_saturation) {
    const marketData = [
      ['MARKET SATURATION ANALYSIS'],
      [''],
      ['Total Listings', analysis.market_saturation.total_listings],
      ['Same Bedroom Count', analysis.market_saturation.same_bedroom_count],
      ['Average Revenue', analysis.market_saturation.avg_revenue],
      ['Average ADR', analysis.market_saturation.avg_adr],
      ['Average Occupancy', analysis.market_saturation.avg_occupancy],
      ['Superhost %', analysis.market_saturation.superhost_percentage],
      ['Professional %', analysis.market_saturation.professional_percentage],
      [''],
      ['REVENUE PERCENTILES'],
      ['25th Percentile', analysis.market_saturation.revenue_percentiles.p25],
      ['50th Percentile (Median)', analysis.market_saturation.revenue_percentiles.p50],
      ['75th Percentile', analysis.market_saturation.revenue_percentiles.p75],
      ['90th Percentile', analysis.market_saturation.revenue_percentiles.p90],
      [''],
      ['BEDROOM DISTRIBUTION'],
      ['Bedrooms', 'Count', 'Percentage'],
      ...analysis.market_saturation.bedroom_distribution.map(b => [
        b.bedrooms,
        b.count,
        b.percentage + '%'
      ])
    ];
    
    const marketSheet = XLSX.utils.aoa_to_sheet(marketData);
    marketSheet['!cols'] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(workbook, marketSheet, 'Market Analysis');
  }
  
  // Sheet 5: Action Items
  if (analysis.enhanced_narrative_report?.action_items && analysis.enhanced_narrative_report.action_items.length > 0) {
    const actionData = [
      ['Priority', 'Action', 'Timeline'],
      ...analysis.enhanced_narrative_report.action_items.map(item => [
        item.priority,
        item.action,
        item.timeline
      ])
    ];
    
    const actionSheet = XLSX.utils.aoa_to_sheet(actionData);
    actionSheet['!cols'] = [
      { wch: 12 },
      { wch: 60 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(workbook, actionSheet, 'Action Items');
  }
  
  // Sheet 6: AI Analysis (Narrative)
  if (analysis.narrative_report) {
    const narrativeData = [
      ['EXECUTIVE SUMMARY'],
      [analysis.narrative_report.executive_summary || ''],
      [''],
      ['MARKET OVERVIEW'],
      [analysis.narrative_report.market_overview || ''],
      [''],
      ['REVENUE ANALYSIS'],
      [analysis.narrative_report.revenue_analysis || ''],
      [''],
      ['COMPETITIVE LANDSCAPE'],
      [analysis.narrative_report.competitive_landscape || ''],
      [''],
      ['RISK ASSESSMENT'],
      [analysis.narrative_report.risk_assessment || ''],
      [''],
      ['INVESTMENT RECOMMENDATION'],
      [analysis.narrative_report.investment_recommendation || ''],
    ];
    
    const narrativeSheet = XLSX.utils.aoa_to_sheet(narrativeData);
    narrativeSheet['!cols'] = [{ wch: 120 }];
    XLSX.utils.book_append_sheet(workbook, narrativeSheet, 'AI Analysis');
  }
  
  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Generate Excel and return as base64 string
 */
export function generateExcelBase64(analysis: AnalysisData): string {
  const buffer = generateExcelReport(analysis);
  return buffer.toString('base64');
}

/**
 * Full Narrative Generation Stress Test
 * Tests the complete AI narrative pipeline with fully mocked external dependencies.
 * All AirDNA, Claude AI, scraper, and AI fallback calls are mocked.
 */

import { describe, it, expect, vi } from 'vitest';
import { MOCK_DENVER_ESTIMATE, MOCK_MIAMI_ESTIMATE } from './fixtures/mock-rentalizer-data';

// Increase timeout for AI narrative generation
vi.setConfig({ testTimeout: 120000 });

// ============================================
// Mock AirDNA - ALL exported functions
// ============================================
vi.mock('../airdna', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../airdna')>();
  
  const mockRentalizerFn = vi.fn().mockImplementation(async (params: any) => {
    if (params.address?.includes('Miami')) return MOCK_MIAMI_ESTIMATE;
    return MOCK_DENVER_ESTIMATE;
  });

  const mockMarketDetails = {
    id: 'test-market-1',
    name: 'Denver, CO',
    listing_count: 5000,
    location_name: 'Denver, Colorado',
    market_type: 'market',
    metrics: {
      revenue: 55000,
      occupancy: 65,
      adr: 225,
      revpar: 146,
      active_listings: 5000,
      market_score: 78,
    },
  };

  const mockSeasonality = [
    { month_name: 'January', revenue: 4000, occupancy: 55, adr: 200, season_type: 'off' },
    { month_name: 'February', revenue: 4200, occupancy: 57, adr: 205, season_type: 'off' },
    { month_name: 'March', revenue: 5500, occupancy: 63, adr: 230, season_type: 'shoulder' },
    { month_name: 'April', revenue: 6000, occupancy: 66, adr: 240, season_type: 'shoulder' },
    { month_name: 'May', revenue: 7200, occupancy: 72, adr: 270, season_type: 'peak' },
    { month_name: 'June', revenue: 8500, occupancy: 78, adr: 295, season_type: 'peak' },
    { month_name: 'July', revenue: 9000, occupancy: 80, adr: 305, season_type: 'peak' },
    { month_name: 'August', revenue: 8800, occupancy: 79, adr: 300, season_type: 'peak' },
    { month_name: 'September', revenue: 6800, occupancy: 70, adr: 260, season_type: 'shoulder' },
    { month_name: 'October', revenue: 5800, occupancy: 64, adr: 240, season_type: 'shoulder' },
    { month_name: 'November', revenue: 4500, occupancy: 58, adr: 210, season_type: 'off' },
    { month_name: 'December', revenue: 4300, occupancy: 56, adr: 205, season_type: 'off' },
  ];

  const mockListings = [
    {
      id: 'abnb_1', title: 'Downtown Luxury Loft', airbnb_url: 'https://airbnb.com/rooms/1',
      image_url: '', bedrooms: 3, bathrooms: 2, accommodates: 6, property_type: 'Apartment',
      rating: 4.9, reviews: 148, annual_revenue: 116954, adr: 491, occupancy: 0.66,
      amenities: ['wifi', 'kitchen', 'parking'], distance_meters: 885,
      last_review_date: '2025-01-15', superhost: true, professionally_managed: false,
      host_size: 'small' as const, latitude: 39.7485, longitude: -104.998, zipcode: '80202',
    },
    {
      id: 'abnb_2', title: 'Modern City Townhome', airbnb_url: 'https://airbnb.com/rooms/2',
      image_url: '', bedrooms: 3, bathrooms: 3, accommodates: 8, property_type: 'House',
      rating: 5.0, reviews: 109, annual_revenue: 71676, adr: 278, occupancy: 0.71,
      amenities: ['wifi', 'pool', 'gym'], distance_meters: 1140,
      last_review_date: '2025-01-10', superhost: true, professionally_managed: true,
      host_size: 'medium' as const, latitude: 39.752, longitude: -105.001, zipcode: '80202',
    },
  ];

  const mockTopPerformers = {
    total_count: 100,
    listings: mockListings.map(l => ({
      title: l.title, bedrooms: l.bedrooms, bathrooms: l.bathrooms,
      annual_revenue: l.annual_revenue, occupancy: l.occupancy, adr: l.adr,
      rating: l.rating, reviews: l.reviews, property_type: l.property_type,
      airbnb_url: l.airbnb_url, superhost: l.superhost,
    })),
  };

  return {
    // Re-export all types/interfaces (they pass through automatically)
    ...actual,
    
    // Core functions
    getRentalizerEstimate: mockRentalizerFn,
    getEnhancedRentalizerEstimate: vi.fn().mockResolvedValue(MOCK_DENVER_ESTIMATE),
    searchByZipcode: vi.fn().mockResolvedValue({ top_performers: [], market_stats: { avg_revenue: 55000, avg_adr: 225, avg_occupancy: 0.65 } }),
    searchMarkets: vi.fn().mockResolvedValue([{ id: 'test-market-1', name: 'Denver, CO', listing_count: 5000 }]),
    searchMarketsAPI: vi.fn().mockResolvedValue([{ id: 'test-market-1', name: 'Denver, CO', listing_count: 5000 }]),
    
    // Market data
    getMarketDetails: vi.fn().mockResolvedValue(mockMarketDetails),
    getComprehensiveMarketReport: vi.fn().mockResolvedValue({ market: mockMarketDetails }),
    getMarketSeasonality: vi.fn().mockResolvedValue(mockSeasonality),
    getMarketHistoricalData: vi.fn().mockResolvedValue({ occupancy: [], revenue: [], adr: [] }),
    getMarketFutureDailyData: vi.fn().mockResolvedValue([]),
    getMarketBookingPatterns: vi.fn().mockResolvedValue(null),
    getMarketSupplyTrend: vi.fn().mockResolvedValue(null),
    getMarketProfessionalStats: vi.fn().mockResolvedValue(null),
    getMarketCancellationPolicies: vi.fn().mockResolvedValue(null),
    getMarketListings: vi.fn().mockResolvedValue(mockListings),
    getAllMarketListings: vi.fn().mockResolvedValue({ listings: mockListings, total_count: 2 }),
    getFilteredMarketListings: vi.fn().mockResolvedValue(mockListings),
    
    // Listing data
    getTopPerformers: vi.fn().mockResolvedValue(mockTopPerformers),
    getListingComps: vi.fn().mockResolvedValue([]),
    getListingFuturePricing: vi.fn().mockResolvedValue(null),
    getListingHistoricalMetrics: vi.fn().mockResolvedValue(null),
    getRentalizerComps: vi.fn().mockResolvedValue({
      comps: mockListings.map(l => ({
        title: l.title, bedrooms: l.bedrooms, bathrooms: l.bathrooms,
        annual_revenue: l.annual_revenue, adr: l.adr, occupancy: l.occupancy,
        rating: l.rating, reviews: l.reviews, distance_meters: l.distance_meters,
      })),
      total: 2,
    }),
    getSinglePropertyDetails: vi.fn().mockResolvedValue(null),
    getQualifyingCompetitors: vi.fn().mockResolvedValue({
      qualifyingListings: mockListings,
      allSameBedroomListings: mockListings,
      activeListings: mockListings,
      revenueThreshold: 60000,
      totalInMarket: 2,
      inactiveCount: 0,
    }),
    getListingsInRadius: vi.fn().mockResolvedValue({ listings: mockListings, total: 2, search_radius_meters: 5000 }),
    exploreListingsInRadius: vi.fn().mockResolvedValue({ listings: mockListings, total: 2, search_radius_meters: 5000 }),
    exploreListingsInMarket: vi.fn().mockResolvedValue({ listings: mockListings, total: 2 }),
    
    // Submarket data
    getSubmarketsInMarket: vi.fn().mockResolvedValue([]),
    getSubmarketDetails: vi.fn().mockResolvedValue(null),
    getSubmarketMetrics: vi.fn().mockResolvedValue(null),
    getSubmarketListings: vi.fn().mockResolvedValue({ listings: [], total: 0 }),
    getSubmarketSeasonality: vi.fn().mockResolvedValue([]),
    getSubmarketBookingPatterns: vi.fn().mockResolvedValue(null),
    getSubmarketSupplyTrend: vi.fn().mockResolvedValue(null),
    getSubmarketBedroomCounts: vi.fn().mockResolvedValue([]),
    getAllSubmarketListings: vi.fn().mockResolvedValue([]),
    exploreSubmarketsWithMetrics: vi.fn().mockResolvedValue({
      market: { id: 'test-market-1', name: 'Denver, CO', metrics: { revenue: 55000, occupancy: 65, adr: 225, revpar: 146, active_listings: 5000, market_score: 78 } },
      submarkets: [],
    }),
    getComprehensiveSubmarketReport: vi.fn().mockResolvedValue(null),
    
    // Analysis functions
    calculateArbitrageFeasibility: vi.fn().mockResolvedValue({
      property: { address: '1321 15th St, Denver, CO 80202', bedrooms: 3, bathrooms: 2, monthly_rent: 2500 },
      projections: {
        annual_str_revenue: 96134, annual_str_revenue_low: 80000, annual_str_revenue_high: 115000,
        monthly_str_revenue: 8011, break_even_occupancy: 0.35,
        projected_monthly_profit: 5511, projected_annual_profit: 66134, roi_percentage: 220,
      },
      risk_assessment: { overall_risk: 'low', seasonality_risk: 'medium', regulation_risk: 'low', market_saturation: 'medium', factors: [] },
      recommendation: 'Strong investment opportunity',
      market_context: { market_name: 'Denver, CO', avg_occupancy: 0.65, avg_adr: 225, avg_revenue: 55000 },
    }),
    calculateMarketInsights: vi.fn().mockReturnValue({
      total_listings: 2,
      professionally_managed_count: 1,
      professionally_managed_pct: 50,
      superhost_count: 1,
      superhost_pct: 50,
      avg_rating: 4.9,
      avg_reviews: 128,
      avg_days_available: 200,
      avg_days_reserved: 165,
      property_type_breakdown: [
        { type: 'Apartment', count: 1, pct: 50, avg_revenue: 116954 },
        { type: 'House', count: 1, pct: 50, avg_revenue: 71676 },
      ],
      host_size_breakdown: [
        { size: 'small', count: 1, pct: 50, avg_revenue: 116954 },
        { size: 'medium', count: 1, pct: 50, avg_revenue: 71676 },
      ],
      revenue_percentiles: { p10: 50000, p25: 65000, p50: 80000, p75: 100000, p90: 120000 },
    }),
    
    // Country/region data
    getCountryMarkets: vi.fn().mockResolvedValue({ markets: [], total_count: 0 }),
    
    // Image/property data
    batchFetchPropertyImages: vi.fn().mockResolvedValue(new Map()),
    enrichListingsWithImages: vi.fn().mockImplementation(async (listings: any[]) => listings),
    
    // Bulk operations
    getBulkListings: vi.fn().mockResolvedValue([]),
    getBulkListingsInBatches: vi.fn().mockResolvedValue([]),
    getRentalizerBulkSummary: vi.fn().mockResolvedValue([]),
    getListingsByArea: vi.fn().mockResolvedValue({ listings: [], total: 0 }),
    getBedroomCounts: vi.fn().mockResolvedValue([]),
    
    // Comparison/detection
    compareMarkets: vi.fn().mockResolvedValue(null),
    detectSearchType: vi.fn().mockReturnValue('address'),
    calculateForwardLookingDemand: vi.fn().mockResolvedValue(null),
    getComprehensivePropertyReport: vi.fn().mockResolvedValue(null),
    getStandaloneMarketAdvisorData: vi.fn().mockResolvedValue(null),
  };
});

// ============================================
// Mock AI Analyzer
// ============================================
vi.mock('../ai-analyzer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ai-analyzer')>();
  return {
    ...actual,
    runFullAIAnalysis: vi.fn().mockResolvedValue({
      insights: [{ category: 'market', text: 'Strong market fundamentals', confidence: 0.85 }],
      verdict: { recommendation: 'invest', confidence: 0.8, summary: 'Good investment opportunity' },
      pricing: { optimal_adr: 480, min_adr: 350, max_adr: 600, strategy: 'dynamic' },
      competitors: [],
      risks: { overall_risk: 'medium', factors: [] },
      action_plan: { immediate: [], short_term: [], long_term: [] },
      executive_summary: 'This property shows strong investment potential.',
    }),
    synthesizePropertyInsights: vi.fn().mockResolvedValue([]),
    analyzeCompetitorPatterns: vi.fn().mockResolvedValue([]),
    generateInvestmentVerdict: vi.fn().mockResolvedValue({ recommendation: 'invest', confidence: 0.8, summary: 'Good opportunity' }),
    generatePricingStrategy: vi.fn().mockResolvedValue({ optimal_adr: 480, strategy: 'dynamic' }),
    assessRisks: vi.fn().mockResolvedValue({ overall_risk: 'medium', factors: [] }),
    generateActionPlan: vi.fn().mockResolvedValue({ immediate: [], short_term: [], long_term: [] }),
    generateExecutiveSummary: vi.fn().mockResolvedValue('Strong investment opportunity in Denver market.'),
    analyzeCompetitorPhotos: vi.fn().mockResolvedValue({ competitor_photos: [], design_insights: { common_themes: [], design_recommendations: [], must_have_shots: [], differentiation_opportunities: [] } }),
    analyzeListingPhoto: vi.fn().mockResolvedValue({ quality_score: 8, style: 'modern', strengths: [], improvements: [] }),
    getLocalRegulations: vi.fn().mockResolvedValue({ status: 'allowed', details: 'Short-term rentals are permitted', restrictions: [] }),
    generateWhatThisMeans: vi.fn().mockResolvedValue('This means the property has good potential.'),
    analyzeHistoricalMarketTrends: vi.fn().mockResolvedValue({ trend: 'growing', summary: 'Market has been growing steadily' }),
    generateNarrativeReport: vi.fn().mockResolvedValue({ report: 'Comprehensive analysis report', sections: [] }),
    callLLMStructured: vi.fn().mockResolvedValue({}),
    generateStructuredAnalysis: vi.fn().mockResolvedValue({}),
    fetchAnalysisDataParallel: vi.fn().mockResolvedValue({}),
    explainForBeginners: vi.fn().mockResolvedValue('Simple explanation of the data.'),
    batchGenerateExplanations: vi.fn().mockResolvedValue({}),
    calculateTimeToRevenue: vi.fn().mockResolvedValue({ months_to_breakeven: 6 }),
    calculateHiddenCosts: vi.fn().mockReturnValue({ total: 5000, items: [] }),
    calculateComplexity: vi.fn().mockReturnValue({ score: 5, level: 'moderate' }),
    compareDIYvsProfessional: vi.fn().mockReturnValue({ recommendation: 'diy' }),
    generateLeadMagnetWowData: vi.fn().mockResolvedValue({}),
  };
});

// ============================================
// Mock AI Analyzer Enhanced
// ============================================
vi.mock('../ai-analyzer-enhanced', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ai-analyzer-enhanced')>();
  return {
    ...actual,
    generateEnhancedNarrativeReport: vi.fn().mockResolvedValue({
      executive_summary: 'This Denver property presents an excellent short-term rental investment opportunity with projected annual revenue of $96,134 and strong market fundamentals. The property benefits from its prime downtown location near major attractions and business districts.',
      key_metrics: {
        projected_annual_revenue: 96134,
        average_daily_rate: 480,
        occupancy_rate: 0.56,
        monthly_cash_flow: 4500,
        roi_percentage: 15.2,
      },
      market_analysis: 'The Denver short-term rental market continues to show strong demand driven by tourism and business travel.',
      competitive_landscape: 'The property faces moderate competition from 5 comparable listings within a 2km radius.',
      investment_recommendation: 'INVEST - Strong fundamentals with above-average revenue potential.',
      risk_factors: ['Seasonal demand fluctuation', 'Regulatory changes possible'],
      action_items: ['Optimize pricing strategy', 'Invest in professional photography'],
    }),
    fetchDataInParallel: vi.fn().mockResolvedValue({}),
    clearAllCaches: vi.fn(),
    getCacheStats: vi.fn().mockReturnValue({ marketData: 0, narrative: 0 }),
  };
});

// ============================================
// Mock AI Fallback
// ============================================
vi.mock('../ai-fallback', () => ({
  generateEnhancedNarrativeWithFallback: vi.fn().mockResolvedValue({
    executive_summary: 'This Denver property presents an excellent short-term rental investment opportunity with projected annual revenue of $96,134 and strong market fundamentals. The property benefits from its prime downtown location near major attractions and business districts.',
    key_metrics: {
      projected_annual_revenue: 96134,
      average_daily_rate: 480,
      occupancy_rate: 0.56,
      monthly_cash_flow: 4500,
      roi_percentage: 15.2,
    },
    market_analysis: 'The Denver short-term rental market continues to show strong demand driven by tourism and business travel.',
    competitive_landscape: 'The property faces moderate competition from 5 comparable listings within a 2km radius.',
    investment_recommendation: 'INVEST - Strong fundamentals with above-average revenue potential.',
    risk_factors: ['Seasonal demand fluctuation', 'Regulatory changes possible'],
    action_items: ['Optimize pricing strategy', 'Invest in professional photography'],
  }),
}));

// ============================================
// Mock Airbnb Scraper
// ============================================
vi.mock('../airbnb-scraper', () => ({
  scrapeAirbnbImages: vi.fn().mockResolvedValue([]),
  batchScrapeAirbnbImages: vi.fn().mockResolvedValue(new Map()),
  batchCheckAirbnbListingsActive: vi.fn().mockResolvedValue(new Map()),
  extractAirbnbListingId: vi.fn().mockReturnValue(null),
  constructAirbnbImageUrl: vi.fn().mockReturnValue(''),
  checkAirbnbListingActive: vi.fn().mockResolvedValue(true),
  getListingThumbnail: vi.fn().mockResolvedValue(null),
  clearImageCache: vi.fn(),
  getCacheStats: vi.fn().mockReturnValue({ size: 0, entries: [] }),
}));

// ============================================
// Mock progress tracker (avoid side effects)
// ============================================
vi.mock('../progress-tracker', () => ({
  progressTracker: {
    startStep: vi.fn(),
    completeStep: vi.fn(),
    errorStep: vi.fn(),
    getProgress: vi.fn().mockReturnValue({ steps: [], currentStep: null }),
  },
  withProgress: vi.fn().mockImplementation((_id: string, fn: Function) => fn()),
}));

import { generateFullArbitrageAnalysis } from '../sop-reports';

interface NarrativeQualityIssue {
  section: string;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
}

function analyzeNarrativeQuality(report: any): NarrativeQualityIssue[] {
  const issues: NarrativeQualityIssue[] = [];
  
  // Check executive summary
  if (!report.enhanced_narrative_report?.executive_summary) {
    issues.push({ section: 'executive_summary', issue: 'MISSING', severity: 'critical' });
  } else {
    const summary = report.enhanced_narrative_report.executive_summary;
    
    // Check for placeholder text
    if (/\[.*?\]|undefined|null|NaN/i.test(summary)) {
      issues.push({ section: 'executive_summary', issue: 'CONTAINS_PLACEHOLDERS', severity: 'critical' });
    }
    
    // Check length
    const wordCount = summary.split(/\s+/).length;
    if (wordCount < 100) {
      issues.push({ section: 'executive_summary', issue: `TOO_SHORT (${wordCount} words)`, severity: 'warning' });
    } else if (wordCount > 300) {
      issues.push({ section: 'executive_summary', issue: `TOO_LONG (${wordCount} words)`, severity: 'info' });
    }
  }
  
  // Check key metrics
  const metrics = report.enhanced_narrative_report?.key_metrics;
  if (!metrics) {
    issues.push({ section: 'key_metrics', issue: 'MISSING', severity: 'critical' });
  } else {
    if (!metrics.projected_annual_revenue || metrics.projected_annual_revenue <= 0) {
      issues.push({ section: 'key_metrics', issue: 'INVALID_REVENUE', severity: 'critical' });
    }
  }
  
  // Check competitors
  if (!report.competitors || report.competitors.length === 0) {
    issues.push({ section: 'competitors', issue: 'NO_COMPETITORS', severity: 'warning' });
  }
  
  // Check profitability
  if (!report.profitability) {
    issues.push({ section: 'profitability', issue: 'MISSING', severity: 'critical' });
  }
  
  return issues;
}

describe('Full Narrative Generation Stress Test', () => {
  it('should generate quality narrative for Denver property', async () => {
    console.log('\n=== Testing Denver ===');
    
    const report = await generateFullArbitrageAnalysis(
      '1321 15th St, Denver, CO 80202',
      2500,
      3,
      2
    );
    
    const issues = analyzeNarrativeQuality(report);
    
    console.log(`Revenue: $${report.profitability?.scenarios.realistic.projected_revenue?.toLocaleString() || 'N/A'}/yr`);
    console.log(`Competitors: ${report.competitors?.length || 0}`);
    console.log(`Issues found: ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.severity}] ${i.section}: ${i.issue}`));
    
    // Should have executive summary
    expect(report.enhanced_narrative_report?.executive_summary).toBeDefined();
    
    // Should not have critical issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    expect(criticalIssues.length).toBe(0);
  }, 120000);

  it('should generate quality narrative for Miami Beach property', async () => {
    console.log('\n=== Testing Miami Beach ===');
    
    const report = await generateFullArbitrageAnalysis(
      '456 Ocean Dr, Miami Beach, FL 33139',
      3500,
      2,
      2
    );
    
    const issues = analyzeNarrativeQuality(report);
    
    console.log(`Revenue: $${report.profitability?.scenarios.realistic.projected_revenue?.toLocaleString() || 'N/A'}/yr`);
    console.log(`Competitors: ${report.competitors?.length || 0}`);
    console.log(`Issues found: ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.severity}] ${i.section}: ${i.issue}`));
    
    expect(report.enhanced_narrative_report?.executive_summary).toBeDefined();
    
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    expect(criticalIssues.length).toBe(0);
  }, 120000);
});

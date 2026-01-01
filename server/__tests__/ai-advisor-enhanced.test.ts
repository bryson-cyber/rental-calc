import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeEnhancedFunction,
  executeAdditionalFunction,
  executeDealFunction,
  calculateInvestmentDecision
} from '../ai-advisor-enhanced';

// Mock the airdna module
vi.mock('../airdna', () => ({
  searchMarkets: vi.fn().mockResolvedValue([
    { id: 'test-market-1', name: 'Austin, TX', listing_count: 5000 }
  ]),
  getComprehensiveMarketReport: vi.fn().mockResolvedValue({
    market: {
      id: 'test-market-1',
      name: 'Austin, TX',
      listing_count: 5000,
      metrics: {
        revenue: 55000,
        occupancy: 65,
        adr: 225,
        revpar: 146,
        active_listings: 5000,
        market_score: 78
      }
    }
  }),
  getTopPerformers: vi.fn().mockResolvedValue({
    total_count: 100,
    listings: [
      { title: 'Luxury Downtown Condo', bedrooms: 2, bathrooms: 2, annual_revenue: 85000, occupancy: 75, adr: 310, rating: 4.9, reviews: 150, property_type: 'Condo', airbnb_url: 'https://airbnb.com/1' },
      { title: 'Modern House with Pool', bedrooms: 3, bathrooms: 2, annual_revenue: 78000, occupancy: 70, adr: 280, rating: 4.8, reviews: 120, property_type: 'House', airbnb_url: 'https://airbnb.com/2' },
      { title: 'Cozy Apartment', bedrooms: 1, bathrooms: 1, annual_revenue: 45000, occupancy: 68, adr: 180, rating: 4.7, reviews: 80, property_type: 'Apartment', airbnb_url: 'https://airbnb.com/3' },
      { title: 'Spacious Townhouse', bedrooms: 3, bathrooms: 2, annual_revenue: 72000, occupancy: 72, adr: 265, rating: 4.85, reviews: 95, property_type: 'Townhouse', airbnb_url: 'https://airbnb.com/4' },
      { title: 'Lake View House', bedrooms: 4, bathrooms: 3, annual_revenue: 95000, occupancy: 68, adr: 350, rating: 4.95, reviews: 200, property_type: 'House', airbnb_url: 'https://airbnb.com/5' }
    ]
  }),
  getMarketSeasonality: vi.fn().mockResolvedValue([
    { month_name: 'January', revenue: 4000, occupancy: 55, adr: 200, season_type: 'off' },
    { month_name: 'February', revenue: 4200, occupancy: 58, adr: 205, season_type: 'off' },
    { month_name: 'March', revenue: 5500, occupancy: 68, adr: 230, season_type: 'shoulder' },
    { month_name: 'April', revenue: 5800, occupancy: 70, adr: 235, season_type: 'shoulder' },
    { month_name: 'May', revenue: 6200, occupancy: 72, adr: 245, season_type: 'peak' },
    { month_name: 'June', revenue: 7000, occupancy: 78, adr: 260, season_type: 'peak' },
    { month_name: 'July', revenue: 7500, occupancy: 80, adr: 270, season_type: 'peak' },
    { month_name: 'August', revenue: 7200, occupancy: 78, adr: 265, season_type: 'peak' },
    { month_name: 'September', revenue: 5500, occupancy: 68, adr: 230, season_type: 'shoulder' },
    { month_name: 'October', revenue: 5800, occupancy: 70, adr: 235, season_type: 'shoulder' },
    { month_name: 'November', revenue: 4500, occupancy: 60, adr: 215, season_type: 'off' },
    { month_name: 'December', revenue: 5000, occupancy: 62, adr: 220, season_type: 'shoulder' }
  ]),
  exploreSubmarketsWithMetrics: vi.fn().mockResolvedValue({
    market: {
      id: 'test-market-1',
      name: 'Austin, TX',
      metrics: { revenue: 55000, occupancy: 65, adr: 225, revpar: 146 }
    },
    submarkets: [
      { id: 'sub-1', name: 'Downtown', listing_count: 500, metrics: { revenue: 65000, occupancy: 72, adr: 250, revpar: 180 }, ranking: 1 },
      { id: 'sub-2', name: 'East Side', listing_count: 400, metrics: { revenue: 55000, occupancy: 68, adr: 220, revpar: 150 }, ranking: 2 },
      { id: 'sub-3', name: 'South Congress', listing_count: 350, metrics: { revenue: 60000, occupancy: 70, adr: 235, revpar: 165 }, ranking: 3 }
    ],
    topRecommendation: { id: 'sub-1', name: 'Downtown', listing_count: 500, metrics: { revenue: 65000, occupancy: 72, adr: 250, revpar: 180 }, ranking: 1 }
  }),
  getCountryMarkets: vi.fn().mockResolvedValue({
    total_count: 3,
    markets: [
      { id: 'm1', name: 'Nashville, TN', location: { state: 'TN' }, market_type: 'urban_metro', listing_count: 8000, scores: { market_score: 85, investability: 82 }, metrics: { revenue: 65000, occupancy: 70 } },
      { id: 'm2', name: 'Austin, TX', location: { state: 'TX' }, market_type: 'urban_metro', listing_count: 5000, scores: { market_score: 78, investability: 75 }, metrics: { revenue: 55000, occupancy: 65 } },
      { id: 'm3', name: 'Denver, CO', location: { state: 'CO' }, market_type: 'urban_metro', listing_count: 6000, scores: { market_score: 76, investability: 73 }, metrics: { revenue: 60000, occupancy: 68 } }
    ]
  }),
  calculateArbitrageFeasibility: vi.fn().mockResolvedValue({
    feasible: true,
    monthly_profit: 1500,
    break_even_occupancy: 45,
    risk_score: 'low'
  }),
  getRentalizerEstimate: vi.fn().mockResolvedValue({
    property: {
      address: '123 Main St, Austin, TX',
      bedrooms: 3,
      bathrooms: 2,
      accommodates: 6,
      zipcode: '78701'
    },
    estimates: {
      annual_revenue: 55000,
      annual_revenue_low: 45000,
      annual_revenue_high: 65000,
      average_daily_rate: 225,
      occupancy_rate: 65
    },
    comps: [
      { title: 'Comp 1', annual_revenue: 52000, occupancy: 63, adr: 220, airbnb_url: 'https://airbnb.com/c1' },
      { title: 'Comp 2', annual_revenue: 58000, occupancy: 67, adr: 230, airbnb_url: 'https://airbnb.com/c2' }
    ],
    monthly_forecast: []
  })
}));

describe('Investment Decision Calculator', () => {
  it('should calculate STRONG BUY for excellent metrics', () => {
    const decision = calculateInvestmentDecision(
      85000,  // High revenue
      75,     // High occupancy
      280,    // High ADR
      50,     // Low competition
      85,     // High market score
      3000    // Reasonable expenses
    );
    
    expect(decision.grade).toBe('A');
    expect(decision.recommendation).toBe('STRONG BUY');
    expect(decision.score).toBeGreaterThanOrEqual(85);
    expect(decision.confidence).toBeGreaterThanOrEqual(85);
    expect(decision.factors.length).toBe(6);
  });
  
  it('should calculate AVOID for poor metrics', () => {
    const decision = calculateInvestmentDecision(
      25000,  // Low revenue
      40,     // Low occupancy
      100,    // Low ADR
      500,    // High competition
      45,     // Low market score
      2500    // Expenses eating into profit
    );
    
    expect(['D', 'F']).toContain(decision.grade);
    expect(['AVOID', 'STRONG AVOID']).toContain(decision.recommendation);
    expect(decision.score).toBeLessThan(60);
    expect(decision.risks.length).toBeGreaterThan(0);
  });
  
  it('should calculate HOLD for moderate metrics', () => {
    const decision = calculateInvestmentDecision(
      50000,  // Moderate revenue
      58,     // Moderate occupancy
      175,    // Moderate ADR
      150,    // Moderate competition
      65,     // Moderate market score
      2200    // Moderate expenses
    );
    
    expect(['B', 'C']).toContain(decision.grade);
    expect(decision.score).toBeGreaterThanOrEqual(55);
    expect(decision.score).toBeLessThan(85);
  });
  
  it('should include all required fields in decision', () => {
    const decision = calculateInvestmentDecision(60000, 65, 200, 100, 70, 2500);
    
    expect(decision).toHaveProperty('score');
    expect(decision).toHaveProperty('grade');
    expect(decision).toHaveProperty('recommendation');
    expect(decision).toHaveProperty('confidence');
    expect(decision).toHaveProperty('factors');
    expect(decision).toHaveProperty('risks');
    expect(decision).toHaveProperty('opportunities');
    expect(decision).toHaveProperty('action_items');
    
    // Check factors structure
    decision.factors.forEach(factor => {
      expect(factor).toHaveProperty('name');
      expect(factor).toHaveProperty('score');
      expect(factor).toHaveProperty('weight');
      expect(factor).toHaveProperty('impact');
      expect(factor).toHaveProperty('reasoning');
    });
  });
});

describe('Enhanced Function Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should execute compare_multiple_markets function', async () => {
    const result = await executeEnhancedFunction('compare_multiple_markets', {
      market_names: ['Austin', 'Nashville'],
      comparison_focus: 'revenue'
    });
    
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('error');
  });
  
  it('should execute analyze_market_submarkets function', async () => {
    const result = await executeEnhancedFunction('analyze_market_submarkets', {
      market_name: 'Austin',
      sort_by: 'revenue',
      limit: 5
    });
    
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('error');
  });
  
  it('should execute find_top_markets_nationwide function', async () => {
    const result = await executeEnhancedFunction('find_top_markets_nationwide', {
      criteria: 'market_score',
      limit: 10
    });
    
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('error');
  });
  
  it('should execute compare_property_configurations function', async () => {
    const result = await executeEnhancedFunction('compare_property_configurations', {
      market_name: 'Austin',
      bedroom_range: [2, 3, 4]
    });
    
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('error');
  });
  
  it('should execute calculate_scenario_analysis function', async () => {
    const result = await executeEnhancedFunction('calculate_scenario_analysis', {
      base_revenue: 55000,
      base_occupancy: 65,
      base_adr: 225,
      monthly_costs: 2500,
      scenarios: ['recession', 'best_case', 'worst_case']
    });
    
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('error');
  });
  
  it('should execute identify_market_gaps function', async () => {
    const result = await executeEnhancedFunction('identify_market_gaps', {
      market_name: 'Austin',
      focus_areas: ['property_type', 'bedroom_count', 'amenities']
    });
    
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('error');
  });
  
  it('should return error for unknown enhanced function', async () => {
    const result = await executeEnhancedFunction('unknown_function', {});
    
    expect(result).toHaveProperty('error');
  });
});

describe('Additional Function Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should execute compare_property_types function', async () => {
    const result = await executeAdditionalFunction('compare_property_types', {
      market_name: 'Austin'
    });
    
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('error');
  });
  
  it('should execute analyze_amenity_correlation function', async () => {
    const result = await executeAdditionalFunction('analyze_amenity_correlation', {
      market_name: 'Austin'
    });
    
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('error');
  });
  
  it('should execute calculate_revenue_percentile function', async () => {
    const result = await executeAdditionalFunction('calculate_revenue_percentile', {
      market_name: 'Austin',
      target_revenue: 55000,
      bedrooms: 3
    });
    
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('error');
  });
  
  it('should execute calculate_seasonality_adjusted_revenue function', async () => {
    const result = await executeAdditionalFunction('calculate_seasonality_adjusted_revenue', {
      market_name: 'Austin',
      base_revenue: 55000,
      start_month: 1
    });
    
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('error');
  });
});

describe('Deal Analysis Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should execute generate_deal_analysis function', async () => {
    const result = await executeDealFunction('generate_deal_analysis', {
      address: '123 Main St, Austin, TX',
      purchase_price: 400000,
      down_payment_percent: 20,
      interest_rate: 7,
      bedrooms: 3,
      bathrooms: 2
    }) as any;
    
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('property');
    expect(result).toHaveProperty('financing');
    expect(result).toHaveProperty('revenue_projections');
    expect(result).toHaveProperty('expenses');
    expect(result).toHaveProperty('returns');
    expect(result).toHaveProperty('investment_decision');
  });
  
  it('should calculate correct financing details', async () => {
    const result = await executeDealFunction('generate_deal_analysis', {
      address: '123 Main St, Austin, TX',
      purchase_price: 400000,
      down_payment_percent: 20
    }) as any;
    
    expect(result.financing.down_payment).toBe(80000);
    expect(result.financing.loan_amount).toBe(320000);
    expect(result.financing.monthly_mortgage).toBeGreaterThan(0);
  });
  
  it('should include investment decision with grade', async () => {
    const result = await executeDealFunction('generate_deal_analysis', {
      address: '123 Main St, Austin, TX',
      purchase_price: 400000
    }) as any;
    
    expect(result.investment_decision).toHaveProperty('grade');
    expect(result.investment_decision).toHaveProperty('recommendation');
    expect(result.investment_decision).toHaveProperty('score');
    expect(['A', 'B', 'C', 'D', 'F']).toContain(result.investment_decision.grade);
  });
});

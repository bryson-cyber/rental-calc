import { describe, it, expect } from 'vitest';
import { getCountryMarkets } from '../airdna';

describe('getCountryMarkets', () => {
  it('should fetch US markets sorted by market score', async () => {
    const response = await getCountryMarkets('us', {
      limit: 10,
      sort_by: 'market_score',
      sort_direction: 'desc',
      min_market_score: 50
    });
    
    expect(response).toBeDefined();
    expect(response.markets).toBeDefined();
    expect(Array.isArray(response.markets)).toBe(true);
  }, 30000);

  it('should return markets with required fields', async () => {
    const response = await getCountryMarkets('us', {
      limit: 5,
      sort_by: 'revenue',
      sort_direction: 'desc'
    });
    
    if (response.markets.length > 0) {
      const market = response.markets[0];
      expect(market.id).toBeDefined();
      expect(market.name).toBeDefined();
      expect(market.scores).toBeDefined();
      expect(market.metrics).toBeDefined();
    }
  }, 30000);
});

describe('Nearby Markets Analysis', () => {
  it('should calculate revenue difference correctly', () => {
    const currentRevenue = 50000;
    const alternativeRevenue = 65000;
    
    const revenueDiff = ((alternativeRevenue - currentRevenue) / currentRevenue) * 100;
    
    expect(revenueDiff).toBe(30); // 30% higher
  });

  it('should identify best alternative based on score and revenue', () => {
    const currentRevenue = 50000;
    const alternatives = [
      { name: 'Market A', market_score: 75, revenue: 55000 },
      { name: 'Market B', market_score: 85, revenue: 60000 },
      { name: 'Market C', market_score: 70, revenue: 70000 }
    ];
    
    // Best alternative: highest score with better revenue than current
    const bestAlt = alternatives.reduce((best, current) => 
      (current.market_score > best.market_score && current.revenue > currentRevenue) ? current : best,
      alternatives[0]
    );
    
    expect(bestAlt.name).toBe('Market B'); // Highest score with revenue > current
  });

  it('should generate appropriate recommendation', () => {
    const currentRevenue = 50000;
    const bestAlt = { name: 'Denver, CO', revenue: 65000, market_score: 80 };
    
    const hasGoodAlternative = bestAlt.revenue > currentRevenue * 1.2;
    const revenueDiff = ((bestAlt.revenue - currentRevenue) / currentRevenue) * 100;
    
    const recommendation = hasGoodAlternative
      ? `Consider ${bestAlt.name} - it has ${revenueDiff.toFixed(0)}% higher revenue potential`
      : 'Current market is competitive';
    
    expect(hasGoodAlternative).toBe(true);
    expect(recommendation).toContain('Denver, CO');
    expect(recommendation).toContain('30%');
  });

  it('should handle empty alternatives gracefully', () => {
    const alternatives: any[] = [];
    
    const bestAlt = alternatives.length > 0 
      ? alternatives.reduce((best, current) => current.market_score > best.market_score ? current : best, alternatives[0])
      : null;
    
    expect(bestAlt).toBeNull();
  });

  it('should filter out current market from alternatives', () => {
    const currentMarketName = 'Austin, TX';
    const allMarkets = [
      { name: 'Austin, TX', market_score: 75 },
      { name: 'Denver, CO', market_score: 80 },
      { name: 'Nashville, TN', market_score: 78 }
    ];
    
    const alternatives = allMarkets.filter(
      m => !m.name.toLowerCase().includes(currentMarketName.toLowerCase().split(',')[0])
    );
    
    expect(alternatives.length).toBe(2);
    expect(alternatives.find(m => m.name === 'Austin, TX')).toBeUndefined();
  });
});

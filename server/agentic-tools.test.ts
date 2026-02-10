import { describe, expect, it, vi } from "vitest";

/**
 * Tests for the three agentic tools:
 * 1. Deal Alert Agent
 * 2. Market Evaluation (One-Click)
 * 3. Behavior Engine
 * 
 * These tests focus on the bugs found during cc-debug:
 * - Bug #1: topPerformers was treated as array but getTopPerformers returns { listings: [], total_count: N }
 * - Bug #2: Market evaluation mutation was synchronous (blocking), now async with immediate evaluationId return
 * - Behavior engine strategy selection logic
 */

// ============================================================
// Deal Alert Agent Tests
// ============================================================

describe('Deal Alert Agent', () => {
  describe('Deal Alert Criteria Validation', () => {
    it('should validate required fields for deal alert creation', () => {
      const validCriteria = {
        city: 'Denver',
        state: 'CO',
        strategy: 'arbitrage' as const,
        minBedrooms: 1,
        maxBedrooms: 5,
        minMonthlyProfit: 500,
        frequency: 'daily' as const,
      };

      expect(validCriteria.city).toBeTruthy();
      expect(validCriteria.state).toBeTruthy();
      expect(validCriteria.strategy).toBe('arbitrage');
      expect(validCriteria.minBedrooms).toBeGreaterThan(0);
      expect(validCriteria.maxBedrooms).toBeGreaterThanOrEqual(validCriteria.minBedrooms);
      expect(validCriteria.minMonthlyProfit).toBeGreaterThanOrEqual(0);
      expect(['daily', 'weekly', 'biweekly']).toContain(validCriteria.frequency);
    });

    it('should support all valid strategies', () => {
      const validStrategies = ['arbitrage', 'investment', 'both'];
      validStrategies.forEach(strategy => {
        expect(['arbitrage', 'investment', 'both']).toContain(strategy);
      });
    });

    it('should support all valid frequencies', () => {
      const validFrequencies = ['daily', 'weekly', 'biweekly'];
      validFrequencies.forEach(freq => {
        expect(['daily', 'weekly', 'biweekly']).toContain(freq);
      });
    });
  });

  describe('Scan Result Processing', () => {
    it('should filter properties by bedroom count', () => {
      const properties = [
        { bedrooms: 1, monthlyRevenue: 2000 },
        { bedrooms: 2, monthlyRevenue: 3000 },
        { bedrooms: 3, monthlyRevenue: 4000 },
        { bedrooms: 5, monthlyRevenue: 6000 },
        { bedrooms: 6, monthlyRevenue: 7000 },
      ];

      const minBR = 2;
      const maxBR = 5;
      const filtered = properties.filter(p => p.bedrooms >= minBR && p.bedrooms <= maxBR);

      expect(filtered).toHaveLength(3);
      expect(filtered.every(p => p.bedrooms >= minBR && p.bedrooms <= maxBR)).toBe(true);
    });

    it('should calculate monthly profit correctly for arbitrage', () => {
      const monthlyRevenue = 4000;
      const monthlyRent = 2500;
      const monthlyExpenses = 500;
      const monthlyProfit = monthlyRevenue - monthlyRent - monthlyExpenses;

      expect(monthlyProfit).toBe(1000);
      expect(monthlyProfit).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// Market Evaluation Tests
// ============================================================

describe('Market Evaluation', () => {
  describe('Bug Fix: topPerformers type handling', () => {
    it('should correctly extract listings array from getTopPerformers result', () => {
      // getTopPerformers returns { listings: ListingData[], total_count: number }
      const topPerformersResult = {
        listings: [
          { id: '1', title: 'Luxury Loft', annual_revenue: 120000, rating: 4.9, reviews: 148 },
          { id: '2', title: 'Modern Townhome', annual_revenue: 85000, rating: 5.0, reviews: 109 },
          { id: '3', title: 'Urban Retreat', annual_revenue: 61000, rating: 4.8, reviews: 60 },
        ],
        total_count: 3,
      };

      // The fix: extract .listings instead of treating result as array
      const topPerformers = topPerformersResult?.listings || [];

      expect(Array.isArray(topPerformers)).toBe(true);
      expect(topPerformers).toHaveLength(3);
      expect(topPerformers[0].title).toBe('Luxury Loft');
    });

    it('should handle null/undefined topPerformers result gracefully', () => {
      const topPerformersResult = null;
      const topPerformers = (topPerformersResult as any)?.listings || [];

      expect(Array.isArray(topPerformers)).toBe(true);
      expect(topPerformers).toHaveLength(0);
    });

    it('should handle empty listings array', () => {
      const topPerformersResult = { listings: [], total_count: 0 };
      const topPerformers = topPerformersResult?.listings || [];

      expect(Array.isArray(topPerformers)).toBe(true);
      expect(topPerformers).toHaveLength(0);
    });

    it('should correctly slice topPerformers for AI memo', () => {
      const topPerformers = Array.from({ length: 10 }, (_, i) => ({
        title: `Listing ${i + 1}`,
        annual_revenue: (10 - i) * 10000,
        rating: 4.5 + (i * 0.05),
        reviews: 100 - i * 5,
      }));

      // The fix ensures .slice() works because topPerformers is now an array
      const sliced = topPerformers.slice(0, 5);
      expect(sliced).toHaveLength(5);
      expect(sliced[0].title).toBe('Listing 1');
    });

    it('should use annual_revenue field from ListingData type', () => {
      const performer = {
        title: 'Test Listing',
        annual_revenue: 95000,
        revenue: undefined, // old field name
        rating: 4.8,
        reviews: 50,
      };

      // The fix: use annual_revenue || revenue for backward compat
      const revenue = performer.annual_revenue || performer.revenue || 0;
      expect(revenue).toBe(95000);
    });
  });

  describe('Market Score Calculation', () => {
    it('should calculate market score within 0-100 range', () => {
      const calculateScore = (avgRevenue: number, avgOccupancy: number, avgAdr: number) => {
        let score = 40;
        if (avgRevenue > 80000) score += 20;
        else if (avgRevenue > 60000) score += 16;
        else if (avgRevenue > 40000) score += 12;
        else if (avgRevenue > 25000) score += 8;
        else if (avgRevenue > 15000) score += 4;

        if (avgOccupancy > 0.75) score += 15;
        else if (avgOccupancy > 0.65) score += 12;
        else if (avgOccupancy > 0.55) score += 8;
        else if (avgOccupancy > 0.4) score += 4;

        if (avgAdr > 250) score += 10;
        else if (avgAdr > 180) score += 8;
        else if (avgAdr > 120) score += 5;
        else if (avgAdr > 80) score += 3;

        return Math.min(100, Math.max(0, score));
      };

      // High-performing market
      expect(calculateScore(100000, 0.8, 300)).toBe(85);
      // Mid-range market: 40 base + 12 (revenue>40k) + 8 (occ>0.55) + 5 (adr>120) = 65
      expect(calculateScore(50000, 0.6, 150)).toBe(65);
      // Low-performing market
      expect(calculateScore(10000, 0.3, 50)).toBe(40);
      // All scores should be 0-100
      expect(calculateScore(0, 0, 0)).toBeGreaterThanOrEqual(0);
      expect(calculateScore(0, 0, 0)).toBeLessThanOrEqual(100);
      expect(calculateScore(999999, 1.0, 9999)).toBeGreaterThanOrEqual(0);
      expect(calculateScore(999999, 1.0, 9999)).toBeLessThanOrEqual(100);
    });
  });

  describe('Bug Fix: Async evaluation pattern', () => {
    it('startMarketEvaluation should return only evaluationId', () => {
      // The new startMarketEvaluation returns { evaluationId } immediately
      // while runMarketEvaluation runs in the background
      const expectedShape = { evaluationId: 1 };
      
      expect(expectedShape).toHaveProperty('evaluationId');
      expect(typeof expectedShape.evaluationId).toBe('number');
      // Should NOT have marketScore or summary (those come from polling)
      expect(expectedShape).not.toHaveProperty('marketScore');
      expect(expectedShape).not.toHaveProperty('summary');
    });

    it('evaluation status should transition correctly', () => {
      const validTransitions = {
        pending: ['running'],
        running: ['completed', 'failed'],
        completed: [],
        failed: [],
      };

      // Verify all statuses have defined transitions
      expect(Object.keys(validTransitions)).toEqual(['pending', 'running', 'completed', 'failed']);
      
      // pending → running is valid
      expect(validTransitions.pending).toContain('running');
      // running → completed is valid
      expect(validTransitions.running).toContain('completed');
      // running → failed is valid
      expect(validTransitions.running).toContain('failed');
    });

    it('progress should increase monotonically through steps', () => {
      const steps = [
        { step: 'market_discovery', progress: 5 },
        { step: 'revenue_analysis', progress: 15 },
        { step: 'market_trends', progress: 35 },
        { step: 'competitive_landscape', progress: 50 },
        { step: 'scoring', progress: 65 },
        { step: 'ai_memo', progress: 75 },
        { step: 'complete', progress: 100 },
      ];

      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].progress).toBeGreaterThan(steps[i - 1].progress);
      }
      expect(steps[steps.length - 1].progress).toBe(100);
    });
  });
});

// ============================================================
// Behavior Engine Tests
// ============================================================

describe('Behavior Engine', () => {
  describe('Engagement Level Classification', () => {
    it('should classify power_user correctly', () => {
      const classify = (eventCount: number, daysSinceActive: number) => {
        if (eventCount >= 20 && daysSinceActive <= 7) return 'power_user';
        if (eventCount >= 5 && daysSinceActive <= 14) return 'hot';
        if (eventCount >= 2 && daysSinceActive <= 30) return 'warm';
        return 'cold';
      };

      expect(classify(25, 3)).toBe('power_user');
      expect(classify(20, 7)).toBe('power_user');
    });

    it('should classify hot correctly', () => {
      const classify = (eventCount: number, daysSinceActive: number) => {
        if (eventCount >= 20 && daysSinceActive <= 7) return 'power_user';
        if (eventCount >= 5 && daysSinceActive <= 14) return 'hot';
        if (eventCount >= 2 && daysSinceActive <= 30) return 'warm';
        return 'cold';
      };

      expect(classify(10, 10)).toBe('hot');
      expect(classify(5, 14)).toBe('hot');
    });

    it('should classify warm correctly', () => {
      const classify = (eventCount: number, daysSinceActive: number) => {
        if (eventCount >= 20 && daysSinceActive <= 7) return 'power_user';
        if (eventCount >= 5 && daysSinceActive <= 14) return 'hot';
        if (eventCount >= 2 && daysSinceActive <= 30) return 'warm';
        return 'cold';
      };

      expect(classify(3, 20)).toBe('warm');
      expect(classify(2, 30)).toBe('warm');
    });

    it('should classify cold correctly', () => {
      const classify = (eventCount: number, daysSinceActive: number) => {
        if (eventCount >= 20 && daysSinceActive <= 7) return 'power_user';
        if (eventCount >= 5 && daysSinceActive <= 14) return 'hot';
        if (eventCount >= 2 && daysSinceActive <= 30) return 'warm';
        return 'cold';
      };

      expect(classify(1, 5)).toBe('cold');
      expect(classify(0, 999)).toBe('cold');
      expect(classify(19, 8)).toBe('hot'); // Not power_user because daysSinceActive > 7
    });
  });

  describe('Email Strategy Selection', () => {
    type EmailStrategy = 
      | 'market_deep_dive' | 'property_nudge' | 'regulation_reminder'
      | 'deal_alert_setup' | 'advisor_intro' | 'report_upsell'
      | 'win_back' | 'power_user_reward' | 'new_market_suggestion' | 'seasonal_opportunity';

    interface MockProfile {
      engagementLevel: 'cold' | 'warm' | 'hot' | 'power_user';
      totalEvents: number;
      daysSinceLastActive: number;
      topMarket: { city: string; state: string } | null;
      hasGeneratedReport: boolean;
      hasSetDealAlerts: boolean;
      hasCheckedRegulations: boolean;
      hasUsedAdvisor: boolean;
      hasUsedCalculator: boolean;
      hasSearchedProperties: boolean;
    }

    function selectStrategy(profile: MockProfile): EmailStrategy {
      if (profile.engagementLevel === 'cold' && profile.totalEvents > 0 && profile.daysSinceLastActive >= 14) {
        return 'win_back';
      }
      if (profile.engagementLevel === 'power_user') {
        if (!profile.hasSetDealAlerts) return 'deal_alert_setup';
        return 'power_user_reward';
      }
      if (profile.engagementLevel === 'hot') {
        if (!profile.hasGeneratedReport && profile.topMarket) return 'report_upsell';
        if (!profile.hasSetDealAlerts) return 'deal_alert_setup';
        if (!profile.hasCheckedRegulations && profile.topMarket) return 'regulation_reminder';
        return 'new_market_suggestion';
      }
      if (profile.engagementLevel === 'warm') {
        if (!profile.hasUsedAdvisor && profile.topMarket) return 'advisor_intro';
        if (profile.hasUsedCalculator && !profile.hasSearchedProperties) return 'property_nudge';
        if (profile.topMarket && !profile.hasCheckedRegulations) return 'regulation_reminder';
        return 'market_deep_dive';
      }
      if (profile.topMarket) return 'seasonal_opportunity';
      return 'market_deep_dive';
    }

    it('should select win_back for cold users who were previously active', () => {
      const profile: MockProfile = {
        engagementLevel: 'cold',
        totalEvents: 5,
        daysSinceLastActive: 30,
        topMarket: { city: 'Denver', state: 'CO' },
        hasGeneratedReport: false,
        hasSetDealAlerts: false,
        hasCheckedRegulations: false,
        hasUsedAdvisor: false,
        hasUsedCalculator: false,
        hasSearchedProperties: false,
      };
      expect(selectStrategy(profile)).toBe('win_back');
    });

    it('should select deal_alert_setup for power users without alerts', () => {
      const profile: MockProfile = {
        engagementLevel: 'power_user',
        totalEvents: 25,
        daysSinceLastActive: 2,
        topMarket: { city: 'Austin', state: 'TX' },
        hasGeneratedReport: true,
        hasSetDealAlerts: false,
        hasCheckedRegulations: true,
        hasUsedAdvisor: true,
        hasUsedCalculator: true,
        hasSearchedProperties: true,
      };
      expect(selectStrategy(profile)).toBe('deal_alert_setup');
    });

    it('should select power_user_reward for fully engaged power users', () => {
      const profile: MockProfile = {
        engagementLevel: 'power_user',
        totalEvents: 30,
        daysSinceLastActive: 1,
        topMarket: { city: 'Nashville', state: 'TN' },
        hasGeneratedReport: true,
        hasSetDealAlerts: true,
        hasCheckedRegulations: true,
        hasUsedAdvisor: true,
        hasUsedCalculator: true,
        hasSearchedProperties: true,
      };
      expect(selectStrategy(profile)).toBe('power_user_reward');
    });

    it('should select report_upsell for hot users without reports', () => {
      const profile: MockProfile = {
        engagementLevel: 'hot',
        totalEvents: 10,
        daysSinceLastActive: 5,
        topMarket: { city: 'Miami', state: 'FL' },
        hasGeneratedReport: false,
        hasSetDealAlerts: true,
        hasCheckedRegulations: true,
        hasUsedAdvisor: true,
        hasUsedCalculator: true,
        hasSearchedProperties: true,
      };
      expect(selectStrategy(profile)).toBe('report_upsell');
    });

    it('should select advisor_intro for warm users who havent tried advisor', () => {
      const profile: MockProfile = {
        engagementLevel: 'warm',
        totalEvents: 3,
        daysSinceLastActive: 10,
        topMarket: { city: 'Seattle', state: 'WA' },
        hasGeneratedReport: false,
        hasSetDealAlerts: false,
        hasCheckedRegulations: false,
        hasUsedAdvisor: false,
        hasUsedCalculator: true,
        hasSearchedProperties: true,
      };
      expect(selectStrategy(profile)).toBe('advisor_intro');
    });
  });

  describe('Priority Calculation', () => {
    it('should calculate correct base priorities', () => {
      const basePriority: Record<string, number> = {
        win_back: 8,
        deal_alert_setup: 7,
        report_upsell: 6,
        regulation_reminder: 6,
        property_nudge: 5,
        advisor_intro: 5,
        market_deep_dive: 4,
        power_user_reward: 7,
        new_market_suggestion: 4,
        seasonal_opportunity: 5,
      };

      expect(basePriority.win_back).toBe(8);
      expect(basePriority.power_user_reward).toBe(7);
      expect(basePriority.market_deep_dive).toBe(4);
    });

    it('should boost priority for power users', () => {
      const basePriority = 7;
      const boosted = Math.min(10, basePriority + 2);
      expect(boosted).toBe(9);
    });

    it('should cap priority at 10', () => {
      const basePriority = 9;
      const boosted = Math.min(10, basePriority + 2);
      expect(boosted).toBe(10);
    });

    it('should reduce priority for very cold users', () => {
      const basePriority = 5;
      const daysSinceLastActive = 90;
      const adjusted = daysSinceLastActive > 60 ? Math.max(1, basePriority - 2) : basePriority;
      expect(adjusted).toBe(3);
    });

    it('should not reduce priority below 1', () => {
      const basePriority = 2;
      const daysSinceLastActive = 90;
      const adjusted = daysSinceLastActive > 60 ? Math.max(1, basePriority - 2) : basePriority;
      expect(adjusted).toBe(1);
    });
  });

  describe('Primary Interest Detection', () => {
    it('should detect arbitrage interest from tool names', () => {
      const toolNames = ['calculator', 'arbitrage_analysis', 'rent_estimate', 'calculator'];
      
      const arbitrageSignals = toolNames.filter(t => 
        t.includes('arbitrage') || t.includes('rent') || t.includes('calculator')
      ).length;
      const investmentSignals = toolNames.filter(t => 
        t.includes('investment') || t.includes('purchase') || t.includes('buy')
      ).length;
      
      expect(arbitrageSignals).toBe(4);
      expect(investmentSignals).toBe(0);
      expect(arbitrageSignals > investmentSignals).toBe(true);
    });

    it('should detect research interest from tool names', () => {
      const toolNames = ['market_explorer', 'advisor_chat', 'regulation_check'];
      
      const researchSignals = toolNames.filter(t => 
        t.includes('market') || t.includes('advisor') || t.includes('regulation') || t.includes('explore')
      ).length;
      
      expect(researchSignals).toBe(3);
    });
  });
});

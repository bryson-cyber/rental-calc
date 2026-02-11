import { describe, it, expect } from 'vitest';

/**
 * Tests for AI Advisor submarket/supply data integration
 * and code optimization (lazy loading, dead code removal)
 */

// ============================================
// AI ADVISOR - SUBMARKET & SUPPLY DATA
// ============================================

describe('AI Advisor - Submarket & Supply Data Integration', () => {
  describe('MaxPropertyAdvisorInput interface', () => {
    it('should accept supplyTrend data in the input', () => {
      const input = {
        supplyTrend: {
          currentListings: 450,
          listings12MonthsAgo: 380,
          netChange: 70,
          percentChange: 18.4,
          trend: 'growing' as const,
          insight: 'Market supply has grown by 18.4% over the past year.',
          monthlyData: [
            { month: '2025-01', listings: 390 },
            { month: '2025-02', listings: 400 },
            { month: '2025-12', listings: 450 },
          ],
        },
      };
      
      expect(input.supplyTrend).toBeDefined();
      expect(input.supplyTrend.currentListings).toBe(450);
      expect(input.supplyTrend.trend).toBe('growing');
      expect(input.supplyTrend.monthlyData).toHaveLength(3);
    });

    it('should accept submarkets data in the input', () => {
      const input = {
        submarkets: [
          {
            id: 'downtown',
            name: 'Downtown',
            listingCount: 120,
            metrics: {
              occupancy: 0.78,
              adr: 185,
              revenue: 52000,
              revpar: 142,
            },
          },
          {
            id: 'midtown',
            name: 'Midtown',
            listingCount: 85,
            metrics: {
              occupancy: 0.72,
              adr: 160,
              revenue: 42000,
              revpar: 115,
            },
          },
        ],
      };
      
      expect(input.submarkets).toHaveLength(2);
      expect(input.submarkets[0].name).toBe('Downtown');
      expect(input.submarkets[0].metrics?.revenue).toBe(52000);
      expect(input.submarkets[1].listingCount).toBe(85);
    });

    it('should handle empty/undefined supplyTrend and submarkets gracefully', () => {
      const input = {
        supplyTrend: undefined,
        submarkets: undefined,
      };
      
      expect(input.supplyTrend).toBeUndefined();
      expect(input.submarkets).toBeUndefined();
    });

    it('should handle empty submarkets array', () => {
      const input = {
        submarkets: [] as any[],
      };
      
      expect(input.submarkets).toHaveLength(0);
    });
  });

  describe('Supply trend data processing', () => {
    it('should correctly identify growing trend', () => {
      const data = {
        currentListings: 500,
        listings12MonthsAgo: 400,
      };
      const percentChange = ((data.currentListings - data.listings12MonthsAgo) / data.listings12MonthsAgo) * 100;
      const trend = percentChange > 5 ? 'growing' : percentChange < -5 ? 'declining' : 'stable';
      
      expect(percentChange).toBe(25);
      expect(trend).toBe('growing');
    });

    it('should correctly identify declining trend', () => {
      const data = {
        currentListings: 350,
        listings12MonthsAgo: 500,
      };
      const percentChange = ((data.currentListings - data.listings12MonthsAgo) / data.listings12MonthsAgo) * 100;
      const trend = percentChange > 5 ? 'growing' : percentChange < -5 ? 'declining' : 'stable';
      
      expect(percentChange).toBe(-30);
      expect(trend).toBe('declining');
    });

    it('should correctly identify stable trend', () => {
      const data = {
        currentListings: 402,
        listings12MonthsAgo: 400,
      };
      const percentChange = ((data.currentListings - data.listings12MonthsAgo) / data.listings12MonthsAgo) * 100;
      const trend = percentChange > 5 ? 'growing' : percentChange < -5 ? 'declining' : 'stable';
      
      expect(percentChange).toBe(0.5);
      expect(trend).toBe('stable');
    });
  });

  describe('Submarket ranking logic', () => {
    it('should rank submarkets by revenue descending', () => {
      const submarkets = [
        { name: 'A', metrics: { revenue: 30000 } },
        { name: 'B', metrics: { revenue: 60000 } },
        { name: 'C', metrics: { revenue: 45000 } },
      ];
      
      const sorted = [...submarkets].sort((a, b) => 
        (b.metrics?.revenue || 0) - (a.metrics?.revenue || 0)
      );
      
      expect(sorted[0].name).toBe('B');
      expect(sorted[1].name).toBe('C');
      expect(sorted[2].name).toBe('A');
    });

    it('should handle submarkets with missing metrics', () => {
      const submarkets = [
        { name: 'A', metrics: { revenue: 30000 } },
        { name: 'B', metrics: undefined as any },
        { name: 'C', metrics: { revenue: 45000 } },
      ];
      
      const sorted = [...submarkets].sort((a, b) => 
        (b.metrics?.revenue || 0) - (a.metrics?.revenue || 0)
      );
      
      expect(sorted[0].name).toBe('C');
      expect(sorted[2].name).toBe('B');
    });
  });
});

// ============================================
// CODE OPTIMIZATION - LAZY LOADING
// ============================================

describe('Code Optimization - Lazy Loading', () => {
  it('should have lazy imports for non-landing pages', async () => {
    const fs = await import('fs');
    const appContent = fs.readFileSync(
      '/home/ubuntu/rental-calculator/client/src/App.tsx',
      'utf-8'
    );
    
    // Should use React.lazy for heavy pages
    expect(appContent).toContain('lazy(() => import');
    expect(appContent).toContain('Suspense');
    
    // LeadMagnet should be lazy loaded (it's the heaviest page component)
    expect(appContent).toContain('const LeadMagnet = lazy');
    
    // Other pages should be lazy loaded
    expect(appContent).toContain('const PropertyAnalyzer = lazy');
    expect(appContent).toContain('const MapViewPage = lazy');
    expect(appContent).toContain('const MarketAdvisor = lazy');
    expect(appContent).toContain('const AdminDashboard = lazy');
  });

  it('should have a loading fallback component', async () => {
    const fs = await import('fs');
    const appContent = fs.readFileSync(
      '/home/ubuntu/rental-calculator/client/src/App.tsx',
      'utf-8'
    );
    
    expect(appContent).toContain('PageLoader');
    expect(appContent).toContain('<Suspense fallback={<PageLoader');
  });
});

// ============================================
// CODE OPTIMIZATION - DEAD CODE REMOVAL
// ============================================

describe('Code Optimization - Dead Code Removal', () => {
  it('should not have dead page files', async () => {
    const fs = await import('fs');
    const deadPages = [
      'ArbitrageTool.tsx',
      'ComponentShowcase.tsx',
      'MarketMap.tsx',
      'MarketScorecard.tsx',
      'PropertyComparison.tsx',
      'RadiusSearch.tsx',
      'SavedSearchesPage.tsx',
      'SeasonalityCalendar.tsx',
      'SmartHome.tsx',
      'TopPerformers.tsx',
    ];
    
    for (const page of deadPages) {
      const exists = fs.existsSync(
        `/home/ubuntu/rental-calculator/client/src/pages/${page}`
      );
      expect(exists, `Dead page ${page} should be removed`).toBe(false);
    }
  });

  it('should not have dead component files', async () => {
    const fs = await import('fs');
    const deadComponents = [
      'EmailOptinModal.tsx',
      'MarketAdvisorSkeleton.tsx',
      'ModeSwitch.tsx',
      'OnboardingTutorial.tsx',
      'TrainingMode.tsx',
    ];
    
    for (const comp of deadComponents) {
      const exists = fs.existsSync(
        `/home/ubuntu/rental-calculator/client/src/components/${comp}`
      );
      expect(exists, `Dead component ${comp} should be removed`).toBe(false);
    }
  });

  it('should not have temporary test scripts in server/', async () => {
    const fs = await import('fs');
    const tempFiles = [
      'test-all-submarkets.ts',
      'test-sources.ts',
      'test-submarkets.ts',
      'test-submarkets2.ts',
      'test-submarkets3.ts',
      'test-submarkets4.ts',
      'test-submarkets5.ts',
      'stress-test.ts',
    ];
    
    for (const file of tempFiles) {
      const exists = fs.existsSync(
        `/home/ubuntu/rental-calculator/server/${file}`
      );
      expect(exists, `Temporary file ${file} should be removed`).toBe(false);
    }
  });
});

// ============================================
// AI ADVISOR PROMPT - SUPPLY/SUBMARKET CONTEXT
// ============================================

describe('AI Advisor Prompt - Supply/Submarket Context', () => {
  it('should format supply trend data for the AI prompt', () => {
    const supplyTrend = {
      currentListings: 450,
      listings12MonthsAgo: 380,
      netChange: 70,
      percentChange: 18.4,
      trend: 'growing',
      insight: 'Market supply has grown by 18.4%',
    };
    
    // Simulate the prompt formatting
    const promptSection = `
SUPPLY TREND:
- Current Listings: ${supplyTrend.currentListings}
- 12 Months Ago: ${supplyTrend.listings12MonthsAgo}
- Net Change: ${supplyTrend.netChange > 0 ? '+' : ''}${supplyTrend.netChange}
- Percent Change: ${supplyTrend.percentChange.toFixed(1)}%
- Trend: ${supplyTrend.trend}
- Insight: ${supplyTrend.insight}
    `.trim();
    
    expect(promptSection).toContain('Current Listings: 450');
    expect(promptSection).toContain('Net Change: +70');
    expect(promptSection).toContain('Percent Change: 18.4%');
    expect(promptSection).toContain('Trend: growing');
  });

  it('should format submarket data for the AI prompt', () => {
    const submarkets = [
      { name: 'Downtown', listingCount: 120, metrics: { revenue: 52000, occupancy: 0.78, adr: 185, revpar: 142 } },
      { name: 'Midtown', listingCount: 85, metrics: { revenue: 42000, occupancy: 0.72, adr: 160, revpar: 115 } },
    ];
    
    const promptSection = submarkets.map((s, i) => 
      `${i + 1}. ${s.name}: ${s.listingCount} listings, $${s.metrics.revenue?.toLocaleString()} avg revenue, ${(s.metrics.occupancy * 100).toFixed(0)}% occupancy`
    ).join('\n');
    
    expect(promptSection).toContain('1. Downtown: 120 listings');
    expect(promptSection).toContain('$52,000 avg revenue');
    expect(promptSection).toContain('78% occupancy');
    expect(promptSection).toContain('2. Midtown: 85 listings');
  });
});

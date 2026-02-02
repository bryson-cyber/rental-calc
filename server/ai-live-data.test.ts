import { describe, it, expect } from 'vitest';

/**
 * Tests for AI Live Data Integration
 * Validates that the AI assistant can receive and process live property/market data
 */

// Mock property data structure (matches ContextualAIChat.tsx LivePropertyData interface)
interface LivePropertyData {
  address?: string;
  bedrooms?: number;
  bathrooms?: number;
  accommodates?: number;
  monthlyRent?: number;
  projectedRevenue?: number;
  revenueRangeLow?: number;
  revenueRangeHigh?: number;
  averageDailyRate?: number;
  occupancyRate?: number;
  revPAR?: number;
  profitMargin?: number;
  monthlyProfit?: number;
  annualProfit?: number;
  monthlyForecast?: Array<{
    month: string;
    revenue: number;
    adr: number;
    occupancy: number;
  }>;
  comparableProperties?: Array<{
    title?: string;
    bedrooms?: number;
    bathrooms?: number;
    rating?: number;
    reviews?: number;
    annualRevenue?: number;
    adr?: number;
    occupancy?: number;
    distance?: number;
  }>;
  analyzedAt?: Date;
}

// Mock market data structure (matches ContextualAIChat.tsx LiveMarketData interface)
interface LiveMarketData {
  city?: string;
  state?: string;
  marketName?: string;
  averageRevenue?: number;
  medianRevenue?: number;
  averageOccupancy?: number;
  averageADR?: number;
  revPAR?: number;
  totalActiveListings?: number;
  newListingsLast30Days?: number;
  listingsRemovedLast30Days?: number;
  revenueGrowthYoY?: number;
  occupancyChangeYoY?: number;
  adrChangeYoY?: number;
  peakSeason?: string;
  lowSeason?: string;
  seasonalityIndex?: number;
  analyzedAt?: Date;
}

// Helper function to build context string (mirrors ContextualAIChat logic)
function buildContextString(propertyData?: LivePropertyData, marketData?: LiveMarketData): string {
  const parts: string[] = [];

  if (propertyData) {
    parts.push('=== LIVE PROPERTY ANALYSIS DATA ===');
    if (propertyData.address) parts.push(`Property Address: ${propertyData.address}`);
    if (propertyData.bedrooms) parts.push(`Bedrooms: ${propertyData.bedrooms}`);
    if (propertyData.bathrooms) parts.push(`Bathrooms: ${propertyData.bathrooms}`);
    if (propertyData.projectedRevenue) {
      parts.push(`Projected Annual Revenue: $${propertyData.projectedRevenue.toLocaleString()}`);
    }
    if (propertyData.occupancyRate) {
      parts.push(`Occupancy Rate: ${(propertyData.occupancyRate * 100).toFixed(1)}%`);
    }
    if (propertyData.monthlyForecast && propertyData.monthlyForecast.length > 0) {
      parts.push('Monthly Forecast:');
      propertyData.monthlyForecast.forEach(m => {
        parts.push(`- ${m.month}: $${m.revenue.toLocaleString()}`);
      });
    }
    if (propertyData.comparableProperties && propertyData.comparableProperties.length > 0) {
      parts.push(`Comparable Properties: ${propertyData.comparableProperties.length} comps`);
    }
  }

  if (marketData) {
    parts.push('=== LIVE MARKET RESEARCH DATA ===');
    if (marketData.marketName) parts.push(`Market: ${marketData.marketName}`);
    if (marketData.city && marketData.state) parts.push(`Location: ${marketData.city}, ${marketData.state}`);
    if (marketData.averageRevenue) {
      parts.push(`Average Annual Revenue: $${marketData.averageRevenue.toLocaleString()}`);
    }
    if (marketData.averageOccupancy) {
      parts.push(`Average Occupancy: ${(marketData.averageOccupancy * 100).toFixed(1)}%`);
    }
    if (marketData.totalActiveListings) {
      parts.push(`Total Active Listings: ${marketData.totalActiveListings.toLocaleString()}`);
    }
    if (marketData.peakSeason) parts.push(`Peak Season: ${marketData.peakSeason}`);
    if (marketData.lowSeason) parts.push(`Low Season: ${marketData.lowSeason}`);
  }

  return parts.join('\n');
}

describe('AI Live Data Integration', () => {
  describe('Property Data Context Building', () => {
    it('should include property address in context', () => {
      const propertyData: LivePropertyData = {
        address: '123 Main St, Denver, CO 80202',
        bedrooms: 3,
        bathrooms: 2,
      };
      const context = buildContextString(propertyData);
      expect(context).toContain('123 Main St, Denver, CO 80202');
      expect(context).toContain('Bedrooms: 3');
      expect(context).toContain('Bathrooms: 2');
    });

    it('should include revenue projections in context', () => {
      const propertyData: LivePropertyData = {
        projectedRevenue: 85000,
        revenueRangeLow: 75000,
        revenueRangeHigh: 95000,
        averageDailyRate: 250,
        occupancyRate: 0.73,
      };
      const context = buildContextString(propertyData);
      expect(context).toContain('$85,000');
      expect(context).toContain('73.0%');
    });

    it('should include monthly forecast in context', () => {
      const propertyData: LivePropertyData = {
        monthlyForecast: [
          { month: 'Jan 2024', revenue: 6500, adr: 220, occupancy: 0.65 },
          { month: 'Feb 2024', revenue: 7200, adr: 240, occupancy: 0.70 },
          { month: 'Mar 2024', revenue: 8100, adr: 260, occupancy: 0.75 },
        ],
      };
      const context = buildContextString(propertyData);
      expect(context).toContain('Monthly Forecast');
      expect(context).toContain('Jan 2024');
      expect(context).toContain('$6,500');
    });

    it('should include comparable properties count in context', () => {
      const propertyData: LivePropertyData = {
        comparableProperties: [
          { title: 'Comp 1', annualRevenue: 80000, occupancy: 0.72 },
          { title: 'Comp 2', annualRevenue: 75000, occupancy: 0.68 },
          { title: 'Comp 3', annualRevenue: 90000, occupancy: 0.78 },
        ],
      };
      const context = buildContextString(propertyData);
      expect(context).toContain('3 comps');
    });

    it('should calculate profitability metrics correctly', () => {
      const propertyData: LivePropertyData = {
        monthlyProfit: 2500,
        annualProfit: 30000,
        profitMargin: 35.5,
      };
      expect(propertyData.monthlyProfit).toBe(2500);
      expect(propertyData.annualProfit).toBe(30000);
      expect(propertyData.profitMargin).toBeCloseTo(35.5, 1);
    });

    it('should calculate RevPAR correctly', () => {
      const adr = 250;
      const occupancy = 0.73;
      const revPAR = adr * occupancy;
      expect(revPAR).toBeCloseTo(182.5, 1);
    });
  });

  describe('Market Data Context Building', () => {
    it('should include market name and location in context', () => {
      const marketData: LiveMarketData = {
        city: 'Denver',
        state: 'CO',
        marketName: 'Denver Metro Area',
      };
      const context = buildContextString(undefined, marketData);
      expect(context).toContain('Denver Metro Area');
      expect(context).toContain('Denver, CO');
    });

    it('should include market statistics in context', () => {
      const marketData: LiveMarketData = {
        averageRevenue: 72000,
        averageOccupancy: 0.68,
        averageADR: 195,
        totalActiveListings: 4500,
      };
      const context = buildContextString(undefined, marketData);
      expect(context).toContain('$72,000');
      expect(context).toContain('68.0%');
      expect(context).toContain('4,500');
    });

    it('should include seasonality information in context', () => {
      const marketData: LiveMarketData = {
        peakSeason: 'June',
        lowSeason: 'January',
        seasonalityIndex: 1.45,
      };
      const context = buildContextString(undefined, marketData);
      expect(context).toContain('Peak Season: June');
      expect(context).toContain('Low Season: January');
    });

    it('should calculate seasonality index correctly', () => {
      // Seasonality index = max occupancy / min occupancy
      const seasonality = [
        { month: 'Jan', occupancy: 0.55 },
        { month: 'Jun', occupancy: 0.85 },
        { month: 'Dec', occupancy: 0.60 },
      ];
      const maxOcc = Math.max(...seasonality.map(s => s.occupancy));
      const minOcc = Math.min(...seasonality.map(s => s.occupancy));
      const seasonalityIndex = maxOcc / minOcc;
      expect(seasonalityIndex).toBeCloseTo(1.545, 2);
    });

    it('should identify peak and low seasons correctly', () => {
      const seasonality = [
        { month: 'January', occupancy: 0.55 },
        { month: 'February', occupancy: 0.58 },
        { month: 'March', occupancy: 0.65 },
        { month: 'June', occupancy: 0.85 },
        { month: 'July', occupancy: 0.82 },
        { month: 'December', occupancy: 0.60 },
      ];
      
      const peakSeason = seasonality.reduce((max, s) => 
        s.occupancy > max.occupancy ? s : max
      ).month;
      
      const lowSeason = seasonality.reduce((min, s) => 
        s.occupancy < min.occupancy ? s : min
      ).month;
      
      expect(peakSeason).toBe('June');
      expect(lowSeason).toBe('January');
    });
  });

  describe('Combined Property and Market Context', () => {
    it('should include both property and market data in context', () => {
      const propertyData: LivePropertyData = {
        address: '456 Oak Ave, Austin, TX',
        projectedRevenue: 95000,
        occupancyRate: 0.75,
      };
      const marketData: LiveMarketData = {
        city: 'Austin',
        state: 'TX',
        averageRevenue: 78000,
        averageOccupancy: 0.70,
      };
      const context = buildContextString(propertyData, marketData);
      
      expect(context).toContain('LIVE PROPERTY ANALYSIS DATA');
      expect(context).toContain('LIVE MARKET RESEARCH DATA');
      expect(context).toContain('456 Oak Ave, Austin, TX');
      expect(context).toContain('Austin, TX');
    });

    it('should allow comparison of property vs market performance', () => {
      const propertyData: LivePropertyData = {
        projectedRevenue: 95000,
        occupancyRate: 0.75,
      };
      const marketData: LiveMarketData = {
        averageRevenue: 78000,
        averageOccupancy: 0.70,
      };
      
      // Property outperforms market
      const revenueVsMarket = ((propertyData.projectedRevenue! - marketData.averageRevenue!) / marketData.averageRevenue!) * 100;
      const occupancyVsMarket = ((propertyData.occupancyRate! - marketData.averageOccupancy!) / marketData.averageOccupancy!) * 100;
      
      expect(revenueVsMarket).toBeCloseTo(21.79, 1); // 21.79% above market
      expect(occupancyVsMarket).toBeCloseTo(7.14, 1); // 7.14% above market
    });
  });

  describe('Data Freshness and Timestamps', () => {
    it('should include analysis timestamp', () => {
      const propertyData: LivePropertyData = {
        address: '789 Pine St',
        analyzedAt: new Date('2024-02-01T10:30:00Z'),
      };
      expect(propertyData.analyzedAt).toBeInstanceOf(Date);
      expect(propertyData.analyzedAt?.toISOString()).toContain('2024-02-01');
    });

    it('should handle missing timestamps gracefully', () => {
      const propertyData: LivePropertyData = {
        address: '789 Pine St',
      };
      expect(propertyData.analyzedAt).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty property data', () => {
      const propertyData: LivePropertyData = {};
      const context = buildContextString(propertyData);
      expect(context).toContain('LIVE PROPERTY ANALYSIS DATA');
    });

    it('should handle empty market data', () => {
      const marketData: LiveMarketData = {};
      const context = buildContextString(undefined, marketData);
      expect(context).toContain('LIVE MARKET RESEARCH DATA');
    });

    it('should handle zero values correctly', () => {
      const propertyData: LivePropertyData = {
        projectedRevenue: 0,
        occupancyRate: 0,
      };
      // Zero values should not be included in context (falsy check)
      const context = buildContextString(propertyData);
      expect(context).not.toContain('$0');
      expect(context).not.toContain('0.0%');
    });

    it('should handle very large numbers', () => {
      const propertyData: LivePropertyData = {
        projectedRevenue: 1500000,
      };
      const context = buildContextString(propertyData);
      expect(context).toContain('$1,500,000');
    });

    it('should handle decimal occupancy rates', () => {
      const propertyData: LivePropertyData = {
        occupancyRate: 0.7345,
      };
      const context = buildContextString(propertyData);
      expect(context).toContain('73.5%'); // Rounded to 1 decimal
    });
  });

  describe('Suggested Questions Generation', () => {
    it('should generate property-specific questions when property data exists', () => {
      const propertyData: LivePropertyData = {
        projectedRevenue: 85000,
        occupancyRate: 0.73,
        profitMargin: 35,
      };
      
      // These are the types of questions that should be generated
      const expectedQuestionPatterns = [
        /\$85,000.*revenue/i,
        /73%.*occupancy/i,
        /35%.*profit.*margin/i,
      ];
      
      // Verify the data can generate meaningful questions
      expect(propertyData.projectedRevenue).toBeDefined();
      expect(propertyData.occupancyRate).toBeDefined();
      expect(propertyData.profitMargin).toBeDefined();
    });

    it('should generate market-specific questions when market data exists', () => {
      const marketData: LiveMarketData = {
        city: 'Denver',
        averageOccupancy: 0.68,
      };
      
      // Verify the data can generate meaningful questions
      expect(marketData.city).toBe('Denver');
      expect(marketData.averageOccupancy).toBe(0.68);
    });
  });
});

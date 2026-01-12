/**
 * Simplified Market Research - AirDNA API Only
 * 
 * Provides instant market insights without Browser Use scraping.
 * Uses AirDNA's comprehensive market APIs for:
 * - Market overview metrics
 * - Seasonality data
 * - Top performers
 * - Submarket breakdown
 */

import { router, publicProcedure } from './_core/trpc';
import { z } from 'zod';
import {
  searchMarkets,
  getMarketDetails,
  getComprehensiveMarketReport,
  getMarketSeasonality,
  getTopPerformers,
  getSubmarketsInMarket,
  getMarketHistoricalData,
  MarketSearchResult
} from './airdna';

// ============================================
// TYPES
// ============================================

interface SimplifiedMarketReport {
  market: {
    id: string;
    name: string;
    state?: string;
    listingCount: number;
  };
  overview: {
    totalListings: number;
    avgOccupancy: number;
    avgAdr: number;
    avgRevenue: number;
    avgRevpar: number;
    marketScore?: number;
  };
  seasonality: {
    peakMonths: string[];
    lowMonths: string[];
    monthlyData: Array<{
      month: string;
      occupancy: number;
      adr: number;
      revenue: number;
    }>;
  };
  topPerformers: Array<{
    title: string;
    bedrooms: number;
    revenue: number;
    occupancy: number;
    adr: number;
    propertyType: string;
    airbnbUrl?: string;
  }>;
  submarkets: Array<{
    name: string;
    listingCount: number;
    avgRevenue: number;
    avgOccupancy: number;
  }>;
  bedroomBreakdown: Array<{
    bedrooms: number;
    count: number;
    avgRevenue: number;
    avgOccupancy: number;
  }>;
  insights: string[];
}

// ============================================
// ROUTER
// ============================================

export const marketResearchSimpleRouter = router({
  // Search for markets by name
  searchMarkets: publicProcedure
    .input(z.object({
      query: z.string().min(2)
    }))
    .mutation(async ({ input }) => {
      const results = await searchMarkets(input.query, 10);
      return results.map((r: MarketSearchResult) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        listingCount: r.listing_count,
        state: r.state,
        locationName: r.location_name
      }));
    }),

  // Get instant market research report
  getMarketReport: publicProcedure
    .input(z.object({
      marketId: z.string(),
      marketName: z.string()
    }))
    .mutation(async ({ input }): Promise<SimplifiedMarketReport> => {
      const { marketId, marketName } = input;

      // Fetch all data in parallel for speed
      const [
        marketDetails,
        comprehensiveReport,
        seasonality,
        topPerformers,
        submarkets,
        historicalData
      ] = await Promise.all([
        getMarketDetails(marketId).catch(() => null),
        getComprehensiveMarketReport(marketId).catch(() => null),
        getMarketSeasonality(marketId).catch(() => null),
        getTopPerformers({ marketId, limit: 10, sort_by: 'revenue' }).catch(() => []),
        getSubmarketsInMarket(marketId).catch(() => []),
        getMarketHistoricalData(marketId, 12).catch(() => null)
      ]);

      // Build overview from available data
      const report = comprehensiveReport as any;
      const details = marketDetails as any;
      const overview = {
        totalListings: details?.listing_count || report?.market?.listing_count || 0,
        avgOccupancy: report?.metrics?.occupancy || details?.metrics?.booked || details?.metrics?.occupancy || 0,
        avgAdr: report?.metrics?.adr || details?.metrics?.daily_rate || details?.metrics?.adr || 0,
        avgRevenue: report?.metrics?.revenue || details?.metrics?.revenue || 0,
        avgRevpar: report?.metrics?.revpar || details?.metrics?.revpar || 0,
        marketScore: details?.metrics?.market_score
      };

      // Process seasonality data
      let seasonalityData = {
        peakMonths: [] as string[],
        lowMonths: [] as string[],
        monthlyData: [] as Array<{ month: string; occupancy: number; adr: number; revenue: number }>
      };

      if (seasonality && Array.isArray(seasonality) && seasonality.length > 0) {
        const monthlyData = seasonality.map((m: any) => ({
          month: m.month || m.date,
          occupancy: m.occupancy || 0,
          adr: m.adr || 0,
          revenue: m.revenue || 0
        }));

        // Find peak and low months based on revenue
        const sortedByRevenue = [...monthlyData].sort((a, b) => b.revenue - a.revenue);
        seasonalityData = {
          peakMonths: sortedByRevenue.slice(0, 3).map(m => m.month),
          lowMonths: sortedByRevenue.slice(-3).map(m => m.month),
          monthlyData
        };
      }

      // Process top performers
      const performersList = Array.isArray(topPerformers) ? topPerformers : (topPerformers as any)?.listings || [];
      const processedTopPerformers = performersList.slice(0, 10).map((p: any) => ({
        title: p.title || `${p.bedrooms}BR ${p.property_type || 'Property'}`,
        bedrooms: p.bedrooms || 0,
        revenue: p.annual_revenue || p.revenue || 0,
        occupancy: p.occupancy || 0,
        adr: p.adr || 0,
        propertyType: p.property_type || 'Unknown',
        airbnbUrl: p.airbnb_url
      }));

      // Process submarkets
      const processedSubmarkets = (submarkets || []).slice(0, 10).map((s: any) => ({
        name: s.name,
        listingCount: s.listing_count || 0,
        avgRevenue: s.metrics?.revenue || 0,
        avgOccupancy: s.metrics?.occupancy || 0
      }));

      // Process bedroom breakdown
      const bedroomBreakdown = comprehensiveReport?.bedroom_performance?.map((b: any) => ({
        bedrooms: b.bedrooms,
        count: b.listing_count || 0,
        avgRevenue: b.revenue || 0,
        avgOccupancy: b.occupancy || 0
      })) || [];

      // Generate insights
      const insights = generateInsights(overview, seasonalityData, processedTopPerformers, bedroomBreakdown);

      return {
        market: {
          id: marketId,
          name: marketName,
          state: (marketDetails as any)?.state,
          listingCount: overview.totalListings
        },
        overview,
        seasonality: seasonalityData,
        topPerformers: processedTopPerformers,
        submarkets: processedSubmarkets,
        bedroomBreakdown,
        insights
      };
    })
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateInsights(
  overview: SimplifiedMarketReport['overview'],
  seasonality: SimplifiedMarketReport['seasonality'],
  topPerformers: SimplifiedMarketReport['topPerformers'],
  bedroomBreakdown: SimplifiedMarketReport['bedroomBreakdown']
): string[] {
  const insights: string[] = [];

  // Occupancy insight
  if (overview.avgOccupancy >= 0.6) {
    insights.push(`Strong market with ${Math.round(overview.avgOccupancy * 100)}% average occupancy - properties stay booked!`);
  } else if (overview.avgOccupancy >= 0.4) {
    insights.push(`Moderate market with ${Math.round(overview.avgOccupancy * 100)}% average occupancy - good potential with the right strategy.`);
  } else {
    insights.push(`Competitive market with ${Math.round(overview.avgOccupancy * 100)}% average occupancy - focus on standing out.`);
  }

  // Revenue insight
  if (overview.avgRevenue > 0) {
    const monthlyRevenue = Math.round(overview.avgRevenue / 12);
    insights.push(`Average Airbnb in this area makes $${monthlyRevenue.toLocaleString()}/month.`);
  }

  // Seasonality insight
  if (seasonality.peakMonths.length > 0) {
    insights.push(`Peak season: ${seasonality.peakMonths.join(', ')} - charge premium rates during these months.`);
  }

  // Best bedroom count
  if (bedroomBreakdown.length > 0) {
    const bestBedroom = [...bedroomBreakdown].sort((a, b) => b.avgRevenue - a.avgRevenue)[0];
    if (bestBedroom) {
      insights.push(`${bestBedroom.bedrooms}-bedroom properties earn the most at $${Math.round(bestBedroom.avgRevenue).toLocaleString()}/year average.`);
    }
  }

  // Top performer insight
  if (topPerformers.length > 0) {
    const topRevenue = topPerformers[0].revenue;
    insights.push(`Top performers in this market earn up to $${Math.round(topRevenue).toLocaleString()}/year.`);
  }

  return insights;
}

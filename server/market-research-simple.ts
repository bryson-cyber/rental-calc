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
  getMarketSeasonality,
  getTopPerformers,
  getSubmarketsInMarket,
  getMarketHistoricalData,
  getMarketListings,
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
      // Fetch MORE listings (200+) to get representative bedroom distribution
      const [
        marketDetails,
        seasonality,
        topPerformers,
        submarkets,
        historicalData,
        listingsPage1,
        listingsPage2,
        listingsPage3,
        listingsPage4,
        listingsPage5,
        listingsPage6,
        listingsPage7,
        listingsPage8
      ] = await Promise.all([
        getMarketDetails(marketId).catch(() => null),
        getMarketSeasonality(marketId).catch(() => null),
        getTopPerformers({ marketId, limit: 10, sort_by: 'revenue' }).catch(() => []),
        getSubmarketsInMarket(marketId).catch(() => []),
        getMarketHistoricalData(marketId, 12).catch(() => null),
        // Fetch 200 listings across multiple pages to get bedroom distribution
        getMarketListings(marketId, { limit: 25, offset: 0, orderBy: 'revenue', orderDirection: 'desc' }).catch(() => ({ listings: [], total_count: 0 })),
        getMarketListings(marketId, { limit: 25, offset: 25, orderBy: 'revenue', orderDirection: 'desc' }).catch(() => ({ listings: [], total_count: 0 })),
        getMarketListings(marketId, { limit: 25, offset: 50, orderBy: 'revenue', orderDirection: 'desc' }).catch(() => ({ listings: [], total_count: 0 })),
        getMarketListings(marketId, { limit: 25, offset: 75, orderBy: 'revenue', orderDirection: 'desc' }).catch(() => ({ listings: [], total_count: 0 })),
        getMarketListings(marketId, { limit: 25, offset: 100, orderBy: 'revenue', orderDirection: 'desc' }).catch(() => ({ listings: [], total_count: 0 })),
        getMarketListings(marketId, { limit: 25, offset: 125, orderBy: 'revenue', orderDirection: 'desc' }).catch(() => ({ listings: [], total_count: 0 })),
        getMarketListings(marketId, { limit: 25, offset: 150, orderBy: 'revenue', orderDirection: 'desc' }).catch(() => ({ listings: [], total_count: 0 })),
        getMarketListings(marketId, { limit: 25, offset: 175, orderBy: 'revenue', orderDirection: 'desc' }).catch(() => ({ listings: [], total_count: 0 })),
      ]);

      // Combine all listings for bedroom analysis
      const allListings = [
        ...listingsPage1.listings,
        ...listingsPage2.listings,
        ...listingsPage3.listings,
        ...listingsPage4.listings,
        ...listingsPage5.listings,
        ...listingsPage6.listings,
        ...listingsPage7.listings,
        ...listingsPage8.listings,
      ];
      
      const totalCount = listingsPage1.total_count || 0;

      // Build overview from available data
      const details = marketDetails as any;
      
      // FIX: Properly handle occupancy - API returns decimal (0.65 = 65%)
      // The metrics.booked field is already a decimal like 0.65
      let rawOccupancy = details?.metrics?.booked || details?.metrics?.occupancy || 0;
      // If occupancy is > 1, it's already a percentage, otherwise multiply by 100
      const avgOccupancy = rawOccupancy > 1 ? rawOccupancy : rawOccupancy * 100;
      
      const overview = {
        totalListings: details?.listing_count || totalCount || 0,
        avgOccupancy: Math.round(avgOccupancy), // Now properly converted to percentage
        avgAdr: Math.round(details?.metrics?.daily_rate || details?.metrics?.adr || 0),
        avgRevenue: Math.round(details?.metrics?.revenue || 0),
        avgRevpar: Math.round(details?.metrics?.revpar || 0),
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
        // FIX: Properly handle occupancy for top performers too
        occupancy: (p.occupancy || 0) > 1 ? p.occupancy : Math.round((p.occupancy || 0) * 100),
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

      // FIX: Calculate bedroom breakdown from ALL fetched listings (200+)
      // This gives us a much better distribution including 1BR and 2BR
      const bedroomMap = new Map<number, { count: number; totalRevenue: number; totalOccupancy: number }>();
      
      allListings.forEach((listing: any) => {
        const br = listing.bedrooms || 0;
        if (br < 1 || br > 10) return; // Skip invalid bedroom counts
        
        const existing = bedroomMap.get(br) || { count: 0, totalRevenue: 0, totalOccupancy: 0 };
        bedroomMap.set(br, {
          count: existing.count + 1,
          totalRevenue: existing.totalRevenue + (listing.annual_revenue || 0),
          // Handle occupancy - could be decimal or percentage
          totalOccupancy: existing.totalOccupancy + ((listing.occupancy || 0) > 1 ? listing.occupancy : (listing.occupancy || 0) * 100),
        });
      });
      
      // Convert to array and sort by bedroom count
      const bedroomBreakdown = Array.from(bedroomMap.entries())
        .map(([bedrooms, data]) => ({
          bedrooms,
          count: data.count,
          avgRevenue: data.count > 0 ? Math.round(data.totalRevenue / data.count) : 0,
          avgOccupancy: data.count > 0 ? Math.round(data.totalOccupancy / data.count) : 0
        }))
        .filter(b => b.count > 0) // Only show bedroom types that have listings
        .sort((a, b) => a.bedrooms - b.bedrooms); // Sort 1BR, 2BR, 3BR, etc.

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

  // Occupancy insight - now avgOccupancy is already a percentage (e.g., 65 not 0.65)
  if (overview.avgOccupancy >= 60) {
    insights.push(`Strong market with ${overview.avgOccupancy}% average occupancy - properties stay booked!`);
  } else if (overview.avgOccupancy >= 40) {
    insights.push(`Moderate market with ${overview.avgOccupancy}% average occupancy - good potential with the right strategy.`);
  } else if (overview.avgOccupancy > 0) {
    insights.push(`Competitive market with ${overview.avgOccupancy}% average occupancy - focus on standing out.`);
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
    if (bestBedroom && bestBedroom.avgRevenue > 0) {
      insights.push(`${bestBedroom.bedrooms}-bedroom properties earn the most at $${Math.round(bestBedroom.avgRevenue).toLocaleString()}/year average.`);
    }
  }

  // Top performer insight
  if (topPerformers.length > 0) {
    const topRevenue = topPerformers[0].revenue;
    if (topRevenue > 0) {
      insights.push(`Top performers in this market earn up to $${Math.round(topRevenue).toLocaleString()}/year.`);
    }
  }

  return insights;
}

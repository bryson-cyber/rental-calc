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
  MarketSearchResult,
  getRentalizerEstimate
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
  // Uses a two-step approach:
  // 1. First try the markets list (fast but limited coverage)
  // 2. If no exact match, use Rentalizer with a sample address to get the correct market
  searchMarkets: publicProcedure
    .input(z.object({
      query: z.string().min(2)
    }))
    .mutation(async ({ input }) => {
      const searchQuery = input.query.trim();
      const searchLower = searchQuery.toLowerCase();
      
      // First try the standard market search
      const results = await searchMarkets(searchQuery, 20);
      
      // Check if we have an exact or very close match
      const exactMatch = results.find(r => 
        r.name.toLowerCase() === searchLower ||
        r.name.toLowerCase().replace(/[^a-z0-9]/g, '') === searchLower.replace(/[^a-z0-9]/g, '')
      );
      
      if (exactMatch) {
        // Return exact match first, then others
        const otherResults = results.filter(r => r.id !== exactMatch.id);
        return [exactMatch, ...otherResults].slice(0, 10).map((r: MarketSearchResult) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          listingCount: r.listing_count,
          state: r.state,
          locationName: r.location_name
        }));
      }
      
      // No exact match - try using Rentalizer with a sample address
      // This works for cities not in the markets list (like San Diego)
      console.log(`[searchMarkets] No exact match for "${searchQuery}", trying Rentalizer lookup...`);
      
      try {
        // Create a sample address for the city
        // Format: "123 Main St, [City], [State if provided]"
        let sampleAddress = `123 Main St, ${searchQuery}`;
        
        // Try to get market info via Rentalizer
        const estimate = await getRentalizerEstimate({
          address: sampleAddress,
          bedrooms: 2,
          bathrooms: 1
        });
        
        if (estimate?.property?.market_id) {
          // Get the market details
          const marketDetails = await getMarketDetails(estimate.property.market_id);
          
          if (marketDetails) {
            console.log(`[searchMarkets] Found market via Rentalizer: ${marketDetails.name} (${estimate.property.market_id})`);
            
            // Return this market as the first result
            const rentalizerResult = {
              id: estimate.property.market_id,
              name: marketDetails.name || searchQuery,
              type: 'market' as const,
              listingCount: marketDetails.listing_count || 0,
              state: (marketDetails as any)?.state,
              locationName: `${marketDetails.name}, United States`
            };
            
            // Combine with other results (excluding duplicates)
            const otherResults = results
              .filter(r => r.id !== rentalizerResult.id)
              .slice(0, 9)
              .map((r: MarketSearchResult) => ({
                id: r.id,
                name: r.name,
                type: r.type,
                listingCount: r.listing_count,
                state: r.state,
                locationName: r.location_name
              }));
            
            return [rentalizerResult, ...otherResults];
          }
        }
      } catch (error) {
        console.log(`[searchMarkets] Rentalizer lookup failed for "${searchQuery}":`, error);
      }
      
      // Fallback to original results
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
    }),

  // Get market report by location (works for ANY US location)
  // Uses Rentalizer to get comparable properties and aggregate their data
  getMarketReportByLocation: publicProcedure
    .input(z.object({
      location: z.string().min(2), // City name, address, or zip code
    }))
    .mutation(async ({ input }): Promise<SimplifiedMarketReport> => {
      const { location } = input;
      
      console.log(`[getMarketReportByLocation] Getting market data for: ${location}`);
      
      // Create sample addresses across the location to get comprehensive data
      // We'll use multiple bedroom configurations to get diverse comps
      const sampleConfigs = [
        { address: `123 Main St, ${location}`, bedrooms: 1, bathrooms: 1 },
        { address: `456 Oak Ave, ${location}`, bedrooms: 2, bathrooms: 1 },
        { address: `789 Pine Rd, ${location}`, bedrooms: 3, bathrooms: 2 },
        { address: `321 Elm St, ${location}`, bedrooms: 4, bathrooms: 2 },
        { address: `654 Maple Dr, ${location}`, bedrooms: 5, bathrooms: 3 },
      ];
      
      // Fetch estimates for all configurations in parallel
      const estimates = await Promise.all(
        sampleConfigs.map(config => 
          getRentalizerEstimate(config).catch(() => null)
        )
      );
      
      // Filter out failed requests
      const validEstimates = estimates.filter(e => e !== null);
      
      if (validEstimates.length === 0) {
        throw new Error('Could not find data for this location. Please try a different city or address.');
      }
      
      // Get the first valid estimate for location info
      const primaryEstimate = validEstimates[0]!;
      const locationName = primaryEstimate.property.address_lookup?.split(',').slice(1, 3).join(',').trim() || location;
      
      // Collect all comps from all estimates
      const allComps: any[] = [];
      validEstimates.forEach(est => {
        if (est?.comps) {
          allComps.push(...est.comps);
        }
      });
      
      // Get the reference latitude from the primary estimate to filter out foreign comps
      const refLat = primaryEstimate.property.latitude;
      const refLng = primaryEstimate.property.longitude;
      
      // Filter out comps that are likely in different countries (e.g., Tijuana for San Diego)
      // A comp more than 50 miles away or with significantly different latitude is likely foreign
      const filteredComps = allComps.filter((comp: any) => {
        // If comp doesn't have location data, keep it
        if (!comp.location?.lat && !comp.latitude) return true;
        
        const compLat = comp.location?.lat || comp.latitude;
        const compLng = comp.location?.lng || comp.longitude;
        
        // Check if comp is within reasonable distance (about 0.5 degrees = ~35 miles)
        const latDiff = Math.abs(compLat - refLat);
        const lngDiff = Math.abs(compLng - refLng);
        
        // For border cities like San Diego, filter out comps south of the border
        // San Diego is around 32.7°N, Tijuana is around 32.5°N
        // If reference is above 32.6°N and comp is below 32.55°N, it's likely in Mexico
        if (refLat > 32.6 && compLat < 32.55) {
          console.log(`[getMarketReportByLocation] Filtering out foreign comp: ${comp.title} (lat: ${compLat})`);
          return false;
        }
        
        // General distance filter - keep comps within ~50 miles
        if (latDiff > 0.7 || lngDiff > 0.7) {
          console.log(`[getMarketReportByLocation] Filtering out distant comp: ${comp.title} (${latDiff.toFixed(2)}° lat, ${lngDiff.toFixed(2)}° lng away)`);
          return false;
        }
        
        return true;
      });
      
      // Remove duplicates by title
      const uniqueComps = filteredComps.filter((comp: any, index: number, self: any[]) =>
        index === self.findIndex(c => c.title === comp.title)
      );
      
      console.log(`[getMarketReportByLocation] Found ${uniqueComps.length} unique comps`);
      
      // Calculate overview metrics from comps
      // Note: comps from RentalizerResponse use annual_revenue, adr, occupancy fields
      const totalRevenue = uniqueComps.reduce((sum, c) => sum + (c.annual_revenue || 0), 0);
      const totalOccupancy = uniqueComps.reduce((sum, c) => {
        const occ = c.occupancy || 0;
        return sum + (occ > 1 ? occ : occ * 100);
      }, 0);
      const totalAdr = uniqueComps.reduce((sum, c) => sum + (c.adr || 0), 0);
      
      const avgRevenue = uniqueComps.length > 0 ? Math.round(totalRevenue / uniqueComps.length) : 0;
      const avgOccupancy = uniqueComps.length > 0 ? Math.round(totalOccupancy / uniqueComps.length) : 0;
      const avgAdr = uniqueComps.length > 0 ? Math.round(totalAdr / uniqueComps.length) : 0;
      
      // Calculate bedroom breakdown from comps
      const bedroomMap = new Map<number, { count: number; totalRevenue: number; totalOccupancy: number }>();
      
      uniqueComps.forEach((comp: any) => {
        const br = comp.bedrooms || 0;
        if (br < 1 || br > 10) return;
        
        const existing = bedroomMap.get(br) || { count: 0, totalRevenue: 0, totalOccupancy: 0 };
        const occ = comp.occupancy || 0;
        bedroomMap.set(br, {
          count: existing.count + 1,
          totalRevenue: existing.totalRevenue + (comp.annual_revenue || 0),
          totalOccupancy: existing.totalOccupancy + (occ > 1 ? occ : occ * 100),
        });
      });
      
      const bedroomBreakdown = Array.from(bedroomMap.entries())
        .map(([bedrooms, data]) => ({
          bedrooms,
          count: data.count,
          avgRevenue: data.count > 0 ? Math.round(data.totalRevenue / data.count) : 0,
          avgOccupancy: data.count > 0 ? Math.round(data.totalOccupancy / data.count) : 0
        }))
        .filter(b => b.count > 0)
        .sort((a, b) => a.bedrooms - b.bedrooms);
      
      // Get seasonality from the primary estimate's monthly_forecast
      // The forecast has complete 12-month data with realistic projections
      // Comp metrics are often incomplete (only 7 months) with many zero values
      let seasonalityData = {
        peakMonths: [] as string[],
        lowMonths: [] as string[],
        monthlyData: [] as Array<{ month: string; occupancy: number; adr: number; revenue: number }>
      };
      
      // Use monthly_forecast which is populated by getRentalizerEstimate
      const forecastMetrics = primaryEstimate.monthly_forecast;
      
      if (forecastMetrics && forecastMetrics.length > 0) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const monthlyData = forecastMetrics.map((m: any) => {
          // Parse date format "YYYY-MM" to get month name
          let monthName = m.month;
          if (monthName && monthName.includes('-')) {
            const monthNum = parseInt(monthName.split('-')[1], 10) - 1;
            monthName = monthNames[monthNum] || monthName;
          }
          const occ = m.occupancy || 0;
          return {
            month: monthName,
            occupancy: occ > 1 ? Math.round(occ) : Math.round(occ * 100),
            adr: Math.round(m.adr || 0),
            revenue: Math.round(m.revenue || 0)
          };
        });
        
        const sortedByRevenue = [...monthlyData].sort((a, b) => b.revenue - a.revenue);
        seasonalityData = {
          peakMonths: sortedByRevenue.slice(0, 3).map(m => m.month),
          lowMonths: sortedByRevenue.slice(-3).map(m => m.month),
          monthlyData
        };
        
        console.log(`[getMarketReportByLocation] Using forecast data (no comp monthly metrics available)`);
      }
      
      // Get top performers from comps
      const topPerformers = [...uniqueComps]
        .sort((a, b) => (b.annual_revenue || 0) - (a.annual_revenue || 0))
        .slice(0, 10)
        .map((comp: any) => {
          const occ = comp.occupancy || 0;
          return {
            title: comp.title || `${comp.bedrooms}BR Property`,
            bedrooms: comp.bedrooms || 0,
            revenue: comp.annual_revenue || 0,
            occupancy: occ > 1 ? occ : Math.round(occ * 100),
            adr: comp.adr || 0,
            propertyType: comp.property_type || 'Unknown',
            airbnbUrl: comp.airbnb_url
          };
        });
      
      const overview = {
        totalListings: uniqueComps.length,
        avgOccupancy,
        avgAdr,
        avgRevenue,
        avgRevpar: Math.round(avgAdr * (avgOccupancy / 100)),
        marketScore: undefined
      };
      
      // Generate insights
      const insights = generateInsights(overview, seasonalityData, topPerformers, bedroomBreakdown);
      
      return {
        market: {
          id: 'location-based',
          name: locationName,
          state: undefined,
          listingCount: uniqueComps.length
        },
        overview,
        seasonality: seasonalityData,
        topPerformers,
        submarkets: [], // Not available for location-based search
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

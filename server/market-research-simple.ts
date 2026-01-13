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
  searchMarketsAPI,
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
  // Search for markets by name using AirDNA's /market/search API
  // This searches DIRECTLY in AirDNA's database, so every result is guaranteed to have data.
  // Supports: city names, neighborhood names, zip codes, and any location AirDNA knows about.
  searchMarkets: publicProcedure
    .input(z.object({
      query: z.string().min(2)
    }))
    .mutation(async ({ input }) => {
      const searchQuery = input.query.trim();
      
      console.log(`[searchMarkets] Searching for: "${searchQuery}"`);
      
      // Use the new AirDNA /market/search API directly
      // This finds markets, submarkets (neighborhoods), and zip codes
      const apiResults = await searchMarketsAPI(searchQuery, 15);
      
      if (apiResults.length > 0) {
        console.log(`[searchMarkets] Found ${apiResults.length} results from AirDNA API`);
        return apiResults.map((r: MarketSearchResult) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          listingCount: r.listing_count,
          state: r.state,
          locationName: r.location_name,
          parentMarket: r.parent_market ? {
            id: r.parent_market.id,
            name: r.parent_market.name
          } : undefined
        }));
      }
      
      // Fallback to the old market list search if API returns nothing
      console.log(`[searchMarkets] No API results, falling back to market list search`);
      const fallbackResults = await searchMarkets(searchQuery, 15);
      
      return fallbackResults.map((r: MarketSearchResult) => ({
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
    }),

  // Get submarket report (for neighborhoods)
  getSubmarketReport: publicProcedure
    .input(z.object({
      submarketId: z.string(),
      submarketName: z.string()
    }))
    .mutation(async ({ input }): Promise<SimplifiedMarketReport> => {
      const { submarketId, submarketName } = input;
      
      console.log(`[getSubmarketReport] Fetching report for submarket: ${submarketId} (${submarketName})`);
      
      // Import the comprehensive submarket report function
      const { getComprehensiveSubmarketReport } = await import('./airdna');
      const report = await getComprehensiveSubmarketReport(submarketId);
      
      if (!report) {
        throw new Error(`Could not find data for submarket: ${submarketName}`);
      }
      
      // Transform to SimplifiedMarketReport format
      const overview = {
        totalListings: report.submarket.listing_count || 0,
        avgOccupancy: report.submarket.metrics.occupancy,
        avgAdr: report.submarket.metrics.adr,
        avgRevenue: report.submarket.metrics.revenue,
        avgRevpar: report.submarket.metrics.revpar,
        marketScore: report.submarket.metrics.market_score
      };
      
      // Process top performers
      const topPerformers = report.top_listings.slice(0, 10).map(l => ({
        title: l.title,
        bedrooms: l.bedrooms,
        revenue: l.annual_revenue,
        occupancy: Math.round(l.occupancy),
        adr: l.adr,
        propertyType: l.property_type,
        airbnbUrl: l.airbnb_url
      }));
      
      // Process bedroom breakdown
      const bedroomBreakdown = report.bedroom_performance.map(b => ({
        bedrooms: b.bedrooms,
        count: b.count,
        avgRevenue: b.avg_revenue,
        avgOccupancy: b.avg_occupancy
      }));
      
      // Seasonality - use parent market seasonality from comprehensive report
      const monthlyData = report.seasonality.map(s => ({
        month: s.month,
        occupancy: s.occupancy,
        adr: s.adr,
        revenue: s.revenue
      }));
      
      const sortedByRevenue = [...monthlyData].sort((a, b) => b.revenue - a.revenue);
      const seasonalityData = {
        peakMonths: sortedByRevenue.slice(0, 3).map(m => m.month),
        lowMonths: sortedByRevenue.slice(-3).map(m => m.month),
        monthlyData
      };
      
      // Generate insights
      const insights = generateInsights(overview, seasonalityData, topPerformers, bedroomBreakdown);
      
      return {
        market: {
          id: submarketId,
          name: submarketName,
          state: undefined,
          listingCount: report.submarket.listing_count || 0
        },
        overview,
        seasonality: seasonalityData,
        topPerformers,
        submarkets: [], // Submarkets don't have sub-submarkets
        bedroomBreakdown,
        insights
      };
    }),

  // ============================================
  // HIERARCHICAL LOCATION ENDPOINTS
  // ============================================

  // Get all submarkets within a market
  getSubmarkets: publicProcedure
    .input(z.object({
      marketId: z.string()
    }))
    .mutation(async ({ input }) => {
      const { marketId } = input;
      console.log(`[getSubmarkets] Getting submarkets for market ${marketId}`);
      
      try {
        // Use the AirDNA /market/{market_id}/submarkets endpoint
        const response = await fetch(
          `https://api.airdna.co/api/enterprise/v2/market/${marketId}/submarkets`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.AIRDNA_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              pagination: { page_size: 25, offset: 0 }
            })
          }
        );
        
        const data = await response.json();
        
        if (data.status?.type === 'error') {
          console.error(`[getSubmarkets] API error:`, data.status.message);
          return [];
        }
        
        const submarkets = data.payload?.submarkets || [];
        const totalCount = data.payload?.page_info?.total_count || 0;
        
        // Fetch additional pages if needed
        let allSubmarkets = [...submarkets];
        let offset = 25;
        
        while (offset < totalCount) {
          const moreResponse = await fetch(
            `https://api.airdna.co/api/enterprise/v2/market/${marketId}/submarkets`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.AIRDNA_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                pagination: { page_size: 25, offset }
              })
            }
          );
          
          const moreData = await moreResponse.json();
          allSubmarkets.push(...(moreData.payload?.submarkets || []));
          offset += 25;
        }
        
        console.log(`[getSubmarkets] Found ${allSubmarkets.length} submarkets`);
        
        // Sort alphabetically by name
        allSubmarkets.sort((a: any, b: any) => 
          (a.name || '').localeCompare(b.name || '')
        );
        
        // Fetch listing counts for each submarket in parallel (limit to top 50 to avoid too many API calls)
        const topSubmarkets = allSubmarkets.slice(0, 50);
        const listingCounts = await Promise.all(
          topSubmarkets.map(async (s: any) => {
            try {
              const listingsResponse = await fetch(
                `https://api.airdna.co/api/enterprise/v2/submarket/${s.id}/listings`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${process.env.AIRDNA_API_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    pagination: { page_size: 1, offset: 0 }
                  })
                }
              );
              const listingsData = await listingsResponse.json();
              return listingsData.payload?.page_info?.total_count || 0;
            } catch {
              return 0;
            }
          })
        );
        
        return topSubmarkets.map((s: any, index: number) => ({
          id: s.id,
          name: s.name,
          listingCount: listingCounts[index],
          revenue: s.metrics?.revenue ? Math.round(s.metrics.revenue) : undefined,
          occupancy: s.metrics?.booked ? Math.round(s.metrics.booked * 100) : undefined
        }));
      } catch (error) {
        console.error(`[getSubmarkets] Error:`, error);
        return [];
      }
    }),

  // Get all zip codes within a submarket with listing counts
  getZipcodesInSubmarket: publicProcedure
    .input(z.object({
      submarketId: z.string()
    }))
    .mutation(async ({ input }) => {
      const { submarketId } = input;
      console.log(`[getZipcodesInSubmarket] Getting zip codes for submarket ${submarketId}`);
      
      try {
        // Fetch listings to extract zip codes and count them
        const response = await fetch(
          `https://api.airdna.co/api/enterprise/v2/submarket/${submarketId}/listings`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.AIRDNA_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              pagination: { page_size: 25, offset: 0 }
            })
          }
        );
        
        const data = await response.json();
        
        if (data.status?.type === 'error') {
          console.error(`[getZipcodesInSubmarket] API error:`, data.status.message);
          return [];
        }
        
        const listings = data.payload?.listings || [];
        const totalCount = data.payload?.page_info?.total_count || 0;
        
        // Count listings per zip code
        const zipcodeCounts = new Map<string, number>();
        listings.forEach((l: any) => {
          const zip = l.zipcode || l.zip_code;
          if (zip) {
            zipcodeCounts.set(zip, (zipcodeCounts.get(zip) || 0) + 1);
          }
        });
        
        // Fetch more pages to get comprehensive zip code coverage
        // Sample up to 200 listings to get accurate zip code representation
        if (totalCount > 25) {
          for (let offset = 25; offset < Math.min(totalCount, 200); offset += 25) {
            const moreResponse = await fetch(
              `https://api.airdna.co/api/enterprise/v2/submarket/${submarketId}/listings`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.AIRDNA_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  pagination: { page_size: 25, offset }
                })
              }
            );
            
            const moreData = await moreResponse.json();
            (moreData.payload?.listings || []).forEach((l: any) => {
              const zip = l.zipcode || l.zip_code;
              if (zip) {
                zipcodeCounts.set(zip, (zipcodeCounts.get(zip) || 0) + 1);
              }
            });
          }
        }
        
        // Convert to array with listing counts and sort by zip code
        const zipcodesWithCounts = Array.from(zipcodeCounts.entries())
          .map(([zipcode, count]) => ({ zipcode, listingCount: count }))
          .sort((a, b) => a.zipcode.localeCompare(b.zipcode));
        
        console.log(`[getZipcodesInSubmarket] Found ${zipcodesWithCounts.length} unique zip codes`);
        
        return zipcodesWithCounts;
      } catch (error) {
        console.error(`[getZipcodesInSubmarket] Error:`, error);
        return [];
      }
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

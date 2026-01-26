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
  getAllMarketListings,
  MarketSearchResult,
  getRentalizerEstimate,
  getMarketBookingPatterns,
  calculateMarketInsights,
  ListingData
} from './airdna';

// ============================================
// CACHE
// ============================================

// In-memory cache for zip codes to speed up repeated requests
const zipcodeCache = new Map<string, { data: Array<{ zipcode: string; listingCount: number }>; timestamp: number }>();

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
  // New fields for Step 1 Super Experience
  marketScores?: {
    overall: number;
    investability: number;
    rentalDemand: number;
    revenueGrowth: number;
    seasonality: number;
    regulation: number;
  };
  bookingPatterns?: {
    avgLeadTime: number; // days in advance guests book
    lastMinutePercent: number; // % of bookings within 7 days
    advanceBookingPercent: number; // % of bookings 30+ days ahead
    avgLengthOfStay: number; // average nights per stay
    weekendPercent: number; // % of 1-3 night stays
    weekPlusPercent: number; // % of 7+ night stays
  };
  revenuePercentiles?: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  competitionData?: {
    professionallyManagedPct: number;
    superhostPct: number;
    entireHomePct: number;
    privateRoomPct: number;
    sharedRoomPct: number;
    singleHostPct: number; // hosts with 1 property
    multiHostPct: number; // hosts with 2+ properties
  };
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
          } : undefined,
          // Include zipcodes from the API response for submarkets
          zipcodes: r.zipcodes || []
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

      console.log(`[getMarketReport] Starting for marketId: ${marketId}, marketName: ${marketName}`);
      
      // Fetch all data in parallel for speed
      // Fetch all listings for comprehensive bedroom distribution analysis
      const [
        marketDetails,
        seasonality,
        topPerformers,
        submarkets,
        historicalData,
        allListingsData,
        bookingPatternsData
      ] = await Promise.all([
        getMarketDetails(marketId).catch((err) => { console.error('[getMarketReport] getMarketDetails error:', err); return null; }),
        getMarketSeasonality(marketId).catch((err) => { console.error('[getMarketReport] getMarketSeasonality error:', err); return null; }),
        getTopPerformers({ marketId, limit: 10, sort_by: 'revenue' }).catch((err) => { console.error('[getMarketReport] getTopPerformers error:', err); return []; }),
        getSubmarketsInMarket(marketId).catch((err) => { console.error('[getMarketReport] getSubmarketsInMarket error:', err); return []; }),
        getMarketHistoricalData(marketId, 12).catch((err) => { console.error('[getMarketReport] getMarketHistoricalData error:', err); return null; }),
        // Fetch all listings for comprehensive bedroom distribution analysis
        getAllMarketListings(marketId, { maxListings: 5000 }).catch((err) => { console.error('[getMarketReport] getAllMarketListings error:', err); return []; }),
        // Fetch booking patterns for Step 1 Super Experience
        getMarketBookingPatterns(marketId).catch((err) => { console.error('[getMarketReport] getMarketBookingPatterns error:', err); return null; }),
      ]);
      
      console.log(`[getMarketReport] allListingsData type: ${typeof allListingsData}, isArray: ${Array.isArray(allListingsData)}, length: ${allListingsData?.length || 0}`);
      if (allListingsData && allListingsData.length > 0) {
        console.log(`[getMarketReport] Sample listing:`, JSON.stringify(allListingsData[0], null, 2).substring(0, 500));
      }

      // Use all listings for bedroom analysis
      const allListings = allListingsData || [];
      
      // Log the allListings data for debugging
      console.log(`[getMarketReport] allListings count: ${allListings.length}`);
      if (allListings.length === 0) {
        console.log(`[getMarketReport] WARNING: No listings returned from getAllMarketListings for market ${marketId}`);
      }
      
      const totalCount = allListings.length;

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
      
      // Convert to array and include ALL bedroom types 1-5+ for comprehensive display
      // This ensures the frontend always has data for all bedroom types
      const allBedroomTypes = [1, 2, 3, 4, 5]; // Standard bedroom types to always include
      const bedroomBreakdown = allBedroomTypes.map(bedrooms => {
        const data = bedroomMap.get(bedrooms);
        if (data && data.count > 0) {
          return {
            bedrooms,
            count: data.count,
            avgRevenue: Math.round(data.totalRevenue / data.count),
            avgOccupancy: Math.round(data.totalOccupancy / data.count)
          };
        }
        // Return placeholder for bedroom types with no listings
        return {
          bedrooms,
          count: 0,
          avgRevenue: 0,
          avgOccupancy: 0
        };
      });

      // Generate insights
      const insights = generateInsights(overview, seasonalityData, processedTopPerformers, bedroomBreakdown);

      // Calculate market insights from listings (competition data, revenue percentiles)
      const marketInsights = calculateMarketInsights(allListings as ListingData[]);

      // Process booking patterns for Step 1 Super Experience
      const bookingPatterns = bookingPatternsData ? {
        avgLeadTime: bookingPatternsData.lead_time.avg_days,
        lastMinutePercent: bookingPatternsData.lead_time.last_minute_percent,
        advanceBookingPercent: bookingPatternsData.lead_time.advance_booking_percent,
        avgLengthOfStay: bookingPatternsData.length_of_stay.avg_nights,
        weekendPercent: bookingPatternsData.length_of_stay.weekend_percent,
        weekPlusPercent: bookingPatternsData.length_of_stay.week_percent,
      } : undefined;

      // Extract market scores from market details
      // Note: AirDNA API only provides overall market_score, not individual sub-scores
      // We'll calculate derived scores based on the data we have
      const metrics = (marketDetails as any)?.metrics;
      const marketScores = metrics?.market_score ? {
        overall: Math.round(metrics.market_score),
        // Derive sub-scores from available data (these are estimates based on market performance)
        investability: Math.round(metrics.market_score * 0.95), // Slightly lower than overall
        rentalDemand: Math.round(Math.min(100, (overview.avgOccupancy / 70) * 80)), // Based on occupancy (70% = 80 score)
        revenueGrowth: Math.round(metrics.market_score * 0.85), // Conservative estimate
        seasonality: Math.round(100 - (seasonalityData.monthlyData.length > 0 ? 
          // Calculate variance in occupancy - lower variance = higher score
          Math.min(40, (Math.max(...seasonalityData.monthlyData.map(m => m.occupancy)) - 
           Math.min(...seasonalityData.monthlyData.map(m => m.occupancy))) * 2) : 20)),
        regulation: Math.round(metrics.market_score * 0.9), // Assume decent regulation if market is active
      } : undefined;

      // Calculate competition data from market insights
      const competitionData = marketInsights.total_listings > 0 ? {
        professionallyManagedPct: marketInsights.professionally_managed_pct,
        superhostPct: marketInsights.superhost_pct,
        entireHomePct: marketInsights.property_type_breakdown.find(p => p.type === 'Entire home/apt')?.pct || 0,
        privateRoomPct: marketInsights.property_type_breakdown.find(p => p.type === 'Private room')?.pct || 0,
        sharedRoomPct: marketInsights.property_type_breakdown.find(p => p.type === 'Shared room')?.pct || 0,
        singleHostPct: marketInsights.host_size_breakdown.find(h => h.size === '1 listing')?.pct || 0,
        multiHostPct: 100 - (marketInsights.host_size_breakdown.find(h => h.size === '1 listing')?.pct || 0),
      } : undefined;

      // Extract revenue percentiles
      const revenuePercentiles = marketInsights.revenue_percentiles.p50 > 0 ? {
        p10: marketInsights.revenue_percentiles.p10,
        p25: marketInsights.revenue_percentiles.p25,
        p50: marketInsights.revenue_percentiles.p50,
        p75: marketInsights.revenue_percentiles.p75,
        p90: marketInsights.revenue_percentiles.p90,
      } : undefined;

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
        insights,
        // New Step 1 Super Experience fields
        marketScores,
        bookingPatterns,
        revenuePercentiles,
        competitionData,
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
      
      // Include ALL bedroom types 1-5+ for comprehensive display
      const allBedroomTypes = [1, 2, 3, 4, 5];
      const bedroomBreakdown = allBedroomTypes.map(bedrooms => {
        const data = bedroomMap.get(bedrooms);
        if (data && data.count > 0) {
          return {
            bedrooms,
            count: data.count,
            avgRevenue: Math.round(data.totalRevenue / data.count),
            avgOccupancy: Math.round(data.totalOccupancy / data.count)
          };
        }
        return {
          bedrooms,
          count: 0,
          avgRevenue: 0,
          avgOccupancy: 0
        };
      });
      
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
      console.log(`[getSubmarketReport] Raw metrics from report:`, JSON.stringify(report.submarket.metrics, null, 2));
      
      const overview = {
        totalListings: report.submarket.listing_count || 0,
        avgOccupancy: report.submarket.metrics.occupancy,
        avgAdr: report.submarket.metrics.adr,
        avgRevenue: report.submarket.metrics.revenue,
        avgRevpar: report.submarket.metrics.revpar,
        marketScore: report.submarket.metrics.market_score
      };
      
      console.log(`[getSubmarketReport] Transformed overview:`, JSON.stringify(overview, null, 2));
      
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
      
      // Process bedroom breakdown - ensure ALL bedroom types 1-5+ are included
      const bedroomMap = new Map<number, { count: number; avgRevenue: number; avgOccupancy: number }>();
      report.bedroom_performance.forEach(b => {
        bedroomMap.set(b.bedrooms, {
          count: b.count,
          avgRevenue: b.avg_revenue,
          avgOccupancy: b.avg_occupancy
        });
      });
      
      const allBedroomTypes = [1, 2, 3, 4, 5];
      const bedroomBreakdown = allBedroomTypes.map(bedrooms => {
        const data = bedroomMap.get(bedrooms);
        if (data && data.count > 0) {
          return {
            bedrooms,
            count: data.count,
            avgRevenue: data.avgRevenue,
            avgOccupancy: data.avgOccupancy
          };
        }
        return {
          bedrooms,
          count: 0,
          avgRevenue: 0,
          avgOccupancy: 0
        };
      });
      
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
  // ENHANCED: Added expectedState parameter to validate submarkets match the expected state
  // This fixes the AirDNA data issue where Annapolis, MD (airdna-495) shares the same ID as Salt Lake City, UT
  getSubmarkets: publicProcedure
    .input(z.object({
      marketId: z.string(),
      expectedState: z.string().optional() // State name to validate submarkets against
    }))
    .mutation(async ({ input }) => {
      const { marketId, expectedState } = input;
      console.log(`[getSubmarkets] Getting submarkets for market ${marketId}${expectedState ? ` (expected state: ${expectedState})` : ''}`);
      
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
        
        // STATE VALIDATION: If expectedState is provided, validate that submarkets belong to the expected state
        // This fixes the AirDNA data issue where Annapolis, MD (airdna-495) shares the same ID as Salt Lake City, UT
        if (expectedState) {
          const expectedStateLower = expectedState.toLowerCase();
          
          // Known Utah cities that appear in Salt Lake City submarkets
          // If we see these when expecting a different state, it's a data mismatch
          const UTAH_CITIES = [
            'salt lake', 'draper', 'herriman', 'holladay', 'jordan', 'riverton', 
            'kearns', 'magna', 'midvale', 'millcreek', 'murray', 'sandy', 
            'taylorsville', 'west valley', 'canyon rim', 'slc airport'
          ];
          
          // Check if submarkets contain Utah-specific city names when we're NOT expecting Utah
          if (expectedStateLower !== 'utah') {
            const sampleSubmarkets = allSubmarkets.slice(0, 10);
            const utahMismatchCount = sampleSubmarkets.filter((s: any) => {
              const submarketName = (s.name || '').toLowerCase();
              return UTAH_CITIES.some(city => submarketName.includes(city));
            }).length;
            
            if (utahMismatchCount >= 3) {
              console.log(`[getSubmarkets] STATE MISMATCH DETECTED: Expected ${expectedState} but found ${utahMismatchCount} Utah cities in submarkets`);
              console.log(`[getSubmarkets] Sample submarkets: ${sampleSubmarkets.map((s: any) => s.name).join(', ')}`);
              // Return empty array - the client should fall back to using the market as a submarket
              return [];
            }
          }
        }
        
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

  // In-memory cache for zip codes (TTL: 30 minutes)
  // This significantly speeds up repeated requests for the same submarket
  
  // Get all zip codes within a submarket with ACCURATE listing counts
  // STRATEGY: Fetch multiple pages to get accurate zip code distribution, then
  // extrapolate to get estimated listing counts based on the sample
  getZipcodesInSubmarket: publicProcedure
    .input(z.object({
      submarketId: z.string(),
      marketId: z.string().optional(), // For fallback to market-level listings
      submarketListingCount: z.number().optional() // Total listings in submarket for accurate calculation
    }))
    .mutation(async ({ input }) => {
      const { submarketId, marketId, submarketListingCount } = input;
      const startTime = Date.now();
      console.log(`[getZipcodesInSubmarket] Getting zip codes for submarket ${submarketId} (total: ${submarketListingCount || 'unknown'})`);
      
      // Check cache first
      const cacheKey = `zipcodes_${submarketId}`;
      const cached = zipcodeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
        console.log(`[getZipcodesInSubmarket] Cache hit! Returning ${cached.data.length} zip codes in ${Date.now() - startTime}ms`);
        return cached.data;
      }
      
      try {
        // Fetch multiple pages in parallel to get a better sample (up to 200 listings)
        const pageSize = 25;
        const pagesToFetch = Math.min(8, Math.ceil((submarketListingCount || 200) / pageSize)); // Up to 8 pages (200 listings)
        
        // Helper to fetch from submarket API
        const fetchSubmarketPage = async (offset: number) => {
          const response = await fetch(
            `https://api.airdna.co/api/enterprise/v2/submarket/${submarketId}/listings`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.AIRDNA_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                pagination: { page_size: pageSize, offset }
              })
            }
          );
          return response.json();
        };
        
        // Helper to fetch from market API (for when submarketId is actually a market)
        const fetchMarketPage = async (offset: number) => {
          const response = await fetch(
            `https://api.airdna.co/api/enterprise/v2/market/${submarketId}/listings`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.AIRDNA_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                pagination: { page_size: pageSize, offset }
              })
            }
          );
          return response.json();
        };
        
        // Try submarket API first
        let firstPageData = await fetchSubmarketPage(0);
        let fetchPage = fetchSubmarketPage;
        let apiType = 'submarket';
        
        // If submarket API fails, try market API with the same ID
        if (firstPageData.status?.type === 'error' || !firstPageData.payload?.listings) {
          console.log(`[getZipcodesInSubmarket] Submarket API failed, trying market API with same ID...`);
          firstPageData = await fetchMarketPage(0);
          fetchPage = fetchMarketPage;
          apiType = 'market';
          
          // If market API also fails, try fallback marketId if provided
          if (firstPageData.status?.type === 'error' || !firstPageData.payload?.listings) {
            console.log(`[getZipcodesInSubmarket] Market API also failed, trying fallback marketId...`);
            if (marketId && marketId !== submarketId) {
              return await fetchZipcodesFromMarket(marketId, startTime);
            }
            console.error(`[getZipcodesInSubmarket] All API attempts failed:`, firstPageData.status?.message);
            return [];
          }
        }
        
        console.log(`[getZipcodesInSubmarket] Using ${apiType} API for ${submarketId}`);
        
        const totalCount = firstPageData.payload?.page_info?.total_count || 0;
        const allListings = [...(firstPageData.payload?.listings || [])];
        
        // Fetch additional pages in parallel if there are more listings
        if (totalCount > pageSize) {
          const additionalPages = Math.min(pagesToFetch - 1, Math.ceil(totalCount / pageSize) - 1);
          console.log(`[getZipcodesInSubmarket] Fetching ${additionalPages} additional pages for better accuracy...`);
          
          const pagePromises = [];
          for (let i = 1; i <= additionalPages; i++) {
            pagePromises.push(fetchPage(i * pageSize));
          }
          
          const additionalData = await Promise.all(pagePromises);
          additionalData.forEach(data => {
            if (data.payload?.listings) {
              allListings.push(...data.payload.listings);
            }
          });
        }
        
        console.log(`[getZipcodesInSubmarket] Sampled ${allListings.length} of ${totalCount} total listings`);
        
        // Debug: Log first listing to see available fields
        if (allListings.length > 0) {
          console.log(`[getZipcodesInSubmarket] Sample listing fields:`, Object.keys(allListings[0]));
          console.log(`[getZipcodesInSubmarket] Sample listing zipcode field:`, allListings[0].zipcode, allListings[0].zip_code, allListings[0].postal_code, allListings[0].location);
        }
        
        // Count listings per zip code from our sample
        // Check multiple possible field names for zip code
        const zipcodeSampleCounts = new Map<string, number>();
        let listingsWithZip = 0;
        let listingsWithoutZip = 0;
        allListings.forEach((l: any) => {
          const zip = l.zipcode || l.zip_code || l.postal_code || l.location?.zipcode || l.location?.postal_code;
          if (zip) {
            zipcodeSampleCounts.set(zip, (zipcodeSampleCounts.get(zip) || 0) + 1);
            listingsWithZip++;
          } else {
            listingsWithoutZip++;
          }
        });
        console.log(`[getZipcodesInSubmarket] Listings with zip: ${listingsWithZip}, without zip: ${listingsWithoutZip}`);
        
        // Calculate estimated actual counts based on sample proportion
        const sampleSize = allListings.length;
        const zipcodesWithCounts = Array.from(zipcodeSampleCounts.entries())
          .map(([zipcode, sampleCount]) => {
            // Extrapolate to get estimated actual count
            const proportion = sampleCount / sampleSize;
            const estimatedCount = Math.round(proportion * totalCount);
            return { 
              zipcode, 
              listingCount: estimatedCount > 0 ? estimatedCount : sampleCount 
            };
          })
          .sort((a, b) => b.listingCount - a.listingCount); // Sort by listing count descending
        
        // Cache the results
        zipcodeCache.set(cacheKey, { data: zipcodesWithCounts, timestamp: Date.now() });
        
        console.log(`[getZipcodesInSubmarket] Found ${zipcodesWithCounts.length} unique zip codes with estimated counts in ${Date.now() - startTime}ms`);
        console.log(`[getZipcodesInSubmarket] Top zip codes:`, zipcodesWithCounts.slice(0, 5));
        
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

// Fallback function to fetch zip codes from market-level listings
async function fetchZipcodesFromMarket(marketId: string, startTime: number) {
  try {
    console.log(`[fetchZipcodesFromMarket] Fetching zip codes from market ${marketId}`);
    const result = await getMarketListings(marketId, { limit: 200 });
    const listings = result.listings || [];
    
    if (!listings || listings.length === 0) {
      console.log(`[fetchZipcodesFromMarket] No listings found for market ${marketId}`);
      return [];
    }
    
    // Count listings per zip code
    const zipcodeCounts = new Map<string, number>();
    listings.forEach((l: any) => {
      const zip = l.zipcode || l.zip_code;
      if (zip) {
        zipcodeCounts.set(zip, (zipcodeCounts.get(zip) || 0) + 1);
      }
    });
    
    // Convert to array with listing counts and sort by zip code
    const zipcodesWithCounts = Array.from(zipcodeCounts.entries())
      .map(([zipcode, count]) => ({ zipcode, listingCount: count }))
      .sort((a, b) => a.zipcode.localeCompare(b.zipcode));
    
    console.log(`[fetchZipcodesFromMarket] Found ${zipcodesWithCounts.length} unique zip codes from market in ${Date.now() - startTime}ms`);
    
    return zipcodesWithCounts;
  } catch (error) {
    console.error(`[fetchZipcodesFromMarket] Error:`, error);
    return [];
  }
}

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

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getMarketListings, getSubmarketListings, getSubmarketsInMarket, searchMarkets, searchMarketsAPI } from "../airdna";

export const marketExplorerRouter = router({
    // Search for markets/submarkets by city or neighborhood name
    searchMarkets: publicProcedure
      .input(z.object({
        query: z.string().min(2),
        limit: z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        try {
          const results = await searchMarketsAPI(input.query);
          
          // Return top results with zip codes included
          return results.slice(0, input.limit).map(r => ({
            id: r.id,
            name: r.name,
            type: r.type,
            listingCount: r.listing_count,
            state: r.state,
            country: r.country,
            parentMarket: r.parent_market,
            zipcodes: r.zipcodes || [],
          }));
        } catch (error) {
          console.error('[marketExplorer.searchMarkets] Error:', error);
          return [];
        }
      }),

    // Get listings for a market with images
    getListings: publicProcedure
      .input(z.object({
        marketId: z.string(),
        marketType: z.enum(['market', 'submarket']).default('market'),
        bedrooms: z.number().optional(),
        propertyType: z.string().optional(),
        minRating: z.number().optional(),
        sortBy: z.enum(['revenue', 'occupancy', 'adr', 'rating']).optional().default('revenue'),
        limit: z.number().optional().default(100),
      }))
      .query(async ({ input }) => {
        try {
          console.log('[marketExplorer.getListings] Input:', JSON.stringify(input));
          
          // Build filters
          const filters: any = {};
          if (input.bedrooms !== undefined && input.bedrooms !== null) filters.bedrooms = input.bedrooms;
          if (input.propertyType) filters.propertyType = input.propertyType;
          if (input.minRating) filters.minRating = input.minRating;

          console.log('[marketExplorer.getListings] Calling API with marketId:', input.marketId, 'filters:', filters);
          
          // Fetch multiple pages to get more listings (AirDNA API max is 25 per page)
          const pageSize = 25;
          const targetCount = Math.min(input.limit || 100, 100);
          const pagesToFetch = Math.ceil(targetCount / pageSize);
          
          let allListings: any[] = [];
          let totalCount = 0;
          
          for (let page = 0; page < pagesToFetch; page++) {
            const offset = page * pageSize;
            console.log(`[marketExplorer.getListings] Fetching page ${page + 1}/${pagesToFetch} (offset: ${offset})`);
            
            const result = input.marketType === 'submarket'
              ? await getSubmarketListings(input.marketId, {
                  limit: pageSize,
                  offset,
                  orderBy: input.sortBy,
                  orderDirection: 'desc',
                  filters: Object.keys(filters).length > 0 ? filters : undefined,
                })
              : await getMarketListings(input.marketId, {
                  limit: pageSize,
                  offset,
                  orderBy: input.sortBy,
                  orderDirection: 'desc',
                  filters: Object.keys(filters).length > 0 ? filters : undefined,
                });
            
            if (result.listings && result.listings.length > 0) {
              allListings = [...allListings, ...result.listings];
              totalCount = result.total_count || totalCount;
            }
            
            // Stop if we've fetched all available listings
            if (result.listings.length < pageSize) break;
          }
          
          console.log(`[marketExplorer.getListings] Fetched ${allListings.length} total listings`);
          
          // Use the combined results
          const result = { listings: allListings, total_count: totalCount };

          // Calculate summary stats
          const listings = result.listings || [];
          const revenues = listings.map(l => l.annual_revenue).filter(r => r > 0);
          const occupancies = listings.map(l => l.occupancy).filter(o => o > 0);
          const adrs = listings.map(l => l.adr).filter(a => a > 0);
          
          const avgRevenue = revenues.length > 0 
            ? revenues.reduce((a, b) => a + b, 0) / revenues.length 
            : 0;
          const avgOccupancy = occupancies.length > 0 
            ? occupancies.reduce((a, b) => a + b, 0) / occupancies.length 
            : 0;
          const avgAdr = adrs.length > 0
            ? adrs.reduce((a, b) => a + b, 0) / adrs.length
            : 0;
          const topRevenue = revenues.length > 0 ? Math.max(...revenues) : 0;
          const topOccupancy = occupancies.length > 0 ? Math.max(...occupancies) : 0;

          return {
            listings: listings.map(l => ({
              id: l.id,
              title: l.title,
              imageUrl: l.image_url || null,
              images: l.images || [],
              airbnbUrl: l.airbnb_url || null,
              bedrooms: l.bedrooms,
              bathrooms: l.bathrooms,
              annualRevenue: l.annual_revenue,
              occupancyRate: l.occupancy,
              adr: l.adr,
              rating: l.rating,
              reviewCount: l.reviews,
              superhost: l.superhost,
              professionallyManaged: l.professionally_managed,
              zipcode: l.zipcode || null,
              daysAvailable: l.days_available || null,
              daysReserved: l.days_reserved || null,
              latitude: l.latitude || null,
              longitude: l.longitude || null,
            })),
            totalCount: result.total_count || listings.length,
            summary: {
              avgRevenue: Math.round(avgRevenue),
              avgOccupancy: Math.round(avgOccupancy * 100) / 100,
              avgAdr: Math.round(avgAdr),
              topRevenue: Math.round(topRevenue),
              topOccupancy: Math.round(topOccupancy * 100) / 100,
              topEarnerMultiple: avgRevenue > 0 ? Math.round((topRevenue / avgRevenue) * 10) / 10 : 0,
            },
          };
        } catch (error) {
          console.error('[marketExplorer.getListings] Error:', error);
          return {
            listings: [],
            totalCount: 0,
            summary: {
              avgRevenue: 0,
              avgOccupancy: 0,
              avgAdr: 0,
              topRevenue: 0,
              topOccupancy: 0,
              topEarnerMultiple: 0,
            },
          };
        }
      }),

    // Get neighborhoods (submarkets) for a market
    getNeighborhoods: publicProcedure
      .input(z.object({
        marketId: z.string(),
      }))
      .query(async ({ input }) => {
        try {
          const submarkets = await getSubmarketsInMarket(input.marketId);
          
          // Sort by revenue descending
          const sorted = submarkets.sort((a, b) => 
            (b.metrics?.revenue || 0) - (a.metrics?.revenue || 0)
          );

          return sorted.map(s => ({
            id: s.id,
            name: s.name,
            listingCount: s.listing_count,
            avgRevenue: s.metrics?.revenue || 0,
            avgOccupancy: s.metrics?.occupancy || 0,
            avgAdr: s.metrics?.adr || 0,
            marketScore: s.metrics?.market_score || 0,
          }));
        } catch (error) {
          console.error('[marketExplorer.getNeighborhoods] Error:', error);
          return [];
        }
      }),
});

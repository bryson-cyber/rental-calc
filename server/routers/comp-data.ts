import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getAllMarketListings, getAllSubmarketListings, getMarketHistoricalData, getMarketListings, getSubmarketListings } from "../airdna";
import { geocodeZipCodeToMarket } from "../airdna-hierarchy";
import { recordApiCallsUsage } from "../usage-limits";

export const compDataRouter = router({
    getListings: publicProcedure
      .input(z.object({
        submarketId: z.string(),
        isMarketLevel: z.boolean().default(false), // true = city/metro level, false = neighborhood level
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
        orderBy: z.enum(['revenue', 'adr', 'occupancy', 'rating']).default('revenue'),
        orderDirection: z.enum(['asc', 'desc']).default('desc'),
        bedrooms: z.number().int().min(1).max(20).optional(), // Filter by specific bedroom count
      }))
      .query(async ({ input, ctx }) => {
        try {
          const offset = (input.page - 1) * input.pageSize;
          
          // Build filters object if bedrooms is specified
          const filters = input.bedrooms ? { bedrooms: input.bedrooms } : undefined;
          console.log(`[CompData.getListings] Input:`, { submarketId: input.submarketId, isMarketLevel: input.isMarketLevel, page: input.page, bedrooms: input.bedrooms, filters });
          console.log(`[CompData.getListings] Calling ${input.isMarketLevel ? 'getMarketListings' : 'getSubmarketListings'} with filters:`, JSON.stringify(filters));
          
          // Use the appropriate function based on whether it's a market or submarket search
          const result = input.isMarketLevel 
            ? await getMarketListings(input.submarketId, {
                limit: input.pageSize,
                offset,
                orderBy: input.orderBy,
                orderDirection: input.orderDirection,
                filters,
              })
            : await getSubmarketListings(input.submarketId, {
                limit: input.pageSize,
                offset,
                orderBy: input.orderBy,
                orderDirection: input.orderDirection,
                filters,
              });

          if (!result) {
            return {
              success: false,
              error: 'Could not fetch listings',
              listings: [],
              totalCount: 0,
            };
          }

          // Transform listings to match frontend interface
          const listings = result.listings.map((listing: any) => ({
            id: listing.id || listing.airbnb_listing_id || listing.property_id || String(Math.random()),
            title: listing.title || 'Untitled Listing',
            property_type: listing.property_type || 'unknown',
            bedrooms: listing.bedrooms ?? 0,
            bathrooms: listing.bathrooms ?? 0,
            accommodates: listing.accommodates || 0,
            annual_revenue: listing.annual_revenue || listing.revenue_ltm || listing.revenue || 0,
            adr: listing.adr || listing.average_daily_rate_ltm || 0,
            occupancy: listing.occupancy || listing.occupancy_rate_ltm || 0,
            rating: listing.rating || null,
            reviews: listing.reviews || 0,
            airbnb_url: listing.airbnb_url || listing.airbnb_property_url || listing.url || `https://www.airbnb.com/rooms/${listing.airbnb_property_id || listing.airbnb_listing_id || ''}`,
            image_url: listing.image_url || listing.thumbnail_url || (listing.images && listing.images[0]) || '',
            is_superhost: listing.is_superhost || listing.superhost || false,
            // Add coordinates - check both direct properties and location object
            latitude: listing.latitude || listing.location?.lat || null,
            longitude: listing.longitude || listing.location?.lng || null,
            exact_location: listing.exact_location || false,
          }));

          // Record AirDNA API usage
          const userId = ctx.user?.id;
          const ipAddress = ctx.req?.ip || ctx.req?.socket?.remoteAddress;
          await recordApiCallsUsage(userId, undefined, ipAddress, 1).catch(err =>
            console.error('[CompData.getListings] Error recording usage:', err)
          );

          return {
            success: true,
            listings,
            totalCount: result.total_count || listings.length,
          };
        } catch (error) {
          console.error('[CompData.getListings] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch listings',
            listings: [],
            totalCount: 0,
          };
        }
      }),

    // Get ALL listings for a market/submarket (with pagination to bypass 25 limit)
    getAllListings: publicProcedure
      .input(z.object({
        submarketId: z.string(),
        isMarketLevel: z.boolean().default(false),
        maxListings: z.number().int().min(25).max(500).default(200),
        bedrooms: z.number().int().min(1).max(20).optional(),
      }))
      .query(async ({ input, ctx }) => {
        try {
          console.log(`\n========================================`);
          console.log(`[CompData.getAllListings] REQUEST RECEIVED`);
          console.log(`  - submarketId: ${input.submarketId}`);
          console.log(`  - isMarketLevel: ${input.isMarketLevel}`);
          console.log(`  - maxListings: ${input.maxListings}`);
          console.log(`  - bedrooms: ${input.bedrooms || 'all'}`);
          console.log(`========================================`);
          
          // Use the appropriate function based on whether it's a market or submarket search
          const allListingsResult = input.isMarketLevel 
            ? await getAllMarketListings(input.submarketId, {
                bedrooms: input.bedrooms,
                maxListings: input.maxListings,
                minFilteredCount: 10,
              })
            : await getAllSubmarketListings(input.submarketId, {
                bedrooms: input.bedrooms,
                maxListings: input.maxListings,
                minFilteredCount: 10,
              });
          
          // Handle both old array format and new { listings, total_count } format
          const allListings = Array.isArray(allListingsResult) ? allListingsResult : allListingsResult.listings;
          const marketTotalCount = Array.isArray(allListingsResult) ? allListings.length : (allListingsResult.total_count || allListings.length);

          console.log(`[CompData.getAllListings] Fetched ${allListings.length} listings (market total: ${marketTotalCount})`);
          if (allListings.length > 0) {
            console.log(`[CompData.getAllListings] First listing title: "${allListings[0].title}"`);
            console.log(`[CompData.getAllListings] First listing lat/lng: ${allListings[0].latitude}, ${allListings[0].longitude}`);
          }

          // Transform listings to match frontend interface
          const listings = allListings.map((listing: any) => ({
            id: listing.id || listing.airbnb_listing_id || listing.property_id || String(Math.random()),
            title: listing.title || 'Untitled Listing',
            property_type: listing.property_type || 'unknown',
            bedrooms: listing.bedrooms ?? 0,
            bathrooms: listing.bathrooms ?? 0,
            accommodates: listing.accommodates || 0,
            annual_revenue: listing.annual_revenue || listing.revenue_ltm || listing.revenue || 0,
            adr: listing.adr || listing.average_daily_rate_ltm || 0,
            occupancy: listing.occupancy || listing.occupancy_rate_ltm || 0,
            rating: listing.rating || null,
            reviews: listing.reviews || 0,
            airbnb_url: listing.airbnb_url || listing.airbnb_property_url || listing.url || `https://www.airbnb.com/rooms/${listing.airbnb_property_id || listing.airbnb_listing_id || ''}`,
            image_url: listing.image_url || listing.thumbnail_url || (listing.images && listing.images[0]) || '',
            is_superhost: listing.is_superhost || listing.superhost || false,
            latitude: listing.latitude || listing.location?.lat || null,
            longitude: listing.longitude || listing.location?.lng || null,
            exact_location: listing.exact_location || false,
          }));

          // Record AirDNA API usage (multiple pages fetched)
          const userId = ctx.user?.id;
          const ipAddress = ctx.req?.ip || ctx.req?.socket?.remoteAddress;
          const pagesEstimate = Math.ceil(listings.length / 25);
          await recordApiCallsUsage(userId, undefined, ipAddress, pagesEstimate).catch(err =>
            console.error('[CompData.getAllListings] Error recording usage:', err)
          );

          return {
            success: true,
            listings,
            totalCount: listings.length,
            marketTotalCount, // The actual total count in the market (not just sampled)
          };
        } catch (error) {
          console.error('[CompData.getAllListings] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch all listings',
            listings: [],
            totalCount: 0,
            marketTotalCount: 0,
          };
        }
      }),

    getHistoricalData: publicProcedure
      .input(z.object({
        marketId: z.string(),
        numMonths: z.number().int().min(12).max(60).default(24),
      }))
      .query(async ({ input, ctx }) => {
        try {
          const result = await getMarketHistoricalData(input.marketId, input.numMonths);

          if (!result) {
            return {
              success: false,
              error: 'Could not fetch historical data',
              data: {
                occupancy: [],
                revenue: [],
                adr: [],
                listings: [],
              },
            };
          }

          // Transform to match frontend interface
          const transformData = (dataPoints: any[], multiplier: number = 1) => 
            (dataPoints || []).map((d: any) => ({
              month: d.month || d.date || '',
              value: (d.value || d.avg || 0) * multiplier,
            }));

          // Record AirDNA API usage (4 metric types fetched)
          const userId = ctx.user?.id;
          const ipAddress = ctx.req?.ip || ctx.req?.socket?.remoteAddress;
          await recordApiCallsUsage(userId, undefined, ipAddress, 4).catch(err =>
            console.error('[CompData.getHistoricalData] Error recording usage:', err)
          );

          return {
            success: true,
            data: {
              occupancy: transformData(result.occupancy),
              // API returns monthly avg_revenue, multiply by 12 to get annual income
              revenue: transformData(result.revenue, 12),
              adr: transformData(result.adr),
              listings: transformData(result.active_listings),
            },
          };
        } catch (error) {
          console.error('[CompData.getHistoricalData] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch historical data',
            data: {
              occupancy: [],
              revenue: [],
              adr: [],
              listings: [],
            },
          };
        }
      }),

    // Get listings by zip code - auto-finds market/submarket and fetches listings
    getListingsByZipcode: publicProcedure
      .input(z.object({
        zipcode: z.string().length(5),
        pageSize: z.number().int().min(1).max(100).default(50),
      }))
      .query(async ({ input, ctx }) => {
        try {
          console.log(`[CompData.getListingsByZipcode] Looking up zip code: ${input.zipcode}`);
          
          // First, geocode the zip code to find the market/submarket
          const geoResult = await geocodeZipCodeToMarket(input.zipcode);
          
          if (!geoResult.success) {
            console.log(`[CompData.getListingsByZipcode] Geocode failed:`, geoResult.error);
            return {
              success: false,
              error: geoResult.error || 'Could not find market for this zip code',
              listings: [],
              totalCount: 0,
              market: null,
              submarket: null,
            };
          }
          
          // Get the market ID to fetch listings from
          let marketId: string | null = null;
          if (geoResult.submarket) {
            marketId = geoResult.submarket.id;
          } else if (geoResult.market) {
            marketId = geoResult.market.id;
          }
          
          if (!marketId) {
            return {
              success: false,
              error: 'No market found for this zip code',
              listings: [],
              totalCount: 0,
              market: geoResult.market || null,
              submarket: geoResult.submarket || null,
            };
          }
          
          console.log(`[CompData.getListingsByZipcode] Fetching ALL listings for market: ${marketId}`);
          
          // Fetch ALL listings for this market (with pagination to bypass 25 limit)
          const allListings = await getAllSubmarketListings(marketId, {
            maxListings: 200,
            minFilteredCount: 10,
          });
          
          const result = {
            listings: allListings,
            total_count: allListings.length,
          };
          
          if (!result) {
            return {
              success: false,
              error: 'Could not fetch listings',
              listings: [],
              totalCount: 0,
              market: geoResult.market || null,
              submarket: geoResult.submarket || null,
            };
          }
          
          // Transform listings to match frontend interface
          const listings = result.listings.map((listing: any) => ({
            id: listing.id || listing.airbnb_listing_id || listing.property_id || String(Math.random()),
            title: listing.title || 'Untitled Listing',
            property_type: listing.property_type || 'unknown',
            bedrooms: listing.bedrooms ?? 0,
            bathrooms: listing.bathrooms ?? 0,
            accommodates: listing.accommodates || 0,
            annual_revenue: listing.annual_revenue || listing.revenue_ltm || listing.revenue || 0,
            adr: listing.adr || listing.average_daily_rate_ltm || 0,
            occupancy: listing.occupancy || listing.occupancy_rate_ltm || 0,
            rating: listing.rating || null,
            reviews: listing.reviews || 0,
            airbnb_url: listing.airbnb_url || listing.airbnb_property_url || listing.url || `https://www.airbnb.com/rooms/${listing.airbnb_property_id || listing.airbnb_listing_id || ''}`,
            image_url: listing.image_url || listing.thumbnail_url || (listing.images && listing.images[0]) || '',
            is_superhost: listing.is_superhost || listing.superhost || false,
            latitude: listing.latitude || listing.location?.lat || null,
            longitude: listing.longitude || listing.location?.lng || null,
            exact_location: listing.exact_location || false,
          }));
          
          console.log(`[CompData.getListingsByZipcode] Found ${listings.length} listings for zip ${input.zipcode}`);
          
          // Record AirDNA API usage (geocode + listing pages)
          const userId = ctx.user?.id;
          const ipAddress = ctx.req?.ip || ctx.req?.socket?.remoteAddress;
          const pagesEstimate = Math.ceil(listings.length / 25) + 1; // +1 for geocode
          await recordApiCallsUsage(userId, undefined, ipAddress, pagesEstimate).catch(err =>
            console.error('[CompData.getListingsByZipcode] Error recording usage:', err)
          );

          return {
            success: true,
            listings,
            totalCount: result.total_count || listings.length,
            market: geoResult.market || null,
            submarket: geoResult.submarket || null,
            coordinates: geoResult.coordinates,
          };
        } catch (error) {
          console.error('[CompData.getListingsByZipcode] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch listings',
            listings: [],
            totalCount: 0,
            market: null,
            submarket: null,
          };
        }
      }),
});

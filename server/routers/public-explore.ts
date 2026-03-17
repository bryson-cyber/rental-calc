import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  searchMarketsAPI,
  getMarketListings,
  getSubmarketListings,
  getRentalizerEstimate,
} from "../airdna";

/**
 * Public Explore Router
 *
 * Provides public (no-auth) endpoints for the /explore page.
 * These mirror the admin-only marketExplorer endpoints but are
 * rate-limited and scoped for unauthenticated lead access.
 */
export const publicExploreRouter = router({
  /**
   * Search for markets by city/neighborhood name.
   * Public version of marketExplorer.searchMarkets.
   * Capped at 8 results.
   */
  searchMarkets: publicProcedure
    .input(
      z.object({
        query: z.string().min(2).max(100),
      })
    )
    .query(async ({ input }) => {
      try {
        const results = await searchMarketsAPI(input.query);
        return results.slice(0, 8).map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          listingCount: r.listing_count,
          state: r.state,
          country: r.country,
        }));
      } catch (error) {
        console.error("[publicExplore.searchMarkets] Error:", error);
        return [];
      }
    }),

  /**
   * Get listings for a market.
   * Public version of marketExplorer.getListings.
   * Capped at 25 listings (1 page) for public access.
   */
  getListings: publicProcedure
    .input(
      z.object({
        marketId: z.string(),
        marketType: z.enum(["market", "submarket"]).default("market"),
        bedrooms: z.number().optional(),
        sortBy: z
          .enum(["revenue", "occupancy", "adr", "rating"])
          .optional()
          .default("revenue"),
      })
    )
    .query(async ({ input }) => {
      try {
        const filters: any = {};
        if (input.bedrooms !== undefined && input.bedrooms !== null) {
          filters.bedrooms = input.bedrooms;
        }

        // Public access: single page of 25 listings
        const result =
          input.marketType === "submarket"
            ? await getSubmarketListings(input.marketId, {
                limit: 25,
                offset: 0,
                orderBy: input.sortBy,
                orderDirection: "desc",
                filters:
                  Object.keys(filters).length > 0 ? filters : undefined,
              })
            : await getMarketListings(input.marketId, {
                limit: 25,
                offset: 0,
                orderBy: input.sortBy,
                orderDirection: "desc",
                filters:
                  Object.keys(filters).length > 0 ? filters : undefined,
              });

        const listings = result.listings || [];

        // Calculate summary stats
        const revenues = listings
          .map((l) => l.annual_revenue)
          .filter((r) => r > 0);
        const occupancies = listings.map((l) => l.occupancy).filter((o) => o > 0);
        const adrs = listings.map((l) => l.adr).filter((a) => a > 0);

        const avgRevenue =
          revenues.length > 0
            ? revenues.reduce((a, b) => a + b, 0) / revenues.length
            : 0;
        const avgOccupancy =
          occupancies.length > 0
            ? occupancies.reduce((a, b) => a + b, 0) / occupancies.length
            : 0;
        const avgAdr =
          adrs.length > 0
            ? adrs.reduce((a, b) => a + b, 0) / adrs.length
            : 0;
        const topRevenue =
          revenues.length > 0 ? Math.max(...revenues) : 0;

        return {
          listings: listings.map((l) => ({
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
          })),
          totalCount: result.total_count || listings.length,
          summary: {
            avgRevenue: Math.round(avgRevenue),
            avgOccupancy:
              Math.round(avgOccupancy * 100) / 100,
            avgAdr: Math.round(avgAdr),
            topRevenue: Math.round(topRevenue),
          },
        };
      } catch (error) {
        console.error("[publicExplore.getListings] Error:", error);
        return {
          listings: [],
          totalCount: 0,
          summary: {
            avgRevenue: 0,
            avgOccupancy: 0,
            avgAdr: 0,
            topRevenue: 0,
          },
        };
      }
    }),

  /**
   * Quick property estimate (public).
   * Uses the existing public getEstimate from rental router.
   */
  getEstimate: publicProcedure
    .input(
      z.object({
        address: z.string().min(1),
        bedrooms: z.number().int().min(0).max(20).optional(),
        bathrooms: z.number().min(0.5).max(20).optional(),
        accommodates: z.number().int().min(1).max(50).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await getRentalizerEstimate(input);
        if (!result || !result.estimates) {
          return { success: false as const, error: "No data available for this address" };
        }

        return {
          success: true as const,
          property: {
            address: input.address,
            bedrooms: result.property?.bedrooms || input.bedrooms,
            bathrooms: result.property?.bathrooms || input.bathrooms,
          },
          estimates: {
            annualRevenue: result.estimates.annual_revenue || 0,
            annualRevenueLow: result.estimates.annual_revenue_low || 0,
            annualRevenueHigh: result.estimates.annual_revenue_high || 0,
            averageDailyRate: result.estimates.average_daily_rate || 0,
            occupancyRate: (result.estimates.occupancy_rate || 0) * 100, // Convert to percentage
          },
          monthlyForecast: (result.monthly_forecast || [])
            .slice(0, 12)
            .map((m) => ({
              month: m.month,
              revenue: m.revenue || 0,
              adr: m.adr || 0,
              occupancy: (m.occupancy || 0) * 100, // Convert decimal to percentage
            })),
        };
      } catch (error) {
        console.error("[publicExplore.getEstimate] Error:", error);
        return { success: false as const, error: "Unable to generate estimate" };
      }
    }),
});

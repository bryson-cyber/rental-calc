import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getCountryMarkets } from "../airdna";

export const marketDiscoveryRouter = router({
    // Get all markets in a country with filtering
    getCountryMarkets: publicProcedure
      .input(z.object({
        countryCode: z.string().default('us'),
        minMarketScore: z.number().min(0).max(100).optional(),
        minInvestability: z.number().min(0).max(100).optional(),
        minRentalDemand: z.number().min(0).max(100).optional(),
        minRevenueGrowth: z.number().optional(),
        marketType: z.enum(['coastal', 'urban_metro', 'mountains_lakes', 'suburban', 'rural', 'mid_size_city', 'all']).default('all'),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        try {
          console.log('[MarketDiscovery] Fetching markets for:', input.countryCode);
          
          const result = await getCountryMarkets(input.countryCode, {
            market_type: input.marketType === 'all' ? undefined : input.marketType as "coastal" | "urban_metro" | "mountains_lakes" | "suburban" | "rural" | "mid_size_city",
            min_market_score: input.minMarketScore,
            min_investability: input.minInvestability,
            min_rental_demand: input.minRentalDemand,
            min_revenue_growth: input.minRevenueGrowth,
            limit: input.limit,
            offset: input.offset,
          });
          
          return {
            success: true,
            data: result.markets,
            total: result.total_count,
          };
        } catch (error) {
          console.error('[MarketDiscovery] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch markets',
            data: [],
            total: 0,
          };
        }
      }),
});

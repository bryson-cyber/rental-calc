import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { compareMarkets } from "../airdna";

export const marketComparisonRouter = router({
    // Compare multiple markets side-by-side
    compare: adminProcedure
      .input(z.object({
        marketIds: z.array(z.string()).min(2).max(5),
        bedrooms: z.number().int().min(0).max(10).optional(),
      }))
      .query(async ({ input }) => {
        try {
          console.log('[MarketComparison] Comparing markets:', input.marketIds);
          
          const result = await compareMarkets(input.marketIds, {
            bedrooms: input.bedrooms,
          });
          
          if (!result) {
            return {
              success: false,
              error: 'Could not compare markets',
              data: null,
            };
          }
          
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('[MarketComparison] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to compare markets',
            data: null,
          };
        }
      }),
});

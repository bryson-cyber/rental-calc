import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getRentalizerBulkSummary } from "../airdna";

export const bulkSummaryRouter = router({
    get: publicProcedure
      .input(z.object({
        queries: z.array(z.object({
          address: z.string().min(1),
          bedrooms: z.number().int().min(1).max(20).optional(),
          bathrooms: z.number().min(0.5).max(20).optional(),
          accommodates: z.number().int().min(1).max(50).optional(),
        })).min(1).max(25),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await getRentalizerBulkSummary(input.queries);

          if (!result) {
            return {
              success: false,
              error: "Could not fetch bulk summary",
              data: null,
            };
          }

          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('[BulkSummary] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch bulk summary',
            data: null,
          };
        }
      }),
});

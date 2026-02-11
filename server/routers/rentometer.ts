import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { analyzeRentVsMarket, getRentSummary } from "../rentometer";

export const rentometerRouter = router({
    // Get rent summary for an address
    getRentSummary: publicProcedure
      .input(z.object({
        address: z.string().min(1, "Address is required"),
        bedrooms: z.number().int().min(0).max(6),
        baths: z.enum(["1", "1.5+"]).optional(),
        buildingType: z.enum(["apartment", "house"]).optional(),
        lookBackDays: z.number().int().min(90).max(1460).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Rentometer] Getting rent summary for:', input.address);
          const result = await getRentSummary(input);
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('[Rentometer] Error getting rent summary:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get rent summary',
            data: null,
          };
        }
      }),

    // Analyze user's rent vs market data
    analyzeRent: publicProcedure
      .input(z.object({
        address: z.string().min(1, "Address is required"),
        bedrooms: z.number().int().min(0).max(6),
        userRent: z.number().min(0),
        baths: z.enum(["1", "1.5+"]).optional(),
        buildingType: z.enum(["apartment", "house"]).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Rentometer] Analyzing rent for:', input.address, 'user rent:', input.userRent);
          const result = await analyzeRentVsMarket(
            input.address,
            input.bedrooms,
            input.userRent
          );
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('[Rentometer] Error analyzing rent:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to analyze rent',
            data: null,
          };
        }
      }),
});

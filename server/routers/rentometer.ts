import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { analyzeRentVsMarket, getRentSummary, getPropertyRents, getNearbyComps, getComprehensiveRentometerData } from "../rentometer";

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

    // Get property rents (recently listed rents at a specific address)
    getPropertyRents: publicProcedure
      .input(z.object({
        address: z.string().min(1, "Address is required"),
        maxAge: z.number().int().min(1).max(30).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Rentometer] Getting property rents for:', input.address);
          const result = await getPropertyRents(input);
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('[Rentometer] Error getting property rents:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get property rents',
            data: null,
          };
        }
      }),

    // Get nearby comps (comparable rental properties sorted by distance)
    getNearbyComps: publicProcedure
      .input(z.object({
        address: z.string().min(1, "Address is required"),
        bedrooms: z.number().int().min(0).max(6),
        baths: z.enum(["1", "1.5+"]).optional(),
        buildingType: z.enum(["apartment", "house"]).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Rentometer] Getting nearby comps for:', input.address);
          const result = await getNearbyComps(input);
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('[Rentometer] Error getting nearby comps:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get nearby comps',
            data: null,
          };
        }
      }),

    // Get comprehensive Rentometer data (all endpoints in one call)
    getComprehensiveData: publicProcedure
      .input(z.object({
        address: z.string().min(1, "Address is required"),
        bedrooms: z.number().int().min(0).max(6),
        baths: z.enum(["1", "1.5+"]).optional(),
        buildingType: z.enum(["apartment", "house"]).optional(),
        userRent: z.number().min(0).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Rentometer] Getting comprehensive data for:', input.address);
          const result = await getComprehensiveRentometerData(input);
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('[Rentometer] Error getting comprehensive data:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get comprehensive Rentometer data',
            data: null,
          };
        }
      }),
});

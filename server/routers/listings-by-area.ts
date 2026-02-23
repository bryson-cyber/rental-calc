import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getListingsByArea } from "../airdna";

export const listingsByAreaRouter = router({
    get: publicProcedure
      .input(z.object({
        address: z.string().min(1, "Address is required"),
        radiusMeters: z.number().int().min(100).max(50000).default(3000),
        bedrooms: z.number().int().min(0).max(20).optional(),
        bathrooms: z.number().min(0.5).max(20).optional(),
        minRating: z.number().min(0).max(5).optional(),
        minRevenue: z.number().min(0).optional(),
        maxRevenue: z.number().min(0).optional(),
        pageSize: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        sortBy: z.enum(['proximity', 'revenue', 'rating', 'occupancy']).default('proximity'),
        sortDirection: z.enum(['ascending', 'descending']).default('ascending'),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await getListingsByArea(
            input.address,
            input.radiusMeters,
            {
              bedrooms: input.bedrooms,
              bathrooms: input.bathrooms,
              minRating: input.minRating,
              minRevenue: input.minRevenue,
              maxRevenue: input.maxRevenue,
              pageSize: input.pageSize,
              offset: input.offset,
              sortBy: input.sortBy,
              sortDirection: input.sortDirection,
            }
          );

          if (!result) {
            return {
              success: false,
              error: "Could not fetch listings for this area",
              data: null,
            };
          }

          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('[ListingsByArea] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch listings',
            data: null,
          };
        }
      }),
});

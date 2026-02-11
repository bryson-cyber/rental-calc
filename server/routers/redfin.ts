import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { logActivity, ActionCategory, ActionType } from "../activity";
import { getRedfinPropertyDetails, isRedfinUrl } from "../hasdata-redfin";

export const redfinRouter = router({
    // Parse a Redfin URL and extract property details
    getPropertyDetails: publicProcedure
      .input(z.object({
        url: z.string().min(1, "Redfin URL is required"),
      }))
      .mutation(async ({ input }) => {
        try {
          // Validate URL format
          if (!isRedfinUrl(input.url)) {
            return {
              success: false,
              error: "Please enter a valid Redfin property URL (e.g., https://www.redfin.com/...)",
            };
          }

          // Log activity
          await logActivity({
            action: ActionType.PROPERTY_SEARCH,
            actionCategory: ActionCategory.SEARCH,
            details: { redfinUrl: input.url },
          });

          // Fetch property details from HasData API
          const result = await getRedfinPropertyDetails(input.url);

          if (!result.success || !result.data) {
            return {
              success: false,
              error: result.error || "Failed to fetch property details",
            };
          }

          return {
            success: true,
            data: {
              address: result.data.address,
              streetAddress: result.data.streetAddress,
              city: result.data.city,
              state: result.data.state,
              zipcode: result.data.zipcode,
              bedrooms: result.data.bedrooms,
              bathrooms: result.data.bathrooms,
              price: result.data.price,
              priceType: result.data.priceType,
              livingArea: result.data.livingArea,
              yearBuilt: result.data.yearBuilt,
              propertyType: result.data.propertyType,
              imageUrl: result.data.imageUrl,
              propertyId: result.data.propertyId,
            },
            creditsUsed: result.creditsUsed,
          };
        } catch (error) {
          console.error("[redfin.getPropertyDetails] Error:", error);
          return {
            success: false,
            error: "An error occurred while fetching property details",
          };
        }
      }),

    // Check if a string is a valid Redfin URL
    validateUrl: publicProcedure
      .input(z.object({
        url: z.string(),
      }))
      .query(({ input }) => {
        return {
          isValid: isRedfinUrl(input.url),
        };
      }),
});

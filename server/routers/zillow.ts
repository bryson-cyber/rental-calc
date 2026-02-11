import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { logActivity, ActionCategory, ActionType } from "../activity";
import { getZillowPropertyDetails, isZillowUrl } from "../hasdata-zillow";

export const zillowRouter = router({
    // Parse a Zillow URL and extract property details
    getPropertyDetails: publicProcedure
      .input(z.object({
        url: z.string().min(1, "Zillow URL is required"),
      }))
      .mutation(async ({ input }) => {
        try {
          // Validate URL format
          if (!isZillowUrl(input.url)) {
            return {
              success: false,
              error: "Please enter a valid Zillow property URL (e.g., https://www.zillow.com/homedetails/...)",
            };
          }

          // Log activity
          await logActivity({
            action: ActionType.PROPERTY_SEARCH,
            actionCategory: ActionCategory.SEARCH,
            details: { zillowUrl: input.url },
          });

          // Fetch property details from HasData API
          const result = await getZillowPropertyDetails(input.url);

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
              zpid: result.data.zpid,
            },
            creditsUsed: result.creditsUsed,
          };
        } catch (error) {
          console.error("[zillow.getPropertyDetails] Error:", error);
          return {
            success: false,
            error: "An error occurred while fetching property details",
          };
        }
      }),

    // Check if a string is a valid Zillow URL
    validateUrl: publicProcedure
      .input(z.object({
        url: z.string(),
      }))
      .query(({ input }) => {
        return {
          isValid: isZillowUrl(input.url),
        };
      }),
});

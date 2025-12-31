import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leads } from "../drizzle/schema";
import { 
  getRentalizerEstimate, 
  searchMarket, 
  getComprehensiveMarketData,
  getBedroomPerformance 
} from "./airdna";

// Input validation schema for rental estimate
const rentalizerInputSchema = z.object({
  address: z.string().min(1, "Address is required"),
  bedrooms: z.number().int().min(1).max(20).optional(),
  bathrooms: z.number().min(0.5).max(20).optional(),
  accommodates: z.number().int().min(1).max(50).optional(),
  currency: z.string().default("usd"),
});

// Lead capture schema
const leadInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().optional(),
  accommodates: z.number().int().optional(),
  zillow_url: z.string().optional(),
});

// Comprehensive report schema
const comprehensiveReportInputSchema = z.object({
  address: z.string().min(1, "Address is required"),
  bedrooms: z.number().int().min(1).max(20).optional(),
  bathrooms: z.number().min(0.5).max(20).optional(),
  accommodates: z.number().int().min(1).max(50).optional(),
  currency: z.string().default("usd"),
  zillow_url: z.string().optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Rental estimate router
  rental: router({
    // Get rental estimate from AirDNA API
    getEstimate: publicProcedure
      .input(rentalizerInputSchema)
      .mutation(async ({ input }) => {
        try {
          const estimate = await getRentalizerEstimate({
            address: input.address,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            accommodates: input.accommodates,
            currency: input.currency,
          });
          
          return {
            success: true,
            data: estimate,
          };
        } catch (error) {
          console.error("[Rental] Error getting estimate:", error);
          const message = error instanceof Error ? error.message : "Failed to get rental estimate";
          return {
            success: false,
            error: message,
            data: null,
          };
        }
      }),

    // Get comprehensive report with market data
    getComprehensiveReport: publicProcedure
      .input(comprehensiveReportInputSchema)
      .mutation(async ({ input }) => {
        try {
          // Step 1: Get property estimate
          const estimate = await getRentalizerEstimate({
            address: input.address,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            accommodates: input.accommodates,
            currency: input.currency,
          });

          // Step 2: Search for the market based on property location
          let marketData = null;
          let bedroomPerformance = null;
          
          try {
            const markets = await searchMarket(
              undefined,
              estimate.property.latitude,
              estimate.property.longitude
            );

            if (markets.length > 0) {
              const primaryMarket = markets[0];
              
              // Step 3: Get comprehensive market metrics
              marketData = await getComprehensiveMarketData(
                primaryMarket.id,
                input.bedrooms
              );
              marketData.market_name = primaryMarket.name;

              // Step 4: Get bedroom performance for the market
              bedroomPerformance = await getBedroomPerformance(primaryMarket.id);
            }
          } catch (marketError) {
            console.error("[Rental] Error fetching market data:", marketError);
            // Continue without market data - property estimate is still valuable
          }

          return {
            success: true,
            data: {
              property: estimate,
              market: marketData,
              bedroom_performance: bedroomPerformance,
              generated_at: new Date().toISOString(),
            },
          };
        } catch (error) {
          console.error("[Rental] Error getting comprehensive report:", error);
          const message = error instanceof Error ? error.message : "Failed to generate report";
          return {
            success: false,
            error: message,
            data: null,
          };
        }
      }),

    // Submit lead and store in database
    submitLead: publicProcedure
      .input(leadInputSchema)
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          
          if (db) {
            // Store lead in database
            await db.insert(leads).values({
              name: input.name,
              email: input.email,
              phone: input.phone || null,
              address: input.address,
              bedrooms: input.bedrooms || null,
              bathrooms: input.bathrooms ? String(input.bathrooms) : null,
              accommodates: input.accommodates || null,
              zillowUrl: input.zillow_url || null,
            });

            console.log("[Lead] New lead stored:", {
              name: input.name,
              email: input.email,
              address: input.address,
              timestamp: new Date().toISOString(),
            });
          } else {
            // Log the lead if DB not available
            console.log("[Lead] Database not available, logging lead:", {
              name: input.name,
              email: input.email,
              phone: input.phone,
              address: input.address,
              timestamp: new Date().toISOString(),
            });
          }

          return {
            success: true,
            message: "Lead submitted successfully",
          };
        } catch (error) {
          console.error("[Lead] Error storing lead:", error);
          
          // Still return success to user even if DB fails
          console.log("[Lead] Fallback - Lead data:", {
            name: input.name,
            email: input.email,
            phone: input.phone,
            address: input.address,
            timestamp: new Date().toISOString(),
          });

          return {
            success: true,
            message: "Lead submitted successfully",
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;

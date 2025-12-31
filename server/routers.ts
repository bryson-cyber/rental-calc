import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leads } from "../drizzle/schema";
import { 
  getRentalizerEstimate, 
  searchMarkets,
  getComprehensivePropertyReport,
  getComprehensiveMarketReport,
  getComprehensiveSubmarketReport,
  detectSearchType,
} from "./airdna";
import { generateEnhancedPropertyReport, generateEnhancedMarketReport } from "./gemini";

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

// Property report schema
const propertyReportInputSchema = z.object({
  address: z.string().min(1, "Address is required"),
  bedrooms: z.number().int().min(1).max(20).optional(),
  bathrooms: z.number().min(0.5).max(20).optional(),
  accommodates: z.number().int().min(1).max(50).optional(),
});

// AI-enhanced property report schema (includes rent for arbitrage calculation)
const aiPropertyReportInputSchema = z.object({
  address: z.string().min(1, "Address is required"),
  monthlyRent: z.number().min(0, "Monthly rent is required"),
  bedrooms: z.number().int().min(1).max(20).optional(),
  bathrooms: z.number().min(0.5).max(20).optional(),
  accommodates: z.number().int().min(1).max(50).optional(),
  propertyType: z.string().optional(),
  squareFootage: z.number().optional(),
});

// Market search schema
const marketSearchInputSchema = z.object({
  searchTerm: z.string().min(1, "Search term is required"),
  limit: z.number().int().min(1).max(20).default(10),
});

// Market report schema
const marketReportInputSchema = z.object({
  marketId: z.string().min(1, "Market ID is required"),
});

// Submarket/zip code report schema
const submarketReportInputSchema = z.object({
  submarketId: z.string().min(1, "Submarket ID is required"),
});

// Smart search schema
const smartSearchInputSchema = z.object({
  query: z.string().min(1, "Search query is required"),
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
    // Search for markets (for autocomplete)
    searchMarkets: publicProcedure
      .input(marketSearchInputSchema)
      .query(async ({ input }) => {
        try {
          const results = await searchMarkets(input.searchTerm, input.limit);
          return {
            success: true,
            data: results,
          };
        } catch (error) {
          console.error("[Rental] Error searching markets:", error);
          return {
            success: false,
            error: "Failed to search markets",
            data: [],
          };
        }
      }),

    // Get basic rental estimate from AirDNA API
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

    // Get comprehensive property report with market data
    getPropertyReport: publicProcedure
      .input(propertyReportInputSchema)
      .mutation(async ({ input }) => {
        try {
          const report = await getComprehensivePropertyReport(
            input.address,
            input.bedrooms,
            input.bathrooms,
            input.accommodates
          );

          if (!report) {
            return {
              success: false,
              error: "Could not generate property report for this address",
              data: null,
            };
          }

          return {
            success: true,
            data: report,
          };
        } catch (error) {
          console.error("[Rental] Error getting property report:", error);
          const message = error instanceof Error ? error.message : "Failed to generate property report";
          return {
            success: false,
            error: message,
            data: null,
          };
        }
      }),

    // Get AI-enhanced property report with profitability analysis
    getAIPropertyReport: publicProcedure
      .input(aiPropertyReportInputSchema)
      .mutation(async ({ input }) => {
        try {
          // First get the comprehensive property report from AirDNA
          const baseReport = await getComprehensivePropertyReport(
            input.address,
            input.bedrooms,
            input.bathrooms,
            input.accommodates
          );

          if (!baseReport) {
            return {
              success: false,
              error: "Could not generate property report for this address",
              data: null,
            };
          }

          // Calculate revenue projections based on market data
          const medianRevenue = baseReport.property.estimates?.annual_revenue || 0;
          const top25Revenue = Math.round(medianRevenue * 1.25);
          const top10Revenue = Math.round(medianRevenue * 1.5);

          // Get neighborhood from address (last part before state/zip)
          const addressParts = input.address.split(',');
          const neighborhood = addressParts.length >= 2 ? addressParts[1].trim() : 'Local Area';

          // Generate AI-enhanced analysis
          const aiAnalysis = await generateEnhancedPropertyReport({
            property: {
              address: input.address,
              neighborhood,
              propertyType: input.propertyType || 'House',
              bedrooms: input.bedrooms || baseReport.property.property?.bedrooms || 2,
              bathrooms: input.bathrooms || baseReport.property.property?.bathrooms || 1,
              squareFootage: input.squareFootage,
              monthlyRent: input.monthlyRent,
            },
            marketData: {
              occupancy: baseReport.market?.metrics?.occupancy || 0,
              adr: baseReport.market?.metrics?.adr || 0,
              revenue: baseReport.market?.metrics?.revenue || 0,
              listingCount: baseReport.market?.listing_count || 0,
            },
            competitors: (baseReport.same_bedroom_comps || []).slice(0, 5).map(c => ({
              name: c.title || 'Competitor',
              revenue: c.annual_revenue || 0,
              adr: c.adr || 0,
              occupancy: c.occupancy || 0,
              rating: c.rating ?? undefined,
            })),
            revenueProjections: {
              conservative: medianRevenue,
              realistic: top25Revenue,
              optimistic: top10Revenue,
            },
          });

          // Calculate profitability
          const monthlyExpenses = input.monthlyRent + 780; // Rent + utilities/supplies
          const annualExpenses = monthlyExpenses * 12;
          const minRevenueThreshold = input.monthlyRent * 12 * 2;
          const meetsThreshold = top25Revenue >= minRevenueThreshold;

          return {
            success: true,
            data: {
              ...baseReport,
              ai_analysis: aiAnalysis,
              profitability: {
                monthly_rent: input.monthlyRent,
                monthly_expenses: monthlyExpenses,
                annual_expenses: annualExpenses,
                startup_costs: 20000,
                min_revenue_threshold: minRevenueThreshold,
                meets_threshold: meetsThreshold,
                revenue_projections: {
                  conservative: medianRevenue,
                  realistic: top25Revenue,
                  optimistic: top10Revenue,
                },
                profit_projections: {
                  conservative: medianRevenue - annualExpenses,
                  realistic: top25Revenue - annualExpenses,
                  optimistic: top10Revenue - annualExpenses,
                },
              },
            },
          };
        } catch (error) {
          console.error("[Rental] Error getting AI property report:", error);
          const message = error instanceof Error ? error.message : "Failed to generate AI property report";
          return {
            success: false,
            error: message,
            data: null,
          };
        }
      }),

    // Get comprehensive market report with AI analysis
    getMarketReport: publicProcedure
      .input(marketReportInputSchema)
      .mutation(async ({ input }) => {
        try {
          const report = await getComprehensiveMarketReport(input.marketId);

          if (!report) {
            return {
              success: false,
              error: "Could not generate market report",
              data: null,
            };
          }

          // Generate AI-enhanced analysis
          const aiAnalysis = await generateEnhancedMarketReport({
            market: {
              name: report.market.name,
              listingCount: report.market.listing_count,
            },
            metrics: {
              occupancy: report.market.metrics.occupancy,
              adr: report.market.metrics.adr,
              revenue: report.market.metrics.revenue,
              revpar: report.market.metrics.revpar,
            },
            topListings: (report.top_listings || []).slice(0, 5).map(l => ({
              title: l.title,
              revenue: l.annual_revenue,
              adr: l.adr,
              occupancy: l.occupancy,
              rating: l.rating,
              bedrooms: l.bedrooms,
              propertyType: l.property_type,
            })),
            bedroomPerformance: (report.bedroom_performance || []).map(b => ({
              bedrooms: b.bedrooms,
              count: b.count,
              avgRevenue: b.avg_revenue,
              avgOccupancy: b.avg_occupancy,
            })),
            insights: report.insights ? {
              professionallyManagedPct: report.insights.professionally_managed_pct,
              superhostPct: report.insights.superhost_pct,
              revenuePercentiles: report.insights.revenue_percentiles,
            } : undefined,
          });

          return {
            success: true,
            data: {
              ...report,
              ai_analysis: aiAnalysis,
            },
          };
        } catch (error) {
          console.error("[Rental] Error getting market report:", error);
          const message = error instanceof Error ? error.message : "Failed to generate market report";
          return {
            success: false,
            error: message,
            data: null,
          };
        }
      }),

    // Get comprehensive submarket/zip code report with AI analysis
    getSubmarketReport: publicProcedure
      .input(submarketReportInputSchema)
      .mutation(async ({ input }) => {
        try {
          const report = await getComprehensiveSubmarketReport(input.submarketId);

          if (!report) {
            return {
              success: false,
              error: "Could not generate submarket report",
              data: null,
            };
          }

          // Generate AI-enhanced analysis
          const aiAnalysis = await generateEnhancedMarketReport({
            market: {
              name: report.submarket.name,
              listingCount: report.submarket.listing_count,
            },
            metrics: {
              occupancy: report.submarket.metrics.occupancy,
              adr: report.submarket.metrics.adr,
              revenue: report.submarket.metrics.revenue,
              revpar: report.submarket.metrics.revpar,
            },
            topListings: (report.top_listings || []).slice(0, 5).map(l => ({
              title: l.title,
              revenue: l.annual_revenue,
              adr: l.adr,
              occupancy: l.occupancy,
              rating: l.rating,
              bedrooms: l.bedrooms,
              propertyType: l.property_type,
            })),
            bedroomPerformance: (report.bedroom_performance || []).map(b => ({
              bedrooms: b.bedrooms,
              count: b.count,
              avgRevenue: b.avg_revenue,
              avgOccupancy: b.avg_occupancy,
            })),
            insights: report.insights ? {
              professionallyManagedPct: report.insights.professionally_managed_pct,
              superhostPct: report.insights.superhost_pct,
              revenuePercentiles: report.insights.revenue_percentiles,
            } : undefined,
          });

          return {
            success: true,
            data: {
              ...report,
              ai_analysis: aiAnalysis,
            },
          };
        } catch (error) {
          console.error("[Rental] Error getting submarket report:", error);
          const message = error instanceof Error ? error.message : "Failed to generate submarket report";
          return {
            success: false,
            error: message,
            data: null,
          };
        }
      }),

    // Smart search - detects input type and returns appropriate results
    smartSearch: publicProcedure
      .input(smartSearchInputSchema)
      .query(async ({ input }) => {
        try {
          const searchType = detectSearchType(input.query);
          const results = await searchMarkets(input.query, 10);
          
          return {
            success: true,
            data: {
              search_type: searchType,
              query: input.query,
              results: results.map(r => ({
                ...r,
                search_type: searchType,
              })),
            },
          };
        } catch (error) {
          console.error("[Rental] Error in smart search:", error);
          return {
            success: false,
            error: "Failed to search",
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

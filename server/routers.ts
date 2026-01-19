import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leads, savedSearches, favoriteProperties, analysisReports } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { 
  getRentalizerEstimate, 
  searchMarkets,
  getComprehensivePropertyReport,
  getComprehensiveMarketReport,
  getComprehensiveSubmarketReport,
  detectSearchType,
  getQualifyingCompetitors,
  enrichListingsWithImages,
  exploreSubmarketsWithMetrics,
  getCountryMarkets,
  getListingsInRadius,
  getMarketSeasonality,
  getTopPerformers,
  calculateArbitrageFeasibility,
  getListingsByArea,
  getRentalizerBulkSummary,
  getSubmarketListings,
  getMarketHistoricalData,
} from "./airdna";
import { generateEnhancedPropertyReport, generateEnhancedMarketReport } from "./gemini";
import { getAIAdvisorResponse, type ChatMessage } from "./ai-advisor";
import { batchScrapeAirbnbImages } from "./airbnb-scraper";
import { generateFullArbitrageAnalysis } from "./sop-reports";
import { generatePDFReport } from "./export-pdf";
import { generateExcelReport } from "./export-excel";
import { startDeepAnalysis, getDeepAnalysis } from "./deep-analysis";
import { marketResearchRouter } from "./market-research-v2";
import { opportunityFinderRouter } from "./opportunity-finder";
import { marketResearchSimpleRouter } from "./market-research-simple";
import { geocodeZipCodeToMarket } from "./airdna-hierarchy";
import { adminRouter } from "./admin-router";
import { logActivity, ActionCategory, ActionType } from "./activity";

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
          // Log activity
          await logActivity({
            action: ActionType.MARKET_SEARCH,
            actionCategory: ActionCategory.SEARCH,
            details: { searchTerm: input.searchTerm },
          });
          
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

    // Geocode a zip code to find the corresponding market and submarket
    geocodeZipCode: publicProcedure
      .input(z.object({ zipcode: z.string().length(5) }))
      .query(async ({ input }) => {
        try {
          console.log(`[geocodeZipCode] Looking up zip code: ${input.zipcode}`);
          
          const result = await geocodeZipCodeToMarket(input.zipcode);
          
          // Log activity
          await logActivity({
            action: ActionType.MARKET_SEARCH,
            actionCategory: ActionCategory.SEARCH,
            details: { 
              searchType: 'zipcode_geocode',
              zipcode: input.zipcode,
              city: result.city,
              state: result.state,
              marketId: result.market?.id,
              marketName: result.market?.name,
              success: result.success
            },
          });
          
          return result;
        } catch (error) {
          console.error("[geocodeZipCode] Error:", error);
          return {
            success: false,
            zipcode: input.zipcode,
            error: "An error occurred while looking up the zip code. Please try again."
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

          // Get the market ID from the base report
          const marketId = baseReport.market?.id || baseReport.property.property?.market_id;
          const bedrooms = input.bedrooms || baseReport.property.property?.bedrooms || 2;
          
          // Fetch ALL qualifying competitors from Market Charts API
          let allCompetitors: typeof baseReport.same_bedroom_comps = [];
          let qualifyingCompetitors: typeof baseReport.same_bedroom_comps = [];
          const minRevenueThreshold = input.monthlyRent * 12 * 2;
          
          if (marketId) {
            console.log(`[getAIPropertyReport] Fetching all competitors for market ${marketId}, ${bedrooms}BR, threshold $${minRevenueThreshold}`);
            const competitorData = await getQualifyingCompetitors(marketId, bedrooms, input.monthlyRent);
            allCompetitors = competitorData.allSameBedroomListings;
            qualifyingCompetitors = competitorData.qualifyingListings;
            console.log(`[getAIPropertyReport] Found ${allCompetitors.length} same-bedroom listings, ${qualifyingCompetitors.length} meet threshold`);
            
            // Scrape images from Airbnb for top competitors
            const airbnbUrls = allCompetitors
              .slice(0, 15)
              .map(c => c.airbnb_url)
              .filter((url): url is string => !!url);
            
            if (airbnbUrls.length > 0) {
              console.log(`[getAIPropertyReport] Scraping images for ${airbnbUrls.length} listings...`);
              try {
                const imageMap = await batchScrapeAirbnbImages(airbnbUrls, 3);
                console.log(`[getAIPropertyReport] Successfully scraped images for ${imageMap.size} listings`);
                
                // Update competitors with scraped images
                allCompetitors = allCompetitors.map(c => {
                  if (c.airbnb_url && imageMap.has(c.airbnb_url)) {
                    const images = imageMap.get(c.airbnb_url)!;
                    return {
                      ...c,
                      image_url: images[0],
                      images: images,
                    };
                  }
                  return c;
                });
              } catch (error) {
                console.error('[getAIPropertyReport] Image scraping failed:', error);
                // Continue without images - UI will show fallback
              }
            }
          } else {
            // Fallback to original comps if no market ID
            allCompetitors = baseReport.same_bedroom_comps || [];
            qualifyingCompetitors = allCompetitors.filter(c => c.annual_revenue >= minRevenueThreshold);
          }

          // Generate AI-enhanced analysis
          const aiAnalysis = await generateEnhancedPropertyReport(input.address, {
            property: {
              address: input.address,
              neighborhood,
              propertyType: input.propertyType || 'House',
              bedrooms,
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
            competitors: allCompetitors.slice(0, 10).map(c => ({
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
          const meetsThreshold = qualifyingCompetitors.length > 0;

          return {
            success: true,
            data: {
              ...baseReport,
              // Override same_bedroom_comps with ALL competitors from Market Charts API
              same_bedroom_comps: allCompetitors,
              qualifying_comps: qualifyingCompetitors,
              ai_analysis: aiAnalysis,
              profitability: {
                monthly_rent: input.monthlyRent,
                monthly_expenses: monthlyExpenses,
                annual_expenses: annualExpenses,
                startup_costs: 20000,
                min_revenue_threshold: minRevenueThreshold,
                meets_threshold: meetsThreshold,
                qualifying_count: qualifyingCompetitors.length,
                total_same_bedroom_count: allCompetitors.length,
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
          console.log(`[getMarketReport] Fetching report for market: ${input.marketId}`);
          const report = await getComprehensiveMarketReport(input.marketId);

          if (!report) {
            console.log(`[getMarketReport] No report returned for market: ${input.marketId}`);
            return {
              success: false,
              error: `Could not find market data for ID: ${input.marketId}. This market may not exist or may not have sufficient data available. Please try searching for a different market.`,
              data: null,
            };
          }
          
          // Validate that we have meaningful data
          if (!report.market?.listing_count || report.market.listing_count === 0) {
            console.log(`[getMarketReport] Market ${input.marketId} has 0 listings`);
            return {
              success: false,
              error: `The market "${report.market?.name || input.marketId}" shows 0 active rentals. This market may not have sufficient short-term rental data available. Please try a different market.`,
              data: null,
            };
          }

          // Generate AI-enhanced analysis
          const aiAnalysis = await generateEnhancedMarketReport(report.market.name, {
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
          console.log(`[getSubmarketReport] Fetching report for submarket: ${input.submarketId}`);
          const report = await getComprehensiveSubmarketReport(input.submarketId);

          if (!report) {
            console.log(`[getSubmarketReport] No report returned for submarket: ${input.submarketId}`);
            return {
              success: false,
              error: `Could not find data for this market/neighborhood. The ID "${input.submarketId}" may not exist or may not have sufficient data available. Please try searching for a different location.`,
              data: null,
            };
          }
          
          // Validate that we have meaningful data
          if (!report.submarket?.listing_count || report.submarket.listing_count === 0) {
            console.log(`[getSubmarketReport] Submarket ${input.submarketId} has 0 listings`);
            return {
              success: false,
              error: `"${report.submarket?.name || input.submarketId}" shows 0 active rentals. This area may not have sufficient short-term rental data available. Please try a different neighborhood or city.`,
              data: null,
            };
          }

          // Generate AI-enhanced analysis
          const aiAnalysis = await generateEnhancedMarketReport(report.submarket.name, {
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

    // Explore submarkets within a market - returns ranked list with recommendations
    exploreSubmarkets: publicProcedure
      .input(z.object({
        marketId: z.string().min(1, "Market ID is required"),
        sortBy: z.enum(['revenue', 'occupancy', 'revpar', 'overall']).default('overall'),
        limit: z.number().int().min(1).max(20).default(15),
      }))
      .query(async ({ input }) => {
        try {
          const result = await exploreSubmarketsWithMetrics(input.marketId, {
            sortBy: input.sortBy,
            limit: input.limit,
          });
          
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error("[Rental] Error exploring submarkets:", error);
          const message = error instanceof Error ? error.message : "Failed to explore submarkets";
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
          // Log activity
          await logActivity({
            action: ActionType.LEAD_SUBMITTED,
            actionCategory: ActionCategory.LEAD,
            details: {
              email: input.email,
              address: input.address,
            },
          });
          
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

  // Saved searches router
  savedSearches: router({
    // Get all saved searches for a user or session
    list: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) {
            return { success: false, error: "Database not available", data: [] };
          }

          // Get by user ID if logged in, otherwise by session ID
          const userId = ctx.user?.id;
          const sessionId = input.sessionId;

          let searches;
          if (userId) {
            searches = await db
              .select()
              .from(savedSearches)
              .where(eq(savedSearches.userId, userId))
              .orderBy(desc(savedSearches.createdAt));
          } else if (sessionId) {
            searches = await db
              .select()
              .from(savedSearches)
              .where(eq(savedSearches.sessionId, sessionId))
              .orderBy(desc(savedSearches.createdAt));
          } else {
            return { success: true, data: [] };
          }

          return { success: true, data: searches };
        } catch (error) {
          console.error("[SavedSearches] Error listing:", error);
          return { success: false, error: "Failed to load saved searches", data: [] };
        }
      }),

    // Save a new search
    save: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        searchType: z.enum(["market", "property"]),
        marketId: z.string().optional(),
        marketName: z.string().optional(),
        submarketId: z.string().optional(),
        submarketName: z.string().optional(),
        address: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        cachedRevenue: z.number().optional(),
        cachedOccupancy: z.number().optional(),
        cachedAdr: z.number().optional(),
        label: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) {
            return { success: false, error: "Database not available" };
          }

          const userId = ctx.user?.id;
          const sessionId = input.sessionId;

          if (!userId && !sessionId) {
            return { success: false, error: "User or session ID required" };
          }

          const [result] = await db.insert(savedSearches).values({
            userId: userId || null,
            sessionId: sessionId || null,
            searchType: input.searchType,
            marketId: input.marketId,
            marketName: input.marketName,
            submarketId: input.submarketId,
            submarketName: input.submarketName,
            address: input.address,
            latitude: input.latitude?.toString(),
            longitude: input.longitude?.toString(),
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms?.toString(),
            cachedRevenue: input.cachedRevenue,
            cachedOccupancy: input.cachedOccupancy?.toString(),
            cachedAdr: input.cachedAdr,
            label: input.label,
            notes: input.notes,
          });

          return { success: true, id: result.insertId };
        } catch (error) {
          console.error("[SavedSearches] Error saving:", error);
          return { success: false, error: "Failed to save search" };
        }
      }),

    // Delete a saved search
    delete: publicProcedure
      .input(z.object({
        id: z.number(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) {
            return { success: false, error: "Database not available" };
          }

          const userId = ctx.user?.id;
          const sessionId = input.sessionId;

          // Ensure user can only delete their own searches
          if (userId) {
            await db
              .delete(savedSearches)
              .where(and(
                eq(savedSearches.id, input.id),
                eq(savedSearches.userId, userId)
              ));
          } else if (sessionId) {
            await db
              .delete(savedSearches)
              .where(and(
                eq(savedSearches.id, input.id),
                eq(savedSearches.sessionId, sessionId)
              ));
          } else {
            return { success: false, error: "User or session ID required" };
          }

          return { success: true };
        } catch (error) {
          console.error("[SavedSearches] Error deleting:", error);
          return { success: false, error: "Failed to delete saved search" };
        }
      }),

    // Update a saved search (label/notes)
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        sessionId: z.string().optional(),
        label: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) {
            return { success: false, error: "Database not available" };
          }

          const userId = ctx.user?.id;
          const sessionId = input.sessionId;

          const updates: Record<string, unknown> = {};
          if (input.label !== undefined) updates.label = input.label;
          if (input.notes !== undefined) updates.notes = input.notes;

          if (userId) {
            await db
              .update(savedSearches)
              .set(updates)
              .where(and(
                eq(savedSearches.id, input.id),
                eq(savedSearches.userId, userId)
              ));
          } else if (sessionId) {
            await db
              .update(savedSearches)
              .set(updates)
              .where(and(
                eq(savedSearches.id, input.id),
                eq(savedSearches.sessionId, sessionId)
              ));
          } else {
            return { success: false, error: "User or session ID required" };
          }

          return { success: true };
        } catch (error) {
          console.error("[SavedSearches] Error updating:", error);
          return { success: false, error: "Failed to update saved search" };
        }
      }),
  }),

  // Advanced features router
  advanced: router({
    // Market Scorecard - Get all markets in a country with scores
    getCountryMarkets: publicProcedure
      .input(z.object({
        countryCode: z.string().default("us"),
        limit: z.number().int().min(1).max(25).default(25),
        offset: z.number().int().min(0).default(0),
        market_type: z.enum(["coastal", "urban_metro", "mountains_lakes", "suburban", "rural", "mid_size_city"]).optional(),
        min_market_score: z.number().min(0).max(100).optional(),
        min_investability: z.number().min(0).max(100).optional(),
        min_rental_demand: z.number().min(0).max(100).optional(),
        min_revenue_growth: z.number().min(0).max(100).optional(),
        min_seasonality: z.number().min(0).max(100).optional(),
        min_regulation: z.number().min(0).max(100).optional(),
        sort_by: z.enum(["market_score", "investability", "rental_demand", "revenue_growth", "seasonality", "regulation", "listing_count", "revenue"]).default("market_score"),
        sort_direction: z.enum(["asc", "desc"]).default("desc"),
        include_geoms: z.boolean().default(false),
      }))
      .query(async ({ input }) => {
        try {
          const result = await getCountryMarkets(input.countryCode, {
            limit: input.limit,
            offset: input.offset,
            market_type: input.market_type,
            min_market_score: input.min_market_score,
            min_investability: input.min_investability,
            min_rental_demand: input.min_rental_demand,
            min_revenue_growth: input.min_revenue_growth,
            min_seasonality: input.min_seasonality,
            min_regulation: input.min_regulation,
            sort_by: input.sort_by,
            sort_direction: input.sort_direction,
            include_geoms: input.include_geoms,
          });
          
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error("[Advanced] Error fetching country markets:", error);
          return {
            success: false,
            error: "Failed to fetch markets",
            data: null,
          };
        }
      }),

    // Radius-Based Opportunity Finder
    getListingsInRadius: publicProcedure
      .input(z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        radiusMeters: z.number().int().min(100).max(50000).default(2000),
        limit: z.number().int().min(1).max(25).default(25),
        offset: z.number().int().min(0).default(0),
        bedrooms: z.number().int().min(0).max(20).optional(),
        sort_by: z.enum(["revenue", "adr", "occupancy", "rating", "distance"]).default("revenue"),
        sort_direction: z.enum(["asc", "desc"]).default("desc"),
      }))
      .query(async ({ input }) => {
        try {
          const result = await getListingsInRadius(
            input.latitude,
            input.longitude,
            input.radiusMeters,
            {
              limit: input.limit,
              offset: input.offset,
              bedrooms: input.bedrooms,
              sort_by: input.sort_by,
              sort_direction: input.sort_direction,
            }
          );
          
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error("[Advanced] Error fetching listings in radius:", error);
          return {
            success: false,
            error: "Failed to fetch listings",
            data: null,
          };
        }
      }),

    // Seasonality Calendar / Heatmap
    getMarketSeasonality: publicProcedure
      .input(z.object({
        marketId: z.string().min(1, "Market ID is required"),
      }))
      .query(async ({ input }) => {
        try {
          const result = await getMarketSeasonality(input.marketId);
          
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error("[Advanced] Error fetching seasonality:", error);
          return {
            success: false,
            error: "Failed to fetch seasonality data",
            data: null,
          };
        }
      }),

    // Top Performers Finder
    getTopPerformers: publicProcedure
      .input(z.object({
        marketId: z.string().min(1, "Market ID is required"),
        limit: z.number().int().min(1).max(25).default(25),
        sort_by: z.enum(["revenue", "adr", "occupancy", "rating", "reviews"]).default("revenue"),
        superhost_only: z.boolean().default(false),
        professionally_managed: z.boolean().optional(),
        bedrooms: z.number().int().min(0).max(20).optional(),
        min_rating: z.number().min(0).max(5).optional(),
        instant_book: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        try {
          const result = await getTopPerformers({
            marketId: input.marketId,
            limit: input.limit,
            sort_by: input.sort_by,
            filters: {
              superhost_only: input.superhost_only,
              professionally_managed: input.professionally_managed,
              bedrooms: input.bedrooms,
              min_rating: input.min_rating,
              instant_book: input.instant_book,
            },
          });
          
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error("[Advanced] Error fetching top performers:", error);
          return {
            success: false,
            error: "Failed to fetch top performers",
            data: null,
          };
        }
      }),

    // Rental Arbitrage Feasibility Tool
    calculateArbitrageFeasibility: publicProcedure
      .input(z.object({
        address: z.string().min(1, "Address is required"),
        monthlyRent: z.number().min(0, "Monthly rent is required"),
        bedrooms: z.number().int().min(1).max(20).optional(),
        bathrooms: z.number().min(0.5).max(20).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await calculateArbitrageFeasibility(
            input.address,
            input.monthlyRent,
            input.bedrooms,
            input.bathrooms
          );
          
          if (!result) {
            return {
              success: false,
              error: "Could not calculate feasibility for this address",
              data: null,
            };
          }
          
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error("[Advanced] Error calculating arbitrage feasibility:", error);
          return {
            success: false,
            error: "Failed to calculate feasibility",
            data: null,
          };
        }
      }),

    // Lead Magnet Property Analysis - Comprehensive structured report
    analyzeProperty: publicProcedure
      .input(z.object({
        address: z.string().min(1, "Address is required"),
        monthly_rent: z.number().positive("Monthly rent must be positive"),
        bedrooms: z.number().int().min(1).max(20),
        bathrooms: z.number().min(0.5).max(20),
        sessionId: z.string().optional(), // For progress tracking
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[LeadMagnet] Starting property analysis:', input.address);
          
          // Log activity
          await logActivity({
            sessionId: input.sessionId,
            action: ActionType.PROPERTY_ANALYSIS,
            actionCategory: ActionCategory.ANALYSIS,
            details: {
              address: input.address,
              monthly_rent: input.monthly_rent,
              bedrooms: input.bedrooms,
              bathrooms: input.bathrooms,
            },
          });
          
          // Run the full arbitrage analysis with optional progress tracking
          const analysis = await generateFullArbitrageAnalysis(
            input.address,
            input.monthly_rent,
            input.bedrooms,
            input.bathrooms,
            undefined, // zillow_url
            undefined, // attractive_features
            input.sessionId // sessionId for progress tracking
          );
          
          console.log('[LeadMagnet] Analysis complete');
          
          // Save report to database for admin access
          console.log('[LeadMagnet] Attempting to save report to database...');
          try {
            const db = await getDb();
            if (db && analysis) {
              const { analysisReports } = await import('../drizzle/schema');
              const profitability = (analysis.profitability || {}) as any;
              const propertyEstimate = (analysis.property_estimate || {}) as any;
              const aiAnalysis = (analysis.ai_analysis || {}) as any;
              
              // Extract numeric values safely
              const getNumber = (val: any): number | null => {
                if (val === null || val === undefined) return null;
                const num = typeof val === 'string' ? parseFloat(val) : Number(val);
                return isNaN(num) ? null : Math.round(num);
              };
              
              const getDecimalStr = (val: any): string | null => {
                if (val === null || val === undefined) return null;
                const num = typeof val === 'string' ? parseFloat(val) : Number(val);
                return isNaN(num) ? null : num.toFixed(2);
              };
              
              // Use Drizzle ORM insert with proper column mapping
              const insertData = {
                address: input.address,
                city: propertyEstimate.city || null,
                state: propertyEstimate.state || null,
                zipCode: propertyEstimate.zipcode || null,
                latitude: getDecimalStr(propertyEstimate.latitude),
                longitude: getDecimalStr(propertyEstimate.longitude),
                bedrooms: input.bedrooms || null,
                bathrooms: getDecimalStr(input.bathrooms),
                monthlyRent: input.monthly_rent || null,
                marketId: propertyEstimate.market_id || null,
                marketName: propertyEstimate.market_name || null,
                annualRevenueConservative: getNumber(profitability.conservative?.annual_revenue),
                annualRevenueRealistic: getNumber(profitability.realistic?.annual_revenue),
                annualRevenueOptimistic: getNumber(profitability.optimistic?.annual_revenue),
                occupancyRate: getDecimalStr(propertyEstimate.occupancy),
                averageDailyRate: getNumber(propertyEstimate.adr),
                revpar: getNumber(propertyEstimate.revpar),
                annualProfitConservative: getNumber(profitability.conservative?.annual_profit),
                annualProfitRealistic: getNumber(profitability.realistic?.annual_profit),
                annualProfitOptimistic: getNumber(profitability.optimistic?.annual_profit),
                breakEvenOccupancy: getDecimalStr(profitability.break_even_occupancy),
                startupCostsMin: getNumber(profitability.startup_costs?.min),
                startupCostsMax: getNumber(profitability.startup_costs?.max),
                verdict: aiAnalysis?.verdict?.rating || aiAnalysis?.verdict || null,
                confidenceScore: getNumber(aiAnalysis?.verdict?.confidence || aiAnalysis?.confidence_score),
                fullAnalysisData: analysis,
                narrativeReport: analysis.enhanced_narrative_report || analysis.narrative_report || {},
                competitorData: analysis.competitors || [],
              };
              
              console.log('[LeadMagnet] Inserting report with address:', input.address);
              const insertResult = await db.insert(analysisReports).values(insertData);
              const reportId = Number(insertResult[0].insertId);
              console.log('[LeadMagnet] Report saved to database successfully with ID:', reportId);
              // Store reportId in analysis for frontend access
              (analysis as any).reportId = reportId;
            }
          } catch (dbError: any) {
            console.error('[LeadMagnet] Error saving report to database:', dbError?.message || dbError);
            console.error('[LeadMagnet] Full error:', dbError);
            // Don't fail the request if database save fails
          }
          
          // Return structured data for the frontend
          return {
            success: true,
            data: {
              // Core property info
              address: input.address,
              bedrooms: input.bedrooms,
              bathrooms: input.bathrooms,
              monthly_rent: input.monthly_rent,
              
              // Revenue estimates from percentiles
              percentiles: analysis.percentiles,
              
              // Property estimate from Rentalizer
              property_estimate: analysis.property_estimate,
              
              // Profitability scenarios
              profitability: analysis.profitability,
              
              // Competitors
              competitors: analysis.competitors,
              
              // Seasonality
              seasonality: analysis.seasonality,
              
              // Booking metrics
              booking_metrics: analysis.booking_metrics,
              
              // Amenity analysis
              amenity_analysis: analysis.amenity_analysis,
              
              // AI-powered analysis (verdict, insights, risks, etc.)
              ai_analysis: analysis.ai_analysis,
              
              // Photo analysis
              photo_analysis: analysis.photo_analysis,
              
              // Additional market intelligence
              booking_patterns: analysis.booking_patterns,
              supply_trend: analysis.supply_trend,
              professional_host_stats: analysis.professional_host_stats,
              cancellation_policies: analysis.cancellation_policies,
              property_roi: analysis.property_roi,
              regulations: analysis.regulations,
              
              // COMPREHENSIVE DATA: Market-level seasonality from API
              market_seasonality: analysis.market_seasonality,
              // COMPREHENSIVE DATA: Future pricing forecasts
              future_pricing: analysis.future_pricing,
              // COMPREHENSIVE DATA: Historical performance trends
              historical_trends: analysis.historical_trends,
              // 5-YEAR HISTORICAL SUMMARY
              five_year_summary: analysis.five_year_summary,
              // GEMINI HISTORICAL ANALYSIS
              historical_analysis: analysis.historical_analysis,
              // COMPREHENSIVE NARRATIVE REPORT
              narrative_report: analysis.narrative_report,
              // ENHANCED NARRATIVE REPORT (with action items and what_this_means)
              enhanced_narrative_report: analysis.enhanced_narrative_report,
              
              // TIER 1-4 DATA: All collected data must be displayed
              qualifying_competitors: analysis.qualifying_competitors,
              radius_listings: analysis.radius_listings,
              market_saturation: analysis.market_saturation,
              property_type_analysis: analysis.property_type_analysis,
              nearby_markets: analysis.nearby_markets,
              airdna_feasibility: analysis.airdna_feasibility,
              submarket_deep_dive: analysis.submarket_deep_dive,
              competitor_imagery: analysis.competitor_imagery,
              submarket_details: analysis.submarket_details,
              submarket_exploration: analysis.submarket_exploration,
              submarket_listings: analysis.submarket_listings,
              top_performer_comps: analysis.top_performer_comps,
              top_performer_pricing: analysis.top_performer_pricing,
              rentalizer_comps: analysis.rentalizer_comps,
              superhost_top_performers: analysis.superhost_top_performers,
              same_bedroom_radius_listings: analysis.same_bedroom_radius_listings,
              // competitor_historical and daily_pricing are not in the analysis return type
              market_insights: analysis.market_insights,
              
              // Full markdown report
              full_report: analysis.report,
              
              // Report ID for deep analysis
              reportId: (analysis as any).reportId || null
            }
          };
        } catch (error) {
          console.error('[LeadMagnet] Error analyzing property:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to analyze property',
            data: null
          };
        }
      }),

    // AI Investment Advisor Chat
    getInvestmentAdvice: publicProcedure
      .input(z.object({
        question: z.string().min(1, "Question is required"),
        conversationHistory: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })).default([]),
      }))
      .mutation(async ({ input }) => {
        try {
          // Use the new AI advisor with dynamic function calling
          const response = await getAIAdvisorResponse(
            input.question,
            input.conversationHistory as ChatMessage[]
          );
          
          return {
            success: true,
            data: { response },
          };
        } catch (error) {
          console.error("[Advanced] Error getting investment advice:", error);
          return {
            success: false,
            error: "Failed to get investment advice",
            data: null,
          };
        }
      }),


  }),

  // Favorite properties router
  favorites: router({
    // Get all favorite properties for a user or session
    list: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) {
            return { success: false, error: "Database not available", data: [] };
          }

          const userId = ctx.user?.id;
          const sessionId = input.sessionId;

          let favorites;
          if (userId) {
            favorites = await db
              .select()
              .from(favoriteProperties)
              .where(eq(favoriteProperties.userId, userId))
              .orderBy(desc(favoriteProperties.createdAt));
          } else if (sessionId) {
            favorites = await db
              .select()
              .from(favoriteProperties)
              .where(eq(favoriteProperties.sessionId, sessionId))
              .orderBy(desc(favoriteProperties.createdAt));
          } else {
            return { success: true, data: [] };
          }

          return { success: true, data: favorites };
        } catch (error) {
          console.error("[Favorites] Error listing:", error);
          return { success: false, error: "Failed to load favorites", data: [] };
        }
      }),

    // Add a property to favorites
    add: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        address: z.string().min(1, "Address is required"),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        bedrooms: z.number().int().optional(),
        bathrooms: z.number().optional(),
        propertyType: z.string().optional(),
        marketId: z.string().optional(),
        marketName: z.string().optional(),
        annualRevenue: z.number().int().optional(),
        monthlyRevenue: z.number().int().optional(),
        occupancyRate: z.number().optional(),
        averageDailyRate: z.number().int().optional(),
        monthlyRent: z.number().int().optional(),
        estimatedProfit: z.number().int().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) {
            return { success: false, error: "Database not available" };
          }

          const userId = ctx.user?.id;
          const sessionId = input.sessionId;

          if (!userId && !sessionId) {
            return { success: false, error: "User or session ID required" };
          }

          const [result] = await db.insert(favoriteProperties).values({
            userId: userId || null,
            sessionId: sessionId || null,
            address: input.address,
            city: input.city,
            state: input.state,
            zipCode: input.zipCode,
            latitude: input.latitude?.toString(),
            longitude: input.longitude?.toString(),
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms?.toString(),
            propertyType: input.propertyType,
            marketId: input.marketId,
            marketName: input.marketName,
            annualRevenue: input.annualRevenue,
            monthlyRevenue: input.monthlyRevenue,
            occupancyRate: input.occupancyRate?.toString(),
            averageDailyRate: input.averageDailyRate,
            monthlyRent: input.monthlyRent,
            estimatedProfit: input.estimatedProfit,
            notes: input.notes,
          });

          return { success: true, data: { id: result.insertId } };
        } catch (error) {
          console.error("[Favorites] Error adding:", error);
          return { success: false, error: "Failed to add favorite" };
        }
      }),

    // Remove a property from favorites
    remove: publicProcedure
      .input(z.object({
        id: z.number().int(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) {
            return { success: false, error: "Database not available" };
          }

          const userId = ctx.user?.id;
          const sessionId = input.sessionId;

          if (userId) {
            await db
              .delete(favoriteProperties)
              .where(and(
                eq(favoriteProperties.id, input.id),
                eq(favoriteProperties.userId, userId)
              ));
          } else if (sessionId) {
            await db
              .delete(favoriteProperties)
              .where(and(
                eq(favoriteProperties.id, input.id),
                eq(favoriteProperties.sessionId, sessionId)
              ));
          } else {
            return { success: false, error: "User or session ID required" };
          }

          return { success: true };
        } catch (error) {
          console.error("[Favorites] Error removing:", error);
          return { success: false, error: "Failed to remove favorite" };
        }
      }),

    // Update notes on a favorite property
    updateNotes: publicProcedure
      .input(z.object({
        id: z.number().int(),
        notes: z.string(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) {
            return { success: false, error: "Database not available" };
          }

          const userId = ctx.user?.id;
          const sessionId = input.sessionId;

          if (userId) {
            await db
              .update(favoriteProperties)
              .set({ notes: input.notes })
              .where(and(
                eq(favoriteProperties.id, input.id),
                eq(favoriteProperties.userId, userId)
              ));
          } else if (sessionId) {
            await db
              .update(favoriteProperties)
              .set({ notes: input.notes })
              .where(and(
                eq(favoriteProperties.id, input.id),
                eq(favoriteProperties.sessionId, sessionId)
              ));
          } else {
            return { success: false, error: "User or session ID required" };
          }

          return { success: true };
        } catch (error) {
          console.error("[Favorites] Error updating notes:", error);
          return { success: false, error: "Failed to update notes" };
        }
      }),
  }),

  // Export router for PDF and Excel downloads
  export: router({
    // Export analysis as PDF
    pdf: publicProcedure
      .input(z.object({
        address: z.string().min(1, "Address is required"),
        monthly_rent: z.number().min(0, "Monthly rent is required"),
        bedrooms: z.number().int().optional(),
        bathrooms: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Export] Generating PDF for:', input.address);
          
          // Run the analysis
          const analysis = await generateFullArbitrageAnalysis(
            input.address,
            input.monthly_rent,
            input.bedrooms,
            input.bathrooms
          );
          
          // Generate PDF
          const pdfBuffer = await generatePDFReport(analysis as any);
          const base64 = pdfBuffer.toString('base64');
          
          return {
            success: true,
            data: {
              base64,
              filename: `rental-analysis-${input.address.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`,
              mimeType: 'application/pdf'
            }
          };
        } catch (error) {
          console.error('[Export] Error generating PDF:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate PDF',
            data: null
          };
        }
      }),

    // Export analysis as Excel
    excel: publicProcedure
      .input(z.object({
        address: z.string().min(1, "Address is required"),
        monthly_rent: z.number().min(0, "Monthly rent is required"),
        bedrooms: z.number().int().optional(),
        bathrooms: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Export] Generating Excel for:', input.address);
          
          // Run the analysis
          const analysis = await generateFullArbitrageAnalysis(
            input.address,
            input.monthly_rent,
            input.bedrooms,
            input.bathrooms
          );
          
          // Generate Excel
          const excelBuffer = generateExcelReport(analysis as any);
          const base64 = excelBuffer.toString('base64');
          
          return {
            success: true,
            data: {
              base64,
              filename: `rental-analysis-${input.address.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.xlsx`,
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
          };
        } catch (error) {
          console.error('[Export] Error generating Excel:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate Excel',
            data: null
          };
        }
      }),

    // Export from existing analysis data (no re-fetch)
    pdfFromData: publicProcedure
      .input(z.object({
        analysisData: z.any(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Export] Generating PDF from existing data');
          
          const pdfBuffer = await generatePDFReport(input.analysisData);
          const base64 = pdfBuffer.toString('base64');
          const address = input.analysisData?.property_estimate?.property?.address || 'property';
          
          return {
            success: true,
            data: {
              base64,
              filename: `rental-analysis-${address.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`,
              mimeType: 'application/pdf'
            }
          };
        } catch (error) {
          console.error('[Export] Error generating PDF from data:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate PDF',
            data: null
          };
        }
      }),

    // Export from existing analysis data as Excel (no re-fetch)
    excelFromData: publicProcedure
      .input(z.object({
        analysisData: z.any(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Export] Generating Excel from existing data');
          
          const excelBuffer = generateExcelReport(input.analysisData);
          const base64 = excelBuffer.toString('base64');
          const address = input.analysisData?.property_estimate?.property?.address || 'property';
          
          return {
            success: true,
            data: {
              base64,
              filename: `rental-analysis-${address.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.xlsx`,
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
          };
        } catch (error) {
          console.error('[Export] Error generating Excel from data:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate Excel',
            data: null
          };
        }
      }),
  }),

  // Deep Analysis endpoints
  deepAnalysis: router({
    // Start deep analysis for a report
    start: publicProcedure
      .input(z.object({
        reportId: z.number().int().positive(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log(`[DeepAnalysis] Starting for report ${input.reportId}`);
          const result = await startDeepAnalysis(input.reportId);
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('[DeepAnalysis] Start error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to start deep analysis',
            data: null,
          };
        }
      }),

    // Get deep analysis status and results
    get: publicProcedure
      .input(z.object({
        reportId: z.number().int().positive(),
      }))
      .query(async ({ input }) => {
        try {
          const result = await getDeepAnalysis(input.reportId);
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('[DeepAnalysis] Get error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get deep analysis',
            data: null,
          };
        }
      }),
  }),

  // Listings by Area API
  listingsByArea: router({
    get: publicProcedure
      .input(z.object({
        address: z.string().min(1, "Address is required"),
        radiusMeters: z.number().int().min(100).max(50000).default(3000),
        bedrooms: z.number().int().min(1).max(20).optional(),
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
  }),

  // Bulk Summary API
  // Market Research with Browser Use
  marketResearch: marketResearchRouter,

  // Simplified Market Research (AirDNA only - instant results)
  marketResearchSimple: marketResearchSimpleRouter,

  // Opportunity Finder (Zillow + AirDNA + Coach Inayah)
  opportunityFinder: opportunityFinderRouter,

  // Admin portal for user activity tracking
  admin: adminRouter,

  // Comp Data and Historical Charts for Coach Inayah parity
  compData: router({
    getListings: publicProcedure
      .input(z.object({
        submarketId: z.string(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
        orderBy: z.enum(['revenue', 'adr', 'occupancy', 'rating']).default('revenue'),
        orderDirection: z.enum(['asc', 'desc']).default('desc'),
      }))
      .query(async ({ input }) => {
        try {
          const offset = (input.page - 1) * input.pageSize;
          const result = await getSubmarketListings(input.submarketId, {
            limit: input.pageSize,
            offset,
            orderBy: input.orderBy,
            orderDirection: input.orderDirection,
          });

          if (!result) {
            return {
              success: false,
              error: 'Could not fetch listings',
              listings: [],
              totalCount: 0,
            };
          }

          // Transform listings to match frontend interface
          const listings = result.listings.map((listing: any) => ({
            id: listing.id || listing.airbnb_listing_id || listing.property_id || String(Math.random()),
            title: listing.title || 'Untitled Listing',
            property_type: listing.property_type || 'unknown',
            bedrooms: listing.bedrooms || 0,
            bathrooms: listing.bathrooms || 0,
            accommodates: listing.accommodates || 0,
            annual_revenue: listing.annual_revenue || listing.revenue_ltm || listing.revenue || 0,
            adr: listing.adr || listing.average_daily_rate_ltm || 0,
            occupancy: listing.occupancy || listing.occupancy_rate_ltm || 0,
            rating: listing.rating || null,
            reviews: listing.reviews || 0,
            airbnb_url: listing.airbnb_url || listing.airbnb_property_url || listing.url || `https://www.airbnb.com/rooms/${listing.airbnb_property_id || listing.airbnb_listing_id || ''}`,
            image_url: listing.image_url || listing.thumbnail_url || (listing.images && listing.images[0]) || '',
            is_superhost: listing.is_superhost || listing.superhost || false,
            // Add coordinates - check both direct properties and location object
            latitude: listing.latitude || listing.location?.lat || null,
            longitude: listing.longitude || listing.location?.lng || null,
            exact_location: listing.exact_location || false,
          }));

          return {
            success: true,
            listings,
            totalCount: result.total_count || listings.length,
          };
        } catch (error) {
          console.error('[CompData.getListings] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch listings',
            listings: [],
            totalCount: 0,
          };
        }
      }),

    getHistoricalData: publicProcedure
      .input(z.object({
        marketId: z.string(),
        numMonths: z.number().int().min(12).max(60).default(24),
      }))
      .query(async ({ input }) => {
        try {
          const result = await getMarketHistoricalData(input.marketId, input.numMonths);

          if (!result) {
            return {
              success: false,
              error: 'Could not fetch historical data',
              data: {
                occupancy: [],
                revenue: [],
                adr: [],
                listings: [],
              },
            };
          }

          // Transform to match frontend interface
          const transformData = (dataPoints: any[]) => 
            (dataPoints || []).map((d: any) => ({
              month: d.month || d.date || '',
              value: d.value || d.avg || 0,
            }));

          return {
            success: true,
            data: {
              occupancy: transformData(result.occupancy),
              revenue: transformData(result.revenue),
              adr: transformData(result.adr),
              listings: transformData(result.active_listings),
            },
          };
        } catch (error) {
          console.error('[CompData.getHistoricalData] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch historical data',
            data: {
              occupancy: [],
              revenue: [],
              adr: [],
              listings: [],
            },
          };
        }
      }),
  }),

  bulkSummary: router({
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
  }),
});

export type AppRouter = typeof appRouter;

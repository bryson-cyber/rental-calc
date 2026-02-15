import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { aiAdvisorCache, analysisReports } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  getCountryMarkets,
  getListingsInRadius,
  getMarketSeasonality,
  getTopPerformers,
  calculateArbitrageFeasibility,
  getStandaloneMarketAdvisorData,
} from "../airdna";
import {
  generateComprehensivePropertyAdvice,
  generateMarketTrendNarrative,
  generateMaxPropertyAdvice,
  generateMaxMarketAdvice,
  type PropertyAdvisorInput,
  type MaxPropertyAdvisorInput,
  type MaxMarketAdvisorInput,
} from "../gemini";
import { getAIAdvisorResponse, type ChatMessage } from "../ai-advisor";
import { generateFullArbitrageAnalysis } from "../sop-reports";
import { getRentSummary } from "../rentometer";
import { logActivity, ActionCategory, ActionType } from "../activity";
import { notifyOwnerPropertyReport, notifyOwnerMarketReport } from "../notification-service";
import { canPerformAnalysis, recordAnalysisUsage } from "../usage-limits";

export const advancedRouter = router({
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
        // Lead capture fields
        leadName: z.string().optional(),
        leadEmail: z.string().email().optional(),
        leadPhone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Enforce daily usage limits (admins bypass)
          const userId = ctx.user?.id;
          const ipAddress = ctx.req?.ip || ctx.req?.socket?.remoteAddress;
          const limitCheck = await canPerformAnalysis(userId, undefined, ipAddress);
          if (!limitCheck.allowed) {
            return {
              success: false as const,
              error: limitCheck.reason || 'Daily analysis limit reached. Please try again tomorrow.',
              data: null,
              limitReached: true,
            };
          }

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
              const { analysisReports } = await import('../../drizzle/schema');
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
                // Lead capture data
                leadName: input.leadName || null,
                leadEmail: input.leadEmail || null,
                leadPhone: input.leadPhone || null,
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
          const result = {
            success: true as const,
            error: null as string | null,
            limitReached: false,
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

          // Record usage after successful analysis
          await recordAnalysisUsage(userId, undefined, ipAddress, 20).catch(err => 
            console.error('[LeadMagnet] Error recording usage:', err)
          );

          return result;
        } catch (error) {
          console.error('[LeadMagnet] Error analyzing property:', error);
          return {
            success: false as const,
            error: error instanceof Error ? error.message : 'Failed to analyze property',
            data: null,
            limitReached: false,
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


    // Comprehensive AI Property Advisor - synthesizes all data into actionable advice
    propertyAdvisor: publicProcedure
      .input(z.object({
        property: z.object({
          address: z.string(),
          bedrooms: z.number(),
          bathrooms: z.number(),
          accommodates: z.number().optional(),
          monthlyRent: z.number().optional(),
        }),
        revenue: z.object({
          projected: z.number(),
          low: z.number(),
          high: z.number(),
          adr: z.number(),
          occupancy: z.number(),
        }),
        cashFlow: z.object({
          monthlyRevenue: z.number(),
          monthlyRent: z.number(),
          monthlyProfit: z.number(),
          annualProfit: z.number(),
          profitMargin: z.number(),
        }).optional(),
        comparables: z.array(z.object({
          title: z.string(),
          bedrooms: z.number(),
          bathrooms: z.number(),
          revenue: z.number(),
          adr: z.number(),
          occupancy: z.number(),
          rating: z.number(),
          reviews: z.number(),
          distanceMeters: z.number().optional(),
          isSuperhost: z.boolean().optional(),
          isProfessionallyManaged: z.boolean().optional(),
        })),
        marketInsights: z.object({
          professionallyManagedPct: z.number(),
          superhostPct: z.number(),
          avgRating: z.number().optional(),
          totalListings: z.number().optional(),
          marketScore: z.number().optional(),
        }).optional(),
        historicalData: z.object({
          yoyChange: z.number(),
          trend: z.enum(['up', 'down', 'stable']),
          months: z.array(z.object({
            date: z.string(),
            revenue: z.number(),
            occupancy: z.number(),
            adr: z.number(),
          })),
        }).optional(),
        seasonality: z.array(z.object({
          month: z.string(),
          revenue: z.number(),
          adr: z.number(),
          occupancy: z.number(),
        })),
        marketGrade: z.object({
          grade: z.string(),
          score: z.number(),
          description: z.string(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[AI Advisor] Generating comprehensive property advice for:', input.property.address);
          const advice = await generateComprehensivePropertyAdvice(input as PropertyAdvisorInput);
          return {
            success: true,
            data: { advice },
          };
        } catch (error) {
          console.error('[AI Advisor] Error generating property advice:', error);
          return {
            success: false,
            error: 'Failed to generate property advice',
            data: null,
          };
        }
      }),

    // Market Trend Narrator - AI-powered natural language insights
    marketTrendNarrative: publicProcedure
      .input(z.object({
        marketName: z.string(),
        currentYearRevenue: z.number(),
        lastYearRevenue: z.number(),
        yoyChange: z.number(),
        occupancy: z.number(),
        adr: z.number(),
        monthlyData: z.array(z.object({
          month: z.string(),
          currentRevenue: z.number(),
          lastYearRevenue: z.number(),
          yoyChange: z.number(),
        })),
        marketGrade: z.string(),
        marketScore: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          const narrative = await generateMarketTrendNarrative(input);
          return {
            success: true,
            data: { narrative },
          };
        } catch (error) {
          console.error("[Advanced] Error generating market trend narrative:", error);
          return {
            success: false,
            error: "Failed to generate market trend narrative",
            data: null,
          };
        }
      }),

    // Maximum Capacity Property Advisor - Full 65K token output
    propertyAdvisorMax: publicProcedure
      .input(z.object({
        property: z.object({
          address: z.string(),
          city: z.string(),
          state: z.string(),
          zipCode: z.string(),
          bedrooms: z.number(),
          bathrooms: z.number(),
          accommodates: z.number(),
          monthlyRent: z.number().optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
        }),
        revenue: z.object({
          projected: z.number(),
          low: z.number(),
          high: z.number(),
          adr: z.number(),
          occupancy: z.number(),
          revpar: z.number(),
        }),
        cashFlow: z.object({
          monthlyRevenue: z.number(),
          monthlyRent: z.number(),
          monthlyProfit: z.number(),
          annualProfit: z.number(),
          profitMargin: z.number(),
          breakEvenOccupancy: z.number(),
        }).optional(),
        comparables: z.array(z.object({
          title: z.string(),
          bedrooms: z.number(),
          bathrooms: z.number(),
          accommodates: z.number(),
          revenue: z.number(),
          adr: z.number(),
          occupancy: z.number(),
          revpar: z.number(),
          rating: z.number(),
          reviews: z.number(),
          distanceMeters: z.number().optional(),
          isSuperhost: z.boolean().optional(),
          isProfessionallyManaged: z.boolean().optional(),
          propertyType: z.string().optional(),
          amenities: z.array(z.string()).optional(),
          lastReviewDate: z.string().optional(),
          listingUrl: z.string().optional(),
          photoCount: z.number().optional(),
        })),
        marketInsights: z.object({
          professionallyManagedPct: z.number(),
          superhostPct: z.number(),
          avgRating: z.number(),
          totalListings: z.number(),
          marketScore: z.number(),
          investabilityScore: z.number().optional(),
          rentalDemandScore: z.number().optional(),
          revenueGrowthScore: z.number().optional(),
          seasonalityScore: z.number().optional(),
          regulationScore: z.number().optional(),
        }),
        historicalData: z.object({
          yoyChange: z.number(),
          trend: z.enum(['up', 'down', 'stable']),
          months: z.array(z.object({
            date: z.string(),
            revenue: z.number(),
            occupancy: z.number(),
            adr: z.number(),
            revpar: z.number(),
            listingCount: z.number().optional(),
          })),
        }),
        seasonality: z.array(z.object({
          month: z.string(),
          revenue: z.number(),
          adr: z.number(),
          occupancy: z.number(),
          revpar: z.number(),
          yoyChange: z.number().optional(),
        })),
        marketGrade: z.object({
          grade: z.string(),
          score: z.number(),
          description: z.string(),
          factors: z.array(z.object({
            name: z.string(),
            score: z.number(),
            weight: z.number(),
          })),
        }),
        marketPosition: z.object({
          percentile: z.number(),
          rank: z.number(),
          totalListings: z.number(),
          vsAverage: z.number(),
        }),
        // Purchase mode support
        mode: z.enum(['rent', 'purchase']).optional(),
        purchaseData: z.object({
          purchasePrice: z.number(),
          loanType: z.enum(['conventional', 'dscr', 'fha', 'cash']),
          downPaymentPercent: z.number(),
          downPayment: z.number(),
          loanAmount: z.number(),
          interestRate: z.number(),
          monthlyMortgage: z.number(),
          closingCosts: z.number(),
          totalCashNeeded: z.number(),
        }).optional(),
        // Supply Trend Data
        supplyTrend: z.object({
          currentListings: z.number(),
          listings12MonthsAgo: z.number(),
          netChange: z.number(),
          percentChange: z.number(),
          trend: z.enum(['growing', 'declining', 'stable']),
          insight: z.string(),
          monthlyData: z.array(z.object({
            month: z.string(),
            activeListings: z.number(),
            changeFromPrevious: z.number(),
          })).optional(),
        }).optional(),
        // Submarket/Neighborhood Data
        submarkets: z.array(z.object({
          id: z.string(),
          name: z.string(),
          listingCount: z.number(),
          metrics: z.object({
            occupancy: z.number(),
            adr: z.number(),
            revenue: z.number(),
            revpar: z.number(),
            marketScore: z.number().optional(),
          }).optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          
          // Generate cache key from property address + bedrooms + bathrooms + mode
          const normalizedAddress = input.property.address.toLowerCase().replace(/[^a-z0-9]/g, '');
          const mode = input.mode || 'rent';
          const cacheKey = `property_${normalizedAddress}_${input.property.bedrooms}_${input.property.bathrooms}_${mode}`;
          
          // Check cache first (only if db is available)
          if (db) {
            const cachedResult = await db.select().from(aiAdvisorCache)
              .where(and(
                eq(aiAdvisorCache.cacheType, 'property'),
                eq(aiAdvisorCache.cacheKey, cacheKey)
              ))
              .limit(1);
            
            if (cachedResult.length > 0 && cachedResult[0].expiresAt > new Date()) {
              console.log('[AI Advisor Max] Cache HIT for property:', input.property.address);
              // Update hit count and last accessed
              await db.update(aiAdvisorCache)
                .set({ 
                  hitCount: cachedResult[0].hitCount + 1,
                  lastAccessedAt: new Date()
                })
                .where(eq(aiAdvisorCache.id, cachedResult[0].id));
              
              return {
                success: true,
                data: { advice: cachedResult[0].advice, cached: true },
              };
            }
          }
          
          console.log('[AI Advisor Max] Cache MISS - Generating maximum capacity property advice for:', input.property.address);
          
          // Fetch Rentometer data for long-term rental market comparison
          let rentometerData: MaxPropertyAdvisorInput['rentometerData'] = undefined;
          try {
            console.log('[AI Advisor Max] Fetching Rentometer data for:', input.property.address);
            const rentData = await getRentSummary({
              address: input.property.address,
              bedrooms: input.property.bedrooms,
              buildingType: 'apartment', // Default to apartment for arbitrage
            });
            
            rentometerData = {
              median: rentData.median,
              mean: rentData.mean,
              percentile25: rentData.percentile_25,
              percentile75: rentData.percentile_75,
              min: rentData.min,
              max: rentData.max,
              samples: rentData.samples,
              radiusMiles: rentData.radius_miles,
            };
            
            // If user provided monthly rent, calculate comparison metrics
            if (input.property.monthlyRent) {
              const userRent = input.property.monthlyRent;
              const rentAdvantage = rentData.median - userRent;
              const rentAdvantagePercent = Math.round((rentAdvantage / rentData.median) * 100);
              
              let percentilePosition: string;
              if (userRent <= rentData.percentile_25) {
                percentilePosition = 'bottom 25% (excellent deal)';
              } else if (userRent <= rentData.median) {
                percentilePosition = 'below median (good deal)';
              } else if (userRent <= rentData.percentile_75) {
                percentilePosition = 'above median (fair)';
              } else {
                percentilePosition = 'top 25% (premium rent)';
              }
              
              rentometerData.userRent = userRent;
              rentometerData.rentAdvantage = rentAdvantage;
              rentometerData.rentAdvantagePercent = rentAdvantagePercent;
              rentometerData.percentilePosition = percentilePosition;
            }
            
            console.log('[AI Advisor Max] Rentometer data fetched: median=$' + rentData.median + ', samples=' + rentData.samples);
          } catch (rentError) {
            console.warn('[AI Advisor Max] Could not fetch Rentometer data:', rentError);
            // Continue without Rentometer data - it's optional
          }
          
          const advice = await generateMaxPropertyAdvice({
            ...input as MaxPropertyAdvisorInput,
            rentometerData,
          });
          
          // Store in cache (expires in 7 days) - only if db is available
          if (db) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);
            
            // Delete old cache entry if exists
            await db.delete(aiAdvisorCache)
              .where(and(
                eq(aiAdvisorCache.cacheType, 'property'),
                eq(aiAdvisorCache.cacheKey, cacheKey)
              ));
            
            // Insert new cache entry
            await db.insert(aiAdvisorCache).values({
              cacheType: 'property',
              cacheKey,
              address: input.property.address,
              city: input.property.city,
              state: input.property.state,
              zipCode: input.property.zipCode,
              bedrooms: input.property.bedrooms,
              bathrooms: String(input.property.bathrooms),
              advice,
              expiresAt,
            });
            
            console.log('[AI Advisor Max] Cached property advice for:', input.property.address);
          }
          
          // Send notification to owner (async, don't wait)
          notifyOwnerPropertyReport({
            address: input.property.address,
            city: input.property.city,
            state: input.property.state,
            bedrooms: input.property.bedrooms,
            bathrooms: input.property.bathrooms,
            annualRevenue: input.revenue.projected,
            occupancyRate: input.revenue.occupancy / 100, // Convert to decimal
          }).catch(err => console.error('[Notification] Failed to notify owner:', err));
          
          return {
            success: true,
            data: { advice, cached: false },
          };
        } catch (error) {
          console.error('[AI Advisor Max] Error generating property advice:', error);
          return {
            success: false,
            error: 'Failed to generate comprehensive property advice',
            data: null,
          };
        }
      }),

    // Maximum Capacity Market Advisor - Full 65K token output
    marketAdvisorMax: publicProcedure
      .input(z.object({
        market: z.object({
          name: z.string(),
          city: z.string(),
          state: z.string(),
          country: z.string(),
        }),
        scores: z.object({
          marketScore: z.number(),
          investabilityScore: z.number(),
          rentalDemandScore: z.number(),
          revenueGrowthScore: z.number(),
          seasonalityScore: z.number(),
          regulationScore: z.number(),
        }),
        metrics: z.object({
          avgRevenue: z.number(),
          avgOccupancy: z.number(),
          avgAdr: z.number(),
          avgRevpar: z.number(),
          totalListings: z.number(),
          professionallyManagedPct: z.number(),
          superhostPct: z.number(),
          avgRating: z.number(),
        }),
        revenueByBedroom: z.array(z.object({
          bedrooms: z.number(),
          avgRevenue: z.number(),
          avgOccupancy: z.number(),
          avgAdr: z.number(),
          listingCount: z.number(),
        })),
        historicalData: z.object({
          yoyChange: z.number(),
          trend: z.enum(['up', 'down', 'stable']),
          months: z.array(z.object({
            date: z.string(),
            revenue: z.number(),
            occupancy: z.number(),
            adr: z.number(),
            listingCount: z.number().optional(),
          })),
        }),
        seasonality: z.array(z.object({
          month: z.string(),
          revenue: z.number(),
          occupancy: z.number(),
          adr: z.number(),
          yoyChange: z.number().optional(),
        })),
        topPerformers: z.array(z.object({
          title: z.string(),
          bedrooms: z.number(),
          bathrooms: z.number(),
          revenue: z.number(),
          occupancy: z.number(),
          adr: z.number(),
          rating: z.number(),
          reviews: z.number(),
          isSuperhost: z.boolean().optional(),
          isProfessionallyManaged: z.boolean().optional(),
        })),
        propertyTypes: z.array(z.object({
          type: z.string(),
          count: z.number(),
          avgRevenue: z.number(),
          avgOccupancy: z.number(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          
          // Generate cache key from market name + state
          const normalizedMarket = input.market.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedState = input.market.state.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cacheKey = `market_${normalizedMarket}_${normalizedState}`;
          
          // Check cache first (only if db is available)
          if (db) {
            const cachedResult = await db.select().from(aiAdvisorCache)
              .where(and(
                eq(aiAdvisorCache.cacheType, 'market'),
                eq(aiAdvisorCache.cacheKey, cacheKey)
              ))
              .limit(1);
            
            if (cachedResult.length > 0 && cachedResult[0].expiresAt > new Date()) {
              console.log('[AI Advisor Max] Cache HIT for market:', input.market.name);
              // Update hit count and last accessed
              await db.update(aiAdvisorCache)
                .set({ 
                  hitCount: cachedResult[0].hitCount + 1,
                  lastAccessedAt: new Date()
                })
                .where(eq(aiAdvisorCache.id, cachedResult[0].id));
              
              return {
                success: true,
                data: { advice: cachedResult[0].advice, cached: true },
              };
            }
          }
          
          console.log('[AI Advisor Max] Cache MISS - Generating maximum capacity market advice for:', input.market.name);
          const advice = await generateMaxMarketAdvice(input as MaxMarketAdvisorInput);
          
          // Store in cache (expires in 7 days) - only if db is available
          if (db) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);
            
            // Delete old cache entry if exists
            await db.delete(aiAdvisorCache)
              .where(and(
                eq(aiAdvisorCache.cacheType, 'market'),
                eq(aiAdvisorCache.cacheKey, cacheKey)
              ));
            
            // Insert new cache entry
            await db.insert(aiAdvisorCache).values({
              cacheType: 'market',
              cacheKey,
              marketName: input.market.name,
              city: input.market.city,
              state: input.market.state,
              advice,
              expiresAt,
            });
            
            console.log('[AI Advisor Max] Cached market advice for:', input.market.name);
          }
          
          // Send notification to owner (async, don't wait)
          notifyOwnerMarketReport({
            marketName: input.market.name,
            state: input.market.state,
            averageRevenue: input.metrics?.avgRevenue,
            averageOccupancy: input.metrics?.avgOccupancy ? input.metrics.avgOccupancy / 100 : undefined,
            listingCount: input.metrics?.totalListings,
          }).catch(err => console.error('[Notification] Failed to notify owner:', err));
          
          return {
            success: true,
            data: { advice, cached: false },
          };
        } catch (error) {
          console.error('[AI Advisor Max] Error generating market advice:', error);
          return {
            success: false,
            error: 'Failed to generate comprehensive market advice',
            data: null,
          };
        }
      }),

    // Standalone Market Advisor - Fetches all data and generates AI report
    // Simplified Market Advisor - Only bedroom filter, fixed to entire_home property type
    standaloneMarketAdvisor: publicProcedure
      .input(z.object({
        marketId: z.string().min(1, "Market ID is required"),
        marketType: z.enum(['market', 'submarket', 'zipcode']).default('market'),
        // Bedroom filter: 0 = Studio, 1-6 = specific bedrooms, undefined = all
        bedrooms: z.number().min(0).max(10).optional(),
        // Fixed to entire_home for arbitrage analysis - no private rooms or shared spaces
        listingType: z.literal('entire_home').default('entire_home'),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log('[Standalone Market Advisor] FULL INPUT:', JSON.stringify(input));
          console.log('[Standalone Market Advisor] Starting analysis for:', input.marketId, 'type:', input.marketType);
          console.log('[Standalone Market Advisor] Bedroom filter:', input.bedrooms, '(type:', typeof input.bedrooms, ')');
          console.log('[Standalone Market Advisor] Property type: entire_home (fixed)');
          
          // Step 1: Fetch comprehensive market data with simplified filters
          // Only bedroom filter is user-selectable; listingType is fixed to entire_home
          const marketData = await getStandaloneMarketAdvisorData(input.marketId, input.marketType, {
            bedrooms: input.bedrooms,
            listingType: 'entire_home', // Fixed for arbitrage analysis
          });
          
          if (!marketData) {
            return {
              success: false,
              error: 'Could not fetch market data. Please try a different market.',
              data: null,
            };
          }
          
          console.log('[Standalone Market Advisor] Market data fetched:', marketData.market.name);
          
          // Step 2: Generate AI advice using the comprehensive data
          const adviceInput: MaxMarketAdvisorInput = {
            market: {
              name: marketData.market.name,
              city: marketData.market.city,
              state: marketData.market.state,
              country: marketData.market.country,
            },
            appliedFilters: {
              bedrooms: input.bedrooms,
              listingType: 'entire_home', // Fixed for arbitrage analysis
            },
          scores: marketData.scores,
            metrics: marketData.metrics,
            revenueByBedroom: marketData.revenueByBedroom,
            historicalData: {
              yoyChange: marketData.historicalData.yoyChange,
              trend: marketData.historicalData.trend,
              months: marketData.historicalData.months.map(m => ({
                date: m.date,
                revenue: m.revenue,
                occupancy: m.occupancy,
                adr: m.adr,
                revpar: m.revpar,
                listingCount: m.listingCount,
              })),
            },
            seasonality: marketData.seasonality.map(s => ({
              month: s.monthName,
              revenue: s.revenue,
              occupancy: s.occupancy,
              adr: s.adr,
              yoyChange: s.yoyChange,
            })),
            topPerformers: marketData.topPerformers.map(p => ({
              title: p.title,
              bedrooms: p.bedrooms,
              bathrooms: p.bathrooms,
              revenue: p.revenue,
              occupancy: p.occupancy,
              adr: p.adr,
              rating: p.rating,
              reviews: p.reviews,
              isSuperhost: p.isSuperhost,
              isProfessionallyManaged: p.isProfessionallyManaged,
            })),
            propertyTypes: marketData.propertyTypes.map(pt => ({
              type: pt.type,
              count: pt.count,
              avgRevenue: pt.avgRevenue,
              avgOccupancy: pt.avgOccupancy,
            })),
            bookingPatterns: marketData.bookingPatterns ?? undefined,
            supplyTrend: marketData.supplyTrend ?? undefined,
            submarkets: marketData.submarkets ?? undefined,
            cancellationPolicies: marketData.cancellationPolicies ?? undefined,
            professionalStats: marketData.professionalStats ? {
              totalListings: marketData.professionalStats.totalListings,
              professionalCount: marketData.professionalStats.professionalCount,
              individualCount: marketData.professionalStats.individualCount,
              professionalPercentage: marketData.professionalStats.professionalPercentage,
              superhostCount: marketData.professionalStats.superhostCount,
              superhostPercentage: marketData.professionalStats.superhostPercentage,
              avgRevenueProfessional: marketData.professionalStats.avgRevenueProfessional,
              avgRevenueIndividual: marketData.professionalStats.avgRevenueIndividual,
              revenuePremiumPercent: marketData.professionalStats.revenuePremiumPercent,
            } : undefined,
          };
          
          const advice = await generateMaxMarketAdvice(adviceInput);
          
          console.log('[Standalone Market Advisor] AI advice generated, length:', advice.length);
          
          // Filter revenueByBedroom if bedroom filter is applied
          // Use explicit undefined check to handle Studio (bedrooms=0)
          let filteredRevenueByBedroom = input.bedrooms !== undefined
            ? marketData.revenueByBedroom.filter(r => r.bedrooms === input.bedrooms)
            : marketData.revenueByBedroom;
          
          // Filter topPerformers if bedroom filter is applied
          let filteredTopPerformers = input.bedrooms !== undefined
            ? marketData.topPerformers.filter(p => p.bedrooms === input.bedrooms)
            : marketData.topPerformers;
          
          // If bedroom filter results in empty data, fall back to all data with a note
          let bedroomFilterNote = '';
          if (input.bedrooms !== undefined && filteredRevenueByBedroom.length === 0) {
            console.log('[Standalone Market Advisor] No data for', input.bedrooms, 'BR, falling back to all data');
            filteredRevenueByBedroom = marketData.revenueByBedroom;
            filteredTopPerformers = marketData.topPerformers;
            bedroomFilterNote = `Note: No ${input.bedrooms}-bedroom properties found in this market. Showing all bedroom sizes.`;
          }
          
          console.log('[Standalone Market Advisor] Bedroom filter:', input.bedrooms, 'Filtered revenueByBedroom count:', filteredRevenueByBedroom.length, 'Filtered topPerformers count:', filteredTopPerformers.length);
          
          return {
            success: true,
            data: {
              market: marketData.market,
              scores: marketData.scores,
              metrics: marketData.metrics,
              revenueByBedroom: filteredRevenueByBedroom,
              historicalData: marketData.historicalData,
              seasonality: marketData.seasonality,
              bookingPatterns: marketData.bookingPatterns,
              supplyTrend: marketData.supplyTrend,
              topPerformers: filteredTopPerformers,
              submarkets: marketData.submarkets,
              propertyTypes: marketData.propertyTypes,
              cancellationPolicies: marketData.cancellationPolicies,
              professionalStats: marketData.professionalStats,
              advice,
              bedroomFilterNote,
            },
          };
        } catch (error) {
          console.error('[Standalone Market Advisor] Error:', error);
          return {
            success: false,
            error: 'Failed to generate market analysis. Please try again.',
            data: null,
          };
        }
      }),
});

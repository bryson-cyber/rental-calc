import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sharedReports } from "../../drizzle/schema";
import { eq, desc, or } from "drizzle-orm";
import { getComprehensivePropertyReport } from "../airdna";
import { generateFullReportSummary, type FullReportSummaryInput } from "../gemini";
import { getRegulationInfo } from "../regulation-tracker";
import { searchZillowListings } from "../hasdata";
import { checkReportRateLimit, incrementReportCount } from "../rate-limiter";

export const sharedReportsRouter = router({
    // Create a new shared report
    create: publicProcedure
      .input(z.object({
        reportType: z.enum(['property', 'market', 'full']),
        // Property fields
        address: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        accommodates: z.number().optional(),
        // Market fields
        marketId: z.string().optional(),
        marketName: z.string().optional(),
        submarketId: z.string().optional(),
        submarketName: z.string().optional(),
        // Report data
        reportData: z.any(),
        // Access controls
        expiresInDays: z.number().min(1).max(365).optional(),
        maxViews: z.number().min(1).max(1000).optional(),
        // Creator name (for display)
        creatorName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Rate limit: 5 reports/day for standard users, admin exempt
        if (ctx.user) {
          checkReportRateLimit(ctx.user.id, ctx.user.role);
        }
        
        // Generate unique share ID
        const shareId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        
        // Calculate expiration if specified
        const expiresAt = input.expiresInDays 
          ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
          : null;
        
        // Generate AI summary if not provided and this is a full property report
        let reportData = typeof input.reportData === 'object' ? input.reportData : (typeof input.reportData === 'string' ? JSON.parse(input.reportData) : input.reportData);
        if (input.reportType === 'full' && reportData && !reportData.ai_summary) {
          try {
            console.log('[SharedReport] Generating comprehensive AI summary via Gemini 3 Pro...');
            const summaryInput: FullReportSummaryInput = {
              property: {
                address: input.address || reportData.property?.address || 'Unknown Address',
                city: reportData.property?.city,
                state: reportData.property?.state,
                bedrooms: input.bedrooms || reportData.property?.bedrooms || 0,
                bathrooms: input.bathrooms || reportData.property?.bathrooms || 0,
                accommodates: input.accommodates || reportData.property?.accommodates || 0,
              },
              revenue: {
                annual: reportData.revenue_estimate?.annual || 0,
                monthly: reportData.revenue_estimate?.monthly || 0,
                nightly: reportData.revenue_estimate?.nightly || 0,
                occupancy: reportData.revenue_estimate?.occupancy || 0,
                range: reportData.revenue_estimate?.range,
              },
              monthlyForecast: reportData.monthly_forecast,
              marketData: reportData.market_data ? {
                name: reportData.market_data.name || 'Your Market',
                occupancy: reportData.market_data.metrics?.occupancy || 0,
                adr: reportData.market_data.metrics?.adr || 0,
                revenue: reportData.market_data.metrics?.revenue || 0,
                listingCount: reportData.market_data.listing_count || 0,
                marketScore: reportData.market_data.metrics?.market_score ? Math.round(reportData.market_data.metrics.market_score) : undefined,
              } : undefined,
              bedroomPerformance: reportData.bedroom_performance,
              competitors: (reportData.comps || []).slice(0, 15).map((c: any) => ({
                name: c.title || 'Competitor',
                revenue: c.annual_revenue || 0,
                adr: c.adr || 0,
                occupancy: c.occupancy || 0,
                rating: c.rating ?? undefined,
                reviews: c.reviews || 0,
                bedrooms: c.bedrooms,
              })),
              revenuePercentiles: reportData.revenue_percentiles,
              historicalData: reportData.historical_data,
              rentalArbitrage: reportData.rental_arbitrage,
              purchase: reportData.purchase,
              preparedFor: reportData.prepared_for || input.creatorName,
              stressTest: reportData.stress_test?.scenarios?.map((s: any) => ({
                occupancyRate: s.occupancy_pct ?? s.occupancy ?? 0,
                adrMultiplier: reportData.stress_test?.base_adr ? s.adr / reportData.stress_test.base_adr : 1,
                monthlyRevenue: s.monthly_revenue || 0,
                monthlyProfit: s.monthly_profit || 0,
                annualProfit: (s.monthly_profit || 0) * 12,
                cashFlow: (s.monthly_profit || 0) >= 0 ? 'positive' : 'negative',
              })),
              itemizedExpenses: reportData.itemized_expenses,
              regulation: reportData.regulation,
              comparableSales: reportData.comparable_sales,
            };
            const aiSummary = await generateFullReportSummary(summaryInput);
            if (aiSummary && aiSummary.length > 100) {
              reportData = { ...reportData, ai_summary: aiSummary };
              console.log('[SharedReport] Comprehensive AI summary generated successfully (' + aiSummary.length + ' chars)');
            }
          } catch (e) {
            console.error('[SharedReport] Failed to generate AI summary:', e);
            // Continue without AI summary - the report will use the auto-generated fallback
          }
        }
        
        // === POST-PROCESSING: Ensure stress_test, regulation, and expense_breakdown are always populated ===
        if (input.reportType === 'full' && reportData && typeof reportData === 'object') {
          const revEstimate = reportData.revenue_estimate;
          const bedrooms = input.bedrooms || reportData.property?.bedrooms || 2;
          const annualRev = revEstimate?.annual || 0;
          const occRate = revEstimate?.occupancy ? (revEstimate.occupancy > 1 ? revEstimate.occupancy / 100 : revEstimate.occupancy) : 0.5;
          const adr = revEstimate?.nightly || 0;

          // Generate expense_breakdown if missing
          if (!reportData.expense_breakdown && !reportData.itemized_expenses && annualRev > 0) {
            const monthlyRevBase = Math.round(annualRev / 12);
            const nightsPerMonth = Math.round(occRate * 30);
            const itemizedExpenses = {
              cleaning: Math.round(nightsPerMonth * 0.33 * (bedrooms <= 1 ? 75 : bedrooms <= 2 ? 100 : bedrooms <= 3 ? 140 : 180)),
              platform_fees: Math.round(monthlyRevBase * 0.14),
              property_management: Math.round(monthlyRevBase * 0.15),
              supplies: Math.round(bedrooms * 40 + 60),
              utilities: Math.round(bedrooms * 75 + 100),
              maintenance: Math.round(monthlyRevBase * 0.05),
              insurance: Math.round(bedrooms <= 2 ? 150 : bedrooms <= 4 ? 225 : 300),
              licenses_taxes: Math.round(monthlyRevBase * 0.08),
            };
            const totalMonthlyExpenses = Object.values(itemizedExpenses).reduce((a, b) => a + b, 0);
            const expensePercent = monthlyRevBase > 0 ? Math.round((totalMonthlyExpenses / monthlyRevBase) * 100) : 0;
            reportData.expense_breakdown = {
              items: itemizedExpenses,
              total_monthly: totalMonthlyExpenses,
              total_annual: totalMonthlyExpenses * 12,
              percent_of_revenue: expensePercent,
              note: 'Estimates based on market averages. Property management fee included — remove if self-managing to increase profit.',
            };
            console.log('[SharedReport] Generated expense_breakdown for report');
          }

          // Generate stress_test if missing
          if (!reportData.stress_test && annualRev > 0 && adr > 0) {
            const expenseBreakdown = reportData.expense_breakdown || reportData.itemized_expenses;
            const totalMonthly = expenseBreakdown?.total_monthly || Math.round(annualRev / 12 * 0.35);
            const expPct = Math.round(annualRev / 12) > 0 ? Math.round((totalMonthly / Math.round(annualRev / 12)) * 100) : 35;
            const baseOcc = occRate;
            const baseAdr = adr;
            const occScenarios = [
              Math.max(0.25, baseOcc - 0.20),
              Math.max(0.30, baseOcc - 0.10),
              baseOcc,
              Math.min(0.95, baseOcc + 0.10),
            ];
            const adrScenarios = [
              Math.round(baseAdr * 0.75),
              Math.round(baseAdr * 0.90),
              baseAdr,
              Math.round(baseAdr * 1.10),
            ];
            const stressTestMatrix: Array<{ occupancy_pct: number; adr: number; annual_revenue: number; monthly_revenue: number; monthly_profit: number; cash_flow_positive: boolean; }> = [];
            for (const occ of occScenarios) {
              for (const testAdr of adrScenarios) {
                const testAnnualRev = Math.round(occ * testAdr * 365);
                const testMonthlyRev = Math.round(testAnnualRev / 12);
                const testExpenses = Math.round(testMonthlyRev * (expPct / 100));
                const monthlyProfit = testMonthlyRev - testExpenses;
                stressTestMatrix.push({
                  occupancy_pct: occ,
                  adr: testAdr,
                  annual_revenue: testAnnualRev,
                  monthly_revenue: testMonthlyRev,
                  monthly_profit: monthlyProfit,
                  cash_flow_positive: monthlyProfit >= 0,
                });
              }
            }
            reportData.stress_test = {
              base_occupancy: baseOcc,
              base_adr: baseAdr,
              scenarios: stressTestMatrix,
              occupancy_levels: occScenarios,
              adr_levels: adrScenarios,
              breakeven_note: 'Green cells indicate positive cash flow. The breakeven point is where monthly profit crosses $0.',
            };
            console.log('[SharedReport] Generated stress_test for report');
          }

          // Fetch regulation if missing
          if (!reportData.regulation) {
            try {
              const city = reportData.property?.city;
              const state = reportData.property?.state;
              if (city && state) {
                console.log(`[SharedReport] Fetching regulation data for ${city}, ${state}...`);
                const regData = await getRegulationInfo(city, state);
                if (regData && regData.status !== 'unknown') {
                  reportData.regulation = {
                    status: regData.status,
                    summary: regData.simplifiedSummary || regData.summary,
                    key_requirements: regData.keyRequirements || [],
                    permit_required: regData.permitRequired,
                    primary_residence_only: regData.primaryResidenceOnly,
                    max_nights_per_year: regData.maxNightsPerYear,
                    registration_fee: regData.registrationFee,
                    occupancy_tax: regData.occupancyTax,
                    zoning_restrictions: regData.zoningRestrictions,
                    confidence: regData.confidence,
                    warnings: regData.warnings || [],
                    sources: regData.sources?.slice(0, 3) || [],
                  };
                  console.log(`[SharedReport] Regulation status: ${regData.status}`);
                }
              }
            } catch (regErr) {
              console.error('[SharedReport] Regulation fetch failed (non-fatal):', regErr);
            }
          }
        }

        // Serialize reportData to JSON string for text column
        const reportDataStr = typeof reportData === 'string' 
          ? reportData 
          : JSON.stringify(reportData);
        
        await db.insert(sharedReports).values({
          shareId,
          reportType: input.reportType,
          address: input.address,
          latitude: input.latitude?.toString(),
          longitude: input.longitude?.toString(),
          bedrooms: input.bedrooms,
          bathrooms: input.bathrooms?.toString(),
          accommodates: input.accommodates,
          marketId: input.marketId,
          marketName: input.marketName,
          submarketId: input.submarketId,
          submarketName: input.submarketName,
          reportData: reportDataStr,
          expiresAt,
          maxViews: input.maxViews,
          createdByUserId: ctx.user?.id,
          createdByName: input.creatorName || ctx.user?.name,
        });
        
        // Increment rate limit counter on success
        if (ctx.user) {
          incrementReportCount(ctx.user.id, ctx.user.role);
        }
        
        return { success: true, shareId };
      }),

    // Get a shared report by ID
    get: publicProcedure
      .input(z.object({
        shareId: z.string(),
        password: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const results = await db
          .select()
          .from(sharedReports)
          .where(eq(sharedReports.shareId, input.shareId))
          .limit(1);
        
        if (results.length === 0) {
          return { success: false, error: 'Report not found' };
        }
        
        const report = results[0];
        
        // Check expiration
        if (report.expiresAt && new Date(report.expiresAt) < new Date()) {
          return { success: false, error: 'This report has expired' };
        }
        
        // Check view limit
        if (report.maxViews && report.viewCount >= report.maxViews) {
          return { success: false, error: 'This report has reached its view limit' };
        }
        
        // Password protection removed from this version
        // (passwordHash column no longer exists in database)
        
        // Increment view count
        await db.update(sharedReports)
          .set({ viewCount: report.viewCount + 1 })
          .where(eq(sharedReports.shareId, input.shareId));
        
        return {
          success: true,
          data: {
            reportType: report.reportType,
            address: report.address,
            latitude: report.latitude ? parseFloat(report.latitude) : null,
            longitude: report.longitude ? parseFloat(report.longitude) : null,
            bedrooms: report.bedrooms,
            bathrooms: report.bathrooms ? parseFloat(report.bathrooms) : null,
            marketId: report.marketId,
            marketName: report.marketName,
            reportData: report.reportData,
            viewCount: report.viewCount + 1,
            maxViews: report.maxViews,
            expiresAt: report.expiresAt,
            createdAt: report.createdAt,
          },
        };
      }),

    // List shared reports created by user/session
    list: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        let results;
        if (ctx.user?.id) {
          results = await db
            .select()
            .from(sharedReports)
            .where(eq(sharedReports.createdByUserId, ctx.user.id))
            .orderBy(desc(sharedReports.createdAt))
            .limit(50);
        } else {
          // Session-based filtering removed (createdBySessionId no longer exists)
          return { success: true, data: [] };
        }
        
        return {
          success: true,
          data: results.map(r => ({
            shareId: r.shareId,
            reportType: r.reportType,
            address: r.address,
            marketName: r.marketName,
            viewCount: r.viewCount,
            maxViews: r.maxViews,
            expiresAt: r.expiresAt,
            createdAt: r.createdAt,
          })),
        };
      }),

    // Save comp selection for a shared report (admin only)
    saveCompSelection: protectedProcedure
      .input(z.object({
        shareId: z.string(),
        selectedCompIds: z.array(z.string()),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new Error('Only admins can save comp selections');
        }
        const db = await getDb();
        if (!db) throw new Error('Database not available');

        const results = await db
          .select()
          .from(sharedReports)
          .where(eq(sharedReports.shareId, input.shareId))
          .limit(1);

        if (results.length === 0) {
          throw new Error('Report not found');
        }

        const report = results[0];
        let reportData: any;
        try {
          reportData = typeof report.reportData === 'string'
            ? JSON.parse(report.reportData)
            : report.reportData;
        } catch {
          throw new Error('Failed to parse report data');
        }

        // Store the comp selection in the report data
        reportData.comp_selection = {
          selectedIds: input.selectedCompIds,
          savedAt: Date.now(),
          savedBy: ctx.user.name || ctx.user.openId,
        };

        await db.update(sharedReports)
          .set({ reportData: JSON.stringify(reportData) })
          .where(eq(sharedReports.shareId, input.shareId));

        return { success: true, selectedCount: input.selectedCompIds.length };
      }),

    // Regenerate a shared report with fresh data from AirDNA + Gemini 3
    regenerate: protectedProcedure
      .input(z.object({
        shareId: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Fetch existing report
        const results = await db
          .select()
          .from(sharedReports)
          .where(eq(sharedReports.shareId, input.shareId))
          .limit(1);
        
        if (results.length === 0) {
          return { success: false, error: 'Report not found' };
        }
        
        const report = results[0];
        
        // Only owner or admin can regenerate
        const isOwner = (ctx.user?.id && report.createdByUserId === ctx.user.id);
        const isAdmin = ctx.user?.role === 'admin';
        if (!isOwner && !isAdmin) {
          return { success: false, error: 'Not authorized to regenerate this report' };
        }
        
        // Rate limit: 5 reports/day for standard users, admin exempt
        checkReportRateLimit(ctx.user.id, ctx.user.role);
        
        if (report.reportType !== 'full') {
          return { success: false, error: 'Only full property reports can be regenerated' };
        }
        
        const address = report.address;
        if (!address) {
          return { success: false, error: 'No address found for this report' };
        }
        
        const bedrooms = report.bedrooms || 3;
        const bathrooms = report.bathrooms ? parseFloat(report.bathrooms) : 2;
        const accommodates = report.accommodates || bedrooms * 2;
        
        // Parse existing report data to preserve purchase/arbitrage settings
        let existingData: any = {};
        try {
          existingData = typeof report.reportData === 'string' ? JSON.parse(report.reportData) : report.reportData || {};
        } catch { existingData = {}; }
        
        console.log(`[Regenerate] Starting regeneration for ${address} (${bedrooms}BR/${bathrooms}BA)...`);
        
        try {
          // Step 1: Re-run the comprehensive property report from AirDNA
          const freshReport = await getComprehensivePropertyReport(
            address,
            bedrooms,
            bathrooms,
            accommodates
          );
          
          if (!freshReport) {
            return { success: false, error: 'Failed to fetch fresh market data' };
          }
          
          const prop = freshReport.property as any;
          const market = freshReport.market as any;
          const comps = (prop?.comps || []) as any[];
          const sameBedComps = (freshReport.same_bedroom_comps || []) as any[];
          const bedroomPerf = (freshReport.bedroom_performance || []) as any[];
          const rawHistorical = freshReport.market?.historical as any;
          const historicalValuation = (freshReport as any).historical_valuation as any;
          
          // Build historical_data with both summary (YoY) and monthly data
          const historical = {
            summary: {
              yoy_revenue_change: historicalValuation?.yoy_perc_chg ?? rawHistorical?.summary?.revenue_valuation?.yearly_pct_change ?? 0,
              yoy_occupancy_change: rawHistorical?.summary?.occupancy_valuation?.yearly_pct_change ?? 0,
              yoy_adr_change: rawHistorical?.summary?.adr_valuation?.yearly_pct_change ?? 0,
              yearly_pct_change: historicalValuation?.yoy_perc_chg ?? rawHistorical?.summary?.revenue_valuation?.yearly_pct_change ?? 0,
              monthly_pct_change: rawHistorical?.summary?.revenue_valuation?.monthly_pct_change ?? 0,
              trend: (() => {
                const change = historicalValuation?.yoy_perc_chg ?? rawHistorical?.summary?.revenue_valuation?.yearly_pct_change ?? 0;
                return change > 2 ? 'up' : change < -2 ? 'down' : 'stable';
              })(),
            },
            months: rawHistorical?.revenue?.map((r: any, idx: number) => ({
              date: r.date || r.month || '',
              revenue: r.value || r.revenue || 0,
              occupancy: rawHistorical?.occupancy?.[idx]?.value,
              adr: rawHistorical?.adr?.[idx]?.value,
            })) || [],
          };
          
          // Step 2: Build the new report data structure
          const occRate = prop?.estimates?.occupancy_rate || 0;
          const adr = prop?.estimates?.average_daily_rate || 0;
          const annualRev = prop?.estimates?.annual_revenue || 0;
          
          // Calculate revenue percentiles from comps
          const compRevenues = [...comps, ...sameBedComps]
            .filter((c: any) => c.annual_revenue > 0)
            .map((c: any) => c.annual_revenue)
            .sort((a: number, b: number) => a - b);
          const uniqueRevenues = Array.from(new Set(compRevenues));
          let revenuePercentiles = undefined;
          if (uniqueRevenues.length >= 5) {
            revenuePercentiles = {
              p10: uniqueRevenues[Math.floor(uniqueRevenues.length * 10 / 100)],
              p25: uniqueRevenues[Math.floor(uniqueRevenues.length * 25 / 100)],
              p50: uniqueRevenues[Math.floor(uniqueRevenues.length * 50 / 100)],
              p75: uniqueRevenues[Math.floor(uniqueRevenues.length * 75 / 100)],
              p90: uniqueRevenues[Math.floor(uniqueRevenues.length * 90 / 100)],
            };
          }
          
          // Build new report data, preserving purchase/arbitrage from existing
          let newReportData: any = {
            property: {
              address: address,
              city: prop?.property?._geocoded_city || prop?.property?.address_lookup?.split(',')[0]?.trim() || market?.name || '',
              state: prop?.property?._geocoded_state || prop?.property?.address_lookup?.split(',')[1]?.trim() || '',
              zipCode: prop?.property?.zipcode || '',
              bedrooms: bedrooms,
              bathrooms: bathrooms,
              accommodates: accommodates,
              latitude: prop?.property?.latitude,
              longitude: prop?.property?.longitude,
            },
            revenue_estimate: {
              annual: annualRev,
              monthly: Math.round(annualRev / 12),
              nightly: adr,
              occupancy: occRate,
              range: {
                low: prop?.estimates?.annual_revenue_low || Math.round(annualRev * 0.9),
                high: prop?.estimates?.annual_revenue_high || Math.round(annualRev * 1.1),
              },
            },
            monthly_forecast: prop?.monthly_forecast || existingData.monthly_forecast || [],
            market_data: market ? {
              name: market.name || 'Your Market',
              listing_count: market.listing_count || market.metrics?.active_listings || 0,
              metrics: {
                occupancy: market.metrics?.occupancy || occRate,
                adr: market.metrics?.adr || adr,
                revenue: market.metrics?.revenue || annualRev,
                active_listings: market.metrics?.active_listings || market.listing_count || 0,
                market_score: market.metrics?.market_score,
              },
            } : (existingData.market_data || {
              name: (() => {
                const parts = address.split(',').map((s: string) => s.trim());
                if (parts.length >= 2) {
                  const city = parts[1];
                  const stateZip = parts[2]?.split(' ')[0];
                  return stateZip ? `${city}, ${stateZip}` : city;
                }
                return 'Your Market';
              })(),
              listing_count: 0,
              metrics: {
                occupancy: occRate,
                adr: adr,
                revenue: annualRev,
                active_listings: 0,
              },
            }),
            bedroom_performance: bedroomPerf.length > 0 ? bedroomPerf : existingData.bedroom_performance || [],
            revenue_percentiles: revenuePercentiles,
            historical_data: (historical.summary.yoy_revenue_change !== 0 || historical.months.length > 0) ? historical : existingData.historical_data,
            comps: comps.map((c: any) => {
              // Try to enrich with lat/lng from same_bedroom_comps by matching airbnb listing ID
              const listingId = c.airbnb_listing_id || c.id?.replace('abnb_', '') || '';
              const matchingSbc = sameBedComps.find((sbc: any) => {
                const sbcId = sbc.airbnb_listing_id || sbc.id?.replace('abnb_', '') || '';
                return sbcId && listingId && sbcId === listingId;
              });
              return {
                title: c.title || c.name || 'Competitor',
                bedrooms: c.bedrooms,
                bathrooms: c.bathrooms,
                annual_revenue: c.annual_revenue || 0,
                adr: c.adr || 0,
                occupancy: c.occupancy || 0,
                rating: c.rating,
                reviews: c.reviews || 0,
                distance_meters: c.distance_meters,
                airbnb_url: c.airbnb_url || c.url,
                airbnb_listing_id: c.airbnb_listing_id || c.id?.replace('abnb_', ''),
                image_url: c.image_url,
                latitude: c.latitude || matchingSbc?.latitude || null,
                longitude: c.longitude || matchingSbc?.longitude || null,
              };
            }),
            same_bedroom_comps: sameBedComps.map((c: any) => ({
              title: c.title || c.name || 'Competitor',
              bedrooms: c.bedrooms,
              bathrooms: c.bathrooms,
              annual_revenue: c.annual_revenue || 0,
              adr: c.adr || 0,
              occupancy: c.occupancy || 0,
              rating: c.rating,
              reviews: c.reviews || 0,
              airbnb_url: c.airbnb_url || c.url,
              airbnb_listing_id: c.airbnb_listing_id || c.id?.replace('abnb_', ''),
              image_url: c.image_url,
              latitude: c.latitude || null,
              longitude: c.longitude || null,
            })),
            // Preserve existing purchase and rental arbitrage settings
            purchase: existingData.purchase,
            rental_arbitrage: existingData.rental_arbitrage,
            prepared_for: existingData.prepared_for,
            // Supply trend and submarket data
            supply_trend: (rawHistorical?.active_listings || []).map((d: any) => ({ date: d.date, value: d.value })),
            submarkets: ((freshReport.submarkets || []) as any[]).map((s: any) => ({
              id: s.id,
              name: s.name,
              listing_count: s.listing_count || 0,
              metrics: s.metrics ? {
                occupancy: s.metrics.occupancy || 0,
                adr: s.metrics.adr || 0,
                revenue: s.metrics.revenue || 0,
                revpar: s.metrics.revpar || 0,
                market_score: s.metrics.market_score,
              } : undefined,
            })),
          };
          
          // === POST-PROCESSING: Ensure stress_test, regulation, and expense_breakdown are always populated ===
          {
            const regenAnnualRev = newReportData.revenue_estimate?.annual || 0;
            const regenOccRate = newReportData.revenue_estimate?.occupancy ? (newReportData.revenue_estimate.occupancy > 1 ? newReportData.revenue_estimate.occupancy / 100 : newReportData.revenue_estimate.occupancy) : 0.5;
            const regenAdr = newReportData.revenue_estimate?.nightly || 0;
            const regenBedrooms = newReportData.property?.bedrooms || bedrooms;

            // Generate expense_breakdown if missing
            if (!newReportData.expense_breakdown && !newReportData.itemized_expenses && regenAnnualRev > 0) {
              const monthlyRevBase = Math.round(regenAnnualRev / 12);
              const nightsPerMonth = Math.round(regenOccRate * 30);
              const itemizedExpenses = {
                cleaning: Math.round(nightsPerMonth * 0.33 * (regenBedrooms <= 1 ? 75 : regenBedrooms <= 2 ? 100 : regenBedrooms <= 3 ? 140 : 180)),
                platform_fees: Math.round(monthlyRevBase * 0.14),
                property_management: Math.round(monthlyRevBase * 0.15),
                supplies: Math.round(regenBedrooms * 40 + 60),
                utilities: Math.round(regenBedrooms * 75 + 100),
                maintenance: Math.round(monthlyRevBase * 0.05),
                insurance: Math.round(regenBedrooms <= 2 ? 150 : regenBedrooms <= 4 ? 225 : 300),
                licenses_taxes: Math.round(monthlyRevBase * 0.08),
              };
              const totalMonthlyExpenses = Object.values(itemizedExpenses).reduce((a, b) => a + b, 0);
              const expensePercent = monthlyRevBase > 0 ? Math.round((totalMonthlyExpenses / monthlyRevBase) * 100) : 0;
              newReportData.expense_breakdown = {
                items: itemizedExpenses,
                total_monthly: totalMonthlyExpenses,
                total_annual: totalMonthlyExpenses * 12,
                percent_of_revenue: expensePercent,
                note: 'Estimates based on market averages. Property management fee included \u2014 remove if self-managing to increase profit.',
              };
              console.log('[Regenerate] Generated expense_breakdown');
            }

            // Generate stress_test if missing
            if (!newReportData.stress_test && regenAnnualRev > 0 && regenAdr > 0) {
              const expBrk = newReportData.expense_breakdown || newReportData.itemized_expenses;
              const totalMo = expBrk?.total_monthly || Math.round(regenAnnualRev / 12 * 0.35);
              const expPct = Math.round(regenAnnualRev / 12) > 0 ? Math.round((totalMo / Math.round(regenAnnualRev / 12)) * 100) : 35;
              const occScenarios = [
                Math.max(0.25, regenOccRate - 0.20),
                Math.max(0.30, regenOccRate - 0.10),
                regenOccRate,
                Math.min(0.95, regenOccRate + 0.10),
              ];
              const adrScenarios = [
                Math.round(regenAdr * 0.75),
                Math.round(regenAdr * 0.90),
                regenAdr,
                Math.round(regenAdr * 1.10),
              ];
              const stressMatrix: Array<{ occupancy_pct: number; adr: number; annual_revenue: number; monthly_revenue: number; monthly_profit: number; cash_flow_positive: boolean; }> = [];
              for (const occ of occScenarios) {
                for (const testAdr of adrScenarios) {
                  const testAnnRev = Math.round(occ * testAdr * 365);
                  const testMoRev = Math.round(testAnnRev / 12);
                  const testExp = Math.round(testMoRev * (expPct / 100));
                  const moProfit = testMoRev - testExp;
                  stressMatrix.push({ occupancy_pct: occ, adr: testAdr, annual_revenue: testAnnRev, monthly_revenue: testMoRev, monthly_profit: moProfit, cash_flow_positive: moProfit >= 0 });
                }
              }
              newReportData.stress_test = {
                base_occupancy: regenOccRate,
                base_adr: regenAdr,
                scenarios: stressMatrix,
                occupancy_levels: occScenarios,
                adr_levels: adrScenarios,
                breakeven_note: 'Green cells indicate positive cash flow.',
              };
              console.log('[Regenerate] Generated stress_test');
            }

            // Fetch regulation if missing
            if (!newReportData.regulation) {
              try {
                const city = newReportData.property?.city;
                const state = newReportData.property?.state;
                if (city && state) {
                  console.log(`[Regenerate] Fetching regulation data for ${city}, ${state}...`);
                  const regData = await getRegulationInfo(city, state);
                  if (regData && regData.status !== 'unknown') {
                    newReportData.regulation = {
                      status: regData.status,
                      summary: regData.simplifiedSummary || regData.summary,
                      key_requirements: regData.keyRequirements || [],
                      permit_required: regData.permitRequired,
                      primary_residence_only: regData.primaryResidenceOnly,
                      max_nights_per_year: regData.maxNightsPerYear,
                      registration_fee: regData.registrationFee,
                      occupancy_tax: regData.occupancyTax,
                      zoning_restrictions: regData.zoningRestrictions,
                      confidence: regData.confidence,
                      warnings: regData.warnings || [],
                      sources: regData.sources?.slice(0, 3) || [],
                    };
                    console.log(`[Regenerate] Regulation status: ${regData.status}`);
                  }
                }
              } catch (regErr) {
                console.error('[Regenerate] Regulation fetch failed (non-fatal):', regErr);
              }
            }
          }

          // Step 3: Generate comprehensive AI summary via Gemini 3 Pro
          console.log('[Regenerate] Generating AI summary via Gemini 3 Pro...');
          try {
            const summaryInput: FullReportSummaryInput = {
              property: newReportData.property,
              revenue: newReportData.revenue_estimate,
              monthlyForecast: newReportData.monthly_forecast,
              marketData: newReportData.market_data ? {
                name: newReportData.market_data.name,
                occupancy: newReportData.market_data.metrics?.occupancy || 0,
                adr: newReportData.market_data.metrics?.adr || 0,
                revenue: newReportData.market_data.metrics?.revenue || 0,
                listingCount: newReportData.market_data.listing_count || 0,
                marketScore: newReportData.market_data.metrics?.market_score ? Math.round(newReportData.market_data.metrics.market_score) : undefined,
              } : undefined,
              bedroomPerformance: newReportData.bedroom_performance,
              competitors: newReportData.comps.slice(0, 15).map((c: any) => ({
                name: c.title,
                revenue: c.annual_revenue,
                adr: c.adr,
                occupancy: c.occupancy,
                rating: c.rating,
                reviews: c.reviews,
                bedrooms: c.bedrooms,
              })),
              revenuePercentiles: newReportData.revenue_percentiles,
              historicalData: newReportData.historical_data,
              rentalArbitrage: newReportData.rental_arbitrage,
              purchase: newReportData.purchase,
              preparedFor: newReportData.prepared_for,
              stressTest: newReportData.stress_test?.scenarios?.map((s: any) => ({
                occupancyRate: s.occupancy_pct ?? s.occupancy ?? 0,
                adrMultiplier: newReportData.stress_test?.base_adr ? s.adr / newReportData.stress_test.base_adr : 1,
                monthlyRevenue: s.monthly_revenue || 0,
                monthlyProfit: s.monthly_profit || 0,
                annualProfit: (s.monthly_profit || 0) * 12,
                cashFlow: (s.monthly_profit || 0) >= 0 ? 'positive' : 'negative',
              })),
              itemizedExpenses: newReportData.itemized_expenses,
              regulation: newReportData.regulation,
              comparableSales: newReportData.comparable_sales,
            };
            const aiSummary = await generateFullReportSummary(summaryInput);
            if (aiSummary && aiSummary.length > 100) {
              newReportData.ai_summary = aiSummary;
              console.log(`[Regenerate] AI summary generated (${aiSummary.length} chars)`);
            }
          } catch (aiErr) {
            console.error('[Regenerate] AI summary generation failed:', aiErr);
          }
          
          // Step 4: Update the database
          const newReportDataStr = JSON.stringify(newReportData);
          await db.update(sharedReports)
            .set({
              reportData: newReportDataStr,
              latitude: prop?.property?.latitude?.toString(),
              longitude: prop?.property?.longitude?.toString(),
            })
            .where(eq(sharedReports.shareId, input.shareId));
          
          console.log(`[Regenerate] Report ${input.shareId} regenerated successfully`);
          
          // Increment rate limit counter on success
          incrementReportCount(ctx.user.id, ctx.user.role);
          
          return {
            success: true,
            message: 'Report regenerated with fresh data',
            hasAiSummary: !!newReportData.ai_summary,
            hasMarketData: !!market,
            hasBedroomPerf: bedroomPerf.length > 0,
            hasHistorical: !!historical,
            compCount: comps.length,
          };
        } catch (error) {
          console.error('[Regenerate] Error:', error);
          const message = error instanceof Error ? error.message : 'Failed to regenerate report';
          return { success: false, error: message };
        }
      }),

    // Generate a full report from scratch using just address + property details
    generateFromAddress: protectedProcedure
      .input(z.object({
        address: z.string().min(5),
        bedrooms: z.number().int().min(1).max(10),
        bathrooms: z.number().min(1).max(10),
        accommodates: z.number().int().min(1).max(20).optional(),
        monthlyRent: z.number().optional(),
        purchasePrice: z.number().optional(),
        downPaymentPercent: z.number().optional(),
        interestRate: z.number().optional(),
        loanType: z.string().optional(),
        preparedFor: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Rate limit: 5 reports/day for standard users, admin exempt
        if (ctx.user) {
          checkReportRateLimit(ctx.user.id, ctx.user.role);
        }
        
        const { address, bedrooms, bathrooms, preparedFor } = input;
        const accommodates = input.accommodates || bedrooms * 2;
        
        console.log(`[GenerateFromAddress] Starting full report for ${address} (${bedrooms}BR/${bathrooms}BA)...`);
        
        try {
          // Step 1: Fetch comprehensive property data from AirDNA
          const freshReport = await getComprehensivePropertyReport(
            address,
            bedrooms,
            bathrooms,
            accommodates
          );
          
          if (!freshReport) {
            return { success: false as const, error: 'Failed to fetch market data. Please check the address and try again.' };
          }
          
          const prop = freshReport.property as any;
          const market = freshReport.market as any;
          const comps = (prop?.comps || []) as any[];
          const sameBedComps = (freshReport.same_bedroom_comps || []) as any[];
          const bedroomPerf = (freshReport.bedroom_performance || []) as any[];
          const rawHistorical = freshReport.market?.historical as any;
          const historicalValuation = (freshReport as any).historical_valuation as any;
          
          // Build historical_data with both summary (YoY) and monthly data
          const historical = {
            summary: {
              yoy_revenue_change: historicalValuation?.yoy_perc_chg ?? rawHistorical?.summary?.revenue_valuation?.yearly_pct_change ?? 0,
              yoy_occupancy_change: rawHistorical?.summary?.occupancy_valuation?.yearly_pct_change ?? 0,
              yoy_adr_change: rawHistorical?.summary?.adr_valuation?.yearly_pct_change ?? 0,
              yearly_pct_change: historicalValuation?.yoy_perc_chg ?? rawHistorical?.summary?.revenue_valuation?.yearly_pct_change ?? 0,
              monthly_pct_change: rawHistorical?.summary?.revenue_valuation?.monthly_pct_change ?? 0,
              trend: (() => {
                const change = historicalValuation?.yoy_perc_chg ?? rawHistorical?.summary?.revenue_valuation?.yearly_pct_change ?? 0;
                return change > 2 ? 'up' : change < -2 ? 'down' : 'stable';
              })(),
            },
            months: rawHistorical?.revenue?.map((r: any, idx: number) => ({
              date: r.date || r.month || '',
              revenue: r.value || r.revenue || 0,
              occupancy: rawHistorical?.occupancy?.[idx]?.value,
              adr: rawHistorical?.adr?.[idx]?.value,
            })) || [],
          };
          
          // Step 2: Build the report data structure
          const occRate = prop?.estimates?.occupancy_rate || 0;
          const adr = prop?.estimates?.average_daily_rate || 0;
          const annualRev = prop?.estimates?.annual_revenue || 0;
          
          // Calculate revenue percentiles from comps
          const compRevenues = [...comps, ...sameBedComps]
            .filter((c: any) => c.annual_revenue > 0)
            .map((c: any) => c.annual_revenue)
            .sort((a: number, b: number) => a - b);
          const uniqueRevenues = Array.from(new Set(compRevenues));
          let revenuePercentiles = undefined;
          if (uniqueRevenues.length >= 5) {
            revenuePercentiles = {
              p10: uniqueRevenues[Math.floor(uniqueRevenues.length * 10 / 100)],
              p25: uniqueRevenues[Math.floor(uniqueRevenues.length * 25 / 100)],
              p50: uniqueRevenues[Math.floor(uniqueRevenues.length * 50 / 100)],
              p75: uniqueRevenues[Math.floor(uniqueRevenues.length * 75 / 100)],
              p90: uniqueRevenues[Math.floor(uniqueRevenues.length * 90 / 100)],
            };
          }
          
          let reportData: any = {
            property: {
              address: address,
              city: prop?.property?._geocoded_city || prop?.property?.address_lookup?.split(',')[0]?.trim() || market?.name || '',
              state: prop?.property?._geocoded_state || prop?.property?.address_lookup?.split(',')[1]?.trim() || '',
              zipCode: prop?.property?.zipcode || '',
              bedrooms: bedrooms,
              bathrooms: bathrooms,
              accommodates: accommodates,
              latitude: prop?.property?.latitude,
              longitude: prop?.property?.longitude,
            },
            revenue_estimate: {
              annual: annualRev,
              monthly: Math.round(annualRev / 12),
              nightly: adr,
              occupancy: occRate,
              range: {
                low: prop?.estimates?.annual_revenue_low || Math.round(annualRev * 0.9),
                high: prop?.estimates?.annual_revenue_high || Math.round(annualRev * 1.1),
              },
            },
            monthly_forecast: prop?.monthly_forecast || [],
            market_data: market ? {
              name: market.name || 'Your Market',
              listing_count: market.listing_count || market.metrics?.active_listings || 0,
              metrics: {
                occupancy: market.metrics?.occupancy || occRate,
                adr: market.metrics?.adr || adr,
                revenue: market.metrics?.revenue || annualRev,
                active_listings: market.metrics?.active_listings || market.listing_count || 0,
                market_score: market.metrics?.market_score,
              },
            } : {
              name: (() => {
                // Extract city from address like "2680 Carnation Dr, Richardson, TX 75082"
                const parts = address.split(',').map((s: string) => s.trim());
                if (parts.length >= 2) {
                  const city = parts[1]; // e.g. "Richardson"
                  const stateZip = parts[2]?.split(' ')[0]; // e.g. "TX"
                  return stateZip ? `${city}, ${stateZip}` : city;
                }
                return 'Your Market';
              })(),
              listing_count: 0,
              metrics: {
                occupancy: occRate,
                adr: adr,
                revenue: annualRev,
                active_listings: 0,
              },
            },
            bedroom_performance: bedroomPerf,
            revenue_percentiles: revenuePercentiles,
            historical_data: historical,
            comps: comps.map((c: any) => {
              const listingId = c.airbnb_listing_id || c.id?.replace('abnb_', '') || '';
              const matchingSbc = sameBedComps.find((sbc: any) => {
                const sbcId = sbc.airbnb_listing_id || sbc.id?.replace('abnb_', '') || '';
                return sbcId && listingId && sbcId === listingId;
              });
              return {
                title: c.title || c.name || 'Competitor',
                bedrooms: c.bedrooms,
                bathrooms: c.bathrooms,
                annual_revenue: c.annual_revenue || 0,
                adr: c.adr || 0,
                occupancy: c.occupancy || 0,
                rating: c.rating,
                reviews: c.reviews || 0,
                distance_meters: c.distance_meters,
                airbnb_url: c.airbnb_url || c.url,
                airbnb_listing_id: c.airbnb_listing_id || c.id?.replace('abnb_', ''),
                image_url: c.image_url,
                latitude: c.latitude || matchingSbc?.latitude || null,
                longitude: c.longitude || matchingSbc?.longitude || null,
              };
            }),
            same_bedroom_comps: sameBedComps.map((c: any) => ({
              title: c.title || c.name || 'Competitor',
              bedrooms: c.bedrooms,
              bathrooms: c.bathrooms,
              annual_revenue: c.annual_revenue || 0,
              adr: c.adr || 0,
              occupancy: c.occupancy || 0,
              rating: c.rating,
              reviews: c.reviews || 0,
              airbnb_url: c.airbnb_url || c.url,
              airbnb_listing_id: c.airbnb_listing_id || c.id?.replace('abnb_', ''),
              image_url: c.image_url,
              latitude: c.latitude || null,
              longitude: c.longitude || null,
            })),
            prepared_for: preparedFor || ctx.user?.name || undefined,
            // Supply trend and submarket data
            supply_trend: (rawHistorical?.active_listings || []).map((d: any) => ({ date: d.date, value: d.value })),
            submarkets: ((freshReport.submarkets || []) as any[]).map((s: any) => ({
              id: s.id,
              name: s.name,
              listing_count: s.listing_count || 0,
              metrics: s.metrics ? {
                occupancy: s.metrics.occupancy || 0,
                adr: s.metrics.adr || 0,
                revenue: s.metrics.revenue || 0,
                revpar: s.metrics.revpar || 0,
                market_score: s.metrics.market_score,
              } : undefined,
            })),
          };
          
          // === ITEMIZED EXPENSE BREAKDOWN ===
          // Replace flat 30-35% with realistic itemized expenses
          const monthlyRevBase = Math.round(annualRev / 12);
          const nightsPerMonth = Math.round(occRate * 30);
          const itemizedExpenses = {
            cleaning: Math.round(nightsPerMonth * 0.33 * (bedrooms <= 1 ? 75 : bedrooms <= 2 ? 100 : bedrooms <= 3 ? 140 : 180)), // per turnover (avg 3-night stay)
            platform_fees: Math.round(monthlyRevBase * 0.14), // Airbnb host fee ~14%
            property_management: Math.round(monthlyRevBase * 0.15), // 15% if using PM
            supplies: Math.round(bedrooms * 40 + 60), // toiletries, linens replacement, coffee, etc.
            utilities: Math.round(bedrooms * 75 + 100), // electric, water, gas, internet, trash
            maintenance: Math.round(monthlyRevBase * 0.05), // 5% for repairs/upkeep
            insurance: Math.round(bedrooms <= 2 ? 150 : bedrooms <= 4 ? 225 : 300), // STR insurance
            licenses_taxes: Math.round(monthlyRevBase * 0.08), // local occupancy tax + license fees
          };
          const totalMonthlyExpenses = Object.values(itemizedExpenses).reduce((a, b) => a + b, 0);
          const expensePercent = monthlyRevBase > 0 ? Math.round((totalMonthlyExpenses / monthlyRevBase) * 100) : 0;
          
          reportData.expense_breakdown = {
            items: itemizedExpenses,
            total_monthly: totalMonthlyExpenses,
            total_annual: totalMonthlyExpenses * 12,
            percent_of_revenue: expensePercent,
            note: 'Estimates based on market averages. Property management fee included — remove if self-managing to increase profit.',
          };
          
          // === STRESS TEST / SENSITIVITY ANALYSIS ===
          // Show cash flow at different occupancy x ADR combinations
          const baseOcc = occRate;
          const baseAdr = adr;
          const occScenarios = [
            Math.max(0.25, baseOcc - 0.20),
            Math.max(0.30, baseOcc - 0.10),
            baseOcc,
            Math.min(0.95, baseOcc + 0.10),
          ];
          const adrScenarios = [
            Math.round(baseAdr * 0.75),
            Math.round(baseAdr * 0.90),
            baseAdr,
            Math.round(baseAdr * 1.10),
          ];
          
          const stressTestMatrix: Array<{ occupancy_pct: number; adr: number; annual_revenue: number; monthly_revenue: number; monthly_profit: number; cash_flow_positive: boolean; }> = [];
          for (const occ of occScenarios) {
            for (const testAdr of adrScenarios) {
              const testAnnualRev = Math.round(occ * testAdr * 365);
              const testMonthlyRev = Math.round(testAnnualRev / 12);
              // Use proportional expenses (scale with revenue)
              const testExpenses = Math.round(testMonthlyRev * (expensePercent / 100));
              const monthlyProfit = testMonthlyRev - testExpenses;
              stressTestMatrix.push({
                occupancy_pct: occ, // decimal 0-1 (e.g., 0.55 for 55%)
                adr: testAdr,
                annual_revenue: testAnnualRev,
                monthly_revenue: testMonthlyRev,
                monthly_profit: monthlyProfit,
                cash_flow_positive: monthlyProfit >= 0,
              });
            }
          }
          
          reportData.stress_test = {
            base_occupancy: baseOcc, // decimal 0-1 to match frontend expectations
            base_adr: baseAdr,
            scenarios: stressTestMatrix,
            occupancy_levels: occScenarios,
            adr_levels: adrScenarios,
            breakeven_note: 'Green cells indicate positive cash flow. The breakeven point is where monthly profit crosses $0.',
          };
          
          // Add rental arbitrage if monthly rent provided (now with itemized expenses)
          if (input.monthlyRent && input.monthlyRent > 0) {
            const monthlyRev = Math.round(annualRev / 12);
            reportData.rental_arbitrage = {
              monthly_rent: input.monthlyRent,
              monthly_revenue: monthlyRev,
              monthly_expenses: totalMonthlyExpenses,
              expense_breakdown: itemizedExpenses,
              monthly_profit: monthlyRev - input.monthlyRent - totalMonthlyExpenses,
              annual_profit: (monthlyRev - input.monthlyRent - totalMonthlyExpenses) * 12,
              roi_percent: ((monthlyRev - input.monthlyRent - totalMonthlyExpenses) / input.monthlyRent) * 100,
            };
          }
          
          // Add purchase scenario if purchase price provided (now with itemized expenses)
          if (input.purchasePrice && input.purchasePrice > 0) {
            const downPct = input.downPaymentPercent || 20;
            const rate = input.interestRate || 7;
            const downPayment = input.purchasePrice * (downPct / 100);
            const loanAmount = input.purchasePrice - downPayment;
            const monthlyRate = rate / 100 / 12;
            const numPayments = 360;
            const monthlyMortgage = loanAmount > 0 ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1) : 0;
            const monthlyRev = Math.round(annualRev / 12);
            reportData.purchase = {
              purchasePrice: input.purchasePrice,
              downPayment: downPayment,
              downPaymentPercent: downPct,
              loanAmount: loanAmount,
              interestRate: rate,
              loanType: input.loanType || 'conventional',
              monthlyMortgage: Math.round(monthlyMortgage),
              monthlyRevenue: monthlyRev,
              monthlyExpenses: totalMonthlyExpenses,
              monthlyCashFlow: monthlyRev - Math.round(monthlyMortgage) - totalMonthlyExpenses,
              annualCashFlow: (monthlyRev - Math.round(monthlyMortgage) - totalMonthlyExpenses) * 12,
              capRate: (annualRev - totalMonthlyExpenses * 12) / input.purchasePrice * 100,
              cashOnCash: ((monthlyRev - Math.round(monthlyMortgage) - totalMonthlyExpenses) * 12) / downPayment * 100,
            };
          }
          
          // === FETCH REGULATORY DATA ===
          // Pull regulation info from the same source as Step 1
          try {
            const city = reportData.property.city;
            const state = reportData.property.state;
            if (city && state) {
              console.log(`[GenerateFromAddress] Fetching regulation data for ${city}, ${state}...`);
              const regData = await getRegulationInfo(city, state);
              if (regData && regData.status !== 'unknown') {
                reportData.regulation = {
                  status: regData.status,
                  summary: regData.simplifiedSummary || regData.summary,
                  key_requirements: regData.keyRequirements || [],
                  permit_required: regData.permitRequired,
                  primary_residence_only: regData.primaryResidenceOnly,
                  max_nights_per_year: regData.maxNightsPerYear,
                  registration_fee: regData.registrationFee,
                  occupancy_tax: regData.occupancyTax,
                  zoning_restrictions: regData.zoningRestrictions,
                  confidence: regData.confidence,
                  warnings: regData.warnings || [],
                  sources: regData.sources?.slice(0, 3) || [],
                };
                console.log(`[GenerateFromAddress] Regulation status: ${regData.status}`);
              }
            }
          } catch (regErr) {
            console.error('[GenerateFromAddress] Regulation fetch failed (non-fatal):', regErr);
          }
          
          // === FETCH COMPARABLE SALES ===
          // Pull recently sold properties in the same area
          try {
            const searchLocation = reportData.property.zipCode || `${reportData.property.city}, ${reportData.property.state}`;
            if (searchLocation) {
              console.log(`[GenerateFromAddress] Fetching comparable sales for ${searchLocation}...`);
              const salesResult = await searchZillowListings({
                keyword: searchLocation,
                type: 'recentlySold',
                bedsMin: Math.max(1, bedrooms - 1),
                bedsMax: bedrooms + 1,
              });
              if (salesResult.success && salesResult.properties.length > 0) {
                // Take top 10 most relevant comps sorted by recency
                const saleComps = salesResult.properties.slice(0, 10).map(p => ({
                  address: p.address,
                  price: p.price,
                  bedrooms: p.bedrooms,
                  bathrooms: p.bathrooms,
                  sqft: p.squareFeet,
                  url: p.url,
                  image: p.image,
                  days_on_market: p.daysOnZillow,
                }));
                const avgSalePrice = Math.round(saleComps.reduce((sum, c) => sum + c.price, 0) / saleComps.length);
                const medianSalePrice = saleComps.sort((a, b) => a.price - b.price)[Math.floor(saleComps.length / 2)]?.price || avgSalePrice;
                
                reportData.comparable_sales = {
                  properties: saleComps,
                  average_price: avgSalePrice,
                  median_price: medianSalePrice,
                  count: saleComps.length,
                  price_per_sqft: saleComps.filter(c => c.sqft && c.sqft > 0).length > 0
                    ? Math.round(saleComps.filter(c => c.sqft && c.sqft > 0).reduce((sum, c) => sum + (c.price / (c.sqft || 1)), 0) / saleComps.filter(c => c.sqft && c.sqft > 0).length)
                    : undefined,
                  // Calculate gross rent multiplier (GRM) = Sale Price / Annual Rent
                  grm: annualRev > 0 ? Math.round((avgSalePrice / annualRev) * 10) / 10 : undefined,
                };
                console.log(`[GenerateFromAddress] Found ${saleComps.length} comparable sales, avg: $${avgSalePrice}`);
              }
            }
          } catch (salesErr) {
            console.error('[GenerateFromAddress] Comparable sales fetch failed (non-fatal):', salesErr);
          }
          
          // Step 3: Generate AI summary
          console.log('[GenerateFromAddress] Generating AI summary via Gemini 3 Pro...');
          try {
            const summaryInput: FullReportSummaryInput = {
              property: reportData.property,
              revenue: reportData.revenue_estimate,
              monthlyForecast: reportData.monthly_forecast,
              marketData: reportData.market_data ? {
                name: reportData.market_data.name,
                occupancy: reportData.market_data.metrics?.occupancy || 0,
                adr: reportData.market_data.metrics?.adr || 0,
                revenue: reportData.market_data.metrics?.revenue || 0,
                listingCount: reportData.market_data.listing_count || 0,
                marketScore: reportData.market_data.metrics?.market_score ? Math.round(reportData.market_data.metrics.market_score) : undefined,
              } : undefined,
              bedroomPerformance: reportData.bedroom_performance,
              competitors: reportData.comps.slice(0, 15).map((c: any) => ({
                name: c.title,
                revenue: c.annual_revenue,
                adr: c.adr,
                occupancy: c.occupancy,
                rating: c.rating,
                reviews: c.reviews,
                bedrooms: c.bedrooms,
              })),
              revenuePercentiles: reportData.revenue_percentiles,
              historicalData: reportData.historical_data,
              rentalArbitrage: reportData.rental_arbitrage,
              purchase: reportData.purchase,
              preparedFor: reportData.prepared_for,
              stressTest: reportData.stress_test?.scenarios?.map((s: any) => ({
                occupancyRate: s.occupancy_pct ?? s.occupancy ?? 0,
                adrMultiplier: reportData.stress_test?.base_adr ? s.adr / reportData.stress_test.base_adr : 1,
                monthlyRevenue: s.monthly_revenue || 0,
                monthlyProfit: s.monthly_profit || 0,
                annualProfit: (s.monthly_profit || 0) * 12,
                cashFlow: (s.monthly_profit || 0) >= 0 ? 'positive' : 'negative',
              })),
              itemizedExpenses: reportData.itemized_expenses,
              regulation: reportData.regulation ? {
                status: reportData.regulation.status || 'Unknown',
                permitRequired: reportData.regulation.permitRequired || false,
                summary: reportData.regulation.summary || '',
              } : undefined,
              comparableSales: reportData.comparable_sales?.properties?.slice(0, 10).map((c: any) => ({
                address: c.address || 'Unknown',
                price: c.price || 0,
                bedrooms: c.bedrooms || 0,
                bathrooms: c.bathrooms || 0,
                sqft: c.sqft,
              })),
              supplyTrend: reportData.supply_trend?.length > 0 ? reportData.supply_trend : undefined,
              submarkets: reportData.submarkets?.length > 0 ? reportData.submarkets.map((s: any) => ({
                name: s.name,
                listing_count: s.listing_count,
                revenue: s.metrics?.revenue || 0,
                occupancy: s.metrics?.occupancy || 0,
                adr: s.metrics?.adr || 0,
              })) : undefined,
            };
            const aiSummary = await generateFullReportSummary(summaryInput);
            if (aiSummary && aiSummary.length > 100) {
              reportData.ai_summary = aiSummary;
              console.log(`[GenerateFromAddress] AI summary generated (${aiSummary.length} chars)`);
            }
          } catch (aiErr) {
            console.error('[GenerateFromAddress] AI summary generation failed:', aiErr);
          }
          
          // Step 4: Save to database
          const shareId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
          const reportDataStr = JSON.stringify(reportData);
          
          await db.insert(sharedReports).values({
            shareId,
            reportType: 'full',
            address: address,
            latitude: prop?.property?.latitude?.toString(),
            longitude: prop?.property?.longitude?.toString(),
            bedrooms: bedrooms,
            bathrooms: bathrooms.toString(),
            accommodates: accommodates,
            reportData: reportDataStr,
            createdByUserId: ctx.user?.id,
            createdByName: ctx.user?.name || 'Coach Inayah',
          });
          
          console.log(`[GenerateFromAddress] Report created with shareId: ${shareId}`);
          
          // Increment rate limit counter on success
          if (ctx.user) {
            incrementReportCount(ctx.user.id, ctx.user.role);
          }
          
          return {
            success: true as const,
            shareId,
            shareUrl: `/report/${shareId}`,
          };
        } catch (error) {
          console.error('[GenerateFromAddress] Error:', error);
          const message = error instanceof Error ? error.message : 'Failed to generate report';
          return { success: false as const, error: message };
        }
      }),

    // Delete a shared report
    delete: publicProcedure
      .input(z.object({
        shareId: z.string(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Verify ownership
        const results = await db
          .select()
          .from(sharedReports)
          .where(eq(sharedReports.shareId, input.shareId))
          .limit(1);
        
        if (results.length === 0) {
          return { success: false, error: 'Report not found' };
        }
        
        const report = results[0];
        const isOwner = (ctx.user?.id && report.createdByUserId === ctx.user.id);
        
        if (!isOwner) {
          return { success: false, error: 'Not authorized to delete this report' };
        }
        
        await db.delete(sharedReports).where(eq(sharedReports.shareId, input.shareId));
        
        return { success: true };
      }),
});

import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leads, savedSearches, favoriteProperties, analysisReports, favoriteMarkets, marketAlerts, sharedReports, aiAdvisorCache, notifications, favoriteListings, savedRegulations, regulationComments, commentVotes, users, emailOptins, personalizedLinks, linkClicks, promotions, promotionRecipients, toolUsageEvents, bugReports, shareableRegulationReports } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { 
  getRentalizerEstimate, 
  searchMarkets,
  searchMarketsAPI,
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
  getAllSubmarketListings,
  getMarketHistoricalData,
  getMarketListings,
  getAllMarketListings,
  getMarketBookingPatterns,
  getMarketSupplyTrend,
  getStandaloneMarketAdvisorData,
  getListingComps,
  getListingHistoricalMetrics,
  compareMarkets,
  calculateForwardLookingDemand,
  getMarketFutureDailyData,
  getSubmarketsInMarket,
} from "./airdna";
import { generateEnhancedPropertyReport, generateEnhancedMarketReport, generateMarketTrendNarrative, generateComprehensivePropertyAdvice, generateMaxPropertyAdvice, generateMaxMarketAdvice, generateFullReportSummary, type PropertyAdvisorInput, type MaxPropertyAdvisorInput, type MaxMarketAdvisorInput, type FullReportSummaryInput } from "./gemini";
import { getAIAdvisorResponse, type ChatMessage } from "./ai-advisor";
import { batchScrapeAirbnbImages } from "./airbnb-scraper";
import { generateFullArbitrageAnalysis } from "./sop-reports";
import { getRentSummary, analyzeRentVsMarket } from "./rentometer";
import { generatePDFReport } from "./export-pdf";
import { generateExcelReport } from "./export-excel";
import { startDeepAnalysis, getDeepAnalysis } from "./deep-analysis";
import { marketResearchRouter } from "./market-research-v2";
import { opportunityFinderRouter } from "./opportunity-finder";
import { marketResearchSimpleRouter } from "./market-research-simple";
import { geocodeZipCodeToMarket } from "./airdna-hierarchy";
import { getLocationQuality, type LocationQualityResult } from "./location-quality";
import { adminRouter } from "./admin-router";
import { newsletterRouter } from "./newsletter-router";
import { logActivity, ActionCategory, ActionType } from "./activity";
import { getUsageStatus, canPerformAnalysis, canPerformMarketResearch, recordAnalysisUsage, recordMarketResearchUsage } from "./usage-limits";
import { notifyOwnerPropertyReport, notifyOwnerMarketReport } from "./notification-service";
import { getZillowPropertyDetails, isZillowUrl, type ZillowPropertyData } from "./hasdata-zillow";
import { searchZillowListings } from "./hasdata";
import { getRedfinPropertyDetails, isRedfinUrl, type RedfinPropertyData } from "./hasdata-redfin";
import { getRegulationInfo, parseLocation } from "./regulation-tracker";
import { generateShareCode, sendSMSNotification, sendEmailNotification } from "./sms-email-notifications";
import { upsertContact, generateDeepLink, trackLeadEvent } from "./hubspot";
import { createShareableReport, getShareableReport, sendShareableReportNotifications, createAndNotifyShareableReport, getNotificationAnalytics, type ShareableReportType } from "./shareable-reports";
import { universalShareableReports, notificationAnalytics } from "../drizzle/schema";

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
  // Lead capture fields
  leadName: z.string().optional(),
  leadEmail: z.string().email().optional(),
  leadPhone: z.string().optional(),
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
  newsletter: newsletterRouter,
  
  // Usage limits - get current user's remaining analyses
  usage: router({
    getStatus: publicProcedure.query(async ({ ctx }) => {
      const userId = ctx.user?.id;
      // Generate a session ID from request if no user
      const sessionId = !userId ? (ctx.req.headers['x-session-id'] as string || ctx.req.ip || 'anonymous') : undefined;
      const ipAddress = ctx.req.ip || ctx.req.headers['x-forwarded-for'] as string;
      
      const status = await getUsageStatus(userId, sessionId, ipAddress);
      return status;
    }),
  }),
  
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
    // Get location quality metrics (walk score, transit, attractions)
    getLocationQuality: publicProcedure
      .input(z.object({
        lat: z.number(),
        lng: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          console.log(`[Rental] Getting location quality for ${input.lat}, ${input.lng}`);
          const quality = await getLocationQuality(input.lat, input.lng);
          return {
            success: true,
            data: quality,
          };
        } catch (error) {
          console.error("[Rental] Error getting location quality:", error);
          return {
            success: false,
            error: "Failed to get location quality",
            data: null,
          };
        }
      }),

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
          
          // Use searchMarketsAPI which supports zip codes, cities, and submarkets
          const results = await searchMarketsAPI(input.searchTerm, input.limit);
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

    // Search zip codes for autocomplete
    searchZipCodes: publicProcedure
      .input(z.object({ prefix: z.string().min(1).max(5) }))
      .query(async ({ input }) => {
        try {
          // US zip code database - common zip codes by major cities
          const zipCodeDatabase: Array<{ zip: string; city: string; state: string }> = [
            // Florida - Miami area
            { zip: '33101', city: 'Miami', state: 'FL' },
            { zip: '33109', city: 'Miami Beach', state: 'FL' },
            { zip: '33125', city: 'Miami', state: 'FL' },
            { zip: '33129', city: 'Miami', state: 'FL' },
            { zip: '33130', city: 'Miami', state: 'FL' },
            { zip: '33131', city: 'Miami', state: 'FL' },
            { zip: '33132', city: 'Miami', state: 'FL' },
            { zip: '33133', city: 'Miami', state: 'FL' },
            { zip: '33134', city: 'Miami', state: 'FL' },
            { zip: '33135', city: 'Miami', state: 'FL' },
            { zip: '33136', city: 'Miami', state: 'FL' },
            { zip: '33137', city: 'Miami', state: 'FL' },
            { zip: '33138', city: 'Miami', state: 'FL' },
            { zip: '33139', city: 'Miami Beach', state: 'FL' },
            { zip: '33140', city: 'Miami Beach', state: 'FL' },
            { zip: '33141', city: 'Miami Beach', state: 'FL' },
            { zip: '33142', city: 'Miami', state: 'FL' },
            { zip: '33145', city: 'Miami', state: 'FL' },
            { zip: '33146', city: 'Coral Gables', state: 'FL' },
            { zip: '33149', city: 'Key Biscayne', state: 'FL' },
            // Florida - Orlando area
            { zip: '32801', city: 'Orlando', state: 'FL' },
            { zip: '32803', city: 'Orlando', state: 'FL' },
            { zip: '32804', city: 'Orlando', state: 'FL' },
            { zip: '32805', city: 'Orlando', state: 'FL' },
            { zip: '32806', city: 'Orlando', state: 'FL' },
            { zip: '32807', city: 'Orlando', state: 'FL' },
            { zip: '32808', city: 'Orlando', state: 'FL' },
            { zip: '32809', city: 'Orlando', state: 'FL' },
            { zip: '32819', city: 'Orlando', state: 'FL' },
            { zip: '32821', city: 'Orlando', state: 'FL' },
            { zip: '32822', city: 'Orlando', state: 'FL' },
            { zip: '32824', city: 'Orlando', state: 'FL' },
            { zip: '32825', city: 'Orlando', state: 'FL' },
            { zip: '32826', city: 'Orlando', state: 'FL' },
            { zip: '32827', city: 'Orlando', state: 'FL' },
            { zip: '32828', city: 'Orlando', state: 'FL' },
            { zip: '32829', city: 'Orlando', state: 'FL' },
            { zip: '32830', city: 'Orlando', state: 'FL' },
            { zip: '32831', city: 'Orlando', state: 'FL' },
            { zip: '32832', city: 'Orlando', state: 'FL' },
            { zip: '34747', city: 'Kissimmee', state: 'FL' },
            { zip: '34746', city: 'Kissimmee', state: 'FL' },
            { zip: '34744', city: 'Kissimmee', state: 'FL' },
            { zip: '34741', city: 'Kissimmee', state: 'FL' },
            // Florida - Tampa area
            { zip: '33601', city: 'Tampa', state: 'FL' },
            { zip: '33602', city: 'Tampa', state: 'FL' },
            { zip: '33603', city: 'Tampa', state: 'FL' },
            { zip: '33604', city: 'Tampa', state: 'FL' },
            { zip: '33605', city: 'Tampa', state: 'FL' },
            { zip: '33606', city: 'Tampa', state: 'FL' },
            { zip: '33607', city: 'Tampa', state: 'FL' },
            { zip: '33609', city: 'Tampa', state: 'FL' },
            { zip: '33610', city: 'Tampa', state: 'FL' },
            { zip: '33611', city: 'Tampa', state: 'FL' },
            { zip: '33612', city: 'Tampa', state: 'FL' },
            { zip: '33613', city: 'Tampa', state: 'FL' },
            { zip: '33614', city: 'Tampa', state: 'FL' },
            { zip: '33615', city: 'Tampa', state: 'FL' },
            { zip: '33616', city: 'Tampa', state: 'FL' },
            { zip: '33617', city: 'Tampa', state: 'FL' },
            { zip: '33618', city: 'Tampa', state: 'FL' },
            { zip: '33619', city: 'Tampa', state: 'FL' },
            { zip: '33701', city: 'St. Petersburg', state: 'FL' },
            { zip: '33702', city: 'St. Petersburg', state: 'FL' },
            { zip: '33703', city: 'St. Petersburg', state: 'FL' },
            { zip: '33704', city: 'St. Petersburg', state: 'FL' },
            { zip: '33705', city: 'St. Petersburg', state: 'FL' },
            { zip: '33706', city: 'St. Petersburg', state: 'FL' },
            { zip: '33707', city: 'St. Petersburg', state: 'FL' },
            { zip: '33708', city: 'St. Petersburg', state: 'FL' },
            { zip: '33709', city: 'St. Petersburg', state: 'FL' },
            { zip: '33710', city: 'St. Petersburg', state: 'FL' },
            { zip: '33711', city: 'St. Petersburg', state: 'FL' },
            { zip: '33712', city: 'St. Petersburg', state: 'FL' },
            { zip: '33713', city: 'St. Petersburg', state: 'FL' },
            { zip: '33714', city: 'St. Petersburg', state: 'FL' },
            { zip: '33715', city: 'St. Petersburg', state: 'FL' },
            { zip: '33716', city: 'St. Petersburg', state: 'FL' },
            // Texas - Austin area
            { zip: '78701', city: 'Austin', state: 'TX' },
            { zip: '78702', city: 'Austin', state: 'TX' },
            { zip: '78703', city: 'Austin', state: 'TX' },
            { zip: '78704', city: 'Austin', state: 'TX' },
            { zip: '78705', city: 'Austin', state: 'TX' },
            { zip: '78721', city: 'Austin', state: 'TX' },
            { zip: '78722', city: 'Austin', state: 'TX' },
            { zip: '78723', city: 'Austin', state: 'TX' },
            { zip: '78724', city: 'Austin', state: 'TX' },
            { zip: '78725', city: 'Austin', state: 'TX' },
            { zip: '78726', city: 'Austin', state: 'TX' },
            { zip: '78727', city: 'Austin', state: 'TX' },
            { zip: '78728', city: 'Austin', state: 'TX' },
            { zip: '78729', city: 'Austin', state: 'TX' },
            { zip: '78730', city: 'Austin', state: 'TX' },
            { zip: '78731', city: 'Austin', state: 'TX' },
            { zip: '78732', city: 'Austin', state: 'TX' },
            { zip: '78733', city: 'Austin', state: 'TX' },
            { zip: '78734', city: 'Austin', state: 'TX' },
            { zip: '78735', city: 'Austin', state: 'TX' },
            { zip: '78736', city: 'Austin', state: 'TX' },
            { zip: '78737', city: 'Austin', state: 'TX' },
            { zip: '78738', city: 'Austin', state: 'TX' },
            { zip: '78739', city: 'Austin', state: 'TX' },
            { zip: '78741', city: 'Austin', state: 'TX' },
            { zip: '78742', city: 'Austin', state: 'TX' },
            { zip: '78744', city: 'Austin', state: 'TX' },
            { zip: '78745', city: 'Austin', state: 'TX' },
            { zip: '78746', city: 'Austin', state: 'TX' },
            { zip: '78747', city: 'Austin', state: 'TX' },
            { zip: '78748', city: 'Austin', state: 'TX' },
            { zip: '78749', city: 'Austin', state: 'TX' },
            { zip: '78750', city: 'Austin', state: 'TX' },
            { zip: '78751', city: 'Austin', state: 'TX' },
            { zip: '78752', city: 'Austin', state: 'TX' },
            { zip: '78753', city: 'Austin', state: 'TX' },
            { zip: '78754', city: 'Austin', state: 'TX' },
            { zip: '78756', city: 'Austin', state: 'TX' },
            { zip: '78757', city: 'Austin', state: 'TX' },
            { zip: '78758', city: 'Austin', state: 'TX' },
            { zip: '78759', city: 'Austin', state: 'TX' },
            // Texas - Dallas area
            { zip: '75201', city: 'Dallas', state: 'TX' },
            { zip: '75202', city: 'Dallas', state: 'TX' },
            { zip: '75203', city: 'Dallas', state: 'TX' },
            { zip: '75204', city: 'Dallas', state: 'TX' },
            { zip: '75205', city: 'Dallas', state: 'TX' },
            { zip: '75206', city: 'Dallas', state: 'TX' },
            { zip: '75207', city: 'Dallas', state: 'TX' },
            { zip: '75208', city: 'Dallas', state: 'TX' },
            { zip: '75209', city: 'Dallas', state: 'TX' },
            { zip: '75210', city: 'Dallas', state: 'TX' },
            { zip: '75211', city: 'Dallas', state: 'TX' },
            { zip: '75212', city: 'Dallas', state: 'TX' },
            { zip: '75214', city: 'Dallas', state: 'TX' },
            { zip: '75215', city: 'Dallas', state: 'TX' },
            { zip: '75216', city: 'Dallas', state: 'TX' },
            { zip: '75217', city: 'Dallas', state: 'TX' },
            { zip: '75218', city: 'Dallas', state: 'TX' },
            { zip: '75219', city: 'Dallas', state: 'TX' },
            { zip: '75220', city: 'Dallas', state: 'TX' },
            { zip: '75223', city: 'Dallas', state: 'TX' },
            { zip: '75224', city: 'Dallas', state: 'TX' },
            { zip: '75225', city: 'Dallas', state: 'TX' },
            { zip: '75226', city: 'Dallas', state: 'TX' },
            { zip: '75227', city: 'Dallas', state: 'TX' },
            { zip: '75228', city: 'Dallas', state: 'TX' },
            { zip: '75229', city: 'Dallas', state: 'TX' },
            { zip: '75230', city: 'Dallas', state: 'TX' },
            { zip: '75231', city: 'Dallas', state: 'TX' },
            { zip: '75232', city: 'Dallas', state: 'TX' },
            { zip: '75233', city: 'Dallas', state: 'TX' },
            { zip: '75234', city: 'Dallas', state: 'TX' },
            { zip: '75235', city: 'Dallas', state: 'TX' },
            { zip: '75236', city: 'Dallas', state: 'TX' },
            { zip: '75237', city: 'Dallas', state: 'TX' },
            { zip: '75238', city: 'Dallas', state: 'TX' },
            { zip: '75240', city: 'Dallas', state: 'TX' },
            { zip: '75241', city: 'Dallas', state: 'TX' },
            { zip: '75243', city: 'Dallas', state: 'TX' },
            { zip: '75244', city: 'Dallas', state: 'TX' },
            { zip: '75246', city: 'Dallas', state: 'TX' },
            { zip: '75247', city: 'Dallas', state: 'TX' },
            { zip: '75248', city: 'Dallas', state: 'TX' },
            { zip: '75249', city: 'Dallas', state: 'TX' },
            { zip: '75251', city: 'Dallas', state: 'TX' },
            { zip: '75252', city: 'Dallas', state: 'TX' },
            { zip: '75253', city: 'Dallas', state: 'TX' },
            { zip: '75254', city: 'Dallas', state: 'TX' },
            // Texas - Houston area
            { zip: '77001', city: 'Houston', state: 'TX' },
            { zip: '77002', city: 'Houston', state: 'TX' },
            { zip: '77003', city: 'Houston', state: 'TX' },
            { zip: '77004', city: 'Houston', state: 'TX' },
            { zip: '77005', city: 'Houston', state: 'TX' },
            { zip: '77006', city: 'Houston', state: 'TX' },
            { zip: '77007', city: 'Houston', state: 'TX' },
            { zip: '77008', city: 'Houston', state: 'TX' },
            { zip: '77009', city: 'Houston', state: 'TX' },
            { zip: '77010', city: 'Houston', state: 'TX' },
            { zip: '77011', city: 'Houston', state: 'TX' },
            { zip: '77012', city: 'Houston', state: 'TX' },
            { zip: '77013', city: 'Houston', state: 'TX' },
            { zip: '77014', city: 'Houston', state: 'TX' },
            { zip: '77015', city: 'Houston', state: 'TX' },
            { zip: '77016', city: 'Houston', state: 'TX' },
            { zip: '77017', city: 'Houston', state: 'TX' },
            { zip: '77018', city: 'Houston', state: 'TX' },
            { zip: '77019', city: 'Houston', state: 'TX' },
            { zip: '77020', city: 'Houston', state: 'TX' },
            { zip: '77021', city: 'Houston', state: 'TX' },
            { zip: '77022', city: 'Houston', state: 'TX' },
            { zip: '77023', city: 'Houston', state: 'TX' },
            { zip: '77024', city: 'Houston', state: 'TX' },
            { zip: '77025', city: 'Houston', state: 'TX' },
            { zip: '77026', city: 'Houston', state: 'TX' },
            { zip: '77027', city: 'Houston', state: 'TX' },
            { zip: '77028', city: 'Houston', state: 'TX' },
            { zip: '77029', city: 'Houston', state: 'TX' },
            { zip: '77030', city: 'Houston', state: 'TX' },
            { zip: '77031', city: 'Houston', state: 'TX' },
            { zip: '77032', city: 'Houston', state: 'TX' },
            { zip: '77033', city: 'Houston', state: 'TX' },
            { zip: '77034', city: 'Houston', state: 'TX' },
            { zip: '77035', city: 'Houston', state: 'TX' },
            { zip: '77036', city: 'Houston', state: 'TX' },
            { zip: '77037', city: 'Houston', state: 'TX' },
            { zip: '77038', city: 'Houston', state: 'TX' },
            { zip: '77039', city: 'Houston', state: 'TX' },
            { zip: '77040', city: 'Houston', state: 'TX' },
            { zip: '77041', city: 'Houston', state: 'TX' },
            { zip: '77042', city: 'Houston', state: 'TX' },
            { zip: '77043', city: 'Houston', state: 'TX' },
            { zip: '77044', city: 'Houston', state: 'TX' },
            { zip: '77045', city: 'Houston', state: 'TX' },
            { zip: '77046', city: 'Houston', state: 'TX' },
            { zip: '77047', city: 'Houston', state: 'TX' },
            { zip: '77048', city: 'Houston', state: 'TX' },
            { zip: '77049', city: 'Houston', state: 'TX' },
            { zip: '77050', city: 'Houston', state: 'TX' },
            { zip: '77051', city: 'Houston', state: 'TX' },
            { zip: '77053', city: 'Houston', state: 'TX' },
            { zip: '77054', city: 'Houston', state: 'TX' },
            { zip: '77055', city: 'Houston', state: 'TX' },
            { zip: '77056', city: 'Houston', state: 'TX' },
            { zip: '77057', city: 'Houston', state: 'TX' },
            { zip: '77058', city: 'Houston', state: 'TX' },
            { zip: '77059', city: 'Houston', state: 'TX' },
            { zip: '77060', city: 'Houston', state: 'TX' },
            { zip: '77061', city: 'Houston', state: 'TX' },
            { zip: '77062', city: 'Houston', state: 'TX' },
            { zip: '77063', city: 'Houston', state: 'TX' },
            { zip: '77064', city: 'Houston', state: 'TX' },
            { zip: '77065', city: 'Houston', state: 'TX' },
            { zip: '77066', city: 'Houston', state: 'TX' },
            { zip: '77067', city: 'Houston', state: 'TX' },
            { zip: '77068', city: 'Houston', state: 'TX' },
            { zip: '77069', city: 'Houston', state: 'TX' },
            { zip: '77070', city: 'Houston', state: 'TX' },
            { zip: '77071', city: 'Houston', state: 'TX' },
            { zip: '77072', city: 'Houston', state: 'TX' },
            { zip: '77073', city: 'Houston', state: 'TX' },
            { zip: '77074', city: 'Houston', state: 'TX' },
            { zip: '77075', city: 'Houston', state: 'TX' },
            { zip: '77076', city: 'Houston', state: 'TX' },
            { zip: '77077', city: 'Houston', state: 'TX' },
            { zip: '77078', city: 'Houston', state: 'TX' },
            { zip: '77079', city: 'Houston', state: 'TX' },
            { zip: '77080', city: 'Houston', state: 'TX' },
            { zip: '77081', city: 'Houston', state: 'TX' },
            { zip: '77082', city: 'Houston', state: 'TX' },
            { zip: '77083', city: 'Houston', state: 'TX' },
            { zip: '77084', city: 'Houston', state: 'TX' },
            { zip: '77085', city: 'Houston', state: 'TX' },
            { zip: '77086', city: 'Houston', state: 'TX' },
            { zip: '77087', city: 'Houston', state: 'TX' },
            { zip: '77088', city: 'Houston', state: 'TX' },
            { zip: '77089', city: 'Houston', state: 'TX' },
            { zip: '77090', city: 'Houston', state: 'TX' },
            { zip: '77091', city: 'Houston', state: 'TX' },
            { zip: '77092', city: 'Houston', state: 'TX' },
            { zip: '77093', city: 'Houston', state: 'TX' },
            { zip: '77094', city: 'Houston', state: 'TX' },
            { zip: '77095', city: 'Houston', state: 'TX' },
            { zip: '77096', city: 'Houston', state: 'TX' },
            { zip: '77098', city: 'Houston', state: 'TX' },
            { zip: '77099', city: 'Houston', state: 'TX' },
            // Arizona - Phoenix area
            { zip: '85001', city: 'Phoenix', state: 'AZ' },
            { zip: '85003', city: 'Phoenix', state: 'AZ' },
            { zip: '85004', city: 'Phoenix', state: 'AZ' },
            { zip: '85006', city: 'Phoenix', state: 'AZ' },
            { zip: '85007', city: 'Phoenix', state: 'AZ' },
            { zip: '85008', city: 'Phoenix', state: 'AZ' },
            { zip: '85009', city: 'Phoenix', state: 'AZ' },
            { zip: '85012', city: 'Phoenix', state: 'AZ' },
            { zip: '85013', city: 'Phoenix', state: 'AZ' },
            { zip: '85014', city: 'Phoenix', state: 'AZ' },
            { zip: '85015', city: 'Phoenix', state: 'AZ' },
            { zip: '85016', city: 'Phoenix', state: 'AZ' },
            { zip: '85017', city: 'Phoenix', state: 'AZ' },
            { zip: '85018', city: 'Phoenix', state: 'AZ' },
            { zip: '85019', city: 'Phoenix', state: 'AZ' },
            { zip: '85020', city: 'Phoenix', state: 'AZ' },
            { zip: '85021', city: 'Phoenix', state: 'AZ' },
            { zip: '85022', city: 'Phoenix', state: 'AZ' },
            { zip: '85023', city: 'Phoenix', state: 'AZ' },
            { zip: '85024', city: 'Phoenix', state: 'AZ' },
            { zip: '85027', city: 'Phoenix', state: 'AZ' },
            { zip: '85028', city: 'Phoenix', state: 'AZ' },
            { zip: '85029', city: 'Phoenix', state: 'AZ' },
            { zip: '85031', city: 'Phoenix', state: 'AZ' },
            { zip: '85032', city: 'Phoenix', state: 'AZ' },
            { zip: '85033', city: 'Phoenix', state: 'AZ' },
            { zip: '85034', city: 'Phoenix', state: 'AZ' },
            { zip: '85035', city: 'Phoenix', state: 'AZ' },
            { zip: '85037', city: 'Phoenix', state: 'AZ' },
            { zip: '85040', city: 'Phoenix', state: 'AZ' },
            { zip: '85041', city: 'Phoenix', state: 'AZ' },
            { zip: '85042', city: 'Phoenix', state: 'AZ' },
            { zip: '85043', city: 'Phoenix', state: 'AZ' },
            { zip: '85044', city: 'Phoenix', state: 'AZ' },
            { zip: '85045', city: 'Phoenix', state: 'AZ' },
            { zip: '85048', city: 'Phoenix', state: 'AZ' },
            { zip: '85050', city: 'Phoenix', state: 'AZ' },
            { zip: '85051', city: 'Phoenix', state: 'AZ' },
            { zip: '85053', city: 'Phoenix', state: 'AZ' },
            { zip: '85054', city: 'Phoenix', state: 'AZ' },
            { zip: '85083', city: 'Phoenix', state: 'AZ' },
            { zip: '85085', city: 'Phoenix', state: 'AZ' },
            { zip: '85086', city: 'Phoenix', state: 'AZ' },
            { zip: '85087', city: 'Phoenix', state: 'AZ' },
            { zip: '85251', city: 'Scottsdale', state: 'AZ' },
            { zip: '85252', city: 'Scottsdale', state: 'AZ' },
            { zip: '85253', city: 'Scottsdale', state: 'AZ' },
            { zip: '85254', city: 'Scottsdale', state: 'AZ' },
            { zip: '85255', city: 'Scottsdale', state: 'AZ' },
            { zip: '85256', city: 'Scottsdale', state: 'AZ' },
            { zip: '85257', city: 'Scottsdale', state: 'AZ' },
            { zip: '85258', city: 'Scottsdale', state: 'AZ' },
            { zip: '85259', city: 'Scottsdale', state: 'AZ' },
            { zip: '85260', city: 'Scottsdale', state: 'AZ' },
            { zip: '85262', city: 'Scottsdale', state: 'AZ' },
            { zip: '85264', city: 'Scottsdale', state: 'AZ' },
            { zip: '85266', city: 'Scottsdale', state: 'AZ' },
            // California - Los Angeles area
            { zip: '90001', city: 'Los Angeles', state: 'CA' },
            { zip: '90002', city: 'Los Angeles', state: 'CA' },
            { zip: '90003', city: 'Los Angeles', state: 'CA' },
            { zip: '90004', city: 'Los Angeles', state: 'CA' },
            { zip: '90005', city: 'Los Angeles', state: 'CA' },
            { zip: '90006', city: 'Los Angeles', state: 'CA' },
            { zip: '90007', city: 'Los Angeles', state: 'CA' },
            { zip: '90008', city: 'Los Angeles', state: 'CA' },
            { zip: '90010', city: 'Los Angeles', state: 'CA' },
            { zip: '90011', city: 'Los Angeles', state: 'CA' },
            { zip: '90012', city: 'Los Angeles', state: 'CA' },
            { zip: '90013', city: 'Los Angeles', state: 'CA' },
            { zip: '90014', city: 'Los Angeles', state: 'CA' },
            { zip: '90015', city: 'Los Angeles', state: 'CA' },
            { zip: '90016', city: 'Los Angeles', state: 'CA' },
            { zip: '90017', city: 'Los Angeles', state: 'CA' },
            { zip: '90018', city: 'Los Angeles', state: 'CA' },
            { zip: '90019', city: 'Los Angeles', state: 'CA' },
            { zip: '90020', city: 'Los Angeles', state: 'CA' },
            { zip: '90021', city: 'Los Angeles', state: 'CA' },
            { zip: '90023', city: 'Los Angeles', state: 'CA' },
            { zip: '90024', city: 'Los Angeles', state: 'CA' },
            { zip: '90025', city: 'Los Angeles', state: 'CA' },
            { zip: '90026', city: 'Los Angeles', state: 'CA' },
            { zip: '90027', city: 'Los Angeles', state: 'CA' },
            { zip: '90028', city: 'Los Angeles', state: 'CA' },
            { zip: '90029', city: 'Los Angeles', state: 'CA' },
            { zip: '90031', city: 'Los Angeles', state: 'CA' },
            { zip: '90032', city: 'Los Angeles', state: 'CA' },
            { zip: '90033', city: 'Los Angeles', state: 'CA' },
            { zip: '90034', city: 'Los Angeles', state: 'CA' },
            { zip: '90035', city: 'Los Angeles', state: 'CA' },
            { zip: '90036', city: 'Los Angeles', state: 'CA' },
            { zip: '90037', city: 'Los Angeles', state: 'CA' },
            { zip: '90038', city: 'Los Angeles', state: 'CA' },
            { zip: '90039', city: 'Los Angeles', state: 'CA' },
            { zip: '90041', city: 'Los Angeles', state: 'CA' },
            { zip: '90042', city: 'Los Angeles', state: 'CA' },
            { zip: '90043', city: 'Los Angeles', state: 'CA' },
            { zip: '90044', city: 'Los Angeles', state: 'CA' },
            { zip: '90045', city: 'Los Angeles', state: 'CA' },
            { zip: '90046', city: 'Los Angeles', state: 'CA' },
            { zip: '90047', city: 'Los Angeles', state: 'CA' },
            { zip: '90048', city: 'Los Angeles', state: 'CA' },
            { zip: '90049', city: 'Los Angeles', state: 'CA' },
            { zip: '90056', city: 'Los Angeles', state: 'CA' },
            { zip: '90057', city: 'Los Angeles', state: 'CA' },
            { zip: '90058', city: 'Los Angeles', state: 'CA' },
            { zip: '90059', city: 'Los Angeles', state: 'CA' },
            { zip: '90061', city: 'Los Angeles', state: 'CA' },
            { zip: '90062', city: 'Los Angeles', state: 'CA' },
            { zip: '90063', city: 'Los Angeles', state: 'CA' },
            { zip: '90064', city: 'Los Angeles', state: 'CA' },
            { zip: '90065', city: 'Los Angeles', state: 'CA' },
            { zip: '90066', city: 'Los Angeles', state: 'CA' },
            { zip: '90067', city: 'Los Angeles', state: 'CA' },
            { zip: '90068', city: 'Los Angeles', state: 'CA' },
            { zip: '90069', city: 'West Hollywood', state: 'CA' },
            { zip: '90071', city: 'Los Angeles', state: 'CA' },
            { zip: '90077', city: 'Los Angeles', state: 'CA' },
            { zip: '90089', city: 'Los Angeles', state: 'CA' },
            { zip: '90094', city: 'Los Angeles', state: 'CA' },
            { zip: '90095', city: 'Los Angeles', state: 'CA' },
            { zip: '90210', city: 'Beverly Hills', state: 'CA' },
            { zip: '90211', city: 'Beverly Hills', state: 'CA' },
            { zip: '90212', city: 'Beverly Hills', state: 'CA' },
            { zip: '90401', city: 'Santa Monica', state: 'CA' },
            { zip: '90402', city: 'Santa Monica', state: 'CA' },
            { zip: '90403', city: 'Santa Monica', state: 'CA' },
            { zip: '90404', city: 'Santa Monica', state: 'CA' },
            { zip: '90405', city: 'Santa Monica', state: 'CA' },
            // California - San Diego area
            { zip: '92101', city: 'San Diego', state: 'CA' },
            { zip: '92102', city: 'San Diego', state: 'CA' },
            { zip: '92103', city: 'San Diego', state: 'CA' },
            { zip: '92104', city: 'San Diego', state: 'CA' },
            { zip: '92105', city: 'San Diego', state: 'CA' },
            { zip: '92106', city: 'San Diego', state: 'CA' },
            { zip: '92107', city: 'San Diego', state: 'CA' },
            { zip: '92108', city: 'San Diego', state: 'CA' },
            { zip: '92109', city: 'San Diego', state: 'CA' },
            { zip: '92110', city: 'San Diego', state: 'CA' },
            { zip: '92111', city: 'San Diego', state: 'CA' },
            { zip: '92113', city: 'San Diego', state: 'CA' },
            { zip: '92114', city: 'San Diego', state: 'CA' },
            { zip: '92115', city: 'San Diego', state: 'CA' },
            { zip: '92116', city: 'San Diego', state: 'CA' },
            { zip: '92117', city: 'San Diego', state: 'CA' },
            { zip: '92118', city: 'Coronado', state: 'CA' },
            { zip: '92119', city: 'San Diego', state: 'CA' },
            { zip: '92120', city: 'San Diego', state: 'CA' },
            { zip: '92121', city: 'San Diego', state: 'CA' },
            { zip: '92122', city: 'San Diego', state: 'CA' },
            { zip: '92123', city: 'San Diego', state: 'CA' },
            { zip: '92124', city: 'San Diego', state: 'CA' },
            { zip: '92126', city: 'San Diego', state: 'CA' },
            { zip: '92127', city: 'San Diego', state: 'CA' },
            { zip: '92128', city: 'San Diego', state: 'CA' },
            { zip: '92129', city: 'San Diego', state: 'CA' },
            { zip: '92130', city: 'San Diego', state: 'CA' },
            { zip: '92131', city: 'San Diego', state: 'CA' },
            { zip: '92132', city: 'San Diego', state: 'CA' },
            { zip: '92134', city: 'San Diego', state: 'CA' },
            { zip: '92135', city: 'San Diego', state: 'CA' },
            { zip: '92136', city: 'San Diego', state: 'CA' },
            { zip: '92139', city: 'San Diego', state: 'CA' },
            { zip: '92140', city: 'San Diego', state: 'CA' },
            { zip: '92145', city: 'San Diego', state: 'CA' },
            { zip: '92147', city: 'San Diego', state: 'CA' },
            { zip: '92154', city: 'San Diego', state: 'CA' },
            { zip: '92155', city: 'San Diego', state: 'CA' },
            // California - San Francisco area
            { zip: '94102', city: 'San Francisco', state: 'CA' },
            { zip: '94103', city: 'San Francisco', state: 'CA' },
            { zip: '94104', city: 'San Francisco', state: 'CA' },
            { zip: '94105', city: 'San Francisco', state: 'CA' },
            { zip: '94107', city: 'San Francisco', state: 'CA' },
            { zip: '94108', city: 'San Francisco', state: 'CA' },
            { zip: '94109', city: 'San Francisco', state: 'CA' },
            { zip: '94110', city: 'San Francisco', state: 'CA' },
            { zip: '94111', city: 'San Francisco', state: 'CA' },
            { zip: '94112', city: 'San Francisco', state: 'CA' },
            { zip: '94114', city: 'San Francisco', state: 'CA' },
            { zip: '94115', city: 'San Francisco', state: 'CA' },
            { zip: '94116', city: 'San Francisco', state: 'CA' },
            { zip: '94117', city: 'San Francisco', state: 'CA' },
            { zip: '94118', city: 'San Francisco', state: 'CA' },
            { zip: '94121', city: 'San Francisco', state: 'CA' },
            { zip: '94122', city: 'San Francisco', state: 'CA' },
            { zip: '94123', city: 'San Francisco', state: 'CA' },
            { zip: '94124', city: 'San Francisco', state: 'CA' },
            { zip: '94127', city: 'San Francisco', state: 'CA' },
            { zip: '94129', city: 'San Francisco', state: 'CA' },
            { zip: '94130', city: 'San Francisco', state: 'CA' },
            { zip: '94131', city: 'San Francisco', state: 'CA' },
            { zip: '94132', city: 'San Francisco', state: 'CA' },
            { zip: '94133', city: 'San Francisco', state: 'CA' },
            { zip: '94134', city: 'San Francisco', state: 'CA' },
            // Colorado - Denver area
            { zip: '80202', city: 'Denver', state: 'CO' },
            { zip: '80203', city: 'Denver', state: 'CO' },
            { zip: '80204', city: 'Denver', state: 'CO' },
            { zip: '80205', city: 'Denver', state: 'CO' },
            { zip: '80206', city: 'Denver', state: 'CO' },
            { zip: '80207', city: 'Denver', state: 'CO' },
            { zip: '80209', city: 'Denver', state: 'CO' },
            { zip: '80210', city: 'Denver', state: 'CO' },
            { zip: '80211', city: 'Denver', state: 'CO' },
            { zip: '80212', city: 'Denver', state: 'CO' },
            { zip: '80214', city: 'Denver', state: 'CO' },
            { zip: '80216', city: 'Denver', state: 'CO' },
            { zip: '80218', city: 'Denver', state: 'CO' },
            { zip: '80219', city: 'Denver', state: 'CO' },
            { zip: '80220', city: 'Denver', state: 'CO' },
            { zip: '80221', city: 'Denver', state: 'CO' },
            { zip: '80222', city: 'Denver', state: 'CO' },
            { zip: '80223', city: 'Denver', state: 'CO' },
            { zip: '80224', city: 'Denver', state: 'CO' },
            { zip: '80227', city: 'Denver', state: 'CO' },
            { zip: '80230', city: 'Denver', state: 'CO' },
            { zip: '80231', city: 'Denver', state: 'CO' },
            { zip: '80232', city: 'Denver', state: 'CO' },
            { zip: '80235', city: 'Denver', state: 'CO' },
            { zip: '80236', city: 'Denver', state: 'CO' },
            { zip: '80237', city: 'Denver', state: 'CO' },
            { zip: '80238', city: 'Denver', state: 'CO' },
            { zip: '80239', city: 'Denver', state: 'CO' },
            { zip: '80246', city: 'Denver', state: 'CO' },
            { zip: '80247', city: 'Denver', state: 'CO' },
            { zip: '80249', city: 'Denver', state: 'CO' },
            // Nevada - Las Vegas area
            { zip: '89101', city: 'Las Vegas', state: 'NV' },
            { zip: '89102', city: 'Las Vegas', state: 'NV' },
            { zip: '89103', city: 'Las Vegas', state: 'NV' },
            { zip: '89104', city: 'Las Vegas', state: 'NV' },
            { zip: '89106', city: 'Las Vegas', state: 'NV' },
            { zip: '89107', city: 'Las Vegas', state: 'NV' },
            { zip: '89108', city: 'Las Vegas', state: 'NV' },
            { zip: '89109', city: 'Las Vegas', state: 'NV' },
            { zip: '89110', city: 'Las Vegas', state: 'NV' },
            { zip: '89113', city: 'Las Vegas', state: 'NV' },
            { zip: '89115', city: 'Las Vegas', state: 'NV' },
            { zip: '89117', city: 'Las Vegas', state: 'NV' },
            { zip: '89118', city: 'Las Vegas', state: 'NV' },
            { zip: '89119', city: 'Las Vegas', state: 'NV' },
            { zip: '89120', city: 'Las Vegas', state: 'NV' },
            { zip: '89121', city: 'Las Vegas', state: 'NV' },
            { zip: '89122', city: 'Las Vegas', state: 'NV' },
            { zip: '89123', city: 'Las Vegas', state: 'NV' },
            { zip: '89124', city: 'Las Vegas', state: 'NV' },
            { zip: '89128', city: 'Las Vegas', state: 'NV' },
            { zip: '89129', city: 'Las Vegas', state: 'NV' },
            { zip: '89130', city: 'Las Vegas', state: 'NV' },
            { zip: '89131', city: 'Las Vegas', state: 'NV' },
            { zip: '89134', city: 'Las Vegas', state: 'NV' },
            { zip: '89135', city: 'Las Vegas', state: 'NV' },
            { zip: '89138', city: 'Las Vegas', state: 'NV' },
            { zip: '89139', city: 'Las Vegas', state: 'NV' },
            { zip: '89141', city: 'Las Vegas', state: 'NV' },
            { zip: '89142', city: 'Las Vegas', state: 'NV' },
            { zip: '89143', city: 'Las Vegas', state: 'NV' },
            { zip: '89144', city: 'Las Vegas', state: 'NV' },
            { zip: '89145', city: 'Las Vegas', state: 'NV' },
            { zip: '89146', city: 'Las Vegas', state: 'NV' },
            { zip: '89147', city: 'Las Vegas', state: 'NV' },
            { zip: '89148', city: 'Las Vegas', state: 'NV' },
            { zip: '89149', city: 'Las Vegas', state: 'NV' },
            { zip: '89156', city: 'Las Vegas', state: 'NV' },
            { zip: '89166', city: 'Las Vegas', state: 'NV' },
            { zip: '89169', city: 'Las Vegas', state: 'NV' },
            { zip: '89178', city: 'Las Vegas', state: 'NV' },
            { zip: '89179', city: 'Las Vegas', state: 'NV' },
            { zip: '89183', city: 'Las Vegas', state: 'NV' },
            // Tennessee - Nashville area
            { zip: '37201', city: 'Nashville', state: 'TN' },
            { zip: '37203', city: 'Nashville', state: 'TN' },
            { zip: '37204', city: 'Nashville', state: 'TN' },
            { zip: '37205', city: 'Nashville', state: 'TN' },
            { zip: '37206', city: 'Nashville', state: 'TN' },
            { zip: '37207', city: 'Nashville', state: 'TN' },
            { zip: '37208', city: 'Nashville', state: 'TN' },
            { zip: '37209', city: 'Nashville', state: 'TN' },
            { zip: '37210', city: 'Nashville', state: 'TN' },
            { zip: '37211', city: 'Nashville', state: 'TN' },
            { zip: '37212', city: 'Nashville', state: 'TN' },
            { zip: '37213', city: 'Nashville', state: 'TN' },
            { zip: '37214', city: 'Nashville', state: 'TN' },
            { zip: '37215', city: 'Nashville', state: 'TN' },
            { zip: '37216', city: 'Nashville', state: 'TN' },
            { zip: '37217', city: 'Nashville', state: 'TN' },
            { zip: '37218', city: 'Nashville', state: 'TN' },
            { zip: '37219', city: 'Nashville', state: 'TN' },
            { zip: '37220', city: 'Nashville', state: 'TN' },
            { zip: '37221', city: 'Nashville', state: 'TN' },
            // Georgia - Atlanta area
            { zip: '30301', city: 'Atlanta', state: 'GA' },
            { zip: '30303', city: 'Atlanta', state: 'GA' },
            { zip: '30305', city: 'Atlanta', state: 'GA' },
            { zip: '30306', city: 'Atlanta', state: 'GA' },
            { zip: '30307', city: 'Atlanta', state: 'GA' },
            { zip: '30308', city: 'Atlanta', state: 'GA' },
            { zip: '30309', city: 'Atlanta', state: 'GA' },
            { zip: '30310', city: 'Atlanta', state: 'GA' },
            { zip: '30311', city: 'Atlanta', state: 'GA' },
            { zip: '30312', city: 'Atlanta', state: 'GA' },
            { zip: '30313', city: 'Atlanta', state: 'GA' },
            { zip: '30314', city: 'Atlanta', state: 'GA' },
            { zip: '30315', city: 'Atlanta', state: 'GA' },
            { zip: '30316', city: 'Atlanta', state: 'GA' },
            { zip: '30317', city: 'Atlanta', state: 'GA' },
            { zip: '30318', city: 'Atlanta', state: 'GA' },
            { zip: '30319', city: 'Atlanta', state: 'GA' },
            { zip: '30324', city: 'Atlanta', state: 'GA' },
            { zip: '30326', city: 'Atlanta', state: 'GA' },
            { zip: '30327', city: 'Atlanta', state: 'GA' },
            { zip: '30328', city: 'Atlanta', state: 'GA' },
            { zip: '30329', city: 'Atlanta', state: 'GA' },
            { zip: '30331', city: 'Atlanta', state: 'GA' },
            { zip: '30332', city: 'Atlanta', state: 'GA' },
            { zip: '30334', city: 'Atlanta', state: 'GA' },
            { zip: '30336', city: 'Atlanta', state: 'GA' },
            { zip: '30337', city: 'Atlanta', state: 'GA' },
            { zip: '30338', city: 'Atlanta', state: 'GA' },
            { zip: '30339', city: 'Atlanta', state: 'GA' },
            { zip: '30340', city: 'Atlanta', state: 'GA' },
            { zip: '30341', city: 'Atlanta', state: 'GA' },
            { zip: '30342', city: 'Atlanta', state: 'GA' },
            { zip: '30344', city: 'Atlanta', state: 'GA' },
            { zip: '30345', city: 'Atlanta', state: 'GA' },
            { zip: '30346', city: 'Atlanta', state: 'GA' },
            { zip: '30349', city: 'Atlanta', state: 'GA' },
            { zip: '30350', city: 'Atlanta', state: 'GA' },
            { zip: '30354', city: 'Atlanta', state: 'GA' },
            { zip: '30360', city: 'Atlanta', state: 'GA' },
            { zip: '30363', city: 'Atlanta', state: 'GA' },
            // New York - NYC area
            { zip: '10001', city: 'New York', state: 'NY' },
            { zip: '10002', city: 'New York', state: 'NY' },
            { zip: '10003', city: 'New York', state: 'NY' },
            { zip: '10004', city: 'New York', state: 'NY' },
            { zip: '10005', city: 'New York', state: 'NY' },
            { zip: '10006', city: 'New York', state: 'NY' },
            { zip: '10007', city: 'New York', state: 'NY' },
            { zip: '10009', city: 'New York', state: 'NY' },
            { zip: '10010', city: 'New York', state: 'NY' },
            { zip: '10011', city: 'New York', state: 'NY' },
            { zip: '10012', city: 'New York', state: 'NY' },
            { zip: '10013', city: 'New York', state: 'NY' },
            { zip: '10014', city: 'New York', state: 'NY' },
            { zip: '10016', city: 'New York', state: 'NY' },
            { zip: '10017', city: 'New York', state: 'NY' },
            { zip: '10018', city: 'New York', state: 'NY' },
            { zip: '10019', city: 'New York', state: 'NY' },
            { zip: '10020', city: 'New York', state: 'NY' },
            { zip: '10021', city: 'New York', state: 'NY' },
            { zip: '10022', city: 'New York', state: 'NY' },
            { zip: '10023', city: 'New York', state: 'NY' },
            { zip: '10024', city: 'New York', state: 'NY' },
            { zip: '10025', city: 'New York', state: 'NY' },
            { zip: '10026', city: 'New York', state: 'NY' },
            { zip: '10027', city: 'New York', state: 'NY' },
            { zip: '10028', city: 'New York', state: 'NY' },
            { zip: '10029', city: 'New York', state: 'NY' },
            { zip: '10030', city: 'New York', state: 'NY' },
            { zip: '10031', city: 'New York', state: 'NY' },
            { zip: '10032', city: 'New York', state: 'NY' },
            { zip: '10033', city: 'New York', state: 'NY' },
            { zip: '10034', city: 'New York', state: 'NY' },
            { zip: '10035', city: 'New York', state: 'NY' },
            { zip: '10036', city: 'New York', state: 'NY' },
            { zip: '10037', city: 'New York', state: 'NY' },
            { zip: '10038', city: 'New York', state: 'NY' },
            { zip: '10039', city: 'New York', state: 'NY' },
            { zip: '10040', city: 'New York', state: 'NY' },
            { zip: '10044', city: 'New York', state: 'NY' },
            { zip: '10065', city: 'New York', state: 'NY' },
            { zip: '10069', city: 'New York', state: 'NY' },
            { zip: '10075', city: 'New York', state: 'NY' },
            { zip: '10128', city: 'New York', state: 'NY' },
            { zip: '10280', city: 'New York', state: 'NY' },
            { zip: '10282', city: 'New York', state: 'NY' },
            // Washington - Seattle area
            { zip: '98101', city: 'Seattle', state: 'WA' },
            { zip: '98102', city: 'Seattle', state: 'WA' },
            { zip: '98103', city: 'Seattle', state: 'WA' },
            { zip: '98104', city: 'Seattle', state: 'WA' },
            { zip: '98105', city: 'Seattle', state: 'WA' },
            { zip: '98106', city: 'Seattle', state: 'WA' },
            { zip: '98107', city: 'Seattle', state: 'WA' },
            { zip: '98108', city: 'Seattle', state: 'WA' },
            { zip: '98109', city: 'Seattle', state: 'WA' },
            { zip: '98112', city: 'Seattle', state: 'WA' },
            { zip: '98115', city: 'Seattle', state: 'WA' },
            { zip: '98116', city: 'Seattle', state: 'WA' },
            { zip: '98117', city: 'Seattle', state: 'WA' },
            { zip: '98118', city: 'Seattle', state: 'WA' },
            { zip: '98119', city: 'Seattle', state: 'WA' },
            { zip: '98121', city: 'Seattle', state: 'WA' },
            { zip: '98122', city: 'Seattle', state: 'WA' },
            { zip: '98125', city: 'Seattle', state: 'WA' },
            { zip: '98126', city: 'Seattle', state: 'WA' },
            { zip: '98133', city: 'Seattle', state: 'WA' },
            { zip: '98134', city: 'Seattle', state: 'WA' },
            { zip: '98136', city: 'Seattle', state: 'WA' },
            { zip: '98144', city: 'Seattle', state: 'WA' },
            { zip: '98146', city: 'Seattle', state: 'WA' },
            { zip: '98154', city: 'Seattle', state: 'WA' },
            { zip: '98164', city: 'Seattle', state: 'WA' },
            { zip: '98174', city: 'Seattle', state: 'WA' },
            { zip: '98177', city: 'Seattle', state: 'WA' },
            { zip: '98178', city: 'Seattle', state: 'WA' },
            { zip: '98195', city: 'Seattle', state: 'WA' },
            { zip: '98199', city: 'Seattle', state: 'WA' },
            // Oregon - Portland area
            { zip: '97201', city: 'Portland', state: 'OR' },
            { zip: '97202', city: 'Portland', state: 'OR' },
            { zip: '97203', city: 'Portland', state: 'OR' },
            { zip: '97204', city: 'Portland', state: 'OR' },
            { zip: '97205', city: 'Portland', state: 'OR' },
            { zip: '97206', city: 'Portland', state: 'OR' },
            { zip: '97209', city: 'Portland', state: 'OR' },
            { zip: '97210', city: 'Portland', state: 'OR' },
            { zip: '97211', city: 'Portland', state: 'OR' },
            { zip: '97212', city: 'Portland', state: 'OR' },
            { zip: '97213', city: 'Portland', state: 'OR' },
            { zip: '97214', city: 'Portland', state: 'OR' },
            { zip: '97215', city: 'Portland', state: 'OR' },
            { zip: '97216', city: 'Portland', state: 'OR' },
            { zip: '97217', city: 'Portland', state: 'OR' },
            { zip: '97218', city: 'Portland', state: 'OR' },
            { zip: '97219', city: 'Portland', state: 'OR' },
            { zip: '97220', city: 'Portland', state: 'OR' },
            { zip: '97221', city: 'Portland', state: 'OR' },
            { zip: '97222', city: 'Portland', state: 'OR' },
            { zip: '97223', city: 'Portland', state: 'OR' },
            { zip: '97224', city: 'Portland', state: 'OR' },
            { zip: '97225', city: 'Portland', state: 'OR' },
            { zip: '97227', city: 'Portland', state: 'OR' },
            { zip: '97229', city: 'Portland', state: 'OR' },
            { zip: '97230', city: 'Portland', state: 'OR' },
            { zip: '97231', city: 'Portland', state: 'OR' },
            { zip: '97232', city: 'Portland', state: 'OR' },
            { zip: '97233', city: 'Portland', state: 'OR' },
            { zip: '97236', city: 'Portland', state: 'OR' },
            { zip: '97239', city: 'Portland', state: 'OR' },
            { zip: '97266', city: 'Portland', state: 'OR' },
            // Illinois - Chicago area
            { zip: '60601', city: 'Chicago', state: 'IL' },
            { zip: '60602', city: 'Chicago', state: 'IL' },
            { zip: '60603', city: 'Chicago', state: 'IL' },
            { zip: '60604', city: 'Chicago', state: 'IL' },
            { zip: '60605', city: 'Chicago', state: 'IL' },
            { zip: '60606', city: 'Chicago', state: 'IL' },
            { zip: '60607', city: 'Chicago', state: 'IL' },
            { zip: '60608', city: 'Chicago', state: 'IL' },
            { zip: '60609', city: 'Chicago', state: 'IL' },
            { zip: '60610', city: 'Chicago', state: 'IL' },
            { zip: '60611', city: 'Chicago', state: 'IL' },
            { zip: '60612', city: 'Chicago', state: 'IL' },
            { zip: '60613', city: 'Chicago', state: 'IL' },
            { zip: '60614', city: 'Chicago', state: 'IL' },
            { zip: '60615', city: 'Chicago', state: 'IL' },
            { zip: '60616', city: 'Chicago', state: 'IL' },
            { zip: '60617', city: 'Chicago', state: 'IL' },
            { zip: '60618', city: 'Chicago', state: 'IL' },
            { zip: '60619', city: 'Chicago', state: 'IL' },
            { zip: '60620', city: 'Chicago', state: 'IL' },
            { zip: '60621', city: 'Chicago', state: 'IL' },
            { zip: '60622', city: 'Chicago', state: 'IL' },
            { zip: '60623', city: 'Chicago', state: 'IL' },
            { zip: '60624', city: 'Chicago', state: 'IL' },
            { zip: '60625', city: 'Chicago', state: 'IL' },
            { zip: '60626', city: 'Chicago', state: 'IL' },
            { zip: '60628', city: 'Chicago', state: 'IL' },
            { zip: '60629', city: 'Chicago', state: 'IL' },
            { zip: '60630', city: 'Chicago', state: 'IL' },
            { zip: '60631', city: 'Chicago', state: 'IL' },
            { zip: '60632', city: 'Chicago', state: 'IL' },
            { zip: '60633', city: 'Chicago', state: 'IL' },
            { zip: '60634', city: 'Chicago', state: 'IL' },
            { zip: '60636', city: 'Chicago', state: 'IL' },
            { zip: '60637', city: 'Chicago', state: 'IL' },
            { zip: '60638', city: 'Chicago', state: 'IL' },
            { zip: '60639', city: 'Chicago', state: 'IL' },
            { zip: '60640', city: 'Chicago', state: 'IL' },
            { zip: '60641', city: 'Chicago', state: 'IL' },
            { zip: '60642', city: 'Chicago', state: 'IL' },
            { zip: '60643', city: 'Chicago', state: 'IL' },
            { zip: '60644', city: 'Chicago', state: 'IL' },
            { zip: '60645', city: 'Chicago', state: 'IL' },
            { zip: '60646', city: 'Chicago', state: 'IL' },
            { zip: '60647', city: 'Chicago', state: 'IL' },
            { zip: '60649', city: 'Chicago', state: 'IL' },
            { zip: '60651', city: 'Chicago', state: 'IL' },
            { zip: '60652', city: 'Chicago', state: 'IL' },
            { zip: '60653', city: 'Chicago', state: 'IL' },
            { zip: '60654', city: 'Chicago', state: 'IL' },
            { zip: '60655', city: 'Chicago', state: 'IL' },
            { zip: '60656', city: 'Chicago', state: 'IL' },
            { zip: '60657', city: 'Chicago', state: 'IL' },
            { zip: '60659', city: 'Chicago', state: 'IL' },
            { zip: '60660', city: 'Chicago', state: 'IL' },
            { zip: '60661', city: 'Chicago', state: 'IL' },
            // Washington DC area
            { zip: '20001', city: 'Washington', state: 'DC' },
            { zip: '20002', city: 'Washington', state: 'DC' },
            { zip: '20003', city: 'Washington', state: 'DC' },
            { zip: '20004', city: 'Washington', state: 'DC' },
            { zip: '20005', city: 'Washington', state: 'DC' },
            { zip: '20006', city: 'Washington', state: 'DC' },
            { zip: '20007', city: 'Washington', state: 'DC' },
            { zip: '20008', city: 'Washington', state: 'DC' },
            { zip: '20009', city: 'Washington', state: 'DC' },
            { zip: '20010', city: 'Washington', state: 'DC' },
            { zip: '20011', city: 'Washington', state: 'DC' },
            { zip: '20012', city: 'Washington', state: 'DC' },
            { zip: '20015', city: 'Washington', state: 'DC' },
            { zip: '20016', city: 'Washington', state: 'DC' },
            { zip: '20017', city: 'Washington', state: 'DC' },
            { zip: '20018', city: 'Washington', state: 'DC' },
            { zip: '20019', city: 'Washington', state: 'DC' },
            { zip: '20020', city: 'Washington', state: 'DC' },
            { zip: '20024', city: 'Washington', state: 'DC' },
            { zip: '20032', city: 'Washington', state: 'DC' },
            { zip: '20036', city: 'Washington', state: 'DC' },
            { zip: '20037', city: 'Washington', state: 'DC' },
          ];
          
          // Filter by prefix
          const prefix = input.prefix.replace(/\D/g, ''); // Remove non-digits
          const matches = zipCodeDatabase
            .filter(z => z.zip.startsWith(prefix))
            .slice(0, 15); // Limit to 15 results
          
          return {
            success: true,
            data: matches,
          };
        } catch (error) {
          console.error('[searchZipCodes] Error:', error);
          return {
            success: false,
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
          
          // Save lead capture data if provided
          if (input.leadEmail) {
            try {
              const db = await getDb();
              if (db) {
                const property = report.property as any;
                await db.insert(analysisReports).values({
                  address: input.address,
                  city: property?.location?.city || null,
                  state: property?.location?.state || null,
                  zipCode: property?.location?.zipcode || null,
                  latitude: property?.location?.latitude?.toString() || null,
                  longitude: property?.location?.longitude?.toString() || null,
                  bedrooms: input.bedrooms || null,
                  bathrooms: input.bathrooms?.toString() || null,
                  marketId: property?.location?.market_id || null,
                  marketName: property?.location?.market_name || null,
                  annualRevenueRealistic: property?.estimates?.annual_revenue || null,
                  occupancyRate: property?.estimates?.occupancy_rate?.toString() || null,
                  averageDailyRate: property?.estimates?.average_daily_rate || null,
                  leadName: input.leadName || null,
                  leadEmail: input.leadEmail || null,
                  leadPhone: input.leadPhone || null,
                  fullAnalysisData: report,
                });
                console.log('[Rental] Lead captured:', input.leadEmail);
              }
            } catch (dbError) {
              console.error('[Rental] Error saving lead:', dbError);
              // Don't fail the request if lead save fails
            }
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
          console.log('[getAIPropertyReport] baseReport.market:', JSON.stringify(baseReport.market, null, 2));
          console.log('[getAIPropertyReport] marketId:', marketId);
          const bedrooms = input.bedrooms || baseReport.property.property?.bedrooms || 2;
          
          // Fetch ALL qualifying competitors from Market Charts API
          let allCompetitors: typeof baseReport.same_bedroom_comps = [];
          let qualifyingCompetitors: typeof baseReport.same_bedroom_comps = [];
          const minRevenueThreshold = input.monthlyRent * 12 * 2;
          
          // Get subject property coordinates for distance calculation
          // baseReport.property is a RentalizerResponse, and RentalizerResponse.property contains lat/lng
          const subjectLat = baseReport.property.property?.latitude;
          const subjectLng = baseReport.property.property?.longitude;
          console.log(`[getAIPropertyReport] Subject coordinates: lat=${subjectLat}, lng=${subjectLng}`);
          console.log(`[getAIPropertyReport] baseReport.property keys:`, Object.keys(baseReport.property || {}));
          console.log(`[getAIPropertyReport] baseReport.property.property keys:`, Object.keys(baseReport.property?.property || {}));
          
          // Helper function to calculate distance in meters using Haversine formula
          const calculateDistanceMeters = (lat1: number, lng1: number, lat2: number | null | undefined, lng2: number | null | undefined): number | undefined => {
            if (!lat2 || !lng2) return undefined;
            const R = 6371000; // Earth's radius in meters
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return Math.round(R * c);
          };
          
          if (marketId) {
            console.log(`[getAIPropertyReport] Fetching all competitors for market ${marketId}, ${bedrooms}BR, threshold $${minRevenueThreshold}`);
            const competitorData = await getQualifyingCompetitors(marketId, bedrooms, input.monthlyRent, { excludeInactive: true });
            allCompetitors = competitorData.allSameBedroomListings; // Already filtered to active only
            qualifyingCompetitors = competitorData.qualifyingListings;
            const inactiveFiltered = competitorData.inactiveCount;
            console.log(`[getAIPropertyReport] Found ${allCompetitors.length} active same-bedroom listings (filtered ${inactiveFiltered} inactive), ${qualifyingCompetitors.length} meet threshold`);
            
            // Calculate distance for each competitor if we have subject property coordinates
            if (subjectLat && subjectLng) {
              allCompetitors = allCompetitors.map(c => ({
                ...c,
                distance_meters: c.distance_meters || calculateDistanceMeters(subjectLat, subjectLng, c.latitude, c.longitude),
              }));
              qualifyingCompetitors = qualifyingCompetitors.map(c => ({
                ...c,
                distance_meters: c.distance_meters || calculateDistanceMeters(subjectLat, subjectLng, c.latitude, c.longitude),
              }));
              const compsWithLatLng = allCompetitors.filter(c => c.latitude && c.longitude).length;
              const compsWithDistance = allCompetitors.filter(c => c.distance_meters).length;
              console.log(`[getAIPropertyReport] Comps with lat/lng: ${compsWithLatLng}/${allCompetitors.length}, Comps with distance: ${compsWithDistance}/${allCompetitors.length}`);
            }
            
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

          // Fetch AirDNA's native comp algorithm (if we have a listing ID from comps)
          let airdnaNativeComps: Awaited<ReturnType<typeof getListingComps>> = [];
          const topCompId = (baseReport.property as any)?.comps?.[0]?.airbnb_listing_id || allCompetitors[0]?.id;
          if (topCompId) {
            try {
              console.log(`[getAIPropertyReport] Fetching AirDNA native comps for listing ${topCompId}`);
              airdnaNativeComps = await getListingComps(topCompId, 10);
              console.log(`[getAIPropertyReport] Found ${airdnaNativeComps.length} native comps from AirDNA algorithm`);
            } catch (error) {
              console.error('[getAIPropertyReport] Native comps fetch failed:', error);
              // Continue without native comps
            }
          }

          // Fetch historical metrics for top 10 comp properties (revenue trends)
          const compHistoricalMetrics: Map<string, { trend: 'growing' | 'stable' | 'declining'; totalRevenue: number; avgOccupancy: number }> = new Map();
          const top10Comps = allCompetitors.slice(0, 10);
          if (top10Comps.length > 0) {
            console.log(`[getAIPropertyReport] Fetching historical metrics for ${top10Comps.length} top comps...`);
            try {
              // Fetch in parallel with rate limiting (batches of 5)
              const batchSize = 5;
              for (let i = 0; i < top10Comps.length; i += batchSize) {
                const batch = top10Comps.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                  batch.map(async (comp) => {
                    if (!comp.id) return null;
                    try {
                      const metrics = await getListingHistoricalMetrics(comp.id, 12);
                      if (metrics) {
                        return {
                          id: comp.id,
                          trend: metrics.summary.revenue_trend,
                          totalRevenue: metrics.summary.total_revenue,
                          avgOccupancy: metrics.summary.avg_occupancy,
                        };
                      }
                    } catch (e) {
                      console.error(`[getAIPropertyReport] Failed to fetch metrics for comp ${comp.id}:`, e);
                    }
                    return null;
                  })
                );
                
                for (const result of batchResults) {
                  if (result) {
                    compHistoricalMetrics.set(result.id, {
                      trend: result.trend,
                      totalRevenue: result.totalRevenue,
                      avgOccupancy: result.avgOccupancy,
                    });
                  }
                }
                
                // Small delay between batches to avoid rate limiting
                if (i + batchSize < top10Comps.length) {
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              }
              console.log(`[getAIPropertyReport] Successfully fetched historical metrics for ${compHistoricalMetrics.size} comps`);
            } catch (error) {
              console.error('[getAIPropertyReport] Historical metrics fetch failed:', error);
              // Continue without historical metrics
            }
          }

          // Enrich allCompetitors with historical trend data
          allCompetitors = allCompetitors.map(comp => {
            const historicalData = comp.id ? compHistoricalMetrics.get(comp.id) : undefined;
            return {
              ...comp,
              revenue_trend: historicalData?.trend,
              historical_total_revenue: historicalData?.totalRevenue,
              historical_avg_occupancy: historicalData?.avgOccupancy,
            };
          });

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

          // Ensure market.id is included in the response
          const marketData = baseReport.market ? {
            ...baseReport.market,
            id: marketId || baseReport.market.id,
          } : { id: marketId };

          return {
            success: true,
            data: {
              ...baseReport,
              // Ensure market.id is always included
              market: marketData,
              // Override same_bedroom_comps with ALL competitors from Market Charts API
              same_bedroom_comps: allCompetitors,
              qualifying_comps: qualifyingCompetitors,
              // AirDNA's native comp algorithm (similarity-based)
              airdna_native_comps: airdnaNativeComps.length > 0 ? airdnaNativeComps.map(c => ({
                id: c.listing_id,
                title: c.title,
                bedrooms: c.bedrooms,
                bathrooms: c.bathrooms,
                accommodates: c.accommodates,
                property_type: c.property_type,
                annual_revenue: c.annual_revenue,
                adr: c.adr,
                occupancy: c.occupancy,
                rating: c.rating,
                reviews: c.reviews,
                distance_meters: c.distance_meters,
                similarity_score: c.similarity_score,
                airbnb_url: c.airbnb_url,
                amenities: c.amenities,
              })) : undefined,
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

    // Get booking patterns for a market
    getBookingPatterns: publicProcedure
      .input(z.object({ marketId: z.union([z.number(), z.string()]), bedrooms: z.number().optional() }))
      .mutation(async ({ input }) => {
        try {
          // Keep the full market ID (e.g., 'airdna-163') - API requires it
          const result = await getMarketBookingPatterns(String(input.marketId), input.bedrooms);
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error("[Rental] Error getting booking patterns:", error);
          return {
            success: false,
            error: "Failed to get booking patterns",
            data: null,
          };
        }
      }),

    // Get supply trend for a market
    getSupplyTrend: publicProcedure
      .input(z.object({ marketId: z.union([z.number(), z.string()]), bedrooms: z.number().optional() }))
      .mutation(async ({ input }) => {
        try {
          const result = await getMarketSupplyTrend(String(input.marketId), input.bedrooms);
          console.log('[getSupplyTrend] Result monthly_data sample:', result?.monthly_data?.slice(0, 2));
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error("[Rental] Error getting supply trend:", error);
          return {
            success: false,
            error: "Failed to get supply trend",
            data: null,
          };
        }
      }),

    // Get forward-looking demand indicators
    getForwardDemand: publicProcedure
      .input(z.object({ 
        marketId: z.union([z.number(), z.string()]),
        numMonths: z.number().optional().default(6),
        bedrooms: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const futureDailyData = await getMarketFutureDailyData(
            String(input.marketId),
            input.numMonths,
            input.bedrooms
          );
          
          if (!futureDailyData || futureDailyData.length === 0) {
            return {
              success: false,
              error: "No future pricing data available",
              data: null,
            };
          }
          
          const indicators = calculateForwardLookingDemand(futureDailyData);
          
          return {
            success: true,
            data: indicators,
          };
        } catch (error) {
          console.error("[Rental] Error getting forward demand:", error);
          return {
            success: false,
            error: "Failed to get forward demand indicators",
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

            // Sync lead to HubSpot for email automation
            try {
              const nameParts = input.name.split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';
              
              // Generate a personalized deep link for follow-up emails
              const baseUrl = process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com';
              const deepLink = generateDeepLink({
                baseUrl,
                tool: 'calculator',
                email: input.email,
                utm_source: 'hubspot',
                utm_medium: 'email',
                utm_campaign: 'lead_followup',
              });

              await upsertContact({
                email: input.email,
                firstName,
                lastName,
                phone: input.phone,
                source: 'rental_calculator',
                toolUsed: 'property_calculator',
                propertyAddress: input.address,
                deepLink,
              });
              
              console.log('[HubSpot] Lead synced to HubSpot:', input.email);
            } catch (hubspotError) {
              // Don't fail the lead submission if HubSpot sync fails
              console.error('[HubSpot] Error syncing lead:', hubspotError);
            }
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

          return { success: true, id: Number((result as any).insertId) };
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
        // Lead capture fields
        leadName: z.string().optional(),
        leadEmail: z.string().email().optional(),
        leadPhone: z.string().optional(),
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
        zillowUrl: z.string().optional(),
        imageUrl: z.string().optional(),
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
            zillowUrl: input.zillowUrl,
            imageUrl: input.imageUrl,
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

  // Favorite Listings router (for map view favorites)
  favoriteListings: router({
    // Get all favorite listing IDs for a user or session
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
              .from(favoriteListings)
              .where(eq(favoriteListings.userId, userId))
              .orderBy(desc(favoriteListings.createdAt));
          } else if (sessionId) {
            favorites = await db
              .select()
              .from(favoriteListings)
              .where(eq(favoriteListings.sessionId, sessionId))
              .orderBy(desc(favoriteListings.createdAt));
          } else {
            return { success: true, data: [] };
          }

          return { success: true, data: favorites };
        } catch (error) {
          console.error("[FavoriteListings] Error listing:", error);
          return { success: false, error: "Failed to load favorites", data: [] };
        }
      }),

    // Add a listing to favorites
    add: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        listingId: z.string().min(1, "Listing ID is required"),
        title: z.string().optional(),
        bedrooms: z.number().int().optional(),
        bathrooms: z.number().optional(),
        revenue: z.number().int().optional(),
        occupancy: z.number().optional(),
        adr: z.number().int().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        airbnbUrl: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        searchAddress: z.string().optional(),
        searchSubmarketId: z.string().optional(),
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

          // Check if already favorited
          const existing = await db
            .select()
            .from(favoriteListings)
            .where(
              and(
                eq(favoriteListings.listingId, input.listingId),
                userId ? eq(favoriteListings.userId, userId) : eq(favoriteListings.sessionId, sessionId!)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            return { success: true, data: { id: existing[0].id }, message: "Already favorited" };
          }

          const [result] = await db.insert(favoriteListings).values({
            userId: userId || null,
            sessionId: sessionId || null,
            listingId: input.listingId,
            title: input.title,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms?.toString(),
            revenue: input.revenue,
            occupancy: input.occupancy?.toString(),
            adr: input.adr,
            latitude: input.latitude?.toString(),
            longitude: input.longitude?.toString(),
            airbnbUrl: input.airbnbUrl,
            thumbnailUrl: input.thumbnailUrl,
            searchAddress: input.searchAddress,
            searchSubmarketId: input.searchSubmarketId,
          });

          return { success: true, data: { id: result.insertId } };
        } catch (error) {
          console.error("[FavoriteListings] Error adding:", error);
          return { success: false, error: "Failed to add favorite" };
        }
      }),

    // Remove a listing from favorites by listing ID
    remove: publicProcedure
      .input(z.object({
        listingId: z.string().min(1, "Listing ID is required"),
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
              .delete(favoriteListings)
              .where(and(
                eq(favoriteListings.listingId, input.listingId),
                eq(favoriteListings.userId, userId)
              ));
          } else if (sessionId) {
            await db
              .delete(favoriteListings)
              .where(and(
                eq(favoriteListings.listingId, input.listingId),
                eq(favoriteListings.sessionId, sessionId)
              ));
          } else {
            return { success: false, error: "User or session ID required" };
          }

          return { success: true };
        } catch (error) {
          console.error("[FavoriteListings] Error removing:", error);
          return { success: false, error: "Failed to remove favorite" };
        }
      }),

    // Toggle a listing favorite (add if not exists, remove if exists)
    toggle: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        listingId: z.string().min(1, "Listing ID is required"),
        title: z.string().optional(),
        bedrooms: z.number().int().optional(),
        bathrooms: z.number().optional(),
        revenue: z.number().int().optional(),
        occupancy: z.number().optional(),
        adr: z.number().int().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        airbnbUrl: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        searchAddress: z.string().optional(),
        searchSubmarketId: z.string().optional(),
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

          // Check if already favorited
          const existing = await db
            .select()
            .from(favoriteListings)
            .where(
              and(
                eq(favoriteListings.listingId, input.listingId),
                userId ? eq(favoriteListings.userId, userId) : eq(favoriteListings.sessionId, sessionId!)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            // Remove it
            await db
              .delete(favoriteListings)
              .where(eq(favoriteListings.id, existing[0].id));
            return { success: true, action: "removed", isFavorited: false };
          } else {
            // Add it
            const [result] = await db.insert(favoriteListings).values({
              userId: userId || null,
              sessionId: sessionId || null,
              listingId: input.listingId,
              title: input.title,
              bedrooms: input.bedrooms,
              bathrooms: input.bathrooms?.toString(),
              revenue: input.revenue,
              occupancy: input.occupancy?.toString(),
              adr: input.adr,
              latitude: input.latitude?.toString(),
              longitude: input.longitude?.toString(),
              airbnbUrl: input.airbnbUrl,
              thumbnailUrl: input.thumbnailUrl,
              searchAddress: input.searchAddress,
              searchSubmarketId: input.searchSubmarketId,
            });
            return { success: true, action: "added", isFavorited: true, id: result.insertId };
          }
        } catch (error) {
          console.error("[FavoriteListings] Error toggling:", error);
          return { success: false, error: "Failed to toggle favorite" };
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

  // Regulation Tracker - Real-time STR regulation lookup
  regulationTracker: router({
    // Parse location from various input formats (city, address, Redfin/Zillow URL)
    parseLocation: publicProcedure
      .input(z.object({
        input: z.string().min(1, "Location input is required"),
      }))
      .query(async ({ input }) => {
        const parsed = parseLocation(input.input);
        if (!parsed) {
          return {
            success: false,
            error: "Could not parse location. Please enter a city/state, address, or Redfin/Zillow URL.",
            data: null,
          };
        }
        return {
          success: true,
          data: parsed,
        };
      }),

    // Get regulations - supports city/state or raw input (address/URL)
    getRegulations: publicProcedure
      .input(z.object({
        city: z.string().min(1, "City is required"),
        state: z.string().min(1, "State is required"),
      }))
      .mutation(async ({ input }) => {
        console.log(`[RegulationTracker] Looking up regulations for ${input.city}, ${input.state}`);
        
        const result = await getRegulationInfo(input.city, input.state);
        
        // Debug log the sources being returned
        console.log(`[RegulationTracker] Returning ${result.sources.length} sources:`);
        result.sources.forEach((s, i) => {
          console.log(`  ${i + 1}. [${s.type}] ${s.title} - ${s.url}`);
        });
        
        return result;
      }),

    // Get regulations from raw input (address, URL, or city/state)
    getRegulationsFromInput: publicProcedure
      .input(z.object({
        input: z.string().min(1, "Location input is required"),
      }))
      .mutation(async ({ input }) => {
        // Parse the input to extract city/state
        const parsed = parseLocation(input.input);
        if (!parsed) {
          return {
            success: false,
            error: "Could not parse location. Please enter a city/state, address, or Redfin/Zillow URL.",
            data: null,
          };
        }

        console.log(`[RegulationTracker] Parsed input: ${parsed.city}, ${parsed.state}${parsed.address ? ` (address: ${parsed.address})` : ''}`);
        
        const result = await getRegulationInfo(parsed.city, parsed.state);
        
        // Debug log the sources being returned
        console.log(`[RegulationTracker] Returning ${result.sources.length} sources:`);
        result.sources.forEach((s, i) => {
          console.log(`  ${i + 1}. [${s.type}] ${s.title} - ${s.url}`);
        });
        
        return {
          success: true,
          data: result,
          parsedLocation: parsed,
        };
      }),

    // Save a regulation search to favorites
    saveRegulation: protectedProcedure
      .input(z.object({
        city: z.string().min(1),
        state: z.string().min(1),
        status: z.string(),
        permitRequired: z.boolean(),
        primaryResidenceOnly: z.boolean(),
        registrationFee: z.string().optional(),
        notes: z.string().optional(),
        sources: z.array(z.object({
          title: z.string(),
          url: z.string(),
          type: z.enum(['official', 'news', 'third_party']),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const locationKey = `${input.city.toLowerCase()}-${input.state.toLowerCase()}`;
        
        // Check if already saved
        const existing = await db.select()
          .from(savedRegulations)
          .where(and(
            eq(savedRegulations.userId, ctx.user.id),
            eq(savedRegulations.locationKey, locationKey)
          ))
          .limit(1);
        
        if (existing.length > 0) {
          return {
            success: false,
            error: 'Regulation already saved',
            alreadySaved: true,
          };
        }
        
        await db.insert(savedRegulations).values({
          userId: ctx.user.id,
          city: input.city,
          state: input.state,
          locationKey,
          status: input.status,
          permitRequired: input.permitRequired ? 1 : 0,
          primaryResidenceOnly: input.primaryResidenceOnly ? 1 : 0,
          registrationFee: input.registrationFee,
          notes: input.notes,
          sources: input.sources || [],
        });
        
        return { success: true };
      }),

    // Get user's saved regulations
    getSavedRegulations: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const saved = await db.select()
          .from(savedRegulations)
          .where(eq(savedRegulations.userId, ctx.user.id))
          .orderBy(desc(savedRegulations.createdAt));
        
        return {
          success: true,
          data: saved.map(r => ({
            ...r,
            permitRequired: r.permitRequired === 1,
            primaryResidenceOnly: r.primaryResidenceOnly === 1,
          })),
        };
      }),

    // Delete a saved regulation
    deleteSavedRegulation: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        await db.delete(savedRegulations)
          .where(and(
            eq(savedRegulations.id, input.id),
            eq(savedRegulations.userId, ctx.user.id)
          ));
        return { success: true };
      }),

    // Check if a regulation is saved
    isRegulationSaved: protectedProcedure
      .input(z.object({
        city: z.string(),
        state: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const locationKey = `${input.city.toLowerCase()}-${input.state.toLowerCase()}`;
        const existing = await db.select()
          .from(savedRegulations)
          .where(and(
            eq(savedRegulations.userId, ctx.user.id),
            eq(savedRegulations.locationKey, locationKey)
          ))
          .limit(1);
        return { saved: existing.length > 0 };
      }),

    // Add a comment to a regulation page
    addComment: protectedProcedure
      .input(z.object({
        city: z.string().min(1),
        state: z.string().min(1),
        content: z.string().min(1).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const locationKey = `${input.city.toLowerCase()}-${input.state.toLowerCase()}`;
        
        const [result] = await db.insert(regulationComments).values({
          userId: ctx.user.id,
          locationKey,
          city: input.city,
          state: input.state,
          content: input.content,
        });
        
        return { success: true, commentId: result.insertId };
      }),

    // Get comments for a regulation page
    getComments: publicProcedure
      .input(z.object({
        city: z.string(),
        state: z.string(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const locationKey = `${input.city.toLowerCase()}-${input.state.toLowerCase()}`;
        
        const comments = await db.select({
          id: regulationComments.id,
          content: regulationComments.content,
          createdAt: regulationComments.createdAt,
          userId: regulationComments.userId,
          userName: users.name,
          upvotes: regulationComments.upvotes,
          downvotes: regulationComments.downvotes,
          isFlagged: regulationComments.isFlagged,
        })
          .from(regulationComments)
          .leftJoin(users, eq(regulationComments.userId, users.id))
          .where(and(
            eq(regulationComments.locationKey, locationKey),
            eq(regulationComments.isApproved, 1)
          ))
          .orderBy(desc(regulationComments.upvotes), desc(regulationComments.createdAt));
        
        return {
          success: true,
          data: comments.map(c => ({
            ...c,
            voteScore: c.upvotes - c.downvotes,
          })),
          count: comments.length,
        };
      }),

    // Delete own comment
    deleteComment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        await db.delete(regulationComments)
          .where(and(
            eq(regulationComments.id, input.id),
            eq(regulationComments.userId, ctx.user.id)
          ));
        return { success: true };
      }),

    // Vote on a comment (upvote/downvote)
    voteComment: protectedProcedure
      .input(z.object({
        commentId: z.number(),
        voteType: z.enum(['up', 'down']),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const voteValue = input.voteType === 'up' ? 1 : -1;
        
        // Check if user already voted on this comment
        const existingVote = await db.select()
          .from(commentVotes)
          .where(and(
            eq(commentVotes.commentId, input.commentId),
            eq(commentVotes.userId, ctx.user.id)
          ))
          .limit(1);
        
        if (existingVote.length > 0) {
          const oldVote = existingVote[0];
          
          if (oldVote.voteType === voteValue) {
            // Same vote - remove it (toggle off)
            await db.delete(commentVotes)
              .where(eq(commentVotes.id, oldVote.id));
            
            // Update comment vote counts
            if (voteValue === 1) {
              await db.execute(`UPDATE regulation_comments SET upvotes = upvotes - 1 WHERE id = ${input.commentId}`);
            } else {
              await db.execute(`UPDATE regulation_comments SET downvotes = downvotes - 1 WHERE id = ${input.commentId}`);
            }
            
            return { success: true, action: 'removed' };
          } else {
            // Different vote - change it
            await db.update(commentVotes)
              .set({ voteType: voteValue })
              .where(eq(commentVotes.id, oldVote.id));
            
            // Update comment vote counts (swap)
            if (voteValue === 1) {
              await db.execute(`UPDATE regulation_comments SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = ${input.commentId}`);
            } else {
              await db.execute(`UPDATE regulation_comments SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = ${input.commentId}`);
            }
            
            return { success: true, action: 'changed' };
          }
        } else {
          // New vote
          await db.insert(commentVotes).values({
            commentId: input.commentId,
            userId: ctx.user.id,
            voteType: voteValue,
          });
          
          // Update comment vote counts
          if (voteValue === 1) {
            await db.execute(`UPDATE regulation_comments SET upvotes = upvotes + 1 WHERE id = ${input.commentId}`);
          } else {
            await db.execute(`UPDATE regulation_comments SET downvotes = downvotes + 1 WHERE id = ${input.commentId}`);
          }
          
          return { success: true, action: 'added' };
        }
      }),

    // Get user's vote on a comment
    getUserVote: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const vote = await db.select()
          .from(commentVotes)
          .where(and(
            eq(commentVotes.commentId, input.commentId),
            eq(commentVotes.userId, ctx.user.id)
          ))
          .limit(1);
        
        return {
          hasVoted: vote.length > 0,
          voteType: vote.length > 0 ? (vote[0].voteType === 1 ? 'up' : 'down') : null,
        };
      }),

    // Get user's votes for multiple comments at once
    getUserVotes: protectedProcedure
      .input(z.object({ commentIds: z.array(z.number()) }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        if (input.commentIds.length === 0) return { votes: {} };
        
        const votes = await db.select()
          .from(commentVotes)
          .where(eq(commentVotes.userId, ctx.user.id));
        
        const voteMap: Record<number, 'up' | 'down'> = {};
        votes.forEach(v => {
          if (input.commentIds.includes(v.commentId)) {
            voteMap[v.commentId] = v.voteType === 1 ? 'up' : 'down';
          }
        });
        
        return { votes: voteMap };
      }),

    // Flag a comment for admin review
    flagComment: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        await db.execute(`UPDATE regulation_comments SET isFlagged = 1 WHERE id = ${input.commentId}`);
        return { success: true };
      }),

    // Admin: Get flagged comments
    getFlaggedComments: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Check if user is admin
        if (ctx.user.role !== 'admin') {
          return { success: false, error: 'Admin access required', data: [] };
        }
        
        const flagged = await db.select({
          id: regulationComments.id,
          content: regulationComments.content,
          createdAt: regulationComments.createdAt,
          userId: regulationComments.userId,
          userName: users.name,
          city: regulationComments.city,
          state: regulationComments.state,
          upvotes: regulationComments.upvotes,
          downvotes: regulationComments.downvotes,
        })
          .from(regulationComments)
          .leftJoin(users, eq(regulationComments.userId, users.id))
          .where(eq(regulationComments.isFlagged, 1))
          .orderBy(desc(regulationComments.createdAt));
        
        return { success: true, data: flagged };
      }),

    // Admin: Approve a flagged comment (unflag)
    approveComment: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        if (ctx.user.role !== 'admin') {
          return { success: false, error: 'Admin access required' };
        }
        
        await db.execute(`UPDATE regulation_comments SET isFlagged = 0 WHERE id = ${input.commentId}`);
        return { success: true };
      }),

    // Admin: Remove a comment (hide it)
    adminDeleteComment: protectedProcedure
      .input(z.object({ commentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        if (ctx.user.role !== 'admin') {
          return { success: false, error: 'Admin access required' };
        }
        
        await db.execute(`UPDATE regulation_comments SET isApproved = 0, isFlagged = 0 WHERE id = ${input.commentId}`);
        return { success: true };
      }),

    // Create a shareable regulation report link
    createShareableReport: publicProcedure
      .input(z.object({
        city: z.string().min(1),
        state: z.string().min(1),
        status: z.string(),
        summary: z.string().optional(),
        permitRequired: z.boolean().default(false),
        primaryResidenceOnly: z.boolean().default(false),
        maxNightsPerYear: z.number().optional(),
        registrationFee: z.string().optional(),
        occupancyTax: z.string().optional(),
        confidence: z.string().optional(),
        fullRegulationData: z.any().optional(),
        keyRequirements: z.array(z.any()).optional(),
        sources: z.array(z.any()).optional(),
        creatorEmail: z.string().email().optional(),
        creatorPhone: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Generate a unique share code
        const shareCode = generateShareCode();
        const locationKey = `${input.city.toLowerCase()}-${input.state.toLowerCase()}`;
        
        const [result] = await db.insert(shareableRegulationReports).values({
          shareCode,
          city: input.city,
          state: input.state,
          locationKey,
          status: input.status,
          summary: input.summary,
          permitRequired: input.permitRequired ? 1 : 0,
          primaryResidenceOnly: input.primaryResidenceOnly ? 1 : 0,
          maxNightsPerYear: input.maxNightsPerYear,
          registrationFee: input.registrationFee,
          occupancyTax: input.occupancyTax,
          confidence: input.confidence,
          fullRegulationData: input.fullRegulationData,
          keyRequirements: input.keyRequirements,
          sources: input.sources,
          creatorEmail: input.creatorEmail,
          creatorPhone: input.creatorPhone,
        });
        
        return {
          success: true,
          shareCode,
          shareUrl: `/report/${shareCode}`,
          reportId: result.insertId,
        };
      }),

    // Get a shareable report by share code
    getShareableReport: publicProcedure
      .input(z.object({ shareCode: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const [report] = await db.select()
          .from(shareableRegulationReports)
          .where(eq(shareableRegulationReports.shareCode, input.shareCode))
          .limit(1);
        
        if (!report) {
          return { success: false, error: 'Report not found', data: null };
        }
        
        // Increment view count
        await db.execute(`UPDATE shareable_regulation_reports SET viewCount = viewCount + 1, lastViewedAt = NOW() WHERE id = ${report.id}`);
        
        return {
          success: true,
          data: {
            ...report,
            permitRequired: report.permitRequired === 1,
            primaryResidenceOnly: report.primaryResidenceOnly === 1,
          },
        };
      }),

    // Send shareable report via SMS
    sendReportSMS: publicProcedure
      .input(z.object({
        shareCode: z.string(),
        phoneNumber: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Get the report
        const [report] = await db.select()
          .from(shareableRegulationReports)
          .where(eq(shareableRegulationReports.shareCode, input.shareCode))
          .limit(1);
        
        if (!report) {
          return { success: false, error: 'Report not found' };
        }
        
        // Send SMS via SimpleTexting
        const smsResult = await sendSMSNotification(
          input.phoneNumber,
          `Your STR Regulation Report for ${report.city}, ${report.state} is ready! Status: ${report.status}. View full report: ${process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com'}/report/${input.shareCode}`
        );
        
        if (smsResult.success) {
          // Update the report with SMS sent info
          await db.execute(`UPDATE shareable_regulation_reports SET smsSentTo = '${input.phoneNumber}', smsSentAt = NOW() WHERE id = ${report.id}`);
        }
        
        return smsResult;
      }),

    // Auto-create shareable report and send notifications (for auto-notification flow)
    autoCreateAndNotify: publicProcedure
      .input(z.object({
        city: z.string().min(1),
        state: z.string().min(1),
        status: z.string(),
        summary: z.string().optional(),
        permitRequired: z.boolean().default(false),
        primaryResidenceOnly: z.boolean().default(false),
        maxNightsPerYear: z.number().optional(),
        registrationFee: z.string().optional(),
        occupancyTax: z.string().optional(),
        confidence: z.string().optional(),
        fullRegulationData: z.any().optional(),
        keyRequirements: z.array(z.any()).optional(),
        sources: z.array(z.any()).optional(),
        // Contact info for auto-notification
        userEmail: z.string().email().optional(),
        userPhone: z.string().optional(),
        userName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Only proceed if at least one contact method provided
        if (!input.userEmail && !input.userPhone) {
          return {
            success: false,
            error: 'No contact information provided for notification',
            shareCode: null,
            notificationsSent: { sms: false, email: false },
          };
        }
        
        // Generate a unique share code
        const shareCode = generateShareCode();
        const locationKey = `${input.city.toLowerCase()}-${input.state.toLowerCase()}`;
        
        // Create the shareable report
        const [result] = await db.insert(shareableRegulationReports).values({
          shareCode,
          city: input.city,
          state: input.state,
          locationKey,
          status: input.status,
          summary: input.summary,
          permitRequired: input.permitRequired ? 1 : 0,
          primaryResidenceOnly: input.primaryResidenceOnly ? 1 : 0,
          maxNightsPerYear: input.maxNightsPerYear,
          registrationFee: input.registrationFee,
          occupancyTax: input.occupancyTax,
          confidence: input.confidence,
          fullRegulationData: input.fullRegulationData,
          keyRequirements: input.keyRequirements,
          sources: input.sources,
          creatorEmail: input.userEmail,
          creatorPhone: input.userPhone,
        });
        
        // Send notifications using the helper function
        const { sendReportNotifications } = await import('./sms-email-notifications');
        const notificationResults = await sendReportNotifications(
          {
            city: input.city,
            state: input.state,
            status: input.status,
            shareCode,
          },
          {
            phone: input.userPhone,
            email: input.userEmail,
            name: input.userName,
          }
        );
        
        // Update the report with notification status
        if (notificationResults.sms?.success && input.userPhone) {
          await db.execute(`UPDATE shareable_regulation_reports SET smsSentTo = '${input.userPhone}', smsSentAt = NOW() WHERE id = ${result.insertId}`);
        }
        if (notificationResults.email?.success && input.userEmail) {
          await db.execute(`UPDATE shareable_regulation_reports SET emailSentTo = '${input.userEmail}', emailSentAt = NOW() WHERE id = ${result.insertId}`);
        }
        
        console.log(`[AutoNotify] Created report ${shareCode} for ${input.city}, ${input.state}. SMS: ${notificationResults.sms?.success || false}, Email: ${notificationResults.email?.success || false}`);
        
        return {
          success: true,
          shareCode,
          shareUrl: `/report/${shareCode}`,
          reportId: result.insertId,
          notificationsSent: {
            sms: notificationResults.sms?.success || false,
            email: notificationResults.email?.success || false,
          },
        };
      }),

    // Send shareable report via Email
    sendReportEmail: publicProcedure
      .input(z.object({
        shareCode: z.string(),
        email: z.string().email(),
        recipientName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Get the report
        const [report] = await db.select()
          .from(shareableRegulationReports)
          .where(eq(shareableRegulationReports.shareCode, input.shareCode))
          .limit(1);
        
        if (!report) {
          return { success: false, error: 'Report not found' };
        }
        
        // Send email via notification service
        const emailResult = await sendEmailNotification(
          input.email,
          `STR Regulation Report: ${report.city}, ${report.state}`,
          `Your STR Regulation Report is ready!\n\nLocation: ${report.city}, ${report.state}\nStatus: ${report.status}\n\nView full report: ${process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com'}/report/${input.shareCode}`,
          input.recipientName
        );
        
        if (emailResult.success) {
          // Update the report with email sent info
          await db.execute(`UPDATE shareable_regulation_reports SET emailSentTo = '${input.email}', emailSentAt = NOW() WHERE id = ${report.id}`);
        }
        
        return emailResult;
      }),
  }),

  // Admin portal for user activity tracking
  admin: adminRouter,

  // Comp Data and Historical Charts for Coach Inayah parity
  compData: router({
    getListings: publicProcedure
      .input(z.object({
        submarketId: z.string(),
        isMarketLevel: z.boolean().default(false), // true = city/metro level, false = neighborhood level
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
        orderBy: z.enum(['revenue', 'adr', 'occupancy', 'rating']).default('revenue'),
        orderDirection: z.enum(['asc', 'desc']).default('desc'),
        bedrooms: z.number().int().min(1).max(20).optional(), // Filter by specific bedroom count
      }))
      .query(async ({ input }) => {
        try {
          const offset = (input.page - 1) * input.pageSize;
          
          // Build filters object if bedrooms is specified
          const filters = input.bedrooms ? { bedrooms: input.bedrooms } : undefined;
          console.log(`[CompData.getListings] Input:`, { submarketId: input.submarketId, isMarketLevel: input.isMarketLevel, page: input.page, bedrooms: input.bedrooms, filters });
          console.log(`[CompData.getListings] Calling ${input.isMarketLevel ? 'getMarketListings' : 'getSubmarketListings'} with filters:`, JSON.stringify(filters));
          
          // Use the appropriate function based on whether it's a market or submarket search
          const result = input.isMarketLevel 
            ? await getMarketListings(input.submarketId, {
                limit: input.pageSize,
                offset,
                orderBy: input.orderBy,
                orderDirection: input.orderDirection,
                filters,
              })
            : await getSubmarketListings(input.submarketId, {
                limit: input.pageSize,
                offset,
                orderBy: input.orderBy,
                orderDirection: input.orderDirection,
                filters,
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

    // Get ALL listings for a market/submarket (with pagination to bypass 25 limit)
    getAllListings: publicProcedure
      .input(z.object({
        submarketId: z.string(),
        isMarketLevel: z.boolean().default(false),
        maxListings: z.number().int().min(25).max(500).default(200),
        bedrooms: z.number().int().min(1).max(20).optional(),
      }))
      .query(async ({ input }) => {
        try {
          console.log(`\n========================================`);
          console.log(`[CompData.getAllListings] REQUEST RECEIVED`);
          console.log(`  - submarketId: ${input.submarketId}`);
          console.log(`  - isMarketLevel: ${input.isMarketLevel}`);
          console.log(`  - maxListings: ${input.maxListings}`);
          console.log(`  - bedrooms: ${input.bedrooms || 'all'}`);
          console.log(`========================================`);
          
          // Use the appropriate function based on whether it's a market or submarket search
          const allListingsResult = input.isMarketLevel 
            ? await getAllMarketListings(input.submarketId, {
                bedrooms: input.bedrooms,
                maxListings: input.maxListings,
                minFilteredCount: 10,
              })
            : await getAllSubmarketListings(input.submarketId, {
                bedrooms: input.bedrooms,
                maxListings: input.maxListings,
                minFilteredCount: 10,
              });
          
          // Handle both old array format and new { listings, total_count } format
          const allListings = Array.isArray(allListingsResult) ? allListingsResult : allListingsResult.listings;
          const marketTotalCount = Array.isArray(allListingsResult) ? allListings.length : (allListingsResult.total_count || allListings.length);

          console.log(`[CompData.getAllListings] Fetched ${allListings.length} listings (market total: ${marketTotalCount})`);
          if (allListings.length > 0) {
            console.log(`[CompData.getAllListings] First listing title: "${allListings[0].title}"`);
            console.log(`[CompData.getAllListings] First listing lat/lng: ${allListings[0].latitude}, ${allListings[0].longitude}`);
          }

          // Transform listings to match frontend interface
          const listings = allListings.map((listing: any) => ({
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
            latitude: listing.latitude || listing.location?.lat || null,
            longitude: listing.longitude || listing.location?.lng || null,
            exact_location: listing.exact_location || false,
          }));

          return {
            success: true,
            listings,
            totalCount: listings.length,
            marketTotalCount, // The actual total count in the market (not just sampled)
          };
        } catch (error) {
          console.error('[CompData.getAllListings] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch all listings',
            listings: [],
            totalCount: 0,
            marketTotalCount: 0,
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
          const transformData = (dataPoints: any[], multiplier: number = 1) => 
            (dataPoints || []).map((d: any) => ({
              month: d.month || d.date || '',
              value: (d.value || d.avg || 0) * multiplier,
            }));

          return {
            success: true,
            data: {
              occupancy: transformData(result.occupancy),
              // API returns monthly avg_revenue, multiply by 12 to get annual income
              revenue: transformData(result.revenue, 12),
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

    // Get listings by zip code - auto-finds market/submarket and fetches listings
    getListingsByZipcode: publicProcedure
      .input(z.object({
        zipcode: z.string().length(5),
        pageSize: z.number().int().min(1).max(100).default(50),
      }))
      .query(async ({ input }) => {
        try {
          console.log(`[CompData.getListingsByZipcode] Looking up zip code: ${input.zipcode}`);
          
          // First, geocode the zip code to find the market/submarket
          const geoResult = await geocodeZipCodeToMarket(input.zipcode);
          
          if (!geoResult.success) {
            console.log(`[CompData.getListingsByZipcode] Geocode failed:`, geoResult.error);
            return {
              success: false,
              error: geoResult.error || 'Could not find market for this zip code',
              listings: [],
              totalCount: 0,
              market: null,
              submarket: null,
            };
          }
          
          // Get the market ID to fetch listings from
          let marketId: string | null = null;
          if (geoResult.submarket) {
            marketId = geoResult.submarket.id;
          } else if (geoResult.market) {
            marketId = geoResult.market.id;
          }
          
          if (!marketId) {
            return {
              success: false,
              error: 'No market found for this zip code',
              listings: [],
              totalCount: 0,
              market: geoResult.market || null,
              submarket: geoResult.submarket || null,
            };
          }
          
          console.log(`[CompData.getListingsByZipcode] Fetching ALL listings for market: ${marketId}`);
          
          // Fetch ALL listings for this market (with pagination to bypass 25 limit)
          const allListings = await getAllSubmarketListings(marketId, {
            maxListings: 200,
            minFilteredCount: 10,
          });
          
          const result = {
            listings: allListings,
            total_count: allListings.length,
          };
          
          if (!result) {
            return {
              success: false,
              error: 'Could not fetch listings',
              listings: [],
              totalCount: 0,
              market: geoResult.market || null,
              submarket: geoResult.submarket || null,
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
            latitude: listing.latitude || listing.location?.lat || null,
            longitude: listing.longitude || listing.location?.lng || null,
            exact_location: listing.exact_location || false,
          }));
          
          console.log(`[CompData.getListingsByZipcode] Found ${listings.length} listings for zip ${input.zipcode}`);
          
          return {
            success: true,
            listings,
            totalCount: result.total_count || listings.length,
            market: geoResult.market || null,
            submarket: geoResult.submarket || null,
            coordinates: geoResult.coordinates,
          };
        } catch (error) {
          console.error('[CompData.getListingsByZipcode] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch listings',
            listings: [],
            totalCount: 0,
            market: null,
            submarket: null,
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

  // Market comparison router
  marketComparison: router({
    // Compare multiple markets side-by-side
    compare: publicProcedure
      .input(z.object({
        marketIds: z.array(z.string()).min(2).max(5),
        bedrooms: z.number().int().min(0).max(10).optional(),
      }))
      .query(async ({ input }) => {
        try {
          console.log('[MarketComparison] Comparing markets:', input.marketIds);
          
          const result = await compareMarkets(input.marketIds, {
            bedrooms: input.bedrooms,
          });
          
          if (!result) {
            return {
              success: false,
              error: 'Could not compare markets',
              data: null,
            };
          }
          
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('[MarketComparison] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to compare markets',
            data: null,
          };
        }
      }),
  }),

  // US Market Discovery router
  marketDiscovery: router({
    // Get all markets in a country with filtering
    getCountryMarkets: publicProcedure
      .input(z.object({
        countryCode: z.string().default('us'),
        minMarketScore: z.number().min(0).max(100).optional(),
        minInvestability: z.number().min(0).max(100).optional(),
        minRentalDemand: z.number().min(0).max(100).optional(),
        minRevenueGrowth: z.number().optional(),
        marketType: z.enum(['coastal', 'urban_metro', 'mountains_lakes', 'suburban', 'rural', 'mid_size_city', 'all']).default('all'),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        try {
          console.log('[MarketDiscovery] Fetching markets for:', input.countryCode);
          
          const result = await getCountryMarkets(input.countryCode, {
            market_type: input.marketType === 'all' ? undefined : input.marketType as "coastal" | "urban_metro" | "mountains_lakes" | "suburban" | "rural" | "mid_size_city",
            min_market_score: input.minMarketScore,
            min_investability: input.minInvestability,
            min_rental_demand: input.minRentalDemand,
            min_revenue_growth: input.minRevenueGrowth,
            limit: input.limit,
            offset: input.offset,
          });
          
          return {
            success: true,
            data: result.markets,
            total: result.total_count,
          };
        } catch (error) {
          console.error('[MarketDiscovery] Error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch markets',
            data: [],
            total: 0,
          };
        }
      }),
  }),

  // Favorite Markets router
  favoriteMarkets: router({
    // List user's favorite markets
    list: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        const favorites = await db
          .select()
          .from(favoriteMarkets)
          .where(input.sessionId ? eq(favoriteMarkets.sessionId, input.sessionId) : undefined)
          .orderBy(desc(favoriteMarkets.createdAt));
        
        return favorites;
      }),

    // Add a market to favorites
    add: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        marketId: z.string(),
        marketName: z.string(),
        marketType: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        marketScore: z.number().optional(),
        listingCount: z.number().optional(),
        averageRevenue: z.number().optional(),
        averageOccupancy: z.number().optional(),
        averageAdr: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Check if already favorited
        const existing = await db
          .select()
          .from(favoriteMarkets)
          .where(
            and(
              eq(favoriteMarkets.marketId, input.marketId),
              input.sessionId ? eq(favoriteMarkets.sessionId, input.sessionId) : undefined
            )
          )
          .limit(1);
        
        if (existing.length > 0) {
          return { success: true, message: 'Already favorited', id: existing[0].id };
        }
        
        const result = await db.insert(favoriteMarkets).values({
          sessionId: input.sessionId,
          marketId: input.marketId,
          marketName: input.marketName,
          marketType: input.marketType,
          state: input.state,
          country: input.country,
          marketScore: input.marketScore?.toString(),
          listingCount: input.listingCount,
          averageRevenue: input.averageRevenue,
          averageOccupancy: input.averageOccupancy?.toString(),
          averageAdr: input.averageAdr,
        });
        
        return { success: true, id: Number((result as any).insertId) };
      }),

    // Remove a market from favorites
    remove: publicProcedure
      .input(z.object({
        id: z.number().optional(),
        marketId: z.string().optional(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        if (input.id) {
          await db.delete(favoriteMarkets).where(eq(favoriteMarkets.id, input.id));
        } else if (input.marketId && input.sessionId) {
          await db.delete(favoriteMarkets).where(
            and(
              eq(favoriteMarkets.marketId, input.marketId),
              eq(favoriteMarkets.sessionId, input.sessionId)
            )
          );
        }
        
        return { success: true };
      }),

    // Check if a market is favorited
    isFavorited: publicProcedure
      .input(z.object({
        marketId: z.string(),
        sessionId: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return false;
        
        const existing = await db
          .select()
          .from(favoriteMarkets)
          .where(
            and(
              eq(favoriteMarkets.marketId, input.marketId),
              input.sessionId ? eq(favoriteMarkets.sessionId, input.sessionId) : undefined
            )
          )
          .limit(1);
        
        return existing.length > 0;
      }),
  }),

  // Market Alerts router for email notifications
  marketAlerts: router({
    // List user's market alerts
    list: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        const alerts = await db
          .select()
          .from(marketAlerts)
          .where(input.sessionId ? eq(marketAlerts.sessionId, input.sessionId) : undefined)
          .orderBy(desc(marketAlerts.createdAt));
        
        return alerts;
      }),

    // Create a new market alert
    create: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        email: z.string().email(),
        marketId: z.string(),
        marketName: z.string(),
        alertType: z.enum(['revenue_change', 'occupancy_change', 'adr_change', 'all_changes']).default('all_changes'),
        thresholdPercent: z.number().min(1).max(100).default(10),
        baselineRevenue: z.number().optional(),
        baselineOccupancy: z.number().optional(),
        baselineAdr: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Check if alert already exists for this market/email
        const existing = await db
          .select()
          .from(marketAlerts)
          .where(
            and(
              eq(marketAlerts.marketId, input.marketId),
              eq(marketAlerts.email, input.email)
            )
          )
          .limit(1);
        
        if (existing.length > 0) {
          return { success: true, message: 'Alert already exists', id: existing[0].id };
        }
        
        const result = await db.insert(marketAlerts).values({
          sessionId: input.sessionId,
          email: input.email,
          marketId: input.marketId,
          marketName: input.marketName,
          alertType: input.alertType,
          thresholdPercent: input.thresholdPercent,
          baselineRevenue: input.baselineRevenue,
          baselineOccupancy: input.baselineOccupancy?.toString(),
          baselineAdr: input.baselineAdr,
        });
        
        return { success: true, id: Number((result as any).insertId) };
      }),

    // Update an existing alert
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        alertType: z.enum(['revenue_change', 'occupancy_change', 'adr_change', 'all_changes']).optional(),
        thresholdPercent: z.number().min(1).max(100).optional(),
        isActive: z.enum(['true', 'false']).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const updateData: any = {};
        if (input.alertType) updateData.alertType = input.alertType;
        if (input.thresholdPercent) updateData.thresholdPercent = input.thresholdPercent;
        if (input.isActive) updateData.isActive = input.isActive;
        
        await db.update(marketAlerts)
          .set(updateData)
          .where(eq(marketAlerts.id, input.id));
        
        return { success: true };
      }),

    // Delete an alert
    delete: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        await db.delete(marketAlerts).where(eq(marketAlerts.id, input.id));
        
        return { success: true };
      }),

    // Toggle alert active status
    toggle: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const existing = await db
          .select()
          .from(marketAlerts)
          .where(eq(marketAlerts.id, input.id))
          .limit(1);
        
        if (existing.length === 0) {
          throw new Error('Alert not found');
        }
        
        const newStatus = existing[0].isActive === 'true' ? 'false' : 'true';
        
        await db.update(marketAlerts)
          .set({ isActive: newStatus })
          .where(eq(marketAlerts.id, input.id));
        
        return { success: true, isActive: newStatus };
      }),
  }),

  // Shared Reports router for creating shareable links
  sharedReports: router({
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
                name: reportData.market_data.name || 'Local Market',
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
              stressTest: reportData.stress_test,
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
            return { success: false, error: 'Failed to fetch fresh data from AirDNA' };
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
              name: market.name || 'Local Market',
              listing_count: market.listing_count || market.metrics?.active_listings || 0,
              metrics: {
                occupancy: market.metrics?.occupancy || occRate,
                adr: market.metrics?.adr || adr,
                revenue: market.metrics?.revenue || annualRev,
                active_listings: market.metrics?.active_listings || market.listing_count || 0,
                market_score: market.metrics?.market_score,
              },
            } : existingData.market_data,
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
              stressTest: newReportData.stress_test,
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
            return { success: false as const, error: 'Failed to fetch data from AirDNA. Please check the address and try again.' };
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
              name: market.name || 'Local Market',
              listing_count: market.listing_count || market.metrics?.active_listings || 0,
              metrics: {
                occupancy: market.metrics?.occupancy || occRate,
                adr: market.metrics?.adr || adr,
                revenue: market.metrics?.revenue || annualRev,
                active_listings: market.metrics?.active_listings || market.listing_count || 0,
                market_score: market.metrics?.market_score,
              },
            } : undefined,
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
          
          const stressTestMatrix: Array<{ occupancy: number; adr: number; annual_revenue: number; monthly_revenue: number; monthly_profit: number; }> = [];
          for (const occ of occScenarios) {
            for (const testAdr of adrScenarios) {
              const testAnnualRev = Math.round(occ * testAdr * 365);
              const testMonthlyRev = Math.round(testAnnualRev / 12);
              // Use proportional expenses (scale with revenue)
              const testExpenses = Math.round(testMonthlyRev * (expensePercent / 100));
              stressTestMatrix.push({
                occupancy: Math.round(occ * 100),
                adr: testAdr,
                annual_revenue: testAnnualRev,
                monthly_revenue: testMonthlyRev,
                monthly_profit: testMonthlyRev - testExpenses,
              });
            }
          }
          
          reportData.stress_test = {
            base_occupancy: Math.round(baseOcc * 100),
            base_adr: baseAdr,
            scenarios: stressTestMatrix,
            occupancy_levels: occScenarios.map(o => Math.round(o * 100)),
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
              purchase_price: input.purchasePrice,
              down_payment: downPayment,
              down_payment_percent: downPct,
              loan_amount: loanAmount,
              interest_rate: rate,
              loan_type: input.loanType || 'conventional',
              monthly_mortgage: Math.round(monthlyMortgage),
              monthly_revenue: monthlyRev,
              monthly_expenses: totalMonthlyExpenses,
              monthly_cash_flow: monthlyRev - Math.round(monthlyMortgage) - totalMonthlyExpenses,
              annual_cash_flow: (monthlyRev - Math.round(monthlyMortgage) - totalMonthlyExpenses) * 12,
              cap_rate: (annualRev - totalMonthlyExpenses * 12) / input.purchasePrice * 100,
              cash_on_cash: ((monthlyRev - Math.round(monthlyMortgage) - totalMonthlyExpenses) * 12) / downPayment * 100,
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
              stressTest: reportData.stress_test,
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
  }),

  // Notifications router
  notifications: router({
    // Get all notifications for the current user
    getAll: publicProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(100).default(20),
        includeRead: z.boolean().default(true),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          return { notifications: [] };
        }
        
        const userId = ctx.user?.id;
        if (!userId) {
          return { notifications: [] };
        }
        
        try {
          const conditions = input.includeRead
            ? eq(notifications.userId, userId)
            : and(eq(notifications.userId, userId), eq(notifications.isRead, 0));
          
          const results = await db
            .select()
            .from(notifications)
            .where(conditions)
            .orderBy(desc(notifications.createdAt))
            .limit(input.limit);
          
          return { notifications: results };
        } catch (error) {
          console.error('[Notifications] Error fetching:', error);
          return { notifications: [] };
        }
      }),
    
    // Mark a notification as read
    markAsRead: publicProcedure
      .input(z.object({
        notificationId: z.number().int(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          return { success: false, error: 'Database not available' };
        }
        
        const userId = ctx.user?.id;
        if (!userId) {
          return { success: false, error: 'User not authenticated' };
        }
        
        try {
          await db
            .update(notifications)
            .set({
              isRead: 1,
              readAt: new Date(),
            })
            .where(and(
              eq(notifications.id, input.notificationId),
              eq(notifications.userId, userId)
            ));
          
          return { success: true };
        } catch (error) {
          console.error('[Notifications] Error marking as read:', error);
          return { success: false, error: 'Failed to mark notification as read' };
        }
      }),
    
    // Mark all notifications as read
    markAllAsRead: publicProcedure
      .mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
          return { success: false, error: 'Database not available' };
        }
        
        const userId = ctx.user?.id;
        if (!userId) {
          return { success: false, error: 'User not authenticated' };
        }
        
        try {
          await db
            .update(notifications)
            .set({
              isRead: 1,
              readAt: new Date(),
            })
            .where(and(
              eq(notifications.userId, userId),
              eq(notifications.isRead, 0)
            ));
          
          return { success: true };
        } catch (error) {
          console.error('[Notifications] Error marking all as read:', error);
          return { success: false, error: 'Failed to mark all notifications as read' };
        }
      }),
    
    // Clear all notifications
    clearAll: publicProcedure
      .mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
          return { success: false, error: 'Database not available' };
        }
        
        const userId = ctx.user?.id;
        if (!userId) {
          return { success: false, error: 'User not authenticated' };
        }
        
        try {
          await db
            .delete(notifications)
            .where(eq(notifications.userId, userId));
          
          return { success: true };
        } catch (error) {
          console.error('[Notifications] Error clearing all:', error);
          return { success: false, error: 'Failed to clear notifications' };
        }
      }),
    
    // Get unread count
    getUnreadCount: publicProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) {
          return { count: 0 };
        }
        
        const userId = ctx.user?.id;
        if (!userId) {
          return { count: 0 };
        }
        
        try {
          const results = await db
            .select()
            .from(notifications)
            .where(and(
              eq(notifications.userId, userId),
              eq(notifications.isRead, 0)
            ));
          
          return { count: results.length };
        } catch (error) {
          console.error('[Notifications] Error getting unread count:', error);
          return { count: 0 };
        }
      }),
  }),

  // Rentometer long-term rental data router
  rentometer: router({
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
  }),

  // Market Explorer router for Step 2 "See What's Working"
  marketExplorer: router({
    // Search for markets/submarkets by city or neighborhood name
    searchMarkets: publicProcedure
      .input(z.object({
        query: z.string().min(2),
        limit: z.number().optional().default(10),
      }))
      .query(async ({ input }) => {
        try {
          const results = await searchMarketsAPI(input.query);
          
          // Return top results with zip codes included
          return results.slice(0, input.limit).map(r => ({
            id: r.id,
            name: r.name,
            type: r.type,
            listingCount: r.listing_count,
            state: r.state,
            country: r.country,
            parentMarket: r.parent_market,
            zipcodes: r.zipcodes || [],
          }));
        } catch (error) {
          console.error('[marketExplorer.searchMarkets] Error:', error);
          return [];
        }
      }),

    // Get listings for a market with images
    getListings: publicProcedure
      .input(z.object({
        marketId: z.string(),
        marketType: z.enum(['market', 'submarket']).default('market'),
        bedrooms: z.number().optional(),
        propertyType: z.string().optional(),
        minRating: z.number().optional(),
        sortBy: z.enum(['revenue', 'occupancy', 'adr', 'rating']).optional().default('revenue'),
        limit: z.number().optional().default(100),
      }))
      .query(async ({ input }) => {
        try {
          console.log('[marketExplorer.getListings] Input:', JSON.stringify(input));
          
          // Build filters
          const filters: any = {};
          if (input.bedrooms !== undefined && input.bedrooms !== null) filters.bedrooms = input.bedrooms;
          if (input.propertyType) filters.propertyType = input.propertyType;
          if (input.minRating) filters.minRating = input.minRating;

          console.log('[marketExplorer.getListings] Calling API with marketId:', input.marketId, 'filters:', filters);
          
          // Fetch multiple pages to get more listings (AirDNA API max is 25 per page)
          const pageSize = 25;
          const targetCount = Math.min(input.limit || 100, 100);
          const pagesToFetch = Math.ceil(targetCount / pageSize);
          
          let allListings: any[] = [];
          let totalCount = 0;
          
          for (let page = 0; page < pagesToFetch; page++) {
            const offset = page * pageSize;
            console.log(`[marketExplorer.getListings] Fetching page ${page + 1}/${pagesToFetch} (offset: ${offset})`);
            
            const result = input.marketType === 'submarket'
              ? await getSubmarketListings(input.marketId, {
                  limit: pageSize,
                  offset,
                  orderBy: input.sortBy,
                  orderDirection: 'desc',
                  filters: Object.keys(filters).length > 0 ? filters : undefined,
                })
              : await getMarketListings(input.marketId, {
                  limit: pageSize,
                  offset,
                  orderBy: input.sortBy,
                  orderDirection: 'desc',
                  filters: Object.keys(filters).length > 0 ? filters : undefined,
                });
            
            if (result.listings && result.listings.length > 0) {
              allListings = [...allListings, ...result.listings];
              totalCount = result.total_count || totalCount;
            }
            
            // Stop if we've fetched all available listings
            if (result.listings.length < pageSize) break;
          }
          
          console.log(`[marketExplorer.getListings] Fetched ${allListings.length} total listings`);
          
          // Use the combined results
          const result = { listings: allListings, total_count: totalCount };

          // Calculate summary stats
          const listings = result.listings || [];
          const revenues = listings.map(l => l.annual_revenue).filter(r => r > 0);
          const occupancies = listings.map(l => l.occupancy).filter(o => o > 0);
          const adrs = listings.map(l => l.adr).filter(a => a > 0);
          
          const avgRevenue = revenues.length > 0 
            ? revenues.reduce((a, b) => a + b, 0) / revenues.length 
            : 0;
          const avgOccupancy = occupancies.length > 0 
            ? occupancies.reduce((a, b) => a + b, 0) / occupancies.length 
            : 0;
          const avgAdr = adrs.length > 0
            ? adrs.reduce((a, b) => a + b, 0) / adrs.length
            : 0;
          const topRevenue = revenues.length > 0 ? Math.max(...revenues) : 0;
          const topOccupancy = occupancies.length > 0 ? Math.max(...occupancies) : 0;

          return {
            listings: listings.map(l => ({
              id: l.id,
              title: l.title,
              imageUrl: l.image_url || null,
              images: l.images || [],
              airbnbUrl: l.airbnb_url || null,
              bedrooms: l.bedrooms,
              bathrooms: l.bathrooms,
              annualRevenue: l.annual_revenue,
              occupancyRate: l.occupancy,
              adr: l.adr,
              rating: l.rating,
              reviewCount: l.reviews,
              superhost: l.superhost,
              professionallyManaged: l.professionally_managed,
              zipcode: l.zipcode || null,
              daysAvailable: l.days_available || null,
              daysReserved: l.days_reserved || null,
              latitude: l.latitude || null,
              longitude: l.longitude || null,
            })),
            totalCount: result.total_count || listings.length,
            summary: {
              avgRevenue: Math.round(avgRevenue),
              avgOccupancy: Math.round(avgOccupancy * 100) / 100,
              avgAdr: Math.round(avgAdr),
              topRevenue: Math.round(topRevenue),
              topOccupancy: Math.round(topOccupancy * 100) / 100,
              topEarnerMultiple: avgRevenue > 0 ? Math.round((topRevenue / avgRevenue) * 10) / 10 : 0,
            },
          };
        } catch (error) {
          console.error('[marketExplorer.getListings] Error:', error);
          return {
            listings: [],
            totalCount: 0,
            summary: {
              avgRevenue: 0,
              avgOccupancy: 0,
              avgAdr: 0,
              topRevenue: 0,
              topOccupancy: 0,
              topEarnerMultiple: 0,
            },
          };
        }
      }),

    // Get neighborhoods (submarkets) for a market
    getNeighborhoods: publicProcedure
      .input(z.object({
        marketId: z.string(),
      }))
      .query(async ({ input }) => {
        try {
          const submarkets = await getSubmarketsInMarket(input.marketId);
          
          // Sort by revenue descending
          const sorted = submarkets.sort((a, b) => 
            (b.metrics?.revenue || 0) - (a.metrics?.revenue || 0)
          );

          return sorted.map(s => ({
            id: s.id,
            name: s.name,
            listingCount: s.listing_count,
            avgRevenue: s.metrics?.revenue || 0,
            avgOccupancy: s.metrics?.occupancy || 0,
            avgAdr: s.metrics?.adr || 0,
            marketScore: s.metrics?.market_score || 0,
          }));
        } catch (error) {
          console.error('[marketExplorer.getNeighborhoods] Error:', error);
          return [];
        }
      }),
  }),

  // Zillow URL property lookup
  zillow: router({
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
  }),

  // Redfin URL property lookup
  redfin: router({
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
  }),

  // HubSpot/Zapier Webhook Integration for Usage Tracking
  webhook: router({
    // Track tool usage events - sends data to Zapier webhook for HubSpot sync
    trackUsage: publicProcedure
      .input(z.object({
        // Event type
        event: z.enum([
          'revenue_calculated',
          'market_researched', 
          'regulation_checked',
          'property_analyzed',
          'comps_searched',
          'ai_advisor_used',
          'report_generated',
          'report_shared',
          'property_saved',
          'market_saved',
        ]),
        // Contact info (from HubSpot personalized link or form)
        email: z.string().email().optional(),
        hubspotContactId: z.string().optional(),
        // Location data
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        address: z.string().optional(),
        // Tool-specific data
        toolData: z.object({
          // Revenue calculator
          estimatedRevenue: z.number().optional(),
          occupancyRate: z.number().optional(),
          averageDailyRate: z.number().optional(),
          // Market research
          marketName: z.string().optional(),
          marketScore: z.number().optional(),
          totalListings: z.number().optional(),
          // Property analysis
          bedrooms: z.number().optional(),
          bathrooms: z.number().optional(),
          monthlyRent: z.number().optional(),
          estimatedProfit: z.number().optional(),
          // Regulation tracker
          regulationStatus: z.string().optional(),
          permitRequired: z.boolean().optional(),
        }).optional(),
        // Personalized link generation
        generatePersonalizedLinks: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const timestamp = new Date().toISOString();
          
          // Build personalized links for all tools based on location
          let personalizedLinks: Record<string, string> | null = null;
          if (input.generatePersonalizedLinks && (input.city || input.zipCode)) {
            const baseUrl = process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com';
            const locationParams = new URLSearchParams();
            if (input.city) locationParams.set('city', input.city);
            if (input.state) locationParams.set('state', input.state);
            if (input.zipCode) locationParams.set('zip', input.zipCode);
            const locationQuery = locationParams.toString();
            
            personalizedLinks = {
              revenueCalculator: `${baseUrl}/?tab=prove&${locationQuery}&autoAnalyze=true`,
              marketAdvisor: `${baseUrl}/?tab=market&${locationQuery}&autoAnalyze=true`,
              regulationTracker: `${baseUrl}/?tab=regulations&${locationQuery}`,
              propertyAnalyzer: `${baseUrl}/?tab=validate&${locationQuery}`,
              compsExplorer: `${baseUrl}/?tab=explore&${locationQuery}&autoAnalyze=true`,
              aiAdvisor: `${baseUrl}/?tab=advisor&${locationQuery}`,
              opportunityFinder: `${baseUrl}/?tab=opportunity&${locationQuery}`,
            };
          }
          
          // Prepare webhook payload for Zapier
          const webhookPayload = {
            event: input.event,
            timestamp,
            contact: {
              email: input.email,
              hubspotContactId: input.hubspotContactId,
            },
            location: {
              city: input.city,
              state: input.state,
              zipCode: input.zipCode,
              address: input.address,
            },
            toolData: input.toolData,
            personalizedLinks,
            // HubSpot custom properties to update
            hubspotProperties: {
              tool_last_used: timestamp,
              last_tool_event: input.event,
              last_searched_city: input.city,
              last_searched_state: input.state,
              last_revenue_estimate: input.toolData?.estimatedRevenue,
              last_market_score: input.toolData?.marketScore,
              personalized_tool_link: personalizedLinks?.revenueCalculator,
            },
          };
          
          console.log('[Webhook] Tool usage tracked:', input.event, input.city, input.state);
          
          // Return the payload - Zapier webhook URL will be called from frontend
          // This allows the webhook URL to be configured in Zapier without exposing it in code
          return {
            success: true,
            data: webhookPayload,
          };
        } catch (error) {
          console.error('[Webhook] Error tracking usage:', error);
          return {
            success: false,
            error: 'Failed to track usage',
          };
        }
      }),

    // Generate personalized links for a contact
    generateLinks: publicProcedure
      .input(z.object({
        city: z.string(),
        state: z.string(),
        zipCode: z.string().optional(),
        address: z.string().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
      }))
      .query(({ input }) => {
        const baseUrl = process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com';
        const params = new URLSearchParams();
        params.set('city', input.city);
        params.set('state', input.state);
        if (input.zipCode) params.set('zip', input.zipCode);
        if (input.address) params.set('address', input.address);
        if (input.bedrooms) params.set('bedrooms', String(input.bedrooms));
        if (input.bathrooms) params.set('bathrooms', String(input.bathrooms));
        const query = params.toString();
        
        return {
          // All tool links with location pre-populated
          revenueCalculator: `${baseUrl}/?tab=prove&${query}&autoAnalyze=true`,
          marketAdvisor: `${baseUrl}/?tab=market&${query}&autoAnalyze=true`,
          regulationTracker: `${baseUrl}/?tab=regulations&${query}`,
          propertyAnalyzer: `${baseUrl}/?tab=validate&${query}`,
          compsExplorer: `${baseUrl}/?tab=explore&${query}&autoAnalyze=true`,
          aiAdvisor: `${baseUrl}/?tab=advisor&${query}`,
          opportunityFinder: `${baseUrl}/?tab=opportunity&${query}`,
          // Main tool link (most commonly used)
          mainTool: `${baseUrl}/?${query}`,
        };
      }),

    // Get daily property recommendations for a location (for automated emails)
    getDailyProperties: publicProcedure
      .input(z.object({
        city: z.string(),
        state: z.string(),
        zipCode: z.string().optional(),
        bedrooms: z.number().optional(),
        minRevenue: z.number().optional(),
        limit: z.number().int().min(1).max(10).default(5),
      }))
      .query(async ({ input }) => {
        try {
          // This would integrate with your existing property search
          // For now, return the structure that Zapier can use
          console.log('[Webhook] Daily properties request for:', input.city, input.state);
          
          return {
            success: true,
            location: {
              city: input.city,
              state: input.state,
              zipCode: input.zipCode,
            },
            // Placeholder - integrate with your existing getListingsInRadius or similar
            message: 'Use the comps explorer to find properties in this area',
            toolLink: `https://coachinayahturnkeytool.com/?tab=explore&city=${encodeURIComponent(input.city)}&state=${encodeURIComponent(input.state)}${input.zipCode ? `&zip=${input.zipCode}` : ''}&autoAnalyze=true`,
          };
        } catch (error) {
          console.error('[Webhook] Error getting daily properties:', error);
          return {
            success: false,
            error: 'Failed to get daily properties',
          };
        }
      }),
  }),

  // Email Opt-in Router for HubSpot integration
  emailOptin: router({
    // Submit email opt-in (public - anyone can opt in)
    submit: publicProcedure
      .input(z.object({
        email: z.string().email(),
        phone: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        wantsMarketUpdates: z.boolean().default(true),
        wantsRegulationAlerts: z.boolean().default(true),
        wantsSmsAlerts: z.boolean().default(false),
        source: z.string().optional(), // Which tool they opted in from
        utmSource: z.string().optional(),
        utmMedium: z.string().optional(),
        utmCampaign: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          
          // Check if email already exists
          const existing = await db.select().from(emailOptins).where(eq(emailOptins.email, input.email)).limit(1);
          
          if (existing.length > 0) {
            // Update existing opt-in
            await db.update(emailOptins)
              .set({
                phone: input.phone || existing[0].phone,
                firstName: input.firstName || existing[0].firstName,
                lastName: input.lastName || existing[0].lastName,
                city: input.city || existing[0].city,
                state: input.state || existing[0].state,
                zipCode: input.zipCode || existing[0].zipCode,
                wantsMarketUpdates: input.wantsMarketUpdates ? 1 : 0,
                wantsRegulationAlerts: input.wantsRegulationAlerts ? 1 : 0,
                wantsSmsAlerts: input.wantsSmsAlerts ? 1 : 0,
                isActive: 1,
                unsubscribedAt: null,
              })
              .where(eq(emailOptins.id, existing[0].id));
            
            return {
              success: true,
              message: 'Preferences updated',
              isNew: false,
              optinId: existing[0].id,
            };
          }
          
          // Create new opt-in
          const result = await db.insert(emailOptins).values({
            email: input.email,
            phone: input.phone,
            firstName: input.firstName,
            lastName: input.lastName,
            city: input.city,
            state: input.state,
            zipCode: input.zipCode,
            wantsMarketUpdates: input.wantsMarketUpdates ? 1 : 0,
            wantsRegulationAlerts: input.wantsRegulationAlerts ? 1 : 0,
            wantsSmsAlerts: input.wantsSmsAlerts ? 1 : 0,
            source: input.source,
            utmSource: input.utmSource,
            utmMedium: input.utmMedium,
            utmCampaign: input.utmCampaign,
          });
          
          console.log('[EmailOptin] New opt-in:', input.email, input.city, input.state);
          
          return {
            success: true,
            message: 'Successfully subscribed',
            isNew: true,
            optinId: result[0].insertId,
          };
        } catch (error) {
          console.error('[EmailOptin] Error:', error);
          return {
            success: false,
            error: 'Failed to save opt-in',
          };
        }
      }),
    
    // Unsubscribe
    unsubscribe: publicProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        try {
           const db = await getDb();
          if (!db) throw new Error('Database not available');
          await db.update(emailOptins)
            .set({
              isActive: 0,
              unsubscribedAt: new Date(),
            })
            .where(eq(emailOptins.email, input.email));
          
          return { success: true };
        } catch (error) {
          console.error('[EmailOptin] Unsubscribe error:', error);
          return { success: false };
        }
      }),
    
    // Get all opt-ins (admin only)
    list: protectedProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        activeOnly: z.boolean().default(true),
      }))
      .query(async ({ input, ctx }) => {
        // Check admin role
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        let results;
        if (input.activeOnly) {
          results = await db.select().from(emailOptins).where(eq(emailOptins.isActive, 1)).orderBy(desc(emailOptins.createdAt)).limit(input.limit).offset(input.offset);
        } else {
          results = await db.select().from(emailOptins).orderBy(desc(emailOptins.createdAt)).limit(input.limit).offset(input.offset);
        }
        
        return results;
      }),
  }),

  // Admin Tracking Router for links and promotions
  adminTracking: router({
    // Create a personalized link
    createLink: protectedProcedure
      .input(z.object({
        email: z.string().email().optional(),
        hubspotContactId: z.string().optional(),
        targetCity: z.string(),
        targetState: z.string(),
        targetZip: z.string().optional(),
        targetTab: z.string().default('prove'),
        campaignName: z.string().optional(),
        campaignType: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const baseUrl = process.env.VITE_APP_URL || 'https://coachinayahturnkeytool.com';
        
        // Build the personalized link URL
        const params = new URLSearchParams();
        params.set('tab', input.targetTab);
        params.set('city', input.targetCity);
        params.set('state', input.targetState);
        if (input.targetZip) params.set('zip', input.targetZip);
        params.set('autoAnalyze', 'true');
        
        const linkUrl = `${baseUrl}/?${params.toString()}`;
        
        // Generate a short code for tracking
        const shortCode = Math.random().toString(36).substring(2, 10);
        
        const result = await db.insert(personalizedLinks).values({
          email: input.email,
          hubspotContactId: input.hubspotContactId,
          linkUrl,
          shortCode,
          targetCity: input.targetCity,
          targetState: input.targetState,
          targetZip: input.targetZip,
          targetTab: input.targetTab,
          campaignName: input.campaignName,
          campaignType: input.campaignType,
        });
        
        return {
          success: true,
          linkId: result[0].insertId,
          linkUrl,
          shortCode,
        };
      }),
    
    // Track a link click
    trackClick: publicProcedure
      .input(z.object({
        linkId: z.number(),
        userIp: z.string().optional(),
        userAgent: z.string().optional(),
        referer: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          
          // Record the click
          await db.insert(linkClicks).values({
            linkId: input.linkId,
            userIp: input.userIp,
            userAgent: input.userAgent,
            referer: input.referer,
          });
          
          // Update click count on the link - fetch current then increment
          const currentLink = await db.select().from(personalizedLinks).where(eq(personalizedLinks.id, input.linkId)).limit(1);
          if (currentLink.length > 0) {
            await db.update(personalizedLinks)
              .set({
                clickCount: (currentLink[0].clickCount || 0) + 1,
                lastClickedAt: new Date(),
              })
              .where(eq(personalizedLinks.id, input.linkId));
          }
          
          return { success: true };
        } catch (error) {
          console.error('[AdminTracking] Track click error:', error);
          return { success: false };
        }
      }),
    
    // Get all personalized links (admin)
    getLinks: protectedProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        campaignName: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const results = await db.select().from(personalizedLinks).orderBy(desc(personalizedLinks.createdAt)).limit(input.limit).offset(input.offset);
        return results;
      }),
    
    // Get link analytics (admin)
    getLinkAnalytics: protectedProcedure
      .input(z.object({
        linkId: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const link = await db.select().from(personalizedLinks).where(eq(personalizedLinks.id, input.linkId)).limit(1);
        const clicks = await db.select().from(linkClicks).where(eq(linkClicks.linkId, input.linkId)).orderBy(desc(linkClicks.clickedAt));
        
        return {
          link: link[0],
          clicks,
          totalClicks: clicks.length,
        };
      }),
    
    // Create a promotion campaign (admin)
    createPromotion: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        type: z.enum(['email', 'sms', 'both']).default('email'),
        targetCity: z.string().optional(),
        targetState: z.string().optional(),
        targetSegment: z.string().optional(),
        emailSubject: z.string().optional(),
        emailPreviewText: z.string().optional(),
        smsMessage: z.string().optional(),
        linkTemplate: z.string().optional(),
        scheduledFor: z.string().optional(), // ISO date string
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const result = await db.insert(promotions).values({
          name: input.name,
          description: input.description,
          type: input.type,
          targetCity: input.targetCity,
          targetState: input.targetState,
          targetSegment: input.targetSegment,
          emailSubject: input.emailSubject,
          emailPreviewText: input.emailPreviewText,
          smsMessage: input.smsMessage,
          linkTemplate: input.linkTemplate,
          scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
          createdBy: ctx.user.id,
        });
        
        return {
          success: true,
          promotionId: result[0].insertId,
        };
      }),
    
    // Get all promotions (admin)
    getPromotions: protectedProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        status: z.enum(['draft', 'scheduled', 'sent', 'cancelled']).optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        let results;
        if (input.status) {
          results = await db.select().from(promotions).where(eq(promotions.status, input.status)).orderBy(desc(promotions.createdAt)).limit(input.limit).offset(input.offset);
        } else {
          results = await db.select().from(promotions).orderBy(desc(promotions.createdAt)).limit(input.limit).offset(input.offset);
        }
        return results;
      }),
    
    // Track tool usage event
    trackToolUsage: publicProcedure
      .input(z.object({
        email: z.string().email().optional(),
        sessionId: z.string().optional(),
        eventType: z.string(),
        toolName: z.string(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        address: z.string().optional(),
        revenueEstimate: z.number().optional(),
        regulationStatus: z.string().optional(),
        utmSource: z.string().optional(),
        utmMedium: z.string().optional(),
        utmCampaign: z.string().optional(),
        personalizedLinkId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          const result = await db.insert(toolUsageEvents).values({
            email: input.email,
            sessionId: input.sessionId,
            eventType: input.eventType,
            toolName: input.toolName,
            city: input.city,
            state: input.state,
            zipCode: input.zipCode,
            address: input.address,
            revenueEstimate: input.revenueEstimate,
            regulationStatus: input.regulationStatus,
            utmSource: input.utmSource,
            utmMedium: input.utmMedium,
            utmCampaign: input.utmCampaign,
            personalizedLinkId: input.personalizedLinkId,
          });
          
          console.log('[ToolUsage] Event tracked:', input.eventType, input.toolName, input.city);
          
          return {
            success: true,
            eventId: result[0].insertId,
          };
        } catch (error) {
          console.error('[ToolUsage] Error:', error);
          return { success: false };
        }
      }),
    
    // Get tool usage stats (admin)
    getToolUsageStats: protectedProcedure
      .input(z.object({
        days: z.number().default(30),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const results = await db.select().from(toolUsageEvents).orderBy(desc(toolUsageEvents.createdAt)).limit(500);
        
        // Aggregate stats
        const byTool: Record<string, number> = {};
        const byCity: Record<string, number> = {};
        const byEvent: Record<string, number> = {};
        
        for (const event of results) {
          byTool[event.toolName] = (byTool[event.toolName] || 0) + 1;
          if (event.city) {
            byCity[event.city] = (byCity[event.city] || 0) + 1;
          }
          byEvent[event.eventType] = (byEvent[event.eventType] || 0) + 1;
        }
        
        return {
          totalEvents: results.length,
          byTool,
          byCity,
          byEvent,
          recentEvents: results.slice(0, 20),
        };
      }),
    
    // Dashboard summary (admin)
    getDashboardSummary: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Get counts
        const optinsResult = await db.select().from(emailOptins).where(eq(emailOptins.isActive, 1));
        const linksResult = await db.select().from(personalizedLinks);
        const promotionsResult = await db.select().from(promotions);
        const eventsResult = await db.select().from(toolUsageEvents).limit(1000);
        
        // Calculate total clicks
        const totalClicks = linksResult.reduce((sum, link) => sum + (link.clickCount || 0), 0);
        
        return {
          totalOptins: optinsResult.length,
          totalLinks: linksResult.length,
          totalClicks,
          totalPromotions: promotionsResult.length,
          totalToolUsageEvents: eventsResult.length,
          recentOptins: optinsResult.slice(0, 5),
          recentLinks: linksResult.slice(0, 5),
        };
      }),
  }),

  // Bug Reports Router
  bugReports: router({
    // Create a new bug report
    create: publicProcedure
      .input(z.object({
        title: z.string().min(5, 'Title must be at least 5 characters'),
        description: z.string().optional(),
        stepsToReproduce: z.string().optional(),
        expectedBehavior: z.string().optional(),
        actualBehavior: z.string().optional(),
        toolName: z.string().optional(),
        pagePath: z.string().optional(),
        propertyAddress: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        marketId: z.string().optional(),
        browserInfo: z.string().optional(),
        screenSize: z.string().optional(),
        errorMessage: z.string().optional(),
        consoleErrors: z.string().optional(),
        screenshotUrl: z.string().optional(),
        reporterEmail: z.string().email().optional(),
        reporterName: z.string().optional(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error('Database not available');
          
          // Generate unique share code
          const shareCode = `BUG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          
          const result = await db.insert(bugReports).values({
            shareCode,
            title: input.title,
            description: input.description,
            stepsToReproduce: input.stepsToReproduce,
            expectedBehavior: input.expectedBehavior,
            actualBehavior: input.actualBehavior,
            toolName: input.toolName,
            pagePath: input.pagePath,
            propertyAddress: input.propertyAddress,
            city: input.city,
            state: input.state,
            marketId: input.marketId,
            browserInfo: input.browserInfo,
            screenSize: input.screenSize,
            errorMessage: input.errorMessage,
            consoleErrors: input.consoleErrors,
            screenshotUrl: input.screenshotUrl,
            reporterEmail: input.reporterEmail,
            reporterName: input.reporterName,
            sessionId: input.sessionId,
            userId: ctx.user?.id,
          });
          
          console.log('[BugReport] New report created:', shareCode, input.title);
          
          return {
            success: true,
            shareCode,
            bugId: result[0].insertId,
            shareUrl: `https://coachinayahturnkeytool.com/bug/${shareCode}`,
          };
        } catch (error) {
          console.error('[BugReport] Error creating report:', error);
          return {
            success: false,
            error: 'Failed to create bug report',
          };
        }
      }),
    
    // Get bug report by share code (public)
    getByShareCode: publicProcedure
      .input(z.object({
        shareCode: z.string(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const result = await db.select().from(bugReports).where(eq(bugReports.shareCode, input.shareCode)).limit(1);
        
        if (result.length === 0) {
          return null;
        }
        
        return result[0];
      }),
    
    // List all bug reports (admin only)
    list: protectedProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        status: z.enum(['new', 'investigating', 'in_progress', 'resolved', 'wont_fix', 'duplicate']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const results = await db.select().from(bugReports).orderBy(desc(bugReports.createdAt)).limit(input.limit).offset(input.offset);
        return results;
      }),
    
    // Update bug report status (admin only)
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['new', 'investigating', 'in_progress', 'resolved', 'wont_fix', 'duplicate']),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        resolution: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const updateData: Record<string, unknown> = {
          status: input.status,
        };
        
        if (input.priority) {
          updateData.priority = input.priority;
        }
        
        if (input.resolution) {
          updateData.resolution = input.resolution;
        }
        
        if (input.status === 'resolved') {
          updateData.resolvedAt = new Date();
        }
        
        await db.update(bugReports).set(updateData).where(eq(bugReports.id, input.id));
        
        return { success: true };
      }),
  }),

  // Universal Shareable Reports - Create shareable links for any tool
  shareableReports: router({
    // Create a shareable report for any tool type
    create: publicProcedure
      .input(z.object({
        reportType: z.enum(['revenue', 'validator', 'market', 'ai_advisor', 'listings', 'comparison', 'map', 'regulation']),
        // Property information
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        monthlyRent: z.number().optional(),
        // Market information
        marketId: z.string().optional(),
        marketName: z.string().optional(),
        // Report data
        reportData: z.any(),
        title: z.string().optional(),
        summary: z.string().optional(),
        // Key metrics
        annualRevenue: z.number().optional(),
        occupancyRate: z.number().optional(),
        averageDailyRate: z.number().optional(),
        profitMargin: z.number().optional(),
        verdict: z.string().optional(),
        // Creator info
        creatorEmail: z.string().optional(),
        creatorPhone: z.string().optional(),
        creatorName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await createShareableReport(input);
        return result;
      }),

    // Get a shareable report by share code
    get: publicProcedure
      .input(z.object({
        shareCode: z.string().min(1),
      }))
      .query(async ({ input }) => {
        const report = await getShareableReport(input.shareCode);
        if (!report) {
          return { success: false, error: 'Report not found' };
        }
        return { success: true, data: report };
      }),

    // Send notifications for an existing shareable report
    sendNotifications: publicProcedure
      .input(z.object({
        shareCode: z.string().min(1),
        reportType: z.enum(['revenue', 'validator', 'market', 'ai_advisor', 'listings', 'comparison', 'map', 'regulation']),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        name: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        address: z.string().optional(),
        title: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await sendShareableReportNotifications(
          input.shareCode,
          input.reportType as ShareableReportType,
          { phone: input.phone, email: input.email, name: input.name },
          { city: input.city, state: input.state, address: input.address, title: input.title }
        );
        return { success: true, notifications: result };
      }),

    // Create shareable report and send notifications in one call (for auto-notification)
    createAndNotify: publicProcedure
      .input(z.object({
        reportType: z.enum(['revenue', 'validator', 'market', 'ai_advisor', 'listings', 'comparison', 'map', 'regulation']),
        // Property information
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        bedrooms: z.number().optional(),
        bathrooms: z.number().optional(),
        monthlyRent: z.number().optional(),
        // Market information
        marketId: z.string().optional(),
        marketName: z.string().optional(),
        // Report data
        reportData: z.any(),
        title: z.string().optional(),
        summary: z.string().optional(),
        // Key metrics
        annualRevenue: z.number().optional(),
        occupancyRate: z.number().optional(),
        averageDailyRate: z.number().optional(),
        profitMargin: z.number().optional(),
        verdict: z.string().optional(),
        // Contact info for notification
        userEmail: z.string().email().optional(),
        userPhone: z.string().optional(),
        userName: z.string().optional(),
        // Options
        triggeredBy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await createAndNotifyShareableReport(
          {
            reportType: input.reportType as ShareableReportType,
            address: input.address,
            city: input.city,
            state: input.state,
            zipCode: input.zipCode,
            latitude: input.latitude,
            longitude: input.longitude,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            monthlyRent: input.monthlyRent,
            marketId: input.marketId,
            marketName: input.marketName,
            reportData: input.reportData,
            title: input.title,
            summary: input.summary,
            annualRevenue: input.annualRevenue,
            occupancyRate: input.occupancyRate,
            averageDailyRate: input.averageDailyRate,
            profitMargin: input.profitMargin,
            verdict: input.verdict,
            creatorEmail: input.userEmail,
            creatorPhone: input.userPhone,
            creatorName: input.userName,
          },
          {
            phone: input.userPhone,
            email: input.userEmail,
            name: input.userName,
          },
          {
            isAutoNotification: true,
            triggeredBy: input.triggeredBy || input.reportType,
          }
        );
        return result;
      }),

    // Get notification analytics (admin only)
    getAnalytics: protectedProcedure
      .input(z.object({
        reportType: z.enum(['regulation', 'revenue', 'validator', 'market', 'ai_advisor', 'listings', 'comparison', 'map']).optional(),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Admin access required');
        }
        const analytics = await getNotificationAnalytics({ reportType: input.reportType as any });
        return analytics;
      }),
  }),

  // AI Chat Router for contextual assistant (Powered by Gemini 2.0 Flash)
  ai: router({
    // Non-streaming chat endpoint (fallback)
    chat: publicProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(['system', 'user', 'assistant']),
          content: z.string(),
        })),
        systemPrompt: z.string().optional(),
        conversationId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { geminiChat } = await import('./gemini-streaming');
          
          const response = await geminiChat(
            input.messages.map(m => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
            })),
            input.systemPrompt
          );
          
          // Save to conversation if conversationId provided
          if (input.conversationId) {
            const db = await getDb();
            if (db) {
              const { aiMessages, aiConversations } = await import('../drizzle/schema');
              
              // Save user message
              const userMsg = input.messages.filter(m => m.role === 'user').pop();
              if (userMsg) {
                await db.insert(aiMessages).values({
                  conversationId: input.conversationId,
                  role: 'user',
                  content: userMsg.content,
                  isComplete: 1,
                });
              }
              
              // Save assistant response
              await db.insert(aiMessages).values({
                conversationId: input.conversationId,
                role: 'assistant',
                content: response,
                isComplete: 1,
              });
              
              // Update conversation
              await db.execute(
                sql`UPDATE ai_conversations SET messageCount = messageCount + 2, lastMessageAt = NOW() WHERE id = ${input.conversationId}`
              );
            }
          }
          
          return {
            content: response || 'I apologize, but I could not generate a response.',
            success: true,
          };
        } catch (error) {
          console.error('[AI Chat] Gemini Error:', error);
          return {
            content: 'I apologize, but I encountered an error. Please try again.',
            success: false,
          };
        }
      }),
    
    // Create a new conversation
    createConversation: publicProcedure
      .input(z.object({
        title: z.string().optional(),
        contextTool: z.string().optional(),
        contextAddress: z.string().optional(),
        contextMarket: z.string().optional(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const { aiConversations } = await import('../drizzle/schema');
        
        const result = await db.insert(aiConversations).values({
          userId: ctx.user?.id || null,
          sessionId: input.sessionId || null,
          title: input.title || 'New Conversation',
          contextTool: input.contextTool || null,
          contextAddress: input.contextAddress || null,
          contextMarket: input.contextMarket || null,
          messageCount: 0,
        });
        
        return {
          id: result[0].insertId,
          success: true,
        };
      }),
    
    // List conversations for a user/session
    listConversations: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        limit: z.number().default(20),
      }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { conversations: [] };
        
        const { aiConversations } = await import('../drizzle/schema');
        
        // Get conversations for this user or session
        let conversations: typeof aiConversations.$inferSelect[] = [];
        if (ctx.user?.id) {
          conversations = await db
            .select()
            .from(aiConversations)
            .where(eq(aiConversations.userId, ctx.user.id))
            .orderBy(desc(aiConversations.lastMessageAt))
            .limit(input.limit);
        } else if (input.sessionId) {
          conversations = await db
            .select()
            .from(aiConversations)
            .where(eq(aiConversations.sessionId, input.sessionId))
            .orderBy(desc(aiConversations.lastMessageAt))
            .limit(input.limit);
        } else {
          conversations = [];
        }
        
        return { conversations };
      }),
    
    // Get messages for a conversation
    getConversation: publicProcedure
      .input(z.object({
        conversationId: z.number(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { messages: [], conversation: null };
        
        const { aiConversations, aiMessages } = await import('../drizzle/schema');
        
        // Get conversation details
        const [conversation] = await db
          .select()
          .from(aiConversations)
          .where(eq(aiConversations.id, input.conversationId))
          .limit(1);
        
        if (!conversation) {
          return { messages: [], conversation: null };
        }
        
        // Get messages
        const messages = await db
          .select()
          .from(aiMessages)
          .where(eq(aiMessages.conversationId, input.conversationId))
          .orderBy(aiMessages.createdAt);
        
        return { messages, conversation };
      }),
    
    // Add a message to a conversation
    addMessage: publicProcedure
      .input(z.object({
        conversationId: z.number(),
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const { aiMessages, aiConversations } = await import('../drizzle/schema');
        
        // Insert message
        const result = await db.insert(aiMessages).values({
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          isComplete: 1,
        });
        
        // Update conversation
        await db.execute(
          sql`UPDATE ai_conversations SET messageCount = messageCount + 1, lastMessageAt = NOW() WHERE id = ${input.conversationId}`
        );
        
        // Auto-generate title from first user message if title is still default
        if (input.role === 'user') {
          const [conv] = await db
            .select()
            .from(aiConversations)
            .where(eq(aiConversations.id, input.conversationId))
            .limit(1);
          
          if (conv && (conv.title === 'New Conversation' || !conv.title)) {
            // Generate title from first ~50 chars of message
            const autoTitle = input.content.slice(0, 50) + (input.content.length > 50 ? '...' : '');
            await db
              .update(aiConversations)
              .set({ title: autoTitle })
              .where(eq(aiConversations.id, input.conversationId));
          }
        }
        
        return {
          id: result[0].insertId,
          success: true,
        };
      }),
    
    // Delete a conversation
    deleteConversation: publicProcedure
      .input(z.object({
        conversationId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        const { aiConversations, aiMessages } = await import('../drizzle/schema');
        
        // Verify ownership
        const [conversation] = await db
          .select()
          .from(aiConversations)
          .where(eq(aiConversations.id, input.conversationId))
          .limit(1);
        
        if (!conversation) {
          throw new Error('Conversation not found');
        }
        
        // Delete messages first
        await db
          .delete(aiMessages)
          .where(eq(aiMessages.conversationId, input.conversationId));
        
        // Delete conversation
        await db
          .delete(aiConversations)
          .where(eq(aiConversations.id, input.conversationId));
        
        return { success: true };
      }),
  }),

  // Deal Alert Agent router - automated deal scanning and notifications
  dealAlerts: router({
    // Create a new deal alert criteria
    create: publicProcedure
      .input(z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
        phone: z.string().optional(),
        sessionId: z.string().optional(),
        city: z.string(),
        state: z.string(),
        zipCode: z.string().optional(),
        marketId: z.string().optional(),
        marketName: z.string().optional(),
        analysisType: z.enum(['arbitrage', 'investment', 'both']).default('arbitrage'),
        minBedrooms: z.number().min(1).max(10).optional(),
        maxBedrooms: z.number().min(1).max(10).optional(),
        minBathrooms: z.number().optional(),
        maxRent: z.number().optional(),
        maxPurchasePrice: z.number().optional(),
        propertyTypes: z.array(z.string()).optional(),
        minMonthlyProfit: z.number().optional(),
        minProfitMargin: z.number().optional(),
        minDealScore: z.number().min(0).max(100).optional(),
        minOccupancy: z.number().optional(),
        notifyEmail: z.boolean().optional(),
        notifySms: z.boolean().optional(),
        notifyInApp: z.boolean().optional(),
        frequency: z.enum(['instant', 'daily', 'weekly']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { createDealAlertCriteria } = await import('./deal-alert-agent');
        return createDealAlertCriteria(input);
      }),

    // List user's deal alert criteria
    list: publicProcedure
      .input(z.object({
        email: z.string().optional(),
        sessionId: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { listDealAlertCriteria } = await import('./deal-alert-agent');
        return listDealAlertCriteria(input);
      }),

    // Get matches for a criteria
    getMatches: publicProcedure
      .input(z.object({
        criteriaId: z.number(),
        status: z.enum(['new', 'notified', 'viewed', 'saved', 'dismissed']).optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const { getDealAlertMatches } = await import('./deal-alert-agent');
        return getDealAlertMatches(input.criteriaId, { status: input.status, limit: input.limit });
      }),

    // Update match status
    updateMatchStatus: publicProcedure
      .input(z.object({
        matchId: z.number(),
        status: z.enum(['viewed', 'saved', 'dismissed']),
      }))
      .mutation(async ({ input }) => {
        const { updateMatchStatus } = await import('./deal-alert-agent');
        await updateMatchStatus(input.matchId, input.status);
        return { success: true };
      }),

    // Toggle criteria active/inactive
    toggle: publicProcedure
      .input(z.object({ criteriaId: z.number() }))
      .mutation(async ({ input }) => {
        const { toggleCriteriaActive } = await import('./deal-alert-agent');
        return toggleCriteriaActive(input.criteriaId);
      }),

    // Delete a criteria
    delete: publicProcedure
      .input(z.object({ criteriaId: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteDealAlertCriteria } = await import('./deal-alert-agent');
        await deleteDealAlertCriteria(input.criteriaId);
        return { success: true };
      }),

    // Manually trigger a scan for a criteria
    scan: publicProcedure
      .input(z.object({ criteriaId: z.number() }))
      .mutation(async ({ input }) => {
        const { scanForCriteria } = await import('./deal-alert-agent');
        return scanForCriteria(input.criteriaId);
      }),

    // Run the full scan job (admin)
    runScanJob: publicProcedure
      .mutation(async () => {
        const { runDealAlertScanJob } = await import('./deal-alert-agent');
        return runDealAlertScanJob();
      }),

    // Run a one-click market evaluation
    // Returns evaluationId immediately and runs the evaluation asynchronously
    evaluateMarket: publicProcedure
      .input(z.object({
        city: z.string(),
        state: z.string(),
        analysisType: z.enum(['arbitrage', 'investment', 'both']).optional(),
        bedrooms: z.number().optional(),
        sessionId: z.string().optional(),
        email: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { startMarketEvaluation } = await import('./deal-alert-agent');
        return startMarketEvaluation(input);
      }),

    // Get a market evaluation by ID
    getEvaluation: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const { marketEvaluations } = await import('../drizzle/schema');
        const [evaluation] = await db
          .select()
          .from(marketEvaluations)
          .where(eq(marketEvaluations.id, input.id))
          .limit(1);
        return evaluation || null;
      }),
  }),

  // ============================================================
  // Behavior-Adaptive Follow-Up Engine
  // ============================================================
  behaviorEngine: router({
    // Get a user's behavior profile
    getUserProfile: protectedProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        const { buildUserBehaviorProfile } = await import('./behavior-engine');
        return buildUserBehaviorProfile(input.email);
      }),

    // Preview what adaptive email would be sent to a user
    previewAdaptiveEmail: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        strategy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { buildUserBehaviorProfile, generateAdaptiveEmail, selectEmailStrategy } = await import('./behavior-engine');
        const profile = await buildUserBehaviorProfile(input.email);
        if (!profile) throw new Error('User not found');
        const strategy = (input.strategy || selectEmailStrategy(profile)) as any;
        const email = await generateAdaptiveEmail(profile, strategy);
        return { profile, email };
      }),

    // Get engagement analytics for the admin dashboard
    getEngagementAnalytics: protectedProcedure
      .query(async () => {
        const { getEngagementAnalytics } = await import('./behavior-engine');
        return getEngagementAnalytics();
      }),

    // Process adaptive follow-ups for a batch of users
    processFollowUps: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
      .mutation(async ({ input }) => {
        const { processAdaptiveFollowUps } = await import('./behavior-engine');
        return processAdaptiveFollowUps(input.limit);
      }),

    // Get strategy recommendation for a specific user
    getStrategy: protectedProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        const { buildUserBehaviorProfile, selectEmailStrategy } = await import('./behavior-engine');
        const profile = await buildUserBehaviorProfile(input.email);
        if (!profile) return null;
        const strategy = selectEmailStrategy(profile);
        return { profile, strategy };
      }),
  }),
});

export type AppRouter = typeof appRouter;

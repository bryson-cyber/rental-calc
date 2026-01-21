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
  getMarketListings,
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
          
          // Get subject property coordinates for distance calculation
          const subjectLat = baseReport.property.property?.latitude;
          const subjectLng = baseReport.property.property?.longitude;
          
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
            const competitorData = await getQualifyingCompetitors(marketId, bedrooms, input.monthlyRent);
            allCompetitors = competitorData.allSameBedroomListings;
            qualifyingCompetitors = competitorData.qualifyingListings;
            console.log(`[getAIPropertyReport] Found ${allCompetitors.length} same-bedroom listings, ${qualifyingCompetitors.length} meet threshold`);
            
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
          
          console.log(`[CompData.getListingsByZipcode] Fetching listings for market: ${marketId}`);
          
          // Fetch listings for this market
          const result = await getSubmarketListings(marketId, {
            limit: input.pageSize,
            offset: 0,
            orderBy: 'revenue',
            orderDirection: 'desc',
          });
          
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
});

export type AppRouter = typeof appRouter;

import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getUsageStatus } from "./usage-limits";

// External routers (already separate files)
import { marketResearchRouter } from "./market-research-v2";
import { opportunityFinderRouter } from "./opportunity-finder";
import { marketResearchSimpleRouter } from "./market-research-simple";
import { adminRouter } from "./admin-router";
import { newsletterRouter } from "./newsletter-router";

// Extracted routers (server/routers/)
import { rentalRouter } from "./routers/rental";
import { advancedRouter } from "./routers/advanced";
import { sharedReportsRouter } from "./routers/shared-reports";
import { regulationTrackerRouter } from "./routers/regulation-tracker";
import { savedSearchesRouter } from "./routers/saved-searches";
import { favoritesRouter } from "./routers/favorites";
import { favoriteListingsRouter } from "./routers/favorite-listings";
import { exportRouter } from "./routers/export";
import { deepAnalysisRouter } from "./routers/deep-analysis";
import { listingsByAreaRouter } from "./routers/listings-by-area";
import { compDataRouter } from "./routers/comp-data";
import { bulkSummaryRouter } from "./routers/bulk-summary";
import { marketComparisonRouter } from "./routers/market-comparison";
import { marketDiscoveryRouter } from "./routers/market-discovery";
import { favoriteMarketsRouter } from "./routers/favorite-markets";
import { marketAlertsRouter } from "./routers/market-alerts";
import { notificationsRouter } from "./routers/notifications";
import { rentometerRouter } from "./routers/rentometer";
import { marketExplorerRouter } from "./routers/market-explorer";
import { zillowRouter } from "./routers/zillow";
import { redfinRouter } from "./routers/redfin";
import { webhookRouter } from "./routers/webhook";
import { emailOptinRouter } from "./routers/email-optin";
import { adminTrackingRouter } from "./routers/admin-tracking";
import { bugReportsRouter } from "./routers/bug-reports";
import { shareableReportsRouter } from "./routers/shareable-reports";
import { aiRouter } from "./routers/ai";
import { dealAlertsRouter } from "./routers/deal-alerts";
import { behaviorEngineRouter } from "./routers/behavior-engine";

export const appRouter = router({
  system: systemRouter,
  newsletter: newsletterRouter,

  // Usage limits - get current user's remaining analyses
  usage: router({
    getStatus: publicProcedure.query(async ({ ctx }) => {
      const userId = ctx.user?.id;
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
      return { success: true } as const;
    }),
  }),

  // Core feature routers
  rental: rentalRouter,
  advanced: advancedRouter,

  // Saved & favorites
  savedSearches: savedSearchesRouter,
  favorites: favoritesRouter,
  favoriteListings: favoriteListingsRouter,
  favoriteMarkets: favoriteMarketsRouter,

  // Export & analysis
  export: exportRouter,
  deepAnalysis: deepAnalysisRouter,
  listingsByArea: listingsByAreaRouter,
  compData: compDataRouter,
  bulkSummary: bulkSummaryRouter,

  // Market research & discovery
  marketResearch: marketResearchRouter,
  marketResearchSimple: marketResearchSimpleRouter,
  marketComparison: marketComparisonRouter,
  marketDiscovery: marketDiscoveryRouter,
  marketExplorer: marketExplorerRouter,
  marketAlerts: marketAlertsRouter,

  // External data integrations
  rentometer: rentometerRouter,
  zillow: zillowRouter,
  redfin: redfinRouter,

  // Regulation & opportunity
  regulationTracker: regulationTrackerRouter,
  opportunityFinder: opportunityFinderRouter,

  // Sharing & reports
  sharedReports: sharedReportsRouter,
  shareableReports: shareableReportsRouter,
  notifications: notificationsRouter,

  // AI & automation
  ai: aiRouter,
  dealAlerts: dealAlertsRouter,
  behaviorEngine: behaviorEngineRouter,

  // Admin & tracking
  admin: adminRouter,
  adminTracking: adminTrackingRouter,
  webhook: webhookRouter,
  emailOptin: emailOptinRouter,
  bugReports: bugReportsRouter,
});

export type AppRouter = typeof appRouter;

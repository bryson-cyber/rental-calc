import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { getUsageStatus } from "./usage-limits";
import { getRateLimitStatus } from "./rate-limiter";

// External routers (already separate files before refactoring)
import { marketResearchRouter } from "./market-research-v2";
import { opportunityFinderRouter } from "./opportunity-finder";
import { marketResearchSimpleRouter } from "./market-research-simple";
import { adminRouter } from "./admin-router";
import { newsletterRouter } from "./newsletter-router";
import { slackAdminRouter } from "./slack-admin-router";

// All extracted feature routers (barrel import)
import {
  rentalRouter,
  advancedRouter,
  sharedReportsRouter,
  regulationTrackerRouter,
  savedSearchesRouter,
  favoritesRouter,
  favoriteListingsRouter,
  exportRouter,
  deepAnalysisRouter,
  listingsByAreaRouter,
  compDataRouter,
  bulkSummaryRouter,
  marketComparisonRouter,
  marketDiscoveryRouter,
  favoriteMarketsRouter,
  marketAlertsRouter,
  notificationsRouter,
  rentometerRouter,
  marketExplorerRouter,
  zillowRouter,
  redfinRouter,
  webhookRouter,
  emailOptinRouter,
  adminTrackingRouter,
  bugReportsRouter,
  shareableReportsRouter,
  aiRouter,
  dealAlertsRouter,
  behaviorEngineRouter,
  myReportsRouter,
  voiceBugReportRouter,
  translationRouter,
  contentStudioRouter,
  webinarSmsRouter,
} from "./routers/index";

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
    // Rate limit status for report generation (5/day per user)
    reportLimit: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) {
        return { limit: 5, used: 0, remaining: 5, resetAt: 0, isExempt: false, loggedIn: false };
      }
      const status = getRateLimitStatus(ctx.user.id, ctx.user.role);
      return { ...status, loggedIn: true };
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

  // Report mode preference (Pro / Guided)
  reportMode: router({
    get: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { mode: null as 'pro' | 'guided' | null };
      return { mode: (ctx.user as any).reportMode ?? null };
    }),
    set: protectedProcedure
      .input(z.object({ mode: z.enum(['pro', 'guided']) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
        await db.update(users).set({ reportMode: input.mode }).where(eq(users.id, ctx.user.id));
        return { success: true, mode: input.mode };
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

  // My Reports
  myReports: myReportsRouter,

  // Admin & tracking
  admin: adminRouter,
  slackAdmin: slackAdminRouter,
  adminTracking: adminTrackingRouter,
  webhook: webhookRouter,
  emailOptin: emailOptinRouter,
  bugReports: bugReportsRouter,
  voiceBugReport: voiceBugReportRouter,

  // Translation
  translation: translationRouter,
  // Content Studio
  contentStudio: contentStudioRouter,

  // Webinar SMS (isolated module)
  webinarSms: webinarSmsRouter,
});

export type AppRouter = typeof appRouter;

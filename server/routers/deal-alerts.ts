import { z } from "zod";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { eq } from "drizzle-orm";

export const dealAlertsRouter = router({
    // Create a new deal alert criteria
    create: adminProcedure
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
        const { createDealAlertCriteria } = await import('../deal-alert-agent');
        return createDealAlertCriteria(input);
      }),

    // List user's deal alert criteria
    list: adminProcedure
      .input(z.object({
        email: z.string().optional(),
        sessionId: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { listDealAlertCriteria } = await import('../deal-alert-agent');
        return listDealAlertCriteria(input);
      }),

    // Get matches for a criteria
    getMatches: adminProcedure
      .input(z.object({
        criteriaId: z.number(),
        status: z.enum(['new', 'notified', 'viewed', 'saved', 'dismissed']).optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const { getDealAlertMatches } = await import('../deal-alert-agent');
        return getDealAlertMatches(input.criteriaId, { status: input.status, limit: input.limit });
      }),

    // Update match status
    updateMatchStatus: adminProcedure
      .input(z.object({
        matchId: z.number(),
        status: z.enum(['viewed', 'saved', 'dismissed']),
      }))
      .mutation(async ({ input }) => {
        const { updateMatchStatus } = await import('../deal-alert-agent');
        await updateMatchStatus(input.matchId, input.status);
        return { success: true };
      }),

    // Toggle criteria active/inactive
    toggle: adminProcedure
      .input(z.object({ criteriaId: z.number() }))
      .mutation(async ({ input }) => {
        const { toggleCriteriaActive } = await import('../deal-alert-agent');
        return toggleCriteriaActive(input.criteriaId);
      }),

    // Delete a criteria
    delete: adminProcedure
      .input(z.object({ criteriaId: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteDealAlertCriteria } = await import('../deal-alert-agent');
        await deleteDealAlertCriteria(input.criteriaId);
        return { success: true };
      }),

    // Manually trigger a scan for a criteria
    scan: adminProcedure
      .input(z.object({ criteriaId: z.number() }))
      .mutation(async ({ input }) => {
        const { scanForCriteria } = await import('../deal-alert-agent');
        return scanForCriteria(input.criteriaId);
      }),

    // Run the full scan job (admin)
    runScanJob: adminProcedure
      .mutation(async () => {
        const { runDealAlertScanJob } = await import('../deal-alert-agent');
        return runDealAlertScanJob();
      }),

    // Run a one-click market evaluation
    // Returns evaluationId immediately and runs the evaluation asynchronously
    evaluateMarket: adminProcedure
      .input(z.object({
        city: z.string(),
        state: z.string(),
        analysisType: z.enum(['arbitrage', 'investment', 'both']).optional(),
        bedrooms: z.number().optional(),
        sessionId: z.string().optional(),
        email: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { startMarketEvaluation } = await import('../deal-alert-agent');
        return startMarketEvaluation(input);
      }),

    // Get a market evaluation by ID
    getEvaluation: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const { marketEvaluations } = await import('../../drizzle/schema');
        const [evaluation] = await db
          .select()
          .from(marketEvaluations)
          .where(eq(marketEvaluations.id, input.id))
          .limit(1);
        return evaluation || null;
      }),
});

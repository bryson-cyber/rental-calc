import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDeepAnalysis, startDeepAnalysis } from "../deep-analysis";
import { logActivity, ActionCategory } from "../activity";
import { canPerformAnalysis, recordAnalysisUsage } from "../usage-limits";

export const deepAnalysisRouter = router({
    // Start deep analysis for a report
    start: publicProcedure
      .input(z.object({
        reportId: z.number().int().positive(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Enforce daily usage limits (admins bypass)
          const userId = ctx.user?.id;
          const ipAddress = ctx.req?.ip || ctx.req?.socket?.remoteAddress;
          const limitCheck = await canPerformAnalysis(userId, undefined, ipAddress);
          if (!limitCheck.allowed) {
            return {
              success: false,
              error: limitCheck.reason || 'Daily analysis limit reached. Please try again tomorrow.',
              data: null,
              limitReached: true,
            };
          }

          console.log(`[DeepAnalysis] Starting for report ${input.reportId}`);
          const result = await startDeepAnalysis(input.reportId);

          // Record usage after successful deep analysis start
          await recordAnalysisUsage(userId, undefined, ipAddress, 5).catch(err =>
            console.error('[DeepAnalysis] Error recording usage:', err)
          );
          
          // Track activity for admin visibility
          logActivity({
            userId: ctx.user?.id ?? null,
            action: 'deep_analysis_started',
            actionCategory: ActionCategory.ANALYSIS,
            details: {
              reportId: input.reportId,
            },
          }).catch(() => {});
          
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
});

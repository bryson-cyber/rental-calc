import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDeepAnalysis, startDeepAnalysis } from "../deep-analysis";

export const deepAnalysisRouter = router({
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
});

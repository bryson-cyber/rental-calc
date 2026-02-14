/**
 * Content Studio v2 tRPC Router — Autonomous Generation
 *
 * Endpoints:
 *   - autoGenerate: One-click autonomous script generation (pulls data + picks topic + generates)
 *   - generateScript: Manual generation (user picks topic/format)
 *   - previewData: Preview what data the AI will use (no generation)
 *   - listScripts: List saved scripts with filters
 *   - getScript: Get a single script by ID
 *   - deleteScript: Delete a script by ID
 *   - getFormats: Get available formats and content pillars
 */

import { z } from 'zod';
import { eq, desc, and, like, sql } from 'drizzle-orm';
import { publicProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { contentScripts } from '../../drizzle/schema';
import {
  generateAutonomousScript,
  generateContentScript,
  FORMAT_SPECS,
  CONTENT_PILLARS,
  type GeneratedScript,
} from '../content-studio';
import {
  gatherContentData,
  formatDataForPrompt,
} from '../content-data-pipeline';
import {
  generateVideo,
  quickGenerateVideo,
  type VideoGenerationOptions,
} from '../video-generation';

// ── Input schemas ────────────────────────────────────────────────────────────

const autoGenerateInput = z.object({
  /** Optional: force a specific format instead of letting AI choose */
  format: z.enum(['reel', 'short', 'lesson', 'deep_dive']).optional(),
}).optional();

const generateScriptInput = z.object({
  format: z.enum(['reel', 'short', 'lesson', 'deep_dive']),
  topic: z.string().min(3, 'Topic must be at least 3 characters').max(500),
  marketData: z.string().optional(),
});

const listScriptsInput = z.object({
  format: z.enum(['reel', 'short', 'lesson', 'deep_dive']).optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const getScriptInput = z.object({
  id: z.number(),
});

const deleteScriptInput = z.object({
  id: z.number(),
});

const generateVideoInput = z.object({
  scriptId: z.number(),
  videoType: z.enum(['short', 'long']).optional(),
  bgMusic: z.enum(['engaging', 'lofi', 'none']).optional(),
  useColor: z.boolean().optional(),
  includeWatermark: z.boolean().optional(),
  timing: z.enum(['1', '2']).optional(),
});

const quickGenerateVideoInput = z.object({
  videoType: z.enum(['short', 'long']).optional(),
  bgMusic: z.enum(['engaging', 'lofi', 'none']).optional(),
  useColor: z.boolean().optional(),
  includeWatermark: z.boolean().optional(),
  timing: z.enum(['1', '2']).optional(),
}).optional();

// ── Router ───────────────────────────────────────────────────────────────────

export const contentStudioRouter = router({
  /**
   * ONE-CLICK autonomous generation.
   * Pulls real data → AI picks topic + format → generates complete script.
   */
  autoGenerate: publicProcedure
    .input(autoGenerateInput)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id ?? null;

      const { script: result, dataBundle } = await generateAutonomousScript(
        input?.format,
      );

      // Persist to database
      const db = await getDb();
      let savedId: number | null = null;

      if (db) {
        const [inserted] = await db.insert(contentScripts).values({
          userId,
          format: result.format,
          topic: result.topic,
          title: result.title,
          hook: result.hook,
          script: result.script,
          cta: result.cta,
          estimatedDurationSeconds: result.estimated_duration_seconds,
          keyDataPoints: result.key_data_points,
          targetAudience: result.target_audience,
          marketDataContext: {
            narrativeAngle: result.narrative_angle,
            dataSourcesUsed: result.data_sources_used,
            platformStats: {
              totalReports: dataBundle.platformStats.totalReports,
              totalLeads: dataBundle.platformStats.totalLeads,
              propertiesUsed: dataBundle.recentProperties.length,
              marketsUsed: dataBundle.marketSnapshots.length,
            },
          },
        });
        savedId = inserted.insertId;
      }

      return {
        id: savedId,
        format: result.format,
        topic: result.topic,
        title: result.title,
        hook: result.hook,
        script: result.script,
        cta: result.cta,
        estimatedDurationSeconds: result.estimated_duration_seconds,
        keyDataPoints: result.key_data_points,
        targetAudience: result.target_audience,
        narrativeAngle: result.narrative_angle,
        dataSourcesUsed: result.data_sources_used,
        dataPreview: {
          propertiesUsed: dataBundle.recentProperties.length,
          marketsUsed: dataBundle.marketSnapshots.length,
          totalReports: dataBundle.platformStats.totalReports,
          topMarkets: dataBundle.platformStats.topMarkets.slice(0, 3),
        },
        createdAt: new Date(),
      };
    }),

  /**
   * Preview what data the AI will use — no generation, just data inspection.
   */
  previewData: publicProcedure.query(async () => {
    const dataBundle = await gatherContentData();
    const formattedPromptData = formatDataForPrompt(dataBundle);

    return {
      recentProperties: dataBundle.recentProperties.slice(0, 10).map((p) => ({
        city: p.city,
        state: p.state,
        bedrooms: p.bedrooms,
        annualRevenue: p.annualRevenue,
        occupancyRate: p.occupancyRate,
        averageDailyRate: p.averageDailyRate,
        verdict: p.verdict,
        monthlyRent: p.monthlyRent,
      })),
      marketSnapshots: dataBundle.marketSnapshots,
      platformStats: dataBundle.platformStats,
      previousTopics: dataBundle.previousTopics.slice(0, 10),
      promptPreview: formattedPromptData,
      pulledAt: dataBundle.pulledAt,
    };
  }),

  /**
   * Manual generation — user picks topic and format.
   */
  generateScript: publicProcedure
    .input(generateScriptInput)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id ?? null;

      const result: GeneratedScript = await generateContentScript(
        input.topic,
        input.format,
        input.marketData,
      );

      const db = await getDb();
      let savedId: number | null = null;

      if (db) {
        const [inserted] = await db.insert(contentScripts).values({
          userId,
          format: input.format,
          topic: input.topic,
          title: result.title,
          hook: result.hook,
          script: result.script,
          cta: result.cta,
          estimatedDurationSeconds: result.estimated_duration_seconds,
          keyDataPoints: result.key_data_points,
          targetAudience: result.target_audience,
          marketDataContext: input.marketData
            ? { raw: input.marketData }
            : null,
        });
        savedId = inserted.insertId;
      }

      return {
        id: savedId,
        format: input.format,
        topic: input.topic,
        title: result.title,
        hook: result.hook,
        script: result.script,
        cta: result.cta,
        estimatedDurationSeconds: result.estimated_duration_seconds,
        keyDataPoints: result.key_data_points,
        targetAudience: result.target_audience,
        narrativeAngle: result.narrative_angle || '',
        dataSourcesUsed: result.data_sources_used || [],
        createdAt: new Date(),
      };
    }),

  /**
   * List saved scripts with optional filters.
   */
  listScripts: publicProcedure
    .input(listScriptsInput)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { scripts: [], total: 0, hasMore: false };

      const conditions = [];
      if (input.format) {
        conditions.push(eq(contentScripts.format, input.format));
      }
      if (input.search) {
        conditions.push(like(contentScripts.topic, `%${input.search}%`));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [scripts, countResult] = await Promise.all([
        db
          .select()
          .from(contentScripts)
          .where(where)
          .orderBy(desc(contentScripts.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(contentScripts)
          .where(where),
      ]);

      return {
        scripts,
        total: countResult[0]?.count ?? 0,
        hasMore: (input.offset + input.limit) < (countResult[0]?.count ?? 0),
      };
    }),

  /**
   * Get a single script by ID.
   */
  getScript: publicProcedure
    .input(getScriptInput)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const [script] = await db
        .select()
        .from(contentScripts)
        .where(eq(contentScripts.id, input.id))
        .limit(1);

      if (!script) {
        throw new Error('Script not found');
      }

      return script;
    }),

  /**
   * Delete a script by ID.
   */
  deleteScript: publicProcedure
    .input(deleteScriptInput)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const userId = ctx.user?.id;

      const [script] = await db
        .select()
        .from(contentScripts)
        .where(eq(contentScripts.id, input.id))
        .limit(1);

      if (!script) {
        throw new Error('Script not found');
      }

      if (ctx.user?.role !== 'admin' && script.userId !== userId) {
        throw new Error('You can only delete your own scripts');
      }

      await db.delete(contentScripts).where(eq(contentScripts.id, input.id));

      return { success: true, deletedId: input.id };
    }),

  /**
   * Get available formats and content pillars for the UI.
   */
  getFormats: publicProcedure.query(() => {
    return {
      formats: Object.entries(FORMAT_SPECS).map(([key, spec]) => ({
        id: key,
        name: spec.name,
        durationRange: spec.durationRange,
        wordCount: spec.wordCount,
        structure: spec.structure,
        style: spec.style,
      })),
      pillars: CONTENT_PILLARS,
    };
  }),

  // ── Video Generation Endpoints ──────────────────────────────────────────

  /**
   * Generate a video from an existing script.
   * Takes a script ID and video options, returns the video URL.
   */
  generateVideo: publicProcedure
    .input(generateVideoInput)
    .mutation(async ({ input }) => {
      console.log(`[Content Studio] Generating video for script #${input.scriptId}`);
      const result = await generateVideo(input);
      return {
        videoUrl: result.videoUrl,
        script: result.script,
        scriptId: result.scriptId,
        format: result.format,
        title: result.title,
      };
    }),

  /**
   * ONE-CLICK: Generate script + video in a single call.
   * Pulls data → generates script → generates video. True zero-effort.
   */
  quickGenerateVideo: publicProcedure
    .input(quickGenerateVideoInput)
    .mutation(async ({ input }) => {
      console.log('[Content Studio] Quick generate: script + video in one call');
      const result = await quickGenerateVideo(input ?? {});
      return {
        videoUrl: result.videoUrl,
        script: result.script,
        scriptId: result.scriptId,
        savedScriptId: result.savedScriptId,
        format: result.format,
        title: result.title,
      };
    }),
});

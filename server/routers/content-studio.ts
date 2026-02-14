/**
 * Content Studio tRPC Router — Autonomous Generation + Async Video
 *
 * Endpoints:
 *   - autoGenerate: One-click autonomous script generation
 *   - generateScript: Manual generation (user picks topic/format)
 *   - previewData: Preview what data the AI will use
 *   - listScripts / getScript / deleteScript: Script CRUD
 *   - getFormats: Available formats (YT Lesson + Deep Dive only)
 *   - startVideo: Start async video generation from script
 *   - quickStartVideo: Script + video in one call (async)
 *   - videoStatus: Poll video generation status
 *   - listVideoJobs: List recent video jobs
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
  startVideoGeneration,
  quickStartVideoGeneration,
  getVideoStatus,
  listVideoJobs,
} from '../video-generation';

// Note: old sync exports (generateVideo, quickGenerateVideo, VideoGenerationOptions) removed

// ── Input schemas ────────────────────────────────────────────────────────────

const autoGenerateInput = z.object({
  format: z.enum(['lesson', 'deep_dive']).optional(),
}).optional();

const generateScriptInput = z.object({
  format: z.enum(['lesson', 'deep_dive']),
  topic: z.string().min(3, 'Topic must be at least 3 characters').max(500),
  marketData: z.string().optional(),
});

const listScriptsInput = z.object({
  format: z.enum(['lesson', 'deep_dive']).optional(),
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

const startVideoInput = z.object({
  scriptId: z.number(),
});

const quickStartVideoInput = z.object({
  format: z.enum(['lesson', 'deep_dive']).optional(),
}).optional();

const videoStatusInput = z.object({
  jobId: z.string(),
});

// ── Router ───────────────────────────────────────────────────────────────────

export const contentStudioRouter = router({
  /**
   * ONE-CLICK autonomous generation.
   * Pulls real data → AI picks topic → generates complete script.
   */
  autoGenerate: publicProcedure
    .input(autoGenerateInput)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user?.id ?? null;

      const { script: result, dataBundle } = await generateAutonomousScript(
        input?.format,
      );

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
   * Preview what data the AI will use — no generation.
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

      if (!script) throw new Error('Script not found');
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

      if (!script) throw new Error('Script not found');
      if (ctx.user?.role !== 'admin' && script.userId !== userId) {
        throw new Error('You can only delete your own scripts');
      }

      await db.delete(contentScripts).where(eq(contentScripts.id, input.id));
      return { success: true, deletedId: input.id };
    }),

  /**
   * Get available formats and content pillars.
   * Only YT-style long-form: Lesson and Deep Dive.
   */
  getFormats: publicProcedure.query(() => {
    const ytFormats = ['lesson', 'deep_dive'];
    return {
      formats: Object.entries(FORMAT_SPECS)
        .filter(([key]) => ytFormats.includes(key))
        .map(([key, spec]) => ({
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

  // ── Async Video Generation Endpoints ───────────────────────────────────

  /**
   * Start video generation from an existing script.
   * Returns immediately with a jobId — client polls videoStatus.
   */
  startVideo: publicProcedure
    .input(startVideoInput)
    .mutation(async ({ input }) => {
      console.log(`[Content Studio] Starting video for script #${input.scriptId}`);
      const result = await startVideoGeneration(input.scriptId);
      return result;
    }),

  /**
   * ONE-CLICK: Generate script + start video in one call.
   * Returns immediately with jobId — client polls videoStatus.
   */
  quickStartVideo: publicProcedure
    .input(quickStartVideoInput)
    .mutation(async ({ input }) => {
      console.log('[Content Studio] Quick start: script + video');
      const result = await quickStartVideoGeneration(input?.format);
      return result;
    }),

  /**
   * Poll video generation status.
   */
  videoStatus: publicProcedure
    .input(videoStatusInput)
    .query(async ({ input }) => {
      return getVideoStatus(input.jobId);
    }),

  /**
   * List recent video jobs.
   */
  listVideoJobs: publicProcedure.query(async () => {
    return listVideoJobs();
  }),
});

/**
 * Content Hub tRPC Router — Full Pipeline Management
 *
 * Endpoints:
 *   Pipeline:
 *     - startPipeline: Start a full topic → script → video pipeline
 *     - getVideo: Get a single video by ID (with status, script, URL)
 *     - listVideos: List videos with filters
 *     - deleteVideo: Delete a video
 *
 *   Script Review:
 *     - updateScript: Edit a script and optionally continue to video
 *
 *   Topic Suggestions:
 *     - suggestTopics: AI suggests topics from platform data
 *
 *   Batch:
 *     - startBatch: Start multiple pipelines at once
 *
 *   Presets:
 *     - savePreset / listPresets / deletePreset
 */

import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import {
  startPipeline,
  getVideoById,
  listVideos,
  deleteVideo,
  bulkDeleteVideos,
  updateScript,
  suggestTopics,
  startBatch,
  savePreset,
  listPresets,
  deletePreset,
  checkGolpoStatus,
  getVideoBySlug,
} from '../content-hub-pipeline';

// ── Input Schemas ────────────────────────────────────────────────────────────

const startPipelineInput = z.object({
  topic: z.string().min(3).max(500),
  format: z.enum(['lesson', 'deep_dive']),
  /** Script input mode */
  scriptMode: z.enum(['own_script', 'ai_enhance', 'ai_generate']).optional().default('ai_generate'),
  /** User-provided script (required for own_script and ai_enhance modes) */
  userScript: z.string().max(50000).optional(),
  scriptOnly: z.boolean().optional().default(false),
  brainDump: z.string().max(5000).optional(),
  targetAudience: z.string().max(100).optional(),
  voiceStyle: z.string().optional(),
  contentFocus: z.string().optional(),
  contentLength: z.string().optional(),
  storyFormat: z.string().optional(),
  persona: z.string().optional(),
  bgMusic: z.string().optional(),
  ttsStyle: z.string().optional(),
  timing: z.string().optional(),
  // Golpo API v1 options
  videoType: z.enum(['long', 'short']).optional().default('long'),
  ttsModel: z.enum(['accurate', 'flash']).optional().default('accurate'),
  whiteBg: z.boolean().optional().default(true),
  outputVolume: z.string().optional().default('1.0'),
  bgVolume: z.string().optional().default('0.3'),
  visualStyle: z.enum(['default', 'sketch', 'sketch-advanced', 'canvas']).optional().default('default'),
  canvasImageStyle: z.enum(['neon', 'whiteboard', 'modern_minimal', 'playful', 'technical', 'editorial']).optional(),
  canvasPenStyle: z.enum(['stylus', 'marker', 'pen']).optional(),
  logoUrl: z.string().url().optional(),
  logoPlacement: z.enum(['tl', 'tr', 'bl', 'br']).optional().default('tl'),
});

const getVideoInput = z.object({
  id: z.number(),
});

const listVideosInput = z.object({
  status: z.string().optional(),
  format: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
}).optional();

const deleteVideoInput = z.object({
  id: z.number(),
});

const updateScriptInput = z.object({
  videoId: z.number(),
  script: z.string().min(100),
  continueToVideo: z.boolean().optional().default(false),
});

const suggestTopicsInput = z.object({
  count: z.number().min(1).max(10).default(5),
}).optional();

const startBatchInput = z.object({
  topics: z.array(z.object({
    topic: z.string().min(3).max(500),
    format: z.enum(['lesson', 'deep_dive']),
  })).min(1).max(10),
  scriptOnly: z.boolean().optional().default(false),
  voiceStyle: z.string().optional(),
  bgMusic: z.string().optional(),
  ttsStyle: z.string().optional(),
  timing: z.string().optional(),
  // Golpo API v1 options
  videoType: z.enum(['long', 'short']).optional().default('long'),
  ttsModel: z.enum(['accurate', 'flash']).optional().default('accurate'),
  whiteBg: z.boolean().optional().default(true),
  outputVolume: z.string().optional().default('1.0'),
  bgVolume: z.string().optional().default('0.3'),
  visualStyle: z.enum(['default', 'sketch', 'sketch-advanced', 'canvas']).optional().default('default'),
  canvasImageStyle: z.enum(['neon', 'whiteboard', 'modern_minimal', 'playful', 'technical', 'editorial']).optional(),
  canvasPenStyle: z.enum(['stylus', 'marker', 'pen']).optional(),
  logoUrl: z.string().url().optional(),
  logoPlacement: z.enum(['tl', 'tr', 'bl', 'br']).optional().default('tl'),
});

const savePresetInput = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().max(4).optional(),
  format: z.string().optional(),
  voiceStyle: z.string().optional(),
  contentFocus: z.string().optional(),
  contentLength: z.string().optional(),
  storyFormat: z.string().optional(),
  persona: z.string().optional(),
  bgMusic: z.string().optional(),
  // Golpo API v1 options
  videoType: z.string().optional(),
  ttsModel: z.string().optional(),
  whiteBg: z.boolean().optional(),
  outputVolume: z.string().optional(),
  bgVolume: z.string().optional(),
  visualStyle: z.string().optional(),
  canvasImageStyle: z.string().optional(),
  canvasPenStyle: z.string().optional(),
  logoUrl: z.string().optional(),
  logoPlacement: z.string().optional(),
});

const deletePresetInput = z.object({
  id: z.number(),
});

// ── Router ───────────────────────────────────────────────────────────────────

export const contentHubRouter = router({
  /**
   * Start a full pipeline: Research → Script → Video
   * Returns immediately with videoId. Client polls getVideo for status.
   */
  startPipeline: protectedProcedure
    .input(startPipelineInput)
    .mutation(async ({ input, ctx }) => {
      const result = await startPipeline({
        ...input,
        userId: ctx.user.id,
      });
      return result;
    }),

  /**
   * Get a single video with full details (status, script, video URL, timing).
   */
  getVideo: protectedProcedure
    .input(getVideoInput)
    .query(async ({ input }) => {
      return getVideoById(input.id);
    }),

  /**
   * List videos with optional filters.
   */
  listVideos: protectedProcedure
    .input(listVideosInput)
    .query(async ({ input, ctx }) => {
      return listVideos({
        userId: ctx.user.role === 'admin' ? undefined : ctx.user.id,
        status: input?.status as any,
        format: input?.format,
        limit: input?.limit,
        offset: input?.offset,
      });
    }),

  /**
   * Delete a video.
   */
  deleteVideo: protectedProcedure
    .input(deleteVideoInput)
    .mutation(async ({ input }) => {
      await deleteVideo(input.id);
      return { success: true };
    }),

  /**
   * Edit a script and optionally continue to video generation.
   */
  updateScript: protectedProcedure
    .input(updateScriptInput)
    .mutation(async ({ input }) => {
      await updateScript(input.videoId, input.script, input.continueToVideo);
      // Return the current status so the frontend knows if video generation started
      const video = await getVideoById(input.videoId);
      return { success: true, status: video.status };
    }),

  /**
   * AI suggests topics based on platform data.
   */
  suggestTopics: protectedProcedure
    .input(suggestTopicsInput)
    .mutation(async ({ input }) => {
      const topics = await suggestTopics(input?.count || 5);
      return { topics };
    }),

  /**
   * Start multiple pipelines at once.
   */
  startBatch: protectedProcedure
    .input(startBatchInput)
    .mutation(async ({ input, ctx }) => {
      const { topics, ...opts } = input;
      const results = await startBatch(
        topics,
        ctx.user.id,
        opts,
      );
      return { results };
    }),

  /**
   * Save a preset configuration.
   */
  savePreset: protectedProcedure
    .input(savePresetInput)
    .mutation(async ({ input, ctx }) => {
      return savePreset(ctx.user.id, input);
    }),

  /**
   * List user's presets.
   */
  listPresets: protectedProcedure
    .query(async ({ ctx }) => {
      return listPresets(ctx.user.id);
    }),

  /**
   * Delete a preset.
   */
  deletePreset: protectedProcedure
    .input(deletePresetInput)
    .mutation(async ({ input, ctx }) => {
      await deletePreset(input.id, ctx.user.id);
      return { success: true };
    }),

  /**
   * Bulk delete multiple videos at once.
   * Useful for cleaning up test videos.
   */
  bulkDeleteVideos: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(200) }))
    .mutation(async ({ input }) => {
      return bulkDeleteVideos(input.ids);
    }),

  /**
   * Manually check Golpo status for a video (recover videos whose polling timed out).
   * Prevents wasted credits by retrieving completed videos that our polling missed.
   */
  checkGolpoStatus: protectedProcedure
    .input(z.object({ videoId: z.number() }))
    .mutation(async ({ input }) => {
      return checkGolpoStatus(input.videoId);
    }),

  /**
   * Public: Get a completed video by its URL slug for the shareable landing page.
   * No authentication required — only exposes completed videos with limited fields.
   */
  getVideoBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      return getVideoBySlug(input.slug);
    }),
});

/**
 * Webinar Show-Up Machine — tRPC Router
 * 
 * ALL procedures are owner-only. This router is hidden from regular users.
 * Owner is identified by matching ctx.user.openId === ENV.ownerOpenId.
 */

import { router, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { ENV } from '../_core/env';
import { getDb } from '../db';
import {
  webinarSchedules,
  webinarRegistrants,
  smsConversations,
  reminderTemplates,
  noShowBlasts,
} from '../../drizzle/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import {
  sendReminders,
  executeNoShowBlast,
  handleIncomingSms,
  addRegistrantFromWebhook,
  syncRegistrants,
  getActiveSchedules,
  getAllSchedules,
  getScheduleRegistrants,
  getConversationLog,
  getRecentConversations,
  getBlastHistory,
  sendManualSms,
  getReminderTemplate,
} from '../webinar-engine';
import { generateAndCacheTeasers, getTeasers, generateTeasersFromTranscript } from '../webinar-ai-content';
import { listWebhooks, createWebhook, deleteWebhook } from '../simpletexting-client';
import { listWebinars, getWebinar } from '../webinarjam-client';
import { getTranscript } from '../webinar-transcript-seeder';

// ---------------------------------------------------------------------------
// OWNER-ONLY MIDDLEWARE
// ---------------------------------------------------------------------------

/**
 * Procedure that requires the caller to be the project owner.
 * Uses OWNER_OPEN_ID from environment to verify identity.
 */
const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
  const ownerOpenId = ENV.ownerOpenId;
  if (!ownerOpenId || ctx.user.openId !== ownerOpenId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This feature is restricted to the site owner.',
    });
  }
  return next({ ctx });
});

// ---------------------------------------------------------------------------
// ROUTER
// ---------------------------------------------------------------------------

export const webinarRouter = router({
  // =========================================================================
  // SCHEDULE MANAGEMENT
  // =========================================================================

  /** List all webinar schedules */
  listSchedules: ownerProcedure.query(async () => {
    return getAllSchedules();
  }),

  /** Get a single schedule with registrant stats */
  getSchedule: ownerProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const [schedule] = await db
        .select()
        .from(webinarSchedules)
        .where(eq(webinarSchedules.id, input.id))
        .limit(1);

      if (!schedule) throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });

      const { registrants, stats } = await getScheduleRegistrants(input.id);

      return { schedule, registrants, stats };
    }),

  /** Create a new webinar schedule */
  createSchedule: ownerProcedure
    .input(z.object({
      name: z.string().min(1),
      dayOfWeek: z.number().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      timezone: z.string().default('America/Los_Angeles'),
      liveRoomUrl: z.string().optional(),
      noShowTeaser: z.string().optional(),
      webinarTranscript: z.string().optional(),
      webinarjamWebinarId: z.string().optional(),
      webinarjamScheduleId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      // Auto-inject the permanent transcript if none provided
      let transcript = input.webinarTranscript || null;
      if (!transcript) {
        try {
          transcript = await getTranscript();
          console.log(`[WebinarRouter] Auto-injected permanent transcript (${transcript.length} chars)`);
        } catch {
          console.warn('[WebinarRouter] Could not load permanent transcript');
        }
      }

      const [result] = await db.insert(webinarSchedules).values({
        name: input.name,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        timezone: input.timezone,
        liveRoomUrl: input.liveRoomUrl || null,
        noShowTeaser: input.noShowTeaser || null,
        webinarTranscript: transcript,
        webinarjamWebinarId: input.webinarjamWebinarId || null,
        webinarjamScheduleId: input.webinarjamScheduleId || null,
        isActive: 1,
      }).$returningId();

      const scheduleId = result.id;

      // Auto-generate teasers from transcript (always, since transcript is always available)
      if (transcript) {
        try {
          await generateAndCacheTeasers(scheduleId);
          console.log(`[WebinarRouter] Auto-generated teasers for schedule ${scheduleId}`);
        } catch (error) {
          console.error(`[WebinarRouter] Failed to auto-generate teasers:`, error);
        }
      }

      // Auto-sync registrants from WebinarJam if IDs provided
      let syncResult = null;
      if (input.webinarjamWebinarId && input.webinarjamScheduleId) {
        try {
          syncResult = await syncRegistrants(scheduleId);
          console.log(`[WebinarRouter] Auto-synced ${syncResult.synced} registrants for schedule ${scheduleId}`);
        } catch (error) {
          console.error(`[WebinarRouter] Failed to auto-sync registrants:`, error);
        }
      }

      return { id: scheduleId, success: true, syncResult };
    }),

  /** Update a webinar schedule */
  updateSchedule: ownerProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      dayOfWeek: z.number().min(0).max(6).optional(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      timezone: z.string().optional(),
      liveRoomUrl: z.string().optional(),
      noShowTeaser: z.string().optional(),
      webinarTranscript: z.string().optional(),
      webinarjamWebinarId: z.string().optional(),
      webinarjamScheduleId: z.string().optional(),
      isActive: z.number().min(0).max(1).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const { id, ...updates } = input;
      const setValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setValues[key] = value;
      }

      if (Object.keys(setValues).length === 0) {
        return { success: true };
      }

      await db.update(webinarSchedules).set(setValues).where(eq(webinarSchedules.id, id));

      // If transcript was updated, regenerate teasers
      if (input.webinarTranscript) {
        try {
          await generateAndCacheTeasers(id);
          console.log(`[WebinarRouter] Regenerated teasers for schedule ${id} after transcript update`);
        } catch (error) {
          console.error(`[WebinarRouter] Failed to regenerate teasers:`, error);
        }
      }

      return { success: true };
    }),

  /** Delete a webinar schedule */
  deleteSchedule: ownerProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      // Soft delete — just deactivate
      await db.update(webinarSchedules).set({ isActive: 0 }).where(eq(webinarSchedules.id, input.id));
      return { success: true };
    }),

  // =========================================================================
  // REGISTRANT MANAGEMENT
  // =========================================================================

  /** Get registrants for a schedule */
  getRegistrants: ownerProcedure
    .input(z.object({ scheduleId: z.number() }))
    .query(async ({ input }) => {
      return getScheduleRegistrants(input.scheduleId);
    }),

  /** Sync registrants from WebinarJam */
  syncRegistrants: ownerProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(async ({ input }) => {
      return syncRegistrants(input.scheduleId);
    }),

  /** Manually add a registrant */
  addRegistrant: ownerProcedure
    .input(z.object({
      scheduleId: z.number(),
      firstName: z.string().min(1),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().min(10),
      liveRoomUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return addRegistrantFromWebhook({
        scheduleId: input.scheduleId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        liveRoomUrl: input.liveRoomUrl,
      });
    }),

  // =========================================================================
  // REMINDER ENGINE
  // =========================================================================

  /** Send reminders for a specific stage */
  sendReminders: ownerProcedure
    .input(z.object({
      scheduleId: z.number(),
      stage: z.number().min(1).max(4),
    }))
    .mutation(async ({ input }) => {
      return sendReminders(input.scheduleId, input.stage);
    }),

  /** Get reminder templates */
  getTemplates: ownerProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const templates = await db
      .select()
      .from(reminderTemplates)
      .orderBy(reminderTemplates.stage);

    // If no custom templates, return defaults
    if (templates.length === 0) {
      return [
        { id: 0, stage: 1, name: '24 Hours Before', messageTemplate: await getReminderTemplate(1), isActive: 1 },
        { id: 0, stage: 2, name: 'Morning Of', messageTemplate: await getReminderTemplate(2), isActive: 1 },
        { id: 0, stage: 3, name: '1 Hour Before', messageTemplate: await getReminderTemplate(3), isActive: 1 },
        { id: 0, stage: 4, name: 'At Start Time', messageTemplate: await getReminderTemplate(4), isActive: 1 },
        { id: 0, stage: 5, name: 'No-Show Blast', messageTemplate: await getReminderTemplate(5), isActive: 1 },
      ];
    }

    return templates;
  }),

  /** Update a reminder template */
  updateTemplate: ownerProcedure
    .input(z.object({
      stage: z.number().min(1).max(5),
      name: z.string().min(1),
      messageTemplate: z.string().min(1),
      isActive: z.number().min(0).max(1).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      // Upsert: check if template exists for this stage
      const [existing] = await db
        .select()
        .from(reminderTemplates)
        .where(eq(reminderTemplates.stage, input.stage))
        .limit(1);

      if (existing) {
        await db.update(reminderTemplates).set({
          name: input.name,
          messageTemplate: input.messageTemplate,
          isActive: input.isActive ?? 1,
        }).where(eq(reminderTemplates.id, existing.id));
      } else {
        await db.insert(reminderTemplates).values({
          stage: input.stage,
          name: input.name,
          messageTemplate: input.messageTemplate,
          isActive: input.isActive ?? 1,
        });
      }

      return { success: true };
    }),

  // =========================================================================
  // NO-SHOW BLASTER
  // =========================================================================

  /** Execute a no-show blast */
  blastNoShows: ownerProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return executeNoShowBlast(input.scheduleId, ctx.user.name || 'owner');
    }),

  /** Get blast history */
  getBlastHistory: ownerProcedure
    .input(z.object({ scheduleId: z.number().optional() }))
    .query(async ({ input }) => {
      return getBlastHistory(input.scheduleId);
    }),

  // =========================================================================
  // SMS CONVERSATIONS
  // =========================================================================

  /** Get recent conversations (grouped by phone) */
  getRecentConversations: ownerProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      return getRecentConversations(input.limit);
    }),

  /** Get conversation log for a specific phone number */
  getConversation: ownerProcedure
    .input(z.object({ phone: z.string(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      return getConversationLog(input.phone, input.limit);
    }),

  /** Send a manual SMS */
  sendManualSms: ownerProcedure
    .input(z.object({
      phone: z.string().min(10),
      message: z.string().min(1).max(1600),
    }))
    .mutation(async ({ input }) => {
      return sendManualSms(input.phone, input.message);
    }),

  // =========================================================================
  // WEBINARJAM INTEGRATION
  // =========================================================================

  /** List webinars from WebinarJam */
  listWebinarJamWebinars: ownerProcedure.query(async () => {
    try {
      return await listWebinars();
    } catch (error) {
      console.error('[WebinarRouter] Failed to list WebinarJam webinars:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch webinars from WebinarJam',
      });
    }
  }),

  /** Get WebinarJam webinar details */
  getWebinarJamWebinar: ownerProcedure
    .input(z.object({ webinarId: z.string() }))
    .query(async ({ input }) => {
      try {
        return await getWebinar(input.webinarId);
      } catch (error) {
        console.error('[WebinarRouter] Failed to get WebinarJam webinar:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch webinar details from WebinarJam',
        });
      }
    }),

  // =========================================================================
  // SIMPLETEXTING WEBHOOKS
  // =========================================================================

  /** List SimpleTexting webhooks */
  listWebhooks: ownerProcedure.query(async () => {
    try {
      return await listWebhooks();
    } catch (error) {
      console.error('[WebinarRouter] Failed to list webhooks:', error);
      return [];
    }
  }),

  // =========================================================================
  // DASHBOARD STATS
  // =========================================================================

  /** Get overall webinar dashboard stats */
  getDashboardStats: ownerProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {
      totalSchedules: 0,
      activeSchedules: 0,
      totalRegistrants: 0,
      totalAttended: 0,
      totalNoShows: 0,
      totalSmsSent: 0,
      totalConversations: 0,
      recentBlasts: [],
    };

    const schedules = await db.select().from(webinarSchedules);
    const registrants = await db.select().from(webinarRegistrants);
    const outboundSms = await db
      .select({ count: sql<number>`count(*)` })
      .from(smsConversations)
      .where(eq(smsConversations.direction, 'outbound'));

    const uniquePhones = await db
      .select({ count: sql<number>`count(distinct ${smsConversations.phone})` })
      .from(smsConversations)
      .where(eq(smsConversations.direction, 'inbound'));

    const recentBlasts = await db
      .select()
      .from(noShowBlasts)
      .orderBy(desc(noShowBlasts.createdAt))
      .limit(5);

    return {
      totalSchedules: schedules.length,
      activeSchedules: schedules.filter(s => s.isActive === 1).length,
      totalRegistrants: registrants.length,
      totalAttended: registrants.filter(r => r.attendanceStatus === 'attended').length,
      totalNoShows: registrants.filter(r => r.attendanceStatus === 'no_show').length,
      totalSmsSent: outboundSms[0]?.count ?? 0,
      totalConversations: uniquePhones[0]?.count ?? 0,
      recentBlasts,
    };
  }),

  // =========================================================================
  // AI TEASER GENERATION
  // =========================================================================

  /** Get AI-generated teasers for a schedule */
  getTeasers: ownerProcedure
    .input(z.object({ scheduleId: z.number() }))
    .query(async ({ input }) => {
      return getTeasers(input.scheduleId);
    }),

  /** Regenerate teasers from transcript */
  regenerateTeasers: ownerProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(async ({ input }) => {
      return generateAndCacheTeasers(input.scheduleId);
    }),

  /** Upload/update transcript for a schedule */
  updateTranscript: ownerProcedure
    .input(z.object({
      scheduleId: z.number(),
      transcript: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      await db.update(webinarSchedules).set({
        webinarTranscript: input.transcript,
      }).where(eq(webinarSchedules.id, input.scheduleId));

      // Auto-generate teasers from the new transcript
      const result = await generateAndCacheTeasers(input.scheduleId);

      return { success: true, teasers: result.teasers, primaryTeaser: result.primaryTeaser };
    }),

  /** Check if current user is the owner (used by frontend to show/hide webinar nav) */
  isOwner: protectedProcedure.query(({ ctx }) => {
    const ownerOpenId = ENV.ownerOpenId;
    return { isOwner: !!ownerOpenId && ctx.user.openId === ownerOpenId };
  }),
});

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
  isAiRepliesEnabled,
  setAiRepliesEnabled,
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
    const db = await getDb();
    if (!db) return [];

    const schedules = await getAllSchedules();

    // Add registrant count to each schedule
    const withCounts = await Promise.all(
      schedules.map(async (schedule) => {
        const [countResult] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(webinarRegistrants)
          .where(eq(webinarRegistrants.scheduleId, schedule.id));
        return {
          ...schedule,
          registrantCount: countResult?.count ?? 0,
        };
      })
    );

    return withCounts;
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

    // Active textable numbers breakdown
    const activeTextable = registrants.filter(r => r.phone && r.phone !== '' && r.optedOut === 0).length;
    const optedOut = registrants.filter(r => r.optedOut === 1).length;
    const noPhone = registrants.filter(r => !r.phone || r.phone === '').length;

    return {
      totalSchedules: schedules.length,
      activeSchedules: schedules.filter(s => s.isActive === 1).length,
      totalRegistrants: registrants.length,
      totalAttended: registrants.filter(r => r.attendanceStatus === 'attended').length,
      totalNoShows: registrants.filter(r => r.attendanceStatus === 'no_show').length,
      totalSmsSent: outboundSms[0]?.count ?? 0,
      totalConversations: uniquePhones[0]?.count ?? 0,
      activeTextable,
      optedOut,
      noPhone,
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

  // =========================================================================
  // WEBHOOK AUTO-CONFIGURATION
  // =========================================================================

  /** Get webhook configuration status */
  getWebhookStatus: ownerProcedure.query(async () => {
    const { isPollingActive } = await import('../webhook-auto-config');
    let simpleTextingWebhooks: Array<{ id?: string; webhookId?: string; url: string; triggers: string[] }> = [];
    try {
      simpleTextingWebhooks = await listWebhooks();
    } catch {
      // API key might not be set
    }

    const ourWebhook = simpleTextingWebhooks.find(wh =>
      wh.url.includes('coachinayahturnkeytool.com') &&
      wh.triggers.includes('INCOMING_MESSAGE')
    );

    return {
      simpleTexting: {
        configured: !!ourWebhook,
        webhookId: ourWebhook?.webhookId ?? ourWebhook?.id ?? null,
        webhookUrl: ourWebhook?.url ?? null,
        totalWebhooks: simpleTextingWebhooks.length,
      },
      webinarJam: {
        pollingActive: isPollingActive(),
        apiKeySet: !!ENV.webinarjamApiKey,
      },
    };
  }),

  /** Manually trigger webhook auto-configuration */
  configureWebhooks: ownerProcedure.mutation(async () => {
    const { runWebhookAutoConfig } = await import('../webhook-auto-config');
    return runWebhookAutoConfig();
  }),

  /** Manually trigger a WebinarJam registrant poll */
  pollRegistrants: ownerProcedure.mutation(async () => {
    const { pollWebinarJamRegistrants } = await import('../webhook-auto-config');
    return pollWebinarJamRegistrants();
  }),

  // =========================================================================
  // CRON SCHEDULER
  // =========================================================================

  /** Get cron scheduler status and next fire times */
  getCronStatus: ownerProcedure.query(async () => {
    const { isCronActive, getNextFireTimes } = await import('../webinar-cron');
    return {
      active: isCronActive(),
      ...getNextFireTimes(),
    };
  }),

  /** Manually trigger the noon engagement blast (for testing) */
  triggerNoonEngagement: ownerProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(async ({ input }) => {
      const { executeNoonEngagement } = await import('../webinar-cron');
      return executeNoonEngagement(input.scheduleId);
    }),

  /** Manually trigger the no-show blast (for testing) */
  triggerNoShowBlast: ownerProcedure
    .input(z.object({ scheduleId: z.number() }))
    .mutation(async ({ input }) => {
      return executeNoShowBlast(input.scheduleId, 'manual');
    }),

  // =========================================================================
  // SMS BLAST DELIVERY TRACKER
  // =========================================================================

  /** Get live SMS blast delivery stats — shows sent/failed/total for each message type */
  getBlastDeliveryStats: ownerProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { blasts: [] };

    // Get stats grouped by messageType for today's outbound messages
    const stats = await db
      .select({
        messageType: smsConversations.messageType,
        total: sql<number>`COUNT(*)`,
        firstSent: sql<string>`MIN(${smsConversations.createdAt})`,
        lastSent: sql<string>`MAX(${smsConversations.createdAt})`,
      })
      .from(smsConversations)
      .where(
        and(
          eq(smsConversations.direction, 'outbound'),
          sql`${smsConversations.createdAt} > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
        )
      )
      .groupBy(smsConversations.messageType);

    // Get total active registrants for progress calculation
    const [regCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(webinarRegistrants)
      .where(
        and(
          eq(webinarRegistrants.optedOut, 0),
          sql`${webinarRegistrants.phone} IS NOT NULL AND ${webinarRegistrants.phone} != ''`
        )
      );

    // Get the last 5 outbound messages as a sample
    const recentMessages = await db
      .select({
        phone: smsConversations.phone,
        messageText: smsConversations.messageText,
        messageType: smsConversations.messageType,
        createdAt: smsConversations.createdAt,
      })
      .from(smsConversations)
      .where(
        and(
          eq(smsConversations.direction, 'outbound'),
          sql`${smsConversations.createdAt} > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
        )
      )
      .orderBy(desc(smsConversations.createdAt))
      .limit(5);

    // Get inbound reply count for today
    const [inboundCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(smsConversations)
      .where(
        and(
          eq(smsConversations.direction, 'inbound'),
          sql`${smsConversations.createdAt} > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
        )
      );

    return {
      blasts: stats.map(s => ({
        type: s.messageType,
        sent: s.total,
        firstSent: s.firstSent,
        lastSent: s.lastSent,
      })),
      totalActiveRegistrants: regCount?.count ?? 0,
      recentMessages,
      inboundReplies: inboundCount?.count ?? 0,
    };
  }),

  // =========================================================================
  // AI TOGGLE
  // =========================================================================

  /** Get the current AI auto-reply status */
  getAiStatus: ownerProcedure.query(() => {
    return { enabled: isAiRepliesEnabled() };
  }),

  /** Enable or disable AI auto-replies for incoming SMS */
  setAiEnabled: ownerProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(({ input }) => {
      setAiRepliesEnabled(input.enabled);
      return { enabled: isAiRepliesEnabled() };
    }),

  /** Send a custom one-off blast to all active registrants for a schedule */
  sendCustomBlast: ownerProcedure
    .input(z.object({
      scheduleId: z.number(),
      message: z.string().min(1).max(300),
    }))
    .mutation(async ({ input }) => {
      const { sendBlast } = await import('../webinar-cron');
      return sendBlast(input.scheduleId, input.message, 'manual', 'custom blast');
    }),

  /** Get editable message templates for a schedule */
  getMessageTemplates: ownerProcedure
    .input(z.object({ scheduleId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const [schedule] = await db.select().from(webinarSchedules).where(eq(webinarSchedules.id, input.scheduleId)).limit(1);
      if (!schedule) throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });

      // Default templates
      const defaults: Record<string, string> = {
        noonEngagement: 'Hey {{firstName}}! Coach Inayah goes LIVE at 4 PM PT / 7 PM ET today. What are you most excited to learn about?',
        twoHourReminder: 'We are 2 HOURS AWAY! Are you ready? Save your link: {{liveRoomUrl}}',
        oneHourReminder: '1 hour warning!!! I am so excited to see you! {{liveRoomUrl}}',
        fifteenMinReminder: 'Get your water, energy drink, paper and pen ready! We have 15 minutes until we are LIVE!\n{{liveRoomUrl}}',
        liveNow: 'we are live !!! LETSGOOOOO!\n{{liveRoomUrl}}',
        noShowBlast: 'You\'re missing out! Coach Inayah is LIVE right now. Jump in: {{liveRoomUrl}}',
        attendeeCta: 'Hey {{firstName}} it\'s Inayah. Ready to launch your first Airbnb w/o owning property? I opened a few Turnkey spots. Grab a free call here: https://masterclass.coachinayah.com/the-turnkey-program',
      };

      // Merge saved overrides with defaults
      let saved: Record<string, string> = {};
      try {
        if (schedule.messageTemplates) {
          saved = JSON.parse(schedule.messageTemplates);
        }
      } catch { /* ignore parse errors */ }

      return Object.entries(defaults).map(([key, defaultMsg]) => ({
        key,
        message: saved[key] ?? defaultMsg,
        isCustom: !!saved[key],
      }));
    }),

  /** Update a single message template for a schedule */
  updateMessageTemplate: ownerProcedure
    .input(z.object({
      scheduleId: z.number(),
      key: z.string(),
      message: z.string().min(1).max(500),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      const [schedule] = await db.select().from(webinarSchedules).where(eq(webinarSchedules.id, input.scheduleId)).limit(1);
      if (!schedule) throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });

      let saved: Record<string, string> = {};
      try {
        if (schedule.messageTemplates) {
          saved = JSON.parse(schedule.messageTemplates);
        }
      } catch { /* ignore */ }

      saved[input.key] = input.message;

      await db.update(webinarSchedules)
        .set({ messageTemplates: JSON.stringify(saved) })
        .where(eq(webinarSchedules.id, input.scheduleId));

      return { success: true, key: input.key };
    }),

  /** Send a test SMS to the owner for a specific blast template */
  testSendBlast: ownerProcedure
    .input(z.object({
      scheduleId: z.number(),
      blastKey: z.string(),
      phone: z.string().min(10),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      // Get the schedule for link and name
      const [schedule] = await db.select().from(webinarSchedules).where(eq(webinarSchedules.id, input.scheduleId)).limit(1);
      if (!schedule) throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });

      // Get the template (DB override or default)
      const defaults: Record<string, string> = {
        noonEngagement: 'Hey {{firstName}}! Coach Inayah goes LIVE at 4 PM PT / 7 PM ET today. What are you most excited to learn about?',
        twoHourReminder: 'We are 2 HOURS AWAY! Are you ready? Save your link: {{liveRoomUrl}}',
        oneHourReminder: '1 hour warning!!! I am so excited to see you! {{liveRoomUrl}}',
        fifteenMinReminder: 'Get your water, energy drink, paper and pen ready! We have 15 minutes until we are LIVE!\n{{liveRoomUrl}}',
        liveNow: 'we are live !!! LETSGOOOOO!\n{{liveRoomUrl}}',
        noShowBlast: 'You\'re missing out! Coach Inayah is LIVE right now. Jump in: {{liveRoomUrl}}',
        attendeeCta: 'Hey {{firstName}} it\'s Inayah. Ready to launch your first Airbnb w/o owning property? I opened a few Turnkey spots. Grab a free call here: https://masterclass.coachinayah.com/the-turnkey-program',
      };

      let saved: Record<string, string> = {};
      try {
        if (schedule.messageTemplates) saved = JSON.parse(schedule.messageTemplates);
      } catch { /* ignore */ }

      const template = saved[input.blastKey] ?? defaults[input.blastKey];
      if (!template) throw new TRPCError({ code: 'BAD_REQUEST', message: `Unknown blast key: ${input.blastKey}` });

      // Personalize with test values
      const liveUrl = schedule.liveRoomUrl || '(no link set)';
      let message = template
        .replace(/\{\{firstName\}\}/g, 'Test')
        .replace(/\{\{webinarName\}\}/g, schedule.name)
        .replace(/\{\{liveRoomUrl\}\}/g, liveUrl)
        .replace(/\{\{startTime\}\}/g, '4 PM PT / 7 PM ET');

      // Strip emoji and enforce limit
      message = message.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').replace(/\s{2,}/g, ' ').trim();
      if (message.length > 160) message = message.substring(0, 157) + '...';

      // Send via SimpleTexting
      const { sendSms } = await import('../simpletexting-client');
      const result = await sendSms({ contactPhone: input.phone, text: message, mode: 'SINGLE_SMS_STRICTLY' });

      return { success: true, message, externalId: result.id };
    }),

  /** Get delivery stats per blast type for today */
  getBlastTypeStats: ownerProcedure
    .input(z.object({ scheduleId: z.number().optional() }))
    .query(async () => {
      const db = await getDb();
      if (!db) return {};

      // Get today's start in UTC
      const now = new Date();
      const pstOffset = -8 * 60; // PST = UTC-8
      const pstNow = new Date(now.getTime() + pstOffset * 60000);
      const todayStart = new Date(pstNow.getFullYear(), pstNow.getMonth(), pstNow.getDate());
      const todayStartUtc = new Date(todayStart.getTime() - pstOffset * 60000);

      const rows = await db.select({
        messageType: smsConversations.messageType,
        count: sql<number>`COUNT(*)`,
      })
        .from(smsConversations)
        .where(and(
          eq(smsConversations.direction, 'outbound'),
          sql`${smsConversations.createdAt} >= ${todayStartUtc}`,
        ))
        .groupBy(smsConversations.messageType);

      const stats: Record<string, number> = {};
      for (const row of rows) {
        stats[row.messageType] = Number(row.count);
      }
      return stats;
    }),

  /** Create a schedule from just a WebinarJam Webinar ID — auto-pulls everything */
  createFromWebinarJam: ownerProcedure
    .input(z.object({ webinarId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

      // 1. Fetch webinar details from WebinarJam
      let webinar;
      try {
        webinar = await getWebinar(input.webinarId);
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Could not find webinar with ID ${input.webinarId}. Check the ID and try again.`,
        });
      }

      if (!webinar.schedules || webinar.schedules.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This webinar has no schedules in WebinarJam.',
        });
      }

      // Use the first (or most recent) schedule
      const wjSchedule = webinar.schedules[webinar.schedules.length - 1];

      // Parse the date to determine day of week
      let dayOfWeek = 0; // default Sunday
      let startTime = '16:00'; // default 4 PM
      try {
        if (wjSchedule.date) {
          const dateObj = new Date(wjSchedule.date);
          if (!isNaN(dateObj.getTime())) {
            dayOfWeek = dateObj.getDay();
          }
        }
        if (wjSchedule.time) {
          // WebinarJam time format varies: "4:00 PM", "16:00", etc.
          const timeStr = wjSchedule.time.trim();
          const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
          const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
          if (match24) {
            startTime = `${match24[1].padStart(2, '0')}:${match24[2]}`;
          } else if (match12) {
            let hour = parseInt(match12[1]);
            const isPM = match12[3].toUpperCase() === 'PM';
            if (isPM && hour !== 12) hour += 12;
            if (!isPM && hour === 12) hour = 0;
            startTime = `${String(hour).padStart(2, '0')}:${match12[2]}`;
          }
        }
      } catch {
        // Use defaults if parsing fails
      }

      // Auto-inject the permanent transcript
      let transcript: string | null = null;
      try {
        transcript = await getTranscript();
      } catch {
        console.warn('[WebinarRouter] Could not load permanent transcript for auto-create');
      }

      // 2. Create the schedule in our database
      const [result] = await db.insert(webinarSchedules).values({
        name: webinar.name || `Webinar ${input.webinarId}`,
        dayOfWeek,
        startTime,
        timezone: wjSchedule.timezone || 'America/New_York',
        liveRoomUrl: null,
        noShowTeaser: null,
        webinarTranscript: transcript,
        webinarjamWebinarId: String(input.webinarId),
        webinarjamScheduleId: String(wjSchedule.schedule),
        isActive: 1,
      }).$returningId();

      const scheduleId = result.id;

      // 3. Auto-generate teasers
      if (transcript) {
        try {
          await generateAndCacheTeasers(scheduleId);
        } catch (error) {
          console.error(`[WebinarRouter] Failed to auto-generate teasers:`, error);
        }
      }

      // 4. Auto-sync registrants
      let syncResult = null;
      try {
        syncResult = await syncRegistrants(scheduleId);
        console.log(`[WebinarRouter] Auto-synced ${syncResult.synced} registrants for schedule ${scheduleId}`);
      } catch (error) {
        console.error(`[WebinarRouter] Failed to auto-sync registrants:`, error);
      }

      return {
        id: scheduleId,
        success: true,
        webinarName: webinar.name,
        scheduleDate: wjSchedule.date,
        scheduleTime: wjSchedule.time,
        wjScheduleId: String(wjSchedule.schedule),
        registrantsSynced: syncResult?.synced ?? 0,
        totalSchedulesInWJ: webinar.schedules.length,
      };
    }),

  /** Check if current user is the owner (used by frontend to show/hide webinar nav) */
  isOwner: protectedProcedure.query(({ ctx }) => {
    const ownerOpenId = ENV.ownerOpenId;
    return { isOwner: !!ownerOpenId && ctx.user.openId === ownerOpenId };
  }),
});

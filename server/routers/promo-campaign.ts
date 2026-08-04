/**
 * Promo Drip Campaign router — admin operations for multi-day promo sequences
 * (email via HubSpot SMTP + SMS via SimpleTexting) sent to a frozen snapshot
 * of a HubSpot list.
 *
 * Lifecycle: createAffiliateCampaign (draft, seeded content) → buildSnapshot
 * (audience preview) → sendTestEmail / sendTestSms → launchCampaign (schedules
 * every step) → the promo dispatcher (scheduled-handlers → promo-dispatcher)
 * does the sending. cancelCampaign stops everything still pending.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  promoDripCampaigns,
  promoDripMessages,
  promoDripRecipients,
  promoDripSendLog,
  webinarRegistrants,
} from "../../drizzle/schema";
import { adminProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { plainTextToEmailHtml, sendWebinarEmail } from "../hubspot-smtp";
import { sendSms } from "./webinar-sms";
import {
  AFFILIATE_ARBITRAGE_CAMPAIGN_NAME,
  AFFILIATE_ARBITRAGE_LIST_ID,
  AFFILIATE_ARBITRAGE_LIST_NAME,
  AFFILIATE_ARBITRAGE_STEPS,
} from "../promo/promo-content";
import { buildAudienceSnapshot, snapshotProgress } from "../promo/promo-snapshot";
import { applyTrackedHrefs, buildTrackedPromoContent, getPromoEngagement, openPixelHtml } from "../promo/promo-tracking";
import { computeStepScheduledAt, zonedCalendarDate } from "../promo/promo-time";
import { buildPromoUnsubscribeUrl, normalizePromoPhone, renderPromoVars } from "../promo/promo-util";
import { PROMO_POSTAL_ADDRESS } from "../promo/promo-content";

const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

async function requireCampaign(db: any, campaignId: number) {
  const [campaign] = await db.select().from(promoDripCampaigns).where(eq(promoDripCampaigns.id, campaignId));
  if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: `Campaign ${campaignId} not found` });
  return campaign;
}

async function requireMessage(db: any, messageId: number) {
  const [message] = await db.select().from(promoDripMessages).where(eq(promoDripMessages.id, messageId));
  if (!message) throw new TRPCError({ code: "NOT_FOUND", message: `Message ${messageId} not found` });
  return message;
}

export const promoCampaignRouter = router({
  // ── Read ──────────────────────────────────────────────────────────────────
  listCampaigns: adminProcedure.query(async () => {
    const db = await requireDb();
    return db.select().from(promoDripCampaigns).orderBy(asc(promoDripCampaigns.id));
  }),

  getCampaign: adminProcedure.input(z.object({ campaignId: z.number().int().positive() })).query(async ({ input }) => {
    const db = await requireDb();
    const campaign = await requireCampaign(db, input.campaignId);

    const messages = await db
      .select()
      .from(promoDripMessages)
      .where(eq(promoDripMessages.campaignId, input.campaignId))
      .orderBy(asc(promoDripMessages.sequenceOrder));

    const [recipientStats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        eligible: sql<number>`SUM(CASE WHEN ${promoDripRecipients.excludedAt} IS NULL AND ${promoDripRecipients.unsubscribedAt} IS NULL THEN 1 ELSE 0 END)`,
        excludedWebinar: sql<number>`SUM(CASE WHEN ${promoDripRecipients.excludedReason} = 'upcoming_webinar' THEN 1 ELSE 0 END)`,
        excludedNoContact: sql<number>`SUM(CASE WHEN ${promoDripRecipients.excludedReason} = 'no_email_no_phone' THEN 1 ELSE 0 END)`,
        excludedDuplicate: sql<number>`SUM(CASE WHEN ${promoDripRecipients.excludedReason} = 'duplicate_email' THEN 1 ELSE 0 END)`,
        unsubscribed: sql<number>`SUM(CASE WHEN ${promoDripRecipients.unsubscribedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
        smsEligible: sql<number>`SUM(CASE WHEN ${promoDripRecipients.excludedAt} IS NULL AND ${promoDripRecipients.unsubscribedAt} IS NULL AND ${promoDripRecipients.phoneValid} = 1 THEN 1 ELSE 0 END)`,
        emailEligible: sql<number>`SUM(CASE WHEN ${promoDripRecipients.excludedAt} IS NULL AND ${promoDripRecipients.unsubscribedAt} IS NULL AND ${promoDripRecipients.email} IS NOT NULL THEN 1 ELSE 0 END)`,
      })
      .from(promoDripRecipients)
      .where(eq(promoDripRecipients.campaignId, input.campaignId));

    // "Getting texts" must respect STOP replies recorded by the webinar
    // system — same suppression the dispatcher applies at send time.
    const optedRows: Array<{ phone: string }> = await db
      .select({ phone: webinarRegistrants.phone })
      .from(webinarRegistrants)
      .where(eq(webinarRegistrants.optedOut, 1));
    const optedSet = new Set(optedRows.map((r) => normalizePromoPhone(r.phone)).filter((p) => p.length === 10));
    const activePhones: Array<{ phone: string }> = await db
      .select({ phone: promoDripRecipients.phone })
      .from(promoDripRecipients)
      .where(
        and(
          eq(promoDripRecipients.campaignId, input.campaignId),
          isNull(promoDripRecipients.excludedAt),
          isNull(promoDripRecipients.unsubscribedAt),
          eq(promoDripRecipients.phoneValid, 1)
        )
      );
    const smsEligible = activePhones.filter((r) => !optedSet.has(r.phone)).length;

    // Per-step opens/clicks from the tracked-link rows (test sends excluded)
    const engagement = await getPromoEngagement(db, input.campaignId);
    const messagesWithEngagement = messages.map((m: any) => ({
      ...m,
      engagement: engagement.get(m.stepKey) ?? null,
    }));

    return {
      campaign,
      messages: messagesWithEngagement,
      recipientStats: {
        total: Number(recipientStats?.total ?? 0),
        eligible: Number(recipientStats?.eligible ?? 0),
        excludedWebinar: Number(recipientStats?.excludedWebinar ?? 0),
        excludedNoContact: Number(recipientStats?.excludedNoContact ?? 0),
        excludedDuplicate: Number(recipientStats?.excludedDuplicate ?? 0),
        unsubscribed: Number(recipientStats?.unsubscribed ?? 0),
        smsEligible,
        emailEligible: Number(recipientStats?.emailEligible ?? 0),
      },
    };
  }),

  // ── Create / snapshot ─────────────────────────────────────────────────────
  createAffiliateCampaign: adminProcedure.mutation(async () => {
    const db = await requireDb();

    // One live copy of this campaign at a time — return the existing one.
    const existing = await db
      .select()
      .from(promoDripCampaigns)
      .where(
        and(
          eq(promoDripCampaigns.name, AFFILIATE_ARBITRAGE_CAMPAIGN_NAME),
          inArray(promoDripCampaigns.status, ["draft", "active"])
        )
      );
    if (existing.length > 0) {
      return { campaignId: existing[0].id, created: false };
    }

    const insertRes = await db.insert(promoDripCampaigns).values({
      name: AFFILIATE_ARBITRAGE_CAMPAIGN_NAME,
      status: "draft",
      hubspotListId: AFFILIATE_ARBITRAGE_LIST_ID,
      hubspotListName: AFFILIATE_ARBITRAGE_LIST_NAME,
    });
    const campaignId = Number((insertRes as any)[0]?.insertId ?? (insertRes as any).insertId);
    if (!campaignId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create campaign" });

    await db.insert(promoDripMessages).values(
      AFFILIATE_ARBITRAGE_STEPS.map((step) => ({
        campaignId,
        channel: step.channel,
        stepKey: step.stepKey,
        sequenceOrder: step.sequenceOrder,
        dayOffset: step.dayOffset,
        sendTimeEt: step.sendTimeEt,
        subject: step.subject ?? null,
        body: step.body,
      }))
    );

    return { campaignId, created: true };
  }),

  buildSnapshot: adminProcedure.input(z.object({ campaignId: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await requireDb();
    if (snapshotProgress.running) {
      throw new TRPCError({ code: "CONFLICT", message: "A snapshot build is already in progress" });
    }
    if (!ENV.hubspotApiKey) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "HUBSPOT_API_KEY is not configured on this server" });
    }
    try {
      const result = await buildAudienceSnapshot(db, input.campaignId);
      return result;
    } catch (err: any) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err?.message || "Snapshot build failed" });
    }
  }),

  getSnapshotProgress: adminProcedure.query(() => snapshotProgress),

  // ── Edit content (draft campaign, or still-pending step) ──────────────────
  updateMessage: adminProcedure
    .input(
      z.object({
        messageId: z.number().int().positive(),
        subject: z.string().trim().min(1, "Subject can't be empty").max(500).optional(),
        body: z.string().min(10).max(10000).optional(),
        sendTimeEt: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "sendTimeEt must be HH:MM 24h")
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const message = await requireMessage(db, input.messageId);
      const campaign = await requireCampaign(db, message.campaignId);

      const editable = campaign.status === "draft" || (campaign.status === "active" && message.status === "pending");
      if (!editable) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This step can't be edited (campaign ${campaign.status}, step ${message.status})`,
        });
      }

      const set: Record<string, unknown> = {};
      if (input.subject !== undefined) set.subject = input.subject;
      if (input.body !== undefined) set.body = input.body;
      if (input.sendTimeEt !== undefined) set.sendTimeEt = input.sendTimeEt;
      if (Object.keys(set).length === 0) return { updated: false };

      await db.update(promoDripMessages).set(set).where(eq(promoDripMessages.id, input.messageId));
      return { updated: true };
    }),

  // ── Test sends ────────────────────────────────────────────────────────────
  sendTestEmail: adminProcedure
    .input(z.object({ messageId: z.number().int().positive(), to: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const message = await requireMessage(db, input.messageId);
      if (message.channel !== "email") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This step is an SMS step — use Send Test SMS" });
      }
      if (!ENV.appUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "VITE_APP_URL is not configured — unsubscribe links can't be built" });
      }

      const firstName = ctx.user?.name?.split(" ")[0] || "there";
      const body = renderPromoVars(message.body, { firstName });
      const subject = `[TEST] ${renderPromoVars(message.subject || message.stepKey, { firstName })}`;
      const unsubUrl = buildPromoUnsubscribeUrl(ENV.appUrl, message.campaignId, input.to);
      // Tracked like a real send (tagged as test — excluded from step stats)
      const trackedContent = await buildTrackedPromoContent(db, {
        campaignId: message.campaignId,
        stepKey: message.stepKey,
        channel: "email",
        recipientEmail: input.to,
        body,
        isTest: true,
      });
      let html = plainTextToEmailHtml(trackedContent.body);
      html = applyTrackedHrefs(html, trackedContent.hrefMap);
      // Same footer as real sends so the test is a faithful preview.
      const pixel = trackedContent.openCode ? openPixelHtml(trackedContent.openCode) : "";
      html = html.replace(
        "</body></html>",
        `${pixel}<p style="margin:24px 0 0;font-size:12px;color:#64748b;">${PROMO_POSTAL_ADDRESS}<br>Don't want these emails? <a href="${unsubUrl}" style="color:#64748b;">Unsubscribe</a></p></body></html>`
      );

      const result = await sendWebinarEmail({
        to: input.to,
        subject,
        html,
        headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Test email failed: ${result.error}` });
      }
      return { success: true, messageId: result.messageId };
    }),

  sendTestSms: adminProcedure
    .input(z.object({ messageId: z.number().int().positive(), phone: z.string().min(10).max(20) }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const message = await requireMessage(db, input.messageId);
      if (message.channel !== "sms") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This step is an email step — use Send Test Email" });
      }
      const rendered = renderPromoVars(message.body, { firstName: "there" });
      const trackedSms = await buildTrackedPromoContent(db, {
        campaignId: message.campaignId,
        stepKey: message.stepKey,
        channel: "sms",
        recipientEmail: null,
        body: rendered,
        isTest: true,
      });
      const result = await sendSms(input.phone, trackedSms.body);
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Test SMS failed: ${result.error}` });
      }
      return { success: true, smsId: result.smsId };
    }),

  // ── Launch / cancel / retry ───────────────────────────────────────────────
  launchCampaign: adminProcedure.input(z.object({ campaignId: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await requireDb();
    const campaign = await requireCampaign(db, input.campaignId);

    if (campaign.status !== "draft") {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Campaign is ${campaign.status}, only drafts can launch` });
    }
    if (!campaign.snapshotAt) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Build the audience snapshot before launching" });
    }
    if (Date.now() - new Date(campaign.snapshotAt).getTime() > SNAPSHOT_MAX_AGE_MS) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Audience snapshot is older than 24h — rebuild it so the webinar exclusions are current",
      });
    }
    if (campaign.eligibleCount <= 0 && campaign.smsEligibleCount <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Snapshot has zero eligible recipients" });
    }
    if (!ENV.appUrl) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "VITE_APP_URL is not configured — unsubscribe links can't be built" });
    }

    const messages = await db
      .select()
      .from(promoDripMessages)
      .where(eq(promoDripMessages.campaignId, input.campaignId));
    if (messages.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Campaign has no steps" });
    }

    const launchAt = new Date();
    const scheduled = messages.map((message: any) => ({
      id: message.id,
      channel: message.channel,
      scheduledAt: computeStepScheduledAt(launchAt, {
        channel: message.channel,
        dayOffset: message.dayOffset,
        sendTimeEt: message.sendTimeEt,
      }),
    }));

    // A quiet-hours-clamped day-0 SMS can land on the same ET day as the next
    // SMS step — space same-day texts at least 3h apart (still inside the
    // nationwide window: 14:00 + 3h = 17:00 ET = 11am Hawaii).
    const smsSteps = scheduled
      .filter((s: any) => s.channel === "sms")
      .sort((a: any, b: any) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    const MIN_SMS_GAP_MS = 3 * 60 * 60 * 1000;
    for (let i = 1; i < smsSteps.length; i++) {
      const prev = smsSteps[i - 1];
      const cur = smsSteps[i];
      const sameEtDay =
        JSON.stringify(zonedCalendarDate("America/New_York", prev.scheduledAt)) ===
        JSON.stringify(zonedCalendarDate("America/New_York", cur.scheduledAt));
      if (sameEtDay && cur.scheduledAt.getTime() - prev.scheduledAt.getTime() < MIN_SMS_GAP_MS) {
        cur.scheduledAt = new Date(prev.scheduledAt.getTime() + MIN_SMS_GAP_MS);
      }
    }

    for (const step of scheduled) {
      await db
        .update(promoDripMessages)
        .set({ scheduledAt: step.scheduledAt, status: "pending" })
        .where(eq(promoDripMessages.id, step.id));
    }

    await db
      .update(promoDripCampaigns)
      .set({ status: "active", launchedAt: launchAt })
      .where(and(eq(promoDripCampaigns.id, input.campaignId), eq(promoDripCampaigns.status, "draft")));

    return { launched: true, launchedAt: launchAt, steps: messages.length };
  }),

  cancelCampaign: adminProcedure.input(z.object({ campaignId: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await requireDb();
    await requireCampaign(db, input.campaignId);

    const res = await db
      .update(promoDripMessages)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(promoDripMessages.campaignId, input.campaignId),
          inArray(promoDripMessages.status, ["pending", "sending"])
        )
      );
    await db
      .update(promoDripCampaigns)
      .set({ status: "cancelled" })
      .where(and(eq(promoDripCampaigns.id, input.campaignId), inArray(promoDripCampaigns.status, ["draft", "active"])));

    return { cancelled: true, stepsCancelled: (res as any)[0]?.affectedRows ?? 0 };
  }),

  retryStep: adminProcedure.input(z.object({ messageId: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await requireDb();
    const message = await requireMessage(db, input.messageId);
    const campaign = await requireCampaign(db, message.campaignId);
    if (campaign.status !== "active") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Campaign is not active" });
    }
    if (message.status !== "failed" && message.status !== "cancelled") {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Only failed/cancelled steps can be retried (step is ${message.status})` });
    }
    // Re-open FAILED sends so the retry actually re-attempts them. Sent and
    // skipped rows stay — their claims make re-sends impossible. (Rows failed
    // as "unknown outcome" after a crash may re-send on retry; that tradeoff
    // is deliberate and admin-initiated.)
    const reopened = await db
      .delete(promoDripSendLog)
      .where(and(eq(promoDripSendLog.messageId, input.messageId), eq(promoDripSendLog.status, "failed")));
    // Re-arm for the next dispatcher tick.
    await db
      .update(promoDripMessages)
      .set({ status: "pending", scheduledAt: new Date(), error: null, claimedAt: null })
      .where(eq(promoDripMessages.id, input.messageId));
    return { retried: true, reopenedSends: (reopened as any)[0]?.affectedRows ?? 0 };
  }),

  // ── Manual dispatcher tick (testing with Manus / debugging) ───────────────
  runDispatchNow: adminProcedure.mutation(async () => {
    const { runScheduledPromoDispatch } = await import("../promo/promo-dispatcher");
    return runScheduledPromoDispatch();
  }),
});

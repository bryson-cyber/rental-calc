/**
 * SMS Dispatcher V2 — Exact-Time Blast Dispatch
 *
 * Architecture:
 * - Look-ahead scheduler: arms setTimeout for messages due within 90s
 * - Atomic per-message claim: UPDATE WHERE status='pending' AND claimedAt IS NULL
 * - 50-worker sliding window: concurrent sends with incremental flushing
 * - Watchdog: detects crashed blasts (no delivery progress for 10min) and marks failed
 * - Both FORCE_CRON and heartbeat paths use the same core
 */

import { eq, and, lte, sql, count, isNull } from "drizzle-orm";
import {
  scheduledSmsMessages,
  webinarSmsCampaigns,
  webinarSmsDeliveries,
  webinarRegistrants,
  webinarCredentials,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { notifyOwner } from "../_core/notification";
import { buildPersonalizationVars, personalizationFromMetadata } from "../webinar-personalization";

// ─── Module-level state ──────────────────────────────────────────────────────
const armedSmsTimers = new Map<number, NodeJS.Timeout>();
const SMS_LOOKAHEAD_MS = 90_000;
const SMS_SEND_CONCURRENCY = 50;
// Max time a "sending" message may go without any delivery-flush progress
// before the watchdog treats it as a crashed process (see failStuckMessages).
const SMS_STUCK_SENDING_MS = 10 * 60 * 1000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Dependency injection types ──────────────────────────────────────────────
type SendSmsFn = (phone: string, message: string) => Promise<{ success: boolean; smsId?: string; error?: string }>;
type NormalizePhoneFn = (phone: string) => string;
type RenderMessageFn = (template: string, vars: Record<string, string>) => string;
type HasUnfilledPlaceholdersFn = (messageBody: string) => string | null;
type FetchWebinarJamRegistrantsFn = (webinarId: string, scheduleId?: number, page?: number, overrideApiKey?: string) => Promise<{ registrants: any[]; hasMore: boolean }>;
type FetchWebinarJamDetailsFn = (webinarId: string, overrideApiKey?: string) => Promise<any>;
type GetRecipientsForMessageFn = (db: any, msg: { webinarId: string; audience: string }) => Promise<Array<{ id: number; name: string; email: string | null; phone: string; metadata?: unknown }>>;

let _sendSms: SendSmsFn;
let _normalizePhone: NormalizePhoneFn;
let _renderMessage: RenderMessageFn;
let _hasUnfilledPlaceholders: HasUnfilledPlaceholdersFn;
let _fetchWebinarJamRegistrants: FetchWebinarJamRegistrantsFn;
let _fetchWebinarJamDetails: FetchWebinarJamDetailsFn;
let _getRecipientsForMessage: GetRecipientsForMessageFn;
let _cancelledScheduledMessageIds: Set<number>;

export function initDispatcherV2(deps: {
  sendSms: SendSmsFn;
  normalizePhone: NormalizePhoneFn;
  renderMessage: RenderMessageFn;
  hasUnfilledPlaceholders: HasUnfilledPlaceholdersFn;
  fetchWebinarJamRegistrants: FetchWebinarJamRegistrantsFn;
  fetchWebinarJamDetails: FetchWebinarJamDetailsFn;
  getRecipientsForMessage: GetRecipientsForMessageFn;
  cancelledScheduledMessageIds: Set<number>;
}) {
  _sendSms = deps.sendSms;
  _normalizePhone = deps.normalizePhone;
  _renderMessage = deps.renderMessage;
  _hasUnfilledPlaceholders = deps.hasUnfilledPlaceholders;
  _fetchWebinarJamRegistrants = deps.fetchWebinarJamRegistrants;
  _fetchWebinarJamDetails = deps.fetchWebinarJamDetails;
  _getRecipientsForMessage = deps.getRecipientsForMessage;
  _cancelledScheduledMessageIds = deps.cancelledScheduledMessageIds;
}

// ─── Watchdog ────────────────────────────────────────────────────────────────

async function failStuckMessages(db: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<void> {
  const cutoff = new Date(Date.now() - SMS_STUCK_SENDING_MS);

  // claimedAt is refreshed on every delivery flush (see deliveryFlusher), so
  // "claimedAt older than 10 min while still sending" means NO delivery progress
  // for 10 min — a crashed/restarted process, not merely a long-running blast.
  // A live blast of any size keeps bumping claimedAt and never trips this.
  const stuck = await db
    .select()
    .from(scheduledSmsMessages)
    .where(and(eq(scheduledSmsMessages.status, "sending"), lte(scheduledSmsMessages.claimedAt, cutoff)));

  // Legacy rows with NULL claimedAt stuck in "sending"
  const legacyStuck = await db
    .select()
    .from(scheduledSmsMessages)
    .where(and(eq(scheduledSmsMessages.status, "sending"), isNull(scheduledSmsMessages.claimedAt), lte(scheduledSmsMessages.scheduledAt, cutoff)));

  const allStuck = [...stuck, ...legacyStuck];

  for (const msg of allStuck) {
    const res = await db
      .update(scheduledSmsMessages)
      .set({
        status: "failed",
        error: "No delivery progress for 10 minutes — process likely restarted mid-blast (watchdog)",
        sentAt: new Date(),
      })
      .where(and(eq(scheduledSmsMessages.id, msg.id), eq(scheduledSmsMessages.status, "sending")));

    if ((res as any)[0]?.affectedRows === 0) continue;

    await closeOrphanedCampaign(db, msg.id);

    await notifyOwner({
      title: `⚠️ SMS Watchdog: "${msg.sequenceName}" did not complete`,
      content: `Message #${msg.id} was stuck in "sending" for >10min (likely a mid-send restart).\nPartial delivery counts are on the campaign record — check before any manual resend.`,
    }).catch(() => {});

    console.log(`[SMS Watchdog] Failed stuck message #${msg.id} "${msg.sequenceName}" (claimedAt: ${msg.claimedAt})`);
  }
}

async function closeOrphanedCampaign(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, scheduledMessageId: number): Promise<void> {
  try {
    const campaigns = await db
      .select({ id: webinarSmsCampaigns.id })
      .from(webinarSmsCampaigns)
      .where(sql`JSON_EXTRACT(${webinarSmsCampaigns.filterCriteria}, '$.scheduledMessageId') = ${scheduledMessageId}`);

    for (const campaign of campaigns) {
      const [sentDeliveries] = await db
        .select({ cnt: count() })
        .from(webinarSmsDeliveries)
        .where(and(eq(webinarSmsDeliveries.campaignId, campaign.id), eq(webinarSmsDeliveries.deliveryStatus, "sent")));
      const [failedDeliveries] = await db
        .select({ cnt: count() })
        .from(webinarSmsDeliveries)
        .where(and(eq(webinarSmsDeliveries.campaignId, campaign.id), eq(webinarSmsDeliveries.deliveryStatus, "failed")));

      const actualSent = Number(sentDeliveries?.cnt ?? 0);
      const actualFailed = Number(failedDeliveries?.cnt ?? 0);

      await db.update(webinarSmsCampaigns).set({ sentCount: actualSent, failedCount: actualFailed, status: "failed", completedAt: new Date() }).where(eq(webinarSmsCampaigns.id, campaign.id));
      await db.update(scheduledSmsMessages).set({ sentCount: actualSent, failedCount: actualFailed }).where(eq(scheduledSmsMessages.id, scheduledMessageId));
    }
  } catch (err: any) {
    console.error(`[SMS Watchdog] Error closing orphaned campaign for message ${scheduledMessageId}:`, err.message);
  }
}

// ─── Atomic Claim ────────────────────────────────────────────────────────────

async function claimScheduledMessage(msgId: number): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const claim = await db
    .update(scheduledSmsMessages)
    .set({ status: "sending", claimedAt: now })
    .where(and(eq(scheduledSmsMessages.id, msgId), eq(scheduledSmsMessages.status, "pending"), lte(scheduledSmsMessages.scheduledAt, new Date(now.getTime() + 1000))));

  if (((claim as any)[0]?.affectedRows ?? 0) === 0) return null;

  const [msg] = await db.select().from(scheduledSmsMessages).where(eq(scheduledSmsMessages.id, msgId));
  return msg ?? null;
}

// ─── Fire Message Group ──────────────────────────────────────────────────────

async function fireMessageGroup(msgIds: number[]): Promise<void> {
  for (const id of msgIds) {
    const msg = await claimScheduledMessage(id);
    if (!msg) continue;

    const db = await getDb();
    if (!db) continue;

    dispatchSingleMessage(db, msg, new Date()).catch((err) => console.error(`[SMS Dispatch] message ${id} blast failed:`, err));
  }
}

// ─── Look-ahead Scheduler ────────────────────────────────────────────────────

export async function runScheduledDispatchV2(): Promise<{ armed: number; firedNow: number; skipped: boolean }> {
  const db = await getDb();
  if (!db) return { armed: 0, firedNow: 0, skipped: true };

  await failStuckMessages(db);

  const now = Date.now();
  const horizon = new Date(now + SMS_LOOKAHEAD_MS);

  const upcoming = await db
    .select()
    .from(scheduledSmsMessages)
    .where(and(eq(scheduledSmsMessages.status, "pending"), lte(scheduledSmsMessages.scheduledAt, horizon)))
    .orderBy(scheduledSmsMessages.scheduledAt, scheduledSmsMessages.sequenceOrder);

  const unarmed = upcoming.filter((m) => !armedSmsTimers.has(m.id));
  if (unarmed.length === 0) return { armed: 0, firedNow: 0, skipped: false };

  const dueNow = unarmed.filter((m) => new Date(m.scheduledAt).getTime() <= now);
  const future = unarmed.filter((m) => new Date(m.scheduledAt).getTime() > now);

  // Group future by exact scheduledAt
  const byTime = new Map<number, typeof unarmed>();
  for (const m of future) {
    const t = new Date(m.scheduledAt).getTime();
    const arr = byTime.get(t);
    if (arr) arr.push(m);
    else byTime.set(t, [m]);
  }

  const groups: Array<{ delay: number; msgs: typeof unarmed }> = [];
  if (dueNow.length > 0) groups.push({ delay: 0, msgs: dueNow });
  byTime.forEach((msgs, t) => groups.push({ delay: t - now, msgs }));

  let armed = 0;
  let firedNow = 0;

  for (const g of groups) {
    const ids = g.msgs.map((m) => m.id);
    const timer = setTimeout(() => {
      for (const id of ids) armedSmsTimers.delete(id);
      fireMessageGroup(ids).catch((err) => console.error(`[SMS Dispatch] group [${ids.join(",")}] crashed:`, err));
    }, g.delay);

    for (const id of ids) armedSmsTimers.set(id, timer);

    if (g.delay === 0) {
      firedNow += ids.length;
      console.log(`[SMS Dispatch] Firing ${ids.length} due message(s) NOW: [${ids.join(",")}]`);
    } else {
      armed += ids.length;
      console.log(`[SMS Dispatch] Armed ${ids.length} message(s) for +${Math.round(g.delay / 1000)}s: [${ids.join(",")}]`);
    }
  }

  return { armed, firedNow, skipped: false };
}

// ─── Dispatch Single Message (sliding-window blast) ──────────────────────────

async function dispatchSingleMessage(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, msg: any, now: Date): Promise<void> {
  const scheduledTime = new Date(msg.scheduledAt).getTime();

  // Skip stale (>30 min overdue)
  const staleThresholdMs = 30 * 60 * 1000;
  if (now.getTime() - scheduledTime > staleThresholdMs) {
    console.log(`[SMS Dispatch] Skipping stale message #${msg.id} "${msg.sequenceName}" (${Math.round((now.getTime() - scheduledTime) / 60000)}min overdue)`);
    await db.update(scheduledSmsMessages).set({ status: "cancelled", sentAt: new Date() }).where(eq(scheduledSmsMessages.id, msg.id));
    notifyOwner({ title: `⚠️ Stale Message Skipped: ${msg.sequenceName}`, content: `Message #${msg.id} was ${Math.round((now.getTime() - scheduledTime) / 60000)} minutes overdue and was cancelled.` }).catch(() => {});
    return;
  }

  // GUARD: unfilled placeholders
  const unfilledPlaceholder = _hasUnfilledPlaceholders(msg.messageBody);
  if (unfilledPlaceholder) {
    console.error(`[SMS Dispatch] BLOCKED: Message #${msg.id} "${msg.sequenceName}" contains unfilled placeholder ${unfilledPlaceholder}`);
    await db.update(scheduledSmsMessages).set({ status: "failed", error: `Message contains unfilled placeholder: ${unfilledPlaceholder}`, sentAt: new Date() }).where(eq(scheduledSmsMessages.id, msg.id));
    return;
  }

  // GUARD: duplicate campaign
  const existingCampaigns = await db
    .select({ id: webinarSmsCampaigns.id, status: webinarSmsCampaigns.status })
    .from(webinarSmsCampaigns)
    .where(sql`JSON_EXTRACT(${webinarSmsCampaigns.filterCriteria}, '$.scheduledMessageId') = ${msg.id}`);
  const alreadySentOrSending = existingCampaigns.find((c: any) => c.status === "sending" || c.status === "completed");
  if (alreadySentOrSending) {
    console.warn(`[SMS Dispatch] DUPLICATE BLOCKED: Message #${msg.id} already has campaign #${alreadySentOrSending.id}. Skipping.`);
    await db.update(scheduledSmsMessages).set({ status: "sent", sentAt: new Date() }).where(eq(scheduledSmsMessages.id, msg.id));
    return;
  }

  try {
    // ═══ ATTENDANCE SYNC ═══
    if (msg.audience === "attended" || msg.audience === "not_attended") {
      console.log(`[SMS Dispatch] ATTENDANCE SYNC: Message #${msg.id} targets "${msg.audience}" — syncing from WebinarJam`);

      let syncSuccess = false;
      let syncError = "";
      try {
        const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, msg.webinarId));
        const perWebinarApiKey = credRow?.apiKey || undefined;

        let allRegistrants: any[] = [];
        let page = 1;
        let hasMore = true;
        while (hasMore && page <= 100) {
          const result = await _fetchWebinarJamRegistrants(msg.webinarId, undefined, page, perWebinarApiKey);
          allRegistrants = allRegistrants.concat(result.registrants);
          hasMore = result.hasMore;
          page++;
        }

        const attendanceMap = new Map<string, number>();
        for (const r of allRegistrants) {
          const rawPhone = r.phone_number || r.phone || "";
          const fullPhone = (r.phone_country_code || "") + rawPhone;
          const phone = _normalizePhone(fullPhone);
          if (phone.length >= 7) {
            const attendedLive = r.attended_live === "Yes" || r.attended_live === 1 || r.attended_live === true;
            attendanceMap.set(phone, attendedLive ? 1 : 0);
          }
        }

        const existing = await db.select({ id: webinarRegistrants.id, phone: webinarRegistrants.phone }).from(webinarRegistrants).where(eq(webinarRegistrants.webinarId, msg.webinarId));

        let updated = 0;
        for (const row of existing) {
          const normalizedPhone = _normalizePhone(row.phone);
          const attended = attendanceMap.get(normalizedPhone);
          if (attended !== undefined) {
            await db.update(webinarRegistrants).set({ attended }).where(eq(webinarRegistrants.id, row.id));
            updated++;
          }
        }

        console.log(`[SMS Dispatch] Attendance sync complete — updated ${updated}/${existing.length} registrants`);
        syncSuccess = true;
      } catch (err: any) {
        syncError = err.message || "Unknown sync error";
        console.error(`[SMS Dispatch] Attendance sync FAILED: ${syncError}`);
      }

      if (!syncSuccess) {
        await db.update(scheduledSmsMessages).set({ status: "failed", error: `Attendance sync failed: ${syncError}`, sentAt: new Date() }).where(eq(scheduledSmsMessages.id, msg.id));
        notifyOwner({ title: `🚨 SMS Blocked: ${msg.sequenceName}`, content: `Attendance sync failed. Cannot send to "${msg.audience}" without verified data.` }).catch(() => {});
        return;
      }

      if (msg.audience === "not_attended") {
        const [attendedCount] = await db.select({ count: count() }).from(webinarRegistrants).where(and(eq(webinarRegistrants.webinarId, msg.webinarId), eq(webinarRegistrants.attended, 1)));
        const confirmedAttendees = Number(attendedCount?.count ?? 0);
        if (confirmedAttendees === 0) {
          const elapsed = Date.now() - scheduledTime;
          const MAX_RETRY_WINDOW = 60 * 60 * 1000;
          if (elapsed < MAX_RETRY_WINDOW) {
            console.log(`[SMS Dispatch] Message #${msg.id}: 0 attendees — resetting to pending (${Math.round(elapsed / 60000)}min / 60min max)`);
            await db.update(scheduledSmsMessages).set({ status: "pending", claimedAt: null }).where(eq(scheduledSmsMessages.id, msg.id));
            return;
          } else {
            await db.update(scheduledSmsMessages).set({ status: "failed", sentCount: 0, failedCount: 0, sentAt: new Date(), error: `0 confirmed attendees after ${Math.round(elapsed / 60000)}min.` }).where(eq(scheduledSmsMessages.id, msg.id));
            return;
          }
        }
        console.log(`[SMS Dispatch] ${confirmedAttendees} attendee(s) confirmed — proceeding with not_attended filter`);
      }
    }

    // Get recipients
    const recipients = await _getRecipientsForMessage(db, msg);
    if (recipients.length === 0) {
      if (msg.audience === "attended" || msg.audience === "not_attended") {
        const elapsed = Date.now() - scheduledTime;
        const MAX_RETRY_WINDOW = 60 * 60 * 1000;
        if (elapsed < MAX_RETRY_WINDOW) {
          console.log(`[SMS Dispatch] Message #${msg.id}: 0 recipients for "${msg.audience}" — resetting to pending`);
          await db.update(scheduledSmsMessages).set({ status: "pending", claimedAt: null }).where(eq(scheduledSmsMessages.id, msg.id));
          return;
        } else {
          await db.update(scheduledSmsMessages).set({ status: "failed", sentCount: 0, failedCount: 0, sentAt: new Date(), error: `Zero recipients for "${msg.audience}" after retry window.` }).where(eq(scheduledSmsMessages.id, msg.id));
          return;
        }
      }
      await db.update(scheduledSmsMessages).set({ status: "sent", sentCount: 0, failedCount: 0, sentAt: new Date() }).where(eq(scheduledSmsMessages.id, msg.id));
      return;
    }

    // Create campaign
    const audienceLabel = msg.audience === "attended" ? "Attended" : msg.audience === "not_attended" ? "No-Shows" : "Everyone";
    const [campaignResult] = await db.insert(webinarSmsCampaigns).values({
      name: `[Sequence] ${msg.sequenceName}`,
      messageBody: msg.messageBody,
      filterCriteria: { audience: msg.audience, webinarId: msg.webinarId, source: "sequence", scheduledMessageId: msg.id, audienceLabel } as Record<string, unknown>,
      totalRecipients: recipients.length,
      sentCount: 0,
      failedCount: 0,
      status: "sending",
    });
    const campaignId = (campaignResult as any).insertId;

    console.log(`[SMS Dispatch] Message #${msg.id} "${msg.sequenceName}": Blasting to ${recipients.length} recipients with ${SMS_SEND_CONCURRENCY} workers (campaign #${campaignId})`);

    // ═══ 50-WORKER SLIDING WINDOW ═══
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let billingBlocked = false;
    let cursor = 0;
    let sendsDone = false;
    const pendingRows: Array<any> = [];

    async function sendWorker(): Promise<void> {
      while (!billingBlocked) {
        if (_cancelledScheduledMessageIds.has(msg.id)) break;
        const i = cursor++;
        if (i >= recipients.length) break;
        const recipient = recipients[i];

        try {
          const personalizedMessage = _renderMessage(msg.messageBody, {
            // City/deal tokens from the registrant's enrichment payload; the
            // legacy name/email vars come last so they always win.
            ...buildPersonalizationVars(personalizationFromMetadata(recipient.metadata)),
            name: recipient.name.split(" ")[0],
            fullname: recipient.name,
            email: recipient.email || "",
          });
          const result = await _sendSms(_normalizePhone(recipient.phone), personalizedMessage);

          if (result.success) {
            sentCount++;
          } else if (
            result.error?.includes("International number skipped") ||
            result.error?.includes("Invalid phone number") ||
            result.error?.includes("too short") ||
            result.error?.includes("unsubscribe") ||
            result.error?.includes("opt") ||
            result.error?.includes("Contact marked as invalid")
          ) {
            skippedCount++;
          } else {
            failedCount++;
            if (result.error && (result.error.includes("BLOCKED_BY_PAYMENT") || result.error.includes("billing"))) {
              billingBlocked = true;
            }
          }

          pendingRows.push({
            campaignId,
            registrantId: recipient.id,
            phone: recipient.phone,
            deliveryStatus: result.success ? "sent" : "failed",
            externalMessageId: result.success ? result.smsId || null : null,
            error: result.success ? null : result.error || "Unknown error",
            sentAt: new Date(),
          });
        } catch (err: any) {
          failedCount++;
          pendingRows.push({
            campaignId,
            registrantId: recipient.id,
            phone: recipient.phone,
            deliveryStatus: "failed",
            externalMessageId: null,
            error: String(err?.message ?? err),
            sentAt: new Date(),
          });
        }
      }
    }

    async function deliveryFlusher(): Promise<void> {
      while (!sendsDone || pendingRows.length > 0) {
        if (pendingRows.length === 0) {
          await sleep(500);
          continue;
        }
        const chunk = pendingRows.splice(0, 500);
        try {
          await db.insert(webinarSmsDeliveries).values(chunk);
          await db.update(webinarSmsCampaigns).set({ sentCount, failedCount: failedCount + skippedCount }).where(eq(webinarSmsCampaigns.id, campaignId));
          // Bump claimedAt as a liveness heartbeat: it now marks "last delivery
          // progress", not "claim time", so the watchdog can tell a legitimately
          // long blast (which keeps flushing) from a crashed one (which stops).
          await db.update(scheduledSmsMessages).set({ sentCount, failedCount: failedCount + skippedCount, claimedAt: new Date() }).where(eq(scheduledSmsMessages.id, msg.id));
        } catch (err: any) {
          console.error(`[SMS Dispatch] Delivery flush failed (campaign ${campaignId}):`, err.message);
        }
      }
    }

    const flusher = deliveryFlusher();
    const workerCount = Math.min(SMS_SEND_CONCURRENCY, recipients.length);
    await Promise.all(Array.from({ length: workerCount }, () => sendWorker()));
    sendsDone = true;
    await flusher;

    // Check cancellation
    if (_cancelledScheduledMessageIds.has(msg.id)) {
      console.log(`[SMS Dispatch] Message #${msg.id} cancelled mid-send: ${sentCount} sent, ${failedCount} failed`);
      await db.update(webinarSmsCampaigns).set({ status: "cancelled", sentCount, failedCount: failedCount + skippedCount, completedAt: new Date() }).where(eq(webinarSmsCampaigns.id, campaignId));
      await db.update(scheduledSmsMessages).set({ status: "cancelled", sentCount, failedCount: failedCount + skippedCount }).where(eq(scheduledSmsMessages.id, msg.id));
      _cancelledScheduledMessageIds.delete(msg.id);
      return;
    }

    if (billingBlocked) {
      console.error(`[SMS Dispatch] BILLING BLOCKED — stopped sends for message #${msg.id}`);
      notifyOwner({ title: `🚨 SimpleTexting BILLING BLOCKED`, content: `Account blocked by payment. "${msg.sequenceName}" partially sent: ${sentCount} delivered before block.` }).catch(() => {});
    }

    // Final status
    const isTotalFailure = sentCount === 0 && failedCount > 0;
    const finalStatus = billingBlocked ? "failed" : isTotalFailure ? "failed" : "sent";
    const finalError = billingBlocked ? "SimpleTexting account blocked by payment" : isTotalFailure ? "All sends failed" : null;

    await db.update(webinarSmsCampaigns).set({ sentCount, failedCount: failedCount + skippedCount, status: finalStatus === "sent" ? "completed" : "failed", completedAt: new Date() }).where(eq(webinarSmsCampaigns.id, campaignId));
    await db.update(scheduledSmsMessages).set({ status: finalStatus, sentCount, failedCount: failedCount + skippedCount, sentAt: new Date(), error: finalError }).where(eq(scheduledSmsMessages.id, msg.id));

    console.log(`[SMS Dispatch] Message #${msg.id} "${msg.sequenceName}" DONE: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped (campaign #${campaignId})`);

    if (sentCount > 0 && !billingBlocked) {
      notifyOwner({ title: `✅ SMS Sent: ${msg.sequenceName}`, content: `Delivered to ${sentCount} recipients in ${Math.round((Date.now() - now.getTime()) / 1000)}s.${failedCount > 0 ? ` (${failedCount} failed, ${skippedCount} skipped)` : ""}` }).catch(() => {});
    }

    const realAttempts = sentCount + failedCount;
    if (realAttempts > 0 && failedCount / realAttempts > 0.3 && failedCount > 5) {
      notifyOwner({ title: `⚠️ High Failure Rate: ${msg.sequenceName}`, content: `${failedCount}/${realAttempts} failed (${Math.round((failedCount / realAttempts) * 100)}%).` }).catch(() => {});
    }
  } catch (err: any) {
    console.error(`[SMS Dispatch] Error on message #${msg.id}:`, err.message);
    await db.update(scheduledSmsMessages).set({ status: "failed", error: err.message?.slice(0, 500), sentAt: new Date() }).where(eq(scheduledSmsMessages.id, msg.id));
    notifyOwner({ title: `🚨 SMS Failed: ${msg.sequenceName}`, content: `Error: ${err.message}` }).catch(() => {});
  }
}

// ─── FORCE_CRON Path ─────────────────────────────────────────────────────────

let smsDispatcherInterval: ReturnType<typeof setInterval> | null = null;

export async function startSmsDispatcherV2() {
  if (smsDispatcherInterval) {
    clearInterval(smsDispatcherInterval);
    smsDispatcherInterval = null;
  }

  console.log("[SMS Dispatcher V2] Starting (every 30s, look-ahead scheduler)");

  runScheduledDispatchV2().catch((err) => console.error("[SMS Dispatcher V2]", err));
  smsDispatcherInterval = setInterval(() => {
    runScheduledDispatchV2().catch((err) => console.error("[SMS Dispatcher V2]", err));
  }, 30_000);
}

export function getSmsDispatcherInterval() {
  return smsDispatcherInterval;
}

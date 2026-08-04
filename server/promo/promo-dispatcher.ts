/**
 * Promo Drip — dispatcher.
 *
 * Runs on the production heartbeat cron (POST /api/scheduled/promo-dispatch,
 * every 60s) and, in FORCE_CRON dev mode, on an in-process interval. Both
 * paths are concurrency-safe: every individual send is claimed by inserting a
 * promo_drip_send_log row under the unique (messageId, recipientId) index —
 * whoever wins the INSERT owns the send (same pattern as email_log_claim_uq).
 *
 * Safety model (mirrors the hardened webinar dispatchers):
 * - Step claim: pending→sending via conditional UPDATE; a 'sending' step with
 *   a fresh claimedAt is owned by a live tick, stale claimedAt means resume.
 * - Time-budgeted ticks: each tick works ≤75s then returns; the heartbeat's
 *   next call resumes exactly where the claims left off.
 * - Per-send exclusion check IMMEDIATELY before send: upcoming-webinar
 *   registrants (straight from WebinarJam data) are skipped, unsubscribes are
 *   filtered, STOP'd phones are skipped.
 * - WebinarJam unreachable → the whole step DEFERS (released back to pending),
 *   never guesses.
 * - Steps >20h overdue are cancelled, never fired late on top of the next day.
 * - SimpleTexting billing failure trips a circuit breaker that halts the step.
 */

import { and, eq, inArray, isNull, isNotNull, lt, lte, or, sql } from "drizzle-orm";
import {
  promoDripCampaigns,
  promoDripMessages,
  promoDripRecipients,
  promoDripSendLog,
  type PromoDripCampaign,
  type PromoDripMessage,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "../_core/env";
import { notifyOwner } from "../_core/notification";
import { plainTextToEmailHtml, sendWebinarEmail } from "../hubspot-smtp";
import { sendSms } from "../routers/webinar-sms";
import { buildPromoExclusionSets, type PromoExclusionSets } from "./promo-webinar-exclusion";
import { buildPromoUnsubscribeUrl, chunk, renderPromoVars } from "./promo-util";
import { PROMO_POSTAL_ADDRESS } from "./promo-content";
import { applyTrackedHrefs, buildTrackedPromoContent, openPixelHtml } from "./promo-tracking";

// ── Tunables ────────────────────────────────────────────────────────────────
const PROMO_TICK_BUDGET_MS = 75_000; // stay under the 2-min heartbeat handler timeout
const PROMO_STALE_CANCEL_MS = 20 * 60 * 60 * 1000; // 20h: never fire a step almost a day late
const PROMO_STEP_CLAIM_STALE_MS = 60_000; // 'sending' claim older than this = dead tick, resume
const PROMO_PENDING_LOG_STALE_MS = 15 * 60 * 1000; // pending log rows older than this = crashed send, re-claimable
const EMAIL_CONCURRENCY = 8; // matches the proven webinar manual-blast chunking
const SMS_CONCURRENCY = 5;
const INTER_BATCH_DELAY_MS = 250;
const CLAIM_BUMP_EVERY_MS = 15_000;
const DEFER_NOTIFY_THROTTLE_MS = 30 * 60 * 1000;

let lastDeferNotifyAt = 0;

export interface PromoDispatchResult {
  checked: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  deferred: number;
  cancelledStale: number;
}

const affectedRows = (res: unknown): number => (res as any)[0]?.affectedRows ?? 0;

// ── Entry point (heartbeat handler + FORCE_CRON interval both call this) ────
export async function runScheduledPromoDispatch(): Promise<PromoDispatchResult> {
  const result: PromoDispatchResult = {
    checked: 0,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    deferred: 0,
    cancelledStale: 0,
  };
  const db = await getDb();
  if (!db) return result;

  const now = new Date();
  const deadline = Date.now() + PROMO_TICK_BUDGET_MS;

  // Cancel steps that are hopelessly overdue (server was down for most of a day),
  // and fail 'sending' steps nothing has touched for that long (crashed blasts
  // must not resume a day later on top of the next step).
  const staleCutoff = new Date(now.getTime() - PROMO_STALE_CANCEL_MS);
  const staleRes = await db
    .update(promoDripMessages)
    .set({ status: "cancelled", error: `Cancelled: still pending ${Math.round(PROMO_STALE_CANCEL_MS / 3600000)}h after scheduled time` })
    .where(and(eq(promoDripMessages.status, "pending"), lt(promoDripMessages.scheduledAt, staleCutoff)));
  const staleSendingRes = await db
    .update(promoDripMessages)
    .set({ status: "failed", error: `Failed: blast stalled for ${Math.round(PROMO_STALE_CANCEL_MS / 3600000)}h (use Retry to resume — already-sent people are skipped)` })
    .where(and(eq(promoDripMessages.status, "sending"), lt(promoDripMessages.claimedAt, staleCutoff)));
  result.cancelledStale = affectedRows(staleRes) + affectedRows(staleSendingRes);
  if (result.cancelledStale > 0) {
    notifyOwner({
      title: "⚠️ Promo drip: stale steps stopped",
      content: `${result.cancelledStale} promo step(s) were >20h overdue or stalled and were stopped instead of firing late. Check the promo campaign dashboard.`,
    }).catch(() => {});
  }

  // Active campaigns only.
  const activeCampaigns: PromoDripCampaign[] = await db
    .select()
    .from(promoDripCampaigns)
    .where(eq(promoDripCampaigns.status, "active"));
  if (activeCampaigns.length === 0) return result;
  const campaignById = new Map(activeCampaigns.map((c) => [c.id, c]));

  // Work = due pending steps + in-flight 'sending' steps (resume).
  // Builders only (no raw sql fragments): keeps the OR properly parenthesized
  // inside the campaign filter and lets Date params go through the timestamp
  // column's own driver encoding.
  const dueSteps: PromoDripMessage[] = await db
    .select()
    .from(promoDripMessages)
    .where(
      and(
        inArray(promoDripMessages.campaignId, activeCampaigns.map((c) => c.id)),
        or(
          and(eq(promoDripMessages.status, "pending"), lte(promoDripMessages.scheduledAt, now)),
          eq(promoDripMessages.status, "sending")
        )
      )
    )
    .orderBy(promoDripMessages.scheduledAt);
  result.checked = dueSteps.length;

  for (const step of dueSteps) {
    if (Date.now() > deadline) break;
    const campaign = campaignById.get(step.campaignId);
    if (!campaign) continue;
    const stepResult = await processStep(db, campaign, step, deadline);
    result.processed++;
    result.sent += stepResult.sent;
    result.failed += stepResult.failed;
    result.skipped += stepResult.skipped;
    if (stepResult.deferred) result.deferred++;
  }

  return result;
}

// ── One step (one email or one SMS across the whole audience) ───────────────
async function processStep(
  db: any,
  campaign: PromoDripCampaign,
  step: PromoDripMessage,
  deadline: number
): Promise<{ sent: number; failed: number; skipped: number; deferred: boolean }> {
  const zero = { sent: 0, failed: 0, skipped: 0, deferred: false };
  const now = new Date();

  // Claim the step for this tick. A fresh 'sending' claim belongs to a live
  // concurrent tick — leave it alone. A stale one is a dead tick — take over.
  const claimStaleBefore = new Date(now.getTime() - PROMO_STEP_CLAIM_STALE_MS);
  const claimRes = await db
    .update(promoDripMessages)
    .set({ status: "sending", claimedAt: now })
    .where(
      and(
        eq(promoDripMessages.id, step.id),
        or(
          eq(promoDripMessages.status, "pending"),
          and(
            eq(promoDripMessages.status, "sending"),
            or(isNull(promoDripMessages.claimedAt), lt(promoDripMessages.claimedAt, claimStaleBefore))
          )
        )
      )
    );
  if (affectedRows(claimRes) === 0) return zero;

  // Exclusions — straight from WebinarJam. Unresolvable → defer, don't guess.
  const sets = await buildPromoExclusionSets(db);
  if (!sets.ok) {
    await db
      .update(promoDripMessages)
      .set({ status: "pending", claimedAt: null, error: `Deferred: ${sets.error}` })
      .where(and(eq(promoDripMessages.id, step.id), eq(promoDripMessages.status, "sending")));
    if (Date.now() - lastDeferNotifyAt > DEFER_NOTIFY_THROTTLE_MS) {
      lastDeferNotifyAt = Date.now();
      notifyOwner({
        title: "⏸️ Promo drip deferred",
        content: `Step "${step.stepKey}" (campaign "${campaign.name}") deferred: ${sets.error}. Sends resume automatically once WebinarJam is reachable.`,
      }).catch(() => {});
    }
    return { ...zero, deferred: true };
  }

  // Email steps require the public app URL for CAN-SPAM unsubscribe links.
  if (step.channel === "email" && !ENV.appUrl) {
    await db
      .update(promoDripMessages)
      .set({ status: "pending", claimedAt: null, error: "Deferred: VITE_APP_URL not configured (needed for unsubscribe links)" })
      .where(and(eq(promoDripMessages.id, step.id), eq(promoDripMessages.status, "sending")));
    if (Date.now() - lastDeferNotifyAt > DEFER_NOTIFY_THROTTLE_MS) {
      lastDeferNotifyAt = Date.now();
      notifyOwner({
        title: "⏸️ Promo drip deferred",
        content: `Email step "${step.stepKey}" deferred: VITE_APP_URL is not set, so unsubscribe links can't be built.`,
      }).catch(() => {});
    }
    return { ...zero, deferred: true };
  }

  // Crashed-send recovery: a pending log row older than the stale window means
  // a tick died between claiming and recording the outcome — the send may or
  // may not have gone out. Mark it failed (NOT deleted): for promo marketing a
  // missed message is recoverable via Retry, a duplicate is not.
  await db
    .update(promoDripSendLog)
    .set({ status: "failed", errorMessage: "Unknown outcome: dispatcher crashed mid-send (not re-sent automatically; Retry re-attempts)" })
    .where(
      and(
        eq(promoDripSendLog.messageId, step.id),
        eq(promoDripSendLog.status, "pending"),
        lt(promoDripSendLog.updatedAt, new Date(Date.now() - PROMO_PENDING_LOG_STALE_MS))
      )
    );

  // Channel-eligible snapshot recipients.
  const channelFilter =
    step.channel === "email" ? isNotNull(promoDripRecipients.email) : eq(promoDripRecipients.phoneValid, 1);
  const recipients: Array<{ id: number; email: string | null; firstName: string | null; phone: string }> = await db
    .select({
      id: promoDripRecipients.id,
      email: promoDripRecipients.email,
      firstName: promoDripRecipients.firstName,
      phone: promoDripRecipients.phone,
    })
    .from(promoDripRecipients)
    .where(
      and(
        eq(promoDripRecipients.campaignId, campaign.id),
        isNull(promoDripRecipients.excludedAt),
        isNull(promoDripRecipients.unsubscribedAt),
        channelFilter
      )
    );

  // Anything already claimed/handled for this step is done.
  const handledRows: Array<{ recipientId: number }> = await db
    .select({ recipientId: promoDripSendLog.recipientId })
    .from(promoDripSendLog)
    .where(eq(promoDripSendLog.messageId, step.id));
  const handled = new Set(handledRows.map((r) => r.recipientId));
  const remaining = recipients.filter((r) => !handled.has(r.id));

  let billingBlocked = false;
  let lastClaimBump = Date.now();
  const concurrency = step.channel === "email" ? EMAIL_CONCURRENCY : SMS_CONCURRENCY;

  let batchesSinceStatusCheck = 0;
  for (const batch of chunk(remaining, concurrency)) {
    if (Date.now() > deadline || billingBlocked) break;

    // Honor admin cancellation mid-blast (checked every few batches).
    if (++batchesSinceStatusCheck >= 5) {
      batchesSinceStatusCheck = 0;
      const [fresh] = await db
        .select({ status: promoDripMessages.status })
        .from(promoDripMessages)
        .where(eq(promoDripMessages.id, step.id));
      if (!fresh || fresh.status === "cancelled") {
        console.log(`[PromoDrip] Step ${step.stepKey} cancelled mid-blast — stopping`);
        return { sent: 0, failed: 0, skipped: 0, deferred: false };
      }
    }

    await Promise.all(
      batch.map(async (recipient) => {
        if (billingBlocked) return;
        const outcome = await sendToRecipient(db, campaign, step, recipient, sets);
        if (outcome === "billing_blocked") billingBlocked = true;
      })
    );

    // Liveness heartbeat so a long blast isn't mistaken for a dead tick.
    if (Date.now() - lastClaimBump > CLAIM_BUMP_EVERY_MS) {
      lastClaimBump = Date.now();
      await db.update(promoDripMessages).set({ claimedAt: new Date() }).where(eq(promoDripMessages.id, step.id));
    }
    await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_DELAY_MS));
  }

  // Aggregate results so far for this step.
  const [agg] = await db
    .select({
      sent: sql<number>`SUM(CASE WHEN ${promoDripSendLog.status} = 'sent' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN ${promoDripSendLog.status} = 'failed' THEN 1 ELSE 0 END)`,
      skipped: sql<number>`SUM(CASE WHEN ${promoDripSendLog.status} = 'skipped' THEN 1 ELSE 0 END)`,
    })
    .from(promoDripSendLog)
    .where(eq(promoDripSendLog.messageId, step.id));
  const sent = Number(agg?.sent ?? 0);
  const failed = Number(agg?.failed ?? 0);
  const skipped = Number(agg?.skipped ?? 0);

  // Is anything left? A recipient counts as unresolved when they have NO log
  // row OR a still-'pending' one (an in-flight or crashed claim) — a step must
  // never finalize while claims are unresolved, or crashed sends get silently
  // lost. (Re-query so concurrent unsubscribes are respected.)
  const [remainCount] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(promoDripRecipients)
    .leftJoin(
      promoDripSendLog,
      and(eq(promoDripSendLog.recipientId, promoDripRecipients.id), eq(promoDripSendLog.messageId, step.id))
    )
    .where(
      and(
        eq(promoDripRecipients.campaignId, campaign.id),
        isNull(promoDripRecipients.excludedAt),
        isNull(promoDripRecipients.unsubscribedAt),
        channelFilter,
        or(isNull(promoDripSendLog.id), eq(promoDripSendLog.status, "pending"))
      )
    );
  const remainingAfter = Number(remainCount?.n ?? 0);

  if (billingBlocked) {
    await db
      .update(promoDripMessages)
      .set({ status: "failed", sentCount: sent, failedCount: failed, skippedCount: skipped, error: "SimpleTexting billing blocked — sends halted", sentAt: new Date() })
      .where(eq(promoDripMessages.id, step.id));
    notifyOwner({
      title: "🚨 Promo drip halted: SimpleTexting billing",
      content: `Step "${step.stepKey}" (campaign "${campaign.name}") stopped: SimpleTexting reports a billing block. ${sent} sent before the halt. Fix billing, then use "Retry step" in the promo dashboard.`,
    }).catch(() => {});
    return { sent, failed, skipped, deferred: false };
  }

  if (remainingAfter > 0) {
    // Out of tick budget — leave 'sending'; the next heartbeat resumes.
    await db
      .update(promoDripMessages)
      .set({ sentCount: sent, failedCount: failed, skippedCount: skipped, claimedAt: new Date() })
      .where(eq(promoDripMessages.id, step.id));
    return { sent, failed, skipped, deferred: false };
  }

  // Step complete.
  const finalStatus = sent === 0 && failed > 0 ? "failed" : "sent";
  await db
    .update(promoDripMessages)
    .set({ status: finalStatus, sentCount: sent, failedCount: failed, skippedCount: skipped, sentAt: new Date(), error: finalStatus === "failed" ? "All sends failed" : null })
    .where(and(eq(promoDripMessages.id, step.id), eq(promoDripMessages.status, "sending")));

  const failureRate = sent + failed > 0 ? failed / (sent + failed) : 0;
  if (finalStatus === "failed" || (failed > 5 && failureRate > 0.3)) {
    notifyOwner({
      title: `⚠️ Promo drip step ${finalStatus === "failed" ? "FAILED" : "high failure rate"}`,
      content: `"${step.stepKey}" (campaign "${campaign.name}"): ${sent} sent, ${failed} failed, ${skipped} skipped.`,
    }).catch(() => {});
  } else {
    notifyOwner({
      title: `✅ Promo drip step sent: ${step.stepKey}`,
      content: `Campaign "${campaign.name}" — ${step.channel} "${step.subject || step.stepKey}": ${sent} sent, ${failed} failed, ${skipped} skipped.`,
    }).catch(() => {});
  }

  // Campaign complete when no unfinished steps remain.
  const [openSteps] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(promoDripMessages)
    .where(and(eq(promoDripMessages.campaignId, campaign.id), inArray(promoDripMessages.status, ["pending", "sending"])));
  if (Number(openSteps?.n ?? 0) === 0) {
    await db
      .update(promoDripCampaigns)
      .set({ status: "completed" })
      .where(and(eq(promoDripCampaigns.id, campaign.id), eq(promoDripCampaigns.status, "active")));
    notifyOwner({
      title: "🏁 Promo drip campaign complete",
      content: `Campaign "${campaign.name}" has finished all steps.`,
    }).catch(() => {});
  }

  return { sent, failed, skipped, deferred: false };
}

// ── One send ────────────────────────────────────────────────────────────────
type SendOutcome = "sent" | "failed" | "skipped" | "lost_claim" | "billing_blocked";

const SKIP_ERROR_PATTERNS = [
  "international number skipped",
  "invalid phone number",
  "too short",
  "unsubscrib",
  "opt",
  "contact marked as invalid",
];

export function classifySmsError(error: string): "skipped" | "failed" | "billing" {
  const lower = error.toLowerCase();
  if (lower.includes("blocked_by_payment") || lower.includes("billing")) return "billing";
  if (SKIP_ERROR_PATTERNS.some((p) => lower.includes(p))) return "skipped";
  return "failed";
}

async function sendToRecipient(
  db: any,
  campaign: PromoDripCampaign,
  step: PromoDripMessage,
  recipient: { id: number; email: string | null; firstName: string | null; phone: string },
  sets: Extract<PromoExclusionSets, { ok: true }>
): Promise<SendOutcome> {
  // Exclusion check immediately before send (fresh WebinarJam-derived sets).
  const emailHit = !!recipient.email && sets.upcomingEmails.has(recipient.email);
  const phoneHit = recipient.phone.length === 10 && sets.upcomingPhones.has(recipient.phone);
  let skipReason: string | null = null;
  if (emailHit || phoneHit) skipReason = "upcoming_webinar";
  else if (step.channel === "sms" && sets.optedOutPhones.has(recipient.phone)) skipReason = "sms_opted_out";

  // Claim this send — the unique index makes the INSERT the lock. A plain
  // INSERT is used deliberately: with mysql2's default CLIENT_FOUND_ROWS flag,
  // an ON-DUPLICATE-KEY no-op reports affectedRows=1 (indistinguishable from a
  // won insert), so a duplicate-key ERROR is the only reliable lost-claim
  // signal. drizzle 0.44 wraps driver errors, so check err.cause too.
  try {
    await db.insert(promoDripSendLog).values({
      campaignId: campaign.id,
      messageId: step.id,
      recipientId: recipient.id,
      channel: step.channel,
      status: "pending",
    });
  } catch (err: any) {
    const errno = err?.errno ?? err?.cause?.errno;
    const message = `${err?.message ?? ""} ${err?.cause?.message ?? ""}`;
    if (errno === 1062 || message.includes("Duplicate entry")) return "lost_claim";
    console.error(`[PromoDrip] claim insert failed for recipient ${recipient.id}:`, err?.message);
    return "failed";
  }

  const finish = async (status: "sent" | "failed" | "skipped", extra: { errorMessage?: string; externalId?: string }) => {
    await db
      .update(promoDripSendLog)
      .set({ status, sentAt: new Date(), errorMessage: extra.errorMessage ?? null, externalId: extra.externalId ?? null })
      .where(and(eq(promoDripSendLog.messageId, step.id), eq(promoDripSendLog.recipientId, recipient.id)));
  };

  try {
    if (skipReason) {
      await finish("skipped", { errorMessage: skipReason });
      return "skipped";
    }

    if (step.channel === "email") {
      const to = recipient.email!;
      const body = renderPromoVars(step.body, { firstName: recipient.firstName });
      const subject = renderPromoVars(step.subject || "", { firstName: recipient.firstName });
      const unsubUrl = buildPromoUnsubscribeUrl(ENV.appUrl, campaign.id, to);
      // Per-recipient tracked links + open pixel (falls back untracked on error)
      const trackedContent = await buildTrackedPromoContent(db, {
        campaignId: campaign.id,
        stepKey: step.stepKey,
        channel: "email",
        recipientEmail: to,
        body,
      });
      let html = plainTextToEmailHtml(trackedContent.body);
      // Route clicks through tracking while the reader still sees the real
      // destination. Must run BEFORE the footer is appended so the unsubscribe
      // link is never rewritten.
      html = applyTrackedHrefs(html, trackedContent.hrefMap);
      // Open pixel + CAN-SPAM footer: physical postal address + working unsubscribe.
      const pixel = trackedContent.openCode ? openPixelHtml(trackedContent.openCode) : "";
      html = html.replace(
        "</body></html>",
        `${pixel}<p style="margin:24px 0 0;font-size:12px;color:#64748b;">${PROMO_POSTAL_ADDRESS}<br>Don't want these emails? <a href="${unsubUrl}" style="color:#64748b;">Unsubscribe</a></p></body></html>`
      );
      const result = await sendWebinarEmail({
        to,
        subject,
        html,
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          // RFC 8058 one-click (Gmail/Yahoo bulk-sender requirement): mail
          // clients POST to the same tokened URL.
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      if (result.success) {
        await finish("sent", { externalId: result.messageId });
        return "sent";
      }
      await finish("failed", { errorMessage: result.error || "Unknown SMTP error" });
      return "failed";
    }

    // SMS — tracked short link (falls back untracked on error)
    const rendered = renderPromoVars(step.body, { firstName: recipient.firstName });
    const trackedSms = await buildTrackedPromoContent(db, {
      campaignId: campaign.id,
      stepKey: step.stepKey,
      channel: "sms",
      recipientEmail: recipient.email,
      body: rendered,
    });
    const result = await sendSms(recipient.phone, trackedSms.body);
    if (result.success) {
      await finish("sent", { externalId: result.smsId });
      return "sent";
    }
    const error = result.error || "Unknown SMS error";
    const cls = classifySmsError(error);
    if (cls === "billing") {
      await finish("failed", { errorMessage: error });
      return "billing_blocked";
    }
    await finish(cls, { errorMessage: error });
    return cls;
  } catch (err: any) {
    await finish("failed", { errorMessage: err?.message || String(err) }).catch(() => {});
    return "failed";
  }
}

// ── FORCE_CRON dev-mode interval ────────────────────────────────────────────
let promoInterval: NodeJS.Timeout | null = null;

export function startPromoDispatcher(): void {
  if (promoInterval) clearInterval(promoInterval);
  console.log("[PromoDrip] Starting in-process dispatcher (FORCE_CRON mode), 60s interval");
  runScheduledPromoDispatch().catch((err) => console.error("[PromoDrip] dispatch error:", err));
  promoInterval = setInterval(() => {
    runScheduledPromoDispatch().catch((err) => console.error("[PromoDrip] dispatch error:", err));
  }, 60_000);
}

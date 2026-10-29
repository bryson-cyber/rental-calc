/**
 * Whop retail-payment confirmation: the signed webhook plus the
 * reconciliation sweep that rides the LLC status-poll heartbeat
 * (server/ops/poller.ts <- POST /api/scheduled/llc-status-poll and /api/poll).
 * Ported from Her First Order (whopEnrollment.ts verifyWhopSignature +
 * registerWhopWebhook, and server/llc/retailReconciliation.ts).
 *
 * Neither path trusts the webhook body: both hand only a payment id to
 * processLlcWhopPayment, which re-reads the payment from the Whop API and
 * verifies plan, quote hash, exact amount and currency before claiming.
 */
import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import express from "express";
import { TRPCError } from "@trpc/server";
import { and, eq, gt, inArray, isNotNull, isNull, like, ne, or } from "drizzle-orm";
import { llcRegistrations, llcWebhookEvents } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "../_core/env";
import { sendOpsAlert } from "../ops/notify";
import {
  WHOP_RETAIL_API_BASE,
  fetchWhopPayment,
  getWhopRetailApiConfig,
  processLlcWhopPayment,
  readLlcPaymentMetadata,
  whopRetailHeaders,
} from "./whopRetailCheckout";
import { isAnnualReportPaymentPayload, readAnnualReportPaymentMetadata } from "./annualReports/paymentMetadata";
import { UNCERTAIN_ERROR_PREFIX } from "./store";

export const WHOP_WEBHOOK_PATH = "/api/whop/webhook";
const TIMESTAMP_TOLERANCE_SEC = 5 * 60;
/** Reconciliation only looks at checkouts prepared within this window. */
export const WHOP_RECONCILE_LOOKBACK_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Verify a Whop webhook signature (Standard Webhooks): HMAC-SHA256 over
 * `{webhook-id}.{webhook-timestamp}.{raw body}`, header "v1,<base64>",
 * 5-minute replay window. Accepts an HMAC keyed by either the raw secret
 * string or the base64-decoded portion after the ws_/whsec_ prefix (Whop
 * documents that its helper "derives the key"), exactly as HFO does.
 */
export function verifyWhopSignature(params: {
  id: string;
  timestamp: string;
  signatureHeader: string;
  rawBody: string;
  secret: string;
  nowMs?: number;
}): boolean {
  const { id, timestamp, signatureHeader, rawBody, secret } = params;
  if (!id || !timestamp || !signatureHeader || !secret) return false;
  const tsSec = Number(timestamp);
  if (!Number.isFinite(tsSec)) return false;
  const nowSec = (params.nowMs ?? Date.now()) / 1000;
  if (Math.abs(nowSec - tsSec) > TIMESTAMP_TOLERANCE_SEC) return false;

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const keys: Buffer[] = [Buffer.from(secret, "utf8")];
  const afterPrefix = secret.replace(/^ws_/, "").replace(/^whsec_/, "");
  try {
    const decoded = Buffer.from(afterPrefix, "base64");
    if (decoded.length > 0) keys.push(decoded);
  } catch {
    /* not base64 — raw-key candidate only */
  }

  const offered = signatureHeader
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice(3));
  if (offered.length === 0) return false;

  for (const key of keys) {
    const expected = crypto.createHmac("sha256", key).update(signedContent, "utf8").digest("base64");
    for (const candidate of offered) {
      const a = Buffer.from(expected);
      const b = Buffer.from(candidate);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    }
  }
  return false;
}

/** At-least-once delivery, exactly-once processing (shared with Stripe/doola). */
async function claimWebhookEvent(eventId: string, eventName: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(llcWebhookEvents).values({
      eventId: `whop:${eventId}`.slice(0, 128),
      eventName: `whop.${eventName}`.slice(0, 64),
      registrationId: null,
    });
    return true;
  } catch {
    return false;
  }
}

function paymentIdFromEvent(payload: any): string {
  const data = payload?.data ?? {};
  if (String(payload?.type || "").startsWith("payment.")) return String(data.id || "").trim();
  return String(data.payment?.id || data.payment_id || (typeof data.payment === "string" ? data.payment : "") || "").trim();
}

/** Webhook body metadata present and clearly someone else's (e.g. another product). */
function isForeignPayment(data: any): boolean {
  return Boolean(data?.metadata && typeof data.metadata === "object" && !readLlcPaymentMetadata(data));
}

type AnnualReportPaymentProcessor = (input: { paymentId: string }) => Promise<{ outcome: string } | null>;

/** Loaded only for an annual report payment, so formation webhooks never pull in the annual report service. */
const processAnnualReportPaymentLazily: AnnualReportPaymentProcessor = async (input) => {
  const { processAnnualReportPayment } = await import("./annualReports/payments");
  return processAnnualReportPayment(input);
};

export async function handleWhopWebhookEvent(
  payload: any,
  deps: {
    processPayment?: typeof processLlcWhopPayment;
    fetchPayment?: typeof fetchWhopPayment;
    processAnnualReportPayment?: AnnualReportPaymentProcessor;
  } = {},
): Promise<string> {
  const type = String(payload?.type || "");
  const processPayment = deps.processPayment ?? processLlcWhopPayment;
  const fetchPayment = deps.fetchPayment ?? fetchWhopPayment;
  const paymentId = paymentIdFromEvent(payload);
  if (!paymentId) return "ignored:no-payment-id";

  // An LLC annual report's state fee (2026-10-20): routed BEFORE the formation
  // branch (whose foreign-metadata guard would drop it). The body only routes;
  // annualReports/payments.ts re-reads the payment from Whop, verifies plan,
  // quote hash, amount before tax and currency, claims once and confirms. Its
  // mismatches alert ops inside that module (once each); the reconciliation
  // sweep retries anything this delivery could not finish.
  if (type === "payment.succeeded" && isAnnualReportPaymentPayload(payload)) {
    try {
      const result = await (deps.processAnnualReportPayment ?? processAnnualReportPaymentLazily)({ paymentId });
      return result ? `llc-annual-report-${result.outcome}` : "llc-annual-report-pending";
    } catch (error) {
      if (error instanceof TRPCError && (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")) {
        await sendOpsAlert({
          subject: `ACTION: Whop annual report payment needs review (${paymentId})`,
          lines: [
            "A succeeded Whop payment carried this app's annual report checkout metadata but does not match an annual report on file.",
            "",
            `Whop payment: ${paymentId}`,
            `Reason: ${error.message}`,
            "",
            "Check the order's Annual reports section in /admin/llc and the payment in the Whop dashboard; refund if it can't be applied.",
          ],
        }).catch(() => false);
        return `llc-annual-report-rejected:${error.code}`;
      }
      throw error;
    }
  }

  if (type === "payment.succeeded") {
    if (isForeignPayment(payload.data)) return "ignored:foreign-payment";
    try {
      const result = await processPayment({ paymentId });
      return result ? `llc-${result.outcome}` : "llc-payment-pending";
    } catch (error) {
      if (error instanceof TRPCError && (error.code === "FORBIDDEN" || error.code === "CONFLICT")) {
        // Money arrived that could not be applied automatically — a human
        // must look (wrong amount, stale plan, already paid on another rail).
        await sendOpsAlert({
          subject: `ACTION: Whop LLC payment needs review (${paymentId})`,
          lines: [
            "A succeeded Whop payment carried this app's LLC checkout metadata but could not be applied to its order automatically.",
            "",
            `Whop payment: ${paymentId}`,
            `Reason: ${error.message}`,
            "",
            "Check the order in /admin/llc and the payment in the Whop dashboard; refund or Mark paid as appropriate.",
          ],
        }).catch(() => false);
        return `llc-rejected:${error.code}`;
      }
      throw error;
    }
  }

  if (type.startsWith("refund.") || type.startsWith("dispute.")) {
    // Only alert for payments that belong to this app's LLC checkout.
    const payment = await fetchPayment(paymentId).catch(() => null);
    const metadata = payment ? readLlcPaymentMetadata(payment) : null;
    const annualReport = payment && !metadata ? readAnnualReportPaymentMetadata(payment) : null;
    if (annualReport) {
      // An annual report state fee (2026-10-20): ops decide; nothing is undone automatically.
      await sendOpsAlert({
        subject: `${type.startsWith("dispute.") ? "⚠️ DISPUTE" : "Refund"}: Whop annual report payment (${paymentId})`,
        lines: [
          `Whop event: ${type}`,
          `Whop payment: ${paymentId}`,
          `Order: #${annualReport.registrationId}, annual report row #${annualReport.reportId}`,
          "",
          type.startsWith("dispute.")
            ? "Action required: respond in the Whop dashboard within the deadline. If the report was already handed to the state, the state fee is spent."
            : "Review the order's Annual reports section in /admin/llc.",
        ],
      }).catch(() => false);
      return `alerted:${type}`;
    }
    if (!metadata) return "ignored:foreign-refund-or-dispute";
    await sendOpsAlert({
      subject: `${type.startsWith("dispute.") ? "⚠️ DISPUTE" : "Refund"}: Whop LLC payment (${paymentId})`,
      lines: [
        `Whop event: ${type}`,
        `Whop payment: ${paymentId}`,
        `Order: #${metadata.registrationId}`,
        "",
        type.startsWith("dispute.")
          ? "Action required: respond in the Whop dashboard within the deadline."
          : "Review the order in /admin/llc.",
      ],
    }).catch(() => false);
    return `alerted:${type}`;
  }
  return `ignored:${type || "unknown"}`;
}

/** Mount BEFORE the JSON body parser — the signature covers the RAW body. */
export function registerWhopRetailWebhook(app: Express): void {
  app.post(
    WHOP_WEBHOOK_PATH,
    express.raw({ type: "*/*", limit: "1mb" }),
    async (req: Request, res: Response) => {
      const secret = process.env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
      if (!secret) {
        res.status(503).json({ error: "webhook not configured" });
        return;
      }
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "");
      const webhookId = String(req.headers["webhook-id"] || "");
      const ok = verifyWhopSignature({
        id: webhookId,
        timestamp: String(req.headers["webhook-timestamp"] || ""),
        signatureHeader: String(req.headers["webhook-signature"] || ""),
        rawBody,
        secret,
      });
      if (!ok) {
        res.status(401).json({ error: "invalid signature" });
        return;
      }
      let payload: any;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        res.status(400).json({ error: "invalid JSON" });
        return;
      }
      const claimed = await claimWebhookEvent(webhookId, String(payload?.type || "unknown"));
      if (!claimed) {
        res.status(200).json({ received: true, duplicate: true });
        return;
      }
      // Ack fast (Whop wants 2xx within seconds); a processing failure is
      // recovered by the reconciliation sweep on the next poll heartbeat.
      res.status(200).json({ received: true });
      void handleWhopWebhookEvent(payload)
        .then((outcome) => {
          if (!outcome.startsWith("ignored:")) console.log(`[WhopRetail] webhook ${outcome}`);
        })
        .catch((error) =>
          console.error("[WhopRetail] webhook processing failed:", error instanceof Error ? error.name : "UnknownError"),
        );
    },
  );
  console.log(`[WhopRetail] Webhook registered at ${WHOP_WEBHOOK_PATH}`);
}

// ---------------------------------------------------------------------------
// Reconciliation (status-poll heartbeat)
// ---------------------------------------------------------------------------
type WhopPaymentList = {
  data?: Array<{ id?: string; status?: string; substatus?: string; plan_id?: string | null; plan?: { id?: string } | null }>;
  page_info?: { has_next_page?: boolean; end_cursor?: string | null };
};

export type LlcWhopReconcileReport = {
  filingsChecked: number;
  paymentsSeen: number;
  processed: number;
  skipped: number;
  incomplete: number;
  outcomes: Record<string, number>;
};

/** Succeeded payments on one exact plan (formation orders and annual report checkouts both reconcile through it). */
export async function paidPaymentsForExactPlan(input: {
  apiKey: string;
  companyId: string;
  planId: string;
  createdAfter: string;
  fetchImpl: typeof fetch;
}) {
  const results: Array<{ id: string }> = [];
  let cursor = "";
  for (let page = 0; page < 3; page++) {
    const url = new URL(`${WHOP_RETAIL_API_BASE}/payments`);
    url.searchParams.set("account_id", input.companyId);
    url.searchParams.set("plan_id", input.planId);
    url.searchParams.set("status", "paid");
    url.searchParams.set("substatus", "succeeded");
    url.searchParams.set("created_after", input.createdAfter);
    url.searchParams.set("direction", "asc");
    url.searchParams.set("order", "paid_at");
    url.searchParams.set("first", "50");
    if (cursor) url.searchParams.set("after", cursor);
    const response = await input.fetchImpl(url, {
      headers: whopRetailHeaders(input.apiKey),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`Whop LLC payment reconciliation failed with HTTP ${response.status}`);
    }
    const payload = (await response.json()) as WhopPaymentList;
    for (const payment of Array.isArray(payload.data) ? payload.data : []) {
      const planId = String(payment.plan_id || payment.plan?.id || "");
      if (payment.id && planId === input.planId && payment.status === "paid" && payment.substatus === "succeeded") {
        results.push({ id: payment.id });
      }
    }
    if (!payload.page_info?.has_next_page || !payload.page_info.end_cursor) break;
    cursor = payload.page_info.end_cursor;
  }
  return results;
}

function bump(report: LlcWhopReconcileReport, key: string) {
  report.outcomes[key] = (report.outcomes[key] || 0) + 1;
}

/**
 * One sweep: (a) unpaid orders holding a Whop plan -> look for a succeeded
 * payment on that exact plan and apply it; (b) orders already claimed by a
 * Whop payment with no company filed yet -> hand them back to the filing step
 * (only when auto-file is enabled; the processor re-checks). That covers a
 * filing that never started (payment_required) and a retryable or uncertain
 * failure, never a filing the provider refused (2026-10-29: the query leaves
 * those out, mirroring filingHeldForOpsRetry, and the filing step holds one
 * that slips through). No-op (returns null) when the Whop API config is
 * absent.
 */
export async function runLlcWhopReconciliation(input: {
  fetchImpl?: typeof fetch;
  processPayment?: typeof processLlcWhopPayment;
  now?: Date;
  env?: NodeJS.ProcessEnv;
} = {}): Promise<LlcWhopReconcileReport | null> {
  const config = getWhopRetailApiConfig(input.env);
  if (!config) return null;
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - WHOP_RECONCILE_LOOKBACK_MS);
  const candidates = await db
    .select({
      registrationId: llcRegistrations.id,
      planId: llcRegistrations.retailWhopPlanId,
    })
    .from(llcRegistrations)
    .where(
      and(
        eq(llcRegistrations.status, "payment_required"),
        eq(llcRegistrations.provider, "doola"),
        eq(llcRegistrations.isTest, false),
        isNotNull(llcRegistrations.retailWhopPlanId),
        isNull(llcRegistrations.retailWhopPaymentId),
        isNull(llcRegistrations.retailPaidAt),
        gt(llcRegistrations.checkoutExpiresAt, cutoff),
      ),
    )
    .limit(200);
  const paidPendingFiling = ENV.llcAutoFileEnabled
    ? await db
        .select({
          registrationId: llcRegistrations.id,
          paymentId: llcRegistrations.retailWhopPaymentId,
        })
        .from(llcRegistrations)
        .where(
          and(
            eq(llcRegistrations.provider, "doola"),
            eq(llcRegistrations.isTest, false),
            // A filing that never started, or one that failed in a way that
            // may be retried (2026-10-29, Her First Order's PR #397 rule;
            // before, this pass took payment_required only). A wedged
            // "submitting" row is the watchdog's (server/ops/poller.ts).
            inArray(llcRegistrations.status, ["payment_required", "failed"]),
            isNotNull(llcRegistrations.retailWhopPaymentId),
            isNotNull(llcRegistrations.retailPaidAt),
            isNull(llcRegistrations.doolaCompanyId),
            // Never a filing the provider refused (filingHeldForOpsRetry in
            // doolaSubmission.ts, which also holds it if one slips through):
            // it re-files only from Retry filing on the orders page. HFO's
            // order #32 was re-filed 62 times by its payment sweep.
            or(
              ne(llcRegistrations.status, "failed"),
              eq(llcRegistrations.retryable, true),
              isNull(llcRegistrations.lastErrorType),
              like(llcRegistrations.lastErrorType, `${UNCERTAIN_ERROR_PREFIX}%`),
              eq(llcRegistrations.lastErrorType, "provider_configuration"),
            ),
          ),
        )
        .limit(200)
    : [];
  const report: LlcWhopReconcileReport = {
    filingsChecked: candidates.length + paidPendingFiling.length,
    paymentsSeen: 0,
    processed: 0,
    skipped: 0,
    incomplete: 0,
    outcomes: {},
  };
  const fetchImpl = input.fetchImpl ?? fetch;
  const processPayment = input.processPayment ?? processLlcWhopPayment;

  for (const candidate of paidPendingFiling) {
    if (!candidate.paymentId) continue;
    try {
      const result = await processPayment({ paymentId: candidate.paymentId, fetchImpl });
      if (!result || result.registrationId !== candidate.registrationId) {
        report.skipped++;
        report.incomplete++;
        bump(report, "paid-filing-recovery-mismatch");
        continue;
      }
      report.processed++;
      bump(report, result.outcome);
      if (result.outcome === "filing_failed") report.incomplete++;
    } catch {
      report.skipped++;
      report.incomplete++;
      bump(report, "paid-filing-recovery-error");
    }
  }

  for (const candidate of candidates) {
    if (!candidate.planId) continue;
    let payments: Array<{ id: string }>;
    try {
      payments = await paidPaymentsForExactPlan({
        apiKey: config.apiKey,
        companyId: config.companyId,
        planId: candidate.planId,
        createdAfter: cutoff.toISOString(),
        fetchImpl,
      });
    } catch {
      report.skipped++;
      report.incomplete++;
      bump(report, "list-error");
      continue;
    }
    report.paymentsSeen += payments.length;
    if (!payments.length) {
      report.skipped++;
      bump(report, "not-paid");
      continue;
    }
    for (const payment of payments) {
      try {
        const result = await processPayment({
          paymentId: payment.id,
          expectedRegistrationId: candidate.registrationId,
          fetchImpl,
        });
        if (!result) {
          report.skipped++;
          report.incomplete++;
          bump(report, "payment-not-confirmed");
          continue;
        }
        if (result.registrationId !== candidate.registrationId) {
          report.skipped++;
          report.incomplete++;
          bump(report, "registration-mismatch");
          continue;
        }
        report.processed++;
        bump(report, result.outcome);
        if (result.outcome === "filing_failed") report.incomplete++;
        break; // one payment pays one order
      } catch {
        report.skipped++;
        report.incomplete++;
        bump(report, "processing-error");
      }
    }
  }
  return report;
}

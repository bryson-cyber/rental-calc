/**
 * Doola webhook receiver — POST /api/llc/webhooks/doola
 *
 * Contract: HMAC-SHA256 hex of the RAW request body in X-Doola-Signature,
 * keyed with the partner webhook secret; at-least-once delivery with 5
 * retries, endpoint auto-disabled after exhaustion. So this handler:
 *  - MUST be registered BEFORE the JSON body parser (raw bytes for the HMAC),
 *  - verifies with a constant-time comparison,
 *  - dedupes by eventId (unique insert claim in llc_webhook_events),
 *  - answers 200 immediately and processes async so slow work can never
 *    exhaust Doola's retries and kill the endpoint.
 */
import type { Express, Request, Response } from "express";
import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { llcRegistrations, llcWebhookEvents } from "../../drizzle/schema";
import { getDb } from "../db";
import { getDoolaWebhookSecret } from "./doola";
import { refreshDoolaRegistrationStatus } from "./doolaSubmission";
import { transitionLlcStatus } from "./store";
import { sendOpsAlert, submissionProblemAlert } from "../ops/notify";
import { ingestDoolaRequiredActionWebhook } from "./requiredActions";

export interface DoolaWebhookEvent {
  eventId?: string;
  eventName?: string;
  eventPayload?: {
    doolaCompanyId?: string;
    doolaCustomerId?: string;
    documentId?: string;
    documentType?: string;
    reasonCode?: string;
    message?: string;
    daysSinceRequested?: number;
    requiredActionId?: string;
    actionCode?: string;
    actionName?: string;
    reason?: string;
  };
  timestamp?: number;
}

export function verifyDoolaSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.trim().toLowerCase();
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"));
}

async function findRegistrationByDoolaCompanyId(doolaCompanyId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: llcRegistrations.id,
      userId: llcRegistrations.userId,
      status: llcRegistrations.status,
      legalName: llcRegistrations.legalName,
      entitySuffix: llcRegistrations.entitySuffix,
    })
    .from(llcRegistrations)
    .where(eq(llcRegistrations.doolaCompanyId, doolaCompanyId))
    .limit(1);
  return rows[0] ?? null;
}

/** Unique-insert claim; false = this eventId was already processed. */
async function claimEvent(event: DoolaWebhookEvent, registrationId: number | null): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(llcWebhookEvents).values({
      eventId: (event.eventId ?? "").slice(0, 128),
      eventName: (event.eventName ?? "unknown").slice(0, 64),
      registrationId,
    });
    return true;
  } catch {
    return false; // duplicate delivery
  }
}

export async function processDoolaEvent(event: DoolaWebhookEvent): Promise<void> {
  const eventName = event.eventName ?? "";
  const doolaCompanyId = event.eventPayload?.doolaCompanyId;

  if (eventName === "partner_webhook_disabled") {
    await sendOpsAlert(
      submissionProblemAlert({
        registrationId: 0,
        legalName: "ALL FILINGS",
        errorType: "webhook_disabled",
        message:
          "Doola disabled the webhook endpoint after repeated delivery failures. Status updates fall back to polling — re-enable the endpoint in the Doola Partner Portal.",
        uncertain: true,
      }),
    ).catch(() => {});
    return;
  }

  if (!doolaCompanyId) return;
  const registration = await findRegistrationByDoolaCompanyId(doolaCompanyId);
  if (!registration) {
    console.error("[DoolaWebhook] no registration for company", { eventName });
    return;
  }

  const claimed = await claimEvent(event, registration.id);
  if (!claimed) return;

  if (
    eventName === "company_name_options_required" ||
    eventName === "signature_ss4_reset"
  ) {
    await ingestDoolaRequiredActionWebhook({
      eventName,
      eventPayload: event.eventPayload ?? {},
    });
    await refreshDoolaRegistrationStatus({
      userId: registration.userId,
      registrationId: registration.id,
    }).catch(() => {});
    return;
  }

  if (eventName === "company_formation_failed") {
    await transitionLlcStatus({
      userId: registration.userId,
      registrationId: registration.id,
      toStatus: "action_required",
      source: "system",
      note: "The formation service reported the filing failed; ops review required",
      expectedStatuses: ["processing", "submitting", "payment_required"],
      updates: {
        lastErrorType: `formation_failed_${(event.eventPayload?.reasonCode ?? "unknown").slice(0, 64)}`.toLowerCase(),
        lastErrorMessage:
          "Our team is reviewing a detail on your filing. Nothing is needed from you right now.",
        retryable: false,
      },
    }).catch(() => {});
    await sendOpsAlert(
      submissionProblemAlert({
        registrationId: registration.id,
        legalName: `${registration.legalName ?? "Unknown"} ${registration.entitySuffix}`,
        errorType: `formation_failed_${event.eventPayload?.reasonCode ?? "unknown"}`,
        message: "Doola reported the formation FAILED. Review the order and contact support if needed.",
        uncertain: true,
      }),
    ).catch(() => {});
    return;
  }

  if (eventName === "signature_ss4_reminder_due" || eventName === "signature_form8821_reminder_due") {
    const form = eventName.includes("ss4") ? "IRS Form SS-4" : "IRS Form 8821";
    await sendOpsAlert(
      submissionProblemAlert({
        registrationId: registration.id,
        legalName: `${registration.legalName ?? "Unknown"} ${registration.entitySuffix}`,
        errorType: "signature_reminder",
        message: `${form} is still awaiting the founder's signature (${event.eventPayload?.daysSinceRequested ?? "?"} days). Re-send the signing link to the client under your brand.`,
        uncertain: false,
      }),
    ).catch(() => {});
    return;
  }

  // Everything else (formation submitted/completed, filing date, EIN issued,
  // every document upload, signature completions) resolves through one full
  // refresh: status advance, EIN capture, and vault mirroring in one pass.
  await refreshDoolaRegistrationStatus({
    userId: registration.userId,
    registrationId: registration.id,
  }).catch((error) => {
    console.error("[DoolaWebhook] refresh failed", {
      registrationId: registration.id,
      eventName,
      error: error instanceof Error ? error.name : "UnknownError",
    });
  });
}

/** Register BEFORE express.json() — the HMAC needs the raw bytes. */
export function registerDoolaWebhook(app: Express) {
  app.post(
    "/api/llc/webhooks/doola",
    express.raw({ type: "*/*", limit: "1mb" }),
    (req: Request, res: Response) => {
      const secret = getDoolaWebhookSecret();
      if (!secret) {
        res.status(503).json({ error: "webhook not configured" });
        return;
      }
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
      const signature = req.headers["x-doola-signature"];
      if (
        !verifyDoolaSignature(
          rawBody,
          Array.isArray(signature) ? signature[0] : signature,
          secret,
        )
      ) {
        res.status(401).json({ error: "invalid signature" });
        return;
      }

      let event: DoolaWebhookEvent;
      try {
        event = JSON.parse(rawBody.toString("utf8")) as DoolaWebhookEvent;
      } catch {
        res.status(400).json({ error: "invalid payload" });
        return;
      }
      if (!event.eventId || !event.eventName) {
        res.status(400).json({ error: "invalid payload" });
        return;
      }

      // Ack immediately; never let processing latency burn Doola's retries.
      res.status(200).json({ received: true });
      void processDoolaEvent(event).catch((error) => {
        console.error("[DoolaWebhook] processing failed:", error);
      });
    },
  );
}

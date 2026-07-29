/**
 * Stripe Checkout integration for LLC formation payments.
 *
 * Creates Checkout Sessions with dynamic pricing from llc_state_pricing,
 * handles the checkout.session.completed webhook to mark paid + auto-file,
 * and processes dispute/refund events for ops alerting.
 */
import Stripe from "stripe";
import type { Express, Request, Response } from "express";
import express from "express";
import { eq } from "drizzle-orm";
import { llcRegistrations, llcWebhookEvents } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "../_core/env";
import { getStatePricing } from "./pricing";
import {
  findLlcRegistrationOwner,
  getLlcRegistrationById,
  updateLlcRegistrationProviderFields,
} from "./store";
import { fileDoolaRegistration } from "./doolaSubmission";
import { sendPaymentConfirmedEmail } from "./clientEmails";
import { sendOpsAlert } from "../ops/notify";
import type { OpsAlert } from "../ops/notify";

// ---------------------------------------------------------------------------
// Stripe client (lazy singleton)
// ---------------------------------------------------------------------------
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!ENV.stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(ENV.stripeSecretKey);
  }
  return _stripe;
}

// ---------------------------------------------------------------------------
// Checkout Session creation
// ---------------------------------------------------------------------------
export interface CreateCheckoutParams {
  userId: number;
  userEmail: string | null;
  userName: string | null;
  registrationId: number;
  origin: string; // e.g. https://app.example.com
}

export async function createLlcCheckoutSession(params: CreateCheckoutParams) {
  const { userId, userEmail, userName, registrationId, origin } = params;

  // Load the registration to get formationState + retailPriceCents
  const bundle = await getLlcRegistrationById(userId, registrationId);
  if (!bundle) throw new Error("Registration not found");
  const { registration } = bundle;

  // Guard: only payment_required registrations can check out
  if (registration.status !== "payment_required") {
    throw new Error(
      `Registration #${registrationId} is in status "${registration.status}", not payment_required`,
    );
  }

  // Guard: already paid
  if (registration.retailPaidAt) {
    throw new Error(`Registration #${registrationId} is already paid`);
  }

  // Guard: already has a checkout session — return existing URL
  if (registration.checkoutSessionId && registration.checkoutUrl) {
    return { checkoutUrl: registration.checkoutUrl, existing: true };
  }

  // Determine price: use the snapshot on the row, or fall back to state pricing
  let priceCents = registration.retailPriceCents;
  if (priceCents === null) {
    if (!registration.formationState) {
      throw new Error("Registration has no formation state — cannot determine price");
    }
    const pricing = await getStatePricing(registration.formationState);
    if (pricing.retailPriceCents === null) {
      throw new Error(
        `No published retail price for state "${registration.formationState}"`,
      );
    }
    // Include expedited EIN add-on if selected
    const addOn =
      registration.expediteEin && pricing.expediteEinPriceCents
        ? pricing.expediteEinPriceCents
        : 0;
    priceCents = pricing.retailPriceCents + addOn;
  }

  const legalName = registration.legalName
    ? `${registration.legalName} ${registration.entitySuffix}`
    : "LLC Formation";
  const stateName = registration.formationState ?? "US";

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: priceCents,
          product_data: {
            name: `LLC Formation — ${stateName}`,
            description: legalName,
          },
        },
        quantity: 1,
      },
    ],
    client_reference_id: String(registrationId),
    customer_email: userEmail ?? undefined,
    metadata: {
      registrationId: String(registrationId),
      userId: String(userId),
      customerName: userName ?? "",
    },
    allow_promotion_codes: true,
    success_url: `${origin}/llc/status/${registrationId}?payment=success`,
    cancel_url: `${origin}/llc/status/${registrationId}?payment=cancelled`,
  });

  // Persist the checkout session on the registration
  await updateLlcRegistrationProviderFields(userId, registrationId, {
    checkoutSessionId: session.id,
    checkoutUrl: session.url,
    checkoutTotal: session.amount_total,
    checkoutCurrency: session.currency ?? "usd",
    // Snapshot the retail price if not already set
    ...(registration.retailPriceCents === null ? { retailPriceCents: priceCents } : {}),
  });

  return { checkoutUrl: session.url!, existing: false };
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

/** Idempotent event claim — returns false if already processed. */
async function claimWebhookEvent(
  eventId: string,
  eventName: string,
  registrationId: number | null,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(llcWebhookEvents).values({
      eventId: eventId.slice(0, 128),
      eventName: eventName.slice(0, 64),
      registrationId,
    });
    return true;
  } catch {
    return false; // duplicate delivery
  }
}

/** Find registration by Stripe Checkout Session ID. */
async function findRegistrationByCheckoutSessionId(sessionId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: llcRegistrations.id,
      userId: llcRegistrations.userId,
      status: llcRegistrations.status,
      legalName: llcRegistrations.legalName,
      entitySuffix: llcRegistrations.entitySuffix,
      formationState: llcRegistrations.formationState,
      retailPaidAt: llcRegistrations.retailPaidAt,
    })
    .from(llcRegistrations)
    .where(eq(llcRegistrations.checkoutSessionId, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

/** Handle checkout.session.completed — mark paid + auto-file. */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const sessionId = session.id;
  const registrationIdStr =
    session.metadata?.registrationId ?? session.client_reference_id;
  const registrationId = registrationIdStr ? parseInt(registrationIdStr, 10) : null;

  // Find the registration by the persisted checkoutSessionId
  const registration = await findRegistrationByCheckoutSessionId(sessionId);
  if (!registration) {
    console.warn(
      `[StripeWebhook] checkout.session.completed for unknown session ${sessionId}`,
    );
    return;
  }

  // Already paid — idempotent
  if (registration.retailPaidAt) {
    console.log(
      `[StripeWebhook] Registration #${registration.id} already paid, skipping`,
    );
    return;
  }

  // Mark paid
  await updateLlcRegistrationProviderFields(registration.userId, registration.id, {
    retailPaidAt: new Date(),
  });

  console.log(
    `[StripeWebhook] Marked registration #${registration.id} as paid via Stripe`,
  );

  // Client payment confirmation email — fire-and-forget
  void sendPaymentConfirmedEmail({
    userId: registration.userId,
    registrationId: registration.id,
  }).catch(() => {});

  // Ops alert
  void sendOpsAlert(stripePaymentReceivedAlert(registration)).catch(() => {});

  // Auto-file if enabled
  if (ENV.llcAutoFileEnabled) {
    void fileDoolaRegistration({
      userId: registration.userId,
      registrationId: registration.id,
    }).catch((error) => {
      console.error(
        `[StripeWebhook] Auto-file after payment failed for #${registration.id}:`,
        error,
      );
    });
  }
}

/** Handle charge.dispute.created — alert ops. */
async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const paymentIntentId =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : dispute.payment_intent?.id ?? null;

  await sendOpsAlert({
    subject: `⚠️ DISPUTE: Stripe dispute opened (${dispute.id})`,
    lines: [
      `A customer has disputed a charge.`,
      ``,
      `Dispute ID: ${dispute.id}`,
      `Amount: $${((dispute.amount ?? 0) / 100).toFixed(2)} ${dispute.currency?.toUpperCase() ?? "USD"}`,
      `Reason: ${dispute.reason ?? "unknown"}`,
      `Payment Intent: ${paymentIntentId ?? "n/a"}`,
      ``,
      `Action required: respond in Stripe Dashboard within the deadline.`,
    ],
  });
}

/** Handle charge.refunded — alert ops. */
async function handleChargeRefunded(charge: Stripe.Charge) {
  await sendOpsAlert({
    subject: `Stripe refund processed (${charge.id})`,
    lines: [
      `A charge has been refunded.`,
      ``,
      `Charge ID: ${charge.id}`,
      `Amount refunded: $${((charge.amount_refunded ?? 0) / 100).toFixed(2)} ${charge.currency?.toUpperCase() ?? "USD"}`,
      `Payment Intent: ${typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? "n/a"}`,
    ],
  });
}

function stripePaymentReceivedAlert(registration: {
  id: number;
  legalName: string | null;
  entitySuffix: string;
  formationState: string | null;
}): OpsAlert {
  const name = registration.legalName
    ? `${registration.legalName} ${registration.entitySuffix}`
    : `Order #${registration.id}`;
  return {
    subject: `💰 Stripe payment received — ${name} (#${registration.id})`,
    lines: [
      `A client paid via Stripe Checkout.`,
      ``,
      `Company: ${name}`,
      `Formation state: ${registration.formationState ?? "n/a"}`,
      `Order: #${registration.id}`,
      ``,
      ENV.llcAutoFileEnabled
        ? `Auto-file is ENABLED — the filing will proceed automatically.`
        : `Auto-file is DISABLED — manual "Mark paid" is still required to trigger filing.`,
    ],
  };
}

// ---------------------------------------------------------------------------
// Express route registration — MUST be called BEFORE express.json()
// ---------------------------------------------------------------------------
export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const stripe = getStripe();
      const sig = req.headers["stripe-signature"];
      if (!sig) {
        res.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }
      if (!ENV.stripeWebhookSecret) {
        res.status(503).json({ error: "Webhook secret not configured" });
        return;
      }

      let event: Stripe.Event;
      try {
        const rawBody = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(req.body ?? "");
        event = stripe.webhooks.constructEvent(
          rawBody,
          sig,
          ENV.stripeWebhookSecret,
        );
      } catch (err) {
        console.error("[StripeWebhook] Signature verification failed:", err);
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      // Test event detection (Stripe test mode verification pings)
      if (event.id.startsWith("evt_test_")) {
        console.log("[StripeWebhook] Test event detected, returning verification");
        res.json({ verified: true });
        return;
      }

      // Idempotent claim
      const registrationIdFromMeta =
        event.type === "checkout.session.completed"
          ? parseInt(
              (event.data.object as Stripe.Checkout.Session).metadata
                ?.registrationId ?? "0",
              10,
            ) || null
          : null;

      const claimed = await claimWebhookEvent(
        event.id,
        event.type,
        registrationIdFromMeta,
      );
      if (!claimed) {
        // Already processed — return 200 so Stripe doesn't retry
        res.json({ received: true, duplicate: true });
        return;
      }

      // Ack immediately; process async
      res.json({ received: true });

      // Route event
      try {
        switch (event.type) {
          case "checkout.session.completed":
            await handleCheckoutCompleted(
              event.data.object as Stripe.Checkout.Session,
            );
            break;
          case "charge.dispute.created":
            await handleDisputeCreated(event.data.object as Stripe.Dispute);
            break;
          case "charge.refunded":
            await handleChargeRefunded(event.data.object as Stripe.Charge);
            break;
          default:
            console.log(`[StripeWebhook] Unhandled event type: ${event.type}`);
        }
      } catch (error) {
        console.error(
          `[StripeWebhook] Error processing ${event.type} (${event.id}):`,
          error,
        );
      }
    },
  );
}

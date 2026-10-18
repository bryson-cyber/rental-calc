/**
 * LLC retail checkout rail selection (2026-10-18).
 *
 * New checkouts go to Whop when the Whop payment config is complete
 * (getWhopRetailConfig); otherwise they fall back to the existing Stripe
 * checkout, with a single ops alert per server start in production. Stripe
 * stays fully wired for in-flight orders: an order holding a still-open
 * Stripe Checkout Session keeps that session (the client is mid-payment on
 * it), and a completed one is left for the Stripe webhook to settle.
 */
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { llcRegistrations } from "../../drizzle/schema";
import { getDb } from "../db";
import { getLlcRegistrationById } from "./store";
import {
  createLlcCheckoutSession,
  expireStripeCheckoutSession,
  getStripeCheckoutSessionState,
  isStripeCheckoutSessionId,
} from "./stripeCheckout";
import {
  alertWhopFallbackOnce,
  createWhopLlcCheckout,
  getWhopRetailConfig,
} from "./whopRetailCheckout";

export type RetailCheckoutParams = {
  userId: number;
  userEmail: string | null | undefined;
  userName: string | null | undefined;
  registrationId: number;
  origin: string;
  /** Admin "Generate payment link": discard any prior session and mint fresh. */
  forceNew?: boolean;
};

export type RetailCheckoutResult = {
  checkoutUrl: string;
  rail: "whop" | "stripe";
};

async function clearCheckoutSession(registrationId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(llcRegistrations)
    .set({ checkoutSessionId: null, checkoutUrl: null })
    .where(eq(llcRegistrations.id, registrationId));
}

async function stripeCheckout(params: RetailCheckoutParams): Promise<RetailCheckoutResult> {
  if (params.forceNew) {
    // Pre-existing admin behavior: always clear the old session so a fresh
    // one is generated.
    const bundle = await getLlcRegistrationById(params.userId, params.registrationId);
    if (bundle?.registration.checkoutSessionId) await clearCheckoutSession(params.registrationId);
  }
  const result = await createLlcCheckoutSession({
    userId: params.userId,
    userEmail: params.userEmail ?? null,
    userName: params.userName ?? null,
    registrationId: params.registrationId,
    origin: params.origin,
  });
  return { checkoutUrl: result.checkoutUrl, rail: "stripe" };
}

export async function createRetailCheckout(params: RetailCheckoutParams): Promise<RetailCheckoutResult> {
  const whop = getWhopRetailConfig();
  if (!whop.ok) {
    await alertWhopFallbackOnce(whop);
    return stripeCheckout(params);
  }

  const bundle = await getLlcRegistrationById(params.userId, params.registrationId);
  if (!bundle) throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found" });
  const registration = bundle.registration;

  // In-flight Stripe order: never strand a client mid-payment.
  if (
    !registration.retailPaidAt &&
    registration.checkoutSessionId &&
    isStripeCheckoutSessionId(registration.checkoutSessionId)
  ) {
    const state = await getStripeCheckoutSessionState(registration.checkoutSessionId);
    if (state === "complete") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Your payment was received and is being confirmed. Refresh this page in a moment.",
      });
    }
    if (state === "open" || state === "unknown") {
      if (!params.forceNew && registration.checkoutUrl) {
        return { checkoutUrl: registration.checkoutUrl, rail: "stripe" };
      }
      if (state === "open" && !(await expireStripeCheckoutSession(registration.checkoutSessionId))) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "The previous card checkout could not be closed. Try again in a moment.",
        });
      }
    }
    // expired (or just expired by us): safe to move this order to Whop.
  }

  const result = await createWhopLlcCheckout({
    userId: params.userId,
    registrationId: params.registrationId,
    origin: params.origin,
    forceNew: params.forceNew,
  });
  return { checkoutUrl: result.checkoutUrl, rail: "whop" };
}

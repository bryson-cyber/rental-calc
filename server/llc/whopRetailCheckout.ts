/**
 * Whop retail-payment rail for LLC formation (operator decision 2026-10-18:
 * "it should all be moved to whop"). Ported from Her First Order's
 * server/llc/retailCheckout.ts.
 *
 * Whop is a PAYMENTS rail only — filing is always doola (fileDoolaRegistration).
 *
 * Flow:
 *  1. createWhopLlcCheckout mints a Whop checkout configuration for this
 *     order's EXACT frozen retail total (this app's own markup + the
 *     expedited-EIN add-on when selected) on a hidden one-time plan that
 *     belongs to this order alone. The quote is hashed into the checkout
 *     metadata.
 *  2. A paid Whop payment arrives through the signed webhook, the
 *     reconciliation sweep on the status-poll heartbeat, or the client's
 *     return from checkout. processLlcWhopPayment re-reads the payment from
 *     the Whop API (never trusts the webhook body), verifies status, plan,
 *     quote hash, exact amount and currency, then claims the order with a
 *     conditional UPDATE (idempotent per Whop payment id).
 *  3. Paid -> retailPaidAt -> the same path the Stripe webhook uses: client
 *     payment-confirmed email, ops alert, and (when LLC_AUTO_FILE_ENABLED)
 *     the pre-filing industry guard then fileDoolaRegistration.
 *
 * White-label: nothing this module returns to a client or emails a client
 * names the filing provider. Whop's own branding inside Whop's checkout page
 * is accepted (same as HFO).
 */
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { llcRegistrations } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "../_core/env";
import { getStatePricing } from "./pricing";
import {
  findLlcRegistrationOwner,
  getLlcRegistrationById,
  transitionLlcStatus,
  updateLlcRegistrationProviderFields,
} from "./store";
import { fileDoolaRegistration } from "./doolaSubmission";
import { sendPaymentConfirmedEmail } from "./clientEmails";
import { sendOpsAlert, submissionProblemAlert } from "../ops/notify";
import { deriveDoolaIndustry } from "./doola";

export const WHOP_RETAIL_API_BASE = "https://api.whop.com/api/v1";
export const WHOP_RETAIL_API_VERSION = "2026-09-02-2";
export const LLC_CHECKOUT_METADATA_VERSION = "rc_llc_checkout_v1";
export const LLC_QUOTE_VERSION = "rc-retail-2026-10-18";
export const LLC_CHECKOUT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CANONICAL_ORIGIN = "https://coachinayahturnkeytool.com";

/** Env var NAMES the Whop rail needs. Values are never logged or returned. */
export const WHOP_RETAIL_REQUIRED_ENV = [
  "WHOP_API_KEY",
  "WHOP_COMPANY_ID",
  "WHOP_WEBHOOK_SECRET",
] as const;

export type WhopRetailConfig = {
  apiKey: string;
  companyId: string;
  webhookSecret: string;
};

export type WhopRetailConfigResult =
  | { ok: true; config: WhopRetailConfig }
  | { ok: false; missing: string[]; reason: "missing_env" | "forced_stripe" | "test_mode" };

/**
 * Is the Whop rail active for NEW checkouts? Every required env var must be
 * present; otherwise callers fall back to the existing Stripe checkout so a
 * deploy before Whop is configured never breaks checkout.
 *  - LLC_PAYMENT_RAIL=stripe is an explicit kill switch back to Stripe.
 *  - LLC_TEST_MODE=true keeps Stripe (test keys): Whop has no test card
 *    rail here, so a test-mode order must never take a live Whop payment.
 */
export function getWhopRetailConfig(env: NodeJS.ProcessEnv = process.env): WhopRetailConfigResult {
  if ((env.LLC_PAYMENT_RAIL ?? "").trim().toLowerCase() === "stripe") {
    return { ok: false, missing: [], reason: "forced_stripe" };
  }
  if (env.LLC_TEST_MODE === "true") {
    return { ok: false, missing: [], reason: "test_mode" };
  }
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  const companyId = env.WHOP_COMPANY_ID?.trim() ?? "";
  const webhookSecret = env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
  const missing: string[] = [];
  if (!apiKey) missing.push("WHOP_API_KEY");
  if (!/^biz_[A-Za-z0-9]+$/.test(companyId)) missing.push("WHOP_COMPANY_ID");
  if (!webhookSecret) missing.push("WHOP_WEBHOOK_SECRET");
  if (missing.length) return { ok: false, missing, reason: "missing_env" };
  return { ok: true, config: { apiKey, companyId, webhookSecret } };
}

/**
 * API-only config (no webhook secret needed): lets reconciliation and the
 * client-return confirmation keep settling in-flight Whop orders even if
 * the webhook secret is later removed.
 */
export function getWhopRetailApiConfig(
  env: NodeJS.ProcessEnv = process.env,
): { apiKey: string; companyId: string } | null {
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  const companyId = env.WHOP_COMPANY_ID?.trim() ?? "";
  if (!apiKey || !/^biz_[A-Za-z0-9]+$/.test(companyId)) return null;
  return { apiKey, companyId };
}

export function whopRetailHeaders(apiKey: string, extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Api-Version-Date": WHOP_RETAIL_API_VERSION,
    ...extra,
  };
}

function requireApiConfig() {
  const config = getWhopRetailApiConfig();
  if (!config) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Secure payment is temporarily unavailable.",
    });
  }
  return config;
}

// ---------------------------------------------------------------------------
// Fallback alert (once per process, production only)
// ---------------------------------------------------------------------------
let fallbackAlerted = false;

/** Test hook. */
export function resetWhopFallbackAlertForTests() {
  fallbackAlerted = false;
}

/**
 * Ops-alert ONCE (per server process — i.e. once per deploy/restart, never
 * per request) when production checkout falls back to Stripe because the
 * Whop config is incomplete. Names env vars only; never values.
 */
export async function alertWhopFallbackOnce(result: WhopRetailConfigResult): Promise<void> {
  if (result.ok || fallbackAlerted || !ENV.isProduction) return;
  if (result.reason !== "missing_env") return; // deliberate kill switch / test mode: no alarm
  fallbackAlerted = true;
  await sendOpsAlert({
    subject: "LLC checkout is using Stripe — Whop payment config incomplete",
    lines: [
      "New LLC checkouts fell back to the existing Stripe checkout because the Whop payment rail is not fully configured.",
      "",
      `Missing or invalid environment variables: ${result.missing.join(", ")}`,
      "",
      "Set them in the Manus environment settings and redeploy to move new checkouts to Whop. Stripe keeps working meanwhile.",
      "This alert fires once per server start.",
    ],
  }).catch(() => false);
}

// ---------------------------------------------------------------------------
// Quote + metadata
// ---------------------------------------------------------------------------
type WhopCheckoutResponse = {
  id?: string;
  purchase_url?: string;
  plan_id?: string;
  plan?: { id?: string } | null;
};

/** Whop money: a scalar in dollars (older revisions) or { amount, currency } (the 2026 API). */
export type WhopMoney = number | string | { amount?: number | string | null; currency?: string | null } | null | undefined;

export type WhopPayment = {
  id?: string;
  status?: string;
  substatus?: string;
  total?: WhopMoney;
  /** Sales tax Whop added on top of the plan price (absent or null when none). */
  tax_amount?: WhopMoney;
  currency?: string;
  plan_id?: string | null;
  plan?: { id?: string } | null;
  metadata?: Record<string, unknown> | null;
};

/** A Whop money value in dollars; null for anything malformed or negative (fails closed). */
export function readWhopMoneyAmount(value: WhopMoney): number | null {
  const raw = typeof value === "object" && value !== null ? value.amount : value;
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  if (typeof raw === "string" && !raw.trim()) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function readWhopMoneyCurrency(value: WhopMoney): string | null {
  if (typeof value !== "object" || value === null || typeof value.currency !== "string") return null;
  const currency = value.currency.trim();
  return /^[a-z]{3}$/i.test(currency) ? currency.toUpperCase() : null;
}

/**
 * What she paid BEFORE any sales tax Whop added, in cents: total − tax_amount (Her First Order's fix, PR #327). The
 * plan is created for the exact pre-tax price, so this is the amount to compare; a taxed payment of the right price
 * is accepted, a short one is not. NaN when either value is unreadable, so a comparison always fails closed.
 */
export function priceBeforeTaxCents(payment: Pick<WhopPayment, "total" | "tax_amount">): number {
  const toCents = (value: number | null) => (value === null ? Number.NaN : Math.round(value * 100));
  const total = toCents(readWhopMoneyAmount(payment.total));
  const tax = payment.tax_amount === undefined || payment.tax_amount === null ? 0 : toCents(readWhopMoneyAmount(payment.tax_amount));
  return Number.isSafeInteger(total) && Number.isSafeInteger(tax) ? total - tax : Number.NaN;
}

export function centsToWhopPrice(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function safePurchaseUrl(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  if (value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `https://whop.com${value}`;
  return "";
}

export function buildLlcQuoteHash(input: {
  registrationId: number;
  state: string;
  amountCents: number;
  currency: string;
  quoteVersion: string;
  expediteEin: boolean;
}): string {
  return createHash("sha256")
    .update(
      [
        "rc-llc-quote-v1",
        input.registrationId,
        input.state,
        input.amountCents,
        input.currency.toUpperCase(),
        input.quoteVersion,
        input.expediteEin ? "expedite-ein" : "standard-ein",
      ].join("|"),
    )
    .digest("hex");
}

export function readLlcPaymentMetadata(payment: WhopPayment): {
  registrationId: number;
  quoteHash: string;
  quoteVersion: string;
} | null {
  const metadata = payment.metadata;
  if (
    !metadata ||
    metadata.rc_metadata_version !== LLC_CHECKOUT_METADATA_VERSION ||
    metadata.rc_checkout_kind !== "llc_filing"
  ) {
    return null;
  }
  const registrationId = Number(metadata.rc_llc_registration_id);
  const quoteHash = String(metadata.rc_llc_quote_hash || "");
  const quoteVersion = String(metadata.rc_llc_quote_version || "");
  if (
    !Number.isSafeInteger(registrationId) ||
    registrationId <= 0 ||
    !/^[a-f0-9]{64}$/.test(quoteHash) ||
    !quoteVersion
  ) {
    return null;
  }
  return { registrationId, quoteHash, quoteVersion };
}

/** Return-to origin allowlist; anything else returns to the canonical domain. */
export function safeCheckoutOrigin(origin: string | null | undefined): string {
  if (!origin) return CANONICAL_ORIGIN;
  const trimmed = origin.replace(/\/+$/, "");
  if (
    /^https:\/\/(?:[a-z0-9-]+\.)*coachinayahturnkeytool\.com$/i.test(trimmed) ||
    /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.manus\.(?:space|computer)$/i.test(trimmed) ||
    (!ENV.isProduction && /^http:\/\/localhost(?::\d+)?$/i.test(trimmed))
  ) {
    return trimmed;
  }
  return CANONICAL_ORIGIN;
}

/** Exact retail total: frozen snapshot, else state retail + expedited-EIN add-on. */
async function resolveRetailAmountCents(registration: {
  retailPriceCents: number | null;
  formationState: string | null;
  expediteEin: boolean;
}): Promise<{ amountCents: number; snapshot: boolean }> {
  if (registration.retailPriceCents !== null && registration.retailPriceCents > 0) {
    return { amountCents: registration.retailPriceCents, snapshot: false };
  }
  if (!registration.formationState) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This filing price is not ready. Please contact support.",
    });
  }
  const pricing = await getStatePricing(registration.formationState);
  if (pricing.retailPriceCents === null || pricing.retailPriceCents <= 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This filing price is not ready. Please contact support.",
    });
  }
  const addOn =
    registration.expediteEin && pricing.expediteEinPriceCents
      ? pricing.expediteEinPriceCents
      : 0;
  return { amountCents: pricing.retailPriceCents + addOn, snapshot: true };
}

// ---------------------------------------------------------------------------
// Checkout creation
// ---------------------------------------------------------------------------
export type WhopLlcCheckout = {
  checkoutUrl: string;
  sessionId: string;
  planId: string;
  amountCents: number;
  expiresAt: number;
  existing: boolean;
};

export async function createWhopLlcCheckout(input: {
  userId: number;
  registrationId: number;
  origin: string;
  /** Admin "Generate payment link": always mint a fresh checkout configuration. */
  forceNew?: boolean;
  fetchImpl?: typeof fetch;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}): Promise<WhopLlcCheckout> {
  const configResult = getWhopRetailConfig(input.env);
  if (!configResult.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Secure payment is temporarily unavailable.",
    });
  }
  const { apiKey, companyId } = configResult.config;
  const bundle = await getLlcRegistrationById(input.userId, input.registrationId);
  if (!bundle) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found" });
  }
  const registration = bundle.registration;
  if (
    registration.isTest ||
    registration.provider !== "doola" ||
    registration.status !== "payment_required" ||
    registration.retailPaidAt ||
    registration.retailWhopPaymentId ||
    registration.doolaCompanyId
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: registration.retailPaidAt
        ? `Registration #${registration.id} is already paid`
        : "This filing is not waiting for payment.",
    });
  }

  const state = registration.formationState || "";
  const { amountCents, snapshot } = await resolveRetailAmountCents(registration);
  const quoteHash = buildLlcQuoteHash({
    registrationId: registration.id,
    state,
    amountCents,
    currency: "USD",
    quoteVersion: LLC_QUOTE_VERSION,
    expediteEin: Boolean(registration.expediteEin),
  });
  const now = input.now ?? new Date();

  // Reuse a live prepared checkout for the identical quote.
  if (
    !input.forceNew &&
    registration.checkoutSessionId &&
    !registration.checkoutSessionId.startsWith("cs_") &&
    registration.checkoutUrl &&
    registration.retailWhopPlanId &&
    registration.checkoutQuoteHash === quoteHash &&
    registration.checkoutExpiresAt &&
    registration.checkoutExpiresAt.getTime() > now.getTime()
  ) {
    return {
      checkoutUrl: registration.checkoutUrl,
      sessionId: registration.checkoutSessionId,
      planId: registration.retailWhopPlanId,
      amountCents,
      expiresAt: registration.checkoutExpiresAt.getTime(),
      existing: true,
    };
  }

  const redirectUrl = `${safeCheckoutOrigin(input.origin)}/llc/status/${registration.id}?payment=success`;
  const metadata = {
    rc_metadata_version: LLC_CHECKOUT_METADATA_VERSION,
    rc_checkout_kind: "llc_filing",
    rc_llc_registration_id: String(registration.id),
    rc_llc_quote_hash: quoteHash,
    rc_llc_quote_version: LLC_QUOTE_VERSION,
  };
  // Same quote -> keep the order's existing plan, so every link ever issued
  // for this order pays the one plan reconciliation watches. A changed quote
  // (ops edited the price) mints a new exact-price plan.
  const reusePlan = Boolean(
    registration.retailWhopPlanId && registration.checkoutQuoteHash === quoteHash,
  );
  const stateLabel = state || "US";
  const requestBody = reusePlan
    ? { plan_id: registration.retailWhopPlanId, redirect_url: redirectUrl, metadata }
    : {
        account_id: companyId,
        redirect_url: redirectUrl,
        metadata,
        plan: {
          initial_price: centsToWhopPrice(amountCents),
          plan_type: "one_time",
          currency: "usd",
          force_create_new_plan: true,
          product: {
            title: `LLC Formation — ${stateLabel}`,
            description: registration.expediteEin
              ? "LLC formation filing with expedited EIN"
              : "LLC formation filing",
            visibility: "hidden",
            external_identifier: `rc_llc_${registration.id}_${quoteHash.slice(0, 16)}`,
          },
        },
      };
  const idempotencyKey = `rc-llc-checkout-${registration.id}-${quoteHash.slice(0, 32)}-${
    input.forceNew ? now.getTime() : Math.floor(now.getTime() / LLC_CHECKOUT_TTL_MS)
  }`;
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(`${WHOP_RETAIL_API_BASE}/checkout_configurations`, {
      method: "POST",
      headers: whopRetailHeaders(apiKey, {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      }),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Secure payment could not be prepared. Please try again.",
    });
  }
  const payload = (await response.json().catch(() => ({}))) as WhopCheckoutResponse;
  const planId = String(
    payload.plan?.id || payload.plan_id || (reusePlan ? registration.retailWhopPlanId : "") || "",
  );
  const purchaseUrl = safePurchaseUrl(payload.purchase_url);
  if (!response.ok || !payload.id || !purchaseUrl || !planId) {
    console.error("[WhopRetail] checkout configuration failed", {
      registrationId: registration.id,
      status: response.status,
      hasSession: Boolean(payload.id),
      hasPlan: Boolean(planId),
    });
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Secure payment could not be prepared. Please try again.",
    });
  }
  const expiresAt = new Date(now.getTime() + LLC_CHECKOUT_TTL_MS);
  await updateLlcRegistrationProviderFields(input.userId, input.registrationId, {
    checkoutSessionId: payload.id,
    checkoutUrl: purchaseUrl,
    checkoutTotal: amountCents,
    checkoutCurrency: "USD",
    retailWhopPlanId: planId,
    checkoutQuoteHash: quoteHash,
    checkoutExpiresAt: expiresAt,
    ...(snapshot ? { retailPriceCents: amountCents } : {}),
  });
  return {
    checkoutUrl: purchaseUrl,
    sessionId: payload.id,
    planId,
    amountCents,
    expiresAt: expiresAt.getTime(),
    existing: false,
  };
}

// ---------------------------------------------------------------------------
// Payment confirmation
// ---------------------------------------------------------------------------
export type LlcWhopPaymentResult = {
  outcome:
    | "filed"
    | "already_filed"
    | "filing_started"
    | "filing_failed"
    | "filing_held"
    | "already_paid"
    | "action_required";
  registrationId: number;
  paymentId: string;
};

export async function fetchWhopPayment(
  paymentId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WhopPayment | null> {
  const { apiKey } = requireApiConfig();
  const response = await fetchImpl(
    `${WHOP_RETAIL_API_BASE}/payments/${encodeURIComponent(paymentId)}`,
    { headers: whopRetailHeaders(apiKey), signal: AbortSignal.timeout(20_000) },
  );
  if (response.status === 404) return null;
  const payment = (await response.json().catch(() => ({}))) as WhopPayment;
  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Payment confirmation is delayed. Your payment is safe; refresh in a moment.",
    });
  }
  return payment;
}

/**
 * Post-payment path, mirroring the Stripe webhook's handleCheckoutCompleted:
 * pre-filing industry guard, then fileDoolaRegistration — only when
 * LLC_AUTO_FILE_ENABLED (otherwise ops' Mark paid / retry files it).
 */
async function fileAfterRetailPayment(
  registration: { id: number; userId: number; legalName: string | null; entitySuffix: string },
): Promise<LlcWhopPaymentResult["outcome"]> {
  if (!ENV.llcAutoFileEnabled) return "filing_held";
  const bundle = await getLlcRegistrationById(registration.userId, registration.id);
  const industry = bundle ? deriveDoolaIndustry(bundle.registration) : undefined;
  if (!industry) {
    await transitionLlcStatus({
      userId: registration.userId,
      registrationId: registration.id,
      toStatus: "action_required",
      source: "system",
      note: "Industry could not be mapped to a valid filing category. Our team will resolve this.",
      expectedStatuses: ["payment_required", "ready"],
      updates: {
        lastErrorType: "industry_unmappable",
        lastErrorMessage:
          "Your selected industry could not be mapped to a valid filing category. Our team is reviewing and will update your filing shortly.",
        retryable: false,
      },
    }).catch(() => {});
    void sendOpsAlert(
      submissionProblemAlert({
        registrationId: registration.id,
        legalName: `${registration.legalName ?? "Unknown"} ${registration.entitySuffix}`,
        errorType: "industry_unmappable",
        message:
          "Payment received (Whop) but industry cannot be resolved to a valid Doola label. Registration businessType/industryType needs manual correction before filing can proceed.",
        uncertain: false,
      }),
    ).catch(() => {});
    return "action_required";
  }
  try {
    const filing = await fileDoolaRegistration({
      userId: registration.userId,
      registrationId: registration.id,
    });
    if (filing.outcome === "filed") return "filed";
    if (filing.outcome === "already_filed") return "already_filed";
    if (filing.outcome === "failed") return "filing_failed";
    return "filing_started";
  } catch (error) {
    console.error(`[WhopRetail] Auto-file after payment failed for #${registration.id}:`, error);
    return "filing_failed";
  }
}

function whopPaymentReceivedAlert(registration: {
  id: number;
  legalName: string | null;
  entitySuffix: string;
  formationState: string | null;
}, paymentId: string, amountCents: number) {
  const name = registration.legalName
    ? `${registration.legalName} ${registration.entitySuffix}`
    : `Order #${registration.id}`;
  return {
    subject: `💰 Whop payment received — ${name} (#${registration.id})`,
    lines: [
      `A client paid via Whop checkout.`,
      ``,
      `Company: ${name}`,
      `Formation state: ${registration.formationState ?? "n/a"}`,
      `Order: #${registration.id}`,
      `Amount: $${(amountCents / 100).toFixed(2)} USD`,
      `Whop payment: ${paymentId}`,
      ``,
      ENV.llcAutoFileEnabled
        ? `Auto-file is ENABLED — the filing will proceed automatically.`
        : `Auto-file is DISABLED — manual "Mark paid" is still required to trigger filing.`,
    ],
  };
}

/**
 * Verify one Whop payment against its order and, if it matches exactly,
 * mark the order paid and continue to filing. Returns null when the payment
 * is not (yet) a succeeded payment for an LLC order of this app. Throws
 * FORBIDDEN/CONFLICT for a payment that cannot be applied (callers alert).
 */
export async function processLlcWhopPayment(input: {
  paymentId: string;
  expectedUserId?: number;
  expectedRegistrationId?: number;
  fetchImpl?: typeof fetch;
}): Promise<LlcWhopPaymentResult | null> {
  const payment = await fetchWhopPayment(input.paymentId, input.fetchImpl ?? fetch);
  if (!payment || payment.status !== "paid" || payment.substatus !== "succeeded") return null;
  if (payment.id && payment.id !== input.paymentId) return null;
  const metadata = readLlcPaymentMetadata(payment);
  if (!metadata) return null;
  if (input.expectedRegistrationId && metadata.registrationId !== input.expectedRegistrationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This payment does not belong to this filing." });
  }
  const owner = await findLlcRegistrationOwner(metadata.registrationId);
  if (!owner || (input.expectedUserId && owner.userId !== input.expectedUserId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This payment does not belong to this filing." });
  }
  const bundle = await getLlcRegistrationById(owner.userId, metadata.registrationId);
  if (!bundle) throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found" });
  const registration = bundle.registration;
  if (registration.isTest || registration.provider !== "doola") {
    throw new TRPCError({ code: "FORBIDDEN", message: "This payment cannot be applied to this filing." });
  }

  // Idempotent replay: the same payment already claimed this order.
  if (registration.retailWhopPaymentId) {
    if (registration.retailWhopPaymentId !== input.paymentId) {
      throw new TRPCError({ code: "CONFLICT", message: "This filing already has a different confirmed payment." });
    }
    // Paid but filing never started (e.g. crash between claim and file):
    // resume filing only from payment_required — never auto-retry a failed
    // filing, which stays an ops decision exactly as on the Stripe rail.
    const outcome =
      registration.status === "payment_required" && !registration.doolaCompanyId
        ? await fileAfterRetailPayment(registration)
        : registration.doolaCompanyId
          ? "already_filed"
          : "already_paid";
    return {
      outcome: outcome === "filing_held" ? "already_paid" : outcome,
      registrationId: registration.id,
      paymentId: input.paymentId,
    };
  }
  if (registration.retailPaidAt) {
    // Paid through another rail (Stripe / ops Mark paid) — never double-apply.
    throw new TRPCError({ code: "CONFLICT", message: "This filing is already paid." });
  }

  const planId = String(payment.plan_id || payment.plan?.id || "");
  // Compare the amount before sales tax (HFO PR #327): Whop adds tax on top of the
  // exact-price plan, so payment.total alone would refuse every taxed payment.
  const paidCents = priceBeforeTaxCents(payment);
  const currency = String(payment.currency || readWhopMoneyCurrency(payment.total) || "").toUpperCase();
  if (
    !registration.retailWhopPlanId ||
    planId !== registration.retailWhopPlanId ||
    metadata.quoteHash !== registration.checkoutQuoteHash ||
    metadata.quoteVersion !== LLC_QUOTE_VERSION ||
    !Number.isSafeInteger(paidCents) ||
    registration.retailPriceCents === null ||
    paidCents !== registration.retailPriceCents ||
    currency !== "USD"
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This payment does not match the filing quote." });
  }

  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Secure payment is temporarily unavailable." });
  }
  const claim = await db
    .update(llcRegistrations)
    .set({ retailWhopPaymentId: input.paymentId, retailPaidAt: new Date() })
    .where(
      and(
        eq(llcRegistrations.id, registration.id),
        eq(llcRegistrations.userId, owner.userId),
        eq(llcRegistrations.retailWhopPlanId, planId),
        eq(llcRegistrations.checkoutQuoteHash, metadata.quoteHash),
        isNull(llcRegistrations.retailPaidAt),
        isNull(llcRegistrations.retailWhopPaymentId),
      ),
    );
  if (Number((claim as any)[0]?.affectedRows ?? 0) !== 1) {
    // Lost a race with a concurrent delivery of the same payment.
    const fresh = await getLlcRegistrationById(owner.userId, registration.id);
    if (fresh?.registration.retailWhopPaymentId !== input.paymentId) {
      throw new TRPCError({ code: "CONFLICT", message: "Payment confirmation is already being processed." });
    }
    return { outcome: "already_paid", registrationId: registration.id, paymentId: input.paymentId };
  }

  console.log(`[WhopRetail] Marked registration #${registration.id} as paid via Whop`);
  void sendPaymentConfirmedEmail({ userId: owner.userId, registrationId: registration.id }).catch(() => {});
  void sendOpsAlert(whopPaymentReceivedAlert(registration, input.paymentId, paidCents)).catch(() => {});
  const outcome = await fileAfterRetailPayment(registration);
  return { outcome, registrationId: registration.id, paymentId: input.paymentId };
}

/**
 * App glue: paying the state fee for an annual report through this app's own LLC payment rail, the Whop checkout
 * formation uses (whopRetailCheckout.ts, operator decision 2026-10-18 "it should all be moved to whop"), with no
 * service fee (the owner, 2026-10-20). Same contract as Her First Order's port:
 *
 *  - a hidden one-time plan for exactly this report's fixed price (priceInCents), metadata naming the row, the
 *    registration and a quote hash, an idempotency key per row + hash, reused while it lives;
 *  - a payment is verified on the server, never from the page or the webhook body: re-read from Whop, paid +
 *    succeeded, our metadata, the plan made for this report, the quote hash, the amount BEFORE sales tax equal to
 *    that price, USD;
 *  - claimed once on the row (a guarded UPDATE), and only then handed to confirmReport, which re-reads the report
 *    from the filing provider and refuses a changed price;
 *  - anything that doesn't match is never applied: lastError = payment_mismatch and ops hear once.
 *
 * Stripe stays the formation fallback only (retailCheckoutRail.ts); annual reports are Whop-only, so with the Whop
 * config incomplete the checkout says secure payment is unavailable and ops hear once per server start.
 *
 * Entry points, all safe to repeat: the page's confirm call after she pays (Whop hands back ?payment_id=), the signed
 * Whop webhook (whopRetailWebhook.ts routes it here before the formation branch), and the hourly reconciliation over
 * checkouts with no payment seen (sweep.ts).
 */
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { ENV } from "../../_core/env";
import { sendOpsAlert } from "../../ops/notify";
import {
  LLC_CHECKOUT_TTL_MS,
  WHOP_RETAIL_API_BASE,
  centsToWhopPrice,
  fetchWhopPayment,
  priceBeforeTaxCents,
  readWhopMoneyCurrency,
  getWhopRetailApiConfig,
  getWhopRetailConfig,
  safeCheckoutOrigin,
  safePurchaseUrl,
  whopRetailHeaders,
  type WhopPayment,
} from "../whopRetailCheckout";
import { paidPaymentsForExactPlan } from "../whopRetailWebhook";
import { LLC_STATE_NAMES } from "../../../shared/llc";
import { feeWords } from "../../../shared/llcAnnualReports";
import { AnnualReportError, OPS_FEE_ACTION_LABELS, confirmReport, requireOpenFiling, type AnnualReportDeps, type ConfirmOutcome } from "./service";
import type { AnnualReportRow } from "./store";
import { defaultAnnualReportDeps } from "./defaults";
import {
  ANNUAL_REPORT_CHECKOUT_KIND,
  ANNUAL_REPORT_CHECKOUT_METADATA_VERSION,
  isAnnualReportPaymentPayload,
  readAnnualReportPaymentMetadata,
} from "./paymentMetadata";

export { ANNUAL_REPORT_CHECKOUT_KIND, ANNUAL_REPORT_CHECKOUT_METADATA_VERSION, isAnnualReportPaymentPayload, readAnnualReportPaymentMetadata };
/** Re-exported: the one before-tax rule both the formation and the annual report payments use (whopRetailCheckout.ts). */
export { priceBeforeTaxCents };

/** Where Whop sends her back: her LLC page, marked so the page confirms the annual report payment (not formation). */
export const ANNUAL_REPORT_RETURN_PARAM = "annual_report";

export type AnnualReportCheckoutSession = {
  sessionId: string;
  purchaseUrl: string;
  planId: string;
  amountCents: number;
  currency: "USD";
  expiresAt: number;
};

export type AnnualReportPaymentResult = {
  outcome: ConfirmOutcome | "payment_mismatch" | "duplicate_payment";
  reportId: number;
  registrationId: number;
  paymentId: string;
};

export function buildAnnualReportQuoteHash(input: {
  reportId: number;
  registrationId: number;
  fiscalYear: number;
  annualReportId: string;
  amountCents: number;
  currency: string;
}): string {
  return createHash("sha256")
    .update(
      ["rc-llc-annual-report-v1", input.reportId, input.registrationId, input.fiscalYear, input.annualReportId, input.amountCents, input.currency.toUpperCase()].join("|"),
    )
    .digest("hex");
}

// ─── Checkout ───────────────────────────────────────────────────────────────────────────────────────────────────────

let unavailableAlerted = false;

/** Test hook. */
export function resetAnnualReportPaymentAlertForTests() {
  unavailableAlerted = false;
}

async function alertPaymentsUnavailableOnce(missing: string[], reason: string) {
  if (unavailableAlerted || !ENV.isProduction) return;
  unavailableAlerted = true;
  await sendOpsAlert({
    subject: "Annual report payments are unavailable: Whop payment config incomplete",
    lines: [
      "A member tried to pay her LLC annual report state fee, but the Whop payment rail is not active, so the checkout could not open.",
      reason === "missing_env" ? `Missing or invalid environment variables: ${missing.join(", ")}` : `Reason: ${reason} (LLC_PAYMENT_RAIL=stripe or LLC_TEST_MODE keeps Whop off).`,
      "Annual reports have no Stripe fallback. Set the Whop variables in the Manus environment settings and redeploy.",
      "This alert fires once per server start.",
    ],
  }).catch(() => false);
}

type WhopCheckoutResponse = { id?: string; purchase_url?: string; plan_id?: string; plan?: { id?: string } | null };

export async function createAnnualReportCheckout(
  input: { userId: number; registrationId: number; reportId: number; origin: string; fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv },
  deps: AnnualReportDeps = defaultAnnualReportDeps(),
): Promise<AnnualReportCheckoutSession> {
  const facts = await deps.filings.load(input.registrationId);
  if (!facts || facts.userId !== input.userId) throw new TRPCError({ code: "NOT_FOUND", message: "This LLC could not be found in your account." });
  if (!facts.eligible) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Annual reports open here once your LLC is official." });
  const row = await deps.store.getReport(input.reportId);
  if (!row || row.registrationId !== input.registrationId) throw new TRPCError({ code: "NOT_FOUND", message: "This annual report could not be found." });
  if (row.paidAt || row.confirmedAt || row.status !== "FILLED" || !row.annualReportId) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This annual report isn't waiting for payment." });
  }
  // Only for the cycle that's open now (the same window and fiscal year the form and the submit require; live check
  // 2026-10-20: no payment, so no hand-off to file, before the window opens).
  let cycle;
  try {
    ({ cycle } = await requireOpenFiling(input.registrationId, deps));
  } catch (error) {
    if (error instanceof AnnualReportError) throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
    throw error;
  }
  if (row.dueDate ? row.dueDate !== cycle.dueDate : row.fiscalYear !== cycle.fiscalYear) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This annual report isn't waiting for payment." });
  }
  if (row.priceInCents === null) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The state fee for your answers isn't set yet. Please try again in a few minutes." });
  }
  const amountCents = row.priceInCents;
  if (amountCents <= 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "There's no state fee to pay for this report." });

  const config = getWhopRetailConfig(input.env);
  if (!config.ok) {
    await alertPaymentsUnavailableOnce(config.missing, config.reason);
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Secure payment is temporarily unavailable. Please try again later." });
  }
  const { apiKey, companyId } = config.config;

  const quoteHash = buildAnnualReportQuoteHash({
    reportId: row.id,
    registrationId: row.registrationId,
    fiscalYear: row.fiscalYear,
    annualReportId: row.annualReportId,
    amountCents,
    currency: "USD",
  });
  const now = deps.now();
  if (
    row.checkoutSessionId &&
    row.checkoutUrl &&
    row.checkoutPlanId &&
    row.checkoutQuoteHash === quoteHash &&
    row.checkoutPriceCents === amountCents &&
    row.checkoutExpiresAt &&
    row.checkoutExpiresAt.getTime() > now.getTime()
  ) {
    return { sessionId: row.checkoutSessionId, purchaseUrl: row.checkoutUrl, planId: row.checkoutPlanId, amountCents, currency: "USD", expiresAt: row.checkoutExpiresAt.getTime() };
  }

  const state = String(facts.state ?? "").toUpperCase();
  const stateName = LLC_STATE_NAMES[state as keyof typeof LLC_STATE_NAMES] ?? state;
  const redirectUrl = `${safeCheckoutOrigin(input.origin)}/llc/status/${row.registrationId}?${ANNUAL_REPORT_RETURN_PARAM}=paid`;
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(`${WHOP_RETAIL_API_BASE}/checkout_configurations`, {
      method: "POST",
      headers: whopRetailHeaders(apiKey, { "Content-Type": "application/json", "Idempotency-Key": `rc-llc-annual-report-checkout-${row.id}-${quoteHash}` }),
      body: JSON.stringify({
        account_id: companyId,
        redirect_url: redirectUrl,
        metadata: {
          rc_metadata_version: ANNUAL_REPORT_CHECKOUT_METADATA_VERSION,
          rc_checkout_kind: ANNUAL_REPORT_CHECKOUT_KIND,
          rc_llc_registration_id: String(row.registrationId),
          rc_llc_annual_report_id: String(row.id),
          rc_llc_annual_report_quote_hash: quoteHash,
        },
        plan: {
          initial_price: centsToWhopPrice(amountCents),
          plan_type: "one_time",
          currency: "usd",
          force_create_new_plan: true,
          product: {
            title: `Coach Inayah annual report, ${stateName || "state"} ${row.fiscalYear}`,
            description: "State annual report fee",
            visibility: "hidden",
            external_identifier: `rc_llc_ar_${row.id}_${quoteHash.slice(0, 16)}`,
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Secure payment could not be prepared. Please try again." });
  }
  const payload = (await response.json().catch(() => ({}))) as WhopCheckoutResponse;
  const planId = String(payload.plan?.id || payload.plan_id || "");
  const purchaseUrl = safePurchaseUrl(payload.purchase_url);
  if (!response.ok || !payload.id || !purchaseUrl || !planId) {
    console.error("[LlcAnnualReport] checkout configuration failed", { reportId: row.id, status: response.status, hasSession: Boolean(payload.id), hasPlan: Boolean(planId) });
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Secure payment could not be prepared. Please try again." });
  }
  const expiresAt = new Date(now.getTime() + LLC_CHECKOUT_TTL_MS);
  const saved = await deps.store.updateReport(
    row.id,
    { checkoutSessionId: payload.id, checkoutUrl: purchaseUrl, checkoutPlanId: planId, checkoutQuoteHash: quoteHash, checkoutPriceCents: amountCents, checkoutExpiresAt: expiresAt },
    { paidAtIsNull: true },
  );
  if (!saved) throw new TRPCError({ code: "CONFLICT", message: "This annual report was just paid. Refresh the page." });
  return { sessionId: payload.id, purchaseUrl, planId, amountCents, currency: "USD", expiresAt: expiresAt.getTime() };
}

// ─── Verification ──────────────────────────────────────────────────────────────────────────────────────────────────

const paymentRef = (paymentId: string) => createHash("sha256").update(paymentId).digest("hex").slice(0, 10);

const paidWordsOf = (paidCents: number, currency: string) =>
  `${Number.isSafeInteger(paidCents) ? feeWords(paidCents) : "an unreadable amount"}${currency ? ` ${currency}` : ""}`;

/** A second, different payment for a report already paid: never applied; ops refund it. Once per payment. */
async function alertDuplicatePayment(deps: AnnualReportDeps, row: AnnualReportRow, paymentId: string, paidWith: string | null) {
  await deps.alerts.once({
    registrationId: row.registrationId,
    type: `ar_dup_pay_${row.id}_${paymentRef(paymentId)}`,
    subject: `Second payment for one annual report (order #${row.registrationId})`,
    lines: [
      `Order #${row.registrationId}, ${row.fiscalYear} annual report was already paid with ${paidWith ?? "another payment"}; another Whop payment ${paymentId} also succeeded.`,
      "Refund the second payment in the Whop dashboard. Nothing else was changed.",
    ],
  });
}

/** A real payment that isn't this report's fee on file (or its checkout): never applied. Once per payment. */
async function alertPaymentMismatch(deps: AnnualReportDeps, row: AnnualReportRow, paymentId: string, paidWords: string) {
  await deps.store.updateReport(row.id, { lastError: "payment_mismatch", lastErrorAt: deps.now() }, { paidAtIsNull: true });
  await deps.alerts.once({
    registrationId: row.registrationId,
    type: `ar_pay_mismatch_${row.id}_${paymentRef(paymentId)}`,
    subject: `Annual report payment does not match the fee (order #${row.registrationId})`,
    lines: [
      `Order #${row.registrationId}, ${row.fiscalYear} annual report: Whop payment ${paymentId} paid ${paidWords} before tax, but the fee on file is ${row.priceInCents !== null ? feeWords(row.priceInCents) : "not set yet"} (or the checkout it was made for is no longer this report's).`,
      `Usually her answers changed the fee after this checkout was made. The report was NOT confirmed and this payment was NOT applied, so "${OPS_FEE_ACTION_LABELS.absorb_difference}" doesn't apply to it. Refund it in the Whop dashboard, then on /admin/llc open the order's Annual reports and press "${OPS_FEE_ACTION_LABELS.refunded_pay_again}": she gets an email with a link to pay the fee on file.`,
    ],
  });
}

/**
 * Verify one payment and, when it is exactly this report's fee, claim it and confirm the report. Null while the
 * payment isn't paid yet or isn't an annual report payment. A real payment that doesn't match is never applied: ops
 * hear once and the report stays unconfirmed.
 */
export async function processAnnualReportPayment(
  input: { paymentId: string; expectedUserId?: number; expectedRegistrationId?: number; fetchImpl?: typeof fetch },
  deps: AnnualReportDeps = defaultAnnualReportDeps(),
): Promise<AnnualReportPaymentResult | null> {
  const payment: WhopPayment | null = await fetchWhopPayment(input.paymentId, input.fetchImpl ?? fetch);
  if (!payment || payment.status !== "paid" || payment.substatus !== "succeeded") return null;
  if (payment.id && payment.id !== input.paymentId) return null;
  const metadata = readAnnualReportPaymentMetadata(payment);
  if (!metadata) return null;
  if (input.expectedRegistrationId && metadata.registrationId !== input.expectedRegistrationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This payment does not belong to this annual report." });
  }
  const row = await deps.store.getReport(metadata.reportId);
  if (!row || row.registrationId !== metadata.registrationId) throw new TRPCError({ code: "FORBIDDEN", message: "This payment does not belong to this annual report." });
  const facts = await deps.filings.load(row.registrationId);
  if (!facts) throw new TRPCError({ code: "NOT_FOUND", message: "This LLC could not be found." });
  if (input.expectedUserId && facts.userId !== input.expectedUserId) throw new TRPCError({ code: "FORBIDDEN", message: "This payment does not belong to this annual report." });
  const base = { reportId: row.id, registrationId: row.registrationId, paymentId: input.paymentId };

  if (row.paymentReference) {
    if (row.paymentReference === input.paymentId) {
      // A replay (webhook retry, the return page, the reconciler): the claim stands; the confirm is idempotent.
      return { ...base, outcome: await confirmReport(row.id, { source: "payment" }, deps) };
    }
    await alertDuplicatePayment(deps, row, input.paymentId, row.paymentReference);
    return { ...base, outcome: "duplicate_payment" };
  }

  const planId = String(payment.plan_id || payment.plan?.id || "");
  const paidCents = priceBeforeTaxCents(payment);
  const currency = String(payment.currency || readWhopMoneyCurrency(payment.total) || "").toUpperCase();
  if (
    !row.checkoutPlanId ||
    planId !== row.checkoutPlanId ||
    metadata.quoteHash !== row.checkoutQuoteHash ||
    !Number.isSafeInteger(paidCents) ||
    paidCents !== row.checkoutPriceCents ||
    paidCents !== row.priceInCents ||
    currency !== "USD"
  ) {
    await alertPaymentMismatch(deps, row, input.paymentId, paidWordsOf(paidCents, currency));
    return { ...base, outcome: "payment_mismatch" };
  }

  const claimed = await deps.store.updateReport(
    row.id,
    { paymentReference: input.paymentId, paidCents, paidAt: deps.now(), lastError: null, lastErrorAt: null },
    { paidAtIsNull: true, checkoutPlanId: planId },
  );
  if (!claimed) {
    // Lost the claim: another payment won it (ops hear, like any second payment), or the report's checkout changed
    // under it (a resubmit with a new fee), which is a mismatch. Either way this payment is never applied.
    const fresh = await deps.store.getReport(row.id);
    if (fresh?.paymentReference !== input.paymentId) {
      if (fresh && !fresh.paidAt && fresh.checkoutPlanId !== planId) {
        await alertPaymentMismatch(deps, fresh, input.paymentId, paidWordsOf(paidCents, currency));
        return { ...base, outcome: "payment_mismatch" };
      }
      await alertDuplicatePayment(deps, fresh ?? row, input.paymentId, fresh?.paymentReference ?? null);
      return { ...base, outcome: "duplicate_payment" };
    }
  }
  return { ...base, outcome: await confirmReport(row.id, { source: "payment" }, deps) };
}

/** The backstop: checkouts with no payment seen, read from Whop's payments list for their exact plan. */
export async function reconcileAnnualReportPayments(
  input: { fetchImpl?: typeof fetch; processPayment?: typeof processAnnualReportPayment; env?: NodeJS.ProcessEnv } = {},
  deps: AnnualReportDeps = defaultAnnualReportDeps(),
): Promise<Record<string, number>> {
  const outcomes: Record<string, number> = {};
  const config = getWhopRetailApiConfig(input.env);
  if (!config) return outcomes;
  const fetchImpl = input.fetchImpl ?? fetch;
  const processPayment = input.processPayment ?? processAnnualReportPayment;
  const now = deps.now();
  for (const row of await deps.store.listAwaitingPayment(new Date(now.getTime() - LLC_CHECKOUT_TTL_MS), 100)) {
    if (!row.checkoutPlanId) continue;
    const createdAfter = row.checkoutExpiresAt ? new Date(row.checkoutExpiresAt.getTime() - LLC_CHECKOUT_TTL_MS) : new Date(now.getTime() - LLC_CHECKOUT_TTL_MS);
    try {
      const payments = await paidPaymentsForExactPlan({ apiKey: config.apiKey, companyId: config.companyId, planId: row.checkoutPlanId, createdAfter: createdAfter.toISOString(), fetchImpl });
      if (payments.length === 0) outcomes["not-paid"] = (outcomes["not-paid"] ?? 0) + 1;
      for (const payment of payments) {
        const result = await processPayment({ paymentId: payment.id, expectedRegistrationId: row.registrationId, fetchImpl }, deps);
        const key = result ? result.outcome : "payment-not-confirmed";
        outcomes[key] = (outcomes[key] ?? 0) + 1;
      }
    } catch {
      outcomes["processing-error"] = (outcomes["processing-error"] ?? 0) + 1;
    }
  }
  return outcomes;
}

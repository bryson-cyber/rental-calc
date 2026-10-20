import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readLlcPaymentMetadata } from "../whopRetailCheckout";
import {
  ANNUAL_REPORT_CHECKOUT_KIND,
  ANNUAL_REPORT_CHECKOUT_METADATA_VERSION,
  buildAnnualReportQuoteHash,
  createAnnualReportCheckout,
  isAnnualReportPaymentPayload,
  priceBeforeTaxCents,
  processAnnualReportPayment,
  reconcileAnnualReportPayments,
} from "./payments";
import { submitAnnualReport } from "./service";
import { makeDeps } from "./testFakes";

const ANSWERS = {
  hasAssets: false,
  companyName: "Amina Studio LLC",
  mailingAddress: { line1: "1 Main St", city: "Cheyenne", state: "WY", postalCode: "82001", country: "USA" },
};
const ORIGIN = "https://coachinayahturnkeytool.com";

beforeEach(() => {
  // The Whop rail's own variables (names only; test values). No live call is ever made: every fetch is injected.
  vi.stubEnv("WHOP_API_KEY", "whop_test_key");
  vi.stubEnv("WHOP_COMPANY_ID", "biz_TestCompany1");
  vi.stubEnv("WHOP_WEBHOOK_SECRET", "ws_test_secret");
  vi.stubEnv("LLC_PAYMENT_RAIL", "");
  vi.stubEnv("LLC_TEST_MODE", "");
});
afterEach(() => vi.unstubAllEnvs());

async function setup() {
  const t = makeDeps();
  const { reportId } = await submitAnnualReport(7, 42, ANSWERS, t.deps);
  return { t, reportId };
}

function checkoutFetch(planId = "plan_ar_1") {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify({ id: "ch_ar_1", purchase_url: "https://checkout.example/ch_ar_1", plan: { id: planId } }), { status: 200 }),
  );
}

function paymentFetch(payment: Record<string, unknown>) {
  return vi.fn(async () => new Response(JSON.stringify(payment), { status: 200 }));
}

function payment(reportId: number, overrides: Record<string, unknown> = {}, quoteHash?: string) {
  return {
    id: "pay_ar1",
    status: "paid",
    substatus: "succeeded",
    total: 60,
    currency: "usd",
    plan_id: "plan_ar_1",
    metadata: {
      rc_metadata_version: ANNUAL_REPORT_CHECKOUT_METADATA_VERSION,
      rc_checkout_kind: ANNUAL_REPORT_CHECKOUT_KIND,
      rc_llc_registration_id: "42",
      rc_llc_annual_report_id: String(reportId),
      rc_llc_annual_report_quote_hash: quoteHash ?? buildAnnualReportQuoteHash({ reportId, registrationId: 42, fiscalYear: 2027, annualReportId: "ar_1", amountCents: 6000, currency: "USD" }),
    },
    ...overrides,
  };
}

describe("annual report checkout", () => {
  it("makes a hidden one-time plan for exactly the report's fee, no service fee, back to her LLC page", async () => {
    const { t, reportId } = await setup();
    const fetchImpl = checkoutFetch();
    const session = await createAnnualReportCheckout({ userId: 7, registrationId: 42, reportId, origin: ORIGIN, fetchImpl }, t.deps);
    expect(session).toMatchObject({ sessionId: "ch_ar_1", planId: "plan_ar_1", amountCents: 6000, currency: "USD", purchaseUrl: "https://checkout.example/ch_ar_1" });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://api.whop.com/api/v1/checkout_configurations");
    const body = JSON.parse(String(init?.body));
    expect(body.account_id).toBe("biz_TestCompany1");
    expect(body.plan).toMatchObject({ initial_price: 60, plan_type: "one_time", force_create_new_plan: true });
    expect(body.plan.product.visibility).toBe("hidden");
    expect(body.redirect_url).toBe(`${ORIGIN}/llc/status/42?annual_report=paid`);
    expect(body.metadata).toMatchObject({ rc_checkout_kind: "llc_annual_report", rc_llc_annual_report_id: String(reportId), rc_llc_registration_id: "42" });
    expect(JSON.stringify(body)).not.toMatch(/doola/i);
    expect(new Headers(init?.headers).get("Idempotency-Key")).toMatch(new RegExp(`^rc-llc-annual-report-checkout-${reportId}-[a-f0-9]{64}$`));
    expect(t.memory.reports[0]).toMatchObject({ checkoutPlanId: "plan_ar_1", checkoutPriceCents: 6000 });

    // The same report and price reuses the checkout.
    await createAnnualReportCheckout({ userId: 7, registrationId: 42, reportId, origin: ORIGIN, fetchImpl }, t.deps);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("a foreign origin returns to the canonical domain, never elsewhere", async () => {
    const { t, reportId } = await setup();
    const fetchImpl = checkoutFetch();
    await createAnnualReportCheckout({ userId: 7, registrationId: 42, reportId, origin: "https://evil.example", fetchImpl }, t.deps);
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).redirect_url).toBe(`${ORIGIN}/llc/status/42?annual_report=paid`);
  });

  it("refuses another member, a zero fee, a paid report, and a closed filing window", async () => {
    const { t, reportId } = await setup();
    await expect(createAnnualReportCheckout({ userId: 8, registrationId: 42, reportId, origin: ORIGIN, fetchImpl: checkoutFetch() }, t.deps)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await t.memory.store.updateReport(reportId, { priceInCents: 0 });
    await expect(createAnnualReportCheckout({ userId: 7, registrationId: 42, reportId, origin: ORIGIN, fetchImpl: checkoutFetch() }, t.deps)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await t.memory.store.updateReport(reportId, { priceInCents: 6000, paidAt: new Date() });
    await expect(createAnnualReportCheckout({ userId: 7, registrationId: 42, reportId, origin: ORIGIN, fetchImpl: checkoutFetch() }, t.deps)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await t.memory.store.updateReport(reportId, { paidAt: null });
    const compliance = t.memory.compliance.get(42)!;
    t.memory.compliance.set(42, { ...compliance, nextDueDate: "2027-09-01" });
    const fetchImpl = checkoutFetch();
    await expect(createAnnualReportCheckout({ userId: 7, registrationId: 42, reportId, origin: ORIGIN, fetchImpl }, t.deps)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("without the Whop rail there is no checkout (annual reports have no card fallback)", async () => {
    const { t, reportId } = await setup();
    const fetchImpl = checkoutFetch();
    await expect(
      createAnnualReportCheckout({ userId: 7, registrationId: 42, reportId, origin: ORIGIN, fetchImpl, env: { LLC_PAYMENT_RAIL: "stripe" } }, t.deps),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("temporarily unavailable") });
    await expect(createAnnualReportCheckout({ userId: 7, registrationId: 42, reportId, origin: ORIGIN, fetchImpl, env: {} }, t.deps)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("annual report payment verification", () => {
  let t: ReturnType<typeof makeDeps>;
  let reportId: number;
  beforeEach(async () => {
    ({ t, reportId } = await setup());
    await createAnnualReportCheckout({ userId: 7, registrationId: 42, reportId, origin: ORIGIN, fetchImpl: checkoutFetch() }, t.deps);
  });

  it("is told apart from formation payments, both ways", () => {
    const paid = payment(reportId);
    expect(isAnnualReportPaymentPayload({ type: "payment.succeeded", data: paid })).toBe(true);
    expect(readLlcPaymentMetadata(paid as never)).toBeNull();
    expect(isAnnualReportPaymentPayload({ type: "payment.succeeded", data: { id: "pay_x", metadata: { rc_metadata_version: "rc_llc_checkout_v1", rc_checkout_kind: "llc_filing" } } })).toBe(false);
  });

  it("a verified payment of the exact fee is claimed once and confirms; replays never confirm twice", async () => {
    const fetchImpl = paymentFetch(payment(reportId));
    const first = await processAnnualReportPayment({ paymentId: "pay_ar1", expectedUserId: 7, expectedRegistrationId: 42, fetchImpl }, t.deps);
    expect(first).toMatchObject({ outcome: "confirmed", reportId, registrationId: 42 });
    expect(t.memory.reports[0]).toMatchObject({ paymentReference: "pay_ar1", paidCents: 6000, status: "IN_PROGRESS" });
    // The webhook retry and the return page land too.
    expect((await processAnnualReportPayment({ paymentId: "pay_ar1", fetchImpl }, t.deps))?.outcome).toBe("already_confirmed");
    expect((await processAnnualReportPayment({ paymentId: "pay_ar1", expectedUserId: 7, fetchImpl }, t.deps))?.outcome).toBe("already_confirmed");
    expect(t.provider.confirm).toHaveBeenCalledTimes(1);
  });

  it("compares the amount before sales tax, in either money shape", async () => {
    expect(priceBeforeTaxCents({ total: 66, tax_amount: 6 })).toBe(6000);
    expect(priceBeforeTaxCents({ total: { amount: "66.00", currency: "usd" }, tax_amount: { amount: 6 } })).toBe(6000);
    expect(priceBeforeTaxCents({ total: "nope" })).toBeNaN();
    const fetchImpl = paymentFetch(payment(reportId, { total: 66, tax_amount: 6 }));
    expect((await processAnnualReportPayment({ paymentId: "pay_ar1", fetchImpl }, t.deps))?.outcome).toBe("confirmed");
  });

  it("a payment for another amount is never applied and ops hear once", async () => {
    const fetchImpl = paymentFetch(payment(reportId, { total: 50 }));
    expect((await processAnnualReportPayment({ paymentId: "pay_ar1", fetchImpl }, t.deps))?.outcome).toBe("payment_mismatch");
    expect((await processAnnualReportPayment({ paymentId: "pay_ar1", fetchImpl }, t.deps))?.outcome).toBe("payment_mismatch");
    expect(t.memory.reports[0]).toMatchObject({ paidAt: null, confirmedAt: null, lastError: "payment_mismatch" });
    expect(t.provider.confirm).not.toHaveBeenCalled();
    expect(new Set(t.alerts.once.mock.calls.map((call) => (call as unknown as [{ type: string }])[0].type)).size).toBe(1);
  });

  it("a payment in another currency or on another plan is never applied", async () => {
    expect((await processAnnualReportPayment({ paymentId: "pay_ar1", fetchImpl: paymentFetch(payment(reportId, { currency: "cad" })) }, t.deps))?.outcome).toBe("payment_mismatch");
    expect((await processAnnualReportPayment({ paymentId: "pay_ar1", fetchImpl: paymentFetch(payment(reportId, { plan_id: "plan_other" })) }, t.deps))?.outcome).toBe("payment_mismatch");
    expect(t.provider.confirm).not.toHaveBeenCalled();
  });

  it("a payment on a checkout made before her answers changed the fee is never applied", async () => {
    t.provider.submit.mockImplementationOnce(async () => {
      const { providerReport } = await import("./testFakes");
      const report = providerReport({ priceInCents: 9000 });
      t.providerReports.splice(0, t.providerReports.length, report);
      return { report, isReplaced: true };
    });
    await submitAnnualReport(7, 42, { ...ANSWERS, hasAssets: true, assetValue: "400000" }, t.deps);
    const fetchImpl = paymentFetch(payment(reportId));
    expect((await processAnnualReportPayment({ paymentId: "pay_ar1", fetchImpl }, t.deps))?.outcome).toBe("payment_mismatch");
    expect(t.provider.confirm).not.toHaveBeenCalled();
  });

  it("a second, different payment for a paid report is flagged, not applied", async () => {
    await processAnnualReportPayment({ paymentId: "pay_ar1", fetchImpl: paymentFetch(payment(reportId)) }, t.deps);
    const second = await processAnnualReportPayment({ paymentId: "pay_ar2", fetchImpl: paymentFetch(payment(reportId, { id: "pay_ar2" })) }, t.deps);
    expect(second?.outcome).toBe("duplicate_payment");
    expect(t.memory.reports[0].paymentReference).toBe("pay_ar1");
    expect(t.alerts.once).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining("Second payment") }));
  });

  it("an unpaid payment, someone else's payment, another order's page or another kind of payment does nothing", async () => {
    expect(await processAnnualReportPayment({ paymentId: "pay_ar1", fetchImpl: paymentFetch(payment(reportId, { status: "open", substatus: "pending" })) }, t.deps)).toBeNull();
    await expect(processAnnualReportPayment({ paymentId: "pay_ar1", expectedUserId: 8, fetchImpl: paymentFetch(payment(reportId)) }, t.deps)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(processAnnualReportPayment({ paymentId: "pay_ar1", expectedRegistrationId: 99, fetchImpl: paymentFetch(payment(reportId)) }, t.deps)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await processAnnualReportPayment({ paymentId: "pay_ar1", fetchImpl: paymentFetch({ ...payment(reportId), metadata: {} }) }, t.deps)).toBeNull();
    expect(await processAnnualReportPayment({ paymentId: "pay_ar1", fetchImpl: paymentFetch(payment(reportId, { id: "pay_someone_else" })) }, t.deps)).toBeNull();
    expect(t.memory.reports[0].paidAt).toBeNull();
  });

  it("the reconciliation finds a payment the webhook missed, on the exact plan only", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/payments?")) {
        expect(new URL(href).searchParams.get("plan_id")).toBe("plan_ar_1");
        return new Response(JSON.stringify({ data: [{ id: "pay_ar1", status: "paid", substatus: "succeeded", plan_id: "plan_ar_1" }], page_info: { has_next_page: false } }), { status: 200 });
      }
      return new Response(JSON.stringify(payment(reportId)), { status: 200 });
    });
    expect(await reconcileAnnualReportPayments({ fetchImpl }, t.deps)).toEqual({ confirmed: 1 });
    expect(await reconcileAnnualReportPayments({ fetchImpl }, t.deps)).toEqual({});
  });

  it("the reconciliation is a no-op without the Whop API config", async () => {
    const fetchImpl = vi.fn();
    expect(await reconcileAnnualReportPayments({ fetchImpl, env: {} }, t.deps)).toEqual({});
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

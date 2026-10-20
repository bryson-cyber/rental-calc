/**
 * The 2026-10-20 review of the annual report feature: one block per finding, the provider mocked (testFakes). The
 * live facts these mirror (read-only, 2026-10-20): an Oklahoma LLC's calendar says next due 2027-09-01 UPCOMING;
 * requirements default to fiscal year 2026 and both ?fiscalYear=2026 and 2027 answer due 2027-09-01; the fee quote is
 * 3000 cents, not a minimum.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ported from Her First Order (7d471b78) to this app's Whop rail: the rail's own variables (test values; every fetch
// is injected, nothing live), rc_ checkout metadata, and the checkout built from the request origin.
beforeEach(() => {
  vi.stubEnv("WHOP_API_KEY", "whop_test_key");
  vi.stubEnv("WHOP_COMPANY_ID", "biz_TestCompany1");
  vi.stubEnv("WHOP_WEBHOOK_SECRET", "ws_test_secret");
  vi.stubEnv("LLC_PAYMENT_RAIL", "");
  vi.stubEnv("LLC_TEST_MODE", "");
});
afterEach(() => vi.unstubAllEnvs());

import { DoolaApiError } from "../doola";
import { OPS_FEE_ACTION_LABELS } from "../../../shared/llcAnnualReportOps";
import {
  ANNUAL_REPORT_CHECKOUT_KIND,
  ANNUAL_REPORT_CHECKOUT_METADATA_VERSION,
  createAnnualReportCheckout,
  processAnnualReportPayment,
} from "./payments";
import { submissionIdempotencyKey } from "./provider";
import {
  DAILY_SYNC_MS,
  FILING_WINDOW_DAYS,
  buildMemberView,
  confirmReport,
  filingCycle,
  getAnnualReportForm,
  getMemberAnnualReport,
  getOpsAnnualReports,
  opsAbsorbAnnualReportDifference,
  opsResetAnnualReportPayment,
  processAnnualReportEvent,
  retryPaidUnconfirmed,
  submitAnnualReport,
  syncCompliance,
  syncStaleCalendars,
} from "./service";
import { filing, makeDeps, providerReport, requirements } from "./testFakes";
import type { ComplianceRow } from "./store";

const ANSWERS = {
  hasAssets: false,
  companyName: "Amina Studio LLC",
  mailingAddress: { line1: "1 Main St", city: "Cheyenne", state: "WY", postalCode: "82001", country: "USA" },
};
const ORIGIN = "https://coachinayahturnkeytool.com";
const OKLAHOMA = { state: "OK", nextDueDate: "2027-09-01", lastFiledDate: null, status: "UPCOMING" as const };

const compliance = (overrides: Partial<ComplianceRow> = {}): ComplianceRow => ({
  registrationId: 42,
  userId: 7,
  state: "OK",
  nextDueDate: "2027-09-01",
  lastFiledDate: null,
  status: "UPCOMING",
  filingRequired: true,
  quotePriceCents: 3000,
  quoteIsMinimum: false,
  syncedAt: new Date(),
  lastError: null,
  ...overrides,
});

const alertTypes = (t: ReturnType<typeof makeDeps>) => t.alerts.once.mock.calls.map((call) => (call as unknown as [{ type: string }])[0].type);
const alertText = (t: ReturnType<typeof makeDeps>, type: string) =>
  JSON.stringify((t.alerts.once.mock.calls.find((call) => (call as unknown as [{ type: string }])[0].type === type) as unknown as [unknown] | undefined)?.[0] ?? null);

function checkoutFetch(planId = "plan_ar_1") {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify({ id: "ch_ar_1", purchase_url: "https://whop.com/checkout/ch_ar_1", plan: { id: planId } }), { status: 200 }),
  );
}

function payment(reportId: number, quoteHash: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "pay_ar_1",
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
      rc_llc_annual_report_quote_hash: quoteHash,
    },
    ...overrides,
  };
}

const paymentFetch = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

// ─── 1. The filing window and the fiscal year ──────────────────────────────────────────────────────────────────────

describe("finding 1: the filing window", () => {
  it("opens FILING_WINDOW_DAYS before the due date; the fiscal year is the due year only when that's unambiguous", () => {
    expect(FILING_WINDOW_DAYS).toBe(90);
    // The live Oklahoma calendar today: ten months out, closed, opens June 3, 2027.
    expect(filingCycle(compliance(), new Date("2026-10-20T18:00:00Z"))).toEqual({ open: false, overdue: false, dueDate: "2027-09-01", opensOn: "2027-06-03", fiscalYear: null });
    expect(filingCycle(compliance(), new Date("2027-06-02T18:00:00Z")).open).toBe(false); // 91 days out
    expect(filingCycle(compliance(), new Date("2027-06-03T18:00:00Z"))).toMatchObject({ open: true, fiscalYear: 2027 }); // 90 days out
    // A March due date's window starts the year before: open, but which fiscal year it files is not confirmed.
    expect(filingCycle(compliance({ nextDueDate: "2027-03-01" }), new Date("2026-12-10T18:00:00Z"))).toMatchObject({ open: true, fiscalYear: null });
    expect(filingCycle(compliance({ nextDueDate: "2027-03-01" }), new Date("2027-01-02T18:00:00Z"))).toMatchObject({ open: true, fiscalYear: 2027 });
    // Overdue files the due year, by date or by the calendar's word.
    expect(filingCycle(compliance({ nextDueDate: "2026-09-01", status: "OVERDUE" }), new Date("2026-10-20T18:00:00Z"))).toMatchObject({ open: true, overdue: true, fiscalYear: 2026 });
    expect(filingCycle(compliance({ nextDueDate: "2027-09-01", status: "OVERDUE" }), new Date("2026-10-20T18:00:00Z"))).toMatchObject({ open: true, overdue: true, fiscalYear: 2027 });
    // Closed: no due date, not required, unsupported.
    expect(filingCycle(compliance({ nextDueDate: null }), new Date()).open).toBe(false);
    expect(filingCycle(compliance({ filingRequired: false, nextDueDate: "2026-11-01" }), new Date("2026-10-20T18:00:00Z")).open).toBe(false);
    expect(filingCycle(compliance({ status: "UNSUPPORTED_STATE", nextDueDate: "2026-11-01" }), new Date("2026-10-20T18:00:00Z")).open).toBe(false);
    expect(filingCycle(null, new Date()).open).toBe(false);
  });

  it("an UPCOMING due date ten months out is 'Not due yet' with the day filing opens, and no File button", () => {
    const view = buildMemberView(filing({ state: "OK" }), compliance(), [], new Date("2026-10-20T18:00:00Z"));
    expect(view).toMatchObject({ cardState: "not_yet_due", canFile: false, opensOnWords: "June 3, 2027", dueDateWords: "September 1, 2027" });
    expect(view.body).toContain("Filing opens June 3, 2027");
    const open = buildMemberView(filing({ state: "OK" }), compliance(), [], new Date("2027-07-01T18:00:00Z"));
    expect(open).toMatchObject({ cardState: "due", canFile: true, opensOnWords: null });
  });

  it("right after filing, the calendar rolls forward and the File button stays away (last filing named)", async () => {
    const t = makeDeps({ facts: filing({ state: "OK" }), calendar: { ...OKLAHOMA, nextDueDate: "2026-09-01", status: "OVERDUE" }, now: new Date("2026-09-10T18:00:00Z") });
    t.provider.getRequirements.mockResolvedValue(requirements({ fiscalYear: 2026, dueDate: "2026-09-01" }));
    t.provider.submit.mockImplementation(async () => {
      const report = providerReport({ fiscalYear: 2026, priceInCents: 3000, state: "OK" });
      t.providerReports.splice(0, t.providerReports.length, report);
      return { report, isReplaced: false };
    });
    const { reportId } = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    expect(t.memory.reports[0]).toMatchObject({ fiscalYear: 2026, dueDate: "2026-09-01" });
    await t.memory.store.updateReport(reportId, { paidAt: new Date(), paidCents: 3000, paymentReference: "pay_1" });
    t.providerReports[0].priceInCents = 3000;
    expect(await confirmReport(reportId, { source: "payment" }, t.deps)).toBe("confirmed");
    t.providerReports[0].status = "FILING_COMPLETED";
    await processAnnualReportEvent({ eventName: "company_annual_report_completed", doolaCompanyId: "dc_test123" }, t.deps);

    // The calendar has rolled to next year's due date.
    t.provider.calendar.mockResolvedValue({ ...OKLAHOMA, lastFiledDate: "2026-09-12" });
    t.setNow(new Date("2026-09-12T18:00:00Z"));
    const view = await getMemberAnnualReport(7, 42, t.deps);
    expect(view).toMatchObject({ cardState: "not_yet_due", canFile: false });
    expect(view?.body).toMatch(/^Your last one was filed on September (10|12), 2026\./);
    expect(view?.body).toContain("Filing opens June 3, 2027");
    await expect(getAnnualReportForm(7, 42, t.deps)).rejects.toMatchObject({ code: "not_open" });
    await expect(submitAnnualReport(7, 42, ANSWERS, t.deps)).rejects.toMatchObject({ code: "not_open" });
  });

  it("form and submit refuse outside the window before asking the provider anything", async () => {
    const t = makeDeps({ facts: filing({ state: "OK" }), calendar: OKLAHOMA, now: new Date("2026-10-20T18:00:00Z") });
    const error = await getAnnualReportForm(7, 42, t.deps).catch((e) => e);
    expect(error).toMatchObject({ code: "not_open" });
    expect(error.message).toContain("Filing opens June 3, 2027");
    expect(error.message).not.toMatch(/doola|whop|fiscal/i);
    await expect(submitAnnualReport(7, 42, ANSWERS, t.deps)).rejects.toMatchObject({ code: "not_open" });
    expect(t.provider.getRequirements).not.toHaveBeenCalled();
    expect(t.provider.submit).not.toHaveBeenCalled();
  });

  it("the checkout refuses once the cycle isn't open, even for a saved report", async () => {
    const t = makeDeps();
    const { reportId } = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    // The calendar moves on (say, the report was filed another way): nothing to pay here any more.
    t.provider.calendar.mockResolvedValue({ state: "WY", nextDueDate: "2028-03-01", lastFiledDate: null, status: "NOT_YET_DUE" });
    t.setNow(new Date("2027-01-10T19:00:00Z"));
    const fetchImpl = checkoutFetch();
    await expect(createAnnualReportCheckout({ userId: 7, registrationId: 42, reportId, origin: ORIGIN, fetchImpl }, t.deps)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("a window that opens the year before the due date: 'confirming your filing year', no File button, ops hear once", async () => {
    const t = makeDeps({ now: new Date("2026-12-10T18:00:00Z") });
    const view = await getMemberAnnualReport(7, 42, t.deps);
    expect(view).toMatchObject({ cardState: "confirming_year", headline: "We're confirming your filing year", canFile: false });
    expect(view?.body).toContain("We're confirming your filing year with the state, and we'll email you");
    t.setNow(new Date("2026-12-10T19:00:00Z"));
    await getMemberAnnualReport(7, 42, t.deps);
    expect(new Set(alertTypes(t))).toEqual(new Set(["ar_year_unconfirmed_42_2027-03-01"]));
    const refused = await submitAnnualReport(7, 42, ANSWERS, t.deps).catch((e) => e);
    expect(refused).toMatchObject({ code: "not_open" });
    expect(refused.message).toContain("We're confirming your filing year");
    expect(t.provider.submit).not.toHaveBeenCalled();
  });

  it("asks the requirements for the cycle's year and refuses when another year comes back", async () => {
    const t = makeDeps();
    await getAnnualReportForm(7, 42, t.deps);
    expect(t.provider.getRequirements).toHaveBeenLastCalledWith("dc_test123", 2027);
    t.provider.getRequirements.mockResolvedValue(requirements({ fiscalYear: 2026 }));
    await expect(submitAnnualReport(7, 42, ANSWERS, t.deps)).rejects.toMatchObject({ code: "not_open" });
    expect(t.provider.submit).not.toHaveBeenCalled();
    expect(alertTypes(t)).toContain("ar_year_unconfirmed_42_2027-03-01");
  });

  it("the card finds the cycle's report by its due date first, so a report filed under another year still counts", () => {
    const now = new Date("2027-07-01T18:00:00Z");
    const row = {
      id: 5, registrationId: 42, userId: 7, fiscalYear: 2026, dueDate: "2027-09-01", annualReportId: "ar_9", status: "FILING_COMPLETED",
      priceInCents: 3000, answers: null, checkoutSessionId: null, checkoutUrl: null, checkoutPlanId: null, checkoutQuoteHash: null,
      checkoutPriceCents: null, checkoutExpiresAt: null, paymentReference: "pay_1", paidCents: 3000, paidAt: new Date(), submittedAt: new Date(),
      confirmedAt: new Date(), completedAt: new Date("2027-06-20T12:00:00Z"), filedDocumentId: null, lastError: null, lastErrorAt: null, createdAt: null, updatedAt: null,
    };
    expect(buildMemberView(filing({ state: "OK" }), compliance(), [row], now)).toMatchObject({ cardState: "filed", canFile: false, current: { id: 5 } });
  });

  it("safety net: a filed report whose due date is still next on the calendar two weeks on alerts ops once", async () => {
    const t = makeDeps({ facts: filing({ state: "OK" }), calendar: OKLAHOMA, now: new Date("2027-07-01T18:00:00Z") });
    const row = await t.memory.store.upsertReport(
      { registrationId: 42, userId: 7, fiscalYear: 2027 },
      { dueDate: "2027-09-01", annualReportId: "ar_1", status: "FILING_COMPLETED", priceInCents: 3000, confirmedAt: new Date(), completedAt: new Date("2027-06-20T18:00:00Z") },
    );
    t.providerReports.push(providerReport({ status: "FILING_COMPLETED", priceInCents: 3000 }));
    await syncCompliance(42, {}, t.deps);
    expect(alertTypes(t)).not.toContain(`ar_wrong_year_${row.id}`); // 11 days
    t.setNow(new Date("2027-07-05T18:00:00Z"));
    await syncCompliance(42, {}, t.deps);
    expect(alertTypes(t)).toContain(`ar_wrong_year_${row.id}`); // 15 days
    // Rolled forward as expected: nothing.
    const fine = makeDeps({ calendar: { state: "WY", nextDueDate: "2028-03-01", lastFiledDate: "2027-02-01", status: "NOT_YET_DUE" }, now: new Date("2027-03-01T18:00:00Z") });
    await fine.memory.store.upsertReport({ registrationId: 42, userId: 7, fiscalYear: 2027 }, { dueDate: "2027-03-01", status: "FILING_COMPLETED", completedAt: new Date("2027-02-01T18:00:00Z") });
    await syncCompliance(42, {}, fine.deps);
    expect(alertTypes(fine).some((type) => type.startsWith("ar_wrong_year_"))).toBe(false);
  });
});

// ─── 2. A missing price is never $0, and nothing confirms without a good re-read ──────────────────────────────────

describe("finding 2: price and the re-read", () => {
  it("a submit without a price stores null: no zero-fee confirm, no checkout, the card waits for the fee", async () => {
    const t = makeDeps();
    t.provider.submit.mockImplementationOnce(async () => ({ report: providerReport({ priceInCents: null }), isReplaced: false }));
    const result = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    expect(result).toMatchObject({ priceCents: null, confirmOutcome: null, priceChanged: false });
    expect(t.memory.reports[0].priceInCents).toBeNull();
    expect(t.provider.confirm).not.toHaveBeenCalled();
    const fetchImpl = checkoutFetch();
    await expect(createAnnualReportCheckout({ userId: 7, registrationId: 42, reportId: result.reportId, origin: ORIGIN, fetchImpl }, t.deps)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(fetchImpl).not.toHaveBeenCalled();
    const view = await getMemberAnnualReport(7, 42, t.deps);
    expect(view).toMatchObject({ cardState: "saved", current: { needsPayment: false, priceCents: null } });
    expect(await confirmReport(result.reportId, { source: "retry" }, t.deps)).toBe("not_ready");
  });

  it("zero fee confirms only when the submit and a successful live read both say exactly 0", async () => {
    const t = makeDeps();
    t.provider.submit.mockImplementationOnce(async () => {
      const report = providerReport({ priceInCents: 0 });
      t.providerReports.push(report);
      return { report, isReplaced: false };
    });
    t.provider.get.mockRejectedValueOnce(new DoolaApiError({ message: "x", httpStatus: 503, code: "E_INTERNAL", retryable: true, fields: {} }));
    const result = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    expect(result.confirmOutcome).toBe("confirm_failed");
    expect(t.provider.confirm).not.toHaveBeenCalled();
    expect(t.memory.reports[0]).toMatchObject({ confirmedAt: null, lastError: "confirm:reread:E_INTERNAL" });
    // The hourly sweep retries no-fee reports too, and confirms once the read works.
    expect(await retryPaidUnconfirmed(t.deps)).toEqual({ confirmed: 1 });
    expect(t.provider.confirm).toHaveBeenCalledTimes(1);

    // The live read says it costs something after all: not confirmed, the new fee is stored.
    const u = makeDeps();
    u.provider.submit.mockImplementationOnce(async () => {
      u.providerReports.push(providerReport({ priceInCents: 4500 }));
      return { report: providerReport({ priceInCents: 0 }), isReplaced: false };
    });
    expect((await submitAnnualReport(7, 42, ANSWERS, u.deps)).confirmOutcome).toBe("not_paid");
    expect(u.provider.confirm).not.toHaveBeenCalled();
    expect(u.memory.reports[0].priceInCents).toBe(4500);
  });

  it("a paid report is never confirmed when the re-read fails, finds nothing or has no price", async () => {
    const t = makeDeps();
    const { reportId } = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    await t.memory.store.updateReport(reportId, { paidAt: new Date(), paidCents: 6000, paymentReference: "pay_1" });
    t.provider.get.mockRejectedValueOnce(new Error("socket hang up"));
    expect(await confirmReport(reportId, { source: "payment" }, t.deps)).toBe("confirm_failed");
    t.provider.get.mockResolvedValueOnce(null);
    expect(await confirmReport(reportId, { source: "retry" }, t.deps)).toBe("confirm_failed");
    t.provider.get.mockResolvedValueOnce(providerReport({ priceInCents: null }));
    expect(await confirmReport(reportId, { source: "retry" }, t.deps)).toBe("confirm_failed");
    expect(t.provider.confirm).not.toHaveBeenCalled();
    expect(alertTypes(t)).toContain(`ar_confirm_failed_${reportId}`);
    // Her card: we've got the payment.
    expect((await getMemberAnnualReport(7, 42, t.deps))?.cardState).toBe("paid_finishing");
    // A good read later: confirmed once.
    expect(await retryPaidUnconfirmed(t.deps)).toEqual({ confirmed: 1 });
  });
});

// ─── 3. A paid report whose fee changed: the two ops buttons, and the guarded resubmit ────────────────────────────

describe("finding 3: fee changed after payment", () => {
  async function paidThenRepriced() {
    const t = makeDeps();
    const { reportId } = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    await t.memory.store.updateReport(reportId, { paidAt: new Date(), paidCents: 6000, paymentReference: "pay_1", checkoutPlanId: "plan_old", checkoutPriceCents: 6000, checkoutSessionId: "ch_old" });
    t.providerReports[0].priceInCents = 9000;
    expect(await confirmReport(reportId, { source: "payment" }, t.deps)).toBe("price_mismatch");
    return { t, reportId };
  }

  it("the alert names both buttons, and the ops view offers them", async () => {
    const { t, reportId } = await paidThenRepriced();
    const text = alertText(t, `ar_mismatch_${reportId}`);
    expect(text).toContain(OPS_FEE_ACTION_LABELS.refunded_pay_again);
    expect(text).toContain(OPS_FEE_ACTION_LABELS.absorb_difference);
    const ops = await getOpsAnnualReports(42, t.deps);
    expect(ops.reports[0]).toMatchObject({ feeChanged: true, canResetPayment: true, canConfirm: false, priceInCents: 9000, paidCents: 6000 });
  });

  it("'Difference absorbed': the payment counts as the fee, an audit line stays, and it's confirmed through the guarded path", async () => {
    const { t, reportId } = await paidThenRepriced();
    expect(await opsAbsorbAnnualReportDifference(42, reportId, t.deps)).toBe("confirmed");
    expect(t.provider.confirm).toHaveBeenCalledTimes(1);
    expect(t.memory.reports[0]).toMatchObject({ paidCents: 9000, paymentReference: "pay_1", status: "IN_PROGRESS" });
    expect(t.memory.reports[0].lastError).toMatch(/^ops: absorbed the difference \(paid \$60, fee \$90, payment pay_1\)/);
    // Once handed over, neither button does anything.
    expect(await opsAbsorbAnnualReportDifference(42, reportId, t.deps)).toBe("not_allowed");
    expect(await opsResetAnnualReportPayment(42, reportId, t.deps)).toBe("not_allowed");
    expect(await opsAbsorbAnnualReportDifference(99, reportId, t.deps)).toBe("not_found");
  });

  it("'Fee changed: refunded': payment and checkout come off, she can pay the new fee again", async () => {
    const { t, reportId } = await paidThenRepriced();
    expect(await opsResetAnnualReportPayment(42, reportId, t.deps)).toBe("reset");
    expect(t.memory.reports[0]).toMatchObject({ paymentReference: null, paidAt: null, paidCents: null, checkoutPlanId: null, checkoutSessionId: null, checkoutPriceCents: null, confirmedAt: null, priceInCents: 9000 });
    expect(t.memory.reports[0].lastError).toMatch(/^ops: refunded \$60 payment pay_1; she pays \$90 again/);
    const view = await getMemberAnnualReport(7, 42, t.deps);
    expect(view).toMatchObject({ cardState: "saved", canFile: true, current: { needsPayment: true, priceCents: 9000 } });
    expect(t.provider.confirm).not.toHaveBeenCalled();
  });

  it("an unpaid report is not 'fee changed' (the buttons stay hidden)", async () => {
    const t = makeDeps();
    const { reportId } = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    expect(await opsAbsorbAnnualReportDifference(42, reportId, t.deps)).toBe("not_allowed");
    expect(await opsResetAnnualReportPayment(42, reportId, t.deps)).toBe("not_allowed");
    expect((await getOpsAnnualReports(42, t.deps)).reports[0]).toMatchObject({ feeChanged: false, canResetPayment: false });
  });

  it("a resubmit that loses to a payment claim changes nothing on the paid report", async () => {
    const t = makeDeps();
    const { reportId } = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    await t.memory.store.updateReport(reportId, { checkoutPlanId: "plan_1", checkoutPriceCents: 6000, checkoutSessionId: "ch_1", checkoutQuoteHash: "a".repeat(64) });
    // Her payment is claimed while the resubmit is with the provider.
    t.provider.submit.mockImplementationOnce(async () => {
      await t.memory.store.updateReport(reportId, { paymentReference: "pay_1", paidCents: 6000, paidAt: new Date() }, { paidAtIsNull: true });
      return { report: providerReport({ priceInCents: 26000 }), isReplaced: true };
    });
    const error = await submitAnnualReport(7, 42, { ...ANSWERS, hasAssets: true, assetValue: "400000" }, t.deps).catch((e) => e);
    expect(error).toMatchObject({ code: "locked" });
    expect(error.message).toBe("Your payment is in, so your answers can't be changed now. We'll email you when your report is with the state.");
    expect(t.memory.reports[0]).toMatchObject({ priceInCents: 6000, checkoutPlanId: "plan_1", checkoutSessionId: "ch_1", answers: { hasAssets: false }, paymentReference: "pay_1" });
  });

  it("the pay-mismatch alert names the refund button (absorbing doesn't apply to a payment never applied)", async () => {
    const t = makeDeps();
    const { reportId } = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    await createAnnualReportCheckout({ userId: 7, registrationId: 42, reportId, origin: ORIGIN, fetchImpl: checkoutFetch() }, t.deps);
    const hash = t.memory.reports[0].checkoutQuoteHash as string;
    const result = await processAnnualReportPayment({ paymentId: "pay_ar_1", fetchImpl: paymentFetch(payment(reportId, hash, { total: 50 })) }, t.deps);
    expect(result?.outcome).toBe("payment_mismatch");
    const type = alertTypes(t).find((candidate) => candidate.startsWith(`ar_pay_mismatch_${reportId}_`)) as string;
    expect(alertText(t, type)).toContain(OPS_FEE_ACTION_LABELS.refunded_pay_again);
    expect((await getOpsAnnualReports(42, t.deps)).reports[0]).toMatchObject({ canResetPayment: true, feeChanged: false });
    expect(await opsResetAnnualReportPayment(42, reportId, t.deps)).toBe("reset");
  });
});

// ─── 4. Each real submit gets its own idempotency key ──────────────────────────────────────────────────────────────

describe("finding 4: idempotency per submit attempt", () => {
  it("answers A, then B, then A again send three different keys; a double click sends one", async () => {
    const t = makeDeps();
    const B = { ...ANSWERS, hasAssets: true, assetValue: "400000" };
    await submitAnnualReport(7, 42, ANSWERS, t.deps);
    t.setNow(new Date("2027-01-10T18:01:00Z"));
    await submitAnnualReport(7, 42, B, t.deps);
    t.setNow(new Date("2027-01-10T18:02:00Z"));
    await submitAnnualReport(7, 42, ANSWERS, t.deps);
    const keys = t.provider.submit.mock.calls.map(([companyId, body, options]) => submissionIdempotencyKey(companyId, body, options?.attempt));
    expect(t.provider.submit.mock.calls[0][1]).toEqual(t.provider.submit.mock.calls[2][1]);
    expect(new Set(keys).size).toBe(3);

    // A double click: both requests see the same row, so the same key goes out and the provider dedupes.
    const u = makeDeps();
    await Promise.all([submitAnnualReport(7, 42, ANSWERS, u.deps), submitAnnualReport(7, 42, ANSWERS, u.deps)]);
    const twin = u.provider.submit.mock.calls.map(([companyId, body, options]) => submissionIdempotencyKey(companyId, body, options?.attempt));
    expect(twin).toHaveLength(2);
    expect(twin[0]).toBe(twin[1]);
  });

  it("the key keeps its old form without an attempt and changes with one", () => {
    const body = { fiscalYear: 2027, answers: [{ fieldId: "hasAssets", value: false }] };
    expect(submissionIdempotencyKey("dc_1", body, "")).toBe(submissionIdempotencyKey("dc_1", body));
    expect(submissionIdempotencyKey("dc_1", body, "1:ar_1:5")).toBe(submissionIdempotencyKey("dc_1", body, "1:ar_1:5"));
    expect(submissionIdempotencyKey("dc_1", body, "1:ar_1:5")).not.toBe(submissionIdempotencyKey("dc_1", body, "1:ar_1:6"));
  });
});

// ─── 5. The mailing address never falls back to her business address ─────────────────────────────────────────────

describe("finding 5: mailing address prefill", () => {
  it("leaves the mailing address empty when she chose the agent's address for mail", async () => {
    const t = makeDeps({ facts: filing({ mailingAddress: null }) });
    const form = await getAnnualReportForm(7, 42, t.deps);
    expect(form.answers).not.toHaveProperty("mailingAddress");
    expect(form.answers).toMatchObject({ companyName: "Amina Studio LLC" });
  });

  it("the page says leaving an optional company detail as is keeps what's on file", () => {
    const card = readFileSync(path.resolve(__dirname, "../../../client/src/components/llc-formation/AnnualReportCard.tsx"), "utf8");
    expect(card).toContain("Leave this as is to keep what's on file with the state.");
    expect(card).toContain('optional && field.group === "COMPANY_DETAIL"');
  });
});

// ─── 6. A lost payment claim always tells ops ─────────────────────────────────────────────────────────────────────

describe("finding 6: losing the payment claim", () => {
  async function racedPayment(interleave: (t: ReturnType<typeof makeDeps>, reportId: number) => Promise<void>) {
    const t = makeDeps();
    const { reportId } = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    await createAnnualReportCheckout({ userId: 7, registrationId: 42, reportId, origin: ORIGIN, fetchImpl: checkoutFetch() }, t.deps);
    const hash = t.memory.reports[0].checkoutQuoteHash as string;
    const original = t.deps.store.getReport;
    let first = true;
    t.deps.store.getReport = async (id: number) => {
      const row = await original(id);
      if (first) {
        first = false;
        await interleave(t, id); // lands after this payment read the row, before its claim
      }
      return row;
    };
    const result = await processAnnualReportPayment({ paymentId: "pay_B", fetchImpl: paymentFetch(payment(reportId, hash, { id: "pay_B" })) }, t.deps);
    t.deps.store.getReport = original;
    return { t, reportId, result };
  }

  it("another payment won the claim: duplicate_payment and the second-payment alert", async () => {
    const { t, reportId, result } = await racedPayment(async (t, id) => {
      await t.deps.store.updateReport(id, { paymentReference: "pay_A", paidCents: 6000, paidAt: new Date() }, { paidAtIsNull: true });
    });
    expect(result?.outcome).toBe("duplicate_payment");
    expect(alertTypes(t).some((type) => type.startsWith(`ar_dup_pay_${reportId}_`))).toBe(true);
    expect(t.memory.reports[0].paymentReference).toBe("pay_A");
  });

  it("the checkout changed under it: payment_mismatch and the mismatch alert", async () => {
    const { t, reportId, result } = await racedPayment(async (t, id) => {
      await t.deps.store.updateReport(id, { checkoutPlanId: "plan_new", checkoutPriceCents: 9000 });
    });
    expect(result?.outcome).toBe("payment_mismatch");
    expect(alertTypes(t).some((type) => type.startsWith(`ar_pay_mismatch_${reportId}_`))).toBe(true);
    expect(t.memory.reports[0]).toMatchObject({ paidAt: null, lastError: "payment_mismatch" });
    expect(t.provider.confirm).not.toHaveBeenCalled();
  });
});

// ─── 7. The page says "on its way" only for a confirmed no-fee report ─────────────────────────────────────────────

describe("finding 7: the no-fee message", () => {
  it("is shown only for confirmed or already_confirmed; anything else refetches and shows the saved state", () => {
    const card = readFileSync(path.resolve(__dirname, "../../../client/src/components/llc-formation/AnnualReportCard.tsx"), "utf8");
    const confirmed = card.indexOf('if (result.confirmOutcome === "confirmed" || result.confirmOutcome === "already_confirmed") {');
    const noFeeWords = card.indexOf("There's no state fee, so we're sending your report to the state now.");
    expect(confirmed).toBeGreaterThan(-1);
    expect(noFeeWords).toBeGreaterThan(confirmed);
    expect(card).toContain("if (result.confirmOutcome || result.priceCents === null || result.priceCents <= 0) {");
    expect(card).not.toContain("if (result.confirmOutcome) {");
  });
});

// ─── 8. A failed sync isn't counted fresh ─────────────────────────────────────────────────────────────────────────

describe("finding 8: failed calendar reads", () => {
  it("keep the old read time (or retry within the hour) so the sweep reads it again soon", async () => {
    const t = makeDeps();
    t.provider.calendar.mockRejectedValueOnce(new DoolaApiError({ message: "x", httpStatus: 503, code: "E_INTERNAL", retryable: true, fields: {} }));
    const result = await syncCompliance(42, {}, t.deps);
    const syncedAt = result?.compliance?.syncedAt as Date;
    expect(syncedAt.getTime()).toBeLessThanOrEqual(t.deps.now().getTime() - DAILY_SYNC_MS + 60 * 60_000);
    expect(result?.compliance?.lastError).toBe("calendar:E_INTERNAL");
    // An hour and a minute later the daily pass picks it up again; a good read is fresh.
    t.setNow(new Date(t.deps.now().getTime() + 61 * 60_000));
    expect((await syncStaleCalendars(t.deps)).synced).toBe(1);
    expect(t.memory.compliance.get(42)?.syncedAt?.getTime()).toBe(t.deps.now().getTime());
    expect((await syncStaleCalendars(t.deps)).synced).toBe(0);
  });

  it("an older read time is kept as it was", async () => {
    const t = makeDeps();
    await syncCompliance(42, {}, t.deps);
    const first = t.memory.compliance.get(42)?.syncedAt as Date;
    t.setNow(new Date(first.getTime() + 2 * DAILY_SYNC_MS));
    t.provider.calendar.mockRejectedValueOnce(new Error("down"));
    await syncCompliance(42, {}, t.deps);
    expect(t.memory.compliance.get(42)?.syncedAt).toEqual(first);
  });
});

// ─── 9. AWAITING_INFORMATION alerts once per episode ──────────────────────────────────────────────────────────────

describe("finding 9: AWAITING_INFORMATION episodes", () => {
  it("a second episode on the same report alerts again; replays of one episode don't", async () => {
    const t = makeDeps();
    t.providerReports.push(providerReport({ status: "AWAITING_INFORMATION", updatedAt: "2027-01-10T10:00:00Z" }));
    await processAnnualReportEvent({ eventName: "company_annual_report_submitted", doolaCompanyId: "dc_test123" }, t.deps);
    await processAnnualReportEvent({ eventName: "company_annual_report_submitted", doolaCompanyId: "dc_test123" }, t.deps);
    t.providerReports[0].status = "IN_PROGRESS";
    await processAnnualReportEvent({ eventName: "company_annual_report_submitted", doolaCompanyId: "dc_test123" }, t.deps);
    t.providerReports[0].status = "AWAITING_INFORMATION";
    t.providerReports[0].updatedAt = "2027-02-02T09:30:00Z";
    await processAnnualReportEvent({ eventName: "company_annual_report_submitted", doolaCompanyId: "dc_test123" }, t.deps);
    const awaiting = alertTypes(t).filter((type) => type.startsWith("ar_awaiting_"));
    expect(awaiting).toHaveLength(2);
    expect(new Set(awaiting).size).toBe(2);
    expect(awaiting.every((type) => type.length <= 64)).toBe(true);
  });
});

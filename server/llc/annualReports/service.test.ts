import { beforeEach, describe, expect, it } from "vitest";
import { DoolaApiError } from "../doola";
import {
  AnnualReportError,
  buildMemberView,
  buildSubmission,
  confirmReport,
  getAnnualReportForm,
  getMemberAnnualReport,
  getOpsAnnualReports,
  opsConfirmAnnualReport,
  processAnnualReportEvent,
  retryPaidUnconfirmed,
  submitAnnualReport,
  syncCompliance,
  syncStaleCalendars,
} from "./service";
import { filing, makeDeps, providerReport, requirements } from "./testFakes";

const ANSWERS = {
  hasAssets: false,
  companyName: "Amina Studio LLC",
  mailingAddress: { line1: "1 Main St", city: "Cheyenne", state: "WY", postalCode: "82001", country: "USA" },
};

const apiError = (code: string, httpStatus: number, fields: Record<string, string> = {}) =>
  new DoolaApiError({ message: "x", httpStatus, code, retryable: false, fields });

describe("compliance calendar sync", () => {
  it("stores the calendar, the fee quote and the provider's reports for a real filing", async () => {
    const t = makeDeps();
    t.providerReports.push(providerReport({ status: "IN_PROGRESS" }));
    const result = await syncCompliance(42, {}, t.deps);
    expect(result?.compliance).toMatchObject({ state: "WY", nextDueDate: "2027-03-01", status: "UPCOMING", filingRequired: true, quotePriceCents: 6000, quoteIsMinimum: true, lastError: null });
    expect(result?.reports[0]).toMatchObject({ fiscalYear: 2027, annualReportId: "ar_1", status: "IN_PROGRESS" });
    // Past FILLED means it was handed over: stamped confirmed.
    expect(result?.reports[0].confirmedAt).toBeInstanceOf(Date);
  });

  it("is throttled on page views and skips test, demo and unfiled orders", async () => {
    const t = makeDeps();
    await syncCompliance(42, { maxAgeMs: 10 * 60_000 }, t.deps);
    await syncCompliance(42, { maxAgeMs: 10 * 60_000 }, t.deps);
    expect(t.provider.calendar).toHaveBeenCalledTimes(1);
    t.setNow(new Date("2026-12-10T18:11:00Z"));
    await syncCompliance(42, { maxAgeMs: 10 * 60_000 }, t.deps);
    expect(t.provider.calendar).toHaveBeenCalledTimes(2);

    const test = makeDeps({ facts: filing({ eligible: false }) });
    expect(await syncCompliance(42, {}, test.deps)).toBeNull();
    expect(test.provider.calendar).not.toHaveBeenCalled();
    expect(test.memory.compliance.size).toBe(0);
  });

  it("keeps the last good calendar through a provider outage and records the error", async () => {
    const t = makeDeps();
    await syncCompliance(42, {}, t.deps);
    t.provider.calendar.mockRejectedValueOnce(apiError("E_INTERNAL", 503));
    const result = await syncCompliance(42, {}, t.deps);
    expect(result?.compliance).toMatchObject({ nextDueDate: "2027-03-01", status: "UPCOMING", lastError: "calendar:E_INTERNAL" });
  });

  it("the daily pass reads only calendars older than a day", async () => {
    const t = makeDeps();
    await syncCompliance(42, {}, t.deps);
    expect((await syncStaleCalendars(t.deps)).synced).toBe(0);
    t.setNow(new Date("2026-12-11T15:00:00Z"));
    expect((await syncStaleCalendars(t.deps)).synced).toBe(1);
  });
});

describe("the filing form", () => {
  it("prefills her company details and hides nothing she must answer", async () => {
    const t = makeDeps();
    const form = await getAnnualReportForm(7, 42, t.deps);
    expect(t.provider.getRequirements).toHaveBeenCalledWith("dc_test123", 2027);
    expect(form.answers).toMatchObject({ companyName: "Amina Studio LLC", phoneNumber: "+13075550100", mailingAddress: { line1: "1 Main St", city: "Cheyenne" } });
    expect(form.quote).toEqual({ priceCents: 6000, isMinimum: true });
    expect(form.fields.map((field) => field.fieldId)).toContain("assetValue");
  });

  it("is scoped to her own LLC", async () => {
    const t = makeDeps();
    await expect(getAnnualReportForm(8, 42, t.deps)).rejects.toMatchObject({ code: "not_found" });
  });

  it("scrubs provider names from the state's labels", async () => {
    const t = makeDeps();
    t.provider.getRequirements.mockResolvedValueOnce(
      requirements({ fields: [{ fieldId: "agent", label: "Keep doola as your agent?", type: "SELECT", group: "QUESTION", required: true, affectsFee: false, options: [{ value: "y", label: "Yes, keep Doola" }], dependsOn: null }] }),
    );
    const form = await getAnnualReportForm(7, 42, t.deps);
    expect(JSON.stringify(form)).not.toMatch(/doola|whop/i);
  });
});

describe("submit and replace", () => {
  it("submits only the fields shown, company details apart, and stores the fixed price", async () => {
    const t = makeDeps();
    const result = await submitAnnualReport(7, 42, { ...ANSWERS, assetValue: "999", invented: "x" } as never, t.deps);
    expect(t.provider.submit).toHaveBeenCalledWith("dc_test123", {
      fiscalYear: 2027,
      answers: [{ fieldId: "hasAssets", value: false }],
      companyDetails: { companyName: "Amina Studio LLC", mailingAddress: ANSWERS.mailingAddress },
    });
    expect(result).toMatchObject({ priceCents: 6000, previousPriceCents: 6000, priceChanged: false, confirmOutcome: null });
    expect(t.memory.reports[0]).toMatchObject({ status: "FILLED", priceInCents: 6000, annualReportId: "ar_1" });
    expect(t.provider.confirm).not.toHaveBeenCalled();
  });

  it("refuses invalid answers before calling the provider", async () => {
    const t = makeDeps();
    const error = await submitAnnualReport(7, 42, { hasAssets: true }, t.deps).catch((e) => e);
    expect(error).toBeInstanceOf(AnnualReportError);
    expect(error.code).toBe("invalid");
    expect(Object.keys(error.fieldErrors)).toEqual(expect.arrayContaining(["assetValue", "companyName", "mailingAddress"]));
    expect(t.provider.submit).not.toHaveBeenCalled();
  });

  it("maps the provider's field errors onto her questions", async () => {
    const t = makeDeps();
    t.provider.submit.mockRejectedValueOnce(apiError("E_VALIDATION_FAILED", 400, { companyName: "E_INVALID", secretInternal: "E_X" }));
    const error = await submitAnnualReport(7, 42, ANSWERS, t.deps).catch((e) => e);
    expect(error.code).toBe("invalid");
    expect(error.fieldErrors).toEqual({ companyName: "Check this answer." });
  });

  it("a resubmit while FILLED replaces the answers; a new price voids the old checkout and is shown", async () => {
    const t = makeDeps();
    const first = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    await t.memory.store.updateReport(first.reportId, { checkoutPlanId: "plan_old", checkoutPriceCents: 6000, checkoutSessionId: "ch_old", checkoutQuoteHash: "a".repeat(64) });
    t.provider.submit.mockImplementationOnce(async () => ({ report: providerReport({ priceInCents: 26000 }), isReplaced: true }));
    const second = await submitAnnualReport(7, 42, { ...ANSWERS, hasAssets: true, assetValue: "400000" }, t.deps);
    expect(second).toMatchObject({ priceCents: 26000, previousPriceCents: 6000, priceChanged: true, isReplaced: true });
    expect(t.memory.reports).toHaveLength(1);
    expect(t.memory.reports[0]).toMatchObject({ priceInCents: 26000, checkoutPlanId: null, checkoutSessionId: null, answers: { hasAssets: true, assetValue: 400000 } });
  });

  it("refuses changes once paid or handed over", async () => {
    const t = makeDeps();
    const first = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    await t.memory.store.updateReport(first.reportId, { paidAt: new Date(), paidCents: 6000, paymentReference: "pay_1" });
    await expect(submitAnnualReport(7, 42, ANSWERS, t.deps)).rejects.toMatchObject({ code: "locked" });
  });

  it("a past report already on file comes back as a plain conflict", async () => {
    const t = makeDeps();
    t.provider.submit.mockRejectedValueOnce(apiError("E_ANNUAL_REPORT_ALREADY_EXISTS", 409));
    await expect(submitAnnualReport(7, 42, ANSWERS, t.deps)).rejects.toMatchObject({ code: "conflict" });
  });

  it("an unsupported state says so", async () => {
    const t = makeDeps();
    t.provider.getRequirements.mockRejectedValueOnce(apiError("E_STATE_NOT_SUPPORTED", 422));
    await expect(submitAnnualReport(7, 42, ANSWERS, t.deps)).rejects.toMatchObject({ code: "unsupported" });
  });

  it("not required: nothing to submit", async () => {
    const t = makeDeps();
    t.provider.getRequirements.mockResolvedValue(requirements({ isFilingRequired: false, fields: [] }));
    await expect(submitAnnualReport(7, 42, ANSWERS, t.deps)).rejects.toMatchObject({ code: "not_required" });
    expect(t.provider.submit).not.toHaveBeenCalled();
  });

  it("zero fee: confirmed straight away, without a payment", async () => {
    const t = makeDeps();
    t.provider.submit.mockImplementationOnce(async () => {
      const report = providerReport({ priceInCents: 0 });
      t.providerReports.push(report);
      return { report, isReplaced: false };
    });
    const result = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    expect(result.confirmOutcome).toBe("confirmed");
    expect(t.provider.confirm).toHaveBeenCalledTimes(1);
    expect(t.memory.reports[0]).toMatchObject({ status: "IN_PROGRESS", paidAt: null });
    expect(t.memory.reports[0].confirmedAt).toBeInstanceOf(Date);
  });
});

describe("confirm: the money rule", () => {
  let t: ReturnType<typeof makeDeps>;
  let reportId: number;
  beforeEach(async () => {
    t = makeDeps();
    reportId = (await submitAnnualReport(7, 42, ANSWERS, t.deps)).reportId;
  });

  it("never confirms a priced report without a verified payment of exactly its price", async () => {
    expect(await confirmReport(reportId, { source: "ops" }, t.deps)).toBe("not_paid");
    await t.memory.store.updateReport(reportId, { paidAt: new Date(), paidCents: 5999, paymentReference: "pay_1" });
    expect(await confirmReport(reportId, { source: "ops" }, t.deps)).toBe("not_paid");
    expect(await opsConfirmAnnualReport(42, reportId, t.deps)).toBe("not_paid");
    expect(t.provider.confirm).not.toHaveBeenCalled();
  });

  it("confirms once on a verified payment; repeats are harmless", async () => {
    await t.memory.store.updateReport(reportId, { paidAt: new Date(), paidCents: 6000, paymentReference: "pay_1" });
    expect(await confirmReport(reportId, { source: "payment" }, t.deps)).toBe("confirmed");
    expect(await confirmReport(reportId, { source: "payment" }, t.deps)).toBe("already_confirmed");
    expect(await retryPaidUnconfirmed(t.deps)).toEqual({});
    expect(t.provider.confirm).toHaveBeenCalledTimes(1);
    expect(t.memory.reports[0].status).toBe("IN_PROGRESS");
  });

  it("re-reads the provider's price first; a changed price is never confirmed and ops hear once", async () => {
    await t.memory.store.updateReport(reportId, { paidAt: new Date(), paidCents: 6000, paymentReference: "pay_1" });
    t.providerReports[0].priceInCents = 9000;
    expect(await confirmReport(reportId, { source: "payment" }, t.deps)).toBe("price_mismatch");
    expect(await confirmReport(reportId, { source: "retry" }, t.deps)).toBe("not_paid");
    expect(t.provider.confirm).not.toHaveBeenCalled();
    expect(t.alerts.once).toHaveBeenCalledTimes(1);
    expect(t.alerts.once.mock.calls[0][0]).toMatchObject({ type: `ar_mismatch_${reportId}` });
  });

  it("a failed confirm after payment alerts ops (once per report) and is retried by the sweep", async () => {
    await t.memory.store.updateReport(reportId, { paidAt: new Date(), paidCents: 6000, paymentReference: "pay_1" });
    t.provider.confirm.mockRejectedValueOnce(apiError("E_INTERNAL", 500));
    expect(await confirmReport(reportId, { source: "payment" }, t.deps)).toBe("confirm_failed");
    expect(t.memory.reports[0]).toMatchObject({ lastError: "confirm:E_INTERNAL", confirmedAt: null });
    expect(t.alerts.once).toHaveBeenCalledWith(expect.objectContaining({ type: `ar_confirm_failed_${reportId}` }));
    // Her page: we've got the payment, our team is finishing.
    const view = buildMemberView(t.facts, null, await t.memory.store.listReports(42), t.deps.now());
    expect(view.cardState).toBe("paid_finishing");
    expect(view.body).toContain("We've got your payment");
    expect(await retryPaidUnconfirmed(t.deps)).toEqual({ confirmed: 1 });
  });

  it("a confirm on the wrong status reads the report back and records it", async () => {
    await t.memory.store.updateReport(reportId, { paidAt: new Date(), paidCents: 6000, paymentReference: "pay_1" });
    t.provider.get.mockResolvedValueOnce(providerReport()).mockResolvedValueOnce(providerReport({ status: "IN_PROGRESS" }));
    t.provider.confirm.mockRejectedValueOnce(apiError("E_RESOURCE_CONFLICT", 409));
    expect(await confirmReport(reportId, { source: "payment" }, t.deps)).toBe("already_confirmed");
    expect(t.alerts.once).not.toHaveBeenCalled();
  });

  it("ops view offers Confirm filing only for a paid, unconfirmed report", async () => {
    let ops = await getOpsAnnualReports(42, t.deps);
    expect(ops.reports[0].canConfirm).toBe(false);
    await t.memory.store.updateReport(reportId, { paidAt: new Date(), paidCents: 6000, paymentReference: "pay_1" });
    t.setNow(new Date("2026-12-10T19:00:00Z"));
    ops = await getOpsAnnualReports(42, t.deps);
    expect(ops.reports[0]).toMatchObject({ canConfirm: true, paidCents: 6000, paymentReference: "pay_1" });
    expect(await opsConfirmAnnualReport(42, reportId, t.deps)).toBe("confirmed");
    expect(await opsConfirmAnnualReport(99, reportId, t.deps)).toBe("not_found");
  });
});

describe("webhooks", () => {
  it("submitted and completed re-read the filing; completed stamps it and mirrors the filed report", async () => {
    const t = makeDeps();
    const { reportId } = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    await t.memory.store.updateReport(reportId, { paidAt: new Date(), paidCents: 6000, paymentReference: "pay_1" });
    await confirmReport(reportId, { source: "payment" }, t.deps);

    expect(await processAnnualReportEvent({ eventName: "company_annual_report_submitted", doolaCompanyId: "dc_test123" }, t.deps)).toBe("synced");
    t.providerReports[0].status = "FILING_COMPLETED";
    expect(await processAnnualReportEvent({ eventName: "company_annual_report_completed", doolaCompanyId: "dc_test123" }, t.deps)).toBe("synced");
    expect(t.memory.reports[0].status).toBe("FILING_COMPLETED");
    expect(t.memory.reports[0].completedAt).toBeInstanceOf(Date);
    expect(t.documents.mirror).toHaveBeenCalled();

    // A replay is harmless: same state, completedAt unchanged.
    const completedAt = t.memory.reports[0].completedAt;
    await processAnnualReportEvent({ eventName: "company_annual_report_completed", doolaCompanyId: "dc_test123" }, t.deps);
    expect(t.memory.reports[0].completedAt).toBe(completedAt);
  });

  it("the document event mirrors with the document id", async () => {
    const t = makeDeps();
    await processAnnualReportEvent({ eventName: "document_annualreport_uploaded", doolaCompanyId: "dc_test123", documentId: "doc_9" }, t.deps);
    expect(t.documents.mirror).toHaveBeenCalledWith(expect.objectContaining({ documentId: "doc_9" }));
  });

  it("unknown events and unknown companies are ignored", async () => {
    const t = makeDeps();
    expect(await processAnnualReportEvent({ eventName: "company_something_new", doolaCompanyId: "dc_test123" }, t.deps)).toBe("ignored");
    expect(await processAnnualReportEvent({ eventName: "company_annual_report_completed", doolaCompanyId: "dc_other" }, t.deps)).toBe("ignored");
    expect(t.provider.calendar).not.toHaveBeenCalled();
  });

  it("AWAITING_INFORMATION alerts ops once, and her card says our team is reviewing", async () => {
    const t = makeDeps();
    t.providerReports.push(providerReport({ status: "AWAITING_INFORMATION" }));
    await processAnnualReportEvent({ eventName: "company_annual_report_submitted", doolaCompanyId: "dc_test123" }, t.deps);
    await processAnnualReportEvent({ eventName: "company_annual_report_submitted", doolaCompanyId: "dc_test123" }, t.deps);
    expect(t.alerts.once).toHaveBeenCalledTimes(1);
    const view = await getMemberAnnualReport(7, 42, t.deps);
    expect(view?.cardState).toBe("awaiting_information");
    expect(view?.body).toContain("Our team is reviewing a detail");
  });
});

describe("her card", () => {
  const base = { registrationId: 42, userId: 7, state: "WY" as const, nextDueDate: "2027-03-01", lastFiledDate: null, filingRequired: true, quotePriceCents: 6000, quoteIsMinimum: false, syncedAt: new Date(), lastError: null };
  const now = new Date("2026-12-10T18:00:00Z");

  it("due, overdue, not yet due and not required read in plain words", () => {
    const due = buildMemberView(filing(), { ...base, status: "UPCOMING" }, [], now);
    expect(due).toMatchObject({ cardState: "due", canFile: true, dueDateWords: "March 1, 2027", stateName: "Wyoming" });
    expect(due.body).toContain("due March 1, 2027");
    expect(buildMemberView(filing(), { ...base, status: "OVERDUE" }, [], now)).toMatchObject({ cardState: "overdue", canFile: true });
    expect(buildMemberView(filing(), { ...base, status: "NOT_YET_DUE" }, [], now)).toMatchObject({ cardState: "not_yet_due", headline: "Not due yet", canFile: false });
    expect(buildMemberView(filing(), { ...base, status: "UPCOMING", filingRequired: false }, [], now)).toMatchObject({ cardState: "not_required", headline: "Your state doesn't require an annual report", canFile: false });
    expect(buildMemberView(filing(), { ...base, status: "UNSUPPORTED_STATE" }, [], now)).toMatchObject({ cardState: "not_required", canFile: false });
    expect(buildMemberView(filing(), null, [], now)).toMatchObject({ cardState: "checking", canFile: false });
  });

  it("follows the report: saved, filing, filed with the date", async () => {
    const t = makeDeps();
    const { reportId } = await submitAnnualReport(7, 42, ANSWERS, t.deps);
    let view = await getMemberAnnualReport(7, 42, t.deps);
    expect(view).toMatchObject({ cardState: "saved", canFile: true, current: { needsPayment: true, priceCents: 6000, canEdit: true } });
    await t.memory.store.updateReport(reportId, { paidAt: new Date(), paidCents: 6000, paymentReference: "pay_1" });
    await confirmReport(reportId, { source: "payment" }, t.deps);
    view = await getMemberAnnualReport(7, 42, t.deps);
    expect(view).toMatchObject({ cardState: "filing", headline: "We're filing it with the state", canFile: false });
    await t.memory.store.updateReport(reportId, { status: "FILING_COMPLETED", completedAt: new Date("2027-01-05T12:00:00Z") });
    view = await getMemberAnnualReport(7, 42, t.deps);
    expect(view).toMatchObject({ cardState: "filed", current: { filedOnWords: "January 5, 2027" } });
    expect(view?.body).toContain("Filed on January 5, 2027");
  });

  it("white-label: no provider name in anything she receives", async () => {
    const t = makeDeps();
    t.providerReports.push(providerReport({ annualReportId: "doola_ar_77", status: "FILLED" }));
    const view = await getMemberAnnualReport(7, 42, t.deps);
    expect(JSON.stringify(view)).not.toMatch(/doola|whop|dc_test|ar_1|annualReportId/i);
  });
});

describe("the filing window (live check 2026-10-20)", () => {
  // The provider answered the same due date for fiscal years 2026 and 2027, so filing opens only within 90 days of
  // the calendar's due date, or once it says OVERDUE.
  const far = { state: "WY", nextDueDate: "2027-09-01", lastFiledDate: null, status: "UPCOMING" as const };
  const now = new Date("2026-10-20T18:00:00Z");

  it("more than 90 days out: no File button, the card says when it opens", async () => {
    const t = makeDeps({ calendar: far, now });
    const view = await getMemberAnnualReport(7, 42, t.deps);
    expect(view).toMatchObject({ cardState: "not_yet_due", canFile: false, dueDateWords: "September 1, 2027", opensOnWords: "June 3, 2027" });
    expect(view?.body).toContain("Filing opens on June 3, 2027");
  });

  it("the form and the submit refuse before the window opens, without asking the provider", async () => {
    const t = makeDeps({ calendar: far, now });
    await expect(getAnnualReportForm(7, 42, t.deps)).rejects.toMatchObject({ code: "not_open", message: expect.stringContaining("June 3, 2027") });
    await expect(submitAnnualReport(7, 42, ANSWERS, t.deps)).rejects.toMatchObject({ code: "not_open" });
    expect(t.provider.getRequirements).not.toHaveBeenCalled();
    expect(t.provider.submit).not.toHaveBeenCalled();
  });

  it("opens exactly 90 days before the due date (Pacific date)", async () => {
    // 2027-06-03 is 90 days before 2027-09-01; 6 AM UTC on June 3 is still June 2 in California.
    const early = makeDeps({ calendar: far, now: new Date("2027-06-03T06:00:00Z") });
    expect((await getMemberAnnualReport(7, 42, early.deps))?.canFile).toBe(false);
    const open = makeDeps({ calendar: far, now: new Date("2027-06-03T18:00:00Z") });
    expect(await getMemberAnnualReport(7, 42, open.deps)).toMatchObject({ cardState: "due", canFile: true, opensOnWords: null });
    // The fiscal year is still the due date's year (awaiting provider confirmation).
    await getAnnualReportForm(7, 42, open.deps);
    expect(open.provider.getRequirements).toHaveBeenCalledWith("dc_test123", 2027);
  });

  it("OVERDUE is always open; no due date is never open", async () => {
    const overdue = makeDeps({ calendar: { ...far, status: "OVERDUE" }, now });
    expect(await getMemberAnnualReport(7, 42, overdue.deps)).toMatchObject({ cardState: "overdue", canFile: true });
    const unknown = makeDeps({ calendar: { ...far, nextDueDate: null }, now });
    expect((await getMemberAnnualReport(7, 42, unknown.deps))?.canFile).toBe(false);
    await expect(getAnnualReportForm(7, 42, unknown.deps)).rejects.toMatchObject({ code: "not_open" });
  });

  it("saved answers outside the window can't be paid or changed until it opens", async () => {
    const t = makeDeps({ calendar: far, now });
    await t.memory.store.upsertReport({ registrationId: 42, userId: 7, fiscalYear: 2027 }, { status: "FILLED", priceInCents: 6000, annualReportId: "ar_1" });
    const view = await getMemberAnnualReport(7, 42, t.deps);
    expect(view).toMatchObject({ cardState: "saved", canFile: false, opensOnWords: "June 3, 2027" });
  });
});

describe("prefill", () => {
  it("fills the mailing address only from her own mailing address, never her business address", async () => {
    const t = makeDeps({ facts: filing({ mailingAddress: null }) });
    const form = await getAnnualReportForm(7, 42, t.deps);
    expect(form.answers).not.toHaveProperty("mailingAddress");
    expect(form.answers).toMatchObject({ companyName: "Amina Studio LLC" });
  });
});

describe("submission body", () => {
  it("puts unknown company-detail ids in answers and known ones in companyDetails", () => {
    const fields = requirements().fields.concat([{ fieldId: "registeredOfficeNote", label: "x", type: "TEXT", group: "COMPANY_DETAIL", required: false, affectsFee: false, options: [], dependsOn: null }]);
    expect(buildSubmission(fields, { companyName: "A LLC", registeredOfficeNote: "n", hasAssets: true }, 2027)).toEqual({
      fiscalYear: 2027,
      answers: [{ fieldId: "hasAssets", value: true }, { fieldId: "registeredOfficeNote", value: "n" }],
      companyDetails: { companyName: "A LLC" },
    });
  });
});

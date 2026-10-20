import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoolaApiError } from "../doola";
import { doolaAnnualReportProvider, normalizeCalendar, normalizeField, normalizeReport, submissionIdempotencyKey } from "./provider";

const calls: Array<{ url: string; method: string; headers: Headers; body: unknown }> = [];

function respond(status: number, payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: String(init.method), headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify(payload), { status });
    }),
  );
}

beforeEach(() => {
  calls.length = 0;
  vi.stubEnv("DOOLA_API_KEY", "dk_test_abcdefghijklmnop");
  vi.stubEnv("DOOLA_API_BASE_URL", "https://api.test.doola.com");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const BASE = "https://api.test.doola.com/v1/partner/companies/dc_1/compliance/annual-reports";

describe("annual report provider client", () => {
  it("reads requirements for a fiscal year and normalizes every field", async () => {
    respond(200, {
      payload: {
        doolaCompanyId: "dc_1",
        state: "WY",
        entityType: "LLC",
        fiscalYear: 2027,
        isFilingRequired: true,
        dueDate: "2027-03-01",
        fields: [
          { fieldId: "assets", label: "Assets in Wyoming", type: "AMOUNT", group: "QUESTION", required: true, affectsFee: true, options: null, dependsOn: { fieldId: "hasAssets", answer: true } },
          { fieldId: "kind", label: "Kind", type: "SELECT", group: "QUESTION", required: false, affectsFee: false, options: ["A", { value: "B", label: "Bee" }] },
          { fieldId: "bad", type: "WEIRD" },
        ],
      },
    });
    const result = await doolaAnnualReportProvider.getRequirements("dc_1", 2027);
    expect(calls[0]).toMatchObject({ url: `${BASE}/requirements?fiscalYear=2027`, method: "GET" });
    expect(calls[0].headers.get("Authorization")).toBe("dk_test_abcdefghijklmnop");
    expect(result).toMatchObject({ fiscalYear: 2027, dueDate: "2027-03-01", isFilingRequired: true });
    expect(result.fields).toHaveLength(2);
    expect(result.fields[0].dependsOn).toEqual({ fieldId: "hasAssets", answer: "true" });
    expect(result.fields[1].options).toEqual([{ value: "A", label: "A" }, { value: "B", label: "Bee" }]);
  });

  it("state fee: priceInCents and isMinimum", async () => {
    respond(200, { payload: { state: "WY", entityType: "LLC", priceInCents: 6000, isFilingRequired: true, isMinimum: true } });
    expect(await doolaAnnualReportProvider.getStateFee("dc_1")).toEqual({ state: "WY", entityType: "LLC", priceInCents: 6000, isFilingRequired: true, isMinimum: true });
    expect(calls[0].url).toBe(`${BASE}/state-fees`);
  });

  it("submit posts the body with an idempotency key and reads { report, isReplaced }", async () => {
    respond(200, { payload: { report: { annualReportId: "ar_1", fiscalYear: 2027, state: "WY", entityType: "LLC", status: "FILLED", priceInCents: 6000 }, isReplaced: true } });
    const body = { fiscalYear: 2027, answers: [{ fieldId: "hasAssets", value: false }] };
    const result = await doolaAnnualReportProvider.submit("dc_1", body);
    expect(calls[0]).toMatchObject({ url: BASE, method: "POST", body });
    expect(calls[0].headers.get("Idempotency-Key")).toBe(submissionIdempotencyKey("dc_1", body));
    expect(result).toMatchObject({ isReplaced: true, report: { annualReportId: "ar_1", status: "FILLED", priceInCents: 6000 } });
    expect(submissionIdempotencyKey("dc_1", { ...body, fiscalYear: 2028 })).not.toBe(submissionIdempotencyKey("dc_1", body));
  });

  it("confirm, list, get and the calendar hit their documented paths", async () => {
    respond(200, { payload: { annualReportId: "ar_1", fiscalYear: 2027, status: "IN_PROGRESS", priceInCents: 6000 } });
    expect((await doolaAnnualReportProvider.confirm("dc_1", "ar_1"))?.status).toBe("IN_PROGRESS");
    expect(calls[0]).toMatchObject({ url: `${BASE}/ar_1/confirm`, method: "POST" });
    await doolaAnnualReportProvider.get("dc_1", "ar_1");
    expect(calls[1]).toMatchObject({ url: `${BASE}/ar_1`, method: "GET" });

    respond(200, { payload: [{ annualReportId: "ar_2", fiscalYear: 2028, status: "FILLED", priceInCents: 6000 }, { nope: true }] });
    expect((await doolaAnnualReportProvider.list("dc_1")).map((report) => report.annualReportId)).toEqual(["ar_2"]);

    respond(200, { payload: { events: [{ type: "ANNUAL_REPORT", state: "WY", nextDueDate: "2027-03-01", lastFiledDate: null, status: "UPCOMING" }] } });
    expect(await doolaAnnualReportProvider.calendar("dc_1")).toEqual({ state: "WY", nextDueDate: "2027-03-01", lastFiledDate: null, status: "UPCOMING" });
    expect(calls.at(-1)?.url).toBe("https://api.test.doola.com/v1/partner/companies/dc_1/compliance/calendar");
  });

  it("errors keep the documented code and the per-field codes (server-side only)", async () => {
    respond(400, { error: { code: "E_VALIDATION_FAILED", message: "bad", fields: { companyName: { code: "E_REQUIRED" } } } });
    const error = await doolaAnnualReportProvider.submit("dc_1", { fiscalYear: 2027 }).catch((e) => e);
    expect(error).toBeInstanceOf(DoolaApiError);
    expect(error).toMatchObject({ code: "E_VALIDATION_FAILED", httpStatus: 400, fields: { companyName: "E_REQUIRED" } });
    respond(409, { error: { code: "E_ANNUAL_REPORT_ALREADY_EXISTS" } });
    expect(await doolaAnnualReportProvider.submit("dc_1", { fiscalYear: 2026 }).catch((e) => e.code)).toBe("E_ANNUAL_REPORT_ALREADY_EXISTS");
    respond(422, { error: { code: "E_STATE_NOT_SUPPORTED" } });
    expect(await doolaAnnualReportProvider.getRequirements("dc_1").catch((e) => e.code)).toBe("E_STATE_NOT_SUPPORTED");
  });

  it("normalizers refuse what they can't read", () => {
    expect(normalizeField({ fieldId: "x", type: "NOPE" })).toBeNull();
    expect(normalizeReport({ annualReportId: "a", status: "SOMETHING" })).toBeNull();
    expect(normalizeCalendar({ events: [{ type: "BOI" }] })).toBeNull();
    expect(normalizeCalendar({ events: [{ type: "ANNUAL_REPORT", status: "??", nextDueDate: "soon" }] })).toMatchObject({ status: "UNSUPPORTED_STATE", nextDueDate: null });
  });
});

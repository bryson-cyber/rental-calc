/**
 * Re-filing after a refusal (2026-10-29, ported from Her First Order's PR
 * #397: HFO's order #32, refused with a 400 validation error, was re-filed
 * 62 times in three hours by its payment sweep, each time the same 400 and
 * the same page to the owner). Pinned here against the real filing step (the
 * provider's HTTP API is never reached: fetch is stubbed):
 *  1. A refusal stores the provider's reason (field:code pairs) on the order
 *     and in the ops alert, and the alert names the right provider.
 *  2. The refused order is held: a plain call (payment webhook, client
 *     return, sweep, Mark paid, address confirm) takes no lock and calls no
 *     provider. Only an ops retry re-files it, also from action_required, and
 *     it reuses the stored submission key.
 *  3. Retryable and uncertain failures (the watchdog's recovered
 *     interruption) still re-file automatically.
 *  4. An activity with no filing industry is parked before any provider
 *     call, with one deduped alert.
 *  5. Every alert goes through the 24-hour claim per order and error type.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  get: vi.fn(),
  transition: vi.fn(),
  updateProvider: vi.fn(),
  countAttempts: vi.fn(),
  createAttempt: vi.fn(),
  finishAttempt: vi.fn(),
}));
const notify = vi.hoisted(() => ({ send: vi.fn() }));
const claim = vi.hoisted(() => ({ within: vi.fn() }));
const database = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, getDb: database.get };
});

vi.mock("./store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store")>();
  return {
    ...actual,
    getLlcRegistrationById: store.get,
    transitionLlcStatus: store.transition,
    updateLlcRegistrationProviderFields: store.updateProvider,
    countSubmissionAttempts: store.countAttempts,
    createSubmissionAttempt: store.createAttempt,
    finishSubmissionAttempt: store.finishAttempt,
  };
});

vi.mock("../ops/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ops/notify")>();
  return { ...actual, sendOpsAlert: notify.send };
});

vi.mock("./opsAlertClaim", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./opsAlertClaim")>();
  return { ...actual, sendOpsAlertWithin: claim.within };
});

import {
  OPS_FILING_PROBLEM_ALERT_TYPE,
  OPS_FILING_PROBLEM_ALERT_WINDOW_MS,
  fileDoolaRegistration,
  filingHeldForOpsRetry,
} from "./doolaSubmission";
import { submissionProblemAlert } from "../ops/notify";
import { makePersistedBundle } from "./test-fixtures";

const fetchMock = vi.fn();
const paidAt = new Date("2026-10-29T03:28:00.000Z");

/** A paid doola order whose customer exists and whose company create is pending. */
function paidBundle(overrides: Record<string, unknown> = {}) {
  const bundle = makePersistedBundle("payment_required");
  Object.assign(bundle.registration, {
    provider: "doola",
    isTest: false,
    doolaEnv: "sandbox",
    doolaCustomerId: "cus_41",
    doolaCompanyId: null,
    retailPaidAt: paidAt,
    businessAddressMode: "customer",
    mailingAddressMode: "customer",
    providerErrorDetail: null,
    ...overrides,
  });
  return bundle as never;
}

const refusedRow = {
  status: "failed",
  retryable: false,
  lastErrorType: "e_validation_failed",
};

function validationRefusal() {
  return new Response(
    JSON.stringify({
      payload: null,
      error: {
        code: "E_VALIDATION_FAILED",
        message: "one or more fields are invalid",
        fields: { industry: { code: "E_INDUSTRY_INVALID", message: "invalid industry" } },
      },
    }),
    { status: 400, headers: { "content-type": "application/json" } },
  );
}

function companyCreated() {
  return new Response(JSON.stringify({ payload: { doolaCompanyId: "dc_41", formationSubmissionStatus: "Submitted" } }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}

/** The lock and every later transition succeed against the bundle's own row. */
function transitionsSucceed() {
  store.transition.mockImplementation(async () => ({
    changed: true,
    registration: ((await store.get()) as { registration: unknown }).registration,
  }));
}

const providerCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("doola.com"));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("LLC_TEST_MODE", "");
  vi.stubEnv("DOOLA_API_KEY", "dk_test_fake_key_for_tests_only");
  vi.stubEnv("DOOLA_API_BASE_URL", "https://api.test.doola.com");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fetchMock.mockImplementation(async () => validationRefusal());
  notify.send.mockResolvedValue(true);
  claim.within.mockResolvedValue("sent");
  database.get.mockResolvedValue(null);
  store.countAttempts.mockResolvedValue(0);
  store.createAttempt.mockResolvedValue(1);
  store.finishAttempt.mockResolvedValue(undefined);
  store.updateProvider.mockResolvedValue(undefined);
  transitionsSucceed();
});

describe("a provider refusal", () => {
  it("stores the provider's field codes on the order and pages once per error type, naming doola, not Whop", async () => {
    store.get.mockResolvedValue(paidBundle());

    const result = await fileDoolaRegistration({ userId: 7, registrationId: 41 });

    expect(result).toEqual({
      outcome: "failed",
      message: "The filing could not be submitted.",
      providerDetail: "E_VALIDATION_FAILED · industry:E_INDUSTRY_INVALID",
    });
    const failed = store.transition.mock.calls.find(([params]) => params.toStatus === "failed")![0];
    expect(failed.updates).toMatchObject({
      lastErrorType: "e_validation_failed",
      retryable: false,
      providerErrorDetail: "E_VALIDATION_FAILED · industry:E_INDUSTRY_INVALID",
    });
    // The client's words stay generic: no provider name, no field codes.
    expect(failed.updates.lastErrorMessage).not.toMatch(/doola|whop|industry/i);

    expect(notify.send).not.toHaveBeenCalled();
    expect(claim.within).toHaveBeenCalledTimes(1);
    const alertCall = claim.within.mock.calls[0][0];
    expect(alertCall).toMatchObject({
      registrationId: 41,
      emailType: `${OPS_FILING_PROBLEM_ALERT_TYPE}:e_validation_failed`,
      windowMs: 24 * 60 * 60 * 1000,
    });
    const text = alertCall.alert.lines.join("\n");
    expect(text).toContain("The doola filing for order #41 did not complete.");
    expect(text).toContain("Provider said: E_VALIDATION_FAILED · industry:E_INDUSTRY_INVALID");
    expect(text).toContain("It will not re-file by itself");
    expect(text).toContain("Retry filing");
    expect(text).not.toContain("Whop");
    // A validation refusal is certain: nothing was created provider-side.
    expect(text).toContain("The client's draft is intact.");
  });

  it("the refused order is then held: the next automatic call takes no lock and calls no provider", async () => {
    store.get.mockResolvedValue(paidBundle());
    await fileDoolaRegistration({ userId: 7, registrationId: 41 });
    const failed = store.transition.mock.calls.find(([params]) => params.toStatus === "failed")![0];

    // The row as the refusal left it.
    store.get.mockResolvedValue(paidBundle({ status: "failed", ...failed.updates }));
    store.transition.mockClear();
    fetchMock.mockClear();
    claim.within.mockClear();

    for (let pass = 0; pass < 3; pass++) {
      const again = await fileDoolaRegistration({ userId: 7, registrationId: 41 });
      expect(again.outcome).toBe("held");
    }
    expect(store.transition).not.toHaveBeenCalled();
    expect(store.createAttempt).toHaveBeenCalledTimes(1); // the first, refused attempt only
    expect(providerCalls()).toHaveLength(0);
    expect(claim.within).not.toHaveBeenCalled();
    expect(notify.send).not.toHaveBeenCalled();
  });

  it("an ops retry re-files it after the correction, from failed or action_required, under the same idempotency key", async () => {
    fetchMock.mockImplementation(async () => companyCreated());
    for (const status of ["failed", "action_required"] as const) {
      store.transition.mockClear();
      fetchMock.mockClear();
      store.get.mockResolvedValue(
        paidBundle({ ...refusedRow, status, providerErrorDetail: "E_VALIDATION_FAILED · industry:E_INDUSTRY_INVALID" }),
      );

      const result = await fileDoolaRegistration({ userId: 7, registrationId: 41, opsRetry: true });

      expect(result).toEqual({ outcome: "filed", doolaCompanyId: "dc_41" });
      const lock = store.transition.mock.calls[0][0];
      expect(lock).toMatchObject({ toStatus: "submitting", note: "Filing with the formation service (ops retry after review)" });
      expect(lock.expectedStatuses).toEqual(["payment_required", "failed", "action_required"]);
      const accepted = store.transition.mock.calls.find(([params]) => params.toStatus === "processing")![0];
      expect(accepted.updates.providerErrorDetail).toBeNull();
      // The stored submission key: the provider sees the same Idempotency-Key as the refused attempt.
      expect(providerCalls()).toHaveLength(1);
      const [url, init] = providerCalls()[0];
      expect(String(url)).toBe("https://api.test.doola.com/v1/partner/companies");
      expect((init as RequestInit).headers).toMatchObject({ "Idempotency-Key": "stable-submission-key-company" });
      expect(store.updateProvider).not.toHaveBeenCalledWith(7, 41, expect.objectContaining({ submissionKey: expect.anything() }));
    }
  });

  it("without the ops flag the lock never takes an action_required order", async () => {
    store.get.mockResolvedValue(paidBundle({ status: "payment_required" }));
    fetchMock.mockImplementation(async () => companyCreated());
    await fileDoolaRegistration({ userId: 7, registrationId: 41 });
    expect(store.transition.mock.calls[0][0].expectedStatuses).toEqual(["payment_required", "failed"]);
  });
});

describe("automatic re-filing that stays", () => {
  it.each([
    ["a retryable provider failure (429/5xx)", { status: "failed", retryable: true, lastErrorType: "e_rate_limited" }],
    ["the watchdog's recovered interruption", { status: "failed", retryable: true, lastErrorType: "uncertain_interrupted" }],
    ["a transport-uncertain create", { status: "failed", retryable: false, lastErrorType: "uncertain_e_malformed_response" }],
    ["our own missing configuration", { status: "failed", retryable: false, lastErrorType: "provider_configuration" }],
    ["a paid order not filed yet", { status: "payment_required", retryable: false, lastErrorType: null }],
  ])("%s still files automatically", async (_label, row) => {
    expect(filingHeldForOpsRetry(row)).toBe(false);
    store.get.mockResolvedValue(paidBundle(row));
    fetchMock.mockImplementation(async () => companyCreated());

    const result = await fileDoolaRegistration({ userId: 7, registrationId: 41 });

    expect(result).toEqual({ outcome: "filed", doolaCompanyId: "dc_41" });
    expect(providerCalls()).toHaveLength(1);
  });

  it("holds every refusal that is certain and not retryable", () => {
    expect(filingHeldForOpsRetry(refusedRow)).toBe(true);
    expect(filingHeldForOpsRetry({ ...refusedRow, lastErrorType: "e_phone_invalid" })).toBe(true);
    expect(filingHeldForOpsRetry({ ...refusedRow, lastErrorType: "e_unsupported_country" })).toBe(true);
    expect(filingHeldForOpsRetry({ ...refusedRow, lastErrorType: "e_industry_unmapped" })).toBe(true);
    // Ops parking (action_required) is outside the automatic lock anyway.
    expect(filingHeldForOpsRetry({ ...refusedRow, status: "action_required" })).toBe(false);
  });
});

describe("the ops alert", () => {
  it("names the provider it is about, and keeps the old words for the Whop leg", () => {
    const base = { registrationId: 41, legalName: "X LLC", errorType: "e_validation_failed", message: "m", uncertain: true };
    const doola = submissionProblemAlert({ ...base, provider: "doola", providerDetail: "E_VALIDATION_FAILED · industry:E_INDUSTRY_INVALID" }).lines.join("\n");
    expect(doola).toContain("The doola filing for order #41 did not complete.");
    expect(doola).toContain("check the doola partner portal before retrying");
    expect(doola).not.toContain("Whop");
    const whop = submissionProblemAlert({ ...base, provider: "whop" }).lines.join("\n");
    expect(whop).toContain("The automatic Whop submission for order #41 did not complete.");
    expect(whop).not.toContain("Provider said");
    const unknown = submissionProblemAlert(base).lines.join("\n");
    expect(unknown).toContain("The automatic filing for order #41 did not complete.");
    expect(unknown).not.toMatch(/whop|doola/i);
  });

  it("the window is 24 hours, and an environment mismatch goes through the same claim", async () => {
    expect(OPS_FILING_PROBLEM_ALERT_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
    store.get.mockResolvedValue(paidBundle({ doolaEnv: "production" }));
    const result = await fileDoolaRegistration({ userId: 7, registrationId: 41 });
    expect(result.outcome).toBe("not_ready");
    expect(notify.send).not.toHaveBeenCalled();
    expect(claim.within).toHaveBeenCalledWith(
      expect.objectContaining({ registrationId: 41, emailType: `${OPS_FILING_PROBLEM_ALERT_TYPE}:environment_mismatch` }),
    );
    expect(providerCalls()).toHaveLength(0);
  });
});

describe("an activity with no filing industry", () => {
  it.each([
    ["a taxonomy triple that is not a wizard choice", { businessType: "physical_product", industryGroup: "clothing_and_apparel", industryType: "not_a_wizard_choice" }],
    ["a provider label that is not on the list", { businessType: "doola_direct", industryGroup: "doola_direct", industryType: "Workwear studio" }],
  ])("%s is parked in action_required before any provider call, with one deduped alert, and never sent", async (_label, activity) => {
    store.get.mockResolvedValue(paidBundle(activity));

    const result = await fileDoolaRegistration({ userId: 7, registrationId: 41 });

    expect(result.outcome).toBe("held");
    expect(providerCalls()).toHaveLength(0);
    expect(store.createAttempt).not.toHaveBeenCalled();
    expect(store.transition).toHaveBeenCalledTimes(1);
    const parked = store.transition.mock.calls[0][0];
    expect(parked).toMatchObject({
      toStatus: "action_required",
      expectedStatuses: ["payment_required", "failed"],
      updates: { lastErrorType: "industry_unmappable", retryable: false },
    });
    expect(parked.updates.lastErrorMessage).not.toMatch(/doola|whop|industry/i);
    expect(notify.send).not.toHaveBeenCalled();
    expect(claim.within).toHaveBeenCalledTimes(1);
    const alertCall = claim.within.mock.calls[0][0];
    expect(alertCall).toMatchObject({
      registrationId: 41,
      emailType: `${OPS_FILING_PROBLEM_ALERT_TYPE}:industry_unmappable`,
      windowMs: OPS_FILING_PROBLEM_ALERT_WINDOW_MS,
    });
    expect(alertCall.alert.lines.join("\n")).toContain("Filing held before any provider call");
  });

  it("an ops retry is held the same way until the activity maps", async () => {
    store.get.mockResolvedValue(
      paidBundle({ businessType: "physical_product", industryGroup: "clothing_and_apparel", industryType: "not_a_wizard_choice", status: "action_required" }),
    );
    const result = await fileDoolaRegistration({ userId: 7, registrationId: 41, opsRetry: true });
    expect(result.outcome).toBe("held");
    expect(providerCalls()).toHaveLength(0);
    expect(store.createAttempt).not.toHaveBeenCalled();
  });

  it("the fixture's legacy taxonomy activity, the owner's 541618 choice and a provider label each file with an industry", async () => {
    fetchMock.mockImplementation(async () => companyCreated());
    for (const [activity, industry] of [
      [{}, "Online education services"],
      [{ businessType: "services", industryGroup: "consulting", industryType: "other_management_consulting_services" }, "Business consulting"],
      [{ businessType: "doola_direct", industryGroup: "721310", industryType: "Short term rentals" }, "Short term rentals"],
    ] as const) {
      fetchMock.mockClear();
      store.get.mockResolvedValue(paidBundle(activity));
      expect(await fileDoolaRegistration({ userId: 7, registrationId: 41 })).toMatchObject({ outcome: "filed" });
      const body = JSON.parse(String((providerCalls()[0][1] as RequestInit).body));
      expect(body.industry).toBe(industry);
      expect(body).not.toHaveProperty("naicsCode");
    }
  });
});

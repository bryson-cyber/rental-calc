/**
 * The automatic ways back into the filing step (2026-10-29, ported from Her
 * First Order's PR #397: HFO's order #32, refused with a 400 validation
 * error, was re-filed 62 times by its payment sweep). Each is driven here
 * with a refused, paid order through this app's REAL handlers and the REAL
 * filing step (fileDoolaRegistration); the payment service and the provider
 * are a stubbed fetch, and the provider must never be called:
 *  - the Whop payment webhook (a redelivery) answers held_for_review;
 *  - the client's return from checkout answers "confirmed" and files nothing;
 *  - the payment sweep files nothing (and its query leaves refused orders
 *    out, mirroring filingHeldForOpsRetry);
 *  - Mark paid files nothing;
 *  - only Retry filing on the orders page (llcOps.retryFiling) re-files it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const store = vi.hoisted(() => ({
  get: vi.fn(),
  owner: vi.fn(),
  transition: vi.fn(),
  updateProvider: vi.fn(),
  countAttempts: vi.fn(),
  createAttempt: vi.fn(),
  finishAttempt: vi.fn(),
}));
const alerts = vi.hoisted(() => ({ send: vi.fn(), within: vi.fn() }));
const emails = vi.hoisted(() => ({ paymentConfirmed: vi.fn() }));
const database = vi.hoisted(() => ({ rows: [] as unknown[][] }));

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    // Only the payment sweep reads through this: select().from().where().limit().
    getDb: vi.fn(async () => ({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => database.rows.shift() ?? [] }) }) }),
    })),
  };
});
vi.mock("./store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store")>();
  return {
    ...actual,
    getLlcRegistrationById: store.get,
    findLlcRegistrationOwner: store.owner,
    transitionLlcStatus: store.transition,
    updateLlcRegistrationProviderFields: store.updateProvider,
    countSubmissionAttempts: store.countAttempts,
    createSubmissionAttempt: store.createAttempt,
    finishSubmissionAttempt: store.finishAttempt,
  };
});
vi.mock("../ops/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ops/notify")>();
  return { ...actual, sendOpsAlert: alerts.send };
});
vi.mock("./opsAlertClaim", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./opsAlertClaim")>();
  return { ...actual, sendOpsAlertWithin: alerts.within };
});
vi.mock("./clientEmails", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./clientEmails")>();
  return { ...actual, sendPaymentConfirmedEmail: emails.paymentConfirmed };
});

import { appRouter } from "../routers";
import { LLC_CHECKOUT_METADATA_VERSION, LLC_QUOTE_VERSION } from "./whopRetailCheckout";
import { handleWhopWebhookEvent, runLlcWhopReconciliation } from "./whopRetailWebhook";
import { makePersistedBundle } from "./test-fixtures";

const fetchMock = vi.fn();
const PAYMENT_ID = "pay_llc41";
const paidAt = new Date("2026-10-29T03:28:00.000Z");

const paymentData = {
  id: PAYMENT_ID,
  status: "paid",
  substatus: "succeeded",
  total: 450,
  currency: "usd",
  plan_id: "plan_llc41",
  metadata: {
    rc_metadata_version: LLC_CHECKOUT_METADATA_VERSION,
    rc_checkout_kind: "llc_filing",
    rc_llc_registration_id: "41",
    rc_llc_quote_hash: "a".repeat(64),
    rc_llc_quote_version: LLC_QUOTE_VERSION,
  },
};

/** A paid order as a 400 left it: paid through Whop checkout, customer created, refused on the company create. */
function refusedBundle(overrides: Record<string, unknown> = {}) {
  const bundle = makePersistedBundle("failed");
  Object.assign(bundle.registration, {
    provider: "doola",
    isTest: false,
    doolaEnv: "sandbox",
    doolaCustomerId: "cus_41",
    doolaCompanyId: null,
    businessAddressMode: "customer",
    mailingAddressMode: "customer",
    retailPaidAt: paidAt,
    retailPriceCents: 45_000,
    retailWhopPlanId: "plan_llc41",
    retailWhopPaymentId: PAYMENT_ID,
    checkoutQuoteHash: "a".repeat(64),
    lastErrorType: "e_validation_failed",
    lastErrorMessage: "Your filing needs a quick review by our team. Nothing further is needed from you right now.",
    retryable: false,
    providerErrorDetail: "E_VALIDATION_FAILED · industry:E_INDUSTRY_INVALID",
    ...overrides,
  });
  return bundle as never;
}

const providerCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("doola.com"));

function context(role: "user" | "admin"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : 7,
      openId: `user-${role}`,
      email: `${role}@example.com`,
      name: role,
      phone: null,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      reportMode: null,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("LLC_TEST_MODE", "");
  vi.stubEnv("LLC_AUTO_FILE_ENABLED", "true");
  vi.stubEnv("DOOLA_API_KEY", "dk_test_fake_key_for_tests_only");
  vi.stubEnv("DOOLA_API_BASE_URL", "https://api.test.doola.com");
  vi.stubEnv("WHOP_API_KEY", "apik_test_key_value");
  vi.stubEnv("WHOP_COMPANY_ID", "biz_rentalcalc123");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string | URL) =>
    String(url).includes("api.whop.com")
      ? new Response(JSON.stringify(paymentData), { status: 200 })
      : new Response(JSON.stringify({ payload: { doolaCompanyId: "dc_41", formationSubmissionStatus: "Submitted" } }), { status: 201 }),
  );
  database.rows = [];
  store.get.mockResolvedValue(refusedBundle());
  store.owner.mockResolvedValue({ userId: 7 });
  store.transition.mockImplementation(async () => ({ changed: true, registration: (await store.get()).registration }));
  store.updateProvider.mockResolvedValue(undefined);
  store.countAttempts.mockResolvedValue(62);
  store.createAttempt.mockResolvedValue(63);
  store.finishAttempt.mockResolvedValue(undefined);
  alerts.send.mockResolvedValue(true);
  alerts.within.mockResolvedValue("sent");
  emails.paymentConfirmed.mockResolvedValue("sent");
});

function expectNothingFiled() {
  expect(providerCalls()).toHaveLength(0);
  expect(store.transition).not.toHaveBeenCalled();
  expect(store.createAttempt).not.toHaveBeenCalled();
  expect(alerts.send).not.toHaveBeenCalled();
  expect(alerts.within).not.toHaveBeenCalled();
}

describe("a refused, paid filing on the automatic paths", () => {
  it("the Whop payment webhook (each redelivery) answers held_for_review and files nothing", async () => {
    for (let delivery = 0; delivery < 2; delivery++) {
      const outcome = await handleWhopWebhookEvent({ type: "payment.succeeded", data: paymentData });
      expect(outcome).toBe("llc-held_for_review");
    }
    expectNothingFiled();
    expect(emails.paymentConfirmed).not.toHaveBeenCalled();
  });

  it("the client's return from checkout answers confirmed (already handled) and files nothing", async () => {
    const caller = appRouter.createCaller(context("user"));
    for (let poll = 0; poll < 3; poll++) {
      const result = await caller.llc.confirmCheckout({ id: 41, paymentId: PAYMENT_ID });
      expect(result).toEqual({ state: "confirmed" });
      // Nothing about the provider or its codes reaches the client.
      expect(JSON.stringify(result)).not.toMatch(/doola|whop|E_INDUSTRY|E_VALIDATION/i);
    }
    expectNothingFiled();
  });

  it("the payment sweep files nothing and does not count the order as incomplete", async () => {
    database.rows = [[], [{ registrationId: 41, paymentId: PAYMENT_ID }]];
    const report = await runLlcWhopReconciliation({ fetchImpl: fetchMock as never });
    expect(report).toMatchObject({ processed: 1, incomplete: 0, outcomes: { held_for_review: 1 } });
    expectNothingFiled();
  });

  it("the sweep's query takes retryable failures but leaves refused orders out (same rule as filingHeldForOpsRetry)", () => {
    const source = readFileSync(join(__dirname, "whopRetailWebhook.ts"), "utf8");
    const start = source.indexOf("const paidPendingFiling");
    const query = source.slice(start, source.indexOf(".limit(200)", start));
    for (const clause of [
      'inArray(llcRegistrations.status, ["payment_required", "failed"])',
      'ne(llcRegistrations.status, "failed")',
      "eq(llcRegistrations.retryable, true)",
      "isNull(llcRegistrations.lastErrorType)",
      "like(llcRegistrations.lastErrorType, `${UNCERTAIN_ERROR_PREFIX}%`)",
      'eq(llcRegistrations.lastErrorType, "provider_configuration")',
    ]) {
      expect(query).toContain(clause);
    }
  });

  it("Mark paid files nothing", async () => {
    const result = await appRouter.createCaller(context("admin")).llcOps.markPaid({ id: 41 });
    expect(result).toEqual({ id: 41, paid: true });
    // The filing call is fire-and-forget: let it run to its answer.
    await vi.waitFor(() => expect(store.get).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(providerCalls()).toHaveLength(0);
    expect(store.transition).not.toHaveBeenCalled();
    expect(store.createAttempt).not.toHaveBeenCalled();
  });

  it("a retryable failure still re-files from the webhook, under its idempotency key", async () => {
    store.get.mockResolvedValue(refusedBundle({ retryable: true, lastErrorType: "e_rate_limited", providerErrorDetail: "E_RATE_LIMITED" }));
    const outcome = await handleWhopWebhookEvent({ type: "payment.succeeded", data: paymentData });
    expect(outcome).toBe("llc-filed");
    expect(providerCalls()).toHaveLength(1);
    expect((providerCalls()[0][1] as RequestInit).headers).toMatchObject({ "Idempotency-Key": "stable-submission-key-company" });
  });
});

describe("Retry filing on the orders page", () => {
  it("re-files the corrected order, from failed or from an action_required parking", async () => {
    const caller = appRouter.createCaller(context("admin"));
    for (const status of ["failed", "action_required"]) {
      fetchMock.mockClear();
      store.get.mockResolvedValue(refusedBundle({ status }));
      const result = await caller.llcOps.retryFiling({ id: 41 });
      expect(result).toMatchObject({ outcome: "filed", message: "Filed. The formation service accepted it." });
      expect(providerCalls()).toHaveLength(1);
      const [url, init] = providerCalls()[0];
      expect(String(url)).toContain("/v1/partner/companies");
      // Only the company create: the stored customer is reused, and so is the submission key.
      const body = JSON.parse(String((init as RequestInit).body));
      expect(body).toMatchObject({ doolaCustomerId: "cus_41", industry: "Online education services" });
      expect(body).not.toHaveProperty("naicsCode");
      expect((init as RequestInit).headers).toMatchObject({ "Idempotency-Key": "stable-submission-key-company" });
    }
  });

  it("files the owner's 541618 choice as Business consulting without editing her answers", async () => {
    store.get.mockResolvedValue(
      refusedBundle({
        status: "action_required",
        businessType: "services",
        industryGroup: "consulting",
        industryType: "other_management_consulting_services",
      }),
    );
    const result = await appRouter.createCaller(context("admin")).llcOps.retryFiling({ id: 41 });
    expect(result).toMatchObject({ outcome: "filed" });
    const body = JSON.parse(String((providerCalls()[0][1] as RequestInit).body));
    expect(body.industry).toBe("Business consulting");
    expect(JSON.stringify(body)).not.toContain("541618");
  });

  it("says what the provider refused when it refuses again", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(
        JSON.stringify({ payload: null, error: { code: "E_VALIDATION_FAILED", fields: { industry: { code: "E_INDUSTRY_INVALID" } } } }),
        { status: 400 },
      ),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await appRouter.createCaller(context("admin")).llcOps.retryFiling({ id: 41 });
    expect(result).toMatchObject({
      outcome: "failed",
      message: "Refused again: E_VALIDATION_FAILED · industry:E_INDUSTRY_INVALID Correct it and retry.",
    });
  });

  it("refuses an order it does not apply to, and clients cannot call it", async () => {
    const admin = appRouter.createCaller(context("admin"));
    for (const overrides of [{ doolaCompanyId: "dc_41" }, { retailPaidAt: null }, { status: "processing" }, { isTest: true }, { provider: "whop" }]) {
      store.get.mockResolvedValue(refusedBundle(overrides));
      await expect(admin.llcOps.retryFiling({ id: 41 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }
    await expect(appRouter.createCaller(context("user")).llcOps.retryFiling({ id: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(providerCalls()).toHaveLength(0);
  });

  it("the orders list tells ops why it was refused and that Retry filing applies", () => {
    const source = readFileSync(join(__dirname, "router.ts"), "utf8");
    const listAll = source.slice(source.indexOf("listAll: adminProcedure"), source.indexOf("get: adminProcedure"));
    expect(listAll).toContain("providerErrorDetail: registration.providerErrorDetail ?? null");
    expect(listAll).toContain("canRetryFiling: opsCanRetryFiling(registration)");
    const page = readFileSync(join(__dirname, "..", "..", "client", "src", "pages", "admin", "LlcOpsPage.tsx"), "utf8");
    expect(page).toContain("trpc.llcOps.retryFiling.useMutation");
    expect(page).toContain("order.canRetryFiling ?");
    expect(page).toContain("Provider refused: {order.providerErrorDetail}");
  });
});

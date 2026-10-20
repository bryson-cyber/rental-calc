/**
 * Whop retail-payment rail (ported from Her First Order's
 * server/llc/retail-checkout.test.ts, adapted to this app's own retail
 * markup + expedited-EIN add-on and its Stripe-parity post-payment path).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRegistration: vi.fn(),
  findOwner: vi.fn(),
  updateProvider: vi.fn(),
  transition: vi.fn(),
  getPricing: vi.fn(),
  sendPaymentEmail: vi.fn(),
  fileDoola: vi.fn(),
  sendOpsAlert: vi.fn(),
  claimWhere: vi.fn(),
  industry: vi.fn(),
  env: { isProduction: true, llcAutoFileEnabled: true },
}));

vi.mock("./store", () => ({
  getLlcRegistrationById: mocks.getRegistration,
  findLlcRegistrationOwner: mocks.findOwner,
  updateLlcRegistrationProviderFields: mocks.updateProvider,
  transitionLlcStatus: mocks.transition,
}));
vi.mock("./pricing", () => ({ getStatePricing: mocks.getPricing }));
vi.mock("./clientEmails", () => ({ sendPaymentConfirmedEmail: mocks.sendPaymentEmail }));
vi.mock("./doolaSubmission", () => ({ fileDoolaRegistration: mocks.fileDoola }));
vi.mock("./doola", () => ({ deriveDoolaIndustry: mocks.industry }));
vi.mock("../ops/notify", () => ({
  sendOpsAlert: mocks.sendOpsAlert,
  submissionProblemAlert: (p: any) => ({ subject: `problem ${p.errorType}`, lines: [] }),
}));
vi.mock("../_core/env", () => ({
  ENV: {
    get isProduction() { return mocks.env.isProduction; },
    get llcAutoFileEnabled() { return mocks.env.llcAutoFileEnabled; },
  },
}));
vi.mock("../db", () => ({
  getDb: vi.fn(async () => ({
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: mocks.claimWhere })) })),
  })),
}));

import {
  LLC_CHECKOUT_METADATA_VERSION,
  LLC_QUOTE_VERSION,
  alertWhopFallbackOnce,
  buildLlcQuoteHash,
  createWhopLlcCheckout,
  getWhopRetailConfig,
  processLlcWhopPayment,
  readLlcPaymentMetadata,
  resetWhopFallbackAlertForTests,
  safeCheckoutOrigin,
} from "./whopRetailCheckout";

const ENV_OK = {
  WHOP_API_KEY: "apik_test_key_value",
  WHOP_COMPANY_ID: "biz_rentalcalc123",
  WHOP_WEBHOOK_SECRET: "ws_dGVzdA",
} as NodeJS.ProcessEnv;

function registration(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    userId: 7,
    isTest: false,
    provider: "doola",
    status: "payment_required",
    retailPaidAt: null,
    doolaCompanyId: null,
    formationState: "TX",
    legalName: "Northstar Rentals",
    entitySuffix: "LLC",
    expediteEin: false,
    retailPriceCents: 45_000,
    checkoutSessionId: null,
    checkoutUrl: null,
    checkoutTotal: null,
    checkoutCurrency: null,
    retailWhopPlanId: null,
    retailWhopPaymentId: null,
    checkoutQuoteHash: null,
    checkoutExpiresAt: null,
    ...overrides,
  } as any;
}
const bundle = (row = registration()) => ({ registration: row, founders: [] }) as any;

function quoteHash(amountCents = 45_000, expediteEin = false) {
  return buildLlcQuoteHash({
    registrationId: 42,
    state: "TX",
    amountCents,
    currency: "USD",
    quoteVersion: LLC_QUOTE_VERSION,
    expediteEin,
  });
}

function paidPayment(overrides: Record<string, unknown> = {}, metadata: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      id: "pay_llc42",
      status: "paid",
      substatus: "succeeded",
      total: 450,
      currency: "usd",
      plan_id: "plan_llc42",
      metadata: {
        rc_metadata_version: LLC_CHECKOUT_METADATA_VERSION,
        rc_checkout_kind: "llc_filing",
        rc_llc_registration_id: "42",
        rc_llc_quote_hash: quoteHash(),
        rc_llc_quote_version: LLC_QUOTE_VERSION,
        ...metadata,
      },
      ...overrides,
    }),
    { status: 200 },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(ENV_OK)) vi.stubEnv(key, value as string);
  vi.stubEnv("LLC_TEST_MODE", "");
  vi.stubEnv("LLC_PAYMENT_RAIL", "");
  mocks.env.isProduction = true;
  mocks.env.llcAutoFileEnabled = true;
  mocks.getRegistration.mockResolvedValue(bundle());
  mocks.findOwner.mockResolvedValue({ userId: 7 });
  mocks.getPricing.mockResolvedValue({
    state: "TX",
    retailPriceCents: 40_000,
    stateFeeCents: 30_000,
    expediteEinPriceCents: 5_000,
    paymentLinkUrl: null,
    active: true,
  });
  mocks.updateProvider.mockResolvedValue(undefined);
  mocks.transition.mockResolvedValue({ changed: true });
  mocks.claimWhere.mockResolvedValue([{ affectedRows: 1 }]);
  mocks.sendPaymentEmail.mockResolvedValue("sent");
  mocks.sendOpsAlert.mockResolvedValue(true);
  mocks.fileDoola.mockResolvedValue({ outcome: "filed", doolaCompanyId: "co_1" });
  mocks.industry.mockReturnValue("Real Estate");
  resetWhopFallbackAlertForTests();
});

describe("Whop rail config + fallback", () => {
  it("is active only when every required env var is present", () => {
    expect(getWhopRetailConfig(ENV_OK).ok).toBe(true);
    const missing = getWhopRetailConfig({ WHOP_API_KEY: "apik_x" } as NodeJS.ProcessEnv);
    expect(missing).toMatchObject({ ok: false, reason: "missing_env" });
    expect((missing as any).missing).toEqual(["WHOP_COMPANY_ID", "WHOP_WEBHOOK_SECRET"]);
    expect(getWhopRetailConfig({ ...ENV_OK, WHOP_COMPANY_ID: "not-a-biz" }).ok).toBe(false);
  });

  it("honors the Stripe kill switch and keeps test mode off the live Whop rail", () => {
    expect(getWhopRetailConfig({ ...ENV_OK, LLC_PAYMENT_RAIL: "stripe" })).toMatchObject({ ok: false, reason: "forced_stripe" });
    expect(getWhopRetailConfig({ ...ENV_OK, LLC_TEST_MODE: "true" })).toMatchObject({ ok: false, reason: "test_mode" });
  });

  it("alerts ops once per process in production, naming env vars but never values", async () => {
    const result = getWhopRetailConfig({ WHOP_API_KEY: "apik_secret_value" } as NodeJS.ProcessEnv);
    await alertWhopFallbackOnce(result);
    await alertWhopFallbackOnce(result);
    expect(mocks.sendOpsAlert).toHaveBeenCalledTimes(1);
    const text = JSON.stringify(mocks.sendOpsAlert.mock.calls[0][0]);
    expect(text).toContain("WHOP_COMPANY_ID");
    expect(text).not.toContain("apik_secret_value");
  });

  it("does not alert outside production", async () => {
    mocks.env.isProduction = false;
    await alertWhopFallbackOnce(getWhopRetailConfig({} as NodeJS.ProcessEnv));
    expect(mocks.sendOpsAlert).not.toHaveBeenCalled();
  });
});

describe("Whop checkout creation", () => {
  it("builds a stable quote hash and rejects foreign metadata", () => {
    expect(quoteHash()).toMatch(/^[a-f0-9]{64}$/);
    expect(quoteHash()).toBe(quoteHash());
    expect(quoteHash(45_001)).not.toBe(quoteHash());
    expect(quoteHash(45_000, true)).not.toBe(quoteHash());
    // HFO's own metadata never matches this app's reader (shared Whop company safe).
    expect(readLlcPaymentMetadata({ metadata: { hfo_metadata_version: "hfo_llc_checkout_v1" } })).toBeNull();
  });

  it("creates an exact-price hidden one-time plan on this app's company and persists the frozen quote", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.whop.com/api/v1/checkout_configurations");
      const body = JSON.parse(String(init?.body));
      const headers = new Headers(init?.headers);
      expect(body.account_id).toBe("biz_rentalcalc123");
      expect(body.plan.initial_price).toBe(450);
      expect(body.plan.plan_type).toBe("one_time");
      expect(body.plan.product.visibility).toBe("hidden");
      expect(JSON.stringify(body).toLowerCase()).not.toContain("doola");
      expect(body.metadata.rc_checkout_kind).toBe("llc_filing");
      expect(body.metadata.rc_llc_quote_hash).toBe(quoteHash());
      expect(body.redirect_url).toBe("https://coachinayahturnkeytool.com/llc/status/42?payment=success");
      expect(headers.get("Idempotency-Key")).toMatch(/^rc-llc-checkout-42-[a-f0-9]{32}-\d+$/);
      expect(headers.get("Authorization")).toBe("Bearer apik_test_key_value");
      return new Response(
        JSON.stringify({ id: "ch_llc42", purchase_url: "/checkout/ch_llc42", plan: { id: "plan_llc42" } }),
        { status: 200 },
      );
    });
    const result = await createWhopLlcCheckout({
      userId: 7,
      registrationId: 42,
      origin: "https://coachinayahturnkeytool.com",
      fetchImpl: fetchImpl as any,
      now: new Date("2026-10-18T12:00:00Z"),
      env: ENV_OK,
    });
    expect(result).toMatchObject({
      checkoutUrl: "https://whop.com/checkout/ch_llc42",
      sessionId: "ch_llc42",
      planId: "plan_llc42",
      amountCents: 45_000,
      existing: false,
    });
    expect(mocks.updateProvider).toHaveBeenCalledWith(7, 42, expect.objectContaining({
      checkoutSessionId: "ch_llc42",
      retailWhopPlanId: "plan_llc42",
      checkoutQuoteHash: quoteHash(),
      checkoutTotal: 45_000,
    }));
  });

  it("prices an unsnapshotted order at this app's retail plus the expedited-EIN add-on", async () => {
    mocks.getRegistration.mockResolvedValue(bundle(registration({ retailPriceCents: null, expediteEin: true })));
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.plan.initial_price).toBe(450); // 400 retail + 50 expedite
      expect(body.plan.product.description).toContain("expedited EIN");
      return new Response(JSON.stringify({ id: "ch_x", purchase_url: "https://whop.com/checkout/ch_x", plan_id: "plan_x" }), { status: 200 });
    });
    await createWhopLlcCheckout({ userId: 7, registrationId: 42, origin: "", fetchImpl: fetchImpl as any, env: ENV_OK });
    expect(mocks.updateProvider).toHaveBeenCalledWith(7, 42, expect.objectContaining({
      retailPriceCents: 45_000,
      checkoutQuoteHash: quoteHash(45_000, true),
    }));
  });

  it("reuses a live checkout for the same quote without calling Whop", async () => {
    mocks.getRegistration.mockResolvedValue(bundle(registration({
      checkoutSessionId: "ch_live",
      checkoutUrl: "https://whop.com/checkout/ch_live",
      retailWhopPlanId: "plan_llc42",
      checkoutQuoteHash: quoteHash(),
      checkoutExpiresAt: new Date("2026-10-20T00:00:00Z"),
    })));
    const fetchImpl = vi.fn();
    const result = await createWhopLlcCheckout({
      userId: 7, registrationId: 42, origin: "", fetchImpl: fetchImpl as any,
      now: new Date("2026-10-18T00:00:00Z"), env: ENV_OK,
    });
    expect(result).toMatchObject({ existing: true, checkoutUrl: "https://whop.com/checkout/ch_live" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("forceNew mints a fresh configuration on the order's existing plan", async () => {
    mocks.getRegistration.mockResolvedValue(bundle(registration({
      checkoutSessionId: "ch_live",
      checkoutUrl: "https://whop.com/checkout/ch_live",
      retailWhopPlanId: "plan_llc42",
      checkoutQuoteHash: quoteHash(),
      checkoutExpiresAt: new Date("2026-10-20T00:00:00Z"),
    })));
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.plan_id).toBe("plan_llc42");
      expect(body.plan).toBeUndefined();
      return new Response(JSON.stringify({ id: "ch_new", purchase_url: "https://whop.com/checkout/ch_new" }), { status: 200 });
    });
    const result = await createWhopLlcCheckout({
      userId: 7, registrationId: 42, origin: "", forceNew: true, fetchImpl: fetchImpl as any,
      now: new Date("2026-10-18T00:00:00Z"), env: ENV_OK,
    });
    expect(result).toMatchObject({ existing: false, sessionId: "ch_new", planId: "plan_llc42" });
  });

  it("refuses paid, test, and non-payment_required orders before calling Whop", async () => {
    const fetchImpl = vi.fn();
    for (const overrides of [{ retailPaidAt: new Date() }, { isTest: true }, { status: "processing" }]) {
      mocks.getRegistration.mockResolvedValueOnce(bundle(registration(overrides)));
      await expect(createWhopLlcCheckout({ userId: 7, registrationId: 42, origin: "", fetchImpl: fetchImpl as any, env: ENV_OK }))
        .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("only returns to allow-listed origins", () => {
    expect(safeCheckoutOrigin("https://coachinayahturnkeytool.com")).toBe("https://coachinayahturnkeytool.com");
    expect(safeCheckoutOrigin("https://rentalcalc-abc.manus.space")).toBe("https://rentalcalc-abc.manus.space");
    expect(safeCheckoutOrigin("https://evil.example.com")).toBe("https://coachinayahturnkeytool.com");
  });
});

describe("Whop payment confirmation", () => {
  const armed = () =>
    mocks.getRegistration.mockResolvedValue(bundle(registration({
      retailWhopPlanId: "plan_llc42",
      checkoutQuoteHash: quoteHash(),
      checkoutSessionId: "ch_llc42",
    })));

  it("claims one exact paid payment, emails once, alerts ops, and files through the Stripe-parity path", async () => {
    armed();
    const fetchImpl = vi.fn(async (url: unknown) => {
      expect(String(url)).toBe("https://api.whop.com/api/v1/payments/pay_llc42");
      return paidPayment();
    });
    await expect(processLlcWhopPayment({ paymentId: "pay_llc42", expectedUserId: 7, fetchImpl: fetchImpl as any }))
      .resolves.toMatchObject({ outcome: "filed", registrationId: 42, paymentId: "pay_llc42" });
    expect(mocks.claimWhere).toHaveBeenCalledTimes(1);
    expect(mocks.sendPaymentEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendOpsAlert).toHaveBeenCalledTimes(1);
    expect(mocks.fileDoola).toHaveBeenCalledWith({ userId: 7, registrationId: 42 });
  });

  it("holds filing when auto-file is disabled (ops Mark paid files it, like Stripe)", async () => {
    armed();
    mocks.env.llcAutoFileEnabled = false;
    const result = await processLlcWhopPayment({ paymentId: "pay_llc42", fetchImpl: (async () => paidPayment()) as any });
    expect(result?.outcome).toBe("filing_held");
    expect(mocks.claimWhere).toHaveBeenCalledTimes(1);
    expect(mocks.fileDoola).not.toHaveBeenCalled();
  });

  it("routes an unmappable industry to action_required instead of filing", async () => {
    armed();
    mocks.industry.mockReturnValue(undefined);
    const result = await processLlcWhopPayment({ paymentId: "pay_llc42", fetchImpl: (async () => paidPayment()) as any });
    expect(result?.outcome).toBe("action_required");
    expect(mocks.transition).toHaveBeenCalledWith(expect.objectContaining({ toStatus: "action_required" }));
    expect(mocks.fileDoola).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong amount", { total: 449.99 }, {}],
    ["wrong plan", { plan_id: "plan_other" }, {}],
    ["wrong currency", { currency: "eur" }, {}],
    ["stale quote", {}, { rc_llc_quote_hash: "a".repeat(64) }],
  ])("rejects a %s before claiming, notifying, or filing", async (_label, overrides, metadata) => {
    armed();
    await expect(processLlcWhopPayment({ paymentId: "pay_llc42", fetchImpl: (async () => paidPayment(overrides, metadata)) as any }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.claimWhere).not.toHaveBeenCalled();
    expect(mocks.sendPaymentEmail).not.toHaveBeenCalled();
    expect(mocks.fileDoola).not.toHaveBeenCalled();
  });

  it("compares the amount before sales tax (HFO #327): a taxed payment of the right price is accepted", async () => {
    armed();
    // $450 plan + $37.13 sales tax: total 487.13, tax_amount 37.13 -> exactly the $450.00 quote.
    const scalar = await processLlcWhopPayment({ paymentId: "pay_llc42", fetchImpl: (async () => paidPayment({ total: 487.13, tax_amount: 37.13 })) as any });
    expect(scalar?.outcome).toBe("filed");
    expect(mocks.claimWhere).toHaveBeenCalledTimes(1);
    // The 2026 money shape ({ amount, currency }) reads the same way, currency included.
    vi.clearAllMocks();
    armed();
    mocks.claimWhere.mockResolvedValue([{ affectedRows: 1 }]);
    mocks.fileDoola.mockResolvedValue({ outcome: "filed", doolaCompanyId: "co_1" });
    mocks.industry.mockReturnValue("Real Estate");
    const shaped = await processLlcWhopPayment({
      paymentId: "pay_llc42",
      fetchImpl: (async () => paidPayment({ total: { amount: "487.13", currency: "usd" }, tax_amount: { amount: "37.13", currency: "usd" }, currency: undefined })) as any,
    });
    expect(shaped?.outcome).toBe("filed");
  });

  it.each([
    ["a short taxed payment (right total, too little before tax)", { total: 450, tax_amount: 37.13 }],
    ["an unreadable tax amount", { total: 487.13, tax_amount: "n/a" }],
    ["an unreadable total", { total: "n/a" }],
  ])("refuses %s before claiming", async (_label, overrides) => {
    armed();
    await expect(processLlcWhopPayment({ paymentId: "pay_llc42", fetchImpl: (async () => paidPayment(overrides)) as any }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.claimWhere).not.toHaveBeenCalled();
    expect(mocks.fileDoola).not.toHaveBeenCalled();
  });

  it("ignores unpaid and foreign payments", async () => {
    armed();
    await expect(processLlcWhopPayment({ paymentId: "pay_llc42", fetchImpl: (async () => paidPayment({ status: "open" })) as any })).resolves.toBeNull();
    await expect(processLlcWhopPayment({ paymentId: "pay_llc42", fetchImpl: (async () => paidPayment({ metadata: { hfo_checkout_kind: "llc_filing" } })) as any })).resolves.toBeNull();
    expect(mocks.claimWhere).not.toHaveBeenCalled();
  });

  it("refuses a payment for another user's order", async () => {
    armed();
    await expect(processLlcWhopPayment({ paymentId: "pay_llc42", expectedUserId: 99, fetchImpl: (async () => paidPayment()) as any }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("is idempotent per payment id: a replay never re-emails, and only resumes an unstarted filing", async () => {
    mocks.getRegistration.mockResolvedValue(bundle(registration({
      retailWhopPlanId: "plan_llc42",
      retailWhopPaymentId: "pay_llc42",
      retailPaidAt: new Date("2026-10-18T00:00:00Z"),
    })));
    await processLlcWhopPayment({ paymentId: "pay_llc42", fetchImpl: (async () => paidPayment()) as any });
    expect(mocks.sendPaymentEmail).not.toHaveBeenCalled();
    expect(mocks.claimWhere).not.toHaveBeenCalled();
    expect(mocks.fileDoola).toHaveBeenCalledTimes(1);

    mocks.fileDoola.mockClear();
    mocks.getRegistration.mockResolvedValue(bundle(registration({
      status: "failed",
      retailWhopPlanId: "plan_llc42",
      retailWhopPaymentId: "pay_llc42",
      retailPaidAt: new Date("2026-10-18T00:00:00Z"),
    })));
    const replay = await processLlcWhopPayment({ paymentId: "pay_llc42", fetchImpl: (async () => paidPayment()) as any });
    expect(replay?.outcome).toBe("already_paid");
    expect(mocks.fileDoola).not.toHaveBeenCalled();
  });

  it("rejects a second, different payment and an order already paid on another rail", async () => {
    mocks.getRegistration.mockResolvedValue(bundle(registration({ retailWhopPlanId: "plan_llc42", retailWhopPaymentId: "pay_first" })));
    await expect(processLlcWhopPayment({ paymentId: "pay_llc42", fetchImpl: (async () => paidPayment()) as any }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    mocks.getRegistration.mockResolvedValue(bundle(registration({ retailWhopPlanId: "plan_llc42", checkoutQuoteHash: quoteHash(), retailPaidAt: new Date() })));
    await expect(processLlcWhopPayment({ paymentId: "pay_llc42", fetchImpl: (async () => paidPayment()) as any }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.claimWhere).not.toHaveBeenCalled();
  });

  it("treats a lost claim race for the same payment as already paid (no double email)", async () => {
    armed();
    mocks.claimWhere.mockResolvedValue([{ affectedRows: 0 }]);
    mocks.getRegistration
      .mockResolvedValueOnce(bundle(registration({ retailWhopPlanId: "plan_llc42", checkoutQuoteHash: quoteHash() })))
      .mockResolvedValueOnce(bundle(registration({ retailWhopPaymentId: "pay_llc42" })));
    const result = await processLlcWhopPayment({ paymentId: "pay_llc42", fetchImpl: (async () => paidPayment()) as any });
    expect(result?.outcome).toBe("already_paid");
    expect(mocks.sendPaymentEmail).not.toHaveBeenCalled();
  });
});

/**
 * Rail selection: Whop when configured, Stripe fallback otherwise, and
 * in-flight Stripe sessions are never stranded.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRegistration: vi.fn(),
  stripeCreate: vi.fn(),
  stripeState: vi.fn(),
  stripeExpire: vi.fn(),
  whopCreate: vi.fn(),
  whopConfig: vi.fn(),
  alertOnce: vi.fn(),
  dbWhere: vi.fn(),
}));

vi.mock("./store", () => ({ getLlcRegistrationById: mocks.getRegistration }));
vi.mock("./stripeCheckout", () => ({
  createLlcCheckoutSession: mocks.stripeCreate,
  getStripeCheckoutSessionState: mocks.stripeState,
  expireStripeCheckoutSession: mocks.stripeExpire,
  isStripeCheckoutSessionId: (id: string | null) => typeof id === "string" && id.startsWith("cs_"),
}));
vi.mock("./whopRetailCheckout", () => ({
  createWhopLlcCheckout: mocks.whopCreate,
  getWhopRetailConfig: mocks.whopConfig,
  alertWhopFallbackOnce: mocks.alertOnce,
}));
vi.mock("../db", () => ({
  getDb: vi.fn(async () => ({ update: vi.fn(() => ({ set: vi.fn(() => ({ where: mocks.dbWhere })) })) })),
}));

import { createRetailCheckout } from "./retailCheckoutRail";

const params = { userId: 7, userEmail: "a@b.co", userName: "A", registrationId: 42, origin: "https://coachinayahturnkeytool.com" };
const reg = (overrides: Record<string, unknown> = {}) => ({
  registration: { id: 42, retailPaidAt: null, checkoutSessionId: null, checkoutUrl: null, ...overrides },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.whopConfig.mockReturnValue({ ok: true, config: {} });
  mocks.getRegistration.mockResolvedValue(reg());
  mocks.stripeCreate.mockResolvedValue({ checkoutUrl: "https://checkout.stripe.com/c/cs_new", existing: false });
  mocks.whopCreate.mockResolvedValue({ checkoutUrl: "https://whop.com/checkout/ch_1" });
  mocks.stripeExpire.mockResolvedValue(true);
  mocks.alertOnce.mockResolvedValue(undefined);
});

describe("createRetailCheckout", () => {
  it("uses Whop when the Whop config is complete", async () => {
    await expect(createRetailCheckout(params)).resolves.toEqual({ checkoutUrl: "https://whop.com/checkout/ch_1", rail: "whop" });
    expect(mocks.stripeCreate).not.toHaveBeenCalled();
  });

  it("falls back to the existing Stripe checkout (and the once-alert) when Whop config is missing", async () => {
    mocks.whopConfig.mockReturnValue({ ok: false, missing: ["WHOP_COMPANY_ID"], reason: "missing_env" });
    await expect(createRetailCheckout(params)).resolves.toMatchObject({ rail: "stripe" });
    expect(mocks.alertOnce).toHaveBeenCalledTimes(1);
    expect(mocks.whopCreate).not.toHaveBeenCalled();
  });

  it("keeps an open in-flight Stripe session for the client", async () => {
    mocks.getRegistration.mockResolvedValue(reg({ checkoutSessionId: "cs_live", checkoutUrl: "https://checkout.stripe.com/c/cs_live" }));
    mocks.stripeState.mockResolvedValue("open");
    await expect(createRetailCheckout(params)).resolves.toEqual({ checkoutUrl: "https://checkout.stripe.com/c/cs_live", rail: "stripe" });
    expect(mocks.whopCreate).not.toHaveBeenCalled();
  });

  it("moves an expired Stripe session to Whop", async () => {
    mocks.getRegistration.mockResolvedValue(reg({ checkoutSessionId: "cs_old", checkoutUrl: "https://checkout.stripe.com/c/cs_old" }));
    mocks.stripeState.mockResolvedValue("expired");
    await expect(createRetailCheckout(params)).resolves.toMatchObject({ rail: "whop" });
  });

  it("refuses to re-mint while a completed Stripe payment awaits its webhook", async () => {
    mocks.getRegistration.mockResolvedValue(reg({ checkoutSessionId: "cs_paid", checkoutUrl: "x" }));
    mocks.stripeState.mockResolvedValue("complete");
    await expect(createRetailCheckout({ ...params, forceNew: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.whopCreate).not.toHaveBeenCalled();
  });

  it("admin forceNew expires an open Stripe session, then mints a fresh Whop checkout", async () => {
    mocks.getRegistration.mockResolvedValue(reg({ checkoutSessionId: "cs_live", checkoutUrl: "https://checkout.stripe.com/c/cs_live" }));
    mocks.stripeState.mockResolvedValue("open");
    await expect(createRetailCheckout({ ...params, forceNew: true })).resolves.toMatchObject({ rail: "whop" });
    expect(mocks.stripeExpire).toHaveBeenCalledWith("cs_live");
    expect(mocks.whopCreate).toHaveBeenCalledWith(expect.objectContaining({ forceNew: true }));
  });

  it("admin forceNew on the Stripe fallback clears the old session first (pre-existing behavior)", async () => {
    mocks.whopConfig.mockReturnValue({ ok: false, missing: ["WHOP_API_KEY"], reason: "missing_env" });
    mocks.getRegistration.mockResolvedValue(reg({ checkoutSessionId: "cs_live", checkoutUrl: "u" }));
    await createRetailCheckout({ ...params, forceNew: true });
    expect(mocks.dbWhere).toHaveBeenCalledTimes(1);
    expect(mocks.stripeCreate).toHaveBeenCalledTimes(1);
  });
});

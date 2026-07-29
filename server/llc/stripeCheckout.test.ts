/**
 * Tests for Stripe Checkout integration:
 * - createLlcCheckoutSession (session creation)
 * - registerStripeWebhook (webhook route handler)
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { makePersistedBundle } from "./test-fixtures";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const store = vi.hoisted(() => ({
  findLlcRegistrationOwner: vi.fn(),
  getLlcRegistrationById: vi.fn(),
  updateLlcRegistrationProviderFields: vi.fn(),
}));

const pricing = vi.hoisted(() => ({
  getStatePricing: vi.fn(),
}));

const doolaSubmission = vi.hoisted(() => ({
  fileDoolaRegistration: vi.fn(async () => ({ outcome: "filed" })),
}));

const clientEmails = vi.hoisted(() => ({
  sendPaymentConfirmedEmail: vi.fn(async () => "sent"),
}));

const notify = vi.hoisted(() => ({
  sendOpsAlert: vi.fn(async () => true),
}));

const database = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./store", () => ({
  findLlcRegistrationOwner: store.findLlcRegistrationOwner,
  getLlcRegistrationById: store.getLlcRegistrationById,
  updateLlcRegistrationProviderFields: store.updateLlcRegistrationProviderFields,
}));

vi.mock("./pricing", () => ({
  getStatePricing: pricing.getStatePricing,
}));

vi.mock("./doolaSubmission", () => ({
  fileDoolaRegistration: doolaSubmission.fileDoolaRegistration,
}));

vi.mock("./clientEmails", () => ({
  sendPaymentConfirmedEmail: clientEmails.sendPaymentConfirmedEmail,
}));

vi.mock("../ops/notify", () => ({
  sendOpsAlert: notify.sendOpsAlert,
}));

vi.mock("../db", () => ({
  getDb: database.getDb,
}));

// Mock Stripe SDK
const mockCheckoutSessionsCreate = vi.fn();
const mockWebhooksConstructEvent = vi.fn();

vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      checkout = { sessions: { create: mockCheckoutSessionsCreate } };
      webhooks = { constructEvent: mockWebhooksConstructEvent };
    },
  };
});

import {
  createLlcCheckoutSession,
  registerStripeWebhook,
} from "./stripeCheckout";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeFakeDb(selectRows: unknown[], insertFails = false) {
  return {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => selectRows,
        }),
      }),
    })),
    insert: vi.fn(() => ({
      values: async () => {
        if (insertFails) throw new Error("duplicate");
        return [{ insertId: 1 }];
      },
    })),
  };
}

function getHandler() {
  let handler: ((req: Request, res: Response) => void | Promise<void>) | undefined;
  registerStripeWebhook({
    post: (_path: string, _middleware: unknown, fn: never) => {
      handler = fn;
    },
  } as never);
  if (!handler) throw new Error("route not registered");
  return handler;
}

function makeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res as typeof res & Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_fake");
  vi.stubEnv("LLC_AUTO_FILE_ENABLED", "true");
  vi.stubEnv("VITE_APP_URL", "https://app.example.com");
});

// ---------------------------------------------------------------------------
// createLlcCheckoutSession tests
// ---------------------------------------------------------------------------
describe("createLlcCheckoutSession", () => {
  it("creates a checkout session for a payment_required registration", async () => {
    const bundle = makePersistedBundle("payment_required");
    bundle.registration.retailPriceCents = 29900;
    store.getLlcRegistrationById.mockResolvedValue(bundle);
    store.updateLlcRegistrationProviderFields.mockResolvedValue(bundle);

    mockCheckoutSessionsCreate.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/pay/cs_test_123",
      amount_total: 29900,
      currency: "usd",
    });

    const result = await createLlcCheckoutSession({
      userId: 7,
      userEmail: "owner@example.com",
      userName: "Owner",
      registrationId: 41,
      origin: "https://app.example.com",
    });

    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/pay/cs_test_123");
    expect(result.existing).toBe(false);
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockCheckoutSessionsCreate.mock.calls[0][0];
    expect(createArgs.mode).toBe("payment");
    expect(createArgs.line_items[0].price_data.unit_amount).toBe(29900);
    expect(createArgs.metadata.registrationId).toBe("41");
    expect(createArgs.customer_email).toBe("owner@example.com");
    expect(createArgs.success_url).toContain("/llc/status/41?payment=success");
    expect(createArgs.cancel_url).toContain("/llc/status/41?payment=cancelled");

    // Verify the session was persisted
    expect(store.updateLlcRegistrationProviderFields).toHaveBeenCalledWith(
      7,
      41,
      expect.objectContaining({
        checkoutSessionId: "cs_test_123",
        checkoutUrl: "https://checkout.stripe.com/pay/cs_test_123",
        checkoutTotal: 29900,
        checkoutCurrency: "usd",
      }),
    );
  });

  it("returns existing checkout URL if session already exists", async () => {
    const bundle = makePersistedBundle("payment_required");
    bundle.registration.checkoutSessionId = "cs_existing";
    bundle.registration.checkoutUrl = "https://checkout.stripe.com/pay/cs_existing";
    store.getLlcRegistrationById.mockResolvedValue(bundle);

    const result = await createLlcCheckoutSession({
      userId: 7,
      userEmail: "owner@example.com",
      userName: "Owner",
      registrationId: 41,
      origin: "https://app.example.com",
    });

    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/pay/cs_existing");
    expect(result.existing).toBe(true);
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("throws if registration is not in payment_required status", async () => {
    const bundle = makePersistedBundle("draft");
    store.getLlcRegistrationById.mockResolvedValue(bundle);

    await expect(
      createLlcCheckoutSession({
        userId: 7,
        userEmail: "owner@example.com",
        userName: "Owner",
        registrationId: 41,
        origin: "https://app.example.com",
      }),
    ).rejects.toThrow("not payment_required");
  });

  it("throws if registration is already paid", async () => {
    const bundle = makePersistedBundle("payment_required");
    bundle.registration.retailPaidAt = new Date();
    store.getLlcRegistrationById.mockResolvedValue(bundle);

    await expect(
      createLlcCheckoutSession({
        userId: 7,
        userEmail: "owner@example.com",
        userName: "Owner",
        registrationId: 41,
        origin: "https://app.example.com",
      }),
    ).rejects.toThrow("already paid");
  });

  it("falls back to state pricing when retailPriceCents is null", async () => {
    const bundle = makePersistedBundle("payment_required");
    bundle.registration.retailPriceCents = null;
    store.getLlcRegistrationById.mockResolvedValue(bundle);
    store.updateLlcRegistrationProviderFields.mockResolvedValue(bundle);
    pricing.getStatePricing.mockResolvedValue({
      state: "WY",
      retailPriceCents: 19900,
      stateFeeCents: 10000,
      expediteEinPriceCents: 5000,
      paymentLinkUrl: null,
      active: true,
    });

    mockCheckoutSessionsCreate.mockResolvedValue({
      id: "cs_test_456",
      url: "https://checkout.stripe.com/pay/cs_test_456",
      amount_total: 19900,
      currency: "usd",
    });

    const result = await createLlcCheckoutSession({
      userId: 7,
      userEmail: null,
      userName: null,
      registrationId: 41,
      origin: "https://app.example.com",
    });

    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/pay/cs_test_456");
    // Should use state pricing since retailPriceCents was null
    const createArgs = mockCheckoutSessionsCreate.mock.calls[0][0];
    expect(createArgs.line_items[0].price_data.unit_amount).toBe(19900);
  });

  it("includes expediteEin add-on when selected", async () => {
    const bundle = makePersistedBundle("payment_required");
    bundle.registration.retailPriceCents = null;
    bundle.registration.expediteEin = true;
    store.getLlcRegistrationById.mockResolvedValue(bundle);
    store.updateLlcRegistrationProviderFields.mockResolvedValue(bundle);
    pricing.getStatePricing.mockResolvedValue({
      state: "WY",
      retailPriceCents: 19900,
      stateFeeCents: 10000,
      expediteEinPriceCents: 5000,
      paymentLinkUrl: null,
      active: true,
    });

    mockCheckoutSessionsCreate.mockResolvedValue({
      id: "cs_test_789",
      url: "https://checkout.stripe.com/pay/cs_test_789",
      amount_total: 24900,
      currency: "usd",
    });

    await createLlcCheckoutSession({
      userId: 7,
      userEmail: null,
      userName: null,
      registrationId: 41,
      origin: "https://app.example.com",
    });

    const createArgs = mockCheckoutSessionsCreate.mock.calls[0][0];
    expect(createArgs.line_items[0].price_data.unit_amount).toBe(24900); // 19900 + 5000
  });

  it("throws when state has no published retail price", async () => {
    const bundle = makePersistedBundle("payment_required");
    bundle.registration.retailPriceCents = null;
    store.getLlcRegistrationById.mockResolvedValue(bundle);
    pricing.getStatePricing.mockResolvedValue({
      state: "WY",
      retailPriceCents: null,
      stateFeeCents: 10000,
      expediteEinPriceCents: null,
      paymentLinkUrl: null,
      active: true,
    });

    await expect(
      createLlcCheckoutSession({
        userId: 7,
        userEmail: null,
        userName: null,
        registrationId: 41,
        origin: "https://app.example.com",
      }),
    ).rejects.toThrow("No published retail price");
  });
});

// ---------------------------------------------------------------------------
// Stripe webhook route tests
// ---------------------------------------------------------------------------
describe("Stripe webhook route", () => {
  it("400s when stripe-signature header is missing", async () => {
    const res = makeRes();
    await getHandler()(
      { body: Buffer.from("{}"), headers: {} } as never,
      res,
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toContain("stripe-signature");
  });

  it("503s when webhook secret is not configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    // Must re-import to pick up the env change in the lazy Stripe singleton
    // The route handler reads ENV.stripeWebhookSecret at request time (getter),
    // so stubbing before the call is sufficient.
    const res = makeRes();
    await getHandler()(
      { body: Buffer.from("{}"), headers: { "stripe-signature": "sig" } } as never,
      res,
    );
    expect(res.statusCode).toBe(503);
    expect((res.body as { error: string }).error).toContain("not configured");
  });

  it("400s when signature verification fails", async () => {
    mockWebhooksConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const res = makeRes();
    await getHandler()(
      { body: Buffer.from("{}"), headers: { "stripe-signature": "bad_sig" } } as never,
      res,
    );
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toContain("Invalid signature");
  });

  it("returns verified:true for test events", async () => {
    mockWebhooksConstructEvent.mockReturnValue({
      id: "evt_test_123",
      type: "checkout.session.completed",
      data: { object: {} },
    });
    const res = makeRes();
    await getHandler()(
      { body: Buffer.from("{}"), headers: { "stripe-signature": "valid" } } as never,
      res,
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as { verified: boolean }).verified).toBe(true);
  });

  it("deduplicates by event ID — replayed delivery returns duplicate:true", async () => {
    mockWebhooksConstructEvent.mockReturnValue({
      id: "evt_real_123",
      type: "checkout.session.completed",
      data: {
        object: { id: "cs_test_123", metadata: { registrationId: "41" } },
      },
    });
    // Simulate duplicate insert failure
    database.getDb.mockResolvedValue(makeFakeDb([], true));

    const res = makeRes();
    await getHandler()(
      { body: Buffer.from("{}"), headers: { "stripe-signature": "valid" } } as never,
      res,
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as { duplicate: boolean }).duplicate).toBe(true);
  });

  it("acks and processes checkout.session.completed — marks paid and auto-files", async () => {
    mockWebhooksConstructEvent.mockReturnValue({
      id: "evt_real_456",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_456",
          metadata: { registrationId: "41" },
          client_reference_id: "41",
          amount_total: 29900,
          currency: "usd",
        },
      },
    });

    // Event claim succeeds
    database.getDb.mockResolvedValue(makeFakeDb([], false));

    // findRegistrationByCheckoutSessionId returns a registration
    const fakeDb = makeFakeDb([
      {
        id: 41,
        userId: 7,
        status: "payment_required",
        legalName: "Test Corp",
        entitySuffix: "LLC",
        formationState: "WY",
        retailPaidAt: null,
      },
    ]);
    // First call is for event claim, second is for finding registration
    database.getDb
      .mockResolvedValueOnce(makeFakeDb([], false)) // claim
      .mockResolvedValueOnce(fakeDb); // find registration

    store.updateLlcRegistrationProviderFields.mockResolvedValue(null);

    const res = makeRes();
    await getHandler()(
      { body: Buffer.from("{}"), headers: { "stripe-signature": "valid" } } as never,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect((res.body as { received: boolean }).received).toBe(true);

    // Give async processing a tick
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify markPaid was called
    expect(store.updateLlcRegistrationProviderFields).toHaveBeenCalledWith(
      7,
      41,
      expect.objectContaining({ retailPaidAt: expect.any(Date) }),
    );

    // Verify payment confirmation email was sent
    expect(clientEmails.sendPaymentConfirmedEmail).toHaveBeenCalledWith({
      userId: 7,
      registrationId: 41,
    });

    // Verify auto-file was triggered
    expect(doolaSubmission.fileDoolaRegistration).toHaveBeenCalledWith({
      userId: 7,
      registrationId: 41,
    });

    // Verify ops alert was sent
    expect(notify.sendOpsAlert).toHaveBeenCalled();
  });

  it("does not auto-file when LLC_AUTO_FILE_ENABLED is false", async () => {
    vi.stubEnv("LLC_AUTO_FILE_ENABLED", "false");

    mockWebhooksConstructEvent.mockReturnValue({
      id: "evt_real_789",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_789",
          metadata: { registrationId: "41" },
          client_reference_id: "41",
        },
      },
    });

    database.getDb
      .mockResolvedValueOnce(makeFakeDb([], false)) // claim
      .mockResolvedValueOnce(
        makeFakeDb([
          {
            id: 41,
            userId: 7,
            status: "payment_required",
            legalName: "Test Corp",
            entitySuffix: "LLC",
            formationState: "WY",
            retailPaidAt: null,
          },
        ]),
      );

    store.updateLlcRegistrationProviderFields.mockResolvedValue(null);

    const res = makeRes();
    await getHandler()(
      { body: Buffer.from("{}"), headers: { "stripe-signature": "valid" } } as never,
      res,
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    // markPaid still happens
    expect(store.updateLlcRegistrationProviderFields).toHaveBeenCalled();
    // But auto-file does NOT
    expect(doolaSubmission.fileDoolaRegistration).not.toHaveBeenCalled();
  });

  it("skips already-paid registrations (idempotent)", async () => {
    mockWebhooksConstructEvent.mockReturnValue({
      id: "evt_real_already",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_already",
          metadata: { registrationId: "41" },
          client_reference_id: "41",
        },
      },
    });

    database.getDb
      .mockResolvedValueOnce(makeFakeDb([], false)) // claim
      .mockResolvedValueOnce(
        makeFakeDb([
          {
            id: 41,
            userId: 7,
            status: "payment_required",
            legalName: "Test Corp",
            entitySuffix: "LLC",
            formationState: "WY",
            retailPaidAt: new Date(), // already paid
          },
        ]),
      );

    const res = makeRes();
    await getHandler()(
      { body: Buffer.from("{}"), headers: { "stripe-signature": "valid" } } as never,
      res,
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should NOT call updateProvider or file
    expect(store.updateLlcRegistrationProviderFields).not.toHaveBeenCalled();
    expect(doolaSubmission.fileDoolaRegistration).not.toHaveBeenCalled();
  });
});

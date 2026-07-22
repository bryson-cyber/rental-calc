import { beforeEach, describe, expect, it, vi } from "vitest";
import { validDraft } from "./test-fixtures";

const database = vi.hoisted(() => ({
  get: vi.fn(),
  countAttempts: vi.fn(),
  createAttempt: vi.fn(),
  finishAttempt: vi.fn(),
  transition: vi.fn(),
  updateProvider: vi.fn(),
}));

const provider = vi.hoisted(() => ({
  createAccount: vi.fn(),
  findAccount: vi.fn(),
  registerLlc: vi.fn(),
  retrieveAccount: vi.fn(),
}));

vi.mock("./store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store")>();
  return {
    isRegistrationEditable: actual.isRegistrationEditable,
    UNCERTAIN_ERROR_PREFIX: actual.UNCERTAIN_ERROR_PREFIX,
    getLlcRegistrationById: database.get,
    countSubmissionAttempts: database.countAttempts,
    createSubmissionAttempt: database.createAttempt,
    finishSubmissionAttempt: database.finishAttempt,
    transitionLlcStatus: database.transition,
    updateLlcRegistrationProviderFields: database.updateProvider,
  };
});

vi.mock("./whop", async () => {
  const actual = await vi.importActual<typeof import("./whop")>("./whop");
  return {
    ...actual,
    createWhopConnectedAccount: provider.createAccount,
    findWhopConnectedAccountByRegistrationId: provider.findAccount,
    registerWhopLlc: provider.registerLlc,
    retrieveWhopAccount: provider.retrieveAccount,
  };
});

const pricingMock = vi.hoisted(() => ({
  getStatePricing: vi.fn(),
  getInactiveStateError: vi.fn(),
}));

vi.mock("./pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./pricing")>();
  return {
    ...actual,
    getStatePricing: pricingMock.getStatePricing,
    getInactiveStateError: pricingMock.getInactiveStateError,
  };
});

import { LlcSubmissionValidationError, submitLlcRegistration } from "./submission";
import { WhopApiError } from "./whop";

type Status =
  | "draft"
  | "ready"
  | "submitting"
  | "payment_required"
  | "processing"
  | "completed"
  | "action_required"
  | "failed";

type TestBundle = ReturnType<typeof makeBundle>;

function makeBundle(status: Status = "ready") {
  const now = new Date("2026-07-21T12:00:00.000Z");
  return {
    registration: {
      id: 41,
      userId: 7,
      status,
      currentStep: 6,
      legalName: validDraft.legalName,
      entitySuffix: validDraft.entitySuffix,
      formationState: validDraft.formationState,
      businessType: validDraft.businessType,
      industryGroup: validDraft.industryGroup,
      industryType: validDraft.industryType,
      businessPhone: validDraft.businessPhone,
      website: validDraft.website,
      useRegisteredAgent: validDraft.useRegisteredAgent,
      companyAddressLine1: validDraft.companyAddress.line1,
      companyAddressLine2: validDraft.companyAddress.line2,
      companyAddressCity: validDraft.companyAddress.city,
      companyAddressState: validDraft.companyAddress.state,
      companyAddressPostalCode: validDraft.companyAddress.postalCode,
      companyAddressCountry: validDraft.companyAddress.country,
      expediteEin: validDraft.expediteEin,
      accuracyAttested: validDraft.accuracyAttested,
      whopAccountId: null as string | null,
      checkoutSessionId: null as string | null,
      checkoutUrl: null as string | null,
      checkoutTotal: null as number | null,
      checkoutCurrency: null as string | null,
      retailPriceCents: null as number | null,
      retailPaidAt: null as Date | null,
      providerStatus: null as Record<string, unknown> | null,
      lastProviderSyncAt: null as Date | null,
      lastErrorType: null as string | null,
      lastErrorMessage: null as string | null,
      retryable: false,
      submissionKey: "stable-submission-key",
      submittedAt: null as Date | null,
      createdAt: now,
      updatedAt: now,
    },
    founders: validDraft.founders.map((founder, index) => ({
      id: index + 1,
      registrationId: 41,
      sortOrder: index,
      isPrimary: founder.isPrimary,
      firstName: founder.firstName,
      lastName: founder.lastName,
      email: founder.email,
      phone: founder.phone,
      ownershipBasisPoints:
        founder.ownershipPercentage === undefined
          ? null
          : Math.round(founder.ownershipPercentage * 100),
      addressLine1: founder.address.line1,
      addressLine2: founder.address.line2,
      addressCity: founder.address.city,
      addressState: founder.address.state,
      addressPostalCode: founder.address.postalCode,
      addressCountry: founder.address.country,
      createdAt: now,
      updatedAt: now,
    })),
    attempts: [],
    history: [
      {
        id: 1,
        registrationId: 41,
        fromStatus: "draft" as Status,
        toStatus: status,
        source: "user" as const,
        note: "Ready for submission",
        createdAt: now,
      },
    ],
  };
}

function installState(initialStatus: Status = "ready") {
  const state: { bundle: TestBundle; allowLock: boolean; nextAttemptId: number } = {
    bundle: makeBundle(initialStatus),
    allowLock: true,
    nextAttemptId: 100,
  };

  database.get.mockImplementation(async () => state.bundle);
  database.countAttempts.mockResolvedValue(0);
  database.createAttempt.mockImplementation(async () => state.nextAttemptId++);
  database.finishAttempt.mockResolvedValue(undefined);
  database.updateProvider.mockImplementation(async (_userId, _registrationId, updates) => {
    Object.assign(state.bundle.registration, updates, { updatedAt: new Date() });
    return state.bundle.registration;
  });
  database.transition.mockImplementation(async (params) => {
    const current = state.bundle.registration.status;
    const allowed = params.expectedStatuses.includes(current);
    const isLock = params.toStatus === "submitting";
    if (!allowed || (isLock && !state.allowLock)) {
      return { changed: false, registration: state.bundle.registration };
    }
    state.bundle.registration.status = params.toStatus;
    if (params.updates) Object.assign(state.bundle.registration, params.updates);
    state.bundle.registration.updatedAt = new Date();
    state.bundle.history.unshift({
      id: state.bundle.history.length + 1,
      registrationId: state.bundle.registration.id,
      fromStatus: current,
      toStatus: params.toStatus,
      source: params.source,
      note: params.note ?? null,
      createdAt: new Date(),
    });
    return { changed: true, registration: state.bundle.registration };
  });

  return state;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPS_EMAIL", "ops@example.com");
  pricingMock.getInactiveStateError.mockResolvedValue(null);
  pricingMock.getStatePricing.mockResolvedValue({
    state: "WY",
    retailPriceCents: null,
    stateFeeCents: 10000,
    paymentLinkUrl: null,
    active: true,
  });
  provider.findAccount.mockResolvedValue(null);
  // Retries against an existing connected account first check for an existing
  // formation; default to "no formation yet" so registration proceeds.
  provider.retrieveAccount.mockResolvedValue({
    data: { id: "biz_TestAccount123", llc_formation: {} },
    httpStatus: 200,
    requestId: "req_status",
  });
  provider.createAccount.mockResolvedValue({
    data: { id: "biz_TestAccount123", metadata: {} },
    httpStatus: 201,
    requestId: "req_account",
  });
  provider.registerLlc.mockResolvedValue({
    data: {
      checkout_session_id: "ch_test_123",
      checkout_url: "https://whop.com/checkout/test",
      total: 39900,
      currency: "usd",
    },
    httpStatus: 201,
    requestId: "req_llc",
  });
});

describe("LLC submission integration", () => {
  it("persists one connected account and checkout before returning success", async () => {
    const state = installState();
    const result = await submitLlcRegistration({
      userId: 7,
      registrationId: 41,
    });

    expect(result.outcome).toBe("checkout_ready");
    expect(state.bundle.registration.status).toBe("payment_required");
    expect(state.bundle.registration.whopAccountId).toBe("biz_TestAccount123");
    expect(state.bundle.registration.checkoutSessionId).toBe("ch_test_123");
    expect(provider.createAccount).toHaveBeenCalledTimes(1);
    expect(provider.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ops+reg41@example.com",
        idempotencyKey: "stable-submission-key-account",
      }),
    );
    expect(provider.registerLlc).toHaveBeenCalledTimes(1);
    expect(provider.registerLlc).toHaveBeenCalledWith(
      "biz_TestAccount123",
      expect.anything(),
      { idempotencyKey: "stable-submission-key-llc" },
    );
    expect(state.bundle.registration.accountEmailAlias).toBe("ops+reg41@example.com");
    expect(database.finishAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "succeeded", providerObjectId: "ch_test_123" }),
    );
  });

  it("preserves the draft and connected account across a retryable failure, then retries without duplicating the account", async () => {
    const state = installState();
    provider.registerLlc.mockRejectedValueOnce(
      new WhopApiError({
        message: "Provider unavailable",
        errorType: "provider_unavailable",
        safeMessage: "Whop is temporarily unavailable. Please try again.",
        retryable: true,
        actionRequired: false,
        uncertain: false,
        httpStatus: 503,
      }),
    );

    const first = await submitLlcRegistration({ userId: 7, registrationId: 41 });
    expect(first.outcome).toBe("failed");
    expect(state.bundle.registration.status).toBe("failed");
    expect(state.bundle.registration.retryable).toBe(true);
    expect(state.bundle.registration.legalName).toBe(validDraft.legalName);
    expect(state.bundle.registration.whopAccountId).toBe("biz_TestAccount123");

    const second = await submitLlcRegistration({ userId: 7, registrationId: 41 });
    expect(second.outcome).toBe("checkout_ready");
    expect(provider.createAccount).toHaveBeenCalledTimes(1);
    expect(provider.registerLlc).toHaveBeenCalledTimes(2);
    expect(state.bundle.registration.status).toBe("payment_required");
  });

  it("blocks automatic retry after an uncertain LLC mutation outcome", async () => {
    const state = installState();
    provider.registerLlc.mockRejectedValue(
      new WhopApiError({
        message: "Connection ended after request was sent",
        errorType: "network_error",
        safeMessage: "The Whop response was interrupted.",
        retryable: true,
        actionRequired: false,
        uncertain: true,
      }),
    );

    const first = await submitLlcRegistration({ userId: 7, registrationId: 41 });
    expect(first.outcome).toBe("action_required");
    expect(state.bundle.registration.status).toBe("action_required");
    expect(state.bundle.registration.retryable).toBe(false);

    const second = await submitLlcRegistration({ userId: 7, registrationId: 41 });
    expect(second.outcome).toBe("action_required");
    expect(provider.registerLlc).toHaveBeenCalledTimes(1);
  });

  it("returns in-progress when another request owns the atomic submission lock", async () => {
    const state = installState();
    state.allowLock = false;

    const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });
    expect(result.outcome).toBe("in_progress");
    expect(provider.createAccount).not.toHaveBeenCalled();
    expect(provider.registerLlc).not.toHaveBeenCalled();
  });

  it("refuses to re-register when the connected account already has a formation", async () => {
    const state = installState();
    state.bundle.registration.whopAccountId = "biz_TestAccount123";
    provider.retrieveAccount.mockResolvedValue({
      data: {
        id: "biz_TestAccount123",
        llc_formation: { payment_pending: true },
      },
      httpStatus: 200,
      requestId: "req_status",
    });

    const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });

    expect(result.outcome).toBe("action_required");
    expect(provider.registerLlc).not.toHaveBeenCalled();
    expect(state.bundle.registration.status).toBe("action_required");
    expect(state.bundle.registration.lastErrorType).toBe("uncertain_existing_formation");
  });

  it("snapshots the state's published retail price onto the registration at submit", async () => {
    pricingMock.getStatePricing.mockResolvedValue({
      state: "WY",
      retailPriceCents: 54900,
      stateFeeCents: 10000,
      paymentLinkUrl: "https://pay.example.com/llc",
      active: true,
    });
    const state = installState();

    const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });

    expect(result.outcome).toBe("checkout_ready");
    expect(state.bundle.registration.retailPriceCents).toBe(54900);
  });

  it("never overwrites an already-recorded retail price at submit", async () => {
    pricingMock.getStatePricing.mockResolvedValue({
      state: "WY",
      retailPriceCents: 64900,
      stateFeeCents: 10000,
      paymentLinkUrl: null,
      active: true,
    });
    const state = installState();
    state.bundle.registration.retailPriceCents = 49900;

    const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });

    expect(result.outcome).toBe("checkout_ready");
    expect(state.bundle.registration.retailPriceCents).toBe(49900);
    expect(pricingMock.getStatePricing).not.toHaveBeenCalled();
  });

  it("refuses to hand an inactive state to the provider", async () => {
    pricingMock.getInactiveStateError.mockResolvedValue(
      "We're not filing in WY just yet. Choose another formation state, or check back soon.",
    );
    installState();

    await expect(
      submitLlcRegistration({ userId: 7, registrationId: 41 }),
    ).rejects.toBeInstanceOf(LlcSubmissionValidationError);
    expect(provider.createAccount).not.toHaveBeenCalled();
    expect(provider.registerLlc).not.toHaveBeenCalled();
  });

  it("reuses a persisted checkout without invoking any provider mutation", async () => {
    const state = installState("payment_required");
    state.bundle.registration.whopAccountId = "biz_TestAccount123";
    state.bundle.registration.checkoutSessionId = "ch_test_123";
    state.bundle.registration.checkoutUrl = "https://whop.com/checkout/test";

    const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });
    expect(result.outcome).toBe("already_submitted");
    expect(provider.createAccount).not.toHaveBeenCalled();
    expect(provider.registerLlc).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { makePersistedBundle } from "./test-fixtures";

const database = vi.hoisted(() => ({
  get: vi.fn(),
  findOwner: vi.fn(),
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

const documents = vi.hoisted(() => ({
  findById: vi.fn(),
  setReleased: vi.fn(),
  mirror: vi.fn(),
}));

const clientEmails = vi.hoisted(() => ({
  applicationReceived: vi.fn(),
  paymentConfirmed: vi.fn(),
  formationComplete: vi.fn(),
  documentsReleased: vi.fn(),
  demoLifecycle: vi.fn(),
}));

const pricingMock = vi.hoisted(() => ({
  getStatePricing: vi.fn(),
  getInactiveStateError: vi.fn(),
}));

vi.mock("./store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store")>();
  return {
    ...actual,
    getLlcRegistrationById: database.get,
    findLlcRegistrationOwner: database.findOwner,
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

vi.mock("./documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./documents")>();
  return {
    ...actual,
    findLlcDocumentById: documents.findById,
    setDocumentReleased: documents.setReleased,
    mirrorFormationDocuments: documents.mirror,
  };
});

vi.mock("./pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./pricing")>();
  return {
    ...actual,
    getStatePricing: pricingMock.getStatePricing,
    getInactiveStateError: pricingMock.getInactiveStateError,
  };
});

vi.mock("./clientEmails", () => ({
  sendApplicationReceivedEmail: clientEmails.applicationReceived,
  sendPaymentConfirmedEmail: clientEmails.paymentConfirmed,
  sendFormationCompleteEmail: clientEmails.formationComplete,
  sendDocumentsReleasedEmail: clientEmails.documentsReleased,
  sendDemoLifecycleEmails: clientEmails.demoLifecycle,
}));

import { appRouter } from "../routers";
import {
  refreshLlcRegistrationStatus,
  submitLlcRegistration,
} from "./submission";
import { WhopApiError } from "./whop";

type TestBundle = ReturnType<typeof makePersistedBundle>;

function installState(bundle: TestBundle) {
  const state = { bundle };
  database.get.mockImplementation(async () => state.bundle);
  database.countAttempts.mockResolvedValue(0);
  database.createAttempt.mockResolvedValue(100);
  database.finishAttempt.mockResolvedValue(undefined);
  database.updateProvider.mockImplementation(
    async (_userId: number, _registrationId: number, updates: Record<string, unknown>) => {
      Object.assign(state.bundle.registration, updates, { updatedAt: new Date() });
      return state.bundle;
    },
  );
  database.transition.mockImplementation(
    async (params: {
      toStatus: TestBundle["registration"]["status"];
      expectedStatuses: string[];
      updates?: Record<string, unknown>;
    }) => {
      const current = state.bundle.registration.status;
      if (!params.expectedStatuses.includes(current)) {
        return { changed: false, registration: state.bundle.registration };
      }
      state.bundle.registration.status = params.toStatus;
      if (params.updates) Object.assign(state.bundle.registration, params.updates);
      return { changed: true, registration: state.bundle.registration };
    },
  );
  return state;
}

function makeContext(userId: number, role: "user" | "admin" = "admin"): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      email: `owner${userId}@example.com`,
      name: `Owner ${userId}`,
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
  };
}

/** Flush the fire-and-forget email promise chains queued by a seam. */
async function flushAsync() {
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPS_EMAIL", "ops@example.com");
  clientEmails.applicationReceived.mockResolvedValue("sent");
  clientEmails.paymentConfirmed.mockResolvedValue("sent");
  clientEmails.formationComplete.mockResolvedValue("sent");
  clientEmails.documentsReleased.mockResolvedValue("sent");
  clientEmails.demoLifecycle.mockResolvedValue({ sent: 4 });
  pricingMock.getInactiveStateError.mockResolvedValue(null);
  pricingMock.getStatePricing.mockResolvedValue({
    state: "WY",
    retailPriceCents: 54900,
    stateFeeCents: 10000,
    paymentLinkUrl: "https://pay.example.com/wy",
    active: true,
  });
  documents.mirror.mockResolvedValue({ mirrored: 0, skipped: 0 });
  documents.findById.mockResolvedValue({
    id: 5,
    registrationId: 41,
    userId: 7,
    name: "Articles of Organization",
    label: null,
    documentType: "articles_of_organization",
    source: "provider",
    storageKey: "pdfs/7/llc/41/articles-of-organization.pdf",
    releasedAt: null,
    createdAt: new Date(),
  });
  documents.setReleased.mockResolvedValue({ releasedAt: new Date() });
  provider.findAccount.mockResolvedValue(null);
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

describe("application_received trigger (submit succeeds)", () => {
  it("fires exactly one application email at the checkout_ready seam", async () => {
    installState(makePersistedBundle("ready"));

    const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });
    await flushAsync();

    expect(result.outcome).toBe("checkout_ready");
    expect(clientEmails.applicationReceived).toHaveBeenCalledTimes(1);
    expect(clientEmails.applicationReceived).toHaveBeenCalledWith({
      userId: 7,
      registrationId: 41,
    });
    expect(clientEmails.formationComplete).not.toHaveBeenCalled();
  });

  it("also fires when a persisted checkout is recovered after an interrupted response", async () => {
    const bundle = makePersistedBundle("submitting");
    bundle.registration.checkoutSessionId = "ch_recovered";
    bundle.registration.checkoutUrl = "https://example.com/checkout/recovered";
    installState(bundle);

    const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });
    await flushAsync();

    expect(result.outcome).toBe("checkout_ready");
    expect(clientEmails.applicationReceived).toHaveBeenCalledTimes(1);
  });

  it("does not email the client when the submission fails", async () => {
    installState(makePersistedBundle("ready"));
    provider.registerLlc.mockRejectedValue(
      new WhopApiError({
        message: "Provider unavailable",
        errorType: "provider_unavailable",
        safeMessage: "The filing service is temporarily unavailable.",
        retryable: true,
        actionRequired: false,
        uncertain: false,
        httpStatus: 503,
      }),
    );

    const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });
    await flushAsync();

    expect(result.outcome).toBe("failed");
    expect(clientEmails.applicationReceived).not.toHaveBeenCalled();
  });

  it("a client email failure never affects the submission result", async () => {
    installState(makePersistedBundle("ready"));
    clientEmails.applicationReceived.mockRejectedValue(new Error("email exploded"));

    const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });
    await flushAsync();

    expect(result.outcome).toBe("checkout_ready");
  });
});

describe("formation_complete trigger (completed transition in the refresh path)", () => {
  it("fires when the provider reports completion and the transition lands", async () => {
    const bundle = makePersistedBundle("processing");
    bundle.registration.whopAccountId = "biz_TestAccount123";
    installState(bundle);
    provider.retrieveAccount.mockResolvedValue({
      data: {
        id: "biz_TestAccount123",
        llc_formation: { state_registered: true, ein_registered: true },
      },
      httpStatus: 200,
      requestId: "req_status",
    });

    const result = await refreshLlcRegistrationStatus({ userId: 7, registrationId: 41 });
    await flushAsync();

    expect(result.refreshed).toBe(true);
    expect(clientEmails.formationComplete).toHaveBeenCalledTimes(1);
    expect(clientEmails.formationComplete).toHaveBeenCalledWith({
      userId: 7,
      registrationId: 41,
    });
  });

  it("does not fire for non-completed provider updates", async () => {
    const bundle = makePersistedBundle("payment_required");
    bundle.registration.whopAccountId = "biz_TestAccount123";
    installState(bundle);
    provider.retrieveAccount.mockResolvedValue({
      data: {
        id: "biz_TestAccount123",
        llc_formation: { state_registered: true, ein_registered: false },
      },
      httpStatus: 200,
      requestId: "req_status",
    });

    await refreshLlcRegistrationStatus({ userId: 7, registrationId: 41 });
    await flushAsync();

    expect(clientEmails.formationComplete).not.toHaveBeenCalled();
  });

  it("does not fire when the completed transition loses the compare-and-set race", async () => {
    const bundle = makePersistedBundle("processing");
    bundle.registration.whopAccountId = "biz_TestAccount123";
    installState(bundle);
    database.transition.mockResolvedValue({
      changed: false,
      registration: bundle.registration,
    });
    provider.retrieveAccount.mockResolvedValue({
      data: {
        id: "biz_TestAccount123",
        llc_formation: { state_registered: true, ein_registered: true },
      },
      httpStatus: 200,
      requestId: "req_status",
    });

    await refreshLlcRegistrationStatus({ userId: 7, registrationId: 41 });
    await flushAsync();

    expect(clientEmails.formationComplete).not.toHaveBeenCalled();
  });
});

describe("payment_confirmed trigger (llcOps.markPaid)", () => {
  it("fires for the registration owner when ops marks the retail payment received", async () => {
    installState(makePersistedBundle("payment_required"));
    database.findOwner.mockResolvedValue({ userId: 7 });

    const caller = appRouter.createCaller(makeContext(9, "admin"));
    const result = await caller.llcOps.markPaid({ id: 41 });
    await flushAsync();

    expect(result).toEqual({ id: 41, paid: true });
    expect(clientEmails.paymentConfirmed).toHaveBeenCalledTimes(1);
    expect(clientEmails.paymentConfirmed).toHaveBeenCalledWith({
      userId: 7,
      registrationId: 41,
    });
  });

  it("does not fire on unmarkPaid", async () => {
    installState(makePersistedBundle("payment_required"));
    database.findOwner.mockResolvedValue({ userId: 7 });

    const caller = appRouter.createCaller(makeContext(9, "admin"));
    await caller.llcOps.unmarkPaid({ id: 41 });
    await flushAsync();

    expect(clientEmails.paymentConfirmed).not.toHaveBeenCalled();
  });

  it("a client email failure never affects the ops action", async () => {
    installState(makePersistedBundle("payment_required"));
    database.findOwner.mockResolvedValue({ userId: 7 });
    clientEmails.paymentConfirmed.mockRejectedValue(new Error("email exploded"));

    const caller = appRouter.createCaller(makeContext(9, "admin"));
    const result = await caller.llcOps.markPaid({ id: 41 });
    await flushAsync();

    expect(result).toEqual({ id: 41, paid: true });
  });
});

describe("documents_released trigger (llcOps.releaseDocument)", () => {
  it("fires for the document's owner and registration on release", async () => {
    const caller = appRouter.createCaller(makeContext(9, "admin"));
    const result = await caller.llcOps.releaseDocument({ documentId: 5 });
    await flushAsync();

    expect(result.released).toBe(true);
    expect(clientEmails.documentsReleased).toHaveBeenCalledTimes(1);
    expect(clientEmails.documentsReleased).toHaveBeenCalledWith({
      userId: 7,
      registrationId: 41,
    });
  });

  it("does not fire when a document is hidden again", async () => {
    const caller = appRouter.createCaller(makeContext(9, "admin"));
    await caller.llcOps.unreleaseDocument({ documentId: 5 });
    await flushAsync();

    expect(clientEmails.documentsReleased).not.toHaveBeenCalled();
  });
});

describe("llcOps.sendDemoEmails (webinar rehearsals)", () => {
  it("refuses non-demo filings", async () => {
    const bundle = makePersistedBundle("completed");
    bundle.registration.submissionKey = "real-submission-key";
    installState(bundle);
    database.findOwner.mockResolvedValue({ userId: 7 });

    const caller = appRouter.createCaller(makeContext(9, "admin"));
    await expect(caller.llcOps.sendDemoEmails({ id: 41 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only demo filings can send demo emails",
    });
    expect(clientEmails.demoLifecycle).not.toHaveBeenCalled();
  });

  it("sends the four lifecycle emails to the calling admin and stays re-sendable", async () => {
    const bundle = makePersistedBundle("completed");
    bundle.registration.submissionKey = "demo-abc123";
    installState(bundle);
    database.findOwner.mockResolvedValue({ userId: 7 });

    const caller = appRouter.createCaller(makeContext(9, "admin"));
    const first = await caller.llcOps.sendDemoEmails({ id: 41 });
    expect(first).toEqual({ sent: 4 });
    expect(clientEmails.demoLifecycle).toHaveBeenCalledWith({
      userId: 7,
      registrationId: 41,
      to: "owner9@example.com",
    });

    // Rehearsals bypass the send-once log, so a second run also sends.
    const second = await caller.llcOps.sendDemoEmails({ id: 41 });
    expect(second).toEqual({ sent: 4 });
    expect(clientEmails.demoLifecycle).toHaveBeenCalledTimes(2);
  });

  it("is admin-only", async () => {
    const bundle = makePersistedBundle("completed");
    bundle.registration.submissionKey = "demo-abc123";
    installState(bundle);
    database.findOwner.mockResolvedValue({ userId: 7 });

    const caller = appRouter.createCaller(makeContext(7, "user"));
    await expect(caller.llcOps.sendDemoEmails({ id: 41 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(clientEmails.demoLifecycle).not.toHaveBeenCalled();
  });
});

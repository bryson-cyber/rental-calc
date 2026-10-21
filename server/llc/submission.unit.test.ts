import { beforeEach, describe, expect, it, vi } from "vitest";
import { makePersistedBundle } from "./test-fixtures";
import { MAILING_AGENT_ACK } from "../../shared/llcAddress";

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

import { LlcSubmissionValidationError, submitLlcRegistration } from "./submission";

beforeEach(() => {
  vi.clearAllMocks();
  database.countAttempts.mockResolvedValue(0);
  database.createAttempt.mockResolvedValue(1);
  database.finishAttempt.mockResolvedValue(undefined);
  database.updateProvider.mockResolvedValue(undefined);
});

describe("LLC submission status and idempotency unit gates", () => {
  it.each(["payment_required", "processing", "completed"] as const)(
    "treats %s as already submitted without another mutation",
    async (status) => {
      database.get.mockResolvedValue(makePersistedBundle(status));

      const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });

      expect(result.outcome).toBe("already_submitted");
      expect(database.transition).not.toHaveBeenCalled();
      expect(provider.createAccount).not.toHaveBeenCalled();
      expect(provider.registerLlc).not.toHaveBeenCalled();
    },
  );

  it("returns in progress when a submission is already running", async () => {
    database.get.mockResolvedValue(makePersistedBundle("submitting"));

    const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });

    expect(result.outcome).toBe("in_progress");
    expect(database.transition).not.toHaveBeenCalled();
    expect(provider.registerLlc).not.toHaveBeenCalled();
  });

  it("recovers a checkout persisted before an interrupted response", async () => {
    const bundle = makePersistedBundle("submitting");
    bundle.registration.checkoutSessionId = "ch_recovered";
    bundle.registration.checkoutUrl = "https://whop.com/checkout/recovered";
    database.get.mockImplementation(async () => bundle);
    database.transition.mockImplementation(async ({ toStatus }) => {
      bundle.registration.status = toStatus;
      return { changed: true, registration: bundle.registration };
    });

    const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });

    expect(result.outcome).toBe("checkout_ready");
    expect(bundle.registration.status).toBe("payment_required");
    expect(database.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        toStatus: "payment_required",
        expectedStatuses: ["submitting"],
      }),
    );
    expect(provider.registerLlc).not.toHaveBeenCalled();
  });

  it("does not call Whop when another request wins the compare-and-set lock", async () => {
    const bundle = makePersistedBundle("ready");
    database.get.mockResolvedValue(bundle);
    database.transition.mockResolvedValue({
      changed: false,
      registration: bundle.registration,
    });

    const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });

    expect(result.outcome).toBe("in_progress");
    expect(database.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        toStatus: "submitting",
        expectedStatuses: ["ready", "failed"],
      }),
    );
    expect(provider.createAccount).not.toHaveBeenCalled();
    expect(provider.registerLlc).not.toHaveBeenCalled();
  });

  it("blocks a failed registration that was marked non-retryable", async () => {
    const bundle = makePersistedBundle("failed");
    bundle.registration.retryable = false;
    bundle.registration.lastErrorMessage = "Manual review is required.";
    database.get.mockResolvedValue(bundle);

    const result = await submitLlcRegistration({ userId: 7, registrationId: 41 });

    expect(result.outcome).toBe("action_required");
    expect(result.message).toBe("Manual review is required.");
    expect(database.transition).not.toHaveBeenCalled();
    expect(provider.registerLlc).not.toHaveBeenCalled();
  });
});

describe("address choices at submit (2026-10-14; owner: an LLC was filed with the registered agent's address as its business address; fix it in every app)", () => {
  it("refuses a draft from before the split whose old switch was on until Step 3 is saved", async () => {
    // The address and phone are on file, so the new defaults validate; but
    // the row still says the agent for both. Submitting would record evidence
    // the client never saw and the order would be held after the client
    // confirmed its own address on review (or, from the status page's retry,
    // without seeing it at all).
    const bundle = makePersistedBundle("ready");
    bundle.registration.useRegisteredAgent = true;
    database.get.mockResolvedValue(bundle);

    await expect(submitLlcRegistration({ userId: 7, registrationId: 41 })).rejects.toMatchObject({
      fieldErrors: { businessAddressMode: expect.stringMatching(/Step 3/) },
    });
    expect(database.transition).not.toHaveBeenCalled();
    expect(provider.createAccount).not.toHaveBeenCalled();
  });

  it("the legacy filing leg never takes a split choice it cannot send", async () => {
    // That leg has one switch for both addresses, so the business address
    // and the mail cannot go to different places through it.
    const bundle = makePersistedBundle("ready");
    Object.assign(bundle.registration, {
      whopAccountId: "biz_existing",
      businessAddressMode: "customer",
      mailingAddressMode: "registered_agent",
      mailingAgentAckVersion: MAILING_AGENT_ACK.version,
      mailingAgentAckAt: new Date("2026-10-14T18:00:00.000Z"),
    });
    database.get.mockResolvedValue(bundle);

    const failure = await submitLlcRegistration({ userId: 7, registrationId: 41 }).catch((error) => error);
    expect(failure).toBeInstanceOf(LlcSubmissionValidationError);
    expect(failure.fieldErrors.businessAddressMode).toMatch(/same option for both/);
    expect(JSON.stringify(failure.fieldErrors)).not.toMatch(/whop|doola/i);
    expect(database.transition).not.toHaveBeenCalled();
    expect(provider.registerLlc).not.toHaveBeenCalled();
  });

  it("the submit lock stamps which modes were submitted, never address text", async () => {
    const bundle = makePersistedBundle("ready");
    Object.assign(bundle.registration, {
      businessAddressMode: "customer",
      mailingAddressMode: "registered_agent",
      mailingAgentAckVersion: MAILING_AGENT_ACK.version,
      mailingAgentAckAt: new Date("2026-10-14T18:00:00.000Z"),
    });
    database.get.mockResolvedValue(bundle);
    database.transition.mockResolvedValue({ changed: false, registration: bundle.registration });

    await submitLlcRegistration({ userId: 7, registrationId: 41 });

    const lock = database.transition.mock.calls[0][0] as {
      toStatus: string;
      updates: { addressChoiceEvidence: { submitted: Record<string, unknown> } };
    };
    expect(lock.toStatus).toBe("submitting");
    expect(lock.updates.addressChoiceEvidence.submitted).toMatchObject({
      business: "customer",
      mailing: "registered_agent",
      modesSource: "stored",
      mailingAgentAckVersion: MAILING_AGENT_ACK.version,
      mailingAgentAckAt: "2026-10-14T18:00:00.000Z",
      businessAgentAckVersion: null,
    });
    expect(JSON.stringify(lock.updates.addressChoiceEvidence)).not.toMatch(/100 Main|Cheyenne|82001/);
  });
});

/**
 * llc.confirmAddressChoices and its token twin (2026-10-14; owner: an LLC was
 * filed with the registered agent's address as its business address; fix it
 * in every app). A held order (placed before the fix with the old switch on)
 * is fixed by the client from the status page, signed in or from a tokenized
 * email link, under the same rules as Step 3. The formation state comes from
 * the order, never the client; when the payment is in, the filing starts
 * right away. Final validation asks an old draft to save Step 3 first.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { BUSINESS_AGENT_ACK, MAILING_AGENT_ACK } from "../../shared/llcAddress";

const store = vi.hoisted(() => ({
  get: vi.fn(),
  findOwner: vi.fn(),
  saveChoices: vi.fn(),
  transition: vi.fn(),
}));
const filing = vi.hoisted(() => ({ file: vi.fn() }));
const pricing = vi.hoisted(() => ({ getInactiveStateError: vi.fn() }));

vi.mock("./store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store")>();
  return {
    ...actual,
    getLlcRegistrationById: store.get,
    findLlcRegistrationOwner: store.findOwner,
    saveLlcAddressChoices: store.saveChoices,
    transitionLlcStatus: store.transition,
  };
});
vi.mock("./doolaSubmission", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./doolaSubmission")>();
  return { ...actual, fileDoolaRegistration: filing.file };
});
vi.mock("./pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./pricing")>();
  return { ...actual, getInactiveStateError: pricing.getInactiveStateError };
});

import { appRouter } from "../routers";
import { encryptPii } from "./pii";
import { makePersistedBundle } from "./test-fixtures";

const TOKEN = "f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6"; // 48 chars

function context(userId: number | null = 7): TrpcContext {
  return {
    user:
      userId === null
        ? null
        : {
            id: userId,
            openId: `user-${userId}`,
            email: `owner${userId}@example.com`,
            name: `Owner ${userId}`,
            phone: null,
            loginMethod: "manus",
            role: "user",
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
            reportMode: null,
          },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

function heldBundle(overrides: Record<string, unknown> = {}) {
  const bundle = makePersistedBundle("payment_required");
  Object.assign(bundle.registration, {
    formationState: "IL",
    useRegisteredAgent: true,
    provider: "doola",
    doolaCompanyId: null,
    isTest: false,
    checkoutSessionId: "cs_1",
    retailPaidAt: new Date("2026-10-14T18:00:00.000Z"),
    statusToken: TOKEN,
    ...overrides,
  });
  return bundle;
}

const ownChoices = {
  businessAddressMode: "customer" as const,
  mailingAddressMode: "customer" as const,
  businessAgentAckVersion: "",
  mailingAgentAckVersion: "",
  companyAddress: { line1: "1 State St", line2: "", city: "Chicago", state: "IL", postalCode: "60601", country: "US" },
  businessPhone: "(312) 555-0100",
};

beforeEach(() => {
  vi.clearAllMocks();
  filing.file.mockResolvedValue({ outcome: "filed", doolaCompanyId: "dc_1" });
  pricing.getInactiveStateError.mockResolvedValue(null);
  store.findOwner.mockResolvedValue({ userId: 7 });
});

describe("llc.confirmAddressChoices", () => {
  it("saves valid choices and starts the filing when the payment is already in", async () => {
    const held = heldBundle();
    store.get.mockResolvedValue(held);
    store.saveChoices.mockResolvedValue(held);
    const result = await appRouter.createCaller(context()).llc.confirmAddressChoices({ id: 41, choices: ownChoices });
    expect(result.saved).toBe(true);
    expect(store.saveChoices).toHaveBeenCalledWith(7, 41, ownChoices);
    expect(filing.file).toHaveBeenCalledWith({ userId: 7, registrationId: 41 });
    if (result.saved) expect(JSON.stringify(result.registration)).not.toMatch(/doola|whop/i);
  });

  it("does not start a filing before payment", async () => {
    const unpaid = heldBundle({ retailPaidAt: null });
    store.get.mockResolvedValue(unpaid);
    store.saveChoices.mockResolvedValue(unpaid);
    await appRouter.createCaller(context()).llc.confirmAddressChoices({ id: 41, choices: ownChoices });
    expect(store.saveChoices).toHaveBeenCalledTimes(1);
    expect(filing.file).not.toHaveBeenCalled();
  });

  it("refuses an opt-in without its acknowledgment, and the agent's address in a state that refuses it", async () => {
    store.get.mockResolvedValue(heldBundle({ formationState: "OK" }));
    const noAck = await appRouter.createCaller(context()).llc.confirmAddressChoices({
      id: 41,
      choices: { ...ownChoices, businessAddressMode: "registered_agent" },
    });
    expect(noAck).toMatchObject({ saved: false });
    if (!noAck.saved) expect(noAck.fieldErrors.businessAgentAckVersion).toMatch(/check the box/i);

    // The state is read from the order (Illinois), not from anything the client sends.
    store.get.mockResolvedValue(heldBundle());
    const illinois = await appRouter.createCaller(context()).llc.confirmAddressChoices({
      id: 41,
      choices: { ...ownChoices, businessAddressMode: "registered_agent", businessAgentAckVersion: BUSINESS_AGENT_ACK.version },
    });
    expect(illinois).toMatchObject({ saved: false });
    if (!illinois.saved) expect(illinois.fieldErrors.businessAddressMode).toMatch(/Illinois/);
    expect(store.saveChoices).not.toHaveBeenCalled();
    expect(filing.file).not.toHaveBeenCalled();
  });

  it("answers CONFLICT when the order can no longer change", async () => {
    store.get.mockResolvedValue(heldBundle());
    store.saveChoices.mockRejectedValue(new Error("These address choices can no longer be changed"));
    await expect(
      appRouter.createCaller(context()).llc.confirmAddressChoices({ id: 41, choices: ownChoices }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(filing.file).not.toHaveBeenCalled();
  });

  it("requires a signed-in client (the token twin covers email links)", async () => {
    await expect(
      appRouter.createCaller(context(null)).llc.confirmAddressChoices({ id: 41, choices: ownChoices }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(store.saveChoices).not.toHaveBeenCalled();
  });
});

describe("llc.confirmAddressChoicesByToken", () => {
  it("saves for the order's owner from a matching email-link token, with SSNs blanked", async () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    const held = heldBundle();
    // A founder with an SSN on file: the signed-in view decrypts it, the
    // token answer must not (an email link is a weaker credential).
    Object.assign(held.founders[0], { ssnEncrypted: encryptPii("123456789") });
    store.get.mockResolvedValue(held);
    store.saveChoices.mockResolvedValue(held);
    const result = await appRouter
      .createCaller(context(null))
      .llc.confirmAddressChoicesByToken({ id: 41, token: TOKEN, choices: ownChoices });
    expect(result.saved).toBe(true);
    expect(store.saveChoices).toHaveBeenCalledWith(7, 41, ownChoices);
    expect(filing.file).toHaveBeenCalledWith({ userId: 7, registrationId: 41 });
    if (result.saved) {
      const json = JSON.stringify(result);
      expect(json).not.toMatch(/doola|whop|statusToken/i);
      expect(json).not.toContain(TOKEN);
      for (const founder of result.registration.draft.founders) expect(founder.ssn).toBe("");
      expect(json).not.toContain("123456789");
    }
    vi.unstubAllEnvs();
  });

  it("answers the same NOT_FOUND for a wrong token and changes nothing", async () => {
    store.get.mockResolvedValue(heldBundle());
    await expect(
      appRouter
        .createCaller(context(null))
        .llc.confirmAddressChoicesByToken({ id: 41, token: "0".repeat(48), choices: ownChoices }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    store.get.mockResolvedValue(heldBundle({ statusToken: null }));
    await expect(
      appRouter
        .createCaller(context(null))
        .llc.confirmAddressChoicesByToken({ id: 41, token: TOKEN, choices: ownChoices }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.saveChoices).not.toHaveBeenCalled();
    expect(filing.file).not.toHaveBeenCalled();
  });

  it("applies the same rules as Step 3", async () => {
    store.get.mockResolvedValue(heldBundle());
    const result = await appRouter.createCaller(context(null)).llc.confirmAddressChoicesByToken({
      id: 41,
      token: TOKEN,
      choices: { ...ownChoices, companyAddress: { ...ownChoices.companyAddress, line1: "PO Box 12" } },
    });
    expect(result).toMatchObject({ saved: false });
    if (!result.saved) expect(result.fieldErrors["companyAddress.line1"]).toMatch(/PO box/);
    expect(store.saveChoices).not.toHaveBeenCalled();
  });
});

describe("llc.validateForSubmission with a draft from before the address split", () => {
  // The wizard opens such a draft on the new defaults (the client's own
  // address), but the row still says the agent for both, and that is what
  // the filing gate and the submit evidence read. Final validation asks the
  // client to save Step 3 first, so the row agrees with what was confirmed.
  function legacyDraft(overrides: Record<string, unknown> = {}) {
    const bundle = makePersistedBundle("draft");
    Object.assign(bundle.registration, {
      useRegisteredAgent: true,
      // A rental preset, so the industry guard passes and only the address rule is under test.
      businessType: "doola_direct",
      industryGroup: "721310",
      industryType: "Short term rentals",
      ...overrides,
    });
    return bundle;
  }

  it("asks the client to choose in Step 3 when the old switch was on and the choices were never saved", async () => {
    store.get.mockResolvedValue(legacyDraft());
    const result = await appRouter.createCaller(context()).llc.validateForSubmission({ id: 41 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.fieldErrors.businessAddressMode).toMatch(/Step 3/);
    expect(store.transition).not.toHaveBeenCalled();
  });

  it("passes once Step 3 is saved, whatever was chosen", async () => {
    store.transition.mockResolvedValue({ changed: true });
    store.get.mockResolvedValue(
      legacyDraft({
        businessAddressMode: "customer",
        mailingAddressMode: "registered_agent",
        mailingAgentAckVersion: MAILING_AGENT_ACK.version,
        mailingAgentAckAt: new Date("2026-10-14T18:00:00.000Z"),
      }),
    );
    const result = await appRouter.createCaller(context()).llc.validateForSubmission({ id: 41 });
    expect(result.valid).toBe(true);
  });
});

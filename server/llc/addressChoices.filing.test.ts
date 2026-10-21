/**
 * The filing step's address gate (2026-10-14; owner: an LLC was filed with the
 * registered agent's address as its business address; fix it in every app).
 * The provider's HTTP API is never reached: fetch is stubbed for the whole
 * file and the key is a fake sandbox key. What is pinned: an order whose
 * address choices cannot be filed (the old switch on, nothing acknowledged)
 * is held before the lock and before any request, ops hear about it once;
 * a valid order sends the business and mailing entries independently and
 * stamps the evidence on the lock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUSINESS_AGENT_ACK, MAILING_AGENT_ACK } from "../../shared/llcAddress";

const store = vi.hoisted(() => ({
  get: vi.fn(),
  transition: vi.fn(),
  updateProvider: vi.fn(),
  countAttempts: vi.fn(),
  createAttempt: vi.fn(),
  finishAttempt: vi.fn(),
}));
const notify = vi.hoisted(() => ({ send: vi.fn() }));
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

import { fileDoolaRegistration } from "./doolaSubmission";

const now = new Date("2026-10-14T18:00:00.000Z");
const fetchMock = vi.fn();

function makeBundle(overrides: Record<string, unknown> = {}) {
  const registration = {
    id: 41,
    userId: 7,
    status: "payment_required",
    currentStep: 6,
    legalName: "Amara Rose Stays",
    entitySuffix: "LLC",
    formationState: "OK",
    businessType: "doola_direct",
    industryGroup: "721310",
    industryType: "Short term rentals",
    businessPhone: "+19185550100",
    website: null,
    useRegisteredAgent: false,
    businessAddressMode: "customer",
    mailingAddressMode: "registered_agent",
    businessAgentAckAt: null,
    businessAgentAckVersion: null,
    mailingAgentAckAt: now,
    mailingAgentAckVersion: MAILING_AGENT_ACK.version,
    addressChoiceEvidence: null,
    companyAddressLine1: "500 Main St",
    companyAddressLine2: null,
    companyAddressCity: "Tulsa",
    companyAddressState: "OK",
    companyAddressPostalCode: "74103",
    companyAddressCountry: "US",
    expediteEin: false,
    accuracyAttested: true,
    retailPaidAt: now,
    lastErrorType: null,
    lastErrorMessage: null,
    retryable: false,
    submissionKey: "abc123",
    isTest: false,
    provider: "doola",
    doolaEnv: null,
    doolaCustomerId: null,
    doolaCompanyId: null,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  return {
    registration,
    founders: [
      {
        id: 1,
        registrationId: 41,
        sortOrder: 0,
        isPrimary: true,
        firstName: "Amara",
        lastName: "Johnson",
        email: "amara@example.com",
        phone: "+14045550137",
        ssnEncrypted: null,
        ownershipBasisPoints: 10_000,
        addressLine1: "1847 Peachtree Walk NE",
        addressLine2: null,
        addressCity: "Atlanta",
        addressState: "GA",
        addressPostalCode: "30309",
        addressCountry: "US",
      },
    ],
    history: [],
    requiredActions: [],
  };
}

/** The old-switch order of 2026-10-14 in shape: the switch on, no modes, nothing acknowledged. */
const legacyAgentOverrides = {
  useRegisteredAgent: true,
  businessAddressMode: null,
  mailingAddressMode: null,
  mailingAgentAckAt: null,
  mailingAgentAckVersion: null,
};

function jsonResponse(payload: unknown, status = 201) {
  return new Response(JSON.stringify({ payload }), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LLC_TEST_MODE", "");
  vi.stubEnv("DOOLA_API_KEY", "dk_test_fake_key_for_tests_only");
  vi.stubEnv("DOOLA_API_BASE_URL", "https://api.test.doola.com");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string) =>
    String(url).endsWith("/v1/partner/customers")
      ? jsonResponse({ doolaCustomerId: "cus_1" })
      : jsonResponse({ doolaCompanyId: "dc_1", formationSubmissionStatus: "Submitted" }),
  );
  notify.send.mockResolvedValue(undefined);
  database.get.mockResolvedValue(null);
  store.countAttempts.mockResolvedValue(0);
  store.createAttempt.mockResolvedValue(1);
  store.finishAttempt.mockResolvedValue(undefined);
  store.updateProvider.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("filing gate", () => {
  it("holds the old-switch order before the lock and before any request, and tells ops", async () => {
    store.get.mockResolvedValue(
      makeBundle({
        ...legacyAgentOverrides,
        companyAddressLine1: null,
        companyAddressCity: null,
        companyAddressState: null,
        companyAddressPostalCode: null,
      }),
    );

    const result = await fileDoolaRegistration({ userId: 7, registrationId: 41 });

    expect(result).toEqual({
      outcome: "not_ready",
      reason: "The business address and mail choices need to be confirmed first",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.transition).not.toHaveBeenCalled();
    expect(store.updateProvider).not.toHaveBeenCalled();
    expect(notify.send).toHaveBeenCalledTimes(1);
    const alert = notify.send.mock.calls[0][0] as { subject: string; lines: string[] };
    const text = alert.lines.join("\n");
    expect(text).toContain("address_choice_needed");
    expect(text).toContain("business_agent_ack_missing");
    expect(text).toContain("mailing_agent_ack_missing");
  });

  it("rings ops once for a held order, not on every pass (payment webhook, Mark paid, retries)", async () => {
    // Several paths re-enter fileDoolaRegistration for a paid order not yet
    // filed; a held order must not re-alert each time (the 2026-09-05
    // pattern). The claim is a unique llc_email_log row.
    store.get.mockResolvedValue(makeBundle(legacyAgentOverrides));
    const claims: Array<Record<string, unknown>> = [];
    const values = vi.fn(async (row: Record<string, unknown>) => {
      const key = `${row.registrationId}|${row.emailType}`;
      if (claims.some((claim) => `${claim.registrationId}|${claim.emailType}` === key)) {
        throw new Error("Duplicate entry '41-ops_address_choice_hold' for key 'llc_email_log_once_unique'");
      }
      claims.push(row);
    });
    database.get.mockResolvedValue({ insert: () => ({ values }), delete: () => ({ where: async () => undefined }) });
    notify.send.mockResolvedValue(true);

    for (let pass = 0; pass < 3; pass++) {
      const result = await fileDoolaRegistration({ userId: 7, registrationId: 41 });
      expect(result.outcome).toBe("not_ready");
    }

    expect(notify.send).toHaveBeenCalledTimes(1);
    expect(claims).toEqual([{ registrationId: 41, emailType: "ops_address_choice_hold" }]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.transition).not.toHaveBeenCalled();
  });

  it("releases the claim when no channel delivered, so the next pass rings again", async () => {
    store.get.mockResolvedValue(makeBundle(legacyAgentOverrides));
    const values = vi.fn(async () => undefined);
    const where = vi.fn(async () => undefined);
    database.get.mockResolvedValue({ insert: () => ({ values }), delete: () => ({ where }) });
    notify.send.mockResolvedValue(false);

    await fileDoolaRegistration({ userId: 7, registrationId: 41 });

    expect(values).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("holds an Illinois order that opted in to the agent's address as its business address", async () => {
    store.get.mockResolvedValue(
      makeBundle({
        formationState: "IL",
        businessAddressMode: "registered_agent",
        businessAgentAckVersion: BUSINESS_AGENT_ACK.version,
        businessAgentAckAt: now,
      }),
    );
    const result = await fileDoolaRegistration({ userId: 7, registrationId: 41 });
    expect(result.outcome).toBe("not_ready");
    expect(fetchMock).not.toHaveBeenCalled();
    expect((notify.send.mock.calls[0][0] as { lines: string[] }).lines.join("\n")).toContain(
      "state_requires_own_business_address",
    );
  });

  it("files a valid order with the client's business address and the agent for mail, and stamps what was sent", async () => {
    const bundle = makeBundle();
    store.get.mockResolvedValue(bundle);
    store.transition.mockImplementation(async (params: { toStatus: string }) => ({
      changed: true,
      registration: { ...bundle.registration, status: params.toStatus },
    }));

    const result = await fileDoolaRegistration({ userId: 7, registrationId: 41 });

    expect(result).toEqual({ outcome: "filed", doolaCompanyId: "dc_1" });
    const companyCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/v1/partner/companies"));
    expect(companyCall).toBeTruthy();
    expect(String(companyCall![0])).toMatch(/^https:\/\/api\.test\.doola\.com\//);
    const body = JSON.parse(String((companyCall![1] as { body: string }).body));
    expect(body.addresses).toEqual([
      { provider: "registeredAgent", type: "mailing" },
      {
        provider: "customer",
        type: "business",
        address: {
          line1: "500 Main St",
          city: "Tulsa",
          state: "OK",
          postalCode: "74103",
          country: "USA",
          phone: "+19185550100",
        },
      },
    ]);

    const lock = store.transition.mock.calls[0][0] as {
      toStatus: string;
      updates: { addressChoiceEvidence: { sent: Record<string, unknown> } };
    };
    expect(lock.toStatus).toBe("submitting");
    expect(lock.updates.addressChoiceEvidence.sent).toMatchObject({
      business: "customer",
      mailing: "registered_agent",
      modesSource: "stored",
      mailingAgentAckVersion: MAILING_AGENT_ACK.version,
      businessAgentAckVersion: null,
    });
    expect(JSON.stringify(lock.updates.addressChoiceEvidence)).not.toMatch(/500 Main|Tulsa|74103/);
    expect(notify.send).not.toHaveBeenCalled();
  });
});

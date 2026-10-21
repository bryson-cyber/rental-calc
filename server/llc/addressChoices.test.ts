/**
 * Address choices (owner fix, 2026-10-14; owner: an LLC was filed with the
 * registered agent's address as its business address; fix it in every app).
 * The case: an Oklahoma LLC was filed with the registered agent's office as
 * its principal place of business and as the EIN letter address, because one
 * switch decided the agent, the business address and the mail. These pins
 * hold the split in this app: the agent is always included, the client's own
 * street address is the default for the business address and for mail, each
 * opt-in to the agent's address needs its own acknowledgment, states that
 * refuse it never get it, and an order with the old switch on and nothing
 * acknowledged is refused instead of filed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  issuesByField,
  llcCompleteSchema,
  llcDraftSchema,
  validateLlcStep,
} from "../../shared/llc";
import {
  ACCEPTED_BUSINESS_AGENT_ACK_VERSIONS,
  BUSINESS_AGENT_ACK,
  MAILING_AGENT_ACK,
  REGISTERED_AGENT_INCLUDED_LINE,
  STATES_REQUIRING_OWN_BUSINESS_ADDRESS,
  agentBusinessAddressBlockedReason,
  nonStreetAddressReason,
  resolveAddressModes,
} from "../../shared/llcAddress";
import {
  LLC_ADDRESS_COLUMN_SETS,
  addressChoiceNeeded,
  addressPlanForRow,
  llcAddressColumnStatements,
  withAddressChoiceEvidence,
} from "./addressChoices";
import { DoolaApiError, mapRegistrationToDoolaCompany } from "./doola";
import { bundleToDraft, bundleToOpsView, bundleToRegistrationView } from "./domain";
import { addressChoiceColumns } from "./store";
import { makePersistedBundle, validDraft } from "./test-fixtures";

const read = (relative: string) => readFileSync(join(__dirname, "..", "..", relative), "utf8");
const now = new Date("2026-10-14T18:00:00.000Z");

const ownAddress = {
  companyAddressLine1: "500 Main St",
  companyAddressLine2: null,
  companyAddressCity: "Tulsa",
  companyAddressState: "OK",
  companyAddressPostalCode: "74103",
  companyAddressCountry: "US",
};

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
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
    mailingAddressMode: "customer",
    businessAgentAckAt: null,
    businessAgentAckVersion: null,
    mailingAgentAckAt: null,
    mailingAgentAckVersion: null,
    addressChoiceEvidence: null,
    ...ownAddress,
    expediteEin: false,
    accuracyAttested: true,
    whopAccountId: null,
    checkoutSessionId: "cs_1",
    retailPaidAt: now,
    lastErrorType: null,
    lastErrorMessage: null,
    retryable: false,
    submissionKey: "abc123",
    isTest: false,
    provider: "doola",
    doolaCustomerId: null,
    doolaCompanyId: null,
    ein: null,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as never;
}

/** The order of 2026-10-14 in shape (no personal data): the old switch on, nothing acknowledged, no address of the client's own. */
function legacyAgentRow(overrides: Record<string, unknown> = {}) {
  return makeRow({
    useRegisteredAgent: true,
    businessAddressMode: null,
    mailingAddressMode: null,
    companyAddressLine1: null,
    companyAddressCity: null,
    companyAddressState: null,
    companyAddressPostalCode: null,
    ...overrides,
  });
}

function makeFounder() {
  return {
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
    createdAt: now,
    updatedAt: now,
  } as never;
}

type Entry = { provider: string; type: string; address?: Record<string, unknown> };

describe("payload: business and mailing are mapped independently", () => {
  const acks = {
    businessAgentAckVersion: BUSINESS_AGENT_ACK.version,
    businessAgentAckAt: now,
    mailingAgentAckVersion: MAILING_AGENT_ACK.version,
    mailingAgentAckAt: now,
  };
  const combos: Array<{ business: string; mailing: string; expected: Entry[] }> = [
    {
      business: "customer",
      mailing: "customer",
      expected: [
        { provider: "customer", type: "mailing" },
        { provider: "customer", type: "business" },
      ],
    },
    {
      business: "customer",
      mailing: "registered_agent",
      expected: [
        { provider: "registeredAgent", type: "mailing" },
        { provider: "customer", type: "business" },
      ],
    },
    {
      business: "registered_agent",
      mailing: "customer",
      expected: [
        { provider: "customer", type: "mailing" },
        { provider: "registeredAgent", type: "business" },
      ],
    },
    {
      business: "registered_agent",
      mailing: "registered_agent",
      expected: [
        { provider: "registeredAgent", type: "mailing" },
        { provider: "registeredAgent", type: "business" },
      ],
    },
  ];

  const baseline = mapRegistrationToDoolaCompany(makeRow(), [makeFounder()], "dc_1");

  for (const combo of combos) {
    it(`business=${combo.business}, mailing=${combo.mailing}`, () => {
      const company = mapRegistrationToDoolaCompany(
        makeRow({ businessAddressMode: combo.business, mailingAddressMode: combo.mailing, ...acks }),
        [makeFounder()],
        "dc_1",
      );
      const addresses = company.addresses as Entry[];
      expect(addresses.map(({ provider, type }) => ({ provider, type }))).toEqual(combo.expected);
      for (const entry of addresses) {
        if (entry.provider === "customer") {
          expect(entry.address).toEqual({
            line1: "500 Main St",
            city: "Tulsa",
            state: "OK",
            postalCode: "74103",
            country: "USA",
            phone: "+19185550100",
          });
        } else {
          expect(entry).not.toHaveProperty("address");
        }
      }
      // Responsible party, members, and the services on the order (the
      // agent service is attached by the provider to every company) do not
      // change with the address choices.
      expect(company.responsibleParty).toEqual(baseline.responsibleParty);
      expect(company.members).toEqual(baseline.members);
      expect(company.requestedServices).toEqual(baseline.requestedServices);
      expect(company.state).toBe("OK");
    });
  }

  it("the new default (the client's address for both) needs no acknowledgment", () => {
    expect(addressPlanForRow(makeRow()).issues).toEqual([]);
  });
});

describe("the old-switch order of 2026-10-14 is refused", () => {
  it("old switch on, nothing acknowledged: the plan has issues and the payload is never built", () => {
    const plan = addressPlanForRow(legacyAgentRow());
    expect(plan.source).toBe("legacy");
    expect(plan.business).toBe("registered_agent");
    expect(plan.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["business_agent_ack_missing", "mailing_agent_ack_missing"]),
    );
    expect(() => mapRegistrationToDoolaCompany(legacyAgentRow(), [makeFounder()], "dc_1")).toThrow(DoolaApiError);
    try {
      mapRegistrationToDoolaCompany(legacyAgentRow(), [makeFounder()], "dc_1");
    } catch (error) {
      expect((error as DoolaApiError).code).toBe("E_ADDRESS_CHOICE");
      expect((error as DoolaApiError).retryable).toBe(false);
    }
  });

  it("the stored agent opt-in without its acknowledgment is refused too", () => {
    const row = makeRow({ businessAddressMode: "registered_agent", mailingAddressMode: "customer" });
    expect(addressPlanForRow(row).issues.map((issue) => issue.code)).toEqual(["business_agent_ack_missing"]);
    expect(() => mapRegistrationToDoolaCompany(row, [makeFounder()], "dc_1")).toThrow(/business_agent_ack_missing/);
  });

  it("the status page asks the client to choose while the order has not reached the filing service", () => {
    expect(addressChoiceNeeded(legacyAgentRow())).toBe(true);
    expect(addressChoiceNeeded(legacyAgentRow({ status: "failed" }))).toBe(true);
    // Filed, completed, test or uncertain rows are never reopened.
    expect(addressChoiceNeeded(legacyAgentRow({ doolaCompanyId: "dc_9" }))).toBe(false);
    expect(addressChoiceNeeded(legacyAgentRow({ status: "completed" }))).toBe(false);
    expect(addressChoiceNeeded(legacyAgentRow({ isTest: true }))).toBe(false);
    expect(addressChoiceNeeded(legacyAgentRow({ status: "failed", lastErrorType: "uncertain_e_timeout" }))).toBe(false);
    // An order still on the legacy filing leg is not part of this flow.
    expect(addressChoiceNeeded(legacyAgentRow({ provider: "whop" }))).toBe(false);
    // A valid order is never asked.
    expect(addressChoiceNeeded(makeRow())).toBe(false);
  });

  it("final validation refuses the same choices as a draft", () => {
    const result = llcCompleteSchema.safeParse({
      ...validDraft,
      formationState: "OK",
      businessAddressMode: "registered_agent",
      mailingAddressMode: "registered_agent",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = issuesByField(result.error);
      expect(fields.businessAgentAckVersion).toMatch(/check the box/i);
      expect(fields.mailingAgentAckVersion).toMatch(/check the box/i);
    }
  });
});

describe("state blocks", () => {
  it("Illinois and Idaho never take the agent's address as the business address", () => {
    expect(Object.keys(STATES_REQUIRING_OWN_BUSINESS_ADDRESS).sort()).toEqual(["ID", "IL"]);
    for (const state of ["IL", "ID", "il"]) {
      expect(agentBusinessAddressBlockedReason(state)).toMatch(/own street address/);
      const step = validateLlcStep(3, {
        ...validDraft,
        formationState: state.toUpperCase(),
        businessAddressMode: "registered_agent",
        businessAgentAckVersion: BUSINESS_AGENT_ACK.version,
      });
      expect(step.success).toBe(false);
      if (!step.success) expect(issuesByField(step.error).businessAddressMode).toMatch(/does not accept|only in rare cases/);
    }
    const illinois = makeRow({
      formationState: "IL",
      businessAddressMode: "registered_agent",
      businessAgentAckVersion: BUSINESS_AGENT_ACK.version,
      businessAgentAckAt: now,
    });
    expect(addressPlanForRow(illinois).issues.map((issue) => issue.code)).toEqual(["state_requires_own_business_address"]);
    expect(() => mapRegistrationToDoolaCompany(illinois, [makeFounder()], "dc_1")).toThrow(DoolaApiError);
  });

  it("other states allow the opt-in once acknowledged, and mail at the agent is allowed everywhere", () => {
    for (const state of ["OK", "GA", "WY", "CA", "TX"]) {
      expect(agentBusinessAddressBlockedReason(state)).toBeNull();
      expect(
        validateLlcStep(3, {
          ...validDraft,
          formationState: state,
          businessAddressMode: "registered_agent",
          businessAgentAckVersion: BUSINESS_AGENT_ACK.version,
        }).success,
      ).toBe(true);
    }
    expect(
      validateLlcStep(3, {
        ...validDraft,
        formationState: "IL",
        mailingAddressMode: "registered_agent",
        mailingAgentAckVersion: MAILING_AGENT_ACK.version,
      }).success,
    ).toBe(true);
  });
});

describe("defaults for new and old drafts", () => {
  it("a new draft defaults to the client's own address for the business address and for mail", () => {
    const draft = llcDraftSchema.parse({ currentStep: 1, founders: [] });
    expect(draft.businessAddressMode).toBe("customer");
    expect(draft.mailingAddressMode).toBe("customer");
    expect(draft.businessAgentAckVersion).toBe("");
    expect(draft.mailingAgentAckVersion).toBe("");
  });

  it("an old client sending only useRegisteredAgent: true gets its own address, not the agent's", () => {
    const draft = llcDraftSchema.parse({ ...validDraft, businessAddressMode: undefined, mailingAddressMode: undefined, useRegisteredAgent: true });
    expect(draft.businessAddressMode).toBe("customer");
    expect(draft.mailingAddressMode).toBe("customer");
    // The saved switch is derived from the modes, never taken from the client.
    expect(addressChoiceColumns(draft, {}, now).useRegisteredAgent).toBe(false);
    // And with no address, Step 3 stops the client: its own address is required.
    const step = validateLlcStep(3, {
      ...draft,
      companyAddress: { line1: "", line2: "", city: "", state: "", postalCode: "", country: "US" },
    });
    expect(step.success).toBe(false);
    if (!step.success) expect(issuesByField(step.error)["companyAddress.line1"]).toMatch(/required/i);
  });

  it("an old draft row with the switch on opens Step 3 on the client's own address", () => {
    const bundle = makePersistedBundle("draft");
    Object.assign(bundle.registration, {
      useRegisteredAgent: true,
      companyAddressLine1: null,
      companyAddressCity: null,
      companyAddressState: null,
      companyAddressPostalCode: null,
    });
    const draft = bundleToDraft(bundle as never);
    expect(draft.businessAddressMode).toBe("customer");
    expect(draft.mailingAddressMode).toBe("customer");
    expect(draft.useRegisteredAgent).toBe(false);
    expect(validateLlcStep(3, draft).success).toBe(false);
  });

  it("a completed order from before the fix still shows what it was filed with", () => {
    const bundle = makePersistedBundle("completed");
    Object.assign(bundle.registration, { useRegisteredAgent: true, checkoutSessionId: "cs_1" });
    const draft = bundleToDraft(bundle as never);
    expect(draft.businessAddressMode).toBe("registered_agent");
    expect(draft.mailingAddressMode).toBe("registered_agent");
    expect(draft.useRegisteredAgent).toBe(true);
    expect(resolveAddressModes({ useRegisteredAgent: false }, { legacyFallback: true }).business).toBe("customer");
  });

  it("stored modes and the current acknowledgment round-trip; a stale wording version asks again", () => {
    const bundle = makePersistedBundle("draft");
    Object.assign(bundle.registration, {
      businessAddressMode: "customer",
      mailingAddressMode: "registered_agent",
      mailingAgentAckVersion: MAILING_AGENT_ACK.version,
      mailingAgentAckAt: now,
    });
    expect(bundleToDraft(bundle as never)).toMatchObject({
      businessAddressMode: "customer",
      mailingAddressMode: "registered_agent",
      mailingAgentAckVersion: MAILING_AGENT_ACK.version,
      useRegisteredAgent: false,
    });
    Object.assign(bundle.registration, { mailingAgentAckVersion: "mailing-agent-2020-01-01" });
    expect(bundleToDraft(bundle as never).mailingAgentAckVersion).toBe("");
  });
});

describe("acknowledgments", () => {
  it("each opt-in needs its own checkbox, under the current wording", () => {
    const businessOnly = validateLlcStep(3, { ...validDraft, businessAddressMode: "registered_agent" });
    expect(businessOnly.success).toBe(false);
    if (!businessOnly.success) expect(Object.keys(issuesByField(businessOnly.error))).toEqual(["businessAgentAckVersion"]);

    const mailOnly = validateLlcStep(3, { ...validDraft, mailingAddressMode: "registered_agent" });
    expect(mailOnly.success).toBe(false);
    if (!mailOnly.success) expect(Object.keys(issuesByField(mailOnly.error))).toEqual(["mailingAgentAckVersion"]);

    const stale = validateLlcStep(3, {
      ...validDraft,
      businessAddressMode: "registered_agent",
      businessAgentAckVersion: "business-agent-2020-01-01",
    });
    expect(stale.success).toBe(false);

    expect(
      validateLlcStep(3, {
        ...validDraft,
        businessAddressMode: "registered_agent",
        businessAgentAckVersion: BUSINESS_AGENT_ACK.version,
        mailingAddressMode: "registered_agent",
        mailingAgentAckVersion: MAILING_AGENT_ACK.version,
      }).success,
    ).toBe(true);
  });

  it("the server stamps the time and version, keeps the first time, and clears both when the client picks its own address", () => {
    const first = addressChoiceColumns(
      { businessAddressMode: "registered_agent", mailingAddressMode: "customer", businessAgentAckVersion: BUSINESS_AGENT_ACK.version, mailingAgentAckVersion: "" },
      {},
      now,
    );
    expect(first).toMatchObject({
      businessAddressMode: "registered_agent",
      mailingAddressMode: "customer",
      businessAgentAckVersion: BUSINESS_AGENT_ACK.version,
      businessAgentAckAt: now,
      mailingAgentAckVersion: null,
      mailingAgentAckAt: null,
      useRegisteredAgent: false,
    });
    const later = new Date(now.getTime() + 60_000);
    const resaved = addressChoiceColumns(
      { businessAddressMode: "registered_agent", mailingAddressMode: "customer", businessAgentAckVersion: BUSINESS_AGENT_ACK.version, mailingAgentAckVersion: "" },
      first,
      later,
    );
    expect(resaved.businessAgentAckAt).toBe(now);
    const unknownVersion = addressChoiceColumns(
      { businessAddressMode: "registered_agent", mailingAddressMode: "customer", businessAgentAckVersion: "made-up", mailingAgentAckVersion: "" },
      {},
      now,
    );
    expect(unknownVersion.businessAgentAckVersion).toBeNull();
    const backToOwn = addressChoiceColumns(
      { businessAddressMode: "customer", mailingAddressMode: "customer", businessAgentAckVersion: BUSINESS_AGENT_ACK.version, mailingAgentAckVersion: "" },
      first,
      later,
    );
    expect(backToOwn).toMatchObject({ businessAgentAckVersion: null, businessAgentAckAt: null });
    expect(
      addressChoiceColumns(
        { businessAddressMode: "registered_agent", mailingAddressMode: "registered_agent", businessAgentAckVersion: BUSINESS_AGENT_ACK.version, mailingAgentAckVersion: MAILING_AGENT_ACK.version },
        {},
        now,
      ).useRegisteredAgent,
    ).toBe(true);
  });

  it("an order acknowledged under any wording version still listed files", () => {
    expect(ACCEPTED_BUSINESS_AGENT_ACK_VERSIONS).toContain(BUSINESS_AGENT_ACK.version);
    const row = makeRow({
      businessAddressMode: "registered_agent",
      businessAgentAckVersion: ACCEPTED_BUSINESS_AGENT_ACK_VERSIONS[0],
      businessAgentAckAt: now,
    });
    expect(addressPlanForRow(row).issues).toEqual([]);
  });
});

describe("the client's own address must be a full street address", () => {
  it("refuses a PO box or c/o and requires the business phone", () => {
    for (const line1 of ["PO Box 12", "P.O. Box 9", "p o box 4", "Post Office Box 1", "POB 77"]) {
      expect(nonStreetAddressReason(line1)).toBe("po_box");
      const step = validateLlcStep(3, { ...validDraft, companyAddress: { ...validDraft.companyAddress, line1 } });
      expect(step.success).toBe(false);
      if (!step.success) expect(issuesByField(step.error)["companyAddress.line1"]).toMatch(/PO box/);
    }
    for (const line of ["c/o Jane Smith", "C/O Agent Inc", "Care of the studio"]) {
      expect(nonStreetAddressReason(line)).toBe("care_of");
    }
    const careOfLine2 = validateLlcStep(3, { ...validDraft, companyAddress: { ...validDraft.companyAddress, line2: "c/o Front desk" } });
    expect(careOfLine2.success).toBe(false);
    for (const line1 of ["100 Main Street", "12 Post Road", "88 Boxwood Lane", "4 Pocono Way"]) {
      expect(nonStreetAddressReason(line1)).toBeNull();
    }
    const noPhone = validateLlcStep(3, { ...validDraft, businessPhone: "" });
    expect(noPhone.success).toBe(false);
    if (!noPhone.success) expect(issuesByField(noPhone.error).businessPhone).toMatch(/business phone is required/i);
    const incomplete = addressPlanForRow(makeRow({ companyAddressCity: null }));
    expect(incomplete.issues.map((issue) => issue.code)).toEqual(["address_incomplete"]);
    const poBoxRow = makeRow({ companyAddressLine1: "PO Box 12" });
    expect(() => mapRegistrationToDoolaCompany(poBoxRow, [makeFounder()], "dc_1")).toThrow(/address_not_street/);
  });

  it("with both addresses at the agent (acknowledged), no address or phone of the client's own is needed", () => {
    const row = legacyAgentRow({
      businessPhone: null,
      businessAddressMode: "registered_agent",
      mailingAddressMode: "registered_agent",
      businessAgentAckVersion: BUSINESS_AGENT_ACK.version,
      businessAgentAckAt: now,
      mailingAgentAckVersion: MAILING_AGENT_ACK.version,
      mailingAgentAckAt: now,
    });
    expect(addressPlanForRow(row).issues).toEqual([]);
  });
});

describe("evidence on the order", () => {
  it("records modes, wording versions and times, never address text", () => {
    const row = makeRow({
      mailingAddressMode: "registered_agent",
      mailingAgentAckVersion: MAILING_AGENT_ACK.version,
      mailingAgentAckAt: now,
    });
    const evidence = withAddressChoiceEvidence(row, "submitted", now);
    expect(evidence.submitted).toEqual({
      at: now.toISOString(),
      formationState: "OK",
      business: "customer",
      mailing: "registered_agent",
      modesSource: "stored",
      businessAgentAckVersion: null,
      businessAgentAckAt: null,
      mailingAgentAckVersion: MAILING_AGENT_ACK.version,
      mailingAgentAckAt: now.toISOString(),
    });
    const sent = withAddressChoiceEvidence({ ...(row as object), addressChoiceEvidence: evidence } as never, "sent", now);
    expect(Object.keys(sent).sort()).toEqual(["sent", "submitted"]);
    const text = JSON.stringify(sent);
    for (const fragment of ["500 Main", "Tulsa", "74103", "9185550100"]) expect(text).not.toContain(fragment);
  });

  it("the submit lock and the filing lock both write it", () => {
    const submission = read("server/llc/submission.ts");
    const lockStart = submission.indexOf('note: "Acquired the single-flight Whop submission lock"');
    expect(lockStart).toBeGreaterThan(-1);
    expect(submission.indexOf('addressChoiceEvidence: withAddressChoiceEvidence(existing, "submitted")', lockStart)).toBeGreaterThan(lockStart);
    const filing = read("server/llc/doolaSubmission.ts");
    const start = filing.indexOf("export async function fileDoolaRegistration");
    const gate = filing.indexOf("addressPlanForRow(registration)", start);
    const lock = filing.indexOf('toStatus: "submitting"', start);
    const evidence = filing.indexOf('addressChoiceEvidence: withAddressChoiceEvidence(registration, "sent")', start);
    const customer = filing.indexOf("createDoolaCustomer", lock);
    expect(gate).toBeGreaterThan(start);
    expect(gate).toBeLessThan(lock);
    expect(evidence).toBeGreaterThan(lock);
    expect(evidence).toBeLessThan(customer);
  });
});

describe("schema guard", () => {
  it("adds every new column NULL-able through the boot-time ensure guard", () => {
    const columns = LLC_ADDRESS_COLUMN_SETS[0];
    expect(columns.table).toBe("llc_registrations");
    expect(columns.columns.map(([name]) => name)).toEqual([
      "businessAddressMode",
      "mailingAddressMode",
      "businessAgentAckAt",
      "businessAgentAckVersion",
      "mailingAgentAckAt",
      "mailingAgentAckVersion",
      "addressChoiceEvidence",
    ]);
    for (const [, definition] of columns.columns) expect(definition).toMatch(/NULL$/);
    expect(llcAddressColumnStatements()).toEqual([
      "ALTER TABLE `llc_registrations` ADD `businessAddressMode` varchar(24) NULL",
      "ALTER TABLE `llc_registrations` ADD `mailingAddressMode` varchar(24) NULL",
      "ALTER TABLE `llc_registrations` ADD `businessAgentAckAt` timestamp NULL",
      "ALTER TABLE `llc_registrations` ADD `businessAgentAckVersion` varchar(64) NULL",
      "ALTER TABLE `llc_registrations` ADD `mailingAgentAckAt` timestamp NULL",
      "ALTER TABLE `llc_registrations` ADD `mailingAgentAckVersion` varchar(64) NULL",
      "ALTER TABLE `llc_registrations` ADD `addressChoiceEvidence` json NULL",
    ]);
    const ensure = read("server/llc/ensure-tables.ts");
    // Pin moved (2026-10-14): the guard no longer swallows every failure of the new columns; a duplicate-column error stays silent and anything else is logged by column name (see addressChoices.schemaGuard.test.ts) (owner: an LLC was filed with the registered agent's address as its business address; fix it in every app).
    const loop = ensure.indexOf("await ensureAddressColumns(");
    expect(loop).toBeGreaterThan(-1);
    // Idempotent like every other column added after launch, after the table
    // and its older columns, inside the guarded boot check.
    expect(ensure.slice(loop, loop + 200)).toContain("db.execute(sql.raw(statement))");
    expect(loop).toBeGreaterThan(ensure.indexOf("ADD `statusToken` varchar(64)"));
    expect(loop).toBeLessThan(ensure.indexOf('console.error("[LLC] ensureLlcTables failed:"'));
    // And the drizzle schema carries the same columns.
    const schema = read("drizzle/schema.ts");
    for (const [name] of columns.columns) expect(schema).toContain(`${name}: `);
  });
});

describe("client copy", () => {
  const files = [
    "client/src/components/llc-formation/AddressChoiceFields.tsx",
    "client/src/components/llc-formation/ConfirmAddressCard.tsx",
    "shared/llcAddress.ts",
  ];

  it("never names the filing or payment provider and has no em dashes in the new copy", () => {
    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(/doola|whop/i);
      expect(source, file).not.toContain("—");
    }
    for (const text of [
      BUSINESS_AGENT_ACK.text,
      MAILING_AGENT_ACK.text,
      REGISTERED_AGENT_INCLUDED_LINE,
      ...Object.values(STATES_REQUIRING_OWN_BUSINESS_ADDRESS),
    ]) {
      expect(text).not.toMatch(/doola|whop|—/i);
    }
    // Step 3 in the wizard file.
    const steps = read("client/src/components/llc-formation/WizardSteps.tsx");
    const step3 = steps.slice(steps.indexOf("export function AddressAgentStep"), steps.indexOf("const emptyFounder"));
    expect(step3).not.toMatch(/doola|whop|—/i);
    expect(step3).toContain("<AddressChoiceFields");
  });

  it("the agent is stated as included in every case, and the false copy is gone", () => {
    const fields = read("client/src/components/llc-formation/AddressChoiceFields.tsx");
    expect(fields).toContain("<RegisteredAgentIncluded />");
    expect(fields).toContain("Your business address (principal place of business)");
    expect(fields).toContain("Use the registered agent's address instead");
    expect(fields).toContain("Where should mail and your EIN letter go?");
    expect(fields).toContain("Send it to the registered agent and show it to me in my account");
    expect(fields).toContain("Your IRS EIN letter will then show the registered agent's address.");
    expect(BUSINESS_AGENT_ACK.text).toBe(
      "I understand my company's principal place of business on my state filing will be the registered agent's address, not mine. Banks may ask for proof of my own address, and changing it later is a paid state amendment.",
    );
    for (const file of [
      "client/src/components/llc-formation/WizardSteps.tsx",
      "client/src/pages/llc/FormationWizard.tsx",
      "client/src/pages/llc/FormationStatus.tsx",
      "client/src/components/llc-formation/AddressChoiceFields.tsx",
    ]) {
      const source = read(file);
      expect(source, file).not.toContain("You handle legal mail yourself");
      expect(source, file).not.toContain("Your own registered-agent address");
      expect(source, file).not.toContain("Company-provided address");
      expect(source, file).not.toContain("Company mailing address");
      expect(source, file).not.toContain("instead of our registered agent");
      expect(source, file).not.toContain("if you choose one");
      expect(source, file).not.toMatch(/draft\.useRegisteredAgent/);
    }
  });

  it("the review shows both lines above the accuracy confirmation, and the status page shows them too", () => {
    const steps = read("client/src/components/llc-formation/WizardSteps.tsx");
    const review = steps.slice(steps.indexOf("export function ReviewStep"));
    const principal = review.indexOf("Principal place of business");
    const mail = review.indexOf("Mail and EIN letter go to");
    const attest = review.indexOf('id="accuracyAttested"');
    expect(principal).toBeGreaterThan(-1);
    expect(mail).toBeGreaterThan(-1);
    expect(principal).toBeLessThan(attest);
    expect(mail).toBeLessThan(attest);
    expect(review).toContain('value="Professional registered agent (included)"');
    // And again inside the confirmation box itself, right above the checkbox.
    const box = review.slice(
      review.indexOf('<div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-5">'),
      attest,
    );
    expect(box).toContain('<dt className="font-semibold text-foreground">Principal place of business</dt>');
    expect(box).toContain("{addressSummary.principal}");
    expect(box).toContain('<dt className="font-semibold text-foreground">Mail and EIN letter go to</dt>');
    expect(box).toContain("{addressSummary.mail}");
    const status = read("client/src/pages/llc/FormationStatus.tsx");
    expect(status).toContain("Principal place of business");
    expect(status).toContain("Mail and EIN letter go to");
    expect(status).toContain("Professional registered agent (included)");
    expect(status).toContain("{registration.addressChoiceNeeded ? (");
    // The order sidebar lists the agent as included in every mode.
    const wizard = read("client/src/pages/llc/FormationWizard.tsx");
    expect(wizard).toContain("<SummaryItem included>Professional registered agent</SummaryItem>");
  });

  it("the client view of a held order carries no provider names", () => {
    const bundle = makePersistedBundle("payment_required");
    Object.assign(bundle.registration, {
      useRegisteredAgent: true,
      provider: "doola",
      doolaCompanyId: null,
      isTest: false,
      checkoutSessionId: "cs_1",
      formationState: "OK",
    });
    const view = bundleToRegistrationView(bundle as never);
    expect(view.addressChoiceNeeded).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/doola|whop/i);
  });
});

describe("ops view and admin page", () => {
  it("the ops view flags a held order with its modes and evidence, never address text", () => {
    const bundle = makePersistedBundle("payment_required");
    Object.assign(bundle.registration, {
      useRegisteredAgent: true,
      provider: "doola",
      doolaCompanyId: null,
      isTest: false,
      checkoutSessionId: "cs_1",
      formationState: "OK",
      addressChoiceEvidence: null,
    });
    const view = bundleToOpsView(bundle as never);
    expect(view.addressChoiceNeeded).toBe(true);
    expect(view.addressModes).toEqual({ business: "registered_agent", mailing: "registered_agent", source: "legacy" });
    expect(view.addressChoiceEvidence).toBeNull();
  });

  it("/admin/llc badges held orders and shows the modes in the order panel", () => {
    const ops = read("client/src/pages/admin/LlcOpsPage.tsx");
    expect(ops).toContain("Address choice needed");
    expect(ops).toContain("<AddressChoicesLine order={order} />");
    expect(ops.toLowerCase()).not.toContain("doola");
    const router = read("server/llc/router.ts");
    const listAll = router.slice(router.indexOf("listAll: adminProcedure"), router.indexOf("get: adminProcedure"));
    expect(listAll).toContain("addressChoiceNeeded: addressChoiceNeeded(registration)");
    expect(listAll).toContain("addressModes: addressModesForOps(registration)");
  });
});

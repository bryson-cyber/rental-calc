/**
 * Address choices, client clarity (2026-10-14; owner: an LLC was filed with
 * the registered agent's address as its business address; fix it in every
 * app). These pins hold what the client sees and what the browser does
 * around Step 3:
 *  - the wizard's copy of the draft stays equal to what the server saves back,
 *    so autosave does not save again and again while the client is on Step 3;
 *  - picking a state that refuses the agent's address after choosing it
 *    falls back to the client's own street address, instead of Step 3 showing
 *    the agent's address chosen next to "your own street address is used";
 *  - a phone typed wrong is called wrong, not "required";
 *  - the review never shows an address line not entered yet as if it were set;
 *  - the "confirm your choices" card on the status page only promises that
 *    the filing starts on save when it really does (the payment is in).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { issuesByField, llcDraftSchema, validateLlcStep } from "../../shared/llc";
import {
  BUSINESS_AGENT_ACK,
  MAILING_AGENT_ACK,
  addressChoiceSummary,
  withAddressChoices,
  withFormationState,
  type LlcAddressMode,
} from "../../shared/llcAddress";
import { bundleToDraft, bundleToRegistrationView } from "./domain";
import { addressChoiceColumns } from "./store";
import { makePersistedBundle, validDraft } from "./test-fixtures";

const read = (relative: string) => readFileSync(join(__dirname, "..", "..", relative), "utf8");
const now = new Date("2026-10-14T18:00:00.000Z");

const combos: Array<{ business: LlcAddressMode; mailing: LlcAddressMode }> = [
  { business: "customer", mailing: "customer" },
  { business: "customer", mailing: "registered_agent" },
  { business: "registered_agent", mailing: "customer" },
  { business: "registered_agent", mailing: "registered_agent" },
];

function choicesFor(combo: { business: LlcAddressMode; mailing: LlcAddressMode }) {
  return {
    businessAddressMode: combo.business,
    mailingAddressMode: combo.mailing,
    businessAgentAckVersion: combo.business === "registered_agent" ? BUSINESS_AGENT_ACK.version : "",
    mailingAgentAckVersion: combo.mailing === "registered_agent" ? MAILING_AGENT_ACK.version : "",
    companyAddress: validDraft.companyAddress,
    businessPhone: validDraft.businessPhone,
  };
}

/** What saveDraft returns for a client draft: parse, store the derived columns, read back. */
function serverRoundTrip(bundle: ReturnType<typeof makePersistedBundle>, clientDraft: unknown) {
  const parsed = llcDraftSchema.parse(clientDraft);
  const saved = {
    ...bundle,
    registration: { ...bundle.registration, ...addressChoiceColumns(parsed, bundle.registration as never, now) },
  };
  return bundleToDraft(saved as never);
}

describe("Step 3 and the wizard's autosave", () => {
  for (const start of combos) {
    for (const next of combos) {
      it(`from ${start.business}/${start.mailing} to ${next.business}/${next.mailing}, the draft equals what the server saves back`, () => {
        // Hydrate the wizard from a saved draft, as FormationWizard does.
        const bundle = makePersistedBundle("draft");
        Object.assign(bundle.registration, addressChoiceColumns(choicesFor(start), {}, now));
        const hydrated = bundleToDraft(bundle as never);

        // The client changes Step 3. The wizard keeps this object and
        // compares it, serialized, with the last saved draft to decide
        // whether to save.
        const clientDraft = withAddressChoices(hydrated, choicesFor(next));
        const savedBack = serverRoundTrip(bundle, clientDraft);
        expect(JSON.stringify(clientDraft)).toBe(JSON.stringify(savedBack));
      });
    }
  }

  it("a plain merge (the bug) leaves the old switch stale, so every save looked unsaved", () => {
    const bundle = makePersistedBundle("draft");
    const hydrated = bundleToDraft(bundle as never);
    const plain = { ...hydrated, ...choicesFor({ business: "registered_agent", mailing: "registered_agent" }) };
    const savedBack = serverRoundTrip(bundle, plain);
    expect(plain.useRegisteredAgent).toBe(false);
    expect(savedBack.useRegisteredAgent).toBe(true);
  });

  it("Step 3 merges the choices through withAddressChoices", () => {
    const steps = read("client/src/components/llc-formation/WizardSteps.tsx");
    const step3 = steps.slice(steps.indexOf("export function AddressAgentStep"), steps.indexOf("const emptyFounder"));
    expect(step3).toContain("onChange={(choices) => onChange(withAddressChoices(draft, choices))}");
  });
});

describe("changing the formation state after choosing the agent's address", () => {
  const agentBoth = withAddressChoices(validDraft, choicesFor({ business: "registered_agent", mailing: "registered_agent" }));

  it("moving to a state that refuses it falls back to the client's own street address and clears that checkbox", () => {
    const moved = withFormationState(agentBoth, "IL");
    expect(moved).toMatchObject({
      formationState: "IL",
      businessAddressMode: "customer",
      businessAgentAckVersion: "",
      // Mail at the agent is allowed everywhere and stays as chosen.
      mailingAddressMode: "registered_agent",
      mailingAgentAckVersion: MAILING_AGENT_ACK.version,
      useRegisteredAgent: false,
    });
    // Step 3 then asks for the street address instead of showing the agent's
    // address picked next to "your own street address is used".
    expect(validateLlcStep(3, { ...moved, companyAddress: { ...validDraft.companyAddress, line1: "" } }).success).toBe(false);
    expect(validateLlcStep(3, moved).success).toBe(true);
    // And what the server saves back matches, so autosave settles.
    const bundle = makePersistedBundle("draft");
    Object.assign(bundle.registration, { formationState: "IL" });
    expect(JSON.stringify(serverRoundTrip(bundle, { ...bundleToDraft(bundle as never), ...moved }))).toBe(
      JSON.stringify({ ...bundleToDraft(bundle as never), ...moved }),
    );
  });

  it("a state that allows it keeps the choice", () => {
    expect(withFormationState(agentBoth, "OK")).toEqual({ ...agentBoth, formationState: "OK" });
  });

  it("Step 1's state picker goes through withFormationState", () => {
    const steps = read("client/src/components/llc-formation/WizardSteps.tsx");
    const step1 = steps.slice(steps.indexOf("export function BusinessStep"), steps.indexOf("export function ActivityStep"));
    expect(step1).toContain("onChange={(event) => onChange(withFormationState(draft, event.target.value))}");
    // Step 1's phone help no longer says the phone is only for "instead of our registered agent".
    expect(step1).toContain("Needed with your own address in Step 3.");
  });
});

describe("Step 3 phone message", () => {
  it("a phone typed wrong is called wrong, not missing", () => {
    const wrong = validateLlcStep(3, { ...validDraft, businessPhone: "555-0100" });
    expect(wrong.success).toBe(false);
    if (!wrong.success) {
      expect(issuesByField(wrong.error).businessPhone).toBe(
        "Enter a 10-digit US number, or include a + country code for international numbers",
      );
    }
    const empty = validateLlcStep(3, { ...validDraft, businessPhone: "" });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(issuesByField(empty.error).businessPhone).toBe(
        "A business phone is required when using your own company address",
      );
    }
    expect(validateLlcStep(3, { ...validDraft, businessPhone: "(702) 555-0100" }).success).toBe(true);
  });
});

describe("review lines", () => {
  const empty = { line1: "", line2: "", city: "", state: "", postalCode: "", country: "US" };

  it("the client's own address lines show the address when entered", () => {
    expect(
      addressChoiceSummary({ businessAddressMode: "customer", mailingAddressMode: "customer", companyAddress: validDraft.companyAddress }),
    ).toEqual({ principal: "100 Main Street, Suite 4, Cheyenne, WY, 82001", mail: "Your business address" });
    expect(
      addressChoiceSummary({ businessAddressMode: "registered_agent", mailingAddressMode: "customer", companyAddress: validDraft.companyAddress }),
    ).toEqual({ principal: "The registered agent's address", mail: "100 Main Street, Suite 4, Cheyenne, WY, 82001" });
    expect(
      addressChoiceSummary({ businessAddressMode: "customer", mailingAddressMode: "registered_agent", companyAddress: validDraft.companyAddress }),
    ).toEqual({ principal: "100 Main Street, Suite 4, Cheyenne, WY, 82001", mail: "The registered agent, shown in your account" });
  });

  it("a line that needs an address not entered yet says so, instead of looking set", () => {
    // An old draft resumed past Step 3 opens on the client's own address with no address yet.
    expect(addressChoiceSummary({ businessAddressMode: "customer", mailingAddressMode: "customer", companyAddress: empty }).principal).toBe(
      "Not entered yet",
    );
    expect(addressChoiceSummary({ businessAddressMode: "registered_agent", mailingAddressMode: "customer", companyAddress: empty }).mail).toBe(
      "Not entered yet",
    );
  });

  it("the wizard and the status page use the shared summary", () => {
    expect(read("client/src/components/llc-formation/AddressChoiceFields.tsx")).toContain(
      'export { addressChoiceSummary } from "@shared/llcAddress";',
    );
    expect(read("client/src/components/llc-formation/WizardSteps.tsx")).toContain(
      "const addressSummary = addressChoiceSummary(draft);",
    );
    expect(read("client/src/pages/llc/FormationStatus.tsx")).toContain(
      "addressChoiceSummary(registration.draft).principal",
    );
  });
});

describe("Step 3 controls", () => {
  it("option cards and acknowledgments are 44px tap targets and the blocked option is a disabled button", () => {
    const fields = read("client/src/components/llc-formation/AddressChoiceFields.tsx");
    expect(fields).toContain('role="radio"');
    expect(fields).toContain("aria-checked={selected}");
    expect(fields).toContain("disabled={disabled}");
    expect(fields).toContain("disabled={Boolean(blockedReason)}");
    expect((fields.match(/min-h-11/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // No text under 12px in the new component.
    expect(fields).not.toMatch(/text-\[(?:9|10|11)px\]/);
    expect(read("client/src/components/llc-formation/ConfirmAddressCard.tsx")).not.toMatch(/text-\[(?:9|10|11)px\]/);
  });
});

describe("status page card for a held order", () => {
  function held(overrides: Record<string, unknown>) {
    const bundle = makePersistedBundle("payment_required");
    Object.assign(bundle.registration, {
      formationState: "OK",
      useRegisteredAgent: true,
      provider: "doola",
      doolaCompanyId: null,
      isTest: false,
      checkoutSessionId: "cs_1",
      ...overrides,
    });
    return bundleToRegistrationView(bundle as never);
  }

  it("says the filing starts on save only when the payment is in", () => {
    const unpaid = held({ retailPaidAt: null });
    expect(unpaid.addressChoiceNeeded).toBe(true);
    expect(unpaid.addressChoiceStartsFiling).toBe(false);
    const paid = held({ retailPaidAt: now });
    expect(paid.addressChoiceStartsFiling).toBe(true);
    // Same rule the confirm route uses to start the filing.
    expect(held({ retailPaidAt: now, status: "action_required" }).addressChoiceStartsFiling).toBe(false);

    const card = read("client/src/components/llc-formation/ConfirmAddressCard.tsx");
    expect(card).toContain("startsFilingOnSave");
    expect(card).toContain("Once you save these and your payment is in, we start your filing.");
    expect(card).not.toContain("address. Your filing starts as soon as you save.");
    const status = read("client/src/pages/llc/FormationStatus.tsx");
    expect(status).toContain("startsFilingOnSave={registration.addressChoiceStartsFiling}");
    expect(read("server/llc/router.ts")).toContain("filingStartsOnAddressConfirm(saved.registration)");
  });

  it("a held order's page never says nothing else is needed", () => {
    const status = read("client/src/pages/llc/FormationStatus.tsx");
    expect(status).toContain("const copy = registration.addressChoiceNeeded\n    ? ADDRESS_CHOICE_COPY");
    expect(status).toContain('title: "One quick choice before we file."');
    // The banner after a card payment asks for the choice instead of
    // promising the filing starts automatically.
    const banner = status.slice(status.indexOf('paymentReturn === "success" ? ('), status.indexOf('paymentReturn === "cancelled"'));
    expect(banner.indexOf("registration.addressChoiceNeeded")).toBeGreaterThan(-1);
    expect(banner.indexOf("registration.addressChoiceNeeded")).toBeLessThan(banner.indexOf("nothing else is needed from you"));
    const copy = status.slice(status.indexOf("const ADDRESS_CHOICE_COPY"), status.indexOf("/** Friendly labels"));
    expect(copy).not.toMatch(/doola|whop|—/i);
  });

  it("the card works from a tokenized email link too, like the required-action cards", () => {
    const status = read("client/src/pages/llc/FormationStatus.tsx");
    const cardUse = status.slice(status.indexOf("<ConfirmAddressCard"), status.indexOf("<ConfirmAddressCard") + 500);
    expect(cardUse).toContain("statusToken={statusToken}");
    const card = read("client/src/components/llc-formation/ConfirmAddressCard.tsx");
    expect(card).toContain("trpc.llc.confirmAddressChoicesByToken.useMutation");
    expect(card).toContain("trpc.llc.confirmAddressChoices.useMutation");
  });
});

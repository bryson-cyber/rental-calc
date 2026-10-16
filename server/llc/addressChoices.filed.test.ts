/**
 * Orders the filing service already has (2026-10-14; owner: an LLC was filed
 * with the registered agent's address as its business address; fix it in
 * every app). "Not editable" is not "submitted": a filed company that is in
 * action_required (name options, SS-4 signature) and was paid offline has no
 * checkout session, so the store still calls it editable. The page must still
 * say what was actually filed for it, never the new defaults.
 */
import { describe, expect, it } from "vitest";
import { addressChoiceSummary } from "../../shared/llcAddress";
import { bundleToDraft, bundleToRegistrationView } from "./domain";
import { makePersistedBundle } from "./test-fixtures";

function filedLegacyAgentOrder(overrides: Record<string, unknown> = {}) {
  const bundle = makePersistedBundle("action_required");
  Object.assign(bundle.registration, {
    provider: "doola",
    doolaCompanyId: "dc_filed_1",
    useRegisteredAgent: true,
    businessAddressMode: null,
    mailingAddressMode: null,
    checkoutSessionId: null,
    lastErrorType: null,
    companyAddressLine1: null,
    companyAddressLine2: null,
    companyAddressCity: null,
    companyAddressState: null,
    companyAddressPostalCode: null,
    ...overrides,
  });
  return bundle;
}

describe("a filed company in an editable status", () => {
  it("shows the registered agent's address it was filed with, not 'Not entered yet'", () => {
    const bundle = filedLegacyAgentOrder();
    const draft = bundleToDraft(bundle as never);

    expect(draft.businessAddressMode).toBe("registered_agent");
    expect(draft.mailingAddressMode).toBe("registered_agent");
    expect(draft.useRegisteredAgent).toBe(true);
    // Nothing is acknowledged under the current wording: it was not asked.
    expect(draft.businessAgentAckVersion).toBe("");
    expect(draft.mailingAgentAckVersion).toBe("");

    const summary = addressChoiceSummary(draft);
    expect(summary.principal).toBe("The registered agent's address");
    expect(summary.mail).toBe("The registered agent, shown in your account");
    // The page's own view agrees, and the order is not asked to choose again.
    const view = bundleToRegistrationView(bundle as never);
    expect(view.draft.businessAddressMode).toBe("registered_agent");
    expect(view.addressChoiceNeeded).toBe(false);
  });

  it("a filed own-address order still shows its own address", () => {
    const bundle = filedLegacyAgentOrder({
      useRegisteredAgent: false,
      companyAddressLine1: "500 Main St",
      companyAddressCity: "Tulsa",
      companyAddressState: "OK",
      companyAddressPostalCode: "74103",
    });
    const draft = bundleToDraft(bundle as never);
    expect(draft.businessAddressMode).toBe("customer");
    expect(draft.mailingAddressMode).toBe("customer");
    expect(addressChoiceSummary(draft).principal).toContain("500 Main St");
  });

  it("stored modes on a filed order are shown as stored", () => {
    const bundle = filedLegacyAgentOrder({
      useRegisteredAgent: false,
      businessAddressMode: "customer",
      mailingAddressMode: "registered_agent",
      companyAddressLine1: "500 Main St",
      companyAddressCity: "Tulsa",
      companyAddressState: "OK",
      companyAddressPostalCode: "74103",
    });
    const draft = bundleToDraft(bundle as never);
    expect(draft.businessAddressMode).toBe("customer");
    expect(draft.mailingAddressMode).toBe("registered_agent");
  });

  it("an old draft with no company yet still opens on the new defaults", () => {
    // The fix must not touch the other half: a draft or a not-yet-filed
    // editable order with the old switch on opens on the client's own address.
    const bundle = filedLegacyAgentOrder({ doolaCompanyId: null });
    const draft = bundleToDraft(bundle as never);
    expect(draft.businessAddressMode).toBe("customer");
    expect(draft.mailingAddressMode).toBe("customer");
    expect(draft.useRegisteredAgent).toBe(false);
  });
});

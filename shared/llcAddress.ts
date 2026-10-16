/**
 * LLC address choices (owner fix, 2026-10-14).
 *
 * The case: an Oklahoma LLC filed through a sibling app on this same filing
 * engine got the registered agent's office as its principal place of
 * business and as the address on the IRS EIN letter, because one switch
 * ("use the registered agent") decided the registered agent, the business
 * address AND where mail goes. Banks and lenders compare the filed principal
 * address and the EIN letter address with the owner's real business address,
 * so that costs the client. The owner asked for it to be fixed in every app.
 *
 * Now there are three separate facts:
 *  - Registered agent: ALWAYS the included professional agent (the filing
 *    service attaches one to every company; there is nothing to choose).
 *  - Business address (the principal place of business on the state filing):
 *    the client's own street address by default. The agent's address is an
 *    explicit opt-in, with a signed acknowledgment, and never offered where
 *    the state refuses it.
 *  - Mail and the EIN letter: the client's business address by default.
 *    Sending mail to the agent (scanned into the client's account) is an
 *    opt-in with its own acknowledgment.
 *
 * Client-facing copy in this file must never name the filing provider or the
 * payment provider (white-label is absolute; a test scans this file).
 */

export const LLC_ADDRESS_MODES = ["customer", "registered_agent"] as const;
export type LlcAddressMode = (typeof LLC_ADDRESS_MODES)[number];

export const DEFAULT_BUSINESS_ADDRESS_MODE: LlcAddressMode = "customer";
export const DEFAULT_MAILING_ADDRESS_MODE: LlcAddressMode = "customer";

/**
 * Acknowledgment wording, versioned. Change the text only together with a new
 * version, and keep the old version in the accepted list below so an order
 * that was acknowledged under it still files.
 */
export const BUSINESS_AGENT_ACK = {
  version: "business-agent-2026-10-14",
  text: "I understand my company's principal place of business on my state filing will be the registered agent's address, not mine. Banks may ask for proof of my own address, and changing it later is a paid state amendment.",
} as const;

export const MAILING_AGENT_ACK = {
  version: "mailing-agent-2026-10-14",
  text: "I understand my company's mail will go to the registered agent and show up in my account, and my IRS EIN letter will show the registered agent's address, not mine.",
} as const;

/** Every wording version an order may carry and still be filed. */
export const ACCEPTED_BUSINESS_AGENT_ACK_VERSIONS: readonly string[] = [BUSINESS_AGENT_ACK.version];
export const ACCEPTED_MAILING_AGENT_ACK_VERSIONS: readonly string[] = [MAILING_AGENT_ACK.version];

/**
 * States where the registered agent's address cannot be the principal place
 * of business (research 2026-10-14, docs/LLC_ADDRESS_CHOICES_2026-10-14.md):
 *  - Illinois: the Secretary of State refuses a registered agent service's
 *    address, a PO box, or "c/o" for the principal place of business.
 *  - Idaho: allowed only with a residential-only attestation AND the agent's
 *    consent, which this order flow does not collect.
 * One plain line each; shown to the client as the reason the option is off.
 */
export const STATES_REQUIRING_OWN_BUSINESS_ADDRESS: Readonly<Record<string, string>> = {
  IL: "Illinois does not accept a registered agent's address as your principal place of business, so your own street address is used.",
  ID: "Idaho accepts a registered agent's address here only in rare cases, so your own street address is used.",
};

export function agentBusinessAddressBlockedReason(state: string | null | undefined): string | null {
  const code = (state ?? "").trim().toUpperCase();
  return STATES_REQUIRING_OWN_BUSINESS_ADDRESS[code] ?? null;
}

export function isLlcAddressMode(value: unknown): value is LlcAddressMode {
  return value === "customer" || value === "registered_agent";
}

const PO_BOX_PATTERN = /\bp\.?\s*o\.?\s*box\b|\bpost\s+office\s+box\b|\bpob\b/i;
const CARE_OF_PATTERN = /(^|[\s,])c\s*\/\s*o\b|\bcare\s+of\b/i;

/** A principal place of business must be a street address: no PO box, no "c/o". */
export function nonStreetAddressReason(line: string | null | undefined): "po_box" | "care_of" | null {
  const value = (line ?? "").trim();
  if (!value) return null;
  if (PO_BOX_PATTERN.test(value)) return "po_box";
  if (CARE_OF_PATTERN.test(value)) return "care_of";
  return null;
}

export type ResolvedAddressModes = {
  business: LlcAddressMode;
  mailing: LlcAddressMode;
  /**
   * stored: the order carries both new fields.
   * legacy: an order from before 2026-10-14, read from the old single switch
   *   (on = the agent for both, off = the client's address for both).
   * default: a draft from before 2026-10-14; it opens with the new defaults.
   */
  source: "stored" | "legacy" | "default";
};

/**
 * The address modes of an order. Drafts that predate the two fields open with
 * the new defaults (the client's own address), so the old switch can never
 * again send the agent's address without the client choosing it. Submitted
 * orders and the filing step read the old switch as it was (legacyFallback),
 * so what is shown and checked is what was actually chosen.
 */
export function resolveAddressModes(
  row: {
    businessAddressMode?: string | null;
    mailingAddressMode?: string | null;
    useRegisteredAgent?: boolean | null;
  },
  options: { legacyFallback: boolean },
): ResolvedAddressModes {
  if (isLlcAddressMode(row.businessAddressMode) && isLlcAddressMode(row.mailingAddressMode)) {
    return { business: row.businessAddressMode, mailing: row.mailingAddressMode, source: "stored" };
  }
  if (options.legacyFallback) {
    const mode: LlcAddressMode = row.useRegisteredAgent ? "registered_agent" : "customer";
    return { business: mode, mailing: mode, source: "legacy" };
  }
  return {
    business: DEFAULT_BUSINESS_ADDRESS_MODE,
    mailing: DEFAULT_MAILING_ADDRESS_MODE,
    source: "default",
  };
}

/**
 * The old single switch, kept readable for old clients and old reports: on
 * only when BOTH addresses are the agent's (exactly what it used to mean).
 */
export function legacyUseRegisteredAgent(business: LlcAddressMode, mailing: LlcAddressMode): boolean {
  return business === "registered_agent" && mailing === "registered_agent";
}

/**
 * Step 3's choices merged into a draft exactly as the server will store them:
 * the old switch is derived from the two modes. The wizard autosaves whenever
 * its draft differs from the last saved one, so a stale switch here would
 * make every save look unsaved and save again and again while the client is
 * on Step 3.
 */
export function withAddressChoices<
  D extends { useRegisteredAgent: boolean },
  C extends { businessAddressMode: LlcAddressMode; mailingAddressMode: LlcAddressMode },
>(draft: D, choices: C): D & C {
  return {
    ...draft,
    ...choices,
    useRegisteredAgent: legacyUseRegisteredAgent(choices.businessAddressMode, choices.mailingAddressMode),
  };
}

/**
 * A new formation state applied to a draft. Where that state refuses the
 * agent's address as the principal place of business, an earlier opt-in
 * falls back to the client's own street address and its checkbox is
 * cleared, so Step 3 never shows the agent's address chosen next to "your
 * own street address is used" with nowhere to type it. Mail at the agent is
 * allowed everywhere and stays as chosen.
 */
export function withFormationState<
  D extends {
    formationState?: string;
    useRegisteredAgent: boolean;
    businessAddressMode: LlcAddressMode;
    mailingAddressMode: LlcAddressMode;
    businessAgentAckVersion: string;
  },
>(draft: D, formationState: string): D {
  const next = { ...draft, formationState };
  if (next.businessAddressMode !== "registered_agent" || !agentBusinessAddressBlockedReason(formationState)) {
    return next;
  }
  return withAddressChoices(next, {
    businessAddressMode: "customer" as LlcAddressMode,
    mailingAddressMode: next.mailingAddressMode,
    businessAgentAckVersion: "",
  });
}

/** Shown where the client's own address is needed but not entered yet, never as if it were set. */
export const ADDRESS_NOT_ENTERED = "Not entered yet";

/**
 * The two review and status lines: the principal place of business, and
 * where mail and the EIN letter go. Address text appears only when it is the
 * client's own.
 */
export function addressChoiceSummary(choices: {
  businessAddressMode: LlcAddressMode;
  mailingAddressMode: LlcAddressMode;
  companyAddress: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
  };
}): { principal: string; mail: string } {
  const address = choices.companyAddress;
  const own = [address.line1, address.line2, address.city, address.state, address.postalCode]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const principal =
    choices.businessAddressMode === "registered_agent"
      ? "The registered agent's address"
      : own || ADDRESS_NOT_ENTERED;
  const mail =
    choices.mailingAddressMode === "registered_agent"
      ? "The registered agent, shown in your account"
      : choices.businessAddressMode === "customer"
        ? "Your business address"
        : own || ADDRESS_NOT_ENTERED;
  return { principal, mail };
}

/** One line that is true in every mode: the agent is always included. */
export const REGISTERED_AGENT_INCLUDED_LINE =
  "A professional registered agent is included with your LLC. They accept official legal papers for your company in your state, and we add them to your account.";

/**
 * Lead priority for the sales team, synced to HubSpot.
 *
 * The ladder: a lead who is funding-qualified from the soft pull AND engaged
 * (replied YES or texted a city) is "hot" — the first call after class. Either
 * signal alone is "warm". Everything else is "standard".
 *
 * Data minimization: only coarse bands leave this process — a qualified
 * boolean and the partner's readiness rating. Never a FICO score.
 */

import { getConnectionSummary } from "./_core/fundingSystem";
import { ensureCustomContactProperties, findContactByEmail, updateContactProperties } from "./hubspot";

export const LEAD_PRIORITY_PROPERTIES = [
  { name: "webinar_lead_priority", label: "Webinar Lead Priority" },
  { name: "webinar_reply_intent", label: "Webinar Reply Intent" },
  { name: "webinar_reply_city", label: "Webinar Reply City" },
  { name: "webinar_funding_qualified", label: "Webinar Funding Qualified" },
  { name: "webinar_funding_readiness", label: "Webinar Funding Readiness" },
  { name: "webinar_engaged_at", label: "Webinar Engaged At" },
] as const;

export type LeadPriority = "hot" | "warm" | "standard";

export interface CoarseFunding {
  qualified: boolean;
  readiness?: string;
}

const ENGAGED_INTENTS = new Set(["yes", "city"]);

/** Pure ladder: soft-pull qualification + engagement reply → call priority */
export function computeLeadPriority(funding: CoarseFunding | null | undefined, replyIntent?: string): LeadPriority {
  const engaged = replyIntent ? ENGAGED_INTENTS.has(replyIntent) : false;
  const qualified = Boolean(funding?.qualified);
  if (qualified && engaged) return "hot";
  if (qualified || engaged) return "warm";
  return "standard";
}

/** Coarse funding bands from the partner's live summary — never the raw score */
export async function getCoarseFunding(email: string): Promise<CoarseFunding | null> {
  try {
    const connection = await getConnectionSummary(email);
    if (!connection?.summary) return null;
    return {
      qualified: Boolean(connection.summary.qualified),
      readiness: connection.summary.readinessRating ?? undefined,
    };
  } catch {
    return null;
  }
}

let propertiesEnsured = false;

/**
 * Push a lead's priority + engagement signals to their HubSpot contact.
 * Returns the computed priority (also stored locally by the caller) or null
 * when the contact doesn't exist / HubSpot is unavailable — never throws.
 */
export async function syncLeadPriorityToHubSpot(params: {
  email: string;
  replyIntent?: string;
  replyCity?: string;
  funding?: CoarseFunding | null;
}): Promise<{ priority: LeadPriority; funding: CoarseFunding | null } | null> {
  const funding = params.funding !== undefined ? params.funding : await getCoarseFunding(params.email);
  const priority = computeLeadPriority(funding, params.replyIntent);
  try {
    if (!propertiesEnsured) {
      await ensureCustomContactProperties([...LEAD_PRIORITY_PROPERTIES]);
      propertiesEnsured = true;
    }
    const contact = await findContactByEmail(params.email);
    if (!contact?.id) return { priority, funding };

    const properties: Record<string, string> = {
      webinar_lead_priority: priority,
      webinar_engaged_at: new Date().toISOString(),
    };
    if (params.replyIntent) properties.webinar_reply_intent = params.replyIntent;
    if (params.replyCity) properties.webinar_reply_city = params.replyCity;
    if (funding) {
      properties.webinar_funding_qualified = funding.qualified ? "yes" : "no";
      if (funding.readiness) properties.webinar_funding_readiness = funding.readiness;
    }
    await updateContactProperties(contact.id, properties);
    console.log(`[LeadPriority] ${params.email} → ${priority} (intent: ${params.replyIntent ?? "n/a"})`);
    return { priority, funding };
  } catch (err: any) {
    console.warn(`[LeadPriority] HubSpot sync failed for ${params.email}:`, err.message);
    return { priority, funding };
  }
}

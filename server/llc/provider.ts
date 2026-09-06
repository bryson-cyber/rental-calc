/**
 * Fulfillment-provider selection. The provider is chosen per registration AT
 * SUBMIT TIME from this env switch, then stored on the row — changing the
 * env never re-routes filings already in flight.
 */
export type LlcProvider = "whop" | "doola";

export function getConfiguredLlcProvider(env: NodeJS.ProcessEnv = process.env): LlcProvider {
  // FAIL-SAFE (live incident 2026-09-05): the four-app rule is doola-only
  // for new filings, so an UNSET or typoed LLC_PROVIDER must never silently
  // route a new filing down the legacy Whop leg — that leg creates a real
  // Whop wholesale checkout and pages ops to pay it. Whop is now opt-in.
  return env.LLC_PROVIDER?.trim().toLowerCase() === "whop" ? "whop" : "doola";
}

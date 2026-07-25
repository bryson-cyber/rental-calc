/**
 * Fulfillment-provider selection. The provider is chosen per registration AT
 * SUBMIT TIME from this env switch, then stored on the row — changing the
 * env never re-routes filings already in flight.
 */
export type LlcProvider = "whop" | "doola";

export function getConfiguredLlcProvider(env: NodeJS.ProcessEnv = process.env): LlcProvider {
  return env.LLC_PROVIDER?.trim().toLowerCase() === "doola" ? "doola" : "whop";
}

import { describe, expect, it } from "vitest";

const apiKey = process.env.WHOP_API_KEY;
const baseUrl = process.env.WHOP_API_BASE_URL ?? "https://sandbox-api.whop.com/api/v1";

const liveDescribe = apiKey ? describe : describe.skip;

liveDescribe("WHOP_API_KEY credential smoke test", () => {
  it("is accepted by a read-only Whop Accounts request", async () => {
    const response = await fetch(`${baseUrl}/accounts?limit=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Api-Version-Date": "2026-07-08-1",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });

    expect(
      response.status,
      "Whop rejected WHOP_API_KEY as unauthenticated. Replace the stored credential with a valid business account API key.",
    ).not.toBe(401);
    expect(
      response.status,
      "Whop could not find the Accounts route at the configured API base URL.",
    ).not.toBe(404);
    expect(
      response.ok,
      `Whop Accounts access failed with HTTP ${response.status}. The key must include the Accounts read scope used for duplicate-safe reconciliation.`,
    ).toBe(true);
  }, 15_000);
});

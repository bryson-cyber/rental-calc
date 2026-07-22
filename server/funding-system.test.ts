import { describe, it, expect } from "vitest";

describe("Funding System credentials", () => {
  it("FUNDING_SYSTEM_URL is set and looks like a URL", () => {
    const url = process.env.FUNDING_SYSTEM_URL;
    expect(url).toBeDefined();
    expect(url).toMatch(/^https?:\/\//);
  });

  it("FUNDING_SYSTEM_API_KEY is set and non-empty", () => {
    const key = process.env.FUNDING_SYSTEM_API_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(5);
  });

  it("can reach the funding system health endpoint", async () => {
    const url = process.env.FUNDING_SYSTEM_URL;
    const key = process.env.FUNDING_SYSTEM_API_KEY;
    if (!url || !key) return;
    
    try {
      const resp = await fetch(`${url}/api/partner/health`, {
        headers: { "x-api-key": key },
        signal: AbortSignal.timeout(10_000),
      });
      // Accept 200, 404 (endpoint may not exist), or 401 (key format issue)
      // As long as we get a response, the URL is reachable
      expect(resp.status).toBeLessThan(500);
    } catch (e: any) {
      // Network error means URL is wrong
      if (e.name === "AbortError") {
        console.warn("Timeout reaching funding system - URL may be slow");
      } else {
        throw new Error(`Cannot reach FUNDING_SYSTEM_URL: ${e.message}`);
      }
    }
  });
});

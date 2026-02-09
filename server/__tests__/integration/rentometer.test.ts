import { describe, it, expect } from "vitest";
import "dotenv/config";
import { checkRentometerAuth, getRentSummary } from "./rentometer";

describe("Rentometer API", () => {
  it("should authenticate with valid API key", async () => {
    const auth = await checkRentometerAuth();
    
    expect(auth.authorized).toBe(true);
    expect(auth.creditsRemaining).toBeGreaterThan(0);
    console.log(`[Rentometer Test] Authenticated: ${auth.email}, Credits: ${auth.creditsRemaining}`);
  });

  it("should fetch rent summary for a valid address", async () => {
    const result = await getRentSummary({
      address: "80202", // Denver zip code
      bedrooms: 2,
    });

    expect(result.median).toBeGreaterThan(0);
    expect(result.samples).toBeGreaterThan(0);
    console.log(`[Rentometer Test] Denver 2BR median rent: $${result.median}, samples: ${result.samples}`);
  });
});

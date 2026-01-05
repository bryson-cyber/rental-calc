import { describe, it, expect } from "vitest";
import { listProfiles } from "./browser-use";

describe("Browser Use API", () => {
  it("should validate API key by listing profiles", async () => {
    // This test validates that the API key is correct by making a simple API call
    // If the API key is invalid, this will throw an error
    const profiles = await listProfiles();
    
    // The API should return an array (even if empty)
    expect(Array.isArray(profiles)).toBe(true);
  }, 30000); // 30 second timeout for API call
});

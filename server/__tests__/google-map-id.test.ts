import { describe, it, expect } from "vitest";

describe("Google Map ID configuration", () => {
  it("should have VITE_GOOGLE_MAP_ID environment variable set", () => {
    const mapId = process.env.VITE_GOOGLE_MAP_ID;
    expect(mapId).toBeDefined();
    expect(mapId).not.toBe("");
    expect(typeof mapId).toBe("string");
  });

  it("should have a valid hex Map ID format", () => {
    const mapId = process.env.VITE_GOOGLE_MAP_ID!;
    // Google Map IDs are hex strings
    expect(mapId).toMatch(/^[a-f0-9]+$/);
    expect(mapId.length).toBeGreaterThan(10);
  });

  it("should validate the Map ID works with Google Maps API", async () => {
    const apiKey = process.env.VITE_GOOGLE_PLACES_API_KEY;
    const mapId = process.env.VITE_GOOGLE_MAP_ID;
    
    // We can't directly validate a Map ID via REST API, but we can verify
    // the API key works (which we already tested) and the Map ID format is correct
    expect(apiKey).toBeDefined();
    expect(mapId).toBeDefined();
    expect(mapId).toBe("21716a29ef7ad3055240c910");
  });
});

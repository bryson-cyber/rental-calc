import { describe, it, expect } from "vitest";

describe("Google Maps Configuration", () => {
  it("should have VITE_GOOGLE_MAP_ID set", () => {
    const mapId = process.env.VITE_GOOGLE_MAP_ID;
    expect(mapId).toBeDefined();
    expect(mapId).toBeTruthy();
    expect(mapId).toBe("21716a29ef7ad3055240c910");
  });

  it("should have VITE_GOOGLE_PLACES_API_KEY set", () => {
    const apiKey = process.env.VITE_GOOGLE_PLACES_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();
  });
});

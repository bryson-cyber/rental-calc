import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("DEV_MOCK_API environment variable", () => {
  it("should have DEV_MOCK_API set in environment", () => {
    expect(process.env.DEV_MOCK_API).toBe("true");
  });
});

describe("dev-mock-api module", () => {
  it("should export installMockApi function", async () => {
    const mod = await import("./dev-mock-api");
    expect(typeof mod.installMockApi).toBe("function");
  });

  it("should export uninstallMockApi function", async () => {
    const mod = await import("./dev-mock-api");
    expect(typeof mod.uninstallMockApi).toBe("function");
  });

  it("should export isMockApiActive function", async () => {
    const mod = await import("./dev-mock-api");
    expect(typeof mod.isMockApiActive).toBe("function");
  });

  it("should export getMockApiStats function", async () => {
    const mod = await import("./dev-mock-api");
    expect(typeof mod.getMockApiStats).toBe("function");
  });

  describe("mock fetch interceptor", () => {
    let mod: typeof import("./dev-mock-api");
    let originalFetch: typeof globalThis.fetch;

    beforeAll(async () => {
      mod = await import("./dev-mock-api");
      originalFetch = globalThis.fetch;
      // Ensure mock is installed
      mod.installMockApi();
    });

    afterAll(() => {
      mod.uninstallMockApi();
      // Restore original fetch if uninstall didn't do it
      if (globalThis.fetch !== originalFetch) {
        globalThis.fetch = originalFetch;
      }
    });

    it("should activate mock API when DEV_MOCK_API=true", () => {
      expect(mod.isMockApiActive()).toBe(true);
    });

    // ── AirDNA Rentalizer ──
    it("should intercept AirDNA rentalizer calls with raw API shape", async () => {
      const response = await fetch("https://api.airdna.co/v1/rentalizer?address=test");
      expect(response.ok).toBe(true);
      const data = await response.json();
      // Raw API shape has payload wrapper
      expect(data).toHaveProperty("payload");
      expect(data.payload).toHaveProperty("details");
      expect(data.payload).toHaveProperty("location");
      expect(data.payload).toHaveProperty("stats");
      expect(data.payload).toHaveProperty("comps");
      expect(data.payload.stats.future.summary.revenue).toBe(85000);
    });

    // ── AirDNA Market Search ──
    it("should intercept AirDNA market search calls with payload wrapper", async () => {
      const response = await fetch("https://api.airdna.co/v1/market/search?query=Dallas");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("payload");
      expect(data.payload).toHaveProperty("results");
      expect(data.payload.results[0].name).toBe("Dallas");
      expect(data.payload.results[0].id).toBe("airdna-403");
    });

    // ── AirDNA Market Details ──
    it("should intercept AirDNA market detail calls with payload wrapper", async () => {
      const response = await fetch("https://api.airdna.co/v1/market/airdna-403");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("payload");
      expect(data.payload).toHaveProperty("name");
      expect(data.payload).toHaveProperty("listing_count");
      expect(data.payload).toHaveProperty("metrics");
    });

    // ── AirDNA Market Metrics ──
    it("should intercept AirDNA market metrics calls", async () => {
      const response = await fetch("https://api.airdna.co/v1/market/airdna-403/metrics/occupancy");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("payload");
      expect(data.payload).toHaveProperty("metrics");
      expect(Array.isArray(data.payload.metrics)).toBe(true);
      expect(data.payload.metrics.length).toBeGreaterThan(0);
    });

    // ── AirDNA Listing Comps (radius search) ──
    it("should intercept AirDNA listing comps/area calls", async () => {
      const response = await fetch("https://api.airdna.co/v1/listing/comps/area", {
        method: "POST",
        body: JSON.stringify({ lat: 32.9, lng: -96.7, radius: 2000 }),
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("payload");
      expect(data.payload).toHaveProperty("listings");
      expect(data.payload).toHaveProperty("page_info");
      expect(Array.isArray(data.payload.listings)).toBe(true);
    });

    // ── AirDNA Submarkets ──
    it("should intercept AirDNA submarkets calls", async () => {
      const response = await fetch("https://api.airdna.co/v1/market/airdna-403/submarkets");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("payload");
      expect(data.payload).toHaveProperty("submarkets");
      expect(Array.isArray(data.payload.submarkets)).toBe(true);
    });

    // ── Rentometer ──
    it("should intercept Rentometer calls with full response shape", async () => {
      const response = await fetch("https://www.rentometer.com/api/v1/summary?address=test");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("mean");
      expect(data).toHaveProperty("median");
      expect(data).toHaveProperty("percentile_25");
      expect(data).toHaveProperty("percentile_75");
      expect(data).toHaveProperty("latitude");
      expect(data).toHaveProperty("longitude");
      expect(data).toHaveProperty("std_dev");
      expect(data.mean).toBe(2200);
    });

    // ── Gemini AI ──
    it("should intercept Gemini AI calls with markdown response", async () => {
      const response = await fetch("https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("candidates");
      expect(data.candidates[0].content.parts[0].text).toContain("Executive Summary");
    });

    // ── HubSpot ──
    it("should intercept HubSpot calls", async () => {
      const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("results");
    });

    // ── HasData ──
    it("should intercept HasData calls", async () => {
      const response = await fetch("https://api.hasdata.com/scrape/zillow?url=test");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("status");
      expect(data.status).toBe("ok");
    });

    // ── SimpleTexting ──
    it("should intercept SimpleTexting calls", async () => {
      const response = await fetch("https://api-app2.simpletexting.com/v2/api/messages", {
        method: "POST",
        body: JSON.stringify({ to: "1234567890", text: "test" }),
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    // ── Zapier ──
    it("should intercept Zapier webhook calls", async () => {
      const response = await fetch("https://hooks.zapier.com/hooks/catch/123/abc", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe("success");
    });

    // ── Airbnb ──
    it("should intercept Airbnb calls", async () => {
      const response = await fetch("https://www.airbnb.com/rooms/12345");
      expect(response.ok).toBe(true);
      // Airbnb mock returns HTML, not JSON
      const text = await response.text();
      expect(text).toContain("html");
    });

    // ── Google Vertex AI Search ──
    it("should intercept Google Vertex AI search calls", async () => {
      const response = await fetch("https://vertexaisearch.cloud.google.com/api/search");
      expect(response.ok).toBe(true);
      // Vertex AI mock returns HTML, not JSON
      const text = await response.text();
      expect(text).toContain("html");
    });

    // ── URL validation (.gov/.org/.edu) ──
    it("should return 200 for .gov URL validation HEAD requests", async () => {
      const response = await fetch("https://www.cityofrichardson.gov/str-regulations", {
        method: "HEAD",
      });
      expect(response.ok).toBe(true);
    });

    // ── Passthrough ──
    it("should pass through localhost calls", async () => {
      const stats = mod.getMockApiStats();
      const initialPassed = stats.passedThrough;

      try {
        await fetch("http://localhost:99999/test", { signal: AbortSignal.timeout(500) });
      } catch {
        // Expected to fail - no server on this port
      }

      const newStats = mod.getMockApiStats();
      expect(newStats.passedThrough).toBeGreaterThan(initialPassed);
    });

    it("should pass through Manus internal calls", async () => {
      const stats = mod.getMockApiStats();
      const initialPassed = stats.passedThrough;

      try {
        await fetch("https://forge.manus.im/api/test", { signal: AbortSignal.timeout(500) });
      } catch {
        // Expected to fail
      }

      const newStats = mod.getMockApiStats();
      expect(newStats.passedThrough).toBeGreaterThan(initialPassed);
    });

    // ── Stats tracking ──
    it("should track intercepted call count", () => {
      const stats = mod.getMockApiStats();
      expect(stats.intercepted).toBeGreaterThan(0);
      expect(stats.active).toBe(true);
    });

    it("should deactivate after uninstall", () => {
      mod.uninstallMockApi();
      expect(mod.isMockApiActive()).toBe(false);
      const stats = mod.getMockApiStats();
      expect(stats.active).toBe(false);
    });
  });
});

describe("system.devFlags endpoint shape", () => {
  it("should return mockApi and isProduction flags from ENV", async () => {
    // Verify the ENV module exposes the devMockApi flag
    const { ENV } = await import("./_core/env");
    expect(typeof ENV.devMockApi).toBe("boolean");
    expect(typeof ENV.isProduction).toBe("boolean");
    // In test env, DEV_MOCK_API=true
    expect(ENV.devMockApi).toBe(true);
  });
});

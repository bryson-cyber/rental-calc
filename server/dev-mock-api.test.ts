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

    it("should intercept AirDNA rentalizer calls", async () => {
      const response = await fetch("https://api.airdna.co/v1/rentalizer?address=test");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("property");
      expect(data).toHaveProperty("estimates");
      expect(data.estimates.annual_revenue).toBe(85000);
    });

    it("should intercept AirDNA market search calls", async () => {
      const response = await fetch("https://api.airdna.co/v1/market/search?query=Dallas");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("results");
      expect(data.results[0].name).toBe("Dallas");
    });

    it("should intercept Rentometer calls", async () => {
      const response = await fetch("https://www.rentometer.com/api/v1/summary?address=test");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("mean");
      expect(data.mean).toBe(2200);
    });

    it("should intercept Gemini AI calls", async () => {
      const response = await fetch("https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("candidates");
    });

    it("should intercept HubSpot calls", async () => {
      const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("results");
    });

    it("should intercept HasData calls", async () => {
      const response = await fetch("https://api.hasdata.com/scrape/zillow?url=test");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("status");
      expect(data.status).toBe("ok");
    });

    it("should intercept SimpleTexting calls", async () => {
      const response = await fetch("https://api.simpletexting.com/v2/api/messages", {
        method: "POST",
        body: JSON.stringify({ to: "1234567890", text: "test" }),
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("should intercept Zapier webhook calls", async () => {
      const response = await fetch("https://hooks.zapier.com/hooks/catch/123/abc", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe("success");
    });

    it("should pass through localhost calls", async () => {
      // This should NOT be intercepted - it should pass through to real fetch
      // We just verify it doesn't return mock data (it will fail since no server is listening)
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

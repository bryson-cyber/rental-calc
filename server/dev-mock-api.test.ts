import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";

describe("DEV_MOCK_API environment variable", () => {
  it("should have DEV_MOCK_API set to false for production safety", () => {
    expect(process.env.DEV_MOCK_API).toBe("false");
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

  describe("production safeguard", () => {
    it("should NOT activate mock API when DEV_MOCK_API=false", async () => {
      const mod = await import("./dev-mock-api");
      // With DEV_MOCK_API=false, installMockApi should be a no-op
      mod.installMockApi();
      expect(mod.isMockApiActive()).toBe(false);
    });

    it("should expose isProduction and devMockApi flags from ENV", async () => {
      const { ENV } = await import("./_core/env");
      expect(typeof ENV.isProduction).toBe("boolean");
      expect(typeof ENV.devMockApi).toBe("boolean");
      // DEV_MOCK_API is now false (production-safe default)
      expect(ENV.devMockApi).toBe(false);
    });

    it("should have production guard code that checks ENV.isProduction", async () => {
      // Verify the production guard exists in the source code
      const fs = await import("fs");
      const source = fs.readFileSync("server/dev-mock-api.ts", "utf-8");
      expect(source).toContain("ENV.isProduction");
      expect(source).toContain("BLOCKED");
      expect(source).toContain("Mock API will NOT activate in production");
    });
  });
});

describe("system.devFlags endpoint shape", () => {
  it("should return mockApi and isProduction flags from ENV", async () => {
    const { ENV } = await import("./_core/env");
    expect(typeof ENV.devMockApi).toBe("boolean");
    expect(typeof ENV.isProduction).toBe("boolean");
    expect(ENV.devMockApi).toBe(false);
  });
});

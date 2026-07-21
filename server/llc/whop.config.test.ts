import { describe, expect, it } from "vitest";
import {
  DEFAULT_WHOP_API_BASE_URL,
  WHOP_API_VERSION,
  WhopConfigurationError,
  getWhopConfig,
} from "./whop";

const validKey = `whop_${"a".repeat(40)}`;

describe("getWhopConfig", () => {
  it("rejects a missing server credential with a redacted configuration error", () => {
    expect(() => getWhopConfig({})).toThrow(WhopConfigurationError);
    expect(() => getWhopConfig({})).toThrow(/WHOP_API_KEY is missing or invalid/);
  });

  it("rejects a malformed credential without echoing the provided value", () => {
    const malformedKey = "sensitive-short-value";
    try {
      getWhopConfig({ WHOP_API_KEY: malformedKey });
      throw new Error("Expected malformed Whop key to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(WhopConfigurationError);
      expect((error as Error).message).not.toContain(malformedKey);
    }
  });

  it("rejects non-HTTPS, untrusted-host, query-bearing, and wrong-path base URLs", () => {
    const invalidUrls = [
      "http://api.whop.com/api/v1",
      "https://api.whop.example/api/v1",
      "https://api.whop.com/api/v2",
      "https://api.whop.com/api/v1?key=secret",
    ];

    for (const baseUrl of invalidUrls) {
      expect(() =>
        getWhopConfig({
          WHOP_API_KEY: validKey,
          WHOP_API_BASE_URL: baseUrl,
        }),
      ).toThrow(WhopConfigurationError);
    }
  });

  it("defaults to production and accepts the documented sandbox endpoint", () => {
    expect(getWhopConfig({ WHOP_API_KEY: validKey })).toEqual({
      apiKey: validKey,
      baseUrl: DEFAULT_WHOP_API_BASE_URL,
      apiVersion: WHOP_API_VERSION,
    });

    expect(
      getWhopConfig({
        WHOP_API_KEY: validKey,
        WHOP_API_BASE_URL: "https://sandbox-api.whop.com/api/v1/",
      }),
    ).toEqual({
      apiKey: validKey,
      baseUrl: "https://sandbox-api.whop.com/api/v1",
      apiVersion: WHOP_API_VERSION,
    });
  });
});

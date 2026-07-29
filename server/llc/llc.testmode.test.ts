import { describe, it, expect } from "vitest";
import { isLlcTestMode } from "./doola";

describe("LLC Test Mode", () => {
  it("should be in live mode (LLC_TEST_MODE !== true)", () => {
    // The env var is set to "false" — isLlcTestMode should return false
    const result = isLlcTestMode({ ...process.env, LLC_TEST_MODE: process.env.LLC_TEST_MODE });
    expect(result).toBe(false);
  });

  it("isLlcTestMode returns false when LLC_TEST_MODE is 'false'", () => {
    expect(isLlcTestMode({ LLC_TEST_MODE: "false" } as any)).toBe(false);
  });

  it("isLlcTestMode returns true only when LLC_TEST_MODE is exactly 'true'", () => {
    expect(isLlcTestMode({ LLC_TEST_MODE: "true" } as any)).toBe(true);
  });
});

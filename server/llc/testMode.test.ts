import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("LLC_TEST_MODE toggle", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("isLlcTestMode returns true when LLC_TEST_MODE=true", async () => {
    process.env.LLC_TEST_MODE = "true";
    const { isLlcTestMode } = await import("./doola");
    expect(isLlcTestMode()).toBe(true);
  });

  it("isLlcTestMode returns false when LLC_TEST_MODE is not set", async () => {
    delete process.env.LLC_TEST_MODE;
    const { isLlcTestMode } = await import("./doola");
    expect(isLlcTestMode()).toBe(false);
  });

  it("getDoolaConfig reads DOOLA_TEST_API_KEY when test mode is active", async () => {
    process.env.LLC_TEST_MODE = "true";
    process.env.DOOLA_TEST_API_KEY = "dk_test_ygkml2v4nsm4ipaqkmi36x7wljloz2jqg3ku6bpmeuaei4pudsua";
    const { getDoolaConfig } = await import("./doola");
    const config = getDoolaConfig();
    expect(config.apiKey).toBe("dk_test_ygkml2v4nsm4ipaqkmi36x7wljloz2jqg3ku6bpmeuaei4pudsua");
    expect(config.baseUrl).toContain("test.doola.com");
  });

  it("getDoolaConfig reads DOOLA_API_KEY when test mode is off", async () => {
    process.env.LLC_TEST_MODE = "false";
    process.env.DOOLA_API_KEY = "dk_live_fakelivekeyfortest1234567890abcdefgh";
    process.env.DOOLA_API_BASE_URL = "https://api.doola.com";
    const { getDoolaConfig } = await import("./doola");
    const config = getDoolaConfig();
    expect(config.apiKey).toBe("dk_live_fakelivekeyfortest1234567890abcdefgh");
    expect(config.baseUrl).toBe("https://api.doola.com");
  });

  it("getDoolaWebhookSecret reads DOOLA_TEST_WEBHOOK_SECRET in test mode", async () => {
    process.env.LLC_TEST_MODE = "true";
    process.env.DOOLA_TEST_WEBHOOK_SECRET = "wk_3x3zw3sjjzabizxlxhoqe3iblupxzo3kxzdsubhryfaccg7wkptq";
    const { getDoolaWebhookSecret } = await import("./doola");
    const secret = getDoolaWebhookSecret();
    expect(secret).toBe("wk_3x3zw3sjjzabizxlxhoqe3iblupxzo3kxzdsubhryfaccg7wkptq");
  });

  it("getDoolaWebhookSecret reads DOOLA_WEBHOOK_SECRET in live mode", async () => {
    process.env.LLC_TEST_MODE = "false";
    process.env.DOOLA_WEBHOOK_SECRET = "wk_livewebhooksecret1234567890abcdefgh";
    const { getDoolaWebhookSecret } = await import("./doola");
    const secret = getDoolaWebhookSecret();
    expect(secret).toBe("wk_livewebhooksecret1234567890abcdefgh");
  });

  it("getDoolaConfig throws when test mode is on but DOOLA_TEST_API_KEY is missing", async () => {
    process.env.LLC_TEST_MODE = "true";
    delete process.env.DOOLA_TEST_API_KEY;
    const { getDoolaConfig } = await import("./doola");
    expect(() => getDoolaConfig()).toThrow("DOOLA_TEST_API_KEY");
  });

  it("ENV.stripeSecretKey reads STRIPE_TEST_SECRET_KEY in test mode", async () => {
    process.env.LLC_TEST_MODE = "true";
    process.env.STRIPE_TEST_SECRET_KEY = "sk_test_51L89TuJ3WEh0enaAQYojac";
    process.env.STRIPE_SECRET_KEY = "sk_test_51TyIM4PoxvKsgYzl";
    const { ENV } = await import("../_core/env");
    expect(ENV.stripeSecretKey).toBe("sk_test_51L89TuJ3WEh0enaAQYojac");
  });

  it("ENV.stripeSecretKey reads STRIPE_SECRET_KEY in live mode", async () => {
    process.env.LLC_TEST_MODE = "false";
    process.env.STRIPE_SECRET_KEY = "sk_test_51TyIM4PoxvKsgYzl";
    process.env.STRIPE_TEST_SECRET_KEY = "sk_test_51L89TuJ3WEh0enaAQYojac";
    const { ENV } = await import("../_core/env");
    expect(ENV.stripeSecretKey).toBe("sk_test_51TyIM4PoxvKsgYzl");
  });

  it("ENV.stripeWebhookSecret reads STRIPE_TEST_WEBHOOK_SECRET in test mode", async () => {
    process.env.LLC_TEST_MODE = "true";
    process.env.STRIPE_TEST_WEBHOOK_SECRET = "whsec_testvalue123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_livevalue456";
    const { ENV } = await import("../_core/env");
    expect(ENV.stripeWebhookSecret).toBe("whsec_testvalue123");
  });
});

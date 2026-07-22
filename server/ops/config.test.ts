import { describe, it, expect, vi } from "vitest";
import { getOpsConfig } from "./config";

describe("getOpsConfig with HubSpot SMTP fallback", () => {
  it("uses HUBSPOT_SMTP_* when SMTP_HOST is not set", () => {
    const env = {
      OPS_EMAIL: "support@coachinayah.com",
      HUBSPOT_SMTP_USER: "test-user",
      HUBSPOT_SMTP_PASS: "test-pass",
      HUBSPOT_SMTP_FROM: "support@coachinayah.com",
    } as unknown as NodeJS.ProcessEnv;

    const config = getOpsConfig(env);
    expect(config.opsEmail).toBe("support@coachinayah.com");
    expect(config.smtp).not.toBeNull();
    expect(config.smtp!.host).toBe("smtp.hubapi.com");
    expect(config.smtp!.user).toBe("test-user");
    expect(config.smtp!.pass).toBe("test-pass");
    expect(config.smtp!.from).toBe("support@coachinayah.com");
    expect(config.smtp!.port).toBe(587);
  });

  it("prefers SMTP_HOST over HubSpot fallback when both are set", () => {
    const env = {
      OPS_EMAIL: "support@coachinayah.com",
      SMTP_HOST: "custom-smtp.example.com",
      SMTP_USER: "custom-user",
      SMTP_PASS: "custom-pass",
      SMTP_FROM: "custom@example.com",
      HUBSPOT_SMTP_USER: "hubspot-user",
      HUBSPOT_SMTP_PASS: "hubspot-pass",
    } as unknown as NodeJS.ProcessEnv;

    const config = getOpsConfig(env);
    expect(config.smtp!.host).toBe("custom-smtp.example.com");
    expect(config.smtp!.user).toBe("custom-user");
  });

  it("validates OPS_EMAIL from env", () => {
    const config = getOpsConfig({
      OPS_EMAIL: process.env.OPS_EMAIL || "support@coachinayah.com",
      HUBSPOT_SMTP_USER: process.env.HUBSPOT_SMTP_USER || "placeholder",
      HUBSPOT_SMTP_PASS: process.env.HUBSPOT_SMTP_PASS || "placeholder",
    } as unknown as NodeJS.ProcessEnv);
    expect(config.opsEmail).toBe("support@coachinayah.com");
  });
});

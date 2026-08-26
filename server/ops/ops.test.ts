import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpsConfigurationError, connectedAccountEmailAlias, getOpsConfig } from "./config";

const database = vi.hoisted(() => ({
  listForPolling: vi.fn(),
}));

const submissionMock = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

const requiredActionsMock = vi.hoisted(() => ({
  reconcile: vi.fn(async () => ({ providerOpen: 0, synced: 0, failed: 0 })),
  rescue: vi.fn(async () => ({ checked: 0 })),
}));

vi.mock("../llc/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../llc/store")>();
  return {
    isRegistrationEditable: actual.isRegistrationEditable,
    UNCERTAIN_ERROR_PREFIX: actual.UNCERTAIN_ERROR_PREFIX,
    listRegistrationsForStatusPolling: database.listForPolling,
  };
});

vi.mock("../llc/submission", () => ({
  refreshLlcRegistrationStatus: submissionMock.refresh,
}));

vi.mock("../llc/requiredActions", () => ({
  reconcileDoolaRequiredActions: requiredActionsMock.reconcile,
  rescueRequiredActionNotifications: requiredActionsMock.rescue,
}));

import { runStatusPollOnce } from "./poller";
import { UNCERTAIN_ERROR_PREFIX, isRegistrationEditable } from "../llc/store";

describe("registration edit locking (duplicate-filing guard)", () => {
  it("locks any registration that has a provider checkout", () => {
    expect(
      isRegistrationEditable({
        status: "action_required",
        checkoutSessionId: "ch_live_1",
        lastErrorType: null,
      }),
    ).toBe(false);
  });

  it("locks registrations quarantined by an uncertain provider outcome", () => {
    expect(
      isRegistrationEditable({
        status: "action_required",
        checkoutSessionId: null,
        lastErrorType: `${UNCERTAIN_ERROR_PREFIX}request_timeout`,
      }),
    ).toBe(false);
  });

  it("keeps ordinary corrective states editable", () => {
    expect(
      isRegistrationEditable({
        status: "action_required",
        checkoutSessionId: null,
        lastErrorType: "http_400",
      }),
    ).toBe(true);
    expect(
      isRegistrationEditable({
        status: "draft",
        checkoutSessionId: null,
        lastErrorType: null,
      }),
    ).toBe(true);
  });

  it("never allows editing post-handoff statuses", () => {
    for (const status of ["submitting", "payment_required", "processing", "completed"]) {
      expect(
        isRegistrationEditable({ status, checkoutSessionId: null, lastErrorType: null }),
      ).toBe(false);
    }
  });
});

describe("ops configuration and account alias", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("derives a per-registration plus alias from OPS_EMAIL", () => {
    vi.stubEnv("OPS_EMAIL", "bryson@coachinayah.com");
    expect(connectedAccountEmailAlias(12)).toBe("bryson+reg12@coachinayah.com");
  });

  it("collapses an existing plus tag before appending the registration tag", () => {
    vi.stubEnv("OPS_EMAIL", "bryson+ops@coachinayah.com");
    expect(connectedAccountEmailAlias(12)).toBe("bryson+reg12@coachinayah.com");
  });

  it("prefers the dedicated WHOP_ACCOUNT_EMAIL mailbox when configured", () => {
    vi.stubEnv("OPS_EMAIL", "bryson@coachinayah.com");
    vi.stubEnv("WHOP_ACCOUNT_EMAIL", "filings@coachinayah.com");
    expect(connectedAccountEmailAlias(7)).toBe("filings+reg7@coachinayah.com");
  });

  it("refuses to produce an alias without an ops address so client emails can never be used", () => {
    vi.stubEnv("OPS_EMAIL", "");
    vi.stubEnv("WHOP_ACCOUNT_EMAIL", "");
    expect(() => connectedAccountEmailAlias(7)).toThrow(OpsConfigurationError);
  });

  it("validates OPS_EMAIL shape in getOpsConfig", () => {
    vi.stubEnv("OPS_EMAIL", "not-an-email");
    expect(() => getOpsConfig()).toThrow(OpsConfigurationError);
  });

  it("enables SMTP only when host, user, and pass are all present", () => {
    vi.stubEnv("OPS_EMAIL", "ops@example.com");
    vi.stubEnv("SMTP_HOST", "smtp.hubapi.com");
    vi.stubEnv("SMTP_USER", "hs-user");
    vi.stubEnv("SMTP_PASS", "");
    vi.stubEnv("HUBSPOT_SMTP_PASS", "");
    vi.stubEnv("SMTP_FROM", "");
    vi.stubEnv("HUBSPOT_SMTP_FROM", "");
    expect(getOpsConfig().smtp).toBeNull();
    vi.stubEnv("SMTP_PASS", "hs-pass");
    const smtp = getOpsConfig().smtp;
    expect(smtp).toMatchObject({
      host: "smtp.hubapi.com",
      port: 587,
      from: "ops@example.com",
    });
  });
});

describe("status poller sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes each submitted registration and survives per-registration failures", async () => {
    database.listForPolling.mockResolvedValue([
      { id: 1, userId: 7, status: "payment_required", whopAccountId: "biz_A" },
      { id: 2, userId: 8, status: "processing", whopAccountId: "biz_B" },
      { id: 3, userId: 9, status: "processing", whopAccountId: null },
    ]);
    submissionMock.refresh
      .mockResolvedValueOnce({ refreshed: true })
      .mockRejectedValueOnce(new Error("provider down"));

    const sweep = runStatusPollOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await sweep;

    expect(result).toEqual({ polled: 1, failed: 1, skipped: false });
    expect(submissionMock.refresh).toHaveBeenCalledTimes(2);
    expect(submissionMock.refresh).toHaveBeenCalledWith({ userId: 7, registrationId: 1 });
    expect(submissionMock.refresh).toHaveBeenCalledWith({ userId: 8, registrationId: 2 });
    expect(requiredActionsMock.reconcile).toHaveBeenCalledTimes(1);
    expect(requiredActionsMock.rescue).toHaveBeenCalledTimes(1);
  });

  it("skips a sweep while another is in flight", async () => {
    database.listForPolling.mockResolvedValue([
      { id: 1, userId: 7, status: "processing", whopAccountId: "biz_A" },
    ]);
    submissionMock.refresh.mockResolvedValue({ refreshed: true });

    const first = runStatusPollOnce();
    const second = await runStatusPollOnce();
    expect(second.skipped).toBe(true);

    await vi.advanceTimersByTimeAsync(60_000);
    await first;
  });
});

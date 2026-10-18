/**
 * Whop retail webhook + reconciliation (ported from Her First Order's
 * whop-enrollment.test.ts signature suite and retail-reconciliation.test.ts).
 */
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as any[][],
  sendOpsAlert: vi.fn(),
  env: { llcAutoFileEnabled: true },
}));

vi.mock("../db", () => ({
  getDb: vi.fn(async () => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => mocks.rows.shift() || []),
        })),
      })),
    })),
  })),
}));
vi.mock("../ops/notify", () => ({ sendOpsAlert: mocks.sendOpsAlert }));
vi.mock("../_core/env", () => ({
  ENV: { get llcAutoFileEnabled() { return mocks.env.llcAutoFileEnabled; }, isProduction: false },
}));

import {
  handleWhopWebhookEvent,
  runLlcWhopReconciliation,
  verifyWhopSignature,
} from "./whopRetailWebhook";
import { LLC_CHECKOUT_METADATA_VERSION } from "./whopRetailCheckout";

const SECRET = "ws_dGVzdC1zZWNyZXQta2V5LWZvci1yYw";
const NOW = 1_790_000_000_000;
const ENV_OK = { WHOP_API_KEY: "apik_test", WHOP_COMPANY_ID: "biz_rentalcalc123" } as NodeJS.ProcessEnv;

function sign(rawBody: string, id = "msg_1", tsMs = NOW, useDerivedKey = false) {
  const timestamp = String(Math.floor(tsMs / 1000));
  const key = useDerivedKey ? Buffer.from(SECRET.replace(/^ws_/, ""), "base64") : Buffer.from(SECRET, "utf8");
  const sig = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`, "utf8").digest("base64");
  return { id, timestamp, signatureHeader: `v1,${sig}` };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows = [];
  mocks.env.llcAutoFileEnabled = true;
  mocks.sendOpsAlert.mockResolvedValue(true);
});

describe("verifyWhopSignature", () => {
  const body = JSON.stringify({ type: "payment.succeeded" });
  it("accepts raw-secret and base64-derived keys", () => {
    expect(verifyWhopSignature({ ...sign(body), rawBody: body, secret: SECRET, nowMs: NOW })).toBe(true);
    expect(verifyWhopSignature({ ...sign(body, "msg_2", NOW, true), rawBody: body, secret: SECRET, nowMs: NOW })).toBe(true);
  });
  it("accepts multiple signatures when one matches", () => {
    const s = sign(body);
    expect(verifyWhopSignature({ ...s, signatureHeader: `v1,${"A".repeat(44)} ${s.signatureHeader}`, rawBody: body, secret: SECRET, nowMs: NOW })).toBe(true);
  });
  it("rejects tampering, wrong secret, replays, and missing pieces", () => {
    const s = sign(body);
    expect(verifyWhopSignature({ ...s, rawBody: body + "x", secret: SECRET, nowMs: NOW })).toBe(false);
    expect(verifyWhopSignature({ ...s, rawBody: body, secret: "ws_d3Jvbmc", nowMs: NOW })).toBe(false);
    expect(verifyWhopSignature({ ...sign(body, "m", NOW - 6 * 60 * 1000), rawBody: body, secret: SECRET, nowMs: NOW })).toBe(false);
    expect(verifyWhopSignature({ ...s, id: "", rawBody: body, secret: SECRET, nowMs: NOW })).toBe(false);
    expect(verifyWhopSignature({ ...s, rawBody: body, secret: "", nowMs: NOW })).toBe(false);
  });
});

describe("handleWhopWebhookEvent", () => {
  it("hands only the payment id to the verifying processor", async () => {
    const processPayment = vi.fn(async () => ({ outcome: "filed" as const, registrationId: 42, paymentId: "pay_1" }));
    const outcome = await handleWhopWebhookEvent(
      { type: "payment.succeeded", data: { id: "pay_1", total: 1, metadata: null } },
      { processPayment: processPayment as any },
    );
    expect(outcome).toBe("llc-filed");
    expect(processPayment).toHaveBeenCalledWith({ paymentId: "pay_1" });
  });

  it("skips payments whose metadata belongs to another product without an API call", async () => {
    const processPayment = vi.fn();
    const outcome = await handleWhopWebhookEvent(
      { type: "payment.succeeded", data: { id: "pay_hfo", metadata: { hfo_checkout_kind: "llc_filing" } } },
      { processPayment: processPayment as any },
    );
    expect(outcome).toBe("ignored:foreign-payment");
    expect(processPayment).not.toHaveBeenCalled();
  });

  it("alerts ops when a payment carries our metadata but cannot be applied", async () => {
    const processPayment = vi.fn(async () => {
      throw new TRPCError({ code: "FORBIDDEN", message: "This payment does not match the filing quote." });
    });
    const outcome = await handleWhopWebhookEvent(
      { type: "payment.succeeded", data: { id: "pay_bad" } },
      { processPayment: processPayment as any },
    );
    expect(outcome).toBe("llc-rejected:FORBIDDEN");
    expect(mocks.sendOpsAlert).toHaveBeenCalledTimes(1);
    expect(mocks.sendOpsAlert.mock.calls[0][0].subject).toContain("pay_bad");
  });

  it("alerts on disputes only for this app's LLC payments", async () => {
    const ours = vi.fn(async () => ({
      id: "pay_1",
      metadata: {
        rc_metadata_version: LLC_CHECKOUT_METADATA_VERSION,
        rc_checkout_kind: "llc_filing",
        rc_llc_registration_id: "42",
        rc_llc_quote_hash: "b".repeat(64),
        rc_llc_quote_version: "v",
      },
    }));
    expect(await handleWhopWebhookEvent({ type: "dispute.created", data: { payment: { id: "pay_1" } } }, { fetchPayment: ours as any }))
      .toBe("alerted:dispute.created");
    const foreign = vi.fn(async () => ({ id: "pay_2", metadata: {} }));
    expect(await handleWhopWebhookEvent({ type: "dispute.created", data: { payment_id: "pay_2" } }, { fetchPayment: foreign as any }))
      .toBe("ignored:foreign-refund-or-dispute");
    expect(mocks.sendOpsAlert).toHaveBeenCalledTimes(1);
  });
});

describe("runLlcWhopReconciliation", () => {
  it("is a no-op without Whop API config", async () => {
    await expect(runLlcWhopReconciliation({ env: {} as NodeJS.ProcessEnv })).resolves.toBeNull();
  });

  it("lists paid payments only for the exact plan persisted on an unpaid order", async () => {
    mocks.rows = [[{ registrationId: 42, planId: "plan_llc42" }], []];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const parsed = new URL(String(url));
      expect(parsed.pathname).toBe("/api/v1/payments");
      expect(parsed.searchParams.get("account_id")).toBe("biz_rentalcalc123");
      expect(parsed.searchParams.get("plan_id")).toBe("plan_llc42");
      expect(parsed.searchParams.get("status")).toBe("paid");
      expect(parsed.searchParams.get("substatus")).toBe("succeeded");
      return new Response(JSON.stringify({
        data: [{ id: "pay_llc42", status: "paid", substatus: "succeeded", plan_id: "plan_llc42" }],
        page_info: { has_next_page: false },
      }), { status: 200 });
    });
    const processPayment = vi.fn(async () => ({ outcome: "filed" as const, registrationId: 42, paymentId: "pay_llc42" }));
    const report = await runLlcWhopReconciliation({ env: ENV_OK, fetchImpl: fetchImpl as any, processPayment: processPayment as any });
    expect(report).toMatchObject({ filingsChecked: 1, paymentsSeen: 1, processed: 1, skipped: 0, incomplete: 0 });
    expect(processPayment).toHaveBeenCalledWith({ paymentId: "pay_llc42", expectedRegistrationId: 42, fetchImpl });
  });

  it("resumes an already-claimed paid order without listing payments", async () => {
    mocks.rows = [[], [{ registrationId: 77, paymentId: "pay_claimed_77" }]];
    const fetchImpl = vi.fn();
    const processPayment = vi.fn(async () => ({ outcome: "filed" as const, registrationId: 77, paymentId: "pay_claimed_77" }));
    const report = await runLlcWhopReconciliation({ env: ENV_OK, fetchImpl: fetchImpl as any, processPayment: processPayment as any });
    expect(report).toMatchObject({ filingsChecked: 1, paymentsSeen: 0, processed: 1 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not resume filings when auto-file is disabled", async () => {
    mocks.env.llcAutoFileEnabled = false;
    mocks.rows = [[]];
    const processPayment = vi.fn();
    const report = await runLlcWhopReconciliation({ env: ENV_OK, fetchImpl: vi.fn() as any, processPayment: processPayment as any });
    expect(report).toMatchObject({ filingsChecked: 0, processed: 0 });
    expect(processPayment).not.toHaveBeenCalled();
  });

  it("fails closed when a payment resolves to a different order", async () => {
    mocks.rows = [[{ registrationId: 42, planId: "plan_llc42" }], []];
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: [{ id: "pay_x", status: "paid", substatus: "succeeded", plan_id: "plan_llc42" }],
      page_info: { has_next_page: false },
    }), { status: 200 }));
    const processPayment = vi.fn(async () => ({ outcome: "filed" as const, registrationId: 999, paymentId: "pay_x" }));
    const report = await runLlcWhopReconciliation({ env: ENV_OK, fetchImpl: fetchImpl as any, processPayment: processPayment as any });
    expect(report).toMatchObject({ processed: 0, skipped: 1, incomplete: 1 });
    expect(report?.outcomes["registration-mismatch"]).toBe(1);
  });
});

describe("wiring (structural)", () => {
  const read = (relative: string) => readFileSync(join(__dirname, "..", "..", relative), "utf8");

  it("mounts the Whop webhook before the JSON body parser", () => {
    const index = read("server/_core/index.ts");
    const mount = index.indexOf("registerWhopRetailWebhook(app)");
    expect(mount).toBeGreaterThan(-1);
    expect(mount).toBeLessThan(index.indexOf("app.use(express.json("));
  });

  it("runs reconciliation on the status-poll heartbeat", () => {
    const poller = read("server/ops/poller.ts");
    expect(poller).toContain("runLlcWhopReconciliation()");
  });

  it("ensures the new columns at boot with catch-guarded additive DDL", () => {
    const ensure = read("server/llc/ensure-tables.ts");
    for (const column of ["retailWhopPlanId", "retailWhopPaymentId", "checkoutQuoteHash", "checkoutExpiresAt"]) {
      expect(ensure).toContain(`ADD \`${column}\``);
    }
    expect(ensure).toContain("llc_registration_retail_whop_payment_unique");
    expect(ensure).toContain("for (const statement of WHOP_RETAIL_RAIL_DDL)");
    expect(ensure).not.toMatch(/DROP\s/i);
  });

  it("keeps the Stripe rail registered for in-flight orders", () => {
    const index = read("server/_core/index.ts");
    expect(index).toContain("registerStripeWebhook(app)");
  });
});

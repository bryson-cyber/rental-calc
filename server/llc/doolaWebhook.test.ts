import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { Request, Response } from "express";

const database = vi.hoisted(() => ({ getDb: vi.fn() }));
const refresh = vi.hoisted(() => ({ refreshDoolaRegistrationStatus: vi.fn(async () => ({ refreshed: true, changed: false })) }));
const notify = vi.hoisted(() => ({
  sendOpsAlert: vi.fn(async () => true),
  submissionProblemAlert: vi.fn((params: unknown) => params),
  statusChangeAlert: vi.fn((params: unknown) => params),
}));
const store = vi.hoisted(() => ({ transitionLlcStatus: vi.fn(async () => ({ changed: true })) }));
const requiredActions = vi.hoisted(() => ({
  ingestDoolaRequiredActionWebhook: vi.fn(async () => ({ row: { id: 1 }, opened: true })),
}));

vi.mock("../db", () => ({ getDb: database.getDb }));
vi.mock("./doolaSubmission", () => ({
  refreshDoolaRegistrationStatus: refresh.refreshDoolaRegistrationStatus,
}));
vi.mock("../ops/notify", () => ({
  sendOpsAlert: notify.sendOpsAlert,
  submissionProblemAlert: notify.submissionProblemAlert,
  statusChangeAlert: notify.statusChangeAlert,
}));
vi.mock("./store", () => ({ transitionLlcStatus: store.transitionLlcStatus }));
vi.mock("./requiredActions", () => ({
  ingestDoolaRequiredActionWebhook: requiredActions.ingestDoolaRequiredActionWebhook,
}));

import {
  processDoolaEvent,
  registerDoolaWebhook,
  verifyDoolaSignature,
} from "./doolaWebhook";

const SECRET = "a-sufficiently-long-secret";

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(Buffer.from(body)).digest("hex");
}

function makeFakeDb(selectRows: unknown[], insertFails = false) {
  return {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => selectRows,
        }),
      }),
    })),
    insert: vi.fn(() => ({
      values: async () => {
        if (insertFails) throw new Error("duplicate");
        return [{ insertId: 1 }];
      },
    })),
  };
}

function getHandler() {
  let handler:
    | ((req: Request, res: Response) => void)
    | undefined;
  registerDoolaWebhook({
    post: (_path: string, _middleware: unknown, fn: never) => {
      handler = fn;
    },
  } as never);
  if (!handler) throw new Error("route not registered");
  return handler;
}

function makeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res as typeof res & Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("DOOLA_WEBHOOK_SECRET", SECRET);
});

describe("Doola webhook signature", () => {
  it("accepts a valid HMAC and rejects tampering", () => {
    const body = Buffer.from(JSON.stringify({ eventId: "evt_1" }));
    const good = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyDoolaSignature(body, good, SECRET)).toBe(true);
    expect(verifyDoolaSignature(body, good.replace(/^./, "0"), SECRET)).toBe(
      good.startsWith("0"), // only true if unchanged
    );
    expect(verifyDoolaSignature(Buffer.from("other"), good, SECRET)).toBe(false);
    expect(verifyDoolaSignature(body, undefined, SECRET)).toBe(false);
    expect(verifyDoolaSignature(body, "not-hex-or-wrong-length", SECRET)).toBe(false);
  });
});

describe("Doola webhook route", () => {
  it("401s an invalid signature and never processes", async () => {
    const body = JSON.stringify({ eventId: "evt_1", eventName: "company_ein_issued" });
    const res = makeRes();
    getHandler()(
      {
        body: Buffer.from(body),
        headers: { "x-doola-signature": "deadbeef" },
      } as never,
      res,
    );
    expect(res.statusCode).toBe(401);
    expect(refresh.refreshDoolaRegistrationStatus).not.toHaveBeenCalled();
  });

  it("503s when the secret is not configured", async () => {
    vi.stubEnv("DOOLA_WEBHOOK_SECRET", "");
    const res = makeRes();
    getHandler()({ body: Buffer.from("{}"), headers: {} } as never, res);
    expect(res.statusCode).toBe(503);
  });

  it("acks a valid delivery with 200 immediately", async () => {
    database.getDb.mockResolvedValue(
      makeFakeDb([{ id: 41, userId: 7, status: "processing", legalName: "X", entitySuffix: "LLC" }]),
    );
    const body = JSON.stringify({
      eventId: "evt_1",
      eventName: "company_ein_issued",
      eventPayload: { doolaCompanyId: "dc_1" },
    });
    const res = makeRes();
    getHandler()(
      { body: Buffer.from(body), headers: { "x-doola-signature": sign(body) } } as never,
      res,
    );
    expect(res.statusCode).toBe(200);
    // Processing is async; give the microtask queue a tick.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refresh.refreshDoolaRegistrationStatus).toHaveBeenCalledWith({
      userId: 7,
      registrationId: 41,
    });
  });
});

describe("Doola event processing", () => {
  it("deduplicates by eventId — a replayed delivery does nothing", async () => {
    database.getDb.mockResolvedValue(
      makeFakeDb(
        [{ id: 41, userId: 7, status: "processing", legalName: "X", entitySuffix: "LLC" }],
        true, // unique-claim insert fails = duplicate
      ),
    );
    await processDoolaEvent({
      eventId: "evt_dup",
      eventName: "company_formation_completed",
      eventPayload: { doolaCompanyId: "dc_1" },
    });
    expect(refresh.refreshDoolaRegistrationStatus).not.toHaveBeenCalled();
  });

  it("formation_failed transitions to action_required and alerts ops", async () => {
    database.getDb.mockResolvedValue(
      makeFakeDb([{ id: 41, userId: 7, status: "processing", legalName: "X", entitySuffix: "LLC" }]),
    );
    await processDoolaEvent({
      eventId: "evt_fail",
      eventName: "company_formation_failed",
      eventPayload: { doolaCompanyId: "dc_1", reasonCode: "NAME_UNAVAILABLE" },
    });
    expect(store.transitionLlcStatus).toHaveBeenCalledWith(
      expect.objectContaining({ toStatus: "action_required" }),
    );
    expect(notify.sendOpsAlert).toHaveBeenCalled();
    expect(refresh.refreshDoolaRegistrationStatus).not.toHaveBeenCalled();
  });

  it("signature reminders alert ops to relay under the brand", async () => {
    database.getDb.mockResolvedValue(
      makeFakeDb([{ id: 41, userId: 7, status: "action_required", legalName: "X", entitySuffix: "LLC" }]),
    );
    await processDoolaEvent({
      eventId: "evt_rem",
      eventName: "signature_ss4_reminder_due",
      eventPayload: { doolaCompanyId: "dc_1", daysSinceRequested: 5 },
    });
    expect(notify.sendOpsAlert).toHaveBeenCalled();
    expect(refresh.refreshDoolaRegistrationStatus).not.toHaveBeenCalled();
  });

  it.each([
    ["company_name_options_required", "FORMATION_NAME_OPTIONS_EXHAUSTED"],
    ["signature_ss4_reset", "FORMATION_SIGNATURE_SS4_RESET"],
  ])("persists %s as a first-class blocker and refreshes the company", async (eventName, actionCode) => {
    database.getDb.mockResolvedValue(
      makeFakeDb([{ id: 41, userId: 7, status: "processing", legalName: "X", entitySuffix: "LLC" }]),
    );
    await processDoolaEvent({
      eventId: `evt_${eventName}`,
      eventName,
      eventPayload: {
        doolaCompanyId: "dc_1",
        requiredActionId: "ra_1",
        actionCode,
        actionName: "Action needed",
        reason: "Customer response needed.",
      },
    });
    expect(requiredActions.ingestDoolaRequiredActionWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ eventName }),
    );
    expect(refresh.refreshDoolaRegistrationStatus).toHaveBeenCalledWith({
      userId: 7,
      registrationId: 41,
    });
  });

  it("webhook-disabled alerts ops without needing a registration", async () => {
    await processDoolaEvent({
      eventId: "evt_disabled",
      eventName: "partner_webhook_disabled",
    });
    expect(notify.sendOpsAlert).toHaveBeenCalled();
  });

  it("document and milestone events resolve through a full refresh", async () => {
    database.getDb.mockResolvedValue(
      makeFakeDb([{ id: 41, userId: 7, status: "processing", legalName: "X", entitySuffix: "LLC" }]),
    );
    for (const eventName of [
      "company_formation_completed",
      "document_aoo_uploaded",
      "document_einletter_uploaded",
      "signature_ss4_completed",
    ]) {
      refresh.refreshDoolaRegistrationStatus.mockClear();
      await processDoolaEvent({
        eventId: `evt_${eventName}`,
        eventName,
        eventPayload: { doolaCompanyId: "dc_1" },
      });
      expect(refresh.refreshDoolaRegistrationStatus).toHaveBeenCalledTimes(1);
    }
  });
});

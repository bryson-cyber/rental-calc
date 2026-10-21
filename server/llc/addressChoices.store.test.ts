/**
 * Saving address choices (2026-10-14; owner: an LLC was filed with the
 * registered agent's address as its business address; fix it in every app):
 * the draft save derives the old switch and stamps acknowledgments; the
 * after-submission confirmation changes only the address choices of a held
 * order and clears the submission key so the company is created with a fresh
 * idempotency key.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAILING_AGENT_ACK } from "../../shared/llcAddress";

const database = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, getDb: database.getDb };
});

import { saveLlcAddressChoices, saveLlcDraft } from "./store";
import { validDraft } from "./test-fixtures";

const now = new Date("2026-10-14T18:00:00.000Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 41,
    userId: 7,
    status: "payment_required",
    formationState: "OK",
    legalName: "Amara Rose Stays",
    businessPhone: null,
    useRegisteredAgent: true,
    businessAddressMode: null,
    mailingAddressMode: null,
    businessAgentAckAt: null,
    businessAgentAckVersion: null,
    mailingAgentAckAt: null,
    mailingAgentAckVersion: null,
    addressChoiceEvidence: null,
    companyAddressLine1: null,
    companyAddressLine2: null,
    companyAddressCity: null,
    companyAddressState: null,
    companyAddressPostalCode: null,
    companyAddressCountry: "US",
    checkoutSessionId: "cs_1",
    retailPaidAt: now,
    lastErrorType: null,
    submissionKey: "abc123",
    isTest: false,
    provider: "doola",
    doolaCompanyId: null,
    ...overrides,
  };
}

function fakeDb(current: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];
  const where = () => ({
    limit: async () => [current],
    orderBy: async () => [],
  });
  const tx = {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updates.push(values);
          return [{ affectedRows: 1 }];
        },
      }),
    }),
    delete: () => ({ where: async () => undefined }),
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        inserts.push(values);
      },
    }),
  };
  return {
    db: {
      select: () => ({ from: () => ({ where }) }),
      transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
    updates,
    inserts,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("saveLlcDraft", () => {
  it("derives the old switch from the modes and ignores what the client sent", async () => {
    const fake = fakeDb(row({ status: "draft", checkoutSessionId: null, useRegisteredAgent: false }));
    database.getDb.mockResolvedValue(fake.db);
    await saveLlcDraft(7, 41, { ...validDraft, useRegisteredAgent: true });
    expect(fake.updates[0]).toMatchObject({
      useRegisteredAgent: false,
      businessAddressMode: "customer",
      mailingAddressMode: "customer",
      businessAgentAckVersion: null,
      mailingAgentAckVersion: null,
    });
  });

  it("stamps the mail opt-in acknowledgment with its version and time", async () => {
    const fake = fakeDb(row({ status: "draft", checkoutSessionId: null }));
    database.getDb.mockResolvedValue(fake.db);
    await saveLlcDraft(7, 41, {
      ...validDraft,
      mailingAddressMode: "registered_agent",
      mailingAgentAckVersion: MAILING_AGENT_ACK.version,
    });
    expect(fake.updates[0]).toMatchObject({
      mailingAddressMode: "registered_agent",
      mailingAgentAckVersion: MAILING_AGENT_ACK.version,
    });
    expect(fake.updates[0].mailingAgentAckAt).toBeInstanceOf(Date);
  });
});

describe("saveLlcAddressChoices", () => {
  const choices = {
    businessAddressMode: "customer" as const,
    mailingAddressMode: "customer" as const,
    businessAgentAckVersion: "",
    mailingAgentAckVersion: "",
    companyAddress: { line1: "500 Main St", line2: "", city: "Tulsa", state: "OK", postalCode: "74103", country: "US" },
    businessPhone: "+19185550100",
  };

  it("saves only the address choices of a held order, clears the key, and notes it without the address", async () => {
    const fake = fakeDb(row());
    database.getDb.mockResolvedValue(fake.db);
    await saveLlcAddressChoices(7, 41, choices);
    expect(fake.updates).toHaveLength(1);
    const update = fake.updates[0];
    expect(update).toMatchObject({
      useRegisteredAgent: false,
      businessAddressMode: "customer",
      mailingAddressMode: "customer",
      companyAddressLine1: "500 Main St",
      businessPhone: "+19185550100",
      submissionKey: null,
    });
    for (const key of ["status", "formationState", "legalName", "retailPaidAt", "expediteEin", "doolaCompanyId", "provider"]) {
      expect(update).not.toHaveProperty(key);
    }
    expect((update.addressChoiceEvidence as { confirmed: Record<string, unknown> }).confirmed).toMatchObject({
      business: "customer",
      mailing: "customer",
    });
    const note = String(fake.inserts[0].note);
    expect(note).toContain("business address = the client's own street address");
    expect(note).not.toMatch(/500 Main|Tulsa|74103/);
  });

  it("refuses an order that does not need it, or incomplete choices", async () => {
    const valid = fakeDb(row({ useRegisteredAgent: false, businessAddressMode: "customer", mailingAddressMode: "customer", companyAddressLine1: "1 A St", companyAddressCity: "Tulsa", companyAddressState: "OK", companyAddressPostalCode: "74103", businessPhone: "+19185550100" }));
    database.getDb.mockResolvedValue(valid.db);
    await expect(saveLlcAddressChoices(7, 41, choices)).rejects.toThrow(/can no longer be changed/);

    const filed = fakeDb(row({ doolaCompanyId: "dc_1" }));
    database.getDb.mockResolvedValue(filed.db);
    await expect(saveLlcAddressChoices(7, 41, choices)).rejects.toThrow(/can no longer be changed/);

    const incomplete = fakeDb(row());
    database.getDb.mockResolvedValue(incomplete.db);
    await expect(
      saveLlcAddressChoices(7, 41, { ...choices, companyAddress: { ...choices.companyAddress, line1: "PO Box 4" } }),
    ).rejects.toThrow(/not complete/);
    expect(incomplete.updates).toHaveLength(0);
  });
});

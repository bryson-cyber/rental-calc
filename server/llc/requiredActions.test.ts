import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ getDb: vi.fn() }));
const provider = vi.hoisted(() => ({
  createSignatureSession: vi.fn(),
  getRequiredAction: vi.fn(),
  listForCompany: vi.fn(),
  listOpen: vi.fn(),
  resolveNames: vi.fn(),
}));
const store = vi.hoisted(() => ({ transition: vi.fn(async () => ({ changed: true })) }));

vi.mock("../db", () => ({ getDb: database.getDb }));
vi.mock("./store", () => ({ transitionLlcStatus: store.transition }));
vi.mock("./doola", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./doola")>();
  return {
    ...actual,
    createDoolaSignatureSession: provider.createSignatureSession,
    getDoolaRequiredAction: provider.getRequiredAction,
    listDoolaRequiredActionsForCompany: provider.listForCompany,
    listOpenDoolaRequiredActions: provider.listOpen,
    resolveDoolaNameOptionsRequiredAction: provider.resolveNames,
  };
});

import {
  createSs4SigningSessionForAction,
  submitNameOptionsForAction,
} from "./requiredActions";

const now = new Date("2026-08-26T19:00:00.000Z");
const registration = {
  id: 41,
  userId: 7,
  status: "action_required",
  legalName: "Old Name",
  entitySuffix: "LLC",
  doolaCompanyId: "dc_1",
};
const action = {
  id: 9,
  registrationId: 41,
  requiredActionId: "ra_1",
  doolaCompanyId: "dc_1",
  actionCode: "FORMATION_NAME_OPTIONS_EXHAUSTED",
  actionName: "New company names needed",
  reason: "Every submitted name was rejected.",
  status: "delivered",
  open: true,
  source: "webhook",
  providerUpdatedAt: now,
  history: null,
  submittedPayload: null,
  clientNotifiedAt: now,
  opsNotifiedAt: now,
  resolvedAt: null,
  createdAt: now,
  updatedAt: now,
};

function makeDb(selectResults: unknown[][]) {
  const queue = [...selectResults];
  return {
    select: vi.fn(() => ({
      from: () => {
        const rows = queue.shift() ?? [];
        const whereResult = {
          limit: async () => rows,
          orderBy: async () => rows,
        };
        return {
          innerJoin: () => ({ where: () => whereResult }),
          where: () => whereResult,
        };
      },
    })),
    update: vi.fn(() => ({
      set: () => ({ where: async () => [] }),
    })),
    insert: vi.fn(() => ({ values: async () => [{ insertId: 9 }] })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Doola Required Actions responses", () => {
  it("submits unique replacement names with the registration entity ending", async () => {
    const submitted = {
      requiredActionId: "ra_1",
      doolaCompanyId: "dc_1",
      actionCode: "FORMATION_NAME_OPTIONS_EXHAUSTED",
      actionName: "New company names needed",
      status: "submitted",
      reason: "Every submitted name was rejected.",
      open: true,
      updatedAt: now.toISOString(),
      history: [
        {
          status: "submitted",
          submittedPayload: { nameOptions: [{ name: "Better Stays" }] },
          createdAt: now.toISOString(),
        },
      ],
    };
    provider.resolveNames.mockResolvedValue(submitted);
    database.getDb.mockResolvedValue(
      makeDb([
        [{ action, registration }],
        [action],
        [{ ...action, status: "submitted", history: submitted.history }],
      ]),
    );

    const result = await submitNameOptionsForAction({
      userId: 7,
      registrationId: 41,
      actionId: 9,
      names: ["Better Stays", "Second Choice"],
    });

    expect(result.status).toBe("submitted");
    expect(provider.resolveNames).toHaveBeenCalledWith({
      doolaCompanyId: "dc_1",
      requiredActionId: "ra_1",
      nameOptions: [
        { name: "Better Stays", entityTypeEnding: "LLC", position: 1 },
        { name: "Second Choice", entityTypeEnding: "LLC", position: 2 },
      ],
    });
  });

  it("rejects duplicate replacement names before calling Doola", async () => {
    database.getDb.mockResolvedValue(makeDb([[{ action, registration }]]));
    await expect(
      submitNameOptionsForAction({
        userId: 7,
        registrationId: 41,
        actionId: 9,
        names: ["Same Name", "same name"],
      }),
    ).rejects.toThrow("must be different");
    expect(provider.resolveNames).not.toHaveBeenCalled();
  });

  it("generates a fresh short-lived SS-4 signing session", async () => {
    const signatureAction = {
      ...action,
      actionCode: "FORMATION_SIGNATURE_SS4_RESET",
    };
    database.getDb.mockResolvedValue(makeDb([[{ action: signatureAction, registration }]]));
    provider.createSignatureSession.mockResolvedValue({
      url: "https://signsessions.com/s/short-lived",
      expiresAt: "2026-08-26T21:00:00.000Z",
    });

    const result = await createSs4SigningSessionForAction({
      userId: 7,
      registrationId: 41,
      actionId: 9,
    });

    expect(provider.createSignatureSession).toHaveBeenCalledWith("dc_1", "SS4");
    expect(result.url).toContain("signsessions.com");
  });
});

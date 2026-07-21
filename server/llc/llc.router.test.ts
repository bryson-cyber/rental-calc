import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlcDraft } from "../../shared/llc";
import type { TrpcContext } from "../_core/context";
import { validDraft } from "./test-fixtures";

const database = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  listAll: vi.fn(),
  findOwner: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
  transition: vi.fn(),
  updateProvider: vi.fn(),
}));

const submission = vi.hoisted(() => ({
  submit: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store")>();
  return {
    isRegistrationEditable: actual.isRegistrationEditable,
    UNCERTAIN_ERROR_PREFIX: actual.UNCERTAIN_ERROR_PREFIX,
    createLlcRegistration: database.create,
    listLlcRegistrationsForUser: database.list,
    listAllLlcRegistrations: database.listAll,
    findLlcRegistrationOwner: database.findOwner,
    getLlcRegistrationById: database.get,
    saveLlcDraft: database.save,
    transitionLlcStatus: database.transition,
    updateLlcRegistrationProviderFields: database.updateProvider,
  };
});

vi.mock("./submission", async () => {
  const actual = await vi.importActual<typeof import("./submission")>("./submission");
  return {
    ...actual,
    submitLlcRegistration: submission.submit,
    refreshLlcRegistrationStatus: submission.refresh,
  };
});

import { appRouter } from "../routers";

function makeBundle(status: "draft" | "ready" = "draft") {
  const now = new Date("2026-07-21T12:00:00.000Z");
  return {
    registration: {
      id: 41,
      userId: 7,
      status,
      currentStep: validDraft.currentStep,
      legalName: validDraft.legalName,
      entitySuffix: validDraft.entitySuffix,
      formationState: validDraft.formationState,
      businessType: validDraft.businessType,
      industryGroup: validDraft.industryGroup,
      industryType: validDraft.industryType,
      businessPhone: validDraft.businessPhone,
      website: validDraft.website,
      useRegisteredAgent: validDraft.useRegisteredAgent,
      companyAddressLine1: validDraft.companyAddress.line1,
      companyAddressLine2: validDraft.companyAddress.line2,
      companyAddressCity: validDraft.companyAddress.city,
      companyAddressState: validDraft.companyAddress.state,
      companyAddressPostalCode: validDraft.companyAddress.postalCode,
      companyAddressCountry: validDraft.companyAddress.country,
      expediteEin: validDraft.expediteEin,
      accuracyAttested: validDraft.accuracyAttested,
      whopAccountId: null as string | null,
      accountEmailAlias: null as string | null,
      checkoutSessionId: null as string | null,
      checkoutUrl: null as string | null,
      checkoutTotal: null as number | null,
      checkoutCurrency: null as string | null,
      retailPriceCents: null as number | null,
      opsNotifiedAt: null as Date | null,
      providerStatus: null as Record<string, unknown> | null,
      lastProviderSyncAt: null as Date | null,
      lastErrorType: null as string | null,
      lastErrorMessage: null as string | null,
      retryable: false,
      submissionKey: "stable-key",
      submittedAt: null as Date | null,
      createdAt: now,
      updatedAt: now,
    },
    founders: validDraft.founders.map((founder, index) => ({
      id: index + 1,
      registrationId: 41,
      sortOrder: index,
      isPrimary: founder.isPrimary,
      firstName: founder.firstName,
      lastName: founder.lastName,
      email: founder.email,
      phone: founder.phone,
      ownershipBasisPoints: Math.round((founder.ownershipPercentage ?? 0) * 100),
      addressLine1: founder.address.line1,
      addressLine2: founder.address.line2,
      addressCity: founder.address.city,
      addressState: founder.address.state,
      addressPostalCode: founder.address.postalCode,
      addressCountry: founder.address.country,
      createdAt: now,
      updatedAt: now,
    })),
    attempts: [],
    history: [
      {
        id: 1,
        registrationId: 41,
        fromStatus: null,
        toStatus: status,
        source: "user" as const,
        note: "Registration created",
        createdAt: now,
      },
    ],
  };
}

function makeBundleForDraft(draft: LlcDraft) {
  const bundle = makeBundle();
  return {
    ...bundle,
    registration: {
      ...bundle.registration,
      currentStep: draft.currentStep,
      legalName: draft.legalName,
      entitySuffix: draft.entitySuffix,
      formationState: draft.formationState,
      businessType: draft.businessType,
      industryGroup: draft.industryGroup,
      industryType: draft.industryType,
      businessPhone: draft.businessPhone,
      website: draft.website,
      useRegisteredAgent: draft.useRegisteredAgent,
      companyAddressLine1: draft.companyAddress.line1,
      companyAddressLine2: draft.companyAddress.line2,
      companyAddressCity: draft.companyAddress.city,
      companyAddressState: draft.companyAddress.state,
      companyAddressPostalCode: draft.companyAddress.postalCode,
      companyAddressCountry: draft.companyAddress.country,
      expediteEin: draft.expediteEin,
      accuracyAttested: draft.accuracyAttested,
    },
    founders: draft.founders.map((founder, index) => ({
      id: index + 1,
      registrationId: bundle.registration.id,
      sortOrder: index,
      isPrimary: founder.isPrimary,
      firstName: founder.firstName,
      lastName: founder.lastName,
      email: founder.email,
      phone: founder.phone,
      ownershipBasisPoints: Math.round((founder.ownershipPercentage ?? 0) * 100),
      addressLine1: founder.address.line1,
      addressLine2: founder.address.line2,
      addressCity: founder.address.city,
      addressState: founder.address.state,
      addressPostalCode: founder.address.postalCode,
      addressCountry: founder.address.country,
      createdAt: bundle.registration.createdAt,
      updatedAt: bundle.registration.updatedAt,
    })),
  };
}

// Member procedures are gated by protectedProcedure: any signed-in user (role
// "user") may file. Ops procedures require role "admin".
function makeContext(
  userId: number | null,
  role: "user" | "admin" = "user",
): TrpcContext {
  return {
    user:
      userId === null
        ? null
        : {
            id: userId,
            openId: `user-${userId}`,
            email: `owner${userId}@example.com`,
            name: `Owner ${userId}`,
            phone: null,
            loginMethod: "manus",
            role,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
            reportMode: null,
          },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  const bundle = makeBundle();
  database.create.mockResolvedValue(bundle.registration);
  database.list.mockResolvedValue([bundle.registration]);
  database.listAll.mockResolvedValue([
    { registration: bundle.registration, clientName: "Owner 7", clientEmail: "owner7@example.com" },
  ]);
  database.findOwner.mockResolvedValue({ userId: 7 });
  database.get.mockResolvedValue(bundle);
  database.save.mockResolvedValue(bundle);
  database.updateProvider.mockResolvedValue(bundle);
  database.transition.mockResolvedValue({ changed: true, registration: bundle.registration });
  submission.submit.mockResolvedValue({ outcome: "in_progress", registration: null });
  submission.refresh.mockResolvedValue({ refreshed: false, registration: null, message: "no change" });
});

describe("LLC protected router ownership", () => {
  it("rejects unauthenticated llc.list with UNAUTHORIZED before any database call", async () => {
    const caller = appRouter.createCaller(makeContext(null));
    await expect(caller.llc.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(database.list).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated draft access before any database call", async () => {
    const caller = appRouter.createCaller(makeContext(null));
    await expect(caller.llc.get({ id: 41 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.llc.create()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(database.get).not.toHaveBeenCalled();
    expect(database.create).not.toHaveBeenCalled();
  });

  it("admits an ordinary signed-in user (filing requires an account, not admin)", async () => {
    const caller = appRouter.createCaller(makeContext(7, "user"));
    const result = await caller.llc.list();
    expect(result).toHaveLength(1);
    expect(database.list).toHaveBeenCalledWith(7);
  });

  it("scopes reads to the authenticated user and requested registration", async () => {
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.llc.get({ id: 41 });
    expect(result.draft.legalName).toBe(validDraft.legalName);
    expect(result.orderRef).toBe("NF-0041");
    expect(database.get).toHaveBeenCalledWith(7, 41);
  });

  it("returns NOT_FOUND rather than leaking other users' registrations", async () => {
    database.get.mockResolvedValue(null);
    const caller = appRouter.createCaller(makeContext(9));
    await expect(caller.llc.get({ id: 41 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(database.get).toHaveBeenCalledWith(9, 41);
  });

  it("lists only the authenticated user's registrations as summaries", async () => {
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.llc.list();
    expect(database.list).toHaveBeenCalledWith(7);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 41, orderRef: "NF-0041" });
  });

  it("creates a registration owned by the authenticated user", async () => {
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.llc.create();
    expect(database.create).toHaveBeenCalledWith(7);
    expect(result.id).toBe(41);
  });

  it("saves drafts with the authenticated user ID rather than client-supplied ownership", async () => {
    const caller = appRouter.createCaller(makeContext(7));
    await caller.llc.saveDraft({ id: 41, draft: validDraft });
    expect(database.save).toHaveBeenCalledWith(7, 41, validDraft);
  });

  it("persists a protected draft save and rehydrates it for a later caller", async () => {
    const persistedDraft: LlcDraft = {
      ...validDraft,
      currentStep: 4,
      legalName: "Persisted Resume Fixture LLC",
      businessPhone: "+14155550188",
      website: "https://resume.example.test",
      companyAddress: {
        ...validDraft.companyAddress,
        line2: "Suite 204",
      },
    };
    let persistedBundle = makeBundleForDraft(validDraft);

    database.save.mockImplementation(
      async (userId: number, registrationId: number, draft: LlcDraft) => {
        expect(userId).toBe(7);
        expect(registrationId).toBe(41);
        persistedBundle = makeBundleForDraft(draft);
        return persistedBundle;
      },
    );
    database.get.mockImplementation(async (userId: number, registrationId: number) => {
      expect(userId).toBe(7);
      expect(registrationId).toBe(41);
      return persistedBundle;
    });

    const saveCaller = appRouter.createCaller(makeContext(7));
    const saved = await saveCaller.llc.saveDraft({ id: 41, draft: persistedDraft });
    expect(saved.draft.legalName).toBe("Persisted Resume Fixture LLC");
    expect(saved.draft.currentStep).toBe(4);

    const resumedCaller = appRouter.createCaller(makeContext(7));
    const resumed = await resumedCaller.llc.get({ id: 41 });
    expect(resumed.draft).toEqual(persistedDraft);
    expect(database.save).toHaveBeenCalledWith(7, 41, persistedDraft);
  });

  it("binds final validation status transitions to the authenticated user", async () => {
    const bundle = makeBundle("draft");
    database.get.mockResolvedValue(bundle);
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.llc.validateForSubmission({ id: 41 });
    expect(result.valid).toBe(true);
    expect(database.transition).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, registrationId: 41, toStatus: "ready" }),
    );
  });

  it("passes only the authenticated identity into submission and refresh workflows", async () => {
    const caller = appRouter.createCaller(makeContext(7));
    await caller.llc.submit({ id: 41 });
    await caller.llc.refreshStatus({ id: 41 });
    expect(submission.submit).toHaveBeenCalledWith({
      userId: 7,
      registrationId: 41,
    });
    expect(submission.refresh).toHaveBeenCalledWith({
      userId: 7,
      registrationId: 41,
    });
  });
});

describe("LLC client view white-label boundary", () => {
  it("never exposes checkout, provider identifiers, or internal notes to clients", async () => {
    const bundle = makeBundle("ready");
    bundle.registration.whopAccountId = "biz_Secret123";
    bundle.registration.checkoutSessionId = "ch_Secret123";
    bundle.registration.checkoutUrl = "https://whop.com/checkout/secret";
    bundle.registration.checkoutTotal = 39900;
    bundle.registration.checkoutCurrency = "usd";
    bundle.registration.accountEmailAlias = "ops+reg41@example.com";
    database.get.mockResolvedValue(bundle);

    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.llc.get({ id: 41 });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("whop.com");
    expect(serialized).not.toContain("biz_");
    expect(serialized).not.toContain("ch_");
    expect(serialized).not.toContain("39900");
    expect(serialized).not.toContain("ops+reg41");
    expect(serialized.toLowerCase()).not.toContain("whop");
    expect(result).not.toHaveProperty("checkout");
    expect(result.history.every((item) => !("note" in item))).toBe(true);
  });
});

describe("LLC ops router authorization", () => {
  it("forbids non-admin users from every ops procedure", async () => {
    const caller = appRouter.createCaller(makeContext(7, "user"));
    await expect(caller.llcOps.listAll()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.llcOps.get({ id: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.llcOps.setRetailPrice({ id: 41, retailPriceCents: 79900 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.llcOps.refresh({ id: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(database.listAll).not.toHaveBeenCalled();
  });

  it("forbids unauthenticated callers from the ops surface", async () => {
    const caller = appRouter.createCaller(makeContext(null));
    await expect(caller.llcOps.listAll()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(database.listAll).not.toHaveBeenCalled();
  });

  it("exposes checkout, costs, and margin to admins", async () => {
    const bundle = makeBundle("ready");
    bundle.registration.checkoutSessionId = "ch_test_123";
    bundle.registration.checkoutUrl = "https://whop.com/checkout/test";
    bundle.registration.checkoutTotal = 39900;
    bundle.registration.checkoutCurrency = "usd";
    bundle.registration.retailPriceCents = 79900;
    database.get.mockResolvedValue(bundle);

    const caller = appRouter.createCaller(makeContext(1, "admin"));
    const result = await caller.llcOps.get({ id: 41 });
    expect(database.findOwner).toHaveBeenCalledWith(41);
    expect(database.get).toHaveBeenCalledWith(7, 41);
    expect(result.checkout?.url).toBe("https://whop.com/checkout/test");
    expect(result.marginCents).toBe(40000);
  });

  it("stores retail price through the owner-resolved registration", async () => {
    const caller = appRouter.createCaller(makeContext(1, "admin"));
    await caller.llcOps.setRetailPrice({ id: 41, retailPriceCents: 79900 });
    expect(database.updateProvider).toHaveBeenCalledWith(7, 41, {
      retailPriceCents: 79900,
    });
  });
});

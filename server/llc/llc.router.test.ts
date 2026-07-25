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

const documents = vi.hoisted(() => ({
  list: vi.fn(),
  listAll: vi.fn(),
  listOps: vi.fn(),
  mirror: vi.fn(),
  findById: vi.fn(),
  setReleased: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("./documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./documents")>();
  return {
    ...actual,
    listFormationDocuments: documents.list,
    listAllFormationDocuments: documents.listAll,
    listOpsDocuments: documents.listOps,
    mirrorFormationDocuments: documents.mirror,
    findLlcDocumentById: documents.findById,
    setDocumentReleased: documents.setReleased,
    uploadOpsDocument: documents.upload,
    deleteLlcDocument: documents.remove,
  };
});

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

const pricing = vi.hoisted(() => ({
  getStatePricing: vi.fn(),
  getInactiveStateError: vi.fn(),
  listWithWholesale: vi.fn(),
  setStatePricing: vi.fn(),
  applyStateMarkup: vi.fn(),
  applyPaymentLink: vi.fn(),
}));

vi.mock("./pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./pricing")>();
  return {
    ...actual,
    getStatePricing: pricing.getStatePricing,
    getInactiveStateError: pricing.getInactiveStateError,
    listStatePricingWithWholesale: pricing.listWithWholesale,
    setStatePricing: pricing.setStatePricing,
    applyStateMarkup: pricing.applyStateMarkup,
    applyPaymentLinkToAllStates: pricing.applyPaymentLink,
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
      retailPaidAt: null as Date | null,
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
  documents.list.mockResolvedValue([
    {
      id: 1,
      registrationId: 41,
      name: "Articles of Organization",
      documentType: "articles_of_organization",
      releasedAt: Date.now(),
      createdAt: Date.now(),
      url: "/manus-storage/pdfs/7/llc/41/articles-of-organization.pdf",
    },
  ]);
  documents.listAll.mockResolvedValue([]);
  documents.listOps.mockResolvedValue([]);
  documents.mirror.mockResolvedValue({ mirrored: 0, skipped: 0 });
  documents.findById.mockResolvedValue({
    id: 1,
    registrationId: 41,
    userId: 7,
    name: "Articles of Organization",
    label: null,
    documentType: "articles_of_organization",
    source: "provider",
    storageKey: "pdfs/7/llc/41/articles-of-organization.pdf",
    releasedAt: null,
    createdAt: new Date(),
  });
  documents.setReleased.mockResolvedValue({ releasedAt: new Date() });
  documents.upload.mockResolvedValue({
    id: 2,
    registrationId: 41,
    userId: 7,
    name: "Operating agreement",
    label: null,
    documentType: "operating_agreement",
    source: "ops_upload",
    storageKey: "pdfs/7/llc/41/operating-agreement-x.pdf",
    releasedAt: new Date(),
    createdAt: new Date(),
  });
  documents.remove.mockResolvedValue(undefined);
  pricing.getInactiveStateError.mockResolvedValue(null);
  pricing.getStatePricing.mockResolvedValue({
    state: "WY",
    retailPriceCents: null,
    stateFeeCents: 10000,
    paymentLinkUrl: null,
    active: true,
  });
  pricing.listWithWholesale.mockResolvedValue([
    {
      state: "WY",
      retailPriceCents: 54900,
      stateFeeCents: 10000,
      paymentLinkUrl: "https://pay.example.com/llc",
      active: true,
      updatedAt: Date.now(),
      lastWholesaleCents: 39900,
      marginVsLastWholesaleCents: 15000,
    },
  ]);
  pricing.setStatePricing.mockResolvedValue({
    state: "WY",
    retailPriceCents: 54900,
    stateFeeCents: 10000,
    paymentLinkUrl: "https://pay.example.com/llc",
    active: true,
    updatedAt: new Date(),
  });
  pricing.applyStateMarkup.mockResolvedValue({ updated: 51 });
  pricing.applyPaymentLink.mockResolvedValue({ updated: 51 });
});

describe("LLC per-state pricing (client procedure)", () => {
  it("rejects unauthenticated pricing reads", async () => {
    const caller = appRouter.createCaller(makeContext(null));
    await expect(caller.llc.statePricing({ state: "WY" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns null-price states as unpriced (price not published)", async () => {
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.llc.statePricing({ state: "WY" });
    expect(result).toEqual({
      state: "WY",
      retailPriceCents: null,
      stateFeeCents: 10000,
      paymentLinkUrl: null,
      active: true,
    });
  });

  it("never exposes wholesale figures through the client pricing procedure", async () => {
    // Even if the store layer somehow carried wholesale context, the client
    // procedure output shape is fixed to retail-facing fields only.
    pricing.getStatePricing.mockResolvedValue({
      state: "WY",
      retailPriceCents: 54900,
      stateFeeCents: 10000,
      paymentLinkUrl: "https://pay.example.com/llc",
      active: true,
      // Extra fields must be dropped by the procedure's explicit mapping:
      lastWholesaleCents: 39900,
      checkoutTotal: 39900,
    } as never);

    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.llc.statePricing({ state: "WY" });
    const serialized = JSON.stringify(result);
    expect(result).not.toHaveProperty("lastWholesaleCents");
    expect(result).not.toHaveProperty("checkoutTotal");
    expect(serialized).not.toContain("39900");
    expect(serialized.toLowerCase()).not.toContain("wholesale");
    expect(serialized.toLowerCase()).not.toContain("whop");
    expect(serialized.toLowerCase()).not.toContain("doola");
  });
});

describe("LLC inactive-state submission block", () => {
  const inactiveMessage = "We're not filing in WY just yet. Choose another formation state, or check back soon.";

  it("blocks advancing past the Business step for an inactive state", async () => {
    pricing.getInactiveStateError.mockResolvedValue(inactiveMessage);
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.llc.advanceStep({ id: 41, step: 1, draft: validDraft });
    expect(result.advanced).toBe(false);
    if (!result.advanced) {
      expect(result.fieldErrors.formationState).toMatch(/not filing in WY just yet/);
    }
    expect(database.save).not.toHaveBeenCalled();
  });

  it("blocks final validation for an inactive state before any status transition", async () => {
    pricing.getInactiveStateError.mockResolvedValue(inactiveMessage);
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.llc.validateForSubmission({ id: 41 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.fieldErrors.formationState).toMatch(/not filing in WY just yet/);
    }
    expect(database.transition).not.toHaveBeenCalled();
  });
});

describe("LLC ops pricing management authorization", () => {
  it("forbids non-admin users from every pricing procedure", async () => {
    const caller = appRouter.createCaller(makeContext(7, "user"));
    await expect(caller.llcOps.listStatePricing()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.llcOps.setStatePricing({ state: "WY", retailPriceCents: 54900, active: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.llcOps.applyStateMarkup({ markupCents: 44900 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.llcOps.applyPaymentLink({ paymentLinkUrl: "https://pay.example.com/llc" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.llcOps.markPaid({ id: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.llcOps.unmarkPaid({ id: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(pricing.listWithWholesale).not.toHaveBeenCalled();
    expect(pricing.setStatePricing).not.toHaveBeenCalled();
    expect(pricing.applyStateMarkup).not.toHaveBeenCalled();
    expect(pricing.applyPaymentLink).not.toHaveBeenCalled();
    expect(database.updateProvider).not.toHaveBeenCalled();
  });

  it("exposes last-wholesale context to admins for pricing decisions", async () => {
    const caller = appRouter.createCaller(makeContext(1, "admin"));
    const rows = await caller.llcOps.listStatePricing();
    expect(rows[0]).toMatchObject({
      state: "WY",
      lastWholesaleCents: 39900,
      marginVsLastWholesaleCents: 15000,
    });
  });

  it("updates one state's price, link, and availability", async () => {
    const caller = appRouter.createCaller(makeContext(1, "admin"));
    const result = await caller.llcOps.setStatePricing({
      state: "WY",
      retailPriceCents: 54900,
      active: true,
      paymentLinkUrl: "https://pay.example.com/llc",
    });
    expect(pricing.setStatePricing).toHaveBeenCalledWith({
      state: "WY",
      retailPriceCents: 54900,
      active: true,
      paymentLinkUrl: "https://pay.example.com/llc",
    });
    expect(result).toMatchObject({ state: "WY", retailPriceCents: 54900 });
    expect(result).not.toHaveProperty("lastWholesaleCents");
  });

  it("applies a bulk markup and a bulk payment link", async () => {
    const caller = appRouter.createCaller(makeContext(1, "admin"));
    const markup = await caller.llcOps.applyStateMarkup({ markupCents: 44900 });
    expect(pricing.applyStateMarkup).toHaveBeenCalledWith(44900);
    expect(markup).toEqual({ updated: 51, markupCents: 44900 });

    const link = await caller.llcOps.applyPaymentLink({
      paymentLinkUrl: "https://pay.example.com/llc",
    });
    expect(pricing.applyPaymentLink).toHaveBeenCalledWith("https://pay.example.com/llc");
    expect(link).toEqual({ updated: 51 });
  });

  it("marks and unmarks retail payment through the owner-resolved registration", async () => {
    const caller = appRouter.createCaller(makeContext(1, "admin"));
    const paid = await caller.llcOps.markPaid({ id: 41 });
    expect(paid).toEqual({ id: 41, paid: true });
    expect(database.updateProvider).toHaveBeenCalledWith(7, 41, {
      retailPaidAt: expect.any(Date),
    });

    const unpaid = await caller.llcOps.unmarkPaid({ id: 41 });
    expect(unpaid).toEqual({ id: 41, paid: false });
    expect(database.updateProvider).toHaveBeenCalledWith(7, 41, {
      retailPaidAt: null,
    });
  });
});

describe("LLC client payment payload", () => {
  it("reports paid=false with the snapshotted retail price before payment", async () => {
    const bundle = makeBundle("ready");
    bundle.registration.retailPriceCents = 54900;
    database.get.mockResolvedValue(bundle);
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.llc.get({ id: 41 });
    expect(result.paid).toBe(false);
    expect(result.retailPriceCents).toBe(54900);
  });

  it("reports paid=true once ops confirms the retail payment", async () => {
    const bundle = makeBundle("ready");
    bundle.registration.retailPaidAt = new Date("2026-07-21T12:30:00.000Z");
    database.get.mockResolvedValue(bundle);
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.llc.get({ id: 41 });
    expect(result.paid).toBe(true);
  });
});

describe("LLC formation documents procedures (client vault)", () => {
  it("lists released documents only after confirming the caller owns the registration", async () => {
    const caller = appRouter.createCaller(makeContext(7));
    const result = await caller.llc.documents({ id: 41 });
    expect(database.get).toHaveBeenCalledWith(7, 41);
    expect(documents.list).toHaveBeenCalledWith(7, 41);
    expect(result).toHaveLength(1);
    expect(result[0].url).toMatch(/^\/manus-storage\/pdfs\/7\/llc\/41\//);
  });

  it("returns NOT_FOUND for another user's registration without listing documents", async () => {
    database.get.mockResolvedValue(null);
    const caller = appRouter.createCaller(makeContext(9));
    await expect(caller.llc.documents({ id: 41 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(database.get).toHaveBeenCalledWith(9, 41);
    expect(documents.list).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated document access", async () => {
    const caller = appRouter.createCaller(makeContext(null));
    await expect(caller.llc.documents({ id: 41 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.llc.allDocuments()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(documents.list).not.toHaveBeenCalled();
    expect(documents.listAll).not.toHaveBeenCalled();
  });

  it("scopes allDocuments to the authenticated user", async () => {
    const caller = appRouter.createCaller(makeContext(7));
    await caller.llc.allDocuments();
    expect(documents.listAll).toHaveBeenCalledWith(7);
  });
});

describe("LLC ops document management authorization", () => {
  const pdfBase64 = Buffer.from("pdf-bytes").toString("base64");

  it("forbids non-admin users from every document-management procedure", async () => {
    const caller = appRouter.createCaller(makeContext(7, "user"));
    await expect(caller.llcOps.documents({ id: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.llcOps.releaseDocument({ documentId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.llcOps.unreleaseDocument({ documentId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.llcOps.uploadDocument({
        registrationId: 41,
        name: "Operating agreement",
        documentType: "operating_agreement",
        mimeType: "application/pdf",
        dataBase64: pdfBase64,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.llcOps.deleteDocument({ documentId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(documents.listOps).not.toHaveBeenCalled();
    expect(documents.setReleased).not.toHaveBeenCalled();
    expect(documents.upload).not.toHaveBeenCalled();
    expect(documents.remove).not.toHaveBeenCalled();
  });

  it("lets admins list every document, including unreleased", async () => {
    const caller = appRouter.createCaller(makeContext(1, "admin"));
    await caller.llcOps.documents({ id: 41 });
    expect(database.findOwner).toHaveBeenCalledWith(41);
    expect(documents.listOps).toHaveBeenCalledWith(41);
  });

  it("releases and unreleases documents by id", async () => {
    const caller = appRouter.createCaller(makeContext(1, "admin"));
    const released = await caller.llcOps.releaseDocument({ documentId: 1 });
    expect(released.released).toBe(true);
    expect(documents.setReleased).toHaveBeenCalledWith(1, true);

    const hidden = await caller.llcOps.unreleaseDocument({ documentId: 1 });
    expect(hidden.released).toBe(false);
    expect(documents.setReleased).toHaveBeenCalledWith(1, false);
  });

  it("uploads through the owner-resolved registration", async () => {
    const caller = appRouter.createCaller(makeContext(1, "admin"));
    const result = await caller.llcOps.uploadDocument({
      registrationId: 41,
      name: "Operating agreement",
      documentType: "operating_agreement",
      mimeType: "application/pdf",
      dataBase64: pdfBase64,
    });
    expect(database.findOwner).toHaveBeenCalledWith(41);
    expect(documents.upload).toHaveBeenCalledWith(
      expect.objectContaining({ registrationId: 41, ownerUserId: 7 }),
    );
    expect(result.source).toBe("ops_upload");
  });

  it("rejects disallowed upload mime types at the input boundary", async () => {
    const caller = appRouter.createCaller(makeContext(1, "admin"));
    await expect(
      caller.llcOps.uploadDocument({
        registrationId: 41,
        name: "Malware",
        documentType: "other",
        mimeType: "text/html" as never,
        dataBase64: pdfBase64,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(documents.upload).not.toHaveBeenCalled();
  });

  it("deletes documents by id and 404s unknown ids", async () => {
    const caller = appRouter.createCaller(makeContext(1, "admin"));
    const result = await caller.llcOps.deleteDocument({ documentId: 1 });
    expect(result.deleted).toBe(true);
    expect(documents.remove).toHaveBeenCalledWith(1);

    documents.findById.mockResolvedValue(null);
    await expect(caller.llcOps.deleteDocument({ documentId: 999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
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
    expect(serialized.toLowerCase()).not.toContain("doola");
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

describe("payment link scheme hardening", () => {
  it("rejects non-http(s) payment links (javascript:, data:)", async () => {
    const caller = appRouter.createCaller(makeContext(1, "admin"));
    for (const url of ["javascript:alert(1)", "data:text/html,hi"]) {
      await expect(
        caller.llcOps.setStatePricing({ state: "NM", paymentLinkUrl: url }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });
});

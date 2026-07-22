import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  llcDocuments,
  llcFounders,
  llcRegistrations,
  llcStatusHistory,
  llcSubmissionAttempts,
} from "../../drizzle/schema";

const database = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

const storage = vi.hoisted(() => ({
  put: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: database.getDb,
}));

vi.mock("../storage", () => ({
  storagePut: storage.put,
}));

import { buildDemoPdf } from "./demo-pdf";
import {
  DemoGuardError,
  createDemoFiling,
  deleteDemoFiling,
  isDemoSubmissionKey,
} from "./demo";
import { bundleToRegistrationView } from "./domain";
import { listFormationDocuments } from "./documents";

type InsertRecord = { table: unknown; values: Record<string, unknown> };

/**
 * Minimal chainable drizzle stand-in: select() resolves queued result sets in
 * call order; insert() records rows and returns an insertId; delete()
 * records the affected table.
 */
function makeFakeDb(selectResults: unknown[][]) {
  const inserted: InsertRecord[] = [];
  const deleted: unknown[] = [];
  let selectCall = 0;
  let nextId = 41;
  const nextRows = () => selectResults[selectCall++] ?? [];
  const db = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => nextRows(),
          orderBy: async () => nextRows(),
        }),
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        inserted.push({ table, values });
        return Promise.resolve([{ insertId: nextId++ }]);
      },
    })),
    delete: vi.fn((table: unknown) => ({
      where: async () => {
        deleted.push(table);
        return [{ affectedRows: 1 }];
      },
    })),
  };
  return { db, inserted, deleted };
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.put.mockImplementation(async (key: string) => ({
    key,
    url: `/manus-storage/${key}`,
  }));
});

describe("demo PDF builder", () => {
  const pdf = buildDemoPdf({
    title: "Articles of Organization",
    lines: ["Amara Rose Stays LLC", "State of Georgia"],
    footnote: "SAMPLE DOCUMENT — FOR DEMONSTRATION ONLY",
  });
  const text = pdf.toString("latin1");

  it("emits a structurally valid single-page PDF", () => {
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Type /Page");
    expect(text).toContain("/BaseFont /Helvetica");
    expect(text).toContain("stream\n");
    expect(text).toContain("\nxref\n");
    expect(text).toContain("startxref");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("records correct xref byte offsets for every object", () => {
    const xrefEntries = [...text.matchAll(/^(\d{10}) 00000 n /gm)].map((match) =>
      Number(match[1]),
    );
    expect(xrefEntries).toHaveLength(5);
    xrefEntries.forEach((offset, index) => {
      expect(text.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
    const startxref = Number(text.match(/startxref\n(\d+)/)?.[1]);
    expect(text.slice(startxref).startsWith("xref")).toBe(true);
  });

  it("always carries the required SAMPLE watermark line", () => {
    expect(text).toContain("SAMPLE DOCUMENT");
    expect(text).toContain("FOR DEMONSTRATION ONLY");
  });

  it("escapes parentheses and backslashes in text content", () => {
    const tricky = buildDemoPdf({
      title: "Company (Sample) \\ Test",
      lines: [],
      footnote: "SAMPLE DOCUMENT — FOR DEMONSTRATION ONLY",
    }).toString("latin1");
    expect(tricky).toContain("Company \\(Sample\\) \\\\ Test");
  });
});

describe("createDemoFiling", () => {
  it("fabricates a completed, paid registration with zero provider fields", async () => {
    // Two selects: findLlcDocumentById after each of the two uploads.
    const { db, inserted } = makeFakeDb([[{ id: 1 }], [{ id: 2 }]]);
    database.getDb.mockResolvedValue(db);

    const result = await createDemoFiling(7);
    expect(result).toEqual({ id: 41 });

    const registration = inserted.find((entry) => entry.table === llcRegistrations);
    expect(registration?.values).toMatchObject({
      userId: 7,
      status: "completed",
      currentStep: 6,
      legalName: "Amara Rose Stays",
      entitySuffix: "LLC",
      formationState: "GA",
      businessType: "brick_and_mortar",
      industryGroup: "hospitality_and_lodging",
      industryType: "vacation_rental_property",
      useRegisteredAgent: true,
      expediteEin: false,
      accuracyAttested: true,
      retailPriceCents: 59900,
      providerStatus: {
        status: "completed",
        state_registered: true,
        ein_registered: true,
      },
    });
    expect(String(registration?.values.submissionKey)).toMatch(/^demo-[0-9a-f]{16}$/);
    expect(registration?.values.retailPaidAt).toBeInstanceOf(Date);
    expect(registration?.values.submittedAt).toBeInstanceOf(Date);
    expect(registration?.values.lastProviderSyncAt).toBeInstanceOf(Date);
    // Zero provider interaction:
    expect(registration?.values.whopAccountId).toBeUndefined();
    expect(registration?.values.checkoutSessionId).toBeUndefined();
    expect(registration?.values.checkoutUrl).toBeUndefined();
    expect(registration?.values.checkoutTotal).toBeUndefined();

    const founder = inserted.find((entry) => entry.table === llcFounders);
    expect(founder?.values).toMatchObject({
      registrationId: 41,
      isPrimary: true,
      firstName: "Amara",
      lastName: "Johnson",
      email: "amara.johnson@example.com",
      phone: "+14045550137",
      ownershipBasisPoints: 10_000,
      addressCity: "Atlanta",
      addressState: "GA",
    });
    expect(founder?.values.ssnEncrypted).toBeUndefined();
  });

  it("writes the full staggered pipeline history", async () => {
    const { db, inserted } = makeFakeDb([[{ id: 1 }], [{ id: 2 }]]);
    database.getDb.mockResolvedValue(db);

    await createDemoFiling(7);

    const history = inserted.filter((entry) => entry.table === llcStatusHistory);
    expect(history.map((entry) => entry.values.toStatus)).toEqual([
      "draft",
      "ready",
      "submitting",
      "payment_required",
      "processing",
      "completed",
    ]);
    const times = history.map((entry) => (entry.values.createdAt as Date).getTime());
    for (let index = 1; index < times.length; index += 1) {
      expect(times[index]).toBeGreaterThan(times[index - 1]);
    }
    // Explicit staggering: draft ~14 days ago, completed ~2 days ago.
    expect(Date.now() - times[0]).toBeGreaterThan(13.5 * 24 * 60 * 60 * 1000);
    expect(Date.now() - times[5]).toBeLessThan(2.5 * 24 * 60 * 60 * 1000);
  });

  it("stores two RELEASED sample documents in the owner's ACL'd namespace", async () => {
    const { db, inserted } = makeFakeDb([[{ id: 1 }], [{ id: 2 }]]);
    database.getDb.mockResolvedValue(db);

    await createDemoFiling(7);

    expect(storage.put).toHaveBeenCalledTimes(2);
    for (const call of storage.put.mock.calls) {
      expect(String(call[0])).toMatch(/^pdfs\/7\/llc\/41\//);
      expect(call[2]).toBe("application/pdf");
      const pdfText = (call[1] as Buffer).toString("latin1");
      expect(pdfText.startsWith("%PDF-1.4")).toBe(true);
      expect(pdfText).toContain("SAMPLE DOCUMENT");
    }

    const documents = inserted.filter((entry) => entry.table === llcDocuments);
    expect(documents.map((entry) => entry.values.documentType)).toEqual([
      "articles_of_organization",
      "ein_confirmation",
    ]);
    for (const document of documents) {
      expect(document.values.source).toBe("ops_upload");
      expect(document.values.releasedAt).toBeInstanceOf(Date);
      // Storage keys never carry a demo marker (client URLs must look real).
      expect(String(document.values.storageKey)).not.toMatch(/demo/i);
    }
  });
});

describe("demo filing client view", () => {
  /**
   * Rebuild store-shaped rows from the rows createDemoFiling actually
   * inserted (plus the columns the database would fill in), then run them
   * through the real client serializers. This proves what a member sees on
   * /llc/status/:id — and what they never see.
   */
  async function buildClientView() {
    const { db, inserted } = makeFakeDb([[{ id: 1 }], [{ id: 2 }]]);
    database.getDb.mockResolvedValue(db);
    const { id } = await createDemoFiling(7);

    const registrationValues = inserted.find(
      (entry) => entry.table === llcRegistrations,
    )?.values;
    const registration = {
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      businessPhone: null,
      website: null,
      companyAddressLine1: null,
      companyAddressLine2: null,
      companyAddressCity: null,
      companyAddressState: null,
      companyAddressPostalCode: null,
      companyAddressCountry: "US",
      whopAccountId: null,
      accountEmailAlias: null,
      checkoutSessionId: null,
      checkoutUrl: null,
      checkoutTotal: null,
      checkoutCurrency: null,
      opsNotifiedAt: null,
      lastErrorType: null,
      lastErrorMessage: null,
      retryable: false,
      ...registrationValues,
    } as Parameters<typeof bundleToRegistrationView>[0]["registration"];

    const founders = inserted
      .filter((entry) => entry.table === llcFounders)
      .map((entry, index) => ({
        id: index + 1,
        ssnEncrypted: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...entry.values,
      })) as Parameters<typeof bundleToRegistrationView>[0]["founders"];

    // The store returns history newest-first.
    const history = inserted
      .filter((entry) => entry.table === llcStatusHistory)
      .map((entry, index) => ({ id: index + 1, ...entry.values }))
      .reverse() as Parameters<typeof bundleToRegistrationView>[0]["history"];

    const documentRows = inserted
      .filter((entry) => entry.table === llcDocuments)
      .map((entry, index) => ({ id: index + 1, createdAt: new Date(), ...entry.values }));

    return {
      view: bundleToRegistrationView({ registration, founders, history }),
      registrationValues,
      documentRows,
    };
  }

  it("renders as a completed, paid filing with the full staggered history", async () => {
    const { view } = await buildClientView();

    expect(view.status).toBe("completed");
    expect(view.statusLabel).toBe("Formation completed");
    expect(view.paid).toBe(true);
    expect(view.retailPriceCents).toBe(59900);
    expect(view.canEdit).toBe(false);
    expect(view.canRetry).toBe(false);
    expect(view.safeErrorMessage).toBeNull();
    expect(view.submittedAt).toBeTypeOf("number");
    expect(view.draft.legalName).toBe("Amara Rose Stays");
    expect(view.draft.entitySuffix).toBe("LLC");
    expect(view.draft.formationState).toBe("GA");
    expect(view.draft.founders).toHaveLength(1);
    expect(view.draft.founders[0]?.firstName).toBe("Amara");

    // Newest-first, every pipeline stage present, each with a client label.
    expect(view.history.map((item) => item.toStatus)).toEqual([
      "completed",
      "processing",
      "payment_required",
      "submitting",
      "ready",
      "draft",
    ]);
    for (const item of view.history) {
      expect(item.label).toBeTruthy();
      expect(item.createdAt).toBeTypeOf("number");
    }
  });

  it("lists the two released sample documents exactly like real ones", async () => {
    const { documentRows } = await buildClientView();

    const { db } = makeFakeDb([documentRows]);
    database.getDb.mockResolvedValue(db);
    const documents = await listFormationDocuments(7, 41);

    expect(documents.map((doc) => doc.name)).toEqual([
      "Articles of Organization",
      "EIN Confirmation Letter",
    ]);
    for (const doc of documents) {
      expect(doc.releasedAt).toBeTypeOf("number");
      expect(doc.url).toMatch(/^\/manus-storage\/pdfs\/7\/llc\/41\//);
    }
    expect(JSON.stringify(documents)).not.toMatch(/demo/i);
  });

  it("never leaks a demo marker into the client payload", async () => {
    const { view, registrationValues } = await buildClientView();

    const serialized = JSON.stringify(view);
    expect(serialized).not.toMatch(/demo/i);
    expect(serialized).not.toContain(String(registrationValues?.submissionKey));
    // Nothing provider-side either: the wholesale leg does not exist.
    expect(serialized).not.toMatch(/whop/i);
    expect(serialized).not.toContain("checkout");
  });
});

describe("deleteDemoFiling guard", () => {
  it("refuses to delete a real registration", async () => {
    const { db, deleted } = makeFakeDb([
      [{ id: 41, submissionKey: "a1b2c3d4e5f6" }],
      [{ id: 41, submissionKey: "a1b2c3d4e5f6" }],
    ]);
    database.getDb.mockResolvedValue(db);

    await expect(deleteDemoFiling(41)).rejects.toBeInstanceOf(DemoGuardError);
    await expect(
      deleteDemoFiling(41).catch((error) => Promise.reject(error.message)),
    ).rejects.toMatch(/Only demo filings can be deleted/);
    expect(deleted).toHaveLength(0);
  });

  it("refuses registrations that never submitted (null submissionKey)", async () => {
    const { db, deleted } = makeFakeDb([[{ id: 41, submissionKey: null }]]);
    database.getDb.mockResolvedValue(db);
    await expect(deleteDemoFiling(41)).rejects.toBeInstanceOf(DemoGuardError);
    expect(deleted).toHaveLength(0);
  });

  it("deletes a demo filing and every attached row", async () => {
    const { db, deleted } = makeFakeDb([
      [{ id: 41, submissionKey: "demo-a1b2c3d4e5f60718" }],
      [{ id: 41, submissionKey: "demo-a1b2c3d4e5f60718" }],
    ]);
    database.getDb.mockResolvedValue(db);

    const result = await deleteDemoFiling(41);
    expect(result).toEqual({ deleted: true, id: 41 });
    expect(deleted).toEqual([
      llcDocuments,
      llcStatusHistory,
      llcSubmissionAttempts,
      llcFounders,
      llcRegistrations,
    ]);
  });

  it("recognizes only the demo- submission-key prefix", () => {
    expect(isDemoSubmissionKey("demo-abc123")).toBe(true);
    expect(isDemoSubmissionKey("abc-demo-123")).toBe(false);
    expect(isDemoSubmissionKey(null)).toBe(false);
    expect(isDemoSubmissionKey(undefined)).toBe(false);
  });
});

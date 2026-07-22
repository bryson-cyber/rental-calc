import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { llcDocuments } from "../../drizzle/schema";

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

import {
  OpsUploadValidationError,
  decodeOpsUpload,
  listAllFormationDocuments,
  listFormationDocuments,
  mirrorFormationDocuments,
  uploadOpsDocument,
} from "./documents";

type InsertRecord = { table: unknown; values: unknown };

/**
 * Minimal chainable drizzle stand-in: select() resolves the queued result
 * sets in call order; insert() records rows and resolves with an insertId.
 */
function makeFakeDb(selectResults: unknown[][]) {
  const inserted: InsertRecord[] = [];
  let selectCall = 0;
  const nextRows = () => selectResults[selectCall++] ?? [];
  const db = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => nextRows(),
          orderBy: async () => nextRows(),
          // Bare `await ...where(...)` (sample-registration lookup) also
          // yields rows.
          then: (resolve: (rows: unknown[]) => void) => resolve(nextRows()),
        }),
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        inserted.push({ table, values });
        return Promise.resolve([{ insertId: inserted.length }]);
      },
    })),
  };
  return { db, inserted };
}

const snapshot = {
  status: "completed",
  documents: [
    {
      id: "doc_1",
      name: "Articles of Organization",
      document_type: "articles_of_organization",
      download_url: "https://cdn.example.com/articles.pdf",
    },
    {
      id: "doc_2",
      name: "EIN Confirmation (CP-575)",
      document_type: "ein_letter",
      download_url: "https://cdn.example.com/ein.pdf",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  storage.put.mockImplementation(async (key: string) => ({
    key,
    url: `/manus-storage/${key}`,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mirrorFormationDocuments idempotency and release gating", () => {
  it("mirrors each new document once into the member's pdfs namespace, UNRELEASED", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { db, inserted } = makeFakeDb([[], []]); // no existing rows
    database.getDb.mockResolvedValue(db);

    const result = await mirrorFormationDocuments({
      userId: 7,
      registrationId: 41,
      snapshot,
    });

    expect(result).toEqual({ mirrored: 2, skipped: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(storage.put).toHaveBeenCalledTimes(2);
    expect(storage.put).toHaveBeenCalledWith(
      "pdfs/7/llc/41/articles-of-organization.pdf",
      expect.anything(),
      "application/pdf",
    );
    expect(inserted).toHaveLength(2);
    expect(inserted[0].table).toBe(llcDocuments);
    expect(inserted[0].values).toMatchObject({
      registrationId: 41,
      userId: 7,
      name: "Articles of Organization",
      documentType: "articles_of_organization",
      source: "provider",
      // Mirrored documents are hidden until ops releases them.
      releasedAt: null,
    });
  });

  it("skips documents already recorded under the unique mirror key (re-poll)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { db, inserted } = makeFakeDb([[{ id: 1 }], [{ id: 2 }]]); // both already mirrored
    database.getDb.mockResolvedValue(db);

    const result = await mirrorFormationDocuments({
      userId: 7,
      registrationId: 41,
      snapshot,
    });

    expect(result).toEqual({ mirrored: 0, skipped: 2 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.put).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it("never throws: a failed download or oversized file is logged and skipped", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-length": String(26 * 1024 * 1024),
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { db, inserted } = makeFakeDb([[], []]);
    database.getDb.mockResolvedValue(db);

    const result = await mirrorFormationDocuments({
      userId: 7,
      registrationId: 41,
      snapshot,
    });

    expect(result).toEqual({ mirrored: 0, skipped: 2 });
    expect(storage.put).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });
});

describe("client document listing", () => {
  const now = new Date("2026-07-21T12:00:00.000Z");
  const releasedRow = {
    id: 1,
    registrationId: 41,
    userId: 7,
    name: "articles_of_organization",
    label: "Articles of Organization",
    documentType: "articles_of_organization",
    source: "provider" as const,
    storageKey: "pdfs/7/llc/41/articles-of-organization.pdf",
    releasedAt: now,
    createdAt: now,
  };

  it("serves member URLs through the /manus-storage proxy path and prefers the ops label", async () => {
    // Second select: the sample-registration lookup finds no demo/test
    // marker, so the URL stays on the storage proxy.
    const { db } = makeFakeDb([
      [releasedRow],
      [{ id: 41, submissionKey: "a1b2c3d4", isTest: false }],
    ]);
    database.getDb.mockResolvedValue(db);

    const rows = await listFormationDocuments(7, 41);
    expect(rows).toEqual([
      {
        id: 1,
        registrationId: 41,
        name: "Articles of Organization",
        documentType: "articles_of_organization",
        releasedAt: now.getTime(),
        createdAt: now.getTime(),
        url: "/manus-storage/pdfs/7/llc/41/articles-of-organization.pdf",
      },
    ]);
  });

  it("lists all released documents across a member's registrations", async () => {
    const { db } = makeFakeDb([
      [releasedRow, { ...releasedRow, id: 2, registrationId: 42 }],
      [
        { id: 41, submissionKey: "a1b2c3d4", isTest: false },
        { id: 42, submissionKey: "a1b2c3d4", isTest: false },
      ],
    ]);
    database.getDb.mockResolvedValue(db);
    const rows = await listAllFormationDocuments(7);
    expect(rows).toHaveLength(2);
    expect(rows[1].registrationId).toBe(42);
  });
});

describe("ops uploads", () => {
  it("rejects disallowed mime types", () => {
    expect(() =>
      decodeOpsUpload({ dataBase64: Buffer.from("x").toString("base64"), mimeType: "image/gif" }),
    ).toThrow(OpsUploadValidationError);
    expect(() =>
      decodeOpsUpload({
        dataBase64: Buffer.from("x").toString("base64"),
        mimeType: "text/html",
      }),
    ).toThrow(/PDF, PNG, or JPG/);
  });

  it("rejects empty and oversized files", () => {
    expect(() => decodeOpsUpload({ dataBase64: "", mimeType: "application/pdf" })).toThrow(
      OpsUploadValidationError,
    );
    const oversized = Buffer.alloc(20 * 1024 * 1024 + 1).toString("base64");
    expect(() => decodeOpsUpload({ dataBase64: oversized, mimeType: "application/pdf" })).toThrow(
      /20MB/,
    );
  });

  it("accepts each documented mime type with the matching extension", () => {
    const data = Buffer.from("file-bytes").toString("base64");
    expect(decodeOpsUpload({ dataBase64: data, mimeType: "application/pdf" }).extension).toBe("pdf");
    expect(decodeOpsUpload({ dataBase64: data, mimeType: "image/png" }).extension).toBe("png");
    expect(decodeOpsUpload({ dataBase64: data, mimeType: "image/jpeg" }).extension).toBe("jpg");
  });

  it("stores ops uploads in the owner's ACL'd namespace, released by default", async () => {
    const uploaded = {
      id: 1,
      registrationId: 41,
      userId: 7,
      name: "Operating agreement",
      label: "Operating agreement",
      documentType: "operating_agreement",
      source: "ops_upload" as const,
      storageKey: "pdfs/7/llc/41/operating-agreement-x.pdf",
      releasedAt: new Date(),
      createdAt: new Date(),
    };
    const { db, inserted } = makeFakeDb([[uploaded]]);
    database.getDb.mockResolvedValue(db);

    const result = await uploadOpsDocument({
      registrationId: 41,
      ownerUserId: 7,
      name: "Operating agreement",
      label: "Operating agreement",
      documentType: "operating_agreement",
      dataBase64: Buffer.from("pdf-bytes").toString("base64"),
      mimeType: "application/pdf",
    });

    expect(storage.put).toHaveBeenCalledTimes(1);
    const [key, , contentType] = storage.put.mock.calls[0];
    expect(String(key)).toMatch(/^pdfs\/7\/llc\/41\/operating-agreement-[a-z0-9]+\.pdf$/);
    expect(contentType).toBe("application/pdf");

    expect(inserted).toHaveLength(1);
    expect(inserted[0].values).toMatchObject({
      registrationId: 41,
      userId: 7,
      name: "Operating agreement",
      documentType: "operating_agreement",
      source: "ops_upload",
    });
    expect(
      (inserted[0].values as { releasedAt: Date | null }).releasedAt,
    ).toBeInstanceOf(Date);
    expect(result?.source).toBe("ops_upload");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const auth = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
}));

const database = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("../_core/sdk", () => ({
  sdk: { authenticateRequest: auth.authenticateRequest },
}));

vi.mock("../db", () => ({
  getDb: database.getDb,
}));

import { registerLlcSampleDocumentRoute } from "./sampleDocumentRoute";

const NOW = new Date("2026-07-22T12:00:00.000Z");

const SAMPLE_DOCUMENT = {
  id: 9,
  registrationId: 41,
  userId: 7,
  name: "Articles of Organization",
  label: "Articles of Organization",
  documentType: "articles_of_organization",
  storageKey: "pdfs/7/llc/41/articles.pdf",
  releasedAt: NOW,
  createdAt: NOW,
};

const TEST_REGISTRATION = {
  id: 41,
  legalName: "Amara Rose Stays",
  entitySuffix: "LLC",
  formationState: "GA",
  submissionKey: null,
  isTest: true,
};

const REAL_REGISTRATION = {
  ...TEST_REGISTRATION,
  isTest: false,
  submissionKey: "a1b2c3d4e5f6",
};

const FOUNDER = {
  id: 1,
  registrationId: 41,
  isPrimary: true,
  firstName: "Amara",
  lastName: "Johnson",
};

/** Chainable select stand-in: resolves queued result sets in call order. */
function makeFakeDb(selectResults: unknown[][]) {
  let call = 0;
  const nextRows = () => selectResults[call++] ?? [];
  return {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => nextRows(),
          then: (resolve: (rows: unknown[]) => void) => resolve(nextRows()),
        }),
      }),
    })),
  };
}

function getHandler() {
  let handler: ((req: Request, res: Response) => Promise<void>) | undefined;
  registerLlcSampleDocumentRoute({
    get: (_path: string, fn: never) => {
      handler = fn;
    },
  } as never);
  if (!handler) throw new Error("route not registered");
  return handler;
}

function makeReq(documentId: string, query: Record<string, string> = {}): Request {
  return { params: { documentId }, query, headers: {} } as unknown as Request;
}

function makeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    send(body: unknown) {
      res.body = body;
      return res;
    },
    set(name: string, value: string) {
      res.headers[name] = value;
      return res;
    },
  };
  return res as typeof res & Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LLC sample-document regeneration route", () => {
  it("regenerates the owner's sample PDF in-process, inline by default", async () => {
    auth.authenticateRequest.mockResolvedValue({ id: 7, role: "user" });
    database.getDb.mockResolvedValue(
      makeFakeDb([[SAMPLE_DOCUMENT], [TEST_REGISTRATION], [FOUNDER]]),
    );
    const res = makeRes();
    await getHandler()(makeReq("9"), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/pdf");
    expect(res.headers["Content-Disposition"]).toContain("inline");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    const pdf = (res.body as Buffer).toString("latin1");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("Amara Rose Stays LLC");
    expect(pdf).toContain("SAMPLE DOCUMENT");
  });

  it("serves ?download=1 as an attachment", async () => {
    auth.authenticateRequest.mockResolvedValue({ id: 7, role: "user" });
    database.getDb.mockResolvedValue(
      makeFakeDb([[SAMPLE_DOCUMENT], [TEST_REGISTRATION], [FOUNDER]]),
    );
    const res = makeRes();
    await getHandler()(makeReq("9", { download: "1" }), res);
    expect(res.headers["Content-Disposition"]).toContain("attachment");
  });

  it("refuses a real registration's document — regeneration is demo/test only", async () => {
    auth.authenticateRequest.mockResolvedValue({ id: 7, role: "user" });
    database.getDb.mockResolvedValue(
      makeFakeDb([[SAMPLE_DOCUMENT], [REAL_REGISTRATION]]),
    );
    const res = makeRes();
    await getHandler()(makeReq("9"), res);
    expect(res.statusCode).toBe(403);
    expect(Buffer.isBuffer(res.body)).toBe(false);
  });

  it("refuses another user's document with 403", async () => {
    auth.authenticateRequest.mockResolvedValue({ id: 9, role: "user" });
    database.getDb.mockResolvedValue(makeFakeDb([[SAMPLE_DOCUMENT]]));
    const res = makeRes();
    await getHandler()(makeReq("9"), res);
    expect(res.statusCode).toBe(403);
  });

  it("lets an admin view any sample document", async () => {
    auth.authenticateRequest.mockResolvedValue({ id: 1, role: "admin" });
    database.getDb.mockResolvedValue(
      makeFakeDb([[SAMPLE_DOCUMENT], [TEST_REGISTRATION], [FOUNDER]]),
    );
    const res = makeRes();
    await getHandler()(makeReq("9"), res);
    expect(res.statusCode).toBe(200);
  });

  it("returns 401 without a session, before touching the database", async () => {
    auth.authenticateRequest.mockRejectedValue(new Error("no session"));
    const res = makeRes();
    await getHandler()(makeReq("9"), res);
    expect(res.statusCode).toBe(401);
    expect(database.getDb).not.toHaveBeenCalled();
  });

  it("404s unreleased documents and invalid ids", async () => {
    auth.authenticateRequest.mockResolvedValue({ id: 7, role: "user" });
    database.getDb.mockResolvedValue(
      makeFakeDb([[{ ...SAMPLE_DOCUMENT, releasedAt: null }]]),
    );
    const res = makeRes();
    await getHandler()(makeReq("9"), res);
    expect(res.statusCode).toBe(404);

    const badRes = makeRes();
    await getHandler()(makeReq("not-a-number"), badRes);
    expect(badRes.statusCode).toBe(400);
  });
});

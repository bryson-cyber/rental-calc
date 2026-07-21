import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const auth = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
}));

const storage = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("./sdk", () => ({
  sdk: { authenticateRequest: auth.authenticateRequest },
}));

vi.mock("../storage", () => ({
  storageGet: storage.get,
}));

import {
  authorizeStorageKey,
  handleStorageProxyRequest,
  registerStorageProxy,
} from "./storageProxy";

function makeUser(id: number, role: "user" | "admin" = "user") {
  return { id, role };
}

describe("authorizeStorageKey ACL", () => {
  it("allows the owner to access their own per-user namespace", () => {
    for (const key of [
      "pdfs/7/llc/41/articles.pdf",
      "photos/7/avatar.png",
      "audio/7/note.webm",
    ]) {
      expect(authorizeStorageKey(key, makeUser(7))).toEqual({ allowed: true });
    }
  });

  it("denies another signed-in user with 403", () => {
    const decision = authorizeStorageKey("pdfs/7/llc/41/articles.pdf", makeUser(9));
    expect(decision).toMatchObject({ allowed: false, status: 403 });
  });

  it("allows an admin to access any user's namespace", () => {
    expect(authorizeStorageKey("pdfs/7/llc/41/articles.pdf", makeUser(1, "admin"))).toEqual({
      allowed: true,
    });
  });

  it("denies unauthenticated access to any non-generated key with 401", () => {
    expect(authorizeStorageKey("pdfs/7/llc/41/articles.pdf", null)).toMatchObject({
      allowed: false,
      status: 401,
    });
    expect(authorizeStorageKey("lease-uploads/7/file.pdf", null)).toMatchObject({
      allowed: false,
      status: 401,
    });
  });

  it("requires only a session for keys outside the per-user namespaces", () => {
    expect(authorizeStorageKey("lease-uploads/7/file.pdf", makeUser(9))).toEqual({
      allowed: true,
    });
  });

  it("never treats a lookalike prefix as the owner namespace", () => {
    // "pdfsx/7/..." is outside the protected namespaces (still needs a
    // session); "pdfs/7x/..." is INSIDE pdfs/ but malformed, so it is denied
    // by default rather than opened to any signed-in user.
    expect(authorizeStorageKey("pdfsx/7/file.pdf", makeUser(9))).toEqual({ allowed: true });
    expect(authorizeStorageKey("pdfs/7x/file.pdf", makeUser(9))).toMatchObject({
      allowed: false,
      status: 403,
    });
    expect(authorizeStorageKey("pdfsx/7/file.pdf", null)).toMatchObject({
      allowed: false,
      status: 401,
    });
  });
});

function makeReq(key: string): Request {
  return {
    params: { "0": key },
    headers: {},
  } as unknown as Request;
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    redirectedTo: undefined as string | undefined,
    redirectStatus: undefined as number | undefined,
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
    redirect(status: number, url: string) {
      res.redirectStatus = status;
      res.redirectedTo = url;
      return res;
    },
  };
  return res as typeof res & Response;
}

describe("storage proxy route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.get.mockResolvedValue({
      key: "pdfs/7/llc/41/articles.pdf",
      url: "https://signed.example.com/articles.pdf?sig=abc",
    });
  });

  it("registers a GET route at /manus-storage/*", () => {
    const get = vi.fn();
    registerStorageProxy({ get } as never);
    expect(get).toHaveBeenCalledWith("/manus-storage/*", handleStorageProxyRequest);
  });

  it("redirects the owner to a short-lived signed URL with no-store caching", async () => {
    auth.authenticateRequest.mockResolvedValue(makeUser(7));
    const res = makeRes();
    await handleStorageProxyRequest(makeReq("pdfs/7/llc/41/articles.pdf"), res);

    expect(storage.get).toHaveBeenCalledWith("pdfs/7/llc/41/articles.pdf");
    expect(res.redirectStatus).toBe(307);
    expect(res.redirectedTo).toBe("https://signed.example.com/articles.pdf?sig=abc");
    expect(res.headers["Cache-Control"]).toBe("no-store");
  });

  it("returns 403 for another user's file without contacting storage", async () => {
    auth.authenticateRequest.mockResolvedValue(makeUser(9));
    const res = makeRes();
    await handleStorageProxyRequest(makeReq("pdfs/7/llc/41/articles.pdf"), res);

    expect(res.statusCode).toBe(403);
    expect(res.redirectedTo).toBeUndefined();
    expect(storage.get).not.toHaveBeenCalled();
  });

  it("lets an admin fetch any user's file", async () => {
    auth.authenticateRequest.mockResolvedValue(makeUser(1, "admin"));
    const res = makeRes();
    await handleStorageProxyRequest(makeReq("pdfs/7/llc/41/articles.pdf"), res);

    expect(res.redirectStatus).toBe(307);
    expect(storage.get).toHaveBeenCalledWith("pdfs/7/llc/41/articles.pdf");
  });

  it("returns 401 for unauthenticated requests without contacting storage", async () => {
    auth.authenticateRequest.mockRejectedValue(new Error("Invalid session cookie"));
    const res = makeRes();
    await handleStorageProxyRequest(makeReq("pdfs/7/llc/41/articles.pdf"), res);

    expect(res.statusCode).toBe(401);
    expect(storage.get).not.toHaveBeenCalled();
  });

  it("returns 400 when the key is missing", async () => {
    auth.authenticateRequest.mockResolvedValue(makeUser(7));
    const res = makeRes();
    await handleStorageProxyRequest({ params: {}, headers: {} } as never, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 502 when the storage backend fails, never a raw error", async () => {
    auth.authenticateRequest.mockResolvedValue(makeUser(7));
    storage.get.mockRejectedValue(new Error("forge down"));
    const res = makeRes();
    await handleStorageProxyRequest(makeReq("pdfs/7/llc/41/articles.pdf"), res);
    expect(res.statusCode).toBe(502);
    expect(String(res.body)).not.toContain("forge down");
  });
});

describe("storage proxy traversal and deny-by-default hardening", () => {
  const admin = { id: 1, role: "admin" } as never;
  const owner7 = { id: 7, role: "user" } as never;

  it("rejects traversal sequences for everyone, including admins", () => {
    for (const key of [
      "pdfs/7/../8/articles.pdf",
      "generated/../pdfs/7/articles.pdf",
      "pdfs/7/llc/..\\secret",
    ]) {
      expect(authorizeStorageKey(key, admin)).toMatchObject({ allowed: false, status: 400 });
    }
  });

  it("denies malformed protected-namespace keys instead of opening them", () => {
    for (const key of ["pdfs/x7/file.pdf", "pdfs/", "photos/abc/file.jpg"]) {
      const decision = authorizeStorageKey(key, owner7);
      expect(decision).toMatchObject({ allowed: false, status: 403 });
    }
  });
});

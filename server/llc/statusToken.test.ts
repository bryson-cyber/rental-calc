/**
 * Tokenized status access (operator complaint 2026-07-28: email links hit a
 * login wall on phones/other browsers).
 *
 * The status email links now carry ?t=<statusToken> — an unguessable
 * 48-hex-char per-registration token, mirroring the results-token pattern —
 * and three surfaces honor it WITHOUT a session:
 *   1. llc.track (publicProcedure): the llc.get client-safe view plus the
 *      released-documents list, NOT_FOUND on any token failure.
 *   2. The storage proxy (/api/llc/files/*): released formation documents.
 *   3. The sample-document route (demo filings), same rules.
 * These pins keep the token column, the boot backfill, the constant-time
 * comparison, and the client's token mode from silently regressing — and
 * pin that the authed path is untouched.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { TrpcContext } from "../_core/context";
import { makePersistedBundle } from "./test-fixtures";

const auth = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
const storage = vi.hoisted(() => ({ get: vi.fn() }));
const database = vi.hoisted(() => ({
  get: vi.fn(),
  findOwner: vi.fn(),
  getDb: vi.fn(),
}));
const documentsMock = vi.hoisted(() => ({
  listFormation: vi.fn(),
  findByStorageKey: vi.fn(),
}));

vi.mock("../_core/sdk", () => ({
  sdk: { authenticateRequest: auth.authenticateRequest },
}));

vi.mock("../storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../storage")>();
  return { ...actual, storageGet: storage.get };
});

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, getDb: database.getDb };
});

vi.mock("./store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store")>();
  return {
    ...actual,
    getLlcRegistrationById: database.get,
    findLlcRegistrationOwner: database.findOwner,
  };
});

vi.mock("./documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./documents")>();
  return {
    ...actual,
    listFormationDocuments: documentsMock.listFormation,
    findRegistrationIdByStorageKey: documentsMock.findByStorageKey,
  };
});

import { appRouter } from "../routers";
import { handleStorageProxyRequest } from "../_core/storageProxy";
import { bundleToRegistrationView } from "./domain";
import {
  ensureStatusToken,
  generateStatusToken,
  statusTokenMatches,
} from "./store";
import {
  renderApplicationReceivedEmail,
  renderDocumentsReleasedEmail,
  renderFormationCompleteEmail,
  renderPaymentConfirmedEmail,
} from "./clientEmails";

const TOKEN = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6"; // 48 chars

const read = (relative: string) =>
  readFileSync(join(__dirname, "..", "..", relative), "utf8");

function makeAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const RELEASED_DOCUMENT = {
  id: 5,
  registrationId: 41,
  name: "Articles of Organization",
  documentType: "articles_of_organization",
  releasedAt: 1_753_000_000_000,
  createdAt: 1_752_000_000_000,
  url: "/api/llc/files/pdfs/7/llc/41/articles.pdf",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.stubEnv("APP_BASE_URL", "https://tools.example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Token primitives ───

describe("status token primitives", () => {
  it("generateStatusToken mints 48 lowercase hex chars, unique per call", () => {
    const first = generateStatusToken();
    const second = generateStatusToken();
    expect(first).toMatch(/^[0-9a-f]{48}$/);
    expect(second).toMatch(/^[0-9a-f]{48}$/);
    expect(first).not.toBe(second);
  });

  it("statusTokenMatches: null/absent stored tokens never match; equality is exact", () => {
    expect(statusTokenMatches(null, TOKEN)).toBe(false);
    expect(statusTokenMatches(undefined, TOKEN)).toBe(false);
    expect(statusTokenMatches("", TOKEN)).toBe(false);
    expect(statusTokenMatches(TOKEN, TOKEN)).toBe(true);
    expect(statusTokenMatches(TOKEN, TOKEN.slice(0, 47))).toBe(false);
    expect(statusTokenMatches(TOKEN, `${TOKEN.slice(0, 47)}f`)).toBe(false);
  });

  it("ensureStatusToken returns an existing token without writing", async () => {
    let updates = 0;
    database.getDb.mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [{ statusToken: TOKEN }] }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: async () => {
            updates += 1;
          },
        }),
      }),
    });
    await expect(ensureStatusToken(41)).resolves.toBe(TOKEN);
    expect(updates).toBe(0);
  });

  it("ensureStatusToken fills a NULL cell once and re-reads (first-write-wins)", async () => {
    const state = { token: null as string | null, updates: 0 };
    database.getDb.mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [{ statusToken: state.token }] }),
        }),
      }),
      update: () => ({
        set: (values: { statusToken: string }) => ({
          where: async () => {
            state.updates += 1;
            if (state.token === null) state.token = values.statusToken;
          },
        }),
      }),
    });
    const token = await ensureStatusToken(41);
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect(token).toBe(state.token);
    expect(state.updates).toBe(1);
  });

  it("the persisting UPDATE carries the IS NULL guard so a racing writer is never clobbered", () => {
    const store = read("server/llc/store.ts");
    const ensure = store.slice(
      store.indexOf("export async function ensureStatusToken"),
      store.indexOf("async function findRegistrationById"),
    );
    expect(ensure).toContain("isNull(llcRegistrations.statusToken)");
  });
});

// ─── Schema + boot wiring ───

describe("schema column and boot wiring", () => {
  it("the llcRegistrations table carries the nullable statusToken column", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain('statusToken: varchar("statusToken", { length: 64 })');
  });

  it("ensure-tables has the idempotent ALTER guard and the NULL-token backfill", () => {
    const ensure = read("server/llc/ensure-tables.ts");
    expect(ensure).toContain(
      "ALTER TABLE `llc_registrations` ADD `statusToken` varchar(64)",
    );
    // Backfill: one pass over NULL rows, IS NULL guard on each write.
    expect(ensure).toContain("isNull(llcRegistrations.statusToken)");
    expect(ensure).toContain("statusToken: generateStatusToken()");
  });

  it("new registrations mint their token at creation", () => {
    const store = read("server/llc/store.ts");
    const create = store.slice(
      store.indexOf("export async function createLlcRegistration"),
      store.indexOf("export async function listLlcRegistrationsForUser"),
    );
    expect(create).toContain("statusToken: generateStatusToken()");
  });
});

// ─── llc.track (public, token-authorized) ───

describe("llc.track public procedure", () => {
  function installBundle(statusToken: string | null) {
    const bundle = makePersistedBundle("completed");
    bundle.registration.statusToken = statusToken;
    database.findOwner.mockResolvedValue({ userId: 7 });
    database.get.mockResolvedValue(bundle);
    documentsMock.listFormation.mockResolvedValue([RELEASED_DOCUMENT]);
    return bundle;
  }

  it("is a publicProcedure with 32–64 char token bounds (structural)", () => {
    const router = read("server/llc/router.ts");
    expect(router).toContain("track: publicProcedure");
    expect(router).toContain("token: z.string().min(32).max(64)");
    // Released documents only, through the same serializer as llc.documents.
    expect(router).toContain("documents: await listFormationDocuments(owner.userId, input.id)");
  });

  it("answers an anonymous caller with the llc.get shape plus released documents", async () => {
    const bundle = installBundle(TOKEN);
    const caller = appRouter.createCaller(makeAnonymousContext());
    const result = await caller.llc.track({ id: 41, token: TOKEN });

    // EXACTLY the same client-safe shape llc.get returns.
    expect(Object.keys(result.registration).sort()).toEqual(
      Object.keys(bundleToRegistrationView(bundle)).sort(),
    );
    expect(result.registration.orderRef).toBe("NF-0041");
    expect(result.registration.status).toBe("completed");
    expect(result.documents).toEqual([RELEASED_DOCUMENT]);
    expect(documentsMock.listFormation).toHaveBeenCalledWith(7, 41);

    // White-label + credential hygiene: no provider fields, and the token
    // itself never round-trips in the payload.
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/whop|doola|wholesale|checkoutUrl|statusToken/i);
    expect(json).not.toContain(TOKEN);
    // SSNs are blanked for token viewers (an email link is a weaker
    // credential than a session; the status page never shows them).
    for (const founder of result.registration.draft.founders) {
      expect(founder.ssn).toBe("");
    }
  });

  it("answers the SAME NOT_FOUND for a wrong token, a null stored token, and a missing row", async () => {
    const caller = appRouter.createCaller(makeAnonymousContext());
    const expected = {
      code: "NOT_FOUND",
      message: "This filing could not be found.",
    };

    installBundle(TOKEN);
    await expect(
      caller.llc.track({ id: 41, token: "b".repeat(48) }),
    ).rejects.toMatchObject(expected);

    installBundle(null);
    await expect(caller.llc.track({ id: 41, token: TOKEN })).rejects.toMatchObject(
      expected,
    );

    database.findOwner.mockResolvedValue(null);
    await expect(caller.llc.track({ id: 41, token: TOKEN })).rejects.toMatchObject(
      expected,
    );
    expect(documentsMock.listFormation).not.toHaveBeenCalled();
  });

  it("rejects out-of-bounds tokens at the input layer", async () => {
    installBundle(TOKEN);
    const caller = appRouter.createCaller(makeAnonymousContext());
    await expect(
      caller.llc.track({ id: 41, token: "too-short" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.llc.track({ id: 41, token: "c".repeat(65) }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(database.findOwner).not.toHaveBeenCalled();
  });
});

// ─── Storage proxy token fallback ───

function makeProxyReq(key: string, query: Record<string, string> = {}): Request {
  return { params: { "0": key }, query, headers: {} } as unknown as Request;
}

function makeProxyRes() {
  const res = {
    statusCode: 0,
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

describe("storage proxy status-token fallback", () => {
  const KEY = "pdfs/7/llc/41/articles.pdf";
  const PDF_BYTES = new TextEncoder().encode("%PDF-1.4 fake").buffer;

  beforeEach(() => {
    auth.authenticateRequest.mockRejectedValue(new Error("no session"));
    storage.get.mockResolvedValue({
      key: KEY,
      url: "https://signed.example.com/articles.pdf?sig=abc",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "application/pdf" },
        arrayBuffer: async () => PDF_BYTES,
      }),
    );
  });

  it("streams a RELEASED document to a matching token without any session", async () => {
    documentsMock.findByStorageKey.mockResolvedValue({
      registrationId: 41,
      released: true,
      statusToken: TOKEN,
    });
    const res = makeProxyRes();
    await handleStorageProxyRequest(makeProxyReq(KEY, { t: TOKEN }), res);

    expect(documentsMock.findByStorageKey).toHaveBeenCalledWith(KEY);
    expect(res.headers["Content-Type"]).toBe("application/pdf");
    expect(Buffer.isBuffer(res.body)).toBe(true);
  });

  it("refuses an UNRELEASED document even with the correct token", async () => {
    documentsMock.findByStorageKey.mockResolvedValue({
      registrationId: 41,
      released: false,
      statusToken: TOKEN,
    });
    const res = makeProxyRes();
    await handleStorageProxyRequest(makeProxyReq(KEY, { t: TOKEN }), res);
    expect(res.statusCode).toBe(401);
    expect(storage.get).not.toHaveBeenCalled();
  });

  it("refuses a token mismatch and a null stored token identically", async () => {
    for (const statusToken of ["b".repeat(48), null]) {
      documentsMock.findByStorageKey.mockResolvedValue({
        registrationId: 41,
        released: true,
        statusToken,
      });
      const res = makeProxyRes();
      await handleStorageProxyRequest(makeProxyReq(KEY, { t: TOKEN }), res);
      expect(res.statusCode).toBe(401);
      expect(storage.get).not.toHaveBeenCalled();
    }
  });

  it("never consults the token for out-of-bounds lengths or traversal keys", async () => {
    const short = makeProxyRes();
    await handleStorageProxyRequest(makeProxyReq(KEY, { t: "short" }), short);
    expect(short.statusCode).toBe(401);

    const traversal = makeProxyRes();
    await handleStorageProxyRequest(
      makeProxyReq("pdfs/7/../8/articles.pdf", { t: TOKEN }),
      traversal,
    );
    // 400 (traversal/malformed) is never overridden by a token.
    expect(traversal.statusCode).toBe(400);
    expect(documentsMock.findByStorageKey).not.toHaveBeenCalled();
  });

  it("leaves the authed session path exactly as before (no token involved)", async () => {
    auth.authenticateRequest.mockResolvedValue({ id: 7, role: "user" });
    const res = makeProxyRes();
    await handleStorageProxyRequest(makeProxyReq(KEY), res);
    expect(res.headers["Content-Type"]).toBe("application/pdf");
    expect(documentsMock.findByStorageKey).not.toHaveBeenCalled();
  });

  it("requires BOTH released and token-match in the source (structural)", () => {
    const proxy = read("server/_core/storageProxy.ts");
    expect(proxy).toContain("if (!document || !document.released) return false;");
    expect(proxy).toContain("statusTokenMatches(document.statusToken, token)");
    expect(proxy).toContain("decision.status !== 400");
    expect(proxy).toContain("token.length >= 32");
    expect(proxy).toContain("token.length <= 64");
    // Tokens must never be logged from the proxy.
    for (const line of proxy.split("\n")) {
      if (/console\.(log|warn|error)/.test(line)) {
        expect(line).not.toMatch(/token/i);
      }
    }
  });

  it("the sample-document route honors the same token rules (structural)", () => {
    const route = read("server/llc/sampleDocumentRoute.ts");
    expect(route).toContain("statusTokenMatches(registration.statusToken, statusToken)");
    expect(route).toContain("rawToken.length >= 32 && rawToken.length <= 64");
    // Session users keep the original instant 401 when anonymous+tokenless.
    expect(route).toContain("if (!user && !statusToken) {");
  });
});

// ─── Email links carry the token ───

describe("statusUrl token variant in client emails", () => {
  const base = {
    registrationId: 41,
    legalName: "Northstar Studio",
    entitySuffix: "LLC",
    formationState: "WY",
    retailPriceCents: 54900,
  };

  it("every lifecycle template appends ?t= when a token is provided", () => {
    const rendered = [
      renderApplicationReceivedEmail({
        ...base,
        paymentLinkUrl: null,
        statusToken: TOKEN,
      }),
      renderPaymentConfirmedEmail({ ...base, statusToken: TOKEN }),
      renderFormationCompleteEmail({ ...base, statusToken: TOKEN }),
      renderDocumentsReleasedEmail({
        ...base,
        documents: ["Articles of Organization"],
        statusToken: TOKEN,
      }),
    ];
    for (const email of rendered) {
      expect(email.text).toContain(
        `https://tools.example.com/llc/status/41?t=${TOKEN}`,
      );
      // The linked HTML carries the tokenized URL too.
      expect(email.html).toContain(`/llc/status/41?t=${TOKEN}`);
    }
  });

  it("token-less renders keep the exact plain URL (pinned copy unchanged)", () => {
    const rendered = [
      renderApplicationReceivedEmail({ ...base, paymentLinkUrl: null }),
      renderPaymentConfirmedEmail(base),
      renderFormationCompleteEmail(base),
      renderDocumentsReleasedEmail({ ...base, documents: [] }),
    ];
    for (const email of rendered) {
      expect(email.text).toContain("https://tools.example.com/llc/status/41");
      expect(email.text).not.toContain("?t=");
    }
  });

  it("the real sends thread registration.statusToken with the ensureStatusToken fallback (structural)", () => {
    const emails = read("server/llc/clientEmails.ts");
    // One resolver, used by all four lifecycle sends and the demo rehearsal.
    expect(emails).toContain("async function resolveStatusToken");
    expect(emails).toContain("return ensureStatusToken(registration.id);");
    expect(
      (emails.match(/statusToken: await resolveStatusToken\(/g) ?? []).length,
    ).toBeGreaterThanOrEqual(4);
    expect(emails).toContain("statusUrl(params.registrationId, params.statusToken)");
  });
});

// ─── Client token mode ───

describe("FormationStatus token mode (structural)", () => {
  const page = read("client/src/pages/llc/FormationStatus.tsx");

  it("reads ?t= once at mount, mirroring the paymentReturn pattern", () => {
    expect(page).toContain('new URLSearchParams(window.location.search).get("t")');
    expect(page).toContain("value.length >= 32 && value.length <= 64");
  });

  it("uses llc.track as the data source and skips the session queries entirely", () => {
    expect(page).toContain("trpc.llc.track.useQuery");
    expect(page).toContain("{ id: registrationId, token: statusToken ?? \"\" }");
    // llc.get and llc.documents are disabled in token mode — they'd 401.
    expect((page.match(/enabled: !tokenMode/g) ?? []).length).toBe(2);
    expect(page).toContain("enabled: tokenMode");
  });

  it("appends the token to every document url so the proxy authorizes", () => {
    expect(page).toContain("t=${encodeURIComponent(statusToken)}");
    // Download links join with & when the url already carries ?t=.
    expect(page).toContain('appendQueryParam(document.url, "download=1")');
    expect(page).toContain('appendQueryParam(viewerDocument.url, "download=1")');
  });

  it("keeps the settle-poll working against llc.track after a Stripe return", () => {
    const trackBlock = page.slice(
      page.indexOf("const trackQuery = trpc.llc.track.useQuery"),
      page.indexOf("const isTestRow"),
    );
    expect(trackBlock).toContain('paymentReturn === "success"');
    expect(trackBlock).toContain('status === "payment_required"');
    expect(trackBlock).toContain("return 3000;");
  });

  it("opens the page shell for token viewers while every other LLC page keeps the gate", () => {
    expect(page).toContain("allowAnonymous={statusToken !== null}");
    const shell = read("client/src/pages/llc/LlcPageShell.tsx");
    expect(shell).toContain("allowAnonymous = false");
    expect(shell).toContain("!allowAnonymous && (!isAuthenticated || !user)");
    // The wizard does not opt out of the gate.
    const wizard = read("client/src/pages/llc/FormationWizard.tsx");
    expect(wizard).not.toContain("allowAnonymous");
  });

  it("hides session-only actions from anonymous token viewers", () => {
    expect(page).toContain("user && registration.canEdit");
    expect(page).toContain("user && registration.canRetry");
    expect(page).toContain(
      'user && (isProviderStatus || registration.status === "submitting")',
    );
    // The unpaid card offers sign-in (checkout is a protected procedure).
    expect(page).toContain("Sign in to pay");
  });
});

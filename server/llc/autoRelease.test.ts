/**
 * Automatic document release (operator decision 2026-08-06).
 *
 * The manual ops-release gate caused a live incident: a customer's completion
 * email arrived while their EIN letter and operating agreement sat held and
 * invisible. Release is now automatic on every Doola refresh — EXCEPT the
 * provider's own operating-agreement copy, which names the provider's legal
 * entity and must never reach a client. These tests pin:
 *  1. The predicate: provider docs + the branded client OA release; the
 *     provider OA copy (flagged with the real label, or structurally
 *     unflagged) never matches.
 *  2. The sweep: held rows release via the same store-level operation the
 *     manual ops release uses, BEFORE the client email / ops alert fire.
 *  3. Test/demo registrations never auto-release or notify.
 *  4. Wiring: the sweep runs in refreshDoolaRegistrationStatus right after
 *     mirrorFormationDocuments, and the client OA attaches released.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makePersistedBundle } from "./test-fixtures";

const database = vi.hoisted(() => ({ getDb: vi.fn() }));
const store = vi.hoisted(() => ({ getLlcRegistrationById: vi.fn() }));
const documents = vi.hoisted(() => ({ setDocumentReleased: vi.fn() }));
const clientEmails = vi.hoisted(() => ({ sendDocumentsReleasedEmail: vi.fn() }));
const notify = vi.hoisted(() => ({ sendOpsAlert: vi.fn(async () => true) }));

vi.mock("../db", () => ({ getDb: database.getDb }));

vi.mock("./store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store")>();
  return { ...actual, getLlcRegistrationById: store.getLlcRegistrationById };
});

vi.mock("./documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./documents")>();
  return { ...actual, setDocumentReleased: documents.setDocumentReleased };
});

vi.mock("./clientEmails", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./clientEmails")>();
  return {
    ...actual,
    sendDocumentsReleasedEmail: clientEmails.sendDocumentsReleasedEmail,
  };
});

vi.mock("../ops/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ops/notify")>();
  return { ...actual, sendOpsAlert: notify.sendOpsAlert };
});

import {
  autoReleaseFormationDocuments,
  isAutoReleasableHeldDocument,
} from "./doolaSubmission";

const read = (relative: string) =>
  readFileSync(join(__dirname, relative), "utf8");

/**
 * The REAL detection mechanism: the exact label string that
 * flagProviderOperatingAgreementCopies writes onto provider OA copies,
 * extracted from the source so the test can never drift from production.
 */
function realProviderCopyLabel(): string {
  const source = read("doolaSubmission.ts");
  const start = source.indexOf(
    "async function flagProviderOperatingAgreementCopies",
  );
  expect(start).toBeGreaterThan(-1);
  const match = source.slice(start).match(/label:\s*"([^"]+)"/);
  expect(match).not.toBeNull();
  return (match as RegExpMatchArray)[1];
}

function heldRow(overrides: Partial<{
  id: number;
  source: string;
  documentType: string;
  label: string | null;
}>) {
  return {
    id: 1,
    source: "provider",
    documentType: "ein_letter",
    label: null,
    ...overrides,
  };
}

function makeBundle(overrides: Partial<{ isTest: boolean; submissionKey: string }> = {}) {
  const bundle = makePersistedBundle("completed");
  return {
    ...bundle,
    registration: {
      ...bundle.registration,
      isTest: overrides.isTest ?? false,
      submissionKey: overrides.submissionKey ?? bundle.registration.submissionKey,
    },
  };
}

function makeFakeDb(heldRows: unknown[]) {
  return {
    select: vi.fn(() => ({
      from: () => ({
        where: async () => heldRows,
      }),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  documents.setDocumentReleased.mockResolvedValue(null);
  clientEmails.sendDocumentsReleasedEmail.mockResolvedValue("sent");
  notify.sendOpsAlert.mockResolvedValue(true);
});

describe("isAutoReleasableHeldDocument", () => {
  it("releases provider-mirrored formation documents", () => {
    expect(
      isAutoReleasableHeldDocument(
        heldRow({ source: "provider", documentType: "ein_letter" }),
      ),
    ).toBe(true);
    expect(
      isAutoReleasableHeldDocument(
        heldRow({ source: "provider", documentType: "articles_of_organization" }),
      ),
    ).toBe(true);
  });

  it("releases the branded client OA (ops_upload operating_agreement)", () => {
    expect(
      isAutoReleasableHeldDocument(
        heldRow({ source: "ops_upload", documentType: "operating_agreement" }),
      ),
    ).toBe(true);
  });

  it("NEVER releases a provider OA copy carrying the real flag label", () => {
    const label = realProviderCopyLabel();
    // The mechanism itself: an unmistakable do-not-release marker.
    expect(label).toMatch(/PROVIDER COPY/);
    expect(
      isAutoReleasableHeldDocument(
        heldRow({ source: "provider", documentType: "operating_agreement", label }),
      ),
    ).toBe(false);
  });

  it("NEVER releases a provider OA even BEFORE the flagging pass labels it", () => {
    // Mirrored provider OA that flagProviderOperatingAgreementCopies has not
    // labeled yet (completion refresh order): still structurally locked.
    expect(
      isAutoReleasableHeldDocument(
        heldRow({ source: "provider", documentType: "operating_agreement", label: null }),
      ),
    ).toBe(false);
  });

  it("honors an ops do-not-release label on any source", () => {
    expect(
      isAutoReleasableHeldDocument(
        heldRow({ source: "provider", documentType: "ein_letter", label: "hold — do not release" }),
      ),
    ).toBe(false);
  });

  it("does not release unrelated ops uploads (they release at upload time)", () => {
    expect(
      isAutoReleasableHeldDocument(
        heldRow({ source: "ops_upload", documentType: "ein_letter" }),
      ),
    ).toBe(false);
  });
});

describe("autoReleaseFormationDocuments sweep", () => {
  it("releases held provider docs + the client OA, skips the provider OA copy", async () => {
    store.getLlcRegistrationById.mockResolvedValue(makeBundle());
    database.getDb.mockResolvedValue(
      makeFakeDb([
        heldRow({ id: 11, source: "provider", documentType: "ein_letter" }),
        heldRow({ id: 12, source: "ops_upload", documentType: "operating_agreement" }),
        heldRow({
          id: 13,
          source: "provider",
          documentType: "operating_agreement",
          label: realProviderCopyLabel(),
        }),
        heldRow({ id: 14, source: "provider", documentType: "operating_agreement" }),
      ]),
    );

    const result = await autoReleaseFormationDocuments({ userId: 7, registrationId: 41 });

    expect(result).toEqual({ released: 2 });
    // Same store-level operation the manual ops releaseDocument uses.
    expect(documents.setDocumentReleased).toHaveBeenCalledTimes(2);
    expect(documents.setDocumentReleased).toHaveBeenCalledWith(11, true);
    expect(documents.setDocumentReleased).toHaveBeenCalledWith(12, true);
    expect(documents.setDocumentReleased).not.toHaveBeenCalledWith(13, true);
    expect(documents.setDocumentReleased).not.toHaveBeenCalledWith(14, true);
  });

  it("fires the batched client email and the ops alert AFTER the releases", async () => {
    store.getLlcRegistrationById.mockResolvedValue(makeBundle());
    database.getDb.mockResolvedValue(
      makeFakeDb([
        heldRow({ id: 11 }),
        heldRow({ id: 12, documentType: "articles_of_organization" }),
      ]),
    );

    await autoReleaseFormationDocuments({ userId: 7, registrationId: 41 });

    expect(clientEmails.sendDocumentsReleasedEmail).toHaveBeenCalledTimes(1);
    expect(clientEmails.sendDocumentsReleasedEmail).toHaveBeenCalledWith({
      userId: 7,
      registrationId: 41,
    });
    expect(notify.sendOpsAlert).toHaveBeenCalledTimes(1);
    const alert = notify.sendOpsAlert.mock.calls[0][0] as { lines: string[] };
    expect(alert.lines.join("\n")).toContain(
      "Auto-released 2 document(s) for order #41 — provider OA copies remain locked.",
    );

    // Ordering: every release committed before either notification fired.
    const releaseOrders = documents.setDocumentReleased.mock.invocationCallOrder;
    const emailOrder = clientEmails.sendDocumentsReleasedEmail.mock.invocationCallOrder[0];
    const alertOrder = notify.sendOpsAlert.mock.invocationCallOrder[0];
    for (const order of releaseOrders) {
      expect(order).toBeLessThan(emailOrder);
      expect(order).toBeLessThan(alertOrder);
    }
  });

  it("sends nothing when no held document is releasable", async () => {
    store.getLlcRegistrationById.mockResolvedValue(makeBundle());
    database.getDb.mockResolvedValue(
      makeFakeDb([
        heldRow({
          id: 13,
          source: "provider",
          documentType: "operating_agreement",
          label: realProviderCopyLabel(),
        }),
      ]),
    );

    const result = await autoReleaseFormationDocuments({ userId: 7, registrationId: 41 });

    expect(result).toEqual({ released: 0 });
    expect(documents.setDocumentReleased).not.toHaveBeenCalled();
    expect(clientEmails.sendDocumentsReleasedEmail).not.toHaveBeenCalled();
    expect(notify.sendOpsAlert).not.toHaveBeenCalled();
  });

  it("test registrations (isTest) never release or notify", async () => {
    store.getLlcRegistrationById.mockResolvedValue(makeBundle({ isTest: true }));
    database.getDb.mockResolvedValue(makeFakeDb([heldRow({ id: 11 })]));

    const result = await autoReleaseFormationDocuments({ userId: 7, registrationId: 41 });

    expect(result).toEqual({ released: 0 });
    expect(documents.setDocumentReleased).not.toHaveBeenCalled();
    expect(clientEmails.sendDocumentsReleasedEmail).not.toHaveBeenCalled();
    expect(notify.sendOpsAlert).not.toHaveBeenCalled();
  });

  it("demo registrations (demo- submissionKey) never release or notify", async () => {
    store.getLlcRegistrationById.mockResolvedValue(
      makeBundle({ submissionKey: "demo-abc123" }),
    );
    database.getDb.mockResolvedValue(makeFakeDb([heldRow({ id: 11 })]));

    const result = await autoReleaseFormationDocuments({ userId: 7, registrationId: 41 });

    expect(result).toEqual({ released: 0 });
    expect(documents.setDocumentReleased).not.toHaveBeenCalled();
    expect(clientEmails.sendDocumentsReleasedEmail).not.toHaveBeenCalled();
    expect(notify.sendOpsAlert).not.toHaveBeenCalled();
  });
});

describe("auto-release wiring (structural)", () => {
  it("refreshDoolaRegistrationStatus sweeps right after mirrorFormationDocuments", () => {
    const source = read("doolaSubmission.ts");
    const start = source.indexOf(
      "export async function refreshDoolaRegistrationStatus",
    );
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("export function isAutoReleasableHeldDocument");
    const body = source.slice(start, end);
    const mirror = body.indexOf("mirrorFormationDocuments({");
    const sweep = body.indexOf("autoReleaseFormationDocuments({");
    const statusAdvance = body.indexOf("const nextStatus");
    expect(mirror).toBeGreaterThan(-1);
    expect(sweep).toBeGreaterThan(mirror);
    // Before the status-advance early return, so completed orders still heal
    // on every later poll (retroactive release of pre-decision stuck docs).
    expect(sweep).toBeLessThan(statusAdvance);
  });

  it("the sweep reuses the manual release operation (setDocumentReleased) and notifies through the batched email", () => {
    const source = read("doolaSubmission.ts");
    const start = source.indexOf("export async function autoReleaseFormationDocuments");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf("export async function attachClientOperatingAgreement"));
    const release = body.indexOf("setDocumentReleased(");
    const email = body.indexOf("sendDocumentsReleasedEmail({");
    const alert = body.indexOf("sendOpsAlert({");
    expect(release).toBeGreaterThan(-1);
    expect(email).toBeGreaterThan(release);
    expect(alert).toBeGreaterThan(release);
  });

  it("the branded client OA now attaches released", () => {
    const source = read("doolaSubmission.ts");
    const start = source.indexOf(
      "export async function attachClientOperatingAgreement",
    );
    const body = source.slice(start, source.indexOf("async function listOpsDocumentTypes"));
    expect(body).toContain("release: true");
    expect(body).not.toContain("release: false");
  });

  it("flagProviderOperatingAgreementCopies still targets exactly the provider OA class", () => {
    const source = read("doolaSubmission.ts");
    const start = source.indexOf(
      "async function flagProviderOperatingAgreementCopies",
    );
    const body = source.slice(start);
    expect(body).toContain('eq(llcDocuments.documentType, "operating_agreement")');
    expect(body).toContain('eq(llcDocuments.source, "provider")');
  });
});

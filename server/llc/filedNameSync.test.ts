/**
 * Registered-name reconciliation (live incident 2026-08-14).
 *
 * Order #270003 applied as "Faith Properties LLC"; the state registered
 * "Properties by Faith LLC" (the provider resolves name availability with
 * the client without telling us). The branded operating agreement — built
 * from registration.legalName — went to the client naming a company that
 * does not exist. These tests pin:
 *  1. extractDoolaFiledName: top-level name strings win; otherwise the
 *     position-1 name option; nothing usable → null.
 *  2. canonicalCompanyName + splitFiledCompanyName: filed-vs-local identity
 *     ignores case/punctuation/whitespace; endings are recognized whether
 *     stored separately, inline, or comma-separated; unrecognized endings
 *     keep the current suffix.
 *  3. Wiring: the refresh syncs the name BEFORE the status transition (so
 *     the completion email and generated agreement read the corrected row),
 *     the regeneration swaps file bytes without touching release state, and
 *     a failed completion email now raises an ops alert.
 *  4. The rescue sweep: completed + non-test + no formation_complete claim,
 *     wired into the poll heartbeat (incident 2026-08-17: two completed
 *     filings' clients were never emailed and nobody knew).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractDoolaFiledName } from "./doola";
import {
  canonicalCompanyName,
  splitFiledCompanyName,
} from "./doolaSubmission";

const read = (relative: string) =>
  readFileSync(join(__dirname, "..", "..", relative), "utf8");

describe("extractDoolaFiledName", () => {
  it("prefers a top-level name string when the payload carries one", () => {
    expect(
      extractDoolaFiledName({
        legalName: " Properties by Faith LLC ",
        nameOptions: [{ name: "Faith Properties", entityTypeEnding: "LLC", position: 1 }],
      }),
    ).toEqual({ name: "Properties by Faith LLC", entityEnding: null });
  });

  it("falls back to the position-1 name option with its ending", () => {
    expect(
      extractDoolaFiledName({
        nameOptions: [
          { name: "Maison Avora", entityTypeEnding: "LLC", position: 2 },
          { name: "Avora Stays", entityTypeEnding: "LLC", position: 1 },
        ],
      }),
    ).toEqual({ name: "Avora Stays", entityEnding: "LLC" });
  });

  it("options without a position sort last; blank names are skipped", () => {
    expect(
      extractDoolaFiledName({
        nameOptions: [
          { name: "  " },
          { name: "Unpositioned Fallback", entityTypeEnding: "LLC" },
          { name: "Chosen Name", entityTypeEnding: "LLC", position: 1 },
        ],
      }),
    ).toEqual({ name: "Chosen Name", entityEnding: "LLC" });
  });

  it("returns null when the payload has nothing usable", () => {
    expect(extractDoolaFiledName({})).toBeNull();
    expect(extractDoolaFiledName({ nameOptions: [] })).toBeNull();
    expect(extractDoolaFiledName({ nameOptions: [{ name: "" }] })).toBeNull();
  });
});

describe("canonicalCompanyName", () => {
  it("treats case, commas, periods, and whitespace as identity-irrelevant", () => {
    expect(canonicalCompanyName("Royal Haven Stays, LLC")).toBe(
      canonicalCompanyName("royal haven stays llc"),
    );
    expect(canonicalCompanyName("Faith Properties L.L.C.")).toBe(
      canonicalCompanyName("Faith  Properties LLC"),
    );
  });

  it("still distinguishes genuinely different names", () => {
    expect(canonicalCompanyName("Faith Properties LLC")).not.toBe(
      canonicalCompanyName("Properties by Faith LLC"),
    );
  });
});

describe("splitFiledCompanyName", () => {
  it("uses a separately-stored ending as-is (nameOptions shape)", () => {
    expect(splitFiledCompanyName("Properties by Faith", "LLC", "L.L.C.")).toEqual({
      base: "Properties by Faith",
      suffix: "LLC",
    });
  });

  it("maps a separately-stored ending onto the enum canonically", () => {
    expect(splitFiledCompanyName("Properties by Faith", "llc.", "LLC")).toEqual({
      base: "Properties by Faith",
      suffix: "LLC",
    });
  });

  it("strips an inline trailing ending", () => {
    expect(splitFiledCompanyName("Properties by Faith LLC", null, "LLC")).toEqual({
      base: "Properties by Faith",
      suffix: "LLC",
    });
  });

  it("strips a comma-separated ending (Royal Haven Stays, LLC)", () => {
    expect(splitFiledCompanyName("Royal Haven Stays, LLC", null, "LLC")).toEqual({
      base: "Royal Haven Stays",
      suffix: "LLC",
    });
  });

  it("recognizes the long-form ending before the LLC inside it", () => {
    expect(
      splitFiledCompanyName("Faith Limited Liability Company", null, "LLC"),
    ).toEqual({ base: "Faith", suffix: "Limited Liability Company" });
  });

  it("keeps the current suffix when no ending is recognizable", () => {
    expect(splitFiledCompanyName("Properties by Faith", null, "L.L.C.")).toEqual({
      base: "Properties by Faith",
      suffix: "L.L.C.",
    });
  });

  it("an unknown separately-stored ending falls back to the current suffix", () => {
    expect(splitFiledCompanyName("Properties by Faith", "Ltd", "LLC")).toEqual({
      base: "Properties by Faith",
      suffix: "LLC",
    });
  });
});

describe("wiring (structural pins)", () => {
  const submission = read("server/llc/doolaSubmission.ts");

  it("the refresh syncs the filed name BEFORE the status transition", () => {
    const refreshStart = submission.indexOf(
      "export async function refreshDoolaRegistrationStatus",
    );
    const syncCall = submission.indexOf("await syncFiledCompanyName(", refreshStart);
    const transition = submission.indexOf(
      "const transition = await transitionLlcStatus",
      refreshStart,
    );
    expect(refreshStart).toBeGreaterThan(-1);
    expect(syncCall).toBeGreaterThan(refreshStart);
    expect(transition).toBeGreaterThan(syncCall);
  });

  it("the sync only trusts the provider name once state-registered, and skips tests", () => {
    const syncStart = submission.indexOf("export async function syncFiledCompanyName");
    const body = submission.slice(syncStart, syncStart + 2200);
    expect(body).toContain("if (!params.stateRegistered) return { changed: false }");
    expect(body).toContain("if (registration.isTest) return { changed: false }");
    // Identity comparison is canonical, not string-equal.
    expect(body).toContain("canonicalCompanyName(filedDisplay) === canonicalCompanyName(localDisplay)");
  });

  it("regeneration targets ONLY the branded ops_upload agreement, never provider copies", () => {
    const regenStart = submission.indexOf(
      "async function regenerateClientOperatingAgreement",
    );
    const body = submission.slice(regenStart, regenStart + 1800);
    expect(body).toContain('eq(llcDocuments.documentType, "operating_agreement")');
    expect(body).toContain('eq(llcDocuments.source, "ops_upload")');
  });

  it("replaceOpsDocumentContent preserves row identity (no releasedAt/opsHeldAt writes)", () => {
    const documents = read("server/llc/documents.ts");
    const start = documents.indexOf("export async function replaceOpsDocumentContent");
    const body = documents.slice(start, documents.indexOf("export async function deleteLlcDocument"));
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain('.set({ storageKey: key })');
    expect(body).not.toContain("releasedAt");
    expect(body).not.toContain("opsHeldAt");
    // Ops uploads only — a provider-mirrored row can never be swapped.
    expect(body).toContain('document.source !== "ops_upload"');
  });

  it("a failed or recipient-less completion email raises an ops alert", () => {
    const completedBlock = submission.slice(
      submission.indexOf('if (nextStatus === "completed")'),
      submission.indexOf("await sendOpsAlert(\n    statusChangeAlert("),
    );
    expect(completedBlock).toContain("sendFormationCompleteEmail");
    expect(completedBlock).toContain('outcome !== "failed" && outcome !== "skipped_no_email"');
    expect(completedBlock).toContain("clientEmailProblemAlert");
  });

  it("the completion-rescue sweep targets completed non-test rows without a claim", () => {
    const emails = read("server/llc/clientEmails.ts");
    const start = emails.indexOf("export async function sendCompletionRescueEmails");
    const body = emails.slice(start, start + 1600);
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain('eq(llcRegistrations.status, "completed")');
    expect(body).toContain("eq(llcRegistrations.isTest, false)");
    expect(body).toContain('eq(llcEmailLog.emailType, "formation_complete")');
    expect(body).toContain("isNull(llcEmailLog.id)");
  });

  it("the poll heartbeat runs the completion-rescue sweep", () => {
    const poller = read("server/ops/poller.ts");
    expect(poller).toContain("sendCompletionRescueEmails()");
  });
});

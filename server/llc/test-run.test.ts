/**
 * Admin test-run safety invariants.
 *
 * A test row (llc_registrations.isTest) must be provably inert toward the
 * outside world: no provider call, no poller sweep, no ops payment alert, no
 * client email — while the client-facing experience mirrors a real filing.
 * These tests pin the structural guarantees; the mock-db behavioral coverage
 * for delete/ops badging lives in demo.test.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(join(__dirname, relative), "utf8");

describe("test-run marker immutability", () => {
  it("saveLlcDraft never touches isTest (edits cannot strip the marker)", () => {
    const source = read("store.ts");
    const start = source.indexOf("export async function saveLlcDraft");
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("export ", start + 1);
    const body = source.slice(start, end === -1 ? undefined : end);
    expect(body).not.toContain("isTest");
  });

  it("createLlcRegistration is the only store write that sets isTest", () => {
    const source = read("store.ts");
    const matches = source.match(/isTest:/g) ?? [];
    // One insert-time write plus the polling exclusion read.
    const createBody = source.slice(
      source.indexOf("export async function createLlcRegistration"),
      source.indexOf("export async function listLlcRegistrationsForUser"),
    );
    expect(createBody).toContain("isTest: options?.isTest ?? false");
    expect(matches.length).toBe(1);
  });
});

describe("test-run submission fork", () => {
  it("forks on isTest before any provider code in submitLlcRegistration", () => {
    const source = read("submission.ts");
    const submitStart = source.indexOf(
      "export async function submitLlcRegistration",
    );
    expect(submitStart).toBeGreaterThan(-1);
    const forkIndex = source.indexOf("lock.registration.isTest", submitStart);
    const accountIndex = source.indexOf("ensureWhopAccount({", submitStart);
    const keyIndex = source.indexOf("randomUUID", submitStart);
    expect(forkIndex).toBeGreaterThan(submitStart);
    expect(forkIndex).toBeLessThan(accountIndex);
    expect(forkIndex).toBeLessThan(keyIndex);
  });

  it("the simulated branch never writes provider identifiers", () => {
    const source = read("submission.ts");
    const forkStart = source.indexOf("TEST RUN FORK");
    // The test fork ends where the provider fork (or the submission-key
    // section) begins — scan only the simulated branch itself.
    const providerFork = source.indexOf("PROVIDER FORK", forkStart);
    const keySection = source.indexOf("const submissionKey =", forkStart);
    const forkEnd = providerFork !== -1 ? Math.min(providerFork, keySection) : keySection;
    expect(forkStart).toBeGreaterThan(-1);
    // Scan executable code only — comment lines may legitimately name the
    // fields they promise to leave untouched.
    const branch = source
      .slice(forkStart, forkEnd)
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    for (const forbidden of [
      "whopAccountId",
      "checkoutSessionId",
      "checkoutUrl",
      "checkoutTotal",
      "ensureWhopAccount",
      "registerWhopLlc",
      "sendOpsAlert",
      "sendApplicationReceivedEmail",
    ]) {
      expect(branch).not.toContain(forbidden);
    }
    expect(branch).toContain('toStatus: "payment_required"');
    expect(branch).toContain("submittedAt: new Date()");
  });

  it("refreshLlcRegistrationStatus answers test rows before touching the provider", () => {
    const source = read("submission.ts");
    const refreshStart = source.indexOf(
      "export async function refreshLlcRegistrationStatus",
    );
    const guardIndex = source.indexOf("registration.isTest", refreshStart);
    const providerIndex = source.indexOf("retrieveWhopAccount", refreshStart);
    expect(guardIndex).toBeGreaterThan(refreshStart);
    expect(guardIndex).toBeLessThan(providerIndex);
    const neutral = source.indexOf("Everything is up to date.", refreshStart);
    expect(neutral).toBeGreaterThan(refreshStart);
    expect(neutral).toBeLessThan(providerIndex);
  });
});

describe("provider fork ordering", () => {
  it("the test fork outranks the provider fork — test rows never reach any provider", () => {
    const source = read("submission.ts");
    const submitStart = source.indexOf("export async function submitLlcRegistration");
    const testFork = source.indexOf("TEST RUN FORK", submitStart);
    const providerFork = source.indexOf("PROVIDER FORK", submitStart);
    expect(testFork).toBeGreaterThan(-1);
    expect(providerFork).toBeGreaterThan(-1);
    expect(testFork).toBeLessThan(providerFork);
  });

  it("the doola hold path performs no provider calls at submit", () => {
    const source = read("submission.ts");
    const start = source.indexOf("PROVIDER FORK");
    const end = source.indexOf("const submissionKey =", start);
    const branch = source
      .slice(start, end)
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    // The hold path may only FILE via fileDoolaRegistration when retail is
    // already paid; it must never create accounts/checkouts or call the
    // doola client directly.
    for (const forbidden of ["ensureWhopAccount", "registerWhopLlc", "createDoolaCustomer", "createDoolaCompany"]) {
      expect(branch).not.toContain(forbidden);
    }
    expect(branch).toContain("fileDoolaRegistration");
    expect(branch).toContain("retailPaidAt");
  });
});

describe("test-run poller exclusion", () => {
  it("the sweep query excludes isTest rows explicitly", () => {
    const source = read("store.ts");
    const start = source.indexOf(
      "export async function listRegistrationsForStatusPolling",
    );
    const end = source.indexOf("export ", start + 1);
    const body = source.slice(start, end);
    expect(body).toContain("eq(llcRegistrations.isTest, false)");
  });
});

describe("test-run email suppression", () => {
  it("sendLifecycleEmail skips test/demo rows before claiming the send-once log", () => {
    const source = read("clientEmails.ts");
    const start = source.indexOf("async function sendLifecycleEmail");
    const guardIndex = source.indexOf("context.registration.isTest", start);
    const claimIndex = source.indexOf("claimSendOnce", start);
    expect(guardIndex).toBeGreaterThan(start);
    expect(guardIndex).toBeLessThan(claimIndex);
  });

  it("sendDocumentsReleasedEmail carries the same guard", () => {
    const source = read("clientEmails.ts");
    const start = source.indexOf(
      "export async function sendDocumentsReleasedEmail",
    );
    const guardIndex = source.indexOf("context.registration.isTest", start);
    const sendIndex = source.indexOf("lastDocumentsEmailAt", start);
    expect(guardIndex).toBeGreaterThan(start);
    expect(guardIndex).toBeLessThan(sendIndex);
  });
});

describe("test-run admin procedures", () => {
  it("startTestRun creates the row with the immutable marker", () => {
    const source = read("router.ts");
    const start = source.indexOf("startTestRun: adminProcedure");
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf("advanceTestStage", start);
    expect(source.slice(start, end)).toContain("{ isTest: true }");
  });

  it("the fork recovers a wedged 'submitting' test row into a retryable failure", () => {
    const source = read("submission.ts");
    const forkStart = source.indexOf("TEST RUN FORK");
    const providerFork = source.indexOf("PROVIDER FORK", forkStart);
    const keySection = source.indexOf("const submissionKey =", forkStart);
    const forkEnd = providerFork !== -1 ? Math.min(providerFork, keySection) : keySection;
    const branch = source.slice(forkStart, forkEnd);
    expect(branch).toContain("[TEST] Simulated submission was interrupted");
    expect(branch).toContain('toStatus: "failed"');
    expect(branch).toContain("retryable: true");
  });

  it("advanceTestStage treats a stale fromStatus as a no-op instead of skipping stages", () => {
    const source = read("router.ts");
    const start = source.indexOf("advanceTestStage: adminProcedure");
    const body = source.slice(start, source.indexOf("markPaid: adminProcedure", start));
    expect(body).toContain('fromStatus: z.enum(["payment_required", "processing"])');
    expect(body).toContain("registration.status !== input.fromStatus");
    // Documents are attached BEFORE the completed flip so a storage failure
    // leaves the row retryable in "processing".
    const attachIndex = body.indexOf("attachSampleDocuments");
    const completedIndex = body.indexOf('toStatus: "completed"');
    expect(attachIndex).toBeGreaterThan(-1);
    expect(attachIndex).toBeLessThan(completedIndex);
  });

  it("advanceTestStage hard-refuses anything that is not a test row", () => {
    const source = read("router.ts");
    const start = source.indexOf("advanceTestStage: adminProcedure");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf("markPaid: adminProcedure", start));
    expect(body).toContain("if (!registration.isTest)");
    expect(body).toContain('code: "FORBIDDEN"');
    // The ladder is fixed and forward-only, guarded by expectedStatuses.
    expect(body).toContain('expectedStatuses: ["payment_required"]');
    expect(body).toContain('expectedStatuses: ["processing"]');
    expect(body).toContain("retailPaidAt: new Date()");
    expect(body).toContain("attachSampleDocuments");
  });
});

describe("test-run client exposure", () => {
  it("client views expose isTest and nothing else about the marker", () => {
    const source = read("domain.ts");
    expect(source).toContain("isTest: Boolean(registration.isTest)");
    expect(source).toContain("isTest: Boolean(row.isTest)");
    // The submission key itself must never reach a client payload. Reading
    // it to DERIVE booleans is fine (isSample does); exposing it as a field
    // ("submissionKey:") is not — demo.test.ts proves the runtime payload.
    const viewStart = source.indexOf("export function bundleToRegistrationView");
    const viewEnd = source.indexOf("export function", viewStart + 1);
    expect(source.slice(viewStart, viewEnd)).not.toContain("submissionKey:");
  });
});

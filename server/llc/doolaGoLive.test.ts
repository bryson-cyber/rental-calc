/**
 * Production go-live safety invariants for the Doola path.
 *
 * These pin the guards added after the 2026-07 pre-production audit:
 *  1. Environment fence — a row stamped for one environment (doolaEnv) can
 *     never file against or be refreshed from the other.
 *  2. Uncertain-outcome quarantine — transport-uncertain filing failures
 *     (timeout / network / malformed response / unknown throw) freeze client
 *     edits so the stored idempotency key can never be rotated away from a
 *     possibly-created company.
 *  3. Sticky provider routing — the submit fork honors the row's provider
 *     history over the live env, so an env flip never re-routes a filing.
 *  4. Post-completion document sweep — recently completed Doola rows stay
 *     pollable so RA mail and late EIN letters arrive without a webhook.
 *  5. Wedged-submitting watchdog — a crash between the charge and the
 *     persistence write is recovered, not silently stranded.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isRegistrationEditable, UNCERTAIN_ERROR_PREFIX } from "./store";

const read = (relative: string) =>
  readFileSync(join(__dirname, relative), "utf8");

describe("environment fence", () => {
  it("fileDoolaRegistration resolves and checks doolaEnv BEFORE the lock", () => {
    const source = read("doolaSubmission.ts");
    const start = source.indexOf("export async function fileDoolaRegistration");
    expect(start).toBeGreaterThan(-1);
    const envResolve = source.indexOf("getDoolaEnvironment()", start);
    const envCheck = source.indexOf("registration.doolaEnv !== environment", start);
    const lockIndex = source.indexOf('toStatus: "submitting"', start);
    expect(envResolve).toBeGreaterThan(start);
    expect(envCheck).toBeGreaterThan(start);
    expect(envResolve).toBeLessThan(lockIndex);
    expect(envCheck).toBeLessThan(lockIndex);
  });

  it("the winning lock stamps the row with the current environment", () => {
    const source = read("doolaSubmission.ts");
    const start = source.indexOf("export async function fileDoolaRegistration");
    const lockIndex = source.indexOf('toStatus: "submitting"', start);
    const stampIndex = source.indexOf("doolaEnv: environment", lockIndex);
    const customerCall = source.indexOf("createDoolaCustomer", lockIndex);
    expect(stampIndex).toBeGreaterThan(lockIndex);
    expect(stampIndex).toBeLessThan(customerCall);
  });

  it("refreshDoolaRegistrationStatus refuses cross-environment company ids", () => {
    const source = read("doolaSubmission.ts");
    const start = source.indexOf(
      "export async function refreshDoolaRegistrationStatus",
    );
    const fence = source.indexOf("registration.doolaEnv !== getDoolaEnvironment()", start);
    const retrieve = source.indexOf("retrieveDoolaCompany", start);
    expect(fence).toBeGreaterThan(start);
    expect(fence).toBeLessThan(retrieve);
  });
});

describe("uncertain-outcome quarantine", () => {
  it("classifies transport-uncertain filing failures with the uncertain_ prefix", () => {
    const source = read("doolaSubmission.ts");
    const start = source.indexOf("export async function fileDoolaRegistration");
    const catchIndex = source.indexOf("} catch (error) {", start);
    const branch = source.slice(catchIndex, source.indexOf("const REFRESHABLE"));
    for (const marker of [
      'api.code === "E_TIMEOUT"',
      'api.code === "E_NETWORK"',
      'api.code === "E_MALFORMED_RESPONSE"',
      "UNCERTAIN_ERROR_PREFIX",
    ]) {
      expect(branch).toContain(marker);
    }
    // Unknown throws (api === null) are ALSO uncertain — a DB failure after
    // a successful create must not leave the row editable.
    expect(branch).toContain("api === null");
  });

  it("an uncertain-marked row is frozen for client edits but a plain retry stays possible", () => {
    const frozen = {
      status: "failed",
      checkoutSessionId: null,
      lastErrorType: `${UNCERTAIN_ERROR_PREFIX}e_timeout`,
    };
    expect(isRegistrationEditable(frozen)).toBe(false);
    // A certain validation failure (e.g. a bad phone) stays editable — the
    // client must be able to fix their data.
    expect(
      isRegistrationEditable({
        status: "failed",
        checkoutSessionId: null,
        lastErrorType: "e_phone_invalid",
      }),
    ).toBe(true);
  });
});

describe("sticky provider routing", () => {
  it("the submit fork honors the row's provider history over the live env", () => {
    const source = read("submission.ts");
    const forkIndex = source.indexOf("PROVIDER FORK");
    const forkRegion = source.slice(forkIndex, forkIndex + 1500);
    expect(forkRegion).toContain('lock.registration.provider === "doola"');
    expect(forkRegion).toContain("lock.registration.whopAccountId");
    expect(forkRegion).toContain("lock.registration.checkoutSessionId");
    // A doola-stamped row must enter the doola leg even when it already has
    // a company id (fileDoolaRegistration answers already_filed) — it must
    // never fall through to the Whop leg.
    expect(forkRegion).toContain("rowIsDoola ||");
  });
});

describe("post-completion document sweep", () => {
  it("recently completed Doola rows stay in the poll set, anchored on submittedAt", () => {
    const source = read("store.ts");
    const start = source.indexOf(
      "export async function listRegistrationsForStatusPolling",
    );
    const end = source.indexOf("export ", start + 1);
    const body = source.slice(start, end);
    expect(body).toContain('eq(llcRegistrations.status, "completed")');
    expect(body).toContain('eq(llcRegistrations.provider, "doola")');
    expect(body).toContain("llcRegistrations.submittedAt");
    // Never updatedAt — refresh writes renew it and would poll forever.
    expect(body).not.toContain("gte(llcRegistrations.updatedAt");
    // Test rows stay excluded no matter what.
    expect(body).toContain("eq(llcRegistrations.isTest, false)");
  });
});

describe("wedged-submitting watchdog", () => {
  it("the poller recovers a doola row stuck in submitting without a company id", () => {
    const source = readFileSync(
      join(__dirname, "..", "ops", "poller.ts"),
      "utf8",
    );
    expect(source).toContain("WEDGED_SUBMITTING_GRACE_MS");
    const watchdog = source.indexOf("WEDGED_SUBMITTING_GRACE_MS =");
    const use = source.indexOf("WEDGED_SUBMITTING_GRACE_MS", watchdog + 40);
    expect(use).toBeGreaterThan(-1);
    // Recovery marks the row uncertain (edit-frozen) AND retryable (same
    // idempotency key replays safely).
    expect(source).toContain('toStatus: "failed"');
    expect(source).toContain("UNCERTAIN_ERROR_PREFIX}interrupted");
    expect(source).toContain("retryable: true");
  });
});

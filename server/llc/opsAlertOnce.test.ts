/**
 * Ops checkout-alert discipline (live incident 2026-09-05: one order's
 * "ACTION: Pay Whop checkout" alert re-fired on every submit retry, all day,
 * and doola orders carried the Whop wholesale wording). Pins:
 *  1. checkoutReadyAlert is provider-aware: only a real hosted-checkout URL
 *     produces the Whop pay-this subject; the doola sentinel produces the
 *     order-received subject with no pay link.
 *  2. The submit path sends it through the send-once claim
 *     (llc_email_log row 'ops_checkout_ready'), released only when no
 *     channel delivered.
 *  3. LLC_PROVIDER fail-safe: unset/typoed routes to doola — the legacy
 *     Whop filing leg is opt-in only.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkoutReadyAlert } from "../ops/notify";
import { getConfiguredLlcProvider } from "./provider";

const read = (relative: string) =>
  readFileSync(join(__dirname, "..", "..", relative), "utf8");

const base = {
  registrationId: 41,
  legalName: "Northstar Studio LLC",
  formationState: "TX",
  retailPriceCents: 40810,
  accountEmailAlias: "ops+reg41@example.com",
  retailPaid: false,
};

describe("checkoutReadyAlert provider-awareness", () => {
  it("a real hosted checkout URL produces the Whop wholesale alert", () => {
    const alert = checkoutReadyAlert({
      ...base,
      checkoutUrl: "https://whop.com/checkout/ch_123",
      checkoutTotal: 40810,
    });
    expect(alert.subject).toContain("ACTION: Pay Whop checkout");
    expect(alert.lines.join("\n")).toContain("Pay here: https://whop.com/checkout/ch_123");
  });

  it("the doola sentinel produces the order-received alert with no pay link and no Whop claim", () => {
    const alert = checkoutReadyAlert({
      ...base,
      checkoutUrl: "(no wholesale checkout — the filing charges automatically once you Mark paid)",
      checkoutTotal: null,
    });
    expect(alert.subject).toContain("ACTION: New LLC filing");
    expect(alert.subject).not.toContain("Whop");
    const body = alert.lines.join("\n");
    expect(body).not.toContain("Pay here");
    expect(body).not.toContain("Whop will submit");
    expect(body).toContain("nothing to pay here");
  });
});

describe("send-once claim", () => {
  const submission = read("server/llc/submission.ts");

  it("every checkoutReadyAlert send goes through sendCheckoutReadyAlertOnce", () => {
    // Three call sites: doola fork, whop success, post-checkout crash catch.
    expect(submission.match(/sendCheckoutReadyAlertOnce\(/g)?.length).toBe(4); // 3 sites + declaration
    expect(submission).not.toMatch(/await sendOpsAlert\(\s*checkoutReadyAlert\(/);
  });

  it("claims BEFORE sending and releases only when no channel delivered", () => {
    const start = submission.indexOf("async function sendCheckoutReadyAlertOnce");
    const body = submission.slice(start, start + 1600);
    const claim = body.indexOf(".insert(llcEmailLog)");
    const send = body.indexOf("sendOpsAlert(alert)");
    const release = body.indexOf(".delete(llcEmailLog)");
    expect(claim).toBeGreaterThan(-1);
    expect(send).toBeGreaterThan(claim);
    expect(release).toBeGreaterThan(send);
    expect(body).toContain('return "skipped"');
    expect(body).toContain('if (delivered) return "sent"');
  });

  it("the whop leg stamps opsNotifiedAt only on a genuine send", () => {
    expect(submission).toContain('if (delivered === "sent") {');
  });
});

describe("LLC_PROVIDER fail-safe", () => {
  it("unset, empty, and typoed values route to doola", () => {
    expect(getConfiguredLlcProvider({} as NodeJS.ProcessEnv)).toBe("doola");
    expect(getConfiguredLlcProvider({ LLC_PROVIDER: "" } as NodeJS.ProcessEnv)).toBe("doola");
    expect(getConfiguredLlcProvider({ LLC_PROVIDER: "whoops" } as NodeJS.ProcessEnv)).toBe("doola");
    expect(getConfiguredLlcProvider({ LLC_PROVIDER: "doola" } as NodeJS.ProcessEnv)).toBe("doola");
  });

  it("the legacy Whop filing leg is explicit opt-in only", () => {
    expect(getConfiguredLlcProvider({ LLC_PROVIDER: "whop" } as NodeJS.ProcessEnv)).toBe("whop");
    expect(getConfiguredLlcProvider({ LLC_PROVIDER: " WHOP " } as NodeJS.ProcessEnv)).toBe("whop");
  });
});

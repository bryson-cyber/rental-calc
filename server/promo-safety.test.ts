/**
 * Promo drip SENDING-SAFETY STRUCTURE TESTS.
 *
 * These read the dispatcher/wiring source and pin the load-bearing safety
 * mechanics so a refactor can't silently remove them (same technique as
 * sms-dispatcher-dedup.test.ts). If one of these fails, a duplicate-send /
 * wrong-audience protection was probably deleted — do not weaken the
 * assertion to make it pass.
 */
import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

const dispatcher = read("promo/promo-dispatcher.ts");
const exclusion = read("promo/promo-webinar-exclusion.ts");
const snapshot = read("promo/promo-snapshot.ts");
const handlers = read("scheduled-handlers.ts");
const coreIndex = read("_core/index.ts");
const schema = read("../drizzle/schema.ts");
const router = read("routers/promo-campaign.ts");

describe("per-send claim (duplicate-send lock)", () => {
  it("schema has the unique (messageId, recipientId) claim index", () => {
    expect(schema).toContain('uniqueIndex("promo_send_claim_uq").on(table.messageId, table.recipientId)');
  });

  it("dispatcher claims by PLAIN INSERT and treats duplicate-key ERROR as lost_claim (never ODKU — mysql2's CLIENT_FOUND_ROWS makes ODKU no-ops report affectedRows=1)", () => {
    const start = dispatcher.indexOf("async function sendToRecipient");
    expect(start).toBeGreaterThan(-1);
    const body = dispatcher.substring(start, start + 3500);
    expect(body).toContain(".insert(promoDripSendLog)");
    expect(body).not.toContain("onDuplicateKeyUpdate");
    expect(body).toMatch(/errno === 1062 \|\| message\.includes\("Duplicate entry"\)\) return "lost_claim"/);
    // drizzle 0.44 wraps driver errors — the cause chain must be checked
    expect(body).toContain("err?.cause?.errno");
  });

  it("step claim only takes pending steps or stale sending claims, with builder-composed WHERE", () => {
    const claimIdx = dispatcher.indexOf("const claimRes = await db");
    const claimBlock = dispatcher.substring(claimIdx, claimIdx + 700);
    expect(claimBlock).toContain('eq(promoDripMessages.status, "pending")');
    expect(claimBlock).toContain('eq(promoDripMessages.status, "sending")');
    expect(claimBlock).toContain("lt(promoDripMessages.claimedAt, claimStaleBefore)");
    expect(dispatcher).toMatch(/if \(affectedRows\(claimRes\) === 0\) return zero/);
  });

  it("dueSteps WHERE uses or()/and() builders so the sending arm stays inside the active-campaign filter", () => {
    const idx = dispatcher.indexOf("const dueSteps");
    const block = dispatcher.substring(idx, idx + 800);
    expect(block).toContain("inArray(promoDripMessages.campaignId");
    expect(block).toContain('and(eq(promoDripMessages.status, "pending"), lte(promoDripMessages.scheduledAt, now))');
    expect(block).not.toContain("sql`");
  });
});

describe("upcoming-webinar exclusion (straight from WebinarJam)", () => {
  it("dispatcher builds fresh exclusion sets inside processStep, before any send", () => {
    const start = dispatcher.indexOf("async function processStep");
    const sendLoop = dispatcher.indexOf("for (const batch of chunk(remaining");
    const setsCall = dispatcher.indexOf("await buildPromoExclusionSets(db)", start);
    expect(setsCall).toBeGreaterThan(start);
    expect(setsCall).toBeLessThan(sendLoop);
  });

  it("WebinarJam failure DEFERS the step (released to pending) instead of guessing", () => {
    expect(dispatcher).toContain("if (!sets.ok)");
    const deferIdx = dispatcher.indexOf("if (!sets.ok)");
    const deferBlock = dispatcher.substring(deferIdx, deferIdx + 700);
    expect(deferBlock).toContain('status: "pending"');
    expect(deferBlock).toContain("claimedAt: null");
  });

  it("exclusion resolver fails closed when any webinar's schedule is unavailable", () => {
    expect(exclusion).toContain("if (!details)");
    const idx = exclusion.indexOf("if (!details)");
    expect(exclusion.substring(idx, idx + 300)).toContain("ok: false");
  });

  it("per-recipient check covers both email and phone identity", () => {
    expect(dispatcher).toContain("sets.upcomingEmails.has(recipient.email)");
    expect(dispatcher).toContain("sets.upcomingPhones.has(recipient.phone)");
  });

  it("snapshot excludes upcoming-webinar registrants with an explainable reason", () => {
    expect(snapshot).toContain('"upcoming_webinar"');
    expect(snapshot).toContain("sets.upcomingEmails.has(email)");
  });
});

describe("suppression filters", () => {
  it("dispatcher only selects recipients with no exclusion and no unsubscribe", () => {
    expect(dispatcher).toContain("isNull(promoDripRecipients.excludedAt)");
    expect(dispatcher).toContain("isNull(promoDripRecipients.unsubscribedAt)");
  });

  it("SMS respects STOP'd phones from the webinar system", () => {
    expect(dispatcher).toContain("sets.optedOutPhones.has(recipient.phone)");
  });

  it("emails carry List-Unsubscribe + RFC 8058 one-click headers and an unsubscribe footer link", () => {
    expect(dispatcher).toContain('"List-Unsubscribe"');
    expect(dispatcher).toContain('"List-Unsubscribe-Post"');
    expect(dispatcher).toContain("buildPromoUnsubscribeUrl");
    expect(router).toContain('"List-Unsubscribe-Post"'); // test sends match the real render
  });

  it("emails include the CAN-SPAM physical postal address in the footer", () => {
    expect(dispatcher).toContain("PROMO_POSTAL_ADDRESS");
    expect(router).toContain("PROMO_POSTAL_ADDRESS");
  });

  it("SMS phones come only from the lead-submitted phone property (TCPA), never vendor-appended numbers", () => {
    const idx = snapshot.indexOf("export function pickPromoPhone");
    const body = snapshot.substring(idx, idx + 700);
    expect(body).not.toContain("data_perfection__phones");
    expect(body).toContain("props.phone");
  });

  it("unsubscribe applies across ALL campaigns (the opt-out sticks) and future snapshots exclude prior unsubscribes", () => {
    const unsub = read("promo/promo-unsubscribe.ts");
    const performIdx = unsub.indexOf("export async function promoUnsubscribeHandler");
    const performBlock = unsub.substring(performIdx);
    expect(performBlock).toContain("eq(promoDripRecipients.email, normalized)");
    expect(performBlock).not.toMatch(/where\([\s\S]{0,200}campaignId/);
    expect(snapshot).toContain('"previously_unsubscribed"');
  });
});

describe("failure containment", () => {
  it("steps >20h overdue are cancelled, never fired late — and stalled 'sending' steps are failed, not resumed", () => {
    expect(dispatcher).toContain("PROMO_STALE_CANCEL_MS = 20 * 60 * 60 * 1000");
    expect(dispatcher).toMatch(/status:\s*"cancelled"[\s\S]{0,400}lt\(promoDripMessages\.scheduledAt, staleCutoff\)/);
    expect(dispatcher).toMatch(/eq\(promoDripMessages\.status, "sending"\), lt\(promoDripMessages\.claimedAt, staleCutoff\)/);
  });

  it("crashed pending claims are marked failed (NOT deleted) — a miss is recoverable, a duplicate is not", () => {
    expect(dispatcher).not.toContain(".delete(promoDripSendLog)");
    const idx = dispatcher.indexOf("Unknown outcome");
    expect(idx).toBeGreaterThan(-1);
    const block = dispatcher.substring(idx - 400, idx + 600);
    expect(block).toContain('status: "failed"');
    expect(block).toContain("PROMO_PENDING_LOG_STALE_MS");
  });

  it("a step never finalizes while unresolved 'pending' claims exist", () => {
    const idx = dispatcher.indexOf("const [remainCount]");
    const block = dispatcher.substring(idx, idx + 900);
    expect(block).toContain('or(isNull(promoDripSendLog.id), eq(promoDripSendLog.status, "pending"))');
  });

  it("retryStep re-opens FAILED sends only (sent/skipped claims stay closed)", () => {
    const idx = router.indexOf("retryStep");
    const block = router.substring(idx, idx + 1600);
    expect(block).toContain(".delete(promoDripSendLog)");
    expect(block).toContain('eq(promoDripSendLog.status, "failed")');
  });

  it("SimpleTexting billing block trips the circuit breaker", () => {
    expect(dispatcher).toContain('if (cls === "billing")');
    expect(dispatcher).toContain('return "billing_blocked"');
    expect(dispatcher).toContain("billingBlocked = true");
  });

  it("skip-type SMS errors don't count as failures", () => {
    expect(dispatcher).toContain("international number skipped");
    expect(dispatcher).toContain("SKIP_ERROR_PATTERNS");
  });

  it("tick is time-budgeted (resumable under the heartbeat handler timeout)", () => {
    expect(dispatcher).toContain("PROMO_TICK_BUDGET_MS = 75_000");
    expect(dispatcher).toContain("Date.now() > deadline");
  });

  it("mid-blast cancellation is honored", () => {
    expect(dispatcher).toMatch(/status === "cancelled"[\s\S]{0,200}stopping/);
  });

});

describe("wiring", () => {
  it("promo dispatch handler is cron-authed and mounted before tRPC", () => {
    const handlerIdx = handlers.indexOf("export async function promoDispatchHandler");
    expect(handlerIdx).toBeGreaterThan(-1);
    expect(handlers.substring(handlerIdx, handlerIdx + 600)).toContain("verifyCronAuth");

    const mountIdx = coreIndex.indexOf('app.post("/api/scheduled/promo-dispatch"');
    const trpcIdx = coreIndex.indexOf('"/api/trpc"');
    expect(mountIdx).toBeGreaterThan(-1);
    expect(mountIdx).toBeLessThan(trpcIdx);
  });

  it("unsubscribe is GET-confirm + POST-perform (scanner prefetch can never unsubscribe anyone)", () => {
    const getIdx = coreIndex.indexOf('app.get("/api/promo/unsubscribe", promoUnsubscribeConfirmHandler)');
    const postIdx = coreIndex.indexOf('app.post("/api/promo/unsubscribe", promoUnsubscribeHandler)');
    expect(getIdx).toBeGreaterThan(-1);
    expect(postIdx).toBeGreaterThan(-1);
    expect(getIdx).toBeLessThan(coreIndex.indexOf('"/api/trpc"'));
    // The GET handler must not write
    const unsub = read("promo/promo-unsubscribe.ts");
    const confirmIdx = unsub.indexOf("export async function promoUnsubscribeConfirmHandler");
    const confirmEnd = unsub.indexOf("export async function promoUnsubscribeHandler");
    const confirmBody = unsub.substring(confirmIdx, confirmEnd);
    expect(confirmBody).not.toContain(".update(");
    expect(confirmBody).not.toContain(".delete(");
  });

  it("in-process promo dispatcher only starts under FORCE_CRON", () => {
    const forceIdx = coreIndex.indexOf("if (process.env.FORCE_CRON === 'true')");
    const elseIdx = coreIndex.indexOf("} else {", forceIdx);
    const startIdx = coreIndex.indexOf("startPromoDispatcher");
    expect(startIdx).toBeGreaterThan(forceIdx);
    expect(startIdx).toBeLessThan(elseIdx);
  });

  it("launch requires a fresh snapshot and a configured app URL", () => {
    expect(router).toContain("SNAPSHOT_MAX_AGE_MS");
    expect(router).toMatch(/if \(!campaign\.snapshotAt\)/);
    expect(router).toMatch(/if \(!ENV\.appUrl\)/);
    expect(router).toMatch(/eligibleCount <= 0/);
  });
});

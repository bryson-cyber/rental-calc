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

  // NOTE: this originally asserted the resolver bail out entirely ("ok: false")
  // the moment ANY webinar failed to resolve. That behavior shipped, and in
  // Aug 2026 a single bogus registrant row (webinarId "settings-test-webinar")
  // made every promo send defer until the 20h guard cancelled Days 3, 5 and 7
  // — the whole campaign died silently. The contract is now fail-closed
  // PER WEBINAR; see the dedicated describe block below. Do not restore the
  // old global-bail assertion.
  it("an unresolvable webinar fails closed for its own registrants, not for everyone", () => {
    const idx = exclusion.indexOf("if (!details)");
    expect(idx).toBeGreaterThan(-1);
    const block = exclusion.substring(idx, idx + 500);
    expect(block).toContain("unresolved.push(webinarId)");
    expect(block).not.toMatch(/return \{ ok: false/);
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

describe("engagement tracking", () => {
  const tracking = read("promo/promo-tracking.ts");

  it("dispatcher tracks links before sending, on both channels", () => {
    const emailIdx = dispatcher.indexOf('channel: "email"', dispatcher.indexOf("sendToRecipient"));
    expect(dispatcher.indexOf("buildTrackedPromoContent")).toBeGreaterThan(-1);
    const sendEmailIdx = dispatcher.indexOf("await sendWebinarEmail(");
    const trackEmailIdx = dispatcher.indexOf("buildTrackedPromoContent", dispatcher.indexOf("async function sendToRecipient"));
    expect(trackEmailIdx).toBeGreaterThan(-1);
    expect(trackEmailIdx).toBeLessThan(sendEmailIdx);
    const smsSendIdx = dispatcher.indexOf("await sendSms(recipient.phone, trackedSms.body)");
    expect(smsSendIdx).toBeGreaterThan(-1);
  });

  it("tracking failure falls back to the untracked body (send never blocked)", () => {
    const idx = tracking.indexOf("sending untracked");
    expect(idx).toBeGreaterThan(-1);
    expect(tracking.substring(idx, idx + 200)).toContain("return { body, openCode: null }");
  });

  it("open pixel endpoint is mounted before tRPC and never cached", () => {
    const idx = coreIndex.indexOf('app.get("/api/promo/open/:code", promoOpenPixelHandler)');
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(coreIndex.indexOf('"/api/trpc"'));
    expect(tracking).toContain('"Cache-Control", "no-store');
  });

  it("step stats exclude test sends", () => {
    expect(tracking).toContain('["promo_drip", "promo_drip_open"]');
    expect(tracking).toContain('"promo_drip_test"');
  });
});

describe("one bad webinar id cannot block the whole campaign", () => {
  const exclusion = read("promo/promo-webinar-exclusion.ts");

  it("non-numeric webinar ids are filtered out before any API call", () => {
    expect(exclusion).toContain("looksLikeRealWebinarId");
    expect(exclusion).toContain("allIds.filter(looksLikeRealWebinarId)");
  });

  it("an unresolvable webinar holds out ONLY its own registrants, it does not abort", () => {
    const idx = exclusion.indexOf("if (!details)");
    expect(idx).toBeGreaterThan(-1);
    const block = exclusion.substring(idx, idx + 500);
    expect(block).toContain("unresolved.push(webinarId)");
    expect(block).toContain("continue");
    // The old behavior — bailing out of the entire resolve — must be gone
    expect(block).not.toMatch(/return \{ ok: false/);
  });

  it("unresolved webinars' registrants are still held out of sends", () => {
    expect(exclusion).toContain("const holdOutIds = [...up.upcomingWebinarIds, ...up.unresolvedWebinarIds]");
    expect(exclusion).toContain("inArray(webinarRegistrants.webinarId, holdOutIds)");
  });

  it("deferring is reserved for a total WebinarJam outage", () => {
    expect(exclusion).toContain("if (unresolved.length === webinarIds.length)");
    const idx = exclusion.indexOf("if (unresolved.length === webinarIds.length)");
    expect(exclusion.substring(idx, idx + 400)).toContain("ok: false");
  });

  it("partial failures notify the owner instead of failing quietly", () => {
    expect(exclusion).toMatch(/unresolved\.length > 0[\s\S]{0,400}notifyOwner/);
  });
});

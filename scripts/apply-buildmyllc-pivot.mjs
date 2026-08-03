/**
 * One-off: swap the promoted offer on the live promo drip from
 * 0percentfunded.com to buildmyllc.com ($0 service fee + state fee).
 *
 * SAFETY MODEL — read before running:
 *  - Only rows with status = 'pending' are touched. A step that already sent
 *    (or is mid-send) is never rewritten, so nobody gets a message whose copy
 *    changed under them.
 *  - Runs inside a transaction; any mismatch rolls the whole thing back.
 *  - Rerouting already-delivered links is OFF by default and only happens
 *    with --reroute-sent (see below).
 *
 * Usage:
 *   node scripts/apply-buildmyllc-pivot.mjs --dry-run     # report only, no writes
 *   node scripts/apply-buildmyllc-pivot.mjs               # apply copy swap
 *   node scripts/apply-buildmyllc-pivot.mjs --reroute-sent # also repoint links
 *                                                          # already delivered in
 *                                                          # Days 0-7 messages
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAMPAIGN_ID = 1;
const NEW_URL = "https://buildmyllc.com/";
const DRY_RUN = process.argv.includes("--dry-run");
const REROUTE_SENT = process.argv.includes("--reroute-sent");

const steps = JSON.parse(fs.readFileSync(path.join(__dirname, "buildmyllc-pivot-copy.json"), "utf8"));

// ── Preflight validation on the copy itself ────────────────────────────────
const problems = [];
for (const s of steps) {
  const urls = s.body.match(/https?:\/\/[^\s]+/g) || [];
  if (urls.length !== 1) problems.push(`${s.stepKey}: expected exactly 1 URL, found ${urls.length}`);
  if (urls[0] && !urls[0].startsWith(NEW_URL)) problems.push(`${s.stepKey}: URL is ${urls[0]}, expected ${NEW_URL}`);
  if (/0percentfunded/i.test(s.body)) problems.push(`${s.stepKey}: still mentions 0percentfunded`);
  if (s.channel === "sms") {
    if (s.body.length > 282) problems.push(`${s.stepKey}: SMS is ${s.body.length} chars (>282 = 3 segments)`);
    // eslint-disable-next-line no-control-regex
    if (/[^\x00-\x7F]/.test(s.body)) problems.push(`${s.stepKey}: SMS contains non-ASCII (breaks GSM-7 billing)`);
  }
  if (s.channel === "email" && !s.subject) problems.push(`${s.stepKey}: email has no subject`);
}
if (problems.length) {
  console.error("PREFLIGHT FAILED — nothing was written:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`Preflight OK: ${steps.length} steps, all pointing at ${NEW_URL}`);

const conn = await mysql.createConnection(
  process.env.DATABASE_URL + '&ssl={"rejectUnauthorized":true}'
);

// ── Show current state ─────────────────────────────────────────────────────
const [current] = await conn.execute(
  "SELECT stepKey, channel, status, scheduledAt, sentCount FROM promo_drip_messages WHERE campaignId = ? ORDER BY sequenceOrder",
  [CAMPAIGN_ID]
);
console.log("\nCurrent campaign state:");
for (const r of current) {
  const mark = steps.some((s) => s.stepKey === r.stepKey) ? (r.status === "pending" ? "  <- will rewrite" : "  <- SKIP (not pending)") : "";
  console.log(`  ${r.stepKey.padEnd(11)} ${r.channel.padEnd(5)} ${String(r.status).padEnd(9)} sent=${r.sentCount}${mark}`);
}

if (DRY_RUN) {
  console.log("\n--dry-run: no writes performed.");
  await conn.end();
  process.exit(0);
}

// ── Apply ──────────────────────────────────────────────────────────────────
await conn.beginTransaction();
try {
  let rewritten = 0;
  const skipped = [];
  for (const s of steps) {
    const [res] = await conn.execute(
      "UPDATE promo_drip_messages SET subject = ?, body = ? WHERE campaignId = ? AND stepKey = ? AND status = 'pending'",
      [s.subject, s.body, CAMPAIGN_ID, s.stepKey]
    );
    if (res.affectedRows === 1) rewritten++;
    else skipped.push(s.stepKey);
  }

  let relinked = 0;
  if (REROUTE_SENT) {
    // Repoint tracking rows already delivered in Days 0-7 so those clicks land
    // on the new offer instead of the dropped partner.
    const [res] = await conn.execute(
      `UPDATE personalized_links
         SET linkUrl = CONCAT(?, '?utm_source=coachinayah&utm_medium=',
             CASE WHEN campaignName LIKE '%:sms_%' THEN 'sms' ELSE 'email' END,
             '&utm_campaign=affiliate_arbitrage&utm_content=', SUBSTRING_INDEX(campaignName, ':', -1))
       WHERE campaignName LIKE ?
         AND campaignType IN ('promo_drip', 'promo_drip_open')
         AND linkUrl LIKE '%0percentfunded%'`,
      [NEW_URL.replace(/\/$/, "/"), `promo:${CAMPAIGN_ID}:%`]
    );
    relinked = res.affectedRows;
  }

  await conn.commit();
  console.log(`\nAPPLIED`);
  console.log(`  steps rewritten: ${rewritten}/${steps.length}`);
  if (skipped.length) console.log(`  skipped (already sent/sending): ${skipped.join(", ")}`);
  console.log(`  already-delivered links repointed: ${REROUTE_SENT ? relinked : "not requested (--reroute-sent off)"}`);
} catch (err) {
  await conn.rollback();
  console.error("ROLLED BACK — nothing changed:", err.message);
  process.exitCode = 1;
}

// ── Verify ─────────────────────────────────────────────────────────────────
const [after] = await conn.execute(
  "SELECT stepKey, status, subject, LEFT(body, 60) AS bodyStart FROM promo_drip_messages WHERE campaignId = ? AND status = 'pending' ORDER BY sequenceOrder",
  [CAMPAIGN_ID]
);
console.log("\nPending steps now read:");
for (const r of after) console.log(`  ${r.stepKey.padEnd(11)} ${r.subject ? '"' + r.subject + '"' : "(sms)"} | ${r.bodyStart.replace(/\n/g, " ")}...`);

const [stale] = await conn.execute(
  "SELECT COUNT(*) AS n FROM promo_drip_messages WHERE campaignId = ? AND status = 'pending' AND body LIKE '%0percentfunded%'",
  [CAMPAIGN_ID]
);
console.log(`\nPending steps still mentioning 0percentfunded: ${stale[0].n} (must be 0)`);

await conn.end();
process.exit(0);

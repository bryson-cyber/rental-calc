import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Duplicate-send protection for the SMS Dispatcher V2 (the dispatcher that
 * actually runs in production; the old V1 mutex-based dispatcher this file used
 * to test was deleted in the V2 rewrite).
 *
 * V2 does NOT rely on an in-process mutex. Instead every message is claimed with
 * a single atomic conditional UPDATE, so overlapping ticks/timers/instances
 * cannot both send the same message. These structural checks pin that guarantee.
 */
describe("SMS Dispatcher V2 — atomic claim prevents duplicate sends", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "routers/sms-dispatcher-v2.ts"),
    "utf-8"
  );

  it("claims a message with a conditional UPDATE gated on status='pending'", () => {
    const claimStart = source.indexOf("async function claimScheduledMessage(");
    expect(claimStart).toBeGreaterThan(-1);
    const claimBody = source.substring(claimStart, claimStart + 700);

    // The claim flips the row to 'sending' only while it is still 'pending'.
    expect(claimBody).toContain('status: "sending"');
    expect(claimBody).toContain('eq(scheduledSmsMessages.status, "pending")');
  });

  it("only the winner of the claim proceeds (affectedRows check)", () => {
    const claimStart = source.indexOf("async function claimScheduledMessage(");
    const claimBody = source.substring(claimStart, claimStart + 700);
    // affectedRows === 0 means another process already claimed it -> bail out.
    expect(claimBody).toMatch(/affectedRows.*(===|\?\?)\s*0|affectedRows\s*\?\?\s*0\)\s*===\s*0/);
    expect(claimBody).toContain("return null");
  });

  it("blocks a second campaign for a message that already has one", () => {
    // Even if two claims ever raced, a pre-send campaign lookup refuses to
    // create a second campaign for the same scheduledMessageId.
    expect(source).toContain("DUPLICATE BLOCKED");
    expect(source).toContain("scheduledMessageId");
  });

  it("watchdog only fails messages with no delivery progress (heartbeat)", () => {
    // claimedAt is refreshed on every delivery flush, so the watchdog cutoff
    // means 'no progress', not 'started long ago' — a live blast never trips it.
    expect(source).toContain("SMS_STUCK_SENDING_MS");
    const flushIdx = source.indexOf("await db.insert(webinarSmsDeliveries).values(chunk);");
    expect(flushIdx).toBeGreaterThan(-1);
    const flushBody = source.substring(flushIdx, flushIdx + 900);
    // The scheduledSmsMessages update inside the flush must bump claimedAt.
    expect(flushBody).toContain("claimedAt: new Date()");
  });
});

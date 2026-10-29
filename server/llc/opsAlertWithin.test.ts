/**
 * sendOpsAlertWithin (2026-10-29, ported from Her First Order's PR #397,
 * where order #32's filing failure paged the owner 62 times): one alert per
 * (order, error type) per window, on this app's llc_email_log claim (unique
 * registrationId + emailType). Inside the window a repeat is skipped, after
 * it the conditional renew lets exactly one caller send, and a send no
 * channel delivered gives the claim back.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ get: vi.fn() }));
const notify = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, getDb: database.get };
});
vi.mock("../ops/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ops/notify")>();
  return { ...actual, sendOpsAlert: notify.send };
});

import { sendOpsAlertWithin } from "./opsAlertClaim";

const DAY = 24 * 60 * 60 * 1000;
const alert = { subject: "ATTENTION: Order #41", lines: ["The doola filing for order #41 did not complete."] };
const args = { registrationId: 41, emailType: "ops_filing_problem:e_validation_failed", windowMs: DAY, alert };

/**
 * A tiny llc_email_log: one claim row per (registrationId, emailType),
 * inserts fail as duplicates, and the renew UPDATE reports one row only when
 * the stored sentAt is older than the cutoff the caller computed.
 */
function fakeLog() {
  const rows = new Map<string, Date>();
  let lastKey = "";
  const db = {
    rows,
    insert: vi.fn(() => ({
      values: async (row: { registrationId: number; emailType: string; sentAt: Date }) => {
        const key = `${row.registrationId}|${row.emailType}`;
        lastKey = key;
        if (rows.has(key)) throw new Error("Duplicate entry for key 'llc_email_log_once_unique' (ER_DUP_ENTRY)");
        rows.set(key, row.sentAt);
      },
    })),
    update: vi.fn(() => ({
      set: (values: { sentAt: Date }) => ({
        where: async () => {
          const stored = rows.get(lastKey)!;
          if (values.sentAt.getTime() - stored.getTime() > args.windowMs) {
            rows.set(lastKey, values.sentAt);
            return [{ affectedRows: 1 }];
          }
          return [{ affectedRows: 0 }];
        },
      }),
    })),
    delete: vi.fn(() => ({
      where: async () => {
        rows.delete(lastKey);
      },
    })),
  };
  return db;
}

beforeEach(() => {
  vi.clearAllMocks();
  notify.send.mockResolvedValue(true);
});

describe("sendOpsAlertWithin", () => {
  it("sends the first, skips repeats inside 24 hours, and sends again once 24 hours have passed", async () => {
    const db = fakeLog();
    database.get.mockResolvedValue(db);
    const start = new Date("2026-10-29T03:28:26.000Z");

    expect(await sendOpsAlertWithin({ ...args, now: start })).toBe("sent");
    // 61 later passes, 1 to 5 minutes apart (HFO's order #32 pattern).
    for (let minute = 4; minute <= 196; minute += 3) {
      expect(await sendOpsAlertWithin({ ...args, now: new Date(start.getTime() + minute * 60_000) })).toBe("skipped");
    }
    expect(notify.send).toHaveBeenCalledTimes(1);

    expect(await sendOpsAlertWithin({ ...args, now: new Date(start.getTime() + DAY + 60_000) })).toBe("sent");
    expect(notify.send).toHaveBeenCalledTimes(2);
  });

  it("a different error type on the same order is its own alert", async () => {
    database.get.mockResolvedValue(fakeLog());
    const now = new Date("2026-10-29T03:28:26.000Z");
    expect(await sendOpsAlertWithin({ ...args, now })).toBe("sent");
    expect(await sendOpsAlertWithin({ ...args, emailType: "ops_filing_problem:e_rate_limited", now })).toBe("sent");
    expect(notify.send).toHaveBeenCalledTimes(2);
  });

  it("cuts the claim type to the column's 64 characters", async () => {
    const db = fakeLog();
    database.get.mockResolvedValue(db);
    await sendOpsAlertWithin({ ...args, emailType: `ops_filing_problem:${"x".repeat(100)}` });
    const [key] = [...db.rows.keys()];
    expect(key.split("|")[1]).toHaveLength(64);
  });

  it("gives the claim back when no channel delivered, so the next pass rings", async () => {
    const db = fakeLog();
    database.get.mockResolvedValue(db);
    const now = new Date("2026-10-29T03:28:26.000Z");
    notify.send.mockResolvedValueOnce(false);
    expect(await sendOpsAlertWithin({ ...args, now })).toBe("failed");
    expect(db.rows.size).toBe(0);
    expect(await sendOpsAlertWithin({ ...args, now: new Date(now.getTime() + 60_000) })).toBe("sent");
  });

  it("without a database the alert still goes out, and it never throws", async () => {
    database.get.mockResolvedValue(null);
    expect(await sendOpsAlertWithin(args)).toBe("sent");
    database.get.mockRejectedValue(new Error("down"));
    expect(await sendOpsAlertWithin(args)).toBe("failed");
  });
});

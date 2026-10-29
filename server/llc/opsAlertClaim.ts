import { and, eq, lt } from "drizzle-orm";
import { llcEmailLog } from "../../drizzle/schema";
import { getDb } from "../db";
import { sendOpsAlert } from "../ops/notify";

/**
 * Send an ops alert at most once per (order, type) per window (2026-10-29,
 * ported from Her First Order's PR #397: HFO's order #32 filing failure paged
 * the owner 62 times in three hours). The claim is this app's send-once row
 * in llc_email_log, the same unique (registrationId, emailType) claim the
 * checkout-ready and address-hold alerts use: it is inserted BEFORE sending.
 * When it already exists, it is renewed only if its sentAt is older than the
 * window, in one conditional UPDATE, so two concurrent callers never both
 * send. Released when no channel delivered, so the next pass rings. Without a
 * database there is nothing to claim against, so the alert goes out. Never
 * throws.
 */
export async function sendOpsAlertWithin(params: {
  registrationId: number;
  /** llc_email_log.emailType: varchar(64), cut to fit. */
  emailType: string;
  windowMs: number;
  alert: { subject: string; lines: string[] };
  now?: Date;
}): Promise<"sent" | "skipped" | "failed"> {
  try {
    const db = await getDb();
    if (!db) return (await sendOpsAlert(params.alert).catch(() => false)) ? "sent" : "failed";
    const now = params.now ?? new Date();
    const emailType = params.emailType.slice(0, 64);
    const key = and(
      eq(llcEmailLog.registrationId, params.registrationId),
      eq(llcEmailLog.emailType, emailType),
    );
    try {
      await db.insert(llcEmailLog).values({
        registrationId: params.registrationId,
        emailType,
        sentAt: now,
      });
    } catch (error) {
      if (!(error instanceof Error && /duplicate|ER_DUP/i.test(error.message))) throw error;
      const renewed = await db
        .update(llcEmailLog)
        .set({ sentAt: now })
        .where(and(key, lt(llcEmailLog.sentAt, new Date(now.getTime() - params.windowMs))));
      if (Number((renewed as unknown as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) !== 1) {
        return "skipped";
      }
    }
    if (await sendOpsAlert(params.alert).catch(() => false)) return "sent";
    await db.delete(llcEmailLog).where(key).catch(() => {});
    return "failed";
  } catch {
    return "failed";
  }
}

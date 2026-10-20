/**
 * The live wiring of the annual report service for this app: the provider client, the SQL store, this app's filings,
 * the once-only ops alert and the vault mirror. Tests build their own deps.
 *
 * Once-only ops alert: the same doorbell discipline as the checkout-ready alert (submission.ts): claim the unique
 * (registrationId, emailType) row in llc_email_log BEFORE sending, and release it when no channel delivered so the
 * next pass can ring once more.
 */
import { and, eq } from "drizzle-orm";
import { llcEmailLog } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { sendOpsAlert } from "../../ops/notify";
import { vaultAnnualReportDocuments } from "./documents";
import { sqlFilingSource } from "./filings";
import { doolaAnnualReportProvider } from "./provider";
import type { AnnualReportDeps } from "./service";
import { sqlAnnualReportStore } from "./store";

const DUPLICATE_PATTERN = /duplicate|ER_DUP/i;

/** A unique-key collision, whether the driver error arrives bare or wrapped by the ORM (error.cause). */
export function isDuplicateKeyError(error: unknown): boolean {
  const messages = [error, (error as { cause?: unknown } | null)?.cause].map((candidate) =>
    candidate instanceof Error ? `${candidate.message} ${(candidate as { code?: unknown }).code ?? ""}` : "",
  );
  return messages.some((message) => DUPLICATE_PATTERN.test(message));
}

export async function sendOpsAlertOnce(params: { registrationId: number; type: string; subject: string; lines: string[] }): Promise<"sent" | "skipped" | "failed"> {
  try {
    const db = await getDb();
    if (!db) return "failed";
    const emailType = params.type.slice(0, 64);
    try {
      await db.insert(llcEmailLog).values({ registrationId: params.registrationId, emailType });
    } catch (error) {
      if (isDuplicateKeyError(error)) return "skipped";
      throw error;
    }
    const delivered = await sendOpsAlert({ subject: params.subject, lines: params.lines }).catch(() => false);
    if (delivered) return "sent";
    await db
      .delete(llcEmailLog)
      .where(and(eq(llcEmailLog.registrationId, params.registrationId), eq(llcEmailLog.emailType, emailType)))
      .catch(() => undefined);
    return "failed";
  } catch (error) {
    console.warn("[AnnualReports] ops alert failed", { error: error instanceof Error ? error.name : "UnknownError" });
    return "failed";
  }
}

export function defaultAnnualReportDeps(): AnnualReportDeps {
  return {
    provider: doolaAnnualReportProvider,
    store: sqlAnnualReportStore,
    filings: sqlFilingSource,
    alerts: { once: (params) => sendOpsAlertOnce(params) },
    documents: vaultAnnualReportDocuments(sqlAnnualReportStore),
    now: () => new Date(),
  };
}

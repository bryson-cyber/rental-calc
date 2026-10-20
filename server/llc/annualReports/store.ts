/**
 * Annual report storage: raw SQL over llc_compliance and llc_annual_reports (tables.ts), behind the AnnualReportStore
 * interface the service takes, so the core logic runs against an in-memory store in tests and a porter swaps only
 * this file when an app's database differs. Every write that guards money (the payment claim, the confirm stamp) is a
 * conditional UPDATE whose affected-row count says who won.
 */
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "../../db";
import type { AnnualReportValue } from "../../../shared/llcAnnualReports";
import { DEMO_SUBMISSION_KEY_PREFIX } from "../demoMarker";

export type ComplianceRow = {
  registrationId: number;
  userId: number;
  state: string | null;
  nextDueDate: string | null;
  lastFiledDate: string | null;
  status: string | null;
  filingRequired: boolean | null;
  quotePriceCents: number | null;
  quoteIsMinimum: boolean;
  syncedAt: Date | null;
  lastError: string | null;
};

export type AnnualReportRow = {
  id: number;
  registrationId: number;
  userId: number;
  fiscalYear: number;
  /** The calendar due date this report was submitted for ("yyyy-MM-dd"); null on rows from before 2026-10-20. */
  dueDate: string | null;
  annualReportId: string | null;
  status: string | null;
  priceInCents: number | null;
  answers: Record<string, AnnualReportValue> | null;
  checkoutSessionId: string | null;
  checkoutUrl: string | null;
  checkoutPlanId: string | null;
  checkoutQuoteHash: string | null;
  checkoutPriceCents: number | null;
  checkoutExpiresAt: Date | null;
  paymentReference: string | null;
  paidCents: number | null;
  paidAt: Date | null;
  submittedAt: Date | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  filedDocumentId: string | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type ReportPatch = Partial<Omit<AnnualReportRow, "id" | "registrationId" | "userId" | "fiscalYear" | "createdAt" | "updatedAt">>;

/** Conditions a guarded update must still meet when it lands. */
export type ReportGuard = {
  paidAtIsNull?: boolean;
  paidAtIsNotNull?: boolean;
  confirmedAtIsNull?: boolean;
  completedAtIsNull?: boolean;
  checkoutPlanId?: string;
};

export type AnnualReportStore = {
  getCompliance(registrationId: number): Promise<ComplianceRow | null>;
  upsertCompliance(row: Omit<ComplianceRow, "syncedAt"> & { syncedAt: Date }): Promise<void>;
  listReports(registrationId: number): Promise<AnnualReportRow[]>;
  getReport(id: number): Promise<AnnualReportRow | null>;
  /**
   * Insert the (registration, fiscal year) row or update it; returns the row as stored. With a guard, the update lands
   * only while the row still meets it (the returned row then shows what won).
   */
  upsertReport(key: { registrationId: number; userId: number; fiscalYear: number }, patch: ReportPatch, guard?: ReportGuard): Promise<AnnualReportRow>;
  /** A guarded update; true when the row matched (and so changed). */
  updateReport(id: number, patch: ReportPatch, guard?: ReportGuard): Promise<boolean>;
  /** Paid (or a no-fee report on file), not confirmed: the confirm retries. */
  listPaidUnconfirmed(limit: number): Promise<AnnualReportRow[]>;
  /** A checkout made, no payment seen, still a saved (FILLED) report: the payment reconciliation. */
  listAwaitingPayment(createdAfter: Date, limit: number): Promise<AnnualReportRow[]>;
  /** Compliance rows whose due date is at most `withinDays` away or past, for the reminders. */
  listDueSoon(lastDate: string, limit: number): Promise<ComplianceRow[]>;
  /** Real completed filings with a provider company whose calendar was never read or was read before `staleBefore`. */
  listStaleFilings(staleBefore: Date, limit: number): Promise<Array<{ registrationId: number; userId: number }>>;
};

// ─── SQL implementation ─────────────────────────────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

/** drizzle/mysql2 answers [rows, fields]; some drivers answer { rows }. */
function rowsOf(result: unknown): Row[] {
  if (Array.isArray(result)) return Array.isArray(result[0]) ? (result[0] as Row[]) : (result as Row[]);
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Row[]) : [];
}

function affectedRowsOf(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  const value = (header as { affectedRows?: unknown; rowsAffected?: unknown } | null)?.affectedRows ?? (header as { rowsAffected?: unknown } | null)?.rowsAffected;
  return typeof value === "number" ? value : Number(value ?? 0);
}

const intOf = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
};
const textOf = (value: unknown): string | null => (value === null || value === undefined ? null : String(value));
const boolOf = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return ["1", "true", "yes"].includes(value.trim().toLowerCase());
  return false;
};
const dateOf = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const text = String(value).trim();
  // A MySQL "2026-09-24 19:00:00" string is UTC here; parse it as such.
  const date = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(text) ? `${text.replace(" ", "T")}Z` : text);
  return Number.isFinite(date.getTime()) ? date : null;
};
const jsonOf = (value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

async function database() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}

const nullableBool = (value: unknown): boolean | null => (value === null || value === undefined ? null : boolOf(value));

function complianceOf(row: Row): ComplianceRow {
  return {
    registrationId: intOf(row.registrationId) ?? 0,
    userId: intOf(row.userId) ?? 0,
    state: textOf(row.state),
    nextDueDate: textOf(row.nextDueDate),
    lastFiledDate: textOf(row.lastFiledDate),
    status: textOf(row.status),
    filingRequired: nullableBool(row.filingRequired),
    quotePriceCents: intOf(row.quotePriceCents),
    quoteIsMinimum: boolOf(row.quoteIsMinimum),
    syncedAt: dateOf(row.syncedAt),
    lastError: textOf(row.lastError),
  };
}

function reportOf(row: Row): AnnualReportRow {
  return {
    id: intOf(row.id) ?? 0,
    registrationId: intOf(row.registrationId) ?? 0,
    userId: intOf(row.userId) ?? 0,
    fiscalYear: intOf(row.fiscalYear) ?? 0,
    dueDate: textOf(row.dueDate),
    annualReportId: textOf(row.annualReportId),
    status: textOf(row.status),
    priceInCents: intOf(row.priceInCents),
    answers: jsonOf(row.answers) as Record<string, AnnualReportValue> | null,
    checkoutSessionId: textOf(row.checkoutSessionId),
    checkoutUrl: textOf(row.checkoutUrl),
    checkoutPlanId: textOf(row.checkoutPlanId),
    checkoutQuoteHash: textOf(row.checkoutQuoteHash),
    checkoutPriceCents: intOf(row.checkoutPriceCents),
    checkoutExpiresAt: dateOf(row.checkoutExpiresAt),
    paymentReference: textOf(row.paymentReference),
    paidCents: intOf(row.paidCents),
    paidAt: dateOf(row.paidAt),
    submittedAt: dateOf(row.submittedAt),
    confirmedAt: dateOf(row.confirmedAt),
    completedAt: dateOf(row.completedAt),
    filedDocumentId: textOf(row.filedDocumentId),
    lastError: textOf(row.lastError),
    lastErrorAt: dateOf(row.lastErrorAt),
    createdAt: dateOf(row.createdAt),
    updatedAt: dateOf(row.updatedAt),
  };
}

const PATCH_COLUMNS = new Set<keyof ReportPatch>([
  "dueDate", "annualReportId", "status", "priceInCents", "answers", "checkoutSessionId", "checkoutUrl", "checkoutPlanId",
  "checkoutQuoteHash", "checkoutPriceCents", "checkoutExpiresAt", "paymentReference", "paidCents", "paidAt",
  "submittedAt", "confirmedAt", "completedAt", "filedDocumentId", "lastError", "lastErrorAt",
]);

function guardConditions(guard: ReportGuard): SQL[] {
  const conditions: SQL[] = [];
  if (guard.paidAtIsNull) conditions.push(sql`paidAt IS NULL`);
  if (guard.paidAtIsNotNull) conditions.push(sql`paidAt IS NOT NULL`);
  if (guard.confirmedAtIsNull) conditions.push(sql`confirmedAt IS NULL`);
  if (guard.completedAtIsNull) conditions.push(sql`completedAt IS NULL`);
  if (guard.checkoutPlanId !== undefined) conditions.push(sql`checkoutPlanId = ${guard.checkoutPlanId}`);
  return conditions;
}

function patchAssignments(patch: ReportPatch): SQL[] {
  const out: SQL[] = [];
  for (const [key, raw] of Object.entries(patch)) {
    if (!PATCH_COLUMNS.has(key as keyof ReportPatch) || raw === undefined) continue;
    const value = key === "answers" && raw !== null ? JSON.stringify(raw) : key === "lastError" && typeof raw === "string" ? raw.slice(0, 255) : raw;
    out.push(sql`${sql.raw(`\`${key}\``)} = ${value}`);
  }
  return out;
}

export const sqlAnnualReportStore: AnnualReportStore = {
  async getCompliance(registrationId) {
    const db = await database();
    const [row] = rowsOf(await db.execute(sql`SELECT * FROM llc_compliance WHERE registrationId = ${registrationId} LIMIT 1`));
    return row ? complianceOf(row) : null;
  },

  async upsertCompliance(row) {
    const db = await database();
    const filingRequired = row.filingRequired === null ? null : row.filingRequired ? 1 : 0;
    await db.execute(sql`
      INSERT INTO llc_compliance
        (registrationId, userId, state, nextDueDate, lastFiledDate, status, filingRequired, quotePriceCents, quoteIsMinimum, syncedAt, lastError)
      VALUES
        (${row.registrationId}, ${row.userId}, ${row.state}, ${row.nextDueDate}, ${row.lastFiledDate}, ${row.status}, ${filingRequired},
         ${row.quotePriceCents}, ${row.quoteIsMinimum ? 1 : 0}, ${row.syncedAt}, ${row.lastError ? row.lastError.slice(0, 255) : null})
      ON DUPLICATE KEY UPDATE
        state = VALUES(state), nextDueDate = VALUES(nextDueDate), lastFiledDate = VALUES(lastFiledDate), status = VALUES(status),
        filingRequired = VALUES(filingRequired), quotePriceCents = VALUES(quotePriceCents), quoteIsMinimum = VALUES(quoteIsMinimum),
        syncedAt = VALUES(syncedAt), lastError = VALUES(lastError)
    `);
  },

  async listReports(registrationId) {
    const db = await database();
    return rowsOf(await db.execute(sql`SELECT * FROM llc_annual_reports WHERE registrationId = ${registrationId} ORDER BY fiscalYear DESC, id DESC`)).map(reportOf);
  },

  async getReport(id) {
    const db = await database();
    const [row] = rowsOf(await db.execute(sql`SELECT * FROM llc_annual_reports WHERE id = ${id} LIMIT 1`));
    return row ? reportOf(row) : null;
  },

  async upsertReport(key, patch, guard = {}) {
    const db = await database();
    await db.execute(sql`
      INSERT IGNORE INTO llc_annual_reports (registrationId, userId, fiscalYear)
      VALUES (${key.registrationId}, ${key.userId}, ${key.fiscalYear})
    `);
    const assignments = patchAssignments(patch);
    if (assignments.length > 0) {
      const conditions = [sql`registrationId = ${key.registrationId}`, sql`fiscalYear = ${key.fiscalYear}`, ...guardConditions(guard)];
      await db.execute(sql`UPDATE llc_annual_reports SET ${sql.join(assignments, sql`, `)} WHERE ${sql.join(conditions, sql` AND `)}`);
    }
    const [row] = rowsOf(await db.execute(sql`SELECT * FROM llc_annual_reports WHERE registrationId = ${key.registrationId} AND fiscalYear = ${key.fiscalYear} LIMIT 1`));
    if (!row) throw new Error("Annual report row could not be saved");
    return reportOf(row);
  },

  async updateReport(id, patch, guard = {}) {
    const assignments = patchAssignments(patch);
    if (assignments.length === 0) return false;
    const conditions: SQL[] = [sql`id = ${id}`, ...guardConditions(guard)];
    const db = await database();
    const result = await db.execute(sql`UPDATE llc_annual_reports SET ${sql.join(assignments, sql`, `)} WHERE ${sql.join(conditions, sql` AND `)}`);
    return affectedRowsOf(result) === 1;
  },

  async listPaidUnconfirmed(limit) {
    const db = await database();
    return rowsOf(await db.execute(sql`
      SELECT * FROM llc_annual_reports
      WHERE confirmedAt IS NULL AND (paidAt IS NOT NULL OR (priceInCents = 0 AND status = 'FILLED' AND annualReportId IS NOT NULL))
      ORDER BY paidAt IS NULL ASC, paidAt ASC, id ASC LIMIT ${limit}
    `)).map(reportOf);
  },

  async listAwaitingPayment(createdAfter, limit) {
    const db = await database();
    return rowsOf(await db.execute(sql`
      SELECT * FROM llc_annual_reports
      WHERE checkoutPlanId IS NOT NULL AND paidAt IS NULL AND confirmedAt IS NULL AND status = 'FILLED'
        AND (checkoutExpiresAt IS NULL OR checkoutExpiresAt > ${createdAfter})
      ORDER BY id ASC LIMIT ${limit}
    `)).map(reportOf);
  },

  async listDueSoon(lastDate, limit) {
    const db = await database();
    return rowsOf(await db.execute(sql`
      SELECT * FROM llc_compliance
      WHERE nextDueDate IS NOT NULL AND nextDueDate <= ${lastDate} AND (filingRequired IS NULL OR filingRequired = 1)
        AND status IN ('UPCOMING', 'OVERDUE')
      ORDER BY nextDueDate ASC LIMIT ${limit}
    `)).map(complianceOf);
  },

  async listStaleFilings(staleBefore, limit) {
    const db = await database();
    // Real filings only: completed, the provider's company on file, never a test or demo row (demoMarker.ts). The
    // service checks eligibility again (and the provider environment) before it reads anything.
    const demoPattern = `${DEMO_SUBMISSION_KEY_PREFIX}%`;
    return rowsOf(await db.execute(sql`
      SELECT r.id AS registrationId, r.userId AS userId
      FROM llc_registrations r
      LEFT JOIN llc_compliance c ON c.registrationId = r.id
      WHERE r.status = 'completed' AND r.provider = 'doola' AND r.doolaCompanyId IS NOT NULL AND r.isTest = 0
        AND (r.submissionKey IS NULL OR r.submissionKey NOT LIKE ${demoPattern})
        AND (c.syncedAt IS NULL OR c.syncedAt < ${staleBefore})
      ORDER BY c.syncedAt IS NULL DESC, c.syncedAt ASC LIMIT ${limit}
    `)).map((row) => ({ registrationId: intOf(row.registrationId) ?? 0, userId: intOf(row.userId) ?? 0 }));
  },
};

/**
 * Boot-time idempotent guard for the provider's reason a filing was refused
 * (llc_registrations.providerErrorDetail, written by fileDoolaRegistration;
 * 2026-10-29, ported from Her First Order's PR #397). NULL-able, so no
 * backfill. server/llc/ensure-tables.ts runs it through
 * ensureFilingDetailColumns, the same way as the address-choice columns: a
 * duplicate-column error is the quiet "already applied", anything else is
 * logged by column name. Every order read selects this column, so a guard
 * that failed quietly would leave every LLC page failing with "Unknown
 * column" while the boot log still said the schema was ensured.
 */
import { isDuplicateColumnError } from "./addressChoices";

export const FILING_DETAIL_COLUMN_SETS: ReadonlyArray<{
  table: string;
  columns: ReadonlyArray<readonly [string, string]>;
}> = [
  {
    table: "llc_registrations",
    columns: [["providerErrorDetail", "varchar(500) NULL"]],
  },
];

/**
 * Adds each column once. Returns the columns that could not be added. Logs
 * the column and the error code only, never a statement or an error message.
 */
export async function ensureFilingDetailColumns(
  execute: (statement: string) => Promise<unknown>,
): Promise<string[]> {
  const failed: string[] = [];
  for (const { table, columns } of FILING_DETAIL_COLUMN_SETS) {
    for (const [name, definition] of columns) {
      try {
        await execute(`ALTER TABLE \`${table}\` ADD \`${name}\` ${definition}`);
      } catch (error) {
        if (isDuplicateColumnError(error)) continue;
        failed.push(`${table}.${name}`);
        const code =
          typeof (error as { code?: unknown } | null)?.code === "string"
            ? (error as { code: string }).code
            : error instanceof Error
              ? error.name
              : "UnknownError";
        console.error("[LLC] Filing detail column could not be added:", `${table}.${name}`, code);
      }
    }
  }
  return failed;
}

/**
 * The activity marker's old value (white-label, 2026-10-29). The wizard saves
 * businessType (and, for a label picked from the searchable list,
 * industryGroup) = DIRECT_LABEL_MARKER to say industryType holds the filing
 * service's own industry label. That marker used to carry the provider's
 * name, which then rode in every draft payload and came back to the browser
 * from every stored order. It is now neutral, and this server-only module is
 * the one place the old value lives (shared/llc.ts ships in the browser
 * bundle, so it must never name it):
 *  - input: a browser still running an older cached bundle sends the old
 *    value; llc.saveDraft and llc.advanceStep rename it before validation and
 *    storage (server/llc/router.ts);
 *  - read: bundleToDraft (server/llc/domain.ts) renames it on a row the boot
 *    update has not reached yet, so no client payload ever carries it;
 *  - filing: deriveDoolaIndustry accepts both values;
 *  - boot: renameLegacyActivityMarkers (run by ensureLlcTables) rewrites the
 *    stored values once, idempotently, leaving updatedAt untouched.
 */
import { DIRECT_LABEL_MARKER } from "../../shared/llc";

/** The marker value before 2026-10-29. Server-only: never import this into client or shared code. */
export const LEGACY_DIRECT_LABEL_MARKER = "doola_direct";

/** True for the direct-label marker, current or legacy. */
export function isDirectLabelMarker(value: string | null | undefined): boolean {
  return value === DIRECT_LABEL_MARKER || value === LEGACY_DIRECT_LABEL_MARKER;
}

/** The legacy marker becomes the current one; every other value passes through unchanged. */
export function normalizeActivityMarker<T extends string | null | undefined>(value: T): T {
  return (value === LEGACY_DIRECT_LABEL_MARKER ? DIRECT_LABEL_MARKER : value) as T;
}

/** The same activity with both marker fields normalized (the same object when nothing changes). */
export function withNormalizedActivityMarker<
  T extends { businessType?: string | null; industryGroup?: string | null },
>(activity: T): T {
  if (
    activity.businessType !== LEGACY_DIRECT_LABEL_MARKER &&
    activity.industryGroup !== LEGACY_DIRECT_LABEL_MARKER
  ) {
    return activity;
  }
  return {
    ...activity,
    businessType: normalizeActivityMarker(activity.businessType),
    industryGroup: normalizeActivityMarker(activity.industryGroup),
  };
}

/** Every stored column that can hold the marker. Drafts and submitted orders are both llc_registrations rows. */
export const ACTIVITY_MARKER_COLUMNS: ReadonlyArray<{ table: string; column: string }> = [
  { table: "llc_registrations", column: "businessType" },
  { table: "llc_registrations", column: "industryGroup" },
];

/**
 * One UPDATE per column. Idempotent: once applied it matches no row.
 * `updatedAt = updatedAt` keeps the ON UPDATE CURRENT_TIMESTAMP column as it
 * was, so the rename does not look like client activity to anything that
 * reads updatedAt (the status page, reminder sweeps).
 */
export function activityMarkerRenameStatements(): string[] {
  return ACTIVITY_MARKER_COLUMNS.map(
    ({ table, column }) =>
      `UPDATE \`${table}\` SET \`${column}\` = '${DIRECT_LABEL_MARKER}', \`updatedAt\` = \`updatedAt\` WHERE \`${column}\` = '${LEGACY_DIRECT_LABEL_MARKER}'`,
  );
}

function affectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  const count = (header as { affectedRows?: unknown } | null)?.affectedRows;
  return typeof count === "number" ? count : 0;
}

/**
 * Boot-time data update (called by ensureLlcTables): renames the stored
 * legacy marker. Returns the columns that could not be updated. Logs counts,
 * column names and error codes only, never a statement or an error message.
 */
export async function renameLegacyActivityMarkers(
  execute: (statement: string) => Promise<unknown>,
): Promise<string[]> {
  const failed: string[] = [];
  const statements = activityMarkerRenameStatements();
  for (let index = 0; index < ACTIVITY_MARKER_COLUMNS.length; index += 1) {
    const { table, column } = ACTIVITY_MARKER_COLUMNS[index];
    try {
      const renamed = affectedRows(await execute(statements[index]));
      if (renamed > 0) {
        console.log(`[LLC] Renamed the legacy activity marker on ${renamed} ${table}.${column} values`);
      }
    } catch (error) {
      failed.push(`${table}.${column}`);
      const code =
        typeof (error as { code?: unknown } | null)?.code === "string"
          ? (error as { code: string }).code
          : error instanceof Error
            ? error.name
            : "UnknownError";
      console.error("[LLC] Activity marker rename failed:", `${table}.${column}`, code);
    }
  }
  return failed;
}

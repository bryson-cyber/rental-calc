/**
 * The boot guard for llc_registrations.providerErrorDetail (2026-10-29, the
 * provider's reason a filing was refused, ops-only). Every order read selects
 * the column, so it must be added at boot like the address-choice columns: a
 * duplicate-column error is the quiet "already applied", anything else is
 * logged by column name (never the statement or the driver's message), and
 * ensureLlcTables runs it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FILING_DETAIL_COLUMN_SETS, ensureFilingDetailColumns } from "./filingDetailColumns";
import { llcRegistrations } from "../../drizzle/schema";

let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("ensureFilingDetailColumns", () => {
  it("adds the NULL-able column the schema declares, and stays quiet once it is there", async () => {
    expect(FILING_DETAIL_COLUMN_SETS).toEqual([
      { table: "llc_registrations", columns: [["providerErrorDetail", "varchar(500) NULL"]] },
    ]);
    expect(llcRegistrations.providerErrorDetail.name).toBe("providerErrorDetail");
    const statements: string[] = [];
    const failed = await ensureFilingDetailColumns(async (statement) => {
      statements.push(statement);
      throw Object.assign(new Error("Duplicate column name 'providerErrorDetail'"), { code: "ER_DUP_FIELDNAME", errno: 1060 });
    });
    expect(statements).toEqual(["ALTER TABLE `llc_registrations` ADD `providerErrorDetail` varchar(500) NULL"]);
    expect(failed).toEqual([]);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("logs a column it could not add by name and code only", async () => {
    const failed = await ensureFilingDetailColumns(async () => {
      throw Object.assign(new Error("ALTER command denied to user 'app'@'10.0.0.5'"), { code: "ER_TABLEACCESS_DENIED_ERROR" });
    });
    expect(failed).toEqual(["llc_registrations.providerErrorDetail"]);
    const logged = errorLog.mock.calls[0].join(" ");
    expect(logged).toContain("llc_registrations.providerErrorDetail");
    expect(logged).toContain("ER_TABLEACCESS_DENIED_ERROR");
    expect(logged).not.toContain("10.0.0.5");
    expect(logged).not.toContain("ALTER TABLE");
  });

  it("runs at boot inside ensureLlcTables, next to the address columns", () => {
    const ensure = readFileSync(join(__dirname, "ensure-tables.ts"), "utf8");
    const address = ensure.indexOf("await ensureAddressColumns(");
    const detail = ensure.indexOf("await ensureFilingDetailColumns(");
    expect(address).toBeGreaterThan(-1);
    expect(detail).toBeGreaterThan(address);
    expect(detail).toBeLessThan(ensure.indexOf('console.log("[LLC] Schema ensured")'));
  });
});

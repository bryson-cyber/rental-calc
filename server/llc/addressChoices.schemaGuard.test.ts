/**
 * The boot guard for the address-choice columns (2026-10-14; owner: an LLC
 * was filed with the registered agent's address as its business address; fix
 * it in every app). Every order read selects these columns, so a guard that
 * fails quietly leaves every LLC page failing with "Unknown column" while the
 * boot log still says the schema is ensured. A duplicate-column error is the
 * normal "already applied" and stays silent; anything else is logged by
 * column name, never with a statement's values or an error message.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, getDb: database.getDb };
});
vi.mock("./pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./pricing")>();
  return { ...actual, seedStatePricing: vi.fn(async () => undefined) };
});

import {
  LLC_ADDRESS_COLUMN_SETS,
  ensureAddressColumns,
  isDuplicateColumnError,
} from "./addressChoices";
import { ensureLlcTables } from "./ensure-tables";

const COLUMN_NAMES = LLC_ADDRESS_COLUMN_SETS.flatMap(({ table, columns }) =>
  columns.map(([name]) => `${table}.${name}`),
);

function duplicateColumn(name: string) {
  return Object.assign(new Error(`Duplicate column name '${name}'`), {
    code: "ER_DUP_FIELDNAME",
    errno: 1060,
  });
}

let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("isDuplicateColumnError", () => {
  it("recognizes the MySQL and TiDB answers, also when wrapped", () => {
    expect(isDuplicateColumnError(duplicateColumn("x"))).toBe(true);
    expect(isDuplicateColumnError({ errno: 1060 })).toBe(true);
    expect(isDuplicateColumnError(new Error("Duplicate column name 'x'"))).toBe(true);
    expect(isDuplicateColumnError(new Error("Failed query", { cause: duplicateColumn("x") }))).toBe(true);
  });

  it("does not mistake a real failure for 'already applied'", () => {
    expect(isDuplicateColumnError(Object.assign(new Error("denied"), { code: "ER_TABLEACCESS_DENIED_ERROR", errno: 1142 }))).toBe(false);
    expect(isDuplicateColumnError(new Error("Table 'llc_registrations' doesn't exist"))).toBe(false);
    expect(isDuplicateColumnError(null)).toBe(false);
    expect(isDuplicateColumnError("Duplicate column name")).toBe(false);
  });
});

describe("ensureAddressColumns", () => {
  it("adds every column once and stays quiet when they are already there", async () => {
    const statements: string[] = [];
    const failed = await ensureAddressColumns(async (statement) => {
      statements.push(statement);
      throw duplicateColumn("already there");
    });
    expect(failed).toEqual([]);
    expect(statements).toHaveLength(COLUMN_NAMES.length);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("logs a column that could not be added by name only, and still tries the others", async () => {
    const attempted: string[] = [];
    const failed = await ensureAddressColumns(async (statement) => {
      attempted.push(statement);
      if (statement.includes("`mailingAgentAckAt`")) {
        throw Object.assign(new Error("ALTER command denied to user 'app'@'10.0.0.5' for table 'llc_registrations'"), {
          code: "ER_TABLEACCESS_DENIED_ERROR",
        });
      }
      return undefined;
    });

    expect(failed).toEqual(["llc_registrations.mailingAgentAckAt"]);
    expect(attempted).toHaveLength(COLUMN_NAMES.length);
    expect(errorLog).toHaveBeenCalledTimes(1);
    const logged = errorLog.mock.calls[0].join(" ");
    expect(logged).toContain("llc_registrations.mailingAgentAckAt");
    expect(logged).toContain("ER_TABLEACCESS_DENIED_ERROR");
    // The driver's message (host, user) and the statement are never logged.
    expect(logged).not.toContain("10.0.0.5");
    expect(logged).not.toContain("ALTER TABLE");
  });
});

describe("ensureLlcTables", () => {
  it("surfaces an address column that could not be added instead of ending 'Schema ensured' silently", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const execute = vi.fn(async (query: unknown) => {
      const text = JSON.stringify(query);
      if (text.includes("addressChoiceEvidence")) throw Object.assign(new Error("timeout"), { code: "ER_LOCK_WAIT_TIMEOUT" });
      if (text.includes("businessAddressMode")) throw duplicateColumn("businessAddressMode");
      return [];
    });
    const select = () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) });
    database.getDb.mockResolvedValue({ execute, select });

    await ensureLlcTables();

    const loggedColumns = errorLog.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(loggedColumns).toContain("llc_registrations.addressChoiceEvidence");
    expect(loggedColumns).not.toContain("businessAddressMode");
    // The other columns were still attempted, and the boot carried on.
    const attempted = execute.mock.calls.map(([query]) => JSON.stringify(query)).join("\n");
    for (const name of COLUMN_NAMES) expect(attempted).toContain(name.split(".")[1]);
    expect(log.mock.calls.flat().join(" ")).toContain("[LLC] Schema ensured");
  });
});

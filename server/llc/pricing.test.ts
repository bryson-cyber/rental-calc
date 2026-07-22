import { describe, expect, it } from "vitest";
import { LLC_FORMATION_STATES } from "../../shared/llc";
import { STATE_FILING_FEES_CENTS, seedStatePricing } from "./pricing";

/**
 * Minimal INSERT IGNORE simulator: applies MySQL unique-key semantics for
 * llc_state_pricing (unique state) so idempotency can be proven without a
 * database. Drizzle sql`` tagged-template queries expose .queryChunks where
 * bound primitives appear inline between StringChunk pieces; we extract the
 * (state, feeCents) pair from those bound values.
 */
function makeFakeSeedDb() {
  const rows = new Map<
    string,
    { stateFeeCents: number; retailPriceCents: number | null; active: boolean }
  >();
  const statements: string[] = [];

  const db = {
    execute: async (query: unknown) => {
      const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
      const params = chunks.filter(
        (chunk) => typeof chunk === "string" || typeof chunk === "number",
      );
      const [state, feeCents] = params as [string, number];
      const text = String((chunks[0] as { value?: string[] })?.value?.[0] ?? "");
      statements.push(text);
      // INSERT IGNORE semantics: existing unique key -> row untouched.
      if (!rows.has(state)) {
        rows.set(state, {
          stateFeeCents: feeCents,
          retailPriceCents: null,
          active: true,
        });
      }
      return [];
    },
  };

  return { db, rows, statements };
}

describe("state filing-fee reference data", () => {
  it("covers exactly the supported formation states with positive fees", () => {
    const seeded = Object.keys(STATE_FILING_FEES_CENTS).sort();
    const supported = [...LLC_FORMATION_STATES].sort();
    expect(seeded).toEqual(supported);
    expect(seeded).toHaveLength(51);
    for (const state of LLC_FORMATION_STATES) {
      expect(STATE_FILING_FEES_CENTS[state]).toBeGreaterThan(0);
      expect(Number.isInteger(STATE_FILING_FEES_CENTS[state])).toBe(true);
    }
  });

  it("carries the documented reference values for spot-checked states", () => {
    expect(STATE_FILING_FEES_CENTS.NM).toBe(5000);
    expect(STATE_FILING_FEES_CENTS.MA).toBe(50000);
    expect(STATE_FILING_FEES_CENTS.MT).toBe(3500);
    expect(STATE_FILING_FEES_CENTS.KY).toBe(4000);
    expect(STATE_FILING_FEES_CENTS.NV).toBe(42500);
  });
});

describe("seedStatePricing idempotency", () => {
  it("seeds one row per state with null retail on first run", async () => {
    const { db, rows, statements } = makeFakeSeedDb();
    await seedStatePricing(db);

    expect(statements).toHaveLength(51);
    for (const statement of statements) {
      expect(statement).toMatch(/^INSERT IGNORE INTO `llc_state_pricing`/);
    }
    expect(rows.size).toBe(51);
    expect(rows.get("NM")).toEqual({
      stateFeeCents: 5000,
      retailPriceCents: null,
      active: true,
    });
  });

  it("re-running the seed never duplicates rows or overwrites owner edits", async () => {
    const { db, rows } = makeFakeSeedDb();
    await seedStatePricing(db);

    // Owner sets a retail price and deactivates a state between boots.
    rows.get("NM")!.retailPriceCents = 54900;
    rows.get("NY")!.active = false;

    await seedStatePricing(db);
    await seedStatePricing(db);

    expect(rows.size).toBe(51);
    expect(rows.get("NM")).toEqual({
      stateFeeCents: 5000,
      retailPriceCents: 54900,
      active: true,
    });
    expect(rows.get("NY")!.active).toBe(false);
  });
});

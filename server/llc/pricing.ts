import { eq, isNotNull, sql, type SQL } from "drizzle-orm";
import { llcRegistrations, llcStatePricing } from "../../drizzle/schema";
import { LLC_FORMATION_STATES } from "../../shared/llc";
import { getDb } from "../db";

/**
 * Per-state retail pricing.
 *
 * Model: the provider's wholesale prices are not published or queryable, so
 * the owner prices each state from two inputs — a state filing-fee REFERENCE
 * table (seeded below) and the real wholesale totals observed on past
 * registrations (surfaced ops-side as lastWholesaleCents).
 *
 * White-label boundary: retail prices and state fees are client-facing by
 * definition; wholesale totals NEVER leave the ops procedures.
 */

/**
 * Secretary-of-State LLC filing fees in cents, as published at seed time.
 * EDITABLE REFERENCE DATA ONLY — fees change; this is not legal or tax
 * advice, and the client-facing price is always the owner-set
 * retailPriceCents (null = no price published). Seeded with INSERT IGNORE so
 * owner edits are never overwritten by a redeploy.
 */
export const STATE_FILING_FEES_CENTS: Record<
  (typeof LLC_FORMATION_STATES)[number],
  number
> = {
  AL: 20000,
  AK: 25000,
  AZ: 5000,
  AR: 4500,
  CA: 7000,
  CO: 5000,
  CT: 12000,
  DE: 11000,
  DC: 9900,
  FL: 12500,
  GA: 10000,
  HI: 5000,
  ID: 10000,
  IL: 15000,
  IN: 9500,
  IA: 5000,
  KS: 16000,
  KY: 4000,
  LA: 10000,
  ME: 17500,
  MD: 10000,
  MA: 50000,
  MI: 5000,
  MN: 15500,
  MS: 5000,
  MO: 5000,
  MT: 3500,
  NE: 10000,
  NV: 42500,
  NH: 10000,
  NJ: 12500,
  NM: 5000,
  NY: 20000,
  NC: 12500,
  ND: 13500,
  OH: 9900,
  OK: 10000,
  OR: 10000,
  PA: 12500,
  RI: 15000,
  SC: 11000,
  SD: 15000,
  TN: 30000,
  TX: 30000,
  UT: 5900,
  VT: 12500,
  VA: 10000,
  WA: 20000,
  WV: 10000,
  WI: 13000,
  WY: 10000,
};

type ExecutingDb = { execute: (query: SQL) => Promise<unknown> };

/**
 * Idempotent boot seed: one INSERT IGNORE per state, so existing rows (and
 * any owner-set retail price / active flag on them) are never touched.
 * retailPriceCents starts NULL everywhere — no price is published until the
 * owner sets one.
 */
export async function seedStatePricing(db: ExecutingDb): Promise<void> {
  for (const state of LLC_FORMATION_STATES) {
    const feeCents = STATE_FILING_FEES_CENTS[state];
    await db.execute(
      sql`INSERT IGNORE INTO \`llc_state_pricing\` (\`state\`, \`stateFeeCents\`) VALUES (${state}, ${feeCents})`,
    );
  }
}

export type StatePricing = {
  state: string;
  retailPriceCents: number | null;
  stateFeeCents: number | null;
  expediteEinPriceCents: number | null;
  /**
   * Owner-provided hosted payment link (client-facing by design: this is the
   * page clients are SENT to after submitting). Null = link not configured.
   */
  paymentLinkUrl: string | null;
  active: boolean;
};

/**
 * Pricing for one state, shaped for the client. A state without a row (or
 * with no database available) reads as unpriced-but-active: the wizard shows
 * the "total after you submit" copy and never blocks.
 */
export async function getStatePricing(state: string): Promise<StatePricing> {
  const fallback: StatePricing = {
    state,
    retailPriceCents: null,
    stateFeeCents: null,
    expediteEinPriceCents: null,
    paymentLinkUrl: null,
    active: true,
  };
  const db = await getDb();
  if (!db) return fallback;

  const rows = await db
    .select()
    .from(llcStatePricing)
    .where(eq(llcStatePricing.state, state))
    .limit(1);
  const row = rows[0];
  if (!row) return fallback;

  return {
    state: row.state,
    retailPriceCents: row.retailPriceCents,
    stateFeeCents: row.stateFeeCents,
    expediteEinPriceCents: row.expediteEinPriceCents,
    paymentLinkUrl: row.paymentLinkUrl,
    active: row.active,
  };
}

/**
 * Friendly blocker for states the owner has switched off. Returns null when
 * the state may be submitted (unknown states and missing pricing rows are
 * allowed — unpriced is not the same as inactive).
 */
export async function getInactiveStateError(
  state: string | null | undefined,
): Promise<string | null> {
  if (!state) return null;
  const pricing = await getStatePricing(state);
  if (pricing.active) return null;
  return `We're not filing in ${state} just yet. Choose another formation state, or check back soon.`;
}

/** All pricing rows, ordered by state (ops + admin table). */
export async function listStatePricing() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(llcStatePricing)
    .orderBy(llcStatePricing.state);
}

/**
 * Ops-only enrichment: the highest wholesale (provider checkout) total seen
 * per formation state, so the owner prices retail with real COGS in view.
 */
export async function listStatePricingWithWholesale() {
  const db = await getDb();
  if (!db) return [];

  const [pricingRows, wholesaleRows] = await Promise.all([
    db.select().from(llcStatePricing).orderBy(llcStatePricing.state),
    db
      .select({
        state: llcRegistrations.formationState,
        lastWholesaleCents: sql<number | null>`max(${llcRegistrations.checkoutTotal})`,
      })
      .from(llcRegistrations)
      .where(isNotNull(llcRegistrations.checkoutTotal))
      .groupBy(llcRegistrations.formationState),
  ]);

  const wholesaleByState = new Map<string, number>();
  for (const row of wholesaleRows) {
    if (row.state && row.lastWholesaleCents !== null) {
      wholesaleByState.set(row.state, Number(row.lastWholesaleCents));
    }
  }

  return pricingRows.map((row) => ({
    state: row.state,
    retailPriceCents: row.retailPriceCents,
    stateFeeCents: row.stateFeeCents,
    expediteEinPriceCents: row.expediteEinPriceCents,
    paymentLinkUrl: row.paymentLinkUrl,
    active: row.active,
    updatedAt: row.updatedAt.getTime(),
    lastWholesaleCents: wholesaleByState.get(row.state) ?? null,
    marginVsLastWholesaleCents:
      row.retailPriceCents !== null && wholesaleByState.has(row.state)
        ? row.retailPriceCents - (wholesaleByState.get(row.state) ?? 0)
        : null,
  }));
}

/** Owner update for one state's retail price / payment link / availability. */
export async function setStatePricing(params: {
  state: string;
  retailPriceCents: number | null;
  active: boolean;
  paymentLinkUrl?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .update(llcStatePricing)
    .set({
      retailPriceCents: params.retailPriceCents,
      active: params.active,
      ...(params.paymentLinkUrl !== undefined
        ? { paymentLinkUrl: params.paymentLinkUrl }
        : {}),
    })
    .where(eq(llcStatePricing.state, params.state));
  const rows = await db
    .select()
    .from(llcStatePricing)
    .where(eq(llcStatePricing.state, params.state))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Bulk pricing: retailPriceCents = stateFeeCents + markupCents for every
 * ACTIVE state in one action. Inactive states are left untouched.
 */
export async function applyStateMarkup(markupCents: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .update(llcStatePricing)
    .set({
      retailPriceCents: sql`${llcStatePricing.stateFeeCents} + ${markupCents}`,
    })
    .where(eq(llcStatePricing.active, true));
  return { updated: Number((result as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) };
}

/**
 * Bulk expedited-EIN add-on price: the add-on is a flat service fee, so one
 * action prices it for every state (null clears it everywhere).
 */
export async function applyExpeditePriceToAllStates(expediteEinPriceCents: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .update(llcStatePricing)
    .set({ expediteEinPriceCents });
  return { updated: Number((result as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) };
}

/**
 * Bulk payment link: many owners use ONE hosted payment page for every
 * state, so this applies the link to all states in one action (null clears
 * it everywhere).
 */
export async function applyPaymentLinkToAllStates(paymentLinkUrl: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .update(llcStatePricing)
    .set({ paymentLinkUrl });
  return { updated: Number((result as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0) };
}

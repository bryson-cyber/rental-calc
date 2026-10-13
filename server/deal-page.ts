/**
 * Client deal walkthroughs for team-built reports.
 *
 * The team builds validator reports in the tool (adjusting revenue, occupancy
 * and the furniture budget), then sends clients the /share links in Slack.
 * This adds a plain-English walkthrough to the top of such a report — using
 * the team's own numbers, BNB Calc's arbitrage analysis and a Claude brief —
 * without changing the link or the team's workflow. The facts and brief are
 * stored in the report's reportData (_dealFacts, _dealBrief), which the /share
 * viewer renders via DealWalkthrough.
 *
 * Built automatically: when a team member saves a rent report, the first time
 * an older team report is opened, and after the team edits its numbers.
 */

import { eq } from "drizzle-orm";
import { universalShareableReports } from "../drizzle/schema";
import { getDb } from "./db";
import { getBnbCalcArbAnalysis } from "./bnbcalc";
import { buildDealFacts, DEAL_FACTS_VERSION, generateDealBrief, type DealBriefComp, type DealProjection } from "./deal-brief";

type ReportRow = typeof universalShareableReports.$inferSelect;

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** Team accounts whose reports get a deal walkthrough automatically. */
export function isDealTeamUser(user?: { role?: string | null; email?: string | null } | null): boolean {
  if (!user) return false;
  return user.role === "admin" || Boolean(user.email?.toLowerCase().endsWith("@coachinayah.com"));
}

/**
 * Revenue picture of a saved report, honoring the team's overrides. Stored
 * numbers carry the boost that was live when the report was made.
 */
export function projectionFromReport(row: ReportRow): DealProjection | null {
  const rd = (row.reportData ?? {}) as any;
  // Reports made before boost tracking were unboosted (matches getShareableReport)
  const boostFactor = num(row.boostFactorAtCreation) || 1;

  const annualRevenue = num(row.revenueOverride) ?? num(rd._revenueOverride) ?? num(rd.revenue?.projected);
  if (!annualRevenue || annualRevenue <= 0) return null;

  const occ = num(row.occupancyOverride) ?? num(rd._occupancyOverride) ?? num(rd.metrics?.occupancy) ?? 0;
  const occupancy = occ > 1 ? occ / 100 : occ;

  const comps: DealBriefComp[] = (Array.isArray(rd.comparables) ? rd.comparables : []).map((c: any) => {
    const compOcc = num(c.occupancy) ?? 0;
    return {
      title: c.title ?? "Comparable rental",
      url: c.airbnbUrl,
      imageUrl: c.imageUrl,
      bedrooms: c.bedrooms,
      // Report comps carry the boost — show the real numbers
      annualRevenue: Math.round((num(c.revenue) ?? 0) / boostFactor),
      occupancy: compOcc > 1 ? compOcc / 100 : compOcc,
      adr: Math.round((num(c.adr) ?? 0) / boostFactor),
      distanceMiles: num(c.distanceMeters) ? num(c.distanceMeters)! / 1609.34 : undefined,
      rating: num(c.rating),
      reviews: num(c.reviews),
    };
  });

  return {
    annualRevenue,
    annualRevenueLow: num(rd.revenue?.low) ?? annualRevenue * 0.6,
    adr: num(row.adrOverride) ?? num(rd.metrics?.adr) ?? 0,
    occupancy,
    boostFactor,
    comps,
    startupCost: num(rd._furnitureCost),
    expenseRatio: num(rd._expensePercent) != null ? num(rd._expensePercent)! / 100 : undefined,
  };
}

export type DealPageResult =
  | { ok: true; hasBrief: boolean }
  | { ok: false; reason: string };

const inFlight = new Map<string, Promise<DealPageResult>>();

/**
 * Build (or rebuild) the deal walkthrough for a saved report. Slow — BNB Calc's AI
 * steps plus a Claude call, usually 1–3 minutes. Concurrent calls for the same
 * report share one run.
 */
export function generateDealPageForReport(shareCode: string): Promise<DealPageResult> {
  const running = inFlight.get(shareCode);
  if (running) return running;
  const run = buildDealPage(shareCode).finally(() => inFlight.delete(shareCode));
  inFlight.set(shareCode, run);
  return run;
}

async function loadReport(shareCode: string): Promise<ReportRow | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [row] = await db
    .select()
    .from(universalShareableReports)
    .where(eq(universalShareableReports.shareCode, shareCode))
    .limit(1);
  return row;
}

async function buildDealPage(shareCode: string): Promise<DealPageResult> {
  const row = await loadReport(shareCode);
  if (!row) return { ok: false, reason: "Report not found" };
  const rd = (row.reportData ?? {}) as any;
  if (row.reportType !== "validator" || (rd._mode && rd._mode !== "rent")) {
    return { ok: false, reason: "Deal pages are for rental-arbitrage reports" };
  }
  const monthlyRent = row.monthlyRent ?? 0;
  if (!row.address || monthlyRent <= 0) return { ok: false, reason: "Report needs an address and monthly rent" };

  const projection = projectionFromReport(row);
  if (!projection) return { ok: false, reason: "Report has no revenue projection" };

  const bedrooms = row.bedrooms ?? 2;
  const bathrooms = num(row.bathrooms) ?? Math.max(1, Math.ceil(bedrooms * 0.75));

  const arb = await getBnbCalcArbAnalysis({
    address: row.address,
    bedrooms,
    bathrooms,
    accommodates: bedrooms * 2 + 2,
    monthlyRent,
  });
  const facts = buildDealFacts({ bedrooms, bathrooms, monthlyRent, projection, arb });
  const brief = facts.monthlyProfit > 0
    ? await generateDealBrief({ address: row.address, city: row.city, state: row.state }, facts)
    : null;

  // Re-read so edits made during the slow calls above aren't overwritten
  const latest = await loadReport(shareCode);
  const db = await getDb();
  if (!latest || !db) return { ok: false, reason: "Report not found" };
  await db
    .update(universalShareableReports)
    .set({
      reportData: {
        ...((latest.reportData ?? {}) as object),
        _dealFacts: facts,
        _dealBrief: brief,
        _dealGeneratedAt: new Date().toISOString(),
      },
    })
    .where(eq(universalShareableReports.shareCode, shareCode));

  console.log(`[DealPage] Built walkthrough for /share/${shareCode}: ${row.address} (brief: ${brief ? "yes" : "no"}, arb: ${arb ? "yes" : "no"})`);
  return { ok: true, hasBrief: Boolean(brief) };
}

/** Fire-and-forget rebuild; logs instead of throwing. */
export function queueDealPage(shareCode: string): void {
  generateDealPageForReport(shareCode)
    .then((r) => {
      if (!r.ok) console.log(`[DealPage] Skipped ${shareCode}: ${r.reason}`);
    })
    .catch((err) => console.error(`[DealPage] Failed for ${shareCode}:`, err));
}

/** Rebuild only when the report already has a walkthrough (e.g. after an override edit). */
export async function refreshDealPageIfPresent(shareCode: string): Promise<void> {
  try {
    const row = await loadReport(shareCode);
    if ((row?.reportData as any)?._dealFacts) queueDealPage(shareCode);
  } catch (err) {
    console.error(`[DealPage] Refresh check failed for ${shareCode}:`, err);
  }
}

/**
 * Called when a report is opened: older team-built rent reports that predate
 * walkthroughs get one built in the background (ready on the next open).
 * Reports made by public users of the free tool are skipped — each build
 * spends BNB Calc AI credits and a Claude call.
 */
export function ensureDealWalkthroughOnView(row: {
  shareCode: string;
  reportType: string | null;
  monthlyRent: number | null;
  creatorEmail: string | null;
  reportData: unknown;
}): void {
  const rd = (row.reportData ?? {}) as any;
  // Built and current → nothing to do. Built on an older facts version → rebuild.
  if (rd._dealFacts && (rd._dealFacts.version ?? 1) >= DEAL_FACTS_VERSION) return;
  if (!rd._dealFacts && rd._dealGeneratedAt) return; // built, but no facts (e.g. unprofitable) — don't retry every open
  if (row.reportType !== "validator" || (row.monthlyRent ?? 0) <= 0 || (rd._mode && rd._mode !== "rent")) return;
  if (!isDealTeamUser({ email: row.creatorEmail })) return;
  queueDealPage(row.shareCode);
}

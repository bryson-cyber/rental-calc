/**
 * Client Deal Brief — "why this deal works", for arbitrage clients.
 *
 * Every deal we send a client gets a short plain-English brief that walks them
 * through the numbers so they can see (and check) why it's worth signing.
 *
 * Two layers:
 * 1. buildDealFacts() — deterministic math. Every number the client sees comes
 *    from here, never from the model.
 * 2. generateDealBrief() — Claude writes the explanation around those facts.
 *
 * Revenue framing: the projection is the OPTIMIZED scenario (top-quarter
 * performer × REVENUE_BOOST_FACTOR — what a well-run listing earns). The raw
 * data-model median and slow-year numbers are shown alongside it, and comps are
 * shown at their real (unboosted) numbers so clients can verify them on Airbnb.
 */

import type { RentalizerResponse } from './airdna';
import { REVENUE_BOOST_FACTOR } from './airdna';
import type { BnbCalcArbAnalysis, BnbCalcArbComparable } from './bnbcalc';
import { routedLLMCall, FEATURES } from './model-router';

// ============================================================
// Startup cost
// ============================================================

/**
 * Our arbitrage launch budget (furniture, setup, deposit, first month):
 * 1 bed $15k, 2 bed $20k, 3 bed $25k, +$5k per extra bedroom. Studios = 1 bed.
 */
export function arbStartupCost(bedrooms: number): number {
  const beds = Math.max(1, Math.round(bedrooms || 1));
  return 15_000 + (beds - 1) * 5_000;
}

// ============================================================
// Facts (deterministic)
// ============================================================

export interface DealBriefComp {
  title: string;
  url?: string;
  imageUrl?: string;
  bedrooms?: number;
  annualRevenue: number;
  occupancy: number; // decimal
  adr: number;
  distanceMiles?: number;
  rating?: number;
  reviews?: number;
}

/** Bump when facts change meaning; older walkthroughs rebuild on next open. */
export const DEAL_FACTS_VERSION = 2;

export interface DealFacts {
  version: number;
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;

  /** Optimized scenario — what the report projects */
  monthlyRevenue: number;
  adr: number;
  projectedOccupancy: number;
  /** Raw data-model median (typical listing, no optimization) */
  dataModelMonthlyRevenue: number;
  /** Raw bottom-quarter listing — the slow-year floor */
  slowYearMonthlyRevenue: number;

  expenseRatio: number;
  expenseSource: 'bnbcalc_ai' | 'report' | 'default';
  monthlyExpenses: number;
  monthlyProfit: number;
  slowYearMonthlyProfit: number;

  /** Occupancy needed to cover rent + expenses */
  breakEvenOccupancy: number;
  /** How booked a typical comparable home is */
  /** How booked a typical comparable home is; null when no real market data */
  marketMedianOccupancy: number | null;

  startupCost: number;
  paybackMonths: number | null;
  annualCashOnCash: number;

  comps: DealBriefComp[];
  /** Amenities far more common among the top earners than the rest */
  topEarnerAmenities: Array<{ amenity: string; topShare: number; restShare: number }>;
  bnbcalcReportUrl?: string;
}

const DEFAULT_EXPENSE_RATIO = 0.2;
const DAYS_PER_MONTH = 30.4;

/** BNB Calc returns occupancy as a decimal in bands but a percentage elsewhere. */
function toDecimal(rate: number | undefined | null): number | undefined {
  if (rate == null || !Number.isFinite(rate)) return undefined;
  return rate > 1 ? rate / 100 : rate;
}

function mapArbComp(c: BnbCalcArbComparable): DealBriefComp {
  const id = c.airbnbId || c.listing_id;
  const ttm = c.metrics?.ttm;
  return {
    title: c.name || 'Comparable rental',
    url: c.listingUrl || (id ? `https://www.airbnb.com/rooms/${id}` : undefined),
    imageUrl: c.photo_urls?.[0] || c.thumbnail_url,
    bedrooms: c.bedrooms,
    annualRevenue: Math.round(c.annualRevenueUSD ?? ttm?.revenue ?? c.annual_revenue_ltm ?? 0),
    occupancy: toDecimal(c.occupancyRatePercentage ?? ttm?.adjusted_occupancy ?? c.average_occupancy_rate_ltm) ?? 0,
    adr: Math.round(c.averageDailyRateUSD ?? ttm?.adr ?? c.average_daily_rate_ltm ?? 0),
    distanceMiles: c.distanceMiles ?? (c.distance_meters != null ? c.distance_meters / 1609.34 : undefined),
    rating: c.rating,
    reviews: c.reviews,
  };
}

/**
 * Comps go in front of clients as "check the proof yourself" links, so skip
 * ones that look delisted: no bookings in the last 90 days. Comps without
 * recent-activity numbers are kept (nothing to judge them on).
 */
export function looksActive(c: BnbCalcArbComparable): boolean {
  const l90d = c.metrics?.l90d;
  const reserved = l90d?.days_reserved;
  const revenue = l90d?.revenue;
  if (typeof reserved !== 'number' && typeof revenue !== 'number') return true;
  return (reserved ?? 0) > 0 || (revenue ?? 0) > 0;
}

function median(values: number[]): number | undefined {
  const v = values.filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (v.length < 3) return undefined;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** A BNB Calc percentile from either response shape (raw, unboosted). */
function arbPercentile(
  arb: BnbCalcArbAnalysis | null | undefined,
  pctl: 'p25' | 'p50',
  field: 'revenue' | 'occupancy',
): number | undefined {
  if (!arb) return undefined;
  const band = arb[field]?.[pctl];
  if (typeof band === 'number') return field === 'occupancy' ? toDecimal(band) : band;
  const q = arb.quartiles?.[pctl === 'p25' ? '25th_percentile' : '50th_percentile'];
  if (!q) return undefined;
  return field === 'occupancy' ? toDecimal(q.occupancy_rate) : q.revenue;
}

function compAmenities(c: BnbCalcArbComparable): string[] {
  if (c.amenities_raw?.length) return c.amenities_raw;
  if (c.amenities) return Object.keys(c.amenities).filter(k => c.amenities![k]);
  return [];
}

/**
 * Amenities at least 30 points more common in the top-earning half of comps
 * than the bottom half. Needs 6+ comps with amenity data to say anything.
 */
export function findTopEarnerAmenities(comps: BnbCalcArbComparable[]): DealFacts['topEarnerAmenities'] {
  const withData = comps
    .map(c => ({ revenue: c.annualRevenueUSD ?? c.annual_revenue_ltm ?? 0, amenities: new Set(compAmenities(c)) }))
    .filter(c => c.amenities.size > 0 && c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
  if (withData.length < 6) return [];

  const half = Math.floor(withData.length / 2);
  const top = withData.slice(0, half);
  const rest = withData.slice(half);
  const all = new Set(withData.flatMap(c => Array.from(c.amenities)));
  const share = (group: typeof withData, a: string) => group.filter(c => c.amenities.has(a)).length / group.length;

  return Array.from(all)
    .map(amenity => ({ amenity, topShare: share(top, amenity), restShare: share(rest, amenity) }))
    .filter(a => a.topShare - a.restShare >= 0.3)
    .sort((a, b) => (b.topShare - b.restShare) - (a.topShare - a.restShare))
    .slice(0, 5);
}

/**
 * The revenue picture a deal page is built on — boosted (optimized) numbers,
 * plus comps at their real numbers. Comes from a fresh estimate (scanner) or
 * from a team-built report with its overrides (see deal-page.ts).
 */
export interface DealProjection {
  /** Optimized annual revenue (boosted, or the team's override) */
  annualRevenue: number;
  /** Boosted bottom-quarter annual revenue */
  annualRevenueLow: number;
  adr: number;
  /** Decimal (0.66) */
  occupancy: number;
  /** Boost baked into the numbers above — used to recover raw data-model figures */
  boostFactor: number;
  /** Comps at real, unboosted numbers (fallback when BNB Calc returns none) */
  comps: DealBriefComp[];
  /** Launch budget the team set on the report, if any */
  startupCost?: number;
  /** Expense share the team set on the report (0.2) — keeps the walkthrough in step with the dashboard */
  expenseRatio?: number;
}

export function projectionFromEstimate(estimate: RentalizerResponse, boostFactor = REVENUE_BOOST_FACTOR): DealProjection {
  return {
    annualRevenue: estimate.estimates.annual_revenue,
    annualRevenueLow: estimate.estimates.annual_revenue_low,
    adr: estimate.estimates.average_daily_rate,
    occupancy: estimate.estimates.occupancy_rate,
    boostFactor,
    // estimate comps carry the boost — show the real numbers
    comps: (estimate.comps || []).map(c => ({
      title: c.title ?? 'Comparable rental',
      url: c.airbnb_url,
      imageUrl: c.image_url,
      bedrooms: c.bedrooms,
      annualRevenue: Math.round((c.annual_revenue ?? 0) / boostFactor),
      occupancy: c.occupancy ?? 0,
      adr: Math.round((c.adr ?? 0) / boostFactor),
      distanceMiles: c.distance_meters ? c.distance_meters / 1609.34 : undefined,
      rating: c.rating ?? undefined,
      reviews: c.reviews,
    })),
  };
}

export function buildDealFacts(params: {
  bedrooms: number;
  bathrooms: number;
  monthlyRent: number;
  projection: DealProjection;
  arb?: BnbCalcArbAnalysis | null;
}): DealFacts {
  const { bedrooms, bathrooms, monthlyRent, projection: p, arb } = params;
  const boost = p.boostFactor || 1;

  const monthlyRevenue = p.annualRevenue / 12;
  const projectedOccupancy = p.occupancy;
  // Nightly rate implied by revenue ÷ booked nights, so rate × occupancy always
  // reproduces the revenue (team overrides often change one but not the other)
  const adr = projectedOccupancy > 0 ? monthlyRevenue / (projectedOccupancy * DAYS_PER_MONTH) : p.adr;

  // Unboosted bands: prefer BNB Calc's arb bands, else undo the boost
  const dataModelMonthlyRevenue = (arbPercentile(arb, 'p50', 'revenue') ?? p.annualRevenue / boost) / 12;
  const slowYearMonthlyRevenue = (arbPercentile(arb, 'p25', 'revenue') ?? p.annualRevenueLow / boost) / 12;

  // BNB Calc's AI expense estimate (excludes rent), as a share of its own revenue
  const arbRatio = arb && arb.monthlyRevenueUSD > 0 ? arb.monthlyExpensesUSD / arb.monthlyRevenueUSD : NaN;
  const hasArbRatio = Number.isFinite(arbRatio) && arbRatio > 0;
  const expenseSource: DealFacts['expenseSource'] =
    p.expenseRatio != null ? 'report' : hasArbRatio ? 'bnbcalc_ai' : 'default';
  const expenseRatio =
    p.expenseRatio ?? (hasArbRatio ? Math.min(0.6, Math.max(0.1, arbRatio)) : DEFAULT_EXPENSE_RATIO);

  const monthlyExpenses = monthlyRevenue * expenseRatio;
  const monthlyProfit = monthlyRevenue - monthlyRent - monthlyExpenses;
  const slowYearMonthlyProfit = slowYearMonthlyRevenue * (1 - expenseRatio) - monthlyRent;

  const revenueToBreakEven = monthlyRent / (1 - expenseRatio);
  const breakEvenOccupancy = adr > 0 ? revenueToBreakEven / (adr * DAYS_PER_MONTH) : 1;
  const liveArbComps = (arb?.comparables ?? []).filter(looksActive);
  const mappedArbComps = liveArbComps.map(mapArbComp);
  // How booked similar homes really are — BNB Calc's median, else the median
  // of real comps. Never the projection itself: that would compare the deal's
  // own assumption to itself.
  const marketMedianOccupancy =
    arbPercentile(arb, 'p50', 'occupancy') ??
    median(mappedArbComps.map(c => c.occupancy)) ??
    median(p.comps.map(c => c.occupancy)) ??
    null;

  const startupCost = p.startupCost && p.startupCost > 0 ? p.startupCost : arbStartupCost(bedrooms);
  const paybackMonths = monthlyProfit > 0 ? startupCost / monthlyProfit : null;
  const annualCashOnCash = (monthlyProfit * 12) / startupCost;

  const comps: DealBriefComp[] = mappedArbComps.some(c => c.annualRevenue > 0) ? mappedArbComps : p.comps;

  return {
    version: DEAL_FACTS_VERSION,
    bedrooms,
    bathrooms,
    monthlyRent,
    monthlyRevenue: Math.round(monthlyRevenue),
    adr: Math.round(adr),
    projectedOccupancy,
    dataModelMonthlyRevenue: Math.round(dataModelMonthlyRevenue),
    slowYearMonthlyRevenue: Math.round(slowYearMonthlyRevenue),
    expenseRatio,
    expenseSource,
    monthlyExpenses: Math.round(monthlyExpenses),
    monthlyProfit: Math.round(monthlyProfit),
    slowYearMonthlyProfit: Math.round(slowYearMonthlyProfit),
    breakEvenOccupancy,
    marketMedianOccupancy,
    startupCost,
    paybackMonths,
    annualCashOnCash,
    comps: comps
      .filter(c => c.annualRevenue > 0)
      .sort((a, b) => b.annualRevenue - a.annualRevenue)
      .slice(0, 5),
    topEarnerAmenities: findTopEarnerAmenities(arb?.comparables ?? []),
    bnbcalcReportUrl: arb?.url,
  };
}

// ============================================================
// Brief (Claude)
// ============================================================

export interface DealBrief {
  headline: string;
  summary: string;
  whyItWorks: string[];
  upsideMoves: Array<{ move: string; why: string }>;
  watchOuts: Array<{ risk: string; howTopOperatorsHandleIt: string }>;
  closingNote: string;
}

const SYSTEM_PROMPT = `You write deal briefs for Coach Inayah's rental-arbitrage clients. A client leases a home from a landlord and runs it on Airbnb. Coach Inayah's team found this deal and is sending it to the client. Your job: help the client see clearly why this deal is worth taking, in plain English, so they feel confident signing.

How to write:
- Write like an experienced arbitrage operator talking to a newer one: warm, direct, specific. Short sentences. No jargon without a quick explanation.
- Lead with the strongest real reason the deal works. The single most persuasive comparison for arbitrage is break-even occupancy vs. how booked similar homes already are — use it when it favors the deal.
- The projected revenue is the OPTIMIZED scenario: what a well-run, well-furnished listing earns here. Call it that. When useful, contrast it with the data-model median ("big data models show a typical listing at $X — they're built conservative").
- If the slow-year profit is still positive, say so plainly — it's the best proof of safety. If it's negative, don't hide it; frame it as the reason to run the listing well.
- Point the client to the comparable listings as proof they can check themselves.

Hard rules:
- Use ONLY numbers given in <facts>. Never invent, round differently, or compute new dollar figures.
- No guarantees ("guaranteed", "risk-free", "can't lose"). No "you should" / "you must" — describe what top operators do instead.
- No legal, tax, or regulatory claims about this city.
- Output ONLY a JSON object, no markdown fences, matching this shape:
{
  "headline": "≤ 12 words, the deal's strongest point",
  "summary": "2-3 sentences: what this deal is and why it's attractive",
  "whyItWorks": ["exactly 3 bullets, each ≤ 20 words: one concrete reason tied to a number in <facts>"],
  "upsideMoves": [{"move": "a specific improvement", "why": "how it moves this listing toward the top earners"}],
  "watchOuts": [{"risk": "one real risk", "howTopOperatorsHandleIt": "how good operators handle it"}],
  "closingNote": "1 sentence, encouraging, about what winning this deal looks like"
}
whyItWorks sits directly under tiles that already show monthly profit, payback months and break-even occupancy — don't just restate those; each bullet should add a new reason (e.g. the slow-year floor, what the comps prove, the gap to the data-model median, demand for this bedroom count).
upsideMoves: 2-3 items, grounded in topEarnerAmenities when present, otherwise in what top-quarter listings for this bedroom count typically offer. watchOuts: 1-2 items.`;

const usd = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function formatFactsForPrompt(deal: { address: string; city?: string | null; state?: string | null }, f: DealFacts): string {
  const lines = [
    `Property: ${f.bedrooms} bed / ${f.bathrooms} bath, ${deal.address}${deal.city ? ` (${[deal.city, deal.state].filter(Boolean).join(', ')})` : ''}`,
    `Landlord rent: ${usd(f.monthlyRent)}/mo`,
    `Optimized scenario revenue: ${usd(f.monthlyRevenue)}/mo (nightly rate ${usd(f.adr)}, ${pct(f.projectedOccupancy)} booked)`,
    `Data-model median listing (unoptimized): ${usd(f.dataModelMonthlyRevenue)}/mo`,
    `Slow-year floor (bottom-quarter listing): ${usd(f.slowYearMonthlyRevenue)}/mo revenue → ${usd(f.slowYearMonthlyProfit)}/mo profit after rent and expenses`,
    `Operating expenses: ${pct(f.expenseRatio)} of revenue = ${usd(f.monthlyExpenses)}/mo (${f.expenseSource === 'bnbcalc_ai' ? 'AI estimate for this property' : 'standard estimate'}), not including rent`,
    `Profit after rent and expenses (optimized): ${usd(f.monthlyProfit)}/mo`,
    `Break-even occupancy: ${pct(f.breakEvenOccupancy)} booked covers rent + expenses`,
    f.marketMedianOccupancy != null
      ? `Typical comparable home is booked: ${pct(f.marketMedianOccupancy)}`
      : `Typical comparable occupancy: not available — don't claim how booked similar homes are`,
    `Startup cost (furniture, setup, deposit, first month): ${usd(f.startupCost)}`,
    f.paybackMonths != null
      ? `Payback on startup: ${f.paybackMonths.toFixed(1)} months; year-one cash-on-cash return ${pct(f.annualCashOnCash)}`
      : `Payback: not reached at the optimized scenario`,
  ];
  if (f.comps.length) {
    lines.push('Comparable Airbnb listings (real, unboosted numbers):');
    for (const c of f.comps) {
      lines.push(`- ${c.title}: ${usd(c.annualRevenue)}/yr, ${pct(c.occupancy)} booked, ${usd(c.adr)}/night${c.distanceMiles != null ? `, ${c.distanceMiles.toFixed(1)} mi away` : ''}`);
    }
  }
  if (f.topEarnerAmenities.length) {
    lines.push('topEarnerAmenities (share of top-earning comps vs. the rest):');
    for (const a of f.topEarnerAmenities) lines.push(`- ${a.amenity}: ${pct(a.topShare)} vs ${pct(a.restShare)}`);
  }
  return `<facts>\n${lines.join('\n')}\n</facts>`;
}

/** Pull the first JSON object out of a model reply (tolerates code fences / stray text). */
export function parseDealBrief(text: string): DealBrief | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1));
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const brief: DealBrief = {
      headline: str(raw.headline),
      summary: str(raw.summary),
      whyItWorks: Array.isArray(raw.whyItWorks) ? raw.whyItWorks.map(str).filter(Boolean) : [],
      upsideMoves: Array.isArray(raw.upsideMoves)
        ? raw.upsideMoves.map((m: any) => ({ move: str(m?.move), why: str(m?.why) })).filter((m: any) => m.move)
        : [],
      watchOuts: Array.isArray(raw.watchOuts)
        ? raw.watchOuts.map((w: any) => ({ risk: str(w?.risk), howTopOperatorsHandleIt: str(w?.howTopOperatorsHandleIt) })).filter((w: any) => w.risk)
        : [],
      closingNote: str(raw.closingNote),
    };
    return brief.headline && brief.whyItWorks.length ? brief : null;
  } catch {
    return null;
  }
}

/** Claude-written brief for a deal. Returns null (never throws) so reports still ship without it. */
export async function generateDealBrief(
  deal: { address: string; city?: string | null; state?: string | null },
  facts: DealFacts,
): Promise<DealBrief | null> {
  try {
    const reply = await routedLLMCall(
      FEATURES.DEAL_BRIEF,
      `${formatFactsForPrompt(deal, facts)}\n\nWrite the deal brief JSON for this client.`,
      { systemPrompt: SYSTEM_PROMPT, maxTokens: 4000 },
    );
    const brief = parseDealBrief(reply);
    if (!brief) console.warn(`[DealBrief] Could not parse brief for ${deal.address}: ${reply.slice(0, 200)}`);
    return brief;
  } catch (error) {
    console.error(`[DealBrief] Generation failed for ${deal.address}:`, error);
    return null;
  }
}

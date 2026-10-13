/**
 * Shareable property reports for scanned webinar deals.
 *
 * Leads are sent the tool's own public /share/<code> report — the universal
 * shareable "Property Analysis" (validator) page rendered by TeslaDashboard,
 * the same experience as the tool's Step 5 — never a login-gated page and
 * never a bare listing link. The report is built from the same rentalizer
 * estimate the deal scan already fetched, and carries the Zillow listing URL
 * so the page can show a "view the live listing" button. One report per
 * property, shared by every lead in that city.
 */

import { and, desc, eq } from "drizzle-orm";
import { universalShareableReports } from "../drizzle/schema";
import { getDb } from "./db";
import { getRentalizerEstimate, REVENUE_BOOST_FACTOR, type RentalizerResponse } from "./airdna";
import { getBnbCalcArbAnalysis } from "./bnbcalc";
import { buildDealFacts, generateDealBrief, projectionFromEstimate, type DealBrief, type DealFacts } from "./deal-brief";
import { createShareableReport } from "./shareable-reports";

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export interface DealForReport {
  address: string;
  city: string;
  state: string;
  zipCode?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | string | null;
  monthlyRent?: number | null;
  propertyType?: string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
}

/**
 * reportData in the exact AnalysisResult shape the /share validator viewer
 * (TeslaDashboard) renders, plus the underscore-prefixed metadata the viewer
 * reads alongside it (same convention as the tool's own share flow).
 */
export function buildDealReportData(
  deal: DealForReport,
  estimate: RentalizerResponse,
  enrichment?: { facts: DealFacts; brief: DealBrief | null } | null,
): Record<string, unknown> {
  const bedrooms = deal.bedrooms ?? estimate.property.bedrooms ?? 2;
  const bathrooms = Number(deal.bathrooms ?? estimate.property.bathrooms ?? Math.max(1, Math.ceil(bedrooms * 0.75)));
  const accommodates = estimate.property.accommodates || bedrooms * 2 + 2;
  const annual = estimate.estimates.annual_revenue;
  const monthlyRevenue = annual / 12;
  const monthlyRent = deal.monthlyRent ?? 0;
  // revenue − rent − opex; opex is BNB Calc's AI estimate when we have one, else 20%
  const expensePercent = enrichment ? Math.round(enrichment.facts.expenseRatio * 100) : 20;
  const monthlyProfit = monthlyRevenue - monthlyRent - monthlyRevenue * (expensePercent / 100);

  const forecastSource = estimate.stats?.future?.metrics?.length
    ? estimate.stats.future.metrics
    : estimate.monthly_forecast || [];

  return {
    revenue: {
      projected: Math.round(annual),
      low: Math.round(estimate.estimates.annual_revenue_low),
      high: Math.round(estimate.estimates.annual_revenue_high),
    },
    metrics: {
      adr: Math.round(estimate.estimates.average_daily_rate),
      occupancy: estimate.estimates.occupancy_rate,
    },
    cashFlow: {
      monthlyRevenue: Math.round(monthlyRevenue),
      monthlyRent,
      monthlyProfit: Math.round(monthlyProfit),
    },
    forecast: forecastSource.map((m: any) => ({
      month: m.date ?? m.month ?? "",
      revenue: Math.round(m.revenue ?? 0),
      adr: Math.round(m.adr ?? estimate.estimates.average_daily_rate),
      occupancy: m.occupancy ?? 0,
    })),
    comparables: (estimate.comps || []).slice(0, 12).map((c: any, i: number) => ({
      id: String(c.id ?? c.airbnb_listing_id ?? i),
      title: c.title ?? "Comparable rental",
      bedrooms: c.bedrooms ?? bedrooms,
      bathrooms: c.bathrooms ?? bathrooms,
      accommodates: c.accommodates ?? accommodates,
      // Comps show their real numbers (estimate comps carry the boost) so
      // clients can check them on Airbnb; the projection stays optimized
      revenue: Math.round((c.annual_revenue ?? 0) / REVENUE_BOOST_FACTOR),
      adr: Math.round((c.adr ?? 0) / REVENUE_BOOST_FACTOR),
      occupancy: c.occupancy ?? 0,
      rating: c.rating ?? 0,
      reviews: c.reviews ?? 0,
      imageUrl: c.image_url ?? undefined,
      airbnbUrl: c.airbnb_url ?? undefined,
      distanceMeters: c.distance_meters ?? undefined,
      latitude: c.latitude ?? undefined,
      longitude: c.longitude ?? undefined,
      amenities: c.amenities ?? undefined,
    })),
    // Viewer metadata (underscore convention used by the tool's share flow)
    _listingUrl: deal.sourceUrl || undefined,
    _imageUrl: deal.imageUrl || undefined,
    _expensePercent: expensePercent,
    _mode: "rent",
    // Startup budget → the dashboard's payback section
    ...(enrichment ? { _furnitureCost: enrichment.facts.startupCost } : {}),
    // Client deal brief ("why this deal works") — rendered above the dashboard
    ...(enrichment ? { _dealFacts: enrichment.facts, _dealBrief: enrichment.brief } : {}),
  };
}

// Report creation never waits longer than this on the arb call + brief
const ENRICHMENT_TIMEOUT_MS = 180_000;

/**
 * BNB Calc arbitrage analysis + Claude brief for a deal. Returns null when the
 * deal has no rent or the arb call fails/times out — the report still ships.
 */
async function enrichDeal(
  deal: DealForReport,
  estimate: RentalizerResponse,
): Promise<{ facts: DealFacts; brief: DealBrief | null } | null> {
  const monthlyRent = deal.monthlyRent ?? 0;
  if (monthlyRent <= 0) return null;
  const bedrooms = deal.bedrooms ?? estimate.property.bedrooms ?? 2;
  const bathrooms = Number(deal.bathrooms ?? estimate.property.bathrooms ?? Math.max(1, Math.ceil(bedrooms * 0.75)));

  const work = (async () => {
    const arb = await getBnbCalcArbAnalysis({
      address: deal.address,
      bedrooms,
      bathrooms,
      accommodates: estimate.property.accommodates || bedrooms * 2 + 2,
      monthlyRent,
    });
    const facts = buildDealFacts({ bedrooms, bathrooms, monthlyRent, projection: projectionFromEstimate(estimate), arb });
    // Only deals that make money get a sales brief
    const brief = facts.monthlyProfit > 0 ? await generateDealBrief(deal, facts) : null;
    return { facts, brief };
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[DealReport] Enrichment timed out for ${deal.address} — creating report without brief`);
      resolve(null);
    }, ENRICHMENT_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } catch (err: any) {
    console.warn(`[DealReport] Enrichment failed for ${deal.address}:`, err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Find-or-create the /share validator report for a deal's property, keyed by
 * address. Pass the estimate when the caller already has one (a fresh scan) —
 * otherwise one rentalizer call is spent fetching it. Returns the shareCode,
 * or null when no estimate is available.
 */
export async function ensureShareReportForDeal(
  db: DbClient,
  deal: DealForReport,
  estimate?: RentalizerResponse | null,
): Promise<{ shareCode: string; created: boolean } | null> {
  const [existing] = await db
    .select({ shareCode: universalShareableReports.shareCode })
    .from(universalShareableReports)
    .where(and(eq(universalShareableReports.address, deal.address), eq(universalShareableReports.reportType, "validator")))
    .orderBy(desc(universalShareableReports.createdAt))
    .limit(1);
  if (existing?.shareCode) return { shareCode: existing.shareCode, created: false };

  let est = estimate ?? null;
  if (!est) {
    const bedrooms = deal.bedrooms ?? 2;
    est = await getRentalizerEstimate({
      address: deal.address,
      bedrooms,
      bathrooms: Number(deal.bathrooms ?? Math.max(1, Math.ceil(bedrooms * 0.75))),
      accommodates: bedrooms * 2 + 2,
    });
  }
  if (!est) return null;

  const enrichment = await enrichDeal(deal, est);

  const result = await createShareableReport({
    reportType: "validator",
    address: deal.address,
    city: deal.city,
    state: deal.state,
    zipCode: deal.zipCode ?? undefined,
    bedrooms: deal.bedrooms ?? est.property.bedrooms,
    bathrooms: Number(deal.bathrooms ?? est.property.bathrooms ?? 1),
    monthlyRent: deal.monthlyRent ?? undefined,
    reportData: buildDealReportData(deal, est, enrichment),
    title: `Property Analysis — ${deal.city}, ${deal.state}`,
    summary: `Scanner-found rental in ${deal.city} analyzed for Airbnb potential`,
    annualRevenue: Math.round(est.estimates.annual_revenue),
    occupancyRate: est.estimates.occupancy_rate,
    averageDailyRate: Math.round(est.estimates.average_daily_rate),
    creatorName: "Coach Inayah",
  });
  if (!result.success || !result.shareCode) {
    console.warn(`[DealReport] Shareable report creation failed for ${deal.address}: ${result.error}`);
    return null;
  }
  console.log(`[DealReport] Created /share/${result.shareCode} (validator) for ${deal.address}`);
  return { shareCode: result.shareCode, created: true };
}

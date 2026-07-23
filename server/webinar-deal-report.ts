/**
 * Shareable property reports for scanned webinar deals.
 *
 * The tool's identity is the report — leads get sent the tool's own public
 * report page (/report/<shareId>, no login), not a raw listing link. The
 * report is built from the same rentalizer estimate the deal scan already
 * fetched, in the exact shape the public ChapterPropertyReport viewer renders,
 * and carries the Zillow listing URL inside it. One report per property,
 * shared by every lead in that city.
 */

import { and, desc, eq } from "drizzle-orm";
import { sharedReports } from "../drizzle/schema";
import { getDb } from "./db";
import { getRentalizerEstimate, type RentalizerResponse } from "./airdna";

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
}

/** reportData in the shape the public property-report viewer expects */
export function buildDealReportData(deal: DealForReport, estimate: RentalizerResponse): Record<string, unknown> {
  const bedrooms = deal.bedrooms ?? estimate.property.bedrooms ?? 2;
  const bathrooms = Number(deal.bathrooms ?? estimate.property.bathrooms ?? Math.max(1, Math.ceil(bedrooms * 0.75)));
  const accommodates = estimate.property.accommodates || bedrooms * 2 + 2;
  const occupancy = estimate.estimates.occupancy_rate;
  const occupancyFraction = occupancy > 1 ? occupancy / 100 : occupancy;
  const comps = (estimate.comps || []).slice(0, 20);
  const forecastSource = estimate.monthly_forecast?.length
    ? estimate.monthly_forecast
    : (estimate.stats?.future?.metrics || []).map((m) => ({ month: m.date, revenue: m.revenue, occupancy: m.occupancy }));

  return {
    property: {
      address: deal.address,
      city: deal.city,
      state: deal.state,
      zipCode: deal.zipCode || estimate.property.zipcode || "",
      bedrooms,
      bathrooms,
      accommodates,
      propertyType: deal.propertyType || undefined,
      monthlyRent: deal.monthlyRent || undefined,
      latitude: estimate.property.latitude,
      longitude: estimate.property.longitude,
      // Public listing link, rendered inside the report
      listingUrl: deal.sourceUrl || undefined,
    },
    revenue_estimate: {
      annual: Math.round(estimate.estimates.annual_revenue),
      monthly: Math.round(estimate.estimates.annual_revenue / 12),
      nightly: Math.round(estimate.estimates.average_daily_rate),
      occupancy,
      range: {
        low: Math.round(estimate.estimates.annual_revenue_low),
        high: Math.round(estimate.estimates.annual_revenue_high),
      },
    },
    monthly_forecast: (forecastSource || []).map((m: any) => ({
      month: m.month ?? m.date,
      revenue: Math.round(m.revenue ?? 0),
      occupancy: m.occupancy ?? 0,
    })),
    comps,
    same_bedroom_comps: comps.filter((c) => c.bedrooms === bedrooms),
    market_data: {
      name: `${deal.city}, ${deal.state}`,
      metrics: {
        occupancy,
        adr: Math.round(estimate.estimates.average_daily_rate),
        revenue: Math.round(estimate.estimates.annual_revenue),
        revpar: Math.round(estimate.estimates.average_daily_rate * occupancyFraction),
        active_listings: comps.length,
      },
      listing_count: comps.length,
    },
    bedroom_performance: [],
  };
}

/**
 * Find-or-create the shareable report for a deal's property, keyed by address.
 * Pass the estimate when the caller already has one (a fresh scan) — otherwise
 * one rentalizer call is spent fetching it. Returns the shareId, or null when
 * no estimate is available.
 */
export async function ensureShareReportForDeal(
  db: DbClient,
  deal: DealForReport,
  estimate?: RentalizerResponse | null,
): Promise<{ shareId: string; created: boolean } | null> {
  const [existing] = await db
    .select({ shareId: sharedReports.shareId })
    .from(sharedReports)
    .where(and(eq(sharedReports.address, deal.address), eq(sharedReports.reportType, "property")))
    .orderBy(desc(sharedReports.createdAt))
    .limit(1);
  if (existing?.shareId) return { shareId: existing.shareId, created: false };

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

  const shareId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  await db.insert(sharedReports).values({
    shareId,
    reportType: "property",
    address: deal.address,
    bedrooms: deal.bedrooms ?? est.property.bedrooms,
    bathrooms: String(deal.bathrooms ?? est.property.bathrooms ?? ""),
    accommodates: est.property.accommodates || undefined,
    latitude: est.property.latitude?.toString(),
    longitude: est.property.longitude?.toString(),
    reportData: JSON.stringify(buildDealReportData(deal, est)),
    createdByName: "Coach Inayah",
  });
  console.log(`[DealReport] Created shared property report ${shareId} for ${deal.address}`);
  return { shareId, created: true };
}

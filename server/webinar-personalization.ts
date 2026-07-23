/**
 * Webinar Registrant Personalization
 *
 * Enriches webinar registrants with market context so SMS/email reminders can
 * reference the lead's own city: a real local deal from the deal scanner,
 * cached market stats, and STR regulation status.
 *
 * Every lookup here reads tables this app already maintains (email_optins,
 * analysis_reports, newsletter_cities, newsletter_deals, regulation_cache) —
 * no external API calls, so enrichment never touches the AirDNA quota and is
 * safe to run inside the 3-minute import cron.
 *
 * The computed payload is stored under webinar_registrants.metadata.personalization
 * and rendered into messages via token substitution (%CITY%, %DEAL_RENT%, ...)
 * plus [IF_DEAL]...[/IF_DEAL] / [IF_CITY]...[/IF_CITY] conditional blocks.
 *
 * HONESTY RULE: any claim about a specific local property or number must live
 * inside a conditional block. Token fallbacks exist only so a stray token never
 * leaks raw into a message — copy must never rely on fallbacks to make claims.
 */

import { and, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import {
  analysisReports,
  emailOptins,
  newsletterCities,
  newsletterDeals,
  personalizedLinks,
  regulationCache,
  webinarRegistrants,
  webinarSmsSettings,
} from "../drizzle/schema";
import { getDb } from "./db";
import { getContactLocationByEmail } from "./hubspot";
import { searchZillowRentals } from "./hasdata-zillow";
import { analyzePropertyForArbitrage } from "./newsletter-deal-finder";
import { getRegulationInfo } from "./regulation-tracker";

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const PERSONALIZATION_VERSION = 2;

/**
 * Deal claims below this monthly profit stay out of messages. The class
 * promises $1K–$3K/mo per property — a hook under that floor undercuts the
 * pitch, so weaker deals render as generic copy instead.
 */
const MIN_CLAIMABLE_MONTHLY_PROFIT = 1000;
/** Deals older than this never back a message claim */
const DEAL_MAX_AGE_DAYS = 30;
/** Live-scan controls (webinar_sms_settings key; any value but "off" enables) */
const LIVE_SCAN_SETTING_KEY = "personalization_live_scan";
const MAX_LIVE_CITY_SCANS_PER_RUN = 2;
const MAX_LISTINGS_TO_ANALYZE = 5;
const CITY_SCAN_RETRY_HOURS = 24;
const DEAL_FRESHNESS_DAYS = 7;
/** Re-check leads that still have no deal after this long (bounds HubSpot lookups) */
const NO_DEAL_RECOMPUTE_HOURS = 24;

export interface RegistrantPersonalization {
  version: number;
  /**
   * Where the location came from. Webinar leads are an unaware audience — they
   * haven't touched the tool — so HubSpot (opt-in / soft-pull address) leads,
   * and a tool run is only a bonus signal when it happens to exist.
   */
  source: "hubspot" | "email_optin" | "analysis_report";
  city: string;
  state: string;
  marketName?: string;
  /** Cached market stats from newsletter_cities (refreshed by the newsletter sync) */
  marketAdr?: number;
  marketRevenue?: number; // annual
  /** STR regulation status for their city, if we have a fresh cache entry */
  regStatus?: string;
  regLine?: string;
  /** Top active scanned deal in their city (all figures monthly) */
  deal?: {
    label: string;
    bedrooms?: number;
    monthlyRent?: number;
    monthlyRevenue?: number;
    monthlyProfit?: number;
    sourceUrl?: string;
  };
  dealCount: number;
  /** Their own property analysis, when they ran one through the tool */
  ownReport?: {
    monthlyRevenue?: number;
    adr?: number;
    verdict?: string;
  };
  /** Tracked link into the tool, pre-targeted to their city */
  toolLink: string;
  computedAt: string;
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// State abbreviation ↔ full name, used only to widen the regulation-cache key
// search (opt-ins tend to store "CA" while regulation searches store "California").
const STATE_FULL: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

// Same normalization as regulation-tracker's normalizeLocationKey (kept private there)
function regulationKey(city: string, state: string): string {
  return `${city.toLowerCase().trim()}_${state.toLowerCase().trim()}`.replace(/[^a-z0-9_]/g, "");
}

function candidateRegulationKeys(city: string, state: string): string[] {
  const keys = [regulationKey(city, state)];
  const upper = state.trim().toUpperCase();
  if (STATE_FULL[upper]) keys.push(regulationKey(city, STATE_FULL[upper]));
  const abbr = Object.entries(STATE_FULL).find(([, full]) => full.toLowerCase() === state.trim().toLowerCase())?.[0];
  if (abbr) keys.push(regulationKey(city, abbr));
  return Array.from(new Set(keys));
}

// ─── Core computation ────────────────────────────────────────────────────────

/**
 * Compute the personalization payload for one lead, identified by email.
 * Returns null when we have no location signal for them — messages then render
 * with generic copy (conditional blocks stripped).
 */
export async function computePersonalizationForEmail(
  db: DbClient,
  email: string,
): Promise<RegistrantPersonalization | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  // 1) Location. This is an unaware audience: they opted into a webinar and
  //    have never used the tool. Their address comes from the opt-in /
  //    soft-pull data synced to HubSpot (Data Perfection fields), then local
  //    opt-in rows, and only last from a tool run of their own.
  let city = "";
  let state = "";
  let source: RegistrantPersonalization["source"] = "hubspot";

  const hubspotContact = await getContactLocationByEmail(normalizedEmail).catch(() => null);
  if (hubspotContact?.city && hubspotContact.state) {
    city = hubspotContact.city;
    state = hubspotContact.state;
  } else {
    const [optin] = await db
      .select({ city: emailOptins.city, state: emailOptins.state })
      .from(emailOptins)
      .where(and(eq(emailOptins.email, normalizedEmail), sql`${emailOptins.city} IS NOT NULL AND ${emailOptins.city} != ''`))
      .orderBy(desc(emailOptins.createdAt))
      .limit(1);
    if (optin?.city && optin.state) {
      city = optin.city;
      state = optin.state;
      source = "email_optin";
    }
  }

  // Their own tool run: bonus signal, and location of last resort
  const [report] = await db
    .select({
      city: analysisReports.city,
      state: analysisReports.state,
      annualRevenueRealistic: analysisReports.annualRevenueRealistic,
      averageDailyRate: analysisReports.averageDailyRate,
      verdict: analysisReports.verdict,
    })
    .from(analysisReports)
    .where(and(eq(analysisReports.leadEmail, normalizedEmail), sql`${analysisReports.city} IS NOT NULL AND ${analysisReports.city} != ''`))
    .orderBy(desc(analysisReports.createdAt))
    .limit(1);

  let ownReport: RegistrantPersonalization["ownReport"];
  if (report?.city && report.state) {
    ownReport = {
      monthlyRevenue: report.annualRevenueRealistic ? Math.round(report.annualRevenueRealistic / 12) : undefined,
      adr: report.averageDailyRate ?? undefined,
      verdict: report.verdict ?? undefined,
    };
    if (!city) {
      city = report.city;
      state = report.state!;
      source = "analysis_report";
    }
  }

  if (!city || !state) return null;
  city = titleCase(city.trim());
  state = state.trim();

  // 2) Market stats from the newsletter city sync, when this city is tracked
  const [cityRow] = await db
    .select()
    .from(newsletterCities)
    .where(and(eq(newsletterCities.city, city), eq(newsletterCities.state, state)))
    .limit(1);

  // 3) Top active scanned deal for their city (figures stored annually; convert).
  //    Match by city/state, not cityId — some writers (hasdata-zillow cacheDeal)
  //    store cityId 0. Deals older than DEAL_MAX_AGE_DAYS never back a claim.
  const dealCutoff = new Date(Date.now() - DEAL_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const deals = await db
    .select()
    .from(newsletterDeals)
    .where(and(
      eq(newsletterDeals.city, city),
      eq(newsletterDeals.state, state),
      eq(newsletterDeals.status, "active"),
      gte(newsletterDeals.discoveredAt, dealCutoff),
    ))
    .orderBy(desc(newsletterDeals.dealScore))
    .limit(3);

  // Best CLAIMABLE deal wins the message slot: highest-scored deal that clears
  // the profit floor (or has revenue with no profit figure). A top-scored deal
  // that fails the floor must not shadow a claimable runner-up.
  const claimable = (d: (typeof deals)[number]) =>
    d.monthlyRent != null &&
    (d.projectedRevenue != null || d.projectedProfit != null) &&
    (d.projectedProfit == null || Math.round(d.projectedProfit / 12) >= MIN_CLAIMABLE_MONTHLY_PROFIT);
  const topDeal = deals.find(claimable) ?? deals[0];
  const deal = topDeal
    ? {
        label: topDeal.bedrooms ? `a ${topDeal.bedrooms}-bedroom in ${topDeal.city}` : `a unit in ${topDeal.city}`,
        bedrooms: topDeal.bedrooms ?? undefined,
        monthlyRent: topDeal.monthlyRent ?? undefined,
        monthlyRevenue: topDeal.projectedRevenue ? Math.round(topDeal.projectedRevenue / 12) : undefined,
        monthlyProfit: topDeal.projectedProfit ? Math.round(topDeal.projectedProfit / 12) : undefined,
        sourceUrl: topDeal.sourceUrl ?? undefined,
      }
    : undefined;

  // 4) Regulation status from cache. "unknown" rows are failed research
  //    (production has such rows, e.g. Miami) — never message their boilerplate.
  let regStatus: string | undefined;
  let regLine: string | undefined;
  const regKeys = candidateRegulationKeys(city, state);
  const [reg] = await db
    .select({ status: regulationCache.status, yesNoSummary: regulationCache.yesNoSummary })
    .from(regulationCache)
    .where(and(inArray(regulationCache.locationKey, regKeys), gt(regulationCache.expiresAt, new Date())))
    .limit(1);
  if (reg && reg.status !== "unknown") {
    regStatus = reg.status;
    regLine = reg.yesNoSummary ?? undefined;
  }

  // 5) Tracked tool link targeted at their city (reuse one per email+campaign)
  const baseUrl = process.env.VITE_APP_URL || "https://coachinayahturnkeytool.com";
  const params = new URLSearchParams();
  params.set("tab", "listings");
  params.set("city", city);
  params.set("state", state);
  params.set("autoAnalyze", "true");
  params.set("utm_source", "webinar_reminder");
  params.set("utm_campaign", "webinar_personalization");
  const linkUrl = `${baseUrl}/?${params.toString()}`;

  let toolLink = linkUrl;
  try {
    const [existing] = await db
      .select({ linkUrl: personalizedLinks.linkUrl })
      .from(personalizedLinks)
      .where(and(eq(personalizedLinks.email, normalizedEmail), eq(personalizedLinks.campaignType, "webinar_deals")))
      .limit(1);
    if (existing) {
      toolLink = existing.linkUrl;
    } else {
      await db.insert(personalizedLinks).values({
        email: normalizedEmail,
        linkUrl,
        shortCode: Math.random().toString(36).substring(2, 10),
        targetCity: city,
        targetState: state,
        targetTab: "listings",
        campaignName: "Webinar Personalization",
        campaignType: "webinar_deals",
      });
    }
  } catch (err: any) {
    console.error(`[Personalization] personalized_links write failed for ${normalizedEmail}:`, err.message);
  }

  return {
    version: PERSONALIZATION_VERSION,
    source,
    city,
    state,
    marketName: cityRow?.airdnaMarketName ?? undefined,
    marketAdr: cityRow?.cachedAdr ?? undefined,
    marketRevenue: cityRow?.cachedRevenue ?? undefined,
    regStatus,
    regLine,
    deal,
    dealCount: deals.length,
    ownReport,
    toolLink,
    computedAt: new Date().toISOString(),
  };
}

// ─── Live city data generation ("step 4" automated per lead city) ────────────

async function isLiveScanEnabled(db: DbClient): Promise<boolean> {
  try {
    const [row] = await db
      .select({ settingValue: webinarSmsSettings.settingValue })
      .from(webinarSmsSettings)
      .where(eq(webinarSmsSettings.settingKey, LIVE_SCAN_SETTING_KEY))
      .limit(1);
    return row?.settingValue !== "off";
  } catch {
    return true;
  }
}

/**
 * Make sure a lead's city has data to message with, generating it the same way
 * the tool's Step 4 / validate flow does: Zillow rentals via HasData, revenue
 * projections via the rentalizer (BNB Calc), regulation research via the
 * regulation tracker. Results persist in newsletter_deals / newsletter_cities /
 * regulation_cache, so each city is scanned once and shared by every lead there.
 *
 * Costs per dry city: 1 HasData listing call (5 credits), up to
 * MAX_LISTINGS_TO_ANALYZE rentalizer calls, and at most one regulation research
 * per 7 days (the tracker caches internally, including failures).
 */
export async function ensureCityData(
  db: DbClient,
  city: string,
  state: string,
): Promise<{ newDeals: number; scanned: boolean }> {
  let newDeals = 0;
  let scanned = false;

  // Regulation: cached-or-research, self-caching, independent of the deal scan
  try {
    await getRegulationInfo(city, state);
  } catch (err: any) {
    console.warn(`[Personalization] Regulation lookup failed for ${city}, ${state}:`, err.message);
  }

  // City row (also claims the scan slot via lastDealScan)
  let [cityRow] = await db
    .select()
    .from(newsletterCities)
    .where(and(eq(newsletterCities.city, city), eq(newsletterCities.state, state)))
    .limit(1);
  if (!cityRow) {
    await db.insert(newsletterCities).values({ city, state, contactCount: 0 }).catch(() => {});
    [cityRow] = await db
      .select()
      .from(newsletterCities)
      .where(and(eq(newsletterCities.city, city), eq(newsletterCities.state, state)))
      .limit(1);
    if (!cityRow) return { newDeals, scanned };
  }

  // Fresh deals already on file → nothing to generate
  const freshCutoff = new Date(Date.now() - DEAL_FRESHNESS_DAYS * 24 * 60 * 60 * 1000);
  const [freshDeal] = await db
    .select({ id: newsletterDeals.id })
    .from(newsletterDeals)
    .where(and(
      eq(newsletterDeals.city, city),
      eq(newsletterDeals.state, state),
      eq(newsletterDeals.status, "active"),
      gte(newsletterDeals.discoveredAt, freshCutoff),
    ))
    .limit(1);
  if (freshDeal) return { newDeals, scanned };

  // A recent dry scan means this city genuinely has nothing right now — wait
  const retryCutoff = new Date(Date.now() - CITY_SCAN_RETRY_HOURS * 60 * 60 * 1000);
  if (cityRow.lastDealScan && cityRow.lastDealScan > retryCutoff) return { newDeals, scanned };

  // Claim before scanning so concurrent cron cycles don't double-spend credits
  await db
    .update(newsletterCities)
    .set({ lastDealScan: new Date() })
    .where(eq(newsletterCities.id, cityRow.id));

  scanned = true;
  console.log(`[Personalization] Live scan for ${city}, ${state} (webinar lead city with no deals)`);

  const search = await searchZillowRentals({ city, state, minBeds: 1, maxBeds: 4 });
  if (!search.success || search.listings.length === 0) {
    console.log(`[Personalization] No rental listings found for ${city}, ${state}`);
    return { newDeals, scanned };
  }

  // Rank candidates by likelihood of clearing the $1K/mo profit floor before
  // spending rentalizer calls: 2–3BR at moderate rent has the widest
  // revenue-over-rent spread (the same profile the class demos live).
  const listingPriority = (l: (typeof search.listings)[number]) =>
    (l.bedrooms >= 2 && l.bedrooms <= 3 ? 0 : 10) + (l.price >= 1000 && l.price <= 2800 ? 0 : 1);
  const candidates = search.listings
    .filter((l) => l.price >= 500 && l.price <= 6000 && l.bedrooms > 0)
    .sort((a, b) => listingPriority(a) - listingPriority(b))
    .slice(0, MAX_LISTINGS_TO_ANALYZE);

  let claimableFound = false;
  for (const listing of candidates) {
    // Stop once a claimable hook exists — later cycles can deepen the pool
    if (claimableFound && newDeals >= 2) break;
    try {
      const deal = await analyzePropertyForArbitrage({
        address: listing.address,
        city,
        state,
        zipCode: listing.zipcode || undefined,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms || Math.max(1, Math.ceil(listing.bedrooms * 0.75)),
        monthlyRent: listing.price,
        propertyType: listing.homeType || undefined,
        sourceUrl: listing.detailUrl,
        sourcePlatform: "zillow",
        imageUrl: listing.imgSrc || undefined,
      });
      if (!deal) continue;

      await db.insert(newsletterDeals).values({
        cityId: cityRow.id,
        city,
        state,
        zipCode: deal.zipCode || undefined,
        address: deal.address,
        bedrooms: deal.bedrooms,
        bathrooms: String(deal.bathrooms),
        monthlyRent: deal.monthlyRent,
        propertyType: deal.propertyType,
        sourceUrl: deal.sourceUrl || undefined,
        sourcePlatform: "zillow",
        imageUrl: deal.imageUrl || undefined,
        projectedRevenue: Math.round(deal.projectedAnnualRevenue),
        projectedAdr: Math.round(deal.projectedAdr),
        projectedOccupancy: deal.projectedOccupancy.toFixed(2),
        projectedProfit: Math.round(deal.annualProfit),
        profitMargin: (deal.profitMargin * 100).toFixed(2),
        dealScore: deal.dealScore,
        status: "active",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });
      newDeals++;
      if (deal.monthlyProfit >= MIN_CLAIMABLE_MONTHLY_PROFIT) claimableFound = true;
    } catch (err: any) {
      console.warn(`[Personalization] Deal analysis failed for ${listing.address}:`, err.message);
    }
  }

  console.log(`[Personalization] Scan of ${city}, ${state}: ${newDeals} deal(s) from ${candidates.length} listing(s)`);
  return { newDeals, scanned };
}

// ─── Registrant enrichment (called from the import cron) ─────────────────────

/**
 * Enrich registrants of a webinar that don't yet carry a personalization
 * payload. Bounded per run; the 3-minute import cron drains any backlog.
 */
export async function enrichWebinarRegistrants(
  db: DbClient,
  webinarId: string,
  opts: { limit?: number; registrantIds?: number[] } = {},
): Promise<{ scanned: number; enriched: number; noLocation: number }> {
  const limit = opts.limit ?? 300;

  const conditions: any[] = [sql`${webinarRegistrants.email} IS NOT NULL AND ${webinarRegistrants.email} != ''`];
  if (opts.registrantIds?.length) {
    conditions.push(inArray(webinarRegistrants.id, opts.registrantIds));
  } else {
    conditions.push(eq(webinarRegistrants.webinarId, webinarId));
  }

  const rows = await db
    .select({
      id: webinarRegistrants.id,
      email: webinarRegistrants.email,
      metadata: webinarRegistrants.metadata,
    })
    .from(webinarRegistrants)
    .where(and(...conditions));

  const recomputeCutoff = Date.now() - NO_DEAL_RECOMPUTE_HOURS * 60 * 60 * 1000;
  const pending = rows
    .filter((r) => {
      const p = (r.metadata as any)?.personalization;
      if (!p || p.version !== PERSONALIZATION_VERSION) return true;
      // Leads still missing a deal get periodically re-checked so a later city
      // scan (or fresh HubSpot data) upgrades them without manual intervention
      const stale = !p.computedAt || new Date(p.computedAt).getTime() < recomputeCutoff;
      return p.dealCount === 0 && stale;
    })
    .slice(0, limit);

  let enriched = 0;
  let noLocation = 0;
  const byEmail = new Map<string, RegistrantPersonalization | null>();

  for (const row of pending) {
    const email = row.email!.trim().toLowerCase();
    try {
      if (!byEmail.has(email)) {
        byEmail.set(email, await computePersonalizationForEmail(db, email));
      }
      const personalization = byEmail.get(email);
      if (!personalization) {
        noLocation++;
        continue;
      }
      await db
        .update(webinarRegistrants)
        .set({ metadata: { ...((row.metadata as Record<string, unknown>) ?? {}), personalization } })
        .where(eq(webinarRegistrants.id, row.id));
      enriched++;
    } catch (err: any) {
      console.error(`[Personalization] Failed to enrich registrant #${row.id}:`, err.message);
    }
  }

  if (pending.length > 0) {
    console.log(`[Personalization] webinar ${webinarId}: ${enriched} enriched, ${noLocation} without location, ${pending.length} scanned`);
  }
  return { scanned: pending.length, enriched, noLocation };
}

/**
 * Phase 2, run detached from the import cron: generate data for lead cities
 * that came up empty. The audience is unaware — nobody is going to run the
 * tool themselves, so the system runs it for them. Slow work (HasData +
 * rentalizer + regulation research) lives here so confirmation sends are never
 * blocked. Bounded per call; the 3-minute cron drains the backlog.
 */
export async function runLiveCityScansForWebinar(
  db: DbClient,
  webinarId: string,
  opts: { maxCities?: number } = {},
): Promise<{ citiesScanned: number; leadsUpgraded: number }> {
  const maxCities = opts.maxCities ?? MAX_LIVE_CITY_SCANS_PER_RUN;
  let citiesScanned = 0;
  let leadsUpgraded = 0;

  if (!(await isLiveScanEnabled(db))) return { citiesScanned, leadsUpgraded };

  const rows = await db
    .select({
      id: webinarRegistrants.id,
      email: webinarRegistrants.email,
      metadata: webinarRegistrants.metadata,
    })
    .from(webinarRegistrants)
    .where(and(
      eq(webinarRegistrants.webinarId, webinarId),
      sql`${webinarRegistrants.email} IS NOT NULL AND ${webinarRegistrants.email} != ''`,
    ));

  const dryCities = new Map<string, { city: string; state: string; emails: Set<string>; rows: typeof rows }>();
  for (const row of rows) {
    const p = personalizationFromMetadata(row.metadata);
    if (!p) continue;
    if (p.dealCount > 0 && p.regStatus) continue;
    const key = `${p.city}|${p.state}`;
    if (!dryCities.has(key)) dryCities.set(key, { city: p.city, state: p.state, emails: new Set(), rows: [] });
    dryCities.get(key)!.emails.add(row.email!.trim().toLowerCase());
    dryCities.get(key)!.rows.push(row);
  }

  for (const { city, state, emails, rows: cityRows } of Array.from(dryCities.values())) {
    if (citiesScanned >= maxCities) break;
    try {
      const { newDeals, scanned } = await ensureCityData(db, city, state);
      if (scanned) citiesScanned++;
      if (newDeals === 0 && !scanned) continue;
      // Upgrade every lead in that city with the fresh data
      const upgradedByEmail = new Map<string, RegistrantPersonalization | null>();
      for (const email of Array.from(emails)) {
        upgradedByEmail.set(email, await computePersonalizationForEmail(db, email));
      }
      for (const row of cityRows) {
        const upgraded = upgradedByEmail.get(row.email!.trim().toLowerCase());
        if (!upgraded) continue;
        await db
          .update(webinarRegistrants)
          .set({ metadata: { ...((row.metadata as Record<string, unknown>) ?? {}), personalization: upgraded } })
          .where(eq(webinarRegistrants.id, row.id));
        leadsUpgraded++;
      }
    } catch (err: any) {
      console.error(`[Personalization] Live scan failed for ${city}, ${state}:`, err.message);
    }
  }

  if (citiesScanned > 0 || leadsUpgraded > 0) {
    console.log(`[Personalization] webinar ${webinarId}: ${citiesScanned} live city scan(s), ${leadsUpgraded} lead(s) upgraded`);
  }
  return { citiesScanned, leadsUpgraded };
}

// ─── Message token rendering ─────────────────────────────────────────────────

/**
 * Fallbacks keep a stray token from leaking raw into a message. They are
 * deliberately generic ("your city", the class-wide $1K–$3K target) — never a
 * fabricated local figure. Local claims belong inside [IF_DEAL]/[IF_CITY].
 */
const TOKEN_FALLBACKS: Record<string, string> = {
  city: "your city",
  state: "",
  market: "your market",
  deal_rent: "about $2,000",
  deal_revenue: "$4K–$6K",
  deal_profit: "$1K–$3K",
  deal_link: "https://coachinayahturnkeytool.com",
  tool_link: "https://coachinayahturnkeytool.com",
  reg_line: "",
};

/**
 * Token map for SMS/email body substitution. Always returns every key so
 * templates render cleanly whether or not the lead has personalization data.
 * Also sets has_city / has_deal flags consumed by conditional blocks.
 */
export function buildPersonalizationVars(p: RegistrantPersonalization | null | undefined): Record<string, string> {
  const vars: Record<string, string> = { ...TOKEN_FALLBACKS, has_city: "0", has_deal: "0", has_city_only: "0" };
  if (!p) return vars;

  vars.has_city = "1";
  vars.city = p.city;
  vars.state = p.state;
  vars.market = p.marketName || p.city;
  vars.tool_link = p.toolLink;
  vars.deal_link = p.toolLink;
  if (p.regLine) vars.reg_line = p.regLine;

  const rent = fmtMoney(p.deal?.monthlyRent);
  const revenue = fmtMoney(p.deal?.monthlyRevenue);
  const profit = fmtMoney(p.deal?.monthlyProfit);
  // A deal is only claimable when we can state real numbers for it, and a weak
  // profit figure makes a worse hook than no deal line at all
  const profitStrongEnough = p.deal?.monthlyProfit == null || p.deal.monthlyProfit >= MIN_CLAIMABLE_MONTHLY_PROFIT;
  if (p.deal && rent && (revenue || profit) && profitStrongEnough) {
    vars.has_deal = "1";
    vars.deal_rent = rent;
    if (revenue) vars.deal_revenue = revenue;
    if (profit) vars.deal_profit = profit;
  }
  // "City but no deal" — lets templates offer an either/or without an else-syntax
  vars.has_city_only = vars.has_city === "1" && vars.has_deal === "0" ? "1" : "0";
  return vars;
}

/**
 * Strip or keep [IF_DEAL]...[/IF_DEAL] and [IF_CITY]...[/IF_CITY] blocks based
 * on the has_deal / has_city flags. Runs before token substitution.
 */
export function applyConditionalBlocks(template: string, vars: Record<string, string>): string {
  if (!template.includes("[IF_")) return template;
  let result = template;
  for (const key of ["DEAL", "CITY_ONLY", "CITY"] as const) {
    const keep = vars[`has_${key.toLowerCase()}`] === "1";
    const re = new RegExp(`\\[IF_${key}\\]([\\s\\S]*?)\\[\\/IF_${key}\\]`, "g");
    result = result.replace(re, (_m, inner: string) => (keep ? inner : ""));
  }
  // Collapse doubled spaces left behind by stripped blocks (keep newlines)
  return result.replace(/[^\S\n]{2,}/g, " ").replace(/ +\n/g, "\n").trim();
}

/** Personalization payload from a registrant metadata JSON blob, if present */
export function personalizationFromMetadata(metadata: unknown): RegistrantPersonalization | null {
  const p = (metadata as any)?.personalization;
  if (p && typeof p === "object" && typeof p.city === "string" && p.city) return p as RegistrantPersonalization;
  return null;
}

// ─── Email rendering payload ─────────────────────────────────────────────────

/** Pre-formatted strings for the email templates' property module */
export interface EmailPersonalization {
  city: string;
  dealLabel?: string;
  dealRent?: string;
  dealRevenue?: string;
  dealProfit?: string;
  regLine?: string;
  toolLink: string;
  ownReportLine?: string;
}

/**
 * Format a personalization payload for the HTML email templates. Deal fields
 * are only present when real numbers exist — the templates render the property
 * module conditionally, so no fabricated local claims are possible.
 */
export function buildEmailPersonalization(
  p: RegistrantPersonalization | null | undefined,
): EmailPersonalization | undefined {
  if (!p) return undefined;
  const rent = fmtMoney(p.deal?.monthlyRent);
  const revenue = fmtMoney(p.deal?.monthlyRevenue);
  const profit = fmtMoney(p.deal?.monthlyProfit);
  const profitStrongEnough = p.deal?.monthlyProfit == null || p.deal.monthlyProfit >= MIN_CLAIMABLE_MONTHLY_PROFIT;
  const hasDeal = Boolean(p.deal && rent && (revenue || profit) && profitStrongEnough);
  const ownRev = fmtMoney(p.ownReport?.monthlyRevenue);
  return {
    city: p.city,
    dealLabel: hasDeal ? p.deal!.label : undefined,
    dealRent: hasDeal ? rent! : undefined,
    dealRevenue: hasDeal && revenue ? revenue : undefined,
    dealProfit: hasDeal && profit ? profit : undefined,
    regLine: p.regLine,
    toolLink: p.toolLink,
    ownReportLine: ownRev ? `When you ran your own numbers in my tool, your ${p.city} report projected ${ownRev}/mo.` : undefined,
  };
}

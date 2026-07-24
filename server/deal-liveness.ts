/**
 * Listing liveness: never quote a lead a rental that's already gone.
 *
 * Rental listings in hot markets die in days — well inside the deal pool's
 * freshness windows. Before a deal backs a message, its Zillow listing is
 * re-checked (HasData property lookup, 5 credits) with a 12h in-memory cache
 * and a per-cycle budget. A dead listing retires the deal row AND refreshes
 * every registrant payload still quoting it, so scheduled sends stop citing
 * it too. API trouble is never treated as "dead" — retiring is reserved for
 * a definitive off-market verdict.
 */

import { eq, sql } from "drizzle-orm";
import { newsletterDeals, webinarRegistrants } from "../drizzle/schema";
import { getDb } from "./db";
import { getZillowPropertyDetails } from "./hasdata-zillow";
import { computePersonalizationForEmail } from "./webinar-personalization";

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const VERIFY_OK_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_PAYLOAD_REFRESH_ROWS = 100;

/** Listings confirmed live recently — bounds credit spend across cycles */
const verifiedOkAt = new Map<string, number>();

export type ListingVerdict = "live" | "dead" | "unknown";

export async function verifyDealListing(
  db: DbClient,
  deal: { sourceUrl?: string | null; address?: string | null },
): Promise<ListingVerdict> {
  const url = deal.sourceUrl;
  if (!url) return "unknown";
  const okAt = verifiedOkAt.get(url);
  if (okAt && Date.now() - okAt < VERIFY_OK_TTL_MS) return "live";

  let res: Awaited<ReturnType<typeof getZillowPropertyDetails>>;
  try {
    res = await getZillowPropertyDetails(url);
  } catch {
    return "unknown";
  }
  if (!res.success || !res.data) return "unknown";

  if (res.data.priceType === "rent") {
    verifiedOkAt.set(url, Date.now());
    return "live";
  }

  console.log(
    `[DealLiveness] Listing off-market (${res.data.homeStatus || res.data.priceType || "no status"}) — retiring ${deal.address || url}`,
  );
  await db
    .update(newsletterDeals)
    .set({ status: "removed" })
    .where(eq(newsletterDeals.sourceUrl, url))
    .catch(() => {});
  await refreshPayloadsQuotingDeal(db, url).catch((err: any) =>
    console.warn(`[DealLiveness] Payload refresh failed for ${url}:`, err.message));
  return "dead";
}

/**
 * Recompute every registrant payload still quoting a retired listing so the
 * runner-up deal (or clean generic copy) takes over everywhere — scheduled
 * sends and short links included.
 */
export async function refreshPayloadsQuotingDeal(db: DbClient, sourceUrl: string): Promise<number> {
  const rows = await db
    .select({ id: webinarRegistrants.id, email: webinarRegistrants.email, metadata: webinarRegistrants.metadata })
    .from(webinarRegistrants)
    .where(sql`JSON_UNQUOTE(JSON_EXTRACT(${webinarRegistrants.metadata}, '$.personalization.dealZillowUrl')) = ${sourceUrl}`)
    .limit(MAX_PAYLOAD_REFRESH_ROWS);

  const byEmail = new Map<string, Awaited<ReturnType<typeof computePersonalizationForEmail>>>();
  let refreshed = 0;
  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email) continue;
    if (!byEmail.has(email)) {
      byEmail.set(email, await computePersonalizationForEmail(db, email).catch(() => null));
    }
    const fresh = byEmail.get(email);
    if (!fresh) continue;
    await db
      .update(webinarRegistrants)
      .set({ metadata: { ...((row.metadata as Record<string, unknown>) ?? {}), personalization: fresh } })
      .where(eq(webinarRegistrants.id, row.id));
    refreshed++;
  }
  if (refreshed > 0) console.log(`[DealLiveness] Refreshed ${refreshed} payload(s) off retired listing ${sourceUrl}`);
  return refreshed;
}

/**
 * Proactive sweep for the import cron: verify the listings currently being
 * quoted to this webinar's registrants (distinct URLs, budgeted per cycle).
 * Keeps the pool clean BEFORE scheduled sends go out, not just when a lead
 * replies.
 */
export async function sweepQuotedDealListings(db: DbClient, webinarId: string, maxChecks = 2): Promise<{ checked: number; retired: number }> {
  let checked = 0;
  let retired = 0;
  const rows = await db
    .select({ metadata: webinarRegistrants.metadata })
    .from(webinarRegistrants)
    .where(sql`${webinarRegistrants.webinarId} = ${webinarId} AND JSON_EXTRACT(${webinarRegistrants.metadata}, '$.personalization.dealZillowUrl') IS NOT NULL`);

  const urls = new Map<string, string>(); // url → address-ish label
  for (const row of rows) {
    const p = (row.metadata as any)?.personalization;
    if (p?.dealZillowUrl && !urls.has(p.dealZillowUrl)) {
      urls.set(p.dealZillowUrl, p.deal?.label || p.city || p.dealZillowUrl);
    }
  }

  for (const [url, label] of Array.from(urls.entries())) {
    if (checked >= maxChecks) break;
    const okAt = verifiedOkAt.get(url);
    if (okAt && Date.now() - okAt < VERIFY_OK_TTL_MS) continue; // fresh, free
    checked++;
    const verdict = await verifyDealListing(db, { sourceUrl: url, address: label });
    if (verdict === "dead") retired++;
  }
  if (checked > 0) console.log(`[DealLiveness] Sweep (webinar ${webinarId}): ${checked} listing(s) checked, ${retired} retired`);
  return { checked, retired };
}

/** Test hook — the OK-cache is module state */
export function _resetLivenessCacheForTests(): void {
  verifiedOkAt.clear();
}

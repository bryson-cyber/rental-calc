/**
 * Promo Drip — "upcoming webinar" exclusion, straight from WebinarJam data.
 *
 * Rule (Bryson): anyone registered for a masterclass whose date hasn't
 * happened yet must NOT receive promo messages — they haven't seen the main
 * offering. The webinar_registrants.webinarDate column is never populated by
 * the import, so the source of truth is the WebinarJam API: a webinar is
 * "upcoming" when any of its schedules starts later than (now − 3h buffer),
 * i.e. registrants stay excluded until ~3h after their webinar starts.
 *
 * Fail-safe: if ANY webinar's schedule can't be fetched, we report ok:false
 * and callers DEFER sending rather than guessing — a delayed promo is
 * recoverable; promoting to someone before their masterclass is not.
 */

import { eq, inArray } from "drizzle-orm";
import { webinarCredentials, webinarRegistrants } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { parseWebinarJamScheduleToUtc } from "./promo-time";
import { normalizeEmail, normalizePromoPhone } from "./promo-util";

const WEBINAR_DURATION_BUFFER_MS = 3 * 60 * 60 * 1000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const WEBINARJAM_TIMEOUT_MS = 15_000;

export type UpcomingWebinarsResult =
  | { ok: true; upcomingWebinarIds: string[]; checkedWebinars: number }
  | { ok: false; error: string };

export type PromoExclusionSets =
  | {
      ok: true;
      upcomingWebinarIds: string[];
      /** Lowercased emails of registrants with an upcoming webinar */
      upcomingEmails: Set<string>;
      /** Normalized phones of registrants with an upcoming webinar */
      upcomingPhones: Set<string>;
      /** Normalized phones that texted STOP to the webinar system (any webinar) */
      optedOutPhones: Set<string>;
    }
  | { ok: false; error: string };

let upcomingCache: { at: number; result: UpcomingWebinarsResult } | null = null;

/** Test hook — clears the module cache. */
export function clearPromoWebinarCache(): void {
  upcomingCache = null;
}

async function fetchWebinarDetails(webinarId: string, overrideApiKey?: string): Promise<any | null> {
  const apiKey = overrideApiKey || ENV.webinarjamApiKey;
  if (!apiKey) return null;
  try {
    const body = new URLSearchParams({ api_key: apiKey, webinar_id: webinarId });
    const res = await fetch("https://api.webinarjam.com/webinarjam/webinar", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(WEBINARJAM_TIMEOUT_MS),
    });
    const data: any = await res.json();
    if (data?.status === "success" && data.webinar) return data.webinar;
    console.warn(`[PromoDrip] WebinarJam details failed for webinar ${webinarId}: ${data?.message || res.status}`);
    return null;
  } catch (err: any) {
    console.warn(`[PromoDrip] WebinarJam details error for webinar ${webinarId}: ${err?.message}`);
    return null;
  }
}

/** Does this webinar have any schedule that hasn't effectively passed yet? */
export function hasUpcomingSchedule(webinar: any, now: Date): boolean {
  const schedules: any[] = Array.isArray(webinar?.schedules) ? webinar.schedules : [];
  const timezone: string = webinar?.timezone || "America/Los_Angeles";
  for (const sched of schedules) {
    const dateStr = sched?.date || sched?.datetime || "";
    const utc = parseWebinarJamScheduleToUtc(String(dateStr), timezone);
    if (!utc) {
      // Fail CLOSED: an unparseable schedule might be in the future — treat
      // the webinar as upcoming rather than promote to its registrants.
      console.warn(`[PromoDrip] Unparseable webinar schedule "${dateStr}" — treating webinar as upcoming (fail-safe)`);
      return true;
    }
    if (utc.getTime() + WEBINAR_DURATION_BUFFER_MS > now.getTime()) return true;
  }
  return false;
}

/**
 * Resolve which webinar IDs (as stored on webinar_registrants rows) currently
 * have an upcoming schedule per WebinarJam. Cached for 10 minutes.
 */
export async function resolveUpcomingWebinarIds(db: any): Promise<UpcomingWebinarsResult> {
  if (upcomingCache && Date.now() - upcomingCache.at < CACHE_TTL_MS && upcomingCache.result.ok) {
    return upcomingCache.result;
  }

  try {
    // Only webinar ids that actually appear on registrant rows matter.
    const idRows: Array<{ webinarId: string | null }> = await db
      .selectDistinct({ webinarId: webinarRegistrants.webinarId })
      .from(webinarRegistrants);
    const webinarIds = idRows.map((r) => r.webinarId).filter((v): v is string => !!v && v.trim().length > 0);

    if (webinarIds.length === 0) {
      const result: UpcomingWebinarsResult = { ok: true, upcomingWebinarIds: [], checkedWebinars: 0 };
      upcomingCache = { at: Date.now(), result };
      return result;
    }

    // Per-webinar API keys where configured; account-level key otherwise.
    const credRows: Array<{ webinarId: string; apiKey: string | null }> = await db
      .select({ webinarId: webinarCredentials.webinarId, apiKey: webinarCredentials.apiKey })
      .from(webinarCredentials);
    const keyByWebinar = new Map(credRows.map((r) => [r.webinarId, r.apiKey || undefined]));

    const now = new Date();
    const upcoming: string[] = [];
    for (const webinarId of webinarIds) {
      const details = await fetchWebinarDetails(webinarId, keyByWebinar.get(webinarId));
      if (!details) {
        // Fail-safe: unknown schedule → callers must defer, not guess.
        return { ok: false, error: `WebinarJam details unavailable for webinar ${webinarId}` };
      }
      if (hasUpcomingSchedule(details, now)) upcoming.push(webinarId);
    }

    const result: UpcomingWebinarsResult = { ok: true, upcomingWebinarIds: upcoming, checkedWebinars: webinarIds.length };
    upcomingCache = { at: Date.now(), result };
    return result;
  } catch (err: any) {
    return { ok: false, error: `Failed to resolve upcoming webinars: ${err?.message}` };
  }
}

/**
 * Build the exclusion sets used at snapshot time and before every send:
 * emails/phones registered to an upcoming webinar, plus STOP'd phones.
 */
export async function buildPromoExclusionSets(db: any): Promise<PromoExclusionSets> {
  const up = await resolveUpcomingWebinarIds(db);
  if (!up.ok) return up;

  const upcomingEmails = new Set<string>();
  const upcomingPhones = new Set<string>();
  try {
    if (up.upcomingWebinarIds.length > 0) {
      const rows: Array<{ email: string | null; phone: string }> = await db
        .select({ email: webinarRegistrants.email, phone: webinarRegistrants.phone })
        .from(webinarRegistrants)
        .where(inArray(webinarRegistrants.webinarId, up.upcomingWebinarIds));
      for (const r of rows) {
        const e = normalizeEmail(r.email);
        if (e) upcomingEmails.add(e);
        const p = normalizePromoPhone(r.phone);
        if (p.length === 10) upcomingPhones.add(p);
      }
    }

    const optedOutPhones = new Set<string>();
    const optedRows: Array<{ phone: string }> = await db
      .select({ phone: webinarRegistrants.phone })
      .from(webinarRegistrants)
      .where(eq(webinarRegistrants.optedOut, 1));
    for (const r of optedRows) {
      const p = normalizePromoPhone(r.phone);
      if (p.length === 10) optedOutPhones.add(p);
    }

    return { ok: true, upcomingWebinarIds: up.upcomingWebinarIds, upcomingEmails, upcomingPhones, optedOutPhones };
  } catch (err: any) {
    return { ok: false, error: `Failed to build exclusion sets: ${err?.message}` };
  }
}

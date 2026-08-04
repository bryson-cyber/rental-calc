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
import { notifyOwner } from "../_core/notification";
import { parseWebinarJamScheduleToUtc } from "./promo-time";
import { normalizeEmail, normalizePromoPhone } from "./promo-util";

const WEBINAR_DURATION_BUFFER_MS = 3 * 60 * 60 * 1000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const WEBINARJAM_TIMEOUT_MS = 15_000;

export type UpcomingWebinarsResult =
  | {
      ok: true;
      upcomingWebinarIds: string[];
      /** Real webinars WebinarJam wouldn't resolve — their registrants are
       *  excluded too, since we can't prove their webinar has passed. */
      unresolvedWebinarIds: string[];
      checkedWebinars: number;
    }
  | { ok: false; error: string };

/**
 * WebinarJam webinar IDs are numeric. Rows carrying anything else (e.g.
 * "settings-test-webinar" written by the admin settings test) are local test
 * artifacts, not real webinars — they can never resolve against the API, so
 * they must be ignored rather than treated as an unverifiable webinar.
 * Without this, one seed row blocks every promo send indefinitely.
 */
export function looksLikeRealWebinarId(webinarId: string): boolean {
  return /^\d+$/.test(webinarId.trim());
}

export type PromoExclusionSets =
  | {
      ok: true;
      upcomingWebinarIds: string[];
      /** Real webinars we couldn't verify — their registrants are held out too */
      unresolvedWebinarIds: string[];
      /** Lowercased emails of registrants held out (upcoming or unverifiable webinar) */
      upcomingEmails: Set<string>;
      /** Normalized phones of registrants held out (upcoming or unverifiable webinar) */
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
    const allIds = idRows.map((r) => r.webinarId).filter((v): v is string => !!v && v.trim().length > 0);
    const webinarIds = allIds.filter(looksLikeRealWebinarId);
    const ignored = allIds.filter((id) => !looksLikeRealWebinarId(id));
    if (ignored.length > 0) {
      console.warn(`[PromoDrip] Ignoring ${ignored.length} non-WebinarJam webinar id(s) on registrant rows: ${ignored.join(", ")}`);
    }

    if (webinarIds.length === 0) {
      const result: UpcomingWebinarsResult = { ok: true, upcomingWebinarIds: [], unresolvedWebinarIds: [], checkedWebinars: 0 };
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
    const unresolved: string[] = [];
    for (const webinarId of webinarIds) {
      const details = await fetchWebinarDetails(webinarId, keyByWebinar.get(webinarId));
      if (!details) {
        // Fail closed for THIS webinar only: we can't prove its date has
        // passed, so its registrants get held out. Deferring the entire
        // campaign over one unreachable webinar is what silently killed
        // Days 3/5/7 in Aug 2026 — never do that again.
        unresolved.push(webinarId);
        continue;
      }
      if (hasUpcomingSchedule(details, now)) upcoming.push(webinarId);
    }

    // Every real webinar failing means WebinarJam itself is down, not one bad
    // row. Excluding the entire audience would silently gut the send, so this
    // is the one case that still defers.
    if (unresolved.length === webinarIds.length) {
      return {
        ok: false,
        error: `WebinarJam unreachable for all ${webinarIds.length} webinar(s) — deferring rather than excluding everyone`,
      };
    }

    if (unresolved.length > 0) {
      console.warn(`[PromoDrip] ${unresolved.length} webinar(s) unresolved; holding out their registrants: ${unresolved.join(", ")}`);
      notifyOwner({
        title: "⚠️ Promo drip: some webinars unreachable",
        content: `Couldn't verify schedules for webinar(s) ${unresolved.join(", ")}. Their registrants are being held out of promo sends as a precaution. Everyone else is sending normally.`,
      }).catch(() => {});
    }

    const result: UpcomingWebinarsResult = {
      ok: true,
      upcomingWebinarIds: upcoming,
      unresolvedWebinarIds: unresolved,
      checkedWebinars: webinarIds.length,
    };
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
    // Hold out registrants of upcoming webinars AND of webinars we couldn't
    // verify (can't prove those have passed).
    const holdOutIds = [...up.upcomingWebinarIds, ...up.unresolvedWebinarIds];
    if (holdOutIds.length > 0) {
      const rows: Array<{ email: string | null; phone: string }> = await db
        .select({ email: webinarRegistrants.email, phone: webinarRegistrants.phone })
        .from(webinarRegistrants)
        .where(inArray(webinarRegistrants.webinarId, holdOutIds));
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

    return {
      ok: true,
      upcomingWebinarIds: up.upcomingWebinarIds,
      unresolvedWebinarIds: up.unresolvedWebinarIds,
      upcomingEmails,
      upcomingPhones,
      optedOutPhones,
    };
  } catch (err: any) {
    return { ok: false, error: `Failed to build exclusion sets: ${err?.message}` };
  }
}

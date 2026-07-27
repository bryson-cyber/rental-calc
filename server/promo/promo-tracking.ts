/**
 * Promo Drip — per-step open/click tracking.
 *
 * Reuses the existing tracked-link infrastructure (personalized_links +
 * link_clicks + the public GET /l/:code redirect) — no schema changes.
 *
 * At send time each message's destination URL is swapped for a per-recipient
 * short link (and each email gets a 1×1 open pixel). Rows are tagged:
 *   campaignType "promo_drip"       — click links (real sends)
 *   campaignType "promo_drip_open"  — email open pixels (real sends)
 *   campaignType "promo_drip_test"  — test sends (excluded from stats)
 *   campaignName "promo:<campaignId>:<stepKey>" — the aggregation key
 *
 * Destination URLs get UTM parameters so the landing site can attribute
 * traffic per step: utm_source=coachinayah, utm_medium=email|sms,
 * utm_campaign=affiliate_arbitrage, utm_content=<stepKey>.
 *
 * Tracking must NEVER block or fail a send: any error falls back to the
 * original untracked body.
 */

import crypto from "crypto";
import type { Request, Response } from "express";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { linkClicks, personalizedLinks } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "../_core/env";

const URL_PATTERN = /https?:\/\/[^\s<>"'）)\]]+/g;
// Lowercase-only alphabet: MySQL's default case-insensitive collation would
// fold mixed-case codes together (shrinking the space and colliding with the
// pre-existing lowercase webinar short codes), so codes must be collation-proof.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 10;

export function generateShortCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Append UTM params to a URL, preserving any existing query string. */
export function withUtmParams(url: string, medium: "email" | "sms", stepKey: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "coachinayah");
    u.searchParams.set("utm_medium", medium);
    u.searchParams.set("utm_campaign", "affiliate_arbitrage");
    u.searchParams.set("utm_content", stepKey);
    return u.toString();
  } catch {
    return url;
  }
}

export function promoStatsKey(campaignId: number, stepKey: string): string {
  return `promo:${campaignId}:${stepKey}`;
}

export interface TrackedContent {
  body: string;
  /** Set for emails: shortCode of the open-pixel row */
  openCode: string | null;
}

/**
 * Replace every URL in the body with a per-recipient tracked short link and
 * (for emails) mint an open-pixel row. Falls back to the original body on any
 * error — a send must never fail because tracking failed.
 */
export async function buildTrackedPromoContent(
  db: any,
  params: {
    campaignId: number;
    stepKey: string;
    channel: "email" | "sms";
    recipientEmail: string | null;
    hubspotContactId?: string | null;
    body: string;
    isTest?: boolean;
  }
): Promise<TrackedContent> {
  const { campaignId, stepKey, channel, body } = params;
  try {
    const baseUrl = ENV.appUrl.replace(/\/+$/, "");
    if (!baseUrl) return { body, openCode: null };

    // Trailing sentence punctuation is trimmed exactly like the email HTML
    // auto-linker does, so tracked destinations never bake in a stray "." .
    const matches = (body.match(URL_PATTERN) || []).map((m) => m.replace(/[.,!?;:]+$/, ""));
    const urls = Array.from(new Set(matches));
    const linkType = params.isTest ? "promo_drip_test" : "promo_drip";
    const campaignName = promoStatsKey(campaignId, stepKey);

    // Mint one code per distinct URL first, then substitute in a SINGLE regex
    // pass — iterative replace could corrupt links when one URL is a prefix of
    // another (or of an already-inserted short link).
    const codeByUrl = new Map<string, string>();
    for (const url of urls) {
      const shortCode = generateShortCode();
      await db.insert(personalizedLinks).values({
        email: params.recipientEmail,
        hubspotContactId: params.hubspotContactId ?? null,
        linkUrl: withUtmParams(url, channel, stepKey),
        shortCode,
        campaignName,
        campaignType: linkType,
      });
      codeByUrl.set(url, shortCode);
    }
    const tracked = body.replace(URL_PATTERN, (match) => {
      const trimmed = match.replace(/[.,!?;:]+$/, "");
      const trailing = match.slice(trimmed.length);
      const code = codeByUrl.get(trimmed);
      return code ? `${baseUrl}/l/${code}${trailing}` : match;
    });

    let openCode: string | null = null;
    if (channel === "email") {
      openCode = generateShortCode();
      await db.insert(personalizedLinks).values({
        email: params.recipientEmail,
        hubspotContactId: params.hubspotContactId ?? null,
        linkUrl: urls[0] ? withUtmParams(urls[0], channel, stepKey) : baseUrl,
        shortCode: openCode,
        campaignName,
        campaignType: params.isTest ? "promo_drip_test" : "promo_drip_open",
      });
    }

    return { body: tracked, openCode };
  } catch (err: any) {
    console.warn(`[PromoDrip] link tracking failed for ${stepKey} — sending untracked:`, err?.message);
    return { body, openCode: null };
  }
}

/** The <img> tag appended to tracked emails (before the unsubscribe footer). */
export function openPixelHtml(openCode: string): string {
  const baseUrl = ENV.appUrl.replace(/\/+$/, "");
  return `<img src="${baseUrl}/api/promo/open/${openCode}.gif" width="1" height="1" alt="" style="display:none;">`;
}

// 43-byte transparent 1×1 GIF
const PIXEL_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/**
 * GET /api/promo/open/:code.gif — records an email open (as a "click" on the
 * pixel's link row) and returns the transparent GIF. Never errors outward.
 */
export async function promoOpenPixelHandler(req: Request, res: Response) {
  const code = String(req.params.code || "").replace(/\.gif$/i, "").slice(0, 20);
  try {
    const db = await getDb();
    if (db && code) {
      const [row] = await db
        .select({ id: personalizedLinks.id, clickCount: personalizedLinks.clickCount })
        .from(personalizedLinks)
        .where(eq(personalizedLinks.shortCode, code))
        .limit(1);
      if (row) {
        // Fire-and-forget — the pixel response never waits on tracking writes.
        // Atomic increment: concurrent pixel fetches must not lose counts.
        (async () => {
          await db.insert(linkClicks).values({
            linkId: row.id,
            userIp: (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip,
            userAgent: req.headers["user-agent"] || undefined,
          });
          await db
            .update(personalizedLinks)
            .set({ clickCount: sql`${personalizedLinks.clickCount} + 1`, lastClickedAt: new Date() })
            .where(eq(personalizedLinks.id, row.id));
        })().catch((err) => console.warn(`[PromoDrip] open tracking failed for ${code}:`, err?.message));
      }
    }
  } catch (err: any) {
    console.warn(`[PromoDrip] open pixel error for ${code}:`, err?.message);
  }
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  return res.end(PIXEL_GIF);
}

export interface StepEngagement {
  /** Emails whose pixel fired at least once (unique recipients, roughly) */
  opens: number;
  /** Tracked links clicked at least once (unique recipients per link) */
  uniqueClicks: number;
  /** Total click events across those links */
  totalClicks: number;
}

// The dashboard polls every 15s; cache the aggregate so repeat polls reuse
// one query (the table grows for the life of the feature).
const ENGAGEMENT_CACHE_TTL_MS = 30_000;
const engagementCache = new Map<number, { at: number; data: Map<string, StepEngagement> }>();

/**
 * Aggregate engagement per step for a campaign. Test sends are excluded
 * (campaignType promo_drip_test). Uses the campaignType index; one query,
 * cached ~30s per campaign.
 */
export async function getPromoEngagement(db: any, campaignId: number): Promise<Map<string, StepEngagement>> {
  const cached = engagementCache.get(campaignId);
  if (cached && Date.now() - cached.at < ENGAGEMENT_CACHE_TTL_MS) return cached.data;
  const prefix = `promo:${campaignId}:`;
  const rows: Array<{ campaignName: string | null; campaignType: string | null; unique: number; total: number }> =
    await db
      .select({
        campaignName: personalizedLinks.campaignName,
        campaignType: personalizedLinks.campaignType,
        unique: sql<number>`SUM(CASE WHEN ${personalizedLinks.clickCount} > 0 THEN 1 ELSE 0 END)`,
        total: sql<number>`SUM(${personalizedLinks.clickCount})`,
      })
      .from(personalizedLinks)
      .where(
        and(
          inArray(personalizedLinks.campaignType, ["promo_drip", "promo_drip_open"]),
          like(personalizedLinks.campaignName, `${prefix}%`)
        )
      )
      .groupBy(personalizedLinks.campaignName, personalizedLinks.campaignType);

  const out = new Map<string, StepEngagement>();
  for (const row of rows) {
    const stepKey = (row.campaignName || "").slice(prefix.length);
    if (!stepKey) continue;
    const entry = out.get(stepKey) ?? { opens: 0, uniqueClicks: 0, totalClicks: 0 };
    if (row.campaignType === "promo_drip_open") {
      entry.opens += Number(row.unique ?? 0);
    } else {
      entry.uniqueClicks += Number(row.unique ?? 0);
      entry.totalClicks += Number(row.total ?? 0);
    }
    out.set(stepKey, entry);
  }
  engagementCache.set(campaignId, { at: Date.now(), data: out });
  return out;
}

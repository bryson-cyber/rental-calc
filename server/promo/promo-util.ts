/**
 * Promo Drip — small shared helpers.
 *
 * Phone normalization mirrors the webinar system's rules exactly (see
 * normalizePhone/isUsCanadaPhone in server/routers/webinar-sms.ts) so a phone
 * stored by the WebinarJam import and a phone pulled from HubSpot compare
 * equal. Kept as local copies so promo modules stay importable in unit tests
 * without pulling the 5k-line webinar router; behavior is pinned by tests.
 */

import crypto from "crypto";
import { ENV } from "../_core/env";

/** Strip to digits; 11-digit leading-1 → 10-digit. Same rules as webinar-sms. */
export function normalizePromoPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return digits;
}

/** US/Canada (NANP): 10 digits, or 11 starting with 1. Same rules as webinar-sms. */
export function isUsCanadaPromoPhone(phone: string): boolean {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 10) return true;
  if (digits.length === 11 && digits.startsWith("1")) return true;
  return false;
}

/** Lowercased, trimmed email for set-membership comparisons; null when empty. */
export function normalizeEmail(email: string | null | undefined): string | null {
  const e = (email || "").trim().toLowerCase();
  return e.length > 0 ? e : null;
}

/** Replace %FIRST_NAME% (empty-name-safe: falls back to "there"). */
export function renderPromoVars(template: string, vars: { firstName?: string | null }): string {
  const first = (vars.firstName || "").trim();
  return template.replace(/%FIRST_NAME%/g, first || "there");
}

// ── Unsubscribe tokens ──────────────────────────────────────────────────────
// HMAC-SHA256(campaignId:email) with the app JWT secret, base64url. The token
// authorizes exactly one (campaign, email) unsubscribe — not a session.

export function promoUnsubscribeToken(campaignId: number, email: string): string {
  const secret = ENV.cookieSecret;
  if (!secret) throw new Error("JWT_SECRET is required for promo unsubscribe tokens");
  return crypto
    .createHmac("sha256", secret)
    .update(`promo-unsub:${campaignId}:${normalizeEmail(email) ?? ""}`)
    .digest("base64url");
}

export function verifyPromoUnsubscribeToken(campaignId: number, email: string, token: string): boolean {
  if (!token || typeof token !== "string") return false;
  try {
    const expected = promoUnsubscribeToken(campaignId, email);
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildPromoUnsubscribeUrl(baseUrl: string, campaignId: number, email: string): string {
  const t = promoUnsubscribeToken(campaignId, email);
  const qs = new URLSearchParams({ c: String(campaignId), e: email, t });
  return `${baseUrl.replace(/\/+$/, "")}/api/promo/unsubscribe?${qs.toString()}`;
}

/** Split an array into chunks of n (n ≥ 1). */
export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

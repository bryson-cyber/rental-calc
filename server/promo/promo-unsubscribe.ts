/**
 * Promo Drip — public unsubscribe endpoint (token-protected).
 *
 * GET  /api/promo/unsubscribe?c&e&t → confirmation page with a one-button
 *      POST form. No side effect on GET: email security scanners prefetch
 *      GET links, and a prefetch must never unsubscribe someone.
 * POST /api/promo/unsubscribe?c&e&t → performs the unsubscribe. This is also
 *      the RFC 8058 one-click target (List-Unsubscribe-Post header), which
 *      mail clients invoke as a POST — a genuine user action.
 *
 * Scope: a valid token (HMAC over campaignId+email) unsubscribes that email
 * from EVERY promo drip campaign, past and future — CAN-SPAM requires the
 * opt-out to stick, not just for the campaign that sent the email. Future
 * snapshots exclude previously-unsubscribed emails (see promo-snapshot.ts).
 */

import type { Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { promoDripRecipients } from "../../drizzle/schema";
import { getDb } from "../db";
import { normalizeEmail, verifyPromoUnsubscribeToken } from "./promo-util";

function page(title: string, message: string, form?: { action: string }): string {
  const formHtml = form
    ? `<form method="POST" action="${form.action}" style="margin:24px 0 0;">
<button type="submit" style="background:#0f172a;color:#fff;border:0;border-radius:8px;padding:12px 24px;font-size:15px;cursor:pointer;">Yes, unsubscribe me</button>
</form>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:48px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f8fafc;">
<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;text-align:center;">
<h1 style="font-size:20px;margin:0 0 12px;color:#0f172a;">${title}</h1>
<p style="font-size:15px;line-height:1.6;color:#475569;margin:0;">${message}</p>
${formHtml}
</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

interface ParsedParams {
  campaignId: number;
  email: string;
  token: string;
}

function parseAndVerify(req: Request): ParsedParams | null {
  const campaignId = Number(req.query.c);
  const email = typeof req.query.e === "string" ? req.query.e : "";
  const token = typeof req.query.t === "string" ? req.query.t : "";
  if (!Number.isInteger(campaignId) || campaignId <= 0 || !email || !token) return null;
  if (!verifyPromoUnsubscribeToken(campaignId, email, token)) return null;
  return { campaignId, email, token };
}

/** GET: show a confirm page. Never mutates — scanners prefetch GET links. */
export async function promoUnsubscribeConfirmHandler(req: Request, res: Response) {
  const params = parseAndVerify(req);
  if (!params) {
    return res.status(400).send(page("Invalid link", "This unsubscribe link is invalid or incomplete. Please use the link from your email."));
  }
  const qs = new URLSearchParams({ c: String(params.campaignId), e: params.email, t: params.token });
  return res.send(
    page(
      "Unsubscribe?",
      `Click below to stop all remaining emails and texts in this series for <strong>${escapeHtml(params.email)}</strong>.`,
      { action: `/api/promo/unsubscribe?${qs.toString()}` }
    )
  );
}

/** POST: perform the unsubscribe (also the RFC 8058 one-click target). */
export async function promoUnsubscribeHandler(req: Request, res: Response) {
  try {
    const params = parseAndVerify(req);
    if (!params) {
      return res.status(403).send(page("Invalid link", "This unsubscribe link is invalid or has been tampered with."));
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).send(page("Something went wrong", "We couldn't process your request right now. Please try again shortly."));
    }

    const normalized = normalizeEmail(params.email);
    if (!normalized) {
      return res.status(400).send(page("Invalid link", "This unsubscribe link is incomplete."));
    }

    // All campaigns, not just the one that sent the email — the opt-out sticks.
    await db
      .update(promoDripRecipients)
      .set({ unsubscribedAt: new Date() })
      .where(and(eq(promoDripRecipients.email, normalized), isNull(promoDripRecipients.unsubscribedAt)));

    return res.send(
      page("You're unsubscribed", "You won't receive any more emails or texts from this series. No further action is needed.")
    );
  } catch (err: any) {
    console.error("[PromoDrip] unsubscribe handler error:", err?.message);
    return res.status(500).send(page("Something went wrong", "We couldn't process your request right now. Please try again shortly."));
  }
}

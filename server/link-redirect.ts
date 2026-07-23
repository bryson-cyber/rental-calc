/**
 * Public short-link redirect: GET /l/:code → 302 to the personalized link's
 * target URL, recording the click. No auth — these links go to unaware leads
 * in SMS/email, so they must open with zero friction. Targets are URLs this
 * app minted itself (e.g. the public Zillow listing behind a lead's local
 * deal), never user-supplied input.
 */
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { linkClicks, personalizedLinks } from "../drizzle/schema";
import { getDb } from "./db";

const FALLBACK_URL = process.env.VITE_APP_URL || "https://coachinayahturnkeytool.com";

export function registerLinkRedirect(app: Express): void {
  app.get("/l/:code", async (req: Request, res: Response) => {
    const code = String(req.params.code || "").slice(0, 20);
    try {
      const db = await getDb();
      if (!db || !code) return res.redirect(302, FALLBACK_URL);

      const [link] = await db
        .select({ id: personalizedLinks.id, linkUrl: personalizedLinks.linkUrl, clickCount: personalizedLinks.clickCount })
        .from(personalizedLinks)
        .where(eq(personalizedLinks.shortCode, code))
        .limit(1);
      if (!link?.linkUrl) return res.redirect(302, FALLBACK_URL);

      // Fire-and-forget click tracking — the redirect never waits on it
      (async () => {
        await db.insert(linkClicks).values({
          linkId: link.id,
          userIp: (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip,
          userAgent: req.headers["user-agent"] || undefined,
          referer: req.headers.referer || undefined,
        });
        await db
          .update(personalizedLinks)
          .set({ clickCount: (link.clickCount || 0) + 1, lastClickedAt: new Date() })
          .where(eq(personalizedLinks.id, link.id));
      })().catch((err) => console.warn(`[LinkRedirect] Click tracking failed for ${code}:`, err.message));

      return res.redirect(302, link.linkUrl);
    } catch (err: any) {
      console.warn(`[LinkRedirect] Redirect failed for ${code}:`, err.message);
      return res.redirect(302, FALLBACK_URL);
    }
  });
}

import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import type { User } from "../drizzle/schema";
import { fundingConnections } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { fetchReportPdf } from "./_core/fundingSystem";
import { getDb } from "./db";

async function resolveUser(req: Request): Promise<User | null> {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    return null;
  }
}

/**
 * GET /api/funding/report-pdf — streams a credit-report PDF from
 * the funding system through this server.
 *
 * Normal users: identified by session cookie, can only see their own PDF.
 * Admin users: may pass ?email=<target> to view any user's report.
 */
export function registerFundingPdfProxy(app: Express) {
  app.get("/api/funding/report-pdf", async (req: Request, res: Response) => {
    try {
      const user = await resolveUser(req);
      if (!user) {
        res.status(401).json({ error: "Sign in to view your report" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ error: "Service unavailable" });
        return;
      }

      // Determine which email to fetch the PDF for
      let targetEmail: string | null = null;

      const emailParam = typeof req.query.email === "string" ? req.query.email.trim() : "";

      if (emailParam && user.role === "admin") {
        // Admin override: fetch PDF for the specified email directly
        targetEmail = emailParam;
      } else {
        // Normal path: look up the user's own funding connection
        const rows = await db.select().from(fundingConnections)
          .where(eq(fundingConnections.userId, user.id)).limit(1);
        const connection = rows[0];
        if (!connection || connection.status !== "connected") {
          res.status(404).json({ error: "No funding report linked yet" });
          return;
        }
        targetEmail = connection.email;
      }

      const pdf = await fetchReportPdf(targetEmail);
      if (!pdf) {
        res.status(404).json({ error: "Report PDF isn't available yet — try again shortly" });
        return;
      }

      const download = req.query.download === "1";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", pdf.length.toString());
      res.setHeader(
        "Content-Disposition",
        `${download ? "attachment" : "inline"}; filename="credit-report.pdf"`,
      );
      res.setHeader("Cache-Control", "private, max-age=300");
      res.send(pdf);
    } catch (error) {
      console.error("[FundingPdfProxy] Error:", error);
      res.status(500).json({ error: "Could not load the report PDF" });
    }
  });
}

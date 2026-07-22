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
 * GET /api/funding/report-pdf — streams the member's credit-report PDF from
 * the funding system through this server, so it can be embedded in the
 * Funding Readiness page. Funding-system URL and credentials stay
 * server-side; the member is identified by their own session cookie and can
 * only ever receive the PDF linked to their connection row.
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

      const rows = await db.select().from(fundingConnections)
        .where(eq(fundingConnections.userId, user.id)).limit(1);
      const connection = rows[0];
      if (!connection || connection.status !== "connected") {
        res.status(404).json({ error: "No funding report linked yet" });
        return;
      }

      const pdf = await fetchReportPdf(connection.email);
      if (!pdf) {
        res.status(404).json({ error: "Your report PDF isn't available yet — try again shortly" });
        return;
      }

      const download = req.query.download === "1";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", pdf.length.toString());
      res.setHeader(
        "Content-Disposition",
        `${download ? "attachment" : "inline"}; filename="my-credit-report.pdf"`,
      );
      res.setHeader("Cache-Control", "private, max-age=300");
      res.send(pdf);
    } catch (error) {
      console.error("[FundingPdfProxy] Error:", error);
      res.status(500).json({ error: "Could not load the report PDF" });
    }
  });
}

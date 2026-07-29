import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { llcDocuments, llcFounders, llcRegistrations } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { buildSampleDocumentPdf, demoStateName } from "./demo";
import { isTestRegistration } from "./demoMarker";
import { statusTokenMatches } from "./store";

/**
 * GET /api/llc/sample-documents/:documentId
 *
 * Serves a demo/test filing's SAMPLE deliverable by regenerating the PDF
 * in-process from the registration's own data. Sample documents therefore
 * never depend on the external storage backend or its CDN being reachable —
 * the webinar demo cannot be taken down by a storage outage or a signing
 * quirk. Real (provider) documents never route through here: the handler
 * hard-refuses any registration without the demo/test marker.
 *
 * Access: the registration's owner or an admin, session-cookie
 * authenticated — or a ?t=<statusToken> matching the owning registration
 * (2026-07-28 tokenized email links; released documents only, same rules as
 * the storage proxy). `?download=1` switches to attachment disposition.
 */
export function registerLlcSampleDocumentRoute(app: Express) {
  app.get("/api/llc/sample-documents/:documentId", async (req: Request, res: Response) => {
    try {
      let user = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        user = null;
      }
      // Status-token candidate (never logged). Anonymous requests without
      // one keep the original instant 401.
      const rawToken = req.query.t;
      const statusToken =
        typeof rawToken === "string" && rawToken.length >= 32 && rawToken.length <= 64
          ? rawToken
          : null;
      if (!user && !statusToken) {
        res.status(401).send("Sign in to view this document");
        return;
      }

      const documentId = Number(req.params.documentId);
      if (!Number.isInteger(documentId) || documentId <= 0) {
        res.status(400).send("Invalid document id");
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).send("Service unavailable");
        return;
      }

      const documentRows = await db
        .select()
        .from(llcDocuments)
        .where(eq(llcDocuments.id, documentId))
        .limit(1);
      const document = documentRows[0];
      if (!document || !document.releasedAt) {
        res.status(404).send("Document not found");
        return;
      }

      const registrationRows = await db
        .select()
        .from(llcRegistrations)
        .where(eq(llcRegistrations.id, document.registrationId))
        .limit(1);
      const registration = registrationRows[0];

      // Session path first (unchanged for signed-in users); the token path
      // authorizes ONLY a released document whose owning registration's
      // statusToken matches (constant-time). Token failures answer 404 —
      // never revealing whether the id or the token was wrong.
      const sessionAuthorized =
        user !== null && (user.role === "admin" || document.userId === user.id);
      const tokenAuthorized =
        !sessionAuthorized &&
        statusToken !== null &&
        registration !== undefined &&
        statusTokenMatches(registration.statusToken, statusToken);
      if (!sessionAuthorized && !tokenAuthorized) {
        if (user) {
          res.status(403).send("You don't have access to this document");
        } else {
          res.status(404).send("Document not found");
        }
        return;
      }

      // Sample regeneration exists ONLY for demo/test filings — a real
      // registration's documents are provider artifacts, not reproducible
      // from form data, and must never be impersonated by this route.
      if (!registration || !isTestRegistration(registration)) {
        res.status(403).send("This document is not a sample document");
        return;
      }

      const founderRows = await db
        .select()
        .from(llcFounders)
        .where(eq(llcFounders.registrationId, registration.id));
      const primary = founderRows.find((founder) => founder.isPrimary);
      const memberName = primary
        ? `${primary.firstName ?? ""} ${primary.lastName ?? ""}`.trim()
        : undefined;

      const pdf = buildSampleDocumentPdf(document.documentType ?? "", {
        companyName: `${registration.legalName ?? "Your Company"} ${registration.entitySuffix}`,
        stateName: demoStateName(registration.formationState),
        // Stable date: regenerating tomorrow yields the same document the
        // vault showed today.
        filedOn: document.releasedAt ?? document.createdAt,
        memberName: memberName || undefined,
      });
      if (!pdf) {
        res.status(404).send("Unknown sample document type");
        return;
      }

      const download = req.query.download === "1";
      const safeName = (document.name ?? "document").replace(/[^\w.\- ]/g, "").slice(0, 120) || "document";
      res.set("Cache-Control", "no-store");
      res.set("Content-Type", "application/pdf");
      res.set(
        "Content-Disposition",
        `${download ? "attachment" : "inline"}; filename="${safeName}.pdf"`,
      );
      res.send(pdf);
    } catch (error) {
      console.error("[LLC SampleDocument] failed:", error);
      res.status(500).send("The document could not be generated");
    }
  });
}

/**
 * App glue: the filed annual report into her document vault (document_annualreport_uploaded, and every sync that sees
 * a filed report without its document). It reuses the formation mirror (documents.ts mirrorFormationDocuments: our own
 * storage, the (registration, type, name) dedupe key) under the type "annual_report" and the name
 * "Annual report <year>", never the provider's file name. Release follows the formation policy
 * (doolaSubmission.ts isAutoReleasableHeldDocument): a provider document is a state filing, auto-released like the
 * articles, unless ops held it.
 *
 * Which filed report a document belongs to: the document id stored on the row once linked; else a year in the
 * document's name; else the oldest filed (or handed-over) report that has no document yet.
 */
import { and, eq } from "drizzle-orm";
import { llcDocuments } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { getDoolaDocumentDownload, listDoolaDocuments, normalizeDoolaDocumentType, type DoolaDocument } from "../doola";
import { autoReleaseFormationDocuments } from "../doolaSubmission";
import { isAnnualReportDocumentType, mirrorFormationDocuments } from "../documents";
import type { WhopFormationSnapshot } from "../whop";
import type { AnnualReportRow, AnnualReportStore } from "./store";
import type { AnnualReportDocuments } from "./service";

export const ANNUAL_REPORT_DOCUMENT_TYPE = "annual_report";
export const annualReportDocumentName = (fiscalYear: number) => `Annual report ${fiscalYear}`;

export function isAnnualReportDocument(document: Pick<DoolaDocument, "documentType" | "name">): boolean {
  return isAnnualReportDocumentType(normalizeDoolaDocumentType(document.documentType)) || isAnnualReportDocumentType(document.documentType);
}

/** Pure: pair unlinked filed-report documents with the reports waiting for one. */
export function pairDocumentsWithReports(
  documents: Array<Pick<DoolaDocument, "id" | "name">>,
  reports: AnnualReportRow[],
  preferredDocumentId?: string | null,
): Array<{ documentId: string; report: AnnualReportRow }> {
  const linked = new Set(reports.map((report) => report.filedDocumentId).filter(Boolean));
  const waiting = reports
    .filter((report) => !report.filedDocumentId && (report.status === "FILING_COMPLETED" || report.confirmedAt))
    .sort((a, b) => a.fiscalYear - b.fiscalYear);
  const unlinked = documents
    .filter((document): document is { id: string; name?: string } => typeof document.id === "string" && Boolean(document.id) && !linked.has(document.id))
    .sort((a, b) => (a.id === preferredDocumentId ? -1 : b.id === preferredDocumentId ? 1 : 0));
  const pairs: Array<{ documentId: string; report: AnnualReportRow }> = [];
  for (const document of unlinked) {
    if (waiting.length === 0) break;
    const year = /\b(20\d{2})\b/.exec(document.name ?? "")?.[1];
    const byYear = year ? waiting.findIndex((report) => report.fiscalYear === Number(year)) : -1;
    const index = byYear >= 0 ? byYear : 0;
    pairs.push({ documentId: document.id, report: waiting[index] });
    waiting.splice(index, 1);
  }
  return pairs;
}

async function vaultHas(registrationId: number, name: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: llcDocuments.id })
    .from(llcDocuments)
    .where(and(eq(llcDocuments.registrationId, registrationId), eq(llcDocuments.documentType, ANNUAL_REPORT_DOCUMENT_TYPE), eq(llcDocuments.name, name)))
    .limit(1);
  return Boolean(rows[0]);
}

export function vaultAnnualReportDocuments(store: AnnualReportStore): AnnualReportDocuments {
  return {
    async mirror({ facts, reports, documentId }) {
      if (!facts.companyId) return { mirrored: 0 };
      const companyId = facts.companyId;
      const documents = (await listDoolaDocuments(companyId)).filter(isAnnualReportDocument);
      let mirrored = 0;
      for (const pair of pairDocumentsWithReports(documents, reports, documentId)) {
        const source = documents.find((document) => document.id === pair.documentId);
        const downloadUrl = source?.downloadUrl ?? (await getDoolaDocumentDownload(companyId, pair.documentId).catch(() => null))?.downloadUrl ?? null;
        const name = annualReportDocumentName(pair.report.fiscalYear);
        const result = await mirrorFormationDocuments({
          userId: facts.userId,
          registrationId: facts.registrationId,
          includeAnnualReports: true,
          snapshot: { documents: [{ id: pair.documentId, name, document_type: ANNUAL_REPORT_DOCUMENT_TYPE, download_url: downloadUrl }] } as WhopFormationSnapshot,
        });
        mirrored += result.mirrored;
        // Linked only once the file is really in her vault; a failed download is tried again on the next sync.
        if (result.mirrored > 0 || (await vaultHas(facts.registrationId, name))) {
          await store.updateReport(pair.report.id, { filedDocumentId: pair.documentId });
        }
      }
      if (mirrored > 0) {
        await autoReleaseFormationDocuments({ userId: facts.userId, registrationId: facts.registrationId }).catch(() => ({ released: 0 }));
      }
      return { mirrored };
    },
  };
}

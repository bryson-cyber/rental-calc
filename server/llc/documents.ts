import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { llcDocuments, llcRegistrations } from "../../drizzle/schema";
import { isTestRegistration } from "./demoMarker";
import { getDb } from "../db";
import { storagePut } from "../storage";
import type { WhopFormationSnapshot } from "./whop";

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

/** Ops uploads accept PDF/PNG/JPG up to 20MB (matches the lease-upload cap). */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const OPS_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;
export type OpsUploadMimeType = (typeof OPS_UPLOAD_MIME_TYPES)[number];

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "document";
}

function requireDb<T>(db: T | null): T {
  if (!db) throw new Error("Database is not available");
  return db;
}

/**
 * Mirror provider formation documents (articles, EIN letters, …) into the
 * member's own ACL'd storage (pdfs/{userId}/llc/{registrationId}/…) so
 * downloads survive the provider relationship and are served from our domain
 * (white-label: members never touch a provider URL).
 *
 * Mirrored rows are recorded UNRELEASED (releasedAt null); the auto-release
 * sweep in the Doola refresh path releases every releasable class right
 * after mirroring (provider OA copies never release — see
 * isAutoReleasableHeldDocument). Ops can still release/unrelease manually.
 *
 * Idempotent via the (registrationId, documentType, name) unique key; each
 * document is best-effort — failures are logged and never thrown so a status
 * refresh can never be broken by a document fetch.
 */
export async function mirrorFormationDocuments(params: {
  userId: number;
  registrationId: number;
  snapshot: WhopFormationSnapshot | null;
}): Promise<{ mirrored: number; skipped: number }> {
  let mirrored = 0;
  let skipped = 0;

  try {
    const documents = params.snapshot?.documents ?? [];
    if (documents.length === 0) return { mirrored, skipped };

    const db = await getDb();
    if (!db) return { mirrored, skipped };

    for (const document of documents) {
      try {
        if (!document.download_url) {
          skipped += 1;
          continue;
        }
        const name = (document.name ?? document.document_type ?? "Document").slice(0, 200);
        const documentType = (document.document_type ?? "document").slice(0, 128);

        // Idempotency: the unique mirror key is checked first so a re-poll
        // never re-downloads or re-uploads an already-mirrored document.
        const existing = await db
          .select({ id: llcDocuments.id })
          .from(llcDocuments)
          .where(
            and(
              eq(llcDocuments.registrationId, params.registrationId),
              eq(llcDocuments.documentType, documentType),
              eq(llcDocuments.name, name),
            ),
          )
          .limit(1);
        if (existing[0]) {
          skipped += 1;
          continue;
        }

        const response = await fetch(document.download_url, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!response.ok) {
          skipped += 1;
          console.warn("[LLC Documents] Provider download failed", {
            registrationId: params.registrationId,
            documentType,
            httpStatus: response.status,
          });
          continue;
        }

        const declaredLength = Number(response.headers.get("content-length") ?? "0");
        if (declaredLength > MAX_DOCUMENT_BYTES) {
          skipped += 1;
          console.warn("[LLC Documents] Document exceeds the 25MB mirror cap", {
            registrationId: params.registrationId,
            documentType,
          });
          continue;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > MAX_DOCUMENT_BYTES) {
          skipped += 1;
          console.warn("[LLC Documents] Document exceeds the 25MB mirror cap", {
            registrationId: params.registrationId,
            documentType,
          });
          continue;
        }

        const contentType =
          response.headers.get("content-type")?.split(";")[0]?.trim() ||
          "application/pdf";
        const { key } = await storagePut(
          `pdfs/${params.userId}/llc/${params.registrationId}/${slugify(name)}.pdf`,
          buffer,
          contentType,
        );

        await db.insert(llcDocuments).values({
          registrationId: params.registrationId,
          userId: params.userId,
          name,
          documentType,
          source: "provider",
          storageKey: key,
          releasedAt: null,
        });
        mirrored += 1;
      } catch (error) {
        skipped += 1;
        const isDuplicate =
          error instanceof Error && /duplicate|ER_DUP/i.test(error.message);
        if (!isDuplicate) {
          console.warn("[LLC Documents] Mirroring one document failed", {
            registrationId: params.registrationId,
            error: error instanceof Error ? error.name : "UnknownError",
          });
        }
      }
    }
  } catch (error) {
    console.warn("[LLC Documents] Document mirror sweep failed", {
      registrationId: params.registrationId,
      error: error instanceof Error ? error.name : "UnknownError",
    });
  }

  return { mirrored, skipped };
}

function toClientDocument(
  row: typeof llcDocuments.$inferSelect,
  options?: { sampleRegistrationIds?: Set<number> },
) {
  const isSampleDocument = options?.sampleRegistrationIds?.has(row.registrationId) ?? false;
  return {
    id: row.id,
    registrationId: row.registrationId,
    name: row.label ?? row.name ?? row.documentType ?? "Document",
    documentType: row.documentType,
    releasedAt: row.releasedAt?.getTime() ?? null,
    createdAt: row.createdAt.getTime(),
    // Demo/test sample documents are regenerated in-process on demand, so
    // the webinar vault never depends on the storage backend. Real provider
    // documents stream through the app-owned /api/llc/files proxy (the
    // platform edge intercepts /manus-storage/* before the app sees it);
    // its ACL restricts pdfs/{userId}/* to that user or an admin.
    url: isSampleDocument
      ? `/api/llc/sample-documents/${row.id}`
      : `/api/llc/files/${row.storageKey}`,
  };
}

/** Registration ids (of the given rows) that carry the demo/test marker. */
async function findSampleRegistrationIds(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  registrationIds: number[],
): Promise<Set<number>> {
  if (registrationIds.length === 0) return new Set();
  const rows = await db
    .select({
      id: llcRegistrations.id,
      submissionKey: llcRegistrations.submissionKey,
      isTest: llcRegistrations.isTest,
    })
    .from(llcRegistrations)
    .where(inArray(llcRegistrations.id, Array.from(new Set(registrationIds))));
  return new Set(rows.filter((row) => isTestRegistration(row)).map((row) => row.id));
}

/**
 * Member-facing document list for one registration: RELEASED documents only.
 * Ownership must be verified by the caller before this runs.
 */
export async function listFormationDocuments(userId: number, registrationId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(llcDocuments)
    .where(
      and(
        eq(llcDocuments.userId, userId),
        eq(llcDocuments.registrationId, registrationId),
        isNotNull(llcDocuments.releasedAt),
      ),
    )
    .orderBy(asc(llcDocuments.createdAt), asc(llcDocuments.id));

  const sampleRegistrationIds = await findSampleRegistrationIds(
    db,
    rows.map((row) => row.registrationId),
  );
  return rows.map((row) => toClientDocument(row, { sampleRegistrationIds }));
}

/** All RELEASED documents across every registration the member owns. */
export async function listAllFormationDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(llcDocuments)
    .where(and(eq(llcDocuments.userId, userId), isNotNull(llcDocuments.releasedAt)))
    .orderBy(asc(llcDocuments.createdAt), asc(llcDocuments.id));

  const sampleRegistrationIds = await findSampleRegistrationIds(
    db,
    rows.map((row) => row.registrationId),
  );
  return rows.map((row) => toClientDocument(row, { sampleRegistrationIds }));
}

/** Ops view: every document for a registration, including unreleased. */
export async function listOpsDocuments(registrationId: number) {
  const db = requireDb(await getDb());
  const rows = await db
    .select()
    .from(llcDocuments)
    .where(eq(llcDocuments.registrationId, registrationId))
    .orderBy(asc(llcDocuments.createdAt), asc(llcDocuments.id));

  return rows.map((row) => ({
    id: row.id,
    registrationId: row.registrationId,
    userId: row.userId,
    name: row.name,
    label: row.label,
    documentType: row.documentType,
    source: row.source,
    releasedAt: row.releasedAt?.getTime() ?? null,
    createdAt: row.createdAt.getTime(),
    url: `/manus-storage/${row.storageKey}`,
  }));
}

/**
 * Formation-document row owning a storage key, joined to its registration's
 * status token — for the tokenized-link fallback in the storage proxy
 * (2026-07-28). Returns whether THIS document row is released; the caller
 * must authorize ONLY when released AND the presented token matches.
 */
export async function findRegistrationIdByStorageKey(storageKey: string): Promise<{
  registrationId: number;
  released: boolean;
  statusToken: string | null;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      registrationId: llcDocuments.registrationId,
      releasedAt: llcDocuments.releasedAt,
      statusToken: llcRegistrations.statusToken,
    })
    .from(llcDocuments)
    .innerJoin(
      llcRegistrations,
      eq(llcDocuments.registrationId, llcRegistrations.id),
    )
    .where(eq(llcDocuments.storageKey, storageKey))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    registrationId: row.registrationId,
    released: row.releasedAt !== null,
    statusToken: row.statusToken,
  };
}

export async function findLlcDocumentById(documentId: number) {
  const db = requireDb(await getDb());
  const rows = await db
    .select()
    .from(llcDocuments)
    .where(eq(llcDocuments.id, documentId))
    .limit(1);
  return rows[0] ?? null;
}

/** Release (or hide again) a document for the client vault. */
export async function setDocumentReleased(documentId: number, released: boolean) {
  const db = requireDb(await getDb());
  await db
    .update(llcDocuments)
    .set({ releasedAt: released ? new Date() : null })
    .where(eq(llcDocuments.id, documentId));
  return findLlcDocumentById(documentId);
}

export class OpsUploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpsUploadValidationError";
  }
}

/** Decode + validate an ops upload (PDF/PNG/JPG, ≤20MB). */
export function decodeOpsUpload(params: {
  dataBase64: string;
  mimeType: string;
}): { buffer: Buffer; mimeType: OpsUploadMimeType; extension: string } {
  if (!(OPS_UPLOAD_MIME_TYPES as readonly string[]).includes(params.mimeType)) {
    throw new OpsUploadValidationError(
      "Only PDF, PNG, or JPG documents can be uploaded.",
    );
  }
  const buffer = Buffer.from(params.dataBase64, "base64");
  if (buffer.length === 0) {
    throw new OpsUploadValidationError("The uploaded file is empty.");
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new OpsUploadValidationError("File too large. Maximum size is 20MB.");
  }
  const extension =
    params.mimeType === "application/pdf"
      ? "pdf"
      : params.mimeType === "image/png"
        ? "png"
        : "jpg";
  return { buffer, mimeType: params.mimeType as OpsUploadMimeType, extension };
}

/**
 * Ops upload into the client vault. Stored under the owner's ACL'd namespace;
 * released immediately (source "ops_upload").
 */
export async function uploadOpsDocument(params: {
  registrationId: number;
  ownerUserId: number;
  name: string;
  label?: string | null;
  documentType: string;
  dataBase64: string;
  mimeType: string;
  /** false = attach HELD for ops review (auto-generated docs); default true. */
  release?: boolean;
}) {
  const db = requireDb(await getDb());
  const { buffer, mimeType, extension } = decodeOpsUpload(params);

  const name = params.name.trim().slice(0, 200) || "Document";
  const documentType = params.documentType.trim().slice(0, 128) || "document";
  const uniqueSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const { key } = await storagePut(
    `pdfs/${params.ownerUserId}/llc/${params.registrationId}/${slugify(name)}-${uniqueSuffix}.${extension}`,
    buffer,
    mimeType,
  );

  const result = await db.insert(llcDocuments).values({
    registrationId: params.registrationId,
    userId: params.ownerUserId,
    name,
    label: params.label?.trim().slice(0, 200) || null,
    documentType,
    source: "ops_upload",
    storageKey: key,
    releasedAt: params.release === false ? null : new Date(),
  });
  const documentId = Number(result[0].insertId);
  return findLlcDocumentById(documentId);
}

/** Remove a document row (the storage object is left for audit). */
export async function deleteLlcDocument(documentId: number) {
  const db = requireDb(await getDb());
  await db.delete(llcDocuments).where(eq(llcDocuments.id, documentId));
}

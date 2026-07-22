import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  llcDocuments,
  llcFounders,
  llcRegistrations,
  llcStatusHistory,
  llcSubmissionAttempts,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { buildDemoPdf } from "./demo-pdf";
import { uploadOpsDocument } from "./documents";

/**
 * Demo filings for webinar demonstrations.
 *
 * createDemoFiling fabricates a completed-looking registration owned by the
 * calling admin with ZERO provider interaction: no connected account, no
 * checkout, and a status ("completed") that the status poller never sweeps.
 * The demo marker is the submissionKey "demo-" prefix — ops surfaces show a
 * Demo badge from it, while the client-facing status page renders the
 * registration exactly like a real one (the marker never reaches client
 * payloads). Vault documents are generated in code and clearly watermarked
 * SAMPLE inside the PDFs themselves.
 */

export class DemoGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoGuardError";
  }
}

export const DEMO_SUBMISSION_KEY_PREFIX = "demo-";

export function isDemoSubmissionKey(submissionKey: string | null | undefined): boolean {
  return Boolean(submissionKey?.startsWith(DEMO_SUBMISSION_KEY_PREFIX));
}

function requireDb<T>(db: T | null): T {
  if (!db) throw new Error("Database is not available");
  return db;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
}

export async function createDemoFiling(ownerUserId: number): Promise<{ id: number }> {
  const db = requireDb(await getDb());
  const now = Date.now();
  const draftAt = new Date(now - 14 * DAY_MS);
  const readyAt = new Date(now - 14 * DAY_MS + 2 * HOUR_MS);
  const submittingAt = new Date(now - 14 * DAY_MS + 2 * HOUR_MS + 5 * 60 * 1000);
  const acceptedAt = new Date(now - 13 * DAY_MS);
  const processingAt = new Date(now - 12 * DAY_MS);
  const completedAt = new Date(now - 2 * DAY_MS);

  const insertResult = await db.insert(llcRegistrations).values({
    userId: ownerUserId,
    status: "completed",
    currentStep: 6,
    legalName: "Amara Rose Apparel",
    entitySuffix: "LLC",
    formationState: "GA",
    businessType: "physical_product",
    industryGroup: "clothing_and_apparel",
    industryType: "casual_everyday_clothing",
    useRegisteredAgent: true,
    expediteEin: false,
    accuracyAttested: true,
    // Demo marker: ops-only recognition; never exposed to clients.
    submissionKey: `${DEMO_SUBMISSION_KEY_PREFIX}${randomBytes(8).toString("hex")}`,
    retailPriceCents: 59900,
    retailPaidAt: acceptedAt,
    submittedAt: new Date(now - 14 * DAY_MS + 2 * HOUR_MS + 5 * 60 * 1000),
    lastProviderSyncAt: new Date(now - 1 * HOUR_MS),
    providerStatus: {
      status: "completed",
      state_registered: true,
      ein_registered: true,
    },
    // whopAccountId / checkoutSessionId / checkoutUrl / checkoutTotal stay
    // NULL: nothing provider-side exists for a demo, and "completed" keeps it
    // outside the status poller's sweep.
  });
  const registrationId = Number(insertResult[0].insertId);
  if (!registrationId) throw new Error("Unable to create the demo registration");

  await db.insert(llcFounders).values({
    registrationId,
    sortOrder: 0,
    isPrimary: true,
    firstName: "Amara",
    lastName: "Johnson",
    email: "amara.johnson@example.com",
    phone: "+14045550137",
    ownershipBasisPoints: 10_000,
    addressLine1: "1847 Peachtree Walk NE",
    addressLine2: null,
    addressCity: "Atlanta",
    addressState: "GA",
    addressPostalCode: "30309",
    addressCountry: "US",
  });

  // History phrased like the real pipeline, with explicit staggered dates.
  const history: Array<{
    fromStatus: "draft" | "ready" | "submitting" | "payment_required" | "processing" | null;
    toStatus: "draft" | "ready" | "submitting" | "payment_required" | "processing" | "completed";
    source: "user" | "system" | "whop";
    note: string;
    createdAt: Date;
  }> = [
    {
      fromStatus: null,
      toStatus: "draft",
      source: "system",
      note: "Registration draft created",
      createdAt: draftAt,
    },
    {
      fromStatus: "draft",
      toStatus: "ready",
      source: "user",
      note: "Registration passed final validation",
      createdAt: readyAt,
    },
    {
      fromStatus: "ready",
      toStatus: "submitting",
      source: "system",
      note: "Acquired the single-flight submission lock",
      createdAt: submittingAt,
    },
    {
      fromStatus: "submitting",
      toStatus: "payment_required",
      source: "whop",
      note: "Provider accepted the filing and issued the wholesale checkout",
      createdAt: acceptedAt,
    },
    {
      fromStatus: "payment_required",
      toStatus: "processing",
      source: "whop",
      note: "Provider is processing the LLC filing",
      createdAt: processingAt,
    },
    {
      fromStatus: "processing",
      toStatus: "completed",
      source: "whop",
      note: "Provider reports the state filing and EIN are both complete",
      createdAt: completedAt,
    },
  ];
  for (const entry of history) {
    await db.insert(llcStatusHistory).values({
      registrationId,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      source: entry.source,
      note: entry.note,
      createdAt: entry.createdAt,
    });
  }

  // Vault: two RELEASED ops-upload documents (SAMPLE-watermarked in-PDF).
  const sampleLine = "SAMPLE DOCUMENT — FOR DEMONSTRATION ONLY";
  const filedOn = formatLongDate(completedAt);

  const articlesPdf = buildDemoPdf({
    title: "Articles of Organization",
    lines: [
      "Amara Rose Apparel LLC",
      "State of Georgia — Secretary of State, Corporations Division",
      `Filed and effective: ${filedOn}`,
      "",
      "The undersigned, acting as organizer of a limited liability company",
      "under the Georgia Limited Liability Company Act, certifies that the",
      "company named above has been duly organized, that a registered agent",
      "has been designated for service of process, and that these Articles",
      "of Organization have been accepted for filing by the Secretary of",
      "State on the date shown above.",
    ],
    footnote: sampleLine,
  });
  await uploadOpsDocument({
    registrationId,
    ownerUserId,
    name: "Articles of Organization",
    label: "Articles of Organization",
    documentType: "articles_of_organization",
    dataBase64: articlesPdf.toString("base64"),
    mimeType: "application/pdf",
  });

  const einPdf = buildDemoPdf({
    title: "EIN Confirmation Letter",
    lines: [
      "Amara Rose Apparel LLC",
      "Formation state: Georgia",
      `Issued: ${filedOn}`,
      "",
      "We have assigned this entity a federal Employer Identification",
      "Number. This number identifies the company for federal tax filings,",
      "banking, and payroll purposes, and should be retained with the",
      "company's permanent records. Use it on all federal correspondence",
      "and filings for the entity named above.",
    ],
    footnote: sampleLine,
  });
  await uploadOpsDocument({
    registrationId,
    ownerUserId,
    name: "EIN Confirmation Letter",
    label: "EIN Confirmation Letter",
    documentType: "ein_confirmation",
    dataBase64: einPdf.toString("base64"),
    mimeType: "application/pdf",
  });

  return { id: registrationId };
}

/**
 * Delete a demo filing and every row attached to it. Refuses anything whose
 * submissionKey does not carry the demo marker — real registrations can
 * never be removed through this path.
 */
export async function deleteDemoFiling(registrationId: number): Promise<{ deleted: true; id: number }> {
  const db = requireDb(await getDb());
  const rows = await db
    .select()
    .from(llcRegistrations)
    .where(eq(llcRegistrations.id, registrationId))
    .limit(1);
  const registration = rows[0];
  if (!registration) throw new Error("Registration not found");
  if (!isDemoSubmissionKey(registration.submissionKey)) {
    throw new DemoGuardError("Only demo filings can be deleted");
  }

  await db.delete(llcDocuments).where(eq(llcDocuments.registrationId, registrationId));
  await db.delete(llcStatusHistory).where(eq(llcStatusHistory.registrationId, registrationId));
  await db
    .delete(llcSubmissionAttempts)
    .where(eq(llcSubmissionAttempts.registrationId, registrationId));
  await db.delete(llcFounders).where(eq(llcFounders.registrationId, registrationId));
  await db.delete(llcRegistrations).where(eq(llcRegistrations.id, registrationId));

  return { deleted: true, id: registrationId };
}

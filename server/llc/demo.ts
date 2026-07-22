import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  llcDocuments,
  llcEmailLog,
  llcFounders,
  llcRegistrations,
  llcStatusHistory,
  llcSubmissionAttempts,
} from "../../drizzle/schema";
import { LLC_STATE_NAMES } from "../../shared/llc";
import { getDb } from "../db";
import { buildStyledDemoPdf } from "./demo-pdf";
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

import {
  DEMO_SUBMISSION_KEY_PREFIX,
  isDemoSubmissionKey,
  isTestRegistration,
} from "./demoMarker";

export { DEMO_SUBMISSION_KEY_PREFIX, isDemoSubmissionKey, isTestRegistration };

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
    legalName: "Amara Rose Stays",
    entitySuffix: "LLC",
    formationState: "GA",
    businessType: "brick_and_mortar",
    industryGroup: "hospitality_and_lodging",
    industryType: "vacation_rental_property",
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
  await attachSampleDocuments({
    registrationId,
    ownerUserId,
    companyName: "Amara Rose Stays LLC",
    stateName: "Georgia",
    filedOn: completedAt,
    memberName: "Amara Johnson",
  });

  return { id: registrationId };
}

/**
 * Attach the two SAMPLE-watermarked vault PDFs (Articles + EIN letter) to a
 * demonstration registration, released immediately. Shared by the instant
 * demo filing and the moment an admin test run advances to completed.
 */
export interface SampleDocumentParams {
  companyName: string;
  stateName: string;
  filedOn: Date;
  memberName?: string;
}

export const SAMPLE_DOCUMENT_TYPES = [
  "articles_of_organization",
  "ein_confirmation",
  "operating_agreement",
  "welcome_kit",
] as const;

const SAMPLE_DOCUMENT_META: Record<
  (typeof SAMPLE_DOCUMENT_TYPES)[number],
  { name: string; label: string }
> = {
  articles_of_organization: { name: "Articles of Organization", label: "Articles of Organization" },
  ein_confirmation: { name: "EIN Confirmation Letter", label: "EIN Confirmation Letter" },
  operating_agreement: { name: "Operating Agreement", label: "Operating Agreement" },
  welcome_kit: { name: "LLC Welcome Kit", label: "Welcome kit & next steps" },
};

/**
 * Deterministically build one SAMPLE deliverable PDF from registration data.
 * Used both when documents are attached to the vault AND to regenerate a
 * document on demand — sample documents never depend on external storage
 * being reachable. Returns null for unknown document types.
 */
export function buildSampleDocumentPdf(
  documentType: string,
  params: SampleDocumentParams,
): Buffer | null {
  const sampleLine = "SAMPLE DOCUMENT — FOR DEMONSTRATION ONLY";
  const filedOn = formatLongDate(params.filedOn);
  const memberName = params.memberName?.trim() || "Member of Record";
  const company = params.companyName;
  const state = params.stateName;

  switch (documentType) {
    case "articles_of_organization":
      return buildStyledDemoPdf({
        footnote: sampleLine,
        pages: [
          {
            border: "certificate",
            blocks: [
              { kind: "eyebrow", text: `State of ${state} — Secretary of State` },
              { kind: "title", text: "Articles of Organization" },
              { kind: "rule" },
              {
                kind: "meta",
                rows: [
                  ["Entity name", company],
                  ["Filing number", "SAMPLE-000000"],
                  ["Filed and effective", filedOn],
                  ["Duration", "Perpetual"],
                ],
              },
              { kind: "heading", text: "Article I — Name" },
              {
                kind: "para",
                lines: [`The name of the limited liability company is ${company}.`],
              },
              { kind: "heading", text: "Article II — Purpose" },
              {
                kind: "para",
                lines: [
                  "The company is organized for any lawful purpose permitted under",
                  "the state's Limited Liability Company Act.",
                ],
              },
              { kind: "heading", text: "Article III — Registered Agent" },
              {
                kind: "para",
                lines: [
                  "A commercial registered agent has been designated to receive",
                  "service of process and official state correspondence.",
                ],
              },
              { kind: "heading", text: "Article IV — Management" },
              {
                kind: "para",
                lines: ["The company is managed by its members."],
              },
              { kind: "space", pt: 8 },
              {
                kind: "para",
                lines: [
                  "The undersigned certifies that these Articles of Organization have",
                  "been accepted for filing and that the company named above is duly",
                  "organized as of the effective date shown.",
                ],
              },
              {
                kind: "signature",
                name: "Registrar of Corporations",
                role: "Office of the Secretary of State",
                date: filedOn,
              },
            ],
          },
        ],
      });
    case "ein_confirmation":
      return buildStyledDemoPdf({
        footnote: sampleLine,
        pages: [
          {
            border: "certificate",
            blocks: [
              { kind: "eyebrow", text: "Federal Tax Registration — Confirmation of Assignment" },
              { kind: "title", text: "EIN Confirmation Letter" },
              { kind: "rule" },
              {
                kind: "meta",
                rows: [
                  ["Legal name", company],
                  ["Formation state", state],
                  ["Date issued", filedOn],
                  ["Sample EIN", "00-0000000"],
                ],
              },
              {
                kind: "para",
                lines: [
                  "We have assigned this entity the Employer Identification Number",
                  "shown above. This number identifies the company for federal tax",
                  "filings, banking, and payroll purposes.",
                ],
              },
              { kind: "heading", text: "Keep this letter with your records" },
              {
                kind: "para",
                lines: [
                  "Your bank will ask for this letter when you open the business",
                  "account. Store it with the company's permanent records alongside",
                  "your Articles of Organization and operating agreement.",
                ],
              },
              { kind: "heading", text: "Using your EIN" },
              {
                kind: "para",
                lines: [
                  "Use the number and the company's exact legal name on all federal",
                  "correspondence, tax deposits, and returns for the entity named",
                  "above. The name and EIN on every filing must match this letter",
                  "exactly.",
                ],
              },
            ],
          },
        ],
      });
    case "operating_agreement":
      return buildStyledDemoPdf({
        footnote: sampleLine,
        pages: [
          {
            blocks: [
              { kind: "eyebrow", text: "Limited Liability Company Operating Agreement" },
              { kind: "title", text: "Operating Agreement" },
              { kind: "rule" },
              {
                kind: "meta",
                rows: [
                  ["Company", company],
                  ["Jurisdiction", `State of ${state}`],
                  ["Effective date", filedOn],
                ],
              },
              { kind: "heading", text: "Article I — Formation" },
              {
                kind: "para",
                lines: [
                  "1.1  The member(s) formed this limited liability company under the",
                  `laws of the State of ${state}. The rights and duties of the member(s)`,
                  "are governed by this agreement and by state law.",
                  "1.2  The company continues until dissolved under Article VII.",
                ],
              },
              { kind: "heading", text: "Article II — Name and Principal Office" },
              {
                kind: "para",
                lines: [
                  `2.1  The company operates under the name ${company}.`,
                  "2.2  The principal office is the address on file with the state and",
                  "may be changed by the member(s) at any time.",
                ],
              },
              { kind: "heading", text: "Article III — Purpose" },
              {
                kind: "para",
                lines: [
                  "3.1  The company may engage in any lawful business activity,",
                  "including the ownership and operation of rental property.",
                ],
              },
            ],
          },
          {
            blocks: [
              { kind: "heading", text: "Article IV — Members and Ownership" },
              {
                kind: "para",
                lines: [
                  "4.1  The member(s) of record and their ownership percentages are",
                  "maintained in the company's records.",
                  `4.2  The primary member of record is ${memberName}.`,
                ],
              },
              { kind: "heading", text: "Article V — Capital, Profits, and Distributions" },
              {
                kind: "para",
                lines: [
                  "5.1  Initial capital contributions are recorded in the company",
                  "records. No member is required to contribute additional capital.",
                  "5.2  Profits and losses are allocated in proportion to ownership.",
                  "5.3  Distributions are made at the times and in the amounts the",
                  "member(s) determine, after providing for company obligations.",
                ],
              },
              { kind: "heading", text: "Article VI — Management and Banking" },
              {
                kind: "para",
                lines: [
                  "6.1  The company is managed by its member(s), who may open bank",
                  "accounts, sign contracts, and act for the company.",
                  "6.2  Company funds are kept separate from personal funds and are",
                  "used only for company purposes.",
                ],
              },
            ],
          },
          {
            blocks: [
              { kind: "heading", text: "Article VII — Transfers and Dissolution" },
              {
                kind: "para",
                lines: [
                  "7.1  No member may transfer an interest in the company without the",
                  "written consent of the remaining member(s).",
                  "7.2  The company dissolves upon the written election of the",
                  "member(s), followed by winding up and filing with the state.",
                ],
              },
              { kind: "heading", text: "Article VIII — General Provisions" },
              {
                kind: "para",
                lines: [
                  "8.1  This agreement is the entire agreement of the member(s) and is",
                  `governed by the laws of the State of ${state}.`,
                  "8.2  Amendments must be in writing and signed by the member(s).",
                ],
              },
              { kind: "space", pt: 16 },
              {
                kind: "para",
                lines: [
                  "IN WITNESS WHEREOF, the undersigned adopts this agreement as of",
                  "the effective date above.",
                ],
              },
              {
                kind: "signature",
                name: memberName,
                role: "Member",
                date: filedOn,
              },
            ],
          },
        ],
      });
    case "welcome_kit":
      return buildStyledDemoPdf({
        footnote: sampleLine,
        pages: [
          {
            blocks: [
              { kind: "eyebrow", text: "Your formation is complete" },
              { kind: "title", text: "Your LLC Welcome Kit" },
              { kind: "rule" },
              {
                kind: "meta",
                rows: [
                  ["Company", company],
                  ["Formed in", state],
                  ["Completed", filedOn],
                ],
              },
              {
                kind: "para",
                lines: [
                  "Congratulations — your company is official. Here is what's in your",
                  "vault and what to do next.",
                ],
              },
              { kind: "heading", text: "What's in your vault" },
              {
                kind: "para",
                lines: [
                  "1.  Articles of Organization — your company's birth certificate.",
                  "     Banks and lenders will ask for this.",
                  "2.  EIN Confirmation Letter — your federal tax ID. Required to open",
                  "     the business bank account and to run payroll.",
                  "3.  Operating Agreement — sign it and keep it with your records.",
                  "     Many banks ask for it at account opening.",
                ],
              },
              { kind: "heading", text: "Next steps this week" },
              {
                kind: "para",
                lines: [
                  "•  Open a business checking account (bring items 1 and 2).",
                  "•  Sign the operating agreement in front of all members.",
                  "•  Run business income and expenses through the new account only.",
                  "•  Calendar your state's annual report due date.",
                ],
              },
              {
                kind: "para",
                lines: [
                  "Questions? Reply to any email from our team — we're with you",
                  "through every step.",
                ],
              },
              {
                kind: "signature",
                name: "The Coach Inayah Team",
                role: "Business Formation",
                date: filedOn,
              },
            ],
          },
        ],
      });
    default:
      return null;
  }
}

export async function attachSampleDocuments(params: {
  registrationId: number;
  ownerUserId: number;
  companyName: string;
  stateName: string;
  filedOn: Date;
  /** Primary member's display name for the agreement's signature block. */
  memberName?: string;
}): Promise<void> {
  // Idempotent: a retried advance (e.g. after a storage hiccup) only attaches
  // whichever documents are still missing — never duplicates.
  const db = requireDb(await getDb());
  const existing = await db
    .select({ documentType: llcDocuments.documentType })
    .from(llcDocuments)
    .where(eq(llcDocuments.registrationId, params.registrationId));
  const existingTypes = new Set(existing.map((row) => row.documentType));

  for (const documentType of SAMPLE_DOCUMENT_TYPES) {
    if (existingTypes.has(documentType)) continue;
    const pdf = buildSampleDocumentPdf(documentType, params);
    if (!pdf) continue;
    const meta = SAMPLE_DOCUMENT_META[documentType];
    await uploadOpsDocument({
      registrationId: params.registrationId,
      ownerUserId: params.ownerUserId,
      name: meta.name,
      label: meta.label,
      documentType,
      dataBase64: pdf.toString("base64"),
      mimeType: "application/pdf",
    });
  }
}

/** Display name for a formation-state code in sample documents. */
export function demoStateName(stateCode: string | null): string {
  if (stateCode && stateCode in LLC_STATE_NAMES) {
    return LLC_STATE_NAMES[stateCode as keyof typeof LLC_STATE_NAMES];
  }
  return stateCode ?? "your state";
}

/**
 * Delete a demo/test filing and every row attached to it. Refuses anything
 * that is neither demo-keyed nor a test run — real registrations can never
 * be removed through this path.
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
  if (!isTestRegistration(registration)) {
    throw new DemoGuardError("Only demo filings can be deleted");
  }

  // Test runs create email-log rows the instant demo never does; clear them
  // so a reused registration id can never inherit stale send-once claims.
  await db.delete(llcEmailLog).where(eq(llcEmailLog.registrationId, registrationId));
  await db.delete(llcDocuments).where(eq(llcDocuments.registrationId, registrationId));
  await db.delete(llcStatusHistory).where(eq(llcStatusHistory.registrationId, registrationId));
  await db
    .delete(llcSubmissionAttempts)
    .where(eq(llcSubmissionAttempts.registrationId, registrationId));
  await db.delete(llcFounders).where(eq(llcFounders.registrationId, registrationId));
  await db.delete(llcRegistrations).where(eq(llcRegistrations.id, registrationId));

  return { deleted: true, id: registrationId };
}

/**
 * Doola filing lifecycle — the bill-first flow.
 *
 * Unlike the Whop path (submit → wholesale checkout → ops pays → provider
 * files), Doola charges the partner AT SUBMISSION. So a Doola registration
 * holds at payment_required with ZERO provider interaction until the client's
 * retail payment is confirmed; `fileDoolaRegistration` then performs the
 * actual filing (create customer → create company) exactly once. From there,
 * webhooks and the poller drive status through `refreshDoolaRegistrationStatus`.
 */
import { randomUUID } from "node:crypto";
import {
  createSubmissionAttempt,
  countSubmissionAttempts,
  finishSubmissionAttempt,
  getLlcRegistrationById,
  transitionLlcStatus,
  updateLlcRegistrationProviderFields,
} from "./store";
import {
  DoolaApiError,
  DoolaConfigurationError,
  createDoolaCompany,
  createDoolaCustomer,
  getDoolaDocumentDownload,
  listDoolaDocuments,
  normalizeDoolaCompanyStatus,
  retrieveDoolaCompany,
} from "./doola";
import { isFormationStatusRegression } from "./whop";
import { mirrorFormationDocuments, uploadOpsDocument } from "./documents";
import { sendOpsAlert, statusChangeAlert, submissionProblemAlert } from "../ops/notify";
import { sendFormationCompleteEmail } from "./clientEmails";
import { buildClientOperatingAgreementPdf, demoStateName } from "./demo";
import { llcDocuments } from "../../drizzle/schema";
import { getDb } from "../db";
import { and, eq } from "drizzle-orm";
import type { LlcStatus } from "../../shared/llc";

/**
 * File a paid Doola registration. Idempotent and single-flight: the
 * payment_required → submitting transition is the lock, the stored
 * submissionKey drives Doola's Idempotency-Key replay, and stored
 * doolaCustomerId/doolaCompanyId are never re-created.
 */
export async function fileDoolaRegistration(params: {
  userId: number;
  registrationId: number;
}): Promise<
  | { outcome: "filed"; doolaCompanyId: string }
  | { outcome: "already_filed"; doolaCompanyId: string }
  | { outcome: "not_ready"; reason: string }
  | { outcome: "failed"; message: string }
> {
  const bundle = await getLlcRegistrationById(params.userId, params.registrationId);
  if (!bundle) return { outcome: "not_ready", reason: "Registration not found" };
  const registration = bundle.registration;

  if (registration.isTest) {
    return { outcome: "not_ready", reason: "Test filings never reach the provider" };
  }
  if (registration.provider !== "doola") {
    return { outcome: "not_ready", reason: "Not a Doola registration" };
  }
  if (registration.doolaCompanyId) {
    return { outcome: "already_filed", doolaCompanyId: registration.doolaCompanyId };
  }
  if (!registration.retailPaidAt) {
    return { outcome: "not_ready", reason: "Retail payment has not been confirmed" };
  }

  // Single-flight lock: only one caller wins payment_required → submitting.
  const lock = await transitionLlcStatus({
    userId: params.userId,
    registrationId: params.registrationId,
    toStatus: "submitting",
    source: "system",
    note: "Filing with the formation service (retail payment confirmed)",
    expectedStatuses: ["payment_required", "failed"],
    updates: { lastErrorType: null, lastErrorMessage: null, retryable: false },
  });
  if (!lock.changed) {
    return { outcome: "not_ready", reason: "The filing is already in progress" };
  }

  const submissionKey = lock.registration.submissionKey ?? randomUUID().replaceAll("-", "");
  if (!lock.registration.submissionKey) {
    await updateLlcRegistrationProviderFields(params.userId, params.registrationId, {
      submissionKey,
    });
  }

  const attemptNumber = (await countSubmissionAttempts(params.registrationId)) + 1;
  const attemptId = await createSubmissionAttempt({
    registrationId: params.registrationId,
    attemptNumber,
    submissionKey,
    phase: "llc_registration",
  });

  try {
    let doolaCustomerId = lock.registration.doolaCustomerId;
    if (!doolaCustomerId) {
      const customer = await createDoolaCustomer({
        registration: lock.registration,
        founders: bundle.founders,
        idempotencyKey: `${submissionKey}-customer`,
      });
      doolaCustomerId = customer.doolaCustomerId;
      await updateLlcRegistrationProviderFields(params.userId, params.registrationId, {
        doolaCustomerId,
      });
    }

    const company = await createDoolaCompany({
      registration: lock.registration,
      founders: bundle.founders,
      doolaCustomerId,
      idempotencyKey: `${submissionKey}-company`,
    });
    const doolaCompanyId =
      typeof company.doolaCompanyId === "string" ? company.doolaCompanyId : null;
    if (!doolaCompanyId) {
      throw new DoolaApiError({
        message: "The filing service returned no company id.",
        httpStatus: null,
        code: "E_MALFORMED_RESPONSE",
        retryable: false,
      });
    }

    const normalized = normalizeDoolaCompanyStatus(company);
    await updateLlcRegistrationProviderFields(params.userId, params.registrationId, {
      doolaCompanyId,
      providerStatus: normalized.snapshot,
      lastProviderSyncAt: new Date(),
      submittedAt: new Date(),
    });
    await finishSubmissionAttempt({
      attemptId,
      outcome: "succeeded",
      httpStatus: 201,
      providerObjectId: doolaCompanyId,
    });
    await transitionLlcStatus({
      userId: params.userId,
      registrationId: params.registrationId,
      toStatus: "processing",
      source: "system",
      note: "The formation service accepted the filing",
      expectedStatuses: ["submitting"],
      updates: { lastErrorType: null, lastErrorMessage: null, retryable: false },
    });
    return { outcome: "filed", doolaCompanyId };
  } catch (error) {
    const isConfig = error instanceof DoolaConfigurationError;
    const api = error instanceof DoolaApiError ? error : null;
    const retryable = Boolean(api?.retryable) && !isConfig;
    const errorType = isConfig
      ? "provider_configuration"
      : (api?.code ?? "provider_failure").toLowerCase();

    await finishSubmissionAttempt({
      attemptId,
      outcome: retryable ? "retryable_failure" : "action_required",
      httpStatus: api?.httpStatus ?? undefined,
      errorType,
      safeMessage: "The filing could not be submitted.",
      retryable,
    }).catch(() => {});

    await transitionLlcStatus({
      userId: params.userId,
      registrationId: params.registrationId,
      toStatus: "failed",
      source: "system",
      note: "The formation service rejected or could not accept the filing",
      expectedStatuses: ["submitting"],
      updates: {
        lastErrorType: errorType,
        lastErrorMessage:
          "Your filing needs a quick review by our team. Nothing further is needed from you right now.",
        retryable,
      },
    }).catch(() => {});

    await sendOpsAlert(
      submissionProblemAlert({
        registrationId: params.registrationId,
        legalName: `${registration.legalName ?? "Unknown"} ${registration.entitySuffix}`,
        errorType,
        message:
          "Doola filing failed AFTER retail payment was collected — review and retry from the order page.",
        uncertain: !retryable,
      }),
    ).catch(() => {});

    return { outcome: "failed", message: "The filing could not be submitted." };
  }
}

const REFRESHABLE: LlcStatus[] = ["payment_required", "processing", "action_required", "submitting"];

/**
 * Pull current state from Doola, enrich document download URLs (Doola issues
 * them per document with ~1h validity), mirror new documents into the vault
 * (HELD until ops release), and advance the local status under the monotonic
 * guard. Used by the poller, manual refresh, and webhook processing.
 */
export async function refreshDoolaRegistrationStatus(params: {
  userId: number;
  registrationId: number;
}): Promise<{ refreshed: boolean; changed: boolean }> {
  const bundle = await getLlcRegistrationById(params.userId, params.registrationId);
  if (!bundle) return { refreshed: false, changed: false };
  const registration = bundle.registration;
  if (registration.isTest || registration.provider !== "doola" || !registration.doolaCompanyId) {
    return { refreshed: false, changed: false };
  }

  const company = await retrieveDoolaCompany(registration.doolaCompanyId);

  // Enrich each known document with a fresh short-lived download URL so the
  // shared mirror can fetch bytes; failures skip that document this sweep.
  let documents = await listDoolaDocuments(registration.doolaCompanyId).catch(() => []);
  documents = await Promise.all(
    documents.slice(0, 20).map(async (document) => {
      if (!document.id || document.downloadUrl) return document;
      try {
        const withUrl = await getDoolaDocumentDownload(
          registration.doolaCompanyId as string,
          document.id,
        );
        return { ...document, downloadUrl: withUrl.downloadUrl };
      } catch {
        return document;
      }
    }),
  );

  const normalized = normalizeDoolaCompanyStatus(company, documents);

  await updateLlcRegistrationProviderFields(params.userId, params.registrationId, {
    providerStatus: normalized.snapshot,
    lastProviderSyncAt: new Date(),
    ...(normalized.ein ? { ein: normalized.ein } : {}),
  });

  await mirrorFormationDocuments({
    userId: params.userId,
    registrationId: params.registrationId,
    snapshot: normalized.snapshot,
  }).catch(() => ({ mirrored: 0, skipped: 0 }));

  const nextStatus = normalized.localStatus;
  const currentStatus = registration.status as LlcStatus;
  if (
    !nextStatus ||
    nextStatus === currentStatus ||
    !REFRESHABLE.includes(currentStatus) ||
    isFormationStatusRegression(currentStatus, nextStatus)
  ) {
    return { refreshed: true, changed: false };
  }

  const transition = await transitionLlcStatus({
    userId: params.userId,
    registrationId: params.registrationId,
    toStatus: nextStatus,
    source: "system",
    note: normalized.note,
    expectedStatuses: [currentStatus],
    updates:
      nextStatus === "completed" || nextStatus === "processing"
        ? { lastErrorType: null, lastErrorMessage: null, retryable: false }
        : {},
  });
  if (!transition.changed) return { refreshed: true, changed: false };

  if (nextStatus === "completed") {
    void sendFormationCompleteEmail({
      userId: params.userId,
      registrationId: params.registrationId,
    }).catch(() => {});
    // WHITE-LABEL: the provider's generated operating agreement names the
    // provider's own legal entity in its organizer block — it must never be
    // released. Generate OUR branded agreement from the filing's own data
    // (held for ops review) and flag the provider copy in the review queue.
    void attachClientOperatingAgreement({
      userId: params.userId,
      registrationId: params.registrationId,
    }).catch((error) => {
      console.error("[Doola] client OA generation failed", {
        registrationId: params.registrationId,
        error: error instanceof Error ? error.name : "UnknownError",
      });
    });
  }
  await sendOpsAlert(
    statusChangeAlert({
      registrationId: params.registrationId,
      legalName: `${registration.legalName ?? "Unknown"} ${registration.entitySuffix}`,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      note: normalized.note,
      snapshot: normalized.snapshot,
    }),
  ).catch(() => {});

  return { refreshed: true, changed: true };
}


/**
 * Attach the company's client-facing operating agreement (generated from the
 * filing's own data, no provider branding, HELD for ops release) and mark
 * the provider's mirrored agreement as an internal copy.
 */
export async function attachClientOperatingAgreement(params: {
  userId: number;
  registrationId: number;
}): Promise<void> {
  const bundle = await getLlcRegistrationById(params.userId, params.registrationId);
  if (!bundle) return;
  const registration = bundle.registration;
  if (registration.isTest) return;

  const existing = await listOpsDocumentTypes(params.registrationId);
  if (!existing.has("operating_agreement:ops_upload")) {
    const companyName = `${registration.legalName ?? "Your Company"} ${registration.entitySuffix}`;
    const pdf = buildClientOperatingAgreementPdf({
      companyName,
      stateName: demoStateName(registration.formationState),
      effectiveDate: new Date(),
      members: bundle.founders.map((founder) => ({
        name: `${founder.firstName ?? ""} ${founder.lastName ?? ""}`.trim() || "Member of Record",
        ownershipPercent: (founder.ownershipBasisPoints ?? 0) / 100,
      })),
    });
    await uploadOpsDocument({
      registrationId: params.registrationId,
      ownerUserId: params.userId,
      name: "Operating Agreement",
      label: "Operating Agreement",
      documentType: "operating_agreement",
      dataBase64: pdf.toString("base64"),
      mimeType: "application/pdf",
      release: false,
    });
  }

  await flagProviderOperatingAgreementCopies(params.registrationId);
}

async function listOpsDocumentTypes(registrationId: number): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();
  const rows = await db
    .select({ documentType: llcDocuments.documentType, source: llcDocuments.source })
    .from(llcDocuments)
    .where(eq(llcDocuments.registrationId, registrationId));
  return new Set(rows.map((row) => `${row.documentType}:${row.source}`));
}

/** Provider-mirrored operating agreements get an unmistakable review label. */
async function flagProviderOperatingAgreementCopies(registrationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(llcDocuments)
    .set({ label: "Operating agreement — PROVIDER COPY, do not release" })
    .where(
      and(
        eq(llcDocuments.registrationId, registrationId),
        eq(llcDocuments.documentType, "operating_agreement"),
        eq(llcDocuments.source, "provider"),
      ),
    );
}

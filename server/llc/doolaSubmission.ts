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
  UNCERTAIN_ERROR_PREFIX,
} from "./store";
import {
  DoolaApiError,
  DoolaConfigurationError,
  createDoolaCompany,
  createDoolaCustomer,
  getDoolaDocumentDownload,
  getDoolaEnvironment,
  listDoolaDocuments,
  normalizeDoolaCompanyStatus,
  retrieveDoolaCompany,
} from "./doola";
import { isFormationStatusRegression } from "./whop";
import {
  mirrorFormationDocuments,
  setDocumentReleased,
  uploadOpsDocument,
} from "./documents";
import { sendOpsAlert, statusChangeAlert, submissionProblemAlert } from "../ops/notify";
import { sendDocumentsReleasedEmail, sendFormationCompleteEmail } from "./clientEmails";
import { buildClientOperatingAgreementPdf, demoStateName } from "./demo";
import { isTestRegistration } from "./demoMarker";
import { llcDocuments } from "../../drizzle/schema";
import { getDb } from "../db";
import { and, eq, isNull } from "drizzle-orm";
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

  // Environment fence: a row stamped for one environment must never file
  // against the other (e.g. a sandbox-era test order after the production
  // cutover). Resolved BEFORE the lock so a mismatch changes nothing.
  let environment: ReturnType<typeof getDoolaEnvironment>;
  try {
    environment = getDoolaEnvironment();
  } catch {
    return { outcome: "not_ready", reason: "The filing service is not configured" };
  }
  if (registration.doolaEnv && registration.doolaEnv !== environment) {
    await sendOpsAlert(
      submissionProblemAlert({
        registrationId: params.registrationId,
        legalName: `${registration.legalName ?? "Unknown"} ${registration.entitySuffix}`,
        errorType: "environment_mismatch",
        message: `Filing refused: this order was created against the ${registration.doolaEnv} environment but the app is now configured for ${environment}. If it is a leftover test order, delete or ignore it; it will never file automatically.`,
        uncertain: true,
      }),
    ).catch(() => {});
    return {
      outcome: "not_ready",
      reason: "This order belongs to a different filing environment",
    };
  }

  // Single-flight lock: only one caller wins payment_required → submitting.
  // The environment stamp rides the same write, so a row is fenced from the
  // moment it first heads toward a provider.
  const lock = await transitionLlcStatus({
    userId: params.userId,
    registrationId: params.registrationId,
    toStatus: "submitting",
    source: "system",
    note: "Filing with the formation service (retail payment confirmed)",
    expectedStatuses: ["payment_required", "failed"],
    updates: {
      lastErrorType: null,
      lastErrorMessage: null,
      retryable: false,
      doolaEnv: environment,
    },
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
    // Transport-uncertain outcomes (timeout/network drop mid-create, a
    // malformed create response, or any unexpected throw) may have created
    // the company provider-side even though we never saw the id. The
    // uncertain_ prefix freezes client EDITS (which would rotate the
    // idempotency key and defeat replay dedupe) while plain retries stay
    // safe — they replay the SAME stored submissionKey.
    const uncertainOutcome =
      !isConfig &&
      (api === null ||
        api.code === "E_TIMEOUT" ||
        api.code === "E_NETWORK" ||
        api.code === "E_MALFORMED_RESPONSE");
    const errorType = isConfig
      ? "provider_configuration"
      : `${uncertainOutcome ? UNCERTAIN_ERROR_PREFIX : ""}${(api?.code ?? "provider_failure").toLowerCase()}`;

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
        message: uncertainOutcome
          ? "Doola filing outcome is UNCERTAIN after retail payment (the request may have landed provider-side). Retry from the order page is safe — it replays the same idempotency key. Do NOT edit the order first."
          : "Doola filing failed AFTER retail payment was collected — review and retry from the order page.",
        uncertain: uncertainOutcome || !retryable,
      }),
    ).catch(() => {});

    return { outcome: "failed", message: "The filing could not be submitted." };
  }
}

const REFRESHABLE: LlcStatus[] = ["payment_required", "processing", "action_required", "submitting"];

/**
 * Pull current state from Doola, enrich document download URLs (Doola issues
 * them per document with ~1h validity), mirror new documents into the vault
 * (auto-released same sweep, provider OA copies excepted), and advance the
 * local status under the monotonic guard. Used by the poller, manual
 * refresh, and webhook processing.
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
  // Environment fence: a company created in the other environment does not
  // exist here — asking would 404 on every sweep forever. Rows without a
  // stamp (pre-fence history) still refresh normally.
  if (registration.doolaEnv) {
    try {
      if (registration.doolaEnv !== getDoolaEnvironment()) {
        return { refreshed: false, changed: false };
      }
    } catch {
      return { refreshed: false, changed: false };
    }
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

  // AUTO-RELEASE (operator decision 2026-08-06): document release is
  // automatic — the manual ops gate once left a completed order's EIN letter
  // and operating agreement held and invisible while the completion email
  // was already out. Runs on EVERY refresh over held rows, so pre-decision
  // orders heal on their first poll after deploy. Provider OA copies stay
  // locked forever (see isAutoReleasableHeldDocument).
  await autoReleaseFormationDocuments({
    userId: params.userId,
    registrationId: params.registrationId,
  }).catch(() => ({ released: 0 }));

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
    // (released immediately) and flag the provider copy so it stays locked.
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
 * Can this HELD document auto-release? (operator decision 2026-08-06)
 *
 * NEVER: the provider's own operating agreement — it names the provider's
 * legal entity in its organizer block. That class is exactly what
 * flagProviderOperatingAgreementCopies labels (documentType
 * "operating_agreement" + source "provider"), so the structural match is
 * checked alongside the label: a provider OA mirrored moments ago, before
 * the completion-time flagging pass, must still stay locked.
 *
 * NEVER: a document ops MANUALLY unreleased. That write stamps opsHeldAt
 * (see setDocumentReleased), and the hold is durable — the sweep would
 * otherwise re-release it on the very next poll, so ops could never win an
 * argument with the robot. Redundant with the isNull(opsHeldAt) clause in
 * the sweep's own query, deliberately: the hold holds even if a future
 * caller hands this predicate an unfiltered row.
 *
 * YES: every other provider-mirrored document (articles, EIN letter, RA
 * mail, …) and our own branded operating agreement (source "ops_upload",
 * attached by attachClientOperatingAgreement under the
 * 'operating_agreement:ops_upload' dedupe key).
 */
export function isAutoReleasableHeldDocument(document: {
  source: string | null;
  documentType: string | null;
  label: string | null;
  opsHeldAt?: Date | null;
}): boolean {
  // A manual ops unrelease outranks everything else about the row.
  if (document.opsHeldAt) return false;
  // Any do-not-release marker (flagProviderOperatingAgreementCopies, or an
  // ops-applied label) locks the row regardless of source.
  if (document.label && /provider copy|do not release/i.test(document.label)) {
    return false;
  }
  if (document.source === "provider") {
    return document.documentType !== "operating_agreement";
  }
  return (
    document.source === "ops_upload" &&
    document.documentType === "operating_agreement"
  );
}

/**
 * Auto-release sweep: release every held releasable document for the
 * registration using the same store-level operation as the manual ops
 * release (setDocumentReleased), then notify — client email first-class
 * (batched + send-once inside the sender), plus a one-line ops alert.
 * Test/demo registrations never release or email.
 *
 * Rows ops manually unreleased are excluded by the query itself
 * (isNull(opsHeldAt)) so the sweep can neither re-release them nor clear
 * their hold.
 */
export async function autoReleaseFormationDocuments(params: {
  userId: number;
  registrationId: number;
}): Promise<{ released: number }> {
  const bundle = await getLlcRegistrationById(params.userId, params.registrationId);
  if (!bundle) return { released: 0 };
  if (isTestRegistration(bundle.registration)) return { released: 0 };

  const db = await getDb();
  if (!db) return { released: 0 };
  const held = await db
    .select({
      id: llcDocuments.id,
      source: llcDocuments.source,
      documentType: llcDocuments.documentType,
      label: llcDocuments.label,
      opsHeldAt: llcDocuments.opsHeldAt,
    })
    .from(llcDocuments)
    .where(
      and(
        eq(llcDocuments.registrationId, params.registrationId),
        isNull(llcDocuments.releasedAt),
        // Durable ops hold: never re-release what ops deliberately pulled.
        isNull(llcDocuments.opsHeldAt),
      ),
    );

  const releasable = held.filter(isAutoReleasableHeldDocument);
  let released = 0;
  for (const document of releasable) {
    await setDocumentReleased(document.id, true);
    released += 1;
  }
  if (released === 0) return { released };

  // Ordering: every release above has committed before either notification
  // fires, so the email's document list can never precede visibility.
  void sendDocumentsReleasedEmail({
    userId: params.userId,
    registrationId: params.registrationId,
  }).catch(() => {});
  await sendOpsAlert({
    subject: `Documents auto-released (order #${params.registrationId})`,
    lines: [
      `Auto-released ${released} document(s) for order #${params.registrationId} — provider OA copies remain locked.`,
    ],
  }).catch(() => {});

  return { released };
}

/**
 * Attach the company's client-facing operating agreement (generated from the
 * filing's own data, no provider branding, released immediately — operator
 * decision 2026-08-06) and mark the provider's mirrored agreement as an
 * internal copy that never releases.
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
      // Auto-release policy (2026-08-06): the branded client OA goes straight
      // to the vault — holding it once stranded a completed order's documents.
      release: true,
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

import { isRegistrationEditable } from "./store";
import { isDemoSubmissionKey } from "./demoMarker";
import type { getLlcRegistrationById, listLlcRegistrationsForUser } from "./store";
import { decryptPii, maskSsn } from "./pii";
import type { LlcDraft } from "../../shared/llc";
import { LLC_CLIENT_STATUS_LABELS, LLC_STATUS_LABELS } from "../../shared/llc";
import type { WhopFormationSnapshot } from "./whop";

type RegistrationBundle = NonNullable<
  Awaited<ReturnType<typeof getLlcRegistrationById>>
>;

type RegistrationRow = Awaited<
  ReturnType<typeof listLlcRegistrationsForUser>
>[number];

function text(value: string | null | undefined): string {
  return value ?? "";
}

/**
 * Belt-and-braces for rows written before the white-label conversion: any
 * stored error text naming the provider is replaced with neutral copy before
 * it can reach a client.
 */
function clientSafeErrorMessage(message: string | null): string | null {
  if (!message) return message;
  return /whop/i.test(message)
    ? "Our team is reviewing this filing. No action is needed from you right now."
    : message;
}

export function bundleToDraft(bundle: RegistrationBundle): LlcDraft {
  const { registration, founders } = bundle;

  return {
    currentStep: Math.min(6, Math.max(1, registration.currentStep)),
    legalName: text(registration.legalName),
    entitySuffix: registration.entitySuffix,
    formationState: text(registration.formationState),
    businessType: text(registration.businessType),
    industryGroup: text(registration.industryGroup),
    industryType: text(registration.industryType),
    businessPhone: text(registration.businessPhone),
    website: text(registration.website),
    useRegisteredAgent: registration.useRegisteredAgent,
    companyAddress: {
      line1: text(registration.companyAddressLine1),
      line2: text(registration.companyAddressLine2),
      city: text(registration.companyAddressCity),
      state: text(registration.companyAddressState),
      postalCode: text(registration.companyAddressPostalCode),
      country: registration.companyAddressCountry || "US",
    },
    expediteEin: registration.expediteEin,
    accuracyAttested: registration.accuracyAttested,
    founders: founders.map((founder) => ({
      isPrimary: founder.isPrimary,
      firstName: text(founder.firstName),
      lastName: text(founder.lastName),
      email: text(founder.email),
      phone: text(founder.phone),
      ssn: decryptPii(founder.ssnEncrypted) ?? "",
      ownershipPercentage:
        founder.ownershipBasisPoints === null
          ? undefined
          : founder.ownershipBasisPoints / 100,
      address: {
        line1: text(founder.addressLine1),
        line2: text(founder.addressLine2),
        city: text(founder.addressCity),
        state: text(founder.addressState),
        postalCode: text(founder.addressPostalCode),
        country: founder.addressCountry || "US",
      },
    })),
  };
}

/**
 * Client-facing view. Deliberately excludes everything about the wholesale
 * leg: the provider's name, checkout URL, wholesale total, provider IDs, and
 * internal history notes. Clients see their order reference and clean labels.
 */
export function bundleToRegistrationView(bundle: RegistrationBundle) {
  const { registration, history } = bundle;
  const requiredActions = bundle.requiredActions ?? [];

  return {
    id: registration.id,
    orderRef: `NF-${String(registration.id).padStart(4, "0")}`,
    draft: bundleToDraft(bundle),
    status: registration.status,
    statusLabel: LLC_CLIENT_STATUS_LABELS[registration.status],
    canEdit: isRegistrationEditable(registration),
    canRetry: registration.retryable,
    safeErrorMessage: clientSafeErrorMessage(registration.lastErrorMessage),
    // Retail is client-facing by definition (it's the price the client saw at
    // submit); the wholesale checkout stays ops-only.
    retailPriceCents: registration.retailPriceCents ?? null,
    paid: Boolean(registration.retailPaidAt),
    // Admin test runs only; always false for real registrations, so exposing
    // it client-side reveals nothing about anyone's real order.
    isTest: Boolean(registration.isTest),
    // Any demonstration row (instant demo or test run) — drives sample-only
    // affordances. Named "sample" so client payloads never carry the word
    // demo; the submission key itself never leaves the server.
    isSample: Boolean(registration.isTest) || isDemoSubmissionKey(registration.submissionKey),
    // The company's own EIN once issued — client-facing by definition.
    ein: registration.ein ?? null,
    submittedAt: registration.submittedAt?.getTime() ?? null,
    updatedAt: registration.updatedAt.getTime(),
    requiredActions: requiredActions.map((action) => ({
      id: action.id,
      type:
        action.actionCode === "FORMATION_NAME_OPTIONS_EXHAUSTED"
          ? ("name_options" as const)
          : action.actionCode === "FORMATION_SIGNATURE_SS4_RESET" ||
              action.actionCode === "FORMATION_SIGNATURE_SS4_PENDING"
            ? ("ss4_signature" as const)
            : ("support" as const),
      title: action.actionName,
      reason: action.reason,
      status: action.status,
      open: action.open,
      canRespond:
        action.open &&
        (action.actionCode === "FORMATION_NAME_OPTIONS_EXHAUSTED" ||
          action.actionCode === "FORMATION_SIGNATURE_SS4_RESET" ||
          action.actionCode === "FORMATION_SIGNATURE_SS4_PENDING"),
      submitted: action.status === "submitted",
      updatedAt: action.updatedAt.getTime(),
    })),
    history: history.map((item) => ({
      id: item.id,
      fromStatus: item.fromStatus,
      toStatus: item.toStatus,
      label: LLC_CLIENT_STATUS_LABELS[item.toStatus],
      createdAt: item.createdAt.getTime(),
    })),
  };
}

export function registrationRowToSummary(row: RegistrationRow) {
  return {
    id: row.id,
    orderRef: `NF-${String(row.id).padStart(4, "0")}`,
    legalName: text(row.legalName),
    entitySuffix: row.entitySuffix,
    formationState: text(row.formationState),
    status: row.status,
    statusLabel: LLC_CLIENT_STATUS_LABELS[row.status],
    canEdit: isRegistrationEditable(row),
    currentStep: row.currentStep,
    updatedAt: row.updatedAt.getTime(),
    isTest: Boolean(row.isTest),
    isSample: Boolean(row.isTest) || isDemoSubmissionKey(row.submissionKey),
  };
}

/**
 * Operations view. Includes the wholesale checkout, costs, margin, provider
 * identifiers, the sanitized provider snapshot (documents, signatures, EIN and
 * state flags), and the full history with internal notes.
 */
export function bundleToOpsView(bundle: RegistrationBundle) {
  const { registration, history } = bundle;
  const requiredActions = bundle.requiredActions ?? [];
  const snapshot =
    (registration.providerStatus as WhopFormationSnapshot | null) ?? null;
  const margin =
    registration.retailPriceCents !== null && registration.checkoutTotal !== null
      ? registration.retailPriceCents - registration.checkoutTotal
      : null;

  const draft = bundleToDraft(bundle);
  return {
    id: registration.id,
    orderRef: `NF-${String(registration.id).padStart(4, "0")}`,
    userId: registration.userId,
    draft: {
      ...draft,
      founders: draft.founders.map((founder) => ({
        ...founder,
        ssn: maskSsn(founder.ssn) ?? "",
      })),
    },
    status: registration.status,
    statusLabel: LLC_STATUS_LABELS[registration.status],
    safeErrorMessage: registration.lastErrorMessage,
    lastErrorType: registration.lastErrorType,
    canRetry: registration.retryable,
    whopAccountId: registration.whopAccountId,
    accountEmailAlias: registration.accountEmailAlias,
    checkout:
      registration.checkoutUrl && registration.checkoutSessionId
        ? {
            url: registration.checkoutUrl,
            sessionId: registration.checkoutSessionId,
            total: registration.checkoutTotal,
            currency: registration.checkoutCurrency,
          }
        : null,
    retailPriceCents: registration.retailPriceCents,
    retailPaidAt: registration.retailPaidAt?.getTime() ?? null,
    marginCents: margin,
    einRegistered: snapshot?.ein_registered === true,
    stateRegistered: snapshot?.state_registered === true,
    documents: snapshot?.documents ?? [],
    signatures: snapshot?.signatures ?? [],
    submittedAt: registration.submittedAt?.getTime() ?? null,
    lastProviderSyncAt: registration.lastProviderSyncAt?.getTime() ?? null,
    opsNotifiedAt: registration.opsNotifiedAt?.getTime() ?? null,
    updatedAt: registration.updatedAt.getTime(),
    requiredActions: requiredActions.map((action) => ({
      id: action.id,
      requiredActionId: action.requiredActionId,
      actionCode: action.actionCode,
      actionName: action.actionName,
      reason: action.reason,
      status: action.status,
      open: action.open,
      source: action.source,
      history: action.history,
      submittedPayload: action.submittedPayload,
      providerUpdatedAt: action.providerUpdatedAt?.getTime() ?? null,
      clientNotifiedAt: action.clientNotifiedAt?.getTime() ?? null,
      opsNotifiedAt: action.opsNotifiedAt?.getTime() ?? null,
      resolvedAt: action.resolvedAt?.getTime() ?? null,
      updatedAt: action.updatedAt.getTime(),
    })),
    history: history.map((item) => ({
      id: item.id,
      fromStatus: item.fromStatus,
      toStatus: item.toStatus,
      label: LLC_STATUS_LABELS[item.toStatus],
      source: item.source,
      note: item.note,
      createdAt: item.createdAt.getTime(),
    })),
  };
}

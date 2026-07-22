import { randomUUID } from "node:crypto";
import { issuesByField, llcCompleteSchema } from "../../shared/llc";
import {
  UNCERTAIN_ERROR_PREFIX,
  countSubmissionAttempts,
  createSubmissionAttempt,
  finishSubmissionAttempt,
  getLlcRegistrationById,
  transitionLlcStatus,
  updateLlcRegistrationProviderFields,
} from "./store";
import { OpsConfigurationError, connectedAccountEmailAlias } from "../ops/config";
import {
  checkoutReadyAlert,
  sendOpsAlert,
  statusChangeAlert,
  submissionProblemAlert,
} from "../ops/notify";
import { bundleToDraft, bundleToRegistrationView } from "./domain";
import { mirrorFormationDocuments } from "./documents";
import { getInactiveStateError, getStatePricing } from "./pricing";
import {
  WhopApiError,
  WhopConfigurationError,
  createWhopConnectedAccount,
  findWhopConnectedAccountByRegistrationId,
  isFormationStatusRegression,
  normalizeWhopFormationStatus,
  registerWhopLlc,
  retrieveWhopAccount,
} from "./whop";

export class LlcSubmissionValidationError extends Error {
  readonly fieldErrors: Record<string, string>;

  constructor(fieldErrors: Record<string, string>) {
    super("LLC registration failed final validation");
    this.name = "LlcSubmissionValidationError";
    this.fieldErrors = fieldErrors;
  }
}

type SafeFailure = {
  errorType: string;
  message: string;
  retryable: boolean;
  actionRequired: boolean;
  uncertain: boolean;
  httpStatus?: number;
  requestId?: string;
};

function classifyFailure(error: unknown): SafeFailure {
  if (error instanceof WhopApiError) {
    return {
      errorType: error.errorType,
      message: error.safeMessage,
      retryable: error.retryable,
      actionRequired: error.actionRequired,
      uncertain: error.uncertain,
      httpStatus: error.httpStatus,
      requestId: error.requestId,
    };
  }
  if (
    error instanceof WhopConfigurationError ||
    error instanceof OpsConfigurationError
  ) {
    return {
      errorType: "provider_configuration",
      message:
        "The filing service is temporarily unavailable because its secure connection needs attention.",
      retryable: false,
      actionRequired: true,
      uncertain: false,
    };
  }
  return {
    errorType: "internal_error",
    message:
      "We could not complete the filing handoff. Your saved details are safe. Please try again.",
    retryable: true,
    actionRequired: false,
    uncertain: false,
  };
}

function attemptOutcome(failure: SafeFailure) {
  if (failure.uncertain) return "uncertain" as const;
  if (failure.actionRequired) return "action_required" as const;
  return "retryable_failure" as const;
}

async function requireValidatedBundle(userId: number, registrationId: number) {
  const bundle = await getLlcRegistrationById(userId, registrationId);
  if (!bundle) throw new Error("LLC registration was not found");

  const parsed = llcCompleteSchema.safeParse({
    ...bundleToDraft(bundle),
    currentStep: 6,
  });
  if (!parsed.success) {
    throw new LlcSubmissionValidationError(issuesByField(parsed.error));
  }

  // Owner-controlled availability: an inactive state can never be handed off
  // to the provider, regardless of how the request reached submission.
  const inactiveError = await getInactiveStateError(parsed.data.formationState);
  if (inactiveError) {
    throw new LlcSubmissionValidationError({ formationState: inactiveError });
  }

  return { bundle, complete: parsed.data };
}

async function ensureWhopAccount(params: {
  userId: number;
  registrationId: number;
  submissionKey: string;
  existingAccountId: string | null;
  title: string;
}) {
  // The connected account is always registered to an owner-controlled alias so
  // every Whop account/formation email routes to operations, never to a client.
  const accountEmail = connectedAccountEmailAlias(params.registrationId);
  if (params.existingAccountId) {
    return { accountId: params.existingAccountId, accountEmail };
  }

  const attemptNumber =
    (await countSubmissionAttempts(params.registrationId)) + 1;
  const attemptId = await createSubmissionAttempt({
    registrationId: params.registrationId,
    attemptNumber,
    submissionKey: params.submissionKey,
    phase: "account_creation",
  });

  try {
    const reconciled = await findWhopConnectedAccountByRegistrationId(
      params.registrationId,
    );
    if (reconciled) {
      await updateLlcRegistrationProviderFields(
        params.userId,
        params.registrationId,
        {
          whopAccountId: reconciled,
          accountEmailAlias: accountEmail,
          lastProviderSyncAt: new Date(),
        },
      );
      await finishSubmissionAttempt({
        attemptId,
        outcome: "succeeded",
        providerObjectId: reconciled,
      });
      return { accountId: reconciled, accountEmail };
    }

    const created = await createWhopConnectedAccount({
      email: accountEmail,
      title: params.title,
      userId: params.userId,
      registrationId: params.registrationId,
      idempotencyKey: `${params.submissionKey}-account`,
    });
    await updateLlcRegistrationProviderFields(
      params.userId,
      params.registrationId,
      {
        whopAccountId: created.data.id,
        accountEmailAlias: accountEmail,
        lastProviderSyncAt: new Date(),
      },
    );
    await finishSubmissionAttempt({
      attemptId,
      outcome: "succeeded",
      httpStatus: created.httpStatus,
      whopRequestId: created.requestId,
      providerObjectId: created.data.id,
    });
    return { accountId: created.data.id, accountEmail };
  } catch (error) {
    let failure = classifyFailure(error);

    if (failure.uncertain) {
      try {
        const reconciled = await findWhopConnectedAccountByRegistrationId(
          params.registrationId,
        );
        if (reconciled) {
          await updateLlcRegistrationProviderFields(
            params.userId,
            params.registrationId,
            {
              whopAccountId: reconciled,
              accountEmailAlias: accountEmail,
              lastProviderSyncAt: new Date(),
            },
          );
          await finishSubmissionAttempt({
            attemptId,
            outcome: "succeeded",
            providerObjectId: reconciled,
          });
          return { accountId: reconciled, accountEmail };
        }
      } catch {
        // Preserve the original uncertain result and block automatic duplication.
      }
      failure = {
        ...failure,
        actionRequired: true,
        retryable: false,
        message:
          "The filing service may have created the connected account, but the response was interrupted. Our team will review it before anything is retried.",
      };
    }

    await finishSubmissionAttempt({
      attemptId,
      outcome: attemptOutcome(failure),
      httpStatus: failure.httpStatus,
      whopRequestId: failure.requestId,
      errorType: failure.errorType,
      safeMessage: failure.message,
      retryable: failure.retryable,
    });
    throw error instanceof Error
      ? Object.assign(error, { safeFailure: failure })
      : Object.assign(new Error("Whop account creation failed"), {
          safeFailure: failure,
        });
  }
}

function failureFromThrown(error: unknown): SafeFailure {
  if (
    error instanceof Error &&
    "safeFailure" in error &&
    typeof error.safeFailure === "object" &&
    error.safeFailure !== null
  ) {
    return error.safeFailure as SafeFailure;
  }
  return classifyFailure(error);
}

export async function submitLlcRegistration(params: {
  userId: number;
  registrationId: number;
}) {
  const validated = await requireValidatedBundle(
    params.userId,
    params.registrationId,
  );
  const existing = validated.bundle.registration;

  if (
    existing.status === "payment_required" ||
    existing.status === "processing" ||
    existing.status === "completed"
  ) {
    return {
      outcome: "already_submitted" as const,
      registration: bundleToRegistrationView(validated.bundle),
      message: "This registration has already been submitted for filing.",
    };
  }

  if (existing.status === "action_required") {
    return {
      outcome: "action_required" as const,
      registration: bundleToRegistrationView(validated.bundle),
      message:
        existing.lastErrorMessage ??
        "This submission needs attention before it can continue.",
    };
  }

  if (existing.status === "submitting") {
    if (existing.checkoutUrl) {
      await transitionLlcStatus({
        userId: params.userId,
        registrationId: params.registrationId,
        toStatus: "payment_required",
        source: "system",
        note: "Recovered a persisted Whop checkout after an interrupted response",
        expectedStatuses: ["submitting"],
      });
      const recovered = await getLlcRegistrationById(
        params.userId,
        params.registrationId,
      );
      if (!recovered) throw new Error("LLC registration could not be reloaded");
      return {
        outcome: "checkout_ready" as const,
        registration: bundleToRegistrationView(recovered),
        message: "Your registration has been submitted for filing.",
      };
    }
    return {
      outcome: "in_progress" as const,
      registration: bundleToRegistrationView(validated.bundle),
      message: "Your registration is already being submitted.",
    };
  }

  if (existing.status === "failed" && !existing.retryable) {
    return {
      outcome: "action_required" as const,
      registration: bundleToRegistrationView(validated.bundle),
      message:
        existing.lastErrorMessage ??
        "This submission needs attention before it can be retried.",
    };
  }

  const lock = await transitionLlcStatus({
    userId: params.userId,
    registrationId: params.registrationId,
    toStatus: "submitting",
    source: "system",
    note: "Acquired the single-flight Whop submission lock",
    expectedStatuses: ["ready", "failed"],
    updates: {
      lastErrorType: null,
      lastErrorMessage: null,
      retryable: false,
    },
  });

  if (!lock.changed) {
    const current = await getLlcRegistrationById(
      params.userId,
      params.registrationId,
    );
    if (!current) throw new Error("LLC registration could not be reloaded");
    return {
      outcome: "in_progress" as const,
      registration: bundleToRegistrationView(current),
      message: "Your registration is already being submitted.",
    };
  }

  const submissionKey =
    lock.registration.submissionKey ?? randomUUID().replaceAll("-", "");
  if (!lock.registration.submissionKey) {
    await updateLlcRegistrationProviderFields(
      params.userId,
      params.registrationId,
      { submissionKey },
    );
  }

  let registrationAttemptId: number | null = null;
  let issuedCheckout: {
    url: string;
    total: number;
    sessionId: string;
  } | null = null;
  let accountAlias: string | null = lock.registration.accountEmailAlias;
  try {
    const account = await ensureWhopAccount({
      userId: params.userId,
      registrationId: params.registrationId,
      submissionKey,
      existingAccountId: lock.registration.whopAccountId,
      title: validated.complete.legalName,
    });
    const accountId = account.accountId;
    accountAlias = account.accountEmail;

    // A pre-existing connected account means an earlier attempt got at least
    // this far. Before registering again, check whether a formation already
    // exists on the account (e.g. after an uncertain outcome) so a duplicate
    // filing is never created with a fresh idempotency key.
    if (lock.registration.whopAccountId) {
      const existingAccount = await retrieveWhopAccount(accountId);
      const existingFormation = normalizeWhopFormationStatus(
        existingAccount.data.llc_formation,
      );
      if (existingFormation.localStatus !== null) {
        await transitionLlcStatus({
          userId: params.userId,
          registrationId: params.registrationId,
          toStatus: "action_required",
          source: "whop",
          note: "An existing formation was found on the connected account; ops review required before any resubmission",
          expectedStatuses: ["submitting"],
          updates: {
            providerStatus: existingFormation.snapshot,
            lastProviderSyncAt: new Date(),
            lastErrorType: `${UNCERTAIN_ERROR_PREFIX}existing_formation`,
            lastErrorMessage:
              "Our team is completing a review of this filing. No action is needed from you right now.",
            retryable: false,
          },
        });
        await sendOpsAlert(
          submissionProblemAlert({
            registrationId: params.registrationId,
            legalName: `${validated.complete.legalName} ${validated.complete.entitySuffix}`,
            errorType: "existing_formation",
            message:
              "A formation already exists on this connected account (likely from an earlier interrupted attempt). Retrieve the existing checkout from the Whop dashboard instead of resubmitting.",
            uncertain: true,
          }),
        );
        const conflicted = await getLlcRegistrationById(
          params.userId,
          params.registrationId,
        );
        if (!conflicted) throw new Error("LLC registration could not be reloaded");
        return {
          outcome: "action_required" as const,
          registration: bundleToRegistrationView(conflicted),
          message:
            "Our team is completing a review of this filing. No action is needed from you right now.",
        };
      }
    }

    const attemptNumber =
      (await countSubmissionAttempts(params.registrationId)) + 1;
    registrationAttemptId = await createSubmissionAttempt({
      registrationId: params.registrationId,
      attemptNumber,
      submissionKey,
      phase: "llc_registration",
    });

    const checkout = await registerWhopLlc(accountId, validated.complete, {
      idempotencyKey: `${submissionKey}-llc`,
    });
    issuedCheckout = {
      url: checkout.data.checkout_url,
      total: checkout.data.total,
      sessionId: checkout.data.checkout_session_id,
    };

    // Snapshot the state's published retail price onto the registration at
    // submit time (only when no retail price was recorded yet), so margins
    // are tracked against what the client actually saw — later state-price
    // edits never rewrite history.
    let retailSnapshot: { retailPriceCents: number } | Record<string, never> = {};
    if (lock.registration.retailPriceCents === null) {
      try {
        const statePricing = await getStatePricing(validated.complete.formationState);
        if (statePricing.retailPriceCents !== null) {
          retailSnapshot = { retailPriceCents: statePricing.retailPriceCents };
        }
      } catch {
        // Best-effort: a pricing read failure must never fail the submission.
      }
    }

    await updateLlcRegistrationProviderFields(
      params.userId,
      params.registrationId,
      {
        whopAccountId: accountId,
        checkoutSessionId: checkout.data.checkout_session_id,
        checkoutUrl: checkout.data.checkout_url,
        checkoutTotal: checkout.data.total,
        checkoutCurrency: checkout.data.currency,
        ...retailSnapshot,
        lastProviderSyncAt: new Date(),
        submittedAt: new Date(),
        retryable: false,
        lastErrorType: null,
        lastErrorMessage: null,
      },
    );
    await finishSubmissionAttempt({
      attemptId: registrationAttemptId,
      outcome: "succeeded",
      httpStatus: checkout.httpStatus,
      whopRequestId: checkout.requestId,
      providerObjectId: checkout.data.checkout_session_id,
    });

    const finalTransition = await transitionLlcStatus({
      userId: params.userId,
      registrationId: params.registrationId,
      toStatus: "payment_required",
      source: "whop",
      note: "Whop created a hosted LLC checkout",
      expectedStatuses: ["submitting"],
      updates: {
        whopAccountId: accountId,
        checkoutSessionId: checkout.data.checkout_session_id,
        checkoutUrl: checkout.data.checkout_url,
        checkoutTotal: checkout.data.total,
        checkoutCurrency: checkout.data.currency,
        lastProviderSyncAt: new Date(),
        submittedAt: new Date(),
        lastErrorType: null,
        lastErrorMessage: null,
        retryable: false,
      },
    });
    if (!finalTransition.changed) {
      // Either the poller promoted this row first (benign: same checkout
      // already in payment_required) or the submitting lock was genuinely lost.
      const raced = await getLlcRegistrationById(
        params.userId,
        params.registrationId,
      );
      const alreadyPromoted =
        raced?.registration.status === "payment_required" &&
        raced.registration.checkoutSessionId ===
          checkout.data.checkout_session_id;
      if (!alreadyPromoted) {
        throw new Error(
          "Submission state changed while the checkout was being issued",
        );
      }
    }

    const current = await getLlcRegistrationById(
      params.userId,
      params.registrationId,
    );
    if (!current) throw new Error("Submitted LLC registration could not be reloaded");

    const delivered = await sendOpsAlert(
      checkoutReadyAlert({
        registrationId: params.registrationId,
        legalName: `${validated.complete.legalName} ${validated.complete.entitySuffix}`,
        formationState: validated.complete.formationState,
        checkoutUrl: checkout.data.checkout_url,
        checkoutTotal: checkout.data.total,
        retailPriceCents: current.registration.retailPriceCents,
        accountEmailAlias:
          current.registration.accountEmailAlias ?? "not recorded",
        retailPaid: Boolean(current.registration.retailPaidAt),
      }),
    );
    if (delivered) {
      await updateLlcRegistrationProviderFields(
        params.userId,
        params.registrationId,
        { opsNotifiedAt: new Date() },
      );
    }

    return {
      outcome: "checkout_ready" as const,
      registration: bundleToRegistrationView(current),
      message: "Your registration was accepted and is being prepared for filing.",
    };
  } catch (error) {
    if (issuedCheckout) {
      // Whop DID issue a checkout; a failure after that point must never be
      // recorded as a failed submission. Alert ops with the in-memory checkout
      // so the wholesale leg can still be paid, and leave the row for the
      // poller/recovery path to reconcile.
      console.error("[LLC] Post-checkout persistence failed; ops alerted with live checkout", {
        registrationId: params.registrationId,
        error: error instanceof Error ? error.name : "UnknownError",
      });
      await sendOpsAlert(
        checkoutReadyAlert({
          registrationId: params.registrationId,
          legalName: `${validated.complete.legalName} ${validated.complete.entitySuffix}`,
          formationState: validated.complete.formationState,
          checkoutUrl: issuedCheckout.url,
          checkoutTotal: issuedCheckout.total,
          retailPriceCents: lock.registration.retailPriceCents,
          accountEmailAlias: accountAlias ?? "not recorded",
          retailPaid: Boolean(lock.registration.retailPaidAt),
        }),
      ).catch(() => {});
      throw error;
    }
    const failure = failureFromThrown(error);
    const requiresManualReview = failure.actionRequired || failure.uncertain;

    if (registrationAttemptId !== null) {
      await finishSubmissionAttempt({
        attemptId: registrationAttemptId,
        outcome: attemptOutcome(failure),
        httpStatus: failure.httpStatus,
        whopRequestId: failure.requestId,
        errorType: failure.errorType,
        safeMessage: failure.message,
        retryable: !requiresManualReview && failure.retryable,
      }).catch((dbError) => {
        console.error("[LLC] Could not complete the submission-attempt record", {
          attemptId: registrationAttemptId,
          error: dbError instanceof Error ? dbError.name : "UnknownError",
        });
      });
    }

    await transitionLlcStatus({
      userId: params.userId,
      registrationId: params.registrationId,
      toStatus: requiresManualReview ? "action_required" : "failed",
      source: "whop",
      note: failure.uncertain
        ? "The Whop outcome is uncertain; automatic retry was blocked"
        : "Whop submission failed",
      expectedStatuses: ["submitting"],
      updates: {
        lastProviderSyncAt: new Date(),
        lastErrorType: failure.uncertain
          ? `${UNCERTAIN_ERROR_PREFIX}${failure.errorType}`
          : failure.errorType,
        lastErrorMessage: failure.message,
        retryable: !requiresManualReview && failure.retryable,
      },
    });

    if (requiresManualReview) {
      await sendOpsAlert(
        submissionProblemAlert({
          registrationId: params.registrationId,
          legalName: `${validated.complete.legalName} ${validated.complete.entitySuffix}`,
          errorType: failure.errorType,
          message: failure.message,
          uncertain: failure.uncertain,
        }),
      );
    }

    const current = await getLlcRegistrationById(
      params.userId,
      params.registrationId,
    );
    if (!current) throw new Error("Failed LLC registration could not be reloaded");
    return {
      outcome: requiresManualReview
        ? ("action_required" as const)
        : ("failed" as const),
      registration: bundleToRegistrationView(current),
      message: failure.message,
    };
  }
}

export async function refreshLlcRegistrationStatus(params: {
  userId: number;
  registrationId: number;
}) {
  const bundle = await getLlcRegistrationById(
    params.userId,
    params.registrationId,
  );
  if (!bundle) throw new Error("LLC registration was not found");
  const registration = bundle.registration;

  if (!registration.whopAccountId) {
    return {
      refreshed: false as const,
      registration: bundleToRegistrationView(bundle),
      message: "This registration has not been submitted for filing yet.",
    };
  }

  const submissionKey =
    registration.submissionKey ?? randomUUID().replaceAll("-", "");
  if (!registration.submissionKey) {
    await updateLlcRegistrationProviderFields(
      params.userId,
      params.registrationId,
      { submissionKey },
    );
  }
  const attemptNumber =
    (await countSubmissionAttempts(params.registrationId)) + 1;
  const attemptId = await createSubmissionAttempt({
    registrationId: params.registrationId,
    attemptNumber,
    submissionKey,
    phase: "status_refresh",
  });

  try {
    const account = await retrieveWhopAccount(registration.whopAccountId);
    const normalized = normalizeWhopFormationStatus(account.data.llc_formation);
    // Persist the snapshot only; error/retry state is cleared exclusively by a
    // confirmed status transition so a background poll can never disarm a
    // pending safe-retry or an uncertain-outcome quarantine.
    await updateLlcRegistrationProviderFields(
      params.userId,
      params.registrationId,
      {
        providerStatus: normalized.snapshot,
        lastProviderSyncAt: new Date(),
      },
    );
    await finishSubmissionAttempt({
      attemptId,
      outcome: "succeeded",
      httpStatus: account.httpStatus,
      whopRequestId: account.requestId,
      providerObjectId: registration.whopAccountId,
    });

    // Fire-and-forget: mirroring provider documents into the member's ACL'd
    // storage is best-effort and must never affect the refresh result.
    // Mirrored rows land UNRELEASED; ops releases them to the client vault.
    void mirrorFormationDocuments({
      userId: params.userId,
      registrationId: params.registrationId,
      snapshot: normalized.snapshot,
    }).catch(() => {});

    let inferredStatus =
      normalized.localStatus ??
      (registration.checkoutUrl && registration.status === "submitting"
        ? "payment_required"
        : registration.status);

    // Never rewind confirmed provider progress on a stale or partial read.
    if (
      isFormationStatusRegression(
        registration.status as typeof inferredStatus,
        inferredStatus,
      )
    ) {
      inferredStatus = registration.status;
    }

    if (inferredStatus !== registration.status) {
      const transition = await transitionLlcStatus({
        userId: params.userId,
        registrationId: params.registrationId,
        toStatus: inferredStatus,
        source: "whop",
        note: normalized.note,
        expectedStatuses: [registration.status],
        updates: {
          providerStatus: normalized.snapshot,
          lastProviderSyncAt: new Date(),
          lastErrorType: null,
          lastErrorMessage: null,
          retryable: false,
        },
      });

      // NOTE (rental-calc port): the donor's completion side effects (tool
      // state + milestone hydration) are omitted — this app has no
      // tool_states/member_progress equivalents.

      if (transition.changed) {
        const delivered = await sendOpsAlert(
          statusChangeAlert({
            registrationId: params.registrationId,
            legalName:
              [registration.legalName, registration.entitySuffix]
                .filter(Boolean)
                .join(" ") || `order #${params.registrationId}`,
            fromStatus: registration.status,
            toStatus: inferredStatus,
            note: normalized.note,
            snapshot: normalized.snapshot,
          }),
        );
        if (delivered) {
          await updateLlcRegistrationProviderFields(
            params.userId,
            params.registrationId,
            { opsNotifiedAt: new Date() },
          );
        }
      }
    }

    const current = await getLlcRegistrationById(
      params.userId,
      params.registrationId,
    );
    if (!current) throw new Error("Refreshed LLC registration could not be reloaded");
    return {
      refreshed: true as const,
      registration: bundleToRegistrationView(current),
      message: normalized.note,
    };
  } catch (error) {
    const failure = classifyFailure(error);
    await finishSubmissionAttempt({
      attemptId,
      outcome: attemptOutcome(failure),
      httpStatus: failure.httpStatus,
      whopRequestId: failure.requestId,
      errorType: `status_${failure.errorType}`,
      safeMessage:
        "We could not refresh the filing status right now. The last confirmed status is still shown.",
      retryable: failure.retryable,
    });
    await updateLlcRegistrationProviderFields(
      params.userId,
      params.registrationId,
      {
        lastProviderSyncAt: new Date(),
        lastErrorType: `status_${failure.errorType}`,
        lastErrorMessage:
          "We could not refresh the filing status right now. The last confirmed status is still shown.",
      },
    );

    const current = await getLlcRegistrationById(
      params.userId,
      params.registrationId,
    );
    if (!current) throw new Error("LLC registration could not be reloaded");
    return {
      refreshed: false as const,
      registration: bundleToRegistrationView(current),
      message:
        "We could not refresh the filing status right now. The last confirmed status is still shown.",
    };
  }
}

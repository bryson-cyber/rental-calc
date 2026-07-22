import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  llcCompleteSchema,
  llcDraftSchema,
  issuesByField,
  validateLlcStep,
} from "../../shared/llc";
import {
  createLlcRegistration,
  findLlcRegistrationOwner,
  getLlcRegistrationById,
  listAllLlcRegistrations,
  listLlcRegistrationsForUser,
  saveLlcDraft,
  transitionLlcStatus,
  updateLlcRegistrationProviderFields,
} from "./store";
// The public tools stay public, but FILING requires an account: every client
// procedure is gated behind protectedProcedure. Ops procedures use
// adminProcedure.
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  bundleToDraft,
  bundleToOpsView,
  bundleToRegistrationView,
  registrationRowToSummary,
} from "./domain";
import {
  LlcSubmissionValidationError,
  refreshLlcRegistrationStatus,
  submitLlcRegistration,
} from "./submission";
import {
  OPS_UPLOAD_MIME_TYPES,
  OpsUploadValidationError,
  deleteLlcDocument,
  findLlcDocumentById,
  listAllFormationDocuments,
  listFormationDocuments,
  listOpsDocuments,
  setDocumentReleased,
  uploadOpsDocument,
} from "./documents";
import {
  applyPaymentLinkToAllStates,
  applyStateMarkup,
  getInactiveStateError,
  getStatePricing,
  listStatePricingWithWholesale,
  setStatePricing,
} from "./pricing";
import {
  DemoGuardError,
  createDemoFiling,
  deleteDemoFiling,
  isDemoSubmissionKey,
} from "./demo";
import {
  sendDemoLifecycleEmails,
  sendDocumentsReleasedEmail,
  sendPaymentConfirmedEmail,
} from "./clientEmails";
import { LLC_FORMATION_STATES } from "../../shared/llc";
import { PiiConfigurationError } from "./pii";
import { checkRateLimit } from "../ops/rateLimit";

const HOUR_MS = 60 * 60 * 1000;

function enforceRateLimit(userId: number, action: string, limit: number) {
  if (!checkRateLimit(`${action}:${userId}`, limit, HOUR_MS)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "You’re doing that a little too often. Please wait a bit and try again.",
    });
  }
}

const registrationIdInput = z.object({ id: z.number().int().positive() });

// Payment links render as client-side hrefs; zod's .url() alone accepts
// javascript: and data: schemes, so restrict to plain web URLs.
const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(1000)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "Payment links must start with http:// or https://",
  });

async function requireRegistrationBundle(userId: number, registrationId: number) {
  const bundle = await getLlcRegistrationById(userId, registrationId);
  if (!bundle) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This registration could not be found in your workspace.",
    });
  }
  return bundle;
}

export const llcRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await listLlcRegistrationsForUser(ctx.user.id);
    return rows.map(registrationRowToSummary);
  }),

  create: protectedProcedure.mutation(async ({ ctx }) => {
    enforceRateLimit(ctx.user.id, "llc.create", 5);
    const registration = await createLlcRegistration(ctx.user.id);
    const bundle = await requireRegistrationBundle(ctx.user.id, registration.id);
    return bundleToRegistrationView(bundle);
  }),

  get: protectedProcedure
    .input(registrationIdInput)
    .query(async ({ ctx, input }) => {
      const bundle = await requireRegistrationBundle(ctx.user.id, input.id);
      return bundleToRegistrationView(bundle);
    }),

  saveDraft: protectedProcedure
    .input(registrationIdInput.extend({ draft: llcDraftSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const bundle = await saveLlcDraft(ctx.user.id, input.id, input.draft);
        if (!bundle) throw new Error("Saved registration could not be reloaded");
        return bundleToRegistrationView(bundle);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "This registration can no longer be edited"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This registration has already moved beyond the editable stage.",
          });
        }
        if (error instanceof PiiConfigurationError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Secure SSN storage is not enabled yet. Remove the SSN for now, or contact support.",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Your changes could not be saved. Your form remains open; please retry.",
          cause: error,
        });
      }
    }),

  advanceStep: protectedProcedure
    .input(
      registrationIdInput.extend({
        step: z.number().int().min(1).max(5),
        draft: llcDraftSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const validation = validateLlcStep(input.step, input.draft);
      if (!validation.success) {
        return {
          advanced: false as const,
          fieldErrors: issuesByField(validation.error),
        };
      }

      // Owner-controlled availability: a state switched off in pricing cannot
      // proceed past the Business step.
      if (input.step === 1) {
        const inactiveError = await getInactiveStateError(input.draft.formationState);
        if (inactiveError) {
          return {
            advanced: false as const,
            fieldErrors: { formationState: inactiveError },
          };
        }
      }

      let bundle;
      try {
        bundle = await saveLlcDraft(ctx.user.id, input.id, {
          ...input.draft,
          currentStep: input.step + 1,
        });
      } catch (error) {
        if (error instanceof PiiConfigurationError) {
          return {
            advanced: false as const,
            fieldErrors: {
              [`founders.${input.draft.founders.findIndex((f) => f.ssn?.trim())}.ssn`]:
                "Secure SSN storage is not enabled yet. Remove the SSN for now, or contact support.",
            },
          };
        }
        throw error;
      }
      if (!bundle) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Your progress was saved, but the next step could not be loaded.",
        });
      }

      return {
        advanced: true as const,
        registration: bundleToRegistrationView(bundle),
      };
    }),

  validateForSubmission: protectedProcedure
    .input(registrationIdInput)
    .mutation(async ({ ctx, input }) => {
      const bundle = await requireRegistrationBundle(ctx.user.id, input.id);
      const result = llcCompleteSchema.safeParse({
        ...bundleToDraft(bundle),
        currentStep: 6,
      });

      if (!result.success) {
        return {
          valid: false as const,
          fieldErrors: issuesByField(result.error),
        };
      }

      const inactiveError = await getInactiveStateError(result.data.formationState);
      if (inactiveError) {
        return {
          valid: false as const,
          fieldErrors: { formationState: inactiveError },
        };
      }

      if (bundle.registration.status !== "ready") {
        await transitionLlcStatus({
          userId: ctx.user.id,
          registrationId: input.id,
          toStatus: "ready",
          source: "user",
          note: "Registration passed final validation",
          expectedStatuses: ["draft", "failed", "action_required"],
          updates: {
            currentStep: 6,
            lastErrorType: null,
            lastErrorMessage: null,
            retryable: false,
          },
        });
      }

      const refreshed = await requireRegistrationBundle(ctx.user.id, input.id);
      return {
        valid: true as const,
        registration: bundleToRegistrationView(refreshed),
      };
    }),

  submit: protectedProcedure
    .input(registrationIdInput)
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit(ctx.user.id, "llc.submit", 10);
      try {
        return await submitLlcRegistration({
          userId: ctx.user.id,
          registrationId: input.id,
        });
      } catch (error) {
        if (error instanceof LlcSubmissionValidationError) {
          return {
            outcome: "validation_error" as const,
            fieldErrors: error.fieldErrors,
            message: "Review the highlighted fields before submitting.",
          };
        }
        console.error("[LLC] Submission procedure failed", {
          userId: ctx.user.id,
          registrationId: input.id,
          error: error instanceof Error ? error.name : "UnknownError",
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "We could not start the submission. Your saved draft was not lost.",
        });
      }
    }),

  documents: protectedProcedure
    .input(registrationIdInput)
    .query(async ({ ctx, input }) => {
      // Ownership check via the store: the registration must belong to the
      // caller before any document rows are listed. Released documents only.
      await requireRegistrationBundle(ctx.user.id, input.id);
      return listFormationDocuments(ctx.user.id, input.id);
    }),

  allDocuments: protectedProcedure.query(async ({ ctx }) => {
    // Released documents across every registration the caller owns.
    return listAllFormationDocuments(ctx.user.id);
  }),

  statePricing: protectedProcedure
    .input(z.object({ state: z.enum(LLC_FORMATION_STATES) }))
    .query(async ({ input }) => {
      // Client-facing by definition: retail price + published state fee only.
      // Wholesale totals NEVER appear in this procedure's output.
      const pricing = await getStatePricing(input.state);
      return {
        state: pricing.state,
        retailPriceCents: pricing.retailPriceCents,
        stateFeeCents: pricing.stateFeeCents,
        // Client-facing by design: this is the page clients are SENT to pay.
        paymentLinkUrl: pricing.paymentLinkUrl,
        active: pricing.active,
      };
    }),

  refreshStatus: protectedProcedure
    .input(registrationIdInput)
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit(ctx.user.id, "llc.refresh", 30);
      try {
        const result = await refreshLlcRegistrationStatus({
          userId: ctx.user.id,
          registrationId: input.id,
        });
        // Provider notes are ops-facing; clients get a neutral confirmation.
        return {
          refreshed: result.refreshed,
          registration: result.registration,
          message: result.refreshed
            ? `Latest status: ${result.registration.statusLabel}.`
            : result.message,
        };
      } catch (error) {
        console.error("[LLC] Status refresh procedure failed", {
          userId: ctx.user.id,
          registrationId: input.id,
          error: error instanceof Error ? error.name : "UnknownError",
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "We could not refresh the registration status. The last confirmed status is still available.",
        });
      }
    }),
});

export const llcOpsRouter = router({
  listAll: adminProcedure.query(async () => {
    const rows = await listAllLlcRegistrations();
    return rows.map(({ registration, clientName, clientEmail }) => ({
      id: registration.id,
      orderRef: `NF-${String(registration.id).padStart(4, "0")}`,
      clientName: clientName ?? null,
      clientEmail: clientEmail ?? null,
      legalName: registration.legalName,
      entitySuffix: registration.entitySuffix,
      formationState: registration.formationState,
      status: registration.status,
      checkoutUrl: registration.checkoutUrl,
      checkoutTotal: registration.checkoutTotal,
      retailPriceCents: registration.retailPriceCents,
      marginCents:
        registration.retailPriceCents !== null &&
        registration.checkoutTotal !== null
          ? registration.retailPriceCents - registration.checkoutTotal
          : null,
      lastErrorMessage: registration.lastErrorMessage,
      // Ops-only marker so the dashboard can badge demo rows; the client
      // registration view never carries the submission key or this flag.
      isDemo: isDemoSubmissionKey(registration.submissionKey),
      retailPaidAt: registration.retailPaidAt?.getTime() ?? null,
      submittedAt: registration.submittedAt?.getTime() ?? null,
      lastProviderSyncAt: registration.lastProviderSyncAt?.getTime() ?? null,
      updatedAt: registration.updatedAt.getTime(),
    }));
  }),

  get: adminProcedure
    .input(registrationIdInput)
    .query(async ({ input }) => {
      const owner = await findLlcRegistrationOwner(input.id);
      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      const bundle = await getLlcRegistrationById(owner.userId, input.id);
      if (!bundle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      return bundleToOpsView(bundle);
    }),

  setRetailPrice: adminProcedure
    .input(
      registrationIdInput.extend({
        retailPriceCents: z.number().int().min(0).max(10_000_000).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const owner = await findLlcRegistrationOwner(input.id);
      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      const bundle = await updateLlcRegistrationProviderFields(
        owner.userId,
        input.id,
        { retailPriceCents: input.retailPriceCents },
      );
      if (!bundle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      return bundleToOpsView(bundle);
    }),

  refresh: adminProcedure
    .input(registrationIdInput)
    .mutation(async ({ input }) => {
      const owner = await findLlcRegistrationOwner(input.id);
      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      const result = await refreshLlcRegistrationStatus({
        userId: owner.userId,
        registrationId: input.id,
      });
      const bundle = await getLlcRegistrationById(owner.userId, input.id);
      if (!bundle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      return { refreshed: result.refreshed, message: result.message, registration: bundleToOpsView(bundle) };
    }),

  // ─── Document vault management ───

  documents: adminProcedure
    .input(registrationIdInput)
    .query(async ({ input }) => {
      const owner = await findLlcRegistrationOwner(input.id);
      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      return listOpsDocuments(input.id);
    }),

  releaseDocument: adminProcedure
    .input(z.object({ documentId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const existing = await findLlcDocumentById(input.documentId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
      }
      const updated = await setDocumentReleased(input.documentId, true);
      // Client notification (10-minute batching lives in the sender).
      // Fire-and-forget: an email failure can never affect the release.
      void sendDocumentsReleasedEmail({
        userId: existing.userId,
        registrationId: existing.registrationId,
      }).catch(() => {});
      return { released: true as const, documentId: input.documentId, releasedAt: updated?.releasedAt?.getTime() ?? null };
    }),

  unreleaseDocument: adminProcedure
    .input(z.object({ documentId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const existing = await findLlcDocumentById(input.documentId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
      }
      await setDocumentReleased(input.documentId, false);
      return { released: false as const, documentId: input.documentId };
    }),

  uploadDocument: adminProcedure
    .input(
      z.object({
        registrationId: z.number().int().positive(),
        name: z.string().trim().min(1).max(200),
        label: z.string().trim().max(200).optional(),
        documentType: z.string().trim().min(1).max(128),
        mimeType: z.enum(OPS_UPLOAD_MIME_TYPES),
        dataBase64: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const owner = await findLlcRegistrationOwner(input.registrationId);
      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      try {
        const document = await uploadOpsDocument({
          registrationId: input.registrationId,
          ownerUserId: owner.userId,
          name: input.name,
          label: input.label ?? null,
          documentType: input.documentType,
          dataBase64: input.dataBase64,
          mimeType: input.mimeType,
        });
        if (!document) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "The uploaded document could not be reloaded.",
          });
        }
        return {
          id: document.id,
          registrationId: document.registrationId,
          name: document.name,
          label: document.label,
          documentType: document.documentType,
          source: document.source,
          releasedAt: document.releasedAt?.getTime() ?? null,
        };
      } catch (error) {
        if (error instanceof OpsUploadValidationError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),

  deleteDocument: adminProcedure
    .input(z.object({ documentId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const existing = await findLlcDocumentById(input.documentId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
      }
      await deleteLlcDocument(input.documentId);
      return { deleted: true as const, documentId: input.documentId };
    }),

  // ─── Per-state retail pricing ───

  listStatePricing: adminProcedure.query(async () => {
    // Includes lastWholesaleCents (max provider checkout total seen per
    // state) so the owner prices retail with real COGS in view. Ops-only.
    return listStatePricingWithWholesale();
  }),

  setStatePricing: adminProcedure
    .input(
      z.object({
        state: z.enum(LLC_FORMATION_STATES),
        retailPriceCents: z.number().int().min(0).max(10_000_000).nullable(),
        active: z.boolean(),
        paymentLinkUrl: httpUrlSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const updated = await setStatePricing(input);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "State pricing row not found." });
      }
      return {
        state: updated.state,
        retailPriceCents: updated.retailPriceCents,
        stateFeeCents: updated.stateFeeCents,
        paymentLinkUrl: updated.paymentLinkUrl,
        active: updated.active,
      };
    }),

  applyStateMarkup: adminProcedure
    .input(z.object({ markupCents: z.number().int().min(0).max(10_000_000) }))
    .mutation(async ({ input }) => {
      // retailPriceCents = stateFeeCents + markupCents for every ACTIVE state.
      const result = await applyStateMarkup(input.markupCents);
      return { updated: result.updated, markupCents: input.markupCents };
    }),

  applyPaymentLink: adminProcedure
    .input(
      z.object({
        paymentLinkUrl: httpUrlSchema.nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      // One hosted payment page for every state in one action (null clears).
      const result = await applyPaymentLinkToAllStates(input.paymentLinkUrl);
      return { updated: result.updated };
    }),

  // ─── Demo filings (webinar demonstrations) ───

  createDemoFiling: adminProcedure.mutation(async ({ ctx }) => {
    // Fabricates a completed-looking registration owned by the calling admin
    // with zero provider interaction; documents are SAMPLE-watermarked.
    return createDemoFiling(ctx.user.id);
  }),

  deleteDemoFiling: adminProcedure
    .input(registrationIdInput)
    .mutation(async ({ input }) => {
      try {
        return await deleteDemoFiling(input.id);
      } catch (error) {
        if (error instanceof DemoGuardError) {
          throw new TRPCError({ code: "FORBIDDEN", message: error.message });
        }
        if (error instanceof Error && error.message === "Registration not found") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
        }
        throw error;
      }
    }),

  sendDemoEmails: adminProcedure
    .input(registrationIdInput)
    .mutation(async ({ ctx, input }) => {
      const owner = await findLlcRegistrationOwner(input.id);
      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      const bundle = await getLlcRegistrationById(owner.userId, input.id);
      if (!bundle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      // Hard guard: rehearsal sends exist ONLY for demo filings — a real
      // client registration can never be replayed through this procedure.
      if (!isDemoSubmissionKey(bundle.registration.submissionKey)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only demo filings can send demo emails",
        });
      }
      const to = ctx.user.email?.trim();
      if (!to) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Your admin account has no email address on file.",
        });
      }
      // All four lifecycle emails go to the CALLING ADMIN (never a client),
      // bypassing the send-once log so rehearsals are repeatable.
      const result = await sendDemoLifecycleEmails({
        userId: owner.userId,
        registrationId: input.id,
        to,
      });
      return { sent: result.sent };
    }),

  // ─── Retail payment tracking ───

  markPaid: adminProcedure
    .input(registrationIdInput)
    .mutation(async ({ input }) => {
      const owner = await findLlcRegistrationOwner(input.id);
      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      await updateLlcRegistrationProviderFields(owner.userId, input.id, {
        retailPaidAt: new Date(),
      });
      // Client payment confirmation — fire-and-forget so an email failure
      // can never affect the ops action; send-once via the email log claim.
      void sendPaymentConfirmedEmail({
        userId: owner.userId,
        registrationId: input.id,
      }).catch(() => {});
      return { id: input.id, paid: true as const };
    }),

  unmarkPaid: adminProcedure
    .input(registrationIdInput)
    .mutation(async ({ input }) => {
      const owner = await findLlcRegistrationOwner(input.id);
      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      await updateLlcRegistrationProviderFields(owner.userId, input.id, {
        retailPaidAt: null,
      });
      return { id: input.id, paid: false as const };
    }),
});

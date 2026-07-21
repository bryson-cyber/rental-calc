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
});

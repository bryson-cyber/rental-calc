import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  llcCompleteSchema,
  llcDraftSchema,
  issuesByField,
  validateLlcStep,
  DOOLA_DIRECT_MARKER,
  isValidDoolaIndustry,
} from "../../shared/llc";
import { deriveDoolaIndustry } from "./doola";
import {
  createLlcRegistration,
  findLlcRegistrationOwner,
  getLlcRegistrationById,
  listAllLlcRegistrations,
  listLlcRegistrationsForUser,
  saveLlcDraft,
  statusTokenMatches,
  transitionLlcStatus,
  updateLlcRegistrationProviderFields,
} from "./store";
// The public tools stay public, but FILING requires an account: every client
// procedure is gated behind protectedProcedure. Ops procedures use
// adminProcedure. The single exception is llc.track, where the unguessable
// per-registration status token IS the credential (email links must open
// without a login wall — operator complaint 2026-07-28).
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
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
  applyExpeditePriceToAllStates,
  applyPaymentLinkToAllStates,
  applyStateMarkup,
  getInactiveStateError,
  getStatePricing,
  applyReferenceFees,
  listStatePricingWithWholesale,
  setStatePricing,
} from "./pricing";
import {
  DemoGuardError,
  attachSampleDocuments,
  createDemoFiling,
  deleteDemoFiling,
  demoStateName,
  isDemoSubmissionKey,
  isTestRegistration,
} from "./demo";
import {
  sendDemoLifecycleEmails,
  sendDocumentsReleasedEmail,
  sendPaymentConfirmedEmail,
} from "./clientEmails";
import { LLC_FORMATION_STATES } from "../../shared/llc";
import { PiiConfigurationError } from "./pii";
import { checkRateLimit } from "../ops/rateLimit";
import { fileDoolaRegistration } from "./doolaSubmission";
import { createLlcCheckoutSession } from "./stripeCheckout";
import { getDoolaFormationCostCents, listDoolaStateFees } from "./doola";
import { syncStateFeesFromProvider } from "./pricing";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

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

  /**
   * Tokenized status read (2026-07-28): the ?t= token from a status email is
   * the credential, so clients can open their filing page without signing in.
   * Constant behavior on EVERY failure (missing row, null token, mismatch):
   * the same NOT_FOUND, never revealing which part failed. The payload is the
   * exact client-safe shape of llc.get (same serializer — never wholesale or
   * provider fields) plus the RELEASED documents list llc.documents returns;
   * founder SSNs are additionally blanked because a mailto link is a weaker
   * credential than a session and the status page never shows them.
   */
  track: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        token: z.string().min(32).max(64),
      }),
    )
    .query(async ({ input }) => {
      const notFound = () =>
        new TRPCError({
          code: "NOT_FOUND",
          message: "This filing could not be found.",
        });
      const owner = await findLlcRegistrationOwner(input.id);
      if (!owner) throw notFound();
      const bundle = await getLlcRegistrationById(owner.userId, input.id);
      if (!bundle) throw notFound();
      if (!statusTokenMatches(bundle.registration.statusToken, input.token)) {
        throw notFound();
      }
      const view = bundleToRegistrationView(bundle);
      return {
        registration: {
          ...view,
          draft: {
            ...view.draft,
            founders: view.draft.founders.map((founder) => ({
              ...founder,
              ssn: "",
            })),
          },
        },
        // Released documents only — same serializer as llc.documents.
        documents: await listFormationDocuments(owner.userId, input.id),
      };
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

      // Pre-submission industry guard: if the industry doesn't resolve to a
      // valid Doola label, block BEFORE payment can ever lead to a filing.
      const resolvedIndustry = deriveDoolaIndustry(bundle.registration);
      if (!resolvedIndustry) {
        return {
          valid: false as const,
          fieldErrors: {
            industryType:
              "Your selected industry could not be mapped to a valid filing category. Please select a different industry from the list.",
          },
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
        // Retail add-on for expedited EIN; client-facing by definition.
        expediteEinPriceCents: pricing.expediteEinPriceCents,
        // Client-facing by design: this is the page clients are SENT to pay.
        paymentLinkUrl: pricing.paymentLinkUrl,
        active: pricing.active,
      };
    }),

  createCheckoutSession: protectedProcedure
    .input(registrationIdInput)
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit(ctx.user.id, "llc.checkout", 10);
      try {
        const origin =
          ctx.req.headers.origin ??
          (typeof ctx.req.headers.referer === "string"
            ? ctx.req.headers.referer.replace(/\/[^/]*$/, "")
            : undefined) ??
          ENV.appUrl;
        const result = await createLlcCheckoutSession({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          registrationId: input.id,
          origin: origin || "https://coachinayahturnkeytool.com",
        });
        return { checkoutUrl: result.checkoutUrl };
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Checkout session failed";
        throw new TRPCError({
          code: msg.includes("not payment_required") || msg.includes("already paid")
            ? "BAD_REQUEST"
            : msg.includes("not found") || msg.includes("Not found")
              ? "NOT_FOUND"
              : "INTERNAL_SERVER_ERROR",
          message: msg,
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
  // Admin: generate a live checkout link for any registration
  generateCheckoutLink: adminProcedure
    .input(registrationIdInput)
    .mutation(async ({ input }) => {
      const owner = await findLlcRegistrationOwner(input.id);
      if (!owner) throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      const bundle = await getLlcRegistrationById(owner.userId, input.id);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      const db = await getDb();
      let ownerEmail: string | undefined;
      let ownerName: string | undefined;
      if (db) {
        const [user] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, owner.userId));
        ownerEmail = user?.email ?? undefined;
        ownerName = user?.name ?? undefined;
      }
      const result = await createLlcCheckoutSession({
        userId: owner.userId,
        userEmail: ownerEmail,
        userName: ownerName,
        registrationId: input.id,
        origin: "https://coachinayahturnkeytool.com",
      });
      return { checkoutUrl: result.checkoutUrl };
    }),

  listAll: adminProcedure.query(async () => {
    const rows = await listAllLlcRegistrations();
    // Pass-through state fees for Doola wholesale math, loaded once per list.
    const stateFeeByState = new Map<string, number>(
      (await listStatePricingWithWholesale()).map((row) => [
        row.state,
        row.stateFeeCents ?? 0,
      ]),
    );
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
      // Wholesale: the provider checkout total (Whop) or the credit-pack
      // formation cost plus the state's pass-through fee (Doola).
      wholesaleCents:
        registration.provider === "doola"
          ? getDoolaFormationCostCents() +
            (stateFeeByState.get(registration.formationState ?? "") ?? 0)
          : registration.checkoutTotal,
      marginCents:
        registration.retailPriceCents !== null
          ? registration.provider === "doola"
            ? registration.retailPriceCents -
              (getDoolaFormationCostCents() +
                (stateFeeByState.get(registration.formationState ?? "") ?? 0))
            : registration.checkoutTotal !== null
              ? registration.retailPriceCents - registration.checkoutTotal
              : null
          : null,
      lastErrorMessage: registration.lastErrorMessage,
      // Provider truth for the list view: what doola's snapshot last said.
      stateRegistered:
        (registration.providerStatus as { state_registered?: boolean } | null)
          ?.state_registered === true,
      einRegistered:
        (registration.providerStatus as { ein_registered?: boolean } | null)
          ?.ein_registered === true,
      // Ops-only marker so the dashboard can badge demo/test rows; the
      // client registration view never carries the submission key.
      isDemo: isTestRegistration(registration),
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
      let result: { refreshed: boolean; message: string };
      try {
        result = await refreshLlcRegistrationStatus({
          userId: owner.userId,
          registrationId: input.id,
        });
      } catch {
        // Provider errors (e.g. a company id the current environment does not
        // know) must not surface as an opaque 500 — the stored status is
        // still valid.
        result = {
          refreshed: false,
          message:
            "The filing service could not answer for this order right now. The last confirmed status is unchanged.",
        };
      }
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

  /**
   * Refresh every state's fee to the provider's live fee table (fees are
   * billed through at cost). Retail prices and active flags are untouched.
   */
  /**
   * Load the operator fee sheet (the seeded reference table) into every
   * state's live fee. Counterpart to syncStateFees: sheet vs provider as
   * the authority. Retail prices and active flags untouched.
   */
  applyReferenceFees: adminProcedure.mutation(async () => {
    return applyReferenceFees();
  }),

  syncStateFees: adminProcedure.mutation(async () => {
    const fees = await listDoolaStateFees();
    return syncStateFeesFromProvider(fees);
  }),
  setExpeditePriceForAllStates: adminProcedure
    .input(
      z.object({
        expediteEinPriceCents: z
          .number()
          .int()
          .min(0)
          .max(10_000_000)
          .nullable(),
      }),
    )
    .mutation(async ({ input }) =>
      applyExpeditePriceToAllStates(input.expediteEinPriceCents),
    ),

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

  /**
   * Start an admin live-journey test run: a normal draft owned by the calling
   * admin whose immutable isTest marker makes every downstream layer (submit,
   * poller, ops alerts, client emails) treat it as demonstration-only. Not
   * routed through llc.create so webinar rehearsals never burn the member
   * create rate limit.
   */
  startTestRun: adminProcedure.mutation(async ({ ctx }) => {
    const registration = await createLlcRegistration(ctx.user.id, { isTest: true });
    return { id: registration.id };
  }),

  /**
   * Advance a TEST filing one stage along the fixed demo ladder:
   * payment_required → processing (also stamps retailPaidAt, so the payment
   * card clears exactly as it would for a paying client) → completed (attaches
   * the SAMPLE vault documents). Hard-refuses real registrations — this can
   * never touch a client's order.
   */
  advanceTestStage: adminProcedure
    .input(
      registrationIdInput.extend({
        // The stage the caller SAW when clicking: a stale click (double-tap,
        // second window) becomes a graceful no-op instead of skipping a stage.
        fromStatus: z.enum(["payment_required", "processing"]),
      }),
    )
    .mutation(async ({ input }) => {
      const owner = await findLlcRegistrationOwner(input.id);
      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      const bundle = await getLlcRegistrationById(owner.userId, input.id);
      if (!bundle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      const registration = bundle.registration;
      if (!registration.isTest) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only test filings can be advanced.",
        });
      }

      if (registration.status !== input.fromStatus) {
        // The row already moved past the stage this click intended to
        // advance — answer with the fresh view and change nothing.
        return { registration: bundleToRegistrationView(bundle) };
      }

      if (input.fromStatus === "payment_required") {
        await transitionLlcStatus({
          userId: owner.userId,
          registrationId: input.id,
          toStatus: "processing",
          source: "system",
          note: "[TEST] Simulated payment confirmation; filing marked in progress",
          expectedStatuses: ["payment_required"],
          updates: { retailPaidAt: new Date() },
        });
      } else {
        // Documents first, then the status flip: if a storage hiccup throws,
        // the row stays in "processing" and the click can simply be retried
        // (attachSampleDocuments only adds whichever document is missing).
        const companyName = `${registration.legalName ?? "Your Company"} ${registration.entitySuffix}`;
        const primaryFounder = bundle.founders.find((founder) => founder.isPrimary);
        await attachSampleDocuments({
          registrationId: input.id,
          ownerUserId: owner.userId,
          companyName,
          stateName: demoStateName(registration.formationState),
          filedOn: new Date(),
          memberName: primaryFounder
            ? `${primaryFounder.firstName ?? ""} ${primaryFounder.lastName ?? ""}`.trim()
            : undefined,
        });
        await transitionLlcStatus({
          userId: owner.userId,
          registrationId: input.id,
          toStatus: "completed",
          source: "system",
          note: "[TEST] Simulated completion; sample documents delivered",
          expectedStatuses: ["processing"],
        });
      }

      const fresh = await getLlcRegistrationById(owner.userId, input.id);
      if (!fresh) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found." });
      }
      return { registration: bundleToRegistrationView(fresh) };
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
      // Hard guard: rehearsal sends exist ONLY for demo/test filings — a real
      // client registration can never be replayed through this procedure.
      if (!isTestRegistration(bundle.registration)) {
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
      // Bill-first providers file the moment retail is confirmed. Async and
      // fire-and-forget: filing failures alert ops and mark the row failed
      // without blocking the Mark-paid action.
      void fileDoolaRegistration({
        userId: owner.userId,
        registrationId: input.id,
      }).catch((error) => {
        console.error("[LLC] Doola filing after markPaid failed:", error);
      });
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

/**
 * Annual report procedures (2026-10-20). Member ones (spread into llc.*) are signed-in only and scoped to her own
 * registration through the service's ownership check; ops ones (spread into llcOps.*) are admin-only. Every member
 * payload is built from our own words (shared/llcAnnualReports.ts), never from a provider response.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure } from "../../_core/trpc";
import { ENV } from "../../_core/env";
import { checkRateLimit } from "../../ops/rateLimit";
import { defaultAnnualReportDeps } from "./defaults";
import { createAnnualReportCheckout, processAnnualReportPayment, type AnnualReportPaymentResult } from "./payments";
import {
  AnnualReportError,
  getAnnualReportForm,
  getMemberAnnualReport,
  getOpsAnnualReports,
  opsConfirmAnnualReport,
  submitAnnualReport,
  type ConfirmOutcome,
} from "./service";

const HOUR_MS = 60 * 60 * 1000;

function limit(userId: number, action: string, max: number) {
  if (!checkRateLimit(`${action}:${userId}`, max, HOUR_MS)) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You’re doing that a little too often. Please wait a bit and try again." });
  }
}

const TRPC_CODES: Record<AnnualReportError["code"], TRPCError["code"]> = {
  not_found: "NOT_FOUND",
  not_eligible: "PRECONDITION_FAILED",
  not_required: "PRECONDITION_FAILED",
  locked: "CONFLICT",
  invalid: "BAD_REQUEST",
  conflict: "CONFLICT",
  unsupported: "PRECONDITION_FAILED",
  not_open: "PRECONDITION_FAILED",
  unavailable: "SERVICE_UNAVAILABLE",
};

function rethrow(error: unknown): never {
  if (error instanceof AnnualReportError) throw new TRPCError({ code: TRPC_CODES[error.code], message: error.message });
  if (error instanceof TRPCError) throw error;
  console.error("[LlcAnnualReport] procedure failed", { error: error instanceof Error ? error.name : "UnknownError" });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Something went wrong on our side. Nothing was charged. Please try again in a few minutes." });
}

const idInput = z.object({ id: z.number().int().positive() });
const addressInput = z.object({
  line1: z.string().max(200),
  line2: z.string().max(200).optional(),
  city: z.string().max(120),
  state: z.string().max(64),
  postalCode: z.string().max(20),
  country: z.string().max(3),
});
const answersInput = z.record(z.string().max(128), z.union([z.string().max(1000), z.number(), z.boolean(), addressInput, z.null()]));

/** What she reads after paying, in plain words, for each outcome. */
export function paymentOutcomeWords(outcome: ConfirmOutcome | AnnualReportPaymentResult["outcome"]): string {
  if (outcome === "confirmed" || outcome === "already_confirmed") return "Payment received. We're filing your annual report with the state.";
  return "We've got your payment. Our team is finishing your filing, and we'll email you when it's with the state.";
}

function requestOrigin(req: { headers: Record<string, string | string[] | undefined> }): string {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin) return origin;
  const referer = req.headers.referer;
  if (typeof referer === "string" && referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // fall through
    }
  }
  return ENV.appUrl || "https://coachinayahturnkeytool.com";
}

export const annualReportMemberProcedures = {
  /** Her annual report card for one LLC (null until the LLC is official). Reads the provider at most every 10 minutes. */
  annualReport: protectedProcedure.input(idInput).query(async ({ ctx, input }) => {
    try {
      return await getMemberAnnualReport(ctx.user.id, input.id, defaultAnnualReportDeps());
    } catch (error) {
      rethrow(error);
    }
  }),

  annualReportForm: protectedProcedure.input(idInput).query(async ({ ctx, input }) => {
    limit(ctx.user.id, "llc.annualReport.form", 60);
    try {
      return await getAnnualReportForm(ctx.user.id, input.id, defaultAnnualReportDeps());
    } catch (error) {
      rethrow(error);
    }
  }),

  submitAnnualReport: protectedProcedure.input(idInput.extend({ answers: answersInput })).mutation(async ({ ctx, input }) => {
    limit(ctx.user.id, "llc.annualReport.submit", 20);
    try {
      const result = await submitAnnualReport(ctx.user.id, input.id, input.answers, defaultAnnualReportDeps());
      return { ok: true as const, ...result };
    } catch (error) {
      // Answers to fix come back as data so the page can mark each question.
      if (error instanceof AnnualReportError && error.code === "invalid") {
        return { ok: false as const, message: error.message, fieldErrors: error.fieldErrors };
      }
      rethrow(error);
    }
  }),

  /** The hosted secure checkout for exactly the report's state fee; she comes back to her LLC page. */
  createAnnualReportCheckout: protectedProcedure
    .input(idInput.extend({ reportId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      limit(ctx.user.id, "llc.annualReport.checkout", 20);
      const session = await createAnnualReportCheckout({
        userId: ctx.user.id,
        registrationId: input.id,
        reportId: input.reportId,
        origin: requestOrigin(ctx.req as unknown as { headers: Record<string, string | string[] | undefined> }),
      });
      return { checkoutUrl: session.purchaseUrl, amountCents: session.amountCents };
    }),

  /** Back from checkout with a payment id: verified on the server against her own report, then confirmed. */
  confirmAnnualReportPayment: protectedProcedure
    .input(idInput.extend({ paymentId: z.string().trim().regex(/^pay_[A-Za-z0-9]+$/).max(128) }))
    .mutation(async ({ ctx, input }) => {
      limit(ctx.user.id, "llc.annualReport.confirm", 30);
      const result = await processAnnualReportPayment({ paymentId: input.paymentId, expectedUserId: ctx.user.id, expectedRegistrationId: input.id });
      if (!result || result.registrationId !== input.id) return { state: "pending" as const };
      if (result.outcome === "not_paid") return { state: "pending" as const };
      return { state: "confirmed" as const, message: paymentOutcomeWords(result.outcome) };
    }),
};

export const annualReportOpsProcedures = {
  /** The order's annual reports for /admin/llc; read again from the provider when the last read is over 10 minutes old. */
  annualReports: adminProcedure.input(idInput).query(async ({ input }) => getOpsAnnualReports(input.id, defaultAnnualReportDeps())),

  /** "Confirm filing" for a paid (or no-fee) report the hand-off missed. Still refuses without a verified payment. */
  confirmAnnualReport: adminProcedure
    .input(idInput.extend({ reportId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const deps = defaultAnnualReportDeps();
      const outcome = await opsConfirmAnnualReport(input.id, input.reportId, deps);
      const words: Record<ConfirmOutcome, string> = {
        confirmed: "Confirmed. The provider is filing it.",
        already_confirmed: "It was already handed over; the record is updated.",
        not_paid: "Not confirmed: there's no verified payment for this report's exact fee.",
        price_mismatch: "Not confirmed: the provider's fee no longer matches what she paid. See the ops alert.",
        confirm_failed: "The provider refused the confirm. See the last error; the hourly sweep retries.",
        not_found: "That report was not found on this order.",
        not_ready: "This report hasn't been submitted to the provider yet.",
      };
      return { outcome, message: words[outcome], view: await getOpsAnnualReports(input.id, deps) };
    }),
};

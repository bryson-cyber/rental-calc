import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { fundingConnections, type FundingConnection } from "../../drizzle/schema";
import {
  submitIntake,
  getIntakeStatus,
  getFundingReport,
  getConnectionSummary,
  isFundingSystemNotFound,
  type FundingConnectionSummary,
  type PartnerConnection,
} from "../_core/fundingSystem";

// ─── Funding Readiness — partner intake against the funding system ───
// State surfaced to the client. Credit summary values are fetched live from
// the funding system per request — only linkage/consent data is stored here.
type FundingIntakeState = {
  status: "none" | "pending" | "connected" | "gated" | "failed";
  email?: string;
  firstName?: string;
  fundingTimeline?: string | null;
  progress?: number;
  progressMessage?: string;
  error?: string | null;
  connectedAt?: Date | null;
  analyzedAt?: string | null;
  resultsUrl?: string | null;
  summary?: FundingConnectionSummary | null;
};

// Members never see raw upstream errors (API responses, status codes) — the
// raw text is kept in funding_connections.error for debugging.
const FRIENDLY_INTAKE_FAILURE =
  "We couldn't complete your soft credit check. Please try again in a few minutes — if it keeps happening, reach out to support.";

function intakeStateFromRow(
  row: FundingConnection,
  live?: PartnerConnection | null,
): FundingIntakeState {
  return {
    status: row.status,
    email: row.email,
    firstName: row.firstName ?? undefined,
    fundingTimeline: row.fundingTimeline,
    error: row.status === "failed" ? FRIENDLY_INTAKE_FAILURE : row.error,
    connectedAt: row.connectedAt,
    analyzedAt: live?.analyzedAt ?? null,
    resultsUrl: live?.resultsUrl ?? null,
    summary: live?.summary ?? null,
  };
}

// The soft-pull consent record needs the MEMBER'S browser IP, not this
// server's. With app.set('trust proxy', 1) (see _core/index.ts), Express's
// req.ip already resolves the spoof-resistant client address behind the
// reverse proxy — a client-supplied x-forwarded-for can't override it.
function memberIp(req: { ip?: string; headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
  if (req.ip) return req.ip;
  const fwd = req.headers["x-forwarded-for"];
  const first = Array.isArray(fwd) ? fwd[0] : typeof fwd === "string" ? fwd : "";
  return first.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
}

export const fundingRouter = router({
  intakeSubmit: protectedProcedure
    .input(z.object({
      firstName: z.string().trim().min(1, "First name is required").max(100),
      lastName: z.string().trim().min(1, "Last name is required").max(100),
      email: z.string().trim().toLowerCase().email("A valid email is required").max(320),
      phone: z.string().trim().min(10, "A valid phone number is required").max(20),
      // "just exploring" is allowed here — the funding system gates it
      // upstream (no pull) and we show friendly messaging instead.
      fundingTimeline: z.enum(["30_days", "60_90_days", "just_exploring"]),
      consentAccepted: z.literal(true),
    }))
    .mutation(async ({ input, ctx }): Promise<FundingIntakeState> => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Don't fire a second pull while one is already running for this member
      const existing = await db.select().from(fundingConnections)
        .where(eq(fundingConnections.userId, ctx.user.id)).limit(1);
      const current = existing[0];
      if (
        current?.status === "pending" &&
        current.fundingJobId &&
        Date.now() - new Date(current.updatedAt).getTime() < 10 * 60 * 1000
      ) {
        return { ...intakeStateFromRow(current), progressMessage: "Your soft credit check is still running." };
      }

      const consentAt = new Date();
      const consentIp = memberIp(ctx.req as unknown as Parameters<typeof memberIp>[0]);

      const response = await submitIntake({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        fundingTimeline: input.fundingTimeline,
        consentIP: consentIp,
        consentAt: consentAt.toISOString(),
        // An already-connected member resubmitting the form ("New Analysis")
        // explicitly wants a fresh soft pull — without this the funding
        // system's 30-day match window would just link the old analysis back.
        forceRefresh: current?.status === "connected" ? true : undefined,
      });

      const base = {
        userId: ctx.user.id,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        fundingTimeline: input.fundingTimeline,
        consentAt,
        consentIp,
        error: null as string | null,
      };

      const values =
        response.status === "matched"
          ? {
              ...base,
              status: "connected" as const,
              fundingJobId: null,
              fundingAnalysisId: response.connection.analysisId,
              resultsToken: response.connection.resultsToken,
              connectedAt: new Date(),
            }
          : response.status === "started"
            ? {
                ...base,
                status: "pending" as const,
                fundingJobId: response.jobId,
                fundingAnalysisId: null,
                resultsToken: null,
                connectedAt: null,
              }
            : {
                ...base,
                status: "gated" as const,
                fundingJobId: null,
                fundingAnalysisId: null,
                resultsToken: null,
                connectedAt: null,
              };

      const { userId: _userId, ...updateSet } = values;
      await db.insert(fundingConnections).values(values).onDuplicateKeyUpdate({ set: updateSet });

      if (response.status === "matched") {
        return {
          status: "connected",
          email: input.email,
          firstName: input.firstName,
          fundingTimeline: input.fundingTimeline,
          connectedAt: values.connectedAt,
          analyzedAt: response.connection.analyzedAt,
          resultsUrl: response.connection.resultsUrl,
          summary: response.connection.summary,
        };
      }
      if (response.status === "started") {
        return {
          status: "pending",
          email: input.email,
          firstName: input.firstName,
          fundingTimeline: input.fundingTimeline,
          progress: 5,
          progressMessage: "Starting your soft credit check...",
        };
      }
      return { status: "gated", email: input.email, firstName: input.firstName, fundingTimeline: input.fundingTimeline };
    }),

  intakeStatus: protectedProcedure.query(async ({ ctx }): Promise<FundingIntakeState> => {
    const db = await getDb();
    if (!db) return { status: "none" };

    const rows = await db.select().from(fundingConnections)
      .where(eq(fundingConnections.userId, ctx.user.id)).limit(1);
    const row = rows[0];
    if (!row) return { status: "none" };

    if (row.status === "pending" && row.fundingJobId) {
      try {
        const job = await getIntakeStatus(row.fundingJobId);

        if (job.status === "completed") {
          const connectedAt = new Date();
          await db.update(fundingConnections)
            .set({
              status: "connected",
              fundingAnalysisId: job.connection.analysisId,
              resultsToken: job.connection.resultsToken,
              connectedAt,
              error: null,
            })
            .where(eq(fundingConnections.id, row.id));
          return {
            ...intakeStateFromRow({ ...row, status: "connected", connectedAt }, job.connection),
          };
        }

        if (job.status === "failed") {
          const rawError = job.error || "The soft credit check could not be completed.";
          await db.update(fundingConnections)
            .set({ status: "failed", error: rawError })
            .where(eq(fundingConnections.id, row.id));
          return intakeStateFromRow({ ...row, status: "failed", error: rawError });
        }

        return {
          ...intakeStateFromRow(row),
          progress: job.progress,
          progressMessage: job.message,
        };
      } catch (error) {
        // A 404 on a job that's been pending a while means the funding
        // system no longer knows it (e.g. it restarted and lost the job) —
        // mark failed so the member gets a "Try Again" path instead of
        // polling a dead job forever.
        const jobAge = Date.now() - new Date(row.updatedAt).getTime();
        if (isFundingSystemNotFound(error) && jobAge > 5 * 60 * 1000) {
          const rawError = "Funding system no longer recognizes this soft-pull job (404).";
          await db.update(fundingConnections)
            .set({ status: "failed", error: rawError })
            .where(eq(fundingConnections.id, row.id));
          return intakeStateFromRow({ ...row, status: "failed", error: rawError });
        }
        // Otherwise (transient outage) — stay pending, client retries
        console.warn("[FundingIntake] Status poll failed:", error);
        return { ...intakeStateFromRow(row), progressMessage: "Waiting for the funding system..." };
      }
    }

    if (row.status === "connected") {
      const live = await getConnectionSummary(row.email);
      return intakeStateFromRow(row, live);
    }

    return intakeStateFromRow(row);
  }),

  // Curated funding report — fetched live from the funding system and
  // rendered in-platform; nothing from it is persisted here.
  report: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const rows = await db.select().from(fundingConnections)
      .where(eq(fundingConnections.userId, ctx.user.id)).limit(1);
    const row = rows[0];
    if (!row || row.status !== "connected") return null;

    return getFundingReport(row.email);
  }),
});

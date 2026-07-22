import { ENV } from "./env";
import { TRPCError } from "@trpc/server";

/**
 * Server-side client for the funding system's partner API
 * (0percentfunded.com). All calls carry the shared API key and run
 * exclusively on the server — no funding-system URL, key, or credit data
 * ever reaches the browser bundle.
 */

export type FundingIntakePayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  fundingTimeline: "30_days" | "60_90_days" | "just_exploring";
  /** Member's browser IP, forwarded for the soft-pull consent record. */
  consentIP: string;
  /** ISO timestamp of the member's consent action. */
  consentAt: string;
  /**
   * Bypass the funding system's 30-day match-first dedupe and run a fresh
   * soft pull (still rate-limited per email upstream).
   */
  forceRefresh?: boolean;
};

export type FundingConnectionSummary = {
  ficoScore: number | null;
  fundingAmount: number;
  eligibleBanks: string[];
  qualified: boolean;
  readinessRating: string | null;
};

export type PartnerConnection = {
  analysisId: number;
  resultsToken: string | null;
  analyzedAt: string | null;
  resultsUrl: string | null;
  summary: FundingConnectionSummary;
};

export type IntakeResponse =
  | { status: "matched"; connection: PartnerConnection }
  | { status: "started"; jobId: string }
  | { status: "gated"; leadSegment: string };

export type IntakeStatusResponse =
  | { status: "processing"; progress?: number; message?: string }
  | { status: "completed"; connection: PartnerConnection }
  | { status: "failed"; error?: string };

export function isFundingSystemConfigured(): boolean {
  return Boolean(ENV.fundingSystemUrl && ENV.fundingSystemApiKey);
}

/** A real FICO score is 300–850. Anything outside is bad upstream data → null. */
export function sanitizeFico(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 300 && v <= 850 ? Math.round(v) : null;
}
function sanitizeConnection(c: PartnerConnection): PartnerConnection {
  if (c?.summary) c.summary.ficoScore = sanitizeFico(c.summary.ficoScore);
  return c;
}

class FundingSystemError extends Error {
  constructor(message: string, public readonly httpStatus: number) {
    super(message);
    this.name = "FundingSystemError";
  }
}

/** True when the funding system answered 404 — the record/job doesn't exist upstream. */
export function isFundingSystemNotFound(error: unknown): boolean {
  return error instanceof FundingSystemError && error.httpStatus === 404;
}

async function callFundingSystem<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isFundingSystemConfigured()) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The funding system connection is not configured yet. Please try again later.",
    });
  }

  const url = `${ENV.fundingSystemUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-api-key": ENV.fundingSystemApiKey,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new FundingSystemError(
      `Funding system call failed (${response.status}): ${detail.slice(0, 300)}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export async function submitIntake(payload: FundingIntakePayload): Promise<IntakeResponse> {
  try {
    const result = await callFundingSystem<IntakeResponse>("/api/partner/intake", {
      method: "POST",
      body: JSON.stringify({ ...payload, source: "rentalcalc" }),
    });
    if (result.status === "matched") sanitizeConnection(result.connection);
    return result;
  } catch (error) {
    if (error instanceof FundingSystemError && error.httpStatus === 429) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many intake attempts for this email — please try again in an hour.",
      });
    }
    if (error instanceof TRPCError) throw error;
    console.error("[FundingSystem] Intake submit failed:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Couldn't reach the funding system. Please try again in a moment.",
    });
  }
}

export async function getIntakeStatus(jobId: string): Promise<IntakeStatusResponse> {
  const result = await callFundingSystem<IntakeStatusResponse>(`/api/partner/intake/${encodeURIComponent(jobId)}`);
  if (result.status === "completed") sanitizeConnection(result.connection);
  return result;
}

export type FundingReportBank = {
  name: string;
  eligible: boolean;
  eligibleWithCaveats: boolean;
  summary: string | null;
  estimatedAmount: number | null;
};

export type FundingReport = {
  fundingRange: { low: number; mid: number; high: number } | null;
  readiness: {
    score: number | null;
    rating: string | null;
    decision: string | null;
    primaryReason: string | null;
  };
  /** Anonymous aggregate of similar analyzed profiles (no names cross over). */
  similarProfiles: {
    totalAnalyzed: number | null;
    similarCount: number;
    avgFunding: number;
    minFunding: number;
    maxFunding: number;
  } | null;
  banks: FundingReportBank[];
  creditFactors: {
    ficoScore: number | null;
    utilization: number | null;
    hardInquiries: number | null;
    latePayments: number | null;
    collections: number | null;
    averageCreditAge: string | null;
    totalAccounts: number | null;
    totalCreditLimit: number | null;
  };
  workingForYou: string[];
  holdingYouBack: string[];
};

export type FundingReportResponse = {
  analyzedAt: string | null;
  pdfAvailable: boolean;
  report: FundingReport;
};

/**
 * Curated, member-facing funding report — fetched live, displayed in-platform,
 * never stored here. Returns null when no record exists or the funding system
 * is unreachable.
 */
export async function getFundingReport(email: string): Promise<FundingReportResponse | null> {
  try {
    const result = await callFundingSystem<{ found: boolean; analyzedAt?: string | null; pdfAvailable?: boolean; report?: FundingReport }>(
      `/api/partner/report?email=${encodeURIComponent(email)}`,
    );
    if (!result.found || !result.report) return null;
    if (result.report.creditFactors) {
      result.report.creditFactors.ficoScore = sanitizeFico(result.report.creditFactors.ficoScore);
    }
    return { analyzedAt: result.analyzedAt ?? null, pdfAvailable: result.pdfAvailable ?? false, report: result.report };
  } catch (error) {
    if (error instanceof FundingSystemError && error.httpStatus === 404) return null;
    console.warn("[FundingSystem] Report unavailable:", error);
    return null;
  }
}

/**
 * Streams the member's original credit-report PDF from the funding system.
 * Returns null when no PDF exists or the system is unreachable.
 */
export async function fetchReportPdf(email: string): Promise<Buffer | null> {
  if (!isFundingSystemConfigured()) return null;
  try {
    const url = `${ENV.fundingSystemUrl.replace(/\/$/, "")}/api/partner/report-pdf?email=${encodeURIComponent(email)}`;
    const response = await fetch(url, { headers: { "x-api-key": ENV.fundingSystemApiKey } });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.warn("[FundingSystem] Report PDF unavailable:", error);
    return null;
  }
}

/**
 * Live summary for an established connection. Returns null when the funding
 * system has no record or is unreachable — callers degrade gracefully
 * because the summary is display-only and never stored here.
 */
export async function getConnectionSummary(email: string): Promise<PartnerConnection | null> {
  try {
    const result = await callFundingSystem<{ found: boolean; connection?: PartnerConnection }>(
      `/api/partner/connection?email=${encodeURIComponent(email)}`,
    );
    return result.found && result.connection ? result.connection : null;
  } catch (error) {
    if (error instanceof FundingSystemError && error.httpStatus === 404) return null;
    console.warn("[FundingSystem] Connection summary unavailable:", error);
    return null;
  }
}

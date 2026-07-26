import { timingSafeEqual, createHash } from "node:crypto";
import type { Express, Request, Response } from "express";
import {
  listRegistrationsForStatusPolling,
  transitionLlcStatus,
  UNCERTAIN_ERROR_PREFIX,
} from "../llc/store";
import { refreshLlcRegistrationStatus } from "../llc/submission";
import { sendOpsAlert, submissionProblemAlert } from "./notify";

/**
 * A Doola row stuck in "submitting" with no company id means the process
 * died between the filing call and the persistence write — the $100 credit
 * may already be spent on a company we never recorded. After this grace
 * period the sweep recovers it to a retryable failure (a plain retry replays
 * the SAME stored idempotency key, so it re-attaches rather than double-files)
 * and alerts ops. Client edits stay frozen by the uncertain_ marker.
 */
const WEDGED_SUBMITTING_GRACE_MS = 20 * 60 * 1000;

/**
 * Periodic provider-status sync. Whop publishes no webhook for LLC formation,
 * so polling Retrieve Account is the only documented mechanism. Each refresh
 * reuses the same code path as the user-triggered refresh, including the ops
 * email that fires on every confirmed status transition.
 */
let pollInFlight = false;

export async function runStatusPollOnce(): Promise<{
  polled: number;
  failed: number;
  skipped: boolean;
}> {
  if (pollInFlight) return { polled: 0, failed: 0, skipped: true };
  pollInFlight = true;
  let polled = 0;
  let failed = 0;

  try {
    const registrations = await listRegistrationsForStatusPolling();
    for (const registration of registrations) {
      // Pollable = the provider leg exists: a Whop connected account or a
      // filed Doola company. Held/unfiled rows have nothing to ask about.
      if (registration.provider === "doola") {
        if (!registration.doolaCompanyId) {
          // Watchdog: recover a filing wedged mid-flight by a crash.
          if (
            registration.status === "submitting" &&
            Date.now() - new Date(registration.updatedAt).getTime() >
              WEDGED_SUBMITTING_GRACE_MS
          ) {
            const recovered = await transitionLlcStatus({
              userId: registration.userId,
              registrationId: registration.id,
              toStatus: "failed",
              source: "system",
              note: "Filing was interrupted mid-flight; recovered by the status poller",
              expectedStatuses: ["submitting"],
              updates: {
                lastErrorType: `${UNCERTAIN_ERROR_PREFIX}interrupted`,
                lastErrorMessage:
                  "Your filing needs a quick review by our team. Nothing further is needed from you right now.",
                retryable: true,
              },
            }).catch(() => ({ changed: false }));
            if (recovered.changed) {
              await sendOpsAlert(
                submissionProblemAlert({
                  registrationId: registration.id,
                  legalName: "(see order page)",
                  errorType: "uncertain_interrupted",
                  message:
                    "A filing was interrupted mid-flight (server restart?) and has been recovered to a retryable failure. Retry from the order page is safe — it replays the same idempotency key. Do NOT edit the order first.",
                  uncertain: true,
                }),
              ).catch(() => {});
            }
          }
          continue;
        }
      } else if (!registration.whopAccountId) {
        continue;
      }
      try {
        await refreshLlcRegistrationStatus({
          userId: registration.userId,
          registrationId: registration.id,
        });
        polled += 1;
      } catch (error) {
        failed += 1;
        console.warn("[Poller] Status refresh failed", {
          registrationId: registration.id,
          error: error instanceof Error ? error.name : "UnknownError",
        });
      }
      // Space out provider reads; beta rate limits are undocumented.
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  } catch (error) {
    console.warn("[Poller] Poll sweep failed", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
  } finally {
    pollInFlight = false;
  }

  return { polled, failed, skipped: false };
}

export function startStatusPoller() {
  const minutes = Number(process.env.POLL_INTERVAL_MINUTES ?? "60");
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.log("[Poller] Disabled (POLL_INTERVAL_MINUTES is unset or 0)");
    return;
  }
  const intervalMs = Math.max(5, minutes) * 60_000;
  const timer = setInterval(() => {
    void runStatusPollOnce();
  }, intervalMs);
  timer.unref?.();
  console.log(`[Poller] Checking filing status every ${Math.max(5, minutes)} minutes`);
}

function secretMatches(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string" || provided.length === 0) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * GET /api/poll lets an external scheduler (Zapier, cron-job.org) trigger a
 * sweep even if the in-process timer is not running. Disabled unless
 * POLL_SECRET is configured. The secret is accepted via the x-poll-secret
 * header (preferred) or ?secret= for schedulers that only support URLs. The
 * sweep runs in the background so the scheduler's request never times out.
 */
export function registerPollEndpoint(app: Express) {
  app.get("/api/poll", (req: Request, res: Response) => {
    const secret = process.env.POLL_SECRET;
    const provided = req.get("x-poll-secret") ?? req.query.secret;
    if (!secret || !secretMatches(provided, secret)) {
      res.status(404).end();
      return;
    }
    void runStatusPollOnce();
    res.status(202).json({ started: true });
  });
}

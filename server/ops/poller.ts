import { timingSafeEqual, createHash } from "node:crypto";
import type { Express, Request, Response } from "express";
import { listRegistrationsForStatusPolling } from "../llc/store";
import { refreshLlcRegistrationStatus } from "../llc/submission";

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
      if (!registration.whopAccountId) continue;
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

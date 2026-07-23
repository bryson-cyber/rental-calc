/**
 * Heartbeat HTTP Cron Handlers
 * 
 * These handlers are called by the Manus platform's Heartbeat system
 * at configured intervals. They replace the in-process setInterval timers
 * that would die when Cloud Run scales to zero.
 * 
 * Routes:
 *   POST /api/scheduled/webinar-import  — runs every 3 minutes
 *   POST /api/scheduled/sms-dispatch    — runs every 60 seconds
 * 
 * Auth: The platform sends a valid session cookie. We verify the JWT
 * is valid (same secret as user sessions). For project-level crons,
 * the JWT payload contains the project owner's identity.
 */

import type { Request, Response } from "express";
import { jwtVerify } from "jose";
import { inArray } from "drizzle-orm";
import { ENV } from "./_core/env";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { webinarSmsSettings } from "../drizzle/schema";

// ─── Cron liveness stamps ────────────────────────────────────────────────────
// Each successful handler run stamps a settings row, so /api/scheduled/health
// can answer "is anything actually polling this server?" in one request.
const CRON_STAMP_KEYS = {
  import: "cron_last_webinar_import_at",
  sms: "cron_last_sms_dispatch_at",
  email: "cron_last_email_dispatch_at",
} as const;

async function stampCronRun(key: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const now = new Date().toISOString();
    await db
      .insert(webinarSmsSettings)
      .values({ settingKey: key, settingValue: now })
      .onDuplicateKeyUpdate({ set: { settingValue: now } });
  } catch {
    // Liveness stamping must never break the cron itself
  }
}

// Cookie name must match the one used by the auth system
const COOKIE_NAME = "app_session_id";

/**
 * Cron auth, two independent paths:
 * 1. Shared secret — `x-cron-secret` header or `Authorization: Bearer <secret>`
 *    matching CRON_SECRET. Works from any scheduler (Manus task, Vercel cron,
 *    GitHub Actions, cron-job.org) and survives cookie-secret rotation.
 * 2. Legacy Heartbeat — a valid session JWT cookie.
 */
async function verifyCronAuth(req: Request): Promise<boolean> {
  // Path 1: shared secret header
  if (ENV.cronSecret) {
    const headerSecret =
      (req.headers["x-cron-secret"] as string | undefined) ||
      (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined);
    if (headerSecret && headerSecret === ENV.cronSecret) return true;
  }

  // Path 2: legacy session-cookie JWT (Manus Heartbeat)
  try {
    const cookieHeader = req.headers.cookie || "";
    const cookies = new Map<string, string>();
    for (const pair of cookieHeader.split(";")) {
      const [key, ...vals] = pair.trim().split("=");
      if (key) cookies.set(key.trim(), vals.join("=").trim());
    }

    const sessionCookie = cookies.get(COOKIE_NAME);
    if (!sessionCookie) {
      console.warn("[Scheduled] No session cookie in cron request (and no valid cron secret header)");
      return false;
    }

    const secret = new TextEncoder().encode(ENV.cookieSecret);
    await jwtVerify(sessionCookie, secret, { algorithms: ["HS256"] });
    return true;
  } catch (err: any) {
    console.warn("[Scheduled] Cron auth failed:", err.message);
    return false;
  }
}

/**
 * GET /api/scheduled/health
 *
 * Public read-only liveness report: when did each cron last complete?
 * Answers "is anything actually polling this server?" in one request —
 * if ageSeconds is null or large, no scheduler is driving the endpoints.
 */
export async function scheduledHealthHandler(_req: Request, res: Response) {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ ok: false, error: "database unavailable" });
    const rows = await db
      .select({ settingKey: webinarSmsSettings.settingKey, settingValue: webinarSmsSettings.settingValue })
      .from(webinarSmsSettings)
      .where(inArray(webinarSmsSettings.settingKey, Object.values(CRON_STAMP_KEYS)));
    const byKey = new Map(rows.map((r) => [r.settingKey, r.settingValue]));
    const now = Date.now();
    const report = (key: string) => {
      const v = byKey.get(key);
      const t = v ? Date.parse(v) : NaN;
      return {
        lastRunAt: v ?? null,
        ageSeconds: Number.isFinite(t) ? Math.round((now - t) / 1000) : null,
      };
    };
    return res.json({
      ok: true,
      now: new Date(now).toISOString(),
      webinarImport: report(CRON_STAMP_KEYS.import),
      smsDispatch: report(CRON_STAMP_KEYS.sms),
      emailDispatch: report(CRON_STAMP_KEYS.email),
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/scheduled/webinar-import
 *
 * Replaces the setInterval-based import cron.
 * Runs the webinar registrant import from WebinarJam.
 */
export async function webinarImportHandler(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const isAuthed = await verifyCronAuth(req);
    if (!isAuthed) {
      return res.status(403).json({ error: "cron-only" });
    }

    // Dynamically import to avoid circular dependencies
    const { runScheduledImport } = await import("./routers/webinar-sms");
    const result = await runScheduledImport();

    const elapsed = Date.now() - startTime;
    console.log(`[Scheduled] webinar-import completed in ${elapsed}ms:`, result);
    stampCronRun(CRON_STAMP_KEYS.import).catch(() => {});

    return res.json({ ok: true, elapsed, ...result });
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Scheduled] webinar-import FAILED after ${elapsed}ms:`, err.message);
    
    // Alert the owner
    notifyOwner({
      title: "🚨 Scheduled Webinar Import Failed",
      content: `The scheduled webinar import handler failed.\n\nError: ${err.message}\n\nThis means new registrants are NOT being imported.`,
    }).catch(() => {});

    return res.status(500).json({
      error: err.message,
      stack: err.stack?.split("\n").slice(0, 5).join("\n"),
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * POST /api/scheduled/sms-dispatch
 * 
 * Replaces the setInterval-based SMS dispatcher.
 * Checks for due messages and sends them.
 */
export async function smsDispatchHandler(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const isAuthed = await verifyCronAuth(req);
    if (!isAuthed) {
      return res.status(403).json({ error: "cron-only" });
    }

    // Dynamically import to avoid circular dependencies
    const { runScheduledDispatch } = await import("./routers/webinar-sms");
    const result = await runScheduledDispatch();

    const elapsed = Date.now() - startTime;
    console.log(`[Scheduled] sms-dispatch completed in ${elapsed}ms:`, result);
    stampCronRun(CRON_STAMP_KEYS.sms).catch(() => {});

    return res.json({ ok: true, elapsed, ...result });
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Scheduled] sms-dispatch FAILED after ${elapsed}ms:`, err.message);
    
    // Alert the owner
    notifyOwner({
      title: "\uD83D\uDEA8 Scheduled SMS Dispatch Failed",
      content: `The scheduled SMS dispatch handler failed.\n\nError: ${err.message}\n\nThis may mean scheduled messages are not being sent.`,
    }).catch(() => {});

    return res.status(500).json({
      error: err.message,
      stack: err.stack?.split("\n").slice(0, 5).join("\n"),
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * POST /api/scheduled/email-dispatch
 * 
 * Independent email dispatch handler (decoupled from SMS).
 * Checks for due messages and sends HubSpot SMTP emails.
 */
export async function emailDispatchHandler(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const isAuthed = await verifyCronAuth(req);
    if (!isAuthed) {
      return res.status(403).json({ error: "cron-only" });
    }

    // Dynamically import to avoid circular dependencies
    const { runScheduledEmailDispatch } = await import("./routers/webinar-sms");
    const result = await runScheduledEmailDispatch();

    const elapsed = Date.now() - startTime;
    console.log(`[Scheduled] email-dispatch completed in ${elapsed}ms:`, result);
    stampCronRun(CRON_STAMP_KEYS.email).catch(() => {});

    return res.json({ ok: true, elapsed, ...result });
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Scheduled] email-dispatch FAILED after ${elapsed}ms:`, err.message);
    
    // Alert the owner
    notifyOwner({
      title: "\uD83D\uDEA8 Scheduled Email Dispatch Failed",
      content: `The scheduled email dispatch handler failed.\n\nError: ${err.message}\n\nThis may mean webinar reminder emails are not being sent.`,
    }).catch(() => {});

    return res.status(500).json({
      error: err.message,
      stack: err.stack?.split("\n").slice(0, 5).join("\n"),
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * POST /api/scheduled/llc-status-poll
 *
 * Heartbeat-driven LLC filing-status poll. Runs one sweep of the LLC
 * status poller (provider status refresh for submitted registrations).
 * Safe to call at any interval: the sweep is single-flight and a no-op
 * when no registrations are awaiting provider updates.
 */
export async function llcStatusPollHandler(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const isAuthed = await verifyCronAuth(req);
    if (!isAuthed) {
      return res.status(403).json({ error: "cron-only" });
    }

    // Dynamically import to avoid circular dependencies
    const { runStatusPollOnce } = await import("./ops/poller");
    const result = await runStatusPollOnce();

    const elapsed = Date.now() - startTime;
    console.log(`[Scheduled] llc-status-poll completed in ${elapsed}ms:`, result);

    return res.json({ ok: true, elapsed, ...result });
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Scheduled] llc-status-poll FAILED after ${elapsed}ms:`, err.message);

    // Alert the owner
    notifyOwner({
      title: "🚨 Scheduled LLC Status Poll Failed",
      content: `The scheduled LLC status poll handler failed.\n\nError: ${err.message}\n\nThis may mean LLC filing statuses are not being refreshed automatically.`,
    }).catch(() => {});

    return res.status(500).json({
      error: err.message,
      stack: err.stack?.split("\n").slice(0, 5).join("\n"),
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}

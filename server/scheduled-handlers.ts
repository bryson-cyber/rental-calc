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
import { ENV } from "./_core/env";
import { notifyOwner } from "./_core/notification";

// Cookie name must match the one used by the auth system
const COOKIE_NAME = "app_session_id";

/**
 * Lightweight cron auth — verifies the session JWT is valid.
 * The Heartbeat platform sends the cron owner's session cookie.
 * Returns true if authenticated, false otherwise.
 */
async function verifyCronAuth(req: Request): Promise<boolean> {
  try {
    // Parse cookies from the request
    const cookieHeader = req.headers.cookie || "";
    const cookies = new Map<string, string>();
    for (const pair of cookieHeader.split(";")) {
      const [key, ...vals] = pair.trim().split("=");
      if (key) cookies.set(key.trim(), vals.join("=").trim());
    }

    const sessionCookie = cookies.get(COOKIE_NAME);
    if (!sessionCookie) {
      console.warn("[Scheduled] No session cookie in cron request");
      return false;
    }

    // Verify the JWT
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    await jwtVerify(sessionCookie, secret, { algorithms: ["HS256"] });
    return true;
  } catch (err: any) {
    console.warn("[Scheduled] Cron auth failed:", err.message);
    return false;
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

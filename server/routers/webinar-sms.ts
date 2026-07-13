/**
 * Webinar SMS Router — COMPLETELY ISOLATED
 * 
 * This router handles:
 * 1. Registrant management (CRUD, import from WebinarJam, CSV)
 * 2. SMS template management (CRUD)
 * 3. SMS campaign management (create, send, track)
 * 4. WebinarJam API integration (fetch webinars, import registrants)
 * 5. SimpleTexting API integration (send SMS)
 * 
 * ISOLATION: This file imports ONLY from:
 * - drizzle/schema (webinar_* tables only)
 * - server/_core (trpc, env)
 * - server/db (getDb)
 * - drizzle-orm (query helpers)
 * - zod (validation)
 * 
 * It does NOT import from any other feature router or module.
 */

import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import {
  webinarRegistrants,
  webinarSmsTemplates,
  webinarSmsCampaigns,
  webinarSmsDeliveries,
  webinarSmsSettings,
  scheduledSmsMessages,
  webinarCredentials,
  webinarTranscripts,
  webinarReminderSchedule,
  emailSendLog,
} from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { eq, desc, sql, and, inArray, count, lte, ne, isNull, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { sendCalendarInvite, sendBulkCalendarInvites, checkCalendarHealth, sendCalendarReminderUpdates } from "../google-calendar";
import { notifyOwner } from "../_core/notification";
import { sendBulkReminderEmails, sendReminderEmail, checkGmailHealth, buildWebinarReminderEmail, buildPostWebinarEmail } from "../gmail-reminders";
import { sendWebinarEmail, buildWebinarEmail, verifyHubSpotSmtp } from "../hubspot-smtp";
import {
  initDispatcherV2,
  runScheduledDispatchV2,
  startSmsDispatcherV2,
  getSmsDispatcherInterval,
} from "./sms-dispatcher-v2";

// ─── Default Calendar Event Description ──────────────────────────────────────

const DEFAULT_CALENDAR_EVENT_NAME = "LIVE: Coach Inayah's 5-Step Airbnb Masterclass";

const DEFAULT_CALENDAR_DESCRIPTION = `Join Coach Inayah for an exclusive live masterclass where you'll learn the proven 5-Step System to launch your short-term rental business — even with no experience, no property, and no perfect credit.

What You'll Learn:
• Step 1: Setting Up Your Business Entity (LLC)
• Step 2: Building Business Credit
• Step 3: Securing Your First Property
• Step 4: Funding Your Deal
• Step 5: Launching & Scaling

This is the exact system Coach Inayah used to build a multi-property portfolio and has helped hundreds of students do the same.`;

// ─── Helper: SimpleTexting API ───────────────────────────────────────────────

async function sendSms(phone: string, message: string): Promise<{ success: boolean; smsId?: string; error?: string }> {
  const apiKey = ENV.simpletextingApiKey;
  if (!apiKey) {
    return { success: false, error: "SimpleTexting API key not configured" };
  }

  // Strip phone to digits only (remove +, spaces, dashes, parens)
  const cleanPhone = phone.replace(/[^\d]/g, "");

  // Reject international numbers early — SimpleTexting only supports US/Canada
  if (!isUsCanadaPhone(cleanPhone)) {
    console.log(`[WebinarSMS] Skipping international number: ${phone} (${cleanPhone.length} digits)`);
    return { success: false, error: `International number skipped (not US/Canada): ${phone}` };
  }

  // For US numbers: ensure 10 digits (strip leading 1 if 11 digits)
  const normalizedPhone = cleanPhone.length === 11 && cleanPhone.startsWith("1")
    ? cleanPhone.slice(1)
    : cleanPhone;
  
  if (normalizedPhone.length < 10) {
    return { success: false, error: `Invalid phone number: ${phone} -> ${normalizedPhone} (too short)` };
  }

  // Use SimpleTexting v2 API with Bearer auth and JSON body
  const endpoint = "https://api-app2.simpletexting.com/v2/api/messages";

  // AUTO mode lets SimpleTexting decide SMS vs MMS based on content length
  const requestBody = {
    contactPhone: normalizedPhone,
    mode: message.length > 160 ? "MMS_PREFERRED" : "AUTO",
    text: message,
  };

  try {
    console.log(`[WebinarSMS] Sending to ${normalizedPhone} via v2 API, mode: ${requestBody.mode}, message length: ${message.length}`);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10_000),
    });

    const text = await res.text();
    console.log(`[WebinarSMS] SimpleTexting v2 response status: ${res.status}, body: ${text.substring(0, 500)}`);
    
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, error: `SimpleTexting returned non-JSON (status ${res.status}): ${text.substring(0, 200)}` };
    }
    
    // v2 API returns 201 on success with { id, credits }
    if (res.status === 201 && data.id) {
      return { success: true, smsId: data.id };
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // AUTO-RETRY: If contact is marked as invalid, delete and re-create
    // the contact, then retry the send once.
    // This handles cases where SimpleTexting flagged a contact due to
    // duplicate sends or carrier rejections that are no longer relevant.
    // ═══════════════════════════════════════════════════════════════════
    const errorMsg = data.message || data.errorMessage || data.error || JSON.stringify(data);
    const isInvalidContact = res.status === 409 && (
      errorMsg.toLowerCase().includes("contact marked as invalid") ||
      errorMsg.toLowerCase().includes("invalid_contact") ||
      (data.errorCode && data.errorCode === "INVALID_CONTACT")
    );

    if (isInvalidContact) {
      console.log(`[WebinarSMS] Contact ${normalizedPhone} marked as invalid — attempting auto-recovery (delete + re-create + retry)`);
      try {
        // Step 1: Delete the invalid contact
        const deleteRes = await fetch(`https://api-app2.simpletexting.com/v2/api/contacts/${normalizedPhone}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10_000),
        });
        console.log(`[WebinarSMS] Delete contact ${normalizedPhone}: status ${deleteRes.status}`);

        // Step 2: Re-create the contact (small delay to let deletion propagate)
        await new Promise(resolve => setTimeout(resolve, 500));
        const createRes = await fetch("https://api-app2.simpletexting.com/v2/api/contacts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ contactPhone: normalizedPhone }),
          signal: AbortSignal.timeout(10_000),
        });
        const createText = await createRes.text();
        console.log(`[WebinarSMS] Re-create contact ${normalizedPhone}: status ${createRes.status}, body: ${createText.substring(0, 200)}`);

        // Step 3: Retry the original send (small delay)
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryRes = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(10_000),
        });
        const retryText = await retryRes.text();
        console.log(`[WebinarSMS] Retry send to ${normalizedPhone}: status ${retryRes.status}, body: ${retryText.substring(0, 500)}`);

        let retryData: any;
        try { retryData = JSON.parse(retryText); } catch { retryData = {}; }

        if (retryRes.status === 201 && retryData.id) {
          console.log(`[WebinarSMS] AUTO-RECOVERY SUCCESS: ${normalizedPhone} re-created and message sent (id: ${retryData.id})`);
          return { success: true, smsId: retryData.id };
        }

        const retryError = retryData.message || retryData.errorMessage || retryData.error || JSON.stringify(retryData);
        console.warn(`[WebinarSMS] AUTO-RECOVERY FAILED on retry send: ${retryError}`);
        return { success: false, error: `SimpleTexting error after auto-recovery retry (${retryRes.status}): ${retryError}` };
      } catch (recoveryErr: any) {
        console.error(`[WebinarSMS] AUTO-RECOVERY exception for ${normalizedPhone}:`, recoveryErr.message);
        return { success: false, error: `SimpleTexting error (${res.status}): ${errorMsg} [auto-recovery failed: ${recoveryErr.message}]` };
      }
    }

    return { success: false, error: `SimpleTexting error (${res.status}): ${errorMsg}` };
  } catch (err: any) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      console.error(`[WebinarSMS] SimpleTexting request timed out (10s) for ${normalizedPhone}`);
      return { success: false, error: "SimpleTexting request timed out (10s)" };
    }
    console.error("[WebinarSMS] SimpleTexting v2 send error:", err.message);
    return { success: false, error: err.message };
  }
}

// ─── Helper: WebinarJam API ──────────────────────────────────────────────────

async function fetchWebinarJamWebinars(): Promise<any[]> {
  const apiKey = ENV.webinarjamApiKey;
  if (!apiKey) throw new TRPCError({ code: "BAD_REQUEST", message: "WebinarJam API key not configured" });

  const body = new URLSearchParams({ api_key: apiKey });
  const res = await fetch("https://api.webinarjam.com/webinarjam/webinars", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (data.status === "success") {
    return data.webinars || [];
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: data.message || "Failed to fetch webinars" });
}

async function fetchWebinarJamRegistrants(
  webinarId: string,
  scheduleId?: number,
  page: number = 1,
  overrideApiKey?: string
): Promise<{ registrants: any[]; hasMore: boolean }> {
  const apiKey = overrideApiKey || ENV.webinarjamApiKey;
  if (!apiKey) throw new TRPCError({ code: "BAD_REQUEST", message: "WebinarJam API key not configured" });

  const params: Record<string, string> = {
    api_key: apiKey,
    webinar_id: webinarId,
    page: String(page),
  };
  if (scheduleId) params.schedule_id = String(scheduleId);

  const body = new URLSearchParams(params);
  const res = await fetch("https://api.webinarjam.com/webinarjam/registrants", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (data.status === "success") {
    // WebinarJam API returns a paginated object: { current_page, data: [...], per_page, last_page, total }
    const paginatedResult = data.registrants || {};
    const registrants = Array.isArray(paginatedResult) ? paginatedResult : (paginatedResult.data || []);
    const currentPage = paginatedResult.current_page || page;
    const lastPage = paginatedResult.last_page || 1;
    const hasMore = currentPage < lastPage;
    return { registrants, hasMore };
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: data.message || "Failed to fetch registrants" });
}

async function fetchWebinarJamDetails(webinarId: string, overrideApiKey?: string): Promise<any> {
  const apiKey = overrideApiKey || ENV.webinarjamApiKey;
  if (!apiKey) throw new TRPCError({ code: "BAD_REQUEST", message: "WebinarJam API key not configured" });

  const body = new URLSearchParams({ api_key: apiKey, webinar_id: webinarId });
  const res = await fetch("https://api.webinarjam.com/webinarjam/webinar", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (data.status === "success") {
    return data.webinar;
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: data.message || "Failed to fetch webinar details" });
}

// ─── Helper: Phone normalization ─────────────────────────────────────────────

function normalizePhone(phone: string): string {
  // Strip everything except digits
  const digits = phone.replace(/\D/g, "");
  // If 11 digits starting with 1, strip the leading 1
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  // If 10 digits, return as-is
  if (digits.length === 10) return digits;
  // Return whatever we have (may be international)
  return digits;
}

/**
 * Check if a phone number is a valid US/Canada number.
 * SimpleTexting only supports US/Canada (NANP) numbers.
 * Valid formats: 10 digits, or 11 digits starting with 1.
 */
function isUsCanadaPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  // 10-digit US/Canada number
  if (digits.length === 10) return true;
  // 11-digit with leading 1 (US/Canada country code)
  if (digits.length === 11 && digits.startsWith("1")) return true;
  return false;
}

// ─── Helper: Template variable replacement ───────────────────────────────────

function renderMessage(template: string, vars: Record<string, string>): string {
  let result = template;
  // Support both {{var}} and %VAR% formats
  for (const [key, value] of Object.entries(vars)) {
    // Replace {{key}} format
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  // Also replace %FIRST_NAME%, %FULL_NAME%, %EMAIL% format (used by AI composer and templates)
  if (vars.name) {
    result = result.replace(/%FIRST_NAME%/g, vars.name);
  }
  if (vars.fullname) {
    result = result.replace(/%FULL_NAME%/g, vars.fullname);
  }
  if (vars.email) {
    result = result.replace(/%EMAIL%/g, vars.email);
  }
  return result;
}

// ─── In-memory cancellation sets (signal mid-send loops to stop) ────────────
const cancelledCampaignIds = new Set<number>();
const cancelledScheduledMessageIds = new Set<number>();

// ─── Helper: Background campaign send processing ───────────────────────────

// Helper: Check if a message body contains unfilled placeholders that should block sending
function hasUnfilledPlaceholders(messageBody: string): string | null {
  const placeholders = ["[REPLAY_LINK]", "[WEBINAR_LINK]"];
  for (const p of placeholders) {
    if (messageBody.includes(p)) return p;
  }
  return null;
}

async function processCampaignSends(
  campaignId: number,
  recipients: Array<{ id: number; name: string; email: string | null; phone: string }>,
  messageBody: string
) {
  const db = await getDb();
  if (!db) {
    console.error(`[WebinarSMS] Campaign ${campaignId}: Database unavailable for background sends`);
    return;
  }

  // GUARD: Block sending if message contains unfilled placeholders
  const unfilledPlaceholder = hasUnfilledPlaceholders(messageBody);
  if (unfilledPlaceholder) {
    console.error(`[WebinarSMS] Campaign ${campaignId} BLOCKED: Message contains unfilled placeholder ${unfilledPlaceholder}`);
    await db.update(webinarSmsCampaigns).set({
      status: "failed",
      sentCount: 0,
      failedCount: recipients.length,
      completedAt: new Date(),
    }).where(eq(webinarSmsCampaigns.id, campaignId));
    return;
  }

  // DEDUP: Remove duplicate phone numbers — only send once per unique phone
  const seenPhones = new Set<string>();
  const dedupedRecipients: typeof recipients = [];
  for (const r of recipients) {
    const normalized = normalizePhone(r.phone);
    if (!seenPhones.has(normalized)) {
      seenPhones.add(normalized);
      dedupedRecipients.push(r);
    }
  }
  if (dedupedRecipients.length < recipients.length) {
    console.log(`[WebinarSMS] Campaign ${campaignId}: Deduped ${recipients.length} → ${dedupedRecipients.length} unique phones`);
    // Update totalRecipients to reflect actual send count
    await db.update(webinarSmsCampaigns).set({ totalRecipients: dedupedRecipients.length }).where(eq(webinarSmsCampaigns.id, campaignId));
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of dedupedRecipients) {
      // Check if campaign was cancelled mid-send
      if (cancelledCampaignIds.has(campaignId)) {
        console.log(`[Campaign ${campaignId}] Cancelled mid-send after ${sentCount} sent, ${failedCount} failed`);
        await db.update(webinarSmsCampaigns).set({ status: "cancelled" }).where(eq(webinarSmsCampaigns.id, campaignId));
        cancelledCampaignIds.delete(campaignId);
        return;
      }
    const personalizedMessage = renderMessage(messageBody, {
      name: recipient.name.split(" ")[0],
      fullname: recipient.name,
      email: recipient.email || "",
    });

    const result = await sendSms(normalizePhone(recipient.phone), personalizedMessage);

    await db.insert(webinarSmsDeliveries).values({
      campaignId,
      registrantId: recipient.id,
      phone: recipient.phone,
      deliveryStatus: result.success ? "sent" : "failed",
      externalMessageId: result.smsId,
      error: result.error,
    });

    if (result.success) {
      sentCount++;
    } else {
      failedCount++;
    }

    // Update counts periodically (every 10 sends) so frontend can poll progress
    if ((sentCount + failedCount) % 10 === 0) {
      await db.update(webinarSmsCampaigns).set({
        sentCount,
        failedCount,
      }).where(eq(webinarSmsCampaigns.id, campaignId));
    }

    // Small delay between sends to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  // Final update
  await db.update(webinarSmsCampaigns).set({
    sentCount,
    failedCount,
    status: failedCount === dedupedRecipients.length ? "failed" : sentCount === 0 ? "failed" : "completed",
    completedAt: new Date(),
  }).where(eq(webinarSmsCampaigns.id, campaignId));

  console.log(`[WebinarSMS] Campaign ${campaignId} completed: ${sentCount} sent, ${failedCount} failed out of ${dedupedRecipients.length}`);
}

// ─── Sync Progress Tracker ──────────────────────────────────────────────────
let syncProgress: { running: boolean; processed: number; total: number; added: number; skipped: number; failed: number } = {
  running: false, processed: 0, total: 0, added: 0, skipped: 0, failed: 0,
};

// ─── Router ──────────────────────────────────────────────────────────────────

export const webinarSmsRouter = router({

  // ═══ SYSTEM HEALTH ═══════════════════════════════════════════════════════════

  /** Comprehensive health check for the webinar automation system */
  getSystemHealth: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { status: "critical", error: "Database unavailable", checks: [] };

      const checks: Array<{ name: string; status: "ok" | "warning" | "error"; detail: string }> = [];

      // 1. Check SMS dispatcher is running (last message sent within expected window)
      try {
        const [lastSent] = await db.select({ sentAt: scheduledSmsMessages.sentAt, sequenceName: scheduledSmsMessages.sequenceName })
          .from(scheduledSmsMessages)
          .where(eq(scheduledSmsMessages.status, "sent"))
          .orderBy(desc(scheduledSmsMessages.sentAt))
          .limit(1);
        if (lastSent?.sentAt) {
          const ageMs = Date.now() - new Date(lastSent.sentAt).getTime();
          const ageHours = Math.round(ageMs / 3600000);
          checks.push({ name: "SMS Dispatcher", status: "ok", detail: `Last sent: "${lastSent.sequenceName}" (${ageHours}h ago)` });
        } else {
          checks.push({ name: "SMS Dispatcher", status: "warning", detail: "No messages have been sent yet" });
        }
      } catch (e: any) {
        checks.push({ name: "SMS Dispatcher", status: "error", detail: e.message });
      }

      // 2. Check for pending messages that are overdue (should have fired but didn't)
      try {
        const now = new Date();
        const overdueMessages = await db.select({ id: scheduledSmsMessages.id, sequenceName: scheduledSmsMessages.sequenceName, scheduledAt: scheduledSmsMessages.scheduledAt })
          .from(scheduledSmsMessages)
          .where(
            and(
              eq(scheduledSmsMessages.status, "pending"),
              lte(scheduledSmsMessages.scheduledAt, now)
            )
          );
        if (overdueMessages.length > 0) {
          checks.push({ name: "Overdue Messages", status: "error", detail: `${overdueMessages.length} message(s) overdue: ${overdueMessages.map(m => `"${m.sequenceName}"`).join(", ")}` });
        } else {
          checks.push({ name: "Overdue Messages", status: "ok", detail: "No overdue messages" });
        }
      } catch (e: any) {
        checks.push({ name: "Overdue Messages", status: "error", detail: e.message });
      }

      // 3. Check failed messages in last 24h
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const failedMessages = await db.select({ id: scheduledSmsMessages.id, sequenceName: scheduledSmsMessages.sequenceName, error: scheduledSmsMessages.error })
          .from(scheduledSmsMessages)
          .where(
            and(
              eq(scheduledSmsMessages.status, "failed"),
              gte(scheduledSmsMessages.sentAt, oneDayAgo)
            )
          );
        if (failedMessages.length > 0) {
          checks.push({ name: "Failed Messages (24h)", status: "error", detail: `${failedMessages.length} failed: ${failedMessages.map(m => `"${m.sequenceName}" (${m.error || "unknown"})`).join("; ")}` });
        } else {
          checks.push({ name: "Failed Messages (24h)", status: "ok", detail: "No failures in last 24h" });
        }
      } catch (e: any) {
        checks.push({ name: "Failed Messages (24h)", status: "error", detail: e.message });
      }

      // 4. Check import cron health
      try {
        const rows = await db.select().from(webinarSmsSettings);
        const settings: Record<string, string> = {};
        for (const row of rows) settings[row.settingKey] = row.settingValue;

        const lastImport = settings["last_auto_import_at"];
        const cronEnabled = settings["cron_enabled"] === "true";
        const intervalMin = parseInt(settings["cron_interval_minutes"] || "3", 10);

        if (!cronEnabled) {
          checks.push({ name: "Import Cron", status: "warning", detail: "Auto-import is disabled" });
        } else if (lastImport) {
          const ageMs = Date.now() - new Date(lastImport).getTime();
          const ageMin = Math.round(ageMs / 60000);
          const isStale = ageMin > intervalMin * 3; // 3x the interval = stale
          checks.push({
            name: "Import Cron",
            status: isStale ? "error" : "ok",
            detail: isStale ? `Last import was ${ageMin}min ago (expected every ${intervalMin}min) — cron may have stopped` : `Running normally (last: ${ageMin}min ago)`,
          });
        } else {
          checks.push({ name: "Import Cron", status: "warning", detail: "Cron enabled but no imports recorded yet" });
        }
      } catch (e: any) {
        checks.push({ name: "Import Cron", status: "error", detail: e.message });
      }

      // 5. Check Google Calendar health
      try {
        const calHealth = await checkCalendarHealth();
        const calOk = calHealth.configured && calHealth.authenticated;
        checks.push({
          name: "Google Calendar",
          status: calOk ? "ok" : "error",
          detail: calOk ? `Connected (impersonating ${calHealth.impersonateEmail})` : `Error: ${calHealth.error || "not configured"}`,
        });
      } catch (e: any) {
        checks.push({ name: "Google Calendar", status: "error", detail: e.message });
      }

      // 6. Check Gmail health
      try {
        const gmailHealth = await checkGmailHealth();
        const gmailOk = gmailHealth.configured && gmailHealth.authorized;
        checks.push({
          name: "Gmail",
          status: gmailOk ? "ok" : "error",
          detail: gmailOk ? "Connected and ready" : `Error: ${gmailHealth.error || "not configured"}`,
        });
      } catch (e: any) {
        checks.push({ name: "Gmail", status: "error", detail: e.message });
      }

      // 7. Check SimpleTexting API connectivity
      try {
        const stApiKey = ENV.simpletextingApiKey;
        if (!stApiKey) {
          checks.push({ name: "SimpleTexting", status: "error", detail: "API key not configured" });
        } else {
          checks.push({ name: "SimpleTexting", status: "ok", detail: "API key configured" });
        }
      } catch (e: any) {
        checks.push({ name: "SimpleTexting", status: "error", detail: e.message });
      }

      // 8. Upcoming messages summary
      try {
        const upcoming = await db.select({ id: scheduledSmsMessages.id, sequenceName: scheduledSmsMessages.sequenceName, scheduledAt: scheduledSmsMessages.scheduledAt, audience: scheduledSmsMessages.audience })
          .from(scheduledSmsMessages)
          .where(eq(scheduledSmsMessages.status, "pending"))
          .orderBy(scheduledSmsMessages.scheduledAt)
          .limit(5);
        if (upcoming.length > 0) {
          const nextMsg = upcoming[0];
          const timeUntil = Math.round((new Date(nextMsg.scheduledAt).getTime() - Date.now()) / 60000);
          checks.push({ name: "Next Scheduled", status: "ok", detail: `"${nextMsg.sequenceName}" in ${timeUntil}min (${upcoming.length} total pending)` });
        } else {
          checks.push({ name: "Next Scheduled", status: "ok", detail: "No pending messages" });
        }
      } catch (e: any) {
        checks.push({ name: "Next Scheduled", status: "error", detail: e.message });
      }

      // Overall status
      const hasError = checks.some(c => c.status === "error");
      const hasWarning = checks.some(c => c.status === "warning");
      const overallStatus = hasError ? "error" : hasWarning ? "warning" : "healthy";

      return { status: overallStatus, checks, timestamp: new Date().toISOString() };
    }),

  // ═══ REGISTRANTS ═══════════════════════════════════════════════════════════

  /** List registrants with pagination and filtering */
  listRegistrants: adminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(50),
      source: z.string().optional(),
      webinarId: z.string().optional(),
      attended: z.number().optional(),
      optedOut: z.number().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions: any[] = [];
      if (input.source) conditions.push(eq(webinarRegistrants.source, input.source));
      if (input.webinarId) conditions.push(eq(webinarRegistrants.webinarId, input.webinarId));
      if (input.attended !== undefined) conditions.push(eq(webinarRegistrants.attended, input.attended));
      if (input.optedOut !== undefined) conditions.push(eq(webinarRegistrants.optedOut, input.optedOut));
      if (input.search) {
        conditions.push(
          sql`(${webinarRegistrants.name} LIKE ${`%${input.search}%`} OR ${webinarRegistrants.email} LIKE ${`%${input.search}%`} OR ${webinarRegistrants.phone} LIKE ${`%${input.search}%`})`
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (input.page - 1) * input.pageSize;

      const [rows, [totalRow]] = await Promise.all([
        db.select().from(webinarRegistrants)
          .where(where)
          .orderBy(desc(webinarRegistrants.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ count: count() }).from(webinarRegistrants).where(where),
      ]);

      return {
        registrants: rows,
        total: Number(totalRow?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(Number(totalRow?.count ?? 0) / input.pageSize),
      };
    }),

  /** Add a single registrant manually */
  addRegistrant: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().min(7),
      webinarName: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const normalizedPhone = normalizePhone(input.phone);

      // Get the selected webinar ID from settings so we can attach it
      const settingRows = await db.select().from(webinarSmsSettings);
      const settingsMap: Record<string, string> = {};
      for (const row of settingRows) {
        settingsMap[row.settingKey] = row.settingValue;
      }
      const selectedWebinarId = settingsMap["selected_webinar_id"] || undefined;

      const [result] = await db.insert(webinarRegistrants).values({
        name: input.name,
        email: input.email,
        phone: normalizedPhone,
        source: "manual",
        webinarName: input.webinarName,
        webinarId: selectedWebinarId,
        tags: input.tags,
      });

      // Auto-send calendar invite if email is provided and a webinar is selected
      if (input.email && selectedWebinarId) {
        autoSendCalendarInvites(
          db,
          selectedWebinarId,
          [{ id: Number(result.insertId), email: input.email, name: input.name }],
        ).catch(err => console.error(`[Calendar Auto] Manual add invite failed:`, err.message));
      }

      // Instant confirmation SMS (evergreen — fires on registration)
      if (isUsCanadaPhone(input.phone.replace(/\D/g, ""))) {
        // OPTIMISTIC LOCK: Mark as sent IMMEDIATELY to prevent cron from double-sending
        await db.update(webinarRegistrants)
          .set({ confirmationSmsSent: 1, confirmationSmsAt: new Date() })
          .where(eq(webinarRegistrants.id, Number(result.insertId)));

        // Also mark any OTHER rows with the same phone in this webinar (dedup across sources)
        if (selectedWebinarId) {
          await db.update(webinarRegistrants)
            .set({ confirmationSmsSent: 1, confirmationSmsAt: new Date() })
            .where(and(
              eq(webinarRegistrants.webinarId, selectedWebinarId),
              eq(webinarRegistrants.phone, normalizedPhone),
              eq(webinarRegistrants.confirmationSmsSent, 0),
            ));
        }

        (async () => {
          try {
            let tpl = `Hey %FIRST_NAME%, you're confirmed for the Airbnb class. I'll send your join link here before we start. Save this number! - Inayah`;
            const [tplRow] = await db.select({ settingValue: webinarSmsSettings.settingValue })
              .from(webinarSmsSettings).where(eq(webinarSmsSettings.settingKey, "confirmation_sms_template")).limit(1);
            if (tplRow?.settingValue) tpl = tplRow.settingValue;
            const firstName = (input.name || "there").split(" ")[0];
            const msg = tpl.replace(/%FIRST_NAME%/g, firstName);
            const smsResult = await sendSms(normalizedPhone, msg);
            if (smsResult.success) {
              console.log(`[Confirmation SMS] Instant send to ${normalizedPhone} succeeded`);
            } else {
              console.log(`[Confirmation SMS] Instant send to ${normalizedPhone} failed: ${smsResult.error}`);
              // DO NOT unmark/retry — prevents spam loops from quiet hours/carrier queuing.
              // If the API accepted it (201), it's queued. If it rejected it, it's permanent.
            }
          } catch (err: any) {
            console.error(`[Confirmation SMS] Instant send error:`, err.message);
            // DO NOT unmark — leave as sent=1 to prevent retry spam loops.
          }
        })();
      }

      // Instant confirmation EMAIL (evergreen — fires on registration alongside SMS)
      if (input.email) {
        (async () => {
          try {
            const firstName = (input.name || "there").split(" ")[0];
            // Fetch dynamic webinar schedule for email
            let manualWebinarDay = "";
            let manualWebinarDate = "";
            let manualWebinarTime = "";
            let manualJoinUrl = "";
            try {
              const [credRow3] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, selectedWebinarId || ""));
              const detailsManual = await fetchWebinarJamDetails(selectedWebinarId || "", credRow3?.apiKey || undefined);
              manualJoinUrl = detailsManual.direct_live_room_url || detailsManual.registration_url || "";
              if (detailsManual.schedules?.length > 0) {
                const sd = new Date(detailsManual.schedules[0].date + ":00");
                manualWebinarDay = sd.toLocaleDateString("en-US", { weekday: "long" });
                manualWebinarDate = sd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
                const hrs = sd.getHours();
                const mins = sd.getMinutes();
                const ap = hrs >= 12 ? "PM" : "AM";
                const hh = hrs % 12 || 12;
                manualWebinarTime = `${hh}:${mins.toString().padStart(2, "0")} ${ap} ET`;
              }
            } catch (_) {}
            if (!manualJoinUrl) {
              // No join URL available right now — let the import cron send it
              // later with the correct link instead of guessing a wrong one.
              console.log(`[Confirmation Email] Instant send deferred for ${input.email}: no join URL yet`);
              return;
            }

            // ═══ ATOMIC CLAIM (unique index email_log_claim_uq) ═══
            // Insert-first so the import cron can never double-send this registrant.
            const claimRes = await db.insert(emailSendLog).values({
              webinarId: selectedWebinarId || "unknown",
              registrantId: Number(result.insertId),
              recipientEmail: input.email!,
              recipientName: input.name,
              channel: "hubspot_smtp",
              emailType: "confirmation",
              status: "pending",
              errorMessage: null,
            }).onDuplicateKeyUpdate({ set: { id: sql`${emailSendLog.id}` } });
            if (((claimRes as any)[0]?.affectedRows ?? 0) !== 1) return;

            const emailContent = buildWebinarEmail("confirmation", {
              firstName,
              webinarLink: manualJoinUrl,
              callLink: "https://masterclass.coachinayah.com/turnkey-v2",
              webinarDay: manualWebinarDay || undefined,
              webinarDate: manualWebinarDate || undefined,
              webinarTime: manualWebinarTime || undefined,
            });
            if (emailContent) {
              const result2 = await sendWebinarEmail({
                to: input.email!,
                subject: emailContent.subject,
                html: emailContent.html,
              });
              if (result2.success) {
                console.log(`[Confirmation Email] Instant send to ${input.email} succeeded`);
              } else {
                console.log(`[Confirmation Email] Instant send to ${input.email} failed: ${result2.error}`);
              }
              await db.update(emailSendLog)
                .set({
                  status: result2.success ? "sent" : "failed",
                  errorMessage: result2.error?.slice(0, 1000) || null,
                })
                .where(and(
                  eq(emailSendLog.webinarId, selectedWebinarId || "unknown"),
                  eq(emailSendLog.registrantId, Number(result.insertId)),
                  eq(emailSendLog.emailType, "confirmation"),
                  eq(emailSendLog.status, "pending"),
                )).catch(() => {});
            }
          } catch (err: any) {
            console.error(`[Confirmation Email] Instant send error:`, err.message);
          }
        })();
      }

      return { success: true, id: result.insertId };
    }),

  /** Update a registrant */
  updateRegistrant: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().min(7).optional(),
      optedOut: z.number().min(0).max(1).optional(),
      attended: z.number().min(0).max(1).optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { id, ...updates } = input;
      const cleanUpdates: Record<string, any> = {};
      if (updates.name) cleanUpdates.name = updates.name;
      if (updates.email) cleanUpdates.email = updates.email;
      if (updates.phone) cleanUpdates.phone = normalizePhone(updates.phone);
      if (updates.optedOut !== undefined) cleanUpdates.optedOut = updates.optedOut;
      if (updates.attended !== undefined) cleanUpdates.attended = updates.attended;
      if (updates.tags) cleanUpdates.tags = updates.tags;

      await db.update(webinarRegistrants).set(cleanUpdates).where(eq(webinarRegistrants.id, id));
      return { success: true };
    }),

  /** Delete registrants */
  deleteRegistrants: adminProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.delete(webinarRegistrants).where(inArray(webinarRegistrants.id, input.ids));
      return { success: true, deleted: input.ids.length };
    }),

  /** Bulk import registrants from CSV data */
  importCsv: adminProcedure
    .input(z.object({
      rows: z.array(z.object({
        name: z.string().min(1),
        email: z.string().optional(),
        phone: z.string().min(7),
        webinarName: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })).min(1).max(5000),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const values = input.rows.map(row => ({
        name: row.name,
        email: row.email,
        phone: normalizePhone(row.phone),
        source: "csv" as const,
        webinarName: row.webinarName,
        tags: row.tags,
      }));

      // Insert in batches of 500
      let imported = 0;
      for (let i = 0; i < values.length; i += 500) {
        const batch = values.slice(i, i + 500);
        await db.insert(webinarRegistrants).values(batch);
        imported += batch.length;
      }

      return { success: true, imported };
    }),

  // ═══ WEBINARJAM INTEGRATION ════════════════════════════════════════════════

  /** List webinars from WebinarJam */
  listWebinars: adminProcedure.query(async () => {
    const webinars = await fetchWebinarJamWebinars();
    return { webinars };
  }),

  /** Get webinar details including schedules */
  getWebinarDetails: adminProcedure
    .input(z.object({ webinarId: z.string() }))
    .query(async ({ input }) => {
      const details = await fetchWebinarJamDetails(input.webinarId);
      return { webinar: details };
    }),

  /** Import registrants from WebinarJam */
  importFromWebinarJam: adminProcedure
    .input(z.object({
      webinarId: z.string(),
      webinarName: z.string(),
      scheduleId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Load per-webinar API key from credentials table
      const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, input.webinarId));
      const perWebinarApiKey = credRow?.apiKey || undefined;

      let allRegistrants: any[] = [];
      let page = 1;
      let hasMore = true;

      // Paginate through all registrants
      while (hasMore && page <= 100) {
        const result = await fetchWebinarJamRegistrants(input.webinarId, input.scheduleId, page, perWebinarApiKey);
        allRegistrants = allRegistrants.concat(result.registrants);
        hasMore = result.hasMore;
        page++;
      }

      if (allRegistrants.length === 0) {
        return { success: true, imported: 0, skipped: 0, message: "No registrants found" };
      }

      // Get existing phones to avoid duplicates
      const existingRows = await db.select({ phone: webinarRegistrants.phone })
        .from(webinarRegistrants)
        .where(eq(webinarRegistrants.webinarId, input.webinarId));
      const existingPhones = new Set(existingRows.map(r => normalizePhone(r.phone)));

      const newRegistrants = allRegistrants
        .filter(r => {
          // API returns phone_number (not phone) and phone_country_code
          const rawPhone = r.phone_number || r.phone || "";
          const fullPhone = (r.phone_country_code || "") + rawPhone;
          const phone = normalizePhone(fullPhone);
          return phone.length >= 7 && !existingPhones.has(phone);
        })
        .map(r => {
          const rawPhone = r.phone_number || r.phone || "";
          const fullPhone = (r.phone_country_code || "") + rawPhone;
          // attended_live is a string "Yes"/"No" (not integer 1/0)
          const attendedLive = r.attended_live === "Yes" || r.attended_live === 1 || r.attended_live === true;
          return {
            webinarId: input.webinarId,
            name: [r.first_name, r.last_name].filter(Boolean).join(" ") || "Unknown",
            email: r.email || null,
            phone: normalizePhone(fullPhone),
            source: "webinarjam" as const,
            webinarName: input.webinarName,
            attended: attendedLive ? 1 : 0,
            metadata: {
              signup_date: r.signup_date,
              attended_live: r.attended_live,
              attended_replay: r.attended_replay,
              time_live: r.time_live,
              utm_source: r.utm_source,
            },
          };
        });

      // Insert in batches
      let imported = 0;
      for (let i = 0; i < newRegistrants.length; i += 500) {
        const batch = newRegistrants.slice(i, i + 500);
        await db.insert(webinarRegistrants).values(batch);
        imported += batch.length;
      }

      return {
        success: true,
        imported,
        skipped: allRegistrants.length - newRegistrants.length,
        total: allRegistrants.length,
      };
    }),

  // ═══ SMS TEMPLATES ═════════════════════════════════════════════════════════

  /** List all SMS templates */
  listTemplates: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const templates = await db.select().from(webinarSmsTemplates).orderBy(desc(webinarSmsTemplates.createdAt));
    return { templates };
  }),

  /** Create a new SMS template */
  createTemplate: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      body: z.string().min(1).max(320),
      category: z.enum(["reminder", "followup", "promo", "custom"]).default("custom"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [result] = await db.insert(webinarSmsTemplates).values(input);
      return { success: true, id: result.insertId };
    }),

  /** Update an SMS template */
  updateTemplate: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      body: z.string().min(1).max(320).optional(),
      category: z.enum(["reminder", "followup", "promo", "custom"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { id, ...updates } = input;
      await db.update(webinarSmsTemplates).set(updates).where(eq(webinarSmsTemplates.id, id));
      return { success: true };
    }),

  /** Delete an SMS template */
  deleteTemplate: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.delete(webinarSmsTemplates).where(eq(webinarSmsTemplates.id, input.id));
      return { success: true };
    }),

  // ═══ SMS CAMPAIGNS ═════════════════════════════════════════════════════════

  /** List all campaigns */
  listCampaigns: adminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const offset = (input.page - 1) * input.pageSize;
      const [campaigns, [totalRow]] = await Promise.all([
        db.select().from(webinarSmsCampaigns)
          .orderBy(desc(webinarSmsCampaigns.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ count: count() }).from(webinarSmsCampaigns),
      ]);

      return {
        campaigns,
        total: Number(totalRow?.count ?? 0),
        page: input.page,
        totalPages: Math.ceil(Number(totalRow?.count ?? 0) / input.pageSize),
      };
    }),

  /** Get campaign details with delivery stats */
  getCampaignDetails: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [campaign] = await db.select().from(webinarSmsCampaigns).where(eq(webinarSmsCampaigns.id, input.id));
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });

      const deliveries = await db.select().from(webinarSmsDeliveries)
        .where(eq(webinarSmsDeliveries.campaignId, input.id))
        .orderBy(desc(webinarSmsDeliveries.sentAt));

      return { campaign, deliveries };
    }),

  /** Send SMS campaign to filtered registrants */
  sendCampaign: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      messageBody: z.string().min(1).max(1600),
      templateId: z.number().optional(),
      /** Filter: only send to registrants matching these criteria */
      filter: z.object({
        source: z.string().optional(),
        webinarId: z.string().optional(),
        attended: z.number().optional(),
        tags: z.array(z.string()).optional(),
        registrantIds: z.array(z.number()).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Build recipient query
      const conditions: any[] = [
        eq(webinarRegistrants.optedOut, 0), // Never send to opted-out
      ];
      if (input.filter?.source) conditions.push(eq(webinarRegistrants.source, input.filter.source));
      if (input.filter?.webinarId) conditions.push(eq(webinarRegistrants.webinarId, input.filter.webinarId));
      if (input.filter?.attended !== undefined) conditions.push(eq(webinarRegistrants.attended, input.filter.attended));
      if (input.filter?.registrantIds?.length) {
        conditions.push(inArray(webinarRegistrants.id, input.filter.registrantIds));
      }

      // GUARD: Block sending if message contains unfilled placeholders
      const unfilledPlaceholder = hasUnfilledPlaceholders(input.messageBody);
      if (unfilledPlaceholder) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Message contains unfilled placeholder: ${unfilledPlaceholder}. Please replace it with an actual link before sending.` });
      }

      const recipients = await db.select().from(webinarRegistrants).where(and(...conditions));

      if (recipients.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No recipients match the filter criteria" });
      }

      // Create campaign record
      const [campaignResult] = await db.insert(webinarSmsCampaigns).values({
        name: input.name,
        messageBody: input.messageBody,
        templateId: input.templateId,
        filterCriteria: input.filter as Record<string, unknown>,
        totalRecipients: recipients.length,
        status: "sending",
        createdBy: ctx.user.id,
      });
      const campaignId = campaignResult.insertId;

      // Return immediately, process sends in background to avoid timeout
      processCampaignSends(campaignId, recipients, input.messageBody).catch((err: unknown) => {
        console.error(`[WebinarSMS] Background campaign ${campaignId} error:`, err);
      });

      return {
        success: true,
        campaignId,
        totalRecipients: recipients.length,
        sent: 0,
        failed: 0,
        message: `Campaign started! Sending to ${recipients.length} recipients in the background.`,
      };
    }),

  /** Resend a failed campaign with the same message to recipients that failed */
  /** Cancel/stop a campaign that is currently sending */
  cancelCampaign: adminProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Add to in-memory set so the send loop stops on next iteration
      cancelledCampaignIds.add(input.campaignId);

      // Also update DB status immediately
      await db.update(webinarSmsCampaigns)
        .set({ status: "cancelled" })
        .where(eq(webinarSmsCampaigns.id, input.campaignId));

      console.log(`[WebinarSMS] Campaign ${input.campaignId} cancellation requested`);
      return { success: true, message: "Campaign stopped" };
    }),

  resendCampaign: adminProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get the original campaign
      const [campaign] = await db.select().from(webinarSmsCampaigns).where(eq(webinarSmsCampaigns.id, input.campaignId));
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });

      // Get failed deliveries
      const failedDeliveries = await db.select().from(webinarSmsDeliveries)
        .where(and(
          eq(webinarSmsDeliveries.campaignId, input.campaignId),
          eq(webinarSmsDeliveries.deliveryStatus, "failed")
        ));

      if (failedDeliveries.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No failed deliveries to resend" });
      }

      // Get the registrant details for failed deliveries
      const failedRegIds = failedDeliveries.map(d => d.registrantId).filter((id): id is number => id !== null);
      const recipients = await db.select().from(webinarRegistrants)
        .where(and(
          inArray(webinarRegistrants.id, failedRegIds),
          eq(webinarRegistrants.optedOut, 0)
        ));

      if (recipients.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No eligible recipients to resend to" });
      }

      // Create a new campaign for the resend
      const [newCampaignResult] = await db.insert(webinarSmsCampaigns).values({
        name: `${campaign.name} (Resend)`,
        messageBody: campaign.messageBody,
        templateId: campaign.templateId,
        filterCriteria: { resendOf: input.campaignId } as Record<string, unknown>,
        totalRecipients: recipients.length,
        status: "sending",
        createdBy: ctx.user.id,
      });
      const newCampaignId = newCampaignResult.insertId;

      // Process in background
      processCampaignSends(newCampaignId, recipients, campaign.messageBody).catch((err: unknown) => {
        console.error(`[WebinarSMS] Background resend campaign ${newCampaignId} error:`, err);
      });

      return {
        success: true,
        campaignId: newCampaignId,
        totalRecipients: recipients.length,
        message: `Resending to ${recipients.length} failed recipients in the background.`,
      };
    }),

  /** Get campaign send progress */
  getCampaignProgress: adminProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [campaign] = await db.select().from(webinarSmsCampaigns).where(eq(webinarSmsCampaigns.id, input.campaignId));
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        totalRecipients: campaign.totalRecipients,
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount,
        completedAt: campaign.completedAt,
      };
    }),

  /** Send a single test SMS to verify configuration */
  sendTestSms: adminProcedure
    .input(z.object({
      phone: z.string().min(7),
      message: z.string().min(1).max(1600),
      testName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log(`[WebinarSMS] Test SMS requested to: ${input.phone}, message length: ${input.message.length}`);
      // Render personalization variables with test data
      const testFirstName = input.testName || ctx.user?.name?.split(" ")[0] || "Friend";
      const testFullName = input.testName || ctx.user?.name || "Test User";
      const testEmail = ctx.user?.email || "test@example.com";
      const personalizedMessage = renderMessage(input.message, {
        name: testFirstName,
        fullname: testFullName,
        email: testEmail,
      });
      console.log(`[WebinarSMS] Personalized test message: ${personalizedMessage.substring(0, 100)}...`);
      const normalized = normalizePhone(input.phone);
      console.log(`[WebinarSMS] Normalized phone: ${normalized}`);
      const result = await sendSms(normalized, personalizedMessage);
      console.log(`[WebinarSMS] Test SMS result:`, JSON.stringify(result));
      return result;
    }),

  // ═══ DASHBOARD STATS ═══════════════════════════════════════════════════════

  /** Get overview stats for the webinar SMS dashboard */
  getDashboardStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const [
      [registrantCount],
      [campaignCount],
      [templateCount],
      [totalSent],
      [optedOutCount],
    ] = await Promise.all([
      db.select({ count: count() }).from(webinarRegistrants),
      db.select({ count: count() }).from(webinarSmsCampaigns),
      db.select({ count: count() }).from(webinarSmsTemplates),
      db.select({ total: sql<number>`COALESCE(SUM(${webinarSmsCampaigns.sentCount}), 0)` }).from(webinarSmsCampaigns),
      db.select({ count: count() }).from(webinarRegistrants).where(eq(webinarRegistrants.optedOut, 1)),
    ]);

    return {
      totalRegistrants: Number(registrantCount?.count ?? 0),
      totalCampaigns: Number(campaignCount?.count ?? 0),
      totalTemplates: Number(templateCount?.count ?? 0),
      totalSmsSent: Number(totalSent?.total ?? 0),
      optedOutCount: Number(optedOutCount?.count ?? 0),
    };
  }),

  // ═══ SETTINGS & CONFIGURATION ═════════════════════════════════════════════

  /** Get API key configuration status (shows which keys are set, not the values) */
  getApiStatus: adminProcedure.query(async () => {
    return {
      webinarjam: {
        configured: !!ENV.webinarjamApiKey,
        keyPreview: ENV.webinarjamApiKey
          ? `${ENV.webinarjamApiKey.slice(0, 6)}...${ENV.webinarjamApiKey.slice(-4)}`
          : null,
      },
      simpletexting: {
        configured: !!ENV.simpletextingApiKey,
        keyPreview: ENV.simpletextingApiKey
          ? `${ENV.simpletextingApiKey.slice(0, 6)}...${ENV.simpletextingApiKey.slice(-4)}`
          : null,
      },
      googleCalendar: {
        configured: !!ENV.googleCalendarServiceAccountJson,
        impersonateEmail: ENV.googleCalendarImpersonateEmail || "support@coachinayah.com",
      },
    };
  }),

  /** Test WebinarJam API connection */
  testWebinarJamConnection: adminProcedure.mutation(async () => {
    try {
      const webinars = await fetchWebinarJamWebinars();
      return {
        success: true,
        message: `Connected! Found ${webinars.length} webinar(s).`,
        webinarCount: webinars.length,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Failed to connect to WebinarJam",
        webinarCount: 0,
      };
    }
  }),

  /** Test SimpleTexting API connection by checking credits */
  testSimpleTextingConnection: adminProcedure.mutation(async () => {
    const apiKey = ENV.simpletextingApiKey;
    if (!apiKey) {
      return { success: false, message: "SimpleTexting API key not configured" };
    }

    try {
      // Use v2 API to check connection by listing campaigns
      const res = await fetch("https://api-app2.simpletexting.com/v2/api/campaigns?page=0&size=1", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
        },
      });

      if (res.status === 200) {
        return {
          success: true,
          message: `Connected to SimpleTexting v2 API!`,
        };
      }
      const data = await res.json().catch(() => ({}));
      return { success: false, message: data.message || data.errorMessage || `API returned status ${res.status}` };
    } catch (err: any) {
      return { success: false, message: err.message || "Failed to connect" };
    }
  }),

  /** List webinars with schedule details for selection */
  listWebinarsWithSchedules: adminProcedure.query(async () => {
    try {
      const webinars = await fetchWebinarJamWebinars();
      const enriched = await Promise.all(
        webinars.slice(0, 10).map(async (w: any) => {
          try {
            const details = await fetchWebinarJamDetails(String(w.webinar_id));
            return {
              id: String(w.webinar_id),
              name: w.name || details?.name || 'Unnamed',
              schedules: (details?.schedules || []).map((s: any) => ({
                id: s.schedule,
                date: s.date,
                comment: s.comment,
              })),
            };
          } catch {
            return {
              id: String(w.webinar_id),
              name: w.name || 'Unnamed',
              schedules: [],
            };
          }
        })
      );
      return { webinars: enriched };
    } catch (err: any) {
      return { webinars: [] };
    }
  }),

  /** Get current settings (selected webinar, cron config, last import) */
  getSettings: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const rows = await db.select().from(webinarSmsSettings);
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.settingKey] = row.settingValue;
    }

    const selectedWebinarId = settings["selected_webinar_id"] || null;

    // Load per-webinar credentials from the dedicated table
    let creds: { apiKey: string | null; webinarHash: string | null; memberId: string | null; integrationWebinarId: string | null } = {
      apiKey: null, webinarHash: null, memberId: null, integrationWebinarId: null,
    };
    if (selectedWebinarId) {
      const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, selectedWebinarId));
      if (credRow) {
        creds = {
          apiKey: credRow.apiKey,
          webinarHash: credRow.webinarHash,
          memberId: credRow.memberId,
          integrationWebinarId: credRow.integrationWebinarId,
        };
      }
    }

    return {
      selectedWebinarId,
      selectedWebinarName: settings["selected_webinar_name"] || null,
      selectedScheduleId: settings["selected_schedule_id"] || null,
      selectedScheduleDate: settings["selected_schedule_date"] || null,
      cronEnabled: settings["cron_enabled"] === "true",
      cronIntervalMinutes: parseInt(settings["cron_interval_minutes"] || "3", 10),
      lastAutoImportAt: settings["last_auto_import_at"] || null,
      lastAutoImportResult: settings["last_auto_import_result"] || null,
      // Per-webinar credentials from dedicated table
      webinarApiKey: creds.apiKey,
      webinarHash: creds.webinarHash,
      webinarMemberId: creds.memberId,
      webinarIntegrationId: creds.integrationWebinarId,
      webinarApiKeyConfigured: !!creds.apiKey,
      webinarHashConfigured: !!creds.webinarHash,
      // SimpleTexting list sync
      simpleTextingListName: settings["simpletexting_list_name"] || null,
      // Evergreen Registration Confirmation SMS template
      confirmationSmsTemplate: settings["confirmation_sms_template"] || `Hey %FIRST_NAME%, you're confirmed for the Airbnb class. I'll send your join link here before we start. Save this number! - Inayah`,
      // Calendar settings
      calendarAutoSend: true, // Always on — cannot be disabled
      calendarEventName: settings["calendar_event_name"] || DEFAULT_CALENDAR_EVENT_NAME,
      calendarEventDescription: settings["calendar_event_description"] || DEFAULT_CALENDAR_DESCRIPTION,
      calendarInviteTime: settings["calendar_invite_time"] || null, // null = use WebinarJam schedule time
      calendarInviteTimezone: settings["calendar_invite_timezone"] || null, // null = use WebinarJam timezone
    };
  }),

  /** Save webinar selection (which webinar + schedule to auto-import from) */
  saveWebinarSelection: adminProcedure
    .input(z.object({
      webinarId: z.string().min(1),
      webinarName: z.string().min(1),
      scheduleId: z.string().optional(),
      webinarApiKey: z.string().optional(),
      webinarHash: z.string().optional(),
       webinarMemberId: z.string().optional(),
      webinarIntegrationId: z.string().optional(),
      scheduleDate: z.string().optional(), // ISO date string of the selected schedule
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Save global selection settings
      const upserts = [
        { key: "selected_webinar_id", value: input.webinarId, desc: "Currently selected WebinarJam webinar ID" },
        { key: "selected_webinar_name", value: input.webinarName, desc: "Currently selected webinar name" },
      ];
      if (input.scheduleId) {
        upserts.push({ key: "selected_schedule_id", value: input.scheduleId, desc: "Currently selected schedule ID" });
      }
      if (input.scheduleDate) {
        upserts.push({ key: "selected_schedule_date", value: input.scheduleDate, desc: "Date of the selected webinar schedule" });
      }

      for (const u of upserts) {
        await db.insert(webinarSmsSettings)
          .values({ settingKey: u.key, settingValue: u.value, description: u.desc })
          .onDuplicateKeyUpdate({ set: { settingValue: u.value } });
      }

      // Save per-webinar credentials to dedicated table (persists across webinar switches)
      const hasAnyCred = input.webinarApiKey || input.webinarHash || input.webinarMemberId || input.webinarIntegrationId;
      if (hasAnyCred) {
        await db.insert(webinarCredentials)
          .values({
            webinarId: input.webinarId,
            webinarName: input.webinarName,
            apiKey: input.webinarApiKey || null,
            webinarHash: input.webinarHash || null,
            memberId: input.webinarMemberId || null,
            integrationWebinarId: input.webinarIntegrationId || null,
          })
          .onDuplicateKeyUpdate({
            set: {
              webinarName: input.webinarName,
              ...(input.webinarApiKey !== undefined ? { apiKey: input.webinarApiKey || null } : {}),
              ...(input.webinarHash !== undefined ? { webinarHash: input.webinarHash || null } : {}),
              ...(input.webinarMemberId !== undefined ? { memberId: input.webinarMemberId || null } : {}),
              ...(input.webinarIntegrationId !== undefined ? { integrationWebinarId: input.webinarIntegrationId || null } : {}),
            },
          });
      }

      // Restart cron so it picks up the new webinar selection
      await restartWebinarImportCron();

      return { success: true };
    }),

  /** Get saved credentials for a specific webinar (used when switching webinars in the dialog) */
  getWebinarCredentials: adminProcedure
    .input(z.object({ webinarId: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [cred] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, input.webinarId));
      if (!cred) {
        return { found: false, apiKey: null, webinarHash: null, memberId: null, integrationWebinarId: null };
      }
      return {
        found: true,
        apiKey: cred.apiKey,
        webinarHash: cred.webinarHash,
        memberId: cred.memberId,
        integrationWebinarId: cred.integrationWebinarId,
      };
    }),

  /** Save cron configuration */
  saveCronConfig: adminProcedure
    .input(z.object({
      enabled: z.boolean(),
      intervalMinutes: z.number().min(1).max(1440).default(3),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.insert(webinarSmsSettings)
        .values({ settingKey: "cron_enabled", settingValue: String(input.enabled), description: "Whether auto-import cron is enabled" })
        .onDuplicateKeyUpdate({ set: { settingValue: String(input.enabled) } });

      await db.insert(webinarSmsSettings)
        .values({ settingKey: "cron_interval_minutes", settingValue: String(input.intervalMinutes), description: "Auto-import interval in minutes" })
        .onDuplicateKeyUpdate({ set: { settingValue: String(input.intervalMinutes) } });

      // Restart cron with new config
      await restartWebinarImportCron();

      return { success: true, cronEnabled: input.enabled, intervalMinutes: input.intervalMinutes };
    }),

  /** Fetch all SimpleTexting contact lists from the API */
  fetchSimpleTextingLists: adminProcedure
    .query(async () => {
      const apiKey = ENV.simpletextingApiKey;
      if (!apiKey) throw new TRPCError({ code: "BAD_REQUEST", message: "SimpleTexting API key not configured" });

      const res = await fetch("https://api-app2.simpletexting.com/v2/api/contact-lists?page=0&size=100", {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `SimpleTexting API error (${res.status}): ${errText}` });
      }
      const data = await res.json();
      // API returns { content: [{ id, name, contactsCount, createdAt }], ... }
      const lists = (data.content || data || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        contactsCount: l.contactsCount || 0,
        createdAt: l.createdAt || null,
      }));
      // Sort newest first
      lists.sort((a: any, b: any) => {
        if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return 0;
      });
      return { lists };
    }),

  /** Create a new SimpleTexting contact list */
  createSimpleTextingList: adminProcedure
    .input(z.object({ name: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
      const apiKey = ENV.simpletextingApiKey;
      if (!apiKey) throw new TRPCError({ code: "BAD_REQUEST", message: "SimpleTexting API key not configured" });

      const res = await fetch("https://api-app2.simpletexting.com/v2/api/contact-lists", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: input.name }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to create list: ${errText}` });
      }
      const data = await res.json();
      return { success: true, id: data.id, name: data.name || input.name };
    }),

  /** Save SimpleTexting list name for auto-adding registrants */
  saveSimpleTextingList: adminProcedure
    .input(z.object({
      listName: z.string().max(255).default(""),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.insert(webinarSmsSettings)
        .values({ settingKey: "simpletexting_list_name", settingValue: input.listName, description: "SimpleTexting contact list name to auto-add registrants" })
        .onDuplicateKeyUpdate({ set: { settingValue: input.listName } });

      return { success: true, listName: input.listName };
    }),

  /** Get the current progress of a running syncAllToList operation */
  getSyncProgress: adminProcedure
    .query(() => {
      return syncProgress;
    }),

  /** Bulk-add all confirmed registrants to the selected SimpleTexting list */
  syncAllToList: adminProcedure
    .mutation(async () => {
      if (syncProgress.running) {
        throw new TRPCError({ code: "CONFLICT", message: "Sync already in progress" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get the configured list name
      const [listSetting] = await db.select({ settingValue: webinarSmsSettings.settingValue })
        .from(webinarSmsSettings)
        .where(eq(webinarSmsSettings.settingKey, "simpletexting_list_name"))
        .limit(1);
      const listName = listSetting?.settingValue;
      if (!listName) throw new TRPCError({ code: "BAD_REQUEST", message: "No SimpleTexting list configured. Select a list first." });

      const apiKey = ENV.simpletextingApiKey;
      if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "SimpleTexting API key not configured" });

      // Get all registrants with valid US/Canada phones
      const allRegs = await db.select({
        id: webinarRegistrants.id,
        phone: webinarRegistrants.phone,
      }).from(webinarRegistrants);

      // Initialize progress
      syncProgress = { running: true, processed: 0, total: allRegs.length, added: 0, skipped: 0, failed: 0 };

      let added = 0;
      let skipped = 0;
      let failed = 0;

      for (const reg of allRegs) {
        if (!reg.phone) { skipped++; syncProgress.skipped = skipped; syncProgress.processed++; continue; }
        const cleanPhone = reg.phone.replace(/[^\d]/g, "");
        // Skip international (not 10 or 11 digits starting with 1)
        if (cleanPhone.length < 10 || cleanPhone.length > 11) { skipped++; syncProgress.skipped = skipped; syncProgress.processed++; continue; }

        try {
          const addRes = await fetch(`https://api-app2.simpletexting.com/v2/api/contact-lists/${encodeURIComponent(listName)}/contacts`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ contactPhoneOrId: cleanPhone }),
          });
          if (addRes.ok) {
            added++;
            syncProgress.added = added;
          } else {
            const status = addRes.status;
            if (status === 409) {
              // Already in list
              skipped++;
              syncProgress.skipped = skipped;
            } else {
              failed++;
              syncProgress.failed = failed;
            }
          }
          // Rate limit: small delay between requests
          await new Promise(r => setTimeout(r, 100));
        } catch (err: any) {
          failed++;
          syncProgress.failed = failed;
        }
        syncProgress.processed++;
      }

      syncProgress.running = false;
      console.log(`[SimpleTexting List Sync] Done: ${added} added, ${skipped} skipped, ${failed} failed`);
      return { success: true, added, skipped, failed, total: allRegs.length };
    }),

  /** Save the evergreen Registration Confirmation SMS template */
  saveConfirmationTemplate: adminProcedure
    .input(z.object({ template: z.string().min(1).max(500) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.insert(webinarSmsSettings)
        .values({ settingKey: "confirmation_sms_template", settingValue: input.template, description: "Evergreen registration confirmation SMS template" })
        .onDuplicateKeyUpdate({ set: { settingValue: input.template } });
      return { success: true };
    }),

  /** Refresh attendance data from WebinarJam for existing registrants */
  refreshAttendance: adminProcedure
    .input(z.object({ webinarId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Load per-webinar API key from credentials table
      const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, input.webinarId));
      const perWebinarApiKey = credRow?.apiKey || undefined;

      // Fetch all registrants from WebinarJam
      let allRegistrants: any[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 100) {
        const result = await fetchWebinarJamRegistrants(input.webinarId, undefined, page, perWebinarApiKey);
        allRegistrants = allRegistrants.concat(result.registrants);
        hasMore = result.hasMore;
        page++;
      }

      // Build phone -> attendance map
      const attendanceMap = new Map<string, number>();
      for (const r of allRegistrants) {
        // API returns phone_number (not phone) and phone_country_code
        const rawPhone = r.phone_number || r.phone || "";
        const fullPhone = (r.phone_country_code || "") + rawPhone;
        const phone = normalizePhone(fullPhone);
        if (phone.length >= 7) {
          // attended_live is a string "Yes"/"No" (not integer 1/0)
          const attendedLive = r.attended_live === "Yes" || r.attended_live === 1 || r.attended_live === true;
          attendanceMap.set(phone, attendedLive ? 1 : 0);
        }
      }

      // Get existing registrants for this webinar
      const existing = await db.select({ id: webinarRegistrants.id, phone: webinarRegistrants.phone })
        .from(webinarRegistrants)
        .where(eq(webinarRegistrants.webinarId, input.webinarId));

      let updated = 0;
      for (const row of existing) {
        const normalizedPhone = normalizePhone(row.phone);
        const attended = attendanceMap.get(normalizedPhone);
        if (attended !== undefined) {
          await db.update(webinarRegistrants)
            .set({ attended })
            .where(eq(webinarRegistrants.id, row.id));
          updated++;
        }
      }

      return {
        success: true,
        message: `Refreshed attendance for ${updated} of ${existing.length} registrants (${allRegistrants.length} found in WebinarJam)`,
        updated,
        total: existing.length,
      };
    }),

  /** Get paginated delivery details for a campaign with status filtering */
  getCampaignDeliveries: adminProcedure
    .input(z.object({
      campaignId: z.number(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(50),
      status: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const offset = (input.page - 1) * input.pageSize;
      const conditions = [eq(webinarSmsDeliveries.campaignId, input.campaignId)];
      if (input.status) {
        conditions.push(eq(webinarSmsDeliveries.deliveryStatus, input.status));
      }
      const where = conditions.length === 1 ? conditions[0] : and(...conditions);

      const [deliveries, countResult, statusSummary] = await Promise.all([
        db.select()
          .from(webinarSmsDeliveries)
          .where(where!)
          .orderBy(desc(webinarSmsDeliveries.sentAt))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ total: count() })
          .from(webinarSmsDeliveries)
          .where(where!),
        db.select({
          status: webinarSmsDeliveries.deliveryStatus,
          count: count(),
        })
          .from(webinarSmsDeliveries)
          .where(eq(webinarSmsDeliveries.campaignId, input.campaignId))
          .groupBy(webinarSmsDeliveries.deliveryStatus),
      ]);

      const total = countResult[0]?.total ?? 0;

      return {
        deliveries,
        total,
        page: input.page,
        totalPages: Math.ceil(total / input.pageSize),
        statusSummary: statusSummary.map(s => ({ status: s.status, count: Number(s.count) })),
      };
    }),

  // ═══ SCHEDULED MESSAGES ══════════════════════════════════════════════════

  /** List scheduled messages for a webinar */
  listScheduledMessages: adminProcedure
    .input(z.object({ webinarId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = input.webinarId ? [eq(scheduledSmsMessages.webinarId, input.webinarId)] : [];
      const messages = await db.select().from(scheduledSmsMessages)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(scheduledSmsMessages.sequenceOrder);

      return { messages };
    }),

  /** Create or update a scheduled message */
  upsertScheduledMessage: adminProcedure
    .input(z.object({
      id: z.number().optional(),
      webinarId: z.string().min(1),
      sequenceName: z.string().min(1),
      sequenceOrder: z.number().min(1),
      messageBody: z.string().min(1),
      scheduledAt: z.string(), // ISO date string
      audience: z.enum(["all", "attended", "not_attended"]).default("all"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const scheduledDate = new Date(input.scheduledAt);

      if (input.id) {
        // Update existing
        await db.update(scheduledSmsMessages).set({
          sequenceName: input.sequenceName,
          sequenceOrder: input.sequenceOrder,
          messageBody: input.messageBody,
          scheduledAt: scheduledDate,
          audience: input.audience,
        }).where(eq(scheduledSmsMessages.id, input.id));
        return { success: true, id: input.id };
      } else {
        // Insert new
        const [result] = await db.insert(scheduledSmsMessages).values({
          webinarId: input.webinarId,
          sequenceName: input.sequenceName,
          sequenceOrder: input.sequenceOrder,
          messageBody: input.messageBody,
          scheduledAt: scheduledDate,
          audience: input.audience,
        });
        return { success: true, id: result.insertId };
      }
    }),

  /** Delete a scheduled message */
  deleteScheduledMessage: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.delete(scheduledSmsMessages).where(eq(scheduledSmsMessages.id, input.id));
      return { success: true };
    }),

  /** Cancel a scheduled message */
  cancelScheduledMessage: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Add to in-memory cancellation set so the dispatcher loop stops mid-send
      cancelledScheduledMessageIds.add(input.id);

      await db.update(scheduledSmsMessages).set({ status: "cancelled" })
        .where(eq(scheduledSmsMessages.id, input.id));
      return { success: true };
    }),

  /** Send a scheduled message immediately (bypass time check) */
  sendScheduledMessageNow: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Fetch the message
      const [msg] = await db.select().from(scheduledSmsMessages)
        .where(eq(scheduledSmsMessages.id, input.id));
      if (!msg) throw new TRPCError({ code: "NOT_FOUND", message: "Scheduled message not found" });
      if (msg.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot send a message with status "${msg.status}". Only pending messages can be sent.` });
      }

      // Set scheduledAt to now so the dispatcher picks it up on the next tick (within 30s)
      const now = new Date();
      await db.update(scheduledSmsMessages)
        .set({ scheduledAt: now })
        .where(eq(scheduledSmsMessages.id, input.id));

      console.log(`[SMS Dispatcher] SEND NOW: Message #${input.id} "${msg.sequenceName}" scheduledAt updated to NOW. Dispatcher will pick it up within 30s.`);
      return { success: true, message: `Message "${msg.sequenceName}" will be sent within 30 seconds.` };
    }),

  /** Import no-shows from a source webinar into a target webinar as new registrants */
  importNoShowsToWebinar: adminProcedure
    .input(z.object({
      sourceWebinarId: z.string().min(1), // Webinar to pull no-shows from
      targetWebinarId: z.string().min(1), // Webinar to add them to
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get no-shows from source webinar (attended=0, not opted out)
      const noShows = await db.select({
        name: webinarRegistrants.name,
        email: webinarRegistrants.email,
        phone: webinarRegistrants.phone,
        tags: webinarRegistrants.tags,
      }).from(webinarRegistrants)
        .where(and(
          eq(webinarRegistrants.webinarId, input.sourceWebinarId),
          eq(webinarRegistrants.attended, 0),
          eq(webinarRegistrants.optedOut, 0),
        ));

      if (noShows.length === 0) {
        return { success: true, imported: 0, skipped: 0, message: "No no-shows found in the source webinar." };
      }

      // Get existing registrants in target webinar to deduplicate by phone
      const existingInTarget = await db.select({ phone: webinarRegistrants.phone })
        .from(webinarRegistrants)
        .where(eq(webinarRegistrants.webinarId, input.targetWebinarId));
      const existingPhones = new Set(existingInTarget.map(r => normalizePhone(r.phone)));

      // Get target webinar name from settings or existing registrants
      const [targetSample] = await db.select({ webinarName: webinarRegistrants.webinarName })
        .from(webinarRegistrants)
        .where(eq(webinarRegistrants.webinarId, input.targetWebinarId))
        .limit(1);
      const targetWebinarName = targetSample?.webinarName || undefined;

      let imported = 0;
      let skipped = 0;

      for (const noShow of noShows) {
        const normalized = normalizePhone(noShow.phone);
        if (existingPhones.has(normalized)) {
          skipped++;
          continue;
        }

        await db.insert(webinarRegistrants).values({
          name: noShow.name,
          email: noShow.email,
          phone: normalized,
          source: "no-show-import",
          webinarId: input.targetWebinarId,
          webinarName: targetWebinarName,
          tags: [...(noShow.tags || []), "no-show-reimport"],
          confirmationSmsSent: 0, // Will get confirmation SMS on next cron cycle
        });
        existingPhones.add(normalized); // Prevent duplicates within this batch
        imported++;
      }

      console.log(`[ImportNoShows] Imported ${imported} no-shows from webinar ${input.sourceWebinarId} to ${input.targetWebinarId} (${skipped} already existed)`);
      return { success: true, imported, skipped, message: `Imported ${imported} no-shows (${skipped} already registered).` };
    }),

  /** Generate a pre-built SMS sequence for a webinar */
  generateSequence: adminProcedure
    .input(z.object({
      webinarId: z.string().min(1),
      webinarDate: z.string(), // ISO date string of the webinar
      timezone: z.string().optional(), // IANA timezone (e.g. "America/New_York")
      webinarLink: z.string().optional(),
      replayLink: z.string().optional(),
      // Customizable timing offsets (in minutes before/after webinar)
      // Negative = before webinar, Positive = after webinar
      timing: z.object({
        twoDaysBefore: z.number().default(-2880),        // -2 days
        dayBefore: z.number().default(-1440),             // -1 day
        morningOf: z.number().default(-720),              // -12 hours (morning of webinar day)
        threeHoursBefore: z.number().default(-180),       // -3 hours
        oneHourWarning: z.number().default(-60),          // -1 hour
        fifteenMinBefore: z.number().default(-15),         // -15 min
        goingLiveNow: z.number().default(-5),             // -5 min ("starting now")
        noShowNudge: z.number().default(10),              // +10 min (nudge no-shows)
        thankYouAttended: z.number().default(60),         // +1 hour
        missedYouNoShow: z.number().default(120),         // +2 hours
        followUpCta: z.number().default(1440),            // +1 day
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const webinarDate = new Date(input.webinarDate);
      const link = input.webinarLink || "[WEBINAR_LINK]";
      const replay = input.replayLink || "[REPLAY_LINK]";

      // Use custom timing or defaults (offsets in minutes from webinar start)
      const t = {
        twoDaysBefore: input.timing?.twoDaysBefore ?? -2880,
        dayBefore: input.timing?.dayBefore ?? -1440,
        morningOf: input.timing?.morningOf ?? -720,  // 12 hours before (morning of webinar day)
        threeHoursBefore: input.timing?.threeHoursBefore ?? -180, // 3 hours before
        oneHourWarning: input.timing?.oneHourWarning ?? -60,
        fifteenMinBefore: input.timing?.fifteenMinBefore ?? -15,
        goingLiveNow: input.timing?.goingLiveNow ?? -5,
        noShowNudge: input.timing?.noShowNudge ?? 10,
        thankYouAttended: input.timing?.thankYouAttended ?? 60,
        missedYouNoShow: input.timing?.missedYouNoShow ?? 120,
        followUpCta: input.timing?.followUpCta ?? 1440,
      };

      // Helper: offset in minutes from webinar date
      const offset = (minutes: number) => new Date(webinarDate.getTime() + minutes * 60 * 1000);

      // Pre-built 12-message sequence with customizable timing
      // Copy written by Coach Inayah — personal, direct, high-converting
      const callLink = "https://masterclass.coachinayah.com/turnkey-v2";
      const sequence = [
        {
          sequenceName: "2 Days Before Reminder",
          sequenceOrder: 1,
          messageBody: `Hey %FIRST_NAME%, it's Inayah. In 2 days I'm going to walk you through how 500+ professionals added $2K\u2013$5K/mo on Airbnb without owning property. You're on the list. Block 90 mins so you can focus.`,
          scheduledAt: offset(t.twoDaysBefore),
          audience: "all" as const,
        },
        {
          sequenceName: "Day Before Reminder",
          sequenceOrder: 2,
          messageBody: `Reminder from Inayah: your Airbnb Masterclass is tomorrow. I'll show you the exact 5-step system my students use to launch in under 90 days while keeping their W2. Stay tuned for your join link.`,
          scheduledAt: offset(t.dayBefore),
          audience: "all" as const,
        },
        {
          sequenceName: "Morning Of",
          sequenceOrder: 3,
          messageBody: `Morning %FIRST_NAME%, it's Inayah. Tonight we're live for your Airbnb Masterclass. If you show up live, you'll get my 'Landlord Yes' script + 90-day launch checklist. Worth being there.`,
          scheduledAt: offset(t.morningOf),
          audience: "all" as const,
        },
        {
          sequenceName: "3 Hours Before",
          sequenceOrder: 4,
          messageBody: `3-hour heads up: your Airbnb Masterclass with me starts soon today. Find a quiet spot, bring a notebook, and be ready to map out your first cash-flowing unit.`,
          scheduledAt: offset(t.threeHoursBefore),
          audience: "all" as const,
        },
        {
          sequenceName: "1 Hour Warning",
          sequenceOrder: 5,
          messageBody: `We're 1 hour out. I'll break down how busy professionals are replacing W2 income with Airbnb without owning property. I'll send your join link 15 minutes before go time.`,
          scheduledAt: offset(t.oneHourWarning),
          audience: "all" as const,
        },
        {
          sequenceName: "15 Min Before",
          sequenceOrder: 6,
          messageBody: `%FIRST_NAME%, we start in 15 minutes. Here's your private link to join live: ${link}\n\nHop on a few minutes early so you don't miss the landlord scripts.`,
          scheduledAt: offset(t.fifteenMinBefore),
          audience: "all" as const,
        },
        {
          sequenceName: "Starting NOW",
          sequenceOrder: 7,
          messageBody: `We're starting now. I'm walking through step 1 of the Turnkey Airbnb system. Join us here: ${link}\n\nIf you don't hop on in the next few minutes, the room may lock.`,
          scheduledAt: offset(t.goingLiveNow),
          audience: "all" as const,
        },
        {
          sequenceName: "No-Show Nudge",
          sequenceOrder: 8,
          messageBody: `Hey %FIRST_NAME%, it's Inayah. We're 10 minutes into the Airbnb Masterclass and just covered how to pick your first unit. You can still jump in live here: ${link}\n\nIf you miss this, there's no replay.`,
          scheduledAt: offset(t.noShowNudge),
          audience: "not_attended" as const,
        },
        {
          sequenceName: "Thank You (Attended)",
          sequenceOrder: 9,
          messageBody: `%FIRST_NAME%, thank you for showing up live tonight. Proud of you for investing in yourself. Next step if you want help launching your first unit: apply for a Turnkey Strategy Call here: ${callLink}`,
          // MANUAL-ONLY: This message should never auto-fire. Set far-future date so
          // it only sends when the user clicks "Send Now" during the webinar.
          scheduledAt: new Date('2030-12-31T23:59:59Z'),
          audience: "attended" as const,
        },
        {
          sequenceName: "Missed You (No-Show)",
          sequenceOrder: 10,
          messageBody: `Hey %FIRST_NAME%, it's Inayah. I didn't see you on the Airbnb Masterclass tonight. Life happens. If you're still serious about adding $2K\u2013$5K/mo without owning property, you can either:\nA) Register for the next live class, or\nB) Apply for a 1:1 Turnkey Strategy Call now\nGrab your best next step here: ${callLink}`,
          scheduledAt: offset(t.missedYouNoShow),
          audience: "not_attended" as const,
        },
        {
          sequenceName: "Follow-Up CTA",
          sequenceOrder: 11,
          messageBody: `%FIRST_NAME%, yesterday's class was about clarity. Today is about action. If you want help launching your first Airbnb in the next 90 days, apply for a Turnkey Strategy Call here: ${callLink}\n\nWe'll see if and how we can help.`,
          scheduledAt: offset(t.followUpCta),
          audience: "all" as const,
        },
      ];

      // Delete existing sequence for this webinar
      await db.delete(scheduledSmsMessages).where(eq(scheduledSmsMessages.webinarId, input.webinarId));

      // Insert all messages
      for (const msg of sequence) {
        await db.insert(scheduledSmsMessages).values({
          webinarId: input.webinarId,
          ...msg,
        });
      }

      return { success: true, count: sequence.length };
    }),

  /** Get registrant counts by attendance status for a webinar */
  getAttendanceSummary: adminProcedure
    .input(z.object({ webinarId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = input.webinarId ? [eq(webinarRegistrants.webinarId, input.webinarId)] : [];
      const baseWhere = conditions.length ? and(...conditions) : undefined;

      const [totalResult, attendedResult, noShowResult, optedOutResult, calendarInvitesResult] = await Promise.all([
        db.select({ count: count() }).from(webinarRegistrants).where(baseWhere),
        db.select({ count: count() }).from(webinarRegistrants).where(
          baseWhere
            ? and(baseWhere, eq(webinarRegistrants.attended, 1))
            : eq(webinarRegistrants.attended, 1)
        ),
        db.select({ count: count() }).from(webinarRegistrants).where(
          baseWhere
            ? and(baseWhere, eq(webinarRegistrants.attended, 0))
            : eq(webinarRegistrants.attended, 0)
        ),
        db.select({ count: count() }).from(webinarRegistrants).where(
          baseWhere
            ? and(baseWhere, eq(webinarRegistrants.optedOut, 1))
            : eq(webinarRegistrants.optedOut, 1)
        ),
        db.select({ count: count() }).from(webinarRegistrants).where(
          baseWhere
            ? and(baseWhere, eq(webinarRegistrants.calendarInviteSent, 1))
            : eq(webinarRegistrants.calendarInviteSent, 1)
        ),
      ]);

      return {
        total: Number(totalResult[0]?.count ?? 0),
        attended: Number(attendedResult[0]?.count ?? 0),
        noShow: Number(noShowResult[0]?.count ?? 0),
        optedOut: Number(optedOutResult[0]?.count ?? 0),
        calendarInvitesSent: Number(calendarInvitesResult[0]?.count ?? 0),
      };
    }),

  /** List registrants filtered by attendance status */
  listRegistrantsByAttendance: adminProcedure
    .input(z.object({
      webinarId: z.string().optional(),
      attended: z.number().optional(), // 1 = attended, 0 = no-show
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions: any[] = [eq(webinarRegistrants.optedOut, 0)];
      if (input.webinarId) conditions.push(eq(webinarRegistrants.webinarId, input.webinarId));
      if (input.attended !== undefined) conditions.push(eq(webinarRegistrants.attended, input.attended));

      const offset = (input.page - 1) * input.pageSize;
      const where = and(...conditions);

      const [registrants, totalResult] = await Promise.all([
        db.select().from(webinarRegistrants).where(where).orderBy(desc(webinarRegistrants.createdAt)).limit(input.pageSize).offset(offset),
        db.select({ count: count() }).from(webinarRegistrants).where(where),
      ]);

      return {
        registrants,
        total: Number(totalResult[0]?.count ?? 0),
        page: input.page,
        totalPages: Math.ceil(Number(totalResult[0]?.count ?? 0) / input.pageSize),
      };
    }),

  /** Trigger a manual import from the currently selected webinar */
  triggerManualImport: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const rows = await db.select().from(webinarSmsSettings);
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.settingKey] = row.settingValue;
    }

    const webinarId = settings["selected_webinar_id"];
    const webinarName = settings["selected_webinar_name"] || "Unknown";
    const scheduleId = settings["selected_schedule_id"];

    if (!webinarId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No webinar selected. Go to Settings and select a webinar first." });
    }

    // Load per-webinar API key from credentials table
    const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, webinarId));
    const perWebinarApiKey = credRow?.apiKey || undefined;

    const result = await runWebinarImport(db, webinarId, webinarName, scheduleId ? parseInt(scheduleId, 10) : undefined, perWebinarApiKey);

    const now = new Date().toISOString();
    const resultStr = `Imported ${result.imported}, skipped ${result.skipped} (total ${result.total}) at ${now}`;

    await db.insert(webinarSmsSettings)
      .values({ settingKey: "last_auto_import_at", settingValue: now, description: "Timestamp of last auto-import" })
      .onDuplicateKeyUpdate({ set: { settingValue: now } });

    await db.insert(webinarSmsSettings)
      .values({ settingKey: "last_auto_import_result", settingValue: resultStr, description: "Result of last auto-import" })
      .onDuplicateKeyUpdate({ set: { settingValue: resultStr } });

    return result;
  }),

  /** AI Message Composer — takes natural language input and rewrites it with personalization variables */
  composeMessage: adminProcedure
    .input(z.object({
      prompt: z.string().min(1).max(1000),
      audience: z.enum(["all", "attended", "not_attended"]).default("all"),
      webinarId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Load transcript context if webinarId provided
      let webinarTitle = "";
      let transcriptContext = "";
      if (input.webinarId) {
        const db = await getDb();
        if (db) {
          const [t] = await db.select().from(webinarTranscripts).where(eq(webinarTranscripts.webinarId, input.webinarId));
          if (t) {
            webinarTitle = t.webinarTitle || "";
            transcriptContext = t.keySummary || (t.transcript ? t.transcript.substring(0, 3000) : "");
          }
        }
      }

      const systemPrompt = `You are an SMS copywriter for webinar follow-up campaigns. Your job is to take a natural language description of what the user wants to say and turn it into a polished, concise SMS message (max 320 characters).

IMPORTANT RULES:
1. Always use %FIRST_NAME% for the recipient's first name (never use generic "Hey there" or "Hi friend")
2. Available variables: %FIRST_NAME%, %FULL_NAME%, %EMAIL%
3. Keep it under 320 characters
4. Write in a warm, conversational but professional tone
5. Include a clear call-to-action when appropriate
6. Do NOT use any emojis in messages
7. The audience is: ${input.audience === "attended" ? "people who ATTENDED the webinar" : input.audience === "not_attended" ? "people who REGISTERED but DID NOT attend (no-shows)" : "all registrants"}
${webinarTitle ? `8. The webinar name is: "${webinarTitle}"` : ""}
${transcriptContext ? `9. WEBINAR CONTENT CONTEXT (use this to make the message relevant):\n${transcriptContext}` : ""}

Respond with ONLY the SMS message text. No quotes, no explanation, no preamble.`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.prompt },
          ],
        });

        const content = response.choices?.[0]?.message?.content;
        const messageText = typeof content === "string" ? content.trim() : "";

        if (!messageText) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned empty response" });
        }

        return { success: true, message: messageText };
      } catch (err: any) {
        console.error("[WebinarSMS] AI compose error:", err.message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI composition failed: ${err.message}` });
      }
    }),

  // ═══ TRANSCRIPT MANAGEMENT ═══════════════════════════════════════════════

  saveTranscript: adminProcedure
    .input(z.object({
      webinarId: z.string().min(1),
      webinarTitle: z.string().optional(),
      keySummary: z.string().optional(),
      transcript: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.insert(webinarTranscripts)
        .values({
          webinarId: input.webinarId,
          webinarTitle: input.webinarTitle || null,
          keySummary: input.keySummary || null,
          transcript: input.transcript,
        })
        .onDuplicateKeyUpdate({
          set: {
            webinarTitle: input.webinarTitle || null,
            keySummary: input.keySummary || null,
            transcript: input.transcript,
          },
        });

      return { success: true };
    }),

  getTranscript: adminProcedure
    .input(z.object({ webinarId: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db.select().from(webinarTranscripts).where(eq(webinarTranscripts.webinarId, input.webinarId));
      return row || null;
    }),

  // ═══ EMAIL COMPOSER (AI-powered) ════════════════════════════════════════

  composeEmail: adminProcedure
    .input(z.object({
      prompt: z.string().min(1).max(2000),
      webinarId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Load transcript context
      let webinarTitle = "";
      let transcriptContext = "";
      if (input.webinarId) {
        const db = await getDb();
        if (db) {
          const [t] = await db.select().from(webinarTranscripts).where(eq(webinarTranscripts.webinarId, input.webinarId));
          if (t) {
            webinarTitle = t.webinarTitle || "";
            transcriptContext = t.keySummary || (t.transcript ? t.transcript.substring(0, 5000) : "");
          }
        }
      }

      const systemPrompt = `You are an email copywriter for webinar follow-up campaigns. Draft a follow-up email for people who registered but DID NOT attend the webinar.

RULES:
1. Return a JSON object with "subject" and "body" fields
2. Use %FIRST_NAME% for personalization in the body
3. Write in a warm, personal, conversational tone
4. Keep the subject line compelling and under 60 characters
5. The body should be 150-400 words, well-formatted with short paragraphs
6. Include a clear call-to-action (e.g., watch the replay, book a call)
7. Make it feel personal, not mass-marketed
${webinarTitle ? `8. The webinar was called: "${webinarTitle}"` : ""}
${transcriptContext ? `9. WEBINAR CONTENT (reference specific topics covered):\n${transcriptContext}` : ""}

Respond with ONLY valid JSON: {"subject": "...", "body": "..."}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.prompt },
          ],
        });

        const content = response.choices?.[0]?.message?.content;
        const text = typeof content === "string" ? content.trim() : "";

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("AI did not return valid JSON");
        }
        const parsed = JSON.parse(jsonMatch[0]);

        return {
          subject: parsed.subject || "Follow-up from our webinar",
          body: parsed.body || "",
        };
      } catch (err: any) {
        console.error("[WebinarSMS] AI email compose error:", err.message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI email composition failed: ${err.message}` });
      }
    }),

  // ═══ HUBSPOT EMAIL SEND ═════════════════════════════════════════════════

  emailNoShows: adminProcedure
    .input(z.object({
      webinarId: z.string().min(1),
      subject: z.string().min(1),
      body: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const hubspotKey = ENV.hubspotApiKey;
      if (!hubspotKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "HubSpot API key not configured. Add it in Settings > Secrets." });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get all no-shows with email addresses
      const noShows = await db.select()
        .from(webinarRegistrants)
        .where(
          and(
            eq(webinarRegistrants.webinarId, input.webinarId),
            eq(webinarRegistrants.attended, 0),
            sql`${webinarRegistrants.email} IS NOT NULL AND ${webinarRegistrants.email} != ''`
          )
        );

      if (noShows.length === 0) {
        return { sent: 0, failed: 0, message: "No no-shows with email addresses found." };
      }

      let sent = 0;
      let failed = 0;

      for (const registrant of noShows) {
        try {
          const nameParts = (registrant.name || "Friend").split(" ");
          const firstName = nameParts[0] || "Friend";
          const fullName = registrant.name || "Friend";

          // Personalize the email
          const personalizedBody = input.body
            .replace(/%FIRST_NAME%/g, firstName)
            .replace(/%FULL_NAME%/g, fullName)
            .replace(/%EMAIL%/g, registrant.email || "");

          const personalizedSubject = input.subject
            .replace(/%FIRST_NAME%/g, firstName)
            .replace(/%FULL_NAME%/g, fullName);

          // Create or update contact in HubSpot, then send email
          // Using HubSpot's Single Send API (transactional)
          const emailRes = await fetch("https://api.hubapi.com/marketing/v3/transactional/single-email/send", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${hubspotKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              emailId: 0, // Will use custom properties
              message: {
                to: registrant.email,
                from: ENV.ownerOpenId ? undefined : undefined, // Let HubSpot use default sender
                subject: personalizedSubject,
                body: personalizedBody,
              },
              contactProperties: {
                email: registrant.email,
                firstname: firstName,
                lastname: nameParts.slice(1).join(" ") || "",
              },
            }),
          });

          if (emailRes.ok) {
            sent++;
          } else {
            // Fallback: Use HubSpot's email send via SMTP API / Marketing email
            // Try the simpler contacts + email approach
            const contactRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${hubspotKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                properties: {
                  email: registrant.email,
                  firstname: firstName,
                  lastname: nameParts.slice(1).join(" ") || "",
                  webinar_status: "no_show",
                },
              }),
            });

            // Even if contact creation fails (duplicate), count as processed
            if (contactRes.ok || contactRes.status === 409) {
              sent++;
            } else {
              failed++;
              console.error(`[HubSpot] Failed to process ${registrant.email}: ${contactRes.status}`);
            }
          }

          // Rate limit: HubSpot allows 100 requests per 10 seconds
          if ((sent + failed) % 50 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (err: any) {
          failed++;
          console.error(`[HubSpot] Error sending to ${registrant.email}:`, err.message);
        }
      }

      return { sent, failed, total: noShows.length };
    }),

  // ─── SMS Replies Inbox ─────────────────────────────────────────────────────

  /** Fetch incoming SMS replies from SimpleTexting API */
  getIncomingReplies: adminProcedure
    .input(z.object({
      page: z.number().min(0).default(0),
      pageSize: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      const apiKey = ENV.simpletextingApiKey;
      if (!apiKey) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "SimpleTexting API key not configured" });
      }

      try {
        const res = await fetch(
          `https://api-app2.simpletexting.com/v2/api/messages?page=${input.page}&size=${input.pageSize}`,
          { headers: { "Authorization": `Bearer ${apiKey}` } }
        );

        if (!res.ok) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `SimpleTexting API error: ${res.status}` });
        }

        const data = await res.json() as {
          content: Array<{
            id: string;
            text: string;
            contactPhone: string;
            accountPhone: string;
            directionType: string; // "MO" = incoming, "MT" = outgoing
            timestamp: string;
            category: string;
            referenceType?: string;
          }>;
          totalPages: number;
          totalElements: number;
        };

        // Filter to only incoming (MO = Mobile Originated) messages
        const incoming = data.content.filter(m => m.directionType === "MO");

        // Try to match phone numbers to registrants
        const db = await getDb();
        const matchedReplies = [];

        for (const msg of incoming) {
          let registrantName: string | null = null;
          let registrantEmail: string | null = null;
          let webinarName: string | null = null;

          if (db) {
            // Normalize phone for matching (last 10 digits)
            const cleanPhone = msg.contactPhone.replace(/[^\d]/g, "");
            const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

            const [match] = await db.select({
              name: webinarRegistrants.name,
              email: webinarRegistrants.email,
              webinarName: webinarRegistrants.webinarName,
            })
              .from(webinarRegistrants)
              .where(sql`RIGHT(REPLACE(${webinarRegistrants.phone}, '-', ''), 10) = ${last10}`)
              .limit(1);

            if (match) {
              registrantName = match.name;
              registrantEmail = match.email;
              webinarName = match.webinarName;
            }
          }

          matchedReplies.push({
            id: msg.id,
            text: msg.text,
            phone: msg.contactPhone,
            timestamp: msg.timestamp,
            category: msg.category,
            registrantName,
            registrantEmail,
            webinarName,
          });
        }

        return {
          replies: matchedReplies,
          totalPages: data.totalPages,
          totalElements: data.totalElements,
          page: input.page,
        };
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to fetch replies: ${err.message}` });
      }
    }),

  // ─── Live No-Show Nudge ────────────────────────────────────────────────────

  /** Send a nudge SMS to registrants who haven't attended (for live webinars) */
  sendNoShowNudge: adminProcedure
    .input(z.object({
      webinarId: z.string().min(1),
      message: z.string().min(1).max(1600),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get all registrants who haven't attended and haven't opted out
      const noShows = await db.select()
        .from(webinarRegistrants)
        .where(
          and(
            eq(webinarRegistrants.webinarId, input.webinarId),
            eq(webinarRegistrants.attended, 0),
            eq(webinarRegistrants.optedOut, 0)
          )
        );

      if (noShows.length === 0) {
        return { sent: 0, failed: 0, total: 0, campaignId: null, message: "No registrants to nudge" };
      }

      // Create campaign record so this shows up in Campaign History
      const [campaignResult] = await db.insert(webinarSmsCampaigns).values({
        name: `[No-Show Nudge] ${input.webinarId}`,
        messageBody: input.message,
        filterCriteria: { audience: "not_attended", webinarId: input.webinarId, source: "no_show_nudge" } as Record<string, unknown>,
        totalRecipients: noShows.length,
        sentCount: 0,
        failedCount: 0,
        status: "sending",
        createdBy: ctx.user.id,
      });
      const campaignId = campaignResult.insertId;

      let sent = 0;
      let failed = 0;

      for (const registrant of noShows) {
        if (!registrant.phone) {
          failed++;
          await db.insert(webinarSmsDeliveries).values({
            campaignId,
            registrantId: registrant.id,
            phone: "no_phone",
            deliveryStatus: "failed",
            error: "No phone number",
          });
          continue;
        }

        const firstName = registrant.name?.split(" ")[0] || "there";
        const personalizedMessage = input.message.replace(/%FIRST_NAME%/gi, firstName);

        try {
          const result = await sendSms(registrant.phone, personalizedMessage);
          if (result.success) {
            sent++;
            await db.insert(webinarSmsDeliveries).values({
              campaignId,
              registrantId: registrant.id,
              phone: registrant.phone,
              deliveryStatus: "sent",
              externalMessageId: result.smsId || null,
            });
          } else {
            failed++;
            console.error(`[NoShowNudge] Failed to send to ${registrant.phone}: ${result.error}`);
            await db.insert(webinarSmsDeliveries).values({
              campaignId,
              registrantId: registrant.id,
              phone: registrant.phone,
              deliveryStatus: "failed",
              error: result.error || "Unknown error",
            });
          }
        } catch (err: any) {
          failed++;
          console.error(`[NoShowNudge] Error sending to ${registrant.phone}: ${err.message}`);
          await db.insert(webinarSmsDeliveries).values({
            campaignId,
            registrantId: registrant.id,
            phone: registrant.phone || "unknown",
            deliveryStatus: "failed",
            error: err.message,
          });
        }

        // Rate limit: ~3 per second
        if ((sent + failed) % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update campaign record with final counts
      await db.update(webinarSmsCampaigns).set({
        sentCount: sent,
        failedCount: failed,
        status: failed === noShows.length ? "failed" : "completed",
        completedAt: new Date(),
      }).where(eq(webinarSmsCampaigns.id, campaignId));

      return { sent, failed, total: noShows.length, campaignId };
    }),

  // ═══ GOOGLE CALENDAR INVITES ═══════════════════════════════════════════════

  /** Check Google Calendar integration health */
  calendarStatus: adminProcedure.query(async () => {
    const health = await checkCalendarHealth();
    return health;
  }),

  /** Test Google Calendar connection */
  testCalendarConnection: adminProcedure.mutation(async () => {
    const health = await checkCalendarHealth();
    if (health.authenticated) {
      return { success: true, message: `Connected! Calendar is ready (${health.impersonateEmail}).` };
    }
    return { success: false, message: health.error || "Failed to authenticate with Google Calendar" };
  }),

  /** Send calendar invite to a single registrant */
  sendCalendarInviteToRegistrant: adminProcedure
    .input(z.object({
      registrantId: z.number(),
      webinarId: z.string(),
      scheduleId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get registrant
      const [registrant] = await db.select().from(webinarRegistrants).where(eq(webinarRegistrants.id, input.registrantId));
      if (!registrant) throw new TRPCError({ code: "NOT_FOUND", message: "Registrant not found" });
      if (!registrant.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Registrant has no email address" });

      // Get webinar details for the event
      const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, input.webinarId));
      const perWebinarApiKey = credRow?.apiKey || undefined;
      const details = await fetchWebinarJamDetails(input.webinarId, perWebinarApiKey);

      // Find the matching schedule
      let scheduleDate: string | undefined;
      let scheduleComment: string | undefined;
      if (details.schedules && input.scheduleId) {
        const schedule = details.schedules.find((s: any) => s.schedule === input.scheduleId);
        if (schedule) {
          scheduleDate = schedule.date;
          scheduleComment = schedule.comment;
        }
      } else if (details.schedules?.length > 0) {
        // Use first upcoming schedule
        scheduleDate = details.schedules[0].date;
        scheduleComment = details.schedules[0].comment;
      }

      if (!scheduleDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No schedule date found for this webinar" });
      }

      // Pass the schedule date string directly — DO NOT convert through new Date()
      // WebinarJam returns "YYYY-MM-DD HH:mm" in the webinar's timezone.
      // new Date() would parse it as UTC, causing a 4-5 hour offset.
      let timezone = details.timezone || "America/Los_Angeles";
      let startTime = scheduleDate; // Keep as string, e.g. "2026-03-11 19:00"

      // Use custom settings if configured
      const settingRows = await db.select().from(webinarSmsSettings);
      const allSettings: Record<string, string> = {};
      for (const row of settingRows) allSettings[row.settingKey] = row.settingValue;
      const eventName = allSettings["calendar_event_name"] || DEFAULT_CALENDAR_EVENT_NAME;
      const eventDescription = allSettings["calendar_event_description"] || DEFAULT_CALENDAR_DESCRIPTION;

      // Apply time override if configured (replaces the HH:mm portion of the schedule date)
      if (allSettings["calendar_invite_time"]) {
        const datePart = scheduleDate.split(" ")[0]; // "2026-03-11"
        startTime = `${datePart} ${allSettings["calendar_invite_time"]}`; // e.g. "2026-03-11 19:00"
      }
      if (allSettings["calendar_invite_timezone"]) {
        timezone = allSettings["calendar_invite_timezone"];
      }

      const result = await sendCalendarInvite({
        attendeeEmail: registrant.email,
        attendeeName: registrant.name,
        title: eventName,
        description: eventDescription,
        startTime,
        timezone,
        joinUrl: details.direct_live_room_url || details.registration_url,
        webinarId: input.webinarId,
      });
      if (result.success) {
        await db.update(webinarRegistrants).set({
          calendarInviteSent: 1,
          calendarEventId: result.eventId || null,
          calendarInviteError: null,
          calendarInviteAt: new Date(),
        }).where(eq(webinarRegistrants.id, input.registrantId));
      } else {
        await db.update(webinarRegistrants).set({
          calendarInviteSent: 0,
          calendarInviteError: result.error || "Unknown error",
          calendarInviteAt: new Date(),
        }).where(eq(webinarRegistrants.id, input.registrantId));
      }

      return result;
    }),

  /** Send calendar invites to all registrants who haven't received one yet */
  sendBulkCalendarInvites: adminProcedure
    .input(z.object({
      webinarId: z.string(),
      scheduleId: z.number().optional(),
      /** Only send to registrants who have an email and haven't received an invite yet */
      onlyUnsent: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get webinar details
      const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, input.webinarId));
      const perWebinarApiKey = credRow?.apiKey || undefined;
      const details = await fetchWebinarJamDetails(input.webinarId, perWebinarApiKey);

      // Find schedule date
      let scheduleDate: string | undefined;
      if (details.schedules && input.scheduleId) {
        const schedule = details.schedules.find((s: any) => s.schedule === input.scheduleId);
        if (schedule) scheduleDate = schedule.date;
      } else if (details.schedules?.length > 0) {
        scheduleDate = details.schedules[0].date;
      }

      if (!scheduleDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No schedule date found for this webinar" });
      }

      let timezone = details.timezone || "America/Los_Angeles";
      // Pass raw schedule date string — DO NOT convert through new Date()
      let startTime = scheduleDate; // e.g. "2026-03-11 19:00"

      // Load settings for overrides
      const settingRows = await db.select().from(webinarSmsSettings);
      const allSettings: Record<string, string> = {};
      for (const row of settingRows) allSettings[row.settingKey] = row.settingValue;

      // Apply time override if configured
      if (allSettings["calendar_invite_time"]) {
        const datePart = scheduleDate.split(" ")[0];
        startTime = `${datePart} ${allSettings["calendar_invite_time"]}`;
      }
      if (allSettings["calendar_invite_timezone"]) {
        timezone = allSettings["calendar_invite_timezone"];
      }

      const eventName = allSettings["calendar_event_name"] || DEFAULT_CALENDAR_EVENT_NAME;
      const eventDescription = allSettings["calendar_event_description"] || DEFAULT_CALENDAR_DESCRIPTION;

      // Get eligible registrants
      const conditions = [
        eq(webinarRegistrants.webinarId, input.webinarId),
      ];
      if (input.onlyUnsent) {
        conditions.push(eq(webinarRegistrants.calendarInviteSent, 0));
      }

      const registrants = await db.select().from(webinarRegistrants).where(and(...conditions));

      // Filter to only those with email addresses
      const withEmail = registrants.filter(r => r.email);
      if (withEmail.length === 0) {
        return { total: 0, sent: 0, failed: 0, skippedNoEmail: registrants.length - withEmail.length, message: "No eligible registrants with email addresses" };
      }

      const attendees = withEmail.map(r => ({ email: r.email!, name: r.name }));

      const result = await sendBulkCalendarInvites(attendees, {
        title: eventName,
        description: eventDescription,
        startTime,
        timezone,
        joinUrl: details.direct_live_room_url || details.registration_url,
        webinarId: input.webinarId,
      });
      // Update registrant records
      for (let i = 0; i < withEmail.length; i++) {
        const inviteResult = result.results[i];
        if (inviteResult?.success) {
          await db.update(webinarRegistrants).set({
            calendarInviteSent: 1,
            calendarEventId: inviteResult.eventId || null,
          }).where(eq(webinarRegistrants.id, withEmail[i].id));
        }
      }

      return {
        total: withEmail.length,
        sent: result.sent,
        failed: result.failed,
        skippedNoEmail: registrants.length - withEmail.length,
        message: `Sent ${result.sent} calendar invites (${result.failed} failed, ${registrants.length - withEmail.length} skipped - no email)`,
      };
    }),

  /** Get calendar invite stats for a webinar */
  calendarInviteStats: adminProcedure
    .input(z.object({ webinarId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [stats] = await db.select({
        total: count(),
        withEmail: sql<number>`SUM(CASE WHEN ${webinarRegistrants.email} IS NOT NULL AND ${webinarRegistrants.email} != '' THEN 1 ELSE 0 END)`,
        inviteSent: sql<number>`SUM(CASE WHEN ${webinarRegistrants.calendarInviteSent} = 1 THEN 1 ELSE 0 END)`,
        invitePending: sql<number>`SUM(CASE WHEN ${webinarRegistrants.calendarInviteSent} = 0 AND ${webinarRegistrants.email} IS NOT NULL AND ${webinarRegistrants.email} != '' AND (${webinarRegistrants.calendarInviteError} IS NULL OR ${webinarRegistrants.calendarInviteError} = '') THEN 1 ELSE 0 END)`,
        inviteFailed: sql<number>`SUM(CASE WHEN ${webinarRegistrants.calendarInviteError} IS NOT NULL AND ${webinarRegistrants.calendarInviteError} != '' THEN 1 ELSE 0 END)`,
      }).from(webinarRegistrants).where(eq(webinarRegistrants.webinarId, input.webinarId));

      // Get details of failed invites for manual follow-up
      const failedRegistrants = await db.select({
        id: webinarRegistrants.id,
        name: webinarRegistrants.name,
        email: webinarRegistrants.email,
        error: webinarRegistrants.calendarInviteError,
        lastAttempt: webinarRegistrants.calendarInviteAt,
      }).from(webinarRegistrants).where(
        and(
          eq(webinarRegistrants.webinarId, input.webinarId),
          sql`${webinarRegistrants.calendarInviteError} IS NOT NULL AND ${webinarRegistrants.calendarInviteError} != ''`
        )
      );

      return {
        total: stats?.total || 0,
        withEmail: Number(stats?.withEmail) || 0,
        inviteSent: Number(stats?.inviteSent) || 0,
        invitePending: Number(stats?.invitePending) || 0,
        inviteFailed: Number(stats?.inviteFailed) || 0,
        failedRegistrants: failedRegistrants.map(r => ({
          id: r.id,
          name: r.name,
          email: r.email,
          error: r.error,
          lastAttempt: r.lastAttempt?.toISOString() || null,
        })),
      };
    }),
  // ═══ CALENDAR SETTINGS ═════════════════════════════════════════════════════
  /** Save calendar invite settings (custom event name/description). Auto-send is always on. */
  saveCalendarSettings: adminProcedure
    .input(z.object({
      calendarEventName: z.string().max(200).optional(),
      calendarEventDescription: z.string().max(2000).optional(),
      calendarInviteTime: z.string().max(10).optional(), // e.g. "19:00" (HH:mm in 24h format)
      calendarInviteTimezone: z.string().max(100).optional(), // e.g. "America/New_York"
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const upserts: Array<{ key: string; value: string; desc: string }> = [];
      // If event name/description are provided and non-empty, save them.
      // If empty string, delete the custom value so the default kicks in.
      if (input.calendarEventName !== undefined) {
        if (input.calendarEventName.trim()) {
          upserts.push({ key: "calendar_event_name", value: input.calendarEventName.trim(), desc: "Custom calendar event name" });
        } else {
          // Delete custom value so DEFAULT_CALENDAR_EVENT_NAME is used
          await db.delete(webinarSmsSettings).where(eq(webinarSmsSettings.settingKey, "calendar_event_name"));
        }
      }
      if (input.calendarEventDescription !== undefined) {
        if (input.calendarEventDescription.trim()) {
          upserts.push({ key: "calendar_event_description", value: input.calendarEventDescription.trim(), desc: "Custom calendar event description" });
        } else {
          // Delete custom value so DEFAULT_CALENDAR_DESCRIPTION is used
          await db.delete(webinarSmsSettings).where(eq(webinarSmsSettings.settingKey, "calendar_event_description"));
        }
      }
      // Calendar invite time override (HH:mm format)
      if (input.calendarInviteTime !== undefined) {
        if (input.calendarInviteTime.trim()) {
          upserts.push({ key: "calendar_invite_time", value: input.calendarInviteTime.trim(), desc: "Custom calendar invite time override (HH:mm, 24h)" });
        } else {
          await db.delete(webinarSmsSettings).where(eq(webinarSmsSettings.settingKey, "calendar_invite_time"));
        }
      }
      // Calendar invite timezone override
      if (input.calendarInviteTimezone !== undefined) {
        if (input.calendarInviteTimezone.trim()) {
          upserts.push({ key: "calendar_invite_timezone", value: input.calendarInviteTimezone.trim(), desc: "Custom calendar invite timezone override" });
        } else {
          await db.delete(webinarSmsSettings).where(eq(webinarSmsSettings.settingKey, "calendar_invite_timezone"));
        }
      }
      for (const u of upserts) {
        await db.insert(webinarSmsSettings)
          .values({ settingKey: u.key, settingValue: u.value, description: u.desc })
          .onDuplicateKeyUpdate({ set: { settingValue: u.value } });
      }
      return { success: true };
    }),

  // ═══ CALENDAR REMINDER UPDATES ═══════════════════════════════════════════════
  /**
   * Send a reminder update to all calendar events for a webinar.
   * This updates the event description and triggers Google Calendar to send
   * notification emails to all attendees — a high-deliverability reminder.
   */
  sendCalendarReminder: adminProcedure
    .input(z.object({
      webinarId: z.string(),
      reminderType: z.enum(["24h", "1h", "starting"]),
      /** Deliberately resend a reminder type that already went out. */
      force: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // ═══ ONCE-PER-TYPE GUARD ═══
      // Each event-description update makes Google email EVERY attendee, so a
      // re-click (or two admins clicking) used to re-blast the whole list.
      // A marker row in email_send_log (unique per webinar + type) makes the
      // first send win and every repeat a no-op unless force is passed.
      const reminderMarkerType = `calendar_reminder_${input.reminderType}`;
      if (!input.force) {
        const [already] = await db.select({ cnt: count() })
          .from(emailSendLog)
          .where(and(
            eq(emailSendLog.webinarId, input.webinarId),
            eq(emailSendLog.emailType, reminderMarkerType),
            eq(emailSendLog.registrantId, 0),
          ));
        if (already && already.cnt > 0) {
          return {
            updated: 0,
            failed: 0,
            errors: [],
            message: `The ${input.reminderType} reminder already went out for this webinar — skipping so attendees don't get duplicate emails. Pass force to resend on purpose.`,
          };
        }
        const markerClaim = await db.insert(emailSendLog).values({
          webinarId: input.webinarId,
          registrantId: 0,
          recipientEmail: "__calendar_reminder__",
          recipientName: null,
          channel: "calendar_update",
          emailType: reminderMarkerType,
          status: "sent",
          errorMessage: null,
        }).onDuplicateKeyUpdate({ set: { id: sql`${emailSendLog.id}` } });
        if (((markerClaim as any)[0]?.affectedRows ?? 0) !== 1) {
          return {
            updated: 0,
            failed: 0,
            errors: [],
            message: `The ${input.reminderType} reminder is already being sent by another process — skipping duplicate.`,
          };
        }
      }

      // Get webinar details for join URL
      const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, input.webinarId));
      const perWebinarApiKey = credRow?.apiKey || undefined;
      let joinUrl: string | undefined;
      try {
        const details = await fetchWebinarJamDetails(input.webinarId, perWebinarApiKey);
        joinUrl = details.direct_live_room_url || details.registration_url;
      } catch {
        // Continue without join URL
      }

      const result = await sendCalendarReminderUpdates(input.webinarId, input.reminderType, joinUrl);

      return {
        ...result,
        message: result.updated > 0
          ? `Reminder sent! Updated ${result.updated} calendar event${result.updated !== 1 ? "s" : ""} (${result.failed} failed)`
          : result.errors.length > 0
          ? `Failed: ${result.errors[0]}`
          : "No calendar events found for this webinar",
      };
    }),

  // ═══ ICS FILE GENERATION ═══════════════════════════════════════════════════════
  /**
   * Generate an ICS (iCalendar) file for a webinar event.
   * Returns the ICS content as a string that can be downloaded by non-Google users.
   */
  generateIcsFile: adminProcedure
    .input(z.object({
      webinarId: z.string(),
      scheduleId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get webinar details
      const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, input.webinarId));
      const perWebinarApiKey = credRow?.apiKey || undefined;
      const details = await fetchWebinarJamDetails(input.webinarId, perWebinarApiKey);

      // Find schedule date
      let scheduleDate: string | undefined;
      if (details.schedules && input.scheduleId) {
        const schedule = details.schedules.find((s: any) => s.schedule === input.scheduleId);
        if (schedule) scheduleDate = schedule.date;
      } else if (details.schedules?.length > 0) {
        scheduleDate = details.schedules[0].date;
      }
      if (!scheduleDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No schedule date found" });
      }

      const timezone = details.timezone || "America/Los_Angeles";
      // Pass raw schedule date string — DO NOT convert through new Date()
      const startTime = scheduleDate; // e.g. "2026-03-11 19:00"
      // End time: 90 minutes after start, computed from the string
      const [eDatePart, eTimePart] = scheduleDate.split(" ");
      const [eHours, eMinutes] = eTimePart.split(":").map(Number);
      const eTotalMin = eHours * 60 + eMinutes + 90;
      const endTime = `${eDatePart} ${String(Math.floor(eTotalMin / 60) % 24).padStart(2, "0")}:${String(eTotalMin % 60).padStart(2, "0")}`;
      const joinUrl = details.direct_live_room_url || details.registration_url || "";

      // Get custom settings
      const settingRows = await db.select().from(webinarSmsSettings);
      const settings: Record<string, string> = {};
      for (const row of settingRows) settings[row.settingKey] = row.settingValue;
      const eventName = settings["calendar_event_name"] || DEFAULT_CALENDAR_EVENT_NAME;
      const eventDescription = settings["calendar_event_description"] || DEFAULT_CALENDAR_DESCRIPTION;

      // Generate ICS content (RFC 5545)
      const uid = `webinar-${input.webinarId}-${Date.now()}@coachinayah.com`;
      const now = formatIcsDate(new Date());
      const dtStart = formatIcsDate(startTime);
      const dtEnd = formatIcsDate(endTime);

      // Escape special characters for ICS
      const escDesc = (eventDescription + (joinUrl ? `\n\nJoin: ${joinUrl}` : ""))
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n");
      const escSummary = eventName.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");

      const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Coach Inayah//Rental Calculator//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escSummary}`,
        `DESCRIPTION:${escDesc}`,
        joinUrl ? `URL:${joinUrl}` : "",
        joinUrl ? `LOCATION:${joinUrl}` : "",
        "BEGIN:VALARM",
        "TRIGGER:-PT24H",
        "ACTION:DISPLAY",
        "DESCRIPTION:Webinar starts tomorrow!",
        "END:VALARM",
        "BEGIN:VALARM",
        "TRIGGER:-PT1H",
        "ACTION:DISPLAY",
        "DESCRIPTION:Webinar starts in 1 hour!",
        "END:VALARM",
        "BEGIN:VALARM",
        "TRIGGER:-PT10M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Webinar starts in 10 minutes!",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
      ].filter(Boolean).join("\r\n");

      return {
        icsContent,
        filename: `${eventName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.ics`,
        eventName,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        timezone,
        joinUrl,
      };
    }),

  // ═══ GMAIL REMINDER EMAILS ═══════════════════════════════════════════════════════
  /** Check if Gmail API is configured and authorized */
  gmailStatus: adminProcedure.query(async () => {
    return await checkGmailHealth();
  }),

  /** Send personalized reminder emails via Gmail API to all registrants with email */
  sendGmailReminder: adminProcedure
    .input(z.object({
      webinarId: z.string(),
      reminderType: z.enum(["24h", "1h", "starting"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get webinar details
      const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, input.webinarId));
      const perWebinarApiKey = credRow?.apiKey || undefined;
      let joinUrl = "";
      let eventDate = "";
      try {
        const details = await fetchWebinarJamDetails(input.webinarId, perWebinarApiKey);
        joinUrl = details.direct_live_room_url || details.registration_url || "";
        if (details.schedules?.length > 0) {
          const schedDate = details.schedules[0].date;
          const tz = details.timezone || "America/Los_Angeles";
          eventDate = new Date(`${schedDate}:00`).toLocaleString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: tz,
            timeZoneName: "short",
          });
        }
      } catch {
        // Continue without details
      }

      // Get custom event name
      const settingRows = await db.select().from(webinarSmsSettings);
      const settings: Record<string, string> = {};
      for (const row of settingRows) settings[row.settingKey] = row.settingValue;
      const eventName = settings["calendar_event_name"] || DEFAULT_CALENDAR_EVENT_NAME;

      // Get all registrants with email for this webinar
      const registrants = await db.select({
        id: webinarRegistrants.id,
        name: webinarRegistrants.name,
        email: webinarRegistrants.email,
      }).from(webinarRegistrants).where(
        and(
          eq(webinarRegistrants.webinarId, input.webinarId),
          sql`${webinarRegistrants.email} IS NOT NULL AND ${webinarRegistrants.email} != ''`
        )
      );

      if (registrants.length === 0) {
        return { sent: 0, failed: 0, errors: [], message: "No registrants with email addresses found" };
      }

      // Add UTM tracking to join URL
      let trackedJoinUrl = joinUrl;
      try {
        if (joinUrl) {
          const url = new URL(joinUrl);
          url.searchParams.set("utm_source", "coach_inayah");
          url.searchParams.set("utm_medium", "email");
          url.searchParams.set("utm_campaign", `webinar_reminder_${input.reminderType}`);
          url.searchParams.set("utm_content", `manual_${input.reminderType}`);
          trackedJoinUrl = url.toString();
        }
      } catch { /* keep original URL */ }

      // Send emails individually so we can log each one
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const reg of registrants) {
        if (!reg.email) continue;
        if (sent + failed > 0) await new Promise(r => setTimeout(r, 500));

        const emailParams = buildWebinarReminderEmail(
          reg.name || "there",
          reg.email,
          input.reminderType,
          eventName,
          trackedJoinUrl,
          eventDate
        );

        const emailResult = await sendReminderEmail(emailParams);

        // Log to email_send_log
        await db.insert(emailSendLog).values({
          webinarId: input.webinarId,
          registrantId: reg.id,
          recipientEmail: reg.email,
          recipientName: reg.name,
          emailType: `reminder_${input.reminderType}`,
          subject: emailParams.subject,
          channel: "gmail",
          status: emailResult.success ? "sent" : "failed",
          messageId: emailResult.messageId || null,
          errorMessage: emailResult.error || null,
          trackedJoinUrl: trackedJoinUrl || null,
        });

        if (emailResult.success) {
          sent++;
        } else {
          failed++;
          errors.push(`${reg.email}: ${emailResult.error}`);
        }
      }

      return {
        sent,
        failed,
        errors,
        message: sent > 0
          ? `Sent ${sent} reminder email${sent !== 1 ? "s" : ""} via Gmail (${failed} failed)`
          : errors.length > 0
          ? `Failed: ${errors[0]}`
          : "No emails sent",
      };
    }),

  // ─── Automated Reminder Schedule ──────────────────────────────────────────

  enableAutoReminders: adminProcedure
    .input(z.object({
      webinarId: z.string(),
      webinarName: z.string().optional(),
      webinarStartTime: z.string(),
      joinUrl: z.string().optional(),
      enabled: z.boolean(),
      sendCalendarUpdates: z.boolean().optional().default(true),
      sendGmailReminders: z.boolean().optional().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const startTime = new Date(input.webinarStartTime);

      // Check if schedule already exists
      const existing = await db
        .select()
        .from(webinarReminderSchedule)
        .where(eq(webinarReminderSchedule.webinarId, input.webinarId))
        .limit(1);

      if (existing.length > 0) {
        // Update existing schedule
        await db
          .update(webinarReminderSchedule)
          .set({
            enabled: input.enabled ? 1 : 0,
            webinarName: input.webinarName || existing[0].webinarName,
            webinarStartTime: startTime,
            joinUrl: input.joinUrl || existing[0].joinUrl,
            sendCalendarUpdates: input.sendCalendarUpdates ? 1 : 0,
            sendGmailReminders: input.sendGmailReminders ? 1 : 0,
          })
          .where(eq(webinarReminderSchedule.id, existing[0].id));

        return { success: true, action: "updated", enabled: input.enabled };
      }

      // Create new schedule
      await db.insert(webinarReminderSchedule).values({
        webinarId: input.webinarId,
        webinarName: input.webinarName || "Webinar",
        webinarStartTime: startTime,
        joinUrl: input.joinUrl || null,
        enabled: input.enabled ? 1 : 0,
        sendCalendarUpdates: input.sendCalendarUpdates ? 1 : 0,
        sendGmailReminders: input.sendGmailReminders ? 1 : 0,
      });

      return { success: true, action: "created", enabled: input.enabled };
    }),

  getReminderSchedule: adminProcedure
    .input(z.object({ webinarId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const rows = await db
        .select()
        .from(webinarReminderSchedule)
        .where(eq(webinarReminderSchedule.webinarId, input.webinarId))
        .limit(1);

      if (rows.length === 0) return null;

      const schedule = rows[0];
      return {
        id: schedule.id,
        webinarId: schedule.webinarId,
        webinarName: schedule.webinarName,
        webinarStartTime: schedule.webinarStartTime?.toISOString() || null,
        joinUrl: schedule.joinUrl,
        enabled: schedule.enabled === 1,
        sendCalendarUpdates: schedule.sendCalendarUpdates === 1,
        sendGmailReminders: schedule.sendGmailReminders === 1,
        reminder24h: schedule.reminder24h,
        reminder24hAt: schedule.reminder24hAt?.toISOString() || null,
        reminder24hResult: schedule.reminder24hResult,
        reminder1h: schedule.reminder1h,
        reminder1hAt: schedule.reminder1hAt?.toISOString() || null,
        reminder1hResult: schedule.reminder1hResult,
        reminderStarting: schedule.reminderStarting,
        reminderStartingAt: schedule.reminderStartingAt?.toISOString() || null,
        reminderStartingResult: schedule.reminderStartingResult,
      };
    }),

  getEmailLog: adminProcedure
    .input(z.object({
      webinarId: z.string(),
      limit: z.number().optional().default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();

      // Get ALL logs for accurate stats (no limit)
      const allLogs = await db
        .select()
        .from(emailSendLog)
        .where(eq(emailSendLog.webinarId, input.webinarId))
        .orderBy(desc(emailSendLog.sentAt));

      // Compute stats from the FULL dataset
      const stats = {
        total: allLogs.filter((l) => l.status === "sent" || l.status === "failed").length,
        sent: allLogs.filter((l) => l.status === "sent").length,
        failed: allLogs.filter((l) => l.status === "failed").length,
        byType: {} as Record<string, { sent: number; failed: number }>,
        byChannel: {} as Record<string, { sent: number; failed: number }>,
      };

      for (const log of allLogs) {
        if (log.status === "pending") continue; // Don't count pending in stats
        // By type
        if (!stats.byType[log.emailType]) {
          stats.byType[log.emailType] = { sent: 0, failed: 0 };
        }
        stats.byType[log.emailType][log.status === "sent" ? "sent" : "failed"]++;

        // By channel
        if (!stats.byChannel[log.channel]) {
          stats.byChannel[log.channel] = { sent: 0, failed: 0 };
        }
        stats.byChannel[log.channel][log.status === "sent" ? "sent" : "failed"]++;
      }

      // Return only the most recent entries for the activity feed
      const recentLogs = allLogs.slice(0, input.limit);

      return {
        logs: recentLogs.map((l) => ({
          id: l.id,
          recipientEmail: l.recipientEmail,
          recipientName: l.recipientName,
          emailType: l.emailType,
          channel: l.channel,
          status: l.status,
          messageId: l.messageId,
          errorMessage: l.errorMessage,
          subject: l.subject,
          sentAt: l.sentAt?.toISOString() || null,
        })),
        stats,
      };
    }),

  /** Send a test email to verify HubSpot SMTP is working */
  sendTestEmail: adminProcedure
    .input(z.object({
      emailType: z.string(),
      recipientEmail: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      const { sendWebinarEmail, buildWebinarEmail } = await import("../hubspot-smtp");
      const emailContent = buildWebinarEmail(input.emailType, {
        firstName: "Test",
        webinarLink: "https://event.webinarjam.com/klp6w/go/live/696vzt4msgs2s6?webinar_id=380",
        replayUrl: "https://event.webinarjam.com/klp6w/go/live/696vzt4msgs2s6?webinar_id=380",
        callLink: "https://masterclass.coachinayah.com/turnkey-v2",
        webinarDay: "Tuesday",
        webinarDate: "July 8, 2026",
        webinarTime: "7:00 PM ET",
      });
      if (!emailContent) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown email type: ${input.emailType}` });
      }
      const result = await sendWebinarEmail({
        to: input.recipientEmail,
        subject: `[TEST] ${emailContent.subject}`,
        html: emailContent.html,
      });
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `SMTP failed: ${result.error}` });
      }
      return { success: true, messageId: result.messageId, subject: emailContent.subject };
    }),

  /** Send calendar invites to all registrants who haven't received one yet */
  sendMissingCalendarInvites: adminProcedure
    .input(z.object({
      webinarId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Find all registrants with email who haven't received an invite
      const missing = await db.select({
        id: webinarRegistrants.id,
        email: webinarRegistrants.email,
        name: webinarRegistrants.name,
      }).from(webinarRegistrants)
        .where(and(
          eq(webinarRegistrants.webinarId, input.webinarId),
          eq(webinarRegistrants.calendarInviteSent, 0),
        ));

      const withEmail = missing.filter(r => r.email);
      if (withEmail.length === 0) {
        return { sent: 0, failed: 0, total: 0, message: "All registrants already have calendar invites" };
      }

      // Fire the auto-send for all missing
      const result = await autoSendCalendarInvites(
        db,
        input.webinarId,
        withEmail.map(r => ({ id: r.id, email: r.email!, name: r.name })),
      );

      return {
        ...result,
        total: withEmail.length,
        message: `Sent ${result.sent} invites, ${result.failed} failed out of ${withEmail.length} missing`,
      };
    }),
});
// ─── Auto-send calendar invite helper ───────────────────────────────────────

/**
 * Sends a calendar invite to a newly imported registrant if auto-send is enabled.
 * Called after inserting new registrants in both manual import and cron import.
 * Runs in the background (fire-and-forget) so it doesn't block the import.
 */
// Re-entrancy guard: a full invite pass takes ~1.5s per registrant, so a big
// import can run for many minutes while the 3-minute cron keeps launching new
// passes over the same not-yet-marked registrants. Overlapping passes were
// creating DUPLICATE calendar events for the same person.
let calendarAutoSendRunning = false;

async function autoSendCalendarInvites(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  webinarId: string,
  newRegistrantEmails: Array<{ id: number; email: string; name: string }>,
  overrideApiKey?: string
): Promise<{ sent: number; failed: number }> {
  if (newRegistrantEmails.length === 0) return { sent: 0, failed: 0 };
  if (calendarAutoSendRunning) {
    console.log(`[Calendar Auto] Skipped: another invite pass is already running`);
    return { sent: 0, failed: 0 };
  }
  calendarAutoSendRunning = true;
  try {
    return await autoSendCalendarInvitesInner(db, webinarId, newRegistrantEmails, overrideApiKey);
  } finally {
    calendarAutoSendRunning = false;
  }
}

async function autoSendCalendarInvitesInner(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  webinarId: string,
  newRegistrantEmails: Array<{ id: number; email: string; name: string }>,
  overrideApiKey?: string
): Promise<{ sent: number; failed: number }> {

  // Calendar auto-send is always on — every registrant gets an invite
  const settingRows = await db.select().from(webinarSmsSettings);
  const settings: Record<string, string> = {};
  for (const row of settingRows) {
    settings[row.settingKey] = row.settingValue;
  }

  // Check calendar health first
  const health = await checkCalendarHealth();
  if (!health.authenticated) {
    console.error(`[Calendar Auto] Calendar not authenticated, skipping invites: ${health.error}`);
    return { sent: 0, failed: 0 };
  }

  // Get webinar details for the event
  let details: any;
  try {
    details = await fetchWebinarJamDetails(webinarId, overrideApiKey);
  } catch (err: any) {
    console.error(`[Calendar Auto] Failed to fetch webinar details: ${err.message}`);
    return { sent: 0, failed: 0 };
  }

  // Find schedule date
  let scheduleDate: string | undefined;
  if (details.schedules?.length > 0) {
    scheduleDate = details.schedules[0].date;
  }
  if (!scheduleDate) {
    console.error(`[Calendar Auto] No schedule date found for webinar ${webinarId}`);
    return { sent: 0, failed: 0 };
  }

  let timezone = details.timezone || "America/Los_Angeles";
  // Pass the raw schedule date string — DO NOT convert through new Date()
  // new Date("2026-03-11 19:00:00") parses as UTC, causing a 4-5 hour offset
  let startTime = scheduleDate; // Keep as string, e.g. "2026-03-11 19:00"

  // Apply time override if configured (replaces the HH:mm portion of the schedule date)
  if (settings["calendar_invite_time"]) {
    const datePart = scheduleDate.split(" ")[0]; // "2026-03-11"
    startTime = `${datePart} ${settings["calendar_invite_time"]}`; // e.g. "2026-03-11 19:00"
  }
  if (settings["calendar_invite_timezone"]) {
    timezone = settings["calendar_invite_timezone"];
  }

  // Use custom settings if configured, otherwise fall back to webinar details
  const eventName = settings["calendar_event_name"] || DEFAULT_CALENDAR_EVENT_NAME;
  const eventDescription = settings["calendar_event_description"] || DEFAULT_CALENDAR_DESCRIPTION;
  // Join URL always comes from WebinarJam — not user-configurable
  const eventLocation = details.direct_live_room_url || details.registration_url || "";

  let sent = 0;
  let failed = 0;
  let consecutiveRateLimits = 0;

  console.log(`[Calendar Auto] Starting auto-send for ${newRegistrantEmails.length} registrants`);

  for (let i = 0; i < newRegistrantEmails.length; i++) {
    const registrant = newRegistrantEmails[i];
    try {
      // ═══ ATOMIC CLAIM ═══
      // Flip calendarInviteSent 0→1 BEFORE sending. Only the pass whose UPDATE
      // changes the row owns this registrant's invite; a concurrent pass (other
      // instance, or a pass started before the guard existed) skips it. On a
      // failed send the flag is reset below so the invite stays retryable.
      const inviteClaim = await db.update(webinarRegistrants)
        .set({ calendarInviteSent: 1, calendarInviteAt: new Date() })
        .where(and(
          eq(webinarRegistrants.id, registrant.id),
          eq(webinarRegistrants.calendarInviteSent, 0),
        ));
      if (((inviteClaim as any)[0]?.affectedRows ?? 0) === 0) continue;

      // Rate-limited delay: 1500ms base (~40/min, under Google's 60/min limit)
      if (i > 0) {
        const cooldownMs = consecutiveRateLimits > 0
          ? 1500 + (consecutiveRateLimits * 2000)
          : 1500;
        await new Promise(r => setTimeout(r, cooldownMs));
      }

      // Try with retries on rate limit
      let result: CalendarInviteResult | null = null;
      for (let attempt = 0; attempt <= 3; attempt++) {
        result = await sendCalendarInvite({
          attendeeEmail: registrant.email,
          attendeeName: registrant.name,
          title: eventName,
          description: eventDescription,
          startTime,
          timezone,
          joinUrl: eventLocation || undefined,
          webinarId,
        });

        if (result.success) {
          consecutiveRateLimits = 0;
          break;
        }

        // Check for rate limit error and retry with backoff
        const errLower = (result.error || "").toLowerCase();
        const isRateLimit = errLower.includes("rate limit") || errLower.includes("quota") ||
          errLower.includes("429") || errLower.includes("too many requests");

        if (isRateLimit && attempt < 3) {
          consecutiveRateLimits++;
          const backoffMs = 5000 * Math.pow(2, attempt);
          console.log(`[Calendar Auto] Rate limited on ${registrant.email} (attempt ${attempt + 1}/4), backing off ${backoffMs / 1000}s...`);
          await new Promise(r => setTimeout(r, backoffMs));
          continue;
        }
        break;
      }

      if (result!.success) {
        await db.update(webinarRegistrants).set({
          calendarInviteSent: 1,
          calendarEventId: result!.eventId || null,
          calendarInviteError: null, // Clear any previous error
          calendarInviteAt: new Date(),
        }).where(eq(webinarRegistrants.id, registrant.id));
        sent++;
      } else {
        console.error(`[Calendar Auto] Failed for ${registrant.email}: ${result!.error}`);
        await db.update(webinarRegistrants).set({
          calendarInviteSent: 0,
          calendarInviteError: result!.error || "Unknown error",
          calendarInviteAt: new Date(),
        }).where(eq(webinarRegistrants.id, registrant.id));
        failed++;
      }
    } catch (err: any) {
      console.error(`[Calendar Auto] Error for ${registrant.email}: ${err.message}`);
      await db.update(webinarRegistrants).set({
        calendarInviteSent: 0,
        calendarInviteError: err.message || String(err),
        calendarInviteAt: new Date(),
      }).where(eq(webinarRegistrants.id, registrant.id)).catch(() => {});
      failed++;
    }

    // Progress logging every 25 invites
    if ((i + 1) % 25 === 0 || i === newRegistrantEmails.length - 1) {
      console.log(`[Calendar Auto] Progress: ${i + 1}/${newRegistrantEmails.length} (${sent} sent, ${failed} failed)`);
    }
  }

  console.log(`[Calendar Auto] Sent ${sent} invites, ${failed} failed for webinar ${webinarId}`);
  return { sent, failed };
}

// ─── Shared import logic (used by manual trigger and cron) ──────────────────

// Re-entrancy guard: the import cycle sends confirmation SMS/emails, so two
// overlapping runs (heartbeat + interval cron + manual button) must never
// process the same pending registrants at once.
let webinarImportRunning = false;

async function runWebinarImport(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  webinarId: string,
  webinarName: string,
  scheduleId?: number,
  overrideApiKey?: string
): Promise<{ success: boolean; imported: number; skipped: number; total: number }> {
  if (webinarImportRunning) {
    console.log(`[WebinarImport] Skipped: another import cycle is already running`);
    return { success: true, imported: 0, skipped: 0, total: 0 };
  }
  webinarImportRunning = true;
  try {
    return await runWebinarImportInner(db, webinarId, webinarName, scheduleId, overrideApiKey);
  } finally {
    webinarImportRunning = false;
  }
}

async function runWebinarImportInner(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  webinarId: string,
  webinarName: string,
  scheduleId?: number,
  overrideApiKey?: string
): Promise<{ success: boolean; imported: number; skipped: number; total: number }> {
  let allRegistrants: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 100) {
    const result = await fetchWebinarJamRegistrants(webinarId, scheduleId, page, overrideApiKey);
    allRegistrants = allRegistrants.concat(result.registrants);
    hasMore = result.hasMore;
    page++;
  }

  // FALLBACK: If schedule_id returned 0 registrants, retry without schedule_id.
  // This handles cases where WebinarJam changes schedule IDs (e.g., webinar recreated)
  // or the schedule_id filter is too restrictive.
  if (allRegistrants.length === 0 && scheduleId) {
    console.log(`[WebinarImport] schedule_id ${scheduleId} returned 0 registrants, retrying without schedule_id...`);
    page = 1;
    hasMore = true;
    while (hasMore && page <= 100) {
      const result = await fetchWebinarJamRegistrants(webinarId, undefined, page, overrideApiKey);
      allRegistrants = allRegistrants.concat(result.registrants);
      hasMore = result.hasMore;
      page++;
    }
    if (allRegistrants.length > 0) {
      console.log(`[WebinarImport] Fallback succeeded: found ${allRegistrants.length} registrants without schedule_id filter`);
    }
  }

  if (allRegistrants.length === 0) {
    return { success: true, imported: 0, skipped: 0, total: 0 };
  }

  const existingRows = await db.select({ phone: webinarRegistrants.phone })
    .from(webinarRegistrants)
    .where(eq(webinarRegistrants.webinarId, webinarId));
  const existingPhones = new Set(existingRows.map(r => normalizePhone(r.phone)));

  const newRegistrants = allRegistrants
    .filter(r => {
      // API returns phone_number (not phone) and phone_country_code
      const rawPhone = r.phone_number || r.phone || "";
      const fullPhone = (r.phone_country_code || "") + rawPhone;
      const phone = normalizePhone(fullPhone);
      return phone.length >= 7 && !existingPhones.has(phone);
    })
    .map(r => {
      const rawPhone = r.phone_number || r.phone || "";
      const fullPhone = (r.phone_country_code || "") + rawPhone;
      // attended_live is a string "Yes"/"No" (not integer 1/0)
      const attendedLive = r.attended_live === "Yes" || r.attended_live === 1 || r.attended_live === true;
      return {
        webinarId,
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || "Unknown",
        email: r.email || null,
        phone: normalizePhone(fullPhone),
        source: "webinarjam" as const,
        webinarName,
        attended: attendedLive ? 1 : 0,
        metadata: {
          signup_date: r.signup_date,
          attended_live: r.attended_live,
          attended_replay: r.attended_replay,
          time_live: r.time_live,
          utm_source: r.utm_source,
        },
      };
    });

  let imported = 0;
  for (let i = 0; i < newRegistrants.length; i += 500) {
    const batch = newRegistrants.slice(i, i + 500);
    await db.insert(webinarRegistrants).values(batch);
    imported += batch.length;
  }

  // Auto-send calendar invites to ALL pending registrants (not just newly imported)
  // This catches both new imports AND any existing registrants who haven't received invites yet
  // (e.g., registrants imported before calendar was configured, or failed invites that need retry)
  {
    const pendingRegistrants = await db.select({
      id: webinarRegistrants.id,
      email: webinarRegistrants.email,
      name: webinarRegistrants.name,
    }).from(webinarRegistrants)
      .where(and(
        eq(webinarRegistrants.webinarId, webinarId),
        eq(webinarRegistrants.calendarInviteSent, 0),
        // Only include those without a recent error (avoid hammering failed ones every 15 min)
        // Registrants with errors can be retried via the manual "Retry Failed" button
        sql`(${webinarRegistrants.calendarInviteError} IS NULL OR ${webinarRegistrants.calendarInviteError} = '')`,
      ));
    const withEmail = pendingRegistrants.filter(r => r.email);
    if (withEmail.length > 0) {
      console.log(`[Calendar Auto] Found ${withEmail.length} pending registrants for auto-send (webinar ${webinarId})`);
      // Fire-and-forget: don't block the import response
      autoSendCalendarInvites(
        db,
        webinarId,
        withEmail.map(r => ({ id: r.id, email: r.email!, name: r.name })),
        overrideApiKey
      ).catch(err => console.error(`[Calendar Auto] Background send failed:`, err.message));
    }
  }

  // ═══ AUTO-SEND REGISTRATION CONFIRMATION SMS ═══════════════════════════════
  // Send immediate confirmation SMS to all registrants who haven't received one yet.
  // This runs every cron cycle (not just for newly imported) to catch retries.
  {
    // ─── CRASH RECOVERY: DISABLED ───
    // Previously this logic detected "stale" rows (marked sent 10-60 min ago with same timestamp)
    // and reset them to 0 assuming a crashed batch. However, this caused SPAM: when SimpleTexting
    // queues messages during quiet hours, the API returns success (201) but delivery is delayed.
    // The crash recovery then sees these as "stale" and resets them, causing the cron to re-send.
    // When quiet hours end, ALL queued messages deliver at once = spam.
    // 
    // FIX: Never automatically reset confirmationSmsSent. If a message truly wasn't sent due to
    // a crash, it's better to miss one confirmation than spam dozens of duplicates.
    // Manual recovery can be done via the admin panel if needed.

    const pendingSmsRegistrants = await db.select({
      id: webinarRegistrants.id,
      phone: webinarRegistrants.phone,
      name: webinarRegistrants.name,
    }).from(webinarRegistrants)
      .where(and(
        eq(webinarRegistrants.webinarId, webinarId),
        eq(webinarRegistrants.confirmationSmsSent, 0),
        eq(webinarRegistrants.optedOut, 0),
      ));

    if (pendingSmsRegistrants.length > 0) {
      // ═══ DEDUPLICATE BY PHONE ═══
      // Group registrants by normalized phone — only send ONE SMS per unique phone
      const phoneMap = new Map<string, typeof pendingSmsRegistrants>();
      for (const reg of pendingSmsRegistrants) {
        const normPhone = reg.phone.replace(/\D/g, "").slice(-10);
        if (!phoneMap.has(normPhone)) {
          phoneMap.set(normPhone, []);
        }
        phoneMap.get(normPhone)!.push(reg);
      }

      // Claims now happen per-phone inside the send loop below (conditional
      // UPDATE ... WHERE confirmationSmsSent = 0). A batch pre-mark here was
      // not atomic against a concurrent import cycle: both processes could
      // SELECT the same pending rows before either marked them.

      // Get the evergreen confirmation template from settings (not from the timed sequence)
      let confirmationTemplate = `Hey %FIRST_NAME%, you're confirmed for the Airbnb class. I'll send your join link here before we start. Save this number! - Inayah`;
      const [templateSetting] = await db.select({ settingValue: webinarSmsSettings.settingValue })
        .from(webinarSmsSettings)
        .where(eq(webinarSmsSettings.settingKey, "confirmation_sms_template"))
        .limit(1);
      if (templateSetting?.settingValue) {
        confirmationTemplate = templateSetting.settingValue;
      }

      console.log(`[Confirmation SMS] Sending to ${phoneMap.size} unique phone(s) (${pendingSmsRegistrants.length} rows) for webinar ${webinarId}`);
      let confirmSent = 0;
      let confirmFailed = 0;

      for (const [, registrants] of phoneMap) {
        // Deterministic owner row: the lowest id in the phone group.
        registrants.sort((a: any, b: any) => a.id - b.id);
        const registrant = registrants[0];
        const allIds = registrants.map((r: any) => r.id);
        const firstName = (registrant.name || "there").split(" ")[0];
        const personalizedMessage = confirmationTemplate.replace(/%FIRST_NAME%/g, firstName);

        // ═══ ATOMIC CLAIM ═══
        // Only the process whose UPDATE flips the owner row 0→1 sends to this
        // phone; concurrent cycles (heartbeat + cron, or two instances) lose
        // the claim and skip. Exactly-once without a cross-process mutex.
        const claim = await db.update(webinarRegistrants)
          .set({ confirmationSmsSent: 1, confirmationSmsAt: new Date() })
          .where(and(
            eq(webinarRegistrants.id, registrant.id),
            eq(webinarRegistrants.confirmationSmsSent, 0),
          ));
        if (((claim as any)[0]?.affectedRows ?? 0) === 0) continue;

        // Mark sibling duplicate rows for the same phone so they never re-queue.
        if (allIds.length > 1) {
          await db.update(webinarRegistrants)
            .set({ confirmationSmsSent: 1, confirmationSmsAt: new Date() })
            .where(sql`${webinarRegistrants.id} IN (${sql.raw(allIds.join(','))}) AND ${webinarRegistrants.confirmationSmsSent} = 0`);
        }

        try {
          const result = await sendSms(registrant.phone, personalizedMessage);
          if (result.success) {
            confirmSent++;
          } else {
            console.log(`[Confirmation SMS] Failed for ${registrant.phone}: ${result.error}`);
            // NEVER retry — all failures are treated as final to prevent spam loops.
            // The SMS was either delivered (queued by carrier/quiet hours) or permanently failed.
            // Retrying transient failures caused infinite send loops when messages were
            // queued during quiet hours and all delivered at once when the window opened.
            confirmFailed++;
          }
          // Rate limit: small delay between sends to avoid API throttling
          if (phoneMap.size > 5) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (err: any) {
          console.error(`[Confirmation SMS] Error sending to ${registrant.phone}:`, err.message);
          // DO NOT unmark — leave as sent=1 to prevent retry spam loops.
          // If the send truly failed, it's better to miss one SMS than spam dozens.
          confirmFailed++;
        }
      }
      console.log(`[Confirmation SMS] Done: ${confirmSent} sent, ${confirmFailed} failed`);

      // ═══ SIMPLETEXTING LIST SYNC ═══
      // After sending confirmations, add successfully-sent phones to the configured SimpleTexting list
      const listNameSetting = await db.select({ settingValue: webinarSmsSettings.settingValue })
        .from(webinarSmsSettings)
        .where(eq(webinarSmsSettings.settingKey, "simpletexting_list_name"))
        .limit(1);
      const listName = listNameSetting[0]?.settingValue;
      if (listName && confirmSent > 0) {
        const apiKey = ENV.simpletextingApiKey;
        if (apiKey) {
          console.log(`[SimpleTexting List] Adding ${confirmSent} contact(s) to list "${listName}"`);
          // Collect phones that were successfully sent
          for (const [normPhone, registrants] of phoneMap) {
            // Only add phones that got a successful SMS (check if confirmationSmsSent was set)
            const reg = registrants[0];
            const [checkRow] = await db.select({ confirmationSmsSent: webinarRegistrants.confirmationSmsSent })
              .from(webinarRegistrants)
              .where(eq(webinarRegistrants.id, reg.id))
              .limit(1);
            if (checkRow?.confirmationSmsSent !== 1) continue;

            try {
              const cleanPhone = reg.phone.replace(/[^\d]/g, "");
              const addRes = await fetch(`https://api-app2.simpletexting.com/v2/api/contact-lists/${encodeURIComponent(listName)}/contacts`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ contactPhoneOrId: cleanPhone }),
              });
              if (addRes.ok) {
                console.log(`[SimpleTexting List] Added ${cleanPhone} to "${listName}"`);
              } else {
                const errText = await addRes.text();
                console.log(`[SimpleTexting List] Failed to add ${cleanPhone}: ${addRes.status} ${errText}`);
              }
            } catch (err: any) {
              console.error(`[SimpleTexting List] Error adding ${reg.phone}:`, err.message);
            }
          }
        }
      }
    }
  }

  // ═══ AUTO-SEND CONFIRMATION EMAIL (runs independently of SMS) ═══
  // Send confirmation email to registrants who have an email and haven't received one yet.
  // This runs on EVERY cron cycle regardless of whether there are pending SMS.
  {
    const pendingEmailRegistrants = await db.select({
      id: webinarRegistrants.id,
      email: webinarRegistrants.email,
      name: webinarRegistrants.name,
    }).from(webinarRegistrants)
      .where(and(
        eq(webinarRegistrants.webinarId, webinarId),
        sql`${webinarRegistrants.email} IS NOT NULL AND ${webinarRegistrants.email} != ''`,
        eq(webinarRegistrants.optedOut, 0),
      ));

    // Check which ones already got a confirmation email via email_send_log
    const alreadySentEmails = new Set<number>();
    if (pendingEmailRegistrants.length > 0) {
      const sentLogs = await db.select({ registrantId: emailSendLog.registrantId })
        .from(emailSendLog)
        .where(and(
          eq(emailSendLog.webinarId, webinarId),
          eq(emailSendLog.emailType, "confirmation"),
        ));
      for (const log of sentLogs) alreadySentEmails.add(log.registrantId);
    }

    const needsEmail = pendingEmailRegistrants.filter(r => !alreadySentEmails.has(r.id));
    if (needsEmail.length > 0) {
      console.log(`[Confirmation Email] ${needsEmail.length} registrant(s) need a confirmation email for webinar ${webinarId}`);

      // Release claims stranded by a crashed process (pending > 15 min) so
      // those registrants become claimable again instead of being lost.
      await db.delete(emailSendLog).where(and(
        eq(emailSendLog.webinarId, webinarId),
        eq(emailSendLog.emailType, "confirmation"),
        eq(emailSendLog.status, "pending"),
        sql`${emailSendLog.sentAt} < ${new Date(Date.now() - 15 * 60 * 1000)}`,
      )).catch(() => {});

      // Fetch webinar schedule BEFORE claiming/sending: if WebinarJam is
      // unreachable we defer to the next cycle rather than email a wrong link.
      let cronEmailDay = "";
      let cronEmailDate = "";
      let cronEmailTime = "";
      let cronEmailJoinUrl = "";
      try {
        const details = await fetchWebinarJamDetails(webinarId, overrideApiKey);
        cronEmailJoinUrl = details.direct_live_room_url || details.registration_url || "";
        if (details.schedules?.length > 0) {
          const schedDate = new Date(details.schedules[0].date + ":00");
          cronEmailDay = schedDate.toLocaleDateString("en-US", { weekday: "long" });
          cronEmailDate = schedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
          const hours = schedDate.getHours();
          const minutes = schedDate.getMinutes();
          const ampm = hours >= 12 ? "PM" : "AM";
          const h = hours % 12 || 12;
          cronEmailTime = `${h}:${minutes.toString().padStart(2, "0")} ${ampm} ET`;
        }
      } catch (_) {}

      if (!cronEmailJoinUrl) {
        console.error(`[Confirmation Email] No join URL for webinar ${webinarId} — deferring ${needsEmail.length} email(s) to the next cycle instead of sending a wrong link`);
      }
      const confirmationSendList = cronEmailJoinUrl ? needsEmail : [];
      let emailSent = 0;
      let emailFailed = 0;
      for (const reg of confirmationSendList) {
        try {
          // ═══ ATOMIC CLAIM (unique index email_log_claim_uq) ═══
          // The INSERT is the lock: whichever process inserts this registrant's
          // 'confirmation' row owns the send; everyone else sees affectedRows 0.
          const claimRes = await db.insert(emailSendLog).values({
            webinarId,
            registrantId: reg.id,
            recipientEmail: reg.email!,
            recipientName: reg.name,
            channel: "hubspot_smtp" as const,
            emailType: "confirmation" as const,
            status: "pending" as const,
            errorMessage: null,
          }).onDuplicateKeyUpdate({ set: { id: sql`${emailSendLog.id}` } });
          if (((claimRes as any)[0]?.affectedRows ?? 0) !== 1) continue;

          const firstName = (reg.name || "there").split(" ")[0];
          const emailContent = buildWebinarEmail("confirmation", {
            firstName,
            webinarLink: cronEmailJoinUrl,
            callLink: "https://masterclass.coachinayah.com/turnkey-v2",
            webinarDay: cronEmailDay || undefined,
            webinarDate: cronEmailDate || undefined,
            webinarTime: cronEmailTime || undefined,
          });
          if (!emailContent) continue;
          const emailResult = await sendWebinarEmail({
            to: reg.email!,
            subject: emailContent.subject,
            html: emailContent.html,
          });
          // Update the pending log entry to sent/failed
          await db.update(emailSendLog)
            .set({
              status: emailResult.success ? "sent" : "failed",
              errorMessage: emailResult.error?.slice(0, 1000) || null,
            })
            .where(and(
              eq(emailSendLog.webinarId, webinarId),
              eq(emailSendLog.registrantId, reg.id),
              eq(emailSendLog.emailType, "confirmation"),
              eq(emailSendLog.status, "pending"),
            ))
            .catch(() => {});
          if (emailResult.success) emailSent++;
          else emailFailed++;
          // Rate limit: 100ms between sends
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          console.error(`[Confirmation Email] Error for ${reg.email}:`, err.message);
          // Mark as failed so it can be retried manually
          await db.update(emailSendLog)
            .set({ status: "failed", errorMessage: err.message?.slice(0, 1000) || "Unknown error" })
            .where(and(
              eq(emailSendLog.webinarId, webinarId),
              eq(emailSendLog.registrantId, reg.id),
              eq(emailSendLog.emailType, "confirmation"),
              eq(emailSendLog.status, "pending"),
            ))
            .catch(() => {});
          emailFailed++;
        }
      }
      console.log(`[Confirmation Email] Done: ${emailSent} sent, ${emailFailed} failed`);
    } else {
      console.log(`[Confirmation Email] No pending emails for webinar ${webinarId}`);
    }
  }


  // ═══ AUTO-REFRESH ATTENDANCE FOR EXISTING REGISTRANTS ═══════════════════════
  // On every cron cycle, update the attended status for all existing registrants
  // based on the latest data from WebinarJam. This catches people who join the
  // live room after they were initially imported.
  {
    let attendanceUpdated = 0;
    const attendanceMap = new Map<string, number>();
    for (const r of allRegistrants) {
      const rawPhone = r.phone_number || r.phone || "";
      const fullPhone = (r.phone_country_code || "") + rawPhone;
      const phone = normalizePhone(fullPhone);
      if (phone.length >= 7) {
        const attendedLive = r.attended_live === "Yes" || r.attended_live === 1 || r.attended_live === true;
        attendanceMap.set(phone, attendedLive ? 1 : 0);
      }
    }

    const existingForAttendance = await db.select({
      id: webinarRegistrants.id,
      phone: webinarRegistrants.phone,
      attended: webinarRegistrants.attended,
    }).from(webinarRegistrants)
      .where(eq(webinarRegistrants.webinarId, webinarId));

    for (const row of existingForAttendance) {
      const normalizedPhone = normalizePhone(row.phone);
      const newAttended = attendanceMap.get(normalizedPhone);
      if (newAttended !== undefined && newAttended !== row.attended) {
        await db.update(webinarRegistrants)
          .set({ attended: newAttended })
          .where(eq(webinarRegistrants.id, row.id));
        attendanceUpdated++;
      }
    }

    if (attendanceUpdated > 0) {
      console.log(`[Attendance Auto-Refresh] Updated ${attendanceUpdated} registrant(s) attendance for webinar ${webinarId}`);
    }
  }

  return {
    success: true,
    imported,
    skipped: allRegistrants.length - newRegistrants.length,
    total: allRegistrants.length,
  };
}

// ─── Cron: Auto-import registrants from selected webinar ────────────────────

let cronInterval: ReturnType<typeof setInterval> | null = null;

export async function startWebinarImportCron() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }

  // In heartbeat mode (production) imports run via POST /api/scheduled/webinar-import.
  // Arming an in-process interval here too would create a second concurrent importer
  // and duplicate confirmation sends — only FORCE_CRON instances may self-schedule.
  if (process.env.FORCE_CRON !== "true") {
    console.log("[WebinarSMS Cron] FORCE_CRON not set — in-process import cron disabled (heartbeat mode)");
    return;
  }

  const db = await getDb();
  if (!db) {
    console.log("[WebinarSMS Cron] Database unavailable, skipping cron setup");
    return;
  }

  const rows = await db.select().from(webinarSmsSettings);
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.settingKey] = row.settingValue;
  }

  const enabled = settings["cron_enabled"] === "true";
  const intervalMinutes = parseInt(settings["cron_interval_minutes"] || "3", 10);
  const webinarId = settings["selected_webinar_id"];
  const webinarName = settings["selected_webinar_name"] || "Unknown";
  const scheduleId = settings["selected_schedule_id"];

  // Load per-webinar API key from credentials table
  let perWebinarApiKey: string | undefined;
  if (webinarId) {
    const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, webinarId));
    perWebinarApiKey = credRow?.apiKey || undefined;
  }

  if (!enabled || !webinarId) {
    console.log(`[WebinarSMS Cron] Auto-import disabled or no webinar selected (enabled=${enabled}, webinarId=${webinarId})`);
    return;
  }

  console.log(`[WebinarSMS Cron] Starting auto-import every ${intervalMinutes} minutes for webinar "${webinarName}" (${webinarId})`);

  const runImport = async () => {
    let currentWebinarId = "";
    let currentWebinarName = "Unknown";
    try {
      const freshDb = await getDb();
      if (!freshDb) return;

      // Re-read settings from DB each run so we always use the latest webinar selection
      const freshRows = await freshDb.select().from(webinarSmsSettings);
      const freshSettings: Record<string, string> = {};
      for (const row of freshRows) {
        freshSettings[row.settingKey] = row.settingValue;
      }

      currentWebinarId = freshSettings["selected_webinar_id"] || "";
      currentWebinarName = freshSettings["selected_webinar_name"] || "Unknown";
      const currentScheduleId = freshSettings["selected_schedule_id"];

      if (!currentWebinarId) {
        console.log(`[WebinarSMS Cron] No webinar selected, skipping import`);
        return;
      }

      console.log(`[WebinarSMS Cron] Running auto-import for webinar "${currentWebinarName}" (${currentWebinarId})...`);

      // Re-fetch credentials each run in case they were updated
      const [freshCred] = await freshDb.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, currentWebinarId));
      const freshApiKey = freshCred?.apiKey || undefined;

      const result = await runWebinarImport(
        freshDb,
        currentWebinarId,
        currentWebinarName,
        currentScheduleId ? parseInt(currentScheduleId, 10) : undefined,
        freshApiKey
      );

      const now = new Date().toISOString();
      const resultStr = `[CRON] Imported ${result.imported}, skipped ${result.skipped} (total ${result.total}) at ${now}`;

      await freshDb.insert(webinarSmsSettings)
        .values({ settingKey: "last_auto_import_at", settingValue: now, description: "Timestamp of last auto-import" })
        .onDuplicateKeyUpdate({ set: { settingValue: now } });

      await freshDb.insert(webinarSmsSettings)
        .values({ settingKey: "last_auto_import_result", settingValue: resultStr, description: "Result of last auto-import" })
        .onDuplicateKeyUpdate({ set: { settingValue: resultStr } });

      console.log(`[WebinarSMS Cron] ${resultStr}`);
    } catch (err: any) {
      console.error(`[WebinarSMS Cron] Import failed:`, err.message);
      // ALERT: Notify owner of import failure
      notifyOwner({
        title: `⚠️ Webinar Import Cron Failed`,
        content: `The auto-import cron failed.\n\nError: ${err.message}\n\nWebinar: ${currentWebinarName} (${currentWebinarId})\nThis means new registrants are NOT being imported.`,
      }).catch(() => {});
    }
  };

  runImport();
  cronInterval = setInterval(runImport, intervalMinutes * 60 * 1000);
}

export async function restartWebinarImportCron() {
  await startWebinarImportCron();
}

/**
 * Exported function for Heartbeat HTTP cron handler.
 * Runs a single import cycle without managing intervals.
 * Returns a summary of what happened.
 */
export async function runScheduledImport(): Promise<{ imported: number; skipped: boolean; webinarId: string; webinarName: string }> {
  const freshDb = await getDb();
  if (!freshDb) return { imported: 0, skipped: true, webinarId: "", webinarName: "" };

  // Read settings from DB
  const freshRows = await freshDb.select().from(webinarSmsSettings);
  const freshSettings: Record<string, string> = {};
  for (const row of freshRows) {
    freshSettings[row.settingKey] = row.settingValue;
  }

  const currentWebinarId = freshSettings["selected_webinar_id"] || "";
  const currentWebinarName = freshSettings["selected_webinar_name"] || "Unknown";
  const currentScheduleIdStr = freshSettings["selected_schedule_id"];
  const currentScheduleId = currentScheduleIdStr ? parseInt(currentScheduleIdStr, 10) : undefined;
  const cronEnabled = freshSettings["cron_enabled"] === "true";

  if (!cronEnabled || !currentWebinarId) {
    return { imported: 0, skipped: true, webinarId: currentWebinarId, webinarName: currentWebinarName };
  }

  // Load per-webinar API key
  const [credRow] = await freshDb.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, currentWebinarId));
  const freshApiKey = credRow?.apiKey || undefined;

  const result = await runWebinarImport(
    freshDb,
    currentWebinarId,
    currentWebinarName,
    currentScheduleId,
    freshApiKey
  );

  // Update last import timestamp
  const now = new Date().toISOString();
  await freshDb.insert(webinarSmsSettings)
    .values({ settingKey: "last_auto_import_at", settingValue: now, description: "Last auto-import timestamp" })
    .onDuplicateKeyUpdate({ set: { settingValue: now } });

  const resultStr = `Imported ${result.imported} new registrants (total: ${result.total})`;
  await freshDb.insert(webinarSmsSettings)
    .values({ settingKey: "last_auto_import_result", settingValue: resultStr, description: "Result of last auto-import" })
    .onDuplicateKeyUpdate({ set: { settingValue: resultStr } });

  return { imported: result.imported, skipped: false, webinarId: currentWebinarId, webinarName: currentWebinarName };
}

// ─── Scheduled Message Dispatcher V2 ──────────────────────────────────────────
// Exact-time blast dispatch: look-ahead scheduler, atomic claim, 50-worker sliding window.
// See server/routers/sms-dispatcher-v2.ts for the full implementation.

/**
 * Helper: Get deduplicated recipients for a scheduled message based on its audience.
 */
async function getRecipientsForMessage(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, msg: { webinarId: string; audience: string }) {
  const conditions: any[] = [eq(webinarRegistrants.webinarId, msg.webinarId)];
  conditions.push(sql`(${webinarRegistrants.optedOut} = 0 OR ${webinarRegistrants.optedOut} IS NULL)`);

  if (msg.audience === "attended") {
    conditions.push(eq(webinarRegistrants.attended, 1));
  } else if (msg.audience === "not_attended") {
    conditions.push(sql`(${webinarRegistrants.attended} = 0 OR ${webinarRegistrants.attended} IS NULL)`);
  }

  const recipients = await db.select({
    id: webinarRegistrants.id,
    name: webinarRegistrants.name,
    email: webinarRegistrants.email,
    phone: webinarRegistrants.phone,
  }).from(webinarRegistrants).where(and(...conditions));

  // Dedup by phone
  const seenPhones = new Set<string>();
  const deduped: typeof recipients = [];
  for (const r of recipients) {
    const normalized = normalizePhone(r.phone);
    if (!seenPhones.has(normalized)) {
      seenPhones.add(normalized);
      deduped.push(r);
    }
  }
  return deduped;
}

// Initialize the V2 dispatcher with helper function references from this module
initDispatcherV2({
  sendSms,
  normalizePhone,
  renderMessage,
  hasUnfilledPlaceholders,
  fetchWebinarJamRegistrants,
  fetchWebinarJamDetails,
  getRecipientsForMessage,
  cancelledScheduledMessageIds,
});

/**
 * Start the SMS dispatcher (FORCE_CRON=true path).
 * Now delegates to V2 look-ahead scheduler.
 */
export const startSmsDispatcher = startSmsDispatcherV2;

/**
 * Exported function for Heartbeat HTTP cron handler.
 * Runs the look-ahead scheduler: arms timers, fires due messages, runs watchdog.
 */
export const runScheduledDispatch = runScheduledDispatchV2;

// ─── ICS Date Formatter ──────────────────────────────────────────────────────

/**
 * Format a Date object to ICS date-time format (UTC): YYYYMMDDTHHmmssZ
 */
function formatIcsDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDEPENDENT EMAIL DISPATCHER
// Fires HubSpot SMTP emails on their own 30s timer, completely decoupled from
// the SMS batch. This ensures emails go out even if the server restarts during
// a long SMS send.
// ═══════════════════════════════════════════════════════════════════════════════

let emailDispatcherInterval: ReturnType<typeof setInterval> | null = null;
let emailDispatcherRunning = false;

// Map from sequence name to email type (same as extendedEmailMap inside SMS dispatcher)
const EMAIL_SEQUENCE_MAP: Record<string, string> = {
  "Registration Confirmation": "confirmation",
  "2 Days Before Reminder": "2_days_before",
  "Day Before Reminder": "day_before",
  "Morning Of": "morning_of",
  "3 Hours Before": "3h",
  "1 Hour Warning": "1h",
  "15 Min Before": "15min",
  "Starting NOW": "starting_now",
  "No-Show Nudge": "no_show",
  "Thank You (Attended)": "thank_you",
  "Missed You (No-Show)": "missed_you",
  "Follow-Up CTA": "follow_up",
};

/**
 * Start the independent email dispatcher.
 * Checks every 30s for scheduled messages whose time has passed and sends
 * the corresponding HubSpot SMTP emails if they haven't been sent yet.
 * This is COMPLETELY INDEPENDENT of the SMS dispatcher.
 */
export async function startEmailDispatcher() {
  if (emailDispatcherInterval) {
    clearInterval(emailDispatcherInterval);
    emailDispatcherInterval = null;
  }

  console.log("[Email Dispatcher] Starting independent email dispatcher (every 30s)");

  const processScheduledEmails = async () => {
    if (emailDispatcherRunning) return;
    emailDispatcherRunning = true;
    try {
      const db = await getDb();
      if (!db) return;
      await dispatchDueEmailBlasts(db, "[Email Dispatcher]");
    } catch (err: any) {
      console.error("[Email Dispatcher] Critical error:", err.message);
    } finally {
      emailDispatcherRunning = false;
    }
  };

  // Run immediately, then every 30 seconds
  processScheduledEmails();
  emailDispatcherInterval = setInterval(processScheduledEmails, 30_000);
}

/**
 * Pull live attendance from WebinarJam and update the `attended` flag on every
 * matching registrant. Used to gate audience-filtered ("attended" /
 * "not_attended") sends so a no-show reminder never hits someone who watched
 * live, and vice-versa. Mirrors the SMS dispatcher's inline sync so both
 * channels decide from the same freshly-synced data.
 */
async function syncWebinarAttendanceForEmail(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  webinarId: string,
  overrideApiKey?: string,
): Promise<{ success: boolean; error?: string; updated: number }> {
  try {
    let allRegistrants: any[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 100) {
      const result = await fetchWebinarJamRegistrants(webinarId, undefined, page, overrideApiKey);
      allRegistrants = allRegistrants.concat(result.registrants);
      hasMore = result.hasMore;
      page++;
    }

    const attendanceMap = new Map<string, number>();
    for (const r of allRegistrants) {
      const rawPhone = r.phone_number || r.phone || "";
      const fullPhone = (r.phone_country_code || "") + rawPhone;
      const phone = normalizePhone(fullPhone);
      if (phone.length >= 7) {
        const attendedLive = r.attended_live === "Yes" || r.attended_live === 1 || r.attended_live === true;
        attendanceMap.set(phone, attendedLive ? 1 : 0);
      }
    }

    const existing = await db.select({ id: webinarRegistrants.id, phone: webinarRegistrants.phone })
      .from(webinarRegistrants).where(eq(webinarRegistrants.webinarId, webinarId));

    let updated = 0;
    for (const row of existing) {
      const attended = attendanceMap.get(normalizePhone(row.phone));
      if (attended !== undefined) {
        await db.update(webinarRegistrants).set({ attended }).where(eq(webinarRegistrants.id, row.id));
        updated++;
      }
    }
    return { success: true, updated };
  } catch (err: any) {
    return { success: false, error: err?.message || "Unknown sync error", updated: 0 };
  }
}

// Email types whose templates hinge on the live join link. If WebinarJam can't
// give us the link, the blast is deferred to the next tick (inside the 1-hour
// send window) rather than sent with a broken or wrong-webinar link.
const EMAIL_TYPES_NEEDING_JOIN_LINK = new Set([
  "confirmation", "2_days_before", "day_before", "morning_of",
  "3h", "1h", "15min", "starting_now", "no_show",
]);

// Claims stuck 'pending' longer than this are treated as a crashed process and
// released so the blast can resume.
const EMAIL_PENDING_STALE_MS = 15 * 60 * 1000;

/**
 * Single shared implementation of scheduled email dispatch, used by BOTH the
 * FORCE_CRON setInterval path and the heartbeat HTTP path. Concurrency safety
 * comes from the DB, not from in-memory flags:
 *   - each recipient's send is claimed via INSERT under the unique index
 *     email_log_claim_uq (webinarId, registrantId, emailType) — whichever
 *     process inserts the row owns that recipient, so overlapping dispatchers
 *     (or two server instances) can never double-send;
 *   - a registrantId=0 marker row records blast completion; until it exists,
 *     later ticks keep looking for unclaimed/stranded recipients, which makes
 *     a crash mid-blast resumable instead of silently dropping the remainder.
 */
async function dispatchDueEmailBlasts(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  logTag: string,
): Promise<number> {
  const now = new Date();
  const staleThresholdMs = 60 * 60 * 1000; // 1 hour — emails can fire up to 1h late

  const dueMessages = await db.select().from(scheduledSmsMessages)
    .where(
      and(
        lte(scheduledSmsMessages.scheduledAt, now),
        ne(scheduledSmsMessages.status, "cancelled"),
      )
    )
    .orderBy(scheduledSmsMessages.scheduledAt);

  let processed = 0;

  for (const msg of dueMessages) {
    const emailType = EMAIL_SEQUENCE_MAP[msg.sequenceName];
    if (!emailType) continue;

    const scheduledTime = new Date(msg.scheduledAt).getTime();
    if (now.getTime() - scheduledTime > staleThresholdMs) continue;

    const logEmailType = `post_${emailType}`;

    // Blast-completion marker (registrantId = 0). Absent → keep working.
    const [marker] = await db.select({ cnt: count() })
      .from(emailSendLog)
      .where(and(
        eq(emailSendLog.webinarId, msg.webinarId),
        eq(emailSendLog.emailType, logEmailType),
        eq(emailSendLog.registrantId, 0),
      ));
    if (marker && marker.cnt > 0) continue;

    try {
      // Release claims stranded by a crashed process so those recipients are
      // picked up again instead of being lost.
      await db.delete(emailSendLog).where(and(
        eq(emailSendLog.webinarId, msg.webinarId),
        eq(emailSendLog.emailType, logEmailType),
        eq(emailSendLog.status, "pending"),
        sql`${emailSendLog.sentAt} < ${new Date(Date.now() - EMAIL_PENDING_STALE_MS)}`,
      )).catch(() => {});

      const settingRows = await db.select().from(webinarSmsSettings);
      const settings: Record<string, string> = {};
      for (const row of settingRows) settings[row.settingKey] = row.settingValue;
      const replayUrl = settings["replay_url"] || "";

      let joinUrl = "";
      let webinarDay = "";
      let webinarDate = "";
      let webinarTime = "";
      try {
        const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, msg.webinarId));
        const perWebinarApiKey = credRow?.apiKey || undefined;
        const details = await fetchWebinarJamDetails(msg.webinarId, perWebinarApiKey);
        joinUrl = details.direct_live_room_url || details.registration_url || "";
        if (details.schedules?.length > 0) {
          const schedDate = new Date(details.schedules[0].date + ":00");
          webinarDay = schedDate.toLocaleDateString("en-US", { weekday: "long" });
          webinarDate = schedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
          const hours = schedDate.getHours();
          const minutes = schedDate.getMinutes();
          const ampm = hours >= 12 ? "PM" : "AM";
          const h = hours % 12 || 12;
          webinarTime = `${h}:${minutes.toString().padStart(2, "0")} ${ampm} ET`;
        }
      } catch (_) {}

      if (EMAIL_TYPES_NEEDING_JOIN_LINK.has(emailType) && !joinUrl) {
        console.error(`${logTag} ${emailType}: WebinarJam details unavailable — deferring to next tick rather than sending without a join link`);
        continue;
      }

      // ═══ ATTENDANCE SYNC — gate audience-filtered emails on fresh data ═══
      // "attended"/"not_attended" emails must never fire from stale flags: a
      // no-show email hitting someone who watched live (or vice-versa) is worse
      // than a short delay. Sync from WebinarJam first; if the sync fails, or a
      // no-show blast still sees zero confirmed attendees, defer within the
      // 1-hour window rather than emailing the wrong audience.
      if (msg.audience === "attended" || msg.audience === "not_attended") {
        const [credRow2] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, msg.webinarId));
        const syncApiKey = credRow2?.apiKey || undefined;
        const sync = await syncWebinarAttendanceForEmail(db, msg.webinarId, syncApiKey);

        const elapsed = Date.now() - scheduledTime;
        const MAX_RETRY_WINDOW = 60 * 60 * 1000; // 1 hour

        if (!sync.success) {
          if (elapsed < MAX_RETRY_WINDOW) {
            console.error(`${logTag} ${emailType}: attendance sync failed (${sync.error}) — deferring (${Math.round(elapsed / 60000)}min / 60min)`);
            continue;
          }
          console.error(`${logTag} ${emailType}: attendance sync still failing after 60min — skipping to avoid emailing the wrong audience`);
          notifyOwner({
            title: `🚨 Email Blocked: ${msg.sequenceName}`,
            content: `Attendance sync failed for over an hour; "${msg.audience}" emails were NOT sent to avoid reaching the wrong people. Error: ${sync.error}`,
          }).catch(() => {});
          await db.insert(emailSendLog).values({
            webinarId: msg.webinarId, registrantId: 0, recipientEmail: "__attendance_sync_failed__",
            recipientName: null, channel: "hubspot_smtp", emailType: logEmailType,
            status: "failed", errorMessage: `Attendance sync failed: ${sync.error}`,
          }).catch(() => {});
          continue;
        }

        if (msg.audience === "not_attended") {
          const [attendedCount] = await db.select({ cnt: count() }).from(webinarRegistrants)
            .where(and(eq(webinarRegistrants.webinarId, msg.webinarId), eq(webinarRegistrants.attended, 1)));
          if (Number(attendedCount?.cnt ?? 0) === 0 && elapsed < MAX_RETRY_WINDOW) {
            console.log(`${logTag} ${emailType}: 0 confirmed attendees yet — deferring no-show emails (${Math.round(elapsed / 60000)}min / 60min)`);
            continue;
          }
        }
      }

      const utmJoinUrl = joinUrl ? `${joinUrl}${joinUrl.includes("?") ? "&" : "?"}utm_source=email&utm_medium=${emailType}&utm_campaign=webinar_${emailType}` : "";

      // Get email recipients (with audience filtering)
      const emailConditions: any[] = [
        eq(webinarRegistrants.webinarId, msg.webinarId),
        sql`${webinarRegistrants.email} IS NOT NULL AND ${webinarRegistrants.email} != ''`,
        sql`(${webinarRegistrants.optedOut} = 0 OR ${webinarRegistrants.optedOut} IS NULL)`,
      ];
      if (msg.audience === "attended") {
        emailConditions.push(eq(webinarRegistrants.attended, 1));
      } else if (msg.audience === "not_attended") {
        emailConditions.push(sql`(${webinarRegistrants.attended} = 0 OR ${webinarRegistrants.attended} IS NULL)`);
      }

      const emailRecipients = await db.select({
        id: webinarRegistrants.id,
        name: webinarRegistrants.name,
        email: webinarRegistrants.email,
      }).from(webinarRegistrants).where(and(...emailConditions));

      if (emailRecipients.length === 0) {
        // ZERO-RECIPIENT RETRY for attended/not_attended audiences
        if (msg.audience === "attended" || msg.audience === "not_attended") {
          const elapsed = Date.now() - scheduledTime;
          const MAX_RETRY_WINDOW = 60 * 60 * 1000; // 1 hour
          if (elapsed < MAX_RETRY_WINDOW) {
            console.log(`${logTag} ${emailType}: 0 recipients for "${msg.audience}" — retrying (${Math.round(elapsed / 60000)}min / 60min max)`);
            continue;
          }
        }
        console.log(`${logTag} ${emailType}: 0 recipients, skipping`);
        // Marker row (registrantId=0) so we don't re-check this blast
        await db.insert(emailSendLog).values({
          webinarId: msg.webinarId,
          registrantId: 0,
          recipientEmail: "__no_recipients__",
          recipientName: null,
          channel: "hubspot_smtp",
          emailType: logEmailType,
          status: "sent",
          errorMessage: "No recipients found",
        }).catch(() => {});
        continue;
      }

      // ═══ ATOMIC PER-RECIPIENT CLAIM (unique index email_log_claim_uq) ═══
      // The INSERT is the lock: only recipients whose row this process created
      // are ours to email. Everyone already claimed/sent is skipped for free.
      const claimed: typeof emailRecipients = [];
      for (const r of emailRecipients) {
        try {
          const res = await db.insert(emailSendLog).values({
            webinarId: msg.webinarId,
            registrantId: r.id,
            recipientEmail: r.email!,
            recipientName: r.name,
            channel: "hubspot_smtp" as const,
            emailType: logEmailType,
            status: "pending" as const,
          }).onDuplicateKeyUpdate({ set: { id: sql`${emailSendLog.id}` } });
          if (((res as any)[0]?.affectedRows ?? 0) === 1) claimed.push(r);
        } catch (_) { /* lost the claim */ }
      }

      if (claimed.length > 0) {
        console.log(`${logTag} Firing ${emailType} emails for webinar ${msg.webinarId} — ${claimed.length}/${emailRecipients.length} recipients claimed by this process`);

        // Send emails — PARALLEL batches of 10 concurrent SMTP sends
        let sent = 0;
        let failed = 0;
        const errors: string[] = [];
        const EMAIL_BATCH_SIZE = 10;

        for (let i = 0; i < claimed.length; i += EMAIL_BATCH_SIZE) {
          const batch = claimed.slice(i, i + EMAIL_BATCH_SIZE);

          const batchResults = await Promise.all(batch.map(async (recipient) => {
            const emailContent = buildWebinarEmail(emailType, {
              firstName: recipient.name?.split(" ")[0] || "",
              webinarLink: utmJoinUrl || joinUrl,
              replayUrl: replayUrl || undefined,
              callLink: "https://masterclass.coachinayah.com/turnkey-v2",
              webinarDay: webinarDay || undefined,
              webinarDate: webinarDate || undefined,
              webinarTime: webinarTime || undefined,
            });

            if (!emailContent) return { recipient, result: { success: false, error: "No email content" } as any };

            const result = await sendWebinarEmail({
              to: recipient.email!,
              subject: emailContent.subject,
              html: emailContent.html,
            });

            return { recipient, result };
          }));

          // Update logs for each result
          for (const { recipient, result } of batchResults) {
            await db.update(emailSendLog)
              .set({
                status: result.success ? "sent" : "failed",
                errorMessage: result.error?.slice(0, 1000) || null,
                messageId: result.messageId || null,
              })
              .where(and(
                eq(emailSendLog.webinarId, msg.webinarId),
                eq(emailSendLog.registrantId, recipient.id),
                eq(emailSendLog.emailType, logEmailType),
                eq(emailSendLog.status, "pending"),
              ));

            if (result.success) {
              sent++;
            } else {
              failed++;
              errors.push(`${recipient.email}: ${result.error}`);
            }
          }
        }

        console.log(`${logTag} ${emailType}: ${sent} sent, ${failed} failed (${claimed.length} claimed)`);
        processed++;

        // Alert on failures
        if (failed > 0) {
          notifyOwner({
            title: `⚠️ Email Failures: ${msg.sequenceName}`,
            content: `${failed}/${claimed.length} HubSpot emails failed for "${emailType}".\nErrors: ${errors.slice(0, 3).join("; ")}`,
          }).catch(() => {});
        }

        // Alert on success
        if (sent > 0 && failed === 0) {
          notifyOwner({
            title: `✅ Emails Sent: ${msg.sequenceName}`,
            content: `Successfully sent ${sent} ${emailType} emails via HubSpot SMTP.`,
          }).catch(() => {});
        }
      }

      // Mark the blast done once no in-flight claims remain (ours or another
      // process's). Until then, later ticks keep checking for stragglers —
      // this is what makes a crash mid-blast resumable.
      const [pendingLeft] = await db.select({ cnt: count() })
        .from(emailSendLog)
        .where(and(
          eq(emailSendLog.webinarId, msg.webinarId),
          eq(emailSendLog.emailType, logEmailType),
          eq(emailSendLog.status, "pending"),
        ));
      if ((pendingLeft?.cnt ?? 0) === 0) {
        await db.insert(emailSendLog).values({
          webinarId: msg.webinarId,
          registrantId: 0,
          recipientEmail: "__blast_done__",
          recipientName: null,
          channel: "hubspot_smtp",
          emailType: logEmailType,
          status: "sent",
          errorMessage: null,
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error(`${logTag} Error sending ${emailType} emails: ${err.message}`);
      notifyOwner({
        title: `🚨 Email Dispatch Failed: ${msg.sequenceName}`,
        content: `Failed to send ${emailType} emails: ${err.message}`,
      }).catch(() => {});
    }
  }

  return processed;
}

/**
 * Exported function for Heartbeat HTTP cron handler.
 * Runs a single email dispatch cycle — finds due messages and sends emails.
 * This is the production email dispatch path when Heartbeat is active.
 */
export async function runScheduledEmailDispatch(): Promise<{ processed: number; skipped: boolean }> {
  // If the setInterval email dispatcher is already running (FORCE_CRON=true),
  // let it handle dispatch. Per-recipient DB claims make an overlap harmless,
  // but there is no point scanning twice in one process.
  if (emailDispatcherInterval) {
    console.log(`[Email Dispatch Heartbeat] setInterval dispatcher is active, delegating`);
    return { processed: 0, skipped: true };
  }

  if (emailDispatcherRunning) {
    return { processed: 0, skipped: true };
  }

  emailDispatcherRunning = true;
  try {
    const db = await getDb();
    if (!db) {
      return { processed: 0, skipped: true };
    }
    const processed = await dispatchDueEmailBlasts(db, "[Email Dispatch Heartbeat]");
    return { processed, skipped: false };
  } finally {
    emailDispatcherRunning = false;
  }
}

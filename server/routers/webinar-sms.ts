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
import { sendBulkReminderEmails, sendReminderEmail, checkGmailHealth, buildWebinarReminderEmail } from "../gmail-reminders";

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
    
    // Error responses
    const errorMsg = data.message || data.errorMessage || data.error || JSON.stringify(data);
    return { success: false, error: `SimpleTexting error (${res.status}): ${errorMsg}` };
  } catch (err: any) {
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

// ─── Helper: Background campaign send processing ───────────────────────────

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

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
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
    status: failedCount === recipients.length ? "failed" : sentCount === 0 ? "failed" : "completed",
    completedAt: new Date(),
  }).where(eq(webinarSmsCampaigns.id, campaignId));

  console.log(`[WebinarSMS] Campaign ${campaignId} completed: ${sentCount} sent, ${failedCount} failed out of ${recipients.length}`);
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const webinarSmsRouter = router({

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
      cronIntervalMinutes: parseInt(settings["cron_interval_minutes"] || "30", 10),
      lastAutoImportAt: settings["last_auto_import_at"] || null,
      lastAutoImportResult: settings["last_auto_import_result"] || null,
      // Per-webinar credentials from dedicated table
      webinarApiKey: creds.apiKey,
      webinarHash: creds.webinarHash,
      webinarMemberId: creds.memberId,
      webinarIntegrationId: creds.integrationWebinarId,
      webinarApiKeyConfigured: !!creds.apiKey,
      webinarHashConfigured: !!creds.webinarHash,
      // Calendar settings
      calendarAutoSend: true, // Always on — cannot be disabled
      calendarEventName: settings["calendar_event_name"] || DEFAULT_CALENDAR_EVENT_NAME,
      calendarEventDescription: settings["calendar_event_description"] || DEFAULT_CALENDAR_DESCRIPTION,
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
      intervalMinutes: z.number().min(5).max(1440).default(30),
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

      await db.update(scheduledSmsMessages).set({ status: "cancelled" })
        .where(eq(scheduledSmsMessages.id, input.id));
      return { success: true };
    }),

  /** Generate a pre-built SMS sequence for a webinar */
  generateSequence: adminProcedure
    .input(z.object({
      webinarId: z.string().min(1),
      webinarDate: z.string(), // ISO date string of the webinar
      webinarLink: z.string().optional(),
      replayLink: z.string().optional(),
      // Customizable timing offsets (in minutes before/after webinar)
      // Negative = before webinar, Positive = after webinar
      timing: z.object({
        registrationConfirm: z.number().default(-10080), // -7 days
        twoDaysBefore: z.number().default(-2880),        // -2 days
        dayBefore: z.number().default(-1440),             // -1 day
        morningOf: z.number().default(-240),              // -4 hours
        oneHourWarning: z.number().default(-60),          // -1 hour
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

      // Use custom timing or defaults
      const t = {
        registrationConfirm: input.timing?.registrationConfirm ?? -10080,
        twoDaysBefore: input.timing?.twoDaysBefore ?? -2880,
        dayBefore: input.timing?.dayBefore ?? -1440,
        morningOf: input.timing?.morningOf ?? -240,
        oneHourWarning: input.timing?.oneHourWarning ?? -60,
        goingLiveNow: input.timing?.goingLiveNow ?? -5,
        noShowNudge: input.timing?.noShowNudge ?? 10,
        thankYouAttended: input.timing?.thankYouAttended ?? 60,
        missedYouNoShow: input.timing?.missedYouNoShow ?? 120,
        followUpCta: input.timing?.followUpCta ?? 1440,
      };

      // Helper: offset in minutes from webinar date
      const offset = (minutes: number) => new Date(webinarDate.getTime() + minutes * 60 * 1000);

      // Pre-built 9-message sequence with customizable timing
      const sequence = [
        {
          sequenceName: "Registration Confirmation",
          sequenceOrder: 1,
          messageBody: `Hey %FIRST_NAME%! Thanks for registering for our live workshop. Save this number so you don't miss any updates! 🎯`,
          scheduledAt: offset(t.registrationConfirm),
          audience: "all" as const,
        },
        {
          sequenceName: "2 Days Before Reminder",
          sequenceOrder: 2,
          messageBody: `Hey %FIRST_NAME%! Quick reminder — our live call is in 2 days. You won't want to miss this one. Mark your calendar! 📅\n\nJoin here: ${link}`,
          scheduledAt: offset(t.twoDaysBefore),
          audience: "all" as const,
        },
        {
          sequenceName: "Day Before Reminder",
          sequenceOrder: 3,
          messageBody: `%FIRST_NAME%, our call is TOMORROW! Show up early to guarantee your seat — we have a lot of people registered. See you there! 🔥\n\nJoin here: ${link}`,
          scheduledAt: offset(t.dayBefore),
          audience: "all" as const,
        },
        {
          sequenceName: "Morning Of",
          sequenceOrder: 4,
          messageBody: `Good morning %FIRST_NAME%! Today's the day. Our call is happening TODAY. Be there early — seats fill up fast! 💪\n\nJoin here: ${link}`,
          scheduledAt: offset(t.morningOf),
          audience: "all" as const,
        },
        {
          sequenceName: "1 Hour Warning",
          sequenceOrder: 5,
          messageBody: `%FIRST_NAME% — we're starting in 1 HOUR! Get ready and show up 10 min early. Join here: ${link}`,
          scheduledAt: offset(t.oneHourWarning),
          audience: "all" as const,
        },
        {
          sequenceName: "Starting NOW",
          sequenceOrder: 6,
          messageBody: `🔴 WE'RE LIVE! %FIRST_NAME%, join now before we get started: ${link}`,
          scheduledAt: offset(t.goingLiveNow),
          audience: "all" as const,
        },
        {
          sequenceName: "No-Show Nudge",
          sequenceOrder: 7,
          messageBody: `%FIRST_NAME%, we started and I don't see you in here! There's still time to jump in — join now: ${link}`,
          scheduledAt: offset(t.noShowNudge),
          audience: "not_attended" as const,
        },
        {
          sequenceName: "Thank You (Attended)",
          sequenceOrder: 8,
          messageBody: `Thanks for showing up today %FIRST_NAME%! 🙏 Here's the replay if you want to rewatch: ${replay}`,
          scheduledAt: offset(t.thankYouAttended),
          audience: "attended" as const,
        },
        {
          sequenceName: "Missed You (No-Show)",
          sequenceOrder: 9,
          messageBody: `Hey %FIRST_NAME%, we missed you today! No worries — I saved the replay for you: ${replay}`,
          scheduledAt: offset(t.missedYouNoShow),
          audience: "not_attended" as const,
        },
        {
          sequenceName: "Follow-Up CTA",
          sequenceOrder: 10,
          messageBody: `%FIRST_NAME%, did you catch the call? If you're ready to take the next step, reply YES and I'll send you the details. 🚀`,
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
6. Use emojis sparingly (1-2 max)
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
      const timezone = details.timezone || "America/Los_Angeles";
      const startTime = scheduleDate; // Keep as string, e.g. "2026-03-11 19:00"

      // Use custom settings if configured
      const settingRows = await db.select().from(webinarSmsSettings);
      const allSettings: Record<string, string> = {};
      for (const row of settingRows) allSettings[row.settingKey] = row.settingValue;
      const eventName = allSettings["calendar_event_name"] || DEFAULT_CALENDAR_EVENT_NAME;
      const eventDescription = allSettings["calendar_event_description"] || DEFAULT_CALENDAR_DESCRIPTION;

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

      const timezone = details.timezone || "America/Los_Angeles";
      // Pass raw schedule date string — DO NOT convert through new Date()
      const startTime = scheduleDate; // e.g. "2026-03-11 19:00"

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
        title: DEFAULT_CALENDAR_EVENT_NAME,
        description: DEFAULT_CALENDAR_DESCRIPTION,
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
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

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

      const logs = await db
        .select()
        .from(emailSendLog)
        .where(eq(emailSendLog.webinarId, input.webinarId))
        .orderBy(desc(emailSendLog.sentAt))
        .limit(input.limit);

      // Aggregate stats
      const stats = {
        total: logs.length,
        sent: logs.filter((l) => l.status === "sent").length,
        failed: logs.filter((l) => l.status === "failed").length,
        byType: {} as Record<string, { sent: number; failed: number }>,
        byChannel: {} as Record<string, { sent: number; failed: number }>,
      };

      for (const log of logs) {
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

      return {
        logs: logs.map((l) => ({
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
        stats,      };
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
async function autoSendCalendarInvites(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  webinarId: string,
  newRegistrantEmails: Array<{ id: number; email: string; name: string }>,
  overrideApiKey?: string
): Promise<{ sent: number; failed: number }> {
  if (newRegistrantEmails.length === 0) return { sent: 0, failed: 0 };

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

  const timezone = details.timezone || "America/Los_Angeles";
  // Pass the raw schedule date string — DO NOT convert through new Date()
  // new Date("2026-03-11 19:00:00") parses as UTC, causing a 4-5 hour offset
  const startTime = scheduleDate; // Keep as string, e.g. "2026-03-11 19:00"

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

async function runWebinarImport(
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
  const intervalMinutes = parseInt(settings["cron_interval_minutes"] || "30", 10);
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
    try {
      const freshDb = await getDb();
      if (!freshDb) return;

      // Re-read settings from DB each run so we always use the latest webinar selection
      const freshRows = await freshDb.select().from(webinarSmsSettings);
      const freshSettings: Record<string, string> = {};
      for (const row of freshRows) {
        freshSettings[row.settingKey] = row.settingValue;
      }

      const currentWebinarId = freshSettings["selected_webinar_id"];
      const currentWebinarName = freshSettings["selected_webinar_name"] || "Unknown";
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
    }
  };

  runImport();
  cronInterval = setInterval(runImport, intervalMinutes * 60 * 1000);
}

export async function restartWebinarImportCron() {
  await startWebinarImportCron();
}

// ─── Scheduled Message Dispatcher ──────────────────────────────────────────
// Runs every 30 seconds, picks up pending messages whose scheduledAt <= now,
// sends them via SimpleTexting, and updates status/counts.

let smsDispatcherInterval: ReturnType<typeof setInterval> | null = null;
let smsDispatcherRunning = false; // Mutex to prevent concurrent dispatch runs

export async function startSmsDispatcher() {
  if (smsDispatcherInterval) {
    clearInterval(smsDispatcherInterval);
    smsDispatcherInterval = null;
  }

  console.log("[SMS Dispatcher] Starting scheduled message dispatcher (every 30s)");

  // ─── STARTUP RECOVERY ───────────────────────────────────────────────────────
  // Recover messages stuck in "sending" state from previous server runs.
  // These messages were marked "sending" but the process was interrupted before
  // the final status update. Reset them to "pending" so they get retried.
  // IMPORTANT: This MUST complete before the first processScheduledMessages() runs
  // to prevent race conditions where recovery resets a message while dispatch is
  // already sending it (causing duplicate sends).
  try {
    const db = await getDb();
    if (db) {
      const staleThresholdMs = 30 * 60 * 1000; // 30 minutes
      const now = new Date();
      const stuckMessages = await db.select().from(scheduledSmsMessages)
        .where(eq(scheduledSmsMessages.status, "sending"));

      for (const msg of stuckMessages) {
        const scheduledTime = new Date(msg.scheduledAt).getTime();
        const age = now.getTime() - scheduledTime;

        if (age <= staleThresholdMs) {
          // Within window — reset to pending for retry
          console.log(`[SMS Dispatcher] RECOVERY: Resetting stuck message #${msg.id} "${msg.sequenceName}" from "sending" back to "pending" (was stuck for ${Math.round(age / 60000)}min)`);
          await db.update(scheduledSmsMessages)
            .set({ status: "pending" })
            .where(eq(scheduledSmsMessages.id, msg.id));
        } else {
          // Too old — mark as failed
          console.log(`[SMS Dispatcher] RECOVERY: Marking stale stuck message #${msg.id} "${msg.sequenceName}" as failed (stuck for ${Math.round(age / 60000)}min, > 30min threshold)`);
          await db.update(scheduledSmsMessages)
            .set({ status: "failed", error: `Message was stuck in 'sending' state for ${Math.round(age / 60000)} minutes. Server likely restarted during send.`, sentAt: new Date() })
            .where(eq(scheduledSmsMessages.id, msg.id));
        }
      }

      if (stuckMessages.length > 0) {
        console.log(`[SMS Dispatcher] RECOVERY: Processed ${stuckMessages.length} stuck message(s)`);
      }
    }
  } catch (err: any) {
    console.error("[SMS Dispatcher] RECOVERY error:", err.message);
  }
  // ─── END STARTUP RECOVERY ──────────────────────────────────────────────────

  const processScheduledMessages = async () => {
    // Mutex: prevent concurrent dispatch runs.
    // If a previous run is still sending (e.g., 341 recipients takes > 30s),
    // skip this tick to avoid duplicate sends.
    if (smsDispatcherRunning) {
      console.log("[SMS Dispatcher] Previous run still in progress, skipping this tick");
      return;
    }
    smsDispatcherRunning = true;

    const db = await getDb();
    if (!db) {
      smsDispatcherRunning = false;
      return;
    }

    try {
      // Find pending messages whose scheduled time has passed
      const now = new Date();
      const dueMessages = await db.select().from(scheduledSmsMessages)
        .where(
          and(
            eq(scheduledSmsMessages.status, "pending"),
            lte(scheduledSmsMessages.scheduledAt, now)
          )
        )
        .orderBy(scheduledSmsMessages.scheduledAt);

      if (dueMessages.length === 0) {
        smsDispatcherRunning = false;
        return;
      }

      console.log(`[SMS Dispatcher] Found ${dueMessages.length} due message(s) to send`);

      for (const msg of dueMessages) {
        // Skip messages that are more than 30 minutes past their scheduled time
        // These are stale (e.g., from a previous webinar or server was down)
        const staleThresholdMs = 30 * 60 * 1000; // 30 minutes
        const scheduledTime = new Date(msg.scheduledAt).getTime();
        if (now.getTime() - scheduledTime > staleThresholdMs) {
          console.log(`[SMS Dispatcher] Skipping stale message #${msg.id} "${msg.sequenceName}" (scheduled ${Math.round((now.getTime() - scheduledTime) / 60000)}min ago, > 30min threshold)`);
          await db.update(scheduledSmsMessages)
            .set({ status: "cancelled", sentAt: new Date() })
            .where(eq(scheduledSmsMessages.id, msg.id));
          continue;
        }

        // Mark as sending immediately to prevent double-processing
        await db.update(scheduledSmsMessages)
          .set({ status: "sending" })
          .where(eq(scheduledSmsMessages.id, msg.id));

        console.log(`[SMS Dispatcher] Processing message #${msg.id} "${msg.sequenceName}" (audience: ${msg.audience})`);

        try {
          // ═══════════════════════════════════════════════════════════════════
          // HARD RULES for attendance-targeted messages (attended / not_attended)
          // These rules prevent sending to the wrong audience.
          // ═══════════════════════════════════════════════════════════════════
          if (msg.audience === "attended" || msg.audience === "not_attended") {
            console.log(`[SMS Dispatcher] HARD RULE: Message #${msg.id} targets "${msg.audience}" — forcing attendance sync from WebinarJam before sending`);

            // RULE 1: Force a fresh attendance sync from WebinarJam
            let syncSuccess = false;
            let syncError = "";
            try {
              const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, msg.webinarId));
              const perWebinarApiKey = credRow?.apiKey || undefined;

              let allRegistrants: any[] = [];
              let page = 1;
              let hasMore = true;
              while (hasMore && page <= 100) {
                const result = await fetchWebinarJamRegistrants(msg.webinarId, undefined, page, perWebinarApiKey);
                allRegistrants = allRegistrants.concat(result.registrants);
                hasMore = result.hasMore;
                page++;
              }

              // Build phone -> attendance map and update DB
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
                .from(webinarRegistrants)
                .where(eq(webinarRegistrants.webinarId, msg.webinarId));

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

              console.log(`[SMS Dispatcher] HARD RULE: Attendance sync complete — updated ${updated}/${existing.length} registrants from WebinarJam (${allRegistrants.length} found in API)`);
              syncSuccess = true;
            } catch (err: any) {
              syncError = err.message || "Unknown sync error";
              console.error(`[SMS Dispatcher] HARD RULE: Attendance sync FAILED for webinar ${msg.webinarId}: ${syncError}`);
            }

            // RULE 2: If sync failed, DO NOT send — mark as failed
            if (!syncSuccess) {
              console.error(`[SMS Dispatcher] HARD RULE BLOCK: Message #${msg.id} "${msg.sequenceName}" BLOCKED — attendance sync failed. Cannot verify who attended. Error: ${syncError}`);
              await db.update(scheduledSmsMessages).set({
                status: "failed",
                error: `HARD RULE: Attendance sync failed — cannot verify audience. Error: ${syncError}`,
                sentAt: new Date(),
              }).where(eq(scheduledSmsMessages.id, msg.id));
              continue;
            }

            // RULE 3: For not_attended messages, require at least 1 confirmed attendee
            // If nobody is marked as attended, WebinarJam likely hasn't reported attendance yet.
            // Sending a "no-show nudge" when we can't confirm anyone attended = spamming attendees.
            if (msg.audience === "not_attended") {
              const [attendedCount] = await db.select({ count: count() })
                .from(webinarRegistrants)
                .where(
                  and(
                    eq(webinarRegistrants.webinarId, msg.webinarId),
                    eq(webinarRegistrants.attended, 1)
                  )
                );
              const confirmedAttendees = Number(attendedCount?.count ?? 0);

              if (confirmedAttendees === 0) {
                console.error(`[SMS Dispatcher] HARD RULE BLOCK: Message #${msg.id} "${msg.sequenceName}" BLOCKED — 0 confirmed attendees found. WebinarJam may not have reported attendance yet. Refusing to treat everyone as no-shows.`);
                await db.update(scheduledSmsMessages).set({
                  status: "failed",
                  error: `HARD RULE: 0 confirmed attendees — attendance data not yet available from WebinarJam. Message blocked to prevent sending to actual attendees.`,
                  sentAt: new Date(),
                }).where(eq(scheduledSmsMessages.id, msg.id));
                continue;
              }

              console.log(`[SMS Dispatcher] HARD RULE PASS: ${confirmedAttendees} confirmed attendee(s) found — attendance data is valid. Proceeding with not_attended filter.`);
            }
          }
          // ═══════════════════════════════════════════════════════════════════
          // END HARD RULES
          // ═══════════════════════════════════════════════════════════════════

          // Get recipients based on audience
          const conditions: any[] = [eq(webinarRegistrants.webinarId, msg.webinarId)];
          // Exclude opted-out registrants
          conditions.push(sql`(${webinarRegistrants.optedOut} = 0 OR ${webinarRegistrants.optedOut} IS NULL)`);

          if (msg.audience === "attended") {
            conditions.push(eq(webinarRegistrants.attended, 1));
          } else if (msg.audience === "not_attended") {
            conditions.push(sql`(${webinarRegistrants.attended} = 0 OR ${webinarRegistrants.attended} IS NULL)`);
          }
          // audience === "all" → no extra filter

          const recipients = await db.select({
            id: webinarRegistrants.id,
            name: webinarRegistrants.name,
            email: webinarRegistrants.email,
            phone: webinarRegistrants.phone,
          }).from(webinarRegistrants).where(and(...conditions));

          if (recipients.length === 0) {
            console.log(`[SMS Dispatcher] Message #${msg.id}: No recipients found for audience "${msg.audience}", marking as sent with 0 count`);
            await db.update(scheduledSmsMessages).set({
              status: "sent",
              sentCount: 0,
              failedCount: 0,
              sentAt: new Date(),
            }).where(eq(scheduledSmsMessages.id, msg.id));
            // Still create a campaign record for visibility
            await db.insert(webinarSmsCampaigns).values({
              name: `[Sequence] ${msg.sequenceName}`,
              messageBody: msg.messageBody,
              filterCriteria: { audience: msg.audience, webinarId: msg.webinarId, source: "sequence", scheduledMessageId: msg.id } as Record<string, unknown>,
              totalRecipients: 0,
              sentCount: 0,
              failedCount: 0,
              status: "completed",
              completedAt: new Date(),
            });
            continue;
          }

          // Create campaign record BEFORE sending so it shows up in history immediately
          const audienceLabel = msg.audience === "attended" ? "Attended" : msg.audience === "not_attended" ? "No-Shows" : "Everyone";
          const [campaignResult] = await db.insert(webinarSmsCampaigns).values({
            name: `[Sequence] ${msg.sequenceName}`,
            messageBody: msg.messageBody,
            filterCriteria: { audience: msg.audience, webinarId: msg.webinarId, source: "sequence", scheduledMessageId: msg.id, audienceLabel } as Record<string, unknown>,
            totalRecipients: recipients.length,
            sentCount: 0,
            failedCount: 0,
            status: "sending",
          });
          const campaignId = campaignResult.insertId;

          console.log(`[SMS Dispatcher] Message #${msg.id}: Sending to ${recipients.length} recipients (campaign #${campaignId})`);

          let sentCount = 0;
          let failedCount = 0;
          const BATCH_UPDATE_INTERVAL = 25; // Update DB counts every 25 sends

          for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            const personalizedMessage = renderMessage(msg.messageBody, {
              name: recipient.name.split(" ")[0],
              fullname: recipient.name,
              email: recipient.email || "",
            });

            const result = await sendSms(normalizePhone(recipient.phone), personalizedMessage);

            if (result.success) {
              sentCount++;
            } else {
              failedCount++;
              console.warn(`[SMS Dispatcher] Failed to send to ${recipient.phone}: ${result.error}`);
            }

            // Track individual delivery — wrapped in try/catch so one failed
            // DB insert doesn't kill the entire batch
            try {
              await db.insert(webinarSmsDeliveries).values({
                campaignId,
                registrantId: recipient.id,
                phone: recipient.phone,
                deliveryStatus: result.success ? "sent" : "failed",
                externalMessageId: result.success ? (result.smsId || null) : null,
                error: result.success ? null : (result.error || "Unknown error"),
              });
            } catch (deliveryErr: any) {
              console.warn(`[SMS Dispatcher] Failed to track delivery for ${recipient.phone}: ${deliveryErr.message}`);
            }

            // Update counts incrementally every BATCH_UPDATE_INTERVAL sends
            // This ensures counts are persisted even if the process crashes mid-batch
            if ((i + 1) % BATCH_UPDATE_INTERVAL === 0 || i === recipients.length - 1) {
              try {
                await db.update(webinarSmsCampaigns).set({
                  sentCount,
                  failedCount,
                }).where(eq(webinarSmsCampaigns.id, campaignId));
                await db.update(scheduledSmsMessages).set({
                  sentCount,
                  failedCount,
                }).where(eq(scheduledSmsMessages.id, msg.id));
              } catch (updateErr: any) {
                console.warn(`[SMS Dispatcher] Failed to update incremental counts: ${updateErr.message}`);
              }
            }

            // Small delay between sends to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 150));
          }

          // Final update: mark campaign and message as completed
          await db.update(webinarSmsCampaigns).set({
            sentCount,
            failedCount,
            status: failedCount === recipients.length ? "failed" : "completed",
            completedAt: new Date(),
          }).where(eq(webinarSmsCampaigns.id, campaignId));

          await db.update(scheduledSmsMessages).set({
            status: failedCount === recipients.length ? "failed" : "sent",
            sentCount,
            failedCount,
            sentAt: new Date(),
          }).where(eq(scheduledSmsMessages.id, msg.id));

          console.log(`[SMS Dispatcher] Message #${msg.id} "${msg.sequenceName}" completed: ${sentCount} sent, ${failedCount} failed (campaign #${campaignId})`);
          console.log(`[SMS Dispatcher] Campaign #${campaignId} created in Campaign History`);

          // ═══════════════════════════════════════════════════════════════════
          // MULTI-CHANNEL: Fire Calendar Updates + Gmail Reminders alongside SMS
          // Maps specific SMS sequence names to reminder types
          // ═══════════════════════════════════════════════════════════════════
          const reminderTypeMap: Record<string, "24h" | "1h" | "starting"> = {
            "Day Before Reminder": "24h",
            "2 Days Before Reminder": "24h",  // Also treat 2-day as 24h reminder
            "1 Hour Warning": "1h",
            "Starting NOW": "starting",
          };

          const reminderType = reminderTypeMap[msg.sequenceName];
          if (reminderType) {
            console.log(`[Multi-Channel] SMS "${msg.sequenceName}" maps to reminder type "${reminderType}" — firing Calendar + Gmail reminders`);

            // Fire in background so it doesn't block the SMS dispatcher loop
            (async () => {
              try {
                // Get settings for event name and join URL
                const settingRows = await db.select().from(webinarSmsSettings);
                const settings: Record<string, string> = {};
                for (const row of settingRows) settings[row.settingKey] = row.settingValue;
                const eventName = settings["calendar_event_name"] || DEFAULT_CALENDAR_EVENT_NAME;

                // Get webinar details for join URL
                let joinUrl = "";
                try {
                  const [credRow] = await db.select().from(webinarCredentials).where(eq(webinarCredentials.webinarId, msg.webinarId));
                  const perWebinarApiKey = credRow?.apiKey || undefined;
                  const details = await fetchWebinarJamDetails(msg.webinarId, perWebinarApiKey);
                  joinUrl = details.direct_live_room_url || details.registration_url || "";
                } catch (e: any) {
                  console.warn(`[Multi-Channel] Could not fetch webinar details for join URL: ${e.message}`);
                }

                // UTM-tagged join URL
                const utmJoinUrl = joinUrl ? `${joinUrl}${joinUrl.includes("?") ? "&" : "?"}utm_source=multi_channel&utm_medium=${reminderType}&utm_campaign=webinar_reminder` : "";

                // 1) Calendar Event Updates
                try {
                  const calResult = await sendCalendarReminderUpdates(msg.webinarId, reminderType, utmJoinUrl || undefined);
                  console.log(`[Multi-Channel] Calendar update for "${reminderType}": ${calResult.updated} updated, ${calResult.failed} failed`);

                  // Log to email_send_log
                  if (calResult.updated > 0) {
                    await db.insert(emailSendLog).values({
                      webinarId: msg.webinarId,
                      registrantId: null,
                      recipientEmail: `(${calResult.updated} calendar events)`,
                      recipientName: "Bulk Calendar Update",
                      channel: "calendar",
                      reminderType,
                      status: calResult.failed === 0 ? "sent" : "partial",
                      error: calResult.errors.length > 0 ? calResult.errors.join("; ").slice(0, 1000) : null,
                      triggeredBy: "sms_dispatcher",
                    });
                  }
                } catch (calErr: any) {
                  console.error(`[Multi-Channel] Calendar update failed: ${calErr.message}`);
                  await db.insert(emailSendLog).values({
                    webinarId: msg.webinarId,
                    registrantId: null,
                    recipientEmail: "(calendar update)",
                    recipientName: "Calendar Update",
                    channel: "calendar",
                    reminderType,
                    status: "failed",
                    error: calErr.message?.slice(0, 1000),
                    triggeredBy: "sms_dispatcher",
                  }).catch(() => {});
                }

                // 2) Gmail Reminder Emails — send to all registrants with email
                try {
                  const emailRecipients = await db.select({
                    id: webinarRegistrants.id,
                    name: webinarRegistrants.name,
                    email: webinarRegistrants.email,
                  }).from(webinarRegistrants).where(
                    and(
                      eq(webinarRegistrants.webinarId, msg.webinarId),
                      sql`${webinarRegistrants.email} IS NOT NULL AND ${webinarRegistrants.email} != ''`,
                      sql`(${webinarRegistrants.optedOut} = 0 OR ${webinarRegistrants.optedOut} IS NULL)`
                    )
                  );

                  if (emailRecipients.length > 0) {
                    // Get schedule date for email content
                    let eventDate = "";
                    try {
                      const details2 = await fetchWebinarJamDetails(msg.webinarId);
                      if (details2.schedules?.length > 0) {
                        const d = new Date(details2.schedules[0].date + ":00");
                        eventDate = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
                      }
                    } catch (_) {}

                    const gmailResult = await sendBulkReminderEmails(
                      emailRecipients.map(r => ({ email: r.email!, name: r.name })),
                      (recipient) => buildWebinarReminderEmail(
                        recipient.name,
                        recipient.email,
                        reminderType,
                        eventName,
                        utmJoinUrl || joinUrl,
                        eventDate
                      )
                    );

                    console.log(`[Multi-Channel] Gmail ${reminderType}: ${gmailResult.sent} sent, ${gmailResult.failed} failed`);

                    // Log each send to email_send_log
                    for (const recipient of emailRecipients) {
                      const wasError = gmailResult.errors.find(e => e.includes(recipient.email!));
                      await db.insert(emailSendLog).values({
                        webinarId: msg.webinarId,
                        registrantId: recipient.id,
                        recipientEmail: recipient.email!,
                        recipientName: recipient.name,
                        channel: "gmail",
                        reminderType,
                        status: wasError ? "failed" : "sent",
                        error: wasError ? wasError.slice(0, 1000) : null,
                        triggeredBy: "sms_dispatcher",
                      }).catch(() => {});
                    }
                  }
                } catch (gmailErr: any) {
                  console.error(`[Multi-Channel] Gmail send failed: ${gmailErr.message}`);
                  await db.insert(emailSendLog).values({
                    webinarId: msg.webinarId,
                    registrantId: null,
                    recipientEmail: "(bulk gmail)",
                    recipientName: "Gmail Bulk Send",
                    channel: "gmail",
                    reminderType,
                    status: "failed",
                    error: gmailErr.message?.slice(0, 1000),
                    triggeredBy: "sms_dispatcher",
                  }).catch(() => {});
                }

              } catch (multiErr: any) {
                console.error(`[Multi-Channel] Error in multi-channel dispatch: ${multiErr.message}`);
              }
            })();
          }
          // ═══════════════════════════════════════════════════════════════════
          // END MULTI-CHANNEL
          // ═══════════════════════════════════════════════════════════════════

        } catch (err: any) {
          console.error(`[SMS Dispatcher] Error processing message #${msg.id}:`, err.message);
          await db.update(scheduledSmsMessages).set({
            status: "failed",
            sentAt: new Date(),
          }).where(eq(scheduledSmsMessages.id, msg.id));
        }
      }
    } catch (err: any) {
      console.error("[SMS Dispatcher] Error in dispatch loop:", err.message);
    } finally {
      smsDispatcherRunning = false;
    }
  };

  // Run immediately on startup, then every 30 seconds
  processScheduledMessages();
  smsDispatcherInterval = setInterval(processScheduledMessages, 30_000);
}

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

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
} from "../../drizzle/schema";
import { eq, desc, sql, and, inArray, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// ─── Helper: SimpleTexting API ───────────────────────────────────────────────

async function sendSms(phone: string, message: string): Promise<{ success: boolean; smsId?: string; error?: string }> {
  const apiKey = ENV.simpletextingApiKey;
  if (!apiKey) {
    return { success: false, error: "SimpleTexting API key not configured" };
  }

  try {
    const body = new URLSearchParams({ phone, message });
    const res = await fetch("https://app2.simpletexting.com/v1/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: body.toString(),
    });

    const data = await res.json();
    if (data.code === 1) {
      return { success: true, smsId: data.smsid };
    }
    return { success: false, error: data.message || "Unknown SimpleTexting error" };
  } catch (err: any) {
    console.error("[WebinarSMS] SimpleTexting send error:", err.message);
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
  page: number = 1
): Promise<{ registrants: any[]; hasMore: boolean }> {
  const apiKey = ENV.webinarjamApiKey;
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
    const registrants = data.registrants || [];
    return { registrants, hasMore: registrants.length >= 50 };
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: data.message || "Failed to fetch registrants" });
}

async function fetchWebinarJamDetails(webinarId: string): Promise<any> {
  const apiKey = ENV.webinarjamApiKey;
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

// ─── Helper: Template variable replacement ───────────────────────────────────

function renderMessage(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
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
      const [result] = await db.insert(webinarRegistrants).values({
        name: input.name,
        email: input.email,
        phone: normalizedPhone,
        source: "manual",
        webinarName: input.webinarName,
        tags: input.tags,
      });

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

      let allRegistrants: any[] = [];
      let page = 1;
      let hasMore = true;

      // Paginate through all registrants
      while (hasMore && page <= 100) {
        const result = await fetchWebinarJamRegistrants(input.webinarId, input.scheduleId, page);
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
          const phone = normalizePhone(r.phone || r.phone_country_code + r.phone || "");
          return phone.length >= 7 && !existingPhones.has(phone);
        })
        .map(r => ({
          webinarId: input.webinarId,
          name: [r.first_name, r.last_name].filter(Boolean).join(" ") || "Unknown",
          email: r.email || null,
          phone: normalizePhone(r.phone || (r.phone_country_code || "") + (r.phone || "")),
          source: "webinarjam" as const,
          webinarName: input.webinarName,
          attended: r.attended_live === 1 ? 1 : 0,
          metadata: {
            signup_date: r.signup_date,
            attended_live: r.attended_live,
            attended_replay: r.attended_replay,
            time_live: r.time_live,
            utm_source: r.utm_source,
          },
        }));

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
      messageBody: z.string().min(1).max(320),
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

      // Send messages (fire-and-forget pattern with tracking)
      let sentCount = 0;
      let failedCount = 0;

      for (const recipient of recipients) {
        const personalizedMessage = renderMessage(input.messageBody, {
          name: recipient.name.split(" ")[0], // First name
          fullname: recipient.name,
          email: recipient.email || "",
        });

        const result = await sendSms(normalizePhone(recipient.phone), personalizedMessage);

        // Record delivery
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

        // Small delay between sends to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Update campaign with final counts
      await db.update(webinarSmsCampaigns).set({
        sentCount,
        failedCount,
        status: failedCount === recipients.length ? "failed" : "completed",
        completedAt: new Date(),
      }).where(eq(webinarSmsCampaigns.id, campaignId));

      return {
        success: true,
        campaignId,
        totalRecipients: recipients.length,
        sent: sentCount,
        failed: failedCount,
      };
    }),

  /** Send a single test SMS to verify configuration */
  sendTestSms: adminProcedure
    .input(z.object({
      phone: z.string().min(7),
      message: z.string().min(1).max(320),
    }))
    .mutation(async ({ input }) => {
      const result = await sendSms(normalizePhone(input.phone), input.message);
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

  // ═══ ZAPIER WEBHOOK RECEIVER ═══════════════════════════════════════════════

  /** Receive registrant data from Zapier webhook */
  zapierWebhook: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().optional(),
      phone: z.string().min(7),
      webinarId: z.string().optional(),
      webinarName: z.string().optional(),
      attended: z.number().optional(),
      tags: z.array(z.string()).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [result] = await db.insert(webinarRegistrants).values({
        name: input.name,
        email: input.email,
        phone: normalizePhone(input.phone),
        source: "zapier",
        webinarId: input.webinarId,
        webinarName: input.webinarName,
        attended: input.attended ?? 0,
        tags: input.tags,
        metadata: input.metadata,
      });

      return { success: true, id: result.insertId };
    }),
});

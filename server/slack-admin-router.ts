/**
 * Slack Admin Router
 * 
 * Admin-only endpoints for sending existing property reports to client Slack channels.
 * 
 * Features:
 * - Dynamic channel search across the entire Slack workspace
 * - Fetch existing reports (shared_reports + universal_shareable_reports)
 * - Generate AI deal summary via Gemini as an opportunity pitch
 * - Post report link + AI summary to any channel via Slack MCP
 * - Track all deliveries in slack_report_deliveries table
 * - Batch send to multiple channels at once
 * - Delivery history with filtering
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { sharedReports, universalShareableReports, slackReportDeliveries } from "../drizzle/schema";
import { desc, eq, like, and, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

/**
 * Admin-only procedure that checks if the user has admin role
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have admin access",
    });
  }
  return next({ ctx });
});

// ============================================
// TYPES
// ============================================

interface SlackChannel {
  id: string;
  name: string;
  purpose?: string;
  created?: string;
}

interface ReportSummary {
  id: number;
  shareCode: string;
  reportType: string;
  address: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  title: string | null;
  annualRevenue: number | null;
  occupancyRate: string | null;
  averageDailyRate: number | null;
  verdict: string | null;
  createdAt: Date | null;
  source: "shared" | "universal";
  shareUrl: string;
}

// ============================================
// HELPER: Parse Slack channel search results
// ============================================

function parseSlackChannelResults(rawText: string): SlackChannel[] {
  const channels: SlackChannel[] = [];
  
  // Parse the markdown-formatted results from Slack MCP
  const resultBlocks = rawText.split(/###\s+Result\s+\d+\s+of\s+\d+/);
  
  for (const block of resultBlocks) {
    if (!block.trim()) continue;
    
    const nameMatch = block.match(/Name:\s*#?([\w-]+)/);
    const permalinkMatch = block.match(/archives\/(C[\w]+)/);
    const createdMatch = block.match(/Created:\s*(.+)/);
    const purposeMatch = block.match(/Purpose:\s*(.+)/);
    
    if (nameMatch && permalinkMatch) {
      channels.push({
        id: permalinkMatch[1],
        name: nameMatch[1],
        purpose: purposeMatch?.[1]?.trim(),
        created: createdMatch?.[1]?.trim(),
      });
    }
  }
  
  return channels;
}

// ============================================
// HELPER: Search Slack channels via MCP CLI
// ============================================

async function searchSlackChannels(query: string, cursor?: string): Promise<{ channels: SlackChannel[]; nextCursor?: string }> {
  const { execSync } = await import("child_process");
  
  try {
    const inputObj: Record<string, any> = {
      query,
      channel_types: "public_channel,private_channel",
      limit: 20,
    };
    if (cursor) {
      inputObj.cursor = cursor;
    }
    
    const cmd = `manus-mcp-cli tool call slack_search_channels --server slack --input '${JSON.stringify(inputObj)}'`;
    const output = execSync(cmd, { 
      encoding: "utf-8", 
      timeout: 15000,
      cwd: "/home/ubuntu/rental-calculator"
    });
    
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[SlackAdmin] Could not parse MCP output");
      return { channels: [] };
    }
    
    const result = JSON.parse(jsonMatch[0]);
    const channels = parseSlackChannelResults(result.results || "");
    
    let nextCursor: string | undefined;
    if (result.pagination_info && result.pagination_info.includes("cursor")) {
      const cursorMatch = result.pagination_info.match(/cursor\s+`([^`]+)`/);
      if (cursorMatch) {
        nextCursor = cursorMatch[1];
      }
    }
    
    return { channels, nextCursor };
  } catch (error) {
    console.error("[SlackAdmin] Error searching Slack channels:", error);
    return { channels: [] };
  }
}

// ============================================
// HELPER: Post message to Slack via MCP CLI
// ============================================

async function postToSlackChannel(channelId: string, message: string): Promise<{ success: boolean; permalink?: string; error?: string }> {
  const { execSync } = await import("child_process");
  
  try {
    const inputObj = {
      channel_id: channelId,
      message,
    };
    
    const cmd = `manus-mcp-cli tool call slack_send_message --server slack --input '${JSON.stringify(inputObj).replace(/'/g, "'\\''")}'`;
    const output = execSync(cmd, { 
      encoding: "utf-8", 
      timeout: 30000,
      cwd: "/home/ubuntu/rental-calculator"
    });
    
    if (output.includes("error") && output.includes("not_in_channel")) {
      return { success: false, error: "Bot is not in this channel. Please invite the bot first." };
    }
    
    const permalinkMatch = output.match(/https:\/\/coachinayah\.slack\.com\/archives\/[^\s)]+/);
    
    return { 
      success: true, 
      permalink: permalinkMatch?.[0] 
    };
  } catch (error: any) {
    console.error("[SlackAdmin] Error posting to Slack:", error?.message);
    return { success: false, error: error?.message || "Failed to post to Slack" };
  }
}

// ============================================
// HELPER: Generate AI deal summary via Gemini
// ============================================

async function generateDealSummary(reportData: {
  address: string;
  bedrooms?: number;
  bathrooms?: number | string;
  annualRevenue?: number;
  occupancyRate?: number | string;
  averageDailyRate?: number;
  verdict?: string;
  reportType: string;
  extraData?: any;
}): Promise<string> {
  try {
    const occRate = typeof reportData.occupancyRate === 'string' 
      ? parseFloat(reportData.occupancyRate) 
      : reportData.occupancyRate;
    const occPct = occRate && occRate <= 1 ? Math.round(occRate * 100) : occRate ? Math.round(occRate) : null;
    const monthlyRev = reportData.annualRevenue ? Math.round(reportData.annualRevenue / 12) : null;
    
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are Coach Inayah's deal advisor. Write a short, compelling Slack message (3-5 sentences max) presenting a property as an investment opportunity to a client.

Rules:
- Write in a warm, direct, conversational tone — like you're texting a friend about a great deal
- Lead with the most exciting number (revenue, occupancy, or daily rate)
- Keep it simple — no jargon, no complex terms
- End with something encouraging that makes them want to click the report link
- Do NOT use emojis
- Do NOT use bullet points — write in flowing sentences
- Do NOT give investment advice or say "you should buy this"
- Present the data as an opportunity worth looking at, not a recommendation`
        },
        {
          role: "user",
          content: `Write a deal summary for this property:

Address: ${reportData.address}
${reportData.bedrooms ? `Bedrooms: ${reportData.bedrooms}` : ''}
${reportData.bathrooms ? `Bathrooms: ${reportData.bathrooms}` : ''}
${reportData.annualRevenue ? `Annual Revenue Estimate: $${reportData.annualRevenue.toLocaleString()}` : ''}
${monthlyRev ? `Monthly Revenue: $${monthlyRev.toLocaleString()}` : ''}
${occPct ? `Occupancy Rate: ${occPct}%` : ''}
${reportData.averageDailyRate ? `Average Daily Rate: $${reportData.averageDailyRate}` : ''}
${reportData.verdict ? `Analysis Verdict: ${reportData.verdict}` : ''}
Report Type: ${reportData.reportType}`
        }
      ],
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) return "";
    
    const content = typeof rawContent === 'string' 
      ? rawContent 
      : rawContent.map(part => 'text' in part ? part.text : '').join('');
    
    return content.trim();
  } catch (error) {
    console.error("[SlackAdmin] Error generating deal summary:", error);
    return "";
  }
}

// ============================================
// HELPER: Build the Slack message for a report
// ============================================

function buildReportSlackMessage(params: {
  reportUrl: string;
  address: string;
  dealSummary: string;
  customMessage?: string;
}): string {
  const { reportUrl, address, dealSummary, customMessage } = params;
  
  const encodedAddr = encodeURIComponent(address);
  const zillowUrl = `https://www.zillow.com/homes/${encodedAddr}_rb/`;
  const redfinUrl = `https://www.redfin.com/search#query=${encodedAddr}`;

  let message = "";
  
  if (customMessage?.trim()) {
    message += `${customMessage.trim()}\n\n---\n\n`;
  }
  
  message += `${dealSummary}\n\n`;
  message += `*<${reportUrl}|View Full Report>*\n\n`;
  message += `<${zillowUrl}|Zillow> | <${redfinUrl}|Redfin>\n\n`;
  message += `_Sent by Coach Inayah's Turnkey Tool_`;

  return message;
}

// ============================================
// HELPER: Record delivery in DB
// ============================================

async function recordDelivery(params: {
  sentByUserId?: number;
  sentByName?: string;
  channelId: string;
  channelName?: string;
  shareCode: string;
  reportSource: string;
  address?: string;
  reportType?: string;
  dealSummary?: string;
  customMessage?: string;
  status: "sent" | "failed" | "pending";
  slackPermalink?: string;
  errorMessage?: string;
  batchId?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    
    await db.insert(slackReportDeliveries).values({
      sentByUserId: params.sentByUserId,
      sentByName: params.sentByName,
      channelId: params.channelId,
      channelName: params.channelName,
      shareCode: params.shareCode,
      reportSource: params.reportSource,
      address: params.address,
      reportType: params.reportType,
      dealSummary: params.dealSummary,
      customMessage: params.customMessage,
      status: params.status,
      slackPermalink: params.slackPermalink,
      errorMessage: params.errorMessage,
      batchId: params.batchId,
    });
  } catch (error) {
    console.error("[SlackAdmin] Error recording delivery:", error);
  }
}

// ============================================
// ROUTER
// ============================================

export const slackAdminRouter = router({
  /**
   * Search Slack channels dynamically.
   */
  searchChannels: adminProcedure
    .input(z.object({
      query: z.string().default(""),
      cursor: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const result = await searchSlackChannels(input.query, input.cursor);
      return result;
    }),

  /**
   * Get existing reports that can be sent to Slack.
   */
  getReports: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const reports: ReportSummary[] = [];
      
      // Fetch from shared_reports (full property reports / Step 5)
      try {
        const sharedResults = await db.select({
          id: sharedReports.id,
          shareId: sharedReports.shareId,
          reportType: sharedReports.reportType,
          address: sharedReports.address,
          bedrooms: sharedReports.bedrooms,
          bathrooms: sharedReports.bathrooms,
          createdAt: sharedReports.createdAt,
        })
        .from(sharedReports)
        .orderBy(desc(sharedReports.createdAt))
        .limit(input.limit);
        
        for (const r of sharedResults) {
          if (input.search && r.address && !r.address.toLowerCase().includes(input.search.toLowerCase())) {
            continue;
          }
          reports.push({
            id: r.id,
            shareCode: r.shareId,
            reportType: r.reportType,
            address: r.address,
            bedrooms: r.bedrooms,
            bathrooms: r.bathrooms?.toString() || null,
            title: null,
            annualRevenue: null,
            occupancyRate: null,
            averageDailyRate: null,
            verdict: null,
            createdAt: r.createdAt,
            source: "shared",
            shareUrl: `/report/${r.shareId}`,
          });
        }
      } catch (e) {
        console.error("[SlackAdmin] Error fetching shared reports:", e);
      }
      
      // Fetch from universal_shareable_reports
      try {
        const universalResults = await db.select({
          id: universalShareableReports.id,
          shareCode: universalShareableReports.shareCode,
          reportType: universalShareableReports.reportType,
          address: universalShareableReports.address,
          bedrooms: universalShareableReports.bedrooms,
          bathrooms: universalShareableReports.bathrooms,
          title: universalShareableReports.title,
          annualRevenue: universalShareableReports.annualRevenue,
          occupancyRate: universalShareableReports.occupancyRate,
          averageDailyRate: universalShareableReports.averageDailyRate,
          verdict: universalShareableReports.verdict,
          createdAt: universalShareableReports.createdAt,
        })
        .from(universalShareableReports)
        .orderBy(desc(universalShareableReports.createdAt))
        .limit(input.limit);
        
        for (const r of universalResults) {
          if (input.search && r.address && !r.address.toLowerCase().includes(input.search.toLowerCase())) {
            continue;
          }
          reports.push({
            id: r.id,
            shareCode: r.shareCode,
            reportType: r.reportType,
            address: r.address,
            bedrooms: r.bedrooms,
            bathrooms: r.bathrooms,
            title: r.title,
            annualRevenue: r.annualRevenue,
            occupancyRate: r.occupancyRate,
            averageDailyRate: r.averageDailyRate,
            verdict: r.verdict,
            createdAt: r.createdAt,
            source: "universal",
            shareUrl: `/share/${r.shareCode}`,
          });
        }
      } catch (e) {
        console.error("[SlackAdmin] Error fetching universal reports:", e);
      }
      
      // Sort all reports by createdAt descending
      reports.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      return { reports: reports.slice(0, input.limit) };
    }),

  /**
   * Generate an AI deal summary for a report.
   */
  generateSummary: adminProcedure
    .input(z.object({
      address: z.string(),
      bedrooms: z.number().optional(),
      bathrooms: z.number().optional(),
      annualRevenue: z.number().optional(),
      occupancyRate: z.number().optional(),
      averageDailyRate: z.number().optional(),
      verdict: z.string().optional(),
      reportType: z.string().default("property"),
    }))
    .mutation(async ({ input }) => {
      const summary = await generateDealSummary({
        address: input.address,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        annualRevenue: input.annualRevenue,
        occupancyRate: input.occupancyRate,
        averageDailyRate: input.averageDailyRate,
        verdict: input.verdict,
        reportType: input.reportType,
      });
      
      return { summary };
    }),

  /**
   * Send a report to a single Slack channel.
   * Posts the report link + AI deal summary + optional custom message.
   * Records delivery in the tracking table.
   */
  sendReport: adminProcedure
    .input(z.object({
      channelId: z.string().min(1, "Channel ID is required"),
      channelName: z.string().optional(),
      shareCode: z.string().min(1, "Report share code is required"),
      reportSource: z.enum(["shared", "universal"]),
      address: z.string().min(1, "Property address is required"),
      reportType: z.string().optional(),
      dealSummary: z.string().min(1, "Deal summary is required"),
      customMessage: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { channelId, channelName, shareCode, reportSource, address, reportType, dealSummary, customMessage } = input;

      console.log(`[SlackAdmin] Sending report ${shareCode} for "${address}" to channel ${channelId} (${channelName})`);

      // Build the report URL
      const baseUrl = ENV.isProduction
        ? "https://coachinayahturnkeytool.com"
        : "http://localhost:3000";
      
      const reportUrl = reportSource === "shared"
        ? `${baseUrl}/report/${shareCode}`
        : `${baseUrl}/share/${shareCode}`;

      // Build the Slack message
      const message = buildReportSlackMessage({
        reportUrl,
        address,
        dealSummary,
        customMessage,
      });

      // Post to Slack via MCP
      const result = await postToSlackChannel(channelId, message);

      // Record delivery
      await recordDelivery({
        sentByUserId: ctx.user.id,
        sentByName: ctx.user.name || undefined,
        channelId,
        channelName,
        shareCode,
        reportSource,
        address,
        reportType,
        dealSummary,
        customMessage,
        status: result.success ? "sent" : "failed",
        slackPermalink: result.permalink,
        errorMessage: result.error,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to post message to Slack",
        });
      }

      return {
        success: true,
        channelId,
        channelName,
        address,
        permalink: result.permalink,
      };
    }),

  /**
   * Batch send a report to multiple Slack channels.
   * Posts the same report + deal summary to each selected channel.
   * Records each delivery individually with a shared batchId.
   */
  batchSendReport: adminProcedure
    .input(z.object({
      channels: z.array(z.object({
        id: z.string(),
        name: z.string().optional(),
      })).min(1, "At least one channel is required"),
      shareCode: z.string().min(1, "Report share code is required"),
      reportSource: z.enum(["shared", "universal"]),
      address: z.string().min(1, "Property address is required"),
      reportType: z.string().optional(),
      dealSummary: z.string().min(1, "Deal summary is required"),
      customMessage: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { channels, shareCode, reportSource, address, reportType, dealSummary, customMessage } = input;
      const batchId = randomBytes(12).toString("hex");

      console.log(`[SlackAdmin] Batch send (${batchId}): report ${shareCode} to ${channels.length} channels`);

      // Build the report URL
      const baseUrl = ENV.isProduction
        ? "https://coachinayahturnkeytool.com"
        : "http://localhost:3000";
      
      const reportUrl = reportSource === "shared"
        ? `${baseUrl}/report/${shareCode}`
        : `${baseUrl}/share/${shareCode}`;

      // Build the Slack message
      const message = buildReportSlackMessage({
        reportUrl,
        address,
        dealSummary,
        customMessage,
      });

      // Send to each channel sequentially (to avoid rate limits)
      const results: Array<{
        channelId: string;
        channelName?: string;
        success: boolean;
        permalink?: string;
        error?: string;
      }> = [];

      for (const channel of channels) {
        const result = await postToSlackChannel(channel.id, message);
        
        results.push({
          channelId: channel.id,
          channelName: channel.name,
          success: result.success,
          permalink: result.permalink,
          error: result.error,
        });

        // Record each delivery
        await recordDelivery({
          sentByUserId: ctx.user.id,
          sentByName: ctx.user.name || undefined,
          channelId: channel.id,
          channelName: channel.name,
          shareCode,
          reportSource,
          address,
          reportType,
          dealSummary,
          customMessage,
          status: result.success ? "sent" : "failed",
          slackPermalink: result.permalink,
          errorMessage: result.error,
          batchId,
        });

        // Small delay between sends to avoid Slack rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return {
        batchId,
        totalChannels: channels.length,
        successCount,
        failCount,
        results,
      };
    }),

  /**
   * Get delivery history with optional filtering.
   */
  getDeliveryHistory: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      channelId: z.string().optional(),
      status: z.enum(["sent", "failed", "pending"]).optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const conditions = [];
      
      if (input.channelId) {
        conditions.push(eq(slackReportDeliveries.channelId, input.channelId));
      }
      if (input.status) {
        conditions.push(eq(slackReportDeliveries.status, input.status));
      }
      if (input.search) {
        conditions.push(like(slackReportDeliveries.address, `%${input.search}%`));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [deliveries, countResult] = await Promise.all([
        db.select()
          .from(slackReportDeliveries)
          .where(whereClause)
          .orderBy(desc(slackReportDeliveries.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ count: sql<number>`count(*)` })
          .from(slackReportDeliveries)
          .where(whereClause),
      ]);

      return {
        deliveries,
        total: countResult[0]?.count || 0,
        hasMore: (input.offset + input.limit) < (countResult[0]?.count || 0),
      };
    }),

  /**
   * Get delivery stats summary.
   */
  getDeliveryStats: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [stats] = await db.select({
        total: sql<number>`count(*)`,
        sent: sql<number>`sum(case when status = 'sent' then 1 else 0 end)`,
        failed: sql<number>`sum(case when status = 'failed' then 1 else 0 end)`,
        uniqueChannels: sql<number>`count(distinct channelId)`,
        uniqueReports: sql<number>`count(distinct shareCode)`,
      })
      .from(slackReportDeliveries);

      return {
        total: stats?.total || 0,
        sent: stats?.sent || 0,
        failed: stats?.failed || 0,
        uniqueChannels: stats?.uniqueChannels || 0,
        uniqueReports: stats?.uniqueReports || 0,
      };
    }),
});

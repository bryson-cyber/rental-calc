/**
 * Slack Admin Router
 * 
 * Admin-only endpoints for sending property reports to Slack channels.
 * Uses the Slack Incoming Webhook URL (SLACK_WEBHOOK_URL) to post messages.
 * 
 * Features:
 * - List available Slack channels (cached from a configurable channel list)
 * - Send a property analysis report to a specific channel with a custom message
 * - Format reports with revenue data, Zillow/Redfin links, and Validate the Deal link
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { getRentalizerEstimate } from "./airdna";
import { formatSlackMessage } from "./slack-integration";

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
// SLACK CHANNEL MANAGEMENT
// ============================================

/**
 * In-memory cache of Slack channels.
 * In production, these are fetched via the Slack API or configured manually.
 * For now, we store a configurable list that the admin can manage.
 */
interface SlackChannel {
  id: string;
  name: string;
  topic?: string;
}

// Default channels - these get populated from the admin UI or Slack API
let cachedChannels: SlackChannel[] = [];
let channelsCacheTime = 0;
const CHANNEL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================
// HELPER: Post to Slack via Incoming Webhook
// ============================================

async function postToSlackWebhook(webhookUrl: string, message: object): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Slack Admin] Webhook POST failed (${response.status}):`, errorText);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Slack Admin] Error posting to webhook:', error);
    return false;
  }
}

// ============================================
// HELPER: Format admin report message
// ============================================

interface AdminReportOptions {
  address: string;
  bedrooms: number;
  bathrooms: number;
  customMessage?: string;
  channelName?: string;
}

function formatAdminSlackMessage(
  estimate: {
    property: { address: string; bedrooms: number; bathrooms: number; accommodates: number };
    estimates: {
      annual_revenue: number;
      annual_revenue_low: number;
      annual_revenue_high: number;
      average_daily_rate: number;
      occupancy_rate: number;
      currency: string;
      currency_symbol: string;
    };
    monthly_forecast: Array<{ month: string; revenue: number; adr: number; occupancy: number }>;
    comps: any[];
  },
  options: AdminReportOptions
): object {
  const { property, estimates, monthly_forecast } = estimate;
  const monthlyRevenue = Math.round(estimates.annual_revenue / 12);
  const occupancyPct = Math.round(estimates.occupancy_rate * 100);

  // Find best and worst months
  let bestMonth = { month: '', revenue: 0 };
  let worstMonth = { month: '', revenue: Infinity };
  for (const m of monthly_forecast) {
    if (m.revenue > bestMonth.revenue) bestMonth = m;
    if (m.revenue < worstMonth.revenue) worstMonth = m;
  }

  const formatMonth = (dateStr: string) => {
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const fmt = (amount: number) => `${estimates.currency_symbol}${amount.toLocaleString('en-US')}`;

  // Build the report URL — links to Validate the Deal tab
  const baseUrl = ENV.isProduction
    ? 'https://coachinayahturnkeytool.com'
    : 'http://localhost:3000';
  const encodedAddress = encodeURIComponent(property.address);
  const reportUrl = `${baseUrl}/?tab=validate&address=${encodedAddress}&bedrooms=${options.bedrooms}&bathrooms=${options.bathrooms}`;

  // Zillow and Redfin links
  const encodedAddr = encodeURIComponent(property.address);
  const zillowUrl = `https://www.zillow.com/homes/${encodedAddr}_rb/`;
  const redfinUrl = `https://www.redfin.com/search#query=${encodedAddr}`;

  const blocks: any[] = [];

  // Custom message from admin (if provided)
  if (options.customMessage) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: options.customMessage
      }
    });
    blocks.push({ type: "divider" });
  }

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `Revenue Estimate: ${property.address}`,
      emoji: false
    }
  });

  blocks.push({ type: "divider" });

  // Key metrics
  blocks.push({
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*Annual Revenue*\n${fmt(estimates.annual_revenue)}/yr` },
      { type: "mrkdwn", text: `*Revenue Range*\n${fmt(estimates.annual_revenue_low)} – ${fmt(estimates.annual_revenue_high)}/yr` },
      { type: "mrkdwn", text: `*Monthly Revenue*\n${fmt(monthlyRevenue)}/mo` },
      { type: "mrkdwn", text: `*Avg Daily Rate*\n${fmt(estimates.average_daily_rate)}/night` },
      { type: "mrkdwn", text: `*Occupancy Rate*\n${occupancyPct}%` },
      { type: "mrkdwn", text: `*Property*\n${property.bedrooms} BR / ${property.bathrooms} BA` }
    ]
  });

  blocks.push({ type: "divider" });

  // Seasonality
  if (bestMonth.month && worstMonth.month) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Seasonality Highlights*\n` +
          `• Best month: *${formatMonth(bestMonth.month)}* — ${fmt(bestMonth.revenue)}\n` +
          `• Slowest month: *${formatMonth(worstMonth.month)}* — ${fmt(worstMonth.revenue)}`
      }
    });
  }

  // Zillow / Redfin links
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Search This Property*\n<${zillowUrl}|View on Zillow>  |  <${redfinUrl}|View on Redfin>`
    }
  });

  // Validate the Deal link
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*<${reportUrl}|Validate This Deal>* — Run a full analysis with comps, expenses, and profit projections`
    }
  });

  // Footer
  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: "Sent by Coach Inayah's Turnkey Tool" }
    ]
  });

  return {
    blocks,
    text: `Revenue Estimate for ${property.address}: ${fmt(estimates.annual_revenue)}/year`
  };
}

// ============================================
// ROUTER
// ============================================

export const slackAdminRouter = router({
  /**
   * Get list of Slack channels the admin can send to.
   * Returns the cached list or a default set.
   */
  getChannels: adminProcedure.query(async () => {
    return {
      channels: cachedChannels,
      lastUpdated: channelsCacheTime
    };
  }),

  /**
   * Update the list of available Slack channels.
   * Admin can manually add/remove channels.
   */
  setChannels: adminProcedure
    .input(z.object({
      channels: z.array(z.object({
        id: z.string(),
        name: z.string(),
        topic: z.string().optional()
      }))
    }))
    .mutation(async ({ input }) => {
      cachedChannels = input.channels;
      channelsCacheTime = Date.now();
      return { success: true, count: input.channels.length };
    }),

  /**
   * Send a property analysis report to a specific Slack channel.
   * Runs the AirDNA pipeline and posts formatted results with a custom message.
   */
  sendReport: adminProcedure
    .input(z.object({
      channelId: z.string().min(1, "Channel ID is required"),
      channelName: z.string().optional(),
      address: z.string().min(5, "Property address is required"),
      bedrooms: z.number().min(1).max(10).default(2),
      bathrooms: z.number().min(1).max(10).default(1),
      customMessage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { channelId, channelName, address, bedrooms, bathrooms, customMessage } = input;

      console.log(`[Slack Admin] Sending report for "${address}" to channel ${channelId}`);

      // Step 1: Run the AirDNA analysis
      const estimate = await getRentalizerEstimate({ address, bedrooms, bathrooms });

      if (!estimate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Could not find revenue data for "${address}". Make sure the address is valid and in a market with short-term rental data.`,
        });
      }

      // Step 2: Format the message
      const message = formatAdminSlackMessage(estimate, {
        address,
        bedrooms,
        bathrooms,
        customMessage,
        channelName,
      });

      // Step 3: Post to Slack via the webhook URL
      // For admin sends, we use the configured SLACK_WEBHOOK_URL
      const webhookUrl = ENV.slackWebhookUrl;

      if (!webhookUrl) {
        // If no webhook configured, return the formatted message so the admin
        // can see what would be sent (useful for testing)
        return {
          success: false,
          error: "No SLACK_WEBHOOK_URL configured. The message was formatted but could not be sent.",
          preview: message,
          estimate: {
            annual_revenue: estimate.estimates.annual_revenue,
            monthly_revenue: Math.round(estimate.estimates.annual_revenue / 12),
            adr: estimate.estimates.average_daily_rate,
            occupancy: Math.round(estimate.estimates.occupancy_rate * 100),
          }
        };
      }

      const posted = await postToSlackWebhook(webhookUrl, message);

      if (!posted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to post message to Slack. Check the webhook URL configuration.",
        });
      }

      return {
        success: true,
        channelId,
        channelName,
        address: estimate.property.address,
        estimate: {
          annual_revenue: estimate.estimates.annual_revenue,
          monthly_revenue: Math.round(estimate.estimates.annual_revenue / 12),
          adr: estimate.estimates.average_daily_rate,
          occupancy: Math.round(estimate.estimates.occupancy_rate * 100),
        }
      };
    }),
});

/**
 * Slack Integration: Property Analysis Bot
 * 
 * Receives property analysis requests from Slack (via Incoming Webhook trigger),
 * runs the AirDNA Rentalizer pipeline, and posts formatted results back to Slack.
 * 
 * Flow:
 * 1. Slack Workflow sends POST to /api/slack/analyze with { text, response_url }
 * 2. Server parses the natural language input into { address, bedrooms, bathrooms }
 * 3. Server calls getRentalizerEstimate() for revenue data
 * 4. Server formats results into Slack Block Kit message
 * 5. Server posts the formatted message back via the Slack Incoming Webhook URL
 */

import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { getRentalizerEstimate, type RentalizerResponse } from "./airdna";

// ============================================
// TYPES
// ============================================

interface SlackAnalyzeRequest {
  /** The raw text from the user, e.g. "Analyze 123 Main St, Atlanta, GA 30301, 3BR 2BA" */
  text: string;
  /** Slack channel ID to post results back to (optional, used for logging) */
  channel_id?: string;
  /** Slack user ID who triggered the request (optional, used for @mention) */
  user_id?: string;
  /** Slack Workflow response_url for posting back (alternative to webhook) */
  response_url?: string;
}

interface ParsedPropertyInput {
  address: string;
  bedrooms: number;
  bathrooms: number;
}

// ============================================
// PARSE NATURAL LANGUAGE INPUT
// ============================================

/**
 * Uses LLM to parse a natural language property description into structured data.
 * Handles various formats:
 * - "Analyze 123 Main St, Atlanta, GA 30301, 3BR 2BA"
 * - "What can I make at 456 Oak Ave Denver CO? 2 bed 1 bath"
 * - "1622 Halliard Dr Lawrenceville GA 30043"
 */
export async function parseSlackInput(text: string): Promise<ParsedPropertyInput | null> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a property address parser. Extract the property address, number of bedrooms, and number of bathrooms from the user's message.

Return ONLY a JSON object with these fields:
- "address": the full street address including city, state, and zip code if available
- "bedrooms": number of bedrooms (default to 2 if not specified)
- "bathrooms": number of bathrooms (default to 1 if not specified)

Examples:
Input: "Analyze 123 Main St, Atlanta, GA 30301, 3BR 2BA"
Output: {"address": "123 Main St, Atlanta, GA 30301", "bedrooms": 3, "bathrooms": 2}

Input: "What can I make at 456 Oak Ave Denver CO? 2 bed 1 bath"
Output: {"address": "456 Oak Ave, Denver, CO", "bedrooms": 2, "bathrooms": 1}

Input: "1622 Halliard Dr Lawrenceville GA 30043"
Output: {"address": "1622 Halliard Dr, Lawrenceville, GA 30043", "bedrooms": 2, "bathrooms": 1}

Return ONLY the JSON object, no other text.`
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "property_input",
          strict: true,
          schema: {
            type: "object",
            properties: {
              address: { type: "string", description: "Full street address with city, state, zip" },
              bedrooms: { type: "integer", description: "Number of bedrooms (default 2)" },
              bathrooms: { type: "integer", description: "Number of bathrooms (default 1)" }
            },
            required: ["address", "bedrooms", "bathrooms"],
            additionalProperties: false
          }
        }
      }
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) return null;

    // Content can be string or array of content parts
    const content = typeof rawContent === 'string' 
      ? rawContent 
      : rawContent.map(part => 'text' in part ? part.text : '').join('');
    if (!content) return null;

    const parsed = JSON.parse(content);
    
    // Validate
    if (!parsed.address || typeof parsed.address !== 'string' || parsed.address.length < 5) {
      console.error('[Slack] Invalid parsed address:', parsed.address);
      return null;
    }

    return {
      address: parsed.address,
      bedrooms: Math.max(1, Math.min(10, parsed.bedrooms || 2)),
      bathrooms: Math.max(1, Math.min(10, parsed.bathrooms || 1))
    };
  } catch (error) {
    console.error('[Slack] Error parsing input:', error);
    return null;
  }
}

// ============================================
// FORMAT SLACK MESSAGE
// ============================================

/**
 * Formats the Rentalizer response into a Slack Block Kit message.
 * Uses mrkdwn formatting for rich display in Slack channels.
 */
export function formatSlackMessage(
  estimate: RentalizerResponse,
  originalText: string,
  reportUrl?: string
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

  const formatCurrency = (amount: number) => {
    return `${estimates.currency_symbol}${amount.toLocaleString('en-US')}`;
  };

  // Build the Slack Block Kit message
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Revenue Estimate: ${property.address}`,
        emoji: false
      }
    },
    {
      type: "divider"
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Annual Revenue*\n${formatCurrency(estimates.annual_revenue)}/yr`
        },
        {
          type: "mrkdwn",
          text: `*Revenue Range*\n${formatCurrency(estimates.annual_revenue_low)} – ${formatCurrency(estimates.annual_revenue_high)}/yr`
        },
        {
          type: "mrkdwn",
          text: `*Monthly Revenue*\n${formatCurrency(monthlyRevenue)}/mo`
        },
        {
          type: "mrkdwn",
          text: `*Avg Daily Rate*\n${formatCurrency(estimates.average_daily_rate)}/night`
        },
        {
          type: "mrkdwn",
          text: `*Occupancy Rate*\n${occupancyPct}%`
        },
        {
          type: "mrkdwn",
          text: `*Property*\n${property.bedrooms} BR / ${property.bathrooms} BA`
        }
      ]
    },
    {
      type: "divider"
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Seasonality Highlights*\n` +
          `• Best month: *${formatMonth(bestMonth.month)}* — ${formatCurrency(bestMonth.revenue)}\n` +
          `• Slowest month: *${formatMonth(worstMonth.month)}* — ${formatCurrency(worstMonth.revenue)}`
      }
    }
  ];

  // Zillow and Redfin search links
  const encodedAddr = encodeURIComponent(property.address);
  const zillowUrl = `https://www.zillow.com/homes/${encodedAddr}_rb/`;
  const redfinUrl = `https://www.redfin.com/search#query=${encodedAddr}`;

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Search This Property*\n<${zillowUrl}|View on Zillow>  |  <${redfinUrl}|View on Redfin>`
    }
  });

  // Add report link if available — links to Validate the Deal tab
  if (reportUrl) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${reportUrl}|Validate This Deal>* — Run a full analysis with comps, expenses, and profit projections`
      }
    });
  }

  // Footer
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "Powered by Coach Inayah's Turnkey Tool"
      }
    ]
  });

  return {
    blocks,
    text: `Revenue Estimate for ${property.address}: ${formatCurrency(estimates.annual_revenue)}/year (${formatCurrency(monthlyRevenue)}/month)` // Fallback text
  };
}

// ============================================
// FORMAT ERROR MESSAGE
// ============================================

function formatErrorMessage(errorText: string, originalText: string): object {
  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Analysis Could Not Be Completed",
          emoji: false
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${errorText}\n\n*Your request:* "${originalText}"`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Tips for best results:*\n" +
            "• Include the full street address with city and state\n" +
            "• Optionally add bedrooms and bathrooms (e.g., \"3BR 2BA\")\n" +
            "• Example: `Analyze 123 Main St, Atlanta, GA 30301, 3BR 2BA`"
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "_Powered by Coach Inayah's Turnkey Tool_"
          }
        ]
      }
    ],
    text: `Analysis failed: ${errorText}`
  };
}

// ============================================
// POST TO SLACK
// ============================================

/**
 * Posts a message to Slack via the configured Incoming Webhook URL.
 */
export async function postToSlack(message: object, responseUrl?: string): Promise<boolean> {
  // Use response_url if provided (from Slack Workflow), otherwise use configured webhook
  const webhookUrl = responseUrl || ENV.slackWebhookUrl;
  
  if (!webhookUrl) {
    console.error('[Slack] No webhook URL configured. Set SLACK_WEBHOOK_URL env var.');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Slack] Webhook POST failed (${response.status}):`, errorText);
      return false;
    }

    console.log('[Slack] Message posted successfully');
    return true;
  } catch (error) {
    console.error('[Slack] Error posting to webhook:', error);
    return false;
  }
}

// ============================================
// MAIN HANDLER
// ============================================

/**
 * Main handler for Slack property analysis requests.
 * Called by the Express route handler in index.ts.
 * 
 * Returns immediately with a 200 to Slack, then processes async.
 */
export async function handleSlackAnalyze(request: SlackAnalyzeRequest): Promise<void> {
  const { text, response_url } = request;
  
  console.log(`[Slack] Received analysis request: "${text}"`);

  // Step 1: Parse the natural language input
  const parsed = await parseSlackInput(text);
  
  if (!parsed) {
    const errorMsg = formatErrorMessage(
      "I couldn't understand the property address from your message. Please include a full street address.",
      text
    );
    await postToSlack(errorMsg, response_url);
    return;
  }

  console.log(`[Slack] Parsed: ${parsed.address} (${parsed.bedrooms}BR/${parsed.bathrooms}BA)`);

  // Step 2: Call the AirDNA Rentalizer pipeline
  try {
    const estimate = await getRentalizerEstimate({
      address: parsed.address,
      bedrooms: parsed.bedrooms,
      bathrooms: parsed.bathrooms
    });

    if (!estimate) {
      const errorMsg = formatErrorMessage(
        "We couldn't find revenue data for this address. This could mean:\n" +
        "• The address wasn't recognized by our data provider\n" +
        "• The property is in an area with limited short-term rental data\n" +
        "• There was a temporary issue with the data service",
        text
      );
      await postToSlack(errorMsg, response_url);
      return;
    }

    // Step 3: Build the report URL — links directly to the Validate the Deal tab
    const baseUrl = ENV.isProduction 
      ? 'https://coachinayahturnkeytool.com' 
      : 'http://localhost:3000';
    
    // Encode address for URL — tab=validate pre-fills the Validate the Deal tool
    const encodedAddress = encodeURIComponent(parsed.address);
    const reportUrl = `${baseUrl}/?tab=validate&address=${encodedAddress}&bedrooms=${parsed.bedrooms}&bathrooms=${parsed.bathrooms}`;

    // Step 4: Format and post the results
    const message = formatSlackMessage(estimate, text, reportUrl);
    await postToSlack(message, response_url);
    
    console.log(`[Slack] Analysis complete for ${parsed.address}: $${estimate.estimates.annual_revenue}/yr`);
    
  } catch (error) {
    console.error('[Slack] Analysis pipeline error:', error);
    const errorMsg = formatErrorMessage(
      "An unexpected error occurred while analyzing this property. Please try again in a few minutes.",
      text
    );
    await postToSlack(errorMsg, response_url);
  }
}

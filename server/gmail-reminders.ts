/**
 * Gmail Reminder Email Service
 *
 * Uses the same GCP service account (with domain-wide delegation) as the
 * Calendar integration to send personalized reminder emails from
 * support@coachinayah.com via Gmail API.
 *
 * PREREQUISITE: The service account must have the Gmail send scope
 * (https://www.googleapis.com/auth/gmail.send) granted in:
 * Google Workspace Admin → Security → API Controls → Domain-wide Delegation
 *
 * This provides HIGH deliverability because:
 * 1. Emails come from a real Google Workspace account (not a third-party sender)
 * 2. The domain has proper SPF/DKIM/DMARC already configured
 * 3. Gmail handles threading, unsubscribe headers, etc.
 */

import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { ENV } from "./_core/env";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReminderEmailParams {
  /** Recipient email address */
  to: string;
  /** Recipient name for personalization */
  recipientName?: string;
  /** Email subject line */
  subject: string;
  /** HTML body content */
  htmlBody: string;
  /** Plain text fallback */
  textBody?: string;
}

export interface ReminderEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Auth Helper ─────────────────────────────────────────────────────────────

let _cachedGmailAuth: JWT | null = null;

function getGmailAuth() {
  if (_cachedGmailAuth) return _cachedGmailAuth;

  const saJson = ENV.googleCalendarServiceAccountJson;
  const impersonateEmail = ENV.googleCalendarImpersonateEmail || "support@coachinayah.com";

  if (!saJson) {
    throw new Error("GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON is not configured");
  }

  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(saJson);
  } catch {
    throw new Error("GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Service account JSON missing client_email or private_key");
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    subject: impersonateEmail,
  });

  _cachedGmailAuth = auth;
  return auth;
}

// ─── Gmail Client ────────────────────────────────────────────────────────────

function getGmailClient() {
  const auth = getGmailAuth();
  return google.gmail({ version: "v1", auth });
}

// ─── Email Builder ───────────────────────────────────────────────────────────

/**
 * Build a MIME message for Gmail API
 */
function buildMimeMessage(params: ReminderEmailParams): string {
  const fromEmail = ENV.googleCalendarImpersonateEmail || "support@coachinayah.com";
  const fromName = "Coach Inayah";
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const headers = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${params.recipientName ? `${params.recipientName} <${params.to}>` : params.to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``, // blank line before body
  ].join("\r\n");

  const textPart = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    params.textBody || stripHtml(params.htmlBody),
  ].join("\r\n");

  const htmlPart = [
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    params.htmlBody,
  ].join("\r\n");

  return `${headers}\r\n${textPart}\r\n${htmlPart}\r\n--${boundary}--`;
}

/**
 * Strip HTML tags for plain text fallback
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Send a reminder email via Gmail API
 */
export async function sendReminderEmail(
  params: ReminderEmailParams
): Promise<ReminderEmailResult> {
  try {
    const gmail = getGmailClient();
    const mimeMessage = buildMimeMessage(params);

    // Gmail API requires base64url encoding
    const encodedMessage = Buffer.from(mimeMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`[Gmail] Reminder sent to ${params.to} (messageId: ${response.data.id})`);

    return {
      success: true,
      messageId: response.data.id || undefined,
    };
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error(`[Gmail] Failed to send to ${params.to}:`, message);

    if (message.includes("Delegation denied") || message.includes("forbidden")) {
      return {
        success: false,
        error: `Gmail API delegation not authorized. Add https://www.googleapis.com/auth/gmail.send to the service account's domain-wide delegation scopes.`,
      };
    }
    if (message.includes("invalid_grant")) {
      return {
        success: false,
        error: "Service account credentials are invalid or expired.",
      };
    }

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Send bulk reminder emails to multiple recipients
 */
export async function sendBulkReminderEmails(
  recipients: Array<{ email: string; name: string }>,
  buildEmail: (recipient: { email: string; name: string }) => ReminderEmailParams
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  let consecutiveRateLimits = 0;

  console.log(`[Gmail] Starting bulk send: ${recipients.length} recipients`);

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];

    // Rate limiting: 1500ms base delay (~40/min), with extra cooldown on rate limits
    if (i > 0) {
      const cooldownMs = consecutiveRateLimits > 0
        ? 1500 + (consecutiveRateLimits * 2000)
        : 1500;
      await new Promise(r => setTimeout(r, cooldownMs));
    }

    const emailParams = buildEmail(recipient);

    // Try with retries on rate limit
    let result: { success: boolean; error?: string } = { success: false };
    for (let attempt = 0; attempt <= 3; attempt++) {
      result = await sendReminderEmail(emailParams);

      if (result.success) {
        consecutiveRateLimits = 0;
        break;
      }

      const errLower = (result.error || "").toLowerCase();
      const isRateLimit = errLower.includes("rate limit") || errLower.includes("quota") ||
        errLower.includes("429") || errLower.includes("too many requests");

      if (isRateLimit && attempt < 3) {
        consecutiveRateLimits++;
        const backoffMs = 5000 * Math.pow(2, attempt);
        console.log(`[Gmail] Rate limited on ${recipient.email} (attempt ${attempt + 1}/4), backing off ${backoffMs / 1000}s...`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }
      break;
    }

    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push(`${recipient.email}: ${result.error}`);
    }

    // Progress logging every 25 emails
    if ((i + 1) % 25 === 0 || i === recipients.length - 1) {
      console.log(`[Gmail] Progress: ${i + 1}/${recipients.length} processed (${sent} sent, ${failed} failed)`);
    }
  }

  console.log(`[Gmail] Bulk send complete: ${sent} sent, ${failed} failed`);
  return { sent, failed, errors };
}

/**
 * Check if Gmail API is properly configured and authorized
 */
export async function checkGmailHealth(): Promise<{
  configured: boolean;
  authorized: boolean;
  senderEmail: string;
  error?: string;
}> {
  const senderEmail = ENV.googleCalendarImpersonateEmail || "support@coachinayah.com";

  if (!ENV.googleCalendarServiceAccountJson) {
    return {
      configured: false,
      authorized: false,
      senderEmail,
      error: "GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON not set",
    };
  }

  try {
    const gmail = getGmailClient();
    // Try getting the user's profile to verify auth works
    await gmail.users.getProfile({ userId: "me" });

    return {
      configured: true,
      authorized: true,
      senderEmail,
    };
  } catch (error: any) {
    return {
      configured: true,
      authorized: false,
      senderEmail,
      error: error?.message || String(error),
    };
  }
}

/**
 * Clear the cached Gmail auth client
 */
export function clearGmailAuthCache(): void {
  _cachedGmailAuth = null;
}

// ─── Email Templates ─────────────────────────────────────────────────────────

/**
 * Generate a webinar reminder email with Coach Inayah branding
 */
export function buildWebinarReminderEmail(
  recipientName: string,
  recipientEmail: string,
  reminderType: "24h" | "1h" | "starting",
  eventName: string,
  joinUrl: string,
  eventDate?: string
): ReminderEmailParams {
  const firstName = recipientName.split(" ")[0] || "there";

  const subjectMap = {
    "24h": `⏰ Tomorrow: ${eventName}`,
    "1h": `⚡ Starting in 1 Hour: ${eventName}`,
    "starting": `🟢 LIVE NOW: ${eventName}`,
  };

  const preheaderMap = {
    "24h": "Don't forget — your spot is reserved for tomorrow's live masterclass.",
    "1h": "We're going live in 60 minutes. Get your spot ready!",
    "starting": "We're LIVE right now — click to join!",
  };

  const bodyMap = {
    "24h": `
      <p>Hey ${firstName}! 👋</p>
      <p>Just a friendly reminder — <strong>${eventName}</strong> is happening <strong>TOMORROW</strong>!</p>
      ${eventDate ? `<p>📅 <strong>${eventDate}</strong></p>` : ""}
      <p>This is going to be a game-changer. I'm sharing my exact 5-step system that's helped hundreds of people launch their short-term rental business.</p>
      <p>Make sure you show up on time — the best stuff happens in the first 15 minutes.</p>
      <p style="margin: 24px 0;">
        <a href="${joinUrl}" style="background-color: #C9A962; color: #0F172A; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Save Your Link — Join Tomorrow →
        </a>
      </p>
      <p>See you there! 💛</p>
      <p>— Coach Inayah</p>
    `,
    "1h": `
      <p>Hey ${firstName}! ⚡</p>
      <p>We're going <strong>LIVE in just 1 hour!</strong></p>
      <p><strong>${eventName}</strong> is about to start — and you do NOT want to miss this.</p>
      <p>I'm breaking down the exact blueprint I use to help people go from zero to their first short-term rental. No fluff, no theory — just the real steps.</p>
      <p style="margin: 24px 0;">
        <a href="${joinUrl}" style="background-color: #C9A962; color: #0F172A; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Get Ready — Join in 1 Hour →
        </a>
      </p>
      <p>Set an alarm, grab your notebook, and I'll see you in 60! 🔥</p>
      <p>— Coach Inayah</p>
    `,
    "starting": `
      <p>Hey ${firstName}! 🟢</p>
      <p><strong>WE ARE LIVE RIGHT NOW!</strong></p>
      <p><strong>${eventName}</strong> has started — click below to join immediately:</p>
      <p style="margin: 24px 0;">
        <a href="${joinUrl}" style="background-color: #166534; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 18px;">
          🔴 JOIN LIVE NOW →
        </a>
      </p>
      <p>Don't miss out — I'm sharing things I've never shared publicly before.</p>
      <p>— Coach Inayah</p>
    `,
  };

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <p style="font-size: 12px; color: #666;">${preheaderMap[reminderType]}</p>
      </div>
      ${bodyMap[reminderType]}
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0 16px;">
      <p style="font-size: 11px; color: #999; text-align: center;">
        You're receiving this because you registered for ${eventName}.<br>
        Coach Inayah | I&B Coaching
      </p>
    </body>
    </html>
  `;

  return {
    to: recipientEmail,
    recipientName,
    subject: subjectMap[reminderType],
    htmlBody,
  };
}

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

/**
 * Build post-webinar and extended reminder emails.
 * Covers: morning_of, 3h, thank_you, missed_you, follow_up, replay
 */
export type ExtendedReminderType = "morning_of" | "3h" | "thank_you" | "missed_you" | "follow_up" | "replay";

export function buildPostWebinarEmail(
  recipientName: string,
  recipientEmail: string,
  emailType: ExtendedReminderType,
  eventName: string,
  joinUrl: string,
  replayUrl?: string,
  eventDate?: string
): ReminderEmailParams {
  const firstName = recipientName.split(" ")[0] || "there";
  const ctaUrl = replayUrl || joinUrl;

  const subjectMap: Record<ExtendedReminderType, string> = {
    "morning_of": `Today's the day! ${eventName} is TONIGHT`,
    "3h": `⏰ 3 hours until ${eventName} — don't miss this`,
    "thank_you": `Thanks for showing up! Here's your replay`,
    "missed_you": `We missed you! Here's what you missed...`,
    "follow_up": `Last chance: ${eventName} replay coming down soon`,
    "replay": `Your ${eventName} replay is ready`,
  };

  const preheaderMap: Record<ExtendedReminderType, string> = {
    "morning_of": "Tonight at 7PM ET — your spot is reserved.",
    "3h": "We go live in 3 hours. Get your notebook ready.",
    "thank_you": "You showed up and that's huge. Here's the replay + next steps.",
    "missed_you": "No judgment — life happens. But you need to see this.",
    "follow_up": "The replay won't be available much longer.",
    "replay": "Watch (or re-watch) at your own pace.",
  };

  const bodyMap: Record<ExtendedReminderType, string> = {
    "morning_of": `
      <p>Hey ${firstName}!</p>
      <p>Today is the day. <strong>${eventName}</strong> is happening <strong>TONIGHT</strong>.</p>
      ${eventDate ? `<p>📅 <strong>${eventDate}</strong></p>` : `<p>📅 <strong>Tonight at 7:00 PM ET</strong></p>`}
      <p>I'm going to break down my exact system for finding properties that cash flow from day one — even if you're starting with zero experience.</p>
      <p>Here's how to get the most out of tonight:</p>
      <ul style="padding-left: 20px; margin: 16px 0;">
        <li>Grab a notebook and pen</li>
        <li>Show up 5 minutes early</li>
        <li>Come with questions — I'll be answering them live</li>
      </ul>
      <p style="margin: 24px 0;">
        <a href="${joinUrl}" style="background-color: #C9A962; color: #0F172A; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Save Your Link for Tonight →
        </a>
      </p>
      <p>See you there!</p>
      <p>— Coach Inayah</p>
    `,
    "3h": `
      <p>Hey ${firstName}!</p>
      <p><strong>3 hours.</strong> That's all that's between you and the blueprint that's helped hundreds of people launch their first short-term rental.</p>
      <p><strong>${eventName}</strong> starts at 7:00 PM ET tonight.</p>
      <p>This isn't theory. I'm sharing the exact 5-step system I use — including how to find properties that cash flow $3,000-$5,000/month without owning them.</p>
      <p>If you've been thinking about getting into short-term rentals but don't know where to start... tonight is your answer.</p>
      <p style="margin: 24px 0;">
        <a href="${joinUrl}" style="background-color: #C9A962; color: #0F172A; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          I'll Be There Tonight →
        </a>
      </p>
      <p>Set your alarm. Grab your notebook. Let's go.</p>
      <p>— Coach Inayah</p>
    `,
    "thank_you": `
      <p>Hey ${firstName}!</p>
      <p>I just want to say — <strong>thank you for showing up tonight.</strong></p>
      <p>Most people register for things and never follow through. You did. That tells me you're serious about building something real.</p>
      <p>Here's your replay in case you want to re-watch any part:</p>
      <p style="margin: 24px 0;">
        <a href="${ctaUrl}" style="background-color: #166534; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Watch the Replay →
        </a>
      </p>
      <p><strong>What's next?</strong></p>
      <p>If what I shared tonight resonated with you and you're ready to take the next step, I'd love to help you personally. Reply to this email or book a call — let's talk about your situation.</p>
      <p>You showed up. Now let's make it happen.</p>
      <p>— Coach Inayah</p>
    `,
    "missed_you": `
      <p>Hey ${firstName},</p>
      <p>I noticed you weren't able to make it to <strong>${eventName}</strong> tonight. No judgment — life happens.</p>
      <p>But I don't want you to miss what I shared. This was one of my most actionable sessions ever. I broke down:</p>
      <ul style="padding-left: 20px; margin: 16px 0;">
        <li>The exact 5-step system to find cash-flowing properties</li>
        <li>How to get started with $0 down (yes, really)</li>
        <li>The #1 mistake beginners make that costs them thousands</li>
        <li>Real numbers from real properties in real markets</li>
      </ul>
      <p><strong>Good news:</strong> I recorded the whole thing for you.</p>
      <p style="margin: 24px 0;">
        <a href="${ctaUrl}" style="background-color: #C9A962; color: #0F172A; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
          Watch the Replay Now →
        </a>
      </p>
      <p><em>Fair warning: this replay won't be available forever. Watch it while you can.</em></p>
      <p>— Coach Inayah</p>
    `,
    "follow_up": `
      <p>Hey ${firstName},</p>
      <p>Quick heads up — the replay for <strong>${eventName}</strong> is coming down soon.</p>
      <p>If you haven't watched it yet (or want to re-watch), now's the time.</p>
      <p>Here's what people are saying about this session:</p>
      <blockquote style="border-left: 3px solid #C9A962; padding-left: 16px; margin: 16px 0; font-style: italic; color: #444;">
        "I've been researching STRs for months and this one call gave me more clarity than everything else combined."
      </blockquote>
      <p style="margin: 24px 0;">
        <a href="${ctaUrl}" style="background-color: #C9A962; color: #0F172A; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Watch Before It's Gone →
        </a>
      </p>
      <p>If you're ready to take the next step after watching, reply to this email. I read every one.</p>
      <p>— Coach Inayah</p>
    `,
    "replay": `
      <p>Hey ${firstName}!</p>
      <p>Your replay of <strong>${eventName}</strong> is ready.</p>
      <p>Whether you attended live or couldn't make it — here's your chance to watch (or re-watch) at your own pace:</p>
      <p style="margin: 24px 0;">
        <a href="${ctaUrl}" style="background-color: #166534; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
          Watch the Replay →
        </a>
      </p>
      <p><strong>Pro tip:</strong> Grab a notebook and pause when you need to. The section on finding properties (around the 15-minute mark) is where most people have their "aha" moment.</p>
      <p>This replay will only be available for a limited time, so don't wait too long.</p>
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
        <p style="font-size: 12px; color: #666;">${preheaderMap[emailType]}</p>
      </div>
      ${bodyMap[emailType]}
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
    subject: subjectMap[emailType],
    htmlBody,
  };
}

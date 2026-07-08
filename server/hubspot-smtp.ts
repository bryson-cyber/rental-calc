/**
 * HubSpot SMTP Email Integration for Webinar Reminders
 * Sends custom HTML transactional emails through HubSpot's SMTP relay.
 * This gives us: full custom HTML control, HubSpot engagement tracking,
 * contact timeline visibility, and auto-contact creation.
 */
import nodemailer from "nodemailer";
import { ENV } from "./_core/env";

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    if (!ENV.hubspotSmtpUser || !ENV.hubspotSmtpPass) {
      throw new Error("HubSpot SMTP credentials not configured");
    }
    transporter = nodemailer.createTransport({
      host: "smtp.hubspot.net",
      port: 587,
      secure: false,
      auth: {
        user: ENV.hubspotSmtpUser,
        pass: ENV.hubspotSmtpPass,
      },
    });
  }
  return transporter;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export async function sendWebinarEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transport = getTransporter();
    const result = await transport.sendMail({
      from: options.from || `"Coach Inayah" <${ENV.hubspotSmtpFrom}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo || ENV.hubspotSmtpFrom,
    });
    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error(`[HubSpot SMTP] Failed to send to ${options.to}:`, error.message);
    return { success: false, error: error.message };
  }
}

/** Verify SMTP connection is working */
export async function verifyHubSpotSmtp(): Promise<{ connected: boolean; error?: string }> {
  try {
    const transport = getTransporter();
    await transport.verify();
    return { connected: true };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

// ============================================================
// WEBINAR REMINDER EMAIL TEMPLATES
// ============================================================

interface WebinarEmailData {
  firstName: string;
  webinarLink: string;
  replayUrl?: string;
}

const BRAND = {
  navy: "#0F172A",
  gold: "#C9A962",
  white: "#FFFFFF",
  offWhite: "#F8F6F1",
  textDark: "#1e293b",
  textMuted: "#64748b",
};

function wrap(content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${BRAND.offWhite};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.offWhite};">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:${BRAND.white};border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
<tr><td style="background-color:${BRAND.navy};padding:24px 40px;text-align:center;">
<h1 style="margin:0;color:${BRAND.gold};font-size:20px;font-weight:600;letter-spacing:0.5px;">COACH INAYAH</h1>
</td></tr>
<tr><td style="padding:40px;">${content}</td></tr>
<tr><td style="background-color:${BRAND.offWhite};padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
<p style="margin:0;color:${BRAND.textMuted};font-size:12px;">Coach Inayah | Las Vegas, NV<br>You registered for our webinar.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function cta(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>
<td style="background-color:${BRAND.navy};border-radius:8px;padding:14px 32px;">
<a href="${url}" style="color:${BRAND.gold};text-decoration:none;font-weight:600;font-size:16px;">${text}</a>
</td></tr></table>`;
}

export function buildWebinarEmail(type: string, data: WebinarEmailData): { subject: string; html: string } | null {
  const { firstName, webinarLink, replayUrl } = data;
  const name = firstName || "there";

  switch (type) {
    case "morning_of":
      return {
        subject: `${name}, tonight's the night! Your Airbnb workshop is TODAY`,
        html: wrap(`
          <h2 style="color:${BRAND.navy};font-size:24px;margin:0 0 16px;">Tonight's the Night, ${name}!</h2>
          <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;">Your live Airbnb workshop is <strong>TODAY at 7:00 PM ET</strong>. This is the session where I break down exactly how to find properties that cash flow from day one.</p>
          <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;">Seats fill up fast — show up 10 minutes early to guarantee your spot.</p>
          ${cta("Join Tonight's Workshop →", webinarLink)}
        `),
      };
    case "3h":
      return {
        subject: `3 hours until we go live, ${name}!`,
        html: wrap(`
          <h2 style="color:${BRAND.navy};font-size:24px;margin:0 0 16px;">Just 3 Hours Away!</h2>
          <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;">Hey ${name}, we're going live in 3 hours. This is the one where I break down exactly how to find properties that cash flow from day one. Don't miss it.</p>
          ${cta("Save Your Seat →", webinarLink)}
        `),
      };
    case "1h":
      return {
        subject: `Starting in 1 HOUR — are you ready, ${name}?`,
        html: wrap(`
          <h2 style="color:${BRAND.navy};font-size:24px;margin:0 0 16px;">We Start in 1 Hour!</h2>
          <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;">${name}, we're starting in 1 HOUR! Get ready and show up 10 min early.</p>
          ${cta("Join the Workshop →", webinarLink)}
        `),
      };
    case "15min":
      return {
        subject: `15 minutes! We're about to go live`,
        html: wrap(`
          <h2 style="color:${BRAND.navy};font-size:24px;margin:0 0 16px;">15 Minutes — Almost Time!</h2>
          <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;">${name}, we're about to go live. Grab your seat now!</p>
          ${cta("Join NOW →", webinarLink)}
        `),
      };
    case "starting_now":
      return {
        subject: `WE'RE LIVE! Join now, ${name}`,
        html: wrap(`
          <h2 style="color:${BRAND.navy};font-size:24px;margin:0 0 16px;">🔴 We're LIVE Right Now!</h2>
          <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;">${name}, the workshop has started! Join now before we get into the good stuff.</p>
          ${cta("JOIN LIVE NOW →", webinarLink)}
        `),
      };
    case "thank_you":
      return {
        subject: `Thanks for showing up tonight, ${name}!`,
        html: wrap(`
          <h2 style="color:${BRAND.navy};font-size:24px;margin:0 0 16px;">Thank You, ${name}!</h2>
          <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;">Thanks for showing up today! I hope you got massive value from the workshop.</p>
          ${replayUrl ? `<p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;">Here's the replay if you want to rewatch:</p>${cta("Watch the Replay →", replayUrl)}` : `<p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;">Ready to take the next step? Reply to this email and let's talk.</p>`}
        `),
      };
    case "missed_you":
      return {
        subject: `${name}, you missed it — but I saved the replay`,
        html: wrap(`
          <h2 style="color:${BRAND.navy};font-size:24px;margin:0 0 16px;">We Missed You, ${name}!</h2>
          <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;">Hey ${name}, we missed you today! No worries — I saved the replay for you.</p>
          <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;">In this workshop, I covered:</p>
          <ul style="color:${BRAND.textDark};font-size:16px;line-height:1.8;padding-left:20px;">
            <li>How to find properties that cash flow from day one</li>
            <li>The exact numbers you need for a profitable Airbnb</li>
            <li>My step-by-step system for market analysis</li>
          </ul>
          ${replayUrl ? cta("Watch the Replay →", replayUrl) : cta("Get the Replay →", webinarLink)}
          <p style="color:${BRAND.textMuted};font-size:14px;margin:16px 0 0;">This replay won't be available forever.</p>
        `),
      };
    case "follow_up":
      return {
        subject: `Last chance: Replay expires soon, ${name}`,
        html: wrap(`
          <h2 style="color:${BRAND.navy};font-size:24px;margin:0 0 16px;">Replay Expiring Soon</h2>
          <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;">Hey ${name}, the replay from our Airbnb workshop is coming down soon.</p>
          <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;">If you haven't watched it yet, now's the time. I covered my complete system for building a profitable short-term rental portfolio.</p>
          ${replayUrl ? cta("Watch Before It's Gone →", replayUrl) : cta("Get Access →", webinarLink)}
          <p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:16px 0 0;">Ready to take action? Reply to this email.</p>
        `),
      };
    default:
      return null;
  }
}

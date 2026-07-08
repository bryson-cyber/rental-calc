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
      host: "smtp.hubapi.com",
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
      from: options.from || ENV.hubspotSmtpFrom,
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
  webinarDay?: string;    // e.g. "Tuesday"
  webinarDate?: string;   // e.g. "July 8, 2026"
  webinarTime?: string;   // e.g. "7:00 PM ET"
  callLink?: string;      // Turnkey strategy call link
}

const JOIN_LINK = "https://event.webinarjam.com/klp6w/go/live/696vzt4msgs2s6?webinar_id=380";
const CALL_LINK = "https://masterclass.coachinayah.com/turnkey-v2";

const BRAND = {
  navy: "#0F172A",
  gold: "#C9A962",
  white: "#FFFFFF",
  offWhite: "#F8F6F1",
  textDark: "#1e293b",
  textMuted: "#64748b",
};

function wrap(content: string, preheader: string = ""): string {
  const preheaderHtml = preheader
    ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</span>`
    : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${BRAND.offWhite};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.offWhite};">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:${BRAND.white};border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
<tr><td style="background-color:${BRAND.navy};padding:24px 40px;text-align:center;">
<h1 style="margin:0;color:${BRAND.gold};font-size:20px;font-weight:600;letter-spacing:0.5px;">COACH INAYAH</h1>
</td></tr>
<tr><td style="padding:40px;">${content}</td></tr>
<tr><td style="background-color:${BRAND.offWhite};padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
<p style="margin:0;color:${BRAND.textMuted};font-size:12px;">Coach Inayah | Las Vegas, NV<br>You registered for our Airbnb Masterclass.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function ctaButton(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>
<td style="background-color:${BRAND.navy};border-radius:8px;padding:14px 32px;">
<a href="${url}" style="color:${BRAND.gold};text-decoration:none;font-weight:600;font-size:16px;">${text}</a>
</td></tr></table>`;
}

function p(text: string): string {
  return `<p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:0 0 16px;">${text}</p>`;
}

function ul(items: string[]): string {
  return `<ul style="color:${BRAND.textDark};font-size:16px;line-height:1.8;padding-left:20px;margin:0 0 16px;">${items.map(i => `<li>${i}</li>`).join("")}</ul>`;
}

function h2(text: string): string {
  return `<h2 style="color:${BRAND.navy};font-size:24px;margin:0 0 16px;font-weight:600;">${text}</h2>`;
}

function signoff(): string {
  return `<p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:16px 0 0;">Talk soon,<br><strong>Inayah</strong></p>`;
}

export function buildWebinarEmail(type: string, data: WebinarEmailData): { subject: string; html: string } | null {
  const { firstName } = data;
  const name = firstName || "there";
  const joinLink = data.webinarLink || JOIN_LINK;
  const callLink = data.callLink || CALL_LINK;
  const day = data.webinarDay || "Tuesday";
  const date = data.webinarDate || "July 8, 2026";
  const time = data.webinarTime || "7:00 PM ET";

  switch (type) {
    case "confirmation":
      return {
        subject: "You're in: Your Airbnb Masterclass is booked ✅",
        html: wrap(`
          ${h2(`You're in, ${name}!`)}
          ${p(`You're officially registered for my free Airbnb Masterclass on <strong>${day}, ${date} at ${time}</strong>.`)}
          ${p("In this live class, I'll show you:")}
          ${ul([
            "How busy professionals are adding $2,000–$5,000/mo with Airbnb <strong>without owning property</strong>",
            'The 5-step "Get Your First Yes" system I used to go from nanny to 50+ properties by 23',
            "How to fund your first unit even if you don't have $20K sitting in savings",
          ])}
          ${p("If you show up live and stay until the end, you'll get:")}
          ${ul([
            'My "Landlord Yes" script',
            "My 90-Day Launch Checklist",
            "Access to my full training course as a bonus for action-takers",
          ])}
          ${p("Add this to your calendar now so you don't miss it.")}
          ${ctaButton("Add to Calendar", joinLink)}
          ${p(`On ${day}, I'll also send your private join link here 15 minutes before we start.`)}
          ${signoff()}
        `, "Here's everything you need to know before the class..."),
      };

    case "2_days_before":
      return {
        subject: "In 2 days: Build a second income without quitting your W2",
        html: wrap(`
          ${h2(`2 Days Away, ${name}!`)}
          ${p(`Quick reminder that in 2 days you're joining me live for the Airbnb Masterclass:`)}
          ${p(`<strong>${day}, ${date} at ${time}</strong>`)}
          ${p("Here's what we'll cover:")}
          ${ul([
            "What rental arbitrage actually is (and why you don't need to own property)",
            "How to use data, not guessing, to find units that can profit $1K–$3K/mo",
            "The exact steps my mom used to create a 6-figure income from just 2 properties while keeping her career",
          ])}
          ${p("Block out 90 minutes where you can focus. This is not fluff. It's the exact system I used to replace my income and help hundreds of students do the same.")}
          ${p(`See you soon,<br><strong>Inayah</strong>`)}
        `, "90 minutes that could change your financial future..."),
      };

    case "day_before":
      return {
        subject: "Tomorrow: 5 steps to your first \"yes\" from a landlord",
        html: wrap(`
          ${h2(`Tomorrow's the Day, ${name}!`)}
          ${p(`Your Airbnb Masterclass is tomorrow at <strong>${time}</strong>.`)}
          ${p("By the end, you'll know:")}
          ${ul([
            "How to run the numbers on a property so you're not \"hoping\" it cash flows",
            "How to approach landlords so they actually say yes to your business",
            "What it really costs to start (and how students use 0% business credit to fund it)",
          ])}
          ${p("Remember:<br>Stay live until the end and I'll send you:")}
          ${ul([
            "The Landlord Yes video script",
            "My lease addendum template",
            "Free access to the full course we use with our paying clients",
          ])}
          ${p("Most people register and never show. You already proved you're different by signing up. Tomorrow is where action-takers separate from \"maybe later\" people.")}
          ${p(`See you there,<br><strong>Inayah</strong>`)}
        `, "The exact system that helped my mom make $116K from 2 properties..."),
      };

    case "morning_of":
      return {
        subject: "Tonight: Your 90-minute Airbnb game plan",
        html: wrap(`
          ${h2(`Good morning, ${name}!`)}
          ${p(`Tonight at <strong>${time}</strong> we're live.`)}
          ${p("I'll walk you through:")}
          ${ul([
            "The 5-step money-making system I use with my 50+ unit portfolio",
            "How to budget $10K–$20K and decide if you should use cash or business credit",
            "Real client examples (like my mom's $116K in under 10 months from 2 units)",
          ])}
          ${p("If you've ever thought, \"I know I'm meant for more than just my paycheck,\" this class is for you.")}
          ${p("Watch for your join link in your inbox and texts later today.")}
          ${p(`With you,<br><strong>Inayah</strong>`)}
        `, "Tonight's your night — here's what to expect..."),
      };

    case "3h":
      return {
        subject: "3 hours: grab a notebook, we're building your second income",
        html: wrap(`
          ${h2(`3 Hours Out, ${name}!`)}
          ${p(`We're 3 hours out from your Airbnb Masterclass: <strong>${time}</strong>.`)}
          ${p("Do this now so you actually get value:")}
          ${ul([
            "Put your phone on Do Not Disturb during the class",
            "Grab a notebook and pen",
            "Write this at the top of the page: \"Where do I want to be 6 months from now?\"",
          ])}
          ${p("My goal tonight is simple: give you a clear path so 6 months from now you're not still thinking about a second income, you're collecting it.")}
          ${signoff()}
        `, "Grab a notebook. In 3 hours, we're building your second income..."),
      };

    case "1h":
      return {
        subject: "We start in 1 hour – your private link inside",
        html: wrap(`
          ${h2(`1 Hour, ${name}!`)}
          ${p("We're live in 1 hour.")}
          ${p(`<strong>Airbnb Masterclass</strong><br>${day}, ${date} — ${time}`)}
          ${ctaButton("Join the Masterclass →", joinLink)}
          ${p("Show up live and stay until the end to get:")}
          ${ul([
            "Landlord Yes script",
            "90-Day Launch Checklist",
            "Full course access bonus",
          ])}
          ${p(`See you on the live,<br><strong>Inayah</strong>`)}
        `, "Your private join link is inside — don't miss this..."),
      };

    case "15min":
      return {
        subject: "We go live in 15 minutes (join link)",
        html: wrap(`
          ${h2(`15 Minutes, ${name}!`)}
          ${p("We're starting in 15 minutes.")}
          ${p("Here's your private link to join:")}
          ${ctaButton("Join Now →", joinLink)}
          ${p("Hop on a few minutes early so you don't miss step 1 of the 5-step system or the details on the live-only bonuses.")}
          ${p(`On in a moment,<br><strong>Inayah</strong>`)}
        `, "Open this now — we start in 15 minutes..."),
      };

    case "starting_now":
      return {
        subject: "We're live right now – you can still join",
        html: wrap(`
          ${h2(`We're Live, ${name}!`)}
          ${p("I'm live right now walking through:")}
          ${ul([
            "How to pick a profitable market",
            "How to avoid the biggest mistakes beginners make",
            "The exact tools we use to run numbers in minutes",
          ])}
          ${p("You can still join us here:")}
          ${ctaButton("JOIN LIVE NOW →", joinLink)}
          ${p("If you don't make it on in the next few minutes, you'll likely miss the funding breakdown and landlord pitch.")}
          ${p(`Come on in,<br><strong>Inayah</strong>`)}
        `, "Click to join — we're going live right now..."),
      };

    case "no_show":
      return {
        subject: "We just started – here's your last chance to join live",
        html: wrap(`
          ${h2(`We Just Started, ${name}`)}
          ${p("We kicked off the Airbnb Masterclass about 10 minutes ago and I'm already into the 5-step \"Get Your First Yes\" system.")}
          ${p("If you jump in now, you'll still catch:")}
          ${ul([
            "How to check if your city is legal",
            "How to use data to avoid \"pretty but broke\" properties",
            "The story of how my mom built a 6-figure income from 2 units",
          ])}
          ${ctaButton("Join Before We Lock the Room →", joinLink)}
          ${p("If you miss this, assume there's no public replay.")}
          ${p(`Hope to see you inside,<br><strong>Inayah</strong>`)}
        `, "The class started — there's still time to join..."),
      };

    case "thank_you":
      return {
        subject: "Thank you for showing up live – here's your next step",
        html: wrap(`
          ${h2(`Thank You, ${name}!`)}
          ${p("Thank you for showing up live tonight. Most people registered and never made it. You did the hard part: you actually showed up.")}
          ${p("Now, if you want personal help launching your first (or next) unit in the next 90 days, your next step is simple:")}
          ${ctaButton("Apply for a Turnkey Strategy Call →", callLink)}
          ${p("On this call, my team will:")}
          ${ul([
            "Review your city and budget",
            "Map out a realistic 90-day launch plan",
            "See if you're a fit for us to help you implement it",
          ])}
          ${p("Proud of you for investing your time tonight.")}
          ${p(`With love,<br><strong>Inayah</strong>`)}
        `, "Your replay is ready — plus what to do next..."),
      };

    case "missed_you":
      return {
        subject: `Missed you at the masterclass, ${name}`,
        html: wrap(`
          ${h2(`We Missed You, ${name}`)}
          ${p("I didn't see you live on the Airbnb Masterclass.")}
          ${p("Life happens. But nothing changes if nothing changes.")}
          ${p("If you're still serious about adding $2K–$5K/mo without leaving your W2, here's your best next step:")}
          ${ctaButton("Apply for a Turnkey Strategy Call →", callLink)}
          ${p("On that call, we'll look at:")}
          ${ul([
            "Whether your city makes sense",
            "What startup budget you actually need",
            "How fast you could realistically get your first unit live",
          ])}
          ${p("If we run another live class, I'll email you an invite. Until then, this call is the fastest way to get moving.")}
          ${signoff()}
        `, "You missed it, but I saved the replay for you..."),
      };

    case "follow_up":
      return {
        subject: "Ready to launch your first Airbnb in the next 90 days?",
        html: wrap(`
          ${h2(`Ready to Take Action, ${name}?`)}
          ${p("Yesterday's class was about clarity. Today is about action.")}
          ${p("If you're ready to stop trading only time for money and start building a second stream of income through Airbnb, here's what to do:")}
          ${ul([
            `<a href="${callLink}" style="color:${BRAND.gold};font-weight:600;">Click here</a>`,
            "Pick a time for your Turnkey Strategy Call",
            "Show up ready to talk honestly about your goals, fears, and timeline",
          ])}
          ${p("We'll map out:")}
          ${ul([
            "Your 6-month vision",
            "A step-by-step plan for your first (or next) unit",
            "Whether we're the right team to help you execute it",
          ])}
          ${ctaButton("Book Your Strategy Call →", callLink)}
          ${p("The information you have now is enough to stay stuck or to start. The difference is what you do in the next 24 hours.")}
          ${p(`See you on the call,<br><strong>Inayah</strong>`)}
        `, "The replay expires soon — watch before it's gone..."),
      };

    default:
      return null;
  }
}

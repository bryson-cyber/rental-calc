/**
 * HubSpot SMTP Email Integration for Webinar Reminders
 * Sends custom HTML transactional emails through HubSpot's SMTP relay.
 * This gives us: full custom HTML control, HubSpot engagement tracking,
 * contact timeline visibility, and auto-contact creation.
 */
import nodemailer from "nodemailer";
import { ENV } from "./_core/env";
import type { EmailPersonalization } from "./webinar-personalization";

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

/**
 * Convert admin-typed plain text (from the AI email composer) into minimal
 * personal-style HTML: escaped, paragraphs on blank lines, bare URLs linked.
 * Deliberately no branded wrapper — heavy layouts land in Gmail Promotions.
 *
 * URLs are detected in the RAW text (before escaping) so surrounding
 * punctuation like <https://…> can't leak escaped entities into the href.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Split-capture: odd-indexed tokens are URLs. Excludes whitespace and the
// delimiters commonly wrapped around pasted links.
const URL_TOKEN = /(https?:\/\/[^\s<>"'）)\]]+)/g;

export function plainTextToEmailHtml(text: string): string {
  const linked = text
    .split(URL_TOKEN)
    .map((token, i) => {
      if (i % 2 === 1) {
        // Trim trailing punctuation that's almost never part of the URL
        const url = token.replace(/[.,!?;:]+$/, "");
        const trailing = token.slice(url.length);
        return `<a href="${escapeHtml(url)}" style="color:#1a56db;">${escapeHtml(url)}</a>${escapeHtml(trailing)}`;
      }
      return escapeHtml(token);
    })
    .join("");
  const paragraphs = linked
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1e293b;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${paragraphs}</body></html>`;
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
// WEBINAR REMINDER EMAIL TEMPLATES — V2 (July 2026)
// Upgraded hooks, contrarian angles, two-camp language,
// "this window closes" messaging.
// ============================================================

interface WebinarEmailData {
  firstName: string;
  webinarLink: string;
  replayUrl?: string;
  webinarDay?: string;    // e.g. "Tuesday"
  webinarDate?: string;   // e.g. "July 8, 2026"
  webinarTime?: string;   // e.g. "7:00 PM ET"
  callLink?: string;      // Turnkey strategy call link
  /** Lead's market context (city, local deal, regulation line). Optional —
   *  templates render identically to before when absent. */
  personalization?: EmailPersonalization;
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

function signoff(closing: string = "Talk soon"): string {
  return `<p style="color:${BRAND.textDark};font-size:16px;line-height:1.6;margin:16px 0 0;">${closing},<br><strong>Inayah</strong></p>`;
}

/**
 * "Near {city}" card: the lead's local deal, their own report numbers, and the
 * regulation one-liner. Renders nothing unless we have at least one real local
 * fact — never a fabricated local claim.
 */
function propertyModule(pz?: EmailPersonalization): string {
  if (!pz?.city) return "";
  const rows: string[] = [];
  if (pz.dealLabel && pz.dealRent) {
    const projection = pz.dealRevenue
      ? `comps project <strong>${pz.dealRevenue}/mo</strong> on Airbnb`
      : `comps project roughly <strong>${pz.dealProfit}/mo in profit</strong>`;
    const profitTail = pz.dealRevenue && pz.dealProfit
      ? ` — roughly <strong>${pz.dealProfit}/mo in profit</strong> after rent and expenses`
      : "";
    rows.push(p(`My deal scanner found ${pz.dealLabel} renting for <strong>${pz.dealRent}/mo</strong>, and ${projection}${profitTail}.`));
  }
  if (pz.ownReportLine) rows.push(p(pz.ownReportLine));
  if (pz.regLine) rows.push(p(pz.regLine));
  if (rows.length === 0) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>
<td style="background-color:${BRAND.offWhite};border-left:4px solid ${BRAND.gold};border-radius:8px;padding:20px 24px;">
<p style="margin:0 0 12px;color:${BRAND.navy};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Near ${pz.city}</p>
${rows.join("")}
<p style="margin:8px 0 0;"><a href="${pz.toolLink}" style="color:${BRAND.navy};font-weight:600;text-decoration:underline;">See properties near ${pz.city} &rarr;</a></p>
</td></tr></table>`;
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
    // ─────────────────────────────────────────────────────────
    // 1) CONFIRMATION (immediately on registration)
    // ─────────────────────────────────────────────────────────
    case "confirmation":
      return {
        subject: "You just grabbed a seat in the Airbnb \"gold rush\"",
        html: wrap(`
          ${h2(`You're locked in, ${name}!`)}
          ${p(`You're locked in for my Free Airbnb Masterclass on <strong>${day}, ${date} at ${time}</strong>.`)}
          ${p("In 90 minutes, I'll show you how:")}
          ${ul([
            "Busy professionals are adding $2,000\u2013$5,000/mo with Airbnb",
            "Using properties they don't own",
            "While still working full\u2011time",
          ])}
          ${p('This is the same 5\u2011step "Get Your First Yes" system I used to go from broke nanny to 50+ properties and 7 figures before 25.')}
          ${p("If you stay live until the end, you'll also get:")}
          ${ul([
            'My Landlord "Yes" script',
            "The 90\u2011Day Launch Checklist",
            "A surprise bonus training I normally reserve for paid clients",
          ])}
          ${propertyModule(data.personalization)}
          ${p("Block the time on your calendar now. I'll text and email your private join link 15 minutes before we go live.")}
          ${ctaButton("Add to Calendar", joinLink)}
          ${signoff("Talk soon")}
        `, "In 90 minutes I'll show you how busy professionals add $2K\u2013$5K/mo with Airbnb..."),
      };

    // ─────────────────────────────────────────────────────────
    // 2) TWO DAYS BEFORE
    // ─────────────────────────────────────────────────────────
    case "2_days_before":
      return {
        subject: "Real estate without a mortgage (in 2 days)",
        html: wrap(`
          ${h2(`Hey ${name},`)}
          ${p("In 2 days, we're live:")}
          ${p(`<strong>Airbnb Masterclass</strong><br>${day}, ${date} at ${time}`)}
          ${p("Here's what you're walking into:")}
          ${ul([
            "Why owning property is the slowest way most beginners start",
            "How rental arbitrage turns a $2K rent payment into $4K\u2013$6K revenue",
            "The exact tool I use to see if a unit can profit $1K\u2013$3K/mo before I ever sign a lease",
          ])}
          ${propertyModule(data.personalization)}
          ${p('Most people will register and forget. The ones who show up live are usually the ones sending me messages 6 months later saying, "I got my first unit."')}
          ${p("You already raised your hand. Next step is just showing up.")}
          ${signoff("See you soon")}
        `, "Why owning property is the slowest way most beginners start..."),
      };

    // ─────────────────────────────────────────────────────────
    // 3) ONE DAY BEFORE
    // ─────────────────────────────────────────────────────────
    case "day_before":
      return {
        subject: data.personalization?.city
          ? `Tomorrow: 5 steps to your first "yes" \u2014 and what's near ${data.personalization.city}`
          : "Tomorrow: 5 steps to your first \"yes\" from a landlord",
        html: wrap(`
          ${h2(`Hi ${name},`)}
          ${p(`Tomorrow at <strong>${time}</strong> we go deep on the 5\u2011step money\u2011making system behind my 7\u2011figure Airbnb portfolio.`)}
          ${p("You'll see:")}
          ${ul([
            "How to check if your city is legal (so you don't get shut down)",
            'How to use data, not "that listing looks cute," to pick units',
            "Why my mom's two units passed $116,000 in less than 10 months while she kept her hospital job",
          ])}
          ${propertyModule(data.personalization)}
          ${p('If you\'ve ever thought, "I work too hard to only have one income," this class was built for you.')}
          ${p("Watch for your join link tomorrow. Do whatever you need to do so you're not stuck at work or in traffic when we start.")}
          ${signoff("With you")}
        `, "Tomorrow night: stop scrolling Airbnb and own a piece of it..."),
      };

    // ─────────────────────────────────────────────────────────
    // 4) MORNING OF
    // ─────────────────────────────────────────────────────────
    case "morning_of":
      return {
        subject: "Tonight: 90 minutes that could change your next 6 months",
        html: wrap(`
          ${h2(`${name}, today's the day.`)}
          ${p(`Tonight at <strong>${time}</strong> is your Airbnb Masterclass.`)}
          ${p("Here's my promise:")}
          ${p("If you bring a notebook and focus for 90 minutes, you'll walk away knowing:")}
          ${ul([
            "What rental arbitrage is and exactly how it makes money",
            "How much you realistically need to start ($10K\u2013$20K, or business credit)",
            "The timeline to go from zero to first cash\u2011flowing unit in about 90 days",
          ])}
          ${propertyModule(data.personalization)}
          ${p("For most people, the real cost isn't the money. It's more months of their life trading every hour for a paycheck.")}
          ${p("Let's change that tonight.")}
          ${signoff("Talk soon")}
        `, "Tonight: trade one evening for a second income..."),
      };

    // ─────────────────────────────────────────────────────────
    // 5) THREE HOURS BEFORE
    // ─────────────────────────────────────────────────────────
    case "3h":
      return {
        subject: "In 3 hours, we start building your \"no-clock-in\" income",
        html: wrap(`
          ${h2(`Hey ${name},`)}
          ${p("Quick heads up: we're 3 hours out.")}
          ${p(`<strong>${day}, ${date} at ${time}</strong><br>Airbnb Masterclass with me, live.`)}
          ${p("Do this now:")}
          ${ul([
            "Block 90 minutes where you won't be interrupted",
            "Grab a notebook",
            'Write one line at the top: "Where do I want my life to be 6 months from now?"',
          ])}
          ${p("Tonight, I'll show you a path where your time is no longer your only source of money.")}
          ${signoff("See you soon")}
        `, "3-hour warning: Airbnb Masterclass..."),
      };

    // ─────────────────────────────────────────────────────────
    // 6) ONE HOUR BEFORE
    // ─────────────────────────────────────────────────────────
    case "1h":
      return {
        subject: "You coming? We go live in 1 hour",
        html: wrap(`
          ${h2(`Hi ${name},`)}
          ${p("We're 1 hour away.")}
          ${p(`<strong>Airbnb Masterclass</strong><br>${day}, ${date} at ${time}`)}
          ${ctaButton("Join the Masterclass \u2192", joinLink)}
          ${p("On this session I'll break down:")}
          ${ul([
            "How we generated 7 figures from mostly rented units",
            "Why this isn't flipping, wholesaling, or being a landlord in the old\u2011school way",
            "The exact 5 steps you'll follow if you decide to start",
          ])}
          ${p("Show up live and stay until the end to get:")}
          ${ul([
            'Landlord "Yes" script',
            "90\u2011Day Launch Checklist",
            "Bonus training access",
          ])}
          ${signoff("See you in a bit")}
        `, "60 minutes: your seat in the Airbnb gold rush..."),
      };

    // ─────────────────────────────────────────────────────────
    // 7) FIFTEEN MINUTES BEFORE
    // ─────────────────────────────────────────────────────────
    case "15min":
      return {
        subject: "We start in 15 minutes (join link inside)",
        html: wrap(`
          ${h2(`${name},`)}
          ${p("We're starting in 15 minutes.")}
          ${p("Here's your private link:")}
          ${ctaButton("Join Now \u2192", joinLink)}
          ${p("First thing I'm covering: what rental arbitrage actually is and how hosts are making $300+ per night on properties they don't own.")}
          ${p("Hop on a few minutes early so you don't miss step 1.")}
          ${signoff("On in a moment")}
        `, "Last call before the room fills..."),
      };

    // ─────────────────────────────────────────────────────────
    // 8) STARTING NOW
    // ─────────────────────────────────────────────────────────
    case "starting_now":
      return {
        subject: "We're live right now",
        html: wrap(`
          ${h2(`Hey ${name},`)}
          ${p("I'm live right now walking through:")}
          ${ul([
            'Why Airbnb is still growing (despite all the "it\'s dead" posts)',
            "The numbers behind a real deal we ran",
            'Step 1 of the 5\u2011step "Get Your First Yes" system',
          ])}
          ${p("You can still join here:")}
          ${ctaButton("JOIN LIVE NOW \u2192", joinLink)}
          ${p("If you don't hop on in the next few minutes, assume there's no public replay.")}
          ${signoff("Come in")}
        `, "Live now: 5-step Airbnb income system..."),
      };

    // ─────────────────────────────────────────────────────────
    // 9) NO-SHOW (10 min after start, non-attendees only)
    // ─────────────────────────────────────────────────────────
    case "no_show":
      return {
        subject: "We just started \u2013 you can still catch this",
        html: wrap(`
          ${h2(`Hey ${name},`)}
          ${p("We're about 10 minutes into the Airbnb Masterclass.")}
          ${p("I've already covered:")}
          ${ul([
            'The difference between "pretty but broke" units and boring but profitable ones',
            "How I went from nanny to $1M+ a year in bookings in my early 20s",
          ])}
          ${p("If you jump in now, you'll still catch:")}
          ${ul([
            "The live research demo",
            "The funding breakdown",
            "The offer for people who want our help in the next 90 days",
          ])}
          ${ctaButton("Join Before the Room Locks \u2192", joinLink)}
          ${signoff("Hope to see you inside")}
        `, "10 minutes in. You can still make it..."),
      };

    // ─────────────────────────────────────────────────────────
    // 10) THANK YOU (attended live) — MANUAL ONLY
    // ─────────────────────────────────────────────────────────
    case "thank_you":
      return {
        subject: "You showed up. Now here's what's next.",
        html: wrap(`
          ${h2(`${name},`)}
          ${p("Thank you for showing up live tonight.")}
          ${p("Most people registered. A fraction actually came. An even smaller fraction took notes and stayed until the end. That puts you in the group that change actually happens for.")}
          ${p("As promised, here are your bonuses:")}
          ${ul([
            'Landlord "Yes" script',
            "90\u2011Day Launch Checklist",
            "Bonus training access link",
          ])}
          ${p("Now, if you want hands\u2011on help launching your first (or next) unit in the next 90 days, here's your next step:")}
          ${ctaButton("Apply for a Turnkey Strategy Call \u2192", callLink)}
          ${p("On that call my team will:")}
          ${ul([
            "Look at your city and budget",
            "Map out a realistic 90\u2011day plan",
            "See if you're a fit for us to help you implement it",
          ])}
          ${p("You already proved you're not Group A. Let's keep that momentum.")}
          ${signoff("Proud of you")}
        `, "Proud of you for showing up live..."),
      };

    // ─────────────────────────────────────────────────────────
    // 11) MISSED YOU (didn't attend)
    // ─────────────────────────────────────────────────────────
    case "missed_you":
      return {
        subject: "You registered\u2026 but I didn't see you",
        html: wrap(`
          ${h2(`Hey ${name},`)}
          ${p("I didn't see you live on the Airbnb Masterclass.")}
          ${p("Totally get that life happens. But nothing changes if nothing changes.")}
          ${p("If you're still serious about adding $2K\u2013$5K/mo without quitting your W2, here's the best next step:")}
          ${ctaButton("Apply for a Turnkey Strategy Call \u2192", callLink)}
          ${p("On that call we'll look at:")}
          ${ul([
            "Whether your market and budget make sense",
            "How long it could realistically take you to get your first unit live",
            "Whether we're the right team to walk you through it",
          ])}
          ${p('Most people will let this slide and go back to "maybe later." I don\'t want that for you.')}
          ${signoff("Talk soon")}
        `, "Missed you at the Airbnb Masterclass..."),
      };

    // ─────────────────────────────────────────────────────────
    // 12) FOLLOW-UP CTA (next day, all registrants)
    // ─────────────────────────────────────────────────────────
    case "follow_up":
      return {
        subject: "2 types of people after last night's class\u2026",
        html: wrap(`
          ${h2(`Hi ${name},`)}
          ${p("After every class, people split into two groups:")}
          ${ul([
            '<strong>Group A</strong> replays the webinar in their head, gets inspired, and then lets fear and "I\'m busy" win.',
            "<strong>Group B</strong> decides they're more scared of staying where they are than of trying something new\u2026 and they take the next step.",
          ])}
          ${p("Both groups heard the same information. Only one group changes their finances.")}
          ${p("If you're Group B, here's what to do:")}
          ${ctaButton("Book Your Turnkey Strategy Call \u2192", callLink)}
          ${p("We'll review your situation, lay out a clear 90\u2011day plan, and see if we can be the team that walks you through getting your first \"yes.\"")}
          ${p("The information alone won't change your life. What you do in the next 24 hours might.")}
          ${signoff("See you on the call")}
        `, "Which group are you in? (be honest)..."),
      };

    default:
      return null;
  }
}

/**
 * Two-way SMS engagement for webinar leads.
 *
 * The confirmation text stays clean. A couple of minutes later the lead gets
 * ONE question — "are you looking to get started with Airbnb?" — and their
 * reply drives what happens next:
 *   YES            → send the deal my scanner found near them (report link),
 *                    tied to the masterclass
 *   a city name    → run that city through the pipeline (the lead told us
 *                    where they actually want to be) and send its numbers
 *   NO / unclear   → one warm nudge toward the class, then stop
 *   STOP-ish       → mark opted out, never reply
 *
 * Inbound replies are POLLED from SimpleTexting each import-cron cycle (same
 * heartbeat architecture as everything else — no webhook configuration).
 * Classification uses the LLM router; every automated reply is capped at
 * MAX_AUTO_REPLIES per lead so a conversation can never loop.
 *
 * Kill switch: webinar_sms_settings key `sms_engagement` = "off".
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { webinarRegistrants, webinarSmsSettings } from "../drizzle/schema";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import {
  buildPersonalizationVars,
  computePersonalizationForEmail,
  ensureCityData,
  isQuietHoursLocal,
  personalizationFromMetadata,
  type RegistrantPersonalization,
} from "./webinar-personalization";

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const ENGAGEMENT_SETTING_KEY = "sms_engagement";
const INBOUND_WATERMARK_KEY = "engagement_last_inbound_ts";
const MAX_AUTO_REPLIES = 3;
const MAX_QUESTIONS_PER_CYCLE = 25;
const MAX_REPLY_SCANS_PER_CYCLE = 2;
/** Only ask leads confirmed recently — never blast an old list on deploy */
const ASK_WINDOW_HOURS = 48;
/** Small gap after the confirmation so the two texts don't stack */
const ASK_DELAY_MINUTES = 2;

const ENGAGEMENT_QUESTION =
  "Quick question from Inayah — are you actually looking to get started with Airbnb? Reply YES and I'll send you what my scanner found near you. Or text me the city you're curious about.";

interface EngagementState {
  askedAt?: string;
  replies?: number;
  lastIntent?: string;
  lastReplyAt?: string;
  cityOverride?: { city: string; state: string };
}

function engagementFromMetadata(metadata: unknown): EngagementState {
  const e = (metadata as any)?.engagement;
  return e && typeof e === "object" ? (e as EngagementState) : {};
}

// ─── Standalone SimpleTexting sender (no import cycle with webinar-sms) ──────

export async function sendSmsDirect(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = ENV.simpletextingApiKey;
  if (!apiKey) return { success: false, error: "SimpleTexting API key not configured" };
  const clean = phone.replace(/[^\d]/g, "");
  const normalized = clean.length === 11 && clean.startsWith("1") ? clean.slice(1) : clean;
  if (normalized.length !== 10) return { success: false, error: `Invalid phone: ${phone}` };
  try {
    const res = await fetch("https://api-app2.simpletexting.com/v2/api/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ contactPhone: normalized, mode: message.length > 160 ? "MMS_PREFERRED" : "AUTO", text: message }),
    });
    if (!res.ok) return { success: false, error: `SimpleTexting ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function isEngagementEnabled(db: DbClient): Promise<boolean> {
  try {
    const [row] = await db
      .select({ settingValue: webinarSmsSettings.settingValue })
      .from(webinarSmsSettings)
      .where(eq(webinarSmsSettings.settingKey, ENGAGEMENT_SETTING_KEY))
      .limit(1);
    return row?.settingValue !== "off";
  } catch {
    return true;
  }
}

// ─── Outbound: the engagement question ───────────────────────────────────────

/**
 * Ask recently-confirmed registrants the one engagement question. Runs every
 * import cycle; each lead is asked exactly once, only inside the 48h window
 * after their confirmation, never during their local quiet hours.
 */
export async function sendEngagementQuestions(db: DbClient, webinarId: string): Promise<{ asked: number }> {
  let asked = 0;
  if (!(await isEngagementEnabled(db))) return { asked };

  const windowStart = new Date(Date.now() - ASK_WINDOW_HOURS * 60 * 60 * 1000);
  const delayCutoff = new Date(Date.now() - ASK_DELAY_MINUTES * 60 * 1000);

  const rows = await db
    .select({
      id: webinarRegistrants.id,
      phone: webinarRegistrants.phone,
      metadata: webinarRegistrants.metadata,
      confirmationSmsAt: webinarRegistrants.confirmationSmsAt,
    })
    .from(webinarRegistrants)
    .where(and(
      eq(webinarRegistrants.webinarId, webinarId),
      eq(webinarRegistrants.optedOut, 0),
      eq(webinarRegistrants.confirmationSmsSent, 1),
      sql`${webinarRegistrants.confirmationSmsAt} >= ${windowStart}`,
    ));

  for (const row of rows) {
    if (asked >= MAX_QUESTIONS_PER_CYCLE) break;
    if (!row.confirmationSmsAt || row.confirmationSmsAt > delayCutoff) continue;
    const engagement = engagementFromMetadata(row.metadata);
    if (engagement.askedAt) continue;
    const pz = personalizationFromMetadata(row.metadata);
    if (pz?.timezone && isQuietHoursLocal(pz.timezone)) continue; // next cycle

    // Claim before sending so overlapping cycles can't double-text
    const claim = await db
      .update(webinarRegistrants)
      .set({ metadata: { ...((row.metadata as Record<string, unknown>) ?? {}), engagement: { ...engagement, askedAt: new Date().toISOString() } } })
      .where(and(eq(webinarRegistrants.id, row.id), sql`JSON_EXTRACT(${webinarRegistrants.metadata}, '$.engagement.askedAt') IS NULL`));
    if (((claim as any)[0]?.affectedRows ?? 0) === 0) continue;

    const result = await sendSmsDirect(row.phone, ENGAGEMENT_QUESTION);
    if (result.success) {
      asked++;
    } else {
      console.warn(`[Engagement] Question send failed for registrant #${row.id}: ${result.error}`);
    }
  }

  if (asked > 0) console.log(`[Engagement] Asked ${asked} lead(s) the engagement question (webinar ${webinarId})`);
  return { asked };
}

// ─── Inbound: classify and respond ───────────────────────────────────────────

export interface InboundIntent {
  intent: "yes" | "no" | "city" | "stop" | "other";
  city: string | null;
  state: string | null;
}

/** LLM classification of a lead's reply — handles any city they throw at it */
export async function classifyReply(text: string, knownCity?: string): Promise<InboundIntent> {
  const fallback: InboundIntent = { intent: "other", city: null, state: null };
  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You classify SMS replies from leads who were asked: "Are you looking to get started with Airbnb? Reply YES and I'll send you what my scanner found near you. Or text me the city you're curious about."

Return ONLY JSON: {"intent": "yes"|"no"|"city"|"stop"|"other", "city": string|null, "state": string|null}

Rules:
- "yes" = any affirmative (yes, yeah, absolutely, "yes im interested", emojis like 👍)
- "city" = the reply names a US city or place (even misspelled). Set city (corrected spelling) and state (2-letter). If they say yes AND name a city, intent is "city".
- "stop" = stop/unsubscribe/quit/remove me/wrong number
- "no" = clear negative without a city
- "other" = anything else (questions, confusion)
- If the city is ambiguous (e.g. "Springfield"), pick the most populous US match.${knownCity ? `\n- Their address on file is near ${knownCity}; a bare "yes" refers to that.` : ""}`,
        },
        { role: "user", content: text.slice(0, 400) },
      ],
      responseFormat: { type: "json_object" },
    });
    const content = result.choices?.[0]?.message?.content;
    const raw = typeof content === "string" ? content : "";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const intent = ["yes", "no", "city", "stop", "other"].includes(parsed.intent) ? parsed.intent : "other";
    return {
      intent,
      city: typeof parsed.city === "string" && parsed.city ? parsed.city : null,
      state: typeof parsed.state === "string" && parsed.state ? parsed.state : null,
    };
  } catch (err: any) {
    console.warn(`[Engagement] Reply classification failed:`, err.message);
    return fallback;
  }
}

/** The deal message a lead gets when they engage — report link, class tie-in */
export function buildDealReplyMessage(p: RegistrantPersonalization): string {
  const vars = buildPersonalizationVars(p);
  if (vars.has_deal === "1") {
    const link = vars.deal_link ? ` Full report: ${vars.deal_link}` : "";
    return `Love it. My scanner found a property near ${p.city} renting for ${vars.deal_rent}/mo — comps say around ${vars.deal_revenue}/mo on Airbnb.${link} We'll break down exactly how people get units like this at the masterclass. - Inayah`;
  }
  return `Love it. My scanner is digging through ${p.city} right now — I'll text you the strongest property it finds before class. Either way, the masterclass shows you the exact system. - Inayah`;
}

const NO_REPLY_MESSAGE =
  "All good — come hang out at the class anyway. You'll see exactly how people are doing this, numbers and all. Your join link's coming before we start. - Inayah";
const OTHER_REPLY_MESSAGE =
  "Best place for that is the masterclass — I cover the whole system live and answer questions. Your join link's coming before we start. - Inayah";
const ASK_CITY_MESSAGE =
  "Love it. What city should I check? Text me the city and I'll send you what my scanner finds. - Inayah";

/**
 * Poll SimpleTexting for new inbound replies and respond. Runs once per
 * import-cron cycle; the watermark in webinar_sms_settings makes it
 * exactly-once across cycles.
 */
export async function processInboundReplies(db: DbClient): Promise<{ processed: number; replied: number }> {
  let processed = 0;
  let replied = 0;
  if (!(await isEngagementEnabled(db))) return { processed, replied };
  const apiKey = ENV.simpletextingApiKey;
  if (!apiKey) return { processed, replied };

  // Watermark: only handle messages newer than the last processed timestamp
  const [wmRow] = await db
    .select({ settingValue: webinarSmsSettings.settingValue })
    .from(webinarSmsSettings)
    .where(eq(webinarSmsSettings.settingKey, INBOUND_WATERMARK_KEY))
    .limit(1);
  // First run starts NOW — never react to historical inbox traffic
  const watermark = wmRow?.settingValue ? new Date(wmRow.settingValue) : new Date();
  if (!wmRow) {
    await db
      .insert(webinarSmsSettings)
      .values({ settingKey: INBOUND_WATERMARK_KEY, settingValue: watermark.toISOString() })
      .onDuplicateKeyUpdate({ set: { settingValue: watermark.toISOString() } });
    return { processed, replied };
  }

  let messages: Array<{ id: string; text: string; contactPhone: string; directionType: string; timestamp: string }> = [];
  try {
    const res = await fetch("https://api-app2.simpletexting.com/v2/api/messages?page=0&size=50", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`SimpleTexting ${res.status}`);
    const data = (await res.json()) as { content?: typeof messages };
    messages = (data.content || []).filter((m) => m.directionType === "MO");
  } catch (err: any) {
    console.warn(`[Engagement] Inbound poll failed:`, err.message);
    return { processed, replied };
  }

  const fresh = messages
    .filter((m) => new Date(m.timestamp) > watermark)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  if (fresh.length === 0) return { processed, replied };

  let scansThisCycle = 0;

  for (const msg of fresh) {
    processed++;
    try {
      const last10 = msg.contactPhone.replace(/[^\d]/g, "").slice(-10);
      const [reg] = await db
        .select({
          id: webinarRegistrants.id,
          email: webinarRegistrants.email,
          phone: webinarRegistrants.phone,
          optedOut: webinarRegistrants.optedOut,
          metadata: webinarRegistrants.metadata,
        })
        .from(webinarRegistrants)
        .where(sql`RIGHT(REPLACE(${webinarRegistrants.phone}, '-', ''), 10) = ${last10}`)
        .orderBy(desc(webinarRegistrants.id))
        .limit(1);
      if (!reg || reg.optedOut === 1) continue;

      const engagement = engagementFromMetadata(reg.metadata);
      // Only converse with leads we asked, and never loop
      if (!engagement.askedAt || (engagement.replies ?? 0) >= MAX_AUTO_REPLIES) continue;

      const knownCity = personalizationFromMetadata(reg.metadata)?.city;
      const parsed = await classifyReply(msg.text, knownCity);

      let replyText: string | null = null;
      let cityOverride = engagement.cityOverride;
      let personalization = personalizationFromMetadata(reg.metadata);

      if (parsed.intent === "stop") {
        await db.update(webinarRegistrants).set({ optedOut: 1 }).where(eq(webinarRegistrants.id, reg.id));
      } else if (parsed.intent === "city" && parsed.city && parsed.state) {
        // The lead told us where they actually want to be — run their city
        if (scansThisCycle < MAX_REPLY_SCANS_PER_CYCLE) {
          scansThisCycle++;
          await ensureCityData(db, parsed.city, parsed.state).catch((err) =>
            console.warn(`[Engagement] City scan failed for ${parsed.city}:`, err.message));
        }
        if (reg.email) {
          personalization = await computePersonalizationForEmail(db, reg.email, {
            overrideCity: { city: parsed.city, state: parsed.state },
          });
        }
        cityOverride = { city: parsed.city, state: parsed.state };
        replyText = personalization ? buildDealReplyMessage(personalization) : OTHER_REPLY_MESSAGE;
      } else if (parsed.intent === "yes") {
        if (personalization?.city) {
          if (!personalization.deal && scansThisCycle < MAX_REPLY_SCANS_PER_CYCLE) {
            scansThisCycle++;
            await ensureCityData(db, personalization.city, personalization.state).catch(() => {});
            if (reg.email) {
              personalization = (await computePersonalizationForEmail(db, reg.email)) ?? personalization;
            }
          }
          replyText = buildDealReplyMessage(personalization);
        } else {
          replyText = ASK_CITY_MESSAGE;
        }
      } else if (parsed.intent === "no") {
        replyText = NO_REPLY_MESSAGE;
      } else {
        replyText = OTHER_REPLY_MESSAGE;
      }

      const engagementUpdate = {
        ...engagement,
        replies: (engagement.replies ?? 0) + 1,
        lastIntent: parsed.intent,
        lastReplyAt: new Date().toISOString(),
        ...(cityOverride ? { cityOverride } : {}),
      };

      // Update EVERY row sharing this phone (duplicate registrations, other
      // webinars) so SMS and email always render from the same state — the
      // lead's texted city must never revert on a sibling row.
      const siblings = await db
        .select({ id: webinarRegistrants.id, metadata: webinarRegistrants.metadata })
        .from(webinarRegistrants)
        .where(sql`RIGHT(REPLACE(${webinarRegistrants.phone}, '-', ''), 10) = ${last10}`);
      for (const sib of siblings) {
        await db
          .update(webinarRegistrants)
          .set({
            metadata: {
              ...((sib.metadata as Record<string, unknown>) ?? {}),
              engagement: engagementUpdate,
              ...(personalization ? { personalization } : {}),
            },
          })
          .where(eq(webinarRegistrants.id, sib.id));
      }

      if (replyText) {
        const sent = await sendSmsDirect(reg.phone, replyText);
        if (sent.success) replied++;
        else console.warn(`[Engagement] Reply send failed for #${reg.id}: ${sent.error}`);
      }
    } catch (err: any) {
      console.error(`[Engagement] Failed processing inbound ${msg.id}:`, err.message);
    } finally {
      // Advance the watermark even on failure — never reprocess (and never
      // risk double-texting a lead because one message errored)
      await db
        .update(webinarSmsSettings)
        .set({ settingValue: new Date(msg.timestamp).toISOString() })
        .where(eq(webinarSmsSettings.settingKey, INBOUND_WATERMARK_KEY))
        .catch(() => {});
    }
  }

  if (processed > 0) console.log(`[Engagement] Processed ${processed} inbound repl(ies), sent ${replied} response(s)`);
  return { processed, replied };
}

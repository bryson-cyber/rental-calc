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
  ensureDealReportForCity,
  isQuietHoursLocal,
  personalizationFromMetadata,
  type RegistrantPersonalization,
} from "./webinar-personalization";
import { syncLeadPriorityToHubSpot } from "./lead-priority";
import { verifyDealListing } from "./deal-liveness";

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const ENGAGEMENT_SETTING_KEY = "sms_engagement";
const INBOUND_WATERMARK_KEY = "engagement_last_inbound_ts";
const MAX_AUTO_REPLIES = 3;
const MAX_QUESTIONS_PER_CYCLE = 25;
const MAX_REPLY_SCANS_PER_CYCLE = 2;
/** Zillow liveness checks per inbound cycle (5 HasData credits each) */
const MAX_LISTING_VERIFICATIONS_PER_CYCLE = 2;
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
  /** Timestamp of the newest inbound message already handled for this phone */
  lastInboundTs?: string;
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
      // Real-time opt-ins only (webinarjam/zapier/manual). Bulk CSV uploads
      // carry older consent and no soft-pull data — a fresh upload also lands
      // inside the 48h window, so without this guard an imported list would
      // get the question en masse.
      sql`${webinarRegistrants.source} != 'csv'`,
    ));

  // One question per PERSON, not per row. Duplicate registrations (re-adds,
  // repeat test signups) share a phone; any row already asked means the
  // person was asked — a new sibling row must never re-fire the question.
  const byPhone = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.phone) continue;
    const last10 = row.phone.replace(/[^\d]/g, "").slice(-10);
    if (!byPhone.has(last10)) byPhone.set(last10, []);
    byPhone.get(last10)!.push(row);
  }

  for (const group of Array.from(byPhone.values())) {
    if (asked >= MAX_QUESTIONS_PER_CYCLE) break;
    if (group.some((r) => engagementFromMetadata(r.metadata).askedAt)) continue;
    // The newest row is the live registration
    const row = group.reduce((a, b) => (b.id > a.id ? b : a));
    if (!row.confirmationSmsAt || row.confirmationSmsAt > delayCutoff) continue;
    const engagement = engagementFromMetadata(row.metadata);
    const pz = personalizationFromMetadata(row.metadata);
    if (pz?.timezone && isQuietHoursLocal(pz.timezone)) continue; // next cycle

    // Claim before sending so overlapping cycles can't double-text
    const askedAtStamp = new Date().toISOString();
    const claim = await db
      .update(webinarRegistrants)
      .set({ metadata: { ...((row.metadata as Record<string, unknown>) ?? {}), engagement: { ...engagement, askedAt: askedAtStamp } } })
      .where(and(eq(webinarRegistrants.id, row.id), sql`JSON_EXTRACT(${webinarRegistrants.metadata}, '$.engagement.askedAt') IS NULL`));
    if (((claim as any)[0]?.affectedRows ?? 0) === 0) continue;

    // Stamp the sibling rows too, so no later cycle re-asks this person
    for (const sib of group) {
      if (sib.id === row.id) continue;
      const sibEng = engagementFromMetadata(sib.metadata);
      await db
        .update(webinarRegistrants)
        .set({ metadata: { ...((sib.metadata as Record<string, unknown>) ?? {}), engagement: { ...sibEng, askedAt: sibEng.askedAt ?? askedAtStamp } } })
        .where(eq(webinarRegistrants.id, sib.id))
        .catch(() => {});
    }

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

/**
 * Deterministic classification for the replies that matter most — a plain
 * YES/NO/STOP must never depend on an LLM round-trip succeeding.
 */
export function quickClassify(text: string): InboundIntent | null {
  const bare = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const YES = new Set(["yes", "y", "yeah", "yep", "yup", "sure", "absolutely", "definitely", "yes please", "im interested", "i m interested", "interested", "ok", "okay", "lets go", "let s go"]);
  const NO = new Set(["no", "n", "nope", "nah", "no thanks", "no thank you", "not interested", "not right now", "not now", "maybe later"]);
  const STOP = new Set(["stop", "unsubscribe", "quit", "cancel", "end", "remove me", "stop texting me", "wrong number"]);
  if (YES.has(bare)) return { intent: "yes", city: null, state: null };
  if (NO.has(bare)) return { intent: "no", city: null, state: null };
  if (STOP.has(bare)) return { intent: "stop", city: null, state: null };
  return null;
}

const STATE_ABBRS = new Set(["al","ak","az","ar","ca","co","ct","de","fl","ga","hi","ia","id","il","in","ks","ky","la","ma","md","me","mi","mn","mo","ms","mt","nc","nd","ne","nh","nj","nm","nv","ny","oh","ok","or","pa","ri","sc","sd","tn","tx","ut","va","vt","wa","wi","wv","wy","dc"]);
// State codes that double as everyday words — only trusted when the message
// clearly asks about a place
const AMBIGUOUS_ABBRS = new Set(["ok", "in", "or", "me", "hi", "oh", "la", "de", "id", "ma", "mo", "pa"]);

/**
 * Deterministic parse for the most common city reply shape: "<city> <ST>"
 * with optional filler ("what about phoenix az?"). The city flow must not
 * hinge on the LLM being up for the pattern most leads actually send.
 */
export function quickCityParse(raw: string): InboundIntent | null {
  const bare = raw
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = bare.split(" ");
  if (words.length < 2 || words.length > 8) return null;
  const last = words[words.length - 1];
  if (!STATE_ABBRS.has(last)) return null;
  const FILLER = new Set(["what", "whats", "about", "how", "hows", "can", "you", "u", "check", "out", "try", "run", "do", "look", "up", "at", "in", "for", "me", "my", "the", "a", "is", "of", "and", "please", "pls", "around", "near", "area", "yes", "yeah"]);
  const cityWords = words.slice(0, -1).filter((w) => !FILLER.has(w));
  if (cityWords.length < 1 || cityWords.length > 3) return null;
  if (AMBIGUOUS_ABBRS.has(last)) {
    const intentful = /,\s*[A-Za-z]{2}\s*[?!.]*$/.test(raw.trim()) || /\b(what about|how about|check|try|run|look)\b/i.test(raw);
    if (!intentful) return null;
  }
  const city = cityWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { intent: "city", city, state: last.toUpperCase() };
}

/** LLM classification of a lead's reply — handles any city they throw at it */
export async function classifyReply(text: string, knownCity?: string): Promise<InboundIntent> {
  const quick = quickClassify(text);
  if (quick) return quick;

  const fallback: InboundIntent = { intent: "other", city: null, state: null };
  const attempt = async () => {
    const result = await invokeLLM({
      // Pinned: Gemini 2.5 Flash misclassifies natural-language city replies
      // ("the vegas area", "atl") as 'other'; Claude classifies them reliably
      model: "claude-sonnet",
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
      // json_schema strict — the shape bug-report triage already uses in
      // production; json_object returns empty content on the routed model
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "reply_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              intent: { type: "string", enum: ["yes", "no", "city", "stop", "other"] },
              city: { type: ["string", "null"] },
              state: { type: ["string", "null"] },
            },
            required: ["intent", "city", "state"],
            additionalProperties: false,
          },
        },
      },
    });
    // Content may arrive as a string OR an array of text segments depending
    // on the routed model — handle both, then extract the JSON object
    const content = result.choices?.[0]?.message?.content;
    const raw = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((c: any) => (typeof c === "string" ? c : c?.text ?? "")).join("")
        : "";
    if (!raw.trim()) throw new Error("LLM returned empty content (structured output swallowed by thinking mode?)");
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    const intent = ["yes", "no", "city", "stop", "other"].includes(parsed.intent) ? parsed.intent : "other";
    return {
      intent,
      city: typeof parsed.city === "string" && parsed.city ? parsed.city : null,
      state: typeof parsed.state === "string" && parsed.state ? parsed.state : null,
    } as InboundIntent;
  };
  // What the deterministic pattern sees — used as a rescue when the LLM is
  // down AND as an arbiter when the LLM waffles on an obvious city text
  const parserGuess = quickCityParse(text);

  const arbitrate = (llm: InboundIntent): InboundIntent => {
    // A clear "<city> <ST>" text must reach the city flow even when the model
    // shrugs ("other") or names the intent without filling in the city.
    // Confident yes/no/stop verdicts are trusted as-is.
    if (parserGuess && (llm.intent === "other" || (llm.intent === "city" && !llm.city))) {
      console.log(`[Engagement] LLM said intent=${llm.intent} city=${llm.city ?? "null"}; city-pattern override → ${parserGuess.city}, ${parserGuess.state}`);
      return parserGuess;
    }
    console.log(`[Engagement] Classified reply: intent=${llm.intent}${llm.city ? ` city=${llm.city}, ${llm.state}` : ""}`);
    return llm;
  };

  try {
    return arbitrate(await attempt());
  } catch (firstErr: any) {
    // One retry — a transient LLM hiccup must not cost the lead their answer
    try {
      return arbitrate(await attempt());
    } catch (err: any) {
      // LLM down entirely: the deterministic parser still rescues the most
      // common city shape ("what about phoenix az?") — spelling as-typed
      if (parserGuess) {
        console.warn(`[Engagement] LLM classification failed; deterministic city parse rescued: ${parserGuess.city}, ${parserGuess.state}`);
        return parserGuess;
      }
      console.warn(`[Engagement] Reply classification failed (after retry):`, firstErr.message, "|", err.message);
      return fallback;
    }
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
 * Poll SimpleTexting for new inbound replies and respond. The watermark in
 * webinar_sms_settings plus the in-process singleton guard make it
 * exactly-once across cycles.
 */
let inboundProcessingRunning = false;

export async function processInboundReplies(db: DbClient): Promise<{ processed: number; replied: number }> {
  // The import cron fires this detached (and once per active webinar) —
  // overlapping invocations would poll the same shared inbox against the same
  // watermark and reply N times to one message. One at a time, always.
  if (inboundProcessingRunning) return { processed: 0, replied: 0 };
  inboundProcessingRunning = true;
  try {
    return await processInboundRepliesInner(db);
  } finally {
    inboundProcessingRunning = false;
  }
}

async function processInboundRepliesInner(db: DbClient): Promise<{ processed: number; replied: number }> {
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
  let verifiesThisCycle = 0;

  // Never quote a listing that's already off-market. Verification is cached
  // (12h) and budgeted; a dead verdict retires the deal inside
  // verifyDealListing, then a recompute promotes the runner-up — or strips
  // the deal so the honest no-deal copy renders.
  const withLiveDeal = async (
    p: RegistrantPersonalization | null,
    email: string | null,
  ): Promise<RegistrantPersonalization | null> => {
    if (!p?.deal || !p.dealZillowUrl) return p;
    if (verifiesThisCycle >= MAX_LISTING_VERIFICATIONS_PER_CYCLE) return p;
    verifiesThisCycle++;
    const verdict = await verifyDealListing(db, { sourceUrl: p.dealZillowUrl, address: p.deal.label });
    if (verdict !== "dead") return p;
    const recomputed = email ? await computePersonalizationForEmail(db, email).catch(() => null) : null;
    return recomputed ?? { ...p, deal: undefined, dealShortLink: undefined, dealZillowUrl: undefined, dealReportShareId: undefined };
  };

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
      // Per-lead idempotency: never react to a message at-or-before the one
      // already handled for this phone (covers watermark races and resets)
      if (engagement.lastInboundTs && new Date(msg.timestamp).getTime() <= Date.parse(engagement.lastInboundTs)) continue;

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
        personalization = await withLiveDeal(personalization, reg.email ?? null);
        cityOverride = { city: parsed.city, state: parsed.state };
        replyText = personalization ? buildDealReplyMessage(personalization) : OTHER_REPLY_MESSAGE;
      } else if (parsed.intent === "yes") {
        personalization = await withLiveDeal(personalization, reg.email ?? null);
        if (personalization?.city) {
          if (!personalization.deal && scansThisCycle < MAX_REPLY_SCANS_PER_CYCLE) {
            scansThisCycle++;
            await ensureCityData(db, personalization.city, personalization.state).catch(() => {});
            if (reg.email) {
              personalization = (await computePersonalizationForEmail(db, reg.email)) ?? personalization;
            }
          } else if (personalization.deal && !personalization.dealReportShareId && scansThisCycle < MAX_REPLY_SCANS_PER_CYCLE) {
            // Build the /share report on demand — a YES must get the report
            // link, never a bare Zillow URL
            scansThisCycle++;
            await ensureDealReportForCity(db, personalization.city, personalization.state).catch(() => {});
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

      // A reply is a sales signal: combine it with the soft-pull qualification
      // and push the priority to HubSpot so the post-class calls start with
      // the hottest leads. Never blocks the SMS flow.
      let priority: string | undefined;
      if (parsed.intent !== "stop" && reg.email) {
        const synced = await syncLeadPriorityToHubSpot({
          email: reg.email,
          replyIntent: parsed.intent,
          replyCity: cityOverride?.city,
        }).catch(() => null);
        priority = synced?.priority;
      }

      const engagementUpdate = {
        ...engagement,
        replies: (engagement.replies ?? 0) + 1,
        lastIntent: parsed.intent,
        lastReplyAt: new Date().toISOString(),
        lastInboundTs: new Date(msg.timestamp).toISOString(),
        ...(priority ? { priority } : {}),
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
        // Merge per sibling: the reply state is authoritative, but askedAt
        // must survive on every row — losing it re-arms the ask loop and the
        // person gets the question again
        const sibEng = engagementFromMetadata(sib.metadata);
        await db
          .update(webinarRegistrants)
          .set({
            metadata: {
              ...((sib.metadata as Record<string, unknown>) ?? {}),
              engagement: { ...sibEng, ...engagementUpdate, askedAt: engagementUpdate.askedAt ?? sibEng.askedAt },
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

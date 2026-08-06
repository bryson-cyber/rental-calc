/**
 * In-place upgrade of DEFAULT sequence copy already scheduled in production.
 *
 * Sequences are frozen into scheduled_sms_messages rows when an admin creates
 * them, so new seed copy never reaches messages that are already scheduled.
 * This module fixes that for stock copy only: a pending row whose body is an
 * EXACT match of an old default seed (URLs normalized) is rewritten to the
 * current tokenized default. Anything an admin customized matches no spec and
 * is never touched. Idempotent — upgraded bodies match no old spec.
 */

import { and, eq } from "drizzle-orm";
import { scheduledSmsMessages, webinarSmsSettings } from "../drizzle/schema";
import { getDb } from "./db";

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** {{URL}} marks a link slot; it matches any non-whitespace run and is carried over */
interface UpgradeSpec {
  old: string;
  new: string;
}

// Current (v3) defaults — copy aligned to the top-spending ads: named
// professions, rental arbitrage called by name, $1K–$3K/mo per property,
// no mortgage / no down payment, the done-for-you team, and the "full
// picture / decide if it fits your life" close. Every older default (v0
// plain, v1 tokenized, v2 reframe) chains straight here in one pass.
const V3 = {
  twoDays: `Hey %FIRST_NAME%, it's Inayah. In 2 days I'm walking you through how doctors, nurses, engineers, designers and teachers are using rental arbitrage — no mortgage, no down payment, and one property could profit $1K–$3K/mo.[IF_CITY] And yes, it works for %CITY% too.[/IF_CITY] Block 90 mins so you can focus.`,
  dayBefore: `Reminder from Inayah: your free Airbnb Masterclass is tomorrow — how arbitrage works, how the numbers break down, and how my team can set everything up for you.[IF_DEAL] My deal scanner found a property near %CITY% renting for %DEAL_RENT%/mo that comps say could do %DEAL_REVENUE%/mo on Airbnb. Tomorrow I show you exactly how to find and check deals like it.[/IF_DEAL][IF_CITY_ONLY] The system I teach finds opportunities in markets like %CITY% — you'll see it start to finish.[/IF_CITY_ONLY] Stay tuned for your join link.`,
  morningOf: `%FIRST_NAME%, today's the day — it's Inayah. Tonight we're live: real listings, real numbers, and what one property could actually profit each month.[IF_DEAL] A unit near %CITY% is showing numbers that could clear %DEAL_PROFIT%/mo — tonight you'll see the exact system people use to get units like it.[/IF_DEAL] If you show up live, you'll get my 'Landlord Yes' script + 90-day launch checklist.`,
  threeHours: `3-hour heads up: your Airbnb Masterclass with me starts today. Find a quiet spot and bring a notebook — I'll walk you through the whole model, the numbers, and how my team handles the setup.`,
  oneHour: `We're 1 hour out. I'll break down how career professionals are using rental arbitrage — and how one property could profit $1K–$3K/mo without buying property.[IF_CITY] The same system spots opportunities near %CITY% — you'll see how it works tonight.[/IF_CITY] I'll send your join link 15 minutes before go time.`,
  fifteenMin: `%FIRST_NAME%, we start in 15 minutes. Here's your private link to join live: {{URL}}\n\nHop on a few minutes early — we open with how arbitrage actually works and the numbers behind it.`,
  startingNow: `We're starting now. I'm breaking down the exact rental arbitrage model — no mortgage, no down payment, real numbers. Join us here: {{URL}}\n\nIf you don't hop on in the next few minutes, the room may lock.`,
  noShowNudge: `Hey %FIRST_NAME%, it's Inayah. We're 10 minutes into the Airbnb Masterclass — I just broke down how the arbitrage numbers work. You can still catch how my team sets everything up for you: {{URL}}\n\nIf you miss this, there's no replay.`,
  thankYou: `%FIRST_NAME%, thank you for showing up live tonight. You've seen the full picture — the model, the numbers, and what my team can handle for you. If it fits your life, your next step is a Turnkey Strategy Call: {{URL}}`,
  missedYou: `Hey %FIRST_NAME%, it's Inayah. I didn't see you on the Airbnb Masterclass tonight. Life happens.[IF_DEAL] While you were gone, my scanner kept working — a property near %CITY% rents for %DEAL_RENT%/mo with comps projecting %DEAL_REVENUE%/mo on Airbnb.[/IF_DEAL] If you're still serious about adding $1K–$3K/mo per property without buying a home, you can either:\nA) Register for the next live class, or\nB) Apply for a 1:1 Turnkey Strategy Call now\nGrab your best next step here: {{URL}}`,
  followUp: `%FIRST_NAME%, yesterday you saw how this works. Now it's a decision: move, or watch other people do it first. If you want my team handling the hard parts of your first Airbnb, apply for a Turnkey Strategy Call: {{URL}}\n\nWe'll see if and how we can help.`,
};

const SEQUENCE_UPGRADES: UpgradeSpec[] = [
  // ── 2 Days Before ──
  {
    old: `Hey %FIRST_NAME%, it's Inayah. In 2 days I'm going to walk you through how 500+ professionals added $2K–$5K/mo on Airbnb without owning property. You're on the list. Block 90 mins so you can focus.`,
    new: V3.twoDays,
  },
  {
    old: `Hey %FIRST_NAME%, it's Inayah. In 2 days I'm going to walk you through how 500+ professionals added $2K–$5K/mo on Airbnb without owning property. We do the research LIVE in class — real listings, real numbers.[IF_CITY] And yes, it works for %CITY% too.[/IF_CITY] Block 90 mins so you can focus.`,
    new: V3.twoDays,
  },
  // ── Day Before ──
  {
    old: `Reminder from Inayah: your Airbnb Masterclass is tomorrow. I'll show you the exact 5-step system my students use to launch in under 90 days while keeping their W2. Stay tuned for your join link.`,
    new: V3.dayBefore,
  },
  // v1 tokenized promised to run the lead's city live in class, which the
  // class doesn't do. v2 reframed the opportunity; v3 keeps that reframe.
  {
    old: `Reminder from Inayah: your Airbnb Masterclass is tomorrow.[IF_DEAL] My deal scanner found a property near %CITY% renting for %DEAL_RENT%/mo that comps say could do %DEAL_REVENUE%/mo on Airbnb. Tomorrow I show you exactly how to find and check deals like it.[/IF_DEAL][IF_CITY_ONLY] I'll show you how to run %CITY% through my research tool live.[/IF_CITY_ONLY] Stay tuned for your join link.`,
    new: V3.dayBefore,
  },
  {
    old: `Reminder from Inayah: your Airbnb Masterclass is tomorrow.[IF_DEAL] My deal scanner found a property near %CITY% renting for %DEAL_RENT%/mo that comps say could do %DEAL_REVENUE%/mo on Airbnb. Tomorrow I show you exactly how to find and check deals like it.[/IF_DEAL][IF_CITY_ONLY] The system I teach finds opportunities in markets like %CITY% — you'll see it start to finish.[/IF_CITY_ONLY] Stay tuned for your join link.`,
    new: V3.dayBefore,
  },
  // ── Morning Of ──
  {
    old: `%FIRST_NAME%, today's the day — it's Inayah. Tonight we're live for your Airbnb Masterclass. If you show up live, you'll get my 'Landlord Yes' script + 90-day launch checklist. Worth being there.`,
    new: V3.morningOf,
  },
  {
    old: `%FIRST_NAME%, today's the day — it's Inayah. Tonight we're live: regulations, real listings, and what they'd actually make on Airbnb.[IF_DEAL] I'm bringing the numbers on a unit near %CITY% that could clear %DEAL_PROFIT%/mo.[/IF_DEAL] If you show up live, you'll get my 'Landlord Yes' script + 90-day launch checklist.`,
    new: V3.morningOf,
  },
  {
    old: `%FIRST_NAME%, today's the day — it's Inayah. Tonight we're live: regulations, real listings, and what they'd actually make on Airbnb.[IF_DEAL] A unit near %CITY% is showing numbers that could clear %DEAL_PROFIT%/mo — tonight you'll see the exact system people use to get units like it.[/IF_DEAL] If you show up live, you'll get my 'Landlord Yes' script + 90-day launch checklist.`,
    new: V3.morningOf,
  },
  // ── 3 Hours Before ──
  {
    old: `3-hour heads up: your Airbnb Masterclass with me starts soon today. Find a quiet spot, bring a notebook, and be ready to map out your first cash-flowing unit.`,
    new: V3.threeHours,
  },
  // ── 1 Hour Warning ──
  {
    old: `We're 1 hour out. I'll break down how busy professionals are replacing W2 income with Airbnb without owning property. I'll send your join link 15 minutes before go time.`,
    new: V3.oneHour,
  },
  {
    old: `We're 1 hour out. I'll break down how busy professionals are replacing W2 income with Airbnb without owning property.[IF_CITY] I'll also run %CITY% through the research tool live.[/IF_CITY] I'll send your join link 15 minutes before go time.`,
    new: V3.oneHour,
  },
  {
    old: `We're 1 hour out. I'll break down how busy professionals are replacing W2 income with Airbnb without owning property.[IF_CITY] The same system spots opportunities near %CITY% — you'll see how it works tonight.[/IF_CITY] I'll send your join link 15 minutes before go time.`,
    new: V3.oneHour,
  },
  // ── 15 Min Before ──
  {
    old: `%FIRST_NAME%, we start in 15 minutes. Here's your private link to join live: {{URL}}\n\nHop on a few minutes early so you don't miss the landlord scripts.`,
    new: V3.fifteenMin,
  },
  // ── Starting NOW ──
  {
    old: `We're starting now. I'm walking through step 1 of the Turnkey Airbnb system. Join us here: {{URL}}\n\nIf you don't hop on in the next few minutes, the room may lock.`,
    new: V3.startingNow,
  },
  // ── No-Show Nudge ──
  {
    old: `Hey %FIRST_NAME%, it's Inayah. We're 10 minutes into the Airbnb Masterclass and just covered how to pick your first unit. You can still jump in live here: {{URL}}\n\nIf you miss this, there's no replay.`,
    new: V3.noShowNudge,
  },
  // ── Thank You (Attended) — manual-only, so stale copy sits pending until
  // an admin fires it; upgrading it matters as much as the timed sends ──
  {
    old: `%FIRST_NAME%, thank you for showing up live tonight. Proud of you for investing in yourself. Next step if you want help launching your first unit: apply for a Turnkey Strategy Call here: {{URL}}`,
    new: V3.thankYou,
  },
  // ── Missed You (No-Show) ──
  {
    old: `Hey %FIRST_NAME%, it's Inayah. I didn't see you on the Airbnb Masterclass tonight. Life happens. If you're still serious about adding $2K–$5K/mo without owning property, you can either:\nA) Register for the next live class, or\nB) Apply for a 1:1 Turnkey Strategy Call now\nGrab your best next step here: {{URL}}`,
    new: V3.missedYou,
  },
  {
    old: `Hey %FIRST_NAME%, it's Inayah. I didn't see you on the Airbnb Masterclass tonight. Life happens.[IF_DEAL] While you were gone, my scanner kept working — a property near %CITY% rents for %DEAL_RENT%/mo with comps projecting %DEAL_REVENUE%/mo on Airbnb.[/IF_DEAL] If you're still serious about adding $2K–$5K/mo without owning property, you can either:\nA) Register for the next live class, or\nB) Apply for a 1:1 Turnkey Strategy Call now\nGrab your best next step here: {{URL}}`,
    new: V3.missedYou,
  },
  // ── Follow-Up CTA ──
  {
    old: `%FIRST_NAME%, yesterday's class was about clarity. Today is about action. If you want help launching your first Airbnb in the next 90 days, apply for a Turnkey Strategy Call here: {{URL}}\n\nWe'll see if and how we can help.`,
    new: V3.followUp,
  },
];

// The confirmation stays CLEAN — one job. The engagement question (separate
// text, see sms-engagement.ts) carries the scanner hook. v1's deal line is
// rolled back wherever it reached production. "Free Airbnb Masterclass" is
// the offer name the ads use, so the first text a lead gets echoes the ad
// they clicked.
const CONFIRMATION_TARGET = `Hey %FIRST_NAME%, you're confirmed for the free Airbnb Masterclass. I'll send your join link here before we start. Save this number! - Inayah`;

const CONFIRMATION_UPGRADES: UpgradeSpec[] = [
  {
    old: `Hey %FIRST_NAME%, you're confirmed for the Airbnb class.[IF_DEAL] I already found a property near %CITY% worth showing you — details coming before class.[/IF_DEAL] I'll send your join link here before we start. Save this number! - Inayah`,
    new: CONFIRMATION_TARGET,
  },
  {
    old: `Hey %FIRST_NAME%, you're confirmed for the Airbnb class. I'll send your join link here before we start. Save this number! - Inayah`,
    new: CONFIRMATION_TARGET,
  },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function specToRegex(spec: UpgradeSpec): RegExp {
  const pattern = escapeRegex(spec.old).replace(/\\\{\\\{URL\\\}\\\}/g, "(\\S+)");
  return new RegExp(`^${pattern}$`);
}

/**
 * Returns the upgraded body when `body` is exactly an old default (URL slots
 * carried over), or null when it's anything else — including already-upgraded
 * or admin-customized copy.
 */
export function upgradeBody(body: string, specs: UpgradeSpec[] = SEQUENCE_UPGRADES): string | null {
  const trimmed = body.trim();
  for (const spec of specs) {
    const match = trimmed.match(specToRegex(spec));
    if (!match) continue;
    let upgraded = spec.new;
    for (const url of match.slice(1)) {
      upgraded = upgraded.replace("{{URL}}", url);
    }
    return upgraded;
  }
  return null;
}

/**
 * Upgrade a webinar's PENDING default-copy sequence rows and the evergreen
 * confirmation template to the current tokenized defaults. Sent/sending rows
 * and customized copy are left untouched. Safe to run every import cycle.
 */
export async function upgradeDefaultSequenceCopy(
  db: DbClient,
  webinarId: string,
): Promise<{ upgraded: number; confirmationUpgraded: boolean }> {
  let upgraded = 0;
  let confirmationUpgraded = false;

  const pendingRows = await db
    .select({ id: scheduledSmsMessages.id, messageBody: scheduledSmsMessages.messageBody })
    .from(scheduledSmsMessages)
    .where(and(eq(scheduledSmsMessages.webinarId, webinarId), eq(scheduledSmsMessages.status, "pending")));

  for (const row of pendingRows) {
    const next = upgradeBody(row.messageBody);
    if (!next) continue;
    const res = await db
      .update(scheduledSmsMessages)
      .set({ messageBody: next })
      .where(and(eq(scheduledSmsMessages.id, row.id), eq(scheduledSmsMessages.status, "pending")));
    if (((res as any)[0]?.affectedRows ?? 0) === 1) upgraded++;
  }

  const [setting] = await db
    .select({ settingValue: webinarSmsSettings.settingValue })
    .from(webinarSmsSettings)
    .where(eq(webinarSmsSettings.settingKey, "confirmation_sms_template"))
    .limit(1);
  if (setting && CONFIRMATION_UPGRADES.some((spec) => setting.settingValue.trim() === spec.old)) {
    await db
      .update(webinarSmsSettings)
      .set({ settingValue: CONFIRMATION_TARGET })
      .where(eq(webinarSmsSettings.settingKey, "confirmation_sms_template"));
    confirmationUpgraded = true;
  }

  if (upgraded > 0 || confirmationUpgraded) {
    console.log(`[SequenceUpgrade] webinar ${webinarId}: ${upgraded} pending message(s) upgraded to tokenized copy${confirmationUpgraded ? " + confirmation template" : ""}`);
  }
  return { upgraded, confirmationUpgraded };
}

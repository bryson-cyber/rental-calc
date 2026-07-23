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

const SEQUENCE_UPGRADES: UpgradeSpec[] = [
  {
    old: `Hey %FIRST_NAME%, it's Inayah. In 2 days I'm going to walk you through how 500+ professionals added $2K–$5K/mo on Airbnb without owning property. You're on the list. Block 90 mins so you can focus.`,
    new: `Hey %FIRST_NAME%, it's Inayah. In 2 days I'm going to walk you through how 500+ professionals added $2K–$5K/mo on Airbnb without owning property. We do the research LIVE in class — real listings, real numbers.[IF_CITY] And yes, it works for %CITY% too.[/IF_CITY] Block 90 mins so you can focus.`,
  },
  {
    old: `Reminder from Inayah: your Airbnb Masterclass is tomorrow. I'll show you the exact 5-step system my students use to launch in under 90 days while keeping their W2. Stay tuned for your join link.`,
    new: `Reminder from Inayah: your Airbnb Masterclass is tomorrow.[IF_DEAL] My deal scanner found a property near %CITY% renting for %DEAL_RENT%/mo that comps say could do %DEAL_REVENUE%/mo on Airbnb. Tomorrow I show you exactly how to find and check deals like it.[/IF_DEAL][IF_CITY_ONLY] The system I teach finds opportunities in markets like %CITY% — you'll see it start to finish.[/IF_CITY_ONLY] Stay tuned for your join link.`,
  },
  // v1 tokenized → v2 reframe: v1 promised to run the lead's city live in
  // class, which the class doesn't do. v2 frames the opportunity instead.
  {
    old: `Reminder from Inayah: your Airbnb Masterclass is tomorrow.[IF_DEAL] My deal scanner found a property near %CITY% renting for %DEAL_RENT%/mo that comps say could do %DEAL_REVENUE%/mo on Airbnb. Tomorrow I show you exactly how to find and check deals like it.[/IF_DEAL][IF_CITY_ONLY] I'll show you how to run %CITY% through my research tool live.[/IF_CITY_ONLY] Stay tuned for your join link.`,
    new: `Reminder from Inayah: your Airbnb Masterclass is tomorrow.[IF_DEAL] My deal scanner found a property near %CITY% renting for %DEAL_RENT%/mo that comps say could do %DEAL_REVENUE%/mo on Airbnb. Tomorrow I show you exactly how to find and check deals like it.[/IF_DEAL][IF_CITY_ONLY] The system I teach finds opportunities in markets like %CITY% — you'll see it start to finish.[/IF_CITY_ONLY] Stay tuned for your join link.`,
  },
  {
    old: `%FIRST_NAME%, today's the day — it's Inayah. Tonight we're live for your Airbnb Masterclass. If you show up live, you'll get my 'Landlord Yes' script + 90-day launch checklist. Worth being there.`,
    new: `%FIRST_NAME%, today's the day — it's Inayah. Tonight we're live: regulations, real listings, and what they'd actually make on Airbnb.[IF_DEAL] A unit near %CITY% is showing numbers that could clear %DEAL_PROFIT%/mo — tonight you'll see the exact system people use to get units like it.[/IF_DEAL] If you show up live, you'll get my 'Landlord Yes' script + 90-day launch checklist.`,
  },
  {
    old: `%FIRST_NAME%, today's the day — it's Inayah. Tonight we're live: regulations, real listings, and what they'd actually make on Airbnb.[IF_DEAL] I'm bringing the numbers on a unit near %CITY% that could clear %DEAL_PROFIT%/mo.[/IF_DEAL] If you show up live, you'll get my 'Landlord Yes' script + 90-day launch checklist.`,
    new: `%FIRST_NAME%, today's the day — it's Inayah. Tonight we're live: regulations, real listings, and what they'd actually make on Airbnb.[IF_DEAL] A unit near %CITY% is showing numbers that could clear %DEAL_PROFIT%/mo — tonight you'll see the exact system people use to get units like it.[/IF_DEAL] If you show up live, you'll get my 'Landlord Yes' script + 90-day launch checklist.`,
  },
  {
    old: `We're 1 hour out. I'll break down how busy professionals are replacing W2 income with Airbnb without owning property. I'll send your join link 15 minutes before go time.`,
    new: `We're 1 hour out. I'll break down how busy professionals are replacing W2 income with Airbnb without owning property.[IF_CITY] The same system spots opportunities near %CITY% — you'll see how it works tonight.[/IF_CITY] I'll send your join link 15 minutes before go time.`,
  },
  {
    old: `We're 1 hour out. I'll break down how busy professionals are replacing W2 income with Airbnb without owning property.[IF_CITY] I'll also run %CITY% through the research tool live.[/IF_CITY] I'll send your join link 15 minutes before go time.`,
    new: `We're 1 hour out. I'll break down how busy professionals are replacing W2 income with Airbnb without owning property.[IF_CITY] The same system spots opportunities near %CITY% — you'll see how it works tonight.[/IF_CITY] I'll send your join link 15 minutes before go time.`,
  },
  {
    old: `Hey %FIRST_NAME%, it's Inayah. I didn't see you on the Airbnb Masterclass tonight. Life happens. If you're still serious about adding $2K–$5K/mo without owning property, you can either:\nA) Register for the next live class, or\nB) Apply for a 1:1 Turnkey Strategy Call now\nGrab your best next step here: {{URL}}`,
    new: `Hey %FIRST_NAME%, it's Inayah. I didn't see you on the Airbnb Masterclass tonight. Life happens.[IF_DEAL] While you were gone, my scanner kept working — a property near %CITY% rents for %DEAL_RENT%/mo with comps projecting %DEAL_REVENUE%/mo on Airbnb.[/IF_DEAL] If you're still serious about adding $2K–$5K/mo without owning property, you can either:\nA) Register for the next live class, or\nB) Apply for a 1:1 Turnkey Strategy Call now\nGrab your best next step here: {{URL}}`,
  },
];

// The confirmation stays CLEAN — one job. The engagement question (separate
// text, see sms-engagement.ts) carries the scanner hook. v1's deal line is
// rolled back wherever it reached production.
const CONFIRMATION_TARGET = `Hey %FIRST_NAME%, you're confirmed for the Airbnb class. I'll send your join link here before we start. Save this number! - Inayah`;

const CONFIRMATION_UPGRADES: UpgradeSpec[] = [
  {
    old: `Hey %FIRST_NAME%, you're confirmed for the Airbnb class.[IF_DEAL] I already found a property near %CITY% worth showing you — details coming before class.[/IF_DEAL] I'll send your join link here before we start. Save this number! - Inayah`,
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

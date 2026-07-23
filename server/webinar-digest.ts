/**
 * Daily owner digest for the webinar personalization system.
 *
 * One notification a morning answering "is it working?": new registrants,
 * personalization coverage, engagement replies by intent, hot leads to call,
 * city scans, and STOPs. Sent through the existing owner notification channel.
 *
 * Kill switch: webinar_sms_settings key `daily_digest` = "off".
 */

import { eq, gte, sql } from "drizzle-orm";
import { newsletterCities, newsletterDeals, webinarRegistrants, webinarSmsSettings } from "../drizzle/schema";
import { getDb } from "./db";
import { notifyOwner } from "./_core/notification";
import { personalizationFromMetadata } from "./webinar-personalization";

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const DIGEST_SETTING_KEY = "daily_digest";
const DIGEST_LAST_SENT_KEY = "daily_digest_last_sent_date";
/** Send after 14:00 UTC — mid-morning across US timezones */
const DIGEST_SEND_HOUR_UTC = 14;

export async function maybeSendDailyDigest(db: DbClient): Promise<{ sent: boolean }> {
  const now = new Date();
  if (now.getUTCHours() < DIGEST_SEND_HOUR_UTC) return { sent: false };

  const today = now.toISOString().slice(0, 10);
  const settingRows = await db
    .select({ settingKey: webinarSmsSettings.settingKey, settingValue: webinarSmsSettings.settingValue })
    .from(webinarSmsSettings);
  const settings = new Map(settingRows.map((r) => [r.settingKey, r.settingValue]));
  if (settings.get(DIGEST_SETTING_KEY) === "off") return { sent: false };
  if (settings.get(DIGEST_LAST_SENT_KEY) === today) return { sent: false };

  // Claim today before doing the work so overlapping cycles can't double-send
  if (settings.has(DIGEST_LAST_SENT_KEY)) {
    const res = await db
      .update(webinarSmsSettings)
      .set({ settingValue: today })
      .where(sql`${webinarSmsSettings.settingKey} = ${DIGEST_LAST_SENT_KEY} AND ${webinarSmsSettings.settingValue} != ${today}`);
    if (((res as any)[0]?.affectedRows ?? 0) === 0) return { sent: false };
  } else {
    await db
      .insert(webinarSmsSettings)
      .values({ settingKey: DIGEST_LAST_SENT_KEY, settingValue: today })
      .onDuplicateKeyUpdate({ set: { settingValue: today } });
  }

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recent = await db
    .select({
      name: webinarRegistrants.name,
      email: webinarRegistrants.email,
      createdAt: webinarRegistrants.createdAt,
      metadata: webinarRegistrants.metadata,
    })
    .from(webinarRegistrants)
    .where(gte(webinarRegistrants.updatedAt, since))
    .limit(2000);

  let newRegistrants = 0;
  let located = 0;
  let withDeal = 0;
  const replies: Record<string, number> = {};
  let stops = 0;
  const hotLeads: string[] = [];
  const seenEmails = new Set<string>();

  for (const row of recent) {
    const key = (row.email || "").toLowerCase();
    if (key && seenEmails.has(key)) continue;
    if (key) seenEmails.add(key);

    if (row.createdAt && row.createdAt >= since) newRegistrants++;
    const p = personalizationFromMetadata(row.metadata);
    if (p) {
      located++;
      if (p.deal) withDeal++;
    }
    const e = (row.metadata as any)?.engagement;
    if (e?.lastReplyAt && new Date(e.lastReplyAt) >= since) {
      const intent = String(e.lastIntent || "other");
      replies[intent] = (replies[intent] ?? 0) + 1;
      if (intent === "stop") stops++;
      if (e.priority === "hot") {
        hotLeads.push(`${row.name}${p?.city ? ` (${e.cityOverride?.city || p.city})` : ""} — ${row.email}`);
      }
    }
  }

  const [scannedCities] = await db
    .select({ cnt: sql<number>`COUNT(*)` })
    .from(newsletterCities)
    .where(gte(newsletterCities.lastDealScan, since));
  const [newDeals] = await db
    .select({ cnt: sql<number>`COUNT(*)` })
    .from(newsletterDeals)
    .where(gte(newsletterDeals.discoveredAt, since));

  const replySummary = Object.entries(replies)
    .map(([intent, count]) => `${intent}: ${count}`)
    .join(", ") || "none";

  const content = [
    `Last 24h — webinar personalization`,
    ``,
    `Registrants: ${newRegistrants} new`,
    `Coverage: ${located} located, ${withDeal} with a claimable deal`,
    `Replies: ${replySummary}${stops > 0 ? ` (⚠ ${stops} STOP)` : ""}`,
    `City scans: ${Number(scannedCities?.cnt ?? 0)}, new deals: ${Number(newDeals?.cnt ?? 0)}`,
    hotLeads.length > 0 ? `\n🔥 HOT leads to call first:\n${hotLeads.slice(0, 10).map((l) => `• ${l}`).join("\n")}` : `\nNo hot leads in the last 24h.`,
  ].join("\n");

  await notifyOwner({ title: "📊 Webinar Personalization — Daily Digest", content }).catch((err) =>
    console.warn(`[Digest] notifyOwner failed:`, err.message));
  console.log(`[Digest] Daily digest sent for ${today}`);
  return { sent: true };
}

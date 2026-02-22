/**
 * Webinar Cron Scheduler
 * 
 * Seven automated SMS actions on webinar day:
 * 
 * 1. NOON ENGAGEMENT (12:00 PM Pacific)
 *    - Texts all registrants asking what they're most excited to learn
 * 
 * 2. 2-HOUR REMINDER (2:00 PM Pacific)
 *    - "We are 2 HOURS AWAY!" with live room link
 * 
 * 3. 1-HOUR REMINDER (3:00 PM Pacific)
 *    - "1 hour warning!!!" with live room link
 * 
 * 4. 15-MIN REMINDER (3:45 PM Pacific)
 *    - "Get your water, energy drink..." with live room link
 * 
 * 5. LIVE NOW (4:00 PM Pacific)
 *    - "we are live !!! LETSGOOOOO!" with live room link
 * 
 * 6. NO-SHOW BLAST (4:10 PM Pacific)
 *    - Checks who hasn't shown up 10 minutes after webinar starts
 *    - Sends AI-generated teaser from transcript to create FOMO
 *
 * 7. ATTENDEE CTA (5:00 PM Pacific)
 *    - Sends Turnkey Program CTA ONLY to people who attended
 *    - Does NOT text no-shows or people who never showed up
 *
 * All times are in America/Los_Angeles (Pacific).
 * Webinar starts at 4 PM Pacific / 7 PM Eastern.
 * 
 * The WebinarJam live room link is pulled dynamically from each registrant's
 * record (personal link) or falls back to the schedule's link. This way
 * the correct link is used each week automatically.
 */

import { getDb } from './db';
import {
  webinarSchedules,
  webinarRegistrants,
  smsConversations,
  noShowBlasts,
} from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { sendSms } from './simpletexting-client';
import { getLocalWebinarTime } from './area-code-timezone';
import { executeNoShowBlast, syncRegistrants } from './webinar-engine';
import { getSuppressedPhones, autoTagAfterWebinar } from './suppression';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

/** Timezone for all webinar scheduling — Pacific Time */
const WEBINAR_TZ = 'America/Los_Angeles';

/** Turnkey CTA link */
const TURNKEY_CTA_URL = 'https://masterclass.coachinayah.com/the-turnkey-program';

/** Check interval: every 60 seconds */
const CHECK_INTERVAL_MS = 60 * 1000;

// Schedule times (Pacific)
const NOON_HOUR = 12;
const NOON_MINUTE = 0;

const TWO_HOUR_HOUR = 14;    // 2:00 PM
const TWO_HOUR_MINUTE = 0;

const ONE_HOUR_HOUR = 15;    // 3:00 PM
const ONE_HOUR_MINUTE = 0;

const FIFTEEN_MIN_HOUR = 15; // 3:45 PM
const FIFTEEN_MIN_MINUTE = 45;

const LIVE_NOW_HOUR = 16;    // 4:00 PM
const LIVE_NOW_MINUTE = 0;

const NOSHOW_HOUR = 16;      // 4:10 PM
const NOSHOW_MINUTE = 10;

const CTA_HOUR = 17;          // 5:00 PM
const CTA_MINUTE = 0;

// ---------------------------------------------------------------------------
// MESSAGE TEMPLATES
// ---------------------------------------------------------------------------

/** Noon engagement — no link needed */
const NOON_ENGAGEMENT_MESSAGE = `Hey {{firstName}}! Coach Inayah goes LIVE at 4 PM PT / 7 PM ET today. What are you most excited to learn about?`;

/** 2-hour reminder (2 PM PST) */
const TWO_HOUR_MESSAGE = `We are 2 HOURS AWAY! Are you ready? Save your link: {{liveRoomUrl}}`;

/** 1-hour reminder (3 PM PST) */
const ONE_HOUR_MESSAGE = `1 hour warning!!! I am so excited to see you! {{liveRoomUrl}}`;

/** 15-min reminder (3:45 PM PST) */
const FIFTEEN_MIN_MESSAGE = `Get your water, energy drink, paper and pen ready! We have 15 minutes until we are LIVE!\n{{liveRoomUrl}}`;

/** Live now (4 PM PST) */
const LIVE_NOW_MESSAGE = `we are live !!! LETSGOOOOO!\n{{liveRoomUrl}}`;

/** Post-webinar CTA — attendees only, manual trigger (must stay under 160 chars after {{firstName}} substitution) */
const ATTENDEE_CTA_MESSAGE = `Hey {{firstName}} its Inayah! Turnkey spots open - start your Airbnb! Book a free call: https://masterclass.coachinayah.com/the-turnkey-program`;

/**
 * Strip emoji characters from a string.
 * Uses a simple approach that catches common emoji ranges.
 */
function stripEmoji(text: string): string {
  // Remove surrogate pairs (most emoji) and common symbol ranges
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2600-\u27BF\u2B50\u2B55\u231A-\u23F3\u23F8-\u23FA\u25AA-\u25FE\u2934-\u2935\u2190-\u21FF\u200D\uFE0F\u20E3]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Normalize a phone number to the +1XXXXXXXXXX format used in suppression list.
 */
function normalizePhoneForSuppression(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 7) return `+1${digits}`;
  return null;
}

// ---------------------------------------------------------------------------
// GENERIC BLAST SENDER
// ---------------------------------------------------------------------------

/**
 * Send a templated SMS blast to all active registrants for a schedule.
 * Replaces {{firstName}}, {{liveRoomUrl}}, {{webinarName}}, {{startTime}}.
 * The liveRoomUrl is pulled from the registrant's personal link first,
 * then falls back to the schedule-level link.
 */
export async function sendBlast(
  scheduleId: number,
  messageTemplate: string,
  messageType: 'welcome' | 'reminder' | 'no_show_blast' | 'ai_reply' | 'manual' | 'engagement',
  label: string,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [schedule] = await db
    .select()
    .from(webinarSchedules)
    .where(eq(webinarSchedules.id, scheduleId))
    .limit(1);

  if (!schedule || !schedule.isActive) {
    console.log(`[WebinarCron] Schedule ${scheduleId} not found or inactive`);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  // Get all registrants who haven't opted out
  const registrants = await db
    .select()
    .from(webinarRegistrants)
    .where(
      and(
        eq(webinarRegistrants.scheduleId, scheduleId),
        eq(webinarRegistrants.optedOut, 0)
      )
    );

  if (registrants.length === 0) {
    console.log(`[WebinarCron] No eligible registrants for ${label}`);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  // Check suppression list — skip buyers, past attendees, and DNC contacts
  const allPhones = registrants.map(r => r.phone).filter(Boolean) as string[];
  const suppressedPhones = await getSuppressedPhones(allPhones, 'reminder');
  if (suppressedPhones.size > 0) {
    console.log(`[WebinarCron] Suppressing ${suppressedPhones.size} contacts for ${label} (buyers/past attendees/DNC)`);
  }

  console.log(`[WebinarCron] Sending ${label} to ${registrants.length} registrants (${suppressedPhones.size} suppressed) for "${schedule.name}"`);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reg of registrants) {
    if (!reg.phone) {
      skipped++;
      continue;
    }

    // Check suppression list — skip buyers, past attendees, DNC
    const normalizedPhone = normalizePhoneForSuppression(reg.phone);
    if (normalizedPhone && suppressedPhones.has(normalizedPhone)) {
      skipped++;
      continue;
    }

    // Personalize the message — use registrant's personal link first, then schedule link
    const liveUrl = reg.liveRoomUrl || schedule.liveRoomUrl || '';
    const localTime = getLocalWebinarTime(reg.phone, 16); // 16 = 4 PM Pacific
    let message = messageTemplate
      .replace(/\{\{firstName\}\}/g, reg.firstName || 'there')
      .replace(/\{\{webinarName\}\}/g, schedule.name)
      .replace(/\{\{liveRoomUrl\}\}/g, liveUrl)
      .replace(/\{\{startTime\}\}/g, localTime);

    // Strip emoji and enforce 160-char limit
    message = stripEmoji(message);
    if (message.length > 160) {
      message = message.substring(0, 157) + '...';
    }

    try {
      const result = await sendSms({ contactPhone: reg.phone, text: message, mode: 'SINGLE_SMS_STRICTLY' });

      // Log the outbound SMS
      await db.insert(smsConversations).values({
        phone: reg.phone,
        direction: 'outbound',
        messageText: message,
        messageType,
        externalMessageId: result.id,
      });

      sent++;
    } catch (error) {
      console.error(`[WebinarCron] Failed to send ${label} to ${reg.phone}:`, error);
      failed++;
    }

    // Small delay between sends to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[WebinarCron] ${label} complete: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, failed, skipped };
}

// ---------------------------------------------------------------------------
// DB-AWARE MESSAGE TEMPLATES
// ---------------------------------------------------------------------------

/** Default templates keyed by blast type */
const DEFAULT_TEMPLATES: Record<string, string> = {
  noonEngagement: NOON_ENGAGEMENT_MESSAGE,
  twoHourReminder: TWO_HOUR_MESSAGE,
  oneHourReminder: ONE_HOUR_MESSAGE,
  fifteenMinReminder: FIFTEEN_MIN_MESSAGE,
  liveNow: LIVE_NOW_MESSAGE,
  noShowBlast: `You're missing out! Coach Inayah is LIVE right now. Jump in: {{liveRoomUrl}}`,
  attendeeCta: ATTENDEE_CTA_MESSAGE,
};

/**
 * Get the message template for a blast type.
 * Reads from the schedule's messageTemplates JSON column first,
 * falls back to the hardcoded default.
 */
async function getTemplate(scheduleId: number, key: string): Promise<string> {
  try {
    const db = await getDb();
    if (db) {
      const [schedule] = await db
        .select({ messageTemplates: webinarSchedules.messageTemplates })
        .from(webinarSchedules)
        .where(eq(webinarSchedules.id, scheduleId))
        .limit(1);

      if (schedule?.messageTemplates) {
        const saved = JSON.parse(schedule.messageTemplates) as Record<string, string>;
        if (saved[key]) return saved[key];
      }
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_TEMPLATES[key] || '';
}

// ---------------------------------------------------------------------------
// INDIVIDUAL BLAST FUNCTIONS (for manual triggers)
// ---------------------------------------------------------------------------

export async function executeNoonEngagement(scheduleId: number) {
  const template = await getTemplate(scheduleId, 'noonEngagement');
  return sendBlast(scheduleId, template, 'engagement', 'noon engagement');
}

export async function executeTwoHourReminder(scheduleId: number) {
  const template = await getTemplate(scheduleId, 'twoHourReminder');
  return sendBlast(scheduleId, template, 'reminder', '2-hour reminder');
}

export async function executeOneHourReminder(scheduleId: number) {
  const template = await getTemplate(scheduleId, 'oneHourReminder');
  return sendBlast(scheduleId, template, 'reminder', '1-hour reminder');
}

export async function executeFifteenMinReminder(scheduleId: number) {
  const template = await getTemplate(scheduleId, 'fifteenMinReminder');
  return sendBlast(scheduleId, template, 'reminder', '15-min reminder');
}

export async function executeLiveNowBlast(scheduleId: number) {
  const template = await getTemplate(scheduleId, 'liveNow');
  return sendBlast(scheduleId, template, 'reminder', 'live now');
}

/**
 * Send post-webinar CTA blast to ATTENDEES ONLY.
 * Filters for registrants with attendanceStatus = 'attended'.
 */
export async function executeAttendeeCta(scheduleId: number): Promise<{ sent: number; failed: number; skipped: number }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const template = await getTemplate(scheduleId, 'attendeeCta');

  const [schedule] = await db
    .select()
    .from(webinarSchedules)
    .where(eq(webinarSchedules.id, scheduleId))
    .limit(1);

  if (!schedule || !schedule.isActive) {
    console.log(`[WebinarCron] Schedule ${scheduleId} not found or inactive for CTA`);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  // CRITICAL: Sync attendance from WebinarJam before sending CTA
  try {
    const syncResult = await syncRegistrants(scheduleId);
    console.log(`[WebinarCron] Pre-CTA sync for "${schedule.name}": ${syncResult.updated} attendance updates`);
  } catch (syncErr) {
    console.warn(`[WebinarCron] Pre-CTA sync failed:`, syncErr);
  }

  // Only get registrants who ATTENDED (not no-shows, not just registered)
  const attendees = await db
    .select()
    .from(webinarRegistrants)
    .where(
      and(
        eq(webinarRegistrants.scheduleId, scheduleId),
        eq(webinarRegistrants.optedOut, 0),
        eq(webinarRegistrants.attendanceStatus, 'attended')
      )
    );

  if (attendees.length === 0) {
    console.log(`[WebinarCron] No attendees found for CTA blast on "${schedule.name}"`);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  // Check suppression list — skip buyers and DNC (but NOT past_attendees, since they attended today)
  const attendeePhones = attendees.map(r => r.phone).filter(Boolean) as string[];
  const suppressedPhones = await getSuppressedPhones(attendeePhones, 'attendee_cta');
  if (suppressedPhones.size > 0) {
    console.log(`[WebinarCron] Suppressing ${suppressedPhones.size} contacts for CTA (buyers/DNC)`);
  }

  console.log(`[WebinarCron] Sending attendee CTA to ${attendees.length} attendees (${suppressedPhones.size} suppressed) for "${schedule.name}"`);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reg of attendees) {
    if (!reg.phone) {
      skipped++;
      continue;
    }

    // Check suppression list — skip buyers and DNC
    const normalizedPhone = normalizePhoneForSuppression(reg.phone);
    if (normalizedPhone && suppressedPhones.has(normalizedPhone)) {
      skipped++;
      continue;
    }

    let message = template
      .replace(/\{\{firstName\}\}/g, reg.firstName || 'there')
      .replace(/\{\{webinarName\}\}/g, schedule.name)
      .replace(/\{\{liveRoomUrl\}\}/g, reg.liveRoomUrl || schedule.liveRoomUrl || '')
      .replace(/\{\{startTime\}\}/g, getLocalWebinarTime(reg.phone, 16));

    message = stripEmoji(message);
    if (message.length > 160) {
      message = message.substring(0, 157) + '...';
    }

    try {
      const result = await sendSms({ contactPhone: reg.phone, text: message, mode: 'SINGLE_SMS_STRICTLY' });

      await db.insert(smsConversations).values({
        phone: reg.phone,
        direction: 'outbound',
        messageText: message,
        messageType: 'manual',
        externalMessageId: result.id,
      });

      sent++;
    } catch (error) {
      console.error(`[WebinarCron] Failed to send CTA to ${reg.phone}:`, error);
      failed++;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[WebinarCron] Attendee CTA complete: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, failed, skipped };
}

// ---------------------------------------------------------------------------
// CRON SCHEDULER
// ---------------------------------------------------------------------------

/** Track whether each action has already fired today to prevent duplicates */
let lastNoonFiredDate: string | null = null;
let lastTwoHourFiredDate: string | null = null;
let lastOneHourFiredDate: string | null = null;
let lastFifteenMinFiredDate: string | null = null;
let lastLiveNowFiredDate: string | null = null;
let lastNoShowFiredDate: string | null = null;
let lastCtaFiredDate: string | null = null;
let cronInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Get the current time in Pacific timezone.
 */
function getNowInPacific(): { hour: number; minute: number; dayOfWeek: number; dateStr: string } {
  const now = new Date();
  const ptStr = now.toLocaleString('en-US', { timeZone: WEBINAR_TZ });
  const ptDate = new Date(ptStr);

  return {
    hour: ptDate.getHours(),
    minute: ptDate.getMinutes(),
    dayOfWeek: ptDate.getDay(), // 0 = Sunday
    dateStr: ptDate.toISOString().split('T')[0],
  };
}

/**
 * Fire a blast for all today's schedules.
 */
async function fireBlast(
  todaySchedules: { id: number; name: string }[],
  blastFn: (scheduleId: number) => Promise<{ sent: number; failed: number; skipped: number }>,
  label: string,
): Promise<void> {
  for (const schedule of todaySchedules) {
    try {
      const result = await blastFn(schedule.id);
      console.log(`[WebinarCron] ${label} for "${schedule.name}": ${result.sent} sent`);
    } catch (error) {
      console.error(`[WebinarCron] ${label} failed for "${schedule.name}":`, error);
    }
  }
}

/**
 * Check if it's time to fire any automated action.
 * Runs every minute via setInterval.
 */
async function cronTick(): Promise<void> {
  const { hour, minute, dayOfWeek, dateStr } = getNowInPacific();

  // Only run on webinar days — check which schedules have today as their day
  const db = await getDb();
  if (!db) return;

  const activeSchedules = await db
    .select()
    .from(webinarSchedules)
    .where(eq(webinarSchedules.isActive, 1));

  // Filter to schedules whose dayOfWeek matches today
  const todaySchedules = activeSchedules.filter(s => s.dayOfWeek === dayOfWeek);

  if (todaySchedules.length === 0) return;

  // NOON ENGAGEMENT: 12:00 PM Pacific
  if (hour === NOON_HOUR && minute === NOON_MINUTE && lastNoonFiredDate !== dateStr) {
    lastNoonFiredDate = dateStr;
    console.log(`[WebinarCron] Noon engagement time! Firing for ${todaySchedules.length} schedule(s)`);
    await fireBlast(todaySchedules, executeNoonEngagement, 'Noon engagement');
  }

  // 2-HOUR REMINDER: 2:00 PM Pacific
  if (hour === TWO_HOUR_HOUR && minute === TWO_HOUR_MINUTE && lastTwoHourFiredDate !== dateStr) {
    lastTwoHourFiredDate = dateStr;
    console.log(`[WebinarCron] 2-hour reminder time! Firing for ${todaySchedules.length} schedule(s)`);
    await fireBlast(todaySchedules, executeTwoHourReminder, '2-hour reminder');
  }

  // 1-HOUR REMINDER: 3:00 PM Pacific
  if (hour === ONE_HOUR_HOUR && minute === ONE_HOUR_MINUTE && lastOneHourFiredDate !== dateStr) {
    lastOneHourFiredDate = dateStr;
    console.log(`[WebinarCron] 1-hour reminder time! Firing for ${todaySchedules.length} schedule(s)`);
    await fireBlast(todaySchedules, executeOneHourReminder, '1-hour reminder');
  }

  // 15-MIN REMINDER: 3:45 PM Pacific
  if (hour === FIFTEEN_MIN_HOUR && minute === FIFTEEN_MIN_MINUTE && lastFifteenMinFiredDate !== dateStr) {
    lastFifteenMinFiredDate = dateStr;
    console.log(`[WebinarCron] 15-min reminder time! Firing for ${todaySchedules.length} schedule(s)`);
    await fireBlast(todaySchedules, executeFifteenMinReminder, '15-min reminder');
  }

  // LIVE NOW: 4:00 PM Pacific
  if (hour === LIVE_NOW_HOUR && minute === LIVE_NOW_MINUTE && lastLiveNowFiredDate !== dateStr) {
    lastLiveNowFiredDate = dateStr;
    console.log(`[WebinarCron] LIVE NOW time! Firing for ${todaySchedules.length} schedule(s)`);
    await fireBlast(todaySchedules, executeLiveNowBlast, 'Live now');
  }

  // ATTENDEE CTA: Manual only — removed from automated cron.
  // Use manualTriggerAttendeeCta() from the admin dashboard.

  // NO-SHOW BLAST: 4:10 PM Pacific
  if (hour === NOSHOW_HOUR && minute === NOSHOW_MINUTE && lastNoShowFiredDate !== dateStr) {
    lastNoShowFiredDate = dateStr;
    console.log(`[WebinarCron] No-show blast time! Firing for ${todaySchedules.length} schedule(s)`);

    for (const schedule of todaySchedules) {
      try {
        // CRITICAL: Sync attendance from WebinarJam RIGHT BEFORE the blast
        try {
          const syncResult = await syncRegistrants(schedule.id);
          console.log(`[WebinarCron] Pre-blast sync for "${schedule.name}": ${syncResult.updated} attendance updates`);
        } catch (syncErr) {
          console.warn(`[WebinarCron] Pre-blast sync failed (blast will still use WJ API directly):`, syncErr);
        }

        const result = await executeNoShowBlast(schedule.id, 'manual');
        console.log(`[WebinarCron] No-show blast for "${schedule.name}": ${result.noShowCount} no-shows, ${result.smsSent} sent`);
      } catch (error) {
        console.error(`[WebinarCron] No-show blast failed for "${schedule.name}":`, error);
      }
    }

    // Auto-tag attendees and no-shows in the suppression list for next week's logic
    for (const schedule of todaySchedules) {
      try {
        const tagResult = await autoTagAfterWebinar(schedule.id);
        console.log(`[WebinarCron] Auto-tagged for "${schedule.name}": ${tagResult.attendeesTagged} attendees, ${tagResult.noShowsTagged} no-shows`);
      } catch (tagErr) {
        console.error(`[WebinarCron] Auto-tag failed for "${schedule.name}":`, tagErr);
      }
    }
  }
}

/**
 * Start the webinar cron scheduler.
 * Checks every minute if it's time to fire any blast.
 */
export function startWebinarCron(): void {
  if (cronInterval) {
    console.log('[WebinarCron] Already running');
    return;
  }

  console.log('[WebinarCron] Starting cron scheduler (checking every 60s)');
  console.log(`[WebinarCron] Schedule: 12:00 noon | 2:00 PM 2hr | 3:00 PM 1hr | 3:45 PM 15min | 4:00 PM live | 4:10 PM no-show + auto-tag | CTA = manual only`);

  // Run a check immediately
  cronTick().catch(err => console.error('[WebinarCron] Initial tick failed:', err));

  // Then check every minute
  cronInterval = setInterval(() => {
    cronTick().catch(err => console.error('[WebinarCron] Tick failed:', err));
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the webinar cron scheduler.
 */
export function stopWebinarCron(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log('[WebinarCron] Cron scheduler stopped');
  }
}

/**
 * Check if the cron scheduler is running.
 */
export function isCronActive(): boolean {
  return cronInterval !== null;
}

/**
 * Get the next scheduled fire times for display in the admin UI.
 */
export function getNextFireTimes(): {
  noonEngagement: { time: string; firedToday: boolean };
  twoHourReminder: { time: string; firedToday: boolean };
  oneHourReminder: { time: string; firedToday: boolean };
  fifteenMinReminder: { time: string; firedToday: boolean };
  liveNow: { time: string; firedToday: boolean };
  noShowBlast: { time: string; firedToday: boolean };
  attendeeCta: { time: string; firedToday: boolean };
} {
  const { dateStr } = getNowInPacific();

  return {
    noonEngagement: {
      time: `12:00 PM Pacific`,
      firedToday: lastNoonFiredDate === dateStr,
    },
    twoHourReminder: {
      time: `2:00 PM Pacific`,
      firedToday: lastTwoHourFiredDate === dateStr,
    },
    oneHourReminder: {
      time: `3:00 PM Pacific`,
      firedToday: lastOneHourFiredDate === dateStr,
    },
    fifteenMinReminder: {
      time: `3:45 PM Pacific`,
      firedToday: lastFifteenMinFiredDate === dateStr,
    },
    liveNow: {
      time: `4:00 PM Pacific`,
      firedToday: lastLiveNowFiredDate === dateStr,
    },
    noShowBlast: {
      time: `4:10 PM Pacific`,
      firedToday: lastNoShowFiredDate === dateStr,
    },
    attendeeCta: {
      time: `Manual Only`,
      firedToday: lastCtaFiredDate === dateStr,
    },
  };
}

/**
 * Manually trigger the noon engagement for testing.
 * Bypasses the day-of-week check.
 */
export async function manualTriggerNoonEngagement(): Promise<{
  schedulesFired: number;
  totalSent: number;
  totalFailed: number;
}> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const activeSchedules = await db
    .select()
    .from(webinarSchedules)
    .where(eq(webinarSchedules.isActive, 1));

  let totalSent = 0;
  let totalFailed = 0;

  for (const schedule of activeSchedules) {
    const result = await executeNoonEngagement(schedule.id);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { schedulesFired: activeSchedules.length, totalSent, totalFailed };
}

/**
 * Manually trigger the no-show blast for testing.
 * Bypasses the day-of-week check.
 */
export async function manualTriggerNoShowBlast(): Promise<{
  schedulesFired: number;
  totalNoShows: number;
  totalSent: number;
}> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const activeSchedules = await db
    .select()
    .from(webinarSchedules)
    .where(eq(webinarSchedules.isActive, 1));

  let totalNoShows = 0;
  let totalSent = 0;

  for (const schedule of activeSchedules) {
    const result = await executeNoShowBlast(schedule.id, 'manual');
    totalNoShows += result.noShowCount;
    totalSent += result.smsSent;
  }

  return { schedulesFired: activeSchedules.length, totalNoShows, totalSent };
}

/**
 * Manually trigger the Attendee CTA blast.
 * This is the ONLY way to fire the CTA — it is NOT on the automated timer.
 */
export async function manualTriggerAttendeeCta(): Promise<{
  schedulesFired: number;
  totalSent: number;
  totalFailed: number;
  totalSkipped: number;
}> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const activeSchedules = await db
    .select()
    .from(webinarSchedules)
    .where(eq(webinarSchedules.isActive, 1));

  let totalSent = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const schedule of activeSchedules) {
    const result = await executeAttendeeCta(schedule.id);
    totalSent += result.sent;
    totalFailed += result.failed;
    totalSkipped += result.skipped;
  }

  // Mark as fired so the status shows it
  const { dateStr } = getNowInPacific();
  lastCtaFiredDate = dateStr;

  return { schedulesFired: activeSchedules.length, totalSent, totalFailed, totalSkipped };
}

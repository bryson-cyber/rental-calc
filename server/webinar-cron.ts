/**
 * Webinar Cron Scheduler
 * 
 * Two automated SMS actions on webinar day (Sunday):
 * 
 * 1. NOON ENGAGEMENT (12:00 PM Pacific / 3:00 PM Eastern)
 *    - Texts all registrants asking what they're most excited to learn
 *    - AI-generated from the webinar transcript
 *    - Kicks off a conversation thread — AI handles all replies
 * 
 * 2. NO-SHOW BLAST (4:10 PM Pacific / 7:10 PM Eastern)
 *    - Checks who hasn't shown up 10 minutes after webinar starts (4 PM Pacific)
 *    - Sends AI-generated teaser from transcript to create FOMO
 *    - AI handles replies from no-shows too
 * 
 * All times are in America/Los_Angeles (Pacific).
 * Webinar starts at 4 PM Pacific / 7 PM Eastern.
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

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

/** Timezone for all webinar scheduling — Pacific Time */
const WEBINAR_TZ = 'America/Los_Angeles';

/** Noon engagement text goes out at 12:00 PM Pacific */
const NOON_HOUR = 12;
const NOON_MINUTE = 0;

/** No-show blast goes out at 4:10 PM Pacific (10 min after 4 PM start) */
const NOSHOW_HOUR = 16;
const NOSHOW_MINUTE = 10;

/** Check interval: every 60 seconds */
const CHECK_INTERVAL_MS = 60 * 1000;

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

// ---------------------------------------------------------------------------
// NOON ENGAGEMENT BLAST
// ---------------------------------------------------------------------------

/**
 * Fixed noon engagement message.
 * No AI generation — sends this exact message every time.
 * The {{firstName}} placeholder is replaced per-registrant.
 */
const NOON_ENGAGEMENT_MESSAGE = `Hey {{firstName}}! Coach Inayah goes LIVE at 4 PM PT / 7 PM ET today. What are you most excited to learn about?`;

/**
 * Execute the noon engagement blast.
 * Sends a personalized "what are you excited about?" text to all registrants.
 */
export async function executeNoonEngagement(scheduleId: number): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
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
    console.log(`[WebinarCron] No eligible registrants for noon engagement`);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  // Use the fixed engagement message (no AI generation)
  const messageTemplate = NOON_ENGAGEMENT_MESSAGE;

  console.log(`[WebinarCron] Sending noon engagement to ${registrants.length} registrants for "${schedule.name}"`);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reg of registrants) {
    if (!reg.phone) {
      skipped++;
      continue;
    }

    // Personalize the message with timezone-aware time
    const localTime = getLocalWebinarTime(reg.phone, 16); // 16 = 4 PM Pacific
    let message = messageTemplate
      .replace(/\{\{firstName\}\}/g, reg.firstName || 'there')
      .replace(/\{\{webinarName\}\}/g, schedule.name)
      .replace(/\{\{liveRoomUrl\}\}/g, reg.liveRoomUrl || schedule.liveRoomUrl || '')
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
        messageType: 'engagement',
        externalMessageId: result.id,
      });

      sent++;
    } catch (error) {
      console.error(`[WebinarCron] Failed to send noon engagement to ${reg.phone}:`, error);
      failed++;
    }

    // Small delay between sends to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[WebinarCron] Noon engagement complete: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, failed, skipped };
}

// ---------------------------------------------------------------------------
// CRON SCHEDULER
// ---------------------------------------------------------------------------

/** Track whether each action has already fired today to prevent duplicates */
let lastNoonFiredDate: string | null = null;
let lastNoShowFiredDate: string | null = null;
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
 * Check if it's time to fire either automated action.
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

  // NOON ENGAGEMENT: Fire at 12:00 PM Pacific
  if (hour === NOON_HOUR && minute === NOON_MINUTE && lastNoonFiredDate !== dateStr) {
    lastNoonFiredDate = dateStr;
    console.log(`[WebinarCron] Noon engagement time! Firing for ${todaySchedules.length} schedule(s)`);

    for (const schedule of todaySchedules) {
      try {
        const result = await executeNoonEngagement(schedule.id);
        console.log(`[WebinarCron] Noon engagement for "${schedule.name}": ${result.sent} sent`);
      } catch (error) {
        console.error(`[WebinarCron] Noon engagement failed for "${schedule.name}":`, error);
      }
    }
  }

  // NO-SHOW BLAST: Fire at 4:10 PM Pacific
  if (hour === NOSHOW_HOUR && minute === NOSHOW_MINUTE && lastNoShowFiredDate !== dateStr) {
    lastNoShowFiredDate = dateStr;
    console.log(`[WebinarCron] No-show blast time! Firing for ${todaySchedules.length} schedule(s)`);

    for (const schedule of todaySchedules) {
      try {
        // CRITICAL: Sync attendance from WebinarJam RIGHT BEFORE the blast
        // so our local DB has the freshest attended_live data.
        // This prevents texting people who joined the room in the last few minutes.
        try {
          // syncRegistrants is imported at the top of this file
          const syncResult = await syncRegistrants(schedule.id);
          console.log(`[WebinarCron] Pre-blast sync for "${schedule.name}": ${syncResult.updated} attendance updates`);
        } catch (syncErr) {
          console.warn(`[WebinarCron] Pre-blast sync failed (blast will still use WJ API directly):`, syncErr);
        }

        const result = await executeNoShowBlast(schedule.id, 'cron');
        console.log(`[WebinarCron] No-show blast for "${schedule.name}": ${result.noShowCount} no-shows, ${result.smsSent} sent`);
      } catch (error) {
        console.error(`[WebinarCron] No-show blast failed for "${schedule.name}":`, error);
      }
    }
  }
}

/**
 * Start the webinar cron scheduler.
 * Checks every minute if it's time to fire noon engagement or no-show blast.
 */
export function startWebinarCron(): void {
  if (cronInterval) {
    console.log('[WebinarCron] Already running');
    return;
  }

  console.log('[WebinarCron] Starting cron scheduler (checking every 60s)');
  console.log(`[WebinarCron] Noon engagement: ${NOON_HOUR}:${String(NOON_MINUTE).padStart(2, '0')} Pacific on webinar days`);
  console.log(`[WebinarCron] No-show blast: ${NOSHOW_HOUR}:${String(NOSHOW_MINUTE).padStart(2, '0')} Pacific on webinar days`);

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
  noShowBlast: { time: string; firedToday: boolean };
} {
  const { dateStr } = getNowInPacific();

  return {
    noonEngagement: {
      time: `12:00 PM Pacific`,
      firedToday: lastNoonFiredDate === dateStr,
    },
    noShowBlast: {
      time: `4:10 PM Pacific`,
      firedToday: lastNoShowFiredDate === dateStr,
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

/**
 * Webinar Cron Scheduler
 * 
 * Two automated SMS actions on webinar day (Sunday):
 * 
 * 1. NOON ENGAGEMENT (12:00 PM EST)
 *    - Texts all registrants asking what they're most excited to learn
 *    - AI-generated from the webinar transcript
 *    - Kicks off a conversation thread — AI handles all replies
 * 
 * 2. NO-SHOW BLAST (4:10 PM EST)
 *    - Checks who hasn't shown up 10 minutes after webinar starts (4 PM EST)
 *    - Sends AI-generated teaser from transcript to create FOMO
 *    - AI handles replies from no-shows too
 * 
 * All times are in America/New_York (EST/EDT).
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
import { getRandomTeaser, generateTeasersFromTranscript, buildTranscriptAwareSystemPrompt } from './webinar-ai-content';
import { routedLLMCall, FEATURES } from './model-router';
import { executeNoShowBlast } from './webinar-engine';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

/** Timezone for all webinar scheduling */
const WEBINAR_TZ = 'America/New_York';

/** Noon engagement text goes out at 12:00 PM EST */
const NOON_HOUR = 12;
const NOON_MINUTE = 0;

/** No-show blast goes out at 4:10 PM EST (10 min after 4 PM start) */
const NOSHOW_HOUR = 16;
const NOSHOW_MINUTE = 10;

/** Check interval: every 60 seconds */
const CHECK_INTERVAL_MS = 60 * 1000;

// ---------------------------------------------------------------------------
// NOON ENGAGEMENT BLAST
// ---------------------------------------------------------------------------

/**
 * System prompt for generating the noon engagement message.
 * The AI reads the transcript and writes a casual, exciting question
 * that gets registrants thinking about the webinar.
 */
const NOON_ENGAGEMENT_SYSTEM_PROMPT = `You are Coach Inayah's SMS assistant. You're texting someone who signed up for today's live webinar about starting a profitable Airbnb business.

Your job: Write a SHORT, warm, conversational text asking what they're most excited to learn about today. 

Rules:
- 2-3 sentences MAX (this is SMS, not email)
- Use their first name with {{firstName}}
- Reference 2-3 SPECIFIC topics from the webinar transcript so they know what's coming
- Make it feel like a personal text, not a marketing blast
- Use 1-2 emojis max
- End with an open question that invites a reply
- Casual, warm tone — like a friend checking in before an event

Example tone: "Hey {{firstName}}! Today's the day 🔥 We're covering everything from finding your first deal to getting funded with zero out of pocket. What part are you most excited about?"`;

/**
 * Generate a noon engagement message using the transcript.
 * Each registrant gets a slightly personalized version.
 */
async function generateNoonEngagementMessage(transcript: string | null): Promise<string> {
  if (!transcript || transcript.length < 100) {
    return `Hey {{firstName}}! 🔥 Today's the day — Coach Inayah goes LIVE at 4 PM EST. What are you most excited to learn about?`;
  }

  // Use a relevant excerpt
  const excerpt = transcript.length > 3000
    ? transcript.substring(0, 3000)
    : transcript;

  const prompt = `Here's what the webinar covers:\n\n---\n${excerpt}\n---\n\nWrite a noon engagement text for today's webinar. Use {{firstName}} as the name placeholder:`;

  try {
    const response = await routedLLMCall(FEATURES.WEBINAR_SMS_CONTENT, prompt, {
      systemPrompt: NOON_ENGAGEMENT_SYSTEM_PROMPT,
      maxTokens: 200,
    });

    return response.trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('[WebinarCron] Failed to generate noon engagement message:', error);
    return `Hey {{firstName}}! 🔥 Today's the day — Coach Inayah goes LIVE at 4 PM EST. What are you most excited to learn about?`;
  }
}

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

  // Generate the engagement message template from transcript
  const messageTemplate = await generateNoonEngagementMessage(schedule.webinarTranscript);

  console.log(`[WebinarCron] Sending noon engagement to ${registrants.length} registrants for "${schedule.name}"`);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reg of registrants) {
    if (!reg.phone) {
      skipped++;
      continue;
    }

    // Personalize the message
    const message = messageTemplate
      .replace(/\{\{firstName\}\}/g, reg.firstName || 'there')
      .replace(/\{\{webinarName\}\}/g, schedule.name)
      .replace(/\{\{liveRoomUrl\}\}/g, reg.liveRoomUrl || schedule.liveRoomUrl || '')
      .replace(/\{\{startTime\}\}/g, schedule.startTime || '4 PM EST');

    try {
      const result = await sendSms({ contactPhone: reg.phone, text: message });

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
 * Get the current time in EST/EDT.
 */
function getNowInEST(): { hour: number; minute: number; dayOfWeek: number; dateStr: string } {
  const now = new Date();
  const estStr = now.toLocaleString('en-US', { timeZone: WEBINAR_TZ });
  const estDate = new Date(estStr);

  return {
    hour: estDate.getHours(),
    minute: estDate.getMinutes(),
    dayOfWeek: estDate.getDay(), // 0 = Sunday
    dateStr: estDate.toISOString().split('T')[0],
  };
}

/**
 * Check if it's time to fire either automated action.
 * Runs every minute via setInterval.
 */
async function cronTick(): Promise<void> {
  const { hour, minute, dayOfWeek, dateStr } = getNowInEST();

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

  // NOON ENGAGEMENT: Fire at 12:00 PM EST
  if (hour === NOON_HOUR && minute === NOON_MINUTE && lastNoonFiredDate !== dateStr) {
    lastNoonFiredDate = dateStr;
    console.log(`[WebinarCron] 🕛 Noon engagement time! Firing for ${todaySchedules.length} schedule(s)`);

    for (const schedule of todaySchedules) {
      try {
        const result = await executeNoonEngagement(schedule.id);
        console.log(`[WebinarCron] Noon engagement for "${schedule.name}": ${result.sent} sent`);
      } catch (error) {
        console.error(`[WebinarCron] Noon engagement failed for "${schedule.name}":`, error);
      }
    }
  }

  // NO-SHOW BLAST: Fire at 4:10 PM EST
  if (hour === NOSHOW_HOUR && minute === NOSHOW_MINUTE && lastNoShowFiredDate !== dateStr) {
    lastNoShowFiredDate = dateStr;
    console.log(`[WebinarCron] 🚨 No-show blast time! Firing for ${todaySchedules.length} schedule(s)`);

    for (const schedule of todaySchedules) {
      try {
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
  console.log(`[WebinarCron] Noon engagement: ${NOON_HOUR}:${String(NOON_MINUTE).padStart(2, '0')} EST on webinar days`);
  console.log(`[WebinarCron] No-show blast: ${NOSHOW_HOUR}:${String(NOSHOW_MINUTE).padStart(2, '0')} EST on webinar days`);

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
  const { dateStr } = getNowInEST();

  return {
    noonEngagement: {
      time: `12:00 PM EST`,
      firedToday: lastNoonFiredDate === dateStr,
    },
    noShowBlast: {
      time: `4:10 PM EST`,
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

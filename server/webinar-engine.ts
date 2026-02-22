/**
 * Webinar Show-Up Machine — Core Engine
 * 
 * Three main capabilities:
 * 1. Pre-webinar reminder scheduler (24h, morning of, 1h before, at start)
 * 2. No-show blaster (fetch no-shows from WebinarJam, send SMS with live room link)
 * 3. AI conversation engine (incoming SMS → Claude/Gemini → auto-reply)
 * 
 * All operations are owner-only and configurable from the admin dashboard.
 */

import { getDb } from './db';
import {
  webinarSchedules,
  webinarRegistrants,
  smsConversations,
  reminderTemplates,
  noShowBlasts,
  type WebinarSchedule,
  type WebinarRegistrant,
  type InsertWebinarRegistrant,
  type InsertSmsConversation,
} from '../drizzle/schema';
import { eq, and, lte, gte, desc, inArray, sql } from 'drizzle-orm';
import { sendSms, sendBulkSms, renderTemplate } from './simpletexting-client';
import { getNoShows, getRegistrants, syncRegistrantsFromWebinarJam } from './webinarjam-client';
import { routedLLMCall, FEATURES } from './model-router';
import { getRandomTeaser, buildTranscriptAwareSystemPrompt } from './webinar-ai-content';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Strip emoji characters from a string.
 * Removes surrogate pairs (most emoji) and common symbol ranges.
 */
function stripEmoji(text: string): string {
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2600-\u27BF\u2B50\u2B55\u231A-\u23F3\u23F8-\u23FA\u25AA-\u25FE\u2934-\u2935\u2190-\u21FF\u200D\uFE0F\u20E3]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// COACH INAYAH AI PERSONA
// ---------------------------------------------------------------------------

// Static fallback system prompt (used when no transcript is available)
const COACH_INAYAH_SYSTEM_PROMPT_FALLBACK = `You are Coach Inayah's AI assistant, texting on behalf of her webinar team. Your personality:

- WARM, ENCOURAGING, and REAL — like a big sister who's been through it and wants to help
- You use casual, conversational language (not corporate speak)
- DO NOT use any emoji whatsoever — keep it clean text only
- You're knowledgeable about short-term rentals, Airbnb arbitrage, and building wealth through real estate
- You keep responses SHORT (2-4 sentences max — this is SMS, not email)
- Each response MUST be under 155 characters total to fit in a single SMS segment
- The webinar is at 4 PM Pacific / 7 PM Eastern
- You always try to get the person to JOIN THE LIVE WEBINAR
- If they ask about the webinar topic, it's about how to start a profitable Airbnb business with little to no money down
- If they ask about Coach Inayah, she's a successful Airbnb entrepreneur who's helped hundreds of people build rental businesses
- If they want to unsubscribe, be respectful and say "No problem! I've removed you from our list. Wishing you the best!"
- NEVER make up specific financial claims or guarantees
- NEVER share personal information about Coach Inayah beyond what's public
- If you don't know something, say "Great question! Coach Inayah will cover that in the live session"

Your goal: Get them excited and into the live webinar room. Be helpful, be real, be brief.`;

// ---------------------------------------------------------------------------
// REMINDER ENGINE
// ---------------------------------------------------------------------------

/**
 * Default reminder templates for each stage.
 * These are used as fallbacks if no custom templates exist in the database.
 */
const DEFAULT_TEMPLATES: Record<number, string> = {
  1: `Hey {{firstName}}! Coach Inayah goes LIVE tomorrow at {{startTime}}. You'll learn how to start your Airbnb business. Don't miss it!`,
  2: `{{firstName}}, today's the day! Coach Inayah goes LIVE at {{startTime}}. See you there!`,
  3: `{{firstName}}, we go live in 1 HOUR at {{startTime}}. Join here: {{liveRoomUrl}}`,
  4: `{{firstName}}, we're LIVE RIGHT NOW. Jump in: {{liveRoomUrl}}`,
  5: `{{firstName}}, we're LIVE right now covering {{noShowTeaser}}. Jump in: {{liveRoomUrl}}`,
};

/**
 * Get the active reminder template for a given stage.
 * Falls back to default if no custom template exists.
 */
export async function getReminderTemplate(stage: number): Promise<string> {
  const db = await getDb();
  if (!db) return DEFAULT_TEMPLATES[stage] || '';

  const [template] = await db
    .select()
    .from(reminderTemplates)
    .where(and(eq(reminderTemplates.stage, stage), eq(reminderTemplates.isActive, 1)))
    .limit(1);

  return template?.messageTemplate || DEFAULT_TEMPLATES[stage] || '';
}

/**
 * Send reminders for a specific stage to all eligible registrants of a schedule.
 * 
 * @param scheduleId - The webinar schedule to send reminders for
 * @param stage - Reminder stage (1=24h, 2=morning, 3=1h, 4=start)
 * @returns Summary of sent/failed messages
 */
export async function sendReminders(
  scheduleId: number,
  stage: number
): Promise<{ sent: number; failed: number; skipped: number }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get the schedule
  const [schedule] = await db
    .select()
    .from(webinarSchedules)
    .where(eq(webinarSchedules.id, scheduleId))
    .limit(1);

  if (!schedule || !schedule.isActive) {
    console.log(`[WebinarEngine] Schedule ${scheduleId} not found or inactive`);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  // Get eligible registrants (not opted out, reminder stage < current stage)
  const registrants = await db
    .select()
    .from(webinarRegistrants)
    .where(
      and(
        eq(webinarRegistrants.scheduleId, scheduleId),
        eq(webinarRegistrants.optedOut, 0),
        lte(webinarRegistrants.lastReminderStage, stage - 1)
      )
    );

  if (registrants.length === 0) {
    console.log(`[WebinarEngine] No eligible registrants for schedule ${scheduleId}, stage ${stage}`);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  // Get the template
  const template = await getReminderTemplate(stage);
  if (!template) {
    console.error(`[WebinarEngine] No template found for stage ${stage}`);
    return { sent: 0, failed: 0, skipped: registrants.length };
  }

  console.log(`[WebinarEngine] Sending stage ${stage} reminders to ${registrants.length} registrants for "${schedule.name}"`);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reg of registrants) {
    if (!reg.phone) {
      skipped++;
      continue;
    }

    let message = renderTemplate(template, {
      firstName: reg.firstName || 'there',
      webinarName: schedule.name,
      liveRoomUrl: reg.liveRoomUrl || schedule.liveRoomUrl || '',
      startTime: schedule.startTime,
      date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      noShowTeaser: schedule.noShowTeaser || 'the strategies that are changing lives',
    });

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
        messageType: 'reminder',
        externalMessageId: result.id,
      });

      // Update registrant's last reminder stage
      await db
        .update(webinarRegistrants)
        .set({ lastReminderStage: stage })
        .where(eq(webinarRegistrants.id, reg.id));

      sent++;
    } catch (error) {
      console.error(`[WebinarEngine] Failed to send reminder to ${reg.phone}:`, error);
      failed++;
    }

    // Small delay between sends to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[WebinarEngine] Stage ${stage} complete: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, failed, skipped };
}

// ---------------------------------------------------------------------------
// NO-SHOW BLASTER
// ---------------------------------------------------------------------------

/**
 * Execute a no-show blast for a specific webinar schedule.
 * 
 * 1. Fetches no-shows from WebinarJam API
 * 2. Cross-references with local registrants
 * 3. Sends personalized SMS with live room link
 * 4. Logs the blast event
 * 
 * @param scheduleId - Local schedule ID
 * @param triggeredBy - Who triggered the blast (for audit trail)
 * @returns Blast summary
 */
export async function executeNoShowBlast(
  scheduleId: number,
  triggeredBy: string = 'owner'
): Promise<{
  blastId: number;
  noShowCount: number;
  smsSent: number;
  smsFailed: number;
}> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get the schedule
  const [schedule] = await db
    .select()
    .from(webinarSchedules)
    .where(eq(webinarSchedules.id, scheduleId))
    .limit(1);

  if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

  // Create blast record
  const [blastRecord] = await db.insert(noShowBlasts).values({
    scheduleId,
    noShowCount: 0,
    smsSentCount: 0,
    smsFailedCount: 0,
    triggeredBy,
    status: 'in_progress',
  }).$returningId();

  const blastId = blastRecord.id;

  try {
    // Get registrants who haven't been blasted yet and aren't opted out
    const localRegistrants = await db
      .select()
      .from(webinarRegistrants)
      .where(
        and(
          eq(webinarRegistrants.scheduleId, scheduleId),
          eq(webinarRegistrants.noShowBlastSent, 0),
          eq(webinarRegistrants.optedOut, 0),
          eq(webinarRegistrants.attendanceStatus, 'registered') // Not yet marked as attended
        )
      );

    if (localRegistrants.length === 0) {
      await db.update(noShowBlasts).set({
        noShowCount: 0,
        smsSentCount: 0,
        status: 'completed',
      }).where(eq(noShowBlasts.id, blastId));

      return { blastId, noShowCount: 0, smsSent: 0, smsFailed: 0 };
    }

    // If we have WebinarJam IDs, also cross-reference with their API
    let noShowPhones = new Set<string>();
    if (schedule.webinarjamWebinarId && schedule.webinarjamScheduleId) {
      try {
        const wjNoShows = await getNoShows(
          schedule.webinarjamWebinarId,
          schedule.webinarjamScheduleId
        );
        wjNoShows.forEach(ns => noShowPhones.add(ns.phone));
        console.log(`[WebinarEngine] WebinarJam reports ${wjNoShows.length} no-shows`);
      } catch (error) {
        console.warn(`[WebinarEngine] WebinarJam API failed, using local data only:`, error);
        // Fall back to local registrants only
        localRegistrants.forEach(r => noShowPhones.add(r.phone));
      }
    } else {
      // No WebinarJam integration — use all local registrants who haven't attended
      localRegistrants.forEach(r => noShowPhones.add(r.phone));
    }

    // Filter local registrants to only those in the no-show set
    const noShowRegistrants = localRegistrants.filter(r => noShowPhones.has(r.phone));

    // Get the no-show blast template
    const template = await getReminderTemplate(5);

    let smsSent = 0;
    let smsFailed = 0;

    for (const reg of noShowRegistrants) {
      // Use a random AI-generated teaser for variety in no-show blasts
      const teaser = await getRandomTeaser(scheduleId);

      let message = renderTemplate(template, {
        firstName: reg.firstName || 'there',
        webinarName: schedule.name,
        liveRoomUrl: reg.liveRoomUrl || schedule.liveRoomUrl || '',
        startTime: schedule.startTime,
        noShowTeaser: teaser,
        date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      });

      // Strip emoji and enforce 160-char limit
      message = stripEmoji(message);
      if (message.length > 160) {
        message = message.substring(0, 157) + '...';
      }

      try {
        const result = await sendSms({ contactPhone: reg.phone, text: message, mode: 'SINGLE_SMS_STRICTLY' });

        // Log outbound SMS
        await db.insert(smsConversations).values({
          phone: reg.phone,
          direction: 'outbound',
          messageText: message,
          messageType: 'no_show_blast',
          externalMessageId: result.id,
        });

        // Mark registrant as blasted
        await db
          .update(webinarRegistrants)
          .set({ noShowBlastSent: 1, attendanceStatus: 'no_show' })
          .where(eq(webinarRegistrants.id, reg.id));

        smsSent++;
      } catch (error) {
        console.error(`[WebinarEngine] Failed no-show SMS to ${reg.phone}:`, error);
        smsFailed++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update blast record
    await db.update(noShowBlasts).set({
      noShowCount: noShowRegistrants.length,
      smsSentCount: smsSent,
      smsFailedCount: smsFailed,
      status: 'completed',
    }).where(eq(noShowBlasts.id, blastId));

    console.log(`[WebinarEngine] No-show blast complete: ${noShowRegistrants.length} no-shows, ${smsSent} sent, ${smsFailed} failed`);

    return {
      blastId,
      noShowCount: noShowRegistrants.length,
      smsSent,
      smsFailed,
    };
  } catch (error) {
    // Mark blast as failed
    await db.update(noShowBlasts).set({ status: 'failed' }).where(eq(noShowBlasts.id, blastId));
    throw error;
  }
}

// ---------------------------------------------------------------------------
// AI CONVERSATION ENGINE
// ---------------------------------------------------------------------------

/**
 * Determine which AI provider to use based on the incoming message.
 * 
 * Rule from requirements:
 * - If message contains real-time/search keywords → Gemini (with search capability)
 * - Everything else → Claude (Sonnet for fast, conversational replies)
 */
function routeToProvider(message: string): 'gemini' | 'sonnet' {
  const searchKeywords = [
    'latest', 'current', 'news', 'price', 'today', 'right now',
    'market', 'trending', 'recent', 'update', 'stock', 'rate',
  ];

  const lowerMessage = message.toLowerCase();
  const needsSearch = searchKeywords.some(kw => lowerMessage.includes(kw));

  return needsSearch ? 'gemini' : 'sonnet';
}

/**
 * Handle an incoming SMS message and generate an AI response.
 * 
 * Flow:
 * 1. Log the inbound message
 * 2. Check for opt-out keywords
 * 3. Load conversation history for context
 * 4. Route to appropriate AI provider
 * 5. Send the AI response back via SMS
 * 6. Log the outbound message
 * 
 * @param phone - Sender's phone number
 * @param messageText - The incoming message text
 * @returns The AI response text
 */
export async function handleIncomingSms(
  phone: string,
  messageText: string
): Promise<{ response: string; optedOut: boolean }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const cleanPhone = phone.replace(/\D/g, '');

  // Log inbound message
  await db.insert(smsConversations).values({
    phone: cleanPhone,
    direction: 'inbound',
    messageText,
    messageType: 'manual', // Will be categorized as AI interaction
  });

  // Check for opt-out keywords
  const optOutKeywords = ['stop', 'unsubscribe', 'cancel', 'quit', 'opt out', 'optout', 'remove me'];
  const isOptOut = optOutKeywords.some(kw => messageText.toLowerCase().trim().includes(kw));

  if (isOptOut) {
    // Mark registrant as opted out
    await db
      .update(webinarRegistrants)
      .set({ optedOut: 1 })
      .where(eq(webinarRegistrants.phone, cleanPhone));

    const optOutResponse = "No problem! I've removed you from our list. Wishing you the best!";

    // Send opt-out confirmation
    try {
      const result = await sendSms({ contactPhone: cleanPhone, text: optOutResponse, mode: 'SINGLE_SMS_STRICTLY' });
      await db.insert(smsConversations).values({
        phone: cleanPhone,
        direction: 'outbound',
        messageText: optOutResponse,
        messageType: 'ai_reply',
        externalMessageId: result.id,
      });
    } catch (error) {
      console.error(`[WebinarEngine] Failed to send opt-out confirmation to ${cleanPhone}:`, error);
    }

    return { response: optOutResponse, optedOut: true };
  }

  // Load recent conversation history (last 10 messages for context)
  const history = await db
    .select()
    .from(smsConversations)
    .where(eq(smsConversations.phone, cleanPhone))
    .orderBy(desc(smsConversations.createdAt))
    .limit(10);

  // Build conversation context for the AI
  const conversationContext = history
    .reverse()
    .map(msg => {
      const role = msg.direction === 'inbound' ? 'Contact' : 'Coach Inayah Team';
      return `${role}: ${msg.messageText}`;
    })
    .join('\n');

  // Get the registrant's info if available
  const [registrant] = await db
    .select()
    .from(webinarRegistrants)
    .where(eq(webinarRegistrants.phone, cleanPhone))
    .limit(1);

  // Get the next upcoming schedule for context
  const [nextSchedule] = await db
    .select()
    .from(webinarSchedules)
    .where(eq(webinarSchedules.isActive, 1))
    .limit(1);

  // Build the prompt
  const contextInfo = [
    registrant ? `Contact name: ${registrant.firstName}` : '',
    registrant?.liveRoomUrl ? `Their personal live room link: ${registrant.liveRoomUrl}` : '',
    nextSchedule ? `Next webinar: "${nextSchedule.name}" at ${nextSchedule.startTime} Pacific` : '',
    nextSchedule?.liveRoomUrl ? `General live room link: ${nextSchedule.liveRoomUrl}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `${contextInfo ? `Context:\n${contextInfo}\n\n` : ''}${conversationContext ? `Recent conversation:\n${conversationContext}\n\n` : ''}New message from contact: "${messageText}"\n\nReply as Coach Inayah's assistant. MUST be under 155 characters total (count carefully). No emoji. Be warm and helpful.`;

  // Build transcript-aware system prompt if we have a transcript
  const systemPrompt = nextSchedule?.webinarTranscript
    ? buildTranscriptAwareSystemPrompt(nextSchedule.webinarTranscript)
    : COACH_INAYAH_SYSTEM_PROMPT_FALLBACK;

  // Route to AI provider
  const provider = routeToProvider(messageText);
  let aiResponse: string;

  try {
    if (provider === 'gemini') {
      // Use Gemini for search-related queries (routed through model router as chat)
      aiResponse = await routedLLMCall(FEATURES.CHAT_NON_STREAMING, prompt, {
        systemPrompt,
        maxTokens: 300, // Keep SMS responses short
      });
    } else {
      // Use Sonnet for conversational replies
      aiResponse = await routedLLMCall(FEATURES.CHAT_NON_STREAMING, prompt, {
        systemPrompt,
        maxTokens: 300,
      });
    }

    // Clean up AI response (remove quotes, excessive whitespace)
    aiResponse = aiResponse.trim().replace(/^["']|["']$/g, '');

    // Strip any emoji from AI response
    aiResponse = stripEmoji(aiResponse);

    // Enforce 155-char SMS limit for reliable single-segment delivery (5-char safety margin)
    if (aiResponse.length > 155) {
      aiResponse = aiResponse.substring(0, 152) + '...';
    }
  } catch (error) {
    console.error(`[WebinarEngine] AI response failed:`, error);
    aiResponse = `Hey! Thanks for reaching out. Coach Inayah's team will get back to you soon. Don't miss the live webinar!`;
  }

  // Send the AI response
  try {
    const result = await sendSms({ contactPhone: cleanPhone, text: aiResponse, mode: 'SINGLE_SMS_STRICTLY' });

    // Log outbound AI reply
    await db.insert(smsConversations).values({
      phone: cleanPhone,
      direction: 'outbound',
      messageText: aiResponse,
      aiProvider: provider,
      messageType: 'ai_reply',
      externalMessageId: result.id,
    });
  } catch (error) {
    console.error(`[WebinarEngine] Failed to send AI reply to ${cleanPhone}:`, error);
  }

  return { response: aiResponse, optedOut: false };
}

// ---------------------------------------------------------------------------
// REGISTRANT MANAGEMENT
// ---------------------------------------------------------------------------

/**
 * Add a new registrant from a WebinarJam webhook (via Zapier/Make).
 * Also sends the welcome SMS.
 */
export async function addRegistrantFromWebhook(params: {
  scheduleId: number;
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  phoneCountryCode?: string;
  liveRoomUrl?: string;
  replayRoomUrl?: string;
  webinarjamLeadId?: string;
}): Promise<{ registrantId: number; welcomeSent: boolean }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const cleanPhone = params.phone.replace(/\D/g, '');
  // Prepend country code if needed
  const fullPhone = cleanPhone.length === 10 ? `1${cleanPhone}` : cleanPhone;

  // Check if registrant already exists
  const [existing] = await db
    .select()
    .from(webinarRegistrants)
    .where(
      and(
        eq(webinarRegistrants.phone, fullPhone),
        eq(webinarRegistrants.scheduleId, params.scheduleId)
      )
    )
    .limit(1);

  if (existing) {
    console.log(`[WebinarEngine] Registrant ${fullPhone} already exists for schedule ${params.scheduleId}`);
    return { registrantId: existing.id, welcomeSent: !!existing.welcomeSent };
  }

  // Insert new registrant
  const [newReg] = await db.insert(webinarRegistrants).values({
    scheduleId: params.scheduleId,
    firstName: params.firstName,
    lastName: params.lastName || null,
    email: params.email || null,
    phone: fullPhone,
    phoneCountryCode: params.phoneCountryCode || null,
    liveRoomUrl: params.liveRoomUrl || null,
    replayRoomUrl: params.replayRoomUrl || null,
    webinarjamLeadId: params.webinarjamLeadId || null,
    registeredAt: new Date(),
  }).$returningId();

  // Welcome SMS is handled externally (not by this system)
  // We just register the person and they'll get the noon engagement text on webinar day
  console.log(`[WebinarEngine] Registrant added: ${params.firstName} (${fullPhone}) for schedule ${params.scheduleId}`);

  return { registrantId: newReg.id, welcomeSent: false };
}

/**
 * Sync registrants from WebinarJam for a specific schedule.
 * Pulls all registrants from the API and upserts them locally.
 */
export async function syncRegistrants(scheduleId: number): Promise<{
  synced: number;
  newRegistrants: number;
  updated: number;
}> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [schedule] = await db
    .select()
    .from(webinarSchedules)
    .where(eq(webinarSchedules.id, scheduleId))
    .limit(1);

  if (!schedule?.webinarjamWebinarId || !schedule?.webinarjamScheduleId) {
    throw new Error('Schedule has no WebinarJam IDs configured');
  }

  const { registrants } = await syncRegistrantsFromWebinarJam(
    schedule.webinarjamWebinarId,
    schedule.webinarjamScheduleId
  );

  let newCount = 0;
  let updatedCount = 0;

  for (const wjReg of registrants) {
    if (!wjReg.phone) continue;

    const cleanPhone = wjReg.phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `1${cleanPhone}` : cleanPhone;

    const [existing] = await db
      .select()
      .from(webinarRegistrants)
      .where(
        and(
          eq(webinarRegistrants.phone, fullPhone),
          eq(webinarRegistrants.scheduleId, scheduleId)
        )
      )
      .limit(1);

    if (existing) {
      // Update attendance status
      const newStatus = wjReg.attended_live === 1 ? 'attended' as const : existing.attendanceStatus;
      if (newStatus !== existing.attendanceStatus) {
        await db
          .update(webinarRegistrants)
          .set({ attendanceStatus: newStatus })
          .where(eq(webinarRegistrants.id, existing.id));
        updatedCount++;
      }
    } else {
      await db.insert(webinarRegistrants).values({
        scheduleId,
        firstName: wjReg.first_name || 'Unknown',
        lastName: wjReg.last_name || null,
        email: wjReg.email || null,
        phone: fullPhone,
        phoneCountryCode: wjReg.phone_country_code || null,
        liveRoomUrl: wjReg.live_room || null,
        replayRoomUrl: wjReg.replay_room || null,
        webinarjamLeadId: wjReg.lead_id ? String(wjReg.lead_id) : null,
        attendanceStatus: wjReg.attended_live === 1 ? 'attended' : 'registered',
        registeredAt: new Date(),
      });
      newCount++;
    }
  }

  console.log(`[WebinarEngine] Sync complete: ${registrants.length} total, ${newCount} new, ${updatedCount} updated`);

  return {
    synced: registrants.length,
    newRegistrants: newCount,
    updated: updatedCount,
  };
}

// ---------------------------------------------------------------------------
// SCHEDULE MANAGEMENT
// ---------------------------------------------------------------------------

/**
 * Get all active webinar schedules.
 */
export async function getActiveSchedules(): Promise<WebinarSchedule[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(webinarSchedules)
    .where(eq(webinarSchedules.isActive, 1));
}

/**
 * Get all schedules (active and inactive).
 */
export async function getAllSchedules(): Promise<WebinarSchedule[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(webinarSchedules)
    .orderBy(desc(webinarSchedules.createdAt));
}

/**
 * Get registrants for a schedule with stats.
 */
export async function getScheduleRegistrants(scheduleId: number): Promise<{
  registrants: WebinarRegistrant[];
  stats: {
    total: number;
    attended: number;
    noShows: number;
    optedOut: number;
    welcomeSent: number;
  };
}> {
  const db = await getDb();
  if (!db) return { registrants: [], stats: { total: 0, attended: 0, noShows: 0, optedOut: 0, welcomeSent: 0 } };

  const registrants = await db
    .select()
    .from(webinarRegistrants)
    .where(eq(webinarRegistrants.scheduleId, scheduleId))
    .orderBy(desc(webinarRegistrants.createdAt));

  const stats = {
    total: registrants.length,
    attended: registrants.filter(r => r.attendanceStatus === 'attended').length,
    noShows: registrants.filter(r => r.attendanceStatus === 'no_show').length,
    optedOut: registrants.filter(r => r.optedOut === 1).length,
    welcomeSent: registrants.filter(r => r.welcomeSent === 1).length,
  };

  return { registrants, stats };
}

/**
 * Get conversation log for a specific phone number.
 */
export async function getConversationLog(phone: string, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  const cleanPhone = phone.replace(/\D/g, '');

  return db
    .select()
    .from(smsConversations)
    .where(eq(smsConversations.phone, cleanPhone))
    .orderBy(desc(smsConversations.createdAt))
    .limit(limit);
}

/**
 * Get all recent conversations (grouped by phone number).
 */
export async function getRecentConversations(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  // Get the most recent message per phone number
  const recentMessages = await db
    .select()
    .from(smsConversations)
    .orderBy(desc(smsConversations.createdAt))
    .limit(limit * 3); // Fetch more to account for grouping

  // Group by phone and take the most recent
  const phoneMap = new Map<string, typeof recentMessages[0]>();
  for (const msg of recentMessages) {
    if (!phoneMap.has(msg.phone)) {
      phoneMap.set(msg.phone, msg);
    }
  }

  return Array.from(phoneMap.values()).slice(0, limit);
}

/**
 * Get blast history for a schedule.
 */
export async function getBlastHistory(scheduleId?: number) {
  const db = await getDb();
  if (!db) return [];

  const query = db
    .select()
    .from(noShowBlasts)
    .orderBy(desc(noShowBlasts.createdAt))
    .limit(20);

  if (scheduleId) {
    return db
      .select()
      .from(noShowBlasts)
      .where(eq(noShowBlasts.scheduleId, scheduleId))
      .orderBy(desc(noShowBlasts.createdAt))
      .limit(20);
  }

  return query;
}

/**
 * Send a manual SMS to a specific phone number (from admin dashboard).
 */
export async function sendManualSms(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const db = await getDb();
  const cleanPhone = phone.replace(/\D/g, '');

  try {
    const result = await sendSms({ contactPhone: cleanPhone, text: message, mode: 'SINGLE_SMS_STRICTLY' });

    if (db) {
      await db.insert(smsConversations).values({
        phone: cleanPhone,
        direction: 'outbound',
        messageText: message,
        messageType: 'manual',
        externalMessageId: result.id,
      });
    }

    return { success: true, messageId: result.id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMsg };
  }
}

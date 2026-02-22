/**
 * Webinar AI Content Generator
 * 
 * Uses the webinar transcript as a knowledge base to AI-generate:
 * 1. No-show teaser messages (urgency-creating snippets)
 * 2. Reminder SMS content grounded in what was actually taught
 * 3. AI conversation context for the SMS chatbot
 * 
 * All content is generated from the ACTUAL transcript — not generic filler.
 */

import { routedLLMCall, FEATURES } from './model-router';
import { getDb } from './db';
import { webinarSchedules } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// TEASER GENERATION
// ---------------------------------------------------------------------------

/**
 * System prompt for generating no-show teasers from transcript.
 * The AI reads the transcript and extracts the most compelling moments
 * that would make someone who missed the webinar feel FOMO.
 */
const TEASER_SYSTEM_PROMPT = `You are a marketing copywriter for Coach Inayah's webinar team. Your job is to read a webinar transcript and create SHORT, urgency-driven teaser messages that make no-shows want to jump into the live room immediately.

Rules:
- Each teaser must be 10-20 words MAX (this goes inside an SMS)
- Use simple, direct language — no corporate speak
- Reference SPECIFIC things from the transcript (real student names, real numbers, real stories)
- Create FOMO — make them feel like they're missing something incredible right now
- Don't make up numbers or claims that aren't in the transcript
- Write in a casual, excited tone (like texting a friend)
- Each teaser should highlight a DIFFERENT compelling moment from the webinar
- DO NOT use any emoji whatsoever — keep it clean text only

Output format: Return ONLY a JSON array of 5-8 teaser strings. No explanation, no markdown, just the JSON array.

Example output:
["how Andrew got $80K in funding with zero experience", "the exact calculator that shows your property's earning potential", "Dante's first month making $4,400 from one unit in San Diego"]`;

/**
 * Generate no-show teasers from a webinar transcript.
 * Returns an array of short, compelling teaser strings.
 */
export async function generateTeasersFromTranscript(
  transcript: string
): Promise<string[]> {
  if (!transcript || transcript.trim().length < 100) {
    return ['the strategies that are changing lives right now'];
  }

  // Truncate transcript to ~8000 chars to fit in context window efficiently
  const truncatedTranscript = transcript.length > 8000
    ? transcript.substring(0, 4000) + '\n\n[...middle section...]\n\n' + transcript.substring(transcript.length - 4000)
    : transcript;

  const prompt = `Here is the webinar transcript. Read it carefully and generate no-show teasers based on the ACTUAL content discussed:\n\n---TRANSCRIPT START---\n${truncatedTranscript}\n---TRANSCRIPT END---\n\nGenerate 5-8 compelling no-show teasers as a JSON array:`;

  try {
    const response = await routedLLMCall(FEATURES.WEBINAR_SMS_CONTENT, prompt, {
      systemPrompt: TEASER_SYSTEM_PROMPT,
      maxTokens: 500,
    });

    // Parse the JSON array from the response
    const cleaned = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const teasers = JSON.parse(cleaned);

    if (Array.isArray(teasers) && teasers.length > 0 && teasers.every((t: unknown) => typeof t === 'string')) {
      return teasers;
    }

    console.warn('[WebinarAI] Unexpected teaser format, using fallback');
    return ['the strategies that are changing lives right now'];
  } catch (error) {
    console.error('[WebinarAI] Failed to generate teasers:', error);
    return ['the strategies that are changing lives right now'];
  }
}

/**
 * Generate teasers for a schedule and cache them in the database.
 * Also picks the best one as the primary noShowTeaser.
 */
export async function generateAndCacheTeasers(scheduleId: number): Promise<{
  teasers: string[];
  primaryTeaser: string;
}> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [schedule] = await db
    .select()
    .from(webinarSchedules)
    .where(eq(webinarSchedules.id, scheduleId))
    .limit(1);

  if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

  if (!schedule.webinarTranscript) {
    const fallback = 'the strategies that are changing lives right now';
    return { teasers: [fallback], primaryTeaser: fallback };
  }

  const teasers = await generateTeasersFromTranscript(schedule.webinarTranscript);
  const primaryTeaser = teasers[0] || 'the strategies that are changing lives right now';

  // Cache in database
  await db.update(webinarSchedules).set({
    generatedTeasers: JSON.stringify(teasers),
    noShowTeaser: primaryTeaser,
  }).where(eq(webinarSchedules.id, scheduleId));

  console.log(`[WebinarAI] Generated ${teasers.length} teasers for schedule ${scheduleId}`);

  return { teasers, primaryTeaser };
}

/**
 * Get cached teasers for a schedule, or generate fresh ones if needed.
 */
export async function getTeasers(scheduleId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return ['the strategies that are changing lives right now'];

  const [schedule] = await db
    .select()
    .from(webinarSchedules)
    .where(eq(webinarSchedules.id, scheduleId))
    .limit(1);

  if (!schedule) return ['the strategies that are changing lives right now'];

  // Return cached teasers if available
  if (schedule.generatedTeasers) {
    try {
      const cached = JSON.parse(schedule.generatedTeasers);
      if (Array.isArray(cached) && cached.length > 0) return cached;
    } catch { /* fall through to regenerate */ }
  }

  // Generate fresh if we have a transcript
  if (schedule.webinarTranscript) {
    const { teasers } = await generateAndCacheTeasers(scheduleId);
    return teasers;
  }

  return [schedule.noShowTeaser || 'the strategies that are changing lives right now'];
}

/**
 * Pick a random teaser from the cached set (for variety in no-show blasts).
 */
export async function getRandomTeaser(scheduleId: number): Promise<string> {
  const teasers = await getTeasers(scheduleId);
  const index = Math.floor(Math.random() * teasers.length);
  return teasers[index];
}

// ---------------------------------------------------------------------------
// TRANSCRIPT-AWARE SMS GENERATION
// ---------------------------------------------------------------------------

/**
 * System prompt for generating reminder SMS content from transcript.
 */
const REMINDER_SMS_SYSTEM_PROMPT = `You are Coach Inayah's SMS copywriter. You write SHORT, compelling reminder messages that get people to show up to the live webinar.

Rules:
- Messages MUST be under 160 characters total (single SMS segment)
- Use casual, warm language — like texting a friend
- Reference SPECIFIC things from the transcript to create excitement
- Include the person's first name using {{firstName}}
- Include the webinar time using {{startTime}} — webinar is at 4 PM Pacific / 7 PM Eastern
- For messages that need a link, use {{liveRoomUrl}}
- Don't make up numbers or claims not in the transcript
- DO NOT use any emoji whatsoever — keep it clean text only
- Create genuine excitement, not hype

Output: Return ONLY the SMS message text, nothing else.`;

/**
 * Generate a transcript-aware reminder message for a specific stage.
 * Uses the actual webinar content to make reminders more compelling.
 */
export async function generateTranscriptAwareReminder(
  transcript: string,
  stage: number,
  scheduleName: string
): Promise<string> {
  if (!transcript || transcript.trim().length < 100) {
    return ''; // Fall back to default templates
  }

  // Only use a relevant excerpt to keep prompt small
  const excerpt = transcript.length > 3000
    ? transcript.substring(0, 3000)
    : transcript;

  const stageDescriptions: Record<number, string> = {
    1: '24 hours before the webinar. Build anticipation. Mention something specific they\'ll learn.',
    2: 'Morning of the webinar. Create excitement for today. Reference a specific student success story.',
    3: '1 hour before start. High urgency. Mention a specific strategy or number from the webinar.',
    4: 'Webinar is starting RIGHT NOW. Maximum urgency. Include the live room link.',
    5: 'No-show blast. They missed the start. Create FOMO about what\'s being discussed right now.',
  };

  const prompt = `Webinar name: "${scheduleName}"
Stage: ${stageDescriptions[stage] || 'General reminder'}

Here's an excerpt from the webinar transcript to reference:
---
${excerpt}
---

Write a single SMS reminder message for this stage. Use {{firstName}}, {{startTime}}, and {{liveRoomUrl}} as placeholders:`;

  try {
    const response = await routedLLMCall(FEATURES.WEBINAR_SMS_CONTENT, prompt, {
      systemPrompt: REMINDER_SMS_SYSTEM_PROMPT,
      maxTokens: 200,
    });

    return response.trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error(`[WebinarAI] Failed to generate stage ${stage} reminder:`, error);
    return ''; // Fall back to default templates
  }
}

// ---------------------------------------------------------------------------
// TRANSCRIPT CONTEXT FOR AI CONVERSATIONS
// ---------------------------------------------------------------------------

/**
 * Build a transcript-aware system prompt for the AI conversation engine.
 * This enriches the Coach Inayah persona with actual webinar content knowledge.
 */
export function buildTranscriptAwareSystemPrompt(transcript: string | null): string {
  const basePrompt = `You are Coach Inayah's AI assistant, texting on behalf of her webinar team. Your personality:

- WARM, ENCOURAGING, and REAL — like a big sister who's been through it and wants to help
- You use casual, conversational language (not corporate speak)
- DO NOT use any emoji whatsoever — keep it clean text only
- You're knowledgeable about short-term rentals, Airbnb arbitrage, and building wealth through real estate
- You keep responses SHORT (2-4 sentences max — this is SMS, not email)
- Each response MUST be under 155 characters total to fit in a single SMS segment
- The webinar is at 4 PM Pacific / 7 PM Eastern
- You always try to get the person to JOIN THE LIVE WEBINAR
- If they want to unsubscribe, be respectful and say "No problem! I've removed you from our list. Wishing you the best!"
- NEVER make up specific financial claims or guarantees
- NEVER share personal information about Coach Inayah beyond what's public
- If you don't know something, say "Great question! Coach Inayah will cover that in the live session"

Your goal: Get them excited and into the live webinar room. Be helpful, be real, be brief.`;

  if (!transcript || transcript.trim().length < 100) {
    return basePrompt;
  }

  // Extract key talking points from transcript (first ~2000 chars for context)
  const contextExcerpt = transcript.length > 2000
    ? transcript.substring(0, 2000)
    : transcript;

  return `${basePrompt}

IMPORTANT — Here are REAL things discussed in Coach Inayah's webinar that you can reference when chatting with people. Use these to answer questions and build excitement:

---WEBINAR HIGHLIGHTS---
${contextExcerpt}
---END HIGHLIGHTS---

When someone asks what the webinar covers, reference SPECIFIC things from above (real student names, real numbers, real stories). This makes your responses authentic and compelling.`;
}

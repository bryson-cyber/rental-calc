/**
 * Webinar Transcript Seeder
 * 
 * The webinar transcript is a PERMANENT knowledge base — it doesn't change.
 * This module:
 * 1. Fetches the transcript from CDN on first run
 * 2. Seeds it into every schedule that doesn't have one yet
 * 3. Auto-generates ALL SMS templates (reminders + no-show) from the transcript
 * 4. Auto-generates teasers from the transcript
 * 
 * This runs once on server startup and ensures the system is always ready.
 */

import { getDb } from './db';
import { webinarSchedules, reminderTemplates } from '../drizzle/schema';
import { eq, isNull, sql } from 'drizzle-orm';
import { generateAndCacheTeasers, generateTranscriptAwareReminder } from './webinar-ai-content';

// ---------------------------------------------------------------------------
// PERMANENT TRANSCRIPT CDN URL
// ---------------------------------------------------------------------------

const TRANSCRIPT_CDN_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663085050152/FoQuCQbIBUqVbruP.txt';

let cachedTranscript: string | null = null;

/**
 * Fetch the permanent webinar transcript from CDN.
 * Caches in memory after first fetch.
 */
export async function getTranscript(): Promise<string> {
  if (cachedTranscript) return cachedTranscript;

  try {
    const response = await fetch(TRANSCRIPT_CDN_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.status}`);
    }
    cachedTranscript = await response.text();
    console.log(`[TranscriptSeeder] Loaded transcript from CDN (${cachedTranscript.length.toLocaleString()} chars)`);
    return cachedTranscript;
  } catch (error) {
    console.error('[TranscriptSeeder] Failed to fetch transcript from CDN:', error);
    throw error;
  }
}

/**
 * Seed the transcript into all schedules that don't have one yet.
 * Also generates teasers for any schedule missing them.
 */
export async function seedTranscriptToSchedules(): Promise<{
  schedulesUpdated: number;
  teasersGenerated: number;
}> {
  const db = await getDb();
  if (!db) {
    console.log('[TranscriptSeeder] Database not available, skipping seed');
    return { schedulesUpdated: 0, teasersGenerated: 0 };
  }

  let transcript: string;
  try {
    transcript = await getTranscript();
  } catch {
    console.warn('[TranscriptSeeder] Could not load transcript, skipping seed');
    return { schedulesUpdated: 0, teasersGenerated: 0 };
  }

  // Find schedules without a transcript
  const schedulesWithoutTranscript = await db
    .select()
    .from(webinarSchedules)
    .where(isNull(webinarSchedules.webinarTranscript));

  let schedulesUpdated = 0;
  let teasersGenerated = 0;

  for (const schedule of schedulesWithoutTranscript) {
    await db.update(webinarSchedules).set({
      webinarTranscript: transcript,
    }).where(eq(webinarSchedules.id, schedule.id));
    schedulesUpdated++;
    console.log(`[TranscriptSeeder] Seeded transcript into schedule "${schedule.name}" (ID: ${schedule.id})`);
  }

  // Generate teasers for any schedule that has a transcript but no teasers
  const schedulesWithoutTeasers = await db
    .select()
    .from(webinarSchedules)
    .where(isNull(webinarSchedules.generatedTeasers));

  for (const schedule of schedulesWithoutTeasers) {
    try {
      await generateAndCacheTeasers(schedule.id);
      teasersGenerated++;
      console.log(`[TranscriptSeeder] Generated teasers for schedule "${schedule.name}" (ID: ${schedule.id})`);
    } catch (error) {
      console.error(`[TranscriptSeeder] Failed to generate teasers for schedule ${schedule.id}:`, error);
    }
  }

  console.log(`[TranscriptSeeder] Seed complete: ${schedulesUpdated} schedules updated, ${teasersGenerated} teasers generated`);
  return { schedulesUpdated, teasersGenerated };
}

/**
 * Generate AI-powered SMS templates for all 5 stages from the transcript.
 * Only generates if no custom templates exist in the database yet.
 */
export async function seedAiTemplates(): Promise<{
  templatesGenerated: number;
}> {
  const db = await getDb();
  if (!db) return { templatesGenerated: 0 };

  // Check if templates already exist
  const existingTemplates = await db.select().from(reminderTemplates);
  if (existingTemplates.length > 0) {
    console.log(`[TranscriptSeeder] ${existingTemplates.length} templates already exist, skipping AI generation`);
    return { templatesGenerated: 0 };
  }

  let transcript: string;
  try {
    transcript = await getTranscript();
  } catch {
    console.warn('[TranscriptSeeder] Could not load transcript, skipping template generation');
    return { templatesGenerated: 0 };
  }

  const scheduleName = "Coach Inayah's Live Masterclass";
  let templatesGenerated = 0;

  const stageNames: Record<number, string> = {
    1: '24 Hours Before',
    2: 'Morning Of',
    3: '1 Hour Before',
    4: 'At Start Time',
    5: 'No-Show Blast',
  };

  for (const stage of [1, 2, 3, 4, 5]) {
    try {
      const aiTemplate = await generateTranscriptAwareReminder(transcript, stage, scheduleName);

      if (aiTemplate && aiTemplate.length > 10) {
        await db.insert(reminderTemplates).values({
          stage,
          name: stageNames[stage],
          messageTemplate: aiTemplate,
          isActive: 1,
        });
        templatesGenerated++;
        console.log(`[TranscriptSeeder] Generated AI template for stage ${stage}: "${aiTemplate.slice(0, 60)}..."`);
      } else {
        console.warn(`[TranscriptSeeder] AI template for stage ${stage} was too short, skipping`);
      }
    } catch (error) {
      console.error(`[TranscriptSeeder] Failed to generate template for stage ${stage}:`, error);
    }
  }

  console.log(`[TranscriptSeeder] Template seed complete: ${templatesGenerated} templates generated`);
  return { templatesGenerated };
}

/**
 * Run the full seeder on server startup.
 * This is safe to call multiple times — it only seeds what's missing.
 */
export async function runStartupSeed(): Promise<void> {
  console.log('[TranscriptSeeder] Running startup seed...');

  try {
    const transcriptResult = await seedTranscriptToSchedules();
    const templateResult = await seedAiTemplates();

    console.log(`[TranscriptSeeder] Startup seed complete:`, {
      schedulesUpdated: transcriptResult.schedulesUpdated,
      teasersGenerated: transcriptResult.teasersGenerated,
      templatesGenerated: templateResult.templatesGenerated,
    });
  } catch (error) {
    console.error('[TranscriptSeeder] Startup seed failed:', error);
    // Don't throw — the server should still start even if seeding fails
  }
}

/**
 * Video Generation Service — Golpo AI Integration (DB-Persisted, Async Pattern)
 *
 * Generates whiteboard animation explainer videos from Content Studio scripts
 * using the Golpo AI REST API directly (bypasses the Node SDK to access
 * parameters like new_script, use_color, video_instructions, white_bg
 * that the SDK types don't expose).
 *
 * Key improvements (Feb 14, 2026):
 *   - Jobs persisted to database (video_jobs table) — survives server restarts
 *   - Auto-resumes polling for "generating" jobs on server startup
 *   - Correct base URL: https://api.golpoai.com (not video.golpoai.com)
 *   - FormData format (matching SDK internals), not JSON
 *   - POST /generate for job submission, GET /status/{jobId} for polling
 *   - White background (white_bg=true, use_color=false)
 *   - AI voiceover enabled (tts_model=accurate, style=solo-female)
 *   - 5-10 minute videos (timing=10, long-form coaching scripts 1500-2000+ words)
 *   - new_script parameter passes the full AI-generated narration directly
 *
 * Flow:
 *   1. Client calls startVideoGeneration → gets jobId immediately (saved to DB)
 *   2. Server runs Golpo in background, updates DB row when done
 *   3. Client polls getVideoStatus → reads from DB
 *   4. On server restart, resumeIncompleteJobs() picks up where it left off
 */

import { ENV } from './_core/env';
import { getDb } from './db';
import { contentScripts, videoJobs } from '../drizzle/schema';
import { eq, desc, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import FormData from 'form-data';
import axios from 'axios';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VideoJobResult {
  jobId: string;
  scriptId: number;
  title: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

export interface VideoStatusResult {
  jobId: string;
  scriptId: number;
  title: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl: string | null;
  error: string | null;
  startedAt: number;
  completedAt: number | null;
}

// ─── In-memory set to track which jobs are actively being polled ─────────────
// Prevents duplicate polling if resumeIncompleteJobs runs while a poll is active

const activePollers = new Set<string>();

// ─── Golpo REST API Config ──────────────────────────────────────────────────

const GOLPO_BASE_URL = ENV.golpoBaseUrl || 'https://api.golpoai.com';

function getGolpoApiKey(): string {
  const apiKey = ENV.golpoApiKey;
  if (!apiKey) {
    throw new Error('GOLPO_API_KEY is not configured. Please add it in Settings > Secrets.');
  }
  return apiKey;
}

// ─── Voice & Personality Config ──────────────────────────────────────────────

const COACH_INAYAH_VOICE = `Warm, encouraging, and conversational Black woman's voice. 
Speak like you're coaching a friend who's curious about Airbnb investing. 
Use simple language — no jargon. When you mention numbers, explain what they mean in real terms.
Pace should feel natural and measured, not rushed. Pause briefly after key insights to let them land.
Tone: confident but approachable, like a mentor sharing insider knowledge over coffee.
This is a teaching video — take your time explaining each concept thoroughly.`;

const COACH_INAYAH_PERSONALITY = `Coach Inayah — a short-term rental investment educator who helps 
everyday people understand Airbnb and VRBO investing. She breaks down complex real estate data 
into simple, actionable insights. She's known for her warm teaching style and data-driven approach.
She teaches like she's sitting across from you at a coffee shop, making complex topics feel simple.`;

const VIDEO_INSTRUCTIONS = `Create a clean, professional whiteboard teaching video on a WHITE background.

CRITICAL VISUAL REQUIREMENTS:
- WHITE background only — this must look like a real whiteboard lesson, not a dark presentation
- Clean, hand-drawn style illustrations and diagrams
- Use data visualizations when numbers are mentioned (bar charts, pie charts, trend lines)
- Draw property illustrations, maps, and location markers when discussing specific markets
- Use callout boxes for key statistics and revenue numbers
- Include dollar signs and percentage symbols as visual emphasis
- Draw simple house/building icons for property references
- Use arrows and flow diagrams to show investment processes
- Keep text on screen minimal — let the narration carry the story
- Highlight key takeaways with underlines or circles
- This should look and feel like a YouTube education channel whiteboard explainer
- Pacing should be educational — give the viewer time to absorb each point`;

// ─── Direct Golpo REST API Calls ────────────────────────────────────────────

/**
 * Submit a video generation job to Golpo's /generate endpoint directly.
 * Uses FormData format matching the SDK internals.
 * Returns the Golpo job_id for polling.
 */
async function submitGolpoJob(narrationScript: string, isDeepDive: boolean): Promise<string> {
  const apiKey = getGolpoApiKey();

  const formData = new FormData();

  // The prompt describes the video topic/context
  formData.append('prompt', 'Create an educational Airbnb investing whiteboard explainer video using the provided script. This is a coaching-style YouTube video for beginners.');

  // Pass the full narration script directly — Golpo will use this as the voiceover
  formData.append('new_script', narrationScript);

  // Video style and quality
  formData.append('style', 'solo-female');
  formData.append('tts_model', 'accurate');
  formData.append('video_type', 'long');
  formData.append('language', 'en');

  // White background — dedicated parameter from the API docs
  formData.append('white_bg', 'true');
  formData.append('use_color', 'false');

  // Custom visual instructions for whiteboard teaching style
  formData.append('video_instructions', VIDEO_INSTRUCTIONS);

  // Voice configuration
  formData.append('voice_instructions', COACH_INAYAH_VOICE);
  formData.append('personality_1', COACH_INAYAH_PERSONALITY);

  // Background music
  formData.append('bg_music', 'engaging');
  formData.append('bg_volume', '1.4');
  formData.append('output_volume', '1.0');

  // Timing controls video length — "10" for ~10 min videos
  formData.append('timing', isDeepDive ? '10' : '10');

  // No watermark
  formData.append('include_watermark', 'false');

  // Don't let Golpo do its own research — we provide the full script
  formData.append('do_research', 'false');

  console.log(`[Video Gen] Submitting job to Golpo API at ${GOLPO_BASE_URL}/generate`);
  console.log(`[Video Gen] Script length: ${narrationScript.length} chars (~${Math.round(narrationScript.split(/\s+/).length)} words)`);
  console.log(`[Video Gen] Config: timing=10, white_bg=true, use_color=false, style=solo-female, tts_model=accurate`);

  const response = await axios.post(`${GOLPO_BASE_URL}/generate`, formData, {
    headers: {
      ...formData.getHeaders(),
      'x-api-key': apiKey,
    },
    timeout: 240_000, // 4 min timeout for the initial submission
  });

  const golpoJobId = response.data.job_id;
  if (!golpoJobId) {
    console.error(`[Video Gen] Golpo API response:`, JSON.stringify(response.data));
    throw new Error(`Golpo API did not return a job_id. Response: ${JSON.stringify(response.data)}`);
  }

  console.log(`[Video Gen] Golpo job submitted successfully: ${golpoJobId}`);
  return golpoJobId;
}

/**
 * Poll Golpo's /status/:jobId endpoint until the video is ready.
 * Updates the DB row on each status change.
 */
async function pollGolpoJob(
  internalJobId: string,
  golpoJobId: string,
  pollIntervalMs = 15000,
  maxWaitMs = 1_200_000, // 20 minutes max
): Promise<{ videoUrl: string; videoScript: string }> {
  const apiKey = getGolpoApiKey();
  const startTime = Date.now();

  // Mark this job as actively being polled
  activePollers.add(internalJobId);

  try {
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await axios.get(`${GOLPO_BASE_URL}/status/${golpoJobId}`, {
          headers: { 'x-api-key': apiKey },
          timeout: 30_000,
        });

        const data = response.data;

        if (data.status === 'completed') {
          console.log(`[Video Gen] Golpo job ${golpoJobId} completed!`);
          const videoUrl = data.podcast_url || data.video_url || '';
          const videoScript = data.podcast_script || data.video_script || '';
          console.log(`[Video Gen] Video URL: ${videoUrl}`);
          return { videoUrl, videoScript };
        }

        if (data.status === 'failed' || data.status === 'error') {
          throw new Error(`Golpo job ${golpoJobId} failed: ${data.error || JSON.stringify(data)}`);
        }

        // Still generating — log progress
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`[Video Gen] Golpo job ${golpoJobId} still generating... (${elapsed}s elapsed, status: ${data.status})`);
      } catch (err: any) {
        // Actual failure from Golpo
        if (err.message?.includes('failed')) {
          throw err;
        }
        // Network errors during polling are retryable
        console.warn(`[Video Gen] Polling error for ${golpoJobId}, will retry:`, err.message);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Golpo job ${golpoJobId} timed out after ${maxWaitMs / 1000}s`);
  } finally {
    activePollers.delete(internalJobId);
  }
}

// ─── DB Helpers ─────────────────────────────────────────────────────────────

async function updateJobInDb(jobId: string, updates: Partial<{
  golpoJobId: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl: string;
  videoScript: string;
  error: string;
  completedAt: Date;
}>) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.update(videoJobs)
      .set(updates)
      .where(eq(videoJobs.jobId, jobId));
  } catch (err) {
    console.error(`[Video Gen] Failed to update job ${jobId} in DB:`, err);
  }
}

// ─── Start Video Generation (returns immediately) ───────────────────────────

export async function startVideoGeneration(scriptId: number): Promise<VideoJobResult> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Fetch the script
  const [script] = await db
    .select()
    .from(contentScripts)
    .where(eq(contentScripts.id, scriptId))
    .limit(1);

  if (!script) {
    throw new Error(`Script with ID ${scriptId} not found`);
  }

  // Create a job in the database
  const jobId = randomUUID();
  await db.insert(videoJobs).values({
    jobId,
    scriptId,
    title: script.title,
    status: 'generating',
  });

  // Fire-and-forget: run Golpo in the background
  runVideoGeneration(jobId, script).catch(async (err) => {
    console.error(`[Video Gen] Background job ${jobId} failed:`, err);
    await updateJobInDb(jobId, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      completedAt: new Date(),
    });
  });

  console.log(`[Video Gen] Job ${jobId} started for script #${scriptId}: "${script.title}"`);

  return {
    jobId,
    scriptId,
    title: script.title,
    status: 'generating',
  };
}

// ─── Get Video Job Status (reads from DB) ──────────────────────────────────

export async function getVideoStatus(jobId: string): Promise<VideoStatusResult> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [job] = await db
    .select()
    .from(videoJobs)
    .where(eq(videoJobs.jobId, jobId))
    .limit(1);

  if (!job) {
    throw new Error(`Video job ${jobId} not found.`);
  }

  return {
    jobId: job.jobId,
    scriptId: job.scriptId,
    title: job.title,
    status: job.status,
    videoUrl: job.videoUrl || null,
    error: job.error || null,
    startedAt: job.startedAt.getTime(),
    completedAt: job.completedAt ? job.completedAt.getTime() : null,
  };
}

// ─── List Active/Recent Jobs (reads from DB) ───────────────────────────────

export async function listVideoJobs(): Promise<VideoStatusResult[]> {
  const db = await getDb();
  if (!db) return [];

  const jobs = await db
    .select()
    .from(videoJobs)
    .orderBy(desc(videoJobs.createdAt))
    .limit(20);

  return jobs.map((job) => ({
    jobId: job.jobId,
    scriptId: job.scriptId,
    title: job.title,
    status: job.status,
    videoUrl: job.videoUrl || null,
    error: job.error || null,
    startedAt: job.startedAt.getTime(),
    completedAt: job.completedAt ? job.completedAt.getTime() : null,
  }));
}

// ─── Background Video Generation ────────────────────────────────────────────

async function runVideoGeneration(
  jobId: string,
  script: { title: string; hook: string; script: string; cta: string; format: string },
): Promise<void> {
  // Build the full narration script
  const narration = buildNarrationScript(script);
  const isDeepDive = script.format === 'deep_dive';
  const wordCount = narration.split(/\s+/).length;

  console.log(`[Video Gen] Job ${jobId}: Submitting to Golpo`);
  console.log(`[Video Gen]   Format: ${script.format}`);
  console.log(`[Video Gen]   Script: ${narration.length} chars, ~${wordCount} words`);
  console.log(`[Video Gen]   Expected duration: ${wordCount < 1500 ? '3-5' : '5-10'} minutes`);

  // Step 1: Submit the job
  const golpoJobId = await submitGolpoJob(narration, isDeepDive);

  // Save the Golpo job ID to DB
  await updateJobInDb(jobId, { golpoJobId });

  // Step 2: Poll until complete (this runs in the background)
  const result = await pollGolpoJob(jobId, golpoJobId);

  console.log(`[Video Gen] Job ${jobId}: Video generated successfully!`);
  console.log(`[Video Gen]   URL: ${result.videoUrl}`);

  // Update the job in DB
  await updateJobInDb(jobId, {
    status: 'completed',
    videoUrl: result.videoUrl,
    videoScript: result.videoScript,
    completedAt: new Date(),
  });
}

// ─── Build Narration Script ──────────────────────────────────────────────────

function buildNarrationScript(script: {
  hook: string;
  script: string;
  cta: string;
}): string {
  const parts: string[] = [];

  if (script.hook) {
    parts.push(script.hook);
    parts.push('');
  }

  if (script.script) {
    parts.push(script.script);
    parts.push('');
  }

  if (script.cta) {
    parts.push(script.cta);
  }

  return parts.join('\n');
}

// ─── Resume Incomplete Jobs on Server Startup ──────────────────────────────

/**
 * Called once on server startup. Finds any "generating" jobs in the DB
 * that have a golpoJobId and resumes polling them.
 */
export async function resumeIncompleteJobs(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const incompleteJobs = await db
      .select()
      .from(videoJobs)
      .where(eq(videoJobs.status, 'generating'));

    if (incompleteJobs.length === 0) {
      console.log('[Video Gen] No incomplete video jobs to resume.');
      return;
    }

    console.log(`[Video Gen] Found ${incompleteJobs.length} incomplete job(s) to resume.`);

    for (const job of incompleteJobs) {
      if (!job.golpoJobId) {
        // Job was submitted but never got a Golpo ID — mark as failed
        console.log(`[Video Gen] Job ${job.jobId} has no Golpo ID — marking as failed.`);
        await updateJobInDb(job.jobId, {
          status: 'failed',
          error: 'Server restarted before Golpo job was submitted. Please try again.',
          completedAt: new Date(),
        });
        continue;
      }

      // Check if already being polled (shouldn't happen on startup, but safety check)
      if (activePollers.has(job.jobId)) {
        console.log(`[Video Gen] Job ${job.jobId} is already being polled — skipping.`);
        continue;
      }

      // Check how old the job is — if it's been more than 30 minutes, mark as failed
      const ageMs = Date.now() - job.startedAt.getTime();
      if (ageMs > 30 * 60 * 1000) {
        console.log(`[Video Gen] Job ${job.jobId} is ${Math.round(ageMs / 60000)} min old — marking as timed out.`);
        await updateJobInDb(job.jobId, {
          status: 'failed',
          error: 'Video generation timed out after 30 minutes.',
          completedAt: new Date(),
        });
        continue;
      }

      // Resume polling in the background
      console.log(`[Video Gen] Resuming polling for job ${job.jobId} (Golpo: ${job.golpoJobId})`);
      pollGolpoJob(job.jobId, job.golpoJobId).then(async (result) => {
        console.log(`[Video Gen] Resumed job ${job.jobId} completed! URL: ${result.videoUrl}`);
        await updateJobInDb(job.jobId, {
          status: 'completed',
          videoUrl: result.videoUrl,
          videoScript: result.videoScript,
          completedAt: new Date(),
        });
      }).catch(async (err) => {
        console.error(`[Video Gen] Resumed job ${job.jobId} failed:`, err);
        await updateJobInDb(job.jobId, {
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        });
      });
    }
  } catch (err) {
    console.error('[Video Gen] Error resuming incomplete jobs:', err);
  }
}

// ─── Quick Generate (Script + Video in One Call) ─────────────────────────────

/**
 * Generates a script autonomously, saves it, then starts video generation.
 * Returns immediately with the jobId — client polls for completion.
 */
export async function quickStartVideoGeneration(
  format?: 'lesson' | 'deep_dive',
): Promise<VideoJobResult & { savedScriptId: number }> {
  const { generateAutonomousScript } = await import('./content-studio');
  const { contentScripts: contentScriptsTable } = await import('../drizzle/schema');

  // 1. Generate the script autonomously (forced to lesson or deep_dive)
  console.log('[Video Gen] Quick start: Generating autonomous script...');
  const { script: result, dataBundle } = await generateAutonomousScript(
    format || 'lesson',
  );

  // 2. Save the script to the database
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [inserted] = await db.insert(contentScriptsTable).values({
    format: result.format,
    topic: result.topic,
    title: result.title,
    hook: result.hook,
    script: result.script,
    cta: result.cta,
    estimatedDurationSeconds: result.estimated_duration_seconds,
    keyDataPoints: result.key_data_points,
    targetAudience: result.target_audience,
    marketDataContext: {
      narrativeAngle: result.narrative_angle,
      dataSourcesUsed: result.data_sources_used,
      platformStats: {
        totalReports: dataBundle.platformStats.totalReports,
        totalLeads: dataBundle.platformStats.totalLeads,
      },
    },
  });

  const scriptId = inserted.insertId;
  console.log(`[Video Gen] Quick start: Script #${scriptId} saved ("${result.title}"), starting video...`);

  // 3. Start video generation (async, returns immediately)
  const jobResult = await startVideoGeneration(scriptId);

  return {
    ...jobResult,
    savedScriptId: scriptId,
  };
}

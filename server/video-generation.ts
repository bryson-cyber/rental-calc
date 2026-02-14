/**
 * Video Generation Service — Golpo AI Integration (Async Pattern)
 *
 * Generates whiteboard animation explainer videos from Content Studio scripts
 * using the Golpo AI SDK. Uses fire-and-forget with DB status tracking to
 * avoid HTTP proxy 504 timeouts (Golpo can take 5-10 minutes).
 *
 * Flow:
 *   1. Client calls startVideoGeneration → gets jobId immediately
 *   2. Server runs Golpo in background, updates DB when done
 *   3. Client polls getVideoStatus → sees pending/completed/failed
 */

import Golpo from '@golpoai/sdk';
import { ENV } from './_core/env';
import { getDb } from './db';
import { contentScripts } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

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

// ─── In-memory job tracker (persists across requests, not across restarts) ──

interface VideoJob {
  jobId: string;
  scriptId: number;
  title: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoUrl: string | null;
  videoScript: string | null;
  error: string | null;
  startedAt: number;
  completedAt: number | null;
}

const activeJobs = new Map<string, VideoJob>();

// ─── Golpo Client ────────────────────────────────────────────────────────────

function getGolpoClient(): Golpo {
  const apiKey = ENV.golpoApiKey;
  if (!apiKey) {
    throw new Error('GOLPO_API_KEY is not configured. Please add it in Settings > Secrets.');
  }
  return new Golpo(apiKey);
}

// ─── Voice & Personality Config ──────────────────────────────────────────────

const COACH_INAYAH_VOICE = `Warm, encouraging, and conversational Black woman's voice. 
Speak like you're talking to a friend who's curious about Airbnb investing. 
Use simple language — no jargon. When you mention numbers, explain what they mean in real terms.
Pace should feel natural, not rushed. Pause briefly after key insights to let them land.
Tone: confident but approachable, like a mentor sharing insider knowledge over coffee.`;

const COACH_INAYAH_PERSONALITY = `Coach Inayah — a short-term rental investment educator who helps 
everyday people understand Airbnb and VRBO investing. She breaks down complex real estate data 
into simple, actionable insights. She's known for her warm teaching style and data-driven approach.`;

const AIRBNB_EDUCATION_INSTRUCTIONS = `Create an engaging whiteboard-style explainer video 
suitable for YouTube education content about Airbnb and short-term rental investing.

Visual style guidelines:
- Use clean, professional whiteboard animations
- Include data visualizations when numbers are mentioned (bar charts, pie charts, trend lines)
- Draw property illustrations, maps, and location markers when discussing specific markets
- Use callout boxes for key statistics and revenue numbers
- Include dollar signs and percentage symbols as visual emphasis
- Draw simple house/building icons for property references
- Use arrows and flow diagrams to show investment processes
- Keep text on screen minimal — let the narration carry the story
- Highlight key takeaways with underlines or circles`;

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

  // Create a job
  const jobId = randomUUID();
  const job: VideoJob = {
    jobId,
    scriptId,
    title: script.title,
    status: 'generating',
    videoUrl: null,
    videoScript: null,
    error: null,
    startedAt: Date.now(),
    completedAt: null,
  };
  activeJobs.set(jobId, job);

  // Fire-and-forget: run Golpo in the background
  runVideoGeneration(job, script).catch((err) => {
    console.error(`[Video Gen] Background job ${jobId} failed:`, err);
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
    job.completedAt = Date.now();
  });

  console.log(`[Video Gen] Job ${jobId} started for script #${scriptId}: "${script.title}"`);

  return {
    jobId,
    scriptId,
    title: script.title,
    status: 'generating',
  };
}

// ─── Get Video Job Status ───────────────────────────────────────────────────

export function getVideoStatus(jobId: string): VideoStatusResult {
  const job = activeJobs.get(jobId);
  if (!job) {
    throw new Error(`Video job ${jobId} not found. It may have expired after a server restart.`);
  }

  return {
    jobId: job.jobId,
    scriptId: job.scriptId,
    title: job.title,
    status: job.status,
    videoUrl: job.videoUrl,
    error: job.error,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

// ─── List Active/Recent Jobs ────────────────────────────────────────────────

export function listVideoJobs(): VideoStatusResult[] {
  return Array.from(activeJobs.values())
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 20)
    .map((job) => ({
      jobId: job.jobId,
      scriptId: job.scriptId,
      title: job.title,
      status: job.status,
      videoUrl: job.videoUrl,
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    }));
}

// ─── Background Video Generation ────────────────────────────────────────────

async function runVideoGeneration(
  job: VideoJob,
  script: { title: string; hook: string; script: string; cta: string; format: string },
): Promise<void> {
  const golpo = getGolpoClient();

  // Build the narration script
  const narration = buildNarrationScript(script);
  const prompt = `${AIRBNB_EDUCATION_INSTRUCTIONS}\n\nNarration Script:\n${narration}`;

  // Determine settings — only long-form YT videos
  const isDeepDive = script.format === 'deep_dive';

  console.log(`[Video Gen] Job ${job.jobId}: Calling Golpo API (format: ${script.format}, type: long)`);

  const result = await golpo.createVideo(prompt, {
    style: 'solo-female',
    voiceInstructions: COACH_INAYAH_VOICE,
    personality1: COACH_INAYAH_PERSONALITY,
    bgMusic: 'engaging',
    bgVolume: 1.2,
    videoType: 'long',
    includeWatermark: false,
    timing: isDeepDive ? '2' : '1',
    ttsModel: 'accurate',
    language: 'en',
    outputVolume: 1.0,
  });

  console.log(`[Video Gen] Job ${job.jobId}: Video generated successfully: ${result.videoUrl}`);

  // Update the job
  job.status = 'completed';
  job.videoUrl = result.videoUrl;
  job.videoScript = result.videoScript;
  job.completedAt = Date.now();
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
  console.log(`[Video Gen] Quick start: Script #${scriptId} saved, starting video...`);

  // 3. Start video generation (async, returns immediately)
  const jobResult = await startVideoGeneration(scriptId);

  return {
    ...jobResult,
    savedScriptId: scriptId,
  };
}

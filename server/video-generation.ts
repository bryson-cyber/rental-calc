/**
 * Video Generation Service — Golpo AI Integration
 * 
 * Generates whiteboard animation explainer videos from Content Studio scripts
 * using the Golpo AI SDK. Supports Coach Inayah's persona with solo-female
 * narration style, custom voice instructions, and branded output.
 */

import Golpo from '@golpoai/sdk';
import { ENV } from './_core/env';
import { getDb } from './db';
import { contentScripts } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VideoGenerationOptions {
  /** The content script ID to generate video from */
  scriptId: number;
  /** Video style: short (~1 min) or long (~2+ min) */
  videoType?: 'short' | 'long';
  /** Background music style */
  bgMusic?: 'engaging' | 'lofi' | 'none';
  /** Use color animations instead of black & white */
  useColor?: boolean;
  /** Include Golpo watermark */
  includeWatermark?: boolean;
  /** Custom voice instructions for the narrator */
  voiceInstructions?: string;
  /** Video timing: "1" for ~1 min pacing, "2" for ~2 min pacing */
  timing?: '1' | '2';
}

export interface VideoGenerationResult {
  videoUrl: string;
  script: string;
  scriptId: number;
  format: string;
  title: string;
}

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

// ─── Video Instructions for Airbnb Education Style ───────────────────────────

const AIRBNB_EDUCATION_VIDEO_INSTRUCTIONS = `Create an engaging whiteboard-style explainer video 
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

// ─── Main Generation Function ────────────────────────────────────────────────

export async function generateVideo(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // 1. Fetch the script from the database
  const [script] = await db
    .select()
    .from(contentScripts)
    .where(eq(contentScripts.id, options.scriptId))
    .limit(1);
  
  if (!script) {
    throw new Error(`Script with ID ${options.scriptId} not found`);
  }

  // 2. Build the full narration script for Golpo
  const fullScript = buildNarrationScript({
    title: script.title,
    hook: script.hook,
    fullScript: script.script,
    cta: script.cta,
    format: script.format,
  });

  // 3. Determine video settings based on script format
  const videoSettings = getVideoSettings(script.format, options);

  // 4. Call Golpo AI to generate the video
  const golpo = getGolpoClient();
  
  console.log(`[Video Gen] Starting video generation for script #${options.scriptId}: "${script.title}"`);
  console.log(`[Video Gen] Format: ${script.format}, VideoType: ${videoSettings.videoType}, Timing: ${videoSettings.timing}`);
  
  // The SDK's CreateVideoOptions doesn't include newScript/useColor/videoInstructions
  // in its type definitions, but the API docs show they're supported.
  // We pass the script as the prompt and include visual instructions there.
  const prompt = `${AIRBNB_EDUCATION_VIDEO_INSTRUCTIONS}\n\nNarration Script:\n${fullScript}`;

  const result = await golpo.createVideo(
    prompt,
    {
      style: 'solo-female',
      voiceInstructions: options.voiceInstructions || COACH_INAYAH_VOICE,
      personality1: COACH_INAYAH_PERSONALITY,
      bgMusic: videoSettings.bgMusic,
      bgVolume: 1.2,
      videoType: videoSettings.videoType,
      includeWatermark: options.includeWatermark ?? false,
      timing: videoSettings.timing,
      ttsModel: 'accurate',
      language: 'en',
      outputVolume: 1.0,
    }
  );

  console.log(`[Video Gen] Video generated successfully: ${result.videoUrl}`);

  return {
    videoUrl: result.videoUrl,
    script: result.videoScript,
    scriptId: options.scriptId,
    format: script.format,
    title: script.title,
  };
}

// ─── Build Narration Script ──────────────────────────────────────────────────

function buildNarrationScript(script: {
  title: string;
  hook: string;
  fullScript: string;
  cta: string;
  format: string;
}): string {
  // Golpo works best with a clean, flowing narration script
  // We combine hook + full script + CTA into one seamless narration
  const parts: string[] = [];

  // Hook — the attention-grabbing opener
  if (script.hook) {
    parts.push(script.hook);
    parts.push(''); // blank line for natural pause
  }

  // Main body — the full script content
  if (script.fullScript) {
    parts.push(script.fullScript);
    parts.push(''); // blank line for natural pause
  }

  // CTA — the call to action
  if (script.cta) {
    parts.push(script.cta);
  }

  return parts.join('\n');
}

// ─── Video Settings by Format ────────────────────────────────────────────────

function getVideoSettings(
  format: string,
  options: VideoGenerationOptions
): {
  videoType: 'short' | 'long';
  bgMusic: 'engaging' | 'lofi' | null;
  timing: '1' | '2';
} {
  // Map our bgMusic options to Golpo's accepted types
  const rawBgMusic = options.bgMusic ?? 'engaging';
  const bgMusic: 'engaging' | 'lofi' | null = 
    rawBgMusic === 'none' ? null : 
    (rawBgMusic === 'engaging' || rawBgMusic === 'lofi') ? rawBgMusic : 'engaging';
  
  switch (format) {
    case 'reel':
    case 'short':
      return {
        videoType: options.videoType ?? 'short',
        bgMusic,
        timing: options.timing ?? '1',
      };
    case 'lesson':
      return {
        videoType: options.videoType ?? 'long',
        bgMusic,
        timing: options.timing ?? '2',
      };
    case 'deep_dive':
      return {
        videoType: options.videoType ?? 'long',
        bgMusic,
        timing: options.timing ?? '2',
      };
    default:
      return {
        videoType: options.videoType ?? 'long',
        bgMusic,
        timing: options.timing ?? '1',
      };
  }
}

// ─── Quick Generate (Script + Video in One Call) ─────────────────────────────

/**
 * Generates a script autonomously using the Content Studio service,
 * then immediately generates a video from it.
 * This is the true "one-click" experience.
 */
export async function quickGenerateVideo(
  videoOptions?: Partial<Omit<VideoGenerationOptions, 'scriptId'>>
): Promise<VideoGenerationResult & { savedScriptId: number }> {
  // Import the autonomous script generator
  const { generateAutonomousScript } = await import('./content-studio');
  const { contentScripts: contentScriptsTable } = await import('../drizzle/schema');
  
  // 1. Generate the script autonomously
  console.log('[Video Gen] Step 1: Generating autonomous script...');
  const { script: result, dataBundle } = await generateAutonomousScript();
  
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
  console.log(`[Video Gen] Step 1 complete: Script #${scriptId} saved`);
  
  // 3. Generate the video from the script
  console.log('[Video Gen] Step 2: Generating video from script...');
  const videoResult = await generateVideo({
    scriptId,
    ...videoOptions,
  });
  
  return {
    ...videoResult,
    savedScriptId: scriptId,
  };
}

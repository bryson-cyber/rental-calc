/**
 * Content Hub Pipeline — Multi-Layer Video Generation Engine
 *
 * The full pipeline from topic → research → script → video:
 *   Layer 1: Research — gathers real platform data + webinar transcript context
 *   Layer 2: Script Generation — Opus 4.6 writes the narration script
 *   Layer 3: Video Production — Golpo AI generates the whiteboard video
 *   Layer 4: Thumbnail — (future) generates a YouTube thumbnail
 *
 * Each layer updates the content_hub_videos row as it progresses.
 * The pipeline runs asynchronously — the client polls for status.
 *
 * Brain dump flow: user provides rough idea → Opus enhances it → full script
 * Topic suggestion: AI picks the best topic from platform data
 */

import { ENV } from './_core/env';
import { getDb } from './db';
import { contentHubVideos, contentHubPresets } from '../drizzle/schema';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { routedLLMCall, FEATURES } from './model-router';
import {
  gatherContentData,
  formatDataForPrompt,
  type ContentDataBundle,
} from './content-data-pipeline';
import axios from 'axios';
import qs from 'qs';

// ─── Types ───────────────────────────────────────────────────────────────────

export type VideoStatus =
  | 'pipeline_queued'
  | 'researching'
  | 'scripting'
  | 'script_review'
  | 'script_only'
  | 'video_generating'
  | 'video_complete'
  | 'video_failed'
  | 'pipeline_failed';

export type ScriptMode = 'own_script' | 'ai_enhance' | 'ai_generate';

export interface PipelineInput {
  topic: string;
  format: 'lesson' | 'deep_dive';
  userId: number;
  /** Script input mode */
  scriptMode?: ScriptMode;
  /** User-provided script (required for own_script and ai_enhance modes) */
  userScript?: string;
  /** Optional overrides */
  voiceStyle?: string;
  contentFocus?: string;
  contentLength?: string;
  storyFormat?: string;
  persona?: string;
  bgMusic?: string;
  ttsStyle?: string;
  timing?: string;
  /** If true, stop after script generation (don't send to Golpo) */
  scriptOnly?: boolean;
  /** Brain dump: rough idea that Opus will enhance */
  brainDump?: string;
}

export interface PipelineResult {
  videoId: number;
  status: VideoStatus;
}

export interface TopicSuggestion {
  topic: string;
  format: 'lesson' | 'deep_dive';
  angle: string;
  whyCompelling: string;
  estimatedEngagement: 'high' | 'medium' | 'low';
}

// ─── Golpo Config ────────────────────────────────────────────────────────────

const GOLPO_BASE_URL = ENV.golpoBaseUrl || 'https://api.golpoai.com';

function getGolpoApiKey(): string {
  const apiKey = ENV.golpoApiKey;
  if (!apiKey) throw new Error('GOLPO_API_KEY is not configured.');
  return apiKey;
}

// ─── In-memory tracking ──────────────────────────────────────────────────────

const activePipelines = new Set<number>();

// ─── Coach Inayah Persona & Domain Context ──────────────────────────────────

const PERSONA_SYSTEM_PROMPT = `## PERSONA
You are Coach Inayah — a confident, data-driven short-term rental educator and entrepreneur. You speak directly and conversationally (never corporate or stiff). You back every claim with real data. You make complex topics feel simple and accessible for complete beginners. You build trust through transparency — "I'm showing you the real numbers, not the highlight reel."

You have deep expertise in Airbnb arbitrage, market analysis, deal evaluation, STR regulations, and scaling rental portfolios. You built a free suite of research tools at coachinayahturnkeytool.com that is rated Excellent on Trustpilot with 57 reviews.

## CONTEXT — COACH INAYAH TURNKEY TOOL
Coach Inayah's Turnkey Tool (coachinayahturnkeytool.com) is a free 9-step STR research suite:
1. Regulation Checker — checks if STR is legal in a city
2. Property Finder — finds available properties in a target market
3. Revenue Calculator — shows what hosts actually earn (powered by market data)
4. Competitor Explorer — shows every active listing's revenue, occupancy, ADR
5. Deal Validator — gives GO / CAUTION / PASS verdict with confidence score
6. Comparison Tool — compares saved properties side by side
7. Map View — shows competition on a map
8. Market Advisor — comprehensive market analysis with investment memo
9. AI Advisor — conversational AI that answers any STR question with data

Advanced features: One-Click Market Evaluation, Deal Alert Agent, Full Property Report Generator.
Rated Excellent on Trustpilot with 57 reviews.

CTA patterns:
- "Go to coachinayahturnkeytool.com right now — enter any address and see exactly what it could earn. It's completely free."
- "The link is in my bio. Enter your city, pick a property, and the tool does all the analysis for you."
- "Stop guessing. Go to coachinayahturnkeytool.com, type in an address, and see the real numbers. Free. No sign-up required."

## CONTEXT — STR DOMAIN KNOWLEDGE
STR Investing Curriculum — Key Concepts:

ARBITRAGE MODEL: Rent a property long-term → furnish it → list on Airbnb/VRBO → keep the difference.
Monthly profit = STR revenue - rent - operating expenses (cleaning, supplies, insurance, utilities, software).
Typical startup costs: $3,000-$8,000 per unit (furniture, supplies, photography, initial marketing).

KEY METRICS:
- ADR (Average Daily Rate): What you charge per night
- Occupancy Rate: Percentage of nights booked (good = 65-80%)
- RevPAR: Revenue per available night = ADR × occupancy
- Rent-to-Revenue Ratio: Monthly rent ÷ monthly STR revenue (below 0.40 = strong deal)
- Break-Even Occupancy: Minimum nights needed to cover costs

MARKET EVALUATION: Look at total active listings, average revenue by bedroom count, seasonality patterns, supply trends, booking patterns, and regulation status.

DEAL EVALUATION: Use 3-5 comparable properties in the same neighborhood. Red flags: rent-to-revenue above 0.55, break-even occupancy above 60%, declining occupancy trends, strict regulations, oversaturated market.

FIVE-STEP MONEY MAKING SYSTEM (from Coach Inayah's webinar):
Step 1: Budget — Understand startup costs ($10K-$20K typically)
Step 2: Research — Find profitable markets and properties using the Turnkey Tool
Step 3: Get Your First Yes — Approach landlords with a professional business proposal (83% yes rate)
Step 4: Design & Furnish — Turn the space into a guest-ready property
Step 5: Launch & Optimize — List on platforms, set pricing, get bookings

## CONTEXT — DATA CAPABILITIES (branded as "Coach Inayah market data")
NEVER mention "AirDNA" — always say "Coach Inayah market data" or "the tool."

## RULES
1. EVERY script MUST start with a scroll-stopping hook in the first sentence.
2. EVERY script MUST end with a clear CTA driving to coachinayahturnkeytool.com.
3. Use real numbers, percentages, and dollar amounts — never vague language.
4. Reference the tool's capabilities naturally (not as an ad — as proof of expertise).
5. Never mention "AirDNA" — always say "Coach Inayah market data" or "the tool."
6. Include at least one specific city/market example with real data points.
7. Do NOT include stage directions, camera notes, or production instructions.
8. Output ONLY the narration script — what the speaker actually says out loud.
9. The script must tell a STORY — narrative arc, not just a list of facts.
10. Weave data points into the story naturally.

## CRITICAL — THIRD-GRADE UNDERSTANDING RULE
The audience understands concepts at a THIRD-GRADE level. This does NOT mean third-grade language — you still sound smart, confident, and authoritative. It means every concept must be explained so simply that anyone can follow it on the first listen.

MANDATORY LANGUAGE RULES:
- Say "money coming in" NOT "revenue"
- Say "what you'd make" NOT "projected earnings"
- Say "what you pay in rent" NOT "monthly lease obligation"
- Say "how often it's booked" NOT "occupancy rate"
- Say "what you charge per night" NOT "average daily rate"
- Say "the money you actually keep" NOT "net profit"
- Say "what similar places nearby are making" NOT "comparable property analysis"
- Say "whether it's worth it" NOT "deal validation"
- Say "the rules in your city" NOT "regulatory framework"
- If a concept needs a jargon word, say the simple version FIRST, then drop the term
- Use analogies from everyday life
- One idea per sentence. Short sentences. Conversational rhythm.`;

// ─── Video Visual Instructions ───────────────────────────────────────────────

const VIDEO_INSTRUCTIONS = `Create a clean, professional whiteboard teaching video on a WHITE background.

CRITICAL VISUAL REQUIREMENTS:
- WHITE background only — this must look like a real whiteboard lesson
- Clean, hand-drawn style illustrations and diagrams
- Use data visualizations when numbers are mentioned (bar charts, pie charts, trend lines)
- Draw property illustrations, maps, and location markers when discussing specific markets
- Use callout boxes for key statistics and revenue numbers
- Include dollar signs and percentage symbols as visual emphasis
- Draw simple house/building icons for property references
- Use arrows and flow diagrams to show investment processes
- Keep text on screen minimal — let the narration carry the story
- Highlight key takeaways with underlines or circles
- Pacing should be educational — give the viewer time to absorb each point`;

const VOICE_INSTRUCTIONS = `Warm, encouraging, and conversational Black woman's voice.
Speak like you're coaching a friend who's curious about Airbnb investing.
Use simple language — no jargon. When you mention numbers, explain what they mean in real terms.
Pace should feel natural and measured, not rushed. Pause briefly after key insights to let them land.
Tone: confident but approachable, like a mentor sharing insider knowledge over coffee.
This is a teaching video — take your time explaining each concept thoroughly.`;

const PERSONALITY = `Coach Inayah — a short-term rental investment educator who helps
everyday people understand Airbnb and VRBO investing. She breaks down complex real estate data
into simple, actionable insights. She's known for her warm teaching style and data-driven approach.`;

// ─── Format Specs ────────────────────────────────────────────────────────────

const FORMAT_SPECS: Record<string, { name: string; wordRange: string; structure: string }> = {
  lesson: {
    name: 'YouTube Coaching Lesson',
    wordRange: '1500-2000 words',
    structure: 'Hook (10s) → Set the scene (30s) → Teaching point 1 with data (90s) → Teaching point 2 with story (90s) → Teaching point 3 with example (90s) → Recap (30s) → CTA (20s)',
  },
  deep_dive: {
    name: 'YouTube Deep Dive Masterclass',
    wordRange: '2000-3000 words',
    structure: 'Hook (10s) → Big picture (45s) → Deep breakdown 1 with data (120s) → Deep breakdown 2 with case study (120s) → Deep breakdown 3 with analysis (120s) → Deep breakdown 4 with steps (90s) → Takeaways (45s) → CTA (30s)',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 1: RESEARCH
// ═══════════════════════════════════════════════════════════════════════════════

async function runLayer1Research(videoId: number): Promise<{
  dataBundle: ContentDataBundle;
  formattedData: string;
  durationMs: number;
}> {
  const start = Date.now();
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.update(contentHubVideos)
    .set({ status: 'researching', pipelineStage: 'Layer 1: Gathering platform data...' })
    .where(eq(contentHubVideos.id, videoId));

  console.log(`[ContentHub] Video #${videoId}: Layer 1 — Gathering research data...`);

  const dataBundle = await gatherContentData();
  const formattedData = formatDataForPrompt(dataBundle);

  const durationMs = Date.now() - start;
  console.log(`[ContentHub] Video #${videoId}: Layer 1 complete in ${durationMs}ms`);

  // Save research results
  await db.update(contentHubVideos)
    .set({
      realTimeFacts: formattedData,
      sources: JSON.stringify(dataBundle.platformStats.topMarkets),
      searchQueries: JSON.stringify(dataBundle.platformStats.recentSearches),
      layer1DurationMs: durationMs,
      pipelineStage: 'Layer 1: Research complete',
    })
    .where(eq(contentHubVideos.id, videoId));

  return { dataBundle, formattedData, durationMs };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 2: SCRIPT GENERATION (Opus 4.6)
// ═══════════════════════════════════════════════════════════════════════════════

async function runLayer2ScriptGeneration(
  videoId: number,
  topic: string,
  format: string,
  formattedData: string,
  brainDump?: string,
): Promise<{
  narrationScript: string;
  durationMs: number;
}> {
  const start = Date.now();
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.update(contentHubVideos)
    .set({ status: 'scripting', pipelineStage: 'Layer 2: Generating script with Opus 4.6...' })
    .where(eq(contentHubVideos.id, videoId));

  console.log(`[ContentHub] Video #${videoId}: Layer 2 — Script generation via Opus...`);

  const spec = FORMAT_SPECS[format] || FORMAT_SPECS.lesson;

  // Build the user prompt
  let userPrompt = `## TASK — GENERATE NARRATION SCRIPT

Topic: ${topic}
Format: ${spec.name}
Word count target: ${spec.wordRange}
Structure: ${spec.structure}

`;

  if (brainDump) {
    userPrompt += `## BRAIN DUMP (User's rough idea — enhance this into a full script)
${brainDump}

Take this rough idea and transform it into a polished, complete narration script. Keep the core message but make it compelling, data-rich, and structured properly.

`;
  }

  userPrompt += `## LIVE PLATFORM DATA (use these REAL numbers)
${formattedData}

## REQUIREMENTS
1. Write the COMPLETE, word-for-word narration script. This is what the speaker reads aloud.
2. Start with a scroll-stopping hook in the first sentence.
3. End with a clear CTA driving to coachinayahturnkeytool.com.
4. Weave real data points from the platform data throughout.
5. MINIMUM ${format === 'deep_dive' ? '2000' : '1500'} words. This must fill ${format === 'deep_dive' ? '8-12' : '5-8'} minutes of spoken narration.
6. Use the third-grade understanding rule — explain everything simply.
7. Tell a STORY with a narrative arc, not just a list of facts.
8. Include transitions between sections.
9. Do NOT include stage directions, camera notes, or [brackets].
10. Output ONLY the narration text — nothing else. No JSON, no markdown, no headers.`;

  const rawScript = await routedLLMCall(
    FEATURES.CONTENT_HUB_SCRIPT,
    userPrompt,
    {
      systemPrompt: PERSONA_SYSTEM_PROMPT,
      maxTokens: 16384,
    },
  );

  if (!rawScript || rawScript.trim().length < 200) {
    throw new Error('Script generation returned empty or too-short result');
  }

  // Clean up any accidental markdown/JSON wrapping
  let narrationScript = rawScript.trim();
  if (narrationScript.startsWith('```')) {
    narrationScript = narrationScript.split('\n').slice(1).join('\n');
    narrationScript = narrationScript.replace(/```\s*$/, '').trim();
  }

  const wordCount = narrationScript.split(/\s+/).length;
  const durationMs = Date.now() - start;

  console.log(`[ContentHub] Video #${videoId}: Layer 2 complete — ${wordCount} words in ${durationMs}ms`);

  // Save the script
  await db.update(contentHubVideos)
    .set({
      narrationScript,
      layer2DurationMs: durationMs,
      modelsUsed: JSON.stringify(['opus-4.6']),
      pipelineStage: 'Layer 2: Script complete',
    })
    .where(eq(contentHubVideos.id, videoId));

  return { narrationScript, durationMs };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 3: VIDEO PRODUCTION (Golpo AI)
// ═══════════════════════════════════════════════════════════════════════════════

async function runLayer3VideoProduction(
  videoId: number,
  narrationScript: string,
  options: {
    timing?: string;
    bgMusic?: string;
    ttsStyle?: string;
  } = {},
): Promise<{
  videoUrl: string;
  golpoJobId: string;
  durationMs: number;
}> {
  const start = Date.now();
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.update(contentHubVideos)
    .set({ status: 'video_generating', pipelineStage: 'Layer 3: Submitting to Golpo AI...' })
    .where(eq(contentHubVideos.id, videoId));

  console.log(`[ContentHub] Video #${videoId}: Layer 3 — Submitting to Golpo AI...`);

  const apiKey = getGolpoApiKey();

  // Build form fields matching the Golpo Python SDK format (url-encoded, NOT multipart)
  const fields: Record<string, string> = {
    prompt: 'Create an educational Airbnb investing whiteboard explainer video using the provided script.',
    new_script: narrationScript,
    style: options.ttsStyle || 'solo-female',
    tts_model: 'accurate',
    video_type: 'long',
    language: 'en',
    use_color: 'false',
    video_instructions: VIDEO_INSTRUCTIONS,
    voice_instructions: VOICE_INSTRUCTIONS,
    personality_1: PERSONALITY,
    bg_music: options.bgMusic || 'engaging',
    bg_volume: '1.4',
    output_volume: '1.0',
    timing: options.timing || '10',
    include_watermark: 'false',
    do_research: 'false',
  };

  // Auto-calculate timing from word count (matching Golpo SDK behavior)
  const wordCount = narrationScript.split(/\s+/).length;
  const estimatedMinutes = wordCount / 150;
  const autoTiming = String(Math.round(estimatedMinutes * 2) / 2); // Round to nearest 0.5
  fields.timing = autoTiming; // Override with calculated timing
  console.log(`[ContentHub] Video #${videoId}: Script ${wordCount} words, auto-timing=${autoTiming} min`);

  // Submit to Golpo using url-encoded form data (matching SDK behavior)
  const response = await axios.post(`${GOLPO_BASE_URL}/generate`, qs.stringify(fields), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-api-key': apiKey,
    },
    timeout: 240_000,
    maxBodyLength: Infinity,
  });

  const golpoJobId = response.data.job_id;
  if (!golpoJobId) {
    throw new Error(`Golpo API did not return a job_id: ${JSON.stringify(response.data)}`);
  }

  console.log(`[ContentHub] Video #${videoId}: Golpo job submitted: ${golpoJobId}`);

  // Save the Golpo job ID
  await db.update(contentHubVideos)
    .set({
      golpoJobId,
      pipelineStage: `Layer 3: Golpo job ${golpoJobId} — generating video...`,
    })
    .where(eq(contentHubVideos.id, videoId));

  // Poll for completion
  const videoUrl = await pollGolpoUntilDone(videoId, golpoJobId);

  const durationMs = Date.now() - start;
  console.log(`[ContentHub] Video #${videoId}: Layer 3 complete in ${Math.round(durationMs / 1000)}s`);

  return { videoUrl, golpoJobId, durationMs };
}

async function pollGolpoUntilDone(
  videoId: number,
  golpoJobId: string,
  pollIntervalMs = 15000,
  maxWaitMs = 1_800_000, // 30 minutes (long scripts need more time)
): Promise<string> {
  const apiKey = getGolpoApiKey();
  const db = await getDb();
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await axios.get(`${GOLPO_BASE_URL}/status/${golpoJobId}`, {
        headers: { 'x-api-key': apiKey },
        timeout: 30_000,
      });

      const data = response.data;

      if (data.status === 'completed') {
        const videoUrl = data.podcast_url || data.video_url || '';
        console.log(`[ContentHub] Video #${videoId}: Golpo job completed! URL: ${videoUrl}`);
        return videoUrl;
      }

      if (data.status === 'failed' || data.status === 'error') {
        throw new Error(`Golpo job failed: ${data.error || JSON.stringify(data)}`);
      }

      // Update progress
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (db) {
        await db.update(contentHubVideos)
          .set({ pipelineStage: `Layer 3: Generating video... (${elapsed}s elapsed)` })
          .where(eq(contentHubVideos.id, videoId));
      }

      console.log(`[ContentHub] Video #${videoId}: Still generating... (${elapsed}s)`);
    } catch (err: any) {
      if (err.message?.includes('failed')) throw err;
      console.warn(`[ContentHub] Video #${videoId}: Polling error, retrying:`, err.message);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Golpo job ${golpoJobId} timed out after ${maxWaitMs / 1000}s`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PIPELINE ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start the full pipeline. Returns immediately with the video ID.
 * The pipeline runs in the background, updating the DB row as it progresses.
 */
export async function startPipeline(input: PipelineInput): Promise<PipelineResult> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const scriptMode = input.scriptMode || 'ai_generate';

  // Create the video row
  const [inserted] = await db.insert(contentHubVideos).values({
    userId: input.userId,
    topic: input.topic,
    format: input.format,
    timing: input.timing || 'auto',
    scriptMode,
    userScript: input.userScript || null,
    voiceStyle: input.voiceStyle,
    contentFocus: input.contentFocus,
    contentLength: input.contentLength,
    storyFormat: input.storyFormat,
    persona: input.persona || 'coach-inayah',
    bgMusic: input.bgMusic || 'engaging',
    ttsStyle: input.ttsStyle || 'solo-female',
    status: 'pipeline_queued',
    pipelineStage: 'Queued — starting pipeline...',
  });

  const videoId = inserted.insertId;
  console.log(`[ContentHub] Pipeline started for video #${videoId}: "${input.topic}"`);

  // Run the pipeline in the background
  runPipelineBackground(videoId, input).catch(async (err) => {
    console.error(`[ContentHub] Pipeline failed for video #${videoId}:`, err);
    if (db) {
      await db.update(contentHubVideos)
        .set({
          status: 'pipeline_failed',
          error: err instanceof Error ? err.message : String(err),
          pipelineStage: 'Pipeline failed',
        })
        .where(eq(contentHubVideos.id, videoId));
    }
    activePipelines.delete(videoId);
  });

  return { videoId, status: 'pipeline_queued' };
}

async function runPipelineBackground(videoId: number, input: PipelineInput): Promise<void> {
  activePipelines.add(videoId);
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const pipelineStart = Date.now();
  const scriptMode = input.scriptMode || 'ai_generate';

  try {
    let narrationScript: string;

    if (scriptMode === 'own_script') {
      // ── OWN SCRIPT: User provides the final script, skip Layer 1 & 2 ──
      if (!input.userScript) throw new Error('userScript is required for own_script mode');
      narrationScript = input.userScript;

      // Save the script and pause at script_review so user can confirm before video
      await db.update(contentHubVideos)
        .set({
          narrationScript,
          status: 'script_review',
          layer1DurationMs: 0,
          layer2DurationMs: 0,
          pipelineStage: 'Your script is ready for review — approve to generate video',
        })
        .where(eq(contentHubVideos.id, videoId));

      console.log(`[ContentHub] Video #${videoId}: Own script saved, paused at script_review`);
      activePipelines.delete(videoId);
      return; // Pipeline pauses here — user approves via updateScript()

    } else if (scriptMode === 'ai_enhance') {
      // ── AI ENHANCE: Run research, then enhance user's script (don't rewrite) ──
      if (!input.userScript) throw new Error('userScript is required for ai_enhance mode');

      // Layer 1: Research (for data enrichment)
      const { formattedData } = await runLayer1Research(videoId);

      // Layer 2: Enhance the user's script with AI
      const { narrationScript: enhanced } = await runLayer2EnhanceScript(
        videoId,
        input.topic,
        input.format,
        input.userScript,
        formattedData,
      );
      narrationScript = enhanced;

      // Pause at script_review so user can see what AI changed
      await db.update(contentHubVideos)
        .set({
          narrationScript,
          status: 'script_review',
          pipelineStage: 'AI-enhanced script ready for review — approve to generate video',
        })
        .where(eq(contentHubVideos.id, videoId));

      console.log(`[ContentHub] Video #${videoId}: AI-enhanced script ready, paused at script_review`);
      activePipelines.delete(videoId);
      return; // Pipeline pauses here — user approves via updateScript()

    } else {
      // ── AI GENERATE: Full pipeline — research + AI writes from scratch ──
      // Layer 1: Research
      const { formattedData } = await runLayer1Research(videoId);

      // Layer 2: Script Generation
      const result = await runLayer2ScriptGeneration(
        videoId,
        input.topic,
        input.format,
        formattedData,
        input.brainDump,
      );
      narrationScript = result.narrationScript;

      // Pause at script_review so user can review AI-generated script
      await db.update(contentHubVideos)
        .set({
          narrationScript,
          status: 'script_review',
          pipelineStage: 'AI-generated script ready for review — approve to generate video',
        })
        .where(eq(contentHubVideos.id, videoId));

      console.log(`[ContentHub] Video #${videoId}: AI-generated script ready, paused at script_review`);
      activePipelines.delete(videoId);
      return; // Pipeline pauses here — user approves via updateScript()
    }
  } finally {
    activePipelines.delete(videoId);
  }
}

/**
 * Layer 2 variant: Enhance (don't rewrite) the user's script.
 * Keeps the user's words and ideas intact, but polishes delivery,
 * adds transitions, improves flow, and injects data points.
 */
async function runLayer2EnhanceScript(
  videoId: number,
  topic: string,
  format: string,
  userScript: string,
  researchData: string,
): Promise<{ narrationScript: string }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.update(contentHubVideos)
    .set({ status: 'scripting', pipelineStage: 'Layer 2: AI is enhancing your script...' })
    .where(eq(contentHubVideos.id, videoId));

  const startMs = Date.now();

  const enhancePrompt = `You are a professional script editor for Coach Inayah's YouTube channel about Airbnb arbitrage.

Your job is to ENHANCE the user's script — NOT rewrite it. Follow these rules:

1. KEEP the user's exact words, phrasing, and ideas as much as possible
2. KEEP the user's voice and personality — don't make it sound generic
3. You MAY:
   - Fix grammar and awkward phrasing (minor polish only)
   - Add smooth transitions between sections
   - Insert 1-2 real data points from the research data below (naturally, not forced)
   - Suggest a stronger hook if the opening is weak
   - Add a clear call-to-action at the end if missing
   - Improve the flow and pacing for video narration
4. You MUST NOT:
   - Change the core message or argument
   - Add entire new sections the user didn't write about
   - Remove sections the user wrote
   - Change the user's examples or stories to different ones
   - Make it sound like a different person wrote it

Format: ${format === 'deep_dive' ? '8-12 minute deep dive' : '5-8 minute lesson'}
Topic: ${topic}

LIVE PLATFORM DATA (use sparingly to enrich, not to rewrite):
${researchData}

USER'S ORIGINAL SCRIPT:
${userScript}

Return ONLY the enhanced narration script. No headers, no notes, no commentary.`;

  const enhanced = await routedLLMCall(
    FEATURES.CONTENT_HUB_SCRIPT,
    [
      { role: 'system', content: 'You are a script editor. Enhance, do not rewrite. Preserve the author\'s voice.' },
      { role: 'user', content: enhancePrompt },
    ],
    { effort: 'high', maxTokens: 16384 },
  );
  if (!enhanced) throw new Error('AI returned empty enhanced script');

  const durationMs = Date.now() - startMs;
  console.log(`[ContentHub] Video #${videoId}: Layer 2 (enhance) complete in ${Math.round(durationMs / 1000)}s — ${enhanced.split(/\s+/).length} words`);

  await db.update(contentHubVideos)
    .set({ layer2DurationMs: durationMs })
    .where(eq(contentHubVideos.id, videoId));

  return { narrationScript: enhanced };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOPIC SUGGESTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export async function suggestTopics(count: number = 5): Promise<TopicSuggestion[]> {
  const dataBundle = await gatherContentData();
  const formattedData = formatDataForPrompt(dataBundle);

  const previousTopicsList = dataBundle.previousTopics.length > 0
    ? `\n\nPREVIOUSLY GENERATED TOPICS (do NOT repeat these):\n${dataBundle.previousTopics.map((t) => `- ${t}`).join('\n')}`
    : '';

  const prompt = `Based on the live platform data below, suggest ${count} compelling video topics for Coach Inayah's YouTube channel about Airbnb arbitrage.

${formattedData}
${previousTopicsList}

For each topic, provide:
1. The topic/title (compelling, click-worthy)
2. The best format (lesson or deep_dive)
3. The angle — what makes this interesting
4. Why it's compelling — what data supports it
5. Estimated engagement level (high/medium/low)

Prioritize topics that:
- Use REAL data from the platform (specific properties, markets, numbers)
- Would make someone stop scrolling
- Haven't been covered before
- Are timely and relevant

Return a JSON array of objects with fields: topic, format, angle, whyCompelling, estimatedEngagement.
Return ONLY valid JSON. No markdown fences.`;

  const rawText = await routedLLMCall(
    FEATURES.CONTENT_HUB_SCRIPT,
    prompt,
    {
      systemPrompt: PERSONA_SYSTEM_PROMPT,
      maxTokens: 4096,
    },
  );

  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.split('\n').slice(1).join('\n');
    cleaned = cleaned.replace(/```\s*$/, '').trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed.slice(0, count) : [];
  } catch {
    console.error('[ContentHub] Failed to parse topic suggestions:', cleaned.slice(0, 500));
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT REVIEW — Edit and re-submit
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update the script for a video that's in script_review or script_only status.
 * Optionally continue to video generation.
 */
export async function updateScript(
  videoId: number,
  newScript: string,
  continueToVideo: boolean = false,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [video] = await db.select()
    .from(contentHubVideos)
    .where(eq(contentHubVideos.id, videoId))
    .limit(1);

  if (!video) throw new Error('Video not found');
  if (!['script_review', 'script_only', 'pipeline_failed', 'video_failed'].includes(video.status)) {
    throw new Error(`Cannot edit script in status "${video.status}"`);
  }

  await db.update(contentHubVideos)
    .set({ narrationScript: newScript })
    .where(eq(contentHubVideos.id, videoId));

  if (continueToVideo) {
    // Resume pipeline from Layer 3
    runLayer3VideoProduction(videoId, newScript, {
      timing: video.timing || undefined,
      bgMusic: video.bgMusic || undefined,
      ttsStyle: video.ttsStyle || undefined,
    }).then(async ({ videoUrl, golpoJobId, durationMs }) => {
      const totalMs = (video.layer1DurationMs || 0) + (video.layer2DurationMs || 0) + durationMs;
      await db.update(contentHubVideos)
        .set({
          status: 'video_complete',
          videoUrl,
          videoId: golpoJobId,
          layer3DurationMs: durationMs,
          totalDurationMs: totalMs,
          pipelineStage: 'Pipeline complete (after script edit)',
        })
        .where(eq(contentHubVideos.id, videoId));
    }).catch(async (err) => {
      await db.update(contentHubVideos)
        .set({
          status: 'video_failed',
          error: err instanceof Error ? err.message : String(err),
          pipelineStage: 'Video generation failed after script edit',
        })
        .where(eq(contentHubVideos.id, videoId));
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS & LISTING
// ═══════════════════════════════════════════════════════════════════════════════

export async function getVideoById(videoId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [video] = await db.select()
    .from(contentHubVideos)
    .where(eq(contentHubVideos.id, videoId))
    .limit(1);

  if (!video) throw new Error('Video not found');
  return video;
}

export async function listVideos(options: {
  userId?: number;
  status?: VideoStatus;
  format?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const db = await getDb();
  if (!db) return { videos: [], total: 0 };

  const conditions = [];
  if (options.userId) conditions.push(eq(contentHubVideos.userId, options.userId));
  if (options.status) conditions.push(eq(contentHubVideos.status, options.status));
  if (options.format) conditions.push(eq(contentHubVideos.format, options.format));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = options.limit || 20;
  const offset = options.offset || 0;

  const [videos, countResult] = await Promise.all([
    db.select()
      .from(contentHubVideos)
      .where(where)
      .orderBy(desc(contentHubVideos.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(contentHubVideos)
      .where(where),
  ]);

  return {
    videos,
    total: countResult[0]?.count ?? 0,
  };
}

export async function deleteVideo(videoId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  if (activePipelines.has(videoId)) {
    throw new Error('Cannot delete a video while its pipeline is running');
  }

  await db.delete(contentHubVideos).where(eq(contentHubVideos.id, videoId));
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start multiple pipelines from a list of topics.
 * Returns immediately with all video IDs.
 */
export async function startBatch(
  topics: Array<{ topic: string; format: 'lesson' | 'deep_dive' }>,
  userId: number,
  options: Partial<PipelineInput> = {},
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = [];

  for (const item of topics) {
    const result = await startPipeline({
      ...options,
      topic: item.topic,
      format: item.format,
      userId,
    });
    results.push(result);

    // Small delay between submissions to avoid overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

export async function savePreset(
  userId: number,
  preset: {
    name: string;
    emoji?: string;
    format?: string;
    voiceStyle?: string;
    contentFocus?: string;
    contentLength?: string;
    storyFormat?: string;
    persona?: string;
    bgMusic?: string;
  },
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [inserted] = await db.insert(contentHubPresets).values({
    userId,
    name: preset.name,
    emoji: preset.emoji || '⚡',
    format: preset.format,
    voiceStyle: preset.voiceStyle,
    contentFocus: preset.contentFocus,
    contentLength: preset.contentLength,
    storyFormat: preset.storyFormat,
    persona: preset.persona,
    bgMusic: preset.bgMusic,
  });

  return { id: inserted.insertId };
}

export async function listPresets(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(contentHubPresets)
    .where(eq(contentHubPresets.userId, userId))
    .orderBy(desc(contentHubPresets.createdAt));
}

export async function deletePreset(presetId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.delete(contentHubPresets)
    .where(and(
      eq(contentHubPresets.id, presetId),
      eq(contentHubPresets.userId, userId),
    ));
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESUME INCOMPLETE PIPELINES (on server restart)
// ═══════════════════════════════════════════════════════════════════════════════

export async function resumeIncompletePipelines(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const incomplete = await db.select()
      .from(contentHubVideos)
      .where(
        inArray(contentHubVideos.status, ['video_generating'] as any)
      );

    if (incomplete.length === 0) {
      console.log('[ContentHub] No incomplete pipelines to resume.');
      return;
    }

    console.log(`[ContentHub] Found ${incomplete.length} incomplete pipeline(s) to check.`);

    for (const video of incomplete) {
      const ageMs = Date.now() - video.createdAt.getTime();

      // If older than 30 minutes, mark as failed
      if (ageMs > 30 * 60 * 1000) {
        console.log(`[ContentHub] Video #${video.id} is ${Math.round(ageMs / 60000)} min old — marking as timed out.`);
        await db.update(contentHubVideos)
          .set({
            status: 'video_failed',
            error: 'Pipeline timed out after 30 minutes (server restart).',
            pipelineStage: 'Timed out',
          })
          .where(eq(contentHubVideos.id, video.id));
        continue;
      }

      // If it has a Golpo job ID, resume polling
      if (video.golpoJobId) {
        console.log(`[ContentHub] Resuming polling for video #${video.id} (Golpo: ${video.golpoJobId})`);
        pollGolpoUntilDone(video.id, video.golpoJobId).then(async (videoUrl) => {
          await db.update(contentHubVideos)
            .set({
              status: 'video_complete',
              videoUrl,
              pipelineStage: 'Pipeline complete (resumed after restart)',
            })
            .where(eq(contentHubVideos.id, video.id));
        }).catch(async (err) => {
          await db.update(contentHubVideos)
            .set({
              status: 'video_failed',
              error: err instanceof Error ? err.message : String(err),
              pipelineStage: 'Failed after resume',
            })
            .where(eq(contentHubVideos.id, video.id));
        });
      } else {
        // No Golpo job ID — mark as failed
        await db.update(contentHubVideos)
          .set({
            status: 'pipeline_failed',
            error: 'Server restarted before video submission. Please retry.',
            pipelineStage: 'Failed — no Golpo job ID',
          })
          .where(eq(contentHubVideos.id, video.id));
      }
    }
  } catch (err) {
    console.error('[ContentHub] Error resuming pipelines:', err);
  }
}

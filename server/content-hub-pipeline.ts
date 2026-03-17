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
// qs removed — Golpo API v1 uses JSON, not form-encoded data

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a URL-safe slug from a title, with a short random suffix for uniqueness */
function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric
    .replace(/\s+/g, '-')          // spaces to hyphens
    .replace(/-+/g, '-')           // collapse multiple hyphens
    .replace(/^-|-$/g, '')         // trim leading/trailing hyphens
    .slice(0, 150);                // max length
  const suffix = Math.random().toString(36).slice(2, 8); // 6-char random
  return `${base}-${suffix}`;
}

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
  /** Target audience/demographic for script personalization */
  targetAudience?: string;

  // ── Golpo API v1 options ──────────────────────────────────────────────────
  /** Video orientation: "long" (16:9 landscape) or "short" (9:16 vertical) */
  videoType?: string;
  /** TTS model: "accurate" (highest quality) or "flash" (faster) */
  ttsModel?: string;
  /** White background (true) or dark background (false) */
  whiteBg?: boolean;
  /** Output audio volume 0.0-1.0 */
  outputVolume?: string;
  /** Background music volume 0.0-1.0 */
  bgVolume?: string;
  /** Visual style: "default", "sketch", "sketch-advanced", "canvas" */
  visualStyle?: string;
  /** Canvas image style (only when visualStyle=canvas) */
  canvasImageStyle?: string;
  /** Canvas pen style (only when visualStyle=canvas) */
  canvasPenStyle?: string;
  /** Logo URL for brand overlay */
  logoUrl?: string;
  /** Logo placement: tl, tr, bl, br */
  logoPlacement?: string;
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
  targetAudience?: string,
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

  if (targetAudience && targetAudience !== 'general') {
    const audienceLabels: Record<string, string> = {
      healthcare_pros: 'healthcare professionals (doctors, nurses, therapists, pharmacists)',
      teachers: 'teachers and educators (K-12, college professors, administrators)',
      real_estate_agents: 'real estate agents and brokers',
      corporate_professionals: 'corporate professionals (9-to-5 workers looking for side income)',
      military_veterans: 'military veterans and active-duty service members',
      single_parents: 'single parents looking to build additional income',
      retirees: 'retirees and pre-retirees looking to supplement retirement income',
      college_students: 'college students and recent graduates',
      small_business_owners: 'small business owners and entrepreneurs',
      first_responders: 'first responders (police, firefighters, EMTs)',
    };
    const audienceLabel = audienceLabels[targetAudience] || targetAudience;
    userPrompt += `## TARGET AUDIENCE
This script is specifically for ${audienceLabel}.

ADAPT THE SCRIPT for this audience:
- Use examples and scenarios that resonate with their daily life and career
- Reference their typical income range, schedule, and financial goals
- Address their specific concerns and objections about starting STR investing
- Use analogies from their profession to explain STR concepts
- Frame the opportunity in terms of how it fits their lifestyle
- If they work long hours, emphasize passive income and systems
- If they have specialized knowledge, show how it transfers to STR success

`;
  }

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
    // Golpo API v1 options
    videoType?: string;
    ttsModel?: string;
    whiteBg?: boolean;
    outputVolume?: string;
    bgVolume?: string;
    visualStyle?: string;
    canvasImageStyle?: string;
    canvasPenStyle?: string;
    logoUrl?: string;
    logoPlacement?: string;
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

  // Build JSON payload per Golpo API v1 spec (application/json)
  const bgMusicTrack = options.bgMusic || 'engaging';
  const hasBgMusic = bgMusicTrack !== 'none';

  // Map voice style: frontend sends 'solo-female'/'solo-male' but API v1 uses 'solo-female-3'/'solo-male-3'
  let voiceStyle = options.ttsStyle || 'solo-female-3';
  const voiceMap: Record<string, string> = {
    'solo-female': 'solo-female-3',
    'solo-male': 'solo-male-3',
    'auto': 'solo-female-3',
    'authoritative': 'solo-male-3',
    'motivational': 'solo-female-4',
  };
  if (voiceMap[voiceStyle]) voiceStyle = voiceMap[voiceStyle];

  // Resolve all Golpo API v1 options with defaults
  const videoType = options.videoType || 'long';
  const ttsModel = options.ttsModel || 'accurate';
  const whiteBg = options.whiteBg !== false; // default true
  const outputVolume = parseFloat(options.outputVolume || '1.0');
  const bgVolume = parseFloat(options.bgVolume || '0.3');
  const visualStyle = options.visualStyle || 'default';

  // Calculate timing from word count (in minutes as a string, per API spec)
  const wordCount = narrationScript.split(/\s+/).length;
  const estimatedMinutes = wordCount / 150;
  // Use user-provided timing if set, otherwise auto-calculate
  const timing = options.timing || String(Math.max(1, Math.round(estimatedMinutes * 2) / 2));
  console.log(`[ContentHub] Video #${videoId}: Script ${wordCount} words, timing=${timing} min, voice=${voiceStyle}, type=${videoType}, tts=${ttsModel}, style=${visualStyle}`);

  const payload: Record<string, any> = {
    prompt: 'Create an educational Airbnb investing whiteboard explainer video using the provided script.',
    new_script: narrationScript,
    style: voiceStyle,
    tts_model: ttsModel,
    video_type: videoType,
    language: 'en',
    use_color: true,
    white_bg: whiteBg,
    video_instructions: VIDEO_INSTRUCTIONS,
    voice_instructions: VOICE_INSTRUCTIONS,
    personality_1: PERSONALITY,
    add_music: hasBgMusic,
    bg_music: hasBgMusic ? bgMusicTrack : undefined,
    bg_volume: hasBgMusic ? bgVolume : undefined,
    output_volume: outputVolume,
    timing,
    include_watermark: false,
    do_research: false,
    no_voice_chunking: true,

    // Visual style options
    ...(visualStyle === 'sketch' ? { use_lineart_2_style: 'true' } : {}),
    ...(visualStyle === 'sketch-advanced' ? { use_lineart_2_style: 'advanced' } : {}),
    ...(visualStyle === 'canvas' ? {
      use_2_0_style: true,
      image_style: options.canvasImageStyle || 'whiteboard',
      pen_style: options.canvasPenStyle || 'stylus',
    } : {}),

    // Logo options
    ...(options.logoUrl ? {
      logo: options.logoUrl,
      logo_placement: options.logoPlacement || 'tl',
    } : {}),
  };

  // Remove undefined keys
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  // Submit to Golpo API v1 with JSON body
  // Retry up to 3 times with exponential backoff for TLS/network errors
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;
  let response: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[ContentHub] Video #${videoId}: Golpo submit attempt ${attempt}/${MAX_RETRIES}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 240_000);
      try {
        const fetchResp = await fetch(`${GOLPO_BASE_URL}/api/v1/videos/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!fetchResp.ok) throw new Error(`HTTP ${fetchResp.status}: ${await fetchResp.text()}`);
        response = { data: await fetchResp.json() };
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }
      lastError = null;
      break; // Success — exit retry loop
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      console.error(`[ContentHub] Video #${videoId}: Golpo submit attempt ${attempt} failed: ${errMsg}`);

      // Only retry on network/TLS errors, not on 4xx client errors
      const isRetryable = errMsg.includes('socket') || errMsg.includes('TLS') || errMsg.includes('ECONNRESET') ||
        errMsg.includes('ETIMEDOUT') || errMsg.includes('ECONNREFUSED') || errMsg.includes('network') ||
        err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT' || err?.code === 'ECONNREFUSED';

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw new Error(`Golpo API submission failed after ${attempt} attempt(s): ${errMsg}`);
      }

      // Exponential backoff: 5s, 15s, 45s
      const backoffMs = 5000 * Math.pow(3, attempt - 1);
      console.log(`[ContentHub] Video #${videoId}: Retrying in ${backoffMs / 1000}s...`);
      await db.update(contentHubVideos)
        .set({ pipelineStage: `Layer 3: Retry ${attempt}/${MAX_RETRIES} — waiting ${backoffMs / 1000}s...` })
        .where(eq(contentHubVideos.id, videoId));
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  if (!response) {
    throw lastError || new Error('Golpo API submission failed — no response received');
  }

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

/**
 * Poll Golpo status endpoint until video is complete.
 * Matches the Golpo Python SDK behavior:
 *   - 30s timeout per request (not 120s — keeps connections from hanging)
 *   - 5s poll interval (aggressive, like the SDK's default of 2s)
 *   - Silent error handling: network errors are logged and retried, never thrown
 *   - 60-minute max wait (generous for long scripts)
 *   - Only throws on definitive Golpo failure (status === 'failed')
 */
async function pollGolpoUntilDone(
  videoId: number,
  golpoJobId: string,
  pollIntervalMs = 5_000,   // 5 seconds between polls (SDK uses 2s)
  maxWaitMs = 3_600_000,    // 60 minutes max (generous for long scripts)
): Promise<string> {
  const apiKey = getGolpoApiKey();
  const db = await getDb();
  const startTime = Date.now();
  let consecutiveErrors = 0;
  let lastLogTime = 0;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Use native fetch instead of axios — axios has connection pooling issues with Golpo
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetch(`${GOLPO_BASE_URL}/api/v1/videos/status/${golpoJobId}`, {
          headers: { 'x-api-key': apiKey },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        var data = await response.json() as any;
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        throw fetchErr;
      }

      consecutiveErrors = 0; // Reset on successful response

      if (data.status === 'completed') {
        const videoUrl = data.podcast_url || data.video_url || '';
        console.log(`[ContentHub] Video #${videoId}: Golpo job completed! URL: ${videoUrl}`);
        return videoUrl;
      }

      if (data.status === 'failed' || data.status === 'error') {
        throw new Error(`Golpo job failed: ${data.error || JSON.stringify(data)}`);
      }

      // Update progress (throttle DB updates to every 30s to reduce load)
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (db && Date.now() - lastLogTime > 30_000) {
        lastLogTime = Date.now();
        await db.update(contentHubVideos)
          .set({ pipelineStage: `Layer 3: Generating video... (${elapsed}s elapsed)` })
          .where(eq(contentHubVideos.id, videoId));
        console.log(`[ContentHub] Video #${videoId}: Still generating... (${elapsed}s)`);
      }
    } catch (err: any) {
      // Only re-throw if it's a definitive Golpo failure, not a network glitch
      if (err.message?.includes('Golpo job failed')) throw err;

      // Silent retry on network errors (matching SDK behavior)
      consecutiveErrors++;
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      // Only log every 10th consecutive error to avoid log spam
      if (consecutiveErrors % 10 === 1) {
        console.warn(`[ContentHub] Video #${videoId}: Polling error #${consecutiveErrors} at ${elapsed}s (will keep retrying): ${err.message}`);
      }

      // Update DB with error count periodically
      if (db && consecutiveErrors % 20 === 1) {
        await db.update(contentHubVideos)
          .set({ pipelineStage: `Layer 3: Generating video... (${elapsed}s, ${consecutiveErrors} poll retries)` })
          .where(eq(contentHubVideos.id, videoId));
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Instead of throwing immediately, save the state so manual recovery is possible
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.error(`[ContentHub] Video #${videoId}: Polling timed out after ${elapsed}s — video may still be rendering on Golpo. Use Check Status to recover.`);
  throw new Error(`Golpo job ${golpoJobId} timed out after ${elapsed}s. The video may still be rendering — use Check Status to recover.`);
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
    ttsStyle: input.voiceStyle || input.ttsStyle || 'solo-female-3',
    // Golpo API v1 options
    videoType: input.videoType || 'long',
    ttsModel: input.ttsModel || 'accurate',
    whiteBg: (input.whiteBg !== false) ? 1 : 0,
    outputVolume: input.outputVolume || '1.0',
    bgVolume: input.bgVolume || '0.3',
    visualStyle: input.visualStyle || 'default',
    canvasImageStyle: input.canvasImageStyle || null,
    canvasPenStyle: input.canvasPenStyle || null,
    logoUrl: input.logoUrl || null,
    logoPlacement: input.logoPlacement || 'tl',
    targetAudience: input.targetAudience || null,
    slug: generateSlug(input.topic),
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
      // Go straight to video generation — user wrote the script, no review needed.
      if (!input.userScript) throw new Error('userScript is required for own_script mode');
      narrationScript = input.userScript;

      // Save the script and immediately proceed to video generation
      await db.update(contentHubVideos)
        .set({
          narrationScript,
          status: input.scriptOnly ? 'script_only' : 'video_generating',
          layer1DurationMs: 0,
          layer2DurationMs: 0,
          pipelineStage: input.scriptOnly ? 'Script saved (no video requested)' : 'Sending your script to Golpo AI for video generation...',
        })
        .where(eq(contentHubVideos.id, videoId));

      console.log(`[ContentHub] Video #${videoId}: Own script saved, ${input.scriptOnly ? 'script-only mode' : 'proceeding directly to video generation'}`);

      if (input.scriptOnly) {
        activePipelines.delete(videoId);
        return;
      }

      // Go directly to Layer 3 — no review pause
      try {
        const { videoUrl, golpoJobId, durationMs } = await runLayer3VideoProduction(
          videoId,
          narrationScript,
          {
            timing: input.timing,
            bgMusic: input.bgMusic,
            ttsStyle: input.voiceStyle || input.ttsStyle,
            videoType: input.videoType,
            ttsModel: input.ttsModel,
            whiteBg: input.whiteBg,
            outputVolume: input.outputVolume,
            bgVolume: input.bgVolume,
            visualStyle: input.visualStyle,
            canvasImageStyle: input.canvasImageStyle,
            canvasPenStyle: input.canvasPenStyle,
            logoUrl: input.logoUrl,
            logoPlacement: input.logoPlacement,
          },
        );

        const totalMs = durationMs;
        await db.update(contentHubVideos)
          .set({
            status: 'video_complete',
            videoUrl,
            videoId: golpoJobId,
            layer3DurationMs: durationMs,
            totalDurationMs: totalMs,
            pipelineStage: 'Pipeline complete — video ready!',
          })
          .where(eq(contentHubVideos.id, videoId));

        console.log(`[ContentHub] Video #${videoId}: Own script → video complete in ${Math.round(totalMs / 1000)}s`);
      } catch (err: any) {
        await db.update(contentHubVideos)
          .set({
            status: 'video_failed',
            error: err instanceof Error ? err.message : String(err),
            pipelineStage: 'Video generation failed',
          })
          .where(eq(contentHubVideos.id, videoId));
        throw err;
      }
      activePipelines.delete(videoId);
      return;

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
        input.targetAudience,
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
        input.targetAudience,
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
  targetAudience?: string,
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
${targetAudience && targetAudience !== 'general' ? `Target Audience: ${targetAudience}

When enhancing, subtly adapt examples and framing to resonate with this specific audience. Don't change the core content, but adjust analogies and scenarios to be relevant to their profession/lifestyle.
` : ''}
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
      videoType: video.videoType || undefined,
      ttsModel: video.ttsModel || undefined,
      whiteBg: video.whiteBg === 0 ? false : true,
      outputVolume: video.outputVolume || undefined,
      bgVolume: video.bgVolume || undefined,
      visualStyle: video.visualStyle || undefined,
      canvasImageStyle: video.canvasImageStyle || undefined,
      canvasPenStyle: video.canvasPenStyle || undefined,
      logoUrl: video.logoUrl || undefined,
      logoPlacement: video.logoPlacement || undefined,
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

/** Public: fetch a completed video by its URL slug (no auth required) */
export async function getVideoBySlug(slug: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [video] = await db.select({
    id: contentHubVideos.id,
    topic: contentHubVideos.topic,
    format: contentHubVideos.format,
    videoUrl: contentHubVideos.videoUrl,
    thumbnailUrl: contentHubVideos.thumbnailUrl,
    narrationScript: contentHubVideos.narrationScript,
    status: contentHubVideos.status,
    createdAt: contentHubVideos.createdAt,
    slug: contentHubVideos.slug,
  })
    .from(contentHubVideos)
    .where(eq(contentHubVideos.slug, slug))
    .limit(1);

  if (!video) throw new Error('Video not found');
  // Only expose completed videos publicly
  if (video.status !== 'video_complete') throw new Error('Video not available yet');
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

/**
 * Bulk delete multiple videos at once.
 * Skips any videos that have active pipelines running.
 * Returns count of deleted and skipped videos.
 */
export async function bulkDeleteVideos(videoIds: number[]): Promise<{ deleted: number; skipped: number }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Filter out videos with active pipelines
  const activeIds = videoIds.filter(id => activePipelines.has(id));
  const deletableIds = videoIds.filter(id => !activePipelines.has(id));

  if (deletableIds.length === 0) {
    return { deleted: 0, skipped: activeIds.length };
  }

  await db.delete(contentHubVideos).where(inArray(contentHubVideos.id, deletableIds));
  return { deleted: deletableIds.length, skipped: activeIds.length };
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
    // Golpo API v1 options
    videoType?: string;
    ttsModel?: string;
    whiteBg?: boolean;
    outputVolume?: string;
    bgVolume?: string;
    visualStyle?: string;
    canvasImageStyle?: string;
    canvasPenStyle?: string;
    logoUrl?: string;
    logoPlacement?: string;
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
    videoType: preset.videoType,
    ttsModel: preset.ttsModel,
    whiteBg: preset.whiteBg === false ? 0 : preset.whiteBg === true ? 1 : undefined,
    outputVolume: preset.outputVolume,
    bgVolume: preset.bgVolume,
    visualStyle: preset.visualStyle,
    canvasImageStyle: preset.canvasImageStyle,
    canvasPenStyle: preset.canvasPenStyle,
    logoUrl: preset.logoUrl,
    logoPlacement: preset.logoPlacement,
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
// MANUAL STATUS CHECK (recover videos whose polling timed out)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Manually check Golpo status for a video that may have completed but whose
 * polling timed out. This prevents wasted credits by recovering finished videos.
 */
export async function checkGolpoStatus(videoId: number): Promise<{ status: string; videoUrl?: string; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [video] = await db.select()
    .from(contentHubVideos)
    .where(eq(contentHubVideos.id, videoId))
    .limit(1);

  if (!video) throw new Error('Video not found');
  if (!video.golpoJobId) throw new Error('No Golpo job ID — this video was never submitted to Golpo');

  // If already complete, just return
  if (video.status === 'video_complete') {
    return { status: 'video_complete', videoUrl: video.videoUrl || undefined };
  }

  const apiKey = getGolpoApiKey();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    let data: any;
    try {
      const fetchResp = await fetch(`${GOLPO_BASE_URL}/api/v1/videos/status/${video.golpoJobId}`, {
        headers: { 'x-api-key': apiKey },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!fetchResp.ok) throw new Error(`HTTP ${fetchResp.status}`);
      data = await fetchResp.json();
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      throw fetchErr;
    }
    console.log(`[ContentHub] Manual status check for video #${videoId}:`, JSON.stringify(data));

    if (data.status === 'completed') {
      const videoUrl = data.podcast_url || data.video_url || '';
      await db.update(contentHubVideos)
        .set({
          status: 'video_complete',
          videoUrl,
          pipelineStage: 'Pipeline complete (recovered via manual check)',
          error: null,
        })
        .where(eq(contentHubVideos.id, videoId));
      return { status: 'video_complete', videoUrl };
    }

    if (data.status === 'failed' || data.status === 'error') {
      const errorMsg = data.error || 'Golpo reported failure';
      await db.update(contentHubVideos)
        .set({
          status: 'video_failed',
          error: errorMsg,
          pipelineStage: 'Failed (confirmed via manual check)',
        })
        .where(eq(contentHubVideos.id, videoId));
      return { status: 'video_failed', error: errorMsg };
    }

    // Still processing — update DB status back to video_generating if it was marked as failed
    if (video.status === 'video_failed') {
      await db.update(contentHubVideos)
        .set({
          status: 'video_generating',
          pipelineStage: 'Layer 3: Still generating on Golpo (recovered via manual check)',
          error: null,
        })
        .where(eq(contentHubVideos.id, videoId));
      console.log(`[ContentHub] Video #${videoId} recovered from failed → video_generating (Golpo still processing)`);
    }
    return { status: 'still_generating' };
  } catch (err: any) {
    return { status: 'check_failed', error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESUME INCOMPLETE PIPELINES (on server restart)
// ═══════════════════════════════════════════════════════════════════════════════

export async function resumeIncompletePipelines(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Check both video_generating (interrupted) and video_failed with golpoJobId (may still be rendering)
    const incomplete = await db.select()
      .from(contentHubVideos)
      .where(
        inArray(contentHubVideos.status, ['video_generating', 'video_failed'] as any)
      );

    if (incomplete.length === 0) {
      console.log('[ContentHub] No incomplete pipelines to resume.');
      return;
    }

    console.log(`[ContentHub] Found ${incomplete.length} incomplete pipeline(s) to check.`);

    for (const video of incomplete) {
      const ageMs = Date.now() - video.createdAt.getTime();

      // Skip videos older than 2 hours — they're truly dead
      if (ageMs > 2 * 60 * 60 * 1000) {
        if (video.status !== 'video_failed') {
          console.log(`[ContentHub] Video #${video.id} is ${Math.round(ageMs / 60000)} min old — marking as timed out.`);
          await db.update(contentHubVideos)
            .set({
              status: 'video_failed',
              error: 'Pipeline timed out after 2 hours (server restart).',
              pipelineStage: 'Timed out',
            })
            .where(eq(contentHubVideos.id, video.id));
        }
        continue;
      }

      // Skip video_failed entries without a golpoJobId — nothing to recover
      if (video.status === 'video_failed' && !video.golpoJobId) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND RECOVERY CRON
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Periodically check all video_failed videos that have a Golpo job ID.
 * If Golpo has finished rendering, recover the video URL automatically.
 * This runs every 5 minutes and handles the case where polling timed out
 * but Golpo actually completed the video.
 */
let recoveryInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundRecovery(): void {
  if (recoveryInterval) return; // Already running

  console.log('[ContentHub] Starting background recovery cron (every 5 minutes)');

  recoveryInterval = setInterval(async () => {
    try {
      const db = await getDb();
      if (!db) return;

      // Find all failed videos with Golpo job IDs from the last 24 hours
      const failedWithJobs = await db.select()
        .from(contentHubVideos)
        .where(
          and(
            eq(contentHubVideos.status, 'video_failed' as any),
            sql`${contentHubVideos.golpoJobId} IS NOT NULL AND ${contentHubVideos.golpoJobId} != ''`,
            sql`${contentHubVideos.createdAt} > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
          )
        );

      if (failedWithJobs.length === 0) return;

      console.log(`[ContentHub] Background recovery: checking ${failedWithJobs.length} failed video(s)...`);

      for (const video of failedWithJobs) {
        try {
          const result = await checkGolpoStatus(video.id);
          if (result.status === 'completed') {
            console.log(`[ContentHub] Background recovery: Video #${video.id} recovered! URL: ${result.videoUrl}`);
          } else if (result.status === 'still_generating') {
            console.log(`[ContentHub] Background recovery: Video #${video.id} still generating on Golpo`);
          }
        } catch (err: any) {
          // Silent — don't let one video's check crash the whole loop
          console.warn(`[ContentHub] Background recovery: Error checking video #${video.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      console.error('[ContentHub] Background recovery error:', err.message);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

export function stopBackgroundRecovery(): void {
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
    recoveryInterval = null;
    console.log('[ContentHub] Background recovery cron stopped');
  }
}

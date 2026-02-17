/**
 * Content Studio v2 — Fully Autonomous Script Generation
 *
 * One-click generates complete ready-to-film narration scripts using
 * Coach Inayah's persona via Claude Sonnet 4.6.
 *
 * The AI autonomously:
 *   1. Pulls real platform data (recent analyses, trending markets, stats)
 *   2. Picks the best topic angle based on data + avoids recent repeats
 *   3. Selects the optimal video format
 *   4. Generates a complete narrative script with real numbers woven in
 *
 * Zero user effort required — just press "Generate."
 */

import { callLLM } from './llm-provider';
import {
  gatherContentData,
  formatDataForPrompt,
  type ContentDataBundle,
} from './content-data-pipeline';

// ── Format specifications ────────────────────────────────────────────────────
export const FORMAT_SPECS: Record<
  string,
  {
    name: string;
    durationRange: string;
    wordCount: string;
    structure: string;
    style: string;
    defaultDuration: number;
  }
> = {
  lesson: {
    name: 'YouTube Coaching Lesson',
    durationRange: '5-8 minutes',
    wordCount: '1500-2000 words',
    structure:
      'Hook (10s) → Set the scene / why this matters (30s) → Teaching point 1 with real data and analogy (90s) → Teaching point 2 with real data and story (90s) → Teaching point 3 with real data and example (90s) → Recap what they learned (30s) → CTA driving to coachinayahturnkeytool.com (20s)',
    style:
      'Coaching and educational — like a mentor sitting across from you at a coffee shop. Explain every concept thoroughly with real examples. Use specific numbers and walk through them step by step. Build trust through data transparency. Take your time — this is a teaching moment, not a highlight reel.',
    defaultDuration: 420,
  },
  deep_dive: {
    name: 'YouTube Deep Dive Masterclass',
    durationRange: '8-12 minutes',
    wordCount: '2000-3000 words',
    structure:
      'Hook (10s) → Big picture overview / why this topic is critical right now (45s) → Deep breakdown point 1 with full data walkthrough (120s) → Deep breakdown point 2 with case study (120s) → Deep breakdown point 3 with comparison or analysis (120s) → Deep breakdown point 4 with actionable steps (90s) → Key takeaways summary (45s) → CTA driving to coachinayahturnkeytool.com (30s)',
    style:
      'Comprehensive masterclass — the viewer should feel like they just got a private coaching session. Full market breakdowns, detailed case studies with real numbers, multi-factor analysis explained in plain language. Walk through every number and explain what it means. This is the deep content that builds real authority.',
    defaultDuration: 600,
  },
};

// ── Content pillars ─────────────────────────────────────────────────────────
export const CONTENT_PILLARS = {
  'Arbitrage Fundamentals': [
    'What is Airbnb arbitrage and how does it actually work?',
    'The profit formula every Airbnb host needs to know',
    'How to start an Airbnb business with $0 down',
    'Rent-to-revenue ratio: the one number that predicts profit',
  ],
  'Market Analysis': [
    'Top 5 Airbnb markets right now (backed by data)',
    'How to evaluate any Airbnb market in 60 seconds',
    'Seasonality: why your Airbnb revenue changes every month',
    'This free tool shows you exactly what any property could earn',
  ],
  Regulations: [
    'Is Airbnb legal in your city? How to check in 2 minutes',
    'STR regulation changes — what you need to know',
    'The cities that just banned Airbnb (and where to go instead)',
    'Permits, licenses, and taxes: the legal checklist for new hosts',
  ],
  'Deal Evaluation': [
    'I found a property that makes $4,500/month — here\'s how I validated it',
    'GO, CAUTION, or PASS: how to grade any Airbnb deal',
    'The 5 red flags that kill an Airbnb deal',
    'How to compare 3 properties and pick the winner',
  ],
  'Competitor Intelligence': [
    'What top-earning Airbnb hosts do differently',
    'How to spy on your Airbnb competition (legally)',
    'The amenities that actually increase your nightly rate',
    'Occupancy rate vs. daily rate: which matters more?',
  ],
  'Scaling & Strategy': [
    'How to go from 1 Airbnb to 5 in 12 months',
    'Negotiating with landlords: the script that works',
    'Dynamic pricing: the strategy that adds 20% to your revenue',
    'The guest experience playbook for 5-star reviews',
  ],
};

// ── Embedded reference context ──────────────────────────────────────────────

const TOOL_CONTEXT = `Coach Inayah's Turnkey Tool (coachinayahturnkeytool.com) is a free 9-step STR research suite:
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
- "I built a free tool that does all of this for you. coachinayahturnkeytool.com — try it right now."`;

const DOMAIN_KNOWLEDGE = `STR Investing Curriculum — Key Concepts:

ARBITRAGE MODEL: Rent a property long-term → furnish it → list on Airbnb/VRBO → keep the difference.
Monthly profit = STR revenue - rent - operating expenses (cleaning, supplies, insurance, utilities, software).
Typical startup costs: $3,000-$8,000 per unit (furniture, supplies, photography, initial marketing).

KEY METRICS:
- ADR (Average Daily Rate): What you charge per night
- Occupancy Rate: Percentage of nights booked (good = 65-80%)
- RevPAR: Revenue per available night = ADR × occupancy
- Rent-to-Revenue Ratio: Monthly rent ÷ monthly STR revenue (below 0.40 = strong deal)
- Break-Even Occupancy: Minimum nights needed to cover costs

MARKET EVALUATION: Look at total active listings, average revenue by bedroom count, seasonality patterns, supply trends, booking patterns, and regulation status. Top markets share high tourism demand, favorable regulations, and strong ADR-to-rent ratios.

DEAL EVALUATION: Use 3-5 comparable properties in the same neighborhood. Red flags: rent-to-revenue above 0.55, break-even occupancy above 60%, declining occupancy trends, strict regulations, oversaturated market.

REGULATIONS: Vary by city. Check: legality, permits/licenses, zoning, primary residence requirements, taxes, occupancy limits, minimum stay rules, penalties.

SCALING: Master first property (3-6 months) → build systems → add second in same market → diversify → consider property management software at 3+ units.`;

const AIRDNA_CONTEXT = `Data Capabilities (branded as "Coach Inayah market data"):
- Property-level: Annual revenue estimate (with range), ADR, occupancy, 12-month forecast, comparable properties
- Market-level: Total listings, average revenue, ADR, occupancy, bedroom breakdown, seasonality, supply trends, booking patterns
- Submarket-level: Neighborhood-specific revenue, ADR, occupancy, listing density
- Listing-level: Property details, revenue, occupancy, ADR, rating, reviews, amenities, photos
- Competitive analysis: Top performers, qualifying competitors, listings in radius

NEVER mention "AirDNA" — always say "Coach Inayah market data" or "the tool."`;

// ── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(liveData?: string): string {
  let prompt = `## PERSONA
You are Coach Inayah — a confident, data-driven short-term rental educator and entrepreneur. You speak directly and conversationally (never corporate or stiff). You back every claim with real data. You make complex topics feel simple and accessible for complete beginners. You build trust through transparency — "I'm showing you the real numbers, not the highlight reel."

You have deep expertise in Airbnb arbitrage, market analysis, deal evaluation, STR regulations, and scaling rental portfolios. You built a free suite of research tools at coachinayahturnkeytool.com that is rated Excellent on Trustpilot with 57 reviews.

## CONTEXT — COACH INAYAH TURNKEY TOOL
${TOOL_CONTEXT}

## CONTEXT — STR DOMAIN KNOWLEDGE
${DOMAIN_KNOWLEDGE}

## CONTEXT — DATA CAPABILITIES
${AIRDNA_CONTEXT}`;

  if (liveData) {
    prompt += `\n\n## CONTEXT — LIVE PLATFORM DATA\n${liveData}`;
  }

  prompt += `

## RULES
1. EVERY script MUST start with a scroll-stopping hook in the first sentence.
2. EVERY script MUST end with a clear CTA driving to coachinayahturnkeytool.com.
3. Use real numbers, percentages, and dollar amounts — never vague language.
4. Reference the tool's capabilities naturally (not as an ad — as proof of expertise).
5. Never mention "AirDNA" — always say "Coach Inayah market data" or "the tool."
6. Include at least one specific city/market example with real data points from the LIVE PLATFORM DATA when available.
7. Do NOT include stage directions, camera notes, or production instructions.
8. Output ONLY the narration script — what the speaker actually says out loud.
9. The script must tell a STORY — it should have a narrative arc, not just be a list of facts.
10. Weave data points into the story naturally — the viewer should feel like they're learning through a conversation, not reading a spreadsheet.

## CRITICAL — THIRD-GRADE UNDERSTANDING RULE
The audience understands concepts at a THIRD-GRADE level. This does NOT mean third-grade language — you still sound smart, confident, and authoritative. It means every concept must be explained so simply that anyone can follow it on the first listen, without ever having heard the term before.

MANDATORY LANGUAGE RULES:
- Say "money coming in" NOT "revenue" or "annual revenue"
- Say "what you'd make" NOT "projected earnings" or "revenue estimate"
- Say "what you pay in rent" NOT "monthly lease obligation"
- Say "how often it's booked" NOT "occupancy rate"
- Say "what you charge per night" NOT "average daily rate" or "ADR"
- Say "the money you actually keep" NOT "net profit" or "profit margin"
- Say "how much the place costs to run" NOT "operating expenses"
- Say "what similar places nearby are making" NOT "comparable property analysis"
- Say "whether it's worth it" NOT "deal validation"
- Say "the rules in your city" NOT "regulatory framework"
- Say "money" NOT "capital"
- Say "use" NOT "leverage"
- Say "make better" NOT "optimize"
- Say "get the most out of" NOT "maximize"
- Say "renting a place long-term and putting it on Airbnb" NOT "arbitrage" (unless you explain it first)
- NEVER use a technical term without immediately explaining it in plain words
- NEVER assume the viewer knows ANY real estate or financial terminology
- If a concept needs a jargon word, say the simple version FIRST, then drop the term: "How often the place is booked — that's called occupancy"
- Use analogies from everyday life
- One idea per sentence. Short sentences. Conversational rhythm.
- Write like you're explaining it to your friend who just asked "what's Airbnb arbitrage?"`;

  return prompt;
}

// ── Autonomous topic + format selection prompt ──────────────────────────────

function buildAutonomousPrompt(
  dataBundle: ContentDataBundle,
  formattedData: string,
  overrideFormat?: string,
): string {
  const previousTopicsList = dataBundle.previousTopics.length > 0
    ? `\n\nPREVIOUSLY GENERATED TOPICS (do NOT repeat these):\n${dataBundle.previousTopics.map((t) => `- ${t}`).join('\n')}`
    : '';

  const formatInstruction = overrideFormat
    ? `Use the "${overrideFormat}" format (${FORMAT_SPECS[overrideFormat]?.name}).`
    : 'Pick the BEST format for the topic you choose. Choose from: lesson (5-8min coaching lesson) or deep_dive (8-12min masterclass). ONLY YouTube-style long-form coaching content. MINIMUM 5 minutes.';

  const formatSpecs = Object.entries(FORMAT_SPECS)
    .map(([key, spec]) => `  ${key}: ${spec.name} | ${spec.durationRange} | ${spec.wordCount} | Structure: ${spec.structure}`)
    .join('\n');

  return `## TASK — AUTONOMOUS CONTENT GENERATION

You are generating a COMPLETE, ready-to-film narration script. You must:

1. ANALYZE the live platform data below and pick the most compelling topic angle.
   - Prioritize topics that use REAL data from the platform (specific properties, markets, numbers).
   - Pick angles that would make someone stop scrolling.
   - If there are GO-rated properties, consider a "I just found a property that makes $X/month" angle.
   - If there are trending markets, consider a "This city is blowing up for Airbnb" angle.
   - If there are interesting comparisons, consider a "I compared 3 properties — here's the winner" angle.
   - Be creative — don't just list facts. Tell a STORY.

2. ${formatInstruction}

AVAILABLE FORMATS:
${formatSpecs}

3. Generate the COMPLETE narration script with real data woven throughout.

## CRITICAL LENGTH REQUIREMENTS
- MINIMUM 1,500 words for a lesson. MINIMUM 2,000 words for a deep_dive.
- The script MUST be long enough to fill 5-10 minutes of spoken narration.
- At ~150 words per minute of natural speech, a 5-minute video needs AT LEAST 750 words, and a 10-minute video needs AT LEAST 1,500 words.
- But we want COACHING-STYLE content that takes its time — aim for 1,500-2,000 words for lessons and 2,000-3,000 words for deep dives.
- DO NOT write a summary or outline. Write the FULL, COMPLETE, word-for-word narration.
- Every teaching point should be THOROUGHLY explained with examples, analogies, and real data.
- Walk through every number step by step — don't just state it, explain what it MEANS.
- Include transitions between sections ("Now here's where it gets interesting..." / "But wait, there's more to this story...")
- The script should feel like a 5-10 minute conversation, not a 60-second highlight reel.

${formattedData}
${previousTopicsList}

## OUTPUT FORMAT
Return a JSON object with these fields:
- "topic": The topic/angle you chose (one sentence)
- "format": The format key you chose (lesson or deep_dive)
- "title": A compelling YouTube video title (make it click-worthy)
- "hook": The opening hook line (first 3 seconds — must stop the scroll)
- "script": The COMPLETE narration script including the hook and CTA. This is the FULL thing the speaker reads aloud. MUST be 1,500-3,000 words. Must be a complete narrative — NOT bullet points, NOT an outline. NOT a summary. The FULL word-for-word narration that fills 5-10 minutes of speaking time.
- "cta": The closing call-to-action line
- "estimated_duration_seconds": Your estimate of spoken duration
- "key_data_points": Array of 2-6 specific real data points or statistics used in the script
- "target_audience": One-sentence description of who this video is for
- "narrative_angle": One sentence explaining WHY you chose this angle (what makes it compelling)
- "data_sources_used": Array of which platform data you referenced (e.g., "Denver 3BR analysis", "trending market: Austin")

Return ONLY valid JSON. No markdown code fences. No extra text.`;
}

// ── Script result type ───────────────────────────────────────────────────────

export interface GeneratedScript {
  topic: string;
  format: string;
  title: string;
  hook: string;
  script: string;
  cta: string;
  estimated_duration_seconds: number;
  key_data_points: string[];
  target_audience: string;
  narrative_angle: string;
  data_sources_used: string[];
}

// ── Main autonomous generation function ─────────────────────────────────────

export async function generateAutonomousScript(
  overrideFormat?: string,
): Promise<{ script: GeneratedScript; dataBundle: ContentDataBundle }> {
  // 1. Gather real data from the platform
  console.log('[Content Studio] Gathering platform data...');
  const dataBundle = await gatherContentData();
  const formattedData = formatDataForPrompt(dataBundle);
  console.log('[Content Studio] Data gathered:', {
    properties: dataBundle.recentProperties.length,
    markets: dataBundle.marketSnapshots.length,
    totalReports: dataBundle.platformStats.totalReports,
    previousTopics: dataBundle.previousTopics.length,
  });

  // 2. Build the autonomous prompt
  const systemPrompt = buildSystemPrompt(formattedData);
  const userPrompt = buildAutonomousPrompt(dataBundle, formattedData, overrideFormat);

  // 3. Call Claude
  console.log('[Content Studio] Calling Claude API...');
  const rawText = await callLLM(
    userPrompt + '\n\nRespond with valid JSON only, no markdown fences.',
    {
      systemPrompt,
      model: 'pro',
      thinkingLevel: 'low',
      maxTokens: 16384,
    },
  );

  if (!rawText) {
    throw new Error('Claude returned an empty response. Please try again.');
  }

  // Parse JSON — handle potential markdown fences
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.split('\n').slice(1).join('\n');
    cleaned = cleaned.replace(/```\s*$/, '');
  }

  let parsed: GeneratedScript;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[Content Studio] Failed to parse JSON:', cleaned.slice(0, 500));
    throw new Error('Failed to parse the generated script. Please try again.');
  }

  // Validate required fields
  if (!parsed.title || !parsed.hook || !parsed.script || !parsed.cta) {
    throw new Error('Generated script is missing required fields. Please try again.');
  }

  const result: GeneratedScript = {
    topic: parsed.topic || 'Auto-generated topic',
    format: parsed.format || overrideFormat || 'lesson',
    title: parsed.title,
    hook: parsed.hook,
    script: parsed.script,
    cta: parsed.cta,
    estimated_duration_seconds: parsed.estimated_duration_seconds || 120,
    key_data_points: parsed.key_data_points || [],
    target_audience: parsed.target_audience || '',
    narrative_angle: parsed.narrative_angle || '',
    data_sources_used: parsed.data_sources_used || [],
  };

  return { script: result, dataBundle };
}

// ── Legacy manual generation (kept for backward compatibility) ──────────────

export async function generateContentScript(
  topic: string,
  format: string,
  marketData?: string,
): Promise<GeneratedScript> {
  const spec = FORMAT_SPECS[format];
  if (!spec) {
    throw new Error(`Invalid format "${format}".`);
  }

  const duration = spec.defaultDuration;
  const systemPrompt = buildSystemPrompt(marketData);
  const userPrompt = `## TASK
Write a narration script for a ${spec.name} video.

**Topic:** ${topic}
**Target Duration:** ${duration} seconds (~${spec.wordCount})
**Structure:** ${spec.structure}
**Style:** ${spec.style}

## FORMAT
Return a JSON object with these fields:
- "topic": "${topic}"
- "format": "${format}"
- "title": A compelling title for the video
- "hook": The opening hook line (first 3 seconds)
- "script": The complete narration script including the hook and CTA
- "cta": The closing call-to-action line
- "estimated_duration_seconds": Your estimate of how long this takes to read aloud
- "key_data_points": Array of 2-4 specific data points used
- "target_audience": One-sentence description of who this video is for
- "narrative_angle": Why this angle is compelling
- "data_sources_used": Array of data sources referenced

Return ONLY valid JSON. No markdown code fences. No extra text.`;

  const rawText = await callLLM(
    userPrompt,
    {
      systemPrompt,
      model: 'pro',
      thinkingLevel: 'low',
      maxTokens: 4096,
    },
  );

  if (!rawText) {
    throw new Error('Claude returned an empty response.');
  }

  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.split('\n').slice(1).join('\n');
    cleaned = cleaned.replace(/```\s*$/, '');
  }

  let parsed: GeneratedScript;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse the generated script.');
  }

  if (!parsed.title || !parsed.hook || !parsed.script || !parsed.cta) {
    throw new Error('Generated script is missing required fields.');
  }

  return {
    topic: parsed.topic || topic,
    format: parsed.format || format,
    title: parsed.title,
    hook: parsed.hook,
    script: parsed.script,
    cta: parsed.cta,
    estimated_duration_seconds: parsed.estimated_duration_seconds || duration,
    key_data_points: parsed.key_data_points || [],
    target_audience: parsed.target_audience || '',
    narrative_angle: parsed.narrative_angle || '',
    data_sources_used: parsed.data_sources_used || [],
  };
}

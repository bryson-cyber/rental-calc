/**
 * Model Router — Central routing layer for multi-model LLM architecture
 * 
 * Maps each feature to its optimal model provider:
 * - Gemini 3.1 Pro: Heavy synthesis (full reports, narratives)
 * - Opus 4.6: Precision judgment (deal verdicts, AI advisor, deal alert memos)
 * - Sonnet 4.6: Everything else (chat, summaries, emails, structured JSON)
 * 
 * No fallback logic. Each model was chosen for a reason based on benchmark data.
 * If a provider fails, the error surfaces immediately so it can be fixed properly.
 * 
 * USAGE:
 *   import { routedLLMCall, routedLLMCallMax, FEATURES } from './model-router';
 *   const result = await routedLLMCall(FEATURES.DEAL_VERDICT, prompt, { systemPrompt });
 */

import { callLLM, callLLMMax, callLLMStreaming, type LLMCallOptions } from './llm-provider';
import { callGemini, callGeminiMax, type GeminiCallOptions } from './gemini-provider';
import { callOpus, callOpusMax, type OpusCallOptions } from './opus-provider';

// ---------------------------------------------------------------------------
// FEATURE CONSTANTS
// ---------------------------------------------------------------------------

/**
 * Named constants for every LLM-powered feature in the app.
 * Use these when calling routedLLMCall() to ensure correct model routing.
 */
export const FEATURES = {
  // --- Gemini 3.1 Pro (Heavy Synthesis) ---
  FULL_PROPERTY_REPORT: 'full-property-report',
  FULL_MARKET_REPORT: 'full-market-report',
  FULL_REPORT_SUMMARY: 'full-report-summary',
  ENHANCED_NARRATIVE: 'enhanced-narrative',

  // --- Opus 4.6 (Precision Judgment) ---
  DEAL_VERDICT: 'deal-verdict',
  AI_ADVISOR_TOOL_LOOP: 'ai-advisor-tool-loop',
  DEAL_ALERT_MEMO: 'deal-alert-memo',

  // --- Sonnet 4.6 (Everything Else) ---
  CHAT_STREAMING: 'chat-streaming',
  CHAT_NON_STREAMING: 'chat-non-streaming',
  PROPERTY_QUICK_SUMMARY: 'property-quick-summary',
  MARKET_QUICK_SUMMARY: 'market-quick-summary',
  TREND_ANALYSIS: 'trend-analysis',
  PROPERTY_ANALYSIS_STRUCTURED: 'property-analysis-structured',
  PROPERTY_ANALYSIS_GENERAL: 'property-analysis-general',
  PHOTO_ANALYSIS: 'photo-analysis',
  DEEP_ANALYSIS: 'deep-analysis',
  CONTENT_STUDIO: 'content-studio',
  BEHAVIOR_ENGINE_EMAIL: 'behavior-engine-email',
  NEWSLETTER_CONTENT: 'newsletter-content',
  REGULATION_TRACKER: 'regulation-tracker',
  SLACK_REPORT: 'slack-report',
  DEAL_ALERT_SNIPPET: 'deal-alert-snippet',
  AI_FALLBACK: 'ai-fallback',
  HEALTH_CHECK: 'health-check',
} as const;

export type FeatureName = (typeof FEATURES)[keyof typeof FEATURES];

// ---------------------------------------------------------------------------
// ROUTING TABLE
// ---------------------------------------------------------------------------

type ModelProvider = 'gemini' | 'opus' | 'sonnet';
type EffortLevel = 'low' | 'medium' | 'high';

interface RouteConfig {
  provider: ModelProvider;
  effort: EffortLevel;
  /** Description for logging */
  label: string;
}

/**
 * The routing table: maps each feature to its optimal provider and effort level.
 * 
 * Benchmark justifications:
 * - Gemini: GPQA Diamond 94.3%, 1M context, MRCR v2 84.9%
 * - Opus: Humanity's Last Exam 53.1%, SWE-Bench 80.8%, APEX-Agents 29.8%
 * - Sonnet: GDPval-AA 1633 Elo, τ2-bench 91.7%/97.9%, fast + cost-effective
 */
const ROUTING_TABLE: Record<FeatureName, RouteConfig> = {
  // Gemini 3.1 Pro — Heavy Synthesis
  [FEATURES.FULL_PROPERTY_REPORT]: { provider: 'gemini', effort: 'high', label: 'Full Property Report' },
  [FEATURES.FULL_MARKET_REPORT]: { provider: 'gemini', effort: 'high', label: 'Full Market Report' },
  [FEATURES.FULL_REPORT_SUMMARY]: { provider: 'gemini', effort: 'low', label: 'Full Report Summary' },
  [FEATURES.ENHANCED_NARRATIVE]: { provider: 'gemini', effort: 'high', label: 'Enhanced Narrative' },

  // Opus 4.6 — Precision Judgment
  [FEATURES.DEAL_VERDICT]: { provider: 'opus', effort: 'high', label: 'Deal Verdict' },
  [FEATURES.AI_ADVISOR_TOOL_LOOP]: { provider: 'opus', effort: 'high', label: 'AI Advisor Tool Loop' },
  [FEATURES.DEAL_ALERT_MEMO]: { provider: 'opus', effort: 'high', label: 'Deal Alert AI Memo' },

  // Sonnet 4.6 — Everything Else
  [FEATURES.CHAT_STREAMING]: { provider: 'sonnet', effort: 'low', label: 'Chat Streaming' },
  [FEATURES.CHAT_NON_STREAMING]: { provider: 'sonnet', effort: 'low', label: 'Chat Non-Streaming' },
  [FEATURES.PROPERTY_QUICK_SUMMARY]: { provider: 'sonnet', effort: 'low', label: 'Property Quick Summary' },
  [FEATURES.MARKET_QUICK_SUMMARY]: { provider: 'sonnet', effort: 'low', label: 'Market Quick Summary' },
  [FEATURES.TREND_ANALYSIS]: { provider: 'sonnet', effort: 'low', label: 'Trend Analysis' },
  [FEATURES.PROPERTY_ANALYSIS_STRUCTURED]: { provider: 'sonnet', effort: 'medium', label: 'Property Analysis (Structured)' },
  [FEATURES.PROPERTY_ANALYSIS_GENERAL]: { provider: 'sonnet', effort: 'medium', label: 'Property Analysis (General)' },
  [FEATURES.PHOTO_ANALYSIS]: { provider: 'sonnet', effort: 'low', label: 'Photo Analysis' },
  [FEATURES.DEEP_ANALYSIS]: { provider: 'sonnet', effort: 'high', label: 'Deep Analysis' },
  [FEATURES.CONTENT_STUDIO]: { provider: 'sonnet', effort: 'low', label: 'Content Studio' },
  [FEATURES.BEHAVIOR_ENGINE_EMAIL]: { provider: 'sonnet', effort: 'low', label: 'Behavior Engine Email' },
  [FEATURES.NEWSLETTER_CONTENT]: { provider: 'sonnet', effort: 'low', label: 'Newsletter Content' },
  [FEATURES.REGULATION_TRACKER]: { provider: 'sonnet', effort: 'medium', label: 'Regulation Tracker' },
  [FEATURES.SLACK_REPORT]: { provider: 'sonnet', effort: 'low', label: 'Slack Report' },
  [FEATURES.DEAL_ALERT_SNIPPET]: { provider: 'sonnet', effort: 'low', label: 'Deal Alert Snippet' },
  [FEATURES.AI_FALLBACK]: { provider: 'sonnet', effort: 'medium', label: 'AI Fallback' },
  [FEATURES.HEALTH_CHECK]: { provider: 'sonnet', effort: 'low', label: 'Health Check' },
};

// ---------------------------------------------------------------------------
// EFFORT MAPPING
// ---------------------------------------------------------------------------

/**
 * Maps our effort levels to provider-specific parameters.
 */
function toSonnetOptions(effort: EffortLevel, options?: { maxTokens?: number; systemPrompt?: string }): LLMCallOptions {
  return {
    maxTokens: options?.maxTokens,
    systemPrompt: options?.systemPrompt,
    model: effort === 'low' ? 'flash' : 'pro',
    thinkingLevel: effort === 'high' ? 'high' : 'low',
  };
}

function toGeminiOptions(effort: EffortLevel, options?: { maxTokens?: number; systemPrompt?: string }): GeminiCallOptions {
  return {
    maxTokens: options?.maxTokens,
    systemPrompt: options?.systemPrompt,
    thinkingLevel: effort === 'low' ? 'low' : 'high',
  };
}

function toOpusOptions(effort: EffortLevel, options?: { maxTokens?: number; systemPrompt?: string }): OpusCallOptions {
  return {
    maxTokens: options?.maxTokens,
    systemPrompt: options?.systemPrompt,
    thinkingLevel: effort === 'low' ? 'low' : 'high',
  };
}

// ---------------------------------------------------------------------------
// CORE ROUTING FUNCTIONS
// ---------------------------------------------------------------------------

export interface RoutedCallOptions {
  /** Maximum output tokens */
  maxTokens?: number;
  /** System prompt */
  systemPrompt?: string;
}

/**
 * Route an LLM call to the optimal provider based on the feature name.
 * No fallback — each model was chosen for a reason. Errors surface immediately.
 */
export async function routedLLMCall(
  feature: FeatureName,
  prompt: string,
  options?: RoutedCallOptions
): Promise<string> {
  const route = ROUTING_TABLE[feature];
  if (!route) {
    throw new Error(`[ModelRouter] Unknown feature "${feature}". Add it to FEATURES and ROUTING_TABLE.`);
  }

  const { provider, effort, label } = route;

  console.log(`[ModelRouter] ${label} → ${provider} (effort: ${effort})`);

  switch (provider) {
    case 'gemini':
      return callGemini(prompt, toGeminiOptions(effort, options));
    case 'opus':
      return callOpus(prompt, toOpusOptions(effort, options));
    case 'sonnet':
      return callLLM(prompt, toSonnetOptions(effort, options));
  }
}

/**
 * Route an extended-capacity LLM call (with retries) to the optimal provider.
 * No fallback — retries happen within the assigned provider only.
 */
export async function routedLLMCallMax(
  feature: FeatureName,
  prompt: string,
  maxRetries: number = 3,
  options?: RoutedCallOptions
): Promise<string> {
  const route = ROUTING_TABLE[feature];
  if (!route) {
    throw new Error(`[ModelRouter] Unknown feature "${feature}". Add it to FEATURES and ROUTING_TABLE.`);
  }

  const { provider, effort, label } = route;

  console.log(`[ModelRouter] ${label} (Max) → ${provider} (effort: ${effort})`);

  switch (provider) {
    case 'gemini':
      return callGeminiMax(prompt, maxRetries, toGeminiOptions(effort, options));
    case 'opus':
      return callOpusMax(prompt, maxRetries, toOpusOptions(effort, options));
    case 'sonnet':
      return callLLMMax(prompt, maxRetries, toSonnetOptions(effort, options));
  }
}

// ---------------------------------------------------------------------------
// STREAMING
// ---------------------------------------------------------------------------

/**
 * Route a streaming LLM call. Currently only Sonnet supports streaming.
 * Used for the chat interface where chunks are sent to the client in real-time.
 */
export function routedLLMCallStreaming(
  feature: FeatureName,
  prompt: string,
  options?: RoutedCallOptions
): AsyncGenerator<string, void, unknown> {
  const route = ROUTING_TABLE[feature];
  if (!route) {
    throw new Error(`[ModelRouter] Unknown feature "${feature}". Add it to FEATURES and ROUTING_TABLE.`);
  }

  const { provider, effort, label } = route;
  console.log(`[ModelRouter] ${label} (Streaming) → ${provider} (effort: ${effort})`);

  // Streaming is currently Sonnet-only
  return callLLMStreaming(prompt, toSonnetOptions(effort, options));
}

// ---------------------------------------------------------------------------
// UTILITY
// ---------------------------------------------------------------------------

/**
 * Get the routing configuration for a feature (for logging/debugging).
 */
export function getRouteInfo(feature: FeatureName): RouteConfig | undefined {
  return ROUTING_TABLE[feature];
}

/**
 * Get all features routed to a specific provider.
 */
export function getFeaturesByProvider(provider: ModelProvider): string[] {
  return Object.entries(ROUTING_TABLE)
    .filter(([, config]) => config.provider === provider)
    .map(([feature]) => feature);
}

/**
 * Log the full routing table for debugging.
 */
export function logRoutingTable(): void {
  console.log('\n[ModelRouter] === Routing Table ===');
  const byProvider: Record<string, string[]> = { gemini: [], opus: [], sonnet: [] };
  for (const [feature, config] of Object.entries(ROUTING_TABLE)) {
    byProvider[config.provider].push(`  ${config.label} (${feature}) [effort: ${config.effort}]`);
  }
  console.log(`\nGemini 3.1 Pro (${byProvider.gemini.length} features):`);
  byProvider.gemini.forEach(f => console.log(f));
  console.log(`\nOpus 4.6 (${byProvider.opus.length} features):`);
  byProvider.opus.forEach(f => console.log(f));
  console.log(`\nSonnet 4.6 (${byProvider.sonnet.length} features):`);
  byProvider.sonnet.forEach(f => console.log(f));
  console.log('=================================\n');
}

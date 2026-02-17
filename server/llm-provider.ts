/**
 * LLM Provider Abstraction Layer
 * 
 * Centralizes all LLM API calls behind a single interface that supports
 * multiple providers (Gemini, Anthropic Claude). The active provider is
 * controlled by the LLM_PROVIDER environment variable.
 * 
 * Provider: "gemini"    → Google Gemini 3 Pro/Flash (default)
 * Provider: "anthropic" → Anthropic Claude Opus 4.6 / Sonnet 4.6
 * 
 * CLAUDE 4.6 API CONFIGURATION (per official Anthropic docs, Feb 2026):
 * - Model IDs: claude-opus-4-6, claude-sonnet-4-6
 * - Adaptive thinking: thinking: {type: "adaptive"} (recommended, replaces budget_tokens)
 * - Effort parameter: output_config: {effort: "low"|"medium"|"high"|"max"} (GA, no beta header)
 * - No assistant prefills (returns 400 on 4.6)
 * - No anti-laziness prompts (amplify already-proactive behavior)
 * - max_tokens: up to 128K for Opus 4.6, 64K for Sonnet 4.6
 */

import { ENV } from './_core/env';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type LLMProvider = 'gemini' | 'anthropic';

export interface LLMCallOptions {
  /** Maximum output tokens. Default: 8192 */
  maxTokens?: number;
  /** Temperature for generation. Default: 1.0 for Gemini, 1.0 for Claude */
  temperature?: number;
  /** 
   * Reasoning intensity.
   * Gemini: maps to thinkingLevel 'low' | 'high'
   * Claude: maps to effort 'low' | 'medium' | 'high' via CLAUDE_EFFORT_MAP
   */
  thinkingLevel?: 'low' | 'high';
  /** 
   * Model tier.
   * Gemini: 'pro' (gemini-3-pro-preview) | 'flash' (gemini-3-flash-preview)
   * Claude: 'pro' (claude-opus-4-6) | 'flash' (claude-sonnet-4-6)
   */
  model?: 'pro' | 'flash';
  /** Override the provider for this specific call */
  provider?: LLMProvider;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string; thought?: boolean }>;
      role: string;
    };
    finishReason: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const GEMINI_3_PRO_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent';
const GEMINI_3_FLASH_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

// Claude 4.6 model IDs (per official Anthropic docs, Feb 2026)
const CLAUDE_MODELS = {
  pro: 'claude-opus-4-6',
  flash: 'claude-sonnet-4-6',
} as const;

// Effort mapping: our thinkingLevel → Claude effort parameter
// Per Anthropic docs:
//   - 'high' effort = default, complex reasoning (maps from our thinkingLevel 'high')
//   - 'medium' effort = balanced speed/cost/performance (maps from our thinkingLevel 'low')
//   - 'low' effort = most efficient, simple tasks (used for flash/chat)
const CLAUDE_EFFORT_MAP: Record<string, 'low' | 'medium' | 'high'> = {
  low: 'medium',   // Our 'low' thinking = Claude 'medium' effort (balanced)
  high: 'high',    // Our 'high' thinking = Claude 'high' effort (deep reasoning)
};

/** Get the currently active LLM provider */
export function getActiveProvider(): LLMProvider {
  return ENV.llmProvider;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEMINI PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

async function callGeminiProvider(prompt: string, options?: LLMCallOptions): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout
  
  const model = options?.model ?? 'pro';
  const apiUrl = model === 'flash' ? GEMINI_3_FLASH_URL : GEMINI_3_PRO_URL;
  const temperature = options?.temperature ?? 1.0;
  const thinkingLevel = options?.thinkingLevel ?? 'high';
  
  try {
    const response = await fetch(`${apiUrl}?key=${ENV.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: options?.maxTokens ?? 8192,
          thinkingConfig: { thinkingLevel },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data: GeminiResponse = await response.json();
    const parts = data.candidates[0]?.content?.parts || [];
    return parts
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join('') || '';
  } finally {
    clearTimeout(timeoutId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANTHROPIC PROVIDER (Claude 4.6)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calls the Anthropic Messages API using the REST endpoint directly.
 * 
 * Uses Claude 4.6 features:
 * - Adaptive thinking: thinking: {type: "adaptive"} (Claude decides when/how much to think)
 * - Effort parameter: output_config.effort controls thinking depth
 * - No prefills (not supported on 4.6)
 * - anthropic-version: 2023-06-01 (stable API version)
 */
async function callAnthropicProvider(prompt: string, options?: LLMCallOptions): Promise<string> {
  const apiKey = ENV.anthropicApiKey;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Cannot use Anthropic provider.');
  }

  const model = options?.model ?? 'pro';
  const modelId = CLAUDE_MODELS[model];
  const maxTokens = options?.maxTokens ?? 8192;
  const thinkingLevel = options?.thinkingLevel ?? 'high';
  const effort = CLAUDE_EFFORT_MAP[thinkingLevel];

  // For flash model (Sonnet), use lower effort for speed
  const effectiveEffort = model === 'flash' ? 'low' : effort;

  const providerLabel = model === 'pro' ? 'Claude Opus 4.6' : 'Claude Sonnet 4.6';
  console.log(`[${providerLabel}] Calling ${modelId} (effort: ${effectiveEffort}, maxTokens: ${maxTokens})...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout

  try {
    // Build the request body per Claude 4.6 API docs
    const requestBody: Record<string, unknown> = {
      model: modelId,
      max_tokens: maxTokens,
      // Adaptive thinking: Claude dynamically decides when and how much to think
      // At high effort, Claude almost always thinks deeply
      // At lower effort, it may skip thinking for simpler problems
      thinking: { type: 'adaptive' },
      // Effort parameter (GA, no beta header needed)
      // Controls overall token spend including thinking, text, and tool calls
      output_config: { effort: effectiveEffort },
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    // Only set temperature if not using adaptive thinking with effort
    // Per docs: temperature works alongside thinking but effort is the primary control
    if (options?.temperature !== undefined && options.temperature !== 1.0) {
      requestBody.temperature = options.temperature;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
      const errorMessage = (errorData as any)?.error?.message || `HTTP ${response.status}`;
      throw new Error(`Anthropic API error (${response.status}): ${errorMessage}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
      stop_reason: string;
    };

    // Extract text blocks from the response (skip thinking blocks)
    const textBlocks = data.content.filter(
      (block) => block.type === 'text' && block.text
    );

    const result = textBlocks.map((block) => block.text).join('');
    
    console.log(`[${providerLabel}] Success — ${data.usage.input_tokens} input, ${data.usage.output_tokens} output tokens (stop: ${data.stop_reason})`);
    
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Core LLM call function — routes to the active provider.
 * 
 * Drop-in replacement for the old callGemini() function.
 * Same signature, same return type, but provider-aware.
 */
export async function callLLM(prompt: string, options?: LLMCallOptions): Promise<string> {
  const provider = options?.provider ?? getActiveProvider();
  
  if (provider === 'anthropic') {
    return callAnthropicProvider(prompt, options);
  }
  return callGeminiProvider(prompt, options);
}

/**
 * Extended capacity LLM call with retry logic.
 * 
 * Drop-in replacement for the old callGeminiMax() function.
 * Uses higher token limits and exponential backoff retries.
 */
export async function callLLMMax(prompt: string, maxRetries: number = 3, options?: LLMCallOptions): Promise<string> {
  const provider = options?.provider ?? getActiveProvider();
  let lastError: Error | null = null;
  
  const providerLabel = provider === 'anthropic' ? 'Claude Max' : 'Gemini Max';
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[${providerLabel}] Attempt ${attempt + 1}/${maxRetries}...`);
      
      const result = await callLLM(prompt, {
        ...options,
        maxTokens: options?.maxTokens ?? 16384,
        thinkingLevel: options?.thinkingLevel ?? 'low',
        model: options?.model ?? 'pro',
        provider,
      });
      
      if (result) {
        console.log(`[${providerLabel}] Success on attempt ${attempt + 1}`);
        return result;
      }
      
      // Empty response, retry
      lastError = new Error('Empty response from LLM API');
      console.warn(`[${providerLabel}] Empty response on attempt ${attempt + 1}, retrying...`);
      await sleep(Math.pow(2, attempt + 1) * 1000);
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[${providerLabel}] Timeout on attempt ${attempt + 1}`);
      } else {
        console.error(`[${providerLabel}] Error on attempt ${attempt + 1}:`, error);
      }
      
      // Check for retryable errors (rate limits, server errors, overloaded)
      const errorMsg = lastError.message.toLowerCase();
      const isRetryable = errorMsg.includes('429') || 
                          errorMsg.includes('529') ||
                          errorMsg.includes('500') || 
                          errorMsg.includes('overloaded') ||
                          errorMsg.includes('aborterror') ||
                          errorMsg.includes('rate_limit');
      
      if (!isRetryable && attempt === 0) {
        // Non-retryable error on first attempt — fail fast
        throw lastError;
      }
      
      if (attempt < maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt + 1) * 1000;
        console.log(`[${providerLabel}] Retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
      }
    }
  }
  
  console.error(`[${providerLabel}] All ${maxRetries} attempts failed. Last error:`, lastError);
  throw lastError || new Error('All retry attempts failed');
}

/**
 * Get provider info for logging/debugging
 */
export function getProviderInfo(): { provider: LLMProvider; proModel: string; flashModel: string } {
  const provider = getActiveProvider();
  if (provider === 'anthropic') {
    return { provider, proModel: CLAUDE_MODELS.pro, flashModel: CLAUDE_MODELS.flash };
  }
  return { provider, proModel: 'gemini-3-pro-preview', flashModel: 'gemini-3-flash-preview' };
}

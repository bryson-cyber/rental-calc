/**
 * LLM Provider — Gemini 3.1 Pro
 * 
 * Handles heavy synthesis tasks: full reports, market narratives, enhanced narratives.
 * Uses @google/genai SDK with thinking configuration.
 * 
 * MODEL: gemini-3.1-pro-preview
 * - thinkingLevel: 'high' → deep reasoning for comprehensive reports (default)
 * - thinkingLevel: 'medium' → balanced thinking for most tasks
 * - thinkingLevel: 'low'  → lighter reasoning for summaries
 * 
 * GEMINI 3.1 PRO CONFIGURATION (per official docs):
 * - thinkingConfig: { thinkingLevel: "high" | "medium" | "low" }
 * - 'minimal' is NOT supported for 3.1 Pro
 * - Cannot disable thinking for 3.1 Pro
 * - Max 1M input tokens, 65,536 output tokens
 * - systemInstruction for system prompts
 */

import { GoogleGenAI } from '@google/genai';
import { ENV } from './_core/env';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface GeminiCallOptions {
  /** Maximum output tokens. Default: 8192 */
  maxTokens?: number;
  /**
   * Reasoning intensity.
   * 'high'   → maximizes reasoning depth (default, dynamic)
   * 'medium' → balanced thinking for most tasks
   * 'low'    → minimizes latency and cost
   * Note: 'minimal' is NOT supported for Gemini 3.1 Pro
   */
  thinkingLevel?: 'low' | 'medium' | 'high';
  /** System prompt / instruction. */
  systemPrompt?: string;
}

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

const MODEL_ID = 'gemini-3.1-pro-preview';
const MAX_OUTPUT_TOKENS = 65536; // Gemini 3 Pro max

// ---------------------------------------------------------------------------
// UTILITY
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getClient(): GoogleGenAI {
  const apiKey = ENV.geminiApiKey;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }
  return new GoogleGenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// CORE GEMINI CALL
// ---------------------------------------------------------------------------

/**
 * Calls the Gemini 3.1 Pro API via the @google/genai SDK.
 * 
 * Key configuration (per gemini-api-dev skill):
 * - thinkingConfig.thinkingLevel controls reasoning depth
 * - systemInstruction for system prompts
 * - maxOutputTokens for output limit
 */
async function callGeminiInternal(
  prompt: string,
  options?: GeminiCallOptions
): Promise<string> {
  const client = getClient();
  
  const requestedMaxTokens = options?.maxTokens ?? 8192;
  const maxTokens = Math.min(requestedMaxTokens, MAX_OUTPUT_TOKENS);
  const thinkingLevel = options?.thinkingLevel ?? 'high';

  const label = `Gemini 3.1 Pro`;
  console.log(`[${label}] thinking: ${thinkingLevel}, maxTokens: ${maxTokens}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min timeout for long reports

  try {
    const config: Record<string, unknown> = {
      maxOutputTokens: maxTokens,
      thinkingConfig: {
        thinkingLevel: thinkingLevel,
      },
    };

    if (options?.systemPrompt) {
      config.systemInstruction = options.systemPrompt;
    }

    const response = await client.models.generateContent({
      model: MODEL_ID,
      contents: prompt,
      config,
    });

    const text = response.text ?? '';
    
    // Log usage if available
    const usage = response.usageMetadata;
    if (usage) {
      console.log(`[${label}] ${usage.promptTokenCount ?? '?'} in, ${usage.candidatesTokenCount ?? '?'} out, thinking: ${usage.thoughtsTokenCount ?? '?'}`);
    }

    return text;
  } catch (error) {
    // Handle Gemini-specific errors
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${label}] Error: ${errMsg}`);
    throw new Error(`Gemini API error: ${errMsg}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Standard Gemini call for synthesis tasks.
 * Default: thinkingLevel='high' for deep analysis.
 */
export async function callGemini(
  prompt: string,
  options?: GeminiCallOptions
): Promise<string> {
  return callGeminiInternal(prompt, options);
}

/**
 * Extended capacity Gemini call with retry logic.
 * Uses maximum output tokens and high thinking by default.
 * Exponential backoff retries (2s, 4s, 8s) on transient errors.
 */
export async function callGeminiMax(
  prompt: string,
  maxRetries: number = 3,
  options?: GeminiCallOptions
): Promise<string> {
  let lastError: Error | null = null;
  const label = 'Gemini Max';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[${label}] Attempt ${attempt + 1}/${maxRetries}...`);

      const result = await callGeminiInternal(prompt, {
        ...options,
        maxTokens: options?.maxTokens ?? MAX_OUTPUT_TOKENS,
        thinkingLevel: options?.thinkingLevel ?? 'high',
      });

      if (result) {
        console.log(`[${label}] Success on attempt ${attempt + 1}`);
        return result;
      }

      lastError = new Error('Empty response from Gemini');
      console.warn(`[${label}] Empty response on attempt ${attempt + 1}, retrying...`);
      await sleep(Math.pow(2, attempt + 1) * 1000);

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[${label}] Timeout on attempt ${attempt + 1}`);
      } else {
        console.error(`[${label}] Error on attempt ${attempt + 1}:`, error);
      }

      const errorMsg = lastError.message.toLowerCase();
      const isRetryable =
        errorMsg.includes('429') ||
        errorMsg.includes('500') ||
        errorMsg.includes('503') ||
        errorMsg.includes('overloaded') ||
        errorMsg.includes('resource_exhausted') ||
        errorMsg.includes('rate') ||
        errorMsg.includes('quota') ||
        errorMsg.includes('fetch failed') ||
        errorMsg.includes('socket') ||
        errorMsg.includes('econnreset') ||
        errorMsg.includes('econnrefused') ||
        errorMsg.includes('etimedout') ||
        errorMsg.includes('network');

      if (!isRetryable && attempt === 0) {
        throw lastError;
      }

      if (attempt < maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt + 1) * 1000;
        console.log(`[${label}] Retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
      }
    }
  }

  console.error(`[${label}] All ${maxRetries} attempts failed.`);
  throw lastError || new Error('All retry attempts failed');
}

/**
 * Streaming Gemini call. Returns an async generator that yields text chunks.
 * Used for real-time streaming of long report generation.
 */
export async function* callGeminiStreaming(
  prompt: string,
  options?: GeminiCallOptions
): AsyncGenerator<string, void, unknown> {
  const client = getClient();

  const requestedMaxTokens = options?.maxTokens ?? 8192;
  const maxTokens = Math.min(requestedMaxTokens, MAX_OUTPUT_TOKENS);
  const thinkingLevel = options?.thinkingLevel ?? 'high';

  const label = 'Gemini Stream';
  console.log(`[${label}] thinking: ${thinkingLevel}, maxTokens: ${maxTokens}`);

  const config: Record<string, unknown> = {
    maxOutputTokens: maxTokens,
    thinkingConfig: {
      thinkingLevel: thinkingLevel,
    },
  };

  if (options?.systemPrompt) {
    config.systemInstruction = options.systemPrompt;
  }

  const response = await client.models.generateContentStream({
    model: MODEL_ID,
    contents: prompt,
    config,
  });

  for await (const chunk of response) {
    const text = chunk.text;
    if (text) {
      yield text;
    }
  }
}

/**
 * Get provider info for logging/debugging.
 */
export function getGeminiProviderInfo(): { provider: string; model: string } {
  return { provider: 'google', model: MODEL_ID };
}

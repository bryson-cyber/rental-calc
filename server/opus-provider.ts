/**
 * LLM Provider — Claude Opus 4.6
 * 
 * Handles precision judgment tasks: deal verdicts, AI advisor tool loop, deal alert memos.
 * Uses the Anthropic Messages API with adaptive thinking.
 * 
 * MODEL: claude-opus-4-6
 * - Adaptive thinking: thinking: {type: "adaptive"}
 * - Effort: output_config.effort = "high" (always — these are high-stakes tasks)
 * - Max output: 128K tokens (Opus 4.6 supports 128K vs Sonnet's 64K)
 * - temperature CANNOT be modified when thinking is enabled
 * - No assistant prefills (returns 400 on 4.6)
 * 
 * BENCHMARK JUSTIFICATION:
 * - Humanity's Last Exam w/ tools: 53.1% (best — catches nuances in complex reasoning)
 * - SWE-Bench Verified: 80.8% (best — precise structured outputs)
 * - APEX-Agents: 29.8% (long-horizon professional tasks)
 */

import { ENV } from './_core/env';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface OpusCallOptions {
  /** Maximum output tokens. Default: 16384 */
  maxTokens?: number;
  /**
   * Reasoning intensity. Opus always uses high effort for precision tasks.
   * 'high' → effort: high (deep reasoning — default for Opus)
   * 'low'  → effort: medium (rare — only for simpler Opus tasks)
   */
  thinkingLevel?: 'low' | 'high';
  /** System prompt. Claude supports system messages natively. */
  systemPrompt?: string;
}

export interface OpusToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface OpusToolExecutor {
  (name: string, args: Record<string, unknown>): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

const MODEL_ID = 'claude-opus-4-6';
const MAX_OUTPUT_TOKENS = 128000; // Opus 4.6 supports 128K output

const EFFORT_MAP: Record<string, 'low' | 'medium' | 'high'> = {
  low: 'medium',
  high: 'high',
};

// ---------------------------------------------------------------------------
// UTILITY
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// CORE OPUS CALL
// ---------------------------------------------------------------------------

/**
 * Calls the Anthropic Messages API with Claude Opus 4.6.
 * Uses streaming to prevent socket timeouts on long-running requests.
 */
async function callOpusInternal(
  prompt: string,
  options?: OpusCallOptions
): Promise<string> {
  const apiKey = ENV.anthropicApiKey;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }

  const requestedMaxTokens = options?.maxTokens ?? 16384;
  const maxTokens = Math.min(requestedMaxTokens, MAX_OUTPUT_TOKENS);
  const thinkingLevel = options?.thinkingLevel ?? 'high';
  const effort = EFFORT_MAP[thinkingLevel];

  const label = 'Opus 4.6';
  console.log(`[${label}] effort: ${effort}, maxTokens: ${maxTokens}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min timeout

  try {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'user', content: prompt },
    ];

    const requestBody: Record<string, unknown> = {
      model: MODEL_ID,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      output_config: { effort },
      messages,
      stream: true,
    };

    if (options?.systemPrompt) {
      requestBody.system = options.systemPrompt;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Connection': 'keep-alive',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.text().catch(() => `HTTP ${response.status}`);
      let errorMessage = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errorData);
        errorMessage = parsed?.error?.message || errorMessage;
      } catch { /* use default */ }
      throw new Error(`Opus API error (${response.status}): ${errorMessage}`);
    }

    // Parse SSE stream
    const body = response.body;
    if (!body) {
      throw new Error('No response body from Opus API');
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let resultText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);

          if (event.type === 'content_block_delta') {
            if (event.delta?.type === 'text_delta' && event.delta?.text) {
              resultText += event.delta.text;
            }
          }

          if (event.type === 'message_delta') {
            if (event.usage) {
              outputTokens = event.usage.output_tokens || outputTokens;
            }
            if (event.delta?.stop_reason) {
              stopReason = event.delta.stop_reason;
            }
          }

          if (event.type === 'message_start' && event.message?.usage) {
            inputTokens = event.message.usage.input_tokens || 0;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }

    console.log(`[${label}] ${inputTokens} in, ${outputTokens} out (stop: ${stopReason})`);
    return resultText;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// OPUS TOOL LOOP
// ---------------------------------------------------------------------------

/**
 * Multi-turn tool use loop with Opus 4.6.
 * Used for the AI Advisor where precise tool chaining matters.
 * Loops until Opus gives a final text response or maxIterations is reached.
 */
export async function callOpusWithToolLoop(
  prompt: string,
  tools: OpusToolDefinition[],
  executeFunction: OpusToolExecutor,
  options?: OpusCallOptions & {
    maxIterations?: number;
    conversationHistory?: Array<{ role: string; content: unknown }>;
  }
): Promise<string> {
  const apiKey = ENV.anthropicApiKey;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');

  const requestedMaxTokens = options?.maxTokens ?? 16384;
  const maxTokens = Math.min(requestedMaxTokens, MAX_OUTPUT_TOKENS);
  const thinkingLevel = options?.thinkingLevel ?? 'high';
  const effort = EFFORT_MAP[thinkingLevel];
  const maxIterations = options?.maxIterations ?? 10;

  const label = 'Opus ToolLoop';
  console.log(`[${label}] ${tools.length} tool(s), effort: ${effort}, maxIter: ${maxIterations}`);

  const messages: Array<{ role: string; content: unknown }> = [
    ...(options?.conversationHistory || []),
    { role: 'user', content: prompt },
  ];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000);

    try {
      const requestBody: Record<string, unknown> = {
        model: MODEL_ID,
        max_tokens: maxTokens,
        thinking: { type: 'adaptive' },
        output_config: { effort },
        tools,
        tool_choice: { type: 'auto' },
        messages,
      };

      if (options?.systemPrompt) {
        requestBody.system = options.systemPrompt;
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
        throw new Error(`Opus ToolLoop API error (${response.status}): ${errorMessage}`);
      }

      const data = (await response.json()) as {
        content: Array<{
          type: string;
          text?: string;
          id?: string;
          name?: string;
          input?: Record<string, unknown>;
        }>;
        usage: { input_tokens: number; output_tokens: number };
        stop_reason: string;
      };

      console.log(
        `[${label}] Iter ${iteration + 1}: ${data.usage.input_tokens} in, ${data.usage.output_tokens} out, stop: ${data.stop_reason}`
      );

      const toolCalls = data.content.filter((block) => block.type === 'tool_use');

      if (toolCalls.length === 0 || data.stop_reason === 'end_turn') {
        const textBlocks = data.content.filter(
          (block) => block.type === 'text' && block.text
        );
        const result = textBlocks.map((block) => block.text).join('');
        return (
          result ||
          "I apologize, but I couldn't generate a response. Please try rephrasing your question."
        );
      }

      messages.push({ role: 'assistant', content: data.content });

      const toolResults: Array<{
        type: string;
        tool_use_id: string;
        content: string;
      }> = [];
      for (const tc of toolCalls) {
        try {
          const result = await executeFunction(tc.name!, tc.input || {});
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tc.id!,
            content: JSON.stringify(result),
          });
        } catch (error) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tc.id!,
            content: JSON.stringify({
              error:
                error instanceof Error ? error.message : 'Unknown error',
            }),
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return "I apologize, but I'm having trouble processing your question. Please try a simpler query.";
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Standard Opus call for precision judgment tasks.
 * Default: effort='high' for deep reasoning.
 */
export async function callOpus(
  prompt: string,
  options?: OpusCallOptions
): Promise<string> {
  return callOpusInternal(prompt, options);
}

/**
 * Extended capacity Opus call with retry logic.
 * Uses high effort and generous output tokens by default.
 * Exponential backoff retries (2s, 4s, 8s) on transient errors.
 */
export async function callOpusMax(
  prompt: string,
  maxRetries: number = 3,
  options?: OpusCallOptions
): Promise<string> {
  let lastError: Error | null = null;
  const label = 'Opus Max';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[${label}] Attempt ${attempt + 1}/${maxRetries}...`);

      const result = await callOpusInternal(prompt, {
        ...options,
        maxTokens: options?.maxTokens ?? 32000,
        thinkingLevel: options?.thinkingLevel ?? 'high',
      });

      if (result) {
        console.log(`[${label}] Success on attempt ${attempt + 1}`);
        return result;
      }

      lastError = new Error('Empty response from Opus');
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
        errorMsg.includes('529') ||
        errorMsg.includes('500') ||
        errorMsg.includes('overloaded') ||
        errorMsg.includes('aborterror') ||
        errorMsg.includes('rate_limit') ||
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
 * Streaming Opus call. Returns an async generator that yields text chunks.
 */
export async function* callOpusStreaming(
  prompt: string,
  options?: OpusCallOptions
): AsyncGenerator<string, void, unknown> {
  const apiKey = ENV.anthropicApiKey;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }

  const requestedMaxTokens = options?.maxTokens ?? 16384;
  const maxTokens = Math.min(requestedMaxTokens, MAX_OUTPUT_TOKENS);
  const thinkingLevel = options?.thinkingLevel ?? 'high';
  const effort = EFFORT_MAP[thinkingLevel];

  const label = 'Opus Stream';
  console.log(`[${label}] effort: ${effort}, maxTokens: ${maxTokens}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600000);

  try {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'user', content: prompt },
    ];

    const requestBody: Record<string, unknown> = {
      model: MODEL_ID,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      output_config: { effort },
      messages,
      stream: true,
    };

    if (options?.systemPrompt) {
      requestBody.system = options.systemPrompt;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Connection': 'keep-alive',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`Opus Stream API error (${response.status}): ${errorData}`);
    }

    const body = response.body;
    if (!body) throw new Error('No response body');

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') return;

        try {
          const event = JSON.parse(data);
          if (
            event.type === 'content_block_delta' &&
            event.delta?.type === 'text_delta' &&
            event.delta?.text
          ) {
            yield event.delta.text;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
  }
}

/**
 * Get provider info for logging/debugging.
 */
export function getOpusProviderInfo(): { provider: string; model: string } {
  return { provider: 'anthropic', model: MODEL_ID };
}

/**
 * LLM Provider — Claude Sonnet 4.6 Only
 * 
 * All LLM calls route through Claude Sonnet 4.6 via the Anthropic Messages API.
 * Claude-only, no dual-provider, no fallback.
 * 
 * MODEL: claude-sonnet-4-6 for everything
 * - model: 'pro'   → high effort (deep analysis, reports)
 * - model: 'flash' → low effort (quick tasks, chat)
 * 
 * CLAUDE 4.6 API CONFIGURATION (per extended-thinking skill):
 * - Adaptive thinking: thinking: {type: "adaptive"}
 * - Effort parameter: output_config.effort = "low"|"medium"|"high"
 * - temperature CANNOT be modified when thinking is enabled
 * - No assistant prefills (returns 400 on 4.6)
 * - No anti-laziness prompts (amplify already-proactive behavior)
 * - Max output: 64K tokens
 */

import { ENV } from './_core/env';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface LLMCallOptions {
  /** Maximum output tokens. Default: 8192 */
  maxTokens?: number;
  /** 
   * Reasoning intensity.
   * 'high' → effort: high (deep reasoning for reports)
   * 'low'  → effort: medium (balanced for routine tasks)
   */
  thinkingLevel?: 'low' | 'high';
  /** 
   * Model tier — controls effort level.
   * 'pro'   → high effort (deep analysis, full reports)
   * 'flash' → low effort (quick responses, chat, summaries)
   */
  model?: 'pro' | 'flash';
  /** System prompt to prepend. Claude supports system messages natively. */
  systemPrompt?: string;
}

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 64000;

// Effort mapping: our thinkingLevel → Claude effort parameter
const EFFORT_MAP: Record<string, 'low' | 'medium' | 'high'> = {
  low: 'medium',   // Our 'low' = Claude 'medium' (balanced)
  high: 'high',    // Our 'high' = Claude 'high' (deep reasoning)
};

// ---------------------------------------------------------------------------
// UTILITY
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// CORE CLAUDE CALL
// ---------------------------------------------------------------------------

/**
 * Calls the Anthropic Messages API directly.
 * 
 * Key API rules (per extended-thinking skill):
 * - Adaptive thinking: thinking: {type: "adaptive"} — Claude decides when/how much to think
 * - Effort: output_config.effort controls thinking depth
 * - temperature CANNOT be modified when thinking is enabled
 * - max_tokens is a STRICT limit
 * - Sonnet 4.6: adaptive + manual thinking, max 64K output
 */
async function callClaude(prompt: string, options?: LLMCallOptions): Promise<string> {
  const apiKey = ENV.anthropicApiKey;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }

  const modelTier = options?.model ?? 'pro';
  const requestedMaxTokens = options?.maxTokens ?? 8192;
  const maxTokens = Math.min(requestedMaxTokens, MAX_OUTPUT_TOKENS);
  
  const thinkingLevel = options?.thinkingLevel ?? 'high';
  const effort = EFFORT_MAP[thinkingLevel];
  const effectiveEffort = modelTier === 'flash' ? 'low' : effort;

  const label = `Claude Sonnet 4.6 (${modelTier})`;
  console.log(`[${label}] effort: ${effectiveEffort}, maxTokens: ${maxTokens}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout

  try {
    // Build messages array
    const messages: Array<{ role: string; content: string }> = [
      { role: 'user', content: prompt },
    ];

    // Build request body
    const requestBody: Record<string, unknown> = {
      model: MODEL_ID,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      output_config: { effort: effectiveEffort },
      messages,
    };

    // Add system prompt if provided
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
      throw new Error(`Claude API error (${response.status}): ${errorMessage}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
      stop_reason: string;
    };

    // Extract text blocks (skip thinking blocks)
    const textBlocks = data.content.filter(
      (block) => block.type === 'text' && block.text
    );

    const result = textBlocks.map((block) => block.text).join('');
    
    console.log(`[${label}] ${data.usage.input_tokens} in, ${data.usage.output_tokens} out (stop: ${data.stop_reason})`);
    
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// CLAUDE WITH VISION (images, PDFs)
// ---------------------------------------------------------------------------

export interface VisionContent {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type?: string; // e.g., 'image/jpeg', 'image/png', 'application/pdf'
    data?: string;       // base64 data
    url?: string;        // URL for url type
  };
}

/**
 * Call Claude with vision capabilities (images, PDFs).
 * Supports base64-encoded images and URLs.
 */
export async function callLLMWithVision(
  prompt: string,
  images: VisionContent[],
  options?: LLMCallOptions
): Promise<string> {
  const apiKey = ENV.anthropicApiKey;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }

  const modelTier = options?.model ?? 'pro';
  const requestedMaxTokens = options?.maxTokens ?? 8192;
  const maxTokens = Math.min(requestedMaxTokens, MAX_OUTPUT_TOKENS);
  const thinkingLevel = options?.thinkingLevel ?? 'high';
  const effort = EFFORT_MAP[thinkingLevel];
  const effectiveEffort = modelTier === 'flash' ? 'low' : effort;

  const label = `Claude Vision (${modelTier})`;
  console.log(`[${label}] ${images.length} image(s), effort: ${effectiveEffort}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  try {
    // Build multimodal content array
    const contentParts: Array<Record<string, unknown>> = [];
    
    for (const img of images) {
      if (img.source.type === 'base64') {
        contentParts.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.source.media_type || 'image/jpeg',
            data: img.source.data,
          },
        });
      } else if (img.source.type === 'url') {
        contentParts.push({
          type: 'image',
          source: {
            type: 'url',
            url: img.source.url,
          },
        });
      }
    }
    
    // Add text prompt after images
    contentParts.push({ type: 'text', text: prompt });

    const requestBody: Record<string, unknown> = {
      model: MODEL_ID,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      output_config: { effort: effectiveEffort },
      messages: [{ role: 'user', content: contentParts }],
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
      throw new Error(`Claude Vision API error (${response.status}): ${errorMessage}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
      stop_reason: string;
    };

    const textBlocks = data.content.filter(
      (block) => block.type === 'text' && block.text
    );

    const result = textBlocks.map((block) => block.text).join('');
    console.log(`[${label}] ${data.usage.input_tokens} in, ${data.usage.output_tokens} out`);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// CLAUDE WITH TOOL USE (function calling)
// ---------------------------------------------------------------------------

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolUseResult {
  text: string;
  toolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
}

/**
 * Call Claude with tool use (function calling).
 * Returns both text response and any tool calls.
 */
export async function callLLMWithTools(
  prompt: string,
  tools: ClaudeTool[],
  options?: LLMCallOptions
): Promise<ToolUseResult> {
  const apiKey = ENV.anthropicApiKey;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }

  const modelTier = options?.model ?? 'pro';
  const requestedMaxTokens = options?.maxTokens ?? 8192;
  const maxTokens = Math.min(requestedMaxTokens, MAX_OUTPUT_TOKENS);
  const thinkingLevel = options?.thinkingLevel ?? 'high';
  const effort = EFFORT_MAP[thinkingLevel];
  const effectiveEffort = modelTier === 'flash' ? 'low' : effort;

  const label = `Claude Tools (${modelTier})`;
  console.log(`[${label}] ${tools.length} tool(s), effort: ${effectiveEffort}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  try {
    const requestBody: Record<string, unknown> = {
      model: MODEL_ID,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      output_config: { effort: effectiveEffort },
      tools,
      // tool_choice must be "auto" when thinking is enabled
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: prompt }],
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
      throw new Error(`Claude Tools API error (${response.status}): ${errorMessage}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      usage: { input_tokens: number; output_tokens: number };
      stop_reason: string;
    };

    const text = data.content
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text)
      .join('');

    const toolCalls = data.content
      .filter((block) => block.type === 'tool_use')
      .map((block) => ({
        id: block.id!,
        name: block.name!,
        input: block.input!,
      }));

    console.log(`[${label}] ${data.usage.input_tokens} in, ${data.usage.output_tokens} out, ${toolCalls.length} tool call(s)`);

    return { text, toolCalls };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// CLAUDE STREAMING
// ---------------------------------------------------------------------------

/**
 * Call Claude with streaming response.
 * Returns an async generator that yields text chunks.
 */
export async function* callLLMStreaming(
  prompt: string,
  options?: LLMCallOptions
): AsyncGenerator<string, void, unknown> {
  const apiKey = ENV.anthropicApiKey;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }

  const modelTier = options?.model ?? 'pro';
  const requestedMaxTokens = options?.maxTokens ?? 8192;
  const maxTokens = Math.min(requestedMaxTokens, MAX_OUTPUT_TOKENS);
  const thinkingLevel = options?.thinkingLevel ?? 'high';
  const effort = EFFORT_MAP[thinkingLevel];
  const effectiveEffort = modelTier === 'flash' ? 'low' : effort;

  const label = `Claude Stream (${modelTier})`;
  console.log(`[${label}] effort: ${effectiveEffort}, maxTokens: ${maxTokens}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  try {
    const requestBody: Record<string, unknown> = {
      model: MODEL_ID,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      output_config: { effort: effectiveEffort },
      stream: true,
      messages: [{ role: 'user', content: prompt }],
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
      throw new Error(`Claude Streaming API error (${response.status}): ${errorMessage}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body for streaming');

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
          
          // Only yield text content deltas (skip thinking deltas)
          if (event.type === 'content_block_delta' && 
              event.delta?.type === 'text_delta' && 
              event.delta?.text) {
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

// ---------------------------------------------------------------------------
// CLAUDE MULTI-TURN TOOL USE LOOP
// ---------------------------------------------------------------------------

export interface ToolExecutor {
  (name: string, args: Record<string, unknown>): Promise<unknown>;
}

/**
 * Multi-turn tool use loop — Claude calls tools, we execute them, and feed results back.
 * Loops until Claude gives a final text response or maxIterations is reached.
 * 
 * This replaces the legacy function calling loop in ai-advisor.ts.
 */
export async function callLLMWithToolLoop(
  prompt: string,
  tools: ClaudeTool[],
  executeFunction: ToolExecutor,
  options?: LLMCallOptions & { maxIterations?: number; conversationHistory?: Array<{ role: string; content: unknown }> }
): Promise<string> {
  const apiKey = ENV.anthropicApiKey;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');

  const modelTier = options?.model ?? 'pro';
  const requestedMaxTokens = options?.maxTokens ?? 8192;
  const maxTokens = Math.min(requestedMaxTokens, MAX_OUTPUT_TOKENS);
  const thinkingLevel = options?.thinkingLevel ?? 'high';
  const effort = EFFORT_MAP[thinkingLevel];
  const effectiveEffort = modelTier === 'flash' ? 'low' : effort;
  const maxIterations = options?.maxIterations ?? 10;

  const label = `Claude ToolLoop (${modelTier})`;
  console.log(`[${label}] ${tools.length} tool(s), effort: ${effectiveEffort}, maxIter: ${maxIterations}`);

  // Build initial messages
  const messages: Array<{ role: string; content: unknown }> = [
    ...(options?.conversationHistory || []),
    { role: 'user', content: prompt },
  ];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    try {
      const requestBody: Record<string, unknown> = {
        model: MODEL_ID,
        max_tokens: maxTokens,
        thinking: { type: 'adaptive' },
        output_config: { effort: effectiveEffort },
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
        throw new Error(`Claude ToolLoop API error (${response.status}): ${errorMessage}`);
      }

      const data = await response.json() as {
        content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
        usage: { input_tokens: number; output_tokens: number };
        stop_reason: string;
      };

      console.log(`[${label}] Iter ${iteration + 1}: ${data.usage.input_tokens} in, ${data.usage.output_tokens} out, stop: ${data.stop_reason}`);

      // Check for tool calls
      const toolCalls = data.content.filter((block) => block.type === 'tool_use');

      if (toolCalls.length === 0 || data.stop_reason === 'end_turn') {
        // No tool calls — extract final text response
        const textBlocks = data.content.filter((block) => block.type === 'text' && block.text);
        const result = textBlocks.map((block) => block.text).join('');
        return result || "I apologize, but I couldn't generate a response. Please try rephrasing your question.";
      }

      // Add assistant's response (with tool_use blocks) to conversation
      messages.push({ role: 'assistant', content: data.content });

      // Execute each tool call and collect results
      const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];
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
            content: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
          });
        }
      }

      // Add tool results to conversation
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
 * Core LLM call — routes to Claude Sonnet 4.6.
 * 
 * Standard LLM call with default settings.
 * 
 * Default: model='pro' (high effort for deep analysis)
 * Use model='flash' for fast, routine tasks (low effort)
 */
export async function callLLM(prompt: string, options?: LLMCallOptions): Promise<string> {
  return callClaude(prompt, options);
}

/**
 * Extended capacity LLM call with retry logic.
 * 
 * High-capacity LLM call with maximum output tokens.
 * Uses maximum output tokens (64K) and high effort by default.
 * 
 * Exponential backoff retries (2s, 4s, 8s) on transient errors.
 */
export async function callLLMMax(prompt: string, maxRetries: number = 3, options?: LLMCallOptions): Promise<string> {
  let lastError: Error | null = null;
  
  const modelTier = options?.model ?? 'pro';
  const label = `Claude Max (${modelTier})`;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[${label}] Attempt ${attempt + 1}/${maxRetries}...`);
      
      const result = await callClaude(prompt, {
        ...options,
        maxTokens: options?.maxTokens ?? MAX_OUTPUT_TOKENS,
        thinkingLevel: options?.thinkingLevel ?? 'high',
        model: modelTier,
      });
      
      if (result) {
        console.log(`[${label}] Success on attempt ${attempt + 1}`);
        return result;
      }
      
      lastError = new Error('Empty response from Claude');
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
      const isRetryable = errorMsg.includes('429') || 
                          errorMsg.includes('529') ||
                          errorMsg.includes('500') || 
                          errorMsg.includes('overloaded') ||
                          errorMsg.includes('aborterror') ||
                          errorMsg.includes('rate_limit');
      
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
 * Get provider info for logging/debugging
 */
export function getProviderInfo(): { provider: string; model: string } {
  return { provider: 'anthropic', model: MODEL_ID };
}

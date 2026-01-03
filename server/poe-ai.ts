/**
 * Poe AI Service - Uses OpenAI-compatible API with Claude Opus
 * 
 * This service provides AI-powered narrative generation using Poe's API
 * which gives access to Claude Opus for high-quality writing.
 */

import { ENV } from './_core/env';

const POE_API_URL = 'https://api.poe.com/v1/chat/completions';

// Default model - Claude Opus for best writing quality
const DEFAULT_MODEL = 'Claude-Opus-4.1';

interface PoeMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PoeCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call Poe AI with retry logic and timeout
 */
export async function callPoeAI(
  messages: PoeMessage[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
  } = {}
): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    temperature = 0.7,
    timeoutMs = 60000, // 60 second timeout
  } = options;

  const apiKey = ENV.poeApiKey;
  if (!apiKey) {
    throw new Error('POE_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[PoeAI] Calling ${model} with ${messages.length} messages...`);
    
    const response = await fetch(POE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false, // Non-streaming for reliability
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Poe API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data: PoeCompletionResponse = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    if (!content) {
      throw new Error('Empty response from Poe AI');
    }

    console.log(`[PoeAI] Response received: ${content.length} chars, ${data.usage?.total_tokens || 'unknown'} tokens`);
    return content;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[PoeAI] Timeout after ${timeoutMs / 1000}s`);
      throw new Error(`Poe AI timeout after ${timeoutMs / 1000} seconds`);
    }
    console.error('[PoeAI] Error:', error.message);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generate narrative report using Claude Opus via Poe
 */
export async function generateNarrativeWithPoe(
  prompt: string,
  options: {
    systemPrompt?: string;
    model?: string;
    maxTokens?: number;
    timeoutMs?: number;
  } = {}
): Promise<string> {
  const {
    systemPrompt = 'You are a senior short-term rental investment analyst. Write clear, specific, and actionable analysis in flowing paragraphs. Use specific numbers and explain what they mean for the investor.',
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    timeoutMs = 60000,
  } = options;

  const messages: PoeMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  return callPoeAI(messages, { model, maxTokens, timeoutMs });
}

/**
 * Test the Poe API connection
 */
export async function testPoeConnection(): Promise<{ success: boolean; message: string; model?: string }> {
  try {
    const response = await callPoeAI(
      [{ role: 'user', content: 'Say "Hello" and nothing else.' }],
      { maxTokens: 50, timeoutMs: 15000 }
    );
    
    return {
      success: true,
      message: `Poe AI connected successfully. Response: ${response.trim()}`,
      model: DEFAULT_MODEL,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Poe AI connection failed: ${error.message}`,
    };
  }
}

/**
 * Gemini Streaming Integration for AI Chat
 * 
 * Provides real-time streaming responses using Google's Gemini 3 API
 * with Server-Sent Events (SSE) for the frontend.
 * 
 * GEMINI 3 COMPLIANT:
 * - Model: gemini-3-flash-preview for fast chat responses
 * - Uses REST API with fetch() (no deprecated SDK)
 * - Uses native systemInstruction field
 * - Uses thinkingConfig for improved reasoning
 * - API key via ENV.geminiApiKey (centralized)
 */

import { ENV } from './_core/env';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview';

// Safety settings - allow all content for business analysis
const safetySettings = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamingChatOptions {
  messages: ChatMessage[];
  systemPrompt?: string;
  onChunk: (chunk: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

/**
 * Build chat contents in Gemini format, extracting system messages into systemInstruction
 */
function buildRequestBody(messages: ChatMessage[], systemPrompt?: string) {
  // Collect all system-level instructions
  const systemParts: string[] = [];
  if (systemPrompt) {
    systemParts.push(systemPrompt);
  }

  // Build contents array (user/model turns only)
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      // System messages go into systemInstruction, not as fake user/model pairs
      systemParts.push(msg.content);
    } else if (msg.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: msg.content }],
      });
    } else if (msg.role === 'assistant') {
      contents.push({
        role: 'model',
        parts: [{ text: msg.content }],
      });
    }
  }

  const body: Record<string, unknown> = {
    contents,
    safetySettings,
    generationConfig: {
      temperature: 1.0,
      maxOutputTokens: 2048,
      thinkingConfig: {
        thinkingLevel: 'low'
      }
    }
  };

  // Use native systemInstruction field instead of fake user/model pairs
  if (systemParts.length > 0) {
    body.systemInstruction = {
      parts: [{ text: systemParts.join('\n\n') }]
    };
  }

  return body;
}

/**
 * Stream a chat response from Gemini using REST API with streaming
 */
export async function streamGeminiChat(options: StreamingChatOptions): Promise<void> {
  const { messages, systemPrompt, onChunk, onComplete, onError } = options;
  
  try {
    const apiKey = ENV.geminiApiKey;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      throw new Error('No user message found in conversation');
    }

    const body = buildRequestBody(messages, systemPrompt);

    // Use streamGenerateContent endpoint for streaming
    const response = await fetch(
      `${GEMINI_API_URL}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    let fullResponse = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process SSE events from the buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const text = data.candidates?.[0]?.content?.parts
              ?.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
              ?.map((p: { text: string }) => p.text)
              ?.join('') || '';
            
            if (text) {
              fullResponse += text;
              onChunk(text);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }

    onComplete(fullResponse);

  } catch (error) {
    console.error('[Gemini Streaming] Error:', error);
    onError(error instanceof Error ? error : new Error('Unknown streaming error'));
  }
}

/**
 * Non-streaming chat for fallback
 */
export async function geminiChat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
  try {
    const apiKey = ENV.geminiApiKey;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      throw new Error('No user message found in conversation');
    }

    const body = buildRequestBody(messages, systemPrompt);

    const response = await fetch(
      `${GEMINI_API_URL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  } catch (error) {
    console.error('[Gemini Chat] Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return 'I apologize, but I\'m having trouble connecting to my AI service. Please try again in a moment.';
      }
      if (error.message.includes('quota') || error.message.includes('rate')) {
        return 'I\'m receiving a lot of questions right now. Please wait a moment and try again.';
      }
    }

    return 'I apologize, but I encountered an error processing your question. Please try rephrasing or ask something else.';
  }
}

/**
 * Check if Gemini API is configured and working
 */
export async function checkGeminiHealth(): Promise<boolean> {
  try {
    const apiKey = ENV.geminiApiKey;
    if (!apiKey) return false;

    const response = await fetch(
      `${GEMINI_API_URL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "OK" if you can hear me.' }] }],
          generationConfig: { maxOutputTokens: 10 }
        }),
      }
    );

    if (!response.ok) return false;

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.toLowerCase().includes('ok');
  } catch {
    return false;
  }
}

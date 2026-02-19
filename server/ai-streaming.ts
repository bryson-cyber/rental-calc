/**
 * Claude Streaming Integration for AI Chat
 * 
 * Provides real-time streaming responses using Claude Sonnet 4.6 via llm-provider
 * with Server-Sent Events (SSE) for the frontend.
 * 
 * CLAUDE SONNET 4.6 COMPLIANT:
 * - Model: Claude Sonnet 4.6 via callLLM abstraction
 * - Uses callLLM, callLLMStreaming from llm-provider.ts
 * - Uses native systemPrompt field
 */
import { routedLLMCall, routedLLMCallStreaming, FEATURES } from './model-router';

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
 * Builds a single prompt string from a chat history, combining system and user messages.
 */
function buildPrompt(messages: ChatMessage[], systemPrompt?: string): string {
  const systemParts: string[] = [];
  if (systemPrompt) {
    systemParts.push(systemPrompt);
  }

  const conversationParts: string[] = messages.map(msg => {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
      return null; // System messages are handled separately
    } else {
      return `${msg.role}: ${msg.content}`;
    }
  }).filter(Boolean) as string[];

  const fullPrompt = conversationParts.join('\n\n');
  // The system prompt is passed separately to callLLM, so we don't prepend it here.
  return fullPrompt;
}

/**
 * Stream a chat response from Claude using the llm-provider
 */
export async function streamClaudeChat(options: StreamingChatOptions): Promise<void> {
  const { messages, systemPrompt, onChunk, onComplete, onError } = options;
  
  try {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      throw new Error('No user message found in conversation');
    }

    const prompt = buildPrompt(messages);
    const stream = routedLLMCallStreaming(FEATURES.CHAT_STREAMING, prompt, { systemPrompt });

    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk;
      onChunk(chunk);
    }

    onComplete(fullResponse);

  } catch (error) {
    console.error('[Claude Streaming] Error:', error);
    onError(error instanceof Error ? error : new Error('Unknown streaming error'));
  }
}

/**
 * Non-streaming chat for fallback, using Claude.
 */
export async function claudeChat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
  try {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      throw new Error('No user message found in conversation');
    }

    const prompt = buildPrompt(messages);
    const response = await routedLLMCall(FEATURES.CHAT_NON_STREAMING, prompt, { systemPrompt });
    return response;

  } catch (error) {
    console.error('[Claude Chat] Error:', error);

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
 * Check if Claude API is configured and working via the llm-provider.
 */
export async function checkClaudeHealth(): Promise<boolean> {
  try {
    const response = await routedLLMCall(FEATURES.HEALTH_CHECK, 'Say "OK" if you can hear me.', { maxTokens: 10 });
    return response.toLowerCase().includes('ok');
  } catch {
    return false;
  }
}

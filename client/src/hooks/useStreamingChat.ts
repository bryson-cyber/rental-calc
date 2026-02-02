/**
 * Custom hook for streaming AI chat responses
 * 
 * Uses Server-Sent Events (SSE) to receive real-time streaming responses
 * from the Gemini-powered AI assistant.
 */

import { useState, useCallback, useRef } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamingChatOptions {
  systemPrompt?: string;
  conversationId?: number;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: string) => void;
}

export function useStreamingChat() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    messages: ChatMessage[],
    options: StreamingChatOptions = {}
  ): Promise<string> => {
    const { systemPrompt, conversationId, onChunk, onComplete, onError } = options;
    
    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setIsStreaming(true);
    setStreamedContent('');
    
    let fullResponse = '';
    
    try {
      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          systemPrompt,
          conversationId,
        }),
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'chunk') {
                fullResponse += data.content;
                setStreamedContent(fullResponse);
                onChunk?.(data.content);
              } else if (data.type === 'complete') {
                fullResponse = data.content;
                setStreamedContent(fullResponse);
                onComplete?.(fullResponse);
              } else if (data.type === 'error') {
                onError?.(data.message);
                throw new Error(data.message);
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete JSON
              if (parseError instanceof SyntaxError) continue;
              throw parseError;
            }
          }
        }
      }
      
      return fullResponse;
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was cancelled, not an error
        return fullResponse;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onError?.(errorMessage);
      throw error;
      
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, []);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const clearStreamedContent = useCallback(() => {
    setStreamedContent('');
  }, []);

  return {
    sendMessage,
    cancelStream,
    clearStreamedContent,
    isStreaming,
    streamedContent,
  };
}

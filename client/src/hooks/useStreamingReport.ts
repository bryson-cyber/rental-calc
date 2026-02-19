/**
 * useStreamingReport — React hook for consuming SSE report streams.
 *
 * Connects to /api/reports/stream/property or /api/reports/stream/market,
 * progressively accumulates text chunks, and exposes the growing content
 * plus status flags so the UI can render in real-time.
 */
import { useState, useCallback, useRef } from 'react';

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';

interface UseStreamingReportOptions {
  /** Called with each new chunk (optional) */
  onChunk?: (chunk: string) => void;
  /** Called when the full report is complete */
  onComplete?: (fullText: string, cached: boolean) => void;
  /** Called on error */
  onError?: (message: string) => void;
}

interface UseStreamingReportReturn {
  /** The accumulated report text so far */
  content: string;
  /** Current stream status */
  status: StreamStatus;
  /** Whether the stream is actively running */
  isStreaming: boolean;
  /** Whether the report came from cache */
  isCached: boolean;
  /** Error message if status === 'error' */
  error: string | null;
  /** Start streaming a property report */
  streamPropertyReport: (input: any) => void;
  /** Start streaming a market report */
  streamMarketReport: (input: any) => void;
  /** Cancel an in-progress stream */
  cancel: () => void;
  /** Reset to idle state */
  reset: () => void;
}

export function useStreamingReport(
  options?: UseStreamingReportOptions
): UseStreamingReportReturn {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setContent('');
    setStatus('idle');
    setIsCached(false);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStatus('idle');
  }, []);

  const startStream = useCallback(
    async (endpoint: string, body: any) => {
      // Cancel any existing stream
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setContent('');
      setStatus('connecting');
      setIsCached(false);
      setError(null);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
          credentials: 'include',
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(errBody || `HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        setStatus('streaming');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from the buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === 'chunk') {
                accumulated += event.content;
                setContent(accumulated);
                options?.onChunk?.(event.content);
              } else if (event.type === 'complete') {
                const finalText = event.content || accumulated;
                setContent(finalText);
                setIsCached(!!event.cached);
                setStatus('complete');
                options?.onComplete?.(finalText, !!event.cached);
              } else if (event.type === 'error') {
                setError(event.message);
                setStatus('error');
                options?.onError?.(event.message);
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }

        // If we exited the loop without a 'complete' event, mark as complete
        if (status !== 'complete' && status !== 'error' && accumulated) {
          setStatus('complete');
          options?.onComplete?.(accumulated, false);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User cancelled — don't set error state
          return;
        }
        const message = err.message || 'Stream connection failed';
        setError(message);
        setStatus('error');
        options?.onError?.(message);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [options]
  );

  const streamPropertyReport = useCallback(
    (input: any) => startStream('/api/reports/stream/property', input),
    [startStream]
  );

  const streamMarketReport = useCallback(
    (input: any) => startStream('/api/reports/stream/market', input),
    [startStream]
  );

  return {
    content,
    status,
    isStreaming: status === 'connecting' || status === 'streaming',
    isCached,
    error,
    streamPropertyReport,
    streamMarketReport,
    cancel,
    reset,
  };
}

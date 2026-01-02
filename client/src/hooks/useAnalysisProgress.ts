/**
 * Custom hook for tracking analysis progress via Server-Sent Events
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  startedAt?: number;
  completedAt?: number;
  error?: string;
  detail?: string;
}

export interface ProgressState {
  sessionId: string;
  currentStep: number;
  totalSteps: number;
  steps: ProgressStep[];
  overallProgress: number;
  estimatedTimeRemaining?: number;
  startedAt: number;
}

interface UseAnalysisProgressReturn {
  sessionId: string | null;
  progress: ProgressState | null;
  isConnected: boolean;
  startTracking: () => string;
  stopTracking: () => void;
}

/**
 * Generate a unique session ID for progress tracking
 */
function generateSessionId(): string {
  return `analysis-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Hook to track analysis progress via SSE
 */
export function useAnalysisProgress(): UseAnalysisProgressReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Start tracking with a new session
  const startTracking = useCallback(() => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setProgress(null);
    
    // Create SSE connection
    const eventSource = new EventSource(`/api/progress/${newSessionId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ProgressState;
        setProgress(data);
      } catch (error) {
        console.error('Error parsing progress data:', error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      // Don't close immediately - the server might just be slow
    };

    return newSessionId;
  }, []);

  // Stop tracking and clean up
  const stopTracking = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    setSessionId(null);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    sessionId,
    progress,
    isConnected,
    startTracking,
    stopTracking,
  };
}

/**
 * Format estimated time remaining
 */
export function formatTimeRemaining(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  
  if (seconds < 60) {
    return `~${Math.ceil(seconds)}s remaining`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.ceil(seconds % 60);
  
  if (remainingSeconds === 0) {
    return `~${minutes}m remaining`;
  }
  
  return `~${minutes}m ${remainingSeconds}s remaining`;
}

/**
 * Get status color for a step
 */
export function getStepStatusColor(status: ProgressStep['status']): string {
  switch (status) {
    case 'completed':
      return 'text-green-500';
    case 'in-progress':
      return 'text-[#C9A962]';
    case 'error':
      return 'text-red-500';
    default:
      return 'text-white/40';
  }
}

/**
 * Get icon for step status
 */
export function getStepStatusIcon(status: ProgressStep['status']): 'check' | 'loader' | 'x' | 'circle' {
  switch (status) {
    case 'completed':
      return 'check';
    case 'in-progress':
      return 'loader';
    case 'error':
      return 'x';
    default:
      return 'circle';
  }
}

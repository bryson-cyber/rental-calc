/**
 * Progress Tracker for Analysis Pipeline
 * 
 * Provides real-time progress updates during property analysis.
 * Uses an event-based system that can be consumed by SSE endpoints.
 */

import { EventEmitter } from 'events';

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
  overallProgress: number; // 0-100
  estimatedTimeRemaining?: number; // seconds
  startedAt: number;
}

// Define all analysis steps with their weights (for progress calculation)
export const ANALYSIS_STEPS = [
  { id: 'property', label: 'Analyzing property details', weight: 5 },
  { id: 'market', label: 'Fetching market data', weight: 10 },
  { id: 'competitors', label: 'Finding comparable properties', weight: 15 },
  { id: 'images', label: 'Loading property images', weight: 10 },
  { id: 'seasonality', label: 'Analyzing seasonal trends', weight: 10 },
  { id: 'historical', label: 'Processing historical data', weight: 10 },
  { id: 'ai_analysis', label: 'Running AI analysis', weight: 15 },
  { id: 'narrative', label: 'Generating narrative report', weight: 15 },
  { id: 'enhanced', label: 'Creating enhanced insights', weight: 5 },
  { id: 'finalize', label: 'Finalizing your report', weight: 5 },
] as const;

// Calculate total weight for percentage calculations
const TOTAL_WEIGHT = ANALYSIS_STEPS.reduce((sum, step) => sum + step.weight, 0);

class ProgressTracker extends EventEmitter {
  private sessions: Map<string, ProgressState> = new Map();
  
  /**
   * Create a new progress tracking session
   */
  createSession(sessionId: string): ProgressState {
    const steps: ProgressStep[] = ANALYSIS_STEPS.map(step => ({
      id: step.id,
      label: step.label,
      status: 'pending'
    }));
    
    const state: ProgressState = {
      sessionId,
      currentStep: 0,
      totalSteps: ANALYSIS_STEPS.length,
      steps,
      overallProgress: 0,
      startedAt: Date.now()
    };
    
    this.sessions.set(sessionId, state);
    this.emit('progress', sessionId, state);
    
    return state;
  }
  
  /**
   * Start a specific step
   */
  startStep(sessionId: string, stepId: string, detail?: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    
    const stepIndex = state.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;
    
    state.steps[stepIndex].status = 'in-progress';
    state.steps[stepIndex].startedAt = Date.now();
    if (detail) state.steps[stepIndex].detail = detail;
    state.currentStep = stepIndex;
    
    this.updateProgress(state);
    this.emit('progress', sessionId, state);
  }
  
  /**
   * Complete a specific step
   */
  completeStep(sessionId: string, stepId: string, detail?: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    
    const stepIndex = state.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;
    
    state.steps[stepIndex].status = 'completed';
    state.steps[stepIndex].completedAt = Date.now();
    if (detail) state.steps[stepIndex].detail = detail;
    
    this.updateProgress(state);
    this.emit('progress', sessionId, state);
  }
  
  /**
   * Mark a step as errored (but continue processing)
   */
  errorStep(sessionId: string, stepId: string, error: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    
    const stepIndex = state.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;
    
    state.steps[stepIndex].status = 'error';
    state.steps[stepIndex].error = error;
    state.steps[stepIndex].completedAt = Date.now();
    
    this.updateProgress(state);
    this.emit('progress', sessionId, state);
  }
  
  /**
   * Update step detail without changing status
   */
  updateStepDetail(sessionId: string, stepId: string, detail: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    
    const stepIndex = state.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;
    
    state.steps[stepIndex].detail = detail;
    this.emit('progress', sessionId, state);
  }
  
  /**
   * Get current state for a session
   */
  getState(sessionId: string): ProgressState | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Clean up a session
   */
  endSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
  
  /**
   * Calculate overall progress based on completed steps
   */
  private updateProgress(state: ProgressState): void {
    let completedWeight = 0;
    let inProgressWeight = 0;
    
    state.steps.forEach((step, index) => {
      const stepWeight = ANALYSIS_STEPS[index].weight;
      if (step.status === 'completed' || step.status === 'error') {
        completedWeight += stepWeight;
      } else if (step.status === 'in-progress') {
        // Count in-progress as 50% complete
        inProgressWeight += stepWeight * 0.5;
      }
    });
    
    state.overallProgress = Math.round(((completedWeight + inProgressWeight) / TOTAL_WEIGHT) * 100);
    
    // Estimate time remaining based on elapsed time and progress
    const elapsed = (Date.now() - state.startedAt) / 1000;
    if (state.overallProgress > 5) {
      const totalEstimated = elapsed / (state.overallProgress / 100);
      state.estimatedTimeRemaining = Math.round(totalEstimated - elapsed);
    }
  }
}

// Export singleton instance
export const progressTracker = new ProgressTracker();

/**
 * Helper function to wrap analysis steps with progress tracking
 */
export async function withProgress<T>(
  sessionId: string,
  stepId: string,
  fn: () => Promise<T>,
  detail?: string
): Promise<T> {
  progressTracker.startStep(sessionId, stepId, detail);
  try {
    const result = await fn();
    progressTracker.completeStep(sessionId, stepId);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    progressTracker.errorStep(sessionId, stepId, errorMessage);
    throw error;
  }
}

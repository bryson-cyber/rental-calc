/**
 * Tests for Progress Tracker functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { progressTracker, ANALYSIS_STEPS, withProgress } from '../progress-tracker';

describe('Progress Tracker', () => {
  const testSessionId = 'test-session-123';

  afterEach(() => {
    // Clean up any test sessions
    progressTracker.endSession(testSessionId);
    progressTracker.removeAllListeners();
  });

  describe('createSession', () => {
    it('should create a new progress session with all steps', () => {
      const state = progressTracker.createSession(testSessionId);

      expect(state).toBeDefined();
      expect(state.sessionId).toBe(testSessionId);
      expect(state.steps).toHaveLength(ANALYSIS_STEPS.length);
      expect(state.overallProgress).toBe(0);
      expect(state.currentStep).toBe(0);
      expect(state.totalSteps).toBe(ANALYSIS_STEPS.length);
    });

    it('should initialize all steps as pending', () => {
      const state = progressTracker.createSession(testSessionId);

      state.steps.forEach(step => {
        expect(step.status).toBe('pending');
      });
    });

    it('should emit progress event on session creation', () => {
      const progressHandler = vi.fn();
      progressTracker.on('progress', progressHandler);

      progressTracker.createSession(testSessionId);

      expect(progressHandler).toHaveBeenCalledTimes(1);
      expect(progressHandler).toHaveBeenCalledWith(testSessionId, expect.any(Object));
    });
  });

  describe('startStep', () => {
    it('should mark a step as in-progress', () => {
      progressTracker.createSession(testSessionId);
      progressTracker.startStep(testSessionId, 'property');

      const state = progressTracker.getState(testSessionId);
      const propertyStep = state?.steps.find(s => s.id === 'property');

      expect(propertyStep?.status).toBe('in-progress');
      expect(propertyStep?.startedAt).toBeDefined();
    });

    it('should update current step index', () => {
      progressTracker.createSession(testSessionId);
      progressTracker.startStep(testSessionId, 'market');

      const state = progressTracker.getState(testSessionId);
      expect(state?.currentStep).toBe(1); // market is index 1
    });

    it('should add detail if provided', () => {
      progressTracker.createSession(testSessionId);
      progressTracker.startStep(testSessionId, 'property', 'Analyzing 123 Main St');

      const state = progressTracker.getState(testSessionId);
      const propertyStep = state?.steps.find(s => s.id === 'property');

      expect(propertyStep?.detail).toBe('Analyzing 123 Main St');
    });
  });

  describe('completeStep', () => {
    it('should mark a step as completed', () => {
      progressTracker.createSession(testSessionId);
      progressTracker.startStep(testSessionId, 'property');
      progressTracker.completeStep(testSessionId, 'property');

      const state = progressTracker.getState(testSessionId);
      const propertyStep = state?.steps.find(s => s.id === 'property');

      expect(propertyStep?.status).toBe('completed');
      expect(propertyStep?.completedAt).toBeDefined();
    });

    it('should update overall progress when steps complete', () => {
      progressTracker.createSession(testSessionId);
      
      // Complete first step
      progressTracker.startStep(testSessionId, 'property');
      progressTracker.completeStep(testSessionId, 'property');

      const state = progressTracker.getState(testSessionId);
      expect(state?.overallProgress).toBeGreaterThan(0);
    });
  });

  describe('errorStep', () => {
    it('should mark a step as errored with error message', () => {
      progressTracker.createSession(testSessionId);
      progressTracker.startStep(testSessionId, 'property');
      progressTracker.errorStep(testSessionId, 'property', 'API timeout');

      const state = progressTracker.getState(testSessionId);
      const propertyStep = state?.steps.find(s => s.id === 'property');

      expect(propertyStep?.status).toBe('error');
      expect(propertyStep?.error).toBe('API timeout');
    });
  });

  describe('updateStepDetail', () => {
    it('should update step detail without changing status', () => {
      progressTracker.createSession(testSessionId);
      progressTracker.startStep(testSessionId, 'competitors');
      progressTracker.updateStepDetail(testSessionId, 'competitors', 'Found 15 competitors');

      const state = progressTracker.getState(testSessionId);
      const competitorsStep = state?.steps.find(s => s.id === 'competitors');

      expect(competitorsStep?.status).toBe('in-progress');
      expect(competitorsStep?.detail).toBe('Found 15 competitors');
    });
  });

  describe('getState', () => {
    it('should return undefined for non-existent session', () => {
      const state = progressTracker.getState('non-existent-session');
      expect(state).toBeUndefined();
    });

    it('should return current state for existing session', () => {
      progressTracker.createSession(testSessionId);
      const state = progressTracker.getState(testSessionId);
      
      expect(state).toBeDefined();
      expect(state?.sessionId).toBe(testSessionId);
    });
  });

  describe('endSession', () => {
    it('should remove the session', () => {
      progressTracker.createSession(testSessionId);
      progressTracker.endSession(testSessionId);

      const state = progressTracker.getState(testSessionId);
      expect(state).toBeUndefined();
    });
  });

  describe('progress calculation', () => {
    it('should calculate progress based on completed steps', () => {
      progressTracker.createSession(testSessionId);

      // Complete first few steps
      progressTracker.startStep(testSessionId, 'property');
      progressTracker.completeStep(testSessionId, 'property');
      progressTracker.startStep(testSessionId, 'market');
      progressTracker.completeStep(testSessionId, 'market');

      const state = progressTracker.getState(testSessionId);
      // Should be greater than 0 but less than 100
      expect(state?.overallProgress).toBeGreaterThan(0);
      expect(state?.overallProgress).toBeLessThan(100);
    });

    it('should reach 100% when all steps complete', () => {
      progressTracker.createSession(testSessionId);

      // Complete all steps
      ANALYSIS_STEPS.forEach(step => {
        progressTracker.startStep(testSessionId, step.id);
        progressTracker.completeStep(testSessionId, step.id);
      });

      const state = progressTracker.getState(testSessionId);
      expect(state?.overallProgress).toBe(100);
    });
  });

  describe('withProgress helper', () => {
    it('should track progress for successful async operations', async () => {
      progressTracker.createSession(testSessionId);

      const result = await withProgress(
        testSessionId,
        'property',
        async () => {
          return 'success';
        }
      );

      expect(result).toBe('success');
      
      const state = progressTracker.getState(testSessionId);
      const propertyStep = state?.steps.find(s => s.id === 'property');
      expect(propertyStep?.status).toBe('completed');
    });

    it('should mark step as error on failure and rethrow', async () => {
      progressTracker.createSession(testSessionId);

      await expect(
        withProgress(
          testSessionId,
          'property',
          async () => {
            throw new Error('Test error');
          }
        )
      ).rejects.toThrow('Test error');

      const state = progressTracker.getState(testSessionId);
      const propertyStep = state?.steps.find(s => s.id === 'property');
      expect(propertyStep?.status).toBe('error');
      expect(propertyStep?.error).toBe('Test error');
    });
  });
});

describe('ANALYSIS_STEPS', () => {
  it('should have all required steps defined', () => {
    const requiredSteps = [
      'property',
      'market',
      'competitors',
      'ai_analysis',
      'narrative',
      'enhanced',
      'finalize'
    ];

    requiredSteps.forEach(stepId => {
      const step = ANALYSIS_STEPS.find(s => s.id === stepId);
      expect(step).toBeDefined();
      expect(step?.label).toBeTruthy();
      expect(step?.weight).toBeGreaterThan(0);
    });
  });

  it('should have weights that sum to 100', () => {
    const totalWeight = ANALYSIS_STEPS.reduce((sum, step) => sum + step.weight, 0);
    expect(totalWeight).toBe(100);
  });
});

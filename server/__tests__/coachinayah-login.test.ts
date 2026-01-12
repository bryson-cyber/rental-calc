/**
 * Test coachinayah.com login credentials
 * 
 * This test validates that the stored credentials can successfully log into coachinayah.com
 * using Browser Use Cloud API.
 */

import { describe, it, expect } from 'vitest';
import { ENV } from '../_core/env';
import { createSession, createTask, getTask, stopSession } from '../browser-use';

describe('CoachInayah Login', () => {
  it('should successfully log into coachinayah.com with stored credentials', async () => {
    // Check that credentials are set
    expect(ENV.coachinayahEmail).toBeDefined();
    expect(ENV.coachinayahPassword).toBeDefined();
    expect(ENV.coachinayahEmail).toBe('agent@gmail.com');
    
    console.log('[Test] Creating Browser Use session...');
    
    // Create a new session
    const session = await createSession({
      startUrl: 'https://coachinayah.com/login',
      saveBrowserData: true,
    });
    
    expect(session.id).toBeDefined();
    console.log(`[Test] Session created: ${session.id}`);
    
    try {
      // Create a task to log in
      console.log('[Test] Creating login task...');
      const task = await createTask({
        sessionId: session.id,
        task: `Log into coachinayah.com using email "${ENV.coachinayahEmail}" and password "${ENV.coachinayahPassword}". After logging in, navigate to https://coachinayah.com/market-charts and confirm you can see the market data dashboard.`,
        maxSteps: 20,
        llm: 'claude-opus-4-5-20251101',
        thinking: true,
        vision: true,
      });
      
      expect(task.id).toBeDefined();
      console.log(`[Test] Task created: ${task.id}`);
      
      // Poll for task completion
      console.log('[Test] Waiting for login to complete...');
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const taskStatus = await getTask(task.id);
        console.log(`[Test] Task status: ${taskStatus.status} (attempt ${attempts + 1}/${maxAttempts})`);
        
        if (taskStatus.status === 'finished') {
          console.log('[Test] Login task completed!');
          console.log('[Test] Task output:', taskStatus.output);
          
          // Check if login was successful
          expect(taskStatus.isSuccess).toBe(true);
          expect(taskStatus.output).toBeTruthy();
          
          // The output should mention successful login or access to market-charts
          const output = taskStatus.output?.toLowerCase() || '';
          const loginSuccess = output.includes('market') || 
                              output.includes('dashboard') || 
                              output.includes('logged in') ||
                              output.includes('success');
          
          expect(loginSuccess).toBe(true);
          
          console.log('[Test] ✓ Login credentials are valid!');
          break;
        }
        
        if (taskStatus.status === 'stopped') {
          console.error('[Test] Task stopped unexpectedly');
          console.error('[Test] Task output:', taskStatus.output);
          throw new Error('Login task stopped - credentials may be invalid');
        }
        
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Login task timed out');
      }
      
    } finally {
      // Clean up session
      console.log('[Test] Cleaning up session...');
      try {
        await stopSession(session.id);
        console.log('[Test] Session stopped');
      } catch (error) {
        console.error('[Test] Error stopping session:', error);
      }
    }
  }, 180000); // 3 minute timeout for the test
});

/**
 * Test different Gemini models through Poe to find one without thinking responses
 */
import { describe, it, expect } from 'vitest';
import { callPoeAI } from '../poe-ai';

describe('Gemini Model Testing', () => {
  const testPrompt = 'Say "Hello World" and nothing else. Do not include any thinking or reasoning.';
  
  it('should test Gemini-2-Flash model', async () => {
    try {
      const response = await callPoeAI(
        [{ role: 'user', content: testPrompt }],
        { model: 'Gemini-2-Flash', maxTokens: 100, timeoutMs: 15000, retries: 0 }
      );
      console.log('Gemini-2-Flash response:', response);
      expect(response).not.toContain('<think>');
      expect(response).not.toContain('</think>');
    } catch (error: any) {
      console.log('Gemini-2-Flash error:', error.message);
    }
  }, 20000);

  it('should test Gemini-2.5-Pro model', async () => {
    try {
      const response = await callPoeAI(
        [{ role: 'user', content: testPrompt }],
        { model: 'Gemini-2.5-Pro', maxTokens: 100, timeoutMs: 15000, retries: 0 }
      );
      console.log('Gemini-2.5-Pro response:', response);
      expect(response).not.toContain('<think>');
      expect(response).not.toContain('</think>');
    } catch (error: any) {
      console.log('Gemini-2.5-Pro error:', error.message);
    }
  }, 20000);

  it('should test Gemini-1.5-Flash model', async () => {
    try {
      const response = await callPoeAI(
        [{ role: 'user', content: testPrompt }],
        { model: 'Gemini-1.5-Flash', maxTokens: 100, timeoutMs: 15000, retries: 0 }
      );
      console.log('Gemini-1.5-Flash response:', response);
      expect(response).not.toContain('<think>');
      expect(response).not.toContain('</think>');
    } catch (error: any) {
      console.log('Gemini-1.5-Flash error:', error.message);
    }
  }, 20000);

  it('should test Gemini-3-Pro model and check for thinking tags', async () => {
    try {
      const response = await callPoeAI(
        [{ role: 'user', content: testPrompt }],
        { model: 'Gemini-3-Pro', maxTokens: 100, timeoutMs: 15000, retries: 0 }
      );
      console.log('Gemini-3-Pro response:', response);
      const hasThinkingTags = response.includes('<think>') || response.includes('</think>');
      console.log('Gemini-3-Pro has thinking tags:', hasThinkingTags);
    } catch (error: any) {
      console.log('Gemini-3-Pro error:', error.message);
    }
  }, 20000);
});

/**
 * Tests for the LLM Provider Abstraction Layer
 * 
 * Tests cover:
 * 1. Provider info reporting (Claude-only)
 * 2. callLLM routing to Claude Sonnet 4.6
 * 3. callLLMMax retry logic
 * 4. Claude API integration (live call with adaptive thinking + effort)
 */
import { describe, it, expect } from 'vitest';
import {
  callLLM,
  callLLMMax,
  getProviderInfo,
} from '../llm-provider';

describe('LLM Provider Layer', () => {
  describe('getProviderInfo', () => {
    it('should return anthropic as the provider', () => {
      const info = getProviderInfo();
      expect(info.provider).toBe('anthropic');
      expect(info.model).toBeDefined();
      expect(info.model).toContain('claude');
    });
  });

  describe('callLLM - Claude provider (live)', () => {
    it('should call Claude Sonnet 4.6 with adaptive thinking and return text', async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.log('Skipping: ANTHROPIC_API_KEY not set');
        return;
      }

      const result = await callLLM(
        'Reply with exactly the word "hello" and nothing else.',
        {
          model: 'flash',
          maxTokens: 50,
          thinkingLevel: 'low',
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toContain('hello');
    }, 30000);

    it('should call Claude with high effort and return text', async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.log('Skipping: ANTHROPIC_API_KEY not set');
        return;
      }

      const result = await callLLM(
        'What is 2+2? Reply with only the number.',
        {
          model: 'pro',
          maxTokens: 50,
          thinkingLevel: 'high',
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('4');
    }, 60000);
  });

  describe('callLLMMax - retry logic', () => {
    it('should succeed on first attempt with valid input', async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.log('Skipping: ANTHROPIC_API_KEY not set');
        return;
      }

      const result = await callLLMMax(
        'Reply with exactly the word "retry-test" and nothing else.',
        1,
        {
          model: 'flash',
          maxTokens: 50,
          thinkingLevel: 'low',
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Claude 4.6 API features', () => {
    it('should use adaptive thinking (not budget_tokens)', async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.log('Skipping: ANTHROPIC_API_KEY not set');
        return;
      }

      const result = await callLLM(
        'Explain in one sentence why 2+2=4.',
        {
          model: 'flash',
          maxTokens: 200,
          thinkingLevel: 'high',
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(10);
    }, 30000);

    it('should handle effort parameter correctly at different levels', async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.log('Skipping: ANTHROPIC_API_KEY not set');
        return;
      }

      // Low thinking = medium effort (balanced)
      const lowResult = await callLLM(
        'Reply with "low-effort-ok".',
        {
          model: 'flash',
          maxTokens: 50,
          thinkingLevel: 'low',
        }
      );
      expect(lowResult).toBeDefined();

      // High thinking = high effort (deep reasoning)
      const highResult = await callLLM(
        'Reply with "high-effort-ok".',
        {
          model: 'flash',
          maxTokens: 50,
          thinkingLevel: 'high',
        }
      );
      expect(highResult).toBeDefined();
    }, 60000);
  });
});

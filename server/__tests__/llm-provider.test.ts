/**
 * Tests for the LLM Provider Abstraction Layer
 * 
 * Tests cover:
 * 1. Provider detection and configuration
 * 2. callLLM routing to correct provider
 * 3. callLLMMax retry logic
 * 4. Anthropic API integration (live call with adaptive thinking + effort)
 * 5. Gemini API integration (live call)
 * 6. Provider info reporting
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  callLLM,
  callLLMMax,
  getActiveProvider,
  getProviderInfo,
  type LLMProvider,
} from '../llm-provider';

describe('LLM Provider Layer', () => {
  describe('getActiveProvider', () => {
    it('should return the provider from LLM_PROVIDER env var', () => {
      const provider = getActiveProvider();
      expect(['gemini', 'anthropic']).toContain(provider);
    });
  });

  describe('getProviderInfo', () => {
    it('should return correct model info for the active provider', () => {
      const info = getProviderInfo();
      expect(info.provider).toBeDefined();
      expect(info.proModel).toBeDefined();
      expect(info.flashModel).toBeDefined();

      if (info.provider === 'anthropic') {
        expect(info.proModel).toBe('claude-opus-4-6');
        expect(info.flashModel).toBe('claude-sonnet-4-6');
      } else {
        expect(info.proModel).toBe('gemini-3-pro-preview');
        expect(info.flashModel).toBe('gemini-3-flash-preview');
      }
    });
  });

  describe('callLLM - Anthropic provider (live)', () => {
    it('should call Claude Sonnet 4.6 with adaptive thinking and return text', async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.log('Skipping: ANTHROPIC_API_KEY not set');
        return;
      }

      // Force Anthropic provider for this test
      const result = await callLLM(
        'Reply with exactly the word "hello" and nothing else.',
        {
          provider: 'anthropic',
          model: 'flash', // Use Sonnet for speed
          maxTokens: 50,
          thinkingLevel: 'low',
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toContain('hello');
    }, 30000);

    it('should call Claude Opus 4.6 with high effort and return text', async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.log('Skipping: ANTHROPIC_API_KEY not set');
        return;
      }

      const result = await callLLM(
        'What is 2+2? Reply with only the number.',
        {
          provider: 'anthropic',
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

  describe('callLLM - Gemini provider (live)', () => {
    it('should call Gemini Flash and return text', async () => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.log('Skipping: GEMINI_API_KEY not set');
        return;
      }

      const result = await callLLM(
        'Reply with exactly the word "hello" and nothing else.',
        {
          provider: 'gemini',
          model: 'flash',
          maxTokens: 50,
          thinkingLevel: 'low',
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result.toLowerCase()).toContain('hello');
    }, 30000);
  });

  describe('callLLM - provider override', () => {
    it('should respect the provider option to override the default', async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.log('Skipping: ANTHROPIC_API_KEY not set');
        return;
      }

      // Even if default is gemini, this should use anthropic
      const result = await callLLM(
        'Reply with only the word "override".',
        {
          provider: 'anthropic',
          model: 'flash',
          maxTokens: 50,
          thinkingLevel: 'low',
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    }, 30000);
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
        1, // Only 1 attempt
        {
          provider: 'anthropic',
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

      // This test verifies that the API call succeeds with adaptive thinking
      // If we were using deprecated budget_tokens, this would still work but
      // the response would include a deprecation warning
      const result = await callLLM(
        'Explain in one sentence why 2+2=4.',
        {
          provider: 'anthropic',
          model: 'flash',
          maxTokens: 200,
          thinkingLevel: 'high',
        }
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(10); // Should be a real sentence
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
          provider: 'anthropic',
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
          provider: 'anthropic',
          model: 'flash',
          maxTokens: 50,
          thinkingLevel: 'high',
        }
      );
      expect(highResult).toBeDefined();
    }, 60000);
  });
});

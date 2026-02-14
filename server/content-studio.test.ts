/**
 * Content Studio — Unit Tests
 *
 * Tests the script generation service, format specs, content pillars,
 * prompt building, and Gemini API integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Service-level tests ──────────────────────────────────────────────────────

describe('Content Studio Service', () => {
  describe('FORMAT_SPECS', () => {
    it('should export all 4 format specs', async () => {
      const { FORMAT_SPECS } = await import('./content-studio');
      expect(Object.keys(FORMAT_SPECS)).toEqual(['reel', 'short', 'lesson', 'deep_dive']);
    });

    it('each format should have required fields', async () => {
      const { FORMAT_SPECS } = await import('./content-studio');
      for (const [key, spec] of Object.entries(FORMAT_SPECS)) {
        expect(spec.name).toBeTruthy();
        expect(spec.durationRange).toBeTruthy();
        expect(spec.wordCount).toBeTruthy();
        expect(spec.structure).toBeTruthy();
        expect(spec.style).toBeTruthy();
        expect(typeof spec.defaultDuration).toBe('number');
        expect(spec.defaultDuration).toBeGreaterThan(0);
      }
    });

    it('reel should be 30-60 seconds', async () => {
      const { FORMAT_SPECS } = await import('./content-studio');
      expect(FORMAT_SPECS.reel.durationRange).toContain('30-60');
      expect(FORMAT_SPECS.reel.defaultDuration).toBe(45);
    });

    it('short should be 45-60 seconds', async () => {
      const { FORMAT_SPECS } = await import('./content-studio');
      expect(FORMAT_SPECS.short.durationRange).toContain('45-60');
      expect(FORMAT_SPECS.short.defaultDuration).toBe(55);
    });

    it('lesson should be 2-5 minutes', async () => {
      const { FORMAT_SPECS } = await import('./content-studio');
      expect(FORMAT_SPECS.lesson.durationRange).toContain('2-5');
      expect(FORMAT_SPECS.lesson.defaultDuration).toBe(210);
    });

    it('deep_dive should be 5-10 minutes', async () => {
      const { FORMAT_SPECS } = await import('./content-studio');
      expect(FORMAT_SPECS.deep_dive.durationRange).toContain('5-10');
      expect(FORMAT_SPECS.deep_dive.defaultDuration).toBe(420);
    });
  });

  describe('CONTENT_PILLARS', () => {
    it('should export content pillars with at least 5 categories', async () => {
      const { CONTENT_PILLARS } = await import('./content-studio');
      expect(Object.keys(CONTENT_PILLARS).length).toBeGreaterThanOrEqual(5);
    });

    it('each pillar should have at least 3 topic suggestions', async () => {
      const { CONTENT_PILLARS } = await import('./content-studio');
      for (const [pillar, topics] of Object.entries(CONTENT_PILLARS)) {
        expect(Array.isArray(topics)).toBe(true);
        expect(topics.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('should include core STR content pillars', async () => {
      const { CONTENT_PILLARS } = await import('./content-studio');
      const pillarNames = Object.keys(CONTENT_PILLARS);
      expect(pillarNames).toContain('Arbitrage Fundamentals');
      expect(pillarNames).toContain('Market Analysis');
      expect(pillarNames).toContain('Regulations');
      expect(pillarNames).toContain('Deal Evaluation');
    });
  });

  describe('generateContentScript', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('should throw if GEMINI_API_KEY is not set', async () => {
      // Temporarily override ENV.geminiApiKey
      const { ENV } = await import('./_core/env');
      const original = ENV.geminiApiKey;
      (ENV as any).geminiApiKey = '';
      try {
        const { generateContentScript } = await import('./content-studio');
        await expect(
          generateContentScript('test topic', 'reel'),
        ).rejects.toThrow(/GEMINI_API_KEY/i);
      } finally {
        (ENV as any).geminiApiKey = original;
      }
    });

    it('should throw for invalid format', async () => {
      const { generateContentScript } = await import('./content-studio');
      await expect(
        generateContentScript('test topic', 'invalid_format'),
      ).rejects.toThrow(/Invalid format/);
    });

    it('should call Gemini API with correct URL and body structure', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'Test Title',
                    hook: 'Test hook line',
                    script: 'Full test script content',
                    cta: 'Go to the tool now',
                    estimated_duration_seconds: 45,
                    key_data_points: ['$5,000/month', '73% occupancy'],
                    target_audience: 'New Airbnb hosts',
                  }),
                },
              ],
            },
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { generateContentScript } = await import('./content-studio');
      const result = await generateContentScript('How to start Airbnb', 'reel');

      // Verify fetch was called
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (globalThis.fetch as any).mock.calls[0];

      // Verify URL structure
      expect(url).toContain('generateContent');
      expect(url).toContain('key=');

      // Verify body structure
      const body = JSON.parse(options.body);
      expect(body.contents).toBeDefined();
      expect(body.systemInstruction).toBeDefined();
      expect(body.generationConfig).toBeDefined();
      expect(body.generationConfig.responseMimeType).toBe('application/json');
      expect(body.generationConfig.temperature).toBe(0.9);

      // Verify result
      expect(result.title).toBe('Test Title');
      expect(result.hook).toBe('Test hook line');
      expect(result.script).toBe('Full test script content');
      expect(result.cta).toBe('Go to the tool now');
      expect(result.estimated_duration_seconds).toBe(45);
      expect(result.key_data_points).toEqual(['$5,000/month', '73% occupancy']);
      expect(result.target_audience).toBe('New Airbnb hosts');
    });

    it('should include market data in system prompt when provided', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'Denver Market Analysis',
                    hook: 'Denver is booming',
                    script: 'Full script about Denver',
                    cta: 'Check it out',
                    estimated_duration_seconds: 55,
                    key_data_points: ['$128K annual revenue'],
                    target_audience: 'Investors',
                  }),
                },
              ],
            },
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { generateContentScript } = await import('./content-studio');
      await generateContentScript(
        'Denver market analysis',
        'short',
        'Denver CO: Average revenue $128K, ADR $480, Occupancy 73%',
      );

      const [, options] = (globalThis.fetch as any).mock.calls[0];
      const body = JSON.parse(options.body);
      const systemPrompt = body.systemInstruction.parts[0].text;

      expect(systemPrompt).toContain('LIVE MARKET DATA');
      expect(systemPrompt).toContain('Denver CO');
      expect(systemPrompt).toContain('$128K');
    });

    it('should handle Gemini API error responses', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded'),
      });

      const { generateContentScript } = await import('./content-studio');
      await expect(
        generateContentScript('test', 'reel'),
      ).rejects.toThrow(/Gemini API error \(429\)/);
    });

    it('should handle empty Gemini response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ candidates: [] }),
      });

      const { generateContentScript } = await import('./content-studio');
      await expect(
        generateContentScript('test', 'reel'),
      ).rejects.toThrow(/empty response/i);
    });

    it('should handle malformed JSON from Gemini', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              { content: { parts: [{ text: 'not valid json at all' }] } },
            ],
          }),
      });

      const { generateContentScript } = await import('./content-studio');
      await expect(
        generateContentScript('test', 'reel'),
      ).rejects.toThrow(/Failed to parse/);
    });

    it('should strip markdown code fences from Gemini response', async () => {
      const jsonContent = JSON.stringify({
        title: 'Fenced Title',
        hook: 'Fenced hook',
        script: 'Fenced script',
        cta: 'Fenced CTA',
        estimated_duration_seconds: 30,
        key_data_points: [],
        target_audience: 'Everyone',
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: '```json\n' + jsonContent + '\n```' }],
                },
              },
            ],
          }),
      });

      const { generateContentScript } = await import('./content-studio');
      const result = await generateContentScript('test', 'reel');
      expect(result.title).toBe('Fenced Title');
    });

    it('should include Coach Inayah persona in system prompt', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'T',
                    hook: 'H',
                    script: 'S',
                    cta: 'C',
                    estimated_duration_seconds: 45,
                    key_data_points: [],
                    target_audience: '',
                  }),
                },
              ],
            },
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { generateContentScript } = await import('./content-studio');
      await generateContentScript('test', 'reel');

      const [, options] = (globalThis.fetch as any).mock.calls[0];
      const body = JSON.parse(options.body);
      const systemPrompt = body.systemInstruction.parts[0].text;

      // Verify persona elements
      expect(systemPrompt).toContain('Coach Inayah');
      expect(systemPrompt).toContain('coachinayahturnkeytool.com');
      expect(systemPrompt).toContain('THIRD-GRADE');
      expect(systemPrompt).toContain('Never mention "AirDNA"');
    });

    it('should include format-specific instructions in user prompt', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: 'T',
                    hook: 'H',
                    script: 'S',
                    cta: 'C',
                    estimated_duration_seconds: 210,
                    key_data_points: [],
                    target_audience: '',
                  }),
                },
              ],
            },
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { generateContentScript } = await import('./content-studio');
      await generateContentScript('market analysis tips', 'lesson');

      const [, options] = (globalThis.fetch as any).mock.calls[0];
      const body = JSON.parse(options.body);
      const userPrompt = body.contents[0].parts[0].text;

      expect(userPrompt).toContain('YouTube Lesson');
      expect(userPrompt).toContain('300-750 words');
      expect(userPrompt).toContain('market analysis tips');
    });

    it('should handle missing optional fields in response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        title: 'Minimal',
                        hook: 'Hook',
                        script: 'Script',
                        cta: 'CTA',
                        // Missing optional fields
                      }),
                    },
                  ],
                },
              },
            ],
          }),
      });

      const { generateContentScript } = await import('./content-studio');
      const result = await generateContentScript('test', 'reel');

      expect(result.title).toBe('Minimal');
      expect(result.estimated_duration_seconds).toBe(45); // Falls back to default
      expect(result.key_data_points).toEqual([]);
      expect(result.target_audience).toBe('');
    });
  });
});

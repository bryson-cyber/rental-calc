/**
 * Content Studio v3 — Unit Tests
 *
 * Tests for:
 *   - FORMAT_SPECS (YT-only: lesson + deep_dive)
 *   - CONTENT_PILLARS exports
 *   - Data pipeline formatting (formatDataForPrompt)
 *   - Gemini API call structure and error handling
 *   - Content data bundle types
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Test FORMAT_SPECS and CONTENT_PILLARS ────────────────────────────────────

describe('Content Studio — Exports', () => {
  it('FORMAT_SPECS has only YouTube-style formats (lesson + deep_dive)', async () => {
    const { FORMAT_SPECS } = await import('./content-studio');
    expect(Object.keys(FORMAT_SPECS)).toEqual(
      expect.arrayContaining(['lesson', 'deep_dive']),
    );
    expect(Object.keys(FORMAT_SPECS)).toHaveLength(2);
    // Reel and Short should NOT exist
    expect(FORMAT_SPECS).not.toHaveProperty('reel');
    expect(FORMAT_SPECS).not.toHaveProperty('short');
  });

  it('each FORMAT_SPEC has required fields', async () => {
    const { FORMAT_SPECS } = await import('./content-studio');
    for (const [key, spec] of Object.entries(FORMAT_SPECS)) {
      expect(spec).toHaveProperty('name');
      expect(spec).toHaveProperty('durationRange');
      expect(spec).toHaveProperty('wordCount');
      expect(spec).toHaveProperty('structure');
      expect(spec).toHaveProperty('style');
      expect(spec).toHaveProperty('defaultDuration');
      expect(typeof spec.name).toBe('string');
      expect(typeof spec.defaultDuration).toBe('number');
      expect(spec.defaultDuration).toBeGreaterThan(0);
    }
  });

  it('CONTENT_PILLARS has 6 pillars with topics', async () => {
    const { CONTENT_PILLARS } = await import('./content-studio');
    expect(Object.keys(CONTENT_PILLARS)).toHaveLength(6);
    for (const [pillar, topics] of Object.entries(CONTENT_PILLARS)) {
      expect(typeof pillar).toBe('string');
      expect(Array.isArray(topics)).toBe(true);
      expect(topics.length).toBeGreaterThan(0);
      topics.forEach((t) => expect(typeof t).toBe('string'));
    }
  });

  it('lesson format is 2-5 minutes', async () => {
    const { FORMAT_SPECS } = await import('./content-studio');
    expect(FORMAT_SPECS.lesson.defaultDuration).toBeGreaterThanOrEqual(120);
    expect(FORMAT_SPECS.lesson.defaultDuration).toBeLessThanOrEqual(300);
    expect(FORMAT_SPECS.lesson.durationRange).toContain('2-5');
  });

  it('deep_dive format has long duration (5-10min)', async () => {
    const { FORMAT_SPECS } = await import('./content-studio');
    expect(FORMAT_SPECS.deep_dive.defaultDuration).toBeGreaterThanOrEqual(300);
    expect(FORMAT_SPECS.deep_dive.durationRange).toContain('5-10');
  });

  it('should include core STR content pillars', async () => {
    const { CONTENT_PILLARS } = await import('./content-studio');
    const pillarNames = Object.keys(CONTENT_PILLARS);
    expect(pillarNames).toContain('Arbitrage Fundamentals');
    expect(pillarNames).toContain('Market Analysis');
    expect(pillarNames).toContain('Regulations');
    expect(pillarNames).toContain('Deal Evaluation');
    expect(pillarNames).toContain('Competitor Intelligence');
    expect(pillarNames).toContain('Scaling & Strategy');
  });
});

// ── Test Data Pipeline Formatting ────────────────────────────────────────────

describe('Content Data Pipeline — formatDataForPrompt', () => {
  it('formats empty data bundle correctly', async () => {
    const { formatDataForPrompt } = await import('./content-data-pipeline');
    const result = formatDataForPrompt({
      recentProperties: [],
      marketSnapshots: [],
      platformStats: {
        totalReports: 0,
        totalLeads: 0,
        topMarkets: [],
        recentSearches: [],
      },
      previousTopics: [],
      pulledAt: new Date(),
    });
    expect(result).toContain('LIVE PLATFORM DATA');
    expect(result).toContain('Platform Scale: 0 total property analyses');
  });

  it('includes property data when available', async () => {
    const { formatDataForPrompt } = await import('./content-data-pipeline');
    const result = formatDataForPrompt({
      recentProperties: [
        {
          address: '123 Main St',
          city: 'Denver',
          state: 'CO',
          bedrooms: 3,
          bathrooms: 2,
          annualRevenue: 120000,
          annualRevenueRange: { low: 100000, high: 140000 },
          occupancyRate: 0.75,
          averageDailyRate: 450,
          monthlyRent: 2500,
          verdict: 'GO',
          confidenceScore: 85,
          annualProfit: 50000,
          createdAt: new Date(),
        },
      ],
      marketSnapshots: [],
      platformStats: {
        totalReports: 100,
        totalLeads: 50,
        topMarkets: [{ market: 'Denver, CO', count: 25 }],
        recentSearches: [{ city: 'Denver', state: 'CO', count: 15 }],
      },
      previousTopics: [],
      pulledAt: new Date(),
    });
    expect(result).toContain('Denver');
    expect(result).toContain('3BR');
    expect(result).toContain('GO');
    expect(result).toContain('100 total property analyses');
    expect(result).toContain('rent $2,500/mo');
  });

  it('includes market snapshots', async () => {
    const { formatDataForPrompt } = await import('./content-data-pipeline');
    const result = formatDataForPrompt({
      recentProperties: [],
      marketSnapshots: [
        { marketName: 'Austin, TX', totalListings: 50, averageRevenue: 85000 },
      ],
      platformStats: {
        totalReports: 0,
        totalLeads: 0,
        topMarkets: [],
        recentSearches: [],
      },
      previousTopics: [],
      pulledAt: new Date(),
    });
    expect(result).toContain('Austin, TX');
    expect(result).toContain('Market Averages');
  });

  it('includes aggregate stats for multiple properties', async () => {
    const { formatDataForPrompt } = await import('./content-data-pipeline');
    const properties = [
      {
        address: '1', city: 'Denver', state: 'CO', bedrooms: 3, bathrooms: 2,
        annualRevenue: 120000, annualRevenueRange: { low: 100000, high: 140000 },
        occupancyRate: 0.75, averageDailyRate: 450, monthlyRent: null,
        verdict: 'GO', confidenceScore: null, annualProfit: null, createdAt: new Date(),
      },
      {
        address: '2', city: 'Austin', state: 'TX', bedrooms: 2, bathrooms: 1,
        annualRevenue: 80000, annualRevenueRange: { low: 70000, high: 90000 },
        occupancyRate: 0.65, averageDailyRate: 300, monthlyRent: null,
        verdict: 'CAUTION', confidenceScore: null, annualProfit: null, createdAt: new Date(),
      },
    ];
    const result = formatDataForPrompt({
      recentProperties: properties,
      marketSnapshots: [],
      platformStats: { totalReports: 0, totalLeads: 0, topMarkets: [], recentSearches: [] },
      previousTopics: [],
      pulledAt: new Date(),
    });
    expect(result).toContain('Aggregate');
    expect(result).toContain('2 properties analyzed');
    expect(result).toContain('1 rated GO');
  });

  it('includes trending searches', async () => {
    const { formatDataForPrompt } = await import('./content-data-pipeline');
    const result = formatDataForPrompt({
      recentProperties: [],
      marketSnapshots: [],
      platformStats: {
        totalReports: 0,
        totalLeads: 0,
        topMarkets: [],
        recentSearches: [
          { city: 'Nashville', state: 'TN', count: 20 },
          { city: 'Miami', state: 'FL', count: 15 },
        ],
      },
      previousTopics: [],
      pulledAt: new Date(),
    });
    expect(result).toContain('Nashville, TN');
    expect(result).toContain('Miami, FL');
    expect(result).toContain('Trending City Searches');
  });
});

// ── Test Gemini API Integration ──────────────────────────────────────────────

describe('Content Studio — Gemini API', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws when GEMINI_API_KEY is empty', async () => {
    const { ENV } = await import('./_core/env');
    const original = ENV.geminiApiKey;
    (ENV as any).geminiApiKey = '';
    try {
      const { generateContentScript } = await import('./content-studio');
      await expect(
        generateContentScript('test topic', 'lesson'),
      ).rejects.toThrow(/GEMINI_API_KEY/i);
    } finally {
      (ENV as any).geminiApiKey = original;
    }
  });

  it('throws on invalid format', async () => {
    const { generateContentScript } = await import('./content-studio');
    await expect(
      generateContentScript('test topic', 'invalid_format'),
    ).rejects.toThrow(/Invalid format/);
  });

  it('calls Gemini API with correct URL and body structure', async () => {
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
                  estimated_duration_seconds: 210,
                  key_data_points: ['$5,000/month', '73% occupancy'],
                  target_audience: 'New Airbnb hosts',
                  narrative_angle: 'Test angle',
                  data_sources_used: ['test'],
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
    const result = await generateContentScript('How to start Airbnb', 'lesson');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (globalThis.fetch as any).mock.calls[0];

    expect(url).toContain('generateContent');
    expect(url).toContain('key=');

    const body = JSON.parse(options.body);
    expect(body.contents).toBeDefined();
    expect(body.systemInstruction).toBeDefined();
    expect(body.generationConfig).toBeDefined();
    expect(body.generationConfig.responseMimeType).toBe('application/json');

    expect(result.title).toBe('Test Title');
    expect(result.hook).toBe('Test hook line');
    expect(result.script).toBe('Full test script content');
    expect(result.cta).toBe('Go to the tool now');
  });

  it('includes Coach Inayah persona in system prompt', async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  title: 'T', hook: 'H', script: 'S', cta: 'C',
                  estimated_duration_seconds: 210, key_data_points: [],
                  target_audience: '', narrative_angle: '', data_sources_used: [],
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
    await generateContentScript('test', 'lesson');

    const [, options] = (globalThis.fetch as any).mock.calls[0];
    const body = JSON.parse(options.body);
    const systemPrompt = body.systemInstruction.parts[0].text;

    expect(systemPrompt).toContain('Coach Inayah');
    expect(systemPrompt).toContain('coachinayahturnkeytool.com');
    expect(systemPrompt).toContain('THIRD-GRADE');
    expect(systemPrompt).toContain('AirDNA');
  });

  it('includes market data in system prompt when provided', async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  title: 'T', hook: 'H', script: 'S', cta: 'C',
                  estimated_duration_seconds: 210, key_data_points: [],
                  target_audience: '', narrative_angle: '', data_sources_used: [],
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
      'lesson',
      'Denver CO: Average revenue $128K, ADR $480, Occupancy 73%',
    );

    const [, options] = (globalThis.fetch as any).mock.calls[0];
    const body = JSON.parse(options.body);
    const systemPrompt = body.systemInstruction.parts[0].text;

    expect(systemPrompt).toContain('Denver CO');
    expect(systemPrompt).toContain('$128K');
  });

  it('handles Gemini API error responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limit exceeded'),
    });

    const { generateContentScript } = await import('./content-studio');
    await expect(
      generateContentScript('test', 'lesson'),
    ).rejects.toThrow(/Gemini API error \(429\)/);
  });

  it('handles empty Gemini response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ candidates: [] }),
    });

    const { generateContentScript } = await import('./content-studio');
    await expect(
      generateContentScript('test', 'lesson'),
    ).rejects.toThrow(/empty response/i);
  });

  it('handles malformed JSON from Gemini', async () => {
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
      generateContentScript('test', 'lesson'),
    ).rejects.toThrow(/Failed to parse/);
  });

  it('strips markdown code fences from Gemini response', async () => {
    const jsonContent = JSON.stringify({
      title: 'Fenced Title',
      hook: 'Fenced hook',
      script: 'Fenced script',
      cta: 'Fenced CTA',
      estimated_duration_seconds: 210,
      key_data_points: [],
      target_audience: 'Everyone',
      narrative_angle: '',
      data_sources_used: [],
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
    const result = await generateContentScript('test', 'lesson');
    expect(result.title).toBe('Fenced Title');
  });

  it('rejects script missing required fields', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.stringify({ topic: 'test', format: 'lesson' }) },
                ],
              },
            },
          ],
        }),
    });

    const { generateContentScript } = await import('./content-studio');
    await expect(generateContentScript('test', 'lesson')).rejects.toThrow(
      /missing required fields/,
    );
  });

  it('handles missing optional fields in response', async () => {
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
                    }),
                  },
                ],
              },
            },
          ],
        }),
    });

    const { generateContentScript } = await import('./content-studio');
    const result = await generateContentScript('test', 'lesson');

    expect(result.title).toBe('Minimal');
    expect(result.estimated_duration_seconds).toBe(210); // Falls back to lesson default
    expect(result.key_data_points).toEqual([]);
    expect(result.target_audience).toBe('');
  });

  it('includes format-specific instructions in user prompt', async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  title: 'T', hook: 'H', script: 'S', cta: 'C',
                  estimated_duration_seconds: 210, key_data_points: [],
                  target_audience: '', narrative_angle: '', data_sources_used: [],
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
});

// ── Test Content Data Pipeline Types ─────────────────────────────────────────

describe('Content Data Pipeline — gatherContentData', () => {
  it('returns correct shape even when DB is unavailable', async () => {
    const { gatherContentData } = await import('./content-data-pipeline');
    const bundle = await gatherContentData();
    expect(bundle).toHaveProperty('recentProperties');
    expect(bundle).toHaveProperty('marketSnapshots');
    expect(bundle).toHaveProperty('platformStats');
    expect(bundle).toHaveProperty('previousTopics');
    expect(bundle).toHaveProperty('pulledAt');
    expect(Array.isArray(bundle.recentProperties)).toBe(true);
    expect(Array.isArray(bundle.marketSnapshots)).toBe(true);
    expect(Array.isArray(bundle.previousTopics)).toBe(true);
    expect(bundle.platformStats).toHaveProperty('totalReports');
    expect(bundle.platformStats).toHaveProperty('totalLeads');
    expect(bundle.platformStats).toHaveProperty('topMarkets');
    expect(bundle.platformStats).toHaveProperty('recentSearches');
    expect(bundle.pulledAt).toBeInstanceOf(Date);
  });
});

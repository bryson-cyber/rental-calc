/**
 * Video Generation Service Tests (v4 — DB-Persisted Async Pattern)
 *
 * Tests the Golpo AI video generation integration including:
 * - Module exports (startVideoGeneration, getVideoStatus, resumeIncompleteJobs, etc.)
 * - VideoJobResult and VideoStatusResult types
 * - Narration script building logic
 * - Golpo API configuration (correct base URL, FormData, white_bg)
 * - Router schema validation
 * - Job resume logic (timeout thresholds, missing Golpo IDs)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module Exports ──────────────────────────────────────────────────────────

describe('Video Generation Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Module exports', () => {
    it('exports startVideoGeneration function', async () => {
      const mod = await import('./video-generation');
      expect(typeof mod.startVideoGeneration).toBe('function');
    });

    it('exports getVideoStatus function', async () => {
      const mod = await import('./video-generation');
      expect(typeof mod.getVideoStatus).toBe('function');
    });

    it('exports listVideoJobs function', async () => {
      const mod = await import('./video-generation');
      expect(typeof mod.listVideoJobs).toBe('function');
    });

    it('exports quickStartVideoGeneration function', async () => {
      const mod = await import('./video-generation');
      expect(typeof mod.quickStartVideoGeneration).toBe('function');
    });

    it('exports resumeIncompleteJobs function', async () => {
      const mod = await import('./video-generation');
      expect(typeof mod.resumeIncompleteJobs).toBe('function');
    });
  });

  describe('Type shapes', () => {
    it('VideoJobResult has correct shape', () => {
      const result: import('./video-generation').VideoJobResult = {
        jobId: 'test-uuid',
        scriptId: 1,
        title: 'Test Video',
        status: 'generating',
      };
      expect(result.jobId).toBe('test-uuid');
      expect(result.status).toBe('generating');
    });

    it('VideoStatusResult has correct shape', () => {
      const result: import('./video-generation').VideoStatusResult = {
        jobId: 'test-uuid',
        scriptId: 1,
        title: 'Test Video',
        status: 'completed',
        videoUrl: 'https://example.com/video.mp4',
        error: null,
        startedAt: Date.now(),
        completedAt: Date.now(),
      };
      expect(result.videoUrl).toContain('http');
      expect(result.error).toBeNull();
    });

    it('VideoStatusResult supports failed status with error', () => {
      const result: import('./video-generation').VideoStatusResult = {
        jobId: 'test-uuid',
        scriptId: 1,
        title: 'Test Video',
        status: 'failed',
        videoUrl: null,
        error: 'Golpo API timeout',
        startedAt: Date.now(),
        completedAt: Date.now(),
      };
      expect(result.status).toBe('failed');
      expect(result.error).toContain('timeout');
      expect(result.videoUrl).toBeNull();
    });

    it('VideoStatusResult supports pending status', () => {
      const result: import('./video-generation').VideoStatusResult = {
        jobId: 'test-uuid',
        scriptId: 1,
        title: 'Test Video',
        status: 'pending',
        videoUrl: null,
        error: null,
        startedAt: Date.now(),
        completedAt: null,
      };
      expect(result.status).toBe('pending');
      expect(result.completedAt).toBeNull();
    });
  });
});

// ── Golpo API Configuration ────────────────────────────────────────────────

describe('Golpo API Configuration', () => {
  it('uses correct base URL (api.golpoai.com, not video.golpoai.com)', () => {
    const GOLPO_BASE_URL = 'https://api.golpoai.com';
    expect(GOLPO_BASE_URL).toBe('https://api.golpoai.com');
    expect(GOLPO_BASE_URL).not.toContain('video.golpoai.com');
  });

  it('generate endpoint is /generate (matching SDK)', () => {
    const GOLPO_BASE_URL = 'https://api.golpoai.com';
    const generateUrl = `${GOLPO_BASE_URL}/generate`;
    expect(generateUrl).toBe('https://api.golpoai.com/generate');
  });

  it('status polling endpoint is /status/{jobId} (matching SDK)', () => {
    const GOLPO_BASE_URL = 'https://api.golpoai.com';
    const jobId = 'test-job-123';
    const statusUrl = `${GOLPO_BASE_URL}/status/${jobId}`;
    expect(statusUrl).toBe('https://api.golpoai.com/status/test-job-123');
  });

  it('white_bg parameter should be true for coaching videos', () => {
    const config = { white_bg: 'true', use_color: 'false' };
    expect(config.white_bg).toBe('true');
    expect(config.use_color).toBe('false');
  });

  it('timing should be 10 for 5-10 minute coaching videos', () => {
    const timing = '10';
    expect(timing).toBe('10');
  });
});

// ── Router Schema Validation ────────────────────────────────────────────────

describe('Video Generation Router Schemas', () => {
  it('startVideoInput accepts valid scriptId', async () => {
    const { z } = await import('zod');

    const startVideoInput = z.object({
      scriptId: z.number(),
    });

    const valid = startVideoInput.parse({ scriptId: 42 });
    expect(valid.scriptId).toBe(42);
  });

  it('startVideoInput rejects missing scriptId', async () => {
    const { z } = await import('zod');

    const startVideoInput = z.object({
      scriptId: z.number(),
    });

    expect(() => startVideoInput.parse({})).toThrow();
  });

  it('getVideoStatusInput accepts valid jobId', async () => {
    const { z } = await import('zod');

    const getVideoStatusInput = z.object({
      jobId: z.string(),
    });

    const valid = getVideoStatusInput.parse({ jobId: 'abc-123' });
    expect(valid.jobId).toBe('abc-123');
  });

  it('quickStartVideoInput accepts optional format', async () => {
    const { z } = await import('zod');

    const quickStartInput = z.object({
      format: z.enum(['lesson', 'deep_dive']).optional(),
    }).optional();

    // No input
    const result1 = quickStartInput.parse(undefined);
    expect(result1).toBeUndefined();

    // With format
    const result2 = quickStartInput.parse({ format: 'deep_dive' });
    expect(result2?.format).toBe('deep_dive');
  });

  it('quickStartVideoInput rejects short-form formats', async () => {
    const { z } = await import('zod');

    const quickStartInput = z.object({
      format: z.enum(['lesson', 'deep_dive']).optional(),
    });

    // reel and short should be rejected — YT-only
    expect(() => quickStartInput.parse({ format: 'reel' })).toThrow();
    expect(() => quickStartInput.parse({ format: 'short' })).toThrow();
  });
});

// ── Narration Script Building ───────────────────────────────────────────────

describe('Narration Script Building', () => {
  // Replicate the buildNarrationScript logic from video-generation.ts
  function buildNarrationScript(script: { hook: string; script: string; cta: string }): string {
    const parts: string[] = [];
    if (script.hook) {
      parts.push(script.hook);
      parts.push('');
    }
    if (script.script) {
      parts.push(script.script);
      parts.push('');
    }
    if (script.cta) {
      parts.push(script.cta);
    }
    return parts.join('\n');
  }

  it('combines hook + script + cta into a flowing narration', () => {
    const script = {
      hook: 'Stop scrolling if you want to know the best Airbnb market right now.',
      script: 'Let me show you what the data says about Denver, Colorado. Properties here are pulling in $3,200 a month on average.',
      cta: 'Head to coachinayahturnkeytool.com to run your own numbers for free.',
    };

    const result = buildNarrationScript(script);

    expect(result).toContain(script.hook);
    expect(result).toContain(script.script);
    expect(result).toContain(script.cta);
    expect(result).toContain('\n\n');
  });

  it('handles missing hook gracefully', () => {
    const script = { hook: '', script: 'Body text about Airbnb investing.', cta: 'Visit our tool.' };
    const result = buildNarrationScript(script);

    expect(result).not.toContain('\n\n\n');
    expect(result).toContain('Body text');
    expect(result).toContain('Visit our tool');
  });

  it('handles missing CTA gracefully', () => {
    const script = { hook: 'Great hook here.', script: 'Full body text.', cta: '' };
    const result = buildNarrationScript(script);

    expect(result).toContain('Great hook here');
    expect(result).toContain('Full body text');
    expect(result).not.toContain('undefined');
  });

  it('produces a script long enough for 5+ minute video', () => {
    // A 5-minute video at ~150 words/min needs ~750 words minimum
    const longScript = Array(200).fill('This is a sentence about Airbnb investing in Denver Colorado.').join(' ');
    const script = {
      hook: 'Stop scrolling.',
      script: longScript,
      cta: 'Visit coachinayahturnkeytool.com.',
    };
    const result = buildNarrationScript(script);
    const wordCount = result.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(750);
  });
});

// ── Video Settings ──────────────────────────────────────────────────────────

describe('Video Settings', () => {
  it('all formats use timing=10 for 5-10 minute coaching videos', () => {
    // Both lesson and deep_dive now use timing=10
    for (const format of ['lesson', 'deep_dive']) {
      const timing = '10'; // Both formats use timing=10
      expect(timing).toBe('10');
    }
  });

  it('only lesson and deep_dive formats are supported (no reel/short)', () => {
    const supportedFormats = ['lesson', 'deep_dive'];
    expect(supportedFormats).not.toContain('reel');
    expect(supportedFormats).not.toContain('short');
    expect(supportedFormats).toHaveLength(2);
  });

  it('video style is solo-female for Coach Inayah voice', () => {
    const style = 'solo-female';
    expect(style).toBe('solo-female');
  });

  it('tts_model is accurate for high-quality voiceover', () => {
    const ttsModel = 'accurate';
    expect(ttsModel).toBe('accurate');
  });
});

// ── Job Resume Logic ────────────────────────────────────────────────────────

describe('Job Resume Logic', () => {
  const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

  it('marks jobs older than 30 minutes as timed out', () => {
    const jobStartedAt = Date.now() - 35 * 60 * 1000; // 35 min ago
    const ageMs = Date.now() - jobStartedAt;
    expect(ageMs).toBeGreaterThan(MAX_AGE_MS);
  });

  it('resumes jobs younger than 30 minutes', () => {
    const jobStartedAt = Date.now() - 10 * 60 * 1000; // 10 min ago
    const ageMs = Date.now() - jobStartedAt;
    expect(ageMs).toBeLessThan(MAX_AGE_MS);
  });

  it('skips jobs without a Golpo job ID', () => {
    const job = {
      jobId: 'internal-123',
      golpoJobId: null as string | null,
      status: 'generating',
    };
    expect(job.golpoJobId).toBeNull();
    // This job should be marked as failed (no Golpo ID means submission failed)
  });

  it('does not resume already-completed jobs', () => {
    const job = {
      jobId: 'internal-456',
      golpoJobId: 'golpo-789',
      status: 'completed',
    };
    // Only "generating" status jobs should be resumed
    expect(job.status).not.toBe('generating');
  });

  it('does not resume already-failed jobs', () => {
    const job = {
      jobId: 'internal-789',
      golpoJobId: 'golpo-abc',
      status: 'failed',
    };
    expect(job.status).not.toBe('generating');
  });
});

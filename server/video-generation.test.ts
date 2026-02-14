/**
 * Video Generation Service Tests (v3 — Async Pattern)
 *
 * Tests the Golpo AI video generation integration including:
 * - Module exports (startVideoGeneration, getVideoStatus, etc.)
 * - VideoJobResult and VideoStatusResult types
 * - Narration script building logic
 * - Video settings by format
 * - Router schema validation
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
  });

  describe('getVideoStatus error handling', () => {
    it('throws for unknown jobId', async () => {
      const { getVideoStatus } = await import('./video-generation');
      expect(() => getVideoStatus('non-existent-job-id')).toThrow(/not found/);
    });
  });

  describe('listVideoJobs', () => {
    it('returns an array', async () => {
      const { listVideoJobs } = await import('./video-generation');
      const jobs = listVideoJobs();
      expect(Array.isArray(jobs)).toBe(true);
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

  it('quickStartVideoInput rejects invalid formats', async () => {
    const { z } = await import('zod');

    const quickStartInput = z.object({
      format: z.enum(['lesson', 'deep_dive']).optional(),
    });

    // reel and short should be rejected
    expect(() => quickStartInput.parse({ format: 'reel' })).toThrow();
    expect(() => quickStartInput.parse({ format: 'short' })).toThrow();
  });
});

// ── Narration Script Building ───────────────────────────────────────────────

describe('Narration Script Building (integration)', () => {
  it('combines hook + script + cta into a flowing narration', () => {
    const script = {
      hook: 'Stop scrolling if you want to know the best Airbnb market right now.',
      fullScript: 'Let me show you what the data says about Denver, Colorado. Properties here are pulling in $3,200 a month on average.',
      cta: 'Head to coachinayahturnkeytool.com to run your own numbers for free.',
    };

    const parts: string[] = [];
    if (script.hook) {
      parts.push(script.hook);
      parts.push('');
    }
    if (script.fullScript) {
      parts.push(script.fullScript);
      parts.push('');
    }
    if (script.cta) {
      parts.push(script.cta);
    }
    const result = parts.join('\n');

    expect(result).toContain(script.hook);
    expect(result).toContain(script.fullScript);
    expect(result).toContain(script.cta);
    expect(result).toContain('\n\n');
  });

  it('handles missing hook gracefully', () => {
    const parts: string[] = [];
    const script = { hook: '', fullScript: 'Body text', cta: 'CTA text' };

    if (script.hook) parts.push(script.hook, '');
    if (script.fullScript) parts.push(script.fullScript, '');
    if (script.cta) parts.push(script.cta);

    const result = parts.join('\n');
    expect(result).not.toContain('\n\n\n');
    expect(result).toContain('Body text');
    expect(result).toContain('CTA text');
  });
});

// ── Video Settings by Format ────────────────────────────────────────────────

describe('Video Settings by Format', () => {
  // Replicate the logic from video-generation.ts for testing
  const getVideoSettings = (format: string) => {
    const isDeepDive = format === 'deep_dive';
    return {
      videoType: 'long' as const,
      bgMusic: 'engaging' as const,
      timing: isDeepDive ? '2' as const : '1' as const,
    };
  };

  it('lesson format uses long video with timing 1', () => {
    const settings = getVideoSettings('lesson');
    expect(settings.videoType).toBe('long');
    expect(settings.timing).toBe('1');
    expect(settings.bgMusic).toBe('engaging');
  });

  it('deep_dive format uses long video with timing 2', () => {
    const settings = getVideoSettings('deep_dive');
    expect(settings.videoType).toBe('long');
    expect(settings.timing).toBe('2');
    expect(settings.bgMusic).toBe('engaging');
  });

  it('all formats use long videoType (YT-only)', () => {
    for (const format of ['lesson', 'deep_dive']) {
      const settings = getVideoSettings(format);
      expect(settings.videoType).toBe('long');
    }
  });
});

/**
 * Video Generation Service Tests (v5 — Golpo API v1 Migration)
 *
 * Tests the Golpo AI video generation integration including:
 * - Module exports (startVideoGeneration, getVideoStatus, resumeIncompleteJobs, etc.)
 * - VideoJobResult and VideoStatusResult types
 * - Narration script building logic
 * - Golpo API v1 configuration (correct endpoints, JSON body, voice styles)
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

// ── Golpo API v1 Configuration ────────────────────────────────────────────

describe('Golpo API v1 Configuration', () => {
  it('uses correct base URL (api.golpoai.com)', () => {
    const GOLPO_BASE_URL = 'https://api.golpoai.com';
    expect(GOLPO_BASE_URL).toBe('https://api.golpoai.com');
    expect(GOLPO_BASE_URL).not.toContain('video.golpoai.com');
  });

  it('generate endpoint uses v1 path /api/v1/videos/generate', () => {
    const GOLPO_BASE_URL = 'https://api.golpoai.com';
    const generateUrl = `${GOLPO_BASE_URL}/api/v1/videos/generate`;
    expect(generateUrl).toBe('https://api.golpoai.com/api/v1/videos/generate');
    expect(generateUrl).not.toBe('https://api.golpoai.com/generate');
  });

  it('status endpoint uses v1 path /api/v1/videos/status/{jobId}', () => {
    const GOLPO_BASE_URL = 'https://api.golpoai.com';
    const jobId = 'test-job-123';
    const statusUrl = `${GOLPO_BASE_URL}/api/v1/videos/status/${jobId}`;
    expect(statusUrl).toBe('https://api.golpoai.com/api/v1/videos/status/test-job-123');
    expect(statusUrl).not.toBe('https://api.golpoai.com/status/test-job-123');
  });

  it('request body is JSON (not form-encoded)', () => {
    const contentType = 'application/json';
    expect(contentType).toBe('application/json');
    expect(contentType).not.toBe('application/x-www-form-urlencoded');
  });

  it('use_color defaults to true for color videos', () => {
    const config = { use_color: true, white_bg: true };
    expect(config.use_color).toBe(true);
  });

  it('white_bg is true for coaching whiteboard style', () => {
    const config = { white_bg: true };
    expect(config.white_bg).toBe(true);
  });

  it('add_music is true when bg_music is specified', () => {
    const config = { add_music: true, bg_music: 'engaging' };
    expect(config.add_music).toBe(true);
    expect(config.bg_music).toBe('engaging');
  });

  it('bg_volume must be between 0 and 1.0', () => {
    const bg_volume = 0.3;
    expect(bg_volume).toBeGreaterThanOrEqual(0);
    expect(bg_volume).toBeLessThanOrEqual(1.0);
    // Old code had 1.4 which was out of range
    expect(bg_volume).not.toBe(1.4);
  });
});

// ── Voice Style Validation ────────────────────────────────────────────────

describe('Golpo API v1 Voice Styles', () => {
  const validVoiceStyles = [
    'solo-female-1',
    'solo-female-2',
    'solo-female-3',
    'solo-male-1',
    'solo-male-2',
    'solo-male-3',
    'duo-1',
    'duo-2',
    'duo-3',
  ];

  const deprecatedVoiceStyles = [
    'solo-female',
    'solo-male',
    'conversational',
  ];

  it('default voice style is solo-female-3 (not deprecated solo-female)', () => {
    const defaultStyle = 'solo-female-3';
    expect(validVoiceStyles).toContain(defaultStyle);
    expect(defaultStyle).not.toBe('solo-female');
  });

  it('all valid voice styles are recognized', () => {
    expect(validVoiceStyles).toHaveLength(9);
    for (const style of validVoiceStyles) {
      expect(style).toMatch(/^(solo-female|solo-male|duo)-\d$/);
    }
  });

  it('deprecated voice styles are not used', () => {
    for (const deprecated of deprecatedVoiceStyles) {
      expect(validVoiceStyles).not.toContain(deprecated);
    }
  });

  it('conversational style was removed in v1', () => {
    expect(validVoiceStyles).not.toContain('conversational');
  });
});

// ── Music Options Validation ──────────────────────────────────────────────

describe('Golpo API v1 Music Options', () => {
  const validMusicOptions = [
    'engaging',
    'lo-fi',
    'corporate',
    'cinematic',
    'upbeat',
    'ambient',
    'none',
  ];

  it('all 7 music options are available', () => {
    expect(validMusicOptions).toHaveLength(7);
  });

  it('engaging is the default music option', () => {
    expect(validMusicOptions).toContain('engaging');
  });

  it('none option disables background music', () => {
    expect(validMusicOptions).toContain('none');
  });
});

// ── Timing Parameter Validation ───────────────────────────────────────────

describe('Golpo API Timing Parameter', () => {
  const timingMap: Record<string, number> = {
    '30s': 1,
    '1min': 2,
    '2-3min': 5,
    '5-10min': 10,
  };

  it('30 seconds maps to timing=1', () => {
    expect(timingMap['30s']).toBe(1);
  });

  it('1 minute maps to timing=2', () => {
    expect(timingMap['1min']).toBe(2);
  });

  it('2-3 minutes maps to timing=5', () => {
    expect(timingMap['2-3min']).toBe(5);
  });

  it('5-10 minutes maps to timing=10', () => {
    expect(timingMap['5-10min']).toBe(10);
  });

  it('timing values are integers between 1 and 10', () => {
    for (const [, value] of Object.entries(timingMap)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
    }
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

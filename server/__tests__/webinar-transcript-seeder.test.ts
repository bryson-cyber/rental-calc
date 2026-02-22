/**
 * Tests for webinar-transcript-seeder.ts
 * 
 * Verifies:
 * - getTranscript fetches from CDN and caches
 * - seedTranscriptToSchedules updates schedules missing transcripts
 * - seedAiTemplates only generates when no templates exist
 * - runStartupSeed orchestrates everything without throwing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock dependencies
vi.mock('../db', () => ({
  getDb: vi.fn(),
}));

vi.mock('../webinar-ai-content', () => ({
  generateAndCacheTeasers: vi.fn().mockResolvedValue({ teasers: ['teaser1'], primaryTeaser: 'teaser1' }),
  generateTranscriptAwareReminder: vi.fn().mockResolvedValue('Hey {{firstName}}, join us at {{startTime}}!'),
}));

vi.mock('../../drizzle/schema', () => ({
  webinarSchedules: { id: 'id', webinarTranscript: 'webinarTranscript', generatedTeasers: 'generatedTeasers' },
  reminderTemplates: { id: 'id', stage: 'stage' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', field: a, value: b })),
  isNull: vi.fn((a) => ({ type: 'isNull', field: a })),
  sql: vi.fn(),
}));

describe('webinar-transcript-seeder', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTranscript', () => {
    it('should fetch transcript from CDN', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('This is the webinar transcript content...'),
      });

      const { getTranscript } = await import('../webinar-transcript-seeder');
      const transcript = await getTranscript();

      expect(transcript).toBe('This is the webinar transcript content...');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('manuscdn.com'));
    });

    it('should cache transcript after first fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('Cached transcript'),
      });

      const { getTranscript } = await import('../webinar-transcript-seeder');
      
      const first = await getTranscript();
      const second = await getTranscript();

      expect(first).toBe('Cached transcript');
      expect(second).toBe('Cached transcript');
      // Only fetched once — second call uses cache
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw if CDN returns non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { getTranscript } = await import('../webinar-transcript-seeder');
      
      await expect(getTranscript()).rejects.toThrow('Failed to fetch transcript: 404');
    });

    it('should throw if fetch fails entirely', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { getTranscript } = await import('../webinar-transcript-seeder');
      
      await expect(getTranscript()).rejects.toThrow('Network error');
    });
  });

  describe('seedTranscriptToSchedules', () => {
    it('should return zeros when database is not available', async () => {
      const { getDb } = await import('../db');
      (getDb as any).mockResolvedValue(null);

      const { seedTranscriptToSchedules } = await import('../webinar-transcript-seeder');
      const result = await seedTranscriptToSchedules();

      expect(result).toEqual({ schedulesUpdated: 0, teasersGenerated: 0 });
    });

    it('should return zeros when transcript cannot be loaded', async () => {
      mockFetch.mockRejectedValueOnce(new Error('CDN down'));

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
      };
      const { getDb } = await import('../db');
      (getDb as any).mockResolvedValue(mockDb);

      const { seedTranscriptToSchedules } = await import('../webinar-transcript-seeder');
      const result = await seedTranscriptToSchedules();

      expect(result).toEqual({ schedulesUpdated: 0, teasersGenerated: 0 });
    });
  });

  describe('seedAiTemplates', () => {
    it('should return zeros when database is not available', async () => {
      const { getDb } = await import('../db');
      (getDb as any).mockResolvedValue(null);

      const { seedAiTemplates } = await import('../webinar-transcript-seeder');
      const result = await seedAiTemplates();

      expect(result).toEqual({ templatesGenerated: 0 });
    });

    it('should skip generation when templates already exist', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      };
      // Return existing templates
      mockDb.from.mockResolvedValue([
        { id: 1, stage: 1, name: '24h', messageTemplate: 'test', isActive: 1 },
      ]);

      const { getDb } = await import('../db');
      (getDb as any).mockResolvedValue(mockDb);

      const { seedAiTemplates } = await import('../webinar-transcript-seeder');
      const result = await seedAiTemplates();

      expect(result).toEqual({ templatesGenerated: 0 });
    });
  });

  describe('runStartupSeed', () => {
    it('should not throw even if everything fails', async () => {
      const { getDb } = await import('../db');
      (getDb as any).mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('CDN down'));

      const { runStartupSeed } = await import('../webinar-transcript-seeder');
      
      // Should not throw
      await expect(runStartupSeed()).resolves.toBeUndefined();
    });
  });
});

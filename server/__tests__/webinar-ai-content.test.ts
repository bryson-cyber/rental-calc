/**
 * Tests for webinar-ai-content.ts — AI teaser generation from transcript
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the model-router before importing the module
vi.mock('../model-router', () => ({
  routedLLMCall: vi.fn(),
  FEATURES: { WEBINAR_SMS_CONTENT: 'WEBINAR_SMS_CONTENT' },
}));

// Mock the database
vi.mock('../db', () => ({
  getDb: vi.fn(),
}));

// Mock the schema
vi.mock('../../drizzle/schema', () => ({
  webinarSchedules: {
    id: 'id',
    webinarTranscript: 'webinarTranscript',
    generatedTeasers: 'generatedTeasers',
    noShowTeaser: 'noShowTeaser',
  },
}));

import {
  generateTeasersFromTranscript,
  buildTranscriptAwareSystemPrompt,
} from '../webinar-ai-content';
import { routedLLMCall } from '../model-router';

const mockedLLM = vi.mocked(routedLLMCall);

describe('webinar-ai-content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // generateTeasersFromTranscript
  // =========================================================================

  describe('generateTeasersFromTranscript', () => {
    it('returns fallback teaser when transcript is empty', async () => {
      const result = await generateTeasersFromTranscript('');
      expect(result).toEqual(['the strategies that are changing lives right now']);
      expect(mockedLLM).not.toHaveBeenCalled();
    });

    it('returns fallback teaser when transcript is too short', async () => {
      const result = await generateTeasersFromTranscript('short text');
      expect(result).toEqual(['the strategies that are changing lives right now']);
      expect(mockedLLM).not.toHaveBeenCalled();
    });

    it('calls LLM and parses valid JSON array response', async () => {
      const mockTeasers = [
        'how Andrew got $80K in funding with zero experience',
        'the exact calculator that shows your earning potential',
        'Dante made $4,400 from one unit in San Diego',
      ];
      mockedLLM.mockResolvedValueOnce(JSON.stringify(mockTeasers));

      const transcript = 'A'.repeat(200); // long enough to pass the 100 char check
      const result = await generateTeasersFromTranscript(transcript);

      expect(result).toEqual(mockTeasers);
      expect(mockedLLM).toHaveBeenCalledOnce();
    });

    it('handles LLM response wrapped in markdown code blocks', async () => {
      const mockTeasers = ['teaser one', 'teaser two'];
      mockedLLM.mockResolvedValueOnce('```json\n' + JSON.stringify(mockTeasers) + '\n```');

      const transcript = 'A'.repeat(200);
      const result = await generateTeasersFromTranscript(transcript);

      expect(result).toEqual(mockTeasers);
    });

    it('returns fallback when LLM returns non-array JSON', async () => {
      mockedLLM.mockResolvedValueOnce('{"not": "an array"}');

      const transcript = 'A'.repeat(200);
      const result = await generateTeasersFromTranscript(transcript);

      expect(result).toEqual(['the strategies that are changing lives right now']);
    });

    it('returns fallback when LLM returns array of non-strings', async () => {
      mockedLLM.mockResolvedValueOnce('[1, 2, 3]');

      const transcript = 'A'.repeat(200);
      const result = await generateTeasersFromTranscript(transcript);

      expect(result).toEqual(['the strategies that are changing lives right now']);
    });

    it('returns fallback when LLM call throws an error', async () => {
      mockedLLM.mockRejectedValueOnce(new Error('API timeout'));

      const transcript = 'A'.repeat(200);
      const result = await generateTeasersFromTranscript(transcript);

      expect(result).toEqual(['the strategies that are changing lives right now']);
    });

    it('truncates very long transcripts to ~8000 chars', async () => {
      const mockTeasers = ['teaser from long transcript'];
      mockedLLM.mockResolvedValueOnce(JSON.stringify(mockTeasers));

      const longTranscript = 'X'.repeat(20000);
      await generateTeasersFromTranscript(longTranscript);

      expect(mockedLLM).toHaveBeenCalledOnce();
      // The prompt should contain truncation marker
      const callArgs = mockedLLM.mock.calls[0];
      const prompt = callArgs[1] as string;
      expect(prompt).toContain('[...middle section...]');
    });

    it('does not truncate transcripts under 8000 chars', async () => {
      const mockTeasers = ['teaser from short transcript'];
      mockedLLM.mockResolvedValueOnce(JSON.stringify(mockTeasers));

      const shortTranscript = 'Y'.repeat(5000);
      await generateTeasersFromTranscript(shortTranscript);

      const callArgs = mockedLLM.mock.calls[0];
      const prompt = callArgs[1] as string;
      expect(prompt).not.toContain('[...middle section...]');
    });

    it('returns fallback when LLM returns empty array', async () => {
      mockedLLM.mockResolvedValueOnce('[]');

      const transcript = 'A'.repeat(200);
      const result = await generateTeasersFromTranscript(transcript);

      expect(result).toEqual(['the strategies that are changing lives right now']);
    });
  });

  // =========================================================================
  // buildTranscriptAwareSystemPrompt
  // =========================================================================

  describe('buildTranscriptAwareSystemPrompt', () => {
    it('returns base prompt when transcript is null', () => {
      const result = buildTranscriptAwareSystemPrompt(null);

      expect(result).toContain('Coach Inayah');
      expect(result).toContain('WARM, ENCOURAGING');
      expect(result).not.toContain('WEBINAR HIGHLIGHTS');
    });

    it('returns base prompt when transcript is empty', () => {
      const result = buildTranscriptAwareSystemPrompt('');

      expect(result).toContain('Coach Inayah');
      expect(result).not.toContain('WEBINAR HIGHLIGHTS');
    });

    it('returns base prompt when transcript is too short', () => {
      const result = buildTranscriptAwareSystemPrompt('short');

      expect(result).not.toContain('WEBINAR HIGHLIGHTS');
    });

    it('includes transcript highlights when transcript is long enough', () => {
      const transcript = 'This is a detailed webinar transcript about short-term rental investing. ' + 'A'.repeat(200);
      const result = buildTranscriptAwareSystemPrompt(transcript);

      expect(result).toContain('Coach Inayah');
      expect(result).toContain('WEBINAR HIGHLIGHTS');
      expect(result).toContain('short-term rental investing');
    });

    it('truncates transcript context to ~2000 chars', () => {
      const longTranscript = 'Z'.repeat(5000);
      const result = buildTranscriptAwareSystemPrompt(longTranscript);

      expect(result).toContain('WEBINAR HIGHLIGHTS');
      // The excerpt should be truncated
      const highlightsSection = result.split('---WEBINAR HIGHLIGHTS---')[1]?.split('---END HIGHLIGHTS---')[0];
      expect(highlightsSection).toBeDefined();
      // Should be around 2000 chars, not 5000
      expect(highlightsSection!.trim().length).toBeLessThanOrEqual(2100);
    });

    it('includes key persona elements in the prompt', () => {
      const result = buildTranscriptAwareSystemPrompt(null);

      expect(result).toContain('SMS');
      expect(result).toContain('under 155 characters');
      expect(result).toContain('unsubscribe');
      expect(result).toContain('LIVE WEBINAR');
      expect(result).toContain('short-term rentals');
    });

    it('instructs AI to not use emoji', () => {
      const result = buildTranscriptAwareSystemPrompt(null);
      expect(result).toContain('DO NOT use any emoji');
    });

    it('mentions correct webinar time (4 PM Pacific / 7 PM Eastern)', () => {
      const result = buildTranscriptAwareSystemPrompt(null);
      expect(result).toContain('4 PM Pacific');
      expect(result).toContain('7 PM Eastern');
    });

    it('instructs AI to reference specific transcript content', () => {
      const transcript = 'Andrew got approved for $80,000 in business credit. ' + 'B'.repeat(200);
      const result = buildTranscriptAwareSystemPrompt(transcript);

      expect(result).toContain('SPECIFIC things from above');
      expect(result).toContain('real student names');
      expect(result).toContain('Andrew got approved');
    });
  });
});

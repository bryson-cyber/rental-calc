/**
 * Content Studio v3 — Unit Tests
 *
 * Tests for:
 *   - FORMAT_SPECS (YT-only: lesson + deep_dive)
 *   - CONTENT_PILLARS exports
 *   - generateContentScript validation
 */

import { describe, it, expect } from 'vitest';

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
      expect(typeof spec.durationRange).toBe('string');
      expect(typeof spec.defaultDuration).toBe('number');
    }
  });

  it('CONTENT_PILLARS has expected pillar categories', async () => {
    const { CONTENT_PILLARS } = await import('./content-studio');
    expect(CONTENT_PILLARS).toBeDefined();
    const keys = Object.keys(CONTENT_PILLARS);
    expect(keys.length).toBeGreaterThan(0);
  });
});

// ── Test generateContentScript validation ───────────────────────────────────

describe('Content Studio — Input Validation', () => {
  it('throws on invalid format', async () => {
    const { generateContentScript } = await import('./content-studio');
    await expect(
      generateContentScript('test topic', 'invalid_format'),
    ).rejects.toThrow(/Invalid format/);
  });

  it('exports generateAutonomousScript function', async () => {
    const { generateAutonomousScript } = await import('./content-studio');
    expect(typeof generateAutonomousScript).toBe('function');
  });

  it('lesson format has correct structure', async () => {
    const { FORMAT_SPECS } = await import('./content-studio');
    const lesson = FORMAT_SPECS.lesson;
    expect(lesson.name).toBe('YouTube Coaching Lesson');
    expect(lesson.durationRange).toContain('minute');
    expect(lesson.defaultDuration).toBeGreaterThan(0);
  });
});

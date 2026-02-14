import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Verify that user-facing content in server files does not contain emojis.
 * Unicode symbols like ★ (U+2605), ✓ (U+2713), ✗ (U+2717) are acceptable
 * in data context (AI prompts, rating displays) but actual emojis (U+1Fxxx range)
 * should not appear in notification templates or email content.
 */

// Regex to match common emojis (not Unicode symbols like ★✓✗)
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2728}\u{2B50}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu;

const serverFiles = [
  'server/notification-service.ts',
  'server/deal-alert-agent.ts',
  'server/newsletter-email-sender.ts',
  'server/newsletter-sms.ts',
  'server/newsletter-content-generator.ts',
  'server/newsletter-deal-finder.ts',
  'server/newsletter-market-data.ts',
  'server/newsletter-orchestrator.ts',
  'server/regulation-tracker.ts',
  'server/airdna-rate-limiter.ts',
];

describe('Emoji Removal - Server Files', () => {
  for (const filePath of serverFiles) {
    it(`${filePath} should not contain emojis in user-facing content`, () => {
      const fullPath = resolve(process.cwd(), filePath);
      let content: string;
      try {
        content = readFileSync(fullPath, 'utf-8');
      } catch {
        // File may not exist in test environment, skip
        return;
      }

      const matches = content.match(emojiRegex);
      expect(
        matches,
        `Found emojis in ${filePath}: ${matches?.join(', ')}`
      ).toBeNull();
    });
  }
});

describe('Emoji Removal - SOP Reports', () => {
  it('sop-reports.ts should not contain season type emojis', () => {
    const fullPath = resolve(process.cwd(), 'server/sop-reports.ts');
    let content: string;
    try {
      content = readFileSync(fullPath, 'utf-8');
    } catch {
      return;
    }

    // Check that season type labels don't contain emojis
    const seasonMatches = content.match(/seasonType.*[\u{1F300}-\u{1F9FF}]/gu);
    expect(
      seasonMatches,
      `Found emojis in season type labels: ${seasonMatches?.join(', ')}`
    ).toBeNull();
  });

  it('sop-reports.ts should not contain star emojis in rating display', () => {
    const fullPath = resolve(process.cwd(), 'server/sop-reports.ts');
    let content: string;
    try {
      content = readFileSync(fullPath, 'utf-8');
    } catch {
      return;
    }

    // The ⭐ emoji (U+2B50) should not appear
    expect(content).not.toContain('\u2B50');
  });
});

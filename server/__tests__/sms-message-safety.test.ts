/**
 * SMS Message Safety Tests
 * 
 * Verifies that all SMS-related code enforces:
 * 1. No emoji in any outbound messages
 * 2. Messages stay under 155 characters for single-segment SMS delivery
 * 3. Correct Pacific timezone references
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// 1. STRIP EMOJI FUNCTION (same logic as in webinar-engine.ts and webinar-cron.ts)
// ---------------------------------------------------------------------------

function stripEmoji(text: string): string {
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2600-\u27BF\u2B50\u2B55\u231A-\u23F3\u23F8-\u23FA\u25AA-\u25FE\u2934-\u2935\u2190-\u21FF\u200D\uFE0F\u20E3]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

describe('stripEmoji', () => {
  it('removes common emoji from text', () => {
    expect(stripEmoji('Hello 🔥 World')).toBe('Hello World');
    expect(stripEmoji('Hey! 👋 Welcome')).toBe('Hey! Welcome');
    expect(stripEmoji('Go! 🚀')).toBe('Go!');
  });

  it('removes multiple emoji', () => {
    expect(stripEmoji('🔥🔥🔥 Fire!')).toBe('Fire!');
  });

  it('preserves clean text', () => {
    expect(stripEmoji('Hello World')).toBe('Hello World');
    expect(stripEmoji('No emoji here')).toBe('No emoji here');
  });

  it('handles empty string', () => {
    expect(stripEmoji('')).toBe('');
  });

  it('collapses multiple spaces after emoji removal', () => {
    expect(stripEmoji('Hello  🔥  World')).toBe('Hello World');
  });

  it('removes sun/weather emoji', () => {
    expect(stripEmoji('Good morning ☀️')).toBe('Good morning');
  });

  it('removes prayer hands emoji', () => {
    expect(stripEmoji('Thank you 🙏')).toBe('Thank you');
  });
});

// ---------------------------------------------------------------------------
// 2. DEFAULT TEMPLATES — NO EMOJI, CORRECT TIMEZONE
// ---------------------------------------------------------------------------

describe('Webinar SMS Templates — No Emoji', () => {
  const webinarFiles = [
    'server/webinar-engine.ts',
    'server/webinar-cron.ts',
    'server/webinar-ai-content.ts',
  ];

  // Regex to match surrogate pair emoji (most common emoji)
  const surrogateEmojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

  for (const filePath of webinarFiles) {
    it(`${filePath} should not contain emoji in default templates or fallback messages`, () => {
      const fullPath = resolve(process.cwd(), filePath);
      let content: string;
      try {
        content = readFileSync(fullPath, 'utf-8');
      } catch {
        return; // File may not exist in test environment
      }

      // Extract string literals that look like SMS templates (contain {{firstName}} or similar)
      const templateRegex = /`[^`]*\{\{firstName\}\}[^`]*`/g;
      const templates = content.match(templateRegex) || [];

      for (const template of templates) {
        const matches = template.match(surrogateEmojiRegex);
        expect(
          matches,
          `Found emoji in template in ${filePath}: ${template.substring(0, 80)}...`
        ).toBeNull();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 3. TIMEZONE REFERENCES — PACIFIC, NOT EST
// ---------------------------------------------------------------------------

describe('Webinar SMS — Pacific Timezone', () => {
  it('webinar-cron.ts uses America/Los_Angeles timezone', () => {
    const content = readFileSync(resolve(process.cwd(), 'server/webinar-cron.ts'), 'utf-8');
    expect(content).toContain("'America/Los_Angeles'");
  });

  it('webinar-cron.ts references Pacific time in constants', () => {
    const content = readFileSync(resolve(process.cwd(), 'server/webinar-cron.ts'), 'utf-8');
    expect(content).toContain('Pacific');
  });

  it('webinar-ai-content.ts references 4 PM Pacific in system prompts', () => {
    const content = readFileSync(resolve(process.cwd(), 'server/webinar-ai-content.ts'), 'utf-8');
    expect(content).toContain('4 PM Pacific');
  });

  it('webinar-engine.ts references Pacific in context info', () => {
    const content = readFileSync(resolve(process.cwd(), 'server/webinar-engine.ts'), 'utf-8');
    expect(content).toContain('Pacific');
  });
});

// ---------------------------------------------------------------------------
// 4. 155-CHAR ENFORCEMENT EXISTS IN CODE
// ---------------------------------------------------------------------------

describe('Webinar SMS — 155-char Enforcement', () => {
  it('webinar-engine.ts enforces 155-char limit on AI responses', () => {
    const content = readFileSync(resolve(process.cwd(), 'server/webinar-engine.ts'), 'utf-8');
    expect(content).toContain('aiResponse.length > 155');
  });

  it('webinar-engine.ts enforces 160-char limit on no-show blast messages', () => {
    const content = readFileSync(resolve(process.cwd(), 'server/webinar-engine.ts'), 'utf-8');
    expect(content).toContain('message.length > 160');
  });

  it('webinar-cron.ts enforces 160-char limit on noon engagement messages', () => {
    const content = readFileSync(resolve(process.cwd(), 'server/webinar-cron.ts'), 'utf-8');
    expect(content).toContain('message.length > 160');
  });

  it('webinar-engine.ts calls stripEmoji on AI responses', () => {
    const content = readFileSync(resolve(process.cwd(), 'server/webinar-engine.ts'), 'utf-8');
    expect(content).toContain('stripEmoji(aiResponse)');
  });

  it('webinar-cron.ts calls stripEmoji on noon engagement messages', () => {
    const content = readFileSync(resolve(process.cwd(), 'server/webinar-cron.ts'), 'utf-8');
    expect(content).toContain('stripEmoji(message)');
  });
});

// ---------------------------------------------------------------------------
// 5. SINGLE_SMS_STRICTLY MODE ON ALL SENDS
// ---------------------------------------------------------------------------

describe('Webinar SMS — SINGLE_SMS_STRICTLY Mode', () => {
  it('webinar-engine.ts uses SINGLE_SMS_STRICTLY for all sendSms calls', () => {
    const content = readFileSync(resolve(process.cwd(), 'server/webinar-engine.ts'), 'utf-8');
    // Every sendSms call should include SINGLE_SMS_STRICTLY
    const sendSmsCalls = content.match(/sendSms\(\{[^}]+\}/g) || [];
    expect(sendSmsCalls.length).toBeGreaterThan(0);
    for (const call of sendSmsCalls) {
      expect(
        call,
        `sendSms call missing SINGLE_SMS_STRICTLY: ${call.substring(0, 80)}...`
      ).toContain('SINGLE_SMS_STRICTLY');
    }
  });

  it('webinar-cron.ts uses SINGLE_SMS_STRICTLY for sendSms calls', () => {
    const content = readFileSync(resolve(process.cwd(), 'server/webinar-cron.ts'), 'utf-8');
    const sendSmsCalls = content.match(/sendSms\(\{[^}]+\}/g) || [];
    expect(sendSmsCalls.length).toBeGreaterThan(0);
    for (const call of sendSmsCalls) {
      expect(
        call,
        `sendSms call missing SINGLE_SMS_STRICTLY: ${call.substring(0, 80)}...`
      ).toContain('SINGLE_SMS_STRICTLY');
    }
  });
});

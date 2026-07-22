import { describe, it, expect } from 'vitest';

describe('Secret validation', () => {
  it('PII_ENCRYPTION_KEY is a valid 64-char hex string (256-bit)', () => {
    const key = process.env.PII_ENCRYPTION_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(key!)).toBe(true);
  });

  it('LLC_EMAIL_FROM is a valid email address', () => {
    const email = process.env.LLC_EMAIL_FROM;
    expect(email).toBeDefined();
    expect(email!.length).toBeGreaterThan(0);
    expect(email!).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});

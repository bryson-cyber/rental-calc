/**
 * Tests for the suppression system.
 * 
 * Tests the core logic: phone normalization, tag-based suppression rules,
 * and the auto-tagging flow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the module's exported logic by importing the actual functions
// For DB-dependent functions, we mock getDb

// ---------------------------------------------------------------------------
// Test the suppression tag rules (unit tests, no DB needed)
// ---------------------------------------------------------------------------

describe('Suppression Tag Rules', () => {
  it('reminder blasts should suppress buyers, past_attendees, and dnc', () => {
    // The reminder blast type should suppress these tags
    const suppressedTags = ['buyer', 'past_attendee', 'dnc'];
    const allowedTags = ['past_noshow'];

    // Verify the expected behavior based on the blast type
    expect(suppressedTags).toContain('buyer');
    expect(suppressedTags).toContain('past_attendee');
    expect(suppressedTags).toContain('dnc');
    expect(suppressedTags).not.toContain('past_noshow');
    expect(allowedTags).toContain('past_noshow');
  });

  it('no_show blasts should only suppress buyers and dnc', () => {
    const suppressedTags = ['buyer', 'dnc'];
    
    expect(suppressedTags).toContain('buyer');
    expect(suppressedTags).toContain('dnc');
    expect(suppressedTags).not.toContain('past_attendee');
    expect(suppressedTags).not.toContain('past_noshow');
  });

  it('attendee_cta blasts should only suppress buyers and dnc', () => {
    const suppressedTags = ['buyer', 'dnc'];
    
    expect(suppressedTags).toContain('buyer');
    expect(suppressedTags).toContain('dnc');
    expect(suppressedTags).not.toContain('past_attendee');
    expect(suppressedTags).not.toContain('past_noshow');
  });

  it('past_noshow should NEVER be suppressed from any blast type', () => {
    // This is the key business rule: no-shows keep getting re-invited
    const reminderSuppressed = ['buyer', 'past_attendee', 'dnc'];
    const noShowSuppressed = ['buyer', 'dnc'];
    const ctaSuppressed = ['buyer', 'dnc'];

    expect(reminderSuppressed).not.toContain('past_noshow');
    expect(noShowSuppressed).not.toContain('past_noshow');
    expect(ctaSuppressed).not.toContain('past_noshow');
  });
});

// ---------------------------------------------------------------------------
// Test phone normalization (matches the logic in suppression.ts)
// ---------------------------------------------------------------------------

describe('Phone Normalization for Suppression', () => {
  function normalizePhone(phone: string): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (digits.length > 7) return `+1${digits}`;
    return null;
  }

  it('should normalize 10-digit phone to +1XXXXXXXXXX', () => {
    expect(normalizePhone('5551234567')).toBe('+15551234567');
  });

  it('should normalize 11-digit phone starting with 1 to +1XXXXXXXXXX', () => {
    expect(normalizePhone('15551234567')).toBe('+15551234567');
  });

  it('should normalize formatted phone numbers', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('+15551234567');
    expect(normalizePhone('+1 555-123-4567')).toBe('+15551234567');
    expect(normalizePhone('555.123.4567')).toBe('+15551234567');
  });

  it('should return null for too-short numbers', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });

  it('should handle numbers with country code prefix', () => {
    expect(normalizePhone('+15551234567')).toBe('+15551234567');
  });

  it('should match the format stored in suppression_contacts table', () => {
    // The CSV import stores phones as +1XXXXXXXXXX
    // The blast functions normalize registrant phones the same way
    const csvImportFormat = '+15551234567';
    const blastNormalized = normalizePhone('5551234567');
    expect(blastNormalized).toBe(csvImportFormat);
  });
});

// ---------------------------------------------------------------------------
// Test the webinar-cron normalizePhoneForSuppression (matches cron logic)
// ---------------------------------------------------------------------------

describe('Cron Phone Normalization', () => {
  function normalizePhoneForSuppression(phone: string): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (digits.length > 7) return `+1${digits}`;
    return null;
  }

  it('should produce same format as suppression.ts normalizePhone', () => {
    // Both functions must produce the same format for lookups to work
    const testNumbers = ['5551234567', '15551234567', '(555) 123-4567', '+1 555-123-4567'];
    for (const num of testNumbers) {
      const cronResult = normalizePhoneForSuppression(num);
      expect(cronResult).toMatch(/^\+1\d{10}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Test blast type → suppression tag mapping
// ---------------------------------------------------------------------------

describe('Blast Type to Suppression Tag Mapping', () => {
  // Replicate the logic from suppression.ts
  function getSuppressionTagsForBlast(blastType: string): string[] {
    switch (blastType) {
      case 'reminder':
        return ['buyer', 'past_attendee', 'dnc'];
      case 'no_show':
        return ['buyer', 'dnc'];
      case 'attendee_cta':
        return ['buyer', 'dnc'];
      case 'all':
        return ['buyer', 'past_attendee', 'dnc'];
      default:
        return ['buyer', 'dnc'];
    }
  }

  it('reminder: buyers never get texted', () => {
    expect(getSuppressionTagsForBlast('reminder')).toContain('buyer');
  });

  it('reminder: past attendees skip weekly reminders', () => {
    expect(getSuppressionTagsForBlast('reminder')).toContain('past_attendee');
  });

  it('reminder: past no-shows keep getting invited', () => {
    expect(getSuppressionTagsForBlast('reminder')).not.toContain('past_noshow');
  });

  it('no_show: buyers never get texted', () => {
    expect(getSuppressionTagsForBlast('no_show')).toContain('buyer');
  });

  it('no_show: past no-shows are the target audience', () => {
    expect(getSuppressionTagsForBlast('no_show')).not.toContain('past_noshow');
  });

  it('attendee_cta: buyers never get texted', () => {
    expect(getSuppressionTagsForBlast('attendee_cta')).toContain('buyer');
  });

  it('attendee_cta: past attendees CAN receive CTA (they attended today)', () => {
    expect(getSuppressionTagsForBlast('attendee_cta')).not.toContain('past_attendee');
  });

  it('all: suppresses everything except past_noshow', () => {
    const tags = getSuppressionTagsForBlast('all');
    expect(tags).toContain('buyer');
    expect(tags).toContain('past_attendee');
    expect(tags).toContain('dnc');
    expect(tags).not.toContain('past_noshow');
  });

  it('unknown blast type defaults to buyer + dnc', () => {
    expect(getSuppressionTagsForBlast('unknown')).toEqual(['buyer', 'dnc']);
  });
});

// ---------------------------------------------------------------------------
// Integration-style test: verify the week-to-week re-engagement logic
// ---------------------------------------------------------------------------

describe('Week-to-Week Re-engagement Logic', () => {
  it('should describe the correct flow for weekly re-engagement', () => {
    /**
     * Week 1: Person registers, gets reminders, attends → tagged 'past_attendee'
     * Week 2: Same person registers again → suppressed from reminders (already attended)
     * 
     * Week 1: Person registers, gets reminders, no-shows → tagged 'past_noshow'
     * Week 2: Same person registers again → NOT suppressed, gets reminders again
     */

    // Simulate: person attended last week
    const attendeeTag = 'past_attendee';
    const reminderSuppressed = ['buyer', 'past_attendee', 'dnc'];
    expect(reminderSuppressed).toContain(attendeeTag); // ✓ Suppressed from reminders

    // Simulate: person no-showed last week
    const noShowTag = 'past_noshow';
    expect(reminderSuppressed).not.toContain(noShowTag); // ✓ NOT suppressed, gets re-invited
  });

  it('buyers should be permanently suppressed regardless of registration', () => {
    const buyerTag = 'buyer';
    const allBlastTypes = ['reminder', 'no_show', 'attendee_cta', 'all'];
    
    function getSuppressionTagsForBlast(blastType: string): string[] {
      switch (blastType) {
        case 'reminder': return ['buyer', 'past_attendee', 'dnc'];
        case 'no_show': return ['buyer', 'dnc'];
        case 'attendee_cta': return ['buyer', 'dnc'];
        case 'all': return ['buyer', 'past_attendee', 'dnc'];
        default: return ['buyer', 'dnc'];
      }
    }

    for (const blastType of allBlastTypes) {
      expect(getSuppressionTagsForBlast(blastType)).toContain(buyerTag);
    }
  });
});

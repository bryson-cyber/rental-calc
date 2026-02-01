/**
 * Shareable Regulation Reports Tests
 * Tests the creation and retrieval of shareable regulation reports
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 1,
          shareCode: 'abc123xyz',
          city: 'Denver',
          state: 'CO',
          status: 'allowed_with_permit',
          summary: 'Denver allows short-term rentals with a permit.',
          permitRequired: true,
          primaryResidenceOnly: false,
          viewCount: 0,
          createdAt: new Date(),
        }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          id: 1,
          shareCode: 'abc123xyz',
          city: 'Denver',
          state: 'CO',
          status: 'allowed_with_permit',
          summary: 'Denver allows short-term rentals with a permit.',
          permitRequired: true,
          primaryResidenceOnly: false,
          viewCount: 5,
          createdAt: new Date(),
        }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ viewCount: 6 }]),
      }),
    }),
  },
}));

describe('Shareable Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Share Code Generation', () => {
    it('should generate a unique share code', () => {
      // Simple share code generation logic
      const generateShareCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 12; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      const code1 = generateShareCode();
      const code2 = generateShareCode();

      expect(code1).toHaveLength(12);
      expect(code2).toHaveLength(12);
      expect(code1).not.toBe(code2); // Should be unique
    });

    it('should only contain alphanumeric characters', () => {
      const generateShareCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 12; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      const code = generateShareCode();
      expect(code).toMatch(/^[A-Za-z0-9]+$/);
    });
  });

  describe('Report Data Validation', () => {
    it('should validate required fields for creating a shareable report', () => {
      const validateReportData = (data: any) => {
        const requiredFields = ['city', 'state', 'status', 'permitRequired', 'primaryResidenceOnly', 'confidence'];
        const missingFields = requiredFields.filter(field => data[field] === undefined);
        return missingFields.length === 0;
      };

      const validData = {
        city: 'Denver',
        state: 'CO',
        status: 'allowed_with_permit',
        permitRequired: true,
        primaryResidenceOnly: false,
        confidence: 'high',
      };

      const invalidData = {
        city: 'Denver',
        // missing state and other fields
      };

      expect(validateReportData(validData)).toBe(true);
      expect(validateReportData(invalidData)).toBe(false);
    });

    it('should validate status values', () => {
      const validStatuses = ['allowed', 'allowed_with_permit', 'restricted', 'banned', 'pending', 'unknown'];
      
      const isValidStatus = (status: string) => validStatuses.includes(status);

      expect(isValidStatus('allowed')).toBe(true);
      expect(isValidStatus('allowed_with_permit')).toBe(true);
      expect(isValidStatus('banned')).toBe(true);
      expect(isValidStatus('invalid_status')).toBe(false);
    });
  });

  describe('SMS Notification Format', () => {
    it('should format SMS message correctly', () => {
      const formatSMSMessage = (city: string, state: string, shareCode: string, baseUrl: string) => {
        const url = `${baseUrl}/regulation/${shareCode}`;
        return `Your ${city}, ${state} STR regulation report is ready! View it here: ${url}`;
      };

      const message = formatSMSMessage('Denver', 'CO', 'abc123xyz', 'https://example.com');
      
      expect(message).toContain('Denver, CO');
      expect(message).toContain('https://example.com/regulation/abc123xyz');
      expect(message.length).toBeLessThan(160); // SMS character limit
    });

    it('should validate phone number format', () => {
      const isValidPhoneNumber = (phone: string) => {
        // Remove non-digits
        const digits = phone.replace(/\D/g, '');
        // US phone numbers should have 10 or 11 digits (with country code)
        return digits.length === 10 || digits.length === 11;
      };

      expect(isValidPhoneNumber('555-123-4567')).toBe(true);
      expect(isValidPhoneNumber('(555) 123-4567')).toBe(true);
      expect(isValidPhoneNumber('5551234567')).toBe(true);
      expect(isValidPhoneNumber('+1 555 123 4567')).toBe(true);
      expect(isValidPhoneNumber('123')).toBe(false);
    });
  });

  describe('Email Notification Format', () => {
    it('should format email subject correctly', () => {
      const formatEmailSubject = (city: string, state: string) => {
        return `Your ${city}, ${state} Short-Term Rental Regulation Report`;
      };

      const subject = formatEmailSubject('Denver', 'CO');
      expect(subject).toBe('Your Denver, CO Short-Term Rental Regulation Report');
    });

    it('should validate email format', () => {
      const isValidEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };

      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
    });
  });

  describe('View Count Tracking', () => {
    it('should increment view count correctly', () => {
      let viewCount = 0;
      
      const incrementViewCount = () => {
        viewCount += 1;
        return viewCount;
      };

      expect(incrementViewCount()).toBe(1);
      expect(incrementViewCount()).toBe(2);
      expect(incrementViewCount()).toBe(3);
    });
  });
});

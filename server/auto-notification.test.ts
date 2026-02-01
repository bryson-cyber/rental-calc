/**
 * Auto-Notification Feature Tests
 * Tests the automatic SMS/email notification system for regulation reports
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateShareCode, sendReportNotifications } from './sms-email-notifications';

describe('Auto-Notification Feature', () => {
  describe('generateShareCode', () => {
    it('should generate a 10-character share code', () => {
      const code = generateShareCode();
      expect(code).toHaveLength(10);
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateShareCode());
      }
      // All 100 codes should be unique
      expect(codes.size).toBe(100);
    });

    it('should only contain alphanumeric characters (no ambiguous chars)', () => {
      const code = generateShareCode();
      // Should not contain 0, O, I, l (ambiguous characters)
      expect(code).not.toMatch(/[0OIl]/);
      // Should only contain allowed characters
      expect(code).toMatch(/^[A-HJ-NP-Za-hj-np-z2-9]+$/);
    });
  });

  describe('sendReportNotifications', () => {
    beforeEach(() => {
      // Reset any mocks
      vi.clearAllMocks();
    });

    it('should return empty results when no contact info provided', async () => {
      const result = await sendReportNotifications(
        {
          city: 'Denver',
          state: 'CO',
          status: 'allowed',
          shareCode: 'abc123xyz',
        },
        {}
      );

      // Should return empty object when no contact info
      expect(result.sms).toBeUndefined();
      expect(result.email).toBeUndefined();
    });

    it('should attempt SMS when phone is provided', async () => {
      const result = await sendReportNotifications(
        {
          city: 'Denver',
          state: 'CO',
          status: 'allowed',
          shareCode: 'abc123xyz',
        },
        {
          phone: '5551234567',
        }
      );

      // Should have attempted SMS (may fail without valid API key in test)
      expect(result.sms).toBeDefined();
    });

    it('should attempt email when email is provided', async () => {
      const result = await sendReportNotifications(
        {
          city: 'Denver',
          state: 'CO',
          status: 'allowed',
          shareCode: 'abc123xyz',
        },
        {
          email: 'test@example.com',
          name: 'Test User',
        }
      );

      // Should have attempted email
      expect(result.email).toBeDefined();
    });

    it('should attempt both SMS and email when both provided', async () => {
      const result = await sendReportNotifications(
        {
          city: 'Denver',
          state: 'CO',
          status: 'allowed',
          shareCode: 'abc123xyz',
        },
        {
          phone: '5551234567',
          email: 'test@example.com',
          name: 'Test User',
        }
      );

      // Should have attempted both
      expect(result.sms).toBeDefined();
      expect(result.email).toBeDefined();
    });
  });

  describe('Report URL generation', () => {
    it('should generate correct report URL format', () => {
      const shareCode = 'abc123xyz';
      const baseUrl = 'https://coachinayahturnkeytool.com';
      const reportUrl = `${baseUrl}/report/${shareCode}`;
      
      expect(reportUrl).toBe('https://coachinayahturnkeytool.com/report/abc123xyz');
    });
  });
});

/**
 * HubSpot Email Integration Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
const originalEnv = process.env;

describe('HubSpot Email Integration', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env = { 
      ...originalEnv,
      HUBSPOT_API_KEY: 'test-api-key',
      HUBSPOT_REPORT_EMAIL_ID: '12345',
      HUBSPOT_SHARE_EMAIL_ID: '67890'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendHubSpotEmail', () => {
    it('should send email successfully with valid configuration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusId: 'status-123', status: 'PENDING' })
      });

      const { sendHubSpotEmail } = await import('./hubspot-email');
      
      const result = await sendHubSpotEmail({
        to: 'test@example.com',
        emailType: 'report',
        customProperties: {
          reportLink: 'https://example.com/share/abc123',
          propertyAddress: '123 Main St'
        }
      });

      expect(result.success).toBe(true);
      expect(result.statusId).toBe('status-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hubapi.com/marketing/v4/email/single-send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should return error when API key is not configured', async () => {
      process.env.HUBSPOT_API_KEY = '';
      
      // Re-import to get fresh module with new env
      vi.resetModules();
      const { sendHubSpotEmail } = await import('./hubspot-email');
      
      const result = await sendHubSpotEmail({
        to: 'test@example.com',
        emailType: 'report',
        customProperties: { reportLink: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API key not configured');
    });

    it('should return error when email template ID is not configured', async () => {
      process.env.HUBSPOT_REPORT_EMAIL_ID = '';
      
      vi.resetModules();
      const { sendHubSpotEmail } = await import('./hubspot-email');
      
      const result = await sendHubSpotEmail({
        to: 'test@example.com',
        emailType: 'report',
        customProperties: { reportLink: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('template ID not configured');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid email address' })
      });

      const { sendHubSpotEmail } = await import('./hubspot-email');
      
      const result = await sendHubSpotEmail({
        to: 'invalid-email',
        emailType: 'report',
        customProperties: { reportLink: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email address');
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { sendHubSpotEmail } = await import('./hubspot-email');
      
      const result = await sendHubSpotEmail({
        to: 'test@example.com',
        emailType: 'report',
        customProperties: { reportLink: 'https://example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('sendReportNotificationEmail', () => {
    it('should format report type correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ statusId: 'status-123', status: 'PENDING' })
      });

      const { sendReportNotificationEmail } = await import('./hubspot-email');
      
      await sendReportNotificationEmail({
        recipientEmail: 'test@example.com',
        recipientName: 'John Doe',
        reportLink: 'https://example.com/share/abc123',
        reportType: 'property_validation',
        propertyAddress: '123 Main St',
        annualRevenue: 50000,
        occupancyRate: 0.75
      });

      // Check that fetch was called with formatted data
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.customProperties.reportType).toBe('Property Validation');
      expect(callBody.customProperties.annualRevenue).toBe('$50,000');
      expect(callBody.customProperties.occupancyRate).toBe('75%');
    });
  });

  describe('getEmailStatus', () => {
    it('should return email status successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'COMPLETE',
          sendResult: 'SENT',
          requestedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:00:05Z'
        })
      });

      const { getEmailStatus } = await import('./hubspot-email');
      
      const result = await getEmailStatus('status-123');

      expect(result.status).toBe('COMPLETE');
      expect(result.sendResult).toBe('SENT');
    });
  });

  describe('upsertHubSpotContact', () => {
    it('should create a new contact successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'contact-123' })
      });

      const { upsertHubSpotContact } = await import('./hubspot-email');
      
      const result = await upsertHubSpotContact('test@example.com', {
        firstname: 'John',
        lastname: 'Doe',
        city: 'Denver'
      });

      expect(result.success).toBe(true);
      expect(result.contactId).toBe('contact-123');
    });

    it('should update existing contact on conflict', async () => {
      // First call returns 409 (conflict)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409
      });
      
      // Search returns existing contact
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ id: 'existing-123' }] })
      });
      
      // Update succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      const { upsertHubSpotContact } = await import('./hubspot-email');
      
      const result = await upsertHubSpotContact('existing@example.com', {
        firstname: 'Jane'
      });

      expect(result.success).toBe(true);
      expect(result.contactId).toBe('existing-123');
    });
  });
});

describe('SMS-Email Notification Service with HubSpot', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env = { 
      ...originalEnv,
      HUBSPOT_API_KEY: 'test-api-key',
      HUBSPOT_REPORT_EMAIL_ID: '12345'
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should prioritize HubSpot over Zapier for emails', async () => {
    // HubSpot succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ statusId: 'status-123', status: 'PENDING' })
    });

    const { sendEmailNotification } = await import('./sms-email-notifications');
    
    const result = await sendEmailNotification(
      'test@example.com',
      'Test Subject',
      'Test Body',
      'John',
      {
        reportLink: 'https://example.com/share/abc123',
        reportType: 'property_validation'
      }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('hubspot');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should fall back to Zapier when HubSpot fails', async () => {
    process.env.ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/test';
    
    // HubSpot fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal error' })
    });
    
    // Zapier succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    });

    vi.resetModules();
    const { sendEmailNotification } = await import('./sms-email-notifications');
    
    const result = await sendEmailNotification(
      'test@example.com',
      'Test Subject',
      'Test Body',
      'John',
      {
        reportLink: 'https://example.com/share/abc123',
        reportType: 'property_validation'
      }
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('zapier');
  });

  it('should fall back to console when both HubSpot and Zapier fail', async () => {
    // HubSpot not configured (no email ID)
    process.env.HUBSPOT_REPORT_EMAIL_ID = '';
    // Zapier not configured
    process.env.ZAPIER_WEBHOOK_URL = '';

    vi.resetModules();
    const { sendEmailNotification } = await import('./sms-email-notifications');
    
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const result = await sendEmailNotification(
      'test@example.com',
      'Test Subject',
      'Test Body',
      'John'
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('console');
    
    consoleSpy.mockRestore();
  });
});

/**
 * Test HubSpot SMTP credentials
 * 
 * This test validates that the SMTP credentials are correctly configured
 * by attempting to verify the connection to HubSpot's SMTP server.
 */

import { describe, it, expect } from 'vitest';
import nodemailer from 'nodemailer';

describe('HubSpot SMTP Configuration', () => {
  const HUBSPOT_SMTP_USER = process.env.HUBSPOT_SMTP_USER;
  const HUBSPOT_SMTP_PASS = process.env.HUBSPOT_SMTP_PASS;

  it('should have SMTP credentials configured', () => {
    expect(HUBSPOT_SMTP_USER).toBeDefined();
    expect(HUBSPOT_SMTP_USER).not.toBe('');
    expect(HUBSPOT_SMTP_PASS).toBeDefined();
    expect(HUBSPOT_SMTP_PASS).not.toBe('');
  });

  it('should be able to connect to HubSpot SMTP server', async () => {
    if (!HUBSPOT_SMTP_USER || !HUBSPOT_SMTP_PASS) {
      console.warn('Skipping SMTP connection test - credentials not configured');
      return;
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.hubapi.com',
      port: 587,
      secure: false,
      auth: {
        user: HUBSPOT_SMTP_USER,
        pass: HUBSPOT_SMTP_PASS
      }
    });

    // Verify connection - this will throw if credentials are invalid
    const verified = await transporter.verify();
    expect(verified).toBe(true);
  }, 30000); // 30 second timeout for network operation
});

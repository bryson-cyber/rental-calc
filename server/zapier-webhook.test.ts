import { describe, it, expect } from 'vitest';

describe('Zapier Webhook Integration', () => {
  it('should have ZAPIER_WEBHOOK_URL environment variable set', () => {
    const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
    expect(webhookUrl).toBeDefined();
    expect(webhookUrl).toMatch(/^https:\/\/hooks\.zapier\.com\/hooks\/catch\//);
  });

  it('should be able to reach the Zapier webhook endpoint', async () => {
    const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('ZAPIER_WEBHOOK_URL is not set');
    }

    const testPayload = {
      event_type: 'test',
      tool_name: 'vitest_validation',
      city: 'Test City',
      state: 'TS',
      timestamp: new Date().toISOString(),
      test: true
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    // Zapier webhooks return 200 on success, 410 if zap is paused/off
    // 404 means the webhook URL is invalid or deleted
    // Any of these indicate the endpoint is reachable
    expect([200, 410]).toContain(response.status);
  });
});

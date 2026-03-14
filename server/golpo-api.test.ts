import { describe, it, expect } from 'vitest';

describe('Golpo API credentials', () => {
  it('should have GOLPO_API_KEY set', () => {
    expect(process.env.GOLPO_API_KEY).toBeDefined();
    expect(process.env.GOLPO_API_KEY!.length).toBeGreaterThan(10);
  });

  it('should have GOLPO_BASE_URL set', () => {
    expect(process.env.GOLPO_BASE_URL).toBeDefined();
    expect(process.env.GOLPO_BASE_URL).toContain('golpoai.com');
  });

  it('should authenticate with Golpo API', async () => {
    const baseUrl = process.env.GOLPO_BASE_URL!;
    const apiKey = process.env.GOLPO_API_KEY!;

    const response = await fetch(`${baseUrl}/api/v1/videos?limit=1`, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    // 200 means valid key, even if no videos exist yet
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toBeDefined();
  }, 15000);
});

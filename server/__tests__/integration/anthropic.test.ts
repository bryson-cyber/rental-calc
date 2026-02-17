import { describe, it, expect } from 'vitest';

describe('Anthropic API Key Validation', () => {
  it('should have ANTHROPIC_API_KEY environment variable set', () => {
    expect(process.env.ANTHROPIC_API_KEY).toBeDefined();
    expect(process.env.ANTHROPIC_API_KEY).not.toBe('');
  });

  it('should successfully connect to Claude API', async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.log('Skipping: ANTHROPIC_API_KEY not set');
      return;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Say "API key is valid" and nothing else.' }],
      }),
    });

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.content).toBeDefined();
    expect(data.content[0].text.toLowerCase()).toContain('valid');
  });
});

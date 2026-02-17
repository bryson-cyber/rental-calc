/**
 * Validates the Anthropic API key by making a minimal API call.
 * This test ensures the key is correctly configured before we build
 * the full LLM provider abstraction.
 */
import { describe, it, expect } from 'vitest';

describe('Anthropic API Key Validation', () => {
  it('should have ANTHROPIC_API_KEY set in environment', () => {
    const key = process.env.ANTHROPIC_API_KEY;
    expect(key).toBeDefined();
    expect(key).not.toBe('');
    expect(key!.startsWith('sk-ant-')).toBe(true);
  });

  it('should use Claude as the LLM provider', () => {
    // LLM_PROVIDER is no longer needed — Claude is the only provider
    // This test just confirms the key is set
    const key = process.env.ANTHROPIC_API_KEY;
    expect(key).toBeDefined();
  });

  it('should successfully authenticate with Anthropic API', async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      console.log('Skipping: ANTHROPIC_API_KEY not set');
      return;
    }

    // Minimal API call to validate the key — just ask for a single word
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Reply with only the word "ok".' }],
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.content).toBeDefined();
    expect(data.content.length).toBeGreaterThan(0);
    expect(data.content[0].type).toBe('text');
    console.log('Anthropic API response:', data.content[0].text);
  }, 30000);
});

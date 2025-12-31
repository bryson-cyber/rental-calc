import { describe, it, expect } from 'vitest';

describe('Gemini API Key Validation', () => {
  it('should have GEMINI_API_KEY environment variable set', () => {
    expect(process.env.GEMINI_API_KEY).toBeDefined();
    expect(process.env.GEMINI_API_KEY).not.toBe('');
  });

  it('should successfully connect to Gemini API', async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    
    // Test with a simple request to list models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data.models).toBeDefined();
    expect(Array.isArray(data.models)).toBe(true);
    expect(data.models.length).toBeGreaterThan(0);
  });

  it('should be able to generate content with Gemini', async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Say "API key is valid" and nothing else.'
            }]
          }]
        })
      }
    );
    
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data.candidates).toBeDefined();
    expect(data.candidates[0].content.parts[0].text).toContain('valid');
  });
});

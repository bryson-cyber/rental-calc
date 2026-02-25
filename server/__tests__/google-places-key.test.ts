import { describe, it, expect } from 'vitest';

describe('Google Places API Key Validation', () => {
  it('should have VITE_GOOGLE_PLACES_API_KEY set', () => {
    const key = process.env.VITE_GOOGLE_PLACES_API_KEY;
    expect(key).toBeDefined();
    expect(key).not.toBe('');
    expect(key!.length).toBeGreaterThan(10);
  });

  it('should be able to call Google Places Autocomplete API', async () => {
    const key = process.env.VITE_GOOGLE_PLACES_API_KEY;
    expect(key).toBeDefined();

    const response = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key!,
        },
        body: JSON.stringify({
          input: '1600 Amphitheatre Parkway',
          includedRegionCodes: ['us'],
        }),
      }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.suggestions).toBeDefined();
    expect(data.suggestions.length).toBeGreaterThan(0);
  });
});

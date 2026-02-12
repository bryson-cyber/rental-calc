import { describe, it, expect } from 'vitest';

describe('Google Maps API Key Validation', () => {
  it('should have VITE_GOOGLE_PLACES_API_KEY set', () => {
    const key = process.env.VITE_GOOGLE_PLACES_API_KEY;
    expect(key).toBeDefined();
    expect(key).not.toBe('');
    expect(key!.startsWith('AIza')).toBe(true);
  });

  it('should be able to call Google Maps Geocoding API', async () => {
    const key = process.env.VITE_GOOGLE_PLACES_API_KEY;
    if (!key) {
      console.warn('Skipping API call test: no API key');
      return;
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=Richardson+TX&key=${key}`
    );
    const data = await response.json();

    expect(response.ok).toBe(true);
    // If key is valid and billing is enabled, status should be OK
    // If key is invalid, status would be REQUEST_DENIED
    expect(data.status).not.toBe('REQUEST_DENIED');
    expect(['OK', 'ZERO_RESULTS']).toContain(data.status);
  });
});

import { describe, it, expect } from 'vitest';

/**
 * Validates that the BNBCALC_API_KEY environment variable is set and
 * can successfully authenticate with the BNB Calc API.
 */
describe('BNB Calc API Key Validation', () => {
  it('should have BNBCALC_API_KEY set', () => {
    const key = process.env.BNBCALC_API_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(10);
    expect(key!.startsWith('sk_')).toBe(true);
  });

  it('should authenticate successfully with BNB Calc API', async () => {
    const key = process.env.BNBCALC_API_KEY;
    if (!key) {
      throw new Error('BNBCALC_API_KEY not set');
    }

    // Use the cohost endpoint with minimal params as a lightweight auth check
    const response = await fetch('https://atlas.bnbcalc.com/v1/external/analysis/create/cohost', {
      method: 'POST',
      headers: {
        'x-bnbcalc-api-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lat: 27.7676,
        lng: -82.6403,
        bedrooms: 3,
        bathrooms: 2,
        accomodates: 6,
      }),
    });

    // 200 = success, 401 = bad key, 429 = rate limited (key is valid but throttled)
    expect(response.status).not.toBe(401);
    
    if (response.status === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.revenue).toBeDefined();
      expect(data.data.comparables).toBeDefined();
    }
  }, 30000); // 30s timeout for API call
});

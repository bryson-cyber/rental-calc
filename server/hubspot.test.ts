import { describe, it, expect } from 'vitest';

/**
 * Test to validate the HubSpot API key is working correctly
 * This test calls a lightweight HubSpot API endpoint to verify authentication
 */
describe('HubSpot API Integration', () => {
  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;

  it('should have HUBSPOT_API_KEY environment variable set', () => {
    expect(HUBSPOT_API_KEY).toBeDefined();
    expect(HUBSPOT_API_KEY).not.toBe('');
    expect(HUBSPOT_API_KEY?.startsWith('pat-')).toBe(true);
  });

  it('should successfully authenticate with HubSpot API', async () => {
    // Skip if no API key
    if (!HUBSPOT_API_KEY) {
      console.log('Skipping HubSpot API test - no API key configured');
      return;
    }

    // Call a lightweight endpoint to verify the API key works
    // Using the account info endpoint which is minimal and fast
    const response = await fetch('https://api.hubapi.com/account-info/v3/details', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data).toHaveProperty('portalId');
    console.log('HubSpot API authenticated successfully for portal:', data.portalId);
  });

  it('should have contacts read permission', async () => {
    // Skip if no API key
    if (!HUBSPOT_API_KEY) {
      console.log('Skipping HubSpot contacts test - no API key configured');
      return;
    }

    // Try to list contacts (limit 1) to verify contacts read permission
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data).toHaveProperty('results');
    console.log('HubSpot contacts read permission verified');
  });

  it('should generate valid deep links', async () => {
    const { generateDeepLink } = await import('./hubspot');
    
    const deepLink = generateDeepLink({
      baseUrl: 'https://coachinayahturnkeytool.com',
      tool: 'market-advisor',
      market: 'Denver, Colorado',
      email: 'test@example.com',
      utm_source: 'hubspot',
      utm_medium: 'email',
      utm_campaign: 'test_campaign',
    });

    expect(deepLink).toContain('/market-advisor');
    expect(deepLink).toContain('market=Denver');
    expect(deepLink).toContain('utm_source=hubspot');
    expect(deepLink).toContain('utm_medium=email');
    expect(deepLink).toContain('utm_campaign=test_campaign');
    expect(deepLink).toContain('ref='); // Base64 encoded email
    console.log('Generated deep link:', deepLink);
  });
});

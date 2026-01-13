import { describe, it, expect } from 'vitest';

const AIRDNA_API_BASE = "https://api.airdna.co/api/enterprise/v2";

async function makeApiRequest(endpoint: string, method: string = 'GET', body?: any) {
  const apiKey = process.env.AIRDNA_API_KEY;
  const url = `${AIRDNA_API_BASE}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url);
  return response.json();
}

describe('AirDNA Location APIs', () => {
  it('should check if location autocomplete exists', async () => {
    // Try the location/autocomplete endpoint
    try {
      const response = await makeApiRequest('/location/autocomplete?term=San%20Diego');
      console.log('Autocomplete response:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('Autocomplete error:', e);
    }
  }, 30000);
  
  it('should check location search endpoint', async () => {
    try {
      const response = await makeApiRequest('/location/search?term=San%20Diego');
      console.log('Location search response:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('Location search error:', e);
    }
  }, 30000);
  
  it('should check markets search endpoint', async () => {
    try {
      const response = await makeApiRequest('/markets/search?term=San%20Diego');
      console.log('Markets search response:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('Markets search error:', e);
    }
  }, 30000);
  
  it('should check submarkets for California', async () => {
    // San Diego might be a submarket of California
    try {
      // First find California market
      const response = await makeApiRequest('/country/us/markets', 'POST', {
        pagination: { page_size: 400, offset: 0 }
      });
      
      const markets = response.payload?.markets || [];
      console.log('Total markets:', markets.length);
      
      // Look for any San Diego related market
      const sanDiegoMarkets = markets.filter((m: any) => 
        m.name.toLowerCase().includes('diego') || 
        m.name.toLowerCase().includes('san d')
      );
      console.log('San Diego related markets:', sanDiegoMarkets);
      
      // Also check for California
      const californiaMarkets = markets.filter((m: any) => 
        m.name.toLowerCase().includes('california') ||
        m.name.toLowerCase().includes('los angeles') ||
        m.name.toLowerCase().includes('san francisco')
      );
      console.log('California related markets:', californiaMarkets.map((m: any) => m.name));
    } catch (e) {
      console.log('Error:', e);
    }
  }, 60000);
});

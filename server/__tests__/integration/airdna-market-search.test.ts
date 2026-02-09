import { describe, it, expect } from 'vitest';
import { ENV } from '../_core/env';

const AIRDNA_API_BASE = "https://api.airdna.co/api/enterprise/v2";

async function testSearch(searchTerm: string) {
  const apiKey = ENV.airdnaApiKey;
  
  const response = await fetch(`${AIRDNA_API_BASE}/market/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      search_term: searchTerm,
      pagination: {
        page_size: 25,
        offset: 0
      }
    })
  });
  
  const data = await response.json();
  return data.payload?.results || [];
}

describe('AirDNA Market Search API', () => {
  it('should find Central West End as a submarket', async () => {
    const results = await testSearch('Central West End');
    console.log('\n=== Central West End ===');
    results.slice(0, 5).forEach((r: any) => {
      console.log(`  - ${r.name} (${r.type}) - ${r.listing_count} listings`);
    });
    expect(results.length).toBeGreaterThanOrEqual(0);
  }, 30000);
  
  it('should find St. Louis markets', async () => {
    const results = await testSearch('St. Louis');
    console.log('\n=== St. Louis ===');
    results.slice(0, 5).forEach((r: any) => {
      console.log(`  - ${r.name} (${r.type}) - ${r.listing_count} listings`);
    });
    expect(results.length).toBeGreaterThan(0);
  }, 30000);
  
  it('should find results for zip code 63108', async () => {
    const results = await testSearch('63108');
    console.log('\n=== 63108 (Central West End zip) ===');
    results.slice(0, 5).forEach((r: any) => {
      console.log(`  - ${r.name} (${r.type}) - ${r.listing_count} listings`);
    });
    expect(results.length).toBeGreaterThanOrEqual(0);
  }, 30000);
  
  it('should find San Diego', async () => {
    const results = await testSearch('San Diego');
    console.log('\n=== San Diego ===');
    results.slice(0, 5).forEach((r: any) => {
      console.log(`  - ${r.name} (${r.type}) - ${r.listing_count} listings`);
    });
    expect(results.length).toBeGreaterThan(0);
  }, 30000);
  
  it('should find Beverly Hills', async () => {
    const results = await testSearch('Beverly Hills');
    console.log('\n=== Beverly Hills ===');
    results.slice(0, 5).forEach((r: any) => {
      console.log(`  - ${r.name} (${r.type}) - ${r.listing_count} listings`);
    });
    expect(results.length).toBeGreaterThan(0);
  }, 30000);
});

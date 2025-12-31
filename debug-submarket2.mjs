const API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

console.log('API_KEY exists:', !!API_KEY);
console.log('API_KEY length:', API_KEY?.length || 0);

async function searchMarkets(query) {
  const url = `${BASE_URL}/market/search?search_term=${encodeURIComponent(query)}&limit=20`;
  console.log('Fetching:', url);
  const response = await fetch(url, {
    headers: { 'X-API-Key': API_KEY }
  });
  console.log('Response status:', response.status);
  const data = await response.json();
  console.log('Response payload keys:', Object.keys(data.payload || {}));
  return data.payload?.results || [];
}

async function main() {
  console.log('Searching for Austin...');
  const results = await searchMarkets('Austin');
  console.log(`Found ${results.length} results:`);
  results.slice(0, 10).forEach((r, i) => {
    console.log(`${i+1}. ${r.name} (${r.id}) - ${r.type} - ${r.listing_count} listings`);
    if (r.parent_market) {
      console.log(`   Parent: ${r.parent_market.name} (${r.parent_market.id})`);
    }
  });
}

main().catch(console.error);

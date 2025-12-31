import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

async function searchMarkets(query) {
  const url = `${BASE_URL}/market/search?search_term=${encodeURIComponent(query)}&limit=20`;
  const response = await fetch(url, {
    headers: { 'X-API-Key': API_KEY }
  });
  const data = await response.json();
  return data.payload?.results || [];
}

async function main() {
  console.log('Searching for Austin...');
  const results = await searchMarkets('Austin');
  console.log(`Found ${results.length} results:`);
  results.forEach((r, i) => {
    console.log(`${i+1}. ${r.name} (${r.id}) - ${r.type} - ${r.listing_count} listings`);
    if (r.parent_market) {
      console.log(`   Parent: ${r.parent_market.name} (${r.parent_market.id})`);
    }
  });
}

main().catch(console.error);

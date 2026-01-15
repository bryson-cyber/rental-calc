import 'dotenv/config';

const API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

async function searchMarkets(query) {
  const url = `${BASE_URL}/market/search?search_term=${encodeURIComponent(query)}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

async function main() {
  console.log('Searching for "St. Louis"...\n');
  
  const results = await searchMarkets('St. Louis');
  
  console.log('Results:');
  for (const result of results.data || results) {
    console.log(`- ${result.name || result.location_name}`);
    console.log(`  Type: ${result.type}`);
    console.log(`  State: ${result.state || 'NOT PROVIDED'}`);
    console.log(`  Location: ${result.location_name || 'NOT PROVIDED'}`);
    console.log(`  Legacy Location: ${JSON.stringify(result.legacy_location || {})}`);
    console.log('');
  }
}

main().catch(console.error);

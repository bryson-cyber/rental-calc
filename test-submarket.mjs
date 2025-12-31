import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

async function searchMarkets(term) {
  const url = `${BASE_URL}/market/search?search_term=${encodeURIComponent(term)}&limit=10`;
  const response = await fetch(url, {
    headers: { 'x-api-key': API_KEY }
  });
  const data = await response.json();
  return data.payload?.results || [];
}

async function main() {
  console.log('Searching for Austin...');
  const results = await searchMarkets('Austin');
  console.log('Results:', JSON.stringify(results.slice(0, 5), null, 2));
  
  // Get the Austin market ID
  const austin = results.find(r => r.name === 'Austin');
  if (austin) {
    console.log('\nAustin market:', austin);
    
    // Search for related neighborhoods
    console.log('\nSearching for Austin neighborhoods...');
    const neighborhoods = await searchMarkets('Austin neighborhood');
    console.log('Neighborhoods:', JSON.stringify(neighborhoods.slice(0, 10), null, 2));
  }
}

main().catch(console.error);

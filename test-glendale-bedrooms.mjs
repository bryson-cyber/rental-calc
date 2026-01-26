import { getAllMarketListings } from './server/airdna.ts';

// Glendale, Arizona market ID
const marketId = '5b2bbb0e-7e3f-4e3f-8c3f-3e3f4e3f5e3f';

async function test() {
  console.log('Testing bedroom distribution for Glendale, Arizona...');
  
  // First, let's search for the correct market ID
  const searchUrl = 'https://api.airdna.co/api/explorer/v2/search/markets';
  const response = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AIRDNA_API_KEY}`
    },
    body: JSON.stringify({
      search_term: 'Glendale, Arizona',
      limit: 5
    })
  });
  
  const data = await response.json();
  console.log('Search results:', JSON.stringify(data, null, 2));
}

test().catch(console.error);

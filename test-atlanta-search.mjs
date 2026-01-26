const AIRDNA_API_BASE = "https://api.airdna.co/api/enterprise/v2";
const API_KEY = process.env.AIRDNA_API_KEY;

async function makeApiRequest(endpoint, method = "GET", body = null) {
  const url = `${AIRDNA_API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  };
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function test() {
  console.log('=== Searching for Atlanta ===\n');
  
  // Search for Atlanta
  const searchResp = await makeApiRequest(`/market/search?term=Atlanta&limit=5`);
  console.log('Search results:');
  searchResp.payload?.markets?.forEach((m, i) => {
    console.log(`  ${i+1}. ID: ${m.id}, Name: ${m.name}, Type: ${m.type}, Listings: ${m.listing_count}`);
  });
  
  // Get the first Atlanta result
  const atlantaMarket = searchResp.payload?.markets?.find(m => m.name?.includes('Atlanta') && m.type === 'market');
  if (atlantaMarket) {
    console.log('\n=== Getting Atlanta Market Details ===');
    console.log('Using market ID:', atlantaMarket.id);
    
    const details = await makeApiRequest(`/market/${atlantaMarket.id}`);
    console.log('listing_count:', details.payload?.listing_count);
    console.log('name:', details.payload?.name);
  }
}

test().catch(console.error);

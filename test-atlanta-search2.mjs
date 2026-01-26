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
    const text = await response.text();
    throw new Error(`API error: ${response.status} ${response.statusText} - ${text}`);
  }
  return response.json();
}

async function test() {
  console.log('=== Searching for Atlanta ===\n');
  
  // Search for Atlanta using POST
  const searchResp = await makeApiRequest('/market/search', 'POST', {
    search_term: 'Atlanta',
    pagination: { page_size: 10, offset: 0 }
  });
  
  console.log('Search results:');
  const results = searchResp.payload?.results || [];
  results.forEach((m, i) => {
    console.log(`  ${i+1}. ID: ${m.id}, Name: ${m.name}, Type: ${m.type}, Listings: ${m.listing_count}, Country: ${m.location?.country}`);
  });
  
  // Get the first Atlanta USA result
  const atlantaMarket = results.find(m => m.name?.includes('Atlanta') && m.location?.country === 'United States');
  if (atlantaMarket) {
    console.log('\n=== Getting Atlanta Market Details ===');
    console.log('Using market ID:', atlantaMarket.id);
    
    const details = await makeApiRequest(`/market/${atlantaMarket.id}`);
    console.log('listing_count:', details.payload?.listing_count);
    console.log('name:', details.payload?.name);
    console.log('metrics:', JSON.stringify(details.payload?.metrics, null, 2));
  }
}

test().catch(console.error);

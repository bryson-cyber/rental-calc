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
  const marketId = 'airdna-166'; // Atlanta
  
  console.log('=== Getting Atlanta Market Details ===\n');
  
  const details = await makeApiRequest(`/market/${marketId}`);
  console.log('Full payload keys:', Object.keys(details.payload || {}));
  console.log('\nFull payload:', JSON.stringify(details.payload, null, 2));
  
  // Also get listings to check total_count
  console.log('\n=== Getting Listings Total Count ===');
  const listingsResp = await makeApiRequest(`/market/${marketId}/listings`, 'POST', {
    pagination: { page_size: 1, offset: 0 },
    order_by: { field: 'revenue', method: 'desc' }
  });
  console.log('total_count from listings API:', listingsResp.payload?.page_info?.total_count);
}

test().catch(console.error);

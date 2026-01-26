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
  
  console.log('=== Getting Atlanta Listings Sample ===\n');
  
  // Get 100 listings to analyze property types
  const listingsResp = await makeApiRequest(`/market/${marketId}/listings`, 'POST', {
    pagination: { page_size: 25, offset: 0 },
    order_by: { field: 'revenue', method: 'desc' }
  });
  
  const listings = listingsResp.payload?.listings || [];
  console.log('total_count:', listingsResp.payload?.page_info?.total_count);
  console.log('Sample size:', listings.length);
  
  // Analyze property types
  const propTypes = {};
  const hostSizes = {};
  const roomTypes = {};
  let superhostCount = 0;
  let profManagedCount = 0;
  
  listings.forEach(l => {
    propTypes[l.property_type || 'undefined'] = (propTypes[l.property_type || 'undefined'] || 0) + 1;
    hostSizes[l.host_size || 'undefined'] = (hostSizes[l.host_size || 'undefined'] || 0) + 1;
    roomTypes[l.room_type || 'undefined'] = (roomTypes[l.room_type || 'undefined'] || 0) + 1;
    if (l.superhost) superhostCount++;
    if (l.professionally_managed) profManagedCount++;
  });
  
  console.log('\nProperty type distribution:', propTypes);
  console.log('Host size distribution:', hostSizes);
  console.log('Room type distribution:', roomTypes);
  console.log('Superhost count:', superhostCount, '/', listings.length);
  console.log('Professionally managed count:', profManagedCount, '/', listings.length);
  
  // Show sample listing
  console.log('\n=== Sample Listing Fields ===');
  console.log(JSON.stringify(listings[0], null, 2));
}

test().catch(console.error);

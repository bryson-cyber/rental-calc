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
  // Atlanta market ID from AirDNA
  const marketId = 'airdna-3';
  
  console.log('=== Testing Atlanta Market ===\n');
  
  // Get market details
  console.log('1. Getting market details...');
  const details = await makeApiRequest(`/market/${marketId}`);
  console.log('listing_count:', details.payload?.listing_count);
  console.log('name:', details.payload?.name);
  console.log('metrics.revenue:', details.payload?.metrics?.revenue);
  console.log('metrics.booked:', details.payload?.metrics?.booked);
  
  // Get first page of listings
  console.log('\n2. Getting sample listings...');
  const listingsResp = await makeApiRequest(`/market/${marketId}/listings`, 'POST', {
    pagination: { page_size: 25, offset: 0 },
    order_by: { field: 'revenue', method: 'desc' }
  });
  
  console.log('total_count:', listingsResp.payload?.page_info?.total_count);
  console.log('\nSample listings:');
  
  const listings = listingsResp.payload?.listings || [];
  listings.slice(0, 5).forEach((l, i) => {
    console.log(`  ${i+1}. property_type: "${l.property_type}", host_size: "${l.host_size}", superhost: ${l.superhost}, prof_managed: ${l.professionally_managed}`);
  });
  
  // Count property types
  const propTypes = {};
  const hostSizes = {};
  listings.forEach(l => {
    propTypes[l.property_type] = (propTypes[l.property_type] || 0) + 1;
    hostSizes[l.host_size] = (hostSizes[l.host_size] || 0) + 1;
  });
  
  console.log('\nProperty type distribution:', propTypes);
  console.log('Host size distribution:', hostSizes);
}

test().catch(console.error);

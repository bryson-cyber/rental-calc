import 'dotenv/config';

const API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

async function makeApiRequest(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`[API] ${method} ${url}`);
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!response.ok) {
    console.error('API Error Response:', JSON.stringify(data, null, 2));
    throw new Error(`API error (${response.status}): ${JSON.stringify(data)}`);
  }
  
  return data;
}

async function getSubmarketDetails(submarketId) {
  const response = await makeApiRequest(`/submarket/${submarketId}`);
  return response.payload;
}

async function getSubmarketListings(submarketId, options = {}) {
  const { limit = 25, offset = 0, orderBy = 'revenue', orderDirection = 'desc' } = options;
  
  const body = {
    pagination: {
      page_size: Math.min(limit, 25),
      offset: offset,
    },
    order_by: {
      field: orderBy,
      method: orderDirection,
    }
  };
  
  console.log('Request body:', JSON.stringify(body, null, 2));
  
  const response = await makeApiRequest(`/submarket/${submarketId}/listings`, 'POST', body);
  return {
    listings: response.payload.listings || [],
    total_count: response.payload.page_info?.total_count || 0
  };
}

async function testComprehensiveReport() {
  console.log('Testing South Beach (airdna-1914)...\n');
  
  // Step 1: Get submarket details
  console.log('Step 1: Getting submarket details...');
  const submarketDetails = await getSubmarketDetails('airdna-1914');
  console.log('Name:', submarketDetails.name);
  console.log('Listing count:', submarketDetails.listing_count);
  console.log('Metrics:', JSON.stringify(submarketDetails.metrics, null, 2));
  
  // Step 2: Get listings
  console.log('\nStep 2: Getting listings...');
  const listingsResult = await getSubmarketListings('airdna-1914', { limit: 10 });
  console.log('Total count:', listingsResult.total_count);
  console.log('Fetched:', listingsResult.listings.length, 'listings');
  
  if (listingsResult.listings.length > 0) {
    const first = listingsResult.listings[0];
    console.log('First listing:', {
      title: first.title,
      revenue: first.revenue_ltm,
      adr: first.average_daily_rate_ltm,
      occupancy: first.occupancy_rate_ltm
    });
  }
  
  // Calculate metrics
  console.log('\n=== METRICS CALCULATION ===');
  
  if (submarketDetails.metrics && submarketDetails.metrics.revenue > 0) {
    const occupancy = Math.round(submarketDetails.metrics.booked * 100);
    const adr = Math.round(submarketDetails.metrics.daily_rate);
    const revenue = Math.round(submarketDetails.metrics.revenue);
    const revpar = Math.round(submarketDetails.metrics.revpar);
    const marketScore = submarketDetails.metrics.market_score;
    
    console.log('Using API metrics:');
    console.log('  Occupancy:', occupancy + '%');
    console.log('  ADR:', '$' + adr);
    console.log('  Revenue:', '$' + revenue);
    console.log('  RevPAR:', '$' + revpar);
    console.log('  Market Score:', marketScore);
    
    console.log('\n=== FINAL RESULT ===');
    console.log('This is what the frontend should display:');
    console.log('  Avg Annual Revenue: $' + revenue.toLocaleString());
    console.log('  Nightly Rate: $' + adr);
    console.log('  Occupancy: ' + occupancy + '%');
    console.log('  Active Listings: ' + (listingsResult.total_count || 'N/A'));
  } else {
    console.log('API metrics unavailable, would calculate from listings');
  }
}

testComprehensiveReport().catch(console.error);

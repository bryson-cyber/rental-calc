import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

async function makeApiRequest(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  return data;
}

async function testBedroomFilter() {
  // Test with submarket ID for St Louis 63108
  const submarketId = 'airdna-3511'; // This is a submarket ID
  
  console.log('Testing bedroom filter on submarket:', submarketId);
  
  // Test 1: No filter
  console.log('\n=== Test 1: No bedroom filter ===');
  const noFilter = await makeApiRequest(`/submarket/${submarketId}/listings`, 'POST', {
    pagination: { page_size: 25, offset: 0 },
    order_by: { field: 'revenue', method: 'desc' }
  });
  console.log('Status:', noFilter.status?.type);
  console.log('Total count:', noFilter.payload?.page_info?.total_count);
  if (noFilter.payload?.listings) {
    const bedroomDist = {};
    noFilter.payload.listings.forEach(l => {
      bedroomDist[l.bedrooms] = (bedroomDist[l.bedrooms] || 0) + 1;
    });
    console.log('Bedroom distribution in first 25:', bedroomDist);
  }
  
  // Test 2: Filter for Studio (bedrooms=0)
  console.log('\n=== Test 2: Studio filter (bedrooms=0) ===');
  const studioFilter = await makeApiRequest(`/submarket/${submarketId}/listings`, 'POST', {
    pagination: { page_size: 25, offset: 0 },
    order_by: { field: 'revenue', method: 'desc' },
    filters: [
      { type: 'select', field: 'bedrooms', value: 0 }
    ]
  });
  console.log('Status:', studioFilter.status?.type);
  console.log('Total count:', studioFilter.payload?.page_info?.total_count);
  if (studioFilter.payload?.listings) {
    console.log('Listings returned:', studioFilter.payload.listings.length);
    const bedroomDist = {};
    studioFilter.payload.listings.forEach(l => {
      bedroomDist[l.bedrooms] = (bedroomDist[l.bedrooms] || 0) + 1;
    });
    console.log('Bedroom distribution:', bedroomDist);
    if (studioFilter.payload.listings.length > 0) {
      console.log('Sample listing:', {
        title: studioFilter.payload.listings[0].title,
        bedrooms: studioFilter.payload.listings[0].bedrooms,
        revenue: studioFilter.payload.listings[0].revenue_ltm
      });
    }
  }
  
  // Test 3: Filter for 1BR
  console.log('\n=== Test 3: 1BR filter ===');
  const oneBrFilter = await makeApiRequest(`/submarket/${submarketId}/listings`, 'POST', {
    pagination: { page_size: 25, offset: 0 },
    order_by: { field: 'revenue', method: 'desc' },
    filters: [
      { type: 'select', field: 'bedrooms', value: 1 }
    ]
  });
  console.log('Status:', oneBrFilter.status?.type);
  console.log('Total count:', oneBrFilter.payload?.page_info?.total_count);
  if (oneBrFilter.payload?.listings) {
    console.log('Listings returned:', oneBrFilter.payload.listings.length);
    const bedroomDist = {};
    oneBrFilter.payload.listings.forEach(l => {
      bedroomDist[l.bedrooms] = (bedroomDist[l.bedrooms] || 0) + 1;
    });
    console.log('Bedroom distribution:', bedroomDist);
  }
  
  // Test 4: Filter for 2BR
  console.log('\n=== Test 4: 2BR filter ===');
  const twoBrFilter = await makeApiRequest(`/submarket/${submarketId}/listings`, 'POST', {
    pagination: { page_size: 25, offset: 0 },
    order_by: { field: 'revenue', method: 'desc' },
    filters: [
      { type: 'select', field: 'bedrooms', value: 2 }
    ]
  });
  console.log('Status:', twoBrFilter.status?.type);
  console.log('Total count:', twoBrFilter.payload?.page_info?.total_count);
  if (twoBrFilter.payload?.listings) {
    console.log('Listings returned:', twoBrFilter.payload.listings.length);
    const bedroomDist = {};
    twoBrFilter.payload.listings.forEach(l => {
      bedroomDist[l.bedrooms] = (bedroomDist[l.bedrooms] || 0) + 1;
    });
    console.log('Bedroom distribution:', bedroomDist);
  }
}

testBedroomFilter().catch(console.error);

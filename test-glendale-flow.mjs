import 'dotenv/config';

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

async function testGlendaleFlow() {
  console.log('=== Testing Glendale, Arizona Flow ===\n');
  
  // Step 1: Search for markets
  console.log('Step 1: Searching for markets with "Glendale"...');
  const searchResponse = await fetch(`${BASE_URL}/market/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      term: 'Glendale',
      filters: {
        countries: ['US']
      },
      pagination: {
        limit: 15,
        offset: 0
      }
    })
  });
  
  const searchData = await searchResponse.json();
  console.log('Search results:', JSON.stringify(searchData, null, 2));
  
  // Find Arizona results
  const arizonaResults = searchData.payload?.results?.filter(r => 
    r.location_name?.includes('Arizona') || r.location_name?.includes('AZ')
  ) || [];
  
  console.log(`\nFound ${arizonaResults.length} Arizona results:`);
  arizonaResults.forEach(r => {
    console.log(`- ${r.name} (${r.type}) - ${r.listing_count} listings - ID: ${r.id}`);
  });
  
  if (arizonaResults.length > 0) {
    const glendale = arizonaResults[0];
    console.log(`\nStep 2: Getting zip codes for ${glendale.name} (${glendale.type})...`);
    
    if (glendale.type === 'submarket') {
      // Try to get listings for this submarket
      const listingsResponse = await fetch(`${BASE_URL}/submarket/${glendale.id}/listings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRDNA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pagination: { page_size: 100, offset: 0 }
        })
      });
      
      const listingsData = await listingsResponse.json();
      console.log(`Listings response status: ${listingsResponse.status}`);
      
      if (listingsData.status?.type === 'error') {
        console.error('API Error:', listingsData.status.message);
      } else {
        const listings = listingsData.payload?.listings || [];
        console.log(`Found ${listings.length} listings`);
        
        // Extract zip codes
        const zipCodes = [...new Set(listings
          .map(l => l.zipcode || l.zip_code)
          .filter(z => z))];
        
        console.log(`\nUnique zip codes (${zipCodes.length}):`, zipCodes.sort());
      }
    } else if (glendale.type === 'market') {
      console.log('This is a market, not a submarket. Need to get submarkets first.');
      
      // Get submarkets for this market
      const submarketResponse = await fetch(`${BASE_URL}/market/${glendale.id}/submarkets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRDNA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      const submarketData = await submarketResponse.json();
      console.log('Submarkets:', JSON.stringify(submarketData, null, 2));
    }
  }
}

testGlendaleFlow().catch(console.error);

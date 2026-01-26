// Test Glendale bedroom distribution directly via API

async function test() {
  const apiKey = process.env.AIRDNA_API_KEY;
  if (!apiKey) {
    console.error('AIRDNA_API_KEY not set');
    return;
  }
  
  // First, search for Glendale market ID
  console.log('Searching for Glendale, Arizona...');
  const searchResponse = await fetch('https://api.airdna.co/api/explorer/v2/search/markets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      search_term: 'Glendale, Arizona',
      limit: 5
    })
  });
  
  const searchData = await searchResponse.json();
  console.log('Search results:', JSON.stringify(searchData.payload?.results?.[0], null, 2));
  
  const marketId = searchData.payload?.results?.[0]?.id;
  if (!marketId) {
    console.error('No market found');
    return;
  }
  
  console.log(`\nMarket ID: ${marketId}`);
  
  // Now fetch listings to check bedroom distribution
  console.log('\nFetching listings from different offsets...');
  
  const offsets = [0, 100, 500, 1000];
  const bedroomCounts = {};
  
  for (const offset of offsets) {
    const listingsResponse = await fetch(`https://api.airdna.co/api/explorer/v2/market/${marketId}/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        limit: 25,
        offset: offset,
        order_by: 'revenue',
        order_direction: 'desc'
      })
    });
    
    const listingsData = await listingsResponse.json();
    const listings = listingsData.payload?.results || [];
    
    console.log(`\nOffset ${offset}: ${listings.length} listings`);
    
    listings.forEach(l => {
      const br = l.bedrooms || 0;
      bedroomCounts[br] = (bedroomCounts[br] || 0) + 1;
    });
    
    // Show first listing bedroom count
    if (listings.length > 0) {
      console.log(`  First listing: ${listings[0].bedrooms}BR, $${listings[0].revenue}/yr`);
      console.log(`  Last listing: ${listings[listings.length-1].bedrooms}BR, $${listings[listings.length-1].revenue}/yr`);
    }
  }
  
  console.log('\n=== BEDROOM DISTRIBUTION ===');
  console.log(bedroomCounts);
}

test().catch(console.error);

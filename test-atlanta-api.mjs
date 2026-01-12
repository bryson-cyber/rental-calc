// Use native fetch (Node 18+)
const API_KEY = process.env.AIRDNA_API_KEY;

async function testAtlantaMarket() {
  console.log('API Key:', API_KEY ? 'Set' : 'NOT SET');
  
  // First search for Atlanta market
  const searchResponse = await fetch('https://api.airdna.co/v2/market/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      term: 'Atlanta, GA',
      limit: 5
    })
  });
  
  const searchData = await searchResponse.json();
  console.log('=== MARKET SEARCH RESULTS ===');
  console.log(JSON.stringify(searchData, null, 2));
  
  if (searchData.payload?.results?.[0]) {
    const marketId = searchData.payload.results[0].id;
    console.log('\n=== MARKET ID ===', marketId);
    
    // Get market listings to check bedroom data
    const listingsResponse = await fetch(`https://api.airdna.co/v2/market/${marketId}/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        pagination: { page_size: 100, offset: 0 },
        order_by: { field: 'revenue', method: 'desc' }
      })
    });
    
    const listingsData = await listingsResponse.json();
    console.log('\n=== LISTINGS RESPONSE (first 5) ===');
    if (listingsData.payload?.listings) {
      const listings = listingsData.payload.listings.slice(0, 5);
      listings.forEach((l, i) => {
        console.log(`\n${i+1}. ${l.title}`);
        console.log(`   Bedrooms: ${l.bedrooms}, Revenue: $${l.revenue_ltm}, Occupancy: ${l.occupancy_rate_ltm}`);
      });
      
      // Count bedroom distribution
      const bedroomCounts = {};
      listingsData.payload.listings.forEach(l => {
        const br = l.bedrooms || 0;
        bedroomCounts[br] = (bedroomCounts[br] || 0) + 1;
      });
      console.log('\n=== BEDROOM DISTRIBUTION (from 100 listings) ===');
      Object.keys(bedroomCounts).sort((a,b) => a-b).forEach(br => {
        console.log(`${br}BR: ${bedroomCounts[br]} listings`);
      });
    }
    
    // Get market details
    const detailsResponse = await fetch(`https://api.airdna.co/v2/market/${marketId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    });
    
    const detailsData = await detailsResponse.json();
    console.log('\n=== MARKET DETAILS ===');
    console.log('Name:', detailsData.payload?.name);
    console.log('Listing Count:', detailsData.payload?.listing_count);
    console.log('Metrics:', JSON.stringify(detailsData.payload?.metrics, null, 2));
  }
}

testAtlantaMarket().catch(console.error);

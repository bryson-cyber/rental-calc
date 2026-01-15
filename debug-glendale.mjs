import 'dotenv/config';

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/v1';

async function testGlendaleAZ() {
  console.log('Testing Glendale, Arizona zip code lookup...\n');
  
  // Step 1: Search for Glendale markets
  console.log('Step 1: Searching for Glendale markets...');
  const searchUrl = `${BASE_URL}/market/search?term=Glendale&state_code=AZ`;
  console.log('URL:', searchUrl);
  
  const searchResponse = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`,
      'Accept': 'application/json'
    }
  });
  
  const searchData = await searchResponse.json();
  console.log('Search results:', JSON.stringify(searchData, null, 2));
  
  // Step 2: If we have markets, try to get submarkets
  if (searchData.markets && searchData.markets.length > 0) {
    const market = searchData.markets[0];
    console.log(`\nStep 2: Getting submarkets for market ${market.market_id}...`);
    
    const submarketUrl = `${BASE_URL}/market/${market.market_id}/submarkets`;
    console.log('URL:', submarketUrl);
    
    const submarketResponse = await fetch(submarketUrl, {
      headers: {
        'Authorization': `Bearer ${AIRDNA_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    const submarketData = await submarketResponse.json();
    console.log('Submarket results:', JSON.stringify(submarketData, null, 2));
    
    // Step 3: If we have a submarket, try to get zip codes
    if (submarketData.submarkets && submarketData.submarkets.length > 0) {
      const submarket = submarketData.submarkets[0];
      console.log(`\nStep 3: Getting zip codes for submarket ${submarket.submarket_id}...`);
      
      await testZipcodeLookup(submarket.submarket_id);
    }
  }
}

async function testZipcodeLookup(submarketId) {
  console.log(`\nTesting zip code lookup for submarket: ${submarketId}`);
  
  // Try the listings endpoint to get zip codes
  const listingsUrl = `${BASE_URL}/rentalizer/listings?submarket_id=${submarketId}&page_size=100`;
  console.log('URL:', listingsUrl);
  
  const response = await fetch(listingsUrl, {
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`,
      'Accept': 'application/json'
    }
  });
  
  const data = await response.json();
  console.log(`Response status: ${response.status}`);
  console.log(`Total listings: ${data.listings?.length || 0}`);
  
  if (data.listings && data.listings.length > 0) {
    // Extract unique zip codes
    const zipCodes = [...new Set(data.listings
      .map(l => l.zipcode)
      .filter(z => z))];
    
    console.log(`\nUnique zip codes found: ${zipCodes.length}`);
    console.log('Zip codes:', zipCodes.sort());
  } else {
    console.log('\nNo listings found!');
    console.log('Full response:', JSON.stringify(data, null, 2));
  }
}

testGlendaleAZ().catch(console.error);

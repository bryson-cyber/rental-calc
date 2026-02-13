import 'dotenv/config';

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

// First, search for a market to get a valid ID
async function searchMarket(query) {
  const response = await fetch(`${BASE_URL}/market/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ search_text: query, pagination: { page_size: 5, offset: 0 } }),
  });
  return response.json();
}

async function getListings(marketId) {
  const response = await fetch(`${BASE_URL}/market/${marketId}/listings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pagination: {
        page_size: 5,
        offset: 0,
      },
      order_by: {
        field: 'revenue',
        method: 'desc',
      },
    }),
  });
  return response.json();
}

async function main() {
  // Search for St. Louis market
  console.log('Searching for St. Louis market...');
  const searchResult = await searchMarket('St. Louis, MO');
  
  if (searchResult?.payload?.results?.length > 0) {
    const market = searchResult.payload.results[0];
    console.log(`Found market: ${market.name} (ID: ${market.id})`);
    
    // Get listings
    console.log(`\nFetching listings for market ${market.id}...`);
    const listingsResult = await getListings(market.id);
    
    if (listingsResult?.payload?.listings?.length > 0) {
      const listings = listingsResult.payload.listings;
      console.log(`Got ${listings.length} listings`);
      
      for (const listing of listings) {
        console.log(`\n--- ${listing.title} ---`);
        console.log(`  property_id: ${listing.property_id}`);
        console.log(`  location: ${JSON.stringify(listing.location)}`);
        
        // Check all keys for location-related fields
        const allKeys = Object.keys(listing);
        const locationKeys = allKeys.filter(k => 
          k.includes('lat') || k.includes('lng') || k.includes('lon') || 
          k.includes('location') || k.includes('coord') || k.includes('geo') ||
          k.includes('address') || k.includes('city') || k.includes('state')
        );
        console.log(`  Location-related keys: ${locationKeys.join(', ')}`);
        for (const key of locationKeys) {
          console.log(`    ${key}: ${JSON.stringify(listing[key])}`);
        }
      }
      
      const withLocation = listings.filter(l => l.location?.lat && l.location?.lng).length;
      console.log(`\n\nSummary: ${withLocation}/${listings.length} listings have location data`);
      
      // Dump ALL keys of first listing
      console.log(`\nAll keys:`, Object.keys(listings[0]).sort().join(', '));
    } else {
      console.log('No listings:', JSON.stringify(listingsResult).slice(0, 500));
    }
  } else {
    console.log('No markets found:', JSON.stringify(searchResult).slice(0, 500));
  }
}

main().catch(console.error);

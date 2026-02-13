import 'dotenv/config';

// Direct API call to check if location data is returned
const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

// Use a known market ID - St. Louis area
const marketId = '18827'; // Try a common market

async function testMarketListings() {
  try {
      const url = `${BASE_URL}/market/${marketId}/listings`;
      console.log('Calling:', url);
      console.log('API Key (first 10 chars):', AIRDNA_API_KEY?.slice(0, 10));
      const response = await fetch(url, {
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

    const data = await response.json();
    
    if (data?.payload?.listings) {
      const listings = data.payload.listings;
      console.log(`Got ${listings.length} listings`);
      
      for (const listing of listings) {
        console.log(`\nListing: ${listing.title}`);
        console.log(`  property_id: ${listing.property_id}`);
        console.log(`  location: ${JSON.stringify(listing.location)}`);
        console.log(`  has lat/lng: ${!!(listing.location?.lat && listing.location?.lng)}`);
        
        // Check all keys at top level for any location-related fields
        const locationKeys = Object.keys(listing).filter(k => 
          k.includes('lat') || k.includes('lng') || k.includes('lon') || 
          k.includes('location') || k.includes('coord') || k.includes('geo')
        );
        if (locationKeys.length > 0) {
          console.log(`  Location-related keys: ${locationKeys.join(', ')}`);
          for (const key of locationKeys) {
            console.log(`    ${key}: ${JSON.stringify(listing[key])}`);
          }
        }
      }
      
      const withLocation = listings.filter(l => l.location?.lat && l.location?.lng).length;
      console.log(`\n\nSummary: ${withLocation}/${listings.length} listings have location data`);
      
      // Also dump all keys of first listing
      if (listings.length > 0) {
        console.log(`\nAll keys of first listing:`, Object.keys(listings[0]).sort().join(', '));
      }
    } else {
      console.log('No listings in response:', JSON.stringify(data).slice(0, 500));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testMarketListings();

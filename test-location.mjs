import dotenv from 'dotenv';
dotenv.config();

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

async function testLocation() {
  const address = '123 Main St, San Diego, CA';
  
  try {
    const response = await fetch(`${BASE_URL}/rentalizer/estimate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRDNA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address,
        bedrooms: 2,
        bathrooms: 1,
        currency: 'usd'
      })
    });
    
    const data = await response.json();
    
    console.log('Location object:', JSON.stringify(data.payload?.location, null, 2));
    
    // Check if there's a market_id anywhere in the response
    const jsonStr = JSON.stringify(data);
    if (jsonStr.includes('market_id')) {
      console.log('\nFound market_id in response!');
      const match = jsonStr.match(/"market_id":\s*"?([^",}]+)"?/);
      if (match) console.log('Market ID:', match[1]);
    } else {
      console.log('\nNo market_id found in response');
    }
    
    // Try to find San Diego market by coordinates
    const lat = data.payload?.location?.lat;
    const lng = data.payload?.location?.lng;
    console.log('\nCoordinates:', lat, lng);
    
    // Search for markets near these coordinates
    if (lat && lng) {
      console.log('\n--- Searching for markets by coordinates ---');
      const marketsResponse = await fetch(`${BASE_URL}/markets?country_code=us`, {
        headers: {
          'Authorization': `Bearer ${AIRDNA_API_KEY}`
        }
      });
      const marketsData = await marketsResponse.json();
      console.log('Markets response status:', marketsResponse.status);
      console.log('Markets count:', marketsData.payload?.markets?.length || 0);
      
      // Look for San Diego in markets
      const markets = marketsData.payload?.markets || [];
      const sanDiego = markets.find(m => m.name?.toLowerCase().includes('san diego'));
      console.log('San Diego market:', sanDiego);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testLocation();

import dotenv from 'dotenv';
dotenv.config();

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

async function testRentalizer() {
  const address = '123 Main St, San Diego, CA';
  
  console.log('Testing Rentalizer with address:', address);
  console.log('API Key:', AIRDNA_API_KEY ? 'Present' : 'Missing');
  
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
    console.log('\nResponse status:', response.status);
    console.log('\nProperty location:', JSON.stringify(data.payload?.details?.location, null, 2));
    console.log('\nMarket ID:', data.payload?.details?.location?.market_id);
    console.log('Submarket ID:', data.payload?.details?.location?.submarket_id);
    console.log('Address lookup:', data.payload?.details?.address_lookup);
    
    // Now get market details for this market_id
    if (data.payload?.details?.location?.market_id) {
      const marketId = data.payload.details.location.market_id;
      console.log('\n--- Getting market details for', marketId, '---');
      
      const marketResponse = await fetch(`${BASE_URL}/market/${marketId}`, {
        headers: {
          'Authorization': `Bearer ${AIRDNA_API_KEY}`
        }
      });
      
      const marketData = await marketResponse.json();
      console.log('Market name:', marketData.payload?.name);
      console.log('Market state:', marketData.payload?.state);
      console.log('Listing count:', marketData.payload?.listing_count);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testRentalizer();

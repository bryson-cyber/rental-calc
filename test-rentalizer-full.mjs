import dotenv from 'dotenv';
dotenv.config();

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

async function testRentalizer() {
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
    
    // Print the full payload structure
    console.log('Full payload keys:', Object.keys(data.payload || {}));
    console.log('\nDetails:', JSON.stringify(data.payload?.details, null, 2));
    
    // Check if location is nested differently
    const details = data.payload?.details;
    if (details) {
      console.log('\nLocation from details:', details.location);
      console.log('Market ID from details:', details.market_id);
      console.log('Submarket ID from details:', details.submarket_id);
    }
    
    // Check the full response
    console.log('\n--- Full response structure ---');
    console.log(JSON.stringify(data, null, 2).slice(0, 3000));
  } catch (error) {
    console.error('Error:', error);
  }
}

testRentalizer();

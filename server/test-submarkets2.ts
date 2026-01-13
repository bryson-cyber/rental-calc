import 'dotenv/config';

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const marketId = 'airdna-market-1073'; // Phoenix/Scottsdale

async function testSubmarkets() {
  console.log('Testing submarkets for Phoenix/Scottsdale...');
  console.log('API Key exists:', !!AIRDNA_API_KEY);
  
  const response = await fetch(
    `https://api.airdna.co/api/enterprise/v2/market/${marketId}/submarkets`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRDNA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pagination: { page_size: 50, offset: 0 }
      })
    }
  );
  
  const data = await response.json();
  console.log('Response status:', response.status);
  console.log('Full response:', JSON.stringify(data, null, 2).slice(0, 2000));
}

testSubmarkets().catch(console.error);

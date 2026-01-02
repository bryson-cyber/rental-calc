// Test avg_revenue API endpoint
const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const marketId = 'airdna-429';

async function testRevenueAPI() {
  console.log('Testing AirDNA avg_revenue API...');
  
  const response = await fetch(`https://api.airdna.co/api/enterprise/v2/market/${marketId}/metrics/avg_revenue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AIRDNA_API_KEY}`
    },
    body: JSON.stringify({ num_months: 12 })
  });
  
  console.log('Response status:', response.status);
  const data = await response.json();
  console.log('Full response:', JSON.stringify(data, null, 2));
  
  if (data.payload?.metrics?.length > 0) {
    console.log('\nFirst metric object keys:', Object.keys(data.payload.metrics[0]));
    console.log('First metric:', data.payload.metrics[0]);
  }
}

testRevenueAPI();

import 'dotenv/config';

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const marketId = 'airdna-market-1073'; // Phoenix/Scottsdale

async function testSubmarkets() {
  console.log('Testing submarkets for Phoenix/Scottsdale...');
  
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
  console.log('Total submarkets:', data.payload?.page_info?.total_count);
  console.log('\nFirst 15 submarkets:');
  data.payload?.submarkets?.slice(0, 15).forEach((s: any, i: number) => {
    console.log(`${i+1}. ${s.name} - Revenue: $${Math.round(s.metrics?.revenue || 0)}`);
  });
  
  // Check if Glendale is in the list
  const glendale = data.payload?.submarkets?.find((s: any) => s.name.toLowerCase().includes('glendale'));
  if (glendale) {
    console.log('\n✅ Glendale found:', glendale.name, '- ID:', glendale.id);
  } else {
    console.log('\n❌ Glendale NOT found in first 50 submarkets');
    // Get all submarkets
    console.log('\nFetching all submarkets...');
  }
}

testSubmarkets().catch(console.error);

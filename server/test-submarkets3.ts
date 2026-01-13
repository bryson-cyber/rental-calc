import 'dotenv/config';

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const marketId = 'airdna-market-1073'; // Phoenix/Scottsdale

async function testSubmarkets() {
  console.log('Testing submarkets for Phoenix/Scottsdale...');
  
  // Fetch all pages
  let allSubmarkets: any[] = [];
  let offset = 0;
  const pageSize = 25;
  let hasMore = true;
  
  while (hasMore) {
    const response = await fetch(
      `https://api.airdna.co/api/enterprise/v2/market/${marketId}/submarkets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRDNA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pagination: { page_size: pageSize, offset }
        })
      }
    );
    
    const data = await response.json();
    const submarkets = data.payload?.submarkets || [];
    const totalCount = data.payload?.page_info?.total_count || 0;
    
    allSubmarkets.push(...submarkets);
    offset += pageSize;
    hasMore = offset < totalCount;
    
    if (offset === pageSize) {
      console.log('Total submarkets:', totalCount);
    }
  }
  
  console.log(`\nFetched ${allSubmarkets.length} submarkets total`);
  console.log('\nFirst 20 submarkets:');
  allSubmarkets.slice(0, 20).forEach((s: any, i: number) => {
    console.log(`${i+1}. ${s.name} - Revenue: $${Math.round(s.metrics?.revenue || 0)}`);
  });
  
  // Check if Glendale is in the list
  const glendale = allSubmarkets.find((s: any) => s.name.toLowerCase().includes('glendale'));
  if (glendale) {
    console.log('\n✅ Glendale found:', glendale.name, '- ID:', glendale.id);
  } else {
    console.log('\n❌ Glendale NOT found');
    console.log('All submarket names:', allSubmarkets.map(s => s.name).join(', '));
  }
}

testSubmarkets().catch(console.error);

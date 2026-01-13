import 'dotenv/config';

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;

async function testSubmarkets() {
  // First, search for Phoenix to get the correct market ID
  console.log('Searching for Phoenix market...');
  
  const searchResponse = await fetch(
    'https://api.airdna.co/api/enterprise/v2/market/search',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRDNA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        term: 'Phoenix',
        pagination: { page_size: 5, offset: 0 }
      })
    }
  );
  
  const searchData = await searchResponse.json();
  console.log('Search results:');
  searchData.payload?.results?.forEach((r: any) => {
    console.log(`- ${r.name} (${r.type}) - ID: ${r.id}`);
  });
  
  // Get the Phoenix market ID
  const phoenixMarket = searchData.payload?.results?.find((r: any) => 
    r.name.includes('Phoenix') && r.type === 'market'
  );
  
  if (!phoenixMarket) {
    console.log('Phoenix market not found');
    return;
  }
  
  console.log('\nUsing market ID:', phoenixMarket.id);
  
  // Now get submarkets using the correct ID format
  const submarketResponse = await fetch(
    `https://api.airdna.co/api/enterprise/v2/market/${phoenixMarket.id}/submarkets`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRDNA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pagination: { page_size: 25, offset: 0 }
      })
    }
  );
  
  const submarketData = await submarketResponse.json();
  console.log('\nSubmarket response status:', submarketResponse.status);
  console.log('Total submarkets:', submarketData.payload?.page_info?.total_count);
  
  const submarkets = submarketData.payload?.submarkets || [];
  console.log('\nFirst 15 submarkets:');
  submarkets.slice(0, 15).forEach((s: any, i: number) => {
    console.log(`${i+1}. ${s.name} - ID: ${s.id}`);
  });
  
  // Check if Glendale is there
  const glendale = submarkets.find((s: any) => s.name.toLowerCase().includes('glendale'));
  if (glendale) {
    console.log('\n✅ Glendale found:', glendale.name, '- ID:', glendale.id);
  } else {
    console.log('\n❌ Glendale NOT in first 25 submarkets');
  }
}

testSubmarkets().catch(console.error);

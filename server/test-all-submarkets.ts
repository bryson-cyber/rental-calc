import 'dotenv/config';

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;

async function testAllSubmarkets() {
  const marketId = 'airdna-417'; // Phoenix/Scottsdale
  
  console.log('Fetching all 44 submarkets for Phoenix/Scottsdale...');
  
  let allSubmarkets: any[] = [];
  let offset = 0;
  const pageSize = 25;
  
  while (offset < 50) {
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
    allSubmarkets.push(...submarkets);
    offset += pageSize;
    
    if (submarkets.length < pageSize) break;
  }
  
  console.log(`Total fetched: ${allSubmarkets.length} submarkets`);
  console.log('\nAll submarkets:');
  allSubmarkets.forEach((s: any, i: number) => {
    console.log(`${i+1}. ${s.name}`);
  });
  
  // Check for Glendale
  const glendale = allSubmarkets.find((s: any) => s.name.toLowerCase().includes('glendale'));
  if (glendale) {
    console.log('\n✅ Glendale found:', glendale.name, '- ID:', glendale.id);
  } else {
    console.log('\n❌ Glendale NOT found in any of the 44 submarkets');
    console.log('\nLooking for similar names...');
    const similar = allSubmarkets.filter((s: any) => 
      s.name.toLowerCase().includes('glen') || 
      s.name.toLowerCase().includes('dale') ||
      s.name.toLowerCase().includes('avon') ||
      s.name.toLowerCase().includes('goodyear')
    );
    similar.forEach(s => console.log(`  - ${s.name}`));
  }
}

testAllSubmarkets().catch(console.error);

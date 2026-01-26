// Test if submarkets are returned for Atlanta
const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;

async function testSubmarkets() {
  // First get the Atlanta market ID
  const searchResponse = await fetch(
    `https://api.airdna.co/api/enterprise/v2/market/search?access_token=${AIRDNA_API_KEY}&term=Atlanta`,
    { method: 'GET' }
  );
  const searchData = await searchResponse.json();
  console.log('Search results:', searchData.payload?.results?.slice(0, 3).map(r => ({ id: r.id, name: r.name })));
  
  const atlantaMarket = searchData.payload?.results?.find(r => r.name === 'Atlanta, Georgia');
  if (!atlantaMarket) {
    console.log('Atlanta not found');
    return;
  }
  
  console.log('Atlanta market ID:', atlantaMarket.id);
  
  // Now get submarkets
  const subResponse = await fetch(
    `https://api.airdna.co/api/enterprise/v2/market/${atlantaMarket.id}/submarkets`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AIRDNA_API_KEY}`
      },
      body: JSON.stringify({ limit: 10, offset: 0 })
    }
  );
  const subData = await subResponse.json();
  console.log('Submarkets response:', JSON.stringify(subData, null, 2).slice(0, 2000));
}

testSubmarkets().catch(console.error);

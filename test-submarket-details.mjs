import 'dotenv/config';

const API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

// Clayton submarket ID from the St. Louis market
// We need to find this ID first
async function getStLouisSubmarkets() {
  // First, search for St. Louis to get its market ID
  const searchUrl = `${BASE_URL}/market/search?access_token=${API_KEY}&term=Saint%20Louis&limit=5`;
  
  console.log('Searching for St. Louis...');
  const searchResponse = await fetch(searchUrl);
  const searchData = await searchResponse.json();
  
  console.log('Search response:', JSON.stringify(searchData, null, 2).slice(0, 1000));
  
  // Get the St. Louis market ID
  const stLouisMarket = searchData.find?.(r => r.name?.includes('St. Louis') && r.type === 'market');
  if (!stLouisMarket) {
    console.log('Could not find St. Louis market');
    return;
  }
  
  console.log('\nSt. Louis market:', stLouisMarket.name, 'ID:', stLouisMarket.id);
  
  // Now get the submarkets
  const submarketUrl = `${BASE_URL}/market/${stLouisMarket.id}/submarkets?access_token=${API_KEY}`;
  console.log('\nFetching submarkets...');
  
  const submarketResponse = await fetch(submarketUrl);
  const submarketData = await submarketResponse.json();
  
  console.log('Submarket response keys:', Object.keys(submarketData));
  
  // Find Clayton
  const submarkets = submarketData.submarkets || submarketData.payload?.submarkets || [];
  const clayton = submarkets.find(s => s.name?.toLowerCase().includes('clayton'));
  
  if (clayton) {
    console.log('\n=== Clayton Submarket ===');
    console.log(JSON.stringify(clayton, null, 2));
  } else {
    console.log('\nClayton not found in submarkets');
    console.log('Available submarkets:', submarkets.slice(0, 5).map(s => s.name));
  }
}

getStLouisSubmarkets().catch(console.error);

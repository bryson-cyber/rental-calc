// Test the full flow to see what's happening
const API_KEY = process.env.AIRDNA_API_KEY;

async function testFlow() {
  // 1. Search for South Beach
  console.log('=== Step 1: Search for South Beach ===');
  const searchUrl = 'https://api.airdna.co/api/enterprise/v2/market/search?access_token=' + API_KEY;
  const searchRes = await fetch(searchUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      search_term: 'South Beach',
      pagination: { page_size: 15, offset: 0 }
    })
  });
  const searchData = await searchRes.json();
  const southBeach = searchData.payload?.results?.find(r => r.name === 'South Beach' && r.location?.state === 'Florida');
  console.log('Found South Beach:', southBeach?.id, southBeach?.name, 'listings:', southBeach?.listing_count);
  
  if (!southBeach) {
    console.log('South Beach not found!');
    return;
  }
  
  // 2. Get submarket details
  console.log('\n=== Step 2: Get Submarket Details ===');
  const detailsUrl = 'https://api.airdna.co/api/enterprise/v2/submarket/' + southBeach.id + '?access_token=' + API_KEY;
  const detailsRes = await fetch(detailsUrl);
  const detailsData = await detailsRes.json();
  console.log('Submarket metrics:', JSON.stringify(detailsData.payload?.metrics, null, 2));
  
  // 3. Check if metrics.revenue > 0
  const metrics = detailsData.payload?.metrics;
  if (metrics && metrics.revenue > 0) {
    console.log('\n=== Calculated values ===');
    console.log('occupancy:', Math.round(metrics.booked * 100), '%');
    console.log('adr:', Math.round(metrics.daily_rate));
    console.log('revenue:', Math.round(metrics.revenue));
    console.log('revpar:', Math.round(metrics.revpar));
  } else {
    console.log('\nWARNING: metrics.revenue is 0 or missing!');
    console.log('metrics:', metrics);
  }
}

testFlow().catch(console.error);

// Direct API test with enterprise endpoint
const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const marketId = 'airdna-429';

async function testAPI() {
  console.log('Testing AirDNA Enterprise API...');
  console.log('API Key present:', !!AIRDNA_API_KEY);
  
  // First, let's search for St. Louis to get the correct market ID
  try {
    const searchResponse = await fetch('https://api.airdna.co/api/enterprise/v2/market/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AIRDNA_API_KEY}`
      },
      body: JSON.stringify({ 
        search_term: "St. Louis",
        pagination: { page_size: 5, offset: 0 }
      })
    });
    
    console.log('Search Response status:', searchResponse.status);
    const searchData = await searchResponse.json();
    console.log('Search results:', JSON.stringify(searchData, null, 2).slice(0, 1500));
    
    if (searchData.payload?.results?.length > 0) {
      const marketId = searchData.payload.results[0].id;
      console.log('\nUsing market ID:', marketId);
      
      // Now test the occupancy endpoint
      const metricsResponse = await fetch(`https://api.airdna.co/api/enterprise/v2/market/${marketId}/metrics/occupancy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AIRDNA_API_KEY}`
        },
        body: JSON.stringify({ num_months: 12 })
      });
      
      console.log('\nMetrics Response status:', metricsResponse.status);
      const metricsData = await metricsResponse.json();
      console.log('Metrics results:', JSON.stringify(metricsData, null, 2).slice(0, 2000));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();

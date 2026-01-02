// Direct API test to see raw response
const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const marketId = 'airdna-429';

async function testAPI() {
  console.log('Testing AirDNA API directly...');
  console.log('API Key present:', !!AIRDNA_API_KEY);
  
  try {
    const response = await fetch(`https://api.airdna.co/api/v2/market/${marketId}/metrics/occupancy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AIRDNA_API_KEY || ''
      },
      body: JSON.stringify({ num_months: 12 })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response body (first 2000 chars):', text.slice(0, 2000));
    
    try {
      const data = JSON.parse(text);
      console.log('Parsed response keys:', Object.keys(data));
      if (data.payload) {
        console.log('Payload keys:', Object.keys(data.payload));
        if (data.payload.results) {
          console.log('Results count:', data.payload.results.length);
          if (data.payload.results.length > 0) {
            console.log('First result:', data.payload.results[0]);
          }
        }
      }
    } catch (e) {
      console.log('Could not parse as JSON');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();

async function test() {
  const apiKey = process.env.AIRDNA_API_KEY;
  console.log('API Key exists:', !!apiKey);
  
  const searchResponse = await fetch('https://api.airdna.co/api/explorer/v2/search/markets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      search_term: 'Glendale',
      limit: 5
    })
  });
  
  const text = await searchResponse.text();
  console.log('Response status:', searchResponse.status);
  console.log('Response:', text.substring(0, 500));
}

test().catch(console.error);

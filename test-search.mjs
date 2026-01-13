import fetch from 'node-fetch';

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const AIRDNA_API_BASE = "https://api.airdna.co/api/enterprise/v2";

async function searchMarkets(searchTerm) {
  // First get all US markets
  const response = await fetch(`${AIRDNA_API_BASE}/country/us/markets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pagination: { page_size: 25, offset: 0 }
    })
  });
  
  const data = await response.json();
  console.log('First page of markets:', data.payload?.markets?.slice(0, 10).map(m => m.name));
  
  // Now search for San Diego specifically
  const searchLower = searchTerm.toLowerCase();
  const matches = data.payload?.markets?.filter(m => 
    m.name.toLowerCase().includes(searchLower)
  );
  
  console.log(`\nMatches for "${searchTerm}":`, matches?.map(m => ({ id: m.id, name: m.name })));
  
  return matches;
}

searchMarkets('San Diego').catch(console.error);

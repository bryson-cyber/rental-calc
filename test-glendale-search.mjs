// Test script to check what the AirDNA API returns for Glendale search
import 'dotenv/config';

const API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

async function searchGlendale() {
  const response = await fetch(`${BASE_URL}/market/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      search_term: 'Glendale',
      pagination: {
        page_size: 10,
        offset: 0
      }
    })
  });
  
  const data = await response.json();
  console.log('Search results for "Glendale":');
  console.log(JSON.stringify(data, null, 2));
  
  // Check specifically for Arizona Glendale
  const glendale = data.payload?.results?.find(r => 
    r.name === 'Glendale' && 
    (r.location_name?.includes('Arizona') || r.location?.state === 'Arizona')
  );
  
  if (glendale) {
    console.log('\n\nGlendale, AZ details:');
    console.log('ID:', glendale.id);
    console.log('Name:', glendale.name);
    console.log('Type:', glendale.type);
    console.log('Location:', glendale.location_name);
    console.log('Legacy Location:', JSON.stringify(glendale.legacy_location, null, 2));
    console.log('Zipcodes:', glendale.legacy_location?.zipcodes);
  } else {
    console.log('\n\nGlendale, AZ not found in results');
  }
}

searchGlendale().catch(console.error);

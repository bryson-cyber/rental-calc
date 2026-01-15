import 'dotenv/config';

const API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

async function searchClayton() {
  const url = `${BASE_URL}/market/search?access_token=${API_KEY}&term=Clayton&limit=15`;
  
  console.log('Searching for Clayton, Missouri...');
  console.log('URL:', url.replace(API_KEY, 'REDACTED'));
  
  const response = await fetch(url);
  const data = await response.json();
  
  console.log('\n=== API Response ===');
  console.log('Response:', JSON.stringify(data, null, 2).slice(0, 2000));
  
  if (data.length > 0) {
    console.log('\n=== Results with zipcodes ===');
    for (const result of data) {
      const zipcodes = result.legacy_location?.zipcodes || [];
      const state = result.location?.state || 'N/A';
      console.log(`- ${result.name} (${result.type}) in ${state}: ${zipcodes.length} zipcodes`);
      if (zipcodes.length > 0) {
        console.log(`  Zipcodes: ${zipcodes.join(', ')}`);
      }
    }
    
    // Check if any result matches "Clayton" in Missouri
    console.log('\n=== Checking for Missouri matches ===');
    for (const result of data) {
      const state = result.location?.state || '';
      const name = result.name || '';
      const zipcodes = result.legacy_location?.zipcodes || [];
      
      if (state.toLowerCase().includes('missouri') || state.toLowerCase() === 'mo') {
        console.log(`MATCH: ${name} in ${state} with ${zipcodes.length} zipcodes`);
        if (zipcodes.length > 0) {
          console.log(`  Zipcodes: ${zipcodes.join(', ')}`);
        }
      }
    }
  }
}

searchClayton().catch(console.error);

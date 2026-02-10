import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.AIRDNA_API_KEY;

async function searchMarketsAPI(term) {
  const response = await fetch(`https://api.airdna.co/api/enterprise/v2/market/search?term=${encodeURIComponent(term)}&limit=25`, {
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
    },
  });
  const data = await response.json();
  return data;
}

async function getAllUSMarketsSearch(term) {
  // Also test the local fuzzy search by fetching all US markets
  const response = await fetch(`https://api.airdna.co/api/enterprise/v2/market/list?access_token=${API_KEY}&country_code=us`, {
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
    },
  });
  const data = await response.json();
  const markets = data.payload?.markets || [];
  const fayettevilleMarkets = markets.filter(m => 
    m.name?.toLowerCase().includes('fayetteville')
  );
  return fayettevilleMarkets;
}

async function main() {
  console.log("=== AirDNA Market Search API for 'Fayetteville' ===");
  const apiResults = await searchMarketsAPI('Fayetteville');
  console.log("API Results:", JSON.stringify(apiResults, null, 2));
  
  console.log("\n=== All US Markets containing 'Fayetteville' ===");
  const localResults = await getAllUSMarketsSearch('Fayetteville');
  console.log("Local Results:", JSON.stringify(localResults.map(m => ({
    id: m.id,
    name: m.name,
    type: m.type,
    listing_count: m.listing_count,
    state: m.name?.includes(',') ? m.name.split(',')[1]?.trim() : 'NO STATE IN NAME',
  })), null, 2));
}

async function testZipAndLatLng() {
  console.log("\n=== AirDNA Market Search API for zip '28303' ===");
  const zipResults = await searchMarketsAPI('28303');
  console.log("Zip Results:", JSON.stringify(zipResults, null, 2));
  
  console.log("\n=== AirDNA Market Search API for 'Fayetteville NC' ===");
  const ncResults = await searchMarketsAPI('Fayetteville NC');
  console.log("NC Results:", JSON.stringify(ncResults, null, 2));
  
  console.log("\n=== AirDNA Market Search API for 'Fayetteville, NC' ===");
  const ncResults2 = await searchMarketsAPI('Fayetteville, NC');
  console.log("NC Results2:", JSON.stringify(ncResults2, null, 2));
  
  console.log("\n=== AirDNA Market Search API for 'Fort Bragg' ===");
  const braggResults = await searchMarketsAPI('Fort Bragg');
  console.log("Fort Bragg Results:", JSON.stringify(braggResults, null, 2));
}

main().then(testZipAndLatLng).catch(console.error);

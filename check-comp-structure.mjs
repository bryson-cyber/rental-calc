import dotenv from 'dotenv';
dotenv.config();

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;

async function checkCompStructure() {
  const address = "4567 Ocean Blvd, San Diego, CA 92109";
  const url = `https://api.airdna.co/api/enterprise/v2/rentalizer/estimate`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      address: address,
      bedrooms: 2,
      bathrooms: 1,
      currency: 'usd'
    })
  });
  
  const data = await response.json();
  
  console.log("=== COMP STRUCTURE ANALYSIS ===\n");
  
  if (data.payload?.comps && data.payload.comps.length > 0) {
    const comp = data.payload.comps[0];
    console.log("First comp keys:", Object.keys(comp));
    console.log("\ncomp.stats keys:", comp.stats ? Object.keys(comp.stats) : 'no stats');
    console.log("\ncomp.stats.metrics exists:", !!comp.stats?.metrics);
    console.log("comp.stats.metrics length:", comp.stats?.metrics?.length || 0);
    
    if (comp.stats?.metrics && comp.stats.metrics.length > 0) {
      console.log("\nFirst metric:", JSON.stringify(comp.stats.metrics[0], null, 2));
      console.log("\nAll metrics dates:", comp.stats.metrics.map(m => m.date));
    } else {
      console.log("\nNo metrics in comp.stats.metrics");
      console.log("\nFull comp.stats:", JSON.stringify(comp.stats, null, 2));
    }
    
    // Check if there's location data
    console.log("\ncomp.location:", comp.location);
    console.log("comp.details.latitude:", comp.details?.latitude);
  }
  
  // Also check the main property's monthly forecast
  console.log("\n=== MAIN PROPERTY FORECAST ===");
  if (data.payload?.stats?.future?.metrics) {
    console.log("Monthly forecast length:", data.payload.stats.future.metrics.length);
    console.log("First month:", JSON.stringify(data.payload.stats.future.metrics[0], null, 2));
    console.log("All months:", data.payload.stats.future.metrics.map(m => `${m.date}: occ=${m.occupancy}, adr=${m.adr}, rev=${m.revenue}`));
  }
}

checkCompStructure().catch(console.error);

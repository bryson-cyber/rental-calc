import dotenv from 'dotenv';
dotenv.config();

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;

async function testSeasonality() {
  // First get rentalizer data for a San Diego address
  const address = "123 Main St, San Diego, CA";
  const url = `https://api.airdna.co/api/enterprise/v2/rentalizer/ltm?access_token=${AIRDNA_API_KEY}&address=${encodeURIComponent(address)}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  console.log("=== FULL SEASONALITY DATA ===\n");
  
  if (data.payload?.stats?.future?.metrics) {
    const metrics = data.payload.stats.future.metrics;
    console.log("Monthly Forecast Data:");
    metrics.forEach((m, i) => {
      console.log(`Month ${i+1}: ${m.month} - Occupancy: ${Math.round(m.occ * 100)}%, ADR: $${Math.round(m.adr)}, Revenue: $${Math.round(m.revenue)}`);
    });
  }
  
  // Also check the comps for their seasonality
  if (data.payload?.comps?.length > 0) {
    console.log("\n=== COMP SEASONALITY (first comp) ===");
    const comp = data.payload.comps[0];
    if (comp.stats?.summary) {
      console.log("Summary stats:", JSON.stringify(comp.stats.summary, null, 2));
    }
  }
}

testSeasonality().catch(console.error);

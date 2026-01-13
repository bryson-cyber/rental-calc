import dotenv from 'dotenv';
dotenv.config();

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;

async function testSeasonality() {
  const address = "123 Main St, San Diego, CA";
  const url = `https://api.airdna.co/api/enterprise/v2/rentalizer/ltm?access_token=${AIRDNA_API_KEY}&address=${encodeURIComponent(address)}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  console.log("API Response status:", data.status);
  console.log("Has payload:", !!data.payload);
  console.log("Has stats:", !!data.payload?.stats);
  console.log("Has future:", !!data.payload?.stats?.future);
  console.log("Has metrics:", !!data.payload?.stats?.future?.metrics);
  
  if (data.payload?.stats?.future?.metrics) {
    const metrics = data.payload.stats.future.metrics;
    console.log("\n=== FULL 12-MONTH SEASONALITY ===\n");
    console.log("OCCUPANCY BY MONTH:");
    metrics.forEach((m, i) => {
      const monthName = new Date(2024, i, 1).toLocaleString('en-US', { month: 'short' });
      console.log(`  ${monthName}: ${Math.round(m.occ * 100)}%`);
    });
    
    console.log("\nAVERAGE DAILY RATE BY MONTH:");
    metrics.forEach((m, i) => {
      const monthName = new Date(2024, i, 1).toLocaleString('en-US', { month: 'short' });
      console.log(`  ${monthName}: $${Math.round(m.adr)}`);
    });
    
    console.log("\nREVENUE BY MONTH:");
    metrics.forEach((m, i) => {
      const monthName = new Date(2024, i, 1).toLocaleString('en-US', { month: 'short' });
      console.log(`  ${monthName}: $${Math.round(m.revenue).toLocaleString()}`);
    });
  } else {
    console.log("No metrics found. Full response:");
    console.log(JSON.stringify(data, null, 2).slice(0, 2000));
  }
}

testSeasonality().catch(console.error);

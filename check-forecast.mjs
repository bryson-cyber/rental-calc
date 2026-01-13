import dotenv from 'dotenv';
dotenv.config();

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;

async function checkForecast() {
  const address = "123 Main St, San Diego, CA 92101";
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
  
  console.log("=== CHECKING FORECAST STRUCTURE ===\n");
  
  // Check the structure of the response
  console.log("Top-level keys:", Object.keys(data));
  console.log("payload keys:", data.payload ? Object.keys(data.payload) : 'no payload');
  
  if (data.payload?.stats) {
    console.log("\npayload.stats keys:", Object.keys(data.payload.stats));
    
    if (data.payload.stats.future) {
      console.log("payload.stats.future keys:", Object.keys(data.payload.stats.future));
      
      if (data.payload.stats.future.metrics) {
        console.log("\n=== MONTHLY FORECAST (payload.stats.future.metrics) ===");
        console.log("Length:", data.payload.stats.future.metrics.length);
        data.payload.stats.future.metrics.forEach((m, i) => {
          console.log(`Month ${i+1}: ${m.date} - Occ: ${(m.occupancy*100).toFixed(0)}%, ADR: $${m.adr.toFixed(0)}, Rev: $${m.revenue.toFixed(0)}`);
        });
      }
    }
  }
  
  // Also check if there's a monthly_forecast at the top level
  if (data.payload?.monthly_forecast) {
    console.log("\n=== TOP-LEVEL monthly_forecast ===");
    console.log(JSON.stringify(data.payload.monthly_forecast, null, 2));
  }
}

checkForecast().catch(console.error);

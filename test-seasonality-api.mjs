import dotenv from 'dotenv';
dotenv.config();

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;

async function testSeasonality() {
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
  
  console.log("=== CHECKING stats.future.metrics ===");
  if (data.payload?.stats?.future?.metrics) {
    console.log("Found stats.future.metrics!");
    console.log("Length:", data.payload.stats.future.metrics.length);
    data.payload.stats.future.metrics.forEach((m, i) => {
      console.log(`${m.date}: Occ ${(m.occupancy*100).toFixed(0)}%, ADR $${m.adr.toFixed(0)}, Rev $${m.revenue.toFixed(0)}`);
    });
  } else {
    console.log("No stats.future.metrics found");
    console.log("payload keys:", data.payload ? Object.keys(data.payload) : 'no payload');
    if (data.payload?.stats) {
      console.log("stats keys:", Object.keys(data.payload.stats));
    }
  }
}

testSeasonality().catch(console.error);

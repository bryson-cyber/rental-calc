import dotenv from 'dotenv';
dotenv.config();

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;

async function testForecast() {
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
  
  // Simulate the transformation done by getRentalizerEstimate
  const monthly_forecast = data.payload.stats.future.metrics.map((m) => ({
    month: m.date,
    revenue: m.revenue,
    adr: m.adr,
    occupancy: m.occupancy,
  }));
  
  console.log("=== TRANSFORMED monthly_forecast ===");
  monthly_forecast.forEach((m, i) => {
    console.log(`${m.month}: Occ ${m.occupancy}, ADR ${m.adr}, Rev ${m.revenue}`);
  });
  
  // Now simulate the processing in getMarketReportByLocation
  console.log("\n=== PROCESSED FOR FRONTEND ===");
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const monthlyData = monthly_forecast.map((m) => {
    let monthName = m.month;
    if (monthName && monthName.includes('-')) {
      const monthNum = parseInt(monthName.split('-')[1], 10) - 1;
      monthName = monthNames[monthNum] || monthName;
    }
    const occ = m.occupancy || 0;
    return {
      month: monthName,
      occupancy: occ > 1 ? Math.round(occ) : Math.round(occ * 100),
      adr: Math.round(m.adr || 0),
      revenue: Math.round(m.revenue || 0)
    };
  });
  
  monthlyData.forEach((m, i) => {
    console.log(`${m.month}: Occ ${m.occupancy}%, ADR $${m.adr}, Rev $${m.revenue}`);
  });
}

testForecast().catch(console.error);

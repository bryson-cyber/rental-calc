import dotenv from 'dotenv';
dotenv.config();

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;

async function checkComps() {
  // Test with a San Diego address
  const address = "4567 Ocean Blvd, San Diego, CA 92109";
  const url = `https://api.airdna.co/api/enterprise/v2/rentalizer?access_token=${AIRDNA_API_KEY}&address=${encodeURIComponent(address)}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  console.log("=== SAN DIEGO COMPS ANALYSIS ===\n");
  console.log("Address searched:", address);
  console.log("Number of comps:", data.payload?.comps?.length || 0);
  
  if (data.payload?.comps) {
    console.log("\n=== COMP LOCATIONS ===");
    data.payload.comps.forEach((comp, i) => {
      const title = comp.details?.title || 'Unknown';
      const lat = comp.location?.lat;
      const lng = comp.location?.lng;
      const distance = comp.distance_meters;
      console.log(`${i+1}. ${title}`);
      console.log(`   Lat/Lng: ${lat}, ${lng}`);
      console.log(`   Distance: ${distance}m (${(distance/1609).toFixed(1)} miles)`);
    });
    
    // Check if any comps are in Mexico (lat < 32.5 is likely Tijuana)
    const mexicoComps = data.payload.comps.filter(c => c.location?.lat < 32.55);
    console.log(`\n=== COMPS IN MEXICO: ${mexicoComps.length} ===`);
    
    // Get only US comps
    const usComps = data.payload.comps.filter(c => c.location?.lat >= 32.55);
    console.log(`=== COMPS IN US: ${usComps.length} ===`);
    
    if (usComps.length > 0) {
      console.log("\n=== AGGREGATED US SEASONALITY (12 months) ===");
      
      // Aggregate monthly data across all US comps
      const monthlyData = {};
      usComps.forEach(comp => {
        if (comp.stats?.metrics) {
          comp.stats.metrics.forEach(m => {
            if (!monthlyData[m.date]) {
              monthlyData[m.date] = { occupancies: [], adrs: [], revenues: [] };
            }
            monthlyData[m.date].occupancies.push(m.occupancy);
            monthlyData[m.date].adrs.push(m.adr);
            monthlyData[m.date].revenues.push(m.revenue);
          });
        }
      });
      
      console.log("\nOCCUPANCY BY MONTH (averaged across US comps):");
      Object.keys(monthlyData).sort().forEach(date => {
        const avg = monthlyData[date].occupancies.reduce((a,b) => a+b, 0) / monthlyData[date].occupancies.length;
        console.log(`  ${date}: ${Math.round(avg * 100)}%`);
      });
      
      console.log("\nAVERAGE DAILY RATE BY MONTH:");
      Object.keys(monthlyData).sort().forEach(date => {
        const avg = monthlyData[date].adrs.reduce((a,b) => a+b, 0) / monthlyData[date].adrs.length;
        console.log(`  ${date}: $${Math.round(avg)}`);
      });
    }
  }
}

checkComps().catch(console.error);

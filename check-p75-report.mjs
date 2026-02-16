import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(
  "SELECT reportData FROM shared_reports WHERE shareId = 'v4rqx71gmlpohw32'"
);

if (rows.length === 0) {
  console.log("Report not found");
  process.exit(1);
}

const data = JSON.parse(rows[0].reportData);

console.log("=== LOCATION ===");
console.log("City:", data.property?.city);
console.log("State:", data.property?.state);

console.log("\n=== REVENUE ESTIMATE ===");
const rev = data.revenue_estimate;
if (rev) {
  console.log("Annual Revenue:", rev.annual_revenue);
  console.log("ADR:", rev.average_daily_rate);
  console.log("Occupancy:", rev.occupancy_rate);
  console.log("Revenue Low:", rev.annual_revenue_low);
  console.log("Revenue High:", rev.annual_revenue_high);
}

console.log("\n=== ORIGINAL RENTALIZER (if stored) ===");
const orig = data._original_rentalizer || data.original_rentalizer;
if (orig) {
  console.log("Original Revenue:", orig.annual_revenue);
  console.log("Original ADR:", orig.average_daily_rate);
} else {
  console.log("No original rentalizer data found");
  // Check in property object
  const propOrig = data.property?._original_rentalizer;
  if (propOrig) {
    console.log("Found in property._original_rentalizer:");
    console.log("Original Revenue:", propOrig.annual_revenue);
    console.log("Original ADR:", propOrig.average_daily_rate);
  }
}

console.log("\n=== COMP MEDIAN ADJUSTMENT ===");
console.log("comp_median_adjustment:", JSON.stringify(data.comp_median_adjustment));

console.log("\n=== SAME BEDROOM COMPS (first 5) ===");
const comps = data.same_bedroom_comps || [];
comps.slice(0, 5).forEach((c, i) => {
  console.log(`  ${i+1}. ${c.bedrooms}BR/${c.bathrooms}BA - Revenue: $${c.annual_revenue}, ADR: $${c.adr}`);
});
console.log(`Total same-bedroom comps: ${comps.length}`);

console.log("\n=== MONTHLY FORECAST (first 3) ===");
const forecast = data.monthly_forecast || [];
forecast.slice(0, 3).forEach((m, i) => {
  console.log(`  ${m.month}: Revenue $${m.revenue}, ADR $${m.adr}, Occ ${m.occupancy}`);
});

await conn.end();

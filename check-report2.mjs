import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT reportData FROM shared_reports WHERE shareId = 'm7p8eczxmlpnsw4a'"
);
if (rows.length === 0) {
  console.log('No report found');
  await conn.end();
  process.exit(0);
}
const data = JSON.parse(rows[0].reportData);

console.log('=== LOCATION ===');
console.log('City:', data.property?.city);
console.log('State:', data.property?.state);

console.log('\n=== REVENUE ESTIMATE ===');
const rev = data.revenue_estimate;
console.log('Annual:', rev?.annual);
console.log('Monthly:', rev?.monthly);
console.log('Nightly (ADR):', rev?.nightly);
console.log('Occupancy:', rev?.occupancy);
console.log('Range:', rev?.range);

console.log('\n=== COMPS (first 5) ===');
const comps = data.comps || [];
comps.slice(0, 5).forEach(function(c, i) {
  console.log('Comp ' + (i+1) + ': ' + c.bedrooms + 'BR/' + c.bathrooms + 'BA - Revenue: $' + c.annual_revenue + ' - ADR: $' + c.adr);
});

console.log('\n=== SAME BEDROOM COMPS (first 5) ===');
const sameComps = data.same_bedroom_comps || [];
sameComps.slice(0, 5).forEach(function(c, i) {
  console.log('Comp ' + (i+1) + ': ' + c.bedrooms + 'BR/' + c.bathrooms + 'BA - Revenue: $' + c.annual_revenue + ' - ADR: $' + c.adr);
});

console.log('\n=== MONTHLY FORECAST (first 3) ===');
const forecast = data.monthly_forecast || [];
forecast.slice(0, 3).forEach(function(m) {
  console.log(m.month + ': Revenue $' + m.revenue + ', ADR $' + m.adr + ', Occ ' + m.occupancy);
});

console.log('\n=== RENTAL ARBITRAGE ===');
console.log(JSON.stringify(data.rental_arbitrage, null, 2));

await conn.end();

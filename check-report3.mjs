import 'dotenv/config';
import mysql from 'mysql2/promise';

const shareId = process.argv[2] || 'aofz36q5mlpnv048';
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  `SELECT reportData FROM shared_reports WHERE shareId = ?`, [shareId]
);
if (rows.length === 0) {
  console.log('No report found for shareId:', shareId);
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
console.log('Range:', JSON.stringify(rev?.range));

console.log('\n=== SAME BEDROOM COMPS ===');
const sameComps = data.same_bedroom_comps || [];
console.log('Total same_bedroom_comps:', sameComps.length);
sameComps.slice(0, 8).forEach(function(c, i) {
  console.log(`  Comp ${i+1}: ${c.bedrooms}BR/${c.bathrooms}BA - Revenue: $${c.annual_revenue} - ADR: $${Math.round(c.adr)}`);
});

// Calculate what the median should be
const exactMatch = sameComps.filter(c => c.bedrooms === 2 && Math.abs(c.bathrooms - 1) <= 0.5 && c.annual_revenue > 0);
console.log('\n=== EXACT MATCH COMPS (2BR/1BA ±0.5) ===');
console.log('Count:', exactMatch.length);
if (exactMatch.length > 0) {
  const revenues = exactMatch.map(c => c.annual_revenue).sort((a, b) => a - b);
  const mid = Math.floor(revenues.length / 2);
  const median = revenues.length % 2 === 0 ? Math.round((revenues[mid-1] + revenues[mid]) / 2) : revenues[mid];
  console.log('Revenues:', revenues.map(r => '$' + r).join(', '));
  console.log('Median revenue:', '$' + median);
  console.log('Current headline:', '$' + rev?.annual);
  console.log('Should adjust?', median > rev?.annual ? 'YES - median is higher' : 'NO - Rentalizer is already higher');
}

await conn.end();

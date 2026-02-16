import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute("SELECT reportData FROM shared_reports WHERE shareId = 'blrk6nx0mlpoxohr'");
const data = JSON.parse(rows[0].reportData);

console.log('=== REVENUE ===');
console.log('Revenue estimate:', JSON.stringify(data.revenue_estimate, null, 2));

console.log('\n=== COMPS ===');
const comps = data.same_bedroom_comps || data.comps || [];
console.log('Total comps:', comps.length);
const exact2br1ba = comps.filter(c => c.bedrooms === 2 && Math.abs(c.bathrooms - 1) <= 0.5);
console.log('Exact 2BR/1BA comps:', exact2br1ba.length);
console.log('Revenues:', exact2br1ba.map(c => c.annual_revenue).sort((a,b) => b-a));

// Calculate what P75 should be
const sorted = exact2br1ba.map(c => c.annual_revenue).filter(r => r > 0).sort((a,b) => a-b);
if (sorted.length >= 3) {
  const idx = Math.max(0, Math.ceil((75/100) * sorted.length) - 1);
  const p75 = sorted[idx];
  const rentalizer = 20889;
  const maxCap = rentalizer * 2;
  const target = Math.min(p75, maxCap);
  console.log('\n=== EXPECTED P75 ADJUSTMENT ===');
  console.log('P75 of comps:', p75);
  console.log('Rentalizer:', rentalizer);
  console.log('2x cap:', maxCap);
  console.log('Target (min of P75, cap):', target);
  console.log('Should adjust?', target > rentalizer ? 'YES' : 'NO');
}

console.log('\n=== TOP-LEVEL KEYS ===');
console.log(Object.keys(data).join(', '));

await conn.end();

import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

// The user was looking at share ID 1byhaxuxmlibqtbt
const [rows] = await conn.execute(
  `SELECT reportData, address FROM shared_reports WHERE shareId = '1byhaxuxmlibqtbt' LIMIT 1`
);

if (rows.length === 0) {
  console.log('No report found for shareId 1byhaxuxmlibqtbt');
  await conn.end();
  process.exit(1);
}

const raw = rows[0].reportData;
const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
console.log(`Report for: ${rows[0].address}\n`);

console.log('=== MONTHLY FORECAST (future data) ===');
if (data.monthly_forecast) {
  data.monthly_forecast.forEach(m => {
    console.log(`  ${m.month}: revenue=$${m.revenue}, occ=${(m.occupancy * 100).toFixed(0)}%, adr=$${m.adr}`);
  });
  console.log(`  Total forecast months: ${data.monthly_forecast.length}`);
  const foreAvg = data.monthly_forecast.reduce((s, m) => s + m.revenue, 0) / data.monthly_forecast.length;
  console.log(`  Average monthly forecast revenue: $${foreAvg.toFixed(0)}`);
}

console.log('\n=== HISTORICAL DATA (past data) ===');
if (data.historical_data?.months) {
  data.historical_data.months.forEach(m => {
    console.log(`  ${m.month}: revenue=$${m.revenue}, occ=${(m.occupancy * 100).toFixed(0)}%, adr=$${m.adr}`);
  });
  console.log(`  Total historical months: ${data.historical_data.months.length}`);
  const histAvg = data.historical_data.months.reduce((s, m) => s + m.revenue, 0) / data.historical_data.months.length;
  console.log(`  Average monthly historical revenue: $${histAvg.toFixed(0)}`);
}

console.log('\n=== COMPARISON ===');
if (data.historical_data?.months && data.monthly_forecast) {
  const histAvg = data.historical_data.months.reduce((s, m) => s + m.revenue, 0) / data.historical_data.months.length;
  const foreAvg = data.monthly_forecast.reduce((s, m) => s + m.revenue, 0) / data.monthly_forecast.length;
  console.log(`  Historical avg monthly revenue: $${histAvg.toFixed(0)}`);
  console.log(`  Forecast avg monthly revenue: $${foreAvg.toFixed(0)}`);
  console.log(`  Ratio (forecast/historical): ${(foreAvg / histAvg).toFixed(2)}x`);
  
  // Check raw field structure
  console.log('\n=== FIRST HISTORICAL MONTH RAW ===');
  console.log(JSON.stringify(data.historical_data.months[0], null, 2));
  console.log('\n=== FIRST FORECAST MONTH RAW ===');
  console.log(JSON.stringify(data.monthly_forecast[0], null, 2));
}

// Also check the revenue_estimate
console.log('\n=== REVENUE ESTIMATE ===');
if (data.revenue_estimate) {
  console.log(`  Annual revenue: $${data.revenue_estimate.annual_revenue}`);
  console.log(`  ADR: $${data.revenue_estimate.average_daily_rate}`);
  console.log(`  Occupancy: ${(data.revenue_estimate.occupancy_rate * 100).toFixed(0)}%`);
}

await conn.end();

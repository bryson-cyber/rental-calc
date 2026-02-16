import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT reportData FROM shared_reports WHERE shareId = '4g6g9mo4mlpnmcva'"
);
const data = JSON.parse(rows[0].reportData);
console.log('Top-level keys:', Object.keys(data));
console.log('\nProperty keys:', Object.keys(data.property || {}));

// Check property.estimates
if (data.property && data.property.estimates) {
  console.log('\nproperty.estimates:', JSON.stringify(data.property.estimates, null, 2).substring(0, 500));
}

// Check estimates
if (data.estimates) {
  console.log('\nestimates:', JSON.stringify(data.estimates, null, 2).substring(0, 500));
}

// Check for comp_median_adjustment anywhere
const dataStr = JSON.stringify(data);
if (dataStr.includes('comp_median')) {
  console.log('\ncomp_median found somewhere in data');
} else {
  console.log('\ncomp_median NOT found anywhere in data');
}

// Check for revenue-related fields at top level
for (const key of Object.keys(data)) {
  const val = data[key];
  if (typeof val === 'object' && val !== null) {
    const subKeys = Object.keys(val);
    const hasRevenue = subKeys.some(function(k) { return k.includes('revenue') || k.includes('adr') || k.includes('occupancy'); });
    if (hasRevenue) {
      console.log('\nRevenue found in:', key);
      console.log(JSON.stringify(val, null, 2).substring(0, 500));
    }
  }
}

// Check monthly_forecast
if (data.monthly_forecast) {
  console.log('\nmonthly_forecast (first 2):', JSON.stringify(data.monthly_forecast.slice(0, 2), null, 2));
}

await conn.end();

import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await mysql.createConnection(DATABASE_URL);

// Get the report
const [report] = await connection.execute(`
  SELECT id, shareCode, reportType, address, boostFactorAtCreation, createdAt,
         JSON_EXTRACT(reportData, '$.revenue') as revenue,
         JSON_EXTRACT(reportData, '$.annualRevenue') as annualRevenue,
         JSON_EXTRACT(reportData, '$.averageDailyRate') as averageDailyRate,
         JSON_EXTRACT(reportData, '$.occupancyRate') as occupancyRate,
         JSON_EXTRACT(reportData, '$.monthlyRevenue') as monthlyRevenue,
         JSON_EXTRACT(reportData, '$.monthlyProfit') as monthlyProfit,
         JSON_EXTRACT(reportData, '$.revenueRange') as revenueRange,
         JSON_EXTRACT(reportData, '$.monthlyRent') as monthlyRent,
         JSON_EXTRACT(reportData, '$.bedrooms') as bedrooms,
         JSON_EXTRACT(reportData, '$.bathrooms') as bathrooms
  FROM universal_shareable_reports
  WHERE shareCode = 'DJM8jm75qq'
`);

if (report.length === 0) {
  console.log('Report not found!');
} else {
  const r = report[0];
  console.log('=== Report Metadata ===');
  console.log('ID:', r.id);
  console.log('Share Code:', r.shareCode);
  console.log('Report Type:', r.reportType);
  console.log('Address:', r.address);
  console.log('Boost Factor At Creation:', r.boostFactorAtCreation);
  console.log('Created At:', r.createdAt);
  console.log('');
  console.log('=== Stored Revenue Data ===');
  console.log('revenue:', r.revenue);
  console.log('annualRevenue:', r.annualRevenue);
  console.log('averageDailyRate:', r.averageDailyRate);
  console.log('occupancyRate:', r.occupancyRate);
  console.log('monthlyRevenue:', r.monthlyRevenue);
  console.log('monthlyProfit:', r.monthlyProfit);
  console.log('revenueRange:', r.revenueRange);
  console.log('monthlyRent:', r.monthlyRent);
  console.log('bedrooms:', r.bedrooms);
  console.log('bathrooms:', r.bathrooms);
}

// Also get the current boost factor from admin_settings
const [settings] = await connection.execute(`
  SELECT settingKey, settingValue FROM admin_settings WHERE settingKey = 'revenue_boost_factor'
`);
console.log('');
console.log('=== Current Boost Factor in DB ===');
if (settings.length > 0) {
  console.log('Stored boost factor:', settings[0].settingValue);
} else {
  console.log('No boost factor in DB (using default 1.30)');
}

await connection.end();

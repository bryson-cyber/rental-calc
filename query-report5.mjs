import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await mysql.createConnection({ uri: DATABASE_URL, jsonStrings: true });

// Get detailed revenue and comp data
const [report] = await connection.execute(`
  SELECT 
    JSON_EXTRACT(reportData, '$.revenue') as revenue,
    JSON_EXTRACT(reportData, '$.metrics') as metrics,
    JSON_EXTRACT(reportData, '$.cashFlow') as cashFlow,
    JSON_EXTRACT(reportData, '$.revenuePercentiles') as revenuePercentiles,
    JSON_EXTRACT(reportData, '$.comparables[0].annual_revenue') as comp1Revenue,
    JSON_EXTRACT(reportData, '$.comparables[1].annual_revenue') as comp2Revenue,
    JSON_EXTRACT(reportData, '$.comparables[2].annual_revenue') as comp3Revenue,
    JSON_EXTRACT(reportData, '$.comparables[0].title') as comp1Title,
    JSON_EXTRACT(reportData, '$.comparables[1].title') as comp2Title,
    JSON_EXTRACT(reportData, '$.comparables[2].title') as comp3Title,
    boostFactorAtCreation
  FROM universal_shareable_reports
  WHERE shareCode = 'DJM8jm75qq'
`);

if (report.length === 0) {
  console.log('Report not found!');
} else {
  const r = report[0];
  console.log('=== Revenue ===');
  console.log(r.revenue);
  console.log('');
  console.log('=== Metrics ===');
  console.log(r.metrics);
  console.log('');
  console.log('=== Cash Flow ===');
  console.log(r.cashFlow);
  console.log('');
  console.log('=== Revenue Percentiles ===');
  console.log(r.revenuePercentiles);
  console.log('');
  console.log('=== Top 3 Comps ===');
  console.log('Comp 1:', r.comp1Title, '- Revenue:', r.comp1Revenue);
  console.log('Comp 2:', r.comp2Title, '- Revenue:', r.comp2Revenue);
  console.log('Comp 3:', r.comp3Title, '- Revenue:', r.comp3Revenue);
  console.log('');
  console.log('Boost at creation:', r.boostFactorAtCreation);
  
  // Parse and analyze
  const rev = JSON.parse(r.revenue);
  console.log('');
  console.log('=== Analysis ===');
  console.log('Projected:', rev.projected, '| Low:', rev.low, '| High:', rev.high);
  console.log('Projected ($' + rev.projected + ') is ABOVE High ($' + rev.high + ') by $' + (rev.projected - rev.high));
  
  const c1 = JSON.parse(r.comp1Revenue || '0');
  const c2 = JSON.parse(r.comp2Revenue || '0');
  const c3 = JSON.parse(r.comp3Revenue || '0');
  console.log('Top 3 comp revenues:', c1, c2, c3);
  console.log('Average of top 3:', Math.round((c1 + c2 + c3) / 3));
}

await connection.end();

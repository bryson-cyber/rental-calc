import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await mysql.createConnection(DATABASE_URL);

// Get detailed revenue and comp data
const [report] = await connection.execute(`
  SELECT 
    JSON_EXTRACT(reportData, '$.revenue') as revenue,
    JSON_EXTRACT(reportData, '$.metrics.adr') as adr,
    JSON_EXTRACT(reportData, '$.metrics.occupancy') as occupancy,
    JSON_EXTRACT(reportData, '$.metrics.annual_revenue') as metricsAnnualRevenue,
    JSON_EXTRACT(reportData, '$.metrics') as metricsRaw,
    JSON_EXTRACT(reportData, '$.cashFlow.monthlyRevenue') as cfMonthlyRevenue,
    JSON_EXTRACT(reportData, '$.cashFlow.monthlyProfit') as cfMonthlyProfit,
    JSON_EXTRACT(reportData, '$.cashFlow.annualRevenue') as cfAnnualRevenue,
    JSON_EXTRACT(reportData, '$.cashFlow.monthlyRent') as cfMonthlyRent,
    JSON_EXTRACT(reportData, '$.cashFlow.monthlyExpenses') as cfMonthlyExpenses,
    JSON_EXTRACT(reportData, '$.revenuePercentiles') as revenuePercentiles,
    JSON_EXTRACT(reportData, '$.comparables[0].annual_revenue') as comp1Revenue,
    JSON_EXTRACT(reportData, '$.comparables[1].annual_revenue') as comp2Revenue,
    JSON_EXTRACT(reportData, '$.comparables[2].annual_revenue') as comp3Revenue,
    JSON_EXTRACT(reportData, '$.comparables[0].adr') as comp1Adr,
    JSON_EXTRACT(reportData, '$.comparables[0].occupancy') as comp1Occ,
    JSON_EXTRACT(reportData, '$.comparables[0].title') as comp1Title,
    boostFactorAtCreation
  FROM universal_shareable_reports
  WHERE shareCode = 'DJM8jm75qq'
`);

if (report.length === 0) {
  console.log('Report not found!');
} else {
  const r = report[0];
  console.log('=== Revenue Object ===');
  console.log('Projected:', JSON.parse(r.revenue).projected);
  console.log('Low:', JSON.parse(r.revenue).low);
  console.log('High:', JSON.parse(r.revenue).high);
  console.log('');
  console.log('=== Metrics ===');
  const metrics = JSON.parse(r.metricsRaw);
  console.log(JSON.stringify(metrics, null, 2));
  console.log('');
  console.log('=== Cash Flow ===');
  console.log('Monthly Revenue:', r.cfMonthlyRevenue);
  console.log('Monthly Profit:', r.cfMonthlyProfit);
  console.log('Annual Revenue:', r.cfAnnualRevenue);
  console.log('Monthly Rent:', r.cfMonthlyRent);
  console.log('Monthly Expenses:', r.cfMonthlyExpenses);
  console.log('');
  console.log('=== Revenue Percentiles ===');
  console.log(r.revenuePercentiles);
  console.log('');
  console.log('=== Top 3 Comps Revenue ===');
  console.log('Comp 1:', r.comp1Revenue, '- Title:', r.comp1Title);
  console.log('Comp 2:', r.comp2Revenue);
  console.log('Comp 3:', r.comp3Revenue);
  console.log('');
  console.log('=== Boost Factor ===');
  console.log('At creation:', r.boostFactorAtCreation);
  
  // Calculate what the top-3 average would be
  const rev = JSON.parse(r.revenue);
  console.log('');
  console.log('=== Analysis ===');
  console.log('Projected revenue ($45,766) vs High ($30,705)');
  console.log('Projected is', Math.round(rev.projected / rev.high * 100), '% of high');
  console.log('Projected is', Math.round(rev.projected / rev.low * 100), '% of low');
  console.log('');
  console.log('If projected = avg of top 3 comps:');
  const c1 = r.comp1Revenue ? JSON.parse(r.comp1Revenue) : 0;
  const c2 = r.comp2Revenue ? JSON.parse(r.comp2Revenue) : 0;
  const c3 = r.comp3Revenue ? JSON.parse(r.comp3Revenue) : 0;
  console.log('Top 3 comp revenues:', c1, c2, c3);
  console.log('Average:', Math.round((c1 + c2 + c3) / 3));
}

await connection.end();

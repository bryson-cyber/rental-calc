import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await mysql.createConnection(DATABASE_URL);

// Get the actual data using the real keys
const [report] = await connection.execute(`
  SELECT 
    JSON_EXTRACT(reportData, '$.revenue') as revenue,
    JSON_EXTRACT(reportData, '$.metrics') as metrics,
    JSON_EXTRACT(reportData, '$.cashFlow') as cashFlow,
    JSON_EXTRACT(reportData, '$.forecast[0]') as firstForecast,
    JSON_EXTRACT(reportData, '$.forecast[1]') as secondForecast,
    JSON_LENGTH(reportData, '$.forecast') as forecastCount,
    JSON_EXTRACT(reportData, '$.comparables[0]') as firstComp,
    JSON_LENGTH(reportData, '$.comparables') as compCount,
    JSON_EXTRACT(reportData, '$.revenuePercentiles') as revenuePercentiles,
    JSON_EXTRACT(reportData, '$.revenueScenarios') as revenueScenarios,
    JSON_EXTRACT(reportData, '$.bedroomPerformance') as bedroomPerformance,
    JSON_EXTRACT(reportData, '$.marketInsights') as marketInsights,
    JSON_EXTRACT(reportData, '$._mode') as mode,
    JSON_EXTRACT(reportData, '$._expensePercent') as expensePercent,
    JSON_EXTRACT(reportData, '$._furnitureCost') as furnitureCost,
    JSON_EXTRACT(reportData, '$._rentometerData') as rentometerData,
    JSON_EXTRACT(reportData, '$.historicalData') as historicalData,
    JSON_EXTRACT(reportData, '$.rawMarketData') as rawMarketData
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
  console.log(String(r.metrics).substring(0, 1000));
  console.log('');
  console.log('=== Cash Flow ===');
  console.log(String(r.cashFlow).substring(0, 1000));
  console.log('');
  console.log('=== Revenue Percentiles ===');
  console.log(r.revenuePercentiles);
  console.log('');
  console.log('=== Revenue Scenarios ===');
  console.log(String(r.revenueScenarios).substring(0, 500));
  console.log('');
  console.log('=== First Forecast Month ===');
  console.log(r.firstForecast);
  console.log('Forecast count:', r.forecastCount);
  console.log('');
  console.log('=== First Comp ===');
  console.log(String(r.firstComp).substring(0, 500));
  console.log('Total comps:', r.compCount);
  console.log('');
  console.log('=== Mode / Expense / Furniture ===');
  console.log('Mode:', r.mode);
  console.log('Expense %:', r.expensePercent);
  console.log('Furniture cost:', r.furnitureCost);
  console.log('');
  console.log('=== Rentometer Data ===');
  console.log(String(r.rentometerData).substring(0, 500));
  console.log('');
  console.log('=== Market Insights ===');
  console.log(String(r.marketInsights).substring(0, 500));
}

await connection.end();

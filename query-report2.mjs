import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await mysql.createConnection(DATABASE_URL);

// Get the full report data keys
const [report] = await connection.execute(`
  SELECT 
    JSON_KEYS(reportData) as topKeys,
    JSON_EXTRACT(reportData, '$.revenue') as revenue,
    JSON_EXTRACT(reportData, '$.property') as property,
    JSON_EXTRACT(reportData, '$.estimates') as estimates,
    JSON_EXTRACT(reportData, '$.comps[0]') as firstComp,
    JSON_EXTRACT(reportData, '$.comps[1]') as secondComp,
    JSON_EXTRACT(reportData, '$.comps[2]') as thirdComp,
    JSON_LENGTH(reportData, '$.comps') as compCount,
    JSON_EXTRACT(reportData, '$.monthly_forecast[0]') as firstMonth,
    JSON_LENGTH(reportData, '$.monthly_forecast') as forecastCount,
    JSON_EXTRACT(reportData, '$.marketScore') as marketScore,
    JSON_EXTRACT(reportData, '$.rentValidation') as rentValidation,
    JSON_EXTRACT(reportData, '$.competitiveRanking') as competitiveRanking,
    JSON_EXTRACT(reportData, '$.investmentAnalysis') as investmentAnalysis,
    JSON_EXTRACT(reportData, '$.shortTermVsLongTerm') as shortTermVsLongTerm
  FROM universal_shareable_reports
  WHERE shareCode = 'DJM8jm75qq'
`);

if (report.length === 0) {
  console.log('Report not found!');
} else {
  const r = report[0];
  console.log('=== Top-Level Keys ===');
  console.log(r.topKeys);
  console.log('');
  console.log('=== Revenue ===');
  console.log(r.revenue);
  console.log('');
  console.log('=== Property ===');
  console.log(r.property);
  console.log('');
  console.log('=== Estimates ===');
  console.log(String(r.estimates).substring(0, 2000));
  console.log('');
  console.log('=== First 3 Comps ===');
  console.log('Comp 1:', String(r.firstComp).substring(0, 500));
  console.log('Comp 2:', String(r.secondComp).substring(0, 500));
  console.log('Comp 3:', String(r.thirdComp).substring(0, 500));
  console.log('Total comps:', r.compCount);
  console.log('');
  console.log('=== Monthly Forecast ===');
  console.log('First month:', r.firstMonth);
  console.log('Total months:', r.forecastCount);
  console.log('');
  console.log('=== Market Score ===');
  console.log(String(r.marketScore).substring(0, 500));
  console.log('');
  console.log('=== Rent Validation ===');
  console.log(String(r.rentValidation).substring(0, 500));
  console.log('');
  console.log('=== Competitive Ranking ===');
  console.log(String(r.competitiveRanking).substring(0, 500));
  console.log('');
  console.log('=== Investment Analysis ===');
  console.log(String(r.investmentAnalysis).substring(0, 500));
  console.log('');
  console.log('=== Short-Term vs Long-Term ===');
  console.log(String(r.shortTermVsLongTerm).substring(0, 500));
}

await connection.end();

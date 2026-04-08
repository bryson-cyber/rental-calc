import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const connection = await mysql.createConnection({ uri: DATABASE_URL, jsonStrings: true });

// Get comp structure
const [report] = await connection.execute(`
  SELECT 
    JSON_KEYS(JSON_EXTRACT(reportData, '$.comparables[0]')) as compKeys,
    JSON_EXTRACT(reportData, '$.comparables[0]') as comp1Full,
    JSON_EXTRACT(reportData, '$.comparables[1]') as comp2Full,
    JSON_EXTRACT(reportData, '$.comparables[2]') as comp3Full
  FROM universal_shareable_reports
  WHERE shareCode = 'DJM8jm75qq'
`);

if (report.length === 0) {
  console.log('Report not found!');
} else {
  const r = report[0];
  console.log('=== Comp Keys ===');
  console.log(r.compKeys);
  console.log('');
  console.log('=== Comp 1 Full ===');
  const c1 = JSON.parse(r.comp1Full);
  console.log(JSON.stringify(c1, null, 2));
  console.log('');
  console.log('=== Comp 2 Full ===');
  const c2 = JSON.parse(r.comp2Full);
  console.log(JSON.stringify(c2, null, 2));
  console.log('');
  console.log('=== Comp 3 Full ===');
  const c3 = JSON.parse(r.comp3Full);
  console.log(JSON.stringify(c3, null, 2));
  
  // Find revenue-like fields
  console.log('');
  console.log('=== Revenue fields in comps ===');
  for (const key of Object.keys(c1)) {
    if (key.toLowerCase().includes('rev') || key.toLowerCase().includes('income') || key.toLowerCase().includes('earn')) {
      console.log(`${key}: ${c1[key]}`);
    }
  }
}

await connection.end();

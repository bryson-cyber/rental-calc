import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check the production report (6x7847e1mlfebp33)
const [rows] = await conn.execute(
  `SELECT shareId, latitude, longitude, 
   JSON_EXTRACT(reportData, '$.property.latitude') as prop_lat,
   JSON_EXTRACT(reportData, '$.property.longitude') as prop_lng,
   JSON_EXTRACT(reportData, '$.property.address') as prop_addr
   FROM shared_reports WHERE shareId = ?`,
  ['6x7847e1mlfebp33']
);
console.log('Production report (6x7847e1mlfebp33):');
console.log(JSON.stringify(rows[0], null, 2));

// Check the dev report (l6984fncmlf7nhnx)
const [rows2] = await conn.execute(
  `SELECT shareId, latitude, longitude, 
   JSON_EXTRACT(reportData, '$.property.latitude') as prop_lat,
   JSON_EXTRACT(reportData, '$.property.longitude') as prop_lng,
   JSON_EXTRACT(reportData, '$.property.address') as prop_addr
   FROM shared_reports WHERE shareId = ?`,
  ['l6984fncmlf7nhnx']
);
console.log('\nDev report (l6984fncmlf7nhnx):');
console.log(JSON.stringify(rows2[0], null, 2));

// Also check comp coordinates in the production report
const [compRows] = await conn.execute(
  `SELECT 
   JSON_LENGTH(JSON_EXTRACT(reportData, '$.same_bedroom_comps')) as total_comps,
   JSON_EXTRACT(reportData, '$.same_bedroom_comps[0].latitude') as comp0_lat,
   JSON_EXTRACT(reportData, '$.same_bedroom_comps[0].longitude') as comp0_lng,
   JSON_EXTRACT(reportData, '$.same_bedroom_comps[0].title') as comp0_title
   FROM shared_reports WHERE shareId = ?`,
  ['6x7847e1mlfebp33']
);
console.log('\nProduction comps:');
console.log(JSON.stringify(compRows[0], null, 2));

await conn.end();

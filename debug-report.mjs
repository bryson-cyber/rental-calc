import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  'SELECT reportData FROM universal_shareable_reports WHERE shareCode = ?',
  ['ind58rd8mlk8bcab']
);

if (rows.length > 0) {
  const data = JSON.parse(rows[0].reportData);
  const comps = data.same_bedroom_comps || data.comps || [];
  console.log('Total comps:', comps.length);
  const withCoords = comps.filter(c => c.latitude && c.longitude);
  console.log('Comps with coords:', withCoords.length);
  if (comps.length > 0) {
    console.log('Sample comp keys:', Object.keys(comps[0]));
    console.log('Sample comp lat:', comps[0].latitude);
    console.log('Sample comp lng:', comps[0].longitude);
  }
  console.log('Market ID:', data.market?.id);
  console.log('Has market:', !!data.market);
}

await conn.end();

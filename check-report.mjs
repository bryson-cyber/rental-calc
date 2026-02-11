import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT JSON_KEYS(reportData) as top_keys, JSON_EXTRACT(reportData, '$.purchase') as purchase_data, JSON_EXTRACT(reportData, '$.rental_arbitrage') as rental_data FROM shared_reports WHERE shareId = '1byhaxuxmlibqtbt' LIMIT 1"
);
console.log('Top keys:', rows[0]?.top_keys);
console.log('Purchase data:', rows[0]?.purchase_data);
console.log('Rental data:', rows[0]?.rental_data);
await conn.end();

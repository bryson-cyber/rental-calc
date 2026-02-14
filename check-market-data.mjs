import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query(
    `SELECT id, shareId, 
     JSON_UNQUOTE(JSON_EXTRACT(reportData, '$.market_data.name')) as market_name, 
     JSON_EXTRACT(reportData, '$.market_data.listing_count') as listing_count
     FROM shared_reports WHERE reportType='full' ORDER BY createdAt DESC LIMIT 10`
  );
  for (const row of rows) {
    console.log(`ID: ${row.id} | shareId: ${row.shareId} | market: ${row.market_name} | listings: ${row.listing_count}`);
  }
  await conn.end();
}
main().catch(console.error);

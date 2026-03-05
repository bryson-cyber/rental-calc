import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute("SELECT settingKey, settingValue FROM webinar_sms_settings WHERE settingKey LIKE 'calendar%'");
for (const row of rows) {
  console.log(`KEY: "${row.settingKey}" => VALUE (len=${row.settingValue.length}): "${row.settingValue}"`);
}
await conn.end();

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Coverage
const [cov] = await conn.query(`SELECT COUNT(*) AS total, SUM(JSON_EXTRACT(metadata,'$.personalization.version')=4) AS located, SUM(JSON_EXTRACT(metadata,'$.personalization.deal') IS NOT NULL) AS with_deal FROM webinar_registrants WHERE webinarId='386' AND email IS NOT NULL AND email!=''`);
const { total, located, with_deal } = cov[0];
const pct = ((Number(located) / Number(total)) * 100).toFixed(1);
console.log(`[${new Date().toISOString()}] Coverage: ${located}/${total} (${pct}%) located, ${with_deal} with_deal`);

// Check for 429 errors in recent logs (last 5 min of enrichment)
await conn.end();
process.exit(0);

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Coverage
const [cov] = await conn.query(`SELECT COUNT(*) AS total, SUM(JSON_EXTRACT(metadata,'$.personalization.version')=4) AS located, SUM(JSON_EXTRACT(metadata,'$.personalization.deal') IS NOT NULL) AS with_deal FROM webinar_registrants WHERE webinarId='386' AND email IS NOT NULL AND email!=''`);
console.log("=== COVERAGE ===");
console.log(JSON.stringify(cov[0]));

// 2. Payload sanity (20 rows with personalization)
const [payloads] = await conn.query(`SELECT email, JSON_EXTRACT(metadata,'$.personalization.city') AS city, JSON_EXTRACT(metadata,'$.personalization.source') AS src, JSON_EXTRACT(metadata,'$.personalization.timezone') AS tz FROM webinar_registrants WHERE webinarId='386' AND JSON_EXTRACT(metadata,'$.personalization') IS NOT NULL LIMIT 20`);
console.log("\n=== PAYLOAD SANITY ===");
payloads.forEach(r => console.log(JSON.stringify(r)));

// 3. Newsletter deals
const [deals] = await conn.query(`SELECT city, state, monthlyRent, ROUND(projectedRevenue/12) AS monthlyRev, sourceUrl, discoveredAt FROM newsletter_deals ORDER BY discoveredAt DESC LIMIT 10`);
console.log("\n=== NEWSLETTER DEALS (newest 10) ===");
deals.forEach(r => console.log(JSON.stringify(r)));

// 4. Shared reports
const [reports] = await conn.query(`SELECT id, reportType, address, createdAt FROM shared_reports WHERE reportType='property' ORDER BY createdAt DESC LIMIT 5`);
console.log("\n=== SHARED REPORTS (property) ===");
reports.forEach(r => console.log(JSON.stringify(r)));

// 5. Regulation cache
const [regs] = await conn.query(`SELECT city, state, status, updatedAt FROM regulation_cache ORDER BY updatedAt DESC LIMIT 10`);
console.log("\n=== REGULATION CACHE ===");
regs.forEach(r => console.log(JSON.stringify(r)));

// 6. Tokenized copy
const [tokens] = await conn.query(`SELECT sequenceName, messageBody LIKE '%[IF\\_%' AS tokenized FROM scheduled_sms_messages WHERE webinarId='386' AND status='pending'`);
console.log("\n=== TOKENIZED COPY ===");
tokens.forEach(r => console.log(JSON.stringify(r)));

await conn.end();
process.exit(0);

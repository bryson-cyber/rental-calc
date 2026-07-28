import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL + '&ssl={"rejectUnauthorized":true}');

console.log('=== (1) SMS send_log by status + errorMessage ===');
const [smsRows] = await conn.execute(
  "SELECT status, errorMessage, COUNT(*) AS n FROM promo_drip_send_log WHERE campaignId = 1 AND channel = 'sms' GROUP BY status, errorMessage ORDER BY n DESC"
);
for (const r of smsRows) console.log(`  ${r.status} | ${r.errorMessage || 'NULL'} | ${r.n}`);

console.log('\n=== (2) EMAIL send_log by status + errorMessage ===');
const [emailRows] = await conn.execute(
  "SELECT status, errorMessage, COUNT(*) AS n FROM promo_drip_send_log WHERE campaignId = 1 AND channel = 'email' GROUP BY status, errorMessage ORDER BY n DESC"
);
for (const r of emailRows) console.log(`  ${r.status} | ${r.errorMessage || 'NULL'} | ${r.n}`);

console.log('\n=== (3) Eligible SMS recipients (phoneValid=1, not excluded, not unsubscribed) ===');
const [countRows] = await conn.execute(
  "SELECT COUNT(*) AS cnt FROM promo_drip_recipients WHERE campaignId = 1 AND excludedAt IS NULL AND unsubscribedAt IS NULL AND phoneValid = 1"
);
console.log(`  Count: ${countRows[0].cnt}`);

console.log('\n=== (4) 3 example errorMessages from biggest skip bucket ===');
// Find the biggest skip bucket first
const biggestSkip = smsRows.find(r => r.status !== 'sent');
if (biggestSkip) {
  console.log(`  Biggest skip: status="${biggestSkip.status}" errorMessage="${biggestSkip.errorMessage}" (n=${biggestSkip.n})`);
  const [examples] = await conn.execute(
    "SELECT errorMessage FROM promo_drip_send_log WHERE campaignId = 1 AND channel = 'sms' AND status = ? AND (errorMessage = ? OR (errorMessage IS NULL AND ? IS NULL)) LIMIT 3",
    [biggestSkip.status, biggestSkip.errorMessage, biggestSkip.errorMessage]
  );
  for (const r of examples) console.log(`  Example: ${r.errorMessage}`);
} else {
  console.log('  No skips found');
}

await conn.end();
process.exit(0);

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(
  `SELECT id, webinarId, sequenceName, sequenceOrder, status, scheduledAt, audience, LEFT(messageBody, 120) as msgPreview 
   FROM scheduled_sms_messages 
   WHERE id >= 210000 
   ORDER BY sequenceOrder ASC`
);

console.log('=== Current Webinar Sequence ===');
for (const row of rows) {
  console.log(`\n#${row.sequenceOrder} | ${row.sequenceName} | Status: ${row.status}`);
  console.log(`   Scheduled: ${row.scheduledAt} | Audience: ${row.audience}`);
  console.log(`   Message: ${row.msgPreview}`);
}

// Also check webinarId
if (rows.length > 0) {
  console.log(`\nWebinar ID: ${rows[0].webinarId}`);
}

await conn.end();

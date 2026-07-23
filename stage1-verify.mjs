import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

// Use the same env loading as the project
const dotenv = require('dotenv');
dotenv.config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await mysql.createConnection(DB_URL);

console.log('\n=== STAGE 1 CHECK 1: Personalization Payloads ===');
const [r1] = await conn.query(`
  SELECT id, email,
    JSON_EXTRACT(metadata,'$.personalization.version') AS ver,
    JSON_EXTRACT(metadata,'$.personalization.city') AS city,
    JSON_EXTRACT(metadata,'$.personalization.state') AS state,
    JSON_EXTRACT(metadata,'$.personalization.source') AS source,
    JSON_EXTRACT(metadata,'$.personalization.timezone') AS tz,
    JSON_EXTRACT(metadata,'$.personalization.deal') IS NOT NULL AS has_deal
  FROM webinar_registrants
  WHERE webinarId = 386
    AND JSON_EXTRACT(metadata,'$.personalization.version') IS NOT NULL
  LIMIT 20;
`);
console.table(r1);

console.log('\n=== STAGE 1 CHECK 2: Coverage Rate ===');
const [r2] = await conn.query(`
  SELECT COUNT(*) AS total,
    SUM(JSON_EXTRACT(metadata,'$.personalization.version') = 3) AS located,
    SUM(JSON_EXTRACT(metadata,'$.personalization.deal') IS NOT NULL) AS with_deal
  FROM webinar_registrants
  WHERE webinarId = 386 AND email IS NOT NULL AND email != '';
`);
console.table(r2);

console.log('\n=== STAGE 1 CHECK 3: Sequence Copy Tokenization ===');
const [r3] = await conn.query(`
  SELECT id, sequenceName, status,
    messageBody LIKE '%[IF\\_%' AS tokenized
  FROM scheduled_sms_messages
  WHERE webinarId = 386
  LIMIT 20;
`);
console.table(r3);

console.log('\n=== STAGE 1 CHECK 4: Confirmation Template ===');
const [r4] = await conn.query(`
  SELECT settingValue FROM webinar_sms_settings WHERE settingKey='confirmation_sms_template';
`);
if (r4.length > 0) {
  const val = r4[0].settingValue;
  console.log(val ? val.substring(0, 600) : 'EMPTY');
  console.log('\nContains [IF_DEAL]:', val?.includes('[IF_DEAL]') ?? false);
} else {
  console.log('No confirmation_sms_template found');
}

await conn.end();

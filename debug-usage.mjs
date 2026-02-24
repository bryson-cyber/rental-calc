import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('No DATABASE_URL');
  process.exit(1);
}

const conn = await mysql.createConnection(url);

// Total events
const [totalRows] = await conn.execute('SELECT COUNT(*) as cnt FROM tool_usage_events');
console.log('Total events:', totalRows[0].cnt);

// Today's events
const [todayRows] = await conn.execute('SELECT COUNT(*) as cnt FROM tool_usage_events WHERE createdAt >= CURDATE()');
console.log('Today events:', todayRows[0].cnt);

// Yesterday's events
const [yesterdayRows] = await conn.execute('SELECT COUNT(*) as cnt FROM tool_usage_events WHERE createdAt >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND createdAt < CURDATE()');
console.log('Yesterday events:', yesterdayRows[0].cnt);

// Last 20 events
const [recentRows] = await conn.execute('SELECT id, eventType, toolName, city, address, createdAt FROM tool_usage_events ORDER BY createdAt DESC LIMIT 20');
console.log('\nRecent events:');
for (const row of recentRows) {
  console.log(`  [${row.createdAt}] ${row.eventType} | ${row.toolName} | ${row.city || '-'} | ${(row.address || '-').substring(0, 50)}`);
}

// Events by tool today
const [byToolToday] = await conn.execute('SELECT eventType, toolName, COUNT(*) as cnt FROM tool_usage_events WHERE createdAt >= CURDATE() GROUP BY eventType, toolName ORDER BY cnt DESC');
console.log('\nToday by tool:');
for (const row of byToolToday) {
  console.log(`  ${row.eventType} | ${row.toolName}: ${row.cnt}`);
}

// Events by day for last 7 days
const [byDay] = await conn.execute('SELECT DATE(createdAt) as day, COUNT(*) as cnt FROM tool_usage_events WHERE createdAt >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY DATE(createdAt) ORDER BY day DESC');
console.log('\nEvents by day (last 7 days):');
for (const row of byDay) {
  console.log(`  ${row.day}: ${row.cnt}`);
}

// Check for validate-related events
const [validateEvents] = await conn.execute("SELECT eventType, toolName, COUNT(*) as cnt FROM tool_usage_events WHERE toolName LIKE '%property%' OR toolName LIKE '%validate%' OR toolName LIKE '%full_report%' OR eventType LIKE '%report%' GROUP BY eventType, toolName ORDER BY cnt DESC");
console.log('\nValidate/Report related events:');
for (const row of validateEvents) {
  console.log(`  ${row.eventType} | ${row.toolName}: ${row.cnt}`);
}

await conn.end();

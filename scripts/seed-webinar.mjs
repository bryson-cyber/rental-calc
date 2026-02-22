/**
 * One-time script to create the webinar schedule and pull all existing registrants
 * from WebinarJam API into our database.
 * 
 * WebinarJam ID: 370, Schedule ID: 652
 * Webinar: "Webby 2.22.26" — Sunday, 22 Feb 2026, 7:00 PM EST
 * 
 * DB columns (camelCase):
 *   webinar_schedules: id, name, webinarjamWebinarId, webinarjamScheduleId, dayOfWeek, startTime, timezone, isActive, liveRoomUrl, noShowTeaser, createdAt, updatedAt, webinarTranscript, generatedTeasers
 *   webinar_registrants: id, scheduleId, firstName, lastName, email, phone, phoneCountryCode, webinarjamLeadId, liveRoomUrl, replayRoomUrl, attendanceStatus, welcomeSent, noShowBlastSent, lastReminderStage, optedOut, registeredAt, createdAt, updatedAt
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const BASE_URL = 'https://api.webinarjam.com/webinarjam';
const API_KEY = process.env.WEBINARJAM_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!API_KEY) { console.error('WEBINARJAM_API_KEY not set'); process.exit(1); }
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

async function wjPost(endpoint, params = {}) {
  const body = new URLSearchParams();
  body.append('api_key', API_KEY);
  for (const [key, value] of Object.entries(params)) {
    body.append(key, String(value));
  }
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WebinarJam ${response.status}: ${text}`);
  }
  return response.json();
}

async function fetchAllRegistrants(webinarId, scheduleId) {
  let allRegistrants = [];
  let page = 1;
  let lastPage = 1;

  do {
    console.log(`  Fetching page ${page}...`);
    const data = await wjPost('/registrants', {
      webinar_id: webinarId,
      schedule_id: scheduleId,
      page: page,
    });

    const paginated = data.registrants;
    if (paginated && paginated.data && Array.isArray(paginated.data)) {
      allRegistrants = allRegistrants.concat(paginated.data);
      lastPage = paginated.last_page || 1;
      console.log(`  Page ${page}/${lastPage}: ${paginated.data.length} registrants`);
    } else {
      console.log('  Unexpected response format:', JSON.stringify(data).slice(0, 300));
      break;
    }

    page++;
  } while (page <= lastPage);

  return allRegistrants;
}

async function main() {
  console.log('=== Pulling WebinarJam data for Webinar 370, Schedule 652 ===\n');

  // Step 1: Fetch all registrants
  const registrants = await fetchAllRegistrants(370, 652);
  console.log(`\nTotal registrants fetched: ${registrants.length}`);

  // Stats
  const attended = registrants.filter(r => r.attended_live === 'Yes' || r.attended_live === 1).length;
  const noShows = registrants.filter(r => r.attended_live !== 'Yes' && r.attended_live !== 1).length;
  const withPhone = registrants.filter(r => (r.phone_number || r.phone || '').trim().length > 0).length;
  console.log(`Stats: ${attended} attended, ${noShows} no-shows, ${withPhone} have phone numbers\n`);

  // Step 2: Connect to database
  console.log('=== Inserting into database ===\n');
  const dbUrl = new URL(DATABASE_URL);
  const conn = await mysql.createConnection({
    host: dbUrl.hostname,
    port: parseInt(dbUrl.port) || 3306,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  });

  // Step 2a: Create the webinar schedule if it doesn't exist
  const [existingSchedules] = await conn.execute(
    'SELECT id FROM webinar_schedules WHERE webinarjamWebinarId = ? AND webinarjamScheduleId = ?',
    ['370', '652']
  );

  let scheduleId;
  if (existingSchedules.length > 0) {
    scheduleId = existingSchedules[0].id;
    console.log(`Schedule already exists with ID ${scheduleId}`);
  } else {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const [result] = await conn.execute(
      `INSERT INTO webinar_schedules (name, webinarjamWebinarId, webinarjamScheduleId, dayOfWeek, startTime, timezone, isActive, liveRoomUrl, noShowTeaser, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Webby 2.22.26',  // name
        '370',             // webinarjamWebinarId
        '652',             // webinarjamScheduleId
        0,                 // dayOfWeek: 0 = Sunday
        '19:00',           // startTime (7 PM EST)
        'America/New_York', // timezone
        1,                 // isActive
        '',                // liveRoomUrl (will update from registrant data)
        '',                // noShowTeaser (AI generates this)
        now,               // createdAt
        now,               // updatedAt
      ]
    );
    scheduleId = result.insertId;
    console.log(`Created schedule with ID ${scheduleId}`);
  }

  // Step 2b: Insert registrants
  let inserted = 0;
  let skipped = 0;

  for (const r of registrants) {
    const phone = (r.phone_number || r.phone || '').trim();
    const email = (r.email || '').trim();
    const firstName = r.first_name || '';
    const lastName = r.last_name || '';
    const attendedLive = r.attended_live === 'Yes' || r.attended_live === 1;
    const liveRoomUrl = r.live_room || '';
    const replayRoomUrl = r.replay_room || '';
    const leadId = r.lead_id ? String(r.lead_id) : null;
    const phoneCountryCode = r.phone_country_code || '+1';

    // Check if already exists (by email + schedule)
    const [existing] = await conn.execute(
      'SELECT id FROM webinar_registrants WHERE scheduleId = ? AND email = ?',
      [scheduleId, email]
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Clean phone: strip non-digits, prepend 1 if 10 digits
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '1' + cleanPhone;

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await conn.execute(
      `INSERT INTO webinar_registrants (scheduleId, firstName, lastName, email, phone, phoneCountryCode, webinarjamLeadId, liveRoomUrl, replayRoomUrl, attendanceStatus, welcomeSent, noShowBlastSent, lastReminderStage, optedOut, registeredAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scheduleId,
        firstName,
        lastName,
        email,
        cleanPhone || null,
        phoneCountryCode,
        leadId,
        liveRoomUrl,
        replayRoomUrl,
        attendedLive ? 'attended' : 'registered',
        0,   // welcomeSent
        0,   // noShowBlastSent
        0,   // lastReminderStage
        0,   // optedOut
        now,  // registeredAt
        now,  // createdAt
        now,  // updatedAt
      ]
    );
    inserted++;
  }

  // Update live_room_url on the schedule from the first registrant that has one
  const firstWithRoom = registrants.find(r => r.live_room);
  if (firstWithRoom) {
    await conn.execute(
      'UPDATE webinar_schedules SET liveRoomUrl = ? WHERE id = ?',
      [firstWithRoom.live_room, scheduleId]
    );
    console.log(`Updated schedule liveRoomUrl: ${firstWithRoom.live_room}`);
  }

  console.log(`\nDone! Inserted ${inserted} registrants, skipped ${skipped} duplicates.`);
  console.log(`Schedule ID: ${scheduleId}`);

  // Verify
  const [count] = await conn.execute(
    'SELECT COUNT(*) as cnt FROM webinar_registrants WHERE scheduleId = ?',
    [scheduleId]
  );
  console.log(`Total registrants in DB for this schedule: ${count[0].cnt}`);

  await conn.end();
}

main().catch(console.error);

import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';

// Dynamically import the compiled google-calendar module
// We need to use tsx to run this since it's TypeScript
async function main() {
  const { sendCalendarInvite } = await import('./server/google-calendar.ts');
  
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get Bryson's registrant record
  const [rows] = await conn.execute('SELECT * FROM webinar_registrants WHERE id = 300106');
  const reg = rows[0];
  console.log('Sending invite to:', reg.name, reg.email);
  
  // Get settings
  const [settings] = await conn.execute('SELECT * FROM webinar_sms_settings');
  const settingsMap = {};
  for (const s of settings) { settingsMap[s.settingKey] = s.settingValue; }
  
  const scheduleDate = settingsMap['selected_schedule_date']; // "2026-03-08 19:00"
  const startTime = new Date(scheduleDate + ':00');
  
  console.log('Webinar start time:', startTime.toISOString());
  console.log('Timezone: America/Los_Angeles');
  
  try {
    const result = await sendCalendarInvite({
      attendeeEmail: reg.email,
      attendeeName: reg.name,
      title: 'FREE Live Training: How to Start a Profitable Airbnb Business',
      description: 'Join Coach Inayah for an exclusive live training on building a profitable short-term rental business.\n\nWhat you\'ll learn:\n• How to find profitable rental properties\n• Setting up your Airbnb listing for maximum bookings\n• Pricing strategies that maximize revenue\n• Common mistakes to avoid as a new host\n\nDon\'t miss this opportunity to learn from an experienced investor!',
      startTime,
      timezone: 'America/Los_Angeles',
      joinUrl: undefined,
      webinarId: '373',
    });
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      // Update the registrant record
      await conn.execute(
        'UPDATE webinar_registrants SET calendarInviteSent = 1, calendarEventId = ?, calendarInviteError = NULL, calendarInviteAt = NOW() WHERE id = 300106',
        [result.eventId || null]
      );
      console.log('✅ Calendar invite sent successfully and DB updated!');
    } else {
      await conn.execute(
        'UPDATE webinar_registrants SET calendarInviteSent = 0, calendarInviteError = ?, calendarInviteAt = NOW() WHERE id = 300106',
        [result.error || 'Unknown error']
      );
      console.log('❌ Failed to send invite:', result.error);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    await conn.execute(
      'UPDATE webinar_registrants SET calendarInviteSent = 0, calendarInviteError = ?, calendarInviteAt = NOW() WHERE id = 300106',
      [err.message]
    );
  }
  
  await conn.end();
}

main().catch(e => console.error('Fatal:', e));

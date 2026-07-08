/**
 * Manual one-time script to send the missed "3 Hours Before" email
 * to all registrants for webinar 380.
 * 
 * This email was missed because the sandbox (not production) dispatched
 * the SMS and the sandbox had broken SMTP credentials.
 */
import nodemailer from 'nodemailer';

// SMTP credentials (same as production)
const SMTP_HOST = 'smtp.hubapi.com';
const SMTP_PORT = 587;
const SMTP_USER = process.env.HUBSPOT_SMTP_USER;
const SMTP_PASS = process.env.HUBSPOT_SMTP_PASS;
const SMTP_FROM = process.env.HUBSPOT_SMTP_FROM || 'Coach Inayah <hello@coachinayah.com>';

// Database connection
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const DB_URL = process.env.DATABASE_URL;

// Parse DATABASE_URL
function parseDbUrl(url) {
  const u = new URL(url);
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    host: u.hostname,
    port: parseInt(u.port),
    database: u.pathname.slice(1), // remove leading /
    ssl: { rejectUnauthorized: true }
  };
}

// Email template (3h = "3 Hours Before")
function build3hEmail(firstName, webinarLink) {
  const preheader = `We go live in 3 hours — get your spot ready.`;
  const body = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8f5f0;font-family:'DM Sans',Arial,sans-serif;">
<span style="display:none;font-size:1px;color:#f8f5f0;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}${'&#847; '.repeat(80)}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f5f0;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
<tr><td style="background-color:#0F172A;padding:32px 40px;text-align:center;">
<h1 style="color:#C9A962;font-family:'Playfair Display',Georgia,serif;font-size:24px;margin:0;">Coach Inayah</h1>
</td></tr>
<tr><td style="padding:40px;">
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 20px;">Hey ${firstName || 'there'},</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 20px;">Just a heads up — we're going live in <strong>3 hours</strong>.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 20px;">Tonight I'm breaking down how everyday people are pulling $8K–$12K/month from Airbnb — without owning property or having real estate experience.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 20px;">This is the exact model I used to build a $2M+ portfolio, and I'm showing you how to replicate it step by step.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 30px;">Save your spot now so you're ready when we go live:</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 30px;"><tr><td style="background-color:#C9A962;border-radius:8px;padding:16px 32px;text-align:center;">
<a href="${webinarLink}" style="color:#0F172A;text-decoration:none;font-weight:700;font-size:16px;">Join the Workshop →</a>
</td></tr></table>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 20px;">See you tonight,</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0;"><strong>— Coach Inayah</strong></p>
</td></tr>
<tr><td style="background-color:#0F172A;padding:24px 40px;text-align:center;">
<p style="color:#94a3b8;font-size:12px;margin:0;">© 2026 Coach Inayah. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject: "⏰ 3 hours until we go live!", html: body };
}

async function main() {
  if (!SMTP_USER || !SMTP_PASS) {
    console.error('Missing SMTP credentials');
    process.exit(1);
  }
  if (!DB_URL) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }

  const dbConfig = parseDbUrl(DB_URL);
  const conn = await mysql.createConnection(dbConfig);

  // Get all registrants with email for webinar 380
  const [registrants] = await conn.execute(
    `SELECT id, name, email FROM webinar_registrants 
     WHERE webinarId = '380' 
     AND email IS NOT NULL AND email != '' 
     AND (optedOut = 0 OR optedOut IS NULL)`
  );

  console.log(`Found ${registrants.length} registrants to email`);

  // Check which ones already got the 3h email (shouldn't be any, but just in case)
  const [alreadySent] = await conn.execute(
    `SELECT registrantId FROM email_send_log 
     WHERE webinarId = '380' AND emailType = 'post_3h' AND status = 'sent'`
  );
  const sentIds = new Set(alreadySent.map(r => r.registrantId));
  
  const toSend = registrants.filter(r => !sentIds.has(r.id));
  console.log(`After dedup: ${toSend.length} to send (${sentIds.size} already sent)`);

  if (toSend.length === 0) {
    console.log('Nothing to send');
    await conn.end();
    return;
  }

  // Get webinar join link
  const [settings] = await conn.execute(
    `SELECT settingKey, settingValue FROM webinar_sms_settings WHERE settingKey IN ('join_link', 'replay_url')`
  );
  const settingsMap = {};
  for (const row of settings) settingsMap[row.settingKey] = row.settingValue;
  const joinLink = settingsMap['join_link'] || 'https://event.webinarjam.com/go/live/3/7gwn0h0fwi7c0h77';

  // Create SMTP transport
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  // Verify connection
  await transporter.verify();
  console.log('SMTP connection verified');

  // Insert all as pending first (optimistic lock)
  const pendingValues = toSend.map(r => 
    `('380', ${r.id}, '${r.email.replace(/'/g, "''")}', ${r.name ? `'${r.name.replace(/'/g, "''")}'` : 'NULL'}, 'hubspot_smtp', 'post_3h', 'pending', NULL)`
  ).join(',\n');
  
  await conn.execute(
    `INSERT INTO email_send_log (webinarId, registrantId, recipientEmail, recipientName, channel, emailType, status, errorMessage) VALUES ${pendingValues}`
  );
  console.log(`Inserted ${toSend.length} pending entries`);

  let sent = 0;
  let failed = 0;

  for (const recipient of toSend) {
    const firstName = recipient.name?.split(' ')[0] || '';
    const utmLink = `${joinLink}${joinLink.includes('?') ? '&' : '?'}utm_source=email&utm_medium=3h&utm_campaign=webinar_3h`;
    const { subject, html } = build3hEmail(firstName, utmLink);

    try {
      await transporter.sendMail({
        from: SMTP_FROM,
        to: recipient.email,
        subject,
        html,
      });
      sent++;
      // Update to sent
      await conn.execute(
        `UPDATE email_send_log SET status = 'sent' WHERE webinarId = '380' AND registrantId = ? AND emailType = 'post_3h' AND status = 'pending'`,
        [recipient.id]
      );
    } catch (err) {
      failed++;
      await conn.execute(
        `UPDATE email_send_log SET status = 'failed', errorMessage = ? WHERE webinarId = '380' AND registrantId = ? AND emailType = 'post_3h' AND status = 'pending'`,
        [err.message?.slice(0, 1000) || 'Unknown error', recipient.id]
      );
    }

    // Rate limit: 100ms between sends
    await new Promise(r => setTimeout(r, 100));

    if ((sent + failed) % 50 === 0) {
      console.log(`Progress: ${sent} sent, ${failed} failed, ${toSend.length - sent - failed} remaining`);
    }
  }

  console.log(`\nDone! ${sent} sent, ${failed} failed out of ${toSend.length} total`);
  await conn.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

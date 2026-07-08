/**
 * Update pending SMS messages for July 8 webinar with new Coach Inayah copy.
 * Run: node scripts/update-pending-sms.mjs
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const link = "https://event.webinarjam.com/klp6w/go/live/696vzt4msgs2s6?webinar_id=380";
const callLink = "https://masterclass.coachinayah.com/turnkey-v2";

const updates = [
  {
    sequenceName: "Morning Of",
    messageBody: `Morning %FIRST_NAME%, it's Inayah. Tonight we're live for your Airbnb Masterclass. If you show up live, you'll get my 'Landlord Yes' script + 90-day launch checklist. Worth being there.`
  },
  {
    sequenceName: "3 Hours Before",
    messageBody: `3-hour heads up: your Airbnb Masterclass with me starts soon today. Find a quiet spot, bring a notebook, and be ready to map out your first cash-flowing unit.`
  },
  {
    sequenceName: "1 Hour Warning",
    messageBody: `We're 1 hour out. I'll break down how busy professionals are replacing W2 income with Airbnb without owning property. I'll send your join link 15 minutes before go time.`
  },
  {
    sequenceName: "15 Min Before",
    messageBody: `%FIRST_NAME%, we start in 15 minutes. Here's your private link to join live: ${link}\n\nHop on a few minutes early so you don't miss the landlord scripts.`
  },
  {
    sequenceName: "Starting NOW",
    messageBody: `We're starting now. I'm walking through step 1 of the Turnkey Airbnb system. Join us here: ${link}\n\nIf you don't hop on in the next few minutes, the room may lock.`
  },
  {
    sequenceName: "No-Show Nudge",
    messageBody: `Hey %FIRST_NAME%, it's Inayah. We're 10 minutes into the Airbnb Masterclass and just covered how to pick your first unit. You can still jump in live here: ${link}\n\nIf you miss this, there's no replay.`
  },
  {
    sequenceName: "Thank You (Attended)",
    messageBody: `%FIRST_NAME%, thank you for showing up live tonight. Proud of you for investing in yourself. Next step if you want help launching your first unit: apply for a Turnkey Strategy Call here: ${callLink}`
  },
  {
    sequenceName: "Missed You (No-Show)",
    messageBody: `Hey %FIRST_NAME%, it's Inayah. I didn't see you on the Airbnb Masterclass tonight. Life happens. If you're still serious about adding $2K\u2013$5K/mo without owning property, you can either:\nA) Register for the next live class, or\nB) Apply for a 1:1 Turnkey Strategy Call now\nGrab your best next step here: ${callLink}`
  },
  {
    sequenceName: "Follow-Up CTA",
    messageBody: `%FIRST_NAME%, yesterday's class was about clarity. Today is about action. If you want help launching your first Airbnb in the next 90 days, apply for a Turnkey Strategy Call here: ${callLink}\n\nWe'll see if and how we can help.`
  },
];

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');
  const conn = await mysql.createConnection(dbUrl);

  for (const upd of updates) {
    const [result] = await conn.execute(
      `UPDATE scheduled_sms_messages SET messageBody = ? WHERE sequenceName = ? AND status = 'pending'`,
      [upd.messageBody, upd.sequenceName]
    );
    console.log(`Updated "${upd.sequenceName}": ${result.affectedRows} row(s)`);
  }

  await conn.end();
  console.log("\nDone! All pending messages updated with new copy.");
}

main().catch(console.error);

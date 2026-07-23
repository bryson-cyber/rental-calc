/**
 * Stage 2: Add owner as test registrant via tRPC addRegistrant mutation.
 * This triggers the instant confirmation SMS + email with personalization.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { SignJWT } = require('jose');
const dotenv = require('dotenv');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const OWNER_OPEN_ID = process.env.OWNER_OPEN_ID;
const VITE_APP_ID = process.env.VITE_APP_ID;

if (!JWT_SECRET || !OWNER_OPEN_ID || !VITE_APP_ID) {
  console.error('Missing env vars:', { JWT_SECRET: !!JWT_SECRET, OWNER_OPEN_ID: !!OWNER_OPEN_ID, VITE_APP_ID: !!VITE_APP_ID });
  process.exit(1);
}

// Generate a session token for the owner
const secretKey = new TextEncoder().encode(JWT_SECRET);
const token = await new SignJWT({
  openId: OWNER_OPEN_ID,
  appId: VITE_APP_ID,
  name: "Bryson",
})
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setExpirationTime(Math.floor((Date.now() + 86400000) / 1000))
  .sign(secretKey);

console.log('[Stage 2] Generated session token for owner');

// Call the addRegistrant tRPC mutation
const response = await fetch('http://localhost:3000/api/trpc/webinarSms.addRegistrant', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': `app_session_id=${token}`,
  },
  body: JSON.stringify({
    json: {
      name: "Bryson Test",
      email: "bryson@stayly.com",
      phone: "7025218792",
      webinarName: "Webby 7.26.26",
      tags: ["stage2-test"],
    },
  }),
});

const result = await response.text();
console.log('[Stage 2] Response status:', response.status);
console.log('[Stage 2] Response:', result.substring(0, 1000));

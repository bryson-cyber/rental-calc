import { SignJWT } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;
const APP_ID = process.env.VITE_APP_ID;
if (!JWT_SECRET) { console.error("No JWT_SECRET"); process.exit(1); }

const secretKey = new TextEncoder().encode(JWT_SECRET);

// Sign a session matching the owner's openId
const token = await new SignJWT({ 
  openId: process.env.OWNER_OPEN_ID,
  appId: APP_ID,
  name: "Bryson blocker"
})
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setExpirationTime(Math.floor((Date.now() + 3600000) / 1000))
  .sign(secretKey);

console.log("Token generated for openId:", process.env.OWNER_OPEN_ID);

// Now call the checkout endpoint with correct cookie name
const res = await fetch("http://localhost:3000/api/trpc/llc.createCheckoutSession", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Cookie": `app_session_id=${token}`
  },
  body: JSON.stringify({ json: { id: 120006 } })
});

const text = await res.text();
console.log("Status:", res.status);
try {
  const json = JSON.parse(text);
  console.log("Response:", JSON.stringify(json, null, 2).substring(0, 1500));
} catch {
  console.log("Response:", text.substring(0, 500));
}

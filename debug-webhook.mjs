/**
 * Debug SimpleTexting webhook configuration
 */

const BASE_URL = 'https://api-app2.simpletexting.com/v2';
const API_KEY = process.env.SIMPLETEXTING_API_KEY;

if (!API_KEY) {
  console.error('SIMPLETEXTING_API_KEY not set');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`,
};

// 1. List existing webhooks
console.log('=== EXISTING WEBHOOKS ===');
try {
  const res = await fetch(`${BASE_URL}/api/webhooks`, { headers });
  const text = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(text);
} catch (err) {
  console.error('Failed to list webhooks:', err.message);
}

// 2. Check recent incoming messages
console.log('\n=== RECENT INCOMING MESSAGES ===');
try {
  const res = await fetch(`${BASE_URL}/api/messages?direction=in&page=0&size=5`, { headers });
  const text = await res.text();
  console.log(`Status: ${res.status}`);
  try {
    const data = JSON.parse(text);
    if (data.content) {
      data.content.forEach((msg, i) => {
        console.log(`\n--- Message ${i + 1} ---`);
        console.log(`From: ${msg.contactPhone}`);
        console.log(`Text: ${msg.text}`);
        console.log(`Time: ${msg.timestamp || msg.createdAt}`);
        console.log(`Type: ${msg.category}`);
      });
    } else {
      console.log(text);
    }
  } catch {
    console.log(text);
  }
} catch (err) {
  console.error('Failed to list messages:', err.message);
}

// 3. Check account info
console.log('\n=== ACCOUNT INFO ===');
try {
  const res = await fetch(`${BASE_URL}/api/account`, { headers });
  const text = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(text);
} catch (err) {
  console.error('Failed to get account info:', err.message);
}

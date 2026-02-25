import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.SIMPLETEXTING_API_KEY;

// The API returns directionType: "MO" for incoming (Mobile Originated) and "MT" for outgoing (Mobile Terminated)
// Let's try filtering by directionType
async function testMOFilter() {
  console.log('\n--- Test: GET /messages?directionType=MO ---');
  const res = await fetch('https://api-app2.simpletexting.com/v2/api/messages?directionType=MO&page=0&size=10', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Total elements:', data.totalElements);
  console.log('Messages:');
  for (const msg of data.content || []) {
    console.log(`  ${msg.directionType} | ${msg.contactPhone} | ${msg.timestamp} | ${msg.text?.substring(0, 80)}`);
  }
}

await testMOFilter();

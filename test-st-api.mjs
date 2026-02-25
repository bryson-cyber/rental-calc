import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.SIMPLETEXTING_API_KEY;
console.log('Key exists:', !!apiKey);
if (!apiKey) {
  console.log('No API key found');
  process.exit(1);
}

// Test 1: Get messages (inbox)
async function testGetMessages() {
  console.log('\n--- Test: GET /messages ---');
  const res = await fetch('https://api-app2.simpletexting.com/v2/api/messages?page=0&size=5', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text.substring(0, 2000));
}

// Test 2: Get inbox/incoming messages
async function testGetInbox() {
  console.log('\n--- Test: GET /inbox ---');
  const res = await fetch('https://api-app2.simpletexting.com/v2/api/inbox?page=0&size=5', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text.substring(0, 2000));
}

// Test 3: Get replies
async function testGetReplies() {
  console.log('\n--- Test: GET /replies ---');
  const res = await fetch('https://api-app2.simpletexting.com/v2/api/replies?page=0&size=5', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text.substring(0, 2000));
}

// Test 4: Get messages with direction filter
async function testGetIncoming() {
  console.log('\n--- Test: GET /messages?direction=inbound ---');
  const res = await fetch('https://api-app2.simpletexting.com/v2/api/messages?direction=inbound&page=0&size=5', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text.substring(0, 2000));
}

await testGetMessages();
await testGetInbox();
await testGetReplies();
await testGetIncoming();

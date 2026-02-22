/**
 * Test SMS delivery with optimized short message (no emoji, under 160 chars)
 * Sends to the user's test phone: 702-521-8792
 */

const BASE_URL = 'https://api-app2.simpletexting.com/v2';

// Get API key from environment
const API_KEY = process.env.SIMPLETEXTING_API_KEY;
if (!API_KEY) {
  console.error('SIMPLETEXTING_API_KEY not set');
  process.exit(1);
}

const testPhone = '17025218792';
const testMessage = 'Hey! Coach Inayah goes LIVE Sunday at 4 PM Pacific. What are you most excited to learn about?';

console.log(`Message length: ${testMessage.length} chars`);
console.log(`Message: "${testMessage}"`);
console.log(`Sending to: ${testPhone}`);

try {
  const response = await fetch(`${BASE_URL}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      contactPhone: testPhone,
      text: testMessage,
      mode: 'SINGLE_SMS_STRICTLY',
    }),
  });

  const responseText = await response.text();
  console.log(`\nAPI Response (${response.status}):`);
  console.log(responseText);

  if (response.ok) {
    const result = JSON.parse(responseText);
    console.log(`\nSMS sent successfully!`);
    console.log(`Message ID: ${result.id}`);
    console.log(`Credits used: ${result.credits}`);
  } else {
    console.error(`\nFailed to send SMS: ${response.status}`);
  }
} catch (error) {
  console.error('Error:', error);
}

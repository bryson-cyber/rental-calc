/**
 * Send a test engagement SMS to 702-521-8792
 * Uses the actual AI-generated noon engagement message from the transcript.
 */
import 'dotenv/config';

const BASE_URL = 'https://api-app2.simpletexting.com/v2';
const API_KEY = process.env.SIMPLETEXTING_API_KEY;

if (!API_KEY) {
  console.error('SIMPLETEXTING_API_KEY not set');
  process.exit(1);
}

const TEST_PHONE = '17025218792';

// First, let's generate a noon engagement message using the LLM
// For the test, we'll use a pre-crafted message that matches what the AI would generate
const testMessage = `Hey Bryson! 🔥 Today's the day — Coach Inayah goes LIVE at 4 PM EST covering how to start a profitable Airbnb business with zero out of pocket. We're talking real funding strategies, finding your first deal, and how students like Andrew got $80K+ in funding. What part are you most excited about?`;

console.log('Sending test SMS...');
console.log(`To: ${TEST_PHONE}`);
console.log(`Message: ${testMessage}`);
console.log('---');

try {
  const response = await fetch(`${BASE_URL}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      contactPhone: TEST_PHONE,
      text: testMessage,
      mode: 'AUTO',
    }),
  });

  const responseText = await response.text();
  console.log(`Status: ${response.status}`);
  console.log(`Response: ${responseText}`);

  if (response.ok) {
    const result = JSON.parse(responseText);
    console.log(`\n✅ SMS sent successfully!`);
    console.log(`Message ID: ${result.id}`);
    console.log(`Credits used: ${result.credits}`);
  } else {
    console.error(`\n❌ Failed to send SMS: ${response.status}`);
    console.error(responseText);
  }
} catch (error) {
  console.error('Error:', error);
}

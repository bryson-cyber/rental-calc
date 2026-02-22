/**
 * Register SimpleTexting webhook for incoming SMS
 */

const BASE_URL = 'https://api-app2.simpletexting.com/v2';
const API_KEY = process.env.SIMPLETEXTING_API_KEY;

if (!API_KEY) {
  console.error('SIMPLETEXTING_API_KEY not set');
  process.exit(1);
}

const WEBHOOK_URL = 'https://coachinayahturnkeytool.com/api/webhooks/simpletexting';

console.log(`Registering webhook: ${WEBHOOK_URL}`);
console.log('Triggers: INCOMING_MESSAGE, UNSUBSCRIBE_REPORT');

try {
  const res = await fetch(`${BASE_URL}/api/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      triggers: ['INCOMING_MESSAGE', 'UNSUBSCRIBE_REPORT'],
      requestPerSecLimit: 15,
    }),
  });

  const text = await res.text();
  console.log(`\nResponse (${res.status}):`);
  console.log(text);

  if (res.ok) {
    console.log('\nWebhook registered successfully!');
  } else {
    console.error('\nFailed to register webhook.');
    
    // Try with just INCOMING_MESSAGE
    console.log('\nRetrying with just INCOMING_MESSAGE trigger...');
    const res2 = await fetch(`${BASE_URL}/api/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        triggers: ['INCOMING_MESSAGE'],
        requestPerSecLimit: 15,
      }),
    });
    const text2 = await res2.text();
    console.log(`Response (${res2.status}):`, text2);
  }
} catch (err) {
  console.error('Error:', err.message);
}

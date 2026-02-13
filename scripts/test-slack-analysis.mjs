/**
 * Test script: Run the full AirDNA analysis pipeline and output Slack-formatted results.
 * Usage: node scripts/test-slack-analysis.mjs
 */

const address = '1622 Halliard Dr, Lawrenceville, GA 30043';
const bedrooms = 3;
const bathrooms = 2;

// Call the local webhook endpoint
const response = await fetch('http://localhost:3000/api/slack/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: `Analyze ${address}, ${bedrooms}BR ${bathrooms}BA`,
    // No response_url - we'll check server logs for the result
  })
});

const data = await response.json();
console.log('Endpoint response:', JSON.stringify(data, null, 2));

// Now call the rentalizer directly to get the actual numbers
console.log('\nCalling Rentalizer API directly...');
const rentalizerResponse = await fetch(`http://localhost:3000/api/trpc/getEstimate?batch=1&input=${encodeURIComponent(JSON.stringify({
  "0": { json: { address, bedrooms, bathrooms, accommodates: 6 } }
}))}`, {
  headers: { 'Content-Type': 'application/json' }
});

if (rentalizerResponse.ok) {
  const result = await rentalizerResponse.json();
  console.log('Rentalizer result available:', JSON.stringify(result).substring(0, 500));
} else {
  console.log('Rentalizer call status:', rentalizerResponse.status);
  const text = await rentalizerResponse.text();
  console.log('Response:', text.substring(0, 500));
}

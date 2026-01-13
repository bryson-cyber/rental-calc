import dotenv from 'dotenv';
dotenv.config();

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;

// Try different endpoint formats
const address = "123 Main St, San Diego, CA 92101";

// Format 1: rentalizer/ltm
const url1 = `https://api.airdna.co/api/enterprise/v2/rentalizer/ltm?access_token=${AIRDNA_API_KEY}&address=${encodeURIComponent(address)}`;

// Format 2: rentalizer (without ltm)
const url2 = `https://api.airdna.co/api/enterprise/v2/rentalizer?access_token=${AIRDNA_API_KEY}&address=${encodeURIComponent(address)}`;

console.log('Testing URL 1 (rentalizer/ltm)...');
let response = await fetch(url1);
let data = await response.json();
console.log('Status:', data.status?.type || 'success');

if (data.status?.type === 'error') {
  console.log('\nTesting URL 2 (rentalizer)...');
  response = await fetch(url2);
  data = await response.json();
  console.log('Status:', data.status?.type || 'success');
}

if (data.payload?.stats?.future?.metrics) {
  const metrics = data.payload.stats.future.metrics;
  console.log('\n=== FULL 12-MONTH SEASONALITY FOR SAN DIEGO ===\n');
  console.log('OCCUPANCY BY MONTH:');
  metrics.forEach((m, i) => {
    const monthName = new Date(2024, i, 1).toLocaleString('en-US', { month: 'short' });
    console.log(`  ${monthName}: ${Math.round(m.occ * 100)}%`);
  });
  
  console.log('\nAVERAGE DAILY RATE BY MONTH:');
  metrics.forEach((m, i) => {
    const monthName = new Date(2024, i, 1).toLocaleString('en-US', { month: 'short' });
    console.log(`  ${monthName}: $${Math.round(m.adr)}`);
  });
  
  console.log('\nMONTHLY REVENUE:');
  metrics.forEach((m, i) => {
    const monthName = new Date(2024, i, 1).toLocaleString('en-US', { month: 'short' });
    console.log(`  ${monthName}: $${Math.round(m.revenue).toLocaleString()}`);
  });
} else {
  console.log('\nNo metrics found. Checking response structure...');
  console.log('Has payload:', !!data.payload);
  if (data.payload) {
    console.log('Payload keys:', Object.keys(data.payload));
  }
}

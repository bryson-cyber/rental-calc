import 'dotenv/config';

// We need to call the function directly, but it's in TypeScript
// Instead, let's use the running server's tRPC endpoint with a proper admin session
// First, let's create a JWT token for the admin user

import { SignJWT } from 'jose';

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('JWT_SECRET not set');
  process.exit(1);
}

// Create a JWT token for the admin/owner user
const encoder = new TextEncoder();
const token = await new SignJWT({ 
  openId: process.env.OWNER_OPEN_ID,
  appId: process.env.VITE_APP_ID,
  name: process.env.OWNER_NAME || 'Admin',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(encoder.encode(secret));

console.log('Generated admin JWT token');
console.log('Calling generateFromAddress for Phoenix 2BR/1BA...\n');

// Call the tRPC endpoint
const response = await fetch('http://localhost:3000/api/trpc/sharedReports.generateFromAddress', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': `app_session_id=${token}`,
  },
  body: JSON.stringify({
    json: {
      address: '411 N 32nd Pl, Phoenix, AZ 85008, USA',
      bedrooms: 2,
      bathrooms: 1,
      monthlyRent: 1971,
      mode: 'renting',
    }
  }),
});

const data = await response.json();

if (data.error) {
  console.error('Error:', JSON.stringify(data.error, null, 2));
  process.exit(1);
}

const result = data.result?.data?.json;
if (!result) {
  console.error('No result data. Full response:', JSON.stringify(data, null, 2).slice(0, 2000));
  process.exit(1);
}

// Extract key data points
console.log('=== LOCATION CHECK ===');
console.log('City:', result.property?.city);
console.log('State:', result.property?.state);
console.log('Address:', result.property?.address);

console.log('\n=== REVENUE ESTIMATE ===');
const rev = result.revenue_estimate;
if (rev) {
  console.log('Annual Revenue:', rev.annual_revenue);
  console.log('ADR:', rev.average_daily_rate);
  console.log('Occupancy:', rev.occupancy_rate);
  console.log('Revenue Range:', rev.annual_revenue_low, '-', rev.annual_revenue_high);
}

console.log('\n=== COMP MEDIAN ADJUSTMENT ===');
const adj = result.comp_median_adjustment;
if (adj) {
  console.log('Applied:', adj.applied);
  console.log('Original Revenue:', adj.original_annual_revenue);
  console.log('Comp Median Revenue:', adj.comp_median_revenue);
  console.log('Adjusted Revenue:', adj.adjusted_annual_revenue);
  console.log('Scale Factor:', adj.scale_factor);
  console.log('Comp Count:', adj.comp_count);
} else {
  console.log('No comp_median_adjustment field found');
}

console.log('\n=== COMPS ===');
const comps = result.comps || result.comparable_properties || [];
if (Array.isArray(comps)) {
  comps.slice(0, 5).forEach((c, i) => {
    console.log(`Comp ${i+1}: ${c.bedrooms}BR/${c.bathrooms}BA - Revenue: $${c.annual_revenue} - ADR: $${c.adr || c.average_daily_rate}`);
  });
} else {
  console.log('Comps structure:', typeof comps, Object.keys(comps || {}).join(', '));
}

// Check the share URL
console.log('\n=== SHARE URL ===');
console.log('Share ID:', result.shareId || result.id);

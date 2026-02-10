import http from 'http';
import { SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
const APP_ID = process.env.VITE_APP_ID;
const secret = new TextEncoder().encode(JWT_SECRET);

const issuedAt = Date.now();
const expirationSeconds = Math.floor((issuedAt + 365 * 24 * 60 * 60 * 1000) / 1000);

const token = await new SignJWT({
  openId: 'nXFdDDobGPtzT2HBp5K8e7',
  appId: APP_ID,
  name: 'Bryson blocker',
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setExpirationTime(expirationSeconds)
  .sign(secret);

console.log('Token created. Calling sharedReports.generateFromAddress...');

// tRPC mutation batch format
const body = JSON.stringify({
  "0": {
    "json": {
      "address": "2680 Carnation Dr, Richardson, TX 75082, USA",
      "bedrooms": 6,
      "bathrooms": 5,
      "accommodates": 12,
      "purchasePrice": 649990,
      "downPaymentPercent": 20,
      "interestRate": 7.0,
      "loanTermYears": 30,
      "closingCostsPercent": 3,
      "annualPropertyTaxRate": 2.1,
      "annualInsurance": 3500,
      "monthlyHOA": 0,
      "propertyManagementPercent": 0,
      "furnishingBudget": 15000,
      "userName": "Bryson blocker",
      "userEmail": "bryson@stayly.com"
    }
  }
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/trpc/sharedReports.generateFromAddress?batch=1',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': `app_session_id=${token}`,
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const result = parsed[0]?.result?.data?.json;
      if (result) {
        console.log('\nSUCCESS! Report generated.');
        console.log('Share ID:', result.shareId);
        console.log('Market data name:', result.reportData?.market_data?.name);
        console.log('Market data ADR:', result.reportData?.market_data?.metrics?.adr);
        console.log('Market data occupancy:', result.reportData?.market_data?.metrics?.occupancy_rate);
        console.log('Submarkets count:', result.reportData?.submarkets?.length);
        console.log('Supply trend count:', result.reportData?.supply_trend?.length);
        if (result.reportData?.submarkets?.length > 0) {
          console.log('First submarket:', result.reportData.submarkets[0].name);
        }
      } else {
        console.log('Response:', data.substring(0, 3000));
      }
    } catch (e) {
      console.log('Raw response:', data.substring(0, 3000));
    }
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(body);
req.end();

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const http = require('http');

const payload = JSON.stringify({
  json: {
    address: "123 Main St, Denver, CO 80202",
    bedrooms: 2,
    bathrooms: 1
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/trpc/rental.getEstimate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      // Navigate superjson structure
      const result = parsed?.result?.data;
      if (result?.json) {
        const json = result.json;
        console.log('SUCCESS:', json.success);
        if (json.data) {
          const d = json.data;
          console.log('\n=== TOP-LEVEL KEYS ===');
          console.log(Object.keys(d));
          
          if (d.property) {
            console.log('\n=== PROPERTY KEYS ===');
            console.log(Object.keys(d.property));
            if (d.property.estimates) {
              console.log('\n=== PROPERTY.ESTIMATES ===');
              console.log(JSON.stringify(d.property.estimates, null, 2));
            } else {
              console.log('\nNO property.estimates');
            }
          }
          
          if (d.estimates) {
            console.log('\n=== TOP-LEVEL ESTIMATES ===');
            console.log(JSON.stringify(d.estimates, null, 2));
          }
          
          if (d.same_bedroom_comps) {
            console.log('\n=== same_bedroom_comps COUNT ===');
            console.log(d.same_bedroom_comps.length);
          }
          
          if (d.comps) {
            console.log('\n=== comps COUNT ===');
            console.log(d.comps.length);
          }
          
          if (d.revenue_scenarios) {
            console.log('\n=== revenue_scenarios ===');
            console.log(JSON.stringify(d.revenue_scenarios, null, 2));
          } else {
            console.log('\nNO revenue_scenarios');
          }
        } else {
          console.log('NO DATA:', json.error);
        }
      } else {
        console.log('RAW:', JSON.stringify(parsed).substring(0, 500));
      }
    } catch (e) {
      console.error('Parse error:', e.message);
      console.log('Raw:', data.substring(0, 500));
    }
  });
});

req.write(payload);
req.end();

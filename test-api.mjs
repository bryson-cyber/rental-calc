import http from 'http';

const data = JSON.stringify({
  json: {
    address: '801 Fall River Rd, Idaho Springs, CO 80452',
    bedrooms: 3,
    bathrooms: 1.5,
    reportMode: 'guided',
    source: 'validate'
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/trpc/rental.getPropertyReport',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

console.log('Sending request...');

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', JSON.stringify(res.headers, null, 2));
    try {
      const parsed = JSON.parse(body);
      console.log('Response (parsed):', JSON.stringify(parsed, null, 2).substring(0, 2000));
    } catch {
      console.log('Response (raw):', body.substring(0, 2000));
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  console.error('Error code:', e.code);
});

req.setTimeout(90000, () => {
  console.log('Request timed out after 90s');
  req.destroy();
});

req.write(data);
req.end();

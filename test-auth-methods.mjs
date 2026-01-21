import 'dotenv/config';

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const submarketId = 'airdna-1914';

async function testBearerAuth() {
  console.log('=== Testing Bearer Auth ===');
  const url = `https://api.airdna.co/api/enterprise/v2/submarket/${submarketId}`;
  console.log('URL:', url);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2).slice(0, 500));
}

async function testAccessTokenAuth() {
  console.log('\n=== Testing Access Token Auth ===');
  const url = `https://api.airdna.co/api/enterprise/v2/submarket/${submarketId}?access_token=${AIRDNA_API_KEY}`;
  console.log('URL:', url.replace(AIRDNA_API_KEY, 'API_KEY'));
  
  const response = await fetch(url, {
    method: 'GET'
  });
  
  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2).slice(0, 500));
}

async function main() {
  await testBearerAuth();
  await testAccessTokenAuth();
}

main().catch(console.error);

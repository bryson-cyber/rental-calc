import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.HASDATA_API_KEY;
console.log('API Key exists:', !!apiKey);
console.log('API Key length:', apiKey?.length || 0);

try {
  const response = await fetch('https://api.hasdata.com/scrape/zillow/listing?keyword=Atlanta%2C%20GA&type=forRent', {
    headers: { 
      'x-api-key': apiKey, 
      'Content-Type': 'application/json' 
    }
  });
  
  console.log('Response status:', response.status);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2).slice(0, 3000));
} catch (e) {
  console.error('Error:', e);
}

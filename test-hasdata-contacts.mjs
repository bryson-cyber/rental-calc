import 'dotenv/config';

const apiKey = process.env.HASDATA_API_KEY;
const testUrl = 'https://www.zillow.com/homedetails/419-Saint-Paul-St-Denver-CO-80206/13230631_zpid/';

async function testPropertyContacts() {
  const queryParams = new URLSearchParams();
  queryParams.set('url', testUrl);
  queryParams.set('extractAgentEmails', 'true');
  
  const url = `https://api.hasdata.com/scrape/zillow/property?${queryParams.toString()}`;
  
  console.log('Testing HasData Property API...');
  console.log('URL:', url);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    }
  });
  
  if (!response.ok) {
    console.error('API Error:', response.status);
    const text = await response.text();
    console.error('Response:', text);
    return;
  }
  
  const data = await response.json();
  
  // Log all keys
  console.log('\n=== TOP LEVEL KEYS ===');
  console.log(Object.keys(data));
  
  // Look for agent-related fields
  console.log('\n=== AGENT RELATED FIELDS ===');
  const agentFields = ['agent', 'listingAgent', 'attributionInfo', 'buildingPhoneNumber', 
    'propertyPhoneNumber', 'contactPhone', 'contactEmail', 'brokerName', 'agentName',
    'agentPhoneNumber', 'agentEmail', 'listedBy', 'contact', 'contacts'];
  
  for (const field of agentFields) {
    if (data[field]) {
      console.log(`${field}:`, JSON.stringify(data[field], null, 2));
    }
  }
  
  // Check nested objects
  if (data.attributionInfo) {
    console.log('\n=== ATTRIBUTION INFO ===');
    console.log(JSON.stringify(data.attributionInfo, null, 2));
  }
  
  // Log full response for inspection
  console.log('\n=== FULL RESPONSE (first 3000 chars) ===');
  console.log(JSON.stringify(data, null, 2).slice(0, 3000));
}

testPropertyContacts().catch(console.error);

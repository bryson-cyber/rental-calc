import 'dotenv/config';

const apiKey = process.env.HASDATA_API_KEY;

// Test with a rental listing URL from the search results
const testUrls = [
  'https://www.zillow.com/homedetails/1136-Willow-St-1136-Denver-CO-80220/2060095918_zpid/',
  'https://www.zillow.com/homedetails/1525-E-22nd-Ave-Denver-CO-80205/13145621_zpid/',
];

async function testPropertyContacts(testUrl) {
  const queryParams = new URLSearchParams();
  queryParams.set('url', testUrl);
  queryParams.set('extractAgentEmails', 'true');
  
  const url = `https://api.hasdata.com/scrape/zillow/property?${queryParams.toString()}`;
  
  console.log('\n===========================================');
  console.log('Testing:', testUrl);
  console.log('===========================================');
  
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
  const property = data.property || data;
  
  // Log all keys in property
  console.log('\n=== PROPERTY KEYS ===');
  console.log(Object.keys(property));
  
  // Look for agent-related fields
  console.log('\n=== AGENT/CONTACT FIELDS ===');
  const agentFields = ['agent', 'listingAgent', 'attributionInfo', 'buildingPhoneNumber', 
    'propertyPhoneNumber', 'contactPhone', 'contactEmail', 'brokerName', 'agentName',
    'agentPhoneNumber', 'agentEmail', 'listedBy', 'contact', 'contacts', 'agentEmails',
    'listingProvider', 'listingSubType', 'contactRecipients', 'buildingId', 'listingAgentName'];
  
  for (const field of agentFields) {
    if (property[field] !== undefined && property[field] !== null) {
      console.log(`${field}:`, JSON.stringify(property[field], null, 2));
    }
  }
  
  // Check for nested attributionInfo
  if (property.attributionInfo) {
    console.log('\n=== ATTRIBUTION INFO ===');
    console.log(JSON.stringify(property.attributionInfo, null, 2));
  }
  
  // Check for listing provider
  if (property.listingProvider) {
    console.log('\n=== LISTING PROVIDER ===');
    console.log(JSON.stringify(property.listingProvider, null, 2));
  }
  
  // Log basic property info
  console.log('\n=== BASIC INFO ===');
  console.log('Address:', property.addressRaw || property.address);
  console.log('Price:', property.price);
  console.log('Status:', property.status);
  console.log('Broker:', property.brokerName);
}

async function runTests() {
  for (const url of testUrls) {
    await testPropertyContacts(url);
  }
}

runTests().catch(console.error);

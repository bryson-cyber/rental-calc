import 'dotenv/config';

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;

async function getSubmarketDetails(submarketId) {
  const numericId = submarketId.replace('airdna-', '');
  const url = `https://api.airdna.co/api/enterprise/v2/submarket/${numericId}`;
  console.log('Fetching:', url);
  const response = await fetch(
    url,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRDNA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  console.log('Response status:', response.status);
  const data = await response.json();
  console.log('Full response:', JSON.stringify(data, null, 2));
  return data.payload;
}

async function main() {
  console.log('=== Testing South Beach (airdna-1914) ===\n');
  
  const details = await getSubmarketDetails('airdna-1914');
  
  console.log('Submarket name:', details.name);
  console.log('Listing count:', details.listing_count);
  console.log('\n=== Raw metrics from API ===');
  console.log(JSON.stringify(details.metrics, null, 2));
  
  // Calculate the values as the code does
  const metrics = details.metrics;
  console.log('\n=== Calculated values ===');
  console.log('occupancy:', Math.round(metrics.booked * 100), '%');
  console.log('adr:', Math.round(metrics.daily_rate));
  console.log('revenue:', Math.round(metrics.revenue));
  console.log('revpar:', Math.round(metrics.revpar));
  console.log('market_score:', metrics.market_score);
}

main().catch(console.error);

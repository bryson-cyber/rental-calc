import dotenv from 'dotenv';
dotenv.config();

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/api/enterprise/v2';

async function testCompStructure() {
  const response = await fetch(`${BASE_URL}/rentalizer/estimate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      address: '123 Main St, San Diego, CA',
      bedrooms: 2,
      bathrooms: 1,
      currency: 'usd'
    })
  });
  
  const data = await response.json();
  
  // Check comps structure
  if (data.payload?.comps?.length > 0) {
    console.log('First comp structure:');
    console.log(JSON.stringify(data.payload.comps[0], null, 2));
    
    console.log('\nAll comp keys:', Object.keys(data.payload.comps[0]));
    
    // Check revenue fields
    const comp = data.payload.comps[0];
    console.log('\nRevenue fields:');
    console.log('- revenue:', comp.revenue);
    console.log('- annual_revenue:', comp.annual_revenue);
    console.log('- revenue_potential:', comp.revenue_potential);
    console.log('- ltm_revenue:', comp.ltm_revenue);
  }
  
  // Check monthly_forecast structure
  if (data.payload?.stats?.future?.metrics?.length > 0) {
    console.log('\nMonthly forecast structure:');
    console.log(JSON.stringify(data.payload.stats.future.metrics[0], null, 2));
  }
}

testCompStructure().catch(console.error);

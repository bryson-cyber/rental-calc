// Test getMarketHistoricalData directly
import { getMarketHistoricalData } from './server/airdna';

async function test() {
  console.log('Testing getMarketHistoricalData with airdna-429 (St. Louis)...');
  
  try {
    const result = await getMarketHistoricalData('airdna-429', 60);
    console.log('\nResults:');
    console.log('- Occupancy:', result.occupancy.length, 'months');
    console.log('- ADR:', result.adr.length, 'months');
    console.log('- Revenue:', result.revenue.length, 'months');
    
    if (result.occupancy.length > 0) {
      console.log('\nFirst occupancy:', result.occupancy[0]);
      console.log('Last occupancy:', result.occupancy[result.occupancy.length - 1]);
    }
    
    if (result.revenue.length > 0) {
      console.log('\nFirst revenue:', result.revenue[0]);
      console.log('Last revenue:', result.revenue[result.revenue.length - 1]);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

test();

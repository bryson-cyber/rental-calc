import { getMarketHistoricalData } from './server/airdna';

async function test() {
  console.log('Testing getMarketHistoricalData with 60 months...');
  const result = await getMarketHistoricalData('airdna-429', 60);
  console.log('Occupancy data points:', result.occupancy.length);
  console.log('ADR data points:', result.adr.length);
  console.log('Revenue data points:', result.revenue.length);
  if (result.occupancy.length > 0) {
    console.log('First occupancy:', result.occupancy[0]);
    console.log('Last occupancy:', result.occupancy[result.occupancy.length - 1]);
  }
}

test().catch(console.error);

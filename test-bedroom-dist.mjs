import { getAllMarketListings } from './server/airdna.ts';

// Glendale, Arizona market ID
const marketId = '73408';

console.log('Testing bedroom distribution for Glendale, Arizona...');

try {
  const result = await getAllMarketListings(marketId, { maxListings: 500 });
  console.log(`\nTotal listings returned: ${result.listings.length}`);
  console.log(`Total in market: ${result.total_count}`);
  
  // Count bedrooms
  const bedroomCounts = {};
  result.listings.forEach(l => {
    const br = l.bedrooms || 0;
    bedroomCounts[br] = (bedroomCounts[br] || 0) + 1;
  });
  
  console.log('\nBedroom distribution:');
  Object.keys(bedroomCounts).sort((a,b) => Number(a) - Number(b)).forEach(br => {
    console.log(`  ${br}BR: ${bedroomCounts[br]} listings`);
  });
} catch (error) {
  console.error('Error:', error);
}

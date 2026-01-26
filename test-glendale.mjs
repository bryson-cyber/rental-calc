// Test Glendale, Arizona market data
import { searchMarkets, getMarketDetails, getAllMarketListings } from './server/airdna.ts';

async function test() {
  console.log('Searching for Glendale, Arizona...');
  const markets = await searchMarkets('Glendale', 10);
  const glendale = markets.find(m => m.name.toLowerCase().includes('glendale') && m.state?.toLowerCase() === 'arizona');
  
  if (!glendale) {
    console.log('Glendale, Arizona not found. Available markets:', markets.map(m => `${m.name}, ${m.state}`));
    return;
  }
  
  console.log('\nFound Glendale:', glendale);
  
  console.log('\nFetching market details...');
  const details = await getMarketDetails(glendale.id);
  console.log('Market details:', JSON.stringify(details, null, 2));
  
  console.log('\nFetching listings...');
  const listingsResult = await getAllMarketListings(glendale.id, { maxListings: 500 });
  const listings = listingsResult.listings || [];
  const totalCount = listingsResult.total_count || listings.length;
  
  console.log(`\nTotal listings in market: ${totalCount}`);
  console.log(`Listings fetched: ${listings.length}`);
  
  // Count by bedroom
  const bedroomCounts = {};
  listings.forEach(l => {
    const br = l.bedrooms || 0;
    bedroomCounts[br] = (bedroomCounts[br] || 0) + 1;
  });
  console.log('\nBedroom distribution in fetched listings:', bedroomCounts);
}

test().catch(console.error);

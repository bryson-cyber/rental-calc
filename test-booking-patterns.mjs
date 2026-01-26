import { getMarketBookingPatterns, getMarketDetails, calculateMarketInsights, getAllMarketListings } from './server/airdna.js';

async function test() {
  console.log('Testing booking patterns for Denver...');
  
  try {
    const bookingPatterns = await getMarketBookingPatterns('denver__co');
    console.log('Booking patterns:', JSON.stringify(bookingPatterns, null, 2));
  } catch (e) {
    console.error('Booking patterns error:', e.message);
  }
  
  try {
    const marketDetails = await getMarketDetails('denver__co');
    console.log('Market details metrics:', JSON.stringify(marketDetails?.metrics, null, 2));
  } catch (e) {
    console.error('Market details error:', e.message);
  }
  
  try {
    console.log('Fetching listings for market insights...');
    const listings = await getAllMarketListings('denver__co', { maxListings: 100 });
    console.log('Got', listings.length, 'listings');
    if (listings.length > 0) {
      const insights = calculateMarketInsights(listings);
      console.log('Revenue percentiles:', JSON.stringify(insights.revenue_percentiles, null, 2));
      console.log('Superhost pct:', insights.superhost_pct);
      console.log('Professionally managed pct:', insights.professionally_managed_pct);
    }
  } catch (e) {
    console.error('Market insights error:', e.message);
  }
}

test();

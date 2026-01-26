import { getMarketDetails, getMarketSeasonality, getAllMarketListings, getMarketBookingPatterns, calculateMarketInsights } from './server/airdna.ts';

// Test with Denver market ID (airdna-163)
const marketId = 'airdna-163';

console.log('Testing Step 1 data for Denver (airdna-163)...');

try {
  const [marketDetails, seasonality, listings, bookingPatterns] = await Promise.all([
    getMarketDetails(marketId).catch(e => { console.log('marketDetails error:', e.message); return null; }),
    getMarketSeasonality(marketId).catch(e => { console.log('seasonality error:', e.message); return null; }),
    getAllMarketListings(marketId, { maxListings: 100 }).catch(e => { console.log('listings error:', e.message); return []; }),
    getMarketBookingPatterns(marketId).catch(e => { console.log('bookingPatterns error:', e.message); return null; }),
  ]);

  console.log('\n=== Market Details ===');
  console.log('Name:', marketDetails?.name);
  console.log('Listing count:', marketDetails?.listing_count);
  console.log('Metrics:', JSON.stringify(marketDetails?.metrics, null, 2));

  console.log('\n=== Seasonality ===');
  console.log('Months:', seasonality?.length);
  if (seasonality?.[0]) {
    console.log('Sample month:', JSON.stringify(seasonality[0], null, 2));
  }

  console.log('\n=== Listings ===');
  console.log('Count:', listings?.length);

  console.log('\n=== Booking Patterns ===');
  console.log('Data:', JSON.stringify(bookingPatterns, null, 2));

  if (listings && listings.length > 0) {
    const insights = calculateMarketInsights(listings);
    console.log('\n=== Market Insights ===');
    console.log('Revenue percentiles:', JSON.stringify(insights.revenue_percentiles, null, 2));
    console.log('Superhost %:', insights.superhost_pct);
    console.log('Professionally managed %:', insights.professionally_managed_pct);
  }

} catch (error) {
  console.error('Error:', error);
}

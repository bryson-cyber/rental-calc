import { getMarketBookingPatterns, getMarketDetails, calculateMarketInsights, getAllMarketListings } from './server/airdna';

async function test() {
  // Use the correct market ID format: airdna-163 for Denver
  const marketId = 'airdna-163';
  console.log(`Testing Step 1 Super Experience data for market: ${marketId}`);
  
  console.log('\n=== 1. Booking Patterns ===');
  try {
    const bookingPatterns = await getMarketBookingPatterns(marketId);
    if (bookingPatterns) {
      console.log('✓ Booking patterns found:');
      console.log('  - Avg lead time:', bookingPatterns.lead_time.avg_days, 'days');
      console.log('  - Last minute %:', bookingPatterns.lead_time.last_minute_percent);
      console.log('  - Advance booking %:', bookingPatterns.lead_time.advance_booking_percent);
      console.log('  - Avg length of stay:', bookingPatterns.length_of_stay.avg_nights, 'nights');
      console.log('  - Weekend %:', bookingPatterns.length_of_stay.weekend_percent);
      console.log('  - Week+ %:', bookingPatterns.length_of_stay.week_percent);
    } else {
      console.log('✗ No booking patterns returned');
    }
  } catch (e: any) {
    console.error('✗ Booking patterns error:', e.message);
  }
  
  console.log('\n=== 2. Market Details (for market score) ===');
  try {
    const marketDetails = await getMarketDetails(marketId);
    const metrics = (marketDetails as any)?.metrics;
    if (metrics) {
      console.log('✓ Market metrics found:');
      console.log('  - Market score:', metrics.market_score);
      console.log('  - Revenue:', metrics.revenue);
      console.log('  - Occupancy:', metrics.booked);
      console.log('  - ADR:', metrics.daily_rate);
    } else {
      console.log('✗ No market metrics returned');
    }
  } catch (e: any) {
    console.error('✗ Market details error:', e.message);
  }
  
  console.log('\n=== 3. Market Insights (revenue percentiles, competition) ===');
  try {
    console.log('Fetching listings for market insights...');
    const listings = await getAllMarketListings(marketId, { maxListings: 200 });
    console.log(`Got ${listings.length} listings`);
    if (listings.length > 0) {
      const insights = calculateMarketInsights(listings);
      console.log('✓ Market insights calculated:');
      console.log('  - Revenue percentiles:', JSON.stringify(insights.revenue_percentiles));
      console.log('  - Superhost %:', insights.superhost_pct);
      console.log('  - Professionally managed %:', insights.professionally_managed_pct);
      console.log('  - Property types:', insights.property_type_breakdown.slice(0, 3).map(p => `${p.type}: ${p.pct}%`).join(', '));
    } else {
      console.log('✗ No listings found');
    }
  } catch (e: any) {
    console.error('✗ Market insights error:', e.message);
  }
  
  console.log('\n=== Summary ===');
  console.log('The issue is that the frontend is using market IDs like "denver__co" but the API expects "airdna-163"');
  console.log('Need to check how the market ID is being passed from the frontend to the backend');
}

test();

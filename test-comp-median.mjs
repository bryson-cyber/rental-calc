import 'dotenv/config';

// Dynamically import the function
const { getComprehensivePropertyReport } = await import('./server/airdna.ts');

console.log('Testing Phoenix 2BR/1BA property...');
console.log('Address: 411 N 32nd Pl, Phoenix, AZ 85008');
console.log('');

try {
  const result = await getComprehensivePropertyReport({
    address: '411 N 32nd Pl, Phoenix, AZ 85008',
    bedrooms: 2,
    bathrooms: 1,
    accommodates: 4,
    latitude: 33.4484,
    longitude: -112.0261,
  });

  // Check location data
  console.log('=== LOCATION DATA ===');
  console.log('Geocoded city:', result.property?.property?._geocoded_city);
  console.log('Geocoded state:', result.property?.property?._geocoded_state);
  console.log('Address lookup:', result.property?.property?.address_lookup);
  
  // Check revenue estimates
  console.log('');
  console.log('=== REVENUE ESTIMATES ===');
  console.log('Annual Revenue:', result.property?.estimates?.annual_revenue);
  console.log('ADR:', result.property?.estimates?.average_daily_rate);
  console.log('Occupancy:', result.property?.estimates?.occupancy_rate);
  console.log('Revenue Range:', result.property?.estimates?.annual_revenue_low, '-', result.property?.estimates?.annual_revenue_high);
  
  // Check comp-median adjustment
  console.log('');
  console.log('=== COMP-MEDIAN ADJUSTMENT ===');
  console.log('Was adjusted:', result.comp_median_adjustment?.applied);
  console.log('Original revenue:', result.comp_median_adjustment?.original_annual_revenue);
  console.log('Comp median revenue:', result.comp_median_adjustment?.comp_median_revenue);
  console.log('Adjusted revenue:', result.comp_median_adjustment?.adjusted_annual_revenue);
  console.log('Scale factor:', result.comp_median_adjustment?.scale_factor);
  console.log('Comp count used:', result.comp_median_adjustment?.comp_count);
  
  // Check comps
  console.log('');
  console.log('=== SAME BR+BA COMPS ===');
  const comps = result.same_bedroom_comps || [];
  comps.forEach((c, i) => {
    console.log(`  ${i+1}. ${c.bedrooms}BR/${c.bathrooms}BA - Revenue: $${c.annual_revenue} - ADR: $${c.adr} - ${c.match_quality || 'unknown'}`);
  });
  
  // Check monthly forecast
  console.log('');
  console.log('=== MONTHLY FORECAST (first 3 months) ===');
  const forecast = result.monthly_forecast || [];
  forecast.slice(0, 3).forEach(m => {
    console.log(`  ${m.month}: Revenue $${m.revenue}, ADR $${m.adr}, Occ ${(m.occupancy * 100).toFixed(0)}%`);
  });

} catch (err) {
  console.error('Error:', err.message);
  console.error(err.stack);
}

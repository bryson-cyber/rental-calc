import { getRentalizerEstimate } from './server/airdna.ts';

async function test() {
  try {
    const result = await getRentalizerEstimate({
      address: '411 N 32nd Pl, Phoenix, AZ 85008',
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4
    });
    console.log('=== AirDNA Rentalizer Result for Phoenix ===');
    console.log('Property address:', result.property?.address);
    console.log('Address lookup:', result.property?.address_lookup);
    console.log('Zipcode:', result.property?.zipcode);
    console.log('_geocoded_city:', result.property?._geocoded_city);
    console.log('_geocoded_state:', result.property?._geocoded_state);
    console.log('Latitude:', result.property?.latitude);
    console.log('Longitude:', result.property?.longitude);
    console.log('ADR:', result.estimates?.adr);
    console.log('Annual Revenue:', result.estimates?.annual_revenue);
    console.log('Occupancy:', result.estimates?.occupancy_rate);
    console.log('\nFull property object:', JSON.stringify(result.property, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}
test();

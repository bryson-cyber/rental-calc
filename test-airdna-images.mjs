import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.AIRDNA_API_KEY;
const BASE_URL = 'https://api.airdna.co/v2';

async function testRentalizerImages() {
  const url = `${BASE_URL}/rentalizer/estimate?access_token=${API_KEY}&address=Flamingo%20Drive%2C%20Miami%20Beach%2C%20FL&bedrooms=2&bathrooms=1&accommodates=4&currency=usd`;
  
  console.log('Fetching rentalizer data...');
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.comps && data.comps.length > 0) {
    console.log('\n=== First 3 Comps Image Data ===');
    data.comps.slice(0, 3).forEach((comp, i) => {
      console.log(`\nComp ${i + 1}: ${comp.details?.title}`);
      console.log('  images:', comp.details?.images);
      console.log('  thumbnail_url:', comp.details?.thumbnail_url);
      console.log('  platforms:', JSON.stringify(comp.platforms));
    });
  } else {
    console.log('No comps returned');
    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));
  }
}

testRentalizerImages().catch(console.error);

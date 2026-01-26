// Test the getSubmarketsInMarket function
import { getSubmarketsInMarket } from './server/airdna.ts';

async function test() {
  console.log('Testing getSubmarketsInMarket for Atlanta...');
  const submarkets = await getSubmarketsInMarket('airdna-1');
  console.log('Submarkets found:', submarkets.length);
  console.log('Sample submarkets:', JSON.stringify(submarkets.slice(0, 5), null, 2));
}

test().catch(console.error);

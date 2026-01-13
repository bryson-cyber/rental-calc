import { searchMarketsAPI } from './server/airdna.js';

async function test() {
  try {
    console.log('Testing searchMarketsAPI with query: "Phoenix"');
    const results = await searchMarketsAPI('Phoenix');
    console.log('Results:', JSON.stringify(results, null, 2));
    console.log('Number of results:', results.length);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();

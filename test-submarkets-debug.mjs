// Test script to debug getSubmarketsInMarket
// Run with: pnpm exec tsx test-submarkets-debug.mjs

import { getSubmarketsInMarket, getMarketDetails, searchMarketsAPI } from './server/airdna.ts';

async function test() {
  console.log('Testing getSubmarketsInMarket for Atlanta (airdna-1)...');
  
  try {
    // First test getMarketDetails
    console.log('\n1. Testing getMarketDetails...');
    const details = await getMarketDetails('airdna-1');
    console.log('Market details:', JSON.stringify(details, null, 2));
    
    // Then test searchMarketsAPI
    console.log('\n2. Testing searchMarketsAPI for "Atlanta"...');
    const searchResults = await searchMarketsAPI('Atlanta', 50);
    console.log(`Found ${searchResults.length} results`);
    const submarkets = searchResults.filter(r => r.type === 'submarket');
    console.log(`Submarkets: ${submarkets.length}`);
    console.log('Sample submarkets:', submarkets.slice(0, 5).map(s => ({ id: s.id, name: s.name, type: s.type })));
    
    // Finally test getSubmarketsInMarket
    console.log('\n3. Testing getSubmarketsInMarket...');
    const result = await getSubmarketsInMarket('airdna-1');
    console.log(`Result: ${result.length} submarkets`);
    console.log('Submarkets:', result);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();

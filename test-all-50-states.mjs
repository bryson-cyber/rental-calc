import 'dotenv/config';

const API_BASE = 'http://localhost:3000/api/trpc';

// Major cities to test for each state
const STATE_TEST_CITIES = {
  'Alabama': 'Birmingham',
  'Alaska': 'Anchorage',
  'Arizona': 'Phoenix',
  'Arkansas': 'Little Rock',
  'California': 'Los Angeles',
  'Colorado': 'Denver',
  'Connecticut': 'Hartford',
  'Delaware': 'Wilmington',
  'Florida': 'Miami',
  'Georgia': 'Atlanta',
  'Hawaii': 'Honolulu',
  'Idaho': 'Boise',
  'Illinois': 'Chicago',
  'Indiana': 'Indianapolis',
  'Iowa': 'Des Moines',
  'Kansas': 'Wichita',
  'Kentucky': 'Louisville',
  'Louisiana': 'New Orleans',
  'Maine': 'Portland',
  'Maryland': 'Baltimore',
  'Massachusetts': 'Boston',
  'Michigan': 'Detroit',
  'Minnesota': 'Minneapolis',
  'Mississippi': 'Jackson',
  'Missouri': 'St. Louis',
  'Montana': 'Billings',
  'Nebraska': 'Omaha',
  'Nevada': 'Las Vegas',
  'New Hampshire': 'Manchester',
  'New Jersey': 'Newark',
  'New Mexico': 'Albuquerque',
  'New York': 'New York City',
  'North Carolina': 'Charlotte',
  'North Dakota': 'Fargo',
  'Ohio': 'Columbus',
  'Oklahoma': 'Oklahoma City',
  'Oregon': 'Portland',
  'Pennsylvania': 'Philadelphia',
  'Rhode Island': 'Providence',
  'South Carolina': 'Charleston',
  'South Dakota': 'Sioux Falls',
  'Tennessee': 'Nashville',
  'Texas': 'Houston',
  'Utah': 'Salt Lake City',
  'Vermont': 'Burlington',
  'Virginia': 'Virginia Beach',
  'Washington': 'Seattle',
  'West Virginia': 'Charleston',
  'Wisconsin': 'Milwaukee',
  'Wyoming': 'Cheyenne'
};

async function callTRPC(procedure, input = {}) {
  const url = `${API_BASE}/${procedure}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  
  const data = await response.json();
  return data.result.data;
}

async function testState(stateName, cityName) {
  console.log(`\n=== Testing ${stateName} (${cityName}) ===`);
  
  try {
    // 1. Search for the city
    console.log(`Searching for "${cityName}"...`);
    const searchResults = await callTRPC('marketResearchSimple.searchMarkets', {
      query: cityName
    });
    
    if (!searchResults || searchResults.length === 0) {
      console.log(`❌ No results found for "${cityName}"`);
      return { state: stateName, city: cityName, status: 'NO_RESULTS', details: 'No search results' };
    }
    
    console.log(`Found ${searchResults.length} results`);
    
    // 2. Check if results are from the correct state
    const stateResults = searchResults.filter(r => r.state === stateName);
    const wrongStateResults = searchResults.filter(r => r.state && r.state !== stateName);
    
    if (wrongStateResults.length > 0) {
      console.log(`⚠️  WARNING: Found ${wrongStateResults.length} results from other states:`);
      wrongStateResults.forEach(r => {
        console.log(`   - ${r.name} (${r.state})`);
      });
    }
    
    if (stateResults.length === 0) {
      console.log(`❌ No results from ${stateName} found`);
      return { state: stateName, city: cityName, status: 'WRONG_STATE', details: `Found ${wrongStateResults.length} results from other states` };
    }
    
    console.log(`✅ Found ${stateResults.length} results from ${stateName}`);
    
    // 3. Get the first result (market or submarket)
    const firstResult = stateResults[0];
    console.log(`Selected: ${firstResult.name} (${firstResult.type}, ID: ${firstResult.id})`);
    
    // 4. Check if it has zip codes directly
    if (firstResult.zipcodes && firstResult.zipcodes.length > 0) {
      console.log(`✅ ${firstResult.zipcodes.length} zip codes available directly: ${firstResult.zipcodes.slice(0, 3).join(', ')}${firstResult.zipcodes.length > 3 ? '...' : ''}`);
      return {
        state: stateName,
        city: cityName,
        status: 'PASS',
        details: `${firstResult.name}: ${firstResult.zipcodes.length} zip codes`,
        zipcodes: firstResult.zipcodes
      };
    }
    
    // 5. If it's a market, try to get submarkets
    if (firstResult.type === 'market') {
      console.log(`Getting submarkets for market ${firstResult.id}...`);
      const submarkets = await callTRPC('marketResearchSimple.getSubmarkets', {
        marketId: firstResult.id
      });
      
      if (!submarkets || submarkets.length === 0) {
        console.log(`⚠️  No submarkets found for ${firstResult.name}`);
        return { state: stateName, city: cityName, status: 'NO_SUBMARKETS', details: `${firstResult.name}: no submarkets` };
      }
      
      console.log(`Found ${submarkets.length} submarkets`);
      
      // Try to get zip codes for the first submarket
      const firstSubmarket = submarkets[0];
      console.log(`Getting zip codes for submarket: ${firstSubmarket.name} (ID: ${firstSubmarket.id})...`);
      
      const zipcodes = await callTRPC('marketResearchSimple.getZipcodesInSubmarket', {
        submarketId: firstSubmarket.id
      });
      
      if (!zipcodes || zipcodes.length === 0) {
        console.log(`❌ No zip codes found for ${firstSubmarket.name}`);
        return { state: stateName, city: cityName, status: 'NO_ZIPCODES', details: `${firstSubmarket.name}: no zip codes` };
      }
      
      console.log(`✅ ${zipcodes.length} zip codes found: ${zipcodes.slice(0, 3).map(z => z.zipcode).join(', ')}${zipcodes.length > 3 ? '...' : ''}`);
      return {
        state: stateName,
        city: cityName,
        status: 'PASS',
        details: `${firstResult.name} → ${firstSubmarket.name}: ${zipcodes.length} zip codes`,
        zipcodes: zipcodes.map(z => z.zipcode)
      };
    }
    
    // 6. If it's a submarket, try to get zip codes directly
    if (firstResult.type === 'submarket') {
      console.log(`Getting zip codes for submarket ${firstResult.id}...`);
      const zipcodes = await callTRPC('marketResearchSimple.getZipcodesInSubmarket', {
        submarketId: firstResult.id
      });
      
      if (!zipcodes || zipcodes.length === 0) {
        console.log(`❌ No zip codes found for ${firstResult.name}`);
        return { state: stateName, city: cityName, status: 'NO_ZIPCODES', details: `${firstResult.name}: no zip codes` };
      }
      
      console.log(`✅ ${zipcodes.length} zip codes found: ${zipcodes.slice(0, 3).map(z => z.zipcode).join(', ')}${zipcodes.length > 3 ? '...' : ''}`);
      return {
        state: stateName,
        city: cityName,
        status: 'PASS',
        details: `${firstResult.name}: ${zipcodes.length} zip codes`,
        zipcodes: zipcodes.map(z => z.zipcode)
      };
    }
    
    console.log(`⚠️  Unknown result type: ${firstResult.type}`);
    return { state: stateName, city: cityName, status: 'UNKNOWN_TYPE', details: `Type: ${firstResult.type}` };
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { state: stateName, city: cityName, status: 'ERROR', details: error.message };
  }
}

async function main() {
  console.log('Testing all 50 US states...\n');
  
  const results = [];
  
  for (const [state, city] of Object.entries(STATE_TEST_CITIES)) {
    const result = await testState(state, city);
    results.push(result);
    
    // Add a small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n\n=== SUMMARY ===\n');
  
  const passed = results.filter(r => r.status === 'PASS');
  const failed = results.filter(r => r.status !== 'PASS');
  
  console.log(`✅ PASSED: ${passed.length}/50 states`);
  console.log(`❌ FAILED: ${failed.length}/50 states\n`);
  
  if (passed.length > 0) {
    console.log('Passed states:');
    passed.forEach(r => {
      console.log(`  ✅ ${r.state} (${r.city}): ${r.details}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\nFailed states:');
    failed.forEach(r => {
      console.log(`  ❌ ${r.state} (${r.city}): ${r.status} - ${r.details}`);
    });
  }
  
  // Save results to file
  const fs = await import('fs');
  fs.writeFileSync(
    '/home/ubuntu/rental-calculator/test-results-all-states.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\nResults saved to test-results-all-states.json');
}

main().catch(console.error);

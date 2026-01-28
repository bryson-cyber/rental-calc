/**
 * Diagnostic script to measure API call timings
 * This helps identify which API calls are causing the 2-minute delay
 */

const AIRDNA_API_KEY = process.env.AIRDNA_API_KEY;
const testAddress = "1038 Ashland St APT 2, Houston, TX 77008";

async function timeApiCall(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    console.log(`✓ ${name}: ${duration}ms`);
    return { name, duration, success: true, result };
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`✗ ${name}: ${duration}ms (FAILED: ${error.message})`);
    return { name, duration, success: false, error: error.message };
  }
}

async function testRentalizer() {
  const response = await fetch('https://api.airdna.co/api/enterprise/v2/rentalizer/estimate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      address: testAddress,
      bedrooms: 2,
      bathrooms: 1
    })
  });
  return response.json();
}

async function testZipSearch(zipcode) {
  const response = await fetch(`https://api.airdna.co/api/enterprise/v2/market/search?zipcode=${zipcode}`, {
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`
    }
  });
  return response.json();
}

async function testMarketReport(marketId) {
  const response = await fetch(`https://api.airdna.co/api/enterprise/v2/market/${marketId}/report`, {
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`
    }
  });
  return response.json();
}

async function testBookingPatterns(marketId) {
  const response = await fetch(`https://api.airdna.co/api/enterprise/v2/market/${marketId}/booking_patterns?bedrooms=2`, {
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`
    }
  });
  return response.json();
}

async function testSupplyTrend(marketId) {
  const response = await fetch(`https://api.airdna.co/api/enterprise/v2/market/${marketId}/supply_trend?bedrooms=2`, {
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`
    }
  });
  return response.json();
}

async function testRentalizerComps() {
  const response = await fetch('https://api.airdna.co/api/enterprise/v2/rentalizer/comps', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRDNA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      address: testAddress,
      bedrooms: 2,
      bathrooms: 1,
      limit: 25
    })
  });
  return response.json();
}

async function main() {
  console.log('=== API Timing Diagnostic ===');
  console.log(`Testing with address: ${testAddress}`);
  console.log('');
  
  const results = [];
  
  // Test 1: Rentalizer (primary estimate)
  const rentalizerResult = await timeApiCall('Rentalizer Estimate', testRentalizer);
  results.push(rentalizerResult);
  
  // Get zipcode from rentalizer for subsequent tests
  const zipcode = rentalizerResult.result?.property?.zipcode || '77008';
  console.log(`Using zipcode: ${zipcode}`);
  
  // Test 2: ZIP Search
  const zipResult = await timeApiCall('ZIP Code Search', () => testZipSearch(zipcode));
  results.push(zipResult);
  
  // Get market ID for subsequent tests
  const marketId = zipResult.result?.market?.id || rentalizerResult.result?.property?.market_id;
  console.log(`Using market ID: ${marketId}`);
  
  if (marketId) {
    // Test 3: Market Report
    results.push(await timeApiCall('Market Report', () => testMarketReport(marketId)));
    
    // Test 4: Booking Patterns
    results.push(await timeApiCall('Booking Patterns', () => testBookingPatterns(marketId)));
    
    // Test 5: Supply Trend
    results.push(await timeApiCall('Supply Trend', () => testSupplyTrend(marketId)));
  }
  
  // Test 6: Rentalizer Comps
  results.push(await timeApiCall('Rentalizer Comps', testRentalizerComps));
  
  // Summary
  console.log('');
  console.log('=== Summary ===');
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`Total sequential time: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
  console.log(`Successful calls: ${results.filter(r => r.success).length}/${results.length}`);
  
  // Identify slow calls (>5s)
  const slowCalls = results.filter(r => r.duration > 5000);
  if (slowCalls.length > 0) {
    console.log('');
    console.log('=== Slow Calls (>5s) ===');
    slowCalls.forEach(r => console.log(`  ${r.name}: ${r.duration}ms`));
  }
}

main().catch(console.error);

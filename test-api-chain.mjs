/**
 * Diagnostic script to test the API chain for property analysis
 * Run with: node test-api-chain.mjs "1038 Ashland St APT 2, Houston, TX 77008"
 */

import 'dotenv/config';

const address = process.argv[2] || '1038 Ashland St APT 2, Houston, TX 77008';
const bedrooms = 2;
const bathrooms = 1;

console.log('='.repeat(60));
console.log('API CHAIN DIAGNOSTIC TEST');
console.log('='.repeat(60));
console.log(`Address: ${address}`);
console.log(`Bedrooms: ${bedrooms}, Bathrooms: ${bathrooms}`);
console.log('');

async function testAirDNA() {
  console.log('1. Testing AirDNA Rentalizer API...');
  const start = Date.now();
  
  try {
    const response = await fetch('https://api.airdna.co/api/enterprise/v2/rentalizer/estimate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AIRDNA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address, bedrooms, bathrooms }),
    });
    
    const elapsed = Date.now() - start;
    const data = await response.json();
    
    if (data.status?.type === 'success') {
      console.log(`   ✅ SUCCESS (${elapsed}ms)`);
      console.log(`   - Annual Revenue: $${data.payload?.estimates?.annual_revenue?.toLocaleString()}`);
      console.log(`   - ADR: $${data.payload?.estimates?.average_daily_rate}`);
      console.log(`   - Occupancy: ${Math.round((data.payload?.estimates?.occupancy_rate || 0) * 100)}%`);
      console.log(`   - Market ID: ${data.payload?.property?.market_id}`);
      console.log(`   - Comps: ${data.payload?.comps?.length || 0}`);
      return data.payload;
    } else {
      console.log(`   ❌ FAILED (${elapsed}ms): ${data.status?.message}`);
      return null;
    }
  } catch (error) {
    const elapsed = Date.now() - start;
    console.log(`   ❌ ERROR (${elapsed}ms): ${error.message}`);
    return null;
  }
}

async function testMarketData(marketId) {
  console.log(`\n2. Testing AirDNA Market Data (${marketId})...`);
  const start = Date.now();
  
  try {
    const response = await fetch(`https://api.airdna.co/api/enterprise/v2/market/metrics?market_id=${marketId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.AIRDNA_API_KEY}`,
      },
    });
    
    const elapsed = Date.now() - start;
    const data = await response.json();
    
    if (data.status?.type === 'success') {
      console.log(`   ✅ SUCCESS (${elapsed}ms)`);
      console.log(`   - Market Score: ${data.payload?.market_score}`);
      console.log(`   - Revenue: $${data.payload?.revenue?.toLocaleString()}`);
      return data.payload;
    } else {
      console.log(`   ❌ FAILED (${elapsed}ms): ${data.status?.message}`);
      return null;
    }
  } catch (error) {
    const elapsed = Date.now() - start;
    console.log(`   ❌ ERROR (${elapsed}ms): ${error.message}`);
    return null;
  }
}

async function testSeasonality(marketId) {
  console.log(`\n3. Testing AirDNA Seasonality (${marketId})...`);
  const start = Date.now();
  
  try {
    const response = await fetch(`https://api.airdna.co/api/enterprise/v2/market/seasonality?market_id=${marketId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.AIRDNA_API_KEY}`,
      },
    });
    
    const elapsed = Date.now() - start;
    const data = await response.json();
    
    if (data.status?.type === 'success') {
      console.log(`   ✅ SUCCESS (${elapsed}ms)`);
      console.log(`   - Months: ${data.payload?.length || 0}`);
      return data.payload;
    } else {
      console.log(`   ❌ FAILED (${elapsed}ms): ${data.status?.message}`);
      return null;
    }
  } catch (error) {
    const elapsed = Date.now() - start;
    console.log(`   ❌ ERROR (${elapsed}ms): ${error.message}`);
    return null;
  }
}

async function testForgeAPI() {
  console.log('\n4. Testing Forge API (AI Generation)...');
  const start = Date.now();
  
  try {
    const apiUrl = process.env.BUILT_IN_FORGE_API_URL 
      ? `${process.env.BUILT_IN_FORGE_API_URL.replace(/\/$/, '')}/v1/chat/completions`
      : 'https://forge.manus.im/v1/chat/completions';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'user', content: 'Say "API working" in exactly 2 words.' }
        ],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(10000),
    });
    
    const elapsed = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ SUCCESS (${elapsed}ms)`);
      console.log(`   - Response: ${data.choices?.[0]?.message?.content}`);
      return true;
    } else {
      console.log(`   ❌ FAILED (${elapsed}ms): HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    const elapsed = Date.now() - start;
    console.log(`   ❌ ERROR (${elapsed}ms): ${error.message}`);
    return false;
  }
}

async function main() {
  const totalStart = Date.now();
  
  // Test AirDNA
  const rentalizerData = await testAirDNA();
  
  if (rentalizerData?.property?.market_id) {
    await testMarketData(rentalizerData.property.market_id);
    await testSeasonality(rentalizerData.property.market_id);
  }
  
  // Test Forge API
  await testForgeAPI();
  
  const totalElapsed = Date.now() - totalStart;
  console.log('\n' + '='.repeat(60));
  console.log(`TOTAL TIME: ${totalElapsed}ms (${(totalElapsed / 1000).toFixed(1)}s)`);
  console.log('='.repeat(60));
}

main().catch(console.error);

/**
 * Test script for nurture sequence data fetching
 * Run with: node scripts/test-nurture-data.mjs
 */

import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';

async function testMarket(city, state) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${city}, ${state}`);
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(`${BASE_URL}/api/nurture/preview/${encodeURIComponent(city)}/${encodeURIComponent(state)}`);
    const data = await response.json();
    
    if (!data.success) {
      console.log('❌ Failed:', data.error);
      return;
    }
    
    const { marketSnapshot, regulations, dealOpportunity, topPerformers, marketDeepDive } = data.data;
    
    // Market Snapshot
    console.log('\n📊 Market Snapshot:');
    if (marketSnapshot) {
      console.log(`   Market: ${marketSnapshot.marketName} (${marketSnapshot.marketId})`);
      console.log(`   Listings: ${marketSnapshot.listingCount}`);
      console.log(`   Avg Annual Revenue: $${marketSnapshot.avgAnnualRevenue}`);
      console.log(`   Avg Occupancy: ${marketSnapshot.avgOccupancy}%`);
      console.log(`   Avg ADR: $${marketSnapshot.avgAdr}`);
      console.log(`   Trend: ${marketSnapshot.revenueTrend}`);
    } else {
      console.log('   ⚠️ No market snapshot data');
    }
    
    // Regulations
    console.log('\n📋 Regulations:');
    if (regulations) {
      console.log(`   Status: ${regulations.status}`);
      console.log(`   Permit Required: ${regulations.permitRequired ? 'Yes' : 'No'}`);
      console.log(`   Arbitrage Friendly: ${regulations.arbitrageFriendly ? 'Yes' : 'No'}`);
      console.log(`   Notes: ${regulations.notes}`);
    } else {
      console.log('   ⚠️ No regulation data');
    }
    
    // Deal Opportunity
    console.log('\n💰 Deal Opportunity:');
    if (dealOpportunity) {
      console.log(`   Address: ${dealOpportunity.address}`);
      console.log(`   Property: ${dealOpportunity.bedrooms}BR/${dealOpportunity.bathrooms}BA`);
      console.log(`   Monthly Revenue: $${dealOpportunity.monthlyRevenue}`);
      console.log(`   Monthly Rent: $${dealOpportunity.monthlyRent}`);
      console.log(`   Monthly Profit: $${dealOpportunity.monthlyProfit}`);
      console.log(`   Occupancy: ${dealOpportunity.occupancy}%`);
      console.log(`   ADR: $${dealOpportunity.adr}`);
    } else {
      console.log('   ⚠️ No deal opportunity data');
    }
    
    // Top Performers
    console.log('\n🏆 Top Performers:');
    if (topPerformers && topPerformers.length > 0) {
      topPerformers.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.title.substring(0, 40)}...`);
        console.log(`      Revenue: $${p.monthlyRevenue}/mo | Occupancy: ${p.occupancy}% | Rating: ${p.rating}⭐`);
      });
    } else {
      console.log('   ⚠️ No top performers data');
    }
    
    // Market Deep Dive
    console.log('\n📈 Market Deep Dive:');
    if (marketDeepDive) {
      console.log(`   Peak Season: ${marketDeepDive.peakSeason}`);
      console.log(`   Low Season: ${marketDeepDive.lowSeason}`);
      console.log(`   YoY Growth: ${marketDeepDive.yearOverYearGrowth}%`);
      console.log('   Revenue by Bedroom:');
      marketDeepDive.revenueByBedroom.forEach(r => {
        console.log(`      ${r.bedrooms}BR: $${r.avgRevenue}/year`);
      });
    } else {
      console.log('   ⚠️ No market deep dive data');
    }
    
    console.log('\n✅ Test complete');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function main() {
  console.log('🧪 Nurture Sequence Data Test');
  console.log('Testing data fetching for various markets...\n');
  
  // Test multiple markets
  await testMarket('Denver', 'CO');
  await testMarket('Austin', 'TX');
  await testMarket('Phoenix', 'AZ');
  await testMarket('Miami', 'FL');
  await testMarket('Nashville', 'TN');
  
  console.log('\n' + '='.repeat(60));
  console.log('All tests complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);

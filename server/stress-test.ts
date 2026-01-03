/**
 * Stress Test Script for Rental Calculator
 * 
 * Tests 100 diverse property addresses across different:
 * - Markets (major cities, suburbs, vacation destinations)
 * - Property types (1BR to 5BR+)
 * - Price ranges (low to high rent)
 * 
 * Run with: npx tsx server/stress-test.ts
 */

import { generateFullArbitrageAnalysis } from './sop-reports';

// 100 diverse test addresses across the US
const TEST_PROPERTIES = [
  // Major Metro Areas - High Volume Markets
  { address: '123 Main St, Austin, TX 78701', rent: 2500, bedrooms: 2, bathrooms: 1 },
  { address: '456 Oak Ave, Nashville, TN 37203', rent: 2200, bedrooms: 3, bathrooms: 2 },
  { address: '789 Pine St, Denver, CO 80202', rent: 2800, bedrooms: 2, bathrooms: 2 },
  { address: '321 Elm Dr, Seattle, WA 98101', rent: 3000, bedrooms: 1, bathrooms: 1 },
  { address: '654 Maple Ln, Portland, OR 97201', rent: 2400, bedrooms: 2, bathrooms: 1 },
  { address: '987 Cedar Blvd, Phoenix, AZ 85001', rent: 1800, bedrooms: 3, bathrooms: 2 },
  { address: '147 Birch Way, San Diego, CA 92101', rent: 3200, bedrooms: 2, bathrooms: 2 },
  { address: '258 Walnut St, Miami, FL 33101', rent: 2600, bedrooms: 2, bathrooms: 2 },
  { address: '369 Spruce Ave, Atlanta, GA 30301', rent: 2100, bedrooms: 3, bathrooms: 2 },
  { address: '741 Ash Ct, Dallas, TX 75201', rent: 2300, bedrooms: 2, bathrooms: 2 },
  
  // Vacation Destinations - Seasonal Markets
  { address: '100 Beach Rd, Destin, FL 32541', rent: 3500, bedrooms: 4, bathrooms: 3 },
  { address: '200 Ocean Dr, Myrtle Beach, SC 29577', rent: 2800, bedrooms: 3, bathrooms: 2 },
  { address: '300 Mountain View, Gatlinburg, TN 37738', rent: 2200, bedrooms: 2, bathrooms: 2 },
  { address: '400 Lake Shore Dr, Lake Tahoe, CA 96150', rent: 4000, bedrooms: 4, bathrooms: 3 },
  { address: '500 Ski Run Blvd, Park City, UT 84060', rent: 4500, bedrooms: 5, bathrooms: 4 },
  { address: '600 Gulf Blvd, Clearwater, FL 33767', rent: 3000, bedrooms: 3, bathrooms: 2 },
  { address: '700 Coastal Hwy, Outer Banks, NC 27959', rent: 3200, bedrooms: 4, bathrooms: 3 },
  { address: '800 Palm Dr, Key West, FL 33040', rent: 3800, bedrooms: 2, bathrooms: 2 },
  { address: '900 Canyon Rd, Sedona, AZ 86336', rent: 2800, bedrooms: 3, bathrooms: 2 },
  { address: '1000 Wine Country Ln, Napa, CA 94558', rent: 4200, bedrooms: 3, bathrooms: 2 },
  
  // Suburban Markets - Family-Friendly
  { address: '111 Suburban Dr, Scottsdale, AZ 85251', rent: 2600, bedrooms: 4, bathrooms: 3 },
  { address: '222 Family Ct, Frisco, TX 75034', rent: 2800, bedrooms: 4, bathrooms: 3 },
  { address: '333 Quiet St, Alpharetta, GA 30009', rent: 2400, bedrooms: 3, bathrooms: 2 },
  { address: '444 Cul-de-sac Ln, Chandler, AZ 85224', rent: 2200, bedrooms: 3, bathrooms: 2 },
  { address: '555 School Zone Rd, Plano, TX 75024', rent: 2700, bedrooms: 4, bathrooms: 3 },
  { address: '666 Park View Dr, Bellevue, WA 98004', rent: 3500, bedrooms: 3, bathrooms: 2 },
  { address: '777 Green Acres, Franklin, TN 37064', rent: 2900, bedrooms: 4, bathrooms: 3 },
  { address: '888 Meadow Ln, Brentwood, TN 37027', rent: 3100, bedrooms: 4, bathrooms: 3 },
  { address: '999 Hillside Ave, Boulder, CO 80302', rent: 3200, bedrooms: 3, bathrooms: 2 },
  { address: '1010 Valley Rd, Thousand Oaks, CA 91360', rent: 3400, bedrooms: 3, bathrooms: 2 },
  
  // Urban Core - High-Rise/Condo Markets
  { address: '1111 Downtown St, Chicago, IL 60601', rent: 2800, bedrooms: 1, bathrooms: 1 },
  { address: '1212 High Rise Ave, New York, NY 10001', rent: 4500, bedrooms: 1, bathrooms: 1 },
  { address: '1313 Loft District, Los Angeles, CA 90012', rent: 3200, bedrooms: 1, bathrooms: 1 },
  { address: '1414 Arts District, San Francisco, CA 94102', rent: 3800, bedrooms: 1, bathrooms: 1 },
  { address: '1515 Midtown Blvd, Houston, TX 77002', rent: 2200, bedrooms: 2, bathrooms: 2 },
  { address: '1616 Financial District, Boston, MA 02101', rent: 3500, bedrooms: 1, bathrooms: 1 },
  { address: '1717 Capitol Hill, Washington, DC 20001', rent: 3000, bedrooms: 1, bathrooms: 1 },
  { address: '1818 Uptown Ave, Minneapolis, MN 55401', rent: 2000, bedrooms: 2, bathrooms: 1 },
  { address: '1919 River Walk, San Antonio, TX 78205', rent: 1800, bedrooms: 2, bathrooms: 1 },
  { address: '2020 Gaslamp Quarter, San Diego, CA 92101', rent: 2800, bedrooms: 1, bathrooms: 1 },
  
  // College Towns - Student Markets
  { address: '2121 Campus Dr, Austin, TX 78705', rent: 1500, bedrooms: 2, bathrooms: 1 },
  { address: '2222 University Ave, Ann Arbor, MI 48104', rent: 1800, bedrooms: 3, bathrooms: 1 },
  { address: '2323 College St, Boulder, CO 80302', rent: 2000, bedrooms: 2, bathrooms: 1 },
  { address: '2424 Frat Row, Athens, GA 30601', rent: 1200, bedrooms: 3, bathrooms: 2 },
  { address: '2525 Stadium Dr, Tuscaloosa, AL 35401', rent: 1100, bedrooms: 3, bathrooms: 2 },
  { address: '2626 Sorority Ln, Gainesville, FL 32601', rent: 1300, bedrooms: 3, bathrooms: 2 },
  { address: '2727 Academic Way, Madison, WI 53703', rent: 1600, bedrooms: 2, bathrooms: 1 },
  { address: '2828 Research Park, Raleigh, NC 27601', rent: 1700, bedrooms: 2, bathrooms: 2 },
  { address: '2929 Tech Blvd, San Jose, CA 95112', rent: 2800, bedrooms: 2, bathrooms: 1 },
  { address: '3030 Innovation Dr, Cambridge, MA 02139', rent: 3200, bedrooms: 1, bathrooms: 1 },
  
  // Emerging Markets - Growth Areas
  { address: '3131 New Development, Boise, ID 83702', rent: 1800, bedrooms: 3, bathrooms: 2 },
  { address: '3232 Growth Ave, Salt Lake City, UT 84101', rent: 2000, bedrooms: 2, bathrooms: 2 },
  { address: '3333 Boom Town Rd, Reno, NV 89501', rent: 2200, bedrooms: 2, bathrooms: 2 },
  { address: '3434 Expansion St, Charlotte, NC 28202', rent: 2100, bedrooms: 2, bathrooms: 2 },
  { address: '3535 Rising Star Ln, Tampa, FL 33602', rent: 2300, bedrooms: 2, bathrooms: 2 },
  { address: '3636 Hot Market Dr, Jacksonville, FL 32202', rent: 1900, bedrooms: 3, bathrooms: 2 },
  { address: '3737 Trending Ave, Columbus, OH 43215', rent: 1700, bedrooms: 2, bathrooms: 1 },
  { address: '3838 Up-and-Coming St, Indianapolis, IN 46204', rent: 1600, bedrooms: 3, bathrooms: 2 },
  { address: '3939 Growth Corridor, Oklahoma City, OK 73102', rent: 1400, bedrooms: 3, bathrooms: 2 },
  { address: '4040 Development Zone, Kansas City, MO 64105', rent: 1500, bedrooms: 2, bathrooms: 1 },
  
  // Luxury Markets - High-End Properties
  { address: '4141 Mansion Row, Beverly Hills, CA 90210', rent: 8000, bedrooms: 5, bathrooms: 5 },
  { address: '4242 Penthouse Dr, Manhattan, NY 10019', rent: 10000, bedrooms: 3, bathrooms: 3 },
  { address: '4343 Estate Ln, Aspen, CO 81611', rent: 12000, bedrooms: 6, bathrooms: 6 },
  { address: '4444 Waterfront Ave, Miami Beach, FL 33139', rent: 7500, bedrooms: 4, bathrooms: 4 },
  { address: '4545 Vineyard Rd, Sonoma, CA 95476', rent: 5500, bedrooms: 4, bathrooms: 3 },
  { address: '4646 Golf Course Dr, Scottsdale, AZ 85255', rent: 5000, bedrooms: 4, bathrooms: 4 },
  { address: '4747 Country Club Ln, Palm Beach, FL 33480', rent: 8500, bedrooms: 5, bathrooms: 5 },
  { address: '4848 Exclusive Dr, Malibu, CA 90265', rent: 9000, bedrooms: 4, bathrooms: 4 },
  { address: '4949 Private Island Rd, Naples, FL 34102', rent: 6000, bedrooms: 4, bathrooms: 3 },
  { address: '5050 Billionaire Row, San Francisco, CA 94115', rent: 7000, bedrooms: 3, bathrooms: 3 },
  
  // Budget Markets - Affordable Areas
  { address: '5151 Affordable St, Memphis, TN 38103', rent: 900, bedrooms: 2, bathrooms: 1 },
  { address: '5252 Budget Ln, Cleveland, OH 44113', rent: 1000, bedrooms: 2, bathrooms: 1 },
  { address: '5353 Value Ave, Detroit, MI 48201', rent: 800, bedrooms: 3, bathrooms: 1 },
  { address: '5454 Economy Dr, St. Louis, MO 63101', rent: 950, bedrooms: 2, bathrooms: 1 },
  { address: '5555 Bargain Blvd, Pittsburgh, PA 15222', rent: 1100, bedrooms: 2, bathrooms: 1 },
  { address: '5656 Discount Ct, Baltimore, MD 21201', rent: 1200, bedrooms: 2, bathrooms: 1 },
  { address: '5757 Savings St, Milwaukee, WI 53202', rent: 1050, bedrooms: 2, bathrooms: 1 },
  { address: '5858 Low Cost Ln, Louisville, KY 40202', rent: 1000, bedrooms: 2, bathrooms: 1 },
  { address: '5959 Thrifty Ave, Cincinnati, OH 45202', rent: 1100, bedrooms: 2, bathrooms: 1 },
  { address: '6060 Frugal Dr, Buffalo, NY 14202', rent: 950, bedrooms: 2, bathrooms: 1 },
  
  // Unique/Niche Markets
  { address: '6161 Historic District, Charleston, SC 29401', rent: 2800, bedrooms: 2, bathrooms: 2 },
  { address: '6262 French Quarter, New Orleans, LA 70116', rent: 2500, bedrooms: 2, bathrooms: 1 },
  { address: '6363 Wine Trail, Paso Robles, CA 93446', rent: 2400, bedrooms: 3, bathrooms: 2 },
  { address: '6464 Music Row, Nashville, TN 37203', rent: 2600, bedrooms: 2, bathrooms: 2 },
  { address: '6565 Art District, Santa Fe, NM 87501', rent: 2200, bedrooms: 2, bathrooms: 2 },
  { address: '6666 Bourbon St, Louisville, KY 40202', rent: 1800, bedrooms: 2, bathrooms: 1 },
  { address: '6767 Fishing Village, Key Largo, FL 33037', rent: 3000, bedrooms: 3, bathrooms: 2 },
  { address: '6868 Ski Village, Breckenridge, CO 80424', rent: 4000, bedrooms: 3, bathrooms: 3 },
  { address: '6969 Desert Oasis, Palm Springs, CA 92262', rent: 3200, bedrooms: 3, bathrooms: 2 },
  { address: '7070 Island Paradise, Maui, HI 96761', rent: 5000, bedrooms: 3, bathrooms: 2 },
  
  // Edge Cases - Unusual Configurations
  { address: '7171 Studio Apt, Brooklyn, NY 11201', rent: 2500, bedrooms: 1, bathrooms: 1 },
  { address: '7272 Mega House, Houston, TX 77024', rent: 6000, bedrooms: 7, bathrooms: 6 },
  { address: '7373 Tiny Home, Portland, OR 97214', rent: 1200, bedrooms: 1, bathrooms: 1 },
  { address: '7474 Duplex Unit, Denver, CO 80205', rent: 2000, bedrooms: 2, bathrooms: 1 },
  { address: '7575 Converted Barn, Vermont, VT 05401', rent: 2200, bedrooms: 3, bathrooms: 2 },
  { address: '7676 Treehouse, Asheville, NC 28801', rent: 1800, bedrooms: 1, bathrooms: 1 },
  { address: '7777 Houseboat, Seattle, WA 98109', rent: 2800, bedrooms: 2, bathrooms: 1 },
  { address: '7878 Yurt Village, Joshua Tree, CA 92252', rent: 1500, bedrooms: 1, bathrooms: 1 },
  { address: '7979 A-Frame, Lake Arrowhead, CA 92352', rent: 2400, bedrooms: 2, bathrooms: 1 },
  { address: '8080 Container Home, Austin, TX 78702', rent: 1600, bedrooms: 1, bathrooms: 1 },
];

interface TestResult {
  address: string;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  success: boolean;
  duration_ms: number;
  error?: string;
  verdict?: string;
  revenue_estimate?: number;
  has_narrative?: boolean;
  has_competitors?: boolean;
  has_seasonality?: boolean;
}

async function runStressTest() {
  console.log('='.repeat(80));
  console.log('STRESS TEST: 100 Property Analysis');
  console.log('='.repeat(80));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Total properties: ${TEST_PROPERTIES.length}`);
  console.log('');
  
  const results: TestResult[] = [];
  let successCount = 0;
  let errorCount = 0;
  const errorTypes: Record<string, number> = {};
  
  // Process properties sequentially to avoid rate limiting
  for (let i = 0; i < TEST_PROPERTIES.length; i++) {
    const property = TEST_PROPERTIES[i];
    const startTime = Date.now();
    
    console.log(`[${i + 1}/${TEST_PROPERTIES.length}] Testing: ${property.address}`);
    
    try {
      const analysis = await generateFullArbitrageAnalysis(
        property.address,
        property.rent,
        property.bedrooms,
        property.bathrooms
      );
      
      const duration = Date.now() - startTime;
      
      // Check for key data presence
      const hasNarrative = !!analysis.narrative_report;
      const hasCompetitors = (analysis.competitors?.length || 0) > 0;
      const hasSeasonality = (analysis.seasonality?.length || 0) > 0;
      const revenueEstimate = analysis.property_estimate?.estimates?.annual_revenue || 0;
      const verdict = String(analysis.ai_analysis?.verdict || 'unknown');
      
      results.push({
        address: property.address,
        rent: property.rent,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        success: true,
        duration_ms: duration,
        verdict,
        revenue_estimate: revenueEstimate,
        has_narrative: hasNarrative,
        has_competitors: hasCompetitors,
        has_seasonality: hasSeasonality,
      });
      
      successCount++;
      console.log(`  ✓ Success (${duration}ms) - Verdict: ${verdict}, Revenue: $${revenueEstimate.toLocaleString()}`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Categorize error
      let errorType = 'Unknown';
      if (errorMessage.includes('rate limit')) errorType = 'Rate Limit';
      else if (errorMessage.includes('timeout')) errorType = 'Timeout';
      else if (errorMessage.includes('network')) errorType = 'Network';
      else if (errorMessage.includes('API')) errorType = 'API Error';
      else if (errorMessage.includes('not found')) errorType = 'Not Found';
      else if (errorMessage.includes('invalid')) errorType = 'Invalid Input';
      
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      
      results.push({
        address: property.address,
        rent: property.rent,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        success: false,
        duration_ms: duration,
        error: errorMessage,
      });
      
      errorCount++;
      console.log(`  ✗ Error (${duration}ms): ${errorMessage.substring(0, 100)}`);
    }
    
    // Small delay between requests to avoid rate limiting
    if (i < TEST_PROPERTIES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Generate summary report
  console.log('');
  console.log('='.repeat(80));
  console.log('STRESS TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log(`Completed at: ${new Date().toISOString()}`);
  console.log('');
  
  console.log('OVERALL STATISTICS:');
  console.log(`  Total Tests: ${TEST_PROPERTIES.length}`);
  console.log(`  Successful: ${successCount} (${((successCount / TEST_PROPERTIES.length) * 100).toFixed(1)}%)`);
  console.log(`  Failed: ${errorCount} (${((errorCount / TEST_PROPERTIES.length) * 100).toFixed(1)}%)`);
  console.log('');
  
  if (errorCount > 0) {
    console.log('ERROR BREAKDOWN:');
    for (const [type, count] of Object.entries(errorTypes)) {
      console.log(`  ${type}: ${count}`);
    }
    console.log('');
  }
  
  // Performance stats
  const successfulResults = results.filter(r => r.success);
  if (successfulResults.length > 0) {
    const durations = successfulResults.map(r => r.duration_ms);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    console.log('PERFORMANCE STATISTICS:');
    console.log(`  Average Duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`  Min Duration: ${minDuration}ms`);
    console.log(`  Max Duration: ${maxDuration}ms`);
    console.log('');
    
    // Data quality stats
    const withNarrative = successfulResults.filter(r => r.has_narrative).length;
    const withCompetitors = successfulResults.filter(r => r.has_competitors).length;
    const withSeasonality = successfulResults.filter(r => r.has_seasonality).length;
    
    console.log('DATA QUALITY:');
    console.log(`  With Narrative Report: ${withNarrative}/${successfulResults.length} (${((withNarrative / successfulResults.length) * 100).toFixed(1)}%)`);
    console.log(`  With Competitors: ${withCompetitors}/${successfulResults.length} (${((withCompetitors / successfulResults.length) * 100).toFixed(1)}%)`);
    console.log(`  With Seasonality: ${withSeasonality}/${successfulResults.length} (${((withSeasonality / successfulResults.length) * 100).toFixed(1)}%)`);
    console.log('');
    
    // Verdict distribution
    const verdicts: Record<string, number> = {};
    for (const r of successfulResults) {
      if (r.verdict) {
        verdicts[r.verdict] = (verdicts[r.verdict] || 0) + 1;
      }
    }
    
    console.log('VERDICT DISTRIBUTION:');
    for (const [verdict, count] of Object.entries(verdicts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${verdict}: ${count} (${((count / successfulResults.length) * 100).toFixed(1)}%)`);
    }
  }
  
  // List all errors
  if (errorCount > 0) {
    console.log('');
    console.log('FAILED TESTS:');
    for (const result of results.filter(r => !r.success)) {
      console.log(`  - ${result.address}`);
      console.log(`    Error: ${result.error?.substring(0, 150)}`);
    }
  }
  
  console.log('');
  console.log('='.repeat(80));
  console.log('STRESS TEST COMPLETE');
  console.log('='.repeat(80));
  
  // Return results for programmatic use
  return {
    total: TEST_PROPERTIES.length,
    successful: successCount,
    failed: errorCount,
    successRate: (successCount / TEST_PROPERTIES.length) * 100,
    results,
    errorTypes,
  };
}

// Run the test
runStressTest()
  .then(summary => {
    console.log('');
    console.log(`Final Success Rate: ${summary.successRate.toFixed(1)}%`);
    process.exit(summary.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Stress test failed to run:', error);
    process.exit(1);
  });

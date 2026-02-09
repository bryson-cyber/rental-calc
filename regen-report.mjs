// Script to regenerate a report via direct AirDNA API + Gemini calls
// Uses the same code paths as the server, including geocoding and market search fallbacks

import 'dotenv/config';
import mysql from 'mysql2/promise';

const SHARE_ID = 'l6984fncmlf7nhnx';

async function main() {
  console.log('Connecting to database...');
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Fetch the existing report
  const [rows] = await connection.execute(
    'SELECT * FROM shared_reports WHERE shareId = ?',
    [SHARE_ID]
  );
  
  if (!rows || rows.length === 0) {
    console.error('Report not found');
    process.exit(1);
  }
  
  const report = rows[0];
  console.log('Found report:', report.address, report.bedrooms, 'BR', report.bathrooms, 'BA');
  
  // Parse existing data to preserve purchase/arbitrage
  let existingData = {};
  try {
    existingData = JSON.parse(report.reportData || '{}');
  } catch { existingData = {}; }
  
  const address = report.address;
  const bedrooms = report.bedrooms || 5;
  const bathrooms = report.bathrooms ? parseFloat(report.bathrooms) : 4;
  const accommodates = report.accommodates || 10;
  
  console.log(`\nRegenerating report for: ${address}`);
  console.log(`Property: ${bedrooms}BR / ${bathrooms}BA / Sleeps ${accommodates}`);
  console.log('Existing purchase data:', !!existingData.purchase);
  console.log('Existing rental_arbitrage data:', !!existingData.rental_arbitrage);
  
  // Import the AirDNA and Gemini functions
  const { getComprehensivePropertyReport } = await import('./server/airdna.ts');
  const { generateFullReportSummary } = await import('./server/gemini.ts');
  
  // Step 1: Fetch fresh data from AirDNA (now includes geocoding + market search fallbacks)
  console.log('\n--- Step 1: Fetching fresh AirDNA data (with geocoding + market fallbacks) ---');
  const freshReport = await getComprehensivePropertyReport(address, bedrooms, bathrooms, accommodates);
  
  if (!freshReport) {
    console.error('Failed to fetch data from AirDNA');
    process.exit(1);
  }
  
  const prop = freshReport.property;
  const market = freshReport.market;
  const comps = prop?.comps || [];
  const sameBedComps = freshReport.same_bedroom_comps || [];
  const bedroomPerf = freshReport.bedroom_performance || [];
  const historical = market?.historical;
  
  console.log('\n=== Data Summary ===');
  console.log('Property estimates:', {
    annual_revenue: prop?.estimates?.annual_revenue,
    occupancy: prop?.estimates?.occupancy_rate,
    adr: prop?.estimates?.average_daily_rate,
  });
  console.log('Property lat/lng:', prop?.property?.latitude, prop?.property?.longitude);
  console.log('Property geocoded city:', (prop?.property)?._geocoded_city);
  console.log('Property geocoded state:', (prop?.property)?._geocoded_state);
  console.log('Property address_lookup:', prop?.property?.address_lookup);
  console.log('Market found:', market ? `${market.name} (${market.id})` : 'NONE');
  console.log('Market listing count:', market?.listing_count || 0);
  console.log('Comps count:', comps.length);
  console.log('Same bed comps count:', sameBedComps.length);
  console.log('Bedroom performance entries:', bedroomPerf.length);
  console.log('Historical data available:', !!historical);
  
  // Step 2: Build new report data
  console.log('\n--- Step 2: Building report data ---');
  const occRate = prop?.estimates?.occupancy_rate || 0;
  const adr = prop?.estimates?.average_daily_rate || 0;
  const annualRev = prop?.estimates?.annual_revenue || 0;
  
  // Get city/state from geocoding, address_lookup, or address parsing
  const geocodedCity = (prop?.property)?._geocoded_city || '';
  const geocodedState = (prop?.property)?._geocoded_state || '';
  const addressLookup = prop?.property?.address_lookup || '';
  
  // Parse address_lookup properly: "2680 CARNATION DR, RICHARDSON, TX 75082"
  // City is the second-to-last part before state, not the first part
  let city = geocodedCity;
  let state = geocodedState;
  
  if (!city && addressLookup) {
    const parts = addressLookup.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      // "2680 CARNATION DR, RICHARDSON, TX 75082" → city = "RICHARDSON"
      city = parts[parts.length - 2]; // Second to last
      const stateZip = parts[parts.length - 1]; // "TX 75082"
      state = state || stateZip.match(/([A-Z]{2})/)?.[1] || '';
    } else if (parts.length === 2) {
      // "RICHARDSON, TX 75082" → city = "RICHARDSON"
      city = parts[0];
      state = state || parts[1].match(/([A-Z]{2})/)?.[1] || '';
    }
  }
  
  // Capitalize properly
  city = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  
  console.log('Resolved city:', city);
  console.log('Resolved state:', state);
  
  // Calculate revenue percentiles
  const allComps = [...comps, ...sameBedComps];
  const compRevenues = allComps
    .filter(c => c.annual_revenue > 0)
    .map(c => c.annual_revenue)
    .sort((a, b) => a - b);
  const uniqueRevenues = Array.from(new Set(compRevenues));
  
  let revenuePercentiles = undefined;
  if (uniqueRevenues.length >= 5) {
    revenuePercentiles = {
      p10: uniqueRevenues[Math.floor(uniqueRevenues.length * 10 / 100)],
      p25: uniqueRevenues[Math.floor(uniqueRevenues.length * 25 / 100)],
      p50: uniqueRevenues[Math.floor(uniqueRevenues.length * 50 / 100)],
      p75: uniqueRevenues[Math.floor(uniqueRevenues.length * 75 / 100)],
      p90: uniqueRevenues[Math.floor(uniqueRevenues.length * 90 / 100)],
    };
    console.log('Revenue percentiles:', revenuePercentiles);
  } else {
    console.log('Not enough comps for percentiles:', uniqueRevenues.length);
  }
  
  // Build historical data
  let historicalData = undefined;
  if (historical) {
    const revenueHistory = historical.revenue || [];
    if (revenueHistory.length >= 13) {
      const latestRevenue = revenueHistory[revenueHistory.length - 1]?.value || 0;
      const yearAgoRevenue = revenueHistory[revenueHistory.length - 13]?.value || 0;
      const yoyChange = yearAgoRevenue > 0 ? ((latestRevenue - yearAgoRevenue) / yearAgoRevenue) * 100 : 0;
      
      const occupancyHistory = historical.occupancy || [];
      const adrHistory = historical.adr || [];
      
      historicalData = {
        summary: {
          yoy_revenue_change: Math.round(yoyChange * 10) / 10,
          yoy_occupancy_change: occupancyHistory.length >= 13 ? 
            Math.round(((occupancyHistory[occupancyHistory.length - 1]?.value - occupancyHistory[occupancyHistory.length - 13]?.value) / (occupancyHistory[occupancyHistory.length - 13]?.value || 1)) * 1000) / 10 : 0,
          yoy_adr_change: adrHistory.length >= 13 ?
            Math.round(((adrHistory[adrHistory.length - 1]?.value - adrHistory[adrHistory.length - 13]?.value) / (adrHistory[adrHistory.length - 13]?.value || 1)) * 1000) / 10 : 0,
        },
        monthly: revenueHistory.slice(-24).map((d, i) => ({
          date: d.date,
          revenue: d.value,
          occupancy: occupancyHistory[occupancyHistory.length - revenueHistory.slice(-24).length + i]?.value || 0,
          adr: adrHistory[adrHistory.length - revenueHistory.slice(-24).length + i]?.value || 0,
        })),
      };
      console.log('Historical data: YoY revenue change:', historicalData.summary.yoy_revenue_change, '%');
    }
  }
  
  const newReportData = {
    property: {
      address: address,
      city: city,
      state: state,
      bedrooms: bedrooms,
      bathrooms: bathrooms,
      accommodates: accommodates,
      latitude: prop?.property?.latitude,
      longitude: prop?.property?.longitude,
    },
    revenue_estimate: {
      annual: annualRev,
      monthly: Math.round(annualRev / 12),
      nightly: adr,
      occupancy: occRate,
      range: {
        low: prop?.estimates?.annual_revenue_low || Math.round(annualRev * 0.9),
        high: prop?.estimates?.annual_revenue_high || Math.round(annualRev * 1.1),
      },
    },
    monthly_forecast: prop?.monthly_forecast || existingData.monthly_forecast || [],
    market_data: market ? {
      name: market.name || 'Local Market',
      listing_count: market.listing_count || market.metrics?.active_listings || 0,
      metrics: {
        occupancy: market.metrics?.occupancy || occRate,
        adr: market.metrics?.adr || adr,
        revenue: market.metrics?.revenue || annualRev,
        active_listings: market.metrics?.active_listings || market.listing_count || 0,
        market_score: market.metrics?.market_score,
      },
    } : existingData.market_data,
    bedroom_performance: bedroomPerf.length > 0 ? bedroomPerf : existingData.bedroom_performance || [],
    revenue_percentiles: revenuePercentiles,
    historical_data: historicalData,
    comps: sameBedComps.map(c => ({
      id: c.id,
      title: c.title || c.name || 'Competitor',
      bedrooms: c.bedrooms,
      bathrooms: c.bathrooms,
      annual_revenue: c.annual_revenue || 0,
      adr: c.adr || 0,
      occupancy: c.occupancy || 0,
      rating: c.rating,
      reviews: c.reviews || 0,
      distance_meters: c.distance_meters,
      airbnb_url: c.airbnb_url || c.url,
      image_url: c.image_url,
    })),
    // Preserve existing purchase and rental arbitrage settings
    purchase: existingData.purchase,
    rental_arbitrage: existingData.rental_arbitrage,
    prepared_for: existingData.prepared_for,
  };
  
  console.log('\nReport data built:');
  console.log('  City:', newReportData.property.city);
  console.log('  State:', newReportData.property.state);
  console.log('  Lat/Lng:', newReportData.property.latitude, newReportData.property.longitude);
  console.log('  Market name:', newReportData.market_data?.name);
  console.log('  Market listings:', newReportData.market_data?.listing_count);
  console.log('  Comps:', newReportData.comps.length);
  console.log('  Bedroom perf entries:', newReportData.bedroom_performance.length);
  console.log('  Revenue percentiles:', !!newReportData.revenue_percentiles);
  console.log('  Historical data:', !!newReportData.historical_data);
  console.log('  Purchase preserved:', !!newReportData.purchase);
  console.log('  Prepared for:', newReportData.prepared_for);
  
  // Step 3: Generate AI summary via Gemini 3 Pro
  console.log('\n--- Step 3: Generating AI summary via Gemini 3 Pro ---');
  try {
    const summaryInput = {
      property: newReportData.property,
      revenue: newReportData.revenue_estimate,
      monthlyForecast: newReportData.monthly_forecast,
      marketData: newReportData.market_data ? {
        name: newReportData.market_data.name,
        occupancy: newReportData.market_data.metrics?.occupancy || 0,
        adr: newReportData.market_data.metrics?.adr || 0,
        revenue: newReportData.market_data.metrics?.revenue || 0,
        listingCount: newReportData.market_data.listing_count || 0,
        marketScore: newReportData.market_data.metrics?.market_score,
      } : undefined,
      bedroomPerformance: newReportData.bedroom_performance,
      competitors: newReportData.comps.slice(0, 15).map(c => ({
        name: c.title,
        revenue: c.annual_revenue,
        adr: c.adr,
        occupancy: c.occupancy,
        rating: c.rating,
        reviews: c.reviews,
        bedrooms: c.bedrooms,
      })),
      revenuePercentiles: newReportData.revenue_percentiles,
      historicalData: newReportData.historical_data,
      rentalArbitrage: newReportData.rental_arbitrage,
      purchase: newReportData.purchase,
      preparedFor: newReportData.prepared_for,
    };
    
    const aiSummary = await generateFullReportSummary(summaryInput);
    if (aiSummary && aiSummary.length > 100) {
      newReportData.ai_summary = aiSummary;
      console.log(`AI summary generated: ${aiSummary.length} chars`);
      console.log('First 300 chars:', aiSummary.substring(0, 300));
    } else {
      console.log('AI summary too short or empty:', aiSummary?.length || 0);
    }
  } catch (aiErr) {
    console.error('AI summary generation failed:', aiErr.message);
  }
  
  // Step 4: Update the database
  console.log('\n--- Step 4: Updating database ---');
  const newReportDataStr = JSON.stringify(newReportData);
  console.log('Report data size:', newReportDataStr.length, 'bytes');
  
  await connection.execute(
    'UPDATE shared_reports SET reportData = ?, latitude = ?, longitude = ?, updatedAt = NOW() WHERE shareId = ?',
    [
      newReportDataStr,
      newReportData.property.latitude?.toString() || null,
      newReportData.property.longitude?.toString() || null,
      SHARE_ID,
    ]
  );
  
  console.log('\n✅ Report regenerated successfully!');
  console.log('View at: https://coachinayahturnkeytool.com/report/' + SHARE_ID);
  
  await connection.end();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

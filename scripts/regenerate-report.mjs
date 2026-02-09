// Script to regenerate a shared report directly via the server
// Usage: node scripts/regenerate-report.mjs <shareId>

import 'dotenv/config';

// Import the AirDNA service and Gemini
const shareId = process.argv[2] || 'l6984fncmlf7nhnx';

console.log(`[Regenerate Script] Starting regeneration for shareId: ${shareId}`);

// Use dynamic imports for the server modules
async function main() {
  // Connect to database
  const mysql = await import('mysql2/promise');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  
  const conn = await mysql.createConnection(dbUrl);
  
  // Fetch existing report
  const [rows] = await conn.execute(
    'SELECT * FROM shared_reports WHERE shareId = ?',
    [shareId]
  );
  
  if (rows.length === 0) {
    console.error('Report not found');
    await conn.end();
    process.exit(1);
  }
  
  const report = rows[0];
  console.log(`[Regenerate Script] Found report: ${report.address} (${report.bedrooms}BR)`);
  
  // Parse existing data
  let existingData = {};
  try {
    existingData = JSON.parse(report.reportData || '{}');
  } catch { existingData = {}; }
  
  // Import the AirDNA service
  const { getComprehensivePropertyReport } = await import('../server/airdna.ts');
  const { generateFullReportSummary } = await import('../server/gemini.ts');
  
  const address = report.address;
  const bedrooms = report.bedrooms || 5;
  const bathrooms = report.bathrooms ? parseFloat(report.bathrooms) : 4;
  const accommodates = report.accommodates || bedrooms * 2;
  
  console.log(`[Regenerate Script] Fetching fresh data for ${address} (${bedrooms}BR/${bathrooms}BA/${accommodates}guests)...`);
  
  const freshReport = await getComprehensivePropertyReport(address, bedrooms, bathrooms, accommodates);
  
  if (!freshReport) {
    console.error('Failed to fetch fresh data');
    await conn.end();
    process.exit(1);
  }
  
  const propEstimate = freshReport.property;
  const market = freshReport.market;
  const comps = (propEstimate?.comps || []);
  const sameBedComps = (freshReport.same_bedroom_comps || []);
  const bedroomPerf = (freshReport.bedroom_performance || []);
  const rawHistorical = freshReport.market?.historical;
  const historicalValuation = freshReport.historical_valuation;
  const prop = propEstimate?.property; // The property sub-object with lat/lng, city, etc.
  
  // Build historical_data with both summary (YoY) and monthly data
  const historical = {
    summary: {
      yoy_revenue_change: historicalValuation?.yoy_perc_chg ?? rawHistorical?.summary?.revenue_valuation?.yearly_pct_change ?? 0,
      yoy_occupancy_change: rawHistorical?.summary?.occupancy_valuation?.yearly_pct_change ?? 0,
      yoy_adr_change: rawHistorical?.summary?.adr_valuation?.yearly_pct_change ?? 0,
      yearly_pct_change: historicalValuation?.yoy_perc_chg ?? rawHistorical?.summary?.revenue_valuation?.yearly_pct_change ?? 0,
      monthly_pct_change: rawHistorical?.summary?.revenue_valuation?.monthly_pct_change ?? 0,
      trend: (() => {
        const change = historicalValuation?.yoy_perc_chg ?? rawHistorical?.summary?.revenue_valuation?.yearly_pct_change ?? 0;
        return change > 2 ? 'up' : change < -2 ? 'down' : 'stable';
      })(),
    },
    months: rawHistorical?.revenue?.map((r, idx) => ({
      date: r.date || r.month || '',
      revenue: r.value || r.revenue || 0,
      occupancy: rawHistorical?.occupancy?.[idx]?.value,
      adr: rawHistorical?.adr?.[idx]?.value,
    })) || [],
  };
  
  console.log(`[Regenerate Script] Got ${comps.length} rentalizer comps, ${sameBedComps.length} same-bedroom comps`);
  
  // Check lat/lng on same_bedroom_comps
  const compsWithCoords = sameBedComps.filter(c => c.latitude && c.longitude);
  console.log(`[Regenerate Script] Same-bedroom comps with lat/lng: ${compsWithCoords.length}/${sameBedComps.length}`);
  if (compsWithCoords.length > 0) {
    console.log(`  First comp with coords: ${compsWithCoords[0].title} (${compsWithCoords[0].latitude}, ${compsWithCoords[0].longitude})`);
  }
  
  // Build new report data
  const occRate = propEstimate?.estimates?.occupancy_rate || 0;
  const adr = propEstimate?.estimates?.average_daily_rate || 0;
  const annualRev = propEstimate?.estimates?.annual_revenue || 0;
  
  // Revenue percentiles
  const compRevenues = [...comps, ...sameBedComps]
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
  }
  
  // Extract city/state properly
  const addressParts = address.split(',').map(p => p.trim());
  let city = '', state = '', zipCode = '';
  if (addressParts.length === 2) {
    // "2680 Carnation Dr Richardson, TX 75082"
    const firstPart = addressParts[0];
    const words = firstPart.split(' ');
    city = words[words.length - 1]; // Last word before comma
    const stateZip = addressParts[1].trim().split(' ');
    state = stateZip[0];
    zipCode = stateZip[1] || '';
  } else if (addressParts.length >= 3) {
    city = addressParts[addressParts.length - 2];
    const stateZip = addressParts[addressParts.length - 1].trim().split(' ');
    state = stateZip[0];
    zipCode = stateZip[1] || '';
  }
  
  const newReportData = {
    property: {
      address: address,
      city: prop?._geocoded_city || prop?.address_lookup?.split(',')[0]?.trim() || city || market?.name || '',
      state: prop?._geocoded_state || prop?.address_lookup?.split(',')[1]?.trim() || state || '',
      zipCode: prop?.zipcode || zipCode || '',
      bedrooms: bedrooms,
      bathrooms: bathrooms,
      accommodates: accommodates,
      latitude: prop?.latitude,
      longitude: prop?.longitude,
    },
    revenue_estimate: {
      annual: annualRev,
      monthly: Math.round(annualRev / 12),
      nightly: adr,
      occupancy: occRate,
      range: {
        low: propEstimate?.estimates?.annual_revenue_low || Math.round(annualRev * 0.9),
        high: propEstimate?.estimates?.annual_revenue_high || Math.round(annualRev * 1.1),
      },
    },
    monthly_forecast: propEstimate?.monthly_forecast || existingData.monthly_forecast || [],
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
    historical_data: (historical.summary.yoy_revenue_change !== 0 || historical.months.length > 0) ? historical : existingData.historical_data,
    comps: comps.map(c => {
      const listingId = c.airbnb_listing_id || c.id?.replace('abnb_', '') || '';
      const matchingSbc = sameBedComps.find(sbc => {
        const sbcId = sbc.airbnb_listing_id || sbc.id?.replace('abnb_', '') || '';
        return sbcId && listingId && sbcId === listingId;
      });
      return {
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
        airbnb_listing_id: c.airbnb_listing_id || c.id?.replace('abnb_', ''),
        image_url: c.image_url,
        latitude: c.latitude || matchingSbc?.latitude || null,
        longitude: c.longitude || matchingSbc?.longitude || null,
      };
    }),
    same_bedroom_comps: sameBedComps.map(c => ({
      title: c.title || c.name || 'Competitor',
      bedrooms: c.bedrooms,
      bathrooms: c.bathrooms,
      annual_revenue: c.annual_revenue || 0,
      adr: c.adr || 0,
      occupancy: c.occupancy || 0,
      rating: c.rating,
      reviews: c.reviews || 0,
      airbnb_url: c.airbnb_url || c.url,
      airbnb_listing_id: c.airbnb_listing_id || c.id?.replace('abnb_', ''),
      image_url: c.image_url,
      latitude: c.latitude || null,
      longitude: c.longitude || null,
    })),
    purchase: existingData.purchase,
    rental_arbitrage: existingData.rental_arbitrage,
    prepared_for: existingData.prepared_for,
    generated_at: new Date().toISOString(),
  };
  
  console.log(`[Regenerate Script] Built report data. Property lat/lng: ${newReportData.property.latitude}, ${newReportData.property.longitude}`);
  
  // Count comps with coordinates
  const compsWithLatLng = newReportData.same_bedroom_comps.filter(c => c.latitude && c.longitude);
  console.log(`[Regenerate Script] Same-bedroom comps with lat/lng in final data: ${compsWithLatLng.length}/${newReportData.same_bedroom_comps.length}`);
  
  // Generate AI summary
  console.log('[Regenerate Script] Generating AI summary via Gemini 3 Pro...');
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
        marketScore: newReportData.market_data.metrics?.market_score ? Math.round(newReportData.market_data.metrics.market_score) : undefined,
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
      console.log(`[Regenerate Script] AI summary generated (${aiSummary.length} chars)`);
    }
  } catch (aiErr) {
    console.error('[Regenerate Script] AI summary generation failed:', aiErr);
  }
  
  // Update database
  const newReportDataStr = JSON.stringify(newReportData);
  await conn.execute(
    'UPDATE shared_reports SET reportData = ?, latitude = ?, longitude = ? WHERE shareId = ?',
    [newReportDataStr, (newReportData.property.latitude || null)?.toString?.() || null, (newReportData.property.longitude || null)?.toString?.() || null, shareId]
  );
  
  console.log(`[Regenerate Script] Report ${shareId} regenerated successfully!`);
  console.log(`[Regenerate Script] Report data size: ${(newReportDataStr.length / 1024).toFixed(1)} KB`);
  
  await conn.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

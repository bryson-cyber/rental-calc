# BNB Calc Migration - Full Scope

## Key Architecture Decision
Instead of surgically editing the 1500+ line `getComprehensivePropertyReport` function (lines 2810-4388 in airdna.ts),
we will REWRITE it to use only BNB Calc data. The function's return shape must be preserved.

## Return Shape of getComprehensivePropertyReport (line 4356-4384):
```ts
{
  property: RentalizerResponse;  // Already from BNB Calc ✅
  market: { id, name, listing_count, metrics, historical? } | null;  // Set to null (no AirDNA)
  submarkets: SubmarketData[];  // Empty array (no AirDNA)
  same_bedroom_comps: ListingData[];  // From BNB Calc comps ✅
  bedroom_performance: Array<{ bedrooms, occupancy, adr, revenue, listing_count }>;  // Derive from BNB Calc comps
  insights?: MarketInsights;  // undefined (no AirDNA)
  generated_at: string;
  historical_valuation?: { mom_perc_chg, yoy_perc_chg };  // undefined (no AirDNA)
  revenue_scenarios?: { conservative, target, optimistic, source, compCount };  // Derive from BNB Calc comps ✅
  amenity_filter?: { applied, relaxed, selected_amenities, comp_count };  // Skip (no amenity data in BNB Calc)
}
```

## What BNB Calc /cohost gives us:
- quartiles: { p25, p50, p75, p90 } for revenue, ADR, occupancy
- revenueData: monthly breakdown (month, revenue, occupancy, adr, revpar)
- comparables: up to 49 comps with: title, bedrooms, bathrooms, accommodates, rating, reviews,
  annual_revenue_ltm, average_daily_rate_ltm, occupancy_rate_ltm, thumbnail_url, listing_url,
  latitude, longitude, property_type, distance, amenities[], last_scraped
- address, city, state, zipcode, lat, lng from the response

## Functions that call getComprehensivePropertyReport:
1. server/routers/rental.ts (getPropertyReport procedure, line ~1039)
2. server/routers/shared-reports.ts (regenerate + generateFromAddress)
3. server/sop-reports.ts (generateFullArbitrageAnalysis)

## Other AirDNA functions still used in KEPT routers:
- rental.ts: searchMarkets, searchMarketsAPI, detectSearchType, getComprehensiveMarketReport,
  getComprehensiveSubmarketReport, getQualifyingCompetitors, exploreSubmarketsWithMetrics,
  getListingComps, getListingHistoricalMetrics, getMarketBookingPatterns, getMarketSupplyTrend,
  getMarketFutureDailyData, calculateForwardLookingDemand
- These are used in market-level procedures (getMarketReport, getSubmarketReport, exploreSubmarkets,
  smartSearch, getBookingPatterns, getSupplyTrend, getForwardDemand) which should be REMOVED.
- The KEPT property procedures only use: getRentalizerEstimate + getComprehensivePropertyReport

## Plan:
1. Rewrite getComprehensivePropertyReport to:
   - Call getRentalizerEstimate (already BNB Calc)
   - Map BNB Calc comps to ListingData[]
   - Derive bedroom_performance from comps
   - Derive revenue_scenarios from comps
   - Return market: null, submarkets: [], insights: undefined
   - Skip exploreListingsInRadius (AirDNA), skip market search, skip historical

2. Remove market-only procedures from rental.ts:
   - getMarketReport, getSubmarketReport, exploreSubmarkets, smartSearch,
     getBookingPatterns, getSupplyTrend, getForwardDemand

3. Remove AirDNA imports that are no longer used

4. Handle shared-reports.ts and sop-reports.ts gracefully (they'll get null market data)

## exploreListingsInRadius (line 2397) - AirDNA function
This fetches listings within a radius using AirDNA's API. BNB Calc already provides comps
with distance data, so we don't need this. The BNB Calc comps ARE the radius comps.

## Files to remove entirely (market-only routers):
- server/routers/listings-by-area.ts
- server/routers/market-comparison.ts
- server/routers/market-discovery.ts
- server/routers/favorite-markets.ts
- server/routers/market-alerts.ts
- server/routers/market-explorer.ts
- server/market-research-v2.ts
- server/market-research-simple.ts

## Files to keep but remove market procedures from:
- server/routers/rental.ts (remove market procedures, keep property ones)
- server/routers/advanced.ts (remove market procedures, keep analyzeProperty)
- server/routers/comp-data.ts (remove entirely - admin-only AirDNA market data)

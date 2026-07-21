# AirDNA → BNB Calc Full Migration Audit

## BNB Calc API Endpoints Available

1. **POST /v1/external/analysis/create/cohost** — Revenue estimate (address + bed/bath/accommodates)
   - Returns: quartiles (p25/p50/p75/p90/avg for revenue, ADR, occupancy), revenueData (12 monthly), comparables (up to 49 with full metrics), location, marketId
   - ✅ ALREADY INTEGRATED (replaces getRentalizerEstimate)

2. **POST /v1/external/analysis/create/buy** — Buy analysis (adds purchasePrice, ROI, cash flow)
   - Returns: Same as cohost PLUS investment metrics (cashOnCash, capRate, ROI, mortgage, expenses)
   - Could replace: getComprehensivePropertyReport investment calculations

3. **POST /v1/external/analysis/create/arb** — Arbitrage analysis (adds monthlyRent)
   - Returns: Same as cohost PLUS arbitrage metrics (yearOneCashFlow, yearOneRent vs STR revenue)
   - Could replace: calculateArbitrageFeasibility

4. **POST /v1/external/analysis/create/owned** — Owned property analysis
   - Returns: Same as buy but for existing portfolio properties

## AirDNA Functions That Have NO BNB Calc Equivalent

BNB Calc is a **property-level** API only. It does NOT have:
- Market search/discovery (searchMarkets, searchMarketsAPI)
- Market-level metrics (getMarketDetails, getMarketHistoricalData)
- Submarket data (getSubmarketDetails, getSubmarketsInMarket, getSubmarketMetrics)
- Market listings browse (getMarketListings, getSubmarketListings, getAllMarketListings)
- Seasonality data (getMarketSeasonality, getSubmarketSeasonality)
- Booking patterns (getMarketBookingPatterns, getSubmarketBookingPatterns)
- Supply trends (getMarketSupplyTrend, getSubmarketSupplyTrend)
- Individual listing details (getSinglePropertyDetails, getListingHistoricalMetrics)
- Listing comps by ID (getListingComps, getListingFuturePricing)
- Country markets (getCountryMarkets)
- Professional stats (getMarketProfessionalStats)
- Cancellation policies (getMarketCancellationPolicies)
- Future daily data (getMarketFutureDailyData)
- Radius search (getListingsInRadius, exploreListingsInRadius)

## What BNB Calc CAN Replace (property-level functions)

1. ✅ getRentalizerEstimate → cohost endpoint (DONE)
2. getComprehensivePropertyReport → cohost + buy endpoint (partial — no market data)
3. calculateArbitrageFeasibility → arb endpoint
4. getEnhancedRentalizerEstimate → cohost endpoint (already uses getRentalizerEstimate)
5. getRentalizerComps → cohost endpoint (comps included in response)
6. getRentalizerBulkSummary → multiple cohost calls

## Key Insight

BNB Calc is NOT a 1:1 replacement for AirDNA. It's a property-level revenue estimator with comps.
AirDNA provides an entire market intelligence platform (markets, submarkets, listings, seasonality, booking patterns, supply trends, etc.).

The user said "replace AirDNA with BNB Calc" — but BNB Calc literally cannot do most of what AirDNA does.
The replacement is limited to: property revenue estimates + comps.
Market-level features either need to stay on AirDNA or be removed/redesigned.

## Comparables Data from BNB Calc (richer than AirDNA)

Each comp includes:
- listing_id, airbnbId, vrboId
- name, thumbnail_url, latitude, longitude
- room_type, property_type, bedrooms, beds, bathrooms, accommodates
- host_name, superhost, professional_management
- minimum_nights, photos_count, cleaning_fee
- review_scores_rating, visible_review_count, cancellation_policy
- is_pet_friendly, has_license
- amenities (structured object + raw array)
- average_occupancy_rate_ltm, average_daily_rate_ltm, annual_revenue_ltm
- annual_revenue_potential, annual_revenue_potential_adj
- active_days_count_ltm, reviews, rating, distance_meters
- metrics.ttm (revenue, occupancy, adjusted_occupancy, adr, revpar, days_reserved, blocked_days)
- metrics.l90d (same fields for last 90 days)
- guest_favorite, exact_location, source

## Where "Analyze Property" Button Lives (Zillow Integration)

The Zillow "Analyze Property" button calls getRentalizerEstimate with the property address.
This is already replaced by BNB Calc via the cohost endpoint. ✅

## Files That Import from airdna.ts

- server/routers/rental.ts (getRentalizerEstimate + 10 other market functions)
- server/routers/public-explore.ts (getRentalizerEstimate only)
- server/ai-advisor-enhanced.ts (getRentalizerEstimate)
- server/ai-advisor.ts (getRentalizerEstimate)
- server/deal-alert-agent.ts (getRentalizerEstimate + market functions)
- server/market-research-simple.ts (getRentalizerEstimate + market functions)
- server/newsletter-deal-finder.ts (getRentalizerEstimate)

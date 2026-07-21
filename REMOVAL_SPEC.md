# Feature Removal Spec: AirDNA Market-Level Features

## Goal
Remove all features that depend on AirDNA market-level endpoints (markets, submarkets, listings browse, seasonality, booking patterns, supply trends). Keep only property-level features that now run on BNB Calc.

## What Users Currently See (Non-Admin)
- ebook, regulations, opportunity, validate, compare, map, lease
- (prove, find, market, advisor are already admin-only)

## What to KEEP (property-level, works with BNB Calc)
- **ebook** — Interactive ebook viewer
- **regulations** — Regulation tracker
- **opportunity** — Zillow opportunity finder (calls getRentalizerEstimate → BNB Calc)
- **validate** — One Home property analysis (calls getRentalizerEstimate → BNB Calc)
- **compare** — Compare Many properties (calls getRentalizerEstimate → BNB Calc)
- **map** — Map view of analyzed properties
- **lease** — Lease reader
- **AI Property Advisor** (within validate results) — uses property data from BNB Calc

## What to REMOVE (market-level, requires AirDNA)
### Frontend Tabs/Components
- **prove** tab — "Prove the Market" / Market Research (uses getComprehensiveMarketReport)
- **find** tab — "Find Your Market" / Explore Area (uses getMarketListings, searchMarkets)
- **market** tab — StandaloneMarketAdvisor (uses getStandaloneMarketAdvisorData)
- **advisor** tab (market advisor part) — Market trend narrative (uses market data)
- **explore** tab — Explore listings (uses market listings)

### Frontend Components to Remove
- StandaloneMarketAdvisor.tsx
- MarketInsightsPanel.tsx (if it exists and uses market data)
- Any market search/discovery UI

### Backend Routers to Remove
- market-comparison.ts
- market-discovery.ts
- market-explorer.ts
- market-alerts.ts
- favorite-markets.ts
- listings-by-area.ts

### Backend Services to Remove/Gut
- market-research-simple.ts (market-level)
- market-research-v2.ts (market-level)
- newsletter-market-data.ts (market-level)
- airdna-hierarchy.ts (market hierarchy lookups)

### AirDNA Functions to Remove from airdna.ts
All market-level functions (keep only getRentalizerEstimate and property-level helpers):
- searchMarkets, searchMarketsAPI, searchByZipcode
- getMarketDetails, getSubmarketDetails
- getMarketHistoricalData, getSubmarketsInMarket
- getSubmarketMetrics, getMarketListings, getSubmarketListings
- getAllSubmarketListings, calculateMarketInsights
- exploreListingsInMarket, exploreListingsInRadius
- getComprehensiveMarketReport, getComprehensiveSubmarketReport
- getAllMarketListings, getQualifyingCompetitors
- getSinglePropertyDetails, batchFetchPropertyImages, enrichListingsWithImages
- exploreSubmarketsWithMetrics, getCountryMarkets
- getListingsInRadius, getMarketSeasonality, getSubmarketSeasonality
- getTopPerformers, calculateArbitrageFeasibility
- getMarketFutureDailyData, getListingHistoricalMetrics
- getListingComps, getListingFuturePricing
- getRentalizerComps, getEnhancedRentalizerEstimate
- getFilteredMarketListings, getMarketProfessionalStats
- getMarketCancellationPolicies, getMarketBookingPatterns
- getMarketSupplyTrend, getSubmarketBookingPatterns
- getSubmarketSupplyTrend, getListingsByArea
- getRentalizerBulkSummary, getStandaloneMarketAdvisorData
- getBulkListings, getComprehensivePropertyReport

### What to Keep in airdna.ts
- getRentalizerEstimate (now delegates to BNB Calc)
- REVENUE_BOOST_FACTOR and setBoostFactorValue
- parseAmenities (used by BNB Calc comp mapping)
- detectSearchType (may be used for address detection)
- RentalizerResponse interface and related types

## Approach
1. Remove market tabs from frontend (TabType, ALL_TABS, ADMIN_ONLY_TABS, tab rendering)
2. Remove/comment market router registrations from routers.ts
3. Remove market router files
4. Gut airdna.ts to keep only property-level functions
5. Clean up imports everywhere
6. Verify TypeScript compiles
7. Test remaining features

## Risk
- The rental.ts router has both property AND market procedures. Need to surgically remove only market procedures.
- The advanced.ts router has standaloneMarketAdvisor. Remove that procedure.
- ChapterPropertyReport.tsx imports StandaloneMarketAdvisor — need to remove that section.

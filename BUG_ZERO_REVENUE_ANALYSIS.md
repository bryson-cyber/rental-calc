# Bug Analysis: $0 Revenue in See Real Revenue Tool

## Symptoms
- South Beach shows $0 Avg Annual Revenue, $0 Nightly Rate, 0% Occupancy, 0 Active Listings
- BUT seasonality charts show real data (61% avg occupancy, $178 avg ADR)
- AND comp data table shows 3062 listings with real revenue data

## Data Flow Analysis

1. **Frontend calls**: `getSubmarketReport.mutateAsync({ submarketId, submarketName })`
2. **Backend (market-research-simple.ts)**: Calls `getComprehensiveSubmarketReport(submarketId)`
3. **Backend transforms to**: `SimplifiedMarketReport` with `overview.avgRevenue`, etc.
4. **Frontend reads**: `report.overview.avgRevenue`, `report.overview.avgAdr`, etc.

## Root Cause Investigation

The `market-research-simple.ts` transforms the data correctly:
```typescript
const overview = {
  totalListings: report.submarket.listing_count || 0,
  avgOccupancy: report.submarket.metrics.occupancy,
  avgAdr: report.submarket.metrics.adr,
  avgRevenue: report.submarket.metrics.revenue,
  avgRevpar: report.submarket.metrics.revpar,
  marketScore: report.submarket.metrics.market_score
};
```

The issue is likely that `report.submarket.metrics.revenue` is returning 0 or undefined.

## Possible Causes

1. **API returning 0**: The AirDNA API might be returning 0 for these metrics for South Beach
2. **Caching issue**: Old cached data with 0 values
3. **Data transformation issue**: The metrics are being lost somewhere in the pipeline

## Next Steps

1. Add logging to see what `getComprehensiveSubmarketReport` returns
2. Check if the cache is returning stale data
3. Verify the AirDNA API is returning valid data for South Beach

## Seasonality vs Summary Discrepancy

The seasonality data shows real values because it comes from a different source:
- `report.seasonality` comes from `getSubmarketSeasonality(submarketId)` or falls back to `getMarketSeasonality(marketId)`
- Summary metrics come from `report.submarket.metrics` which is calculated differently

This suggests the issue is specifically in how `report.submarket.metrics` is populated.

# Debug: 5-Year Market History Section Missing

## Issue
The 5-Year Market History section is not appearing in the report, even though the code is in place.

## Root Cause
From server logs: "Got 0 months of historical trends data"

The `getMarketHistoricalData(marketId, 60)` call is returning empty data, which means:
1. The condition `historical_trends.occupancy.length > 12` is false
2. Therefore `calculate5YearSummary()` is never called
3. Therefore `five_year_summary` is undefined
4. Therefore the section doesn't render

## Possible Causes
1. The AirDNA API may not support 60 months for all markets
2. The API endpoint may be returning data in a different format
3. Network errors during the API call

## What's Working
- Verdict removed: Analysis Summary shows informational content without GO/CAUTION/PASS
- Occupancy displayed as percentages: 63% (not 0.63)
- Seasonality data works (12 months)
- Future pricing endpoint fixed (changed from /future/pricing to /future_pricing)

## Next Steps
1. Check if the AirDNA API supports 60 months for this market
2. Add better error handling and logging
3. Consider falling back to 12 months if 60 months fails

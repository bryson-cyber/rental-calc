# South Beach $0 Revenue Bug Analysis

## Key Finding
The summary metrics show $0 revenue, $0 ADR, 0% occupancy, 0 active listings
BUT the seasonality chart shows REAL data:
- Avg Occupancy: 61%
- Avg ADR: $178
- Monthly data is populated correctly

## Root Cause Hypothesis
The summary metrics are coming from a different API call or data transformation
than the seasonality data. The seasonality data is correct, but the overview
metrics are not being populated.

## Data Flow
1. `getSubmarketReport` in routers.ts calls `getComprehensiveSubmarketReport`
2. `getComprehensiveSubmarketReport` gets metrics from `getSubmarketDetails`
3. `getSubmarketDetails` calls `/submarket/{submarketId}` API endpoint
4. The metrics object may be empty or not being returned correctly

## Investigation Needed
- Check if `submarketDetails.metrics` is null/undefined
- Check if the API is returning the metrics field
- The seasonality data comes from a different endpoint that IS working


## ROOT CAUSE FOUND!

The server logs show the exact error:
```
Error fetching adr for market airdna-1914: Error: AirDNA API error (404): 
{"payload":{},"status":{"type":"error","response_id":"API-E-009",
"message":"Could not find Market for the requested id airdna-1914"}}
```

The code is trying to use `/market/{marketId}/metrics/` endpoints with a SUBMARKET ID.
The `/market/` endpoints only work with market IDs, not submarket IDs.

South Beach is a SUBMARKET (airdna-1914), not a MARKET.
The code should use `/submarket/{submarketId}` endpoint instead.

## Fix Required
In `airdna.ts`, the `getMarketMetric` function is being called with submarket IDs,
but it uses the `/market/` endpoint which doesn't support submarket IDs.

Need to:
1. Check if the ID is a submarket or market
2. Use the appropriate endpoint for each
3. Or use the `getSubmarketDetails` function which already has metrics

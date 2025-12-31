# Debug Notes - Market Data Issue

## Current Issue
The Denver Market Overview section is showing all zeros:
- AVG. OCCUPANCY: 0%
- AVG. DAILY RATE: $0
- AVG. REVENUE: $0
- ACTIVE LISTINGS: 0

## What's Working
- Property estimate is working correctly ($50,300 annual revenue)
- Monthly forecast is working correctly
- Comparable properties are being fetched and displayed correctly

## What's Not Working
- Market metrics are not being populated
- The historical data is not being displayed

## Root Cause Analysis
The market details API returns metrics in a different structure than expected.
The API returns:
```json
{
  "payload": {
    "metrics": {
      "market_score": 55.676,
      "revenue": 42226.77,
      "booked": 0.683212,  // This is occupancy as decimal
      "daily_rate": 169.33214,
      "revpar": 115.68978082191781
    },
    "id": "airdna-163",
    "name": "Denver"
  }
}
```

But the code expects metrics to be populated from historical data, which may have different field names.

## Fix Needed
1. Update the getComprehensivePropertyReport to use market details metrics directly
2. Map the API response fields correctly:
   - booked -> occupancy (multiply by 100 for percentage)
   - daily_rate -> adr
   - revenue -> revenue

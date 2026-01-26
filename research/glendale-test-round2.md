# Glendale Test Round 2 - Jan 26, 2026

## Issue Still Present
The Revenue by Property Type section still shows:
- 1 Bedroom: "Limited data available"
- 2 Bedroom: "Limited data available"
- 3 Bedroom: $85,220 Revenue/yr, 78% Occupancy, 12 listings
- 4 Bedroom: $89,374 Revenue/yr, 71% Occupancy, 14 listings
- 5 Bedroom: Visible

## Root Cause Analysis
The ascending sort strategy was added but the issue persists. This means:
1. Either the API is not returning 1BR/2BR listings even with ascending sort
2. Or the data is being fetched but the bedroomBreakdown calculation is filtering them out

## Next Steps
1. Check server logs to see the bedroom distribution after sampling
2. Verify the ascending sort is actually being called
3. Check if the bedroomBreakdown calculation is working correctly

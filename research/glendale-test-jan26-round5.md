# Glendale Test - Jan 26, 2026 - Round 5

## Current State (After Bedroom Filter Type Fix from 'eq' to 'select')
The bedroom filter fix to use 'select' type is NOT working. 1BR and 2BR still show "Limited data available":

- 1BR: "Limited data available"
- 2BR: "Limited data available"
- 3BR: $85,220 Revenue/yr, 78% Occupancy, 12 listings
- 4BR: $89,374 Revenue/yr, 71% Occupancy, 14 listings
- 5BR: (visible but cut off)

## Server Logs
The server was showing errors with the 'eq' filter type. After changing to 'select', need to verify if the API calls are now working.

## Root Cause Analysis
The bedroom filter API calls might still be failing silently, or:
1. The API might not support bedroom filtering for the listings endpoint
2. Glendale genuinely has very few 1BR/2BR listings (it's a suburban Phoenix market with mostly houses)

## Next Steps
1. Check if the API actually returns 1BR/2BR listings for Glendale
2. If Glendale has no 1BR/2BR listings, show a helpful message instead of "Limited data"
3. Consider using market-level bedroom stats from AirDNA if available
4. Add a fallback to show "Not common in this market" for bedroom types with <5 listings

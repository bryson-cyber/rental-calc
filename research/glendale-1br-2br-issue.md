# Glendale 1BR/2BR Data Issue Analysis - Jan 26, 2026

## Current State (After Previous Fixes)
- Market: Glendale, Arizona
- Total listings: 1,108
- Market Grade: B (Decent Market)
- Avg Occupancy: 57%
- Avg Revenue: $38,648

## Revenue by Property Type Cards
- **1 Bedroom**: "Uncommon in this market" - Few 1 Bedroom rentals here
- **2 Bedroom**: "Uncommon in this market" - Few 2 Bedroom rentals here
- **3 Bedroom**: $85,220/yr, 78% occupancy, 12 listings
- **4 Bedroom**: $89,374/yr, 71% occupancy, 14 listings
- **5 Bedroom**: (visible but data not captured)

## Problem Analysis
The API is fetching listings but the bedroom filter is not working correctly.
The getAllMarketListings function has code to fetch 1BR and 2BR specifically, but:
1. The API calls might be failing silently
2. Glendale might genuinely have very few 1BR/2BR listings (it's a suburban Phoenix market)

## Key Question
Is this a bug (API not returning 1BR/2BR data) or is this accurate (Glendale genuinely has few 1BR/2BR)?

## Next Steps
1. Check server logs for the bedroom filter API calls
2. Verify if AirDNA returns 1BR/2BR listings for Glendale
3. If the market genuinely has few 1BR/2BR, the "Uncommon in this market" message is correct

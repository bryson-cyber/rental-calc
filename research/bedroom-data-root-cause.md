# Root Cause Analysis: 1BR/2BR "Limited Data Available" Issue

## Current State (Jan 26, 2026)
- Glendale, Arizona shows 1,108 total listings
- Quick Insights shows: Top Earner = 4BR, Most Booked = 3BR
- Revenue by Property Type shows:
  - 1BR: "Limited data available"
  - 2BR: "Limited data available"
  - 3BR: $85,220 Revenue/yr, 78% Occupancy, 12 listings
  - 4BR: $89,374 Revenue/yr, 71% Occupancy, 14 listings
  - 5BR: Shows data

## Root Cause
The sampling strategy in `getAllMarketListings` is fetching ~400 listings from a market with 1,108 total.
The sampling is biased toward high-revenue listings (sorted by revenue descending).
Even with the ascending sort strategy added, the API may not be returning enough 1BR/2BR listings.

**Key insight:** The Quick Insights shows "Top Earner = 4BR" and "Most Booked = 3BR" which suggests 
the sampled data is heavily skewed toward larger properties.

## Possible Solutions
1. **Use AirDNA's bedroom-filtered API** - Call the API with `bedrooms=1` and `bedrooms=2` filters to get those specific listings
2. **Increase sample size** - Fetch more listings (but this is slow and expensive)
3. **Use market-level bedroom statistics** - If AirDNA provides bedroom-level aggregates, use those instead of calculating from listings

## Next Step
Check if the AirDNA API supports filtering by bedrooms in the listings endpoint.

# Root Cause: 1BR/2BR "Limited data available" Issue

## Problem
For markets like Glendale, Arizona (1,108 listings), the Revenue by Property Type cards show:
- 1 Bedroom: "Limited data available"
- 2 Bedroom: "Limited data available"
- 3 Bedroom: $85,220, 78% occupancy, 12 listings
- 4 Bedroom: $89,374, 71% occupancy, 14 listings
- 5 Bedroom: $79,990, 69% occupancy, 6 listings

## Root Cause
The `getAllMarketListings` function uses **smart sampling** from different offsets in the revenue-sorted list:
- Offsets: [25, 50, 100, 200, 500, 1000, 2000, 3000, 4000, 5000, 7000, 9000, 11000]
- This is designed to get diverse bedroom distribution

However, the API returns listings sorted by **revenue (desc)**, which means:
- High-revenue listings (typically 3BR, 4BR, 5BR) are at the top
- Lower-revenue listings (typically 1BR, 2BR) are at the bottom

For Glendale with only 1,108 listings:
- Offsets 2000, 3000, etc. are beyond the total count
- We're only sampling from offsets [25, 50, 100, 200, 500, 1000]
- These are still dominated by larger properties

## Evidence
The bedroom distribution in the sample shows:
- 3BR: 12 listings
- 4BR: 14 listings  
- 5BR: 6 listings
- 1BR: 0 listings
- 2BR: 0 listings

This is only ~32 listings total out of 350+ sampled, suggesting most sampled listings don't have bedroom data or are filtered out.

## Solution Options

### Option 1: Use Multiple Sort Orders (Recommended)
Fetch listings using different sort orders to get diverse bedroom distribution:
- Sort by revenue DESC (get high earners)
- Sort by bedrooms ASC (get 1BR, 2BR)
- Sort by bedrooms DESC (get 4BR, 5BR)
- Sort by occupancy DESC (get well-booked properties)

### Option 2: Use Bedroom Filter
Make separate API calls for each bedroom count:
- GET /listings?bedrooms=1
- GET /listings?bedrooms=2
- etc.

### Option 3: Increase Sample Size
Fetch more listings (up to 1000) to increase chances of getting 1BR/2BR.

## Implementation Plan
1. Modify `getAllMarketListings` to use multiple sort strategies
2. Alternatively, create a new function `getBedroomBreakdownStats` that fetches a sample for each bedroom count

# Atlanta Market Data Bug Investigation - Jan 26, 2026

## API Test Results

The AirDNA API returns the following for Atlanta (airdna-166):

| Field | Value | Source |
|-------|-------|--------|
| Total Listings | 25,103 | `/market/{id}/listings` page_info.total_count |
| listing_count in details | undefined | `/market/{id}` does NOT include listing_count |
| Market Score | 63.457 | `/market/{id}` metrics |

### Property Type Values from API
The API returns lowercase property types like "house", "villa", "condominium" - NOT "Entire home/apt" as expected.

Sample distribution from 25 listings:
- house: 23
- villa: 1
- condominium: 1

### Host Size Values from API
- "1": 1 listing (single host)
- "2-5": 8 listings
- "6-20": 6 listings
- "21+": 10 listings

### Room Type
The `room_type` field is undefined in all listings, so we cannot use it to determine "Entire home" vs "Private room".

## Root Causes Identified

### Bug 1: Market Size Shows 350 Instead of 25,103
The `getMarketDetails()` function expects `listing_count` in the API response, but AirDNA's `/market/{id}` endpoint does NOT return this field. The listing count must come from the `/market/{id}/listings` endpoint's `page_info.total_count`.

**Fix:** Get listing count from the listings API, not the market details API.

### Bug 2: Entire Homes 0% and Single Hosts 0%
The `calculateMarketInsights()` function checks for:
- `property_type === 'Entire home/apt'` - but API returns "house", "villa", etc.
- `host_size === '1 listing'` - but API returns "1", "2-5", etc.

**Fix:** Update the matching logic to use the actual API values.

### Bug 3: Only 350 Listings Sampled
The `getAllMarketListings()` function only fetches a limited sample. For large markets like Atlanta with 25,103 listings, this is not representative.

**Fix:** For competition stats, we should either:
1. Fetch more pages (expensive)
2. Use the search API's listing_count which is accurate
3. Note that percentages are based on a sample

## Fixes Required

1. In `market-research-simple.ts`:
   - Get total listing count from listings API, not market details
   - Pass this count to the frontend as `overview.totalListings`

2. In `airdna.ts` `calculateMarketInsights()`:
   - Change `property_type === 'Entire home/apt'` to check for "house", "villa", "townhouse", "condominium", etc.
   - Change `host_size === '1 listing'` to `host_size === '1'`

3. In frontend:
   - Display the correct total listing count
   - Note that competition percentages are based on a sample

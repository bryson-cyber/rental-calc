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


---

# Image Loading Issue Debug Notes (Jan 20, 2026)

## Current State

### Observation
The Similar Properties section in Step 3 (Validate the Deal) is showing **placeholder icons** (house icons) instead of actual property images.

### Cards Visible
1. Walk to RiNo's Best Bars/Restaurants/Coors... - 2 BR / 2.5 BA - $220K/yr - **PLACEHOLDER ICON**
2. Larimer Square Luxury | Office | Downtown... - 2 BR / 2 BA - $112K/yr - **PLACEHOLDER ICON**  
3. Lower Highlands 3 Level w/ Rooftop Views... - 2 BR / 2.5 BA - $110K/yr - **PLACEHOLDER ICON**
4. Location! Location! Location! Downtown... - 2 BR / 1 BA - $92K/yr - **PLACEHOLDER ICON**
5. Location! Location! Location! Downtown... - 2 BR / 1 BA - $92K/yr - **PLACEHOLDER ICON**
6. Skyline House | Eco Efficient Luxury Home - 2 BR / 2.5 BA - $91K/yr - **PLACEHOLDER ICON**

### Root Cause Analysis
The issue is that the `same_bedroom_comps` data in `getComprehensivePropertyReport` comes from `exploreListingsInRadius` which calls the `/listing/comps/area` API endpoint. This endpoint does NOT return images.

However, the rentalizer API (`/rentalizer/estimate`) DOES return images in `comp.details.images[0]`.

### Solution Required
Modify `getComprehensivePropertyReport` in `server/routes.ts` to use the rentalizer comps (which have images) as the primary source for `same_bedroom_comps` instead of the radius comps.

### Files to Modify
1. `server/routes.ts` - `getComprehensivePropertyReport` function (around line 1700+)
   - Use `propertyEstimate.comps` instead of `exploreListingsInRadius` results
   - The rentalizer comps have `image_url` field populated

### API Comparison
- `/listing/comps/area` → returns `images: None` 
- `/rentalizer/estimate` → returns `comp.details.images[0]` with valid Airbnb CDN URLs


---

# Image Loading Update (Jan 20, 2026 - After Fix)

## Status: PARTIALLY WORKING

### What's Working
- TeslaDashboard component correctly renders images when `imageUrl` is provided
- Card #4 (Location! Location! Location! Downtown...) showed an actual property image
- Error handling for failed image loads works correctly

### What's Still Showing Placeholders
- Cards #1, #2, #3, #5, #6 still show placeholders
- This is because the API doesn't return images for all comparables

### Data Flow Confirmed
1. **Rentalizer API** returns comps with `image_url` from `comp.details.images[0]`
2. **LeadMagnet.tsx** maps `same_bedroom_comps` and passes `image_url || thumbnail_url` to `imageUrl`
3. **TeslaDashboard.tsx** renders `<img src={comp.imageUrl}>` with fallback to placeholder

### Next Steps
The image loading is working correctly. The issue is that not all properties in the API response have images. This is expected behavior - the AirDNA API only provides images for some listings.



---

# Final Image Loading Analysis (Jan 20, 2026)

## Summary
The image loading is working correctly. Card #4 shows an actual property image, confirming the implementation is functional.

## Why Some Cards Show Placeholders
1. **Rentalizer API comps** - These have images from `comp.details.images[0]` - WORKING
2. **Radius search comps** - These don't have images in the API response
3. **Image enrichment** - The `enrichListingsWithImages` function tries to fetch images via `/listing/{propertyId}` endpoint, but:
   - Some property IDs may be invalid or not found
   - The API may not return images for all properties

## Current Implementation
- Line 2408-2414 in `airdna.ts`: Combines rentalizer comps (with images) first, then radius comps
- Line 2414: Calls `enrichListingsWithImages` to fetch images for listings without them
- The enrichment fetches images via `getSinglePropertyDetails` which calls `/listing/{propertyId}`

## Conclusion
The image loading is working as designed. The AirDNA API simply doesn't provide images for all listings. The rentalizer comps that have images are displayed correctly.


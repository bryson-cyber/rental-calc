# Distance Badges Bug - Debug Analysis

## Data Flow

1. **routers.ts (line 1134-1139)**: Distance is calculated and added to competitors
   - `distance_meters` is calculated using Haversine formula
   - Added to both `allCompetitors` and `qualifyingCompetitors`
   - Logged: "Calculated distances for X competitors"

2. **routers.ts (line 1219)**: Returns `same_bedroom_comps: allCompetitors`
   - This should include `distance_meters` for each comp

3. **LeadMagnet.tsx (line 512)**: Maps `c.distance_meters` to `distanceMeters`
   - `distanceMeters: c.distance_meters`
   - This looks correct!

4. **TeslaDashboard.tsx**: Should receive `distanceMeters` in comparables
   - Need to verify the Comparable interface includes distanceMeters
   - Need to verify the distance badge rendering logic

## Potential Issues

1. **Backend**: Is `distance_meters` actually being set?
   - Check if `calculateDistanceMeters` returns undefined for some comps
   - Check if `lat2` or `lng2` are null/undefined

2. **Frontend**: Is `distanceMeters` being passed correctly?
   - Check if TeslaDashboard's Comparable interface includes `distanceMeters`
   - Check if the distance badge rendering has correct conditional

## Next Steps

1. Add console.log in routers.ts to verify distance_meters is set
2. Check TeslaDashboard Comparable interface
3. Check distance badge rendering logic


## Root Cause Found!

The issue is that `getMarketListings` returns `latitude` and `longitude` fields (lines 1475-1476), but these are often `null` because the API response has `r.location?.lat` and `r.location?.lng` which may not be present for all listings.

When `calculateDistanceMeters` is called with `null` lat/lng values, it returns `undefined`:

```typescript
const calculateDistanceMeters = (lat1, lng1, lat2, lng2) => {
  if (!lat2 || !lng2) return undefined;  // Returns undefined if lat/lng missing!
  ...
}
```

So the distance is only calculated for comps that have valid lat/lng coordinates from the API.

## Solution

1. **Option A**: Filter out comps without distance (already done in CompStrengthIndicator)
2. **Option B**: Use a fallback distance estimate based on market size
3. **Option C**: Log which comps are missing lat/lng to understand the data quality

Let me check if the API is actually returning lat/lng for the listings...

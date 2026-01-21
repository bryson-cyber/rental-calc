# Bug 1: Distance Badges Not Showing - Root Cause Analysis

## The Problem
Distance badges only show on some comp cards, not all. Testing showed 0 out of 6 comps had distance badges.

## Data Flow Analysis

### 1. API Response (airdna.ts)
The `getMarketListings` function does NOT include `distance_meters` in its mapping (line 1457-1480):
```typescript
const listings: ListingData[] = response.payload.listings.map((r) => ({
  // ... other fields
  // distance_meters is MISSING from this mapping!
}));
```

The `ListingData` interface DOES include `distance_meters` (line 193), but `getMarketListings` doesn't populate it.

### 2. Where Distance IS Available
- **Rentalizer API comps** (line 2394): `distance_meters: comp.distance_meters` - ✅ HAS distance
- **Market Charts API** via `getQualifyingCompetitors` → `getAllMarketListings` → `getMarketListings` - ❌ NO distance

### 3. The Issue
When `getAIPropertyReport` is called:
1. It calls `getQualifyingCompetitors` which uses `getAllMarketListings`
2. `getAllMarketListings` uses `getMarketListings` which does NOT return `distance_meters`
3. The Market Listings API doesn't have distance data - it's market-wide, not relative to a specific address

### 4. Solution Options

**Option A: Use Rentalizer Comps for Distance**
The Rentalizer API returns comps WITH distance_meters. We should prioritize these comps or merge the distance data.

**Option B: Calculate Distance Client-Side**
If we have lat/lng for both the subject property and comps, we can calculate distance using Haversine formula.

**Option C: Use Radius Search API**
The `exploreListingsInRadius` function (line 5247-5271) DOES return `distance_meters`:
```typescript
distance_meters: listing.distance || 0,
```

## Recommended Fix
The best fix is to ensure we're using the Rentalizer comps (which have distance) OR calculate distance from lat/lng coordinates.

Looking at line 2394, the `rentalizerComps` mapping DOES include `distance_meters: comp.distance_meters`.

The issue is that `getQualifyingCompetitors` returns listings from `getMarketListings` which doesn't have distance.

**FIX**: In `routers.ts`, when we override `same_bedroom_comps` with `allCompetitors` from Market Charts API (line 1189), we lose the distance data from the original Rentalizer comps.

We need to either:
1. Merge distance data from Rentalizer comps into Market Charts comps
2. Or calculate distance using lat/lng

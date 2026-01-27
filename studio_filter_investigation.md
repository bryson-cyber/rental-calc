# Studio Filter Investigation

## Issue
When selecting "Studio" from the bedroom dropdown in Step 2 (Explore Listings), the filter is not working correctly. The listings still show properties with 14 bedrooms, 5 bedrooms, etc. instead of filtering to 0-bedroom (Studio) properties only.

## Root Cause Analysis

1. The dropdown correctly has `value="0"` for Studio option
2. The onChange handler correctly parses the value to `0` (integer)
3. The `handleMarketSearch` function receives `bedroomFilter: 0`
4. The API call is made with `bedrooms: 0`

## The Bug
The issue is in the `getSubmarketListings` and `getMarketListings` functions in `server/airdna.ts`. The condition:

```javascript
if (options?.filters?.bedrooms !== undefined && options?.filters?.bedrooms !== null) {
```

This should work for `bedrooms: 0`, but let me check if there's a falsy check somewhere that's treating 0 as falsy.

## In routers.ts line 4660:
```javascript
if (input.bedrooms) filters.bedrooms = input.bedrooms;
```

This is the bug! `if (input.bedrooms)` will be falsy when `bedrooms = 0` (Studio).

## Fix
Change line 4660 from:
```javascript
if (input.bedrooms) filters.bedrooms = input.bedrooms;
```
to:
```javascript
if (input.bedrooms !== undefined && input.bedrooms !== null) filters.bedrooms = input.bedrooms;
```

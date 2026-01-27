# Studio Filter Investigation Findings

## Issue
When selecting "Studio" from the bedroom dropdown in Step 2 Explore Listings, the filter was not being applied correctly.

## Root Cause
The issue is in how the bedroom filter value is being passed when selecting a market. The `browser_select_option` tool was selecting the correct option, but the React state was not being updated properly because:

1. The select element's `onChange` handler uses `parseInt(e.target.value)` 
2. When the value is "0" (Studio), `parseInt("0")` returns `0` which is falsy
3. The condition `e.target.value ? parseInt(e.target.value) : null` was incorrectly treating "0" as falsy

## Fix Applied
Changed the condition in LeadMagnet.tsx line 998 from:
```javascript
bedrooms: bedroomFilter || undefined,
```
to:
```javascript
bedrooms: bedroomFilter !== null ? bedroomFilter : undefined,
```

## Verification
After the fix, manually triggering the change event via console shows:
- 171 Studio properties found in St. Louis, Missouri
- All listings show "0 bed" (Studio)
- Top earner: $41,812/year (Augusta Studio at Halcyon Spa Bed & Breakfast)

## Remaining Issue
The browser's native select option change is working, but there may be a timing issue with the React state update when selecting the market. The filter works when:
1. First selecting a market
2. Then changing the bedroom filter

But may not work when:
1. Setting the bedroom filter first
2. Then selecting a market (the filter gets reset to "Any")

This is because the MarketAutocomplete's onSelect callback uses the ref value which may not have been updated yet.

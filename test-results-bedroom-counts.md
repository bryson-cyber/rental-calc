# Property Type Breakdown Test Results - 63104

## Test Date: Jan 26, 2026

## Issue Found: Bedroom Counts Still Incorrect

The property type breakdown is showing:
- **Studio: 469 listings** (same as total market - WRONG)
- 1 Bedroom: 181 listings
- 2 Bedroom: 143 listings
- 3 Bedroom: 77 listings
- 4 Bedroom: 38 listings
- 5 Bedroom: 9 listings
- 6+ Bedroom: 15 listings

**Total from breakdown: 932 listings**
**Market total: 469 listings**

## Root Cause Analysis

The `getSubmarketBedroomCounts` function is being called but it's returning incorrect data.
The Studio count (469) equals the total market count, suggesting the API is returning the total count
instead of the bedroom-specific count for Studios.

## What's Happening

Looking at the code, when we query for bedrooms=0 (Studio), the API might be returning
the total market count instead of just the Studio count. This is likely because:
1. The bedroom filter might not be working correctly for bedrooms=0
2. Or the API returns all listings when bedrooms=0 is specified

## Fix Needed

Need to investigate the `getSubmarketBedroomCounts` function in airdna.ts to see why
the Studio count is returning the total market count.

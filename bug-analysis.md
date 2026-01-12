# Bug Analysis - January 12, 2026

## Bugs Identified from Atlanta Test

### Bug 1: Occupancy shows 1% instead of correct percentage
**Location:** Step 1 (See Real Revenue) - Market Research
**Symptom:** Avg Occupancy displays "1%" instead of expected ~60-70%
**Root Cause:** The `occupancy_rate_ltm` from AirDNA API returns a decimal (e.g., 0.65 for 65%), but the code displays it as-is without multiplying by 100.
**Fix Location:** `server/market-research-simple.ts` line 131 - need to multiply by 100

### Bug 2: Bedroom breakdown shows 3-8BR but no 1-2BR
**Location:** Step 1 (See Real Revenue) - "What's Working in This Market" section
**Symptom:** Only shows 3, 4, 5, 6, 7, 8 bedroom types, missing 1BR and 2BR
**Root Cause:** The `getComprehensiveMarketReport` function only fetches 25 listings sorted by revenue. Top earners in Atlanta are larger properties (5+ bedrooms), so 1-2BR listings don't appear in the sample.
**Fix:** Need to fetch more listings or use a different approach to get bedroom distribution across all property types.

### Bug 3: All bedroom listings show 0 listings and $0/yr
**Location:** Step 1 (See Real Revenue) - "What's Working in This Market" section  
**Symptom:** Every bedroom type shows "0 listings" and "$0/yr"
**Root Cause:** The `bedroom_performance` data structure has different field names than what the frontend expects:
- Backend returns: `count`, `avg_revenue`, `avg_adr`, `avg_occupancy`
- Frontend expects: `listing_count`, `revenue`, `occupancy`
**Fix Location:** `server/market-research-simple.ts` line 183-188 - field mapping is incorrect

## Data Flow Analysis

1. Frontend calls `getMarketReport` mutation
2. Backend calls `getComprehensiveMarketReport(marketId)` in airdna.ts
3. This fetches only 25 listings sorted by revenue (top earners)
4. Bedroom breakdown is calculated from these 25 listings only
5. Top earners in Atlanta are 5+ bedroom properties, so 1-2BR are missing

## Fixes Required

1. **Fix occupancy display:** Multiply by 100 in the overview calculation
2. **Fix bedroom field mapping:** Map `count` → `listing_count`, `avg_revenue` → `revenue`, etc.
3. **Fix bedroom distribution:** Fetch more listings (200+) to get representative sample of all bedroom types

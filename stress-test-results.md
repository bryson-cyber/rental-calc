# STR Investment Advisor Stress Test Results

## Summary

The stress testing revealed that the system handles most inputs well, with proper error handling for invalid inputs. A few issues were identified that need fixing.

## Test Results

| Test | Input | Result | Status |
|------|-------|--------|--------|
| 1. Property Address (Austin) | 456 West 6th Street, Austin, TX 78701 | Revenue: $59,070, Occupancy: 61%, ADR: $267 | ✅ PASSED |
| 2. Zip Code Only | 90210 | Error: "Unable to find market named Beverly Hills, CA" | ⚠️ PARTIAL - Correctly identified zip but market not in database |
| 3. City Name | Nashville, TN | Revenue: $59,376, Occupancy: 57%, ADR: $287 | ✅ PASSED |
| 4. Market Comparison | "Which is better for STR investing, Austin or Nashville?" | Error: "Unable to retrieve market data for Nashville" | ❌ FAILED - Should compare both markets |
| 5. General STR Question | "What is a good occupancy rate for STR?" | Provided helpful guidelines (60% or lower = underperforming, 60-75% = solid, 75%+ = excellent) | ✅ PASSED |
| 6. Invalid/Gibberish Input | "asdfghjkl qwerty" | Graceful error: "I can't find any data for the market" | ✅ PASSED |
| 7. Small Town/Tourist Market | Gatlinburg, TN | Revenue: $71,785, Occupancy: 57%, ADR: $343, 23003 listings | ✅ PASSED |
| 8. Specific Address in Tourist Area | 234 Ski Mountain Road, Gatlinburg, TN 37738 | Revenue: $69,447, Occupancy: 54%, ADR: $354 | ✅ PASSED |
| 9. Miami Property | 1000 Brickell Ave, Miami, FL | Revenue: $62,016, Occupancy: 67%, ADR: $254 | ✅ PASSED |
| 10. Save to Favorites | Clicked Save to Favorites | Button changed to "Saved", property appeared in My Favorites panel | ✅ PASSED |
| 11. Export PDF | Clicked Export PDF | PDF download triggered | ✅ PASSED |

## Issues Found

1. **Market Comparison Queries Fail** - When asking to compare two markets (e.g., "Austin vs Nashville"), the system fails to retrieve data for the second market even though it can retrieve each market individually. This appears to be a limitation in how the AI processes comparison queries.

2. **Some Zip Codes Not in Database** - The 90210 zip code was correctly identified as Beverly Hills, CA but the market wasn't found in the AirDNA database. This is expected behavior for markets not covered by the data source.

3. **Occupancy Rate Display** - Some responses show occupancy as a decimal (0.67) instead of percentage (67%). This should be standardized.

## Features Working Correctly

- Property address analysis with revenue, occupancy, ADR
- Market/city analysis with listing counts and top performers
- General STR education questions
- Error handling for invalid inputs
- Save to Favorites functionality
- Export PDF functionality
- Filters (bedrooms, bathrooms)
- Google Places autocomplete for addresses
- Recent searches
- "Powered by Coach Inayah" branding (AirDNA removed)


---

# Step 5 Map View Stress Test Results (Jan 20, 2026)

## Test 1: Florida → Orlando (Large Market)
- **Market Size**: 63,790 listings
- **Listings Returned**: 25
- **Status**: ✅ PASSED

### Results:
- Map auto-centered on Orlando ✅
- Markers displayed with revenue-based color coding ✅
- Summary stats calculated correctly ✅
  - Properties Shown: 25
  - Avg Revenue: $682,593
  - Top Performer: $1,149,459
- Revenue thresholds calculated:
  - Top 33%: ≥ $709,122 (green)
  - Middle 33%: $549,417 - $709,122 (yellow)
  - Bottom 33%: < $549,417 (red)
- Console errors: None

## Test 2: Arizona → Glendale (Submarket-as-Market)
- **Market Type**: Submarket treated as market
- **Status**: ✅ PASSED (after fix)

### Results:
- isSubmarketAsMarket detection working ✅
- Returns Arizona listings (not Michigan) ✅
- Map auto-centered on Glendale, AZ ✅
- Neighborhood dropdown shows helpful message ✅

## Bugs Fixed During Testing:
1. ✅ Neighborhood dropdown UX for submarket-cities
2. ✅ Map auto-centering on location selection
3. ✅ isSubmarketAsMarket detection (was returning wrong state)
4. ✅ Loading spinner added to map
5. ✅ Distance filter feature added


## Test 3: Texas → Austin (Market with Neighborhoods)
- **Market Size**: 24,356 listings
- **Listings Returned**: 25
- **Status**: ✅ PASSED

### Results:
- Map auto-centered on Austin, TX ✅
- Markers displayed with revenue-based color coding ✅
- Summary stats calculated correctly ✅
  - Properties Shown: 25
  - Avg Revenue: $573,595
  - Top Performer: $1,292,737
- Revenue thresholds calculated:
  - Top 33%: ≥ $588,036 (green)
  - Middle 33%: $418,931 - $588,036 (yellow)
  - Bottom 33%: < $418,931 (red)
- Neighborhood dropdown available and loading ✅
- Filters working (Bedrooms, Property Type, Sort By) ✅

### Top Properties Found:
1. 20-acre Ranch for Events - 28BR/28.5BA - $1,292,737/year
2. Inn Cahoots on 6th - 15BR/10.5BA - $956,388/year - 5.0 rating
3. The Gatsby Mansion Waterfront - 12BR/11.5BA - $940,756/year - 5.0 rating



## Test 4: Quick Search by Zip Code (85308 - Phoenix/Scottsdale)
- **Zip Code**: 85308
- **Auto-detected Market**: Phoenix/Scottsdale
- **Auto-selected Neighborhood**: Deer Valley
- **Listings Returned**: 25
- **Status**: ✅ PASSED

### Results:
- Zip code correctly identified market ✅
- Neighborhood auto-selected based on zip ✅
- Map auto-centered on Phoenix/Glendale area ✅
- Summary stats calculated:
  - Market Average: $185,699
  - Top 33%: ≥ $157,196

### Top Properties Found:
1. Large Groups Welcome | 35 Beds - 18BR/9.5BA - $415,126/year
2. New Best Location in Scottsdale - 9BR/6.5BA - $400,408/year - 5.0 rating
3. Discounts! Direct Message - 10BR/8BA - $334,157/year


# Test Findings - Rental Calculator Report

## Test Date: Dec 30, 2025
## Test Property: 100 Peachtree St, Atlanta, GA 30303, USA

## Working Features:
1. ✅ Address autocomplete with Google Places
2. ✅ Lead capture form
3. ✅ Property estimate data showing:
   - Annual Revenue: $65,516 (Range: $63,967 - $75,268)
   - Monthly Average: $5,460
   - Avg. Nightly Rate: $291
   - Occupancy: 62%
4. ✅ Month-by-month forecast with best/worst month highlighting
5. ✅ Comparable properties showing real listings with revenue, ADR, occupancy
6. ✅ View Listing links to actual Airbnb listings
7. ✅ CTA section with Schedule a Call and Download Report buttons

## Issues Found:
1. ❌ Market Overview section showing all zeros (0% occupancy, $0 ADR, $0 revenue, 0 listings)
   - The market data API call may be failing or returning empty data
   - Need to debug the getMarketData function

## Next Steps:
1. Fix market data API integration
2. Implement PDF download functionality
3. Add bedroom performance comparison section


---

## Test Date: Dec 31, 2025
## Test Property: 3456 Arsenal St, St. Louis, MO 63118, USA

### Issues Found

#### 1. "Unknown Location" Bug - STILL PRESENT
- The property report shows "Unknown Location" in the property details section
- Shows "Located in Unknown, USA - a market with 0 active rentals"
- This needs to be fixed - the market name should be "St. Louis" not "Unknown"

#### 2. Formatting Issues - FIXED
- The occupancy percentage now displays correctly with proper spacing
- Example: "91% occupancy" shows correctly

#### 3. Distance to Competition - NOT VISIBLE
- The distance display was added to the code but not showing in the UI
- Need to verify if the distance_meters data is being passed correctly

#### 4. Top Winners Section - WORKING
- The competition section shows top performers with:
  - Revenue per year
  - Nightly rate
  - Occupancy percentage
  - Ratings
  - Superhost badges

#### 5. CTA Sections - WORKING
- "What It Takes to Reach Top-Performer Status" section is visible
- Shows "Common Mistakes That Kill Profits" vs "What Top Performers Do Differently"

### Market Report Test - St. Louis
- ✅ Chapter 2: Top Winners section showing correctly
- ✅ AI-powered analysis integrated
- ✅ Decision-driving CTAs working
- ✅ All 8 chapters displaying properly

### Root Cause of "Unknown Location" Bug
The market_data.name is not being populated correctly from the AirDNA API response.
Need to investigate the backend to see where the market name is being set.

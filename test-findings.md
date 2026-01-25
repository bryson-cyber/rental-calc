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


---

## Test Date: Jan 25, 2026
## Test Property: Denver, CO 80202, USA (2BR/1BA)

### Best/Slowest Months - FIXED ✅
The "Avg" prefix is now showing correctly:
- Best Months (Avg): Aug Avg $6,622, Jul Avg $6,535, Jun Avg $6,271
- Slowest Months (Avg): Mar Avg $4,045, Feb Avg $3,456, Jan Avg $3,126

### Market Landscape - Bedroom filtering applied
The market insights now filter by bedroom count for apples-to-apples comparison.

### Forward-Looking Demand - Data verified
The forward-looking demand data is coming from the AirDNA future_pricing API with bedroom filtering.


### Market Landscape Section - Verified ✅
The Market Landscape now shows bedroom-filtered data:
- 44% Professionally Managed
- 56% Superhosts
- 4.9 Avg Rating
- 1688 Similar Listings (this is the 2BR filtered count, not the total market count)

The label says "Similar Listings" which correctly indicates these are bedroom-filtered.

### Forward-Looking Demand - Verified ✅
- Next 30 Days: 37% (Cool Market)
- Next 180 Days: 18% (Cold Market)
- Peak Period: Jan 25 - Jan 31 (42% occupancy)
- Low Period: Jun 24 - Jun 30 (3% occupancy)

The data is coming from the AirDNA future_pricing API with bedroom filtering applied.


---

## Test Date: Jan 25, 2026 - Optimistic Reframe Test
## Test Property: Denver, CO 80202, USA (2BR/1BA)

### Market Outlook Section - VERIFIED ✅
The Forward-Looking Demand has been reframed with optimistic language:

**Next 30 Days: 37%**
- Label: "Growing Season"
- Subtext: "Build your reviews now"
- Color: Yellow/amber (positive)

**Next 6 Months: 18%**
- Label: "Strategic Window"
- Subtext: "Less competition, easier to stand out"
- Color: Orange (opportunity-focused)

**Peak Earning Window: Jan 25 - Jan 31**
- 42% booking activity
- "Great time for premium pricing"

**Strategic Opportunity: Jun 24 - Jun 30**
- 3% booking activity
- "Perfect time to build reviews & stand out"

All labels are now positive and opportunity-focused instead of "Cold Market" or "Cool Market".

### Data Freshness Indicator - VERIFIED ✅
The comp strength bar now shows: "Data as of Jan 2026"

### Revenue Disclaimer Tooltip - VERIFIED ✅
The Projected Annual Revenue tooltip now explains estimates are based on similar properties.


### Comp Strength Bar - VERIFIED ✅
Shows: "High Confidence | Based on 30 similar properties | Avg. 0.3 mi away | **Data as of Jan 2026**"

### Market Landscape - VERIFIED ✅
Shows: "1688 Similar Listings" (bedroom-filtered, not all market listings)
- 44% Professionally Managed
- 56% Superhosts
- 4.9 Avg Rating

All three fixes confirmed working in production preview.


## Furniture Cost & Expense Slider Feature Test (Jan 25, 2026)

### Form UI - VERIFIED ✅
- **Furniture & Setup Cost** field visible with value "15000" and helper text "Estimated cost to furnish and set up the property"
- **Operating Expenses** slider visible showing "20%" with range 10%-40%
- Helper text: "Covers cleaning, supplies, utilities, repairs, and platform fees"
- All form fields properly populated with test data

Running analysis to verify calculations...


### Results Verification - ALL FEATURES WORKING ✅

**Hero Revenue Card (4-column layout):**
- Monthly Revenue: $4,981
- Your Rent: $2,500
- Expenses (20%): $996 (amber colored box)
- Net Profit: $1,484 (green colored box)
- Insight text: "After 20% expenses, you keep $1,484/month — that's $17,814/year profit"

**Investment Analysis Section:**
- "Time to Recoup Investment: 11 mo" (displayed prominently)
- Progress bar showing 11 months on a 0-24 month scale
- Furniture Cost: $15,000
- Monthly Profit: $1,484
- Expenses (20%): $996
- Break-even Occupancy: 41%
- "If occupancy drops 20%: You'd still profit $658/month"

**Calculation Verification:**
- Monthly Revenue: $4,981
- Expenses (20%): $4,981 × 0.20 = $996.20 ≈ $996 ✓
- Net Profit: $4,981 - $2,500 - $996 = $1,485 ≈ $1,484 ✓
- Months to Recoup: $15,000 ÷ $1,484 = 10.1 months ≈ 11 mo ✓

All calculations are correct and the UI is displaying properly!


## Investment Comparison Test (Jan 25, 2026)

**Investment Analysis Section - Verified Working:**
- Header shows "Exceptional ROI" badge (green)
- Main display: "Time to Recoup Your $15,000 Investment" → **11 months**
- Tagline: "Then you keep $1,484/month profit forever"

**Comparison Section - Working Correctly:**
- "TO EARN $17,814/YEAR FROM $15,000, OTHER INVESTMENTS WOULD TAKE:"
- Your Airbnb: **11 months** (green, highlighted)
- Stock Market (S&P 500): **12+ years** (gray)
- Real Estate Appreciation: **24+ years** (gray)
- High-Yield Savings: **30+ years** (gray)

**Investment Breakdown:**
- Setup Cost: $15,000
- Monthly Profit: $1,484 (green)
- Year 1 Profit: $17,814 (green)

**Framing is now positive and comparative - shows Airbnb as dramatically faster than traditional investments**


## Expense Slider Labels Test (Jan 25, 2026)

**Expense Slider - Verified Working:**
- Shows "20%" in amber at top right
- Slider at 20% position (default)
- Labels below slider:
  - "10%" on left
  - "20% Recommended" in green (center)
  - "40%" on right
- Second row of labels:
  - "Below Avg" on left
  - "Above Avg" on right
- Helper text: "Covers cleaning, supplies, utilities, repairs, and platform fees"

**All labels displaying correctly for demo**

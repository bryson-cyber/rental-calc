# Bugs Found During Analysis Testing

## Test: 1234 Main St, Denver, Colorado, USA
- Monthly Rent: $2,500
- Bedrooms: 3
- Bathrooms: 2

## Bugs Identified:

### 1. AirDNA Feasibility Assessment - $NaN Projected Revenue
**Location:** AirDNA Feasibility Assessment section
**Issue:** Shows "$NaN" for Projected Revenue and "0%" for Projected Occupancy
**Expected:** Should show actual projected revenue and occupancy values
**Severity:** High - Data display bug
**Status:** FIXED - Now shows $46,890 Projected Revenue, 39% Break-Even Occupancy, MEDIUM Risk Level

### 2. Property Type Analysis - $0 and 0% for all types
**Location:** Property Type Analysis section
**Issue:** Shows "$0" and "0 listings • 0% occ" for both Entire Home and Private Room
**Expected:** Should show actual property type data
**Severity:** Medium - Data not being populated

### 3. Market Overview still shows "Local Market" 
**Location:** Market Overview section
**Issue:** Shows "The Local Market market has..." instead of actual market name (Denver)
**Expected:** Should show "The Denver market has..."
**Severity:** Medium - Market name not being properly extracted
**Status:** FIXED - Now uses submarket_details.parent_market_name or submarket_exploration.market_name first

### 4. Competitive Landscape shows "7472% occupancy"
**Location:** Competitive Landscape accordion section  
**Issue:** Shows "earning $66,751/year with 7472% occupancy" - impossible percentage
**Expected:** Should show 75% occupancy (as shown correctly in competitor card)
**Severity:** High - Calculation/display bug
**Status:** FIXED - Now shows 75% occupancy correctly

### 5. Inconsistent competitor counts
**Location:** Multiple sections
**Issue:** 
  - Header badge shows "1 direct competitors analyzed"
  - Market Intelligence shows "Direct Competitors: 1"
  - Same-Bedroom Competitors section shows "7 Total Found"
  - Qualifying Competitors shows "102"
**Expected:** Consistent competitor counts or clear explanation of different metrics
**Severity:** Medium - Confusing UX

### 6. Revenue values seem inconsistent
**Location:** Market Saturation Analysis
**Issue:** Shows "Avg Revenue: $133,889" but Same-Bedroom Competitors shows "Avg Revenue: $28,445"
**Expected:** Values should be consistent or clearly labeled as different metrics
**Severity:** Low - Potentially confusing

## Items Working Correctly:
- Executive Summary renders with proper markdown formatting
- Revenue Projections display correctly ($32,655 / $50,892 / $54,706)
- Annual Profit calculations display correctly
- Startup Costs & Break-Even display correctly
- 5-Year Market Trends display correctly
- Same-Bedroom Competitors list displays with images and data
- Export buttons present (PDF/Excel)

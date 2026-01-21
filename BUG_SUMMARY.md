# Bug Summary - Extensive Testing (Jan 21, 2026)

## Critical Bugs (Data Quality Issues)

### 1. Distance Badges Not Showing on Comp Cards
**Location**: Tool 1 (Validate the Deal) - TeslaDashboard.tsx
**Issue**: Distance badges only show on some comp cards, not all
**Root Cause**: `distance_meters` field not being passed through data transformation pipeline
**Impact**: Users can't see how close comps are to their property
**Fix Required**: Trace data flow from API → sop-reports.ts → routers.ts → LeadMagnet.tsx → TeslaDashboard.tsx

### 2. Tool 2 (Bulk Comparison) Shows $0 Rent
**Location**: Tool 2 (Find the Best Deal) - BulkComparison.tsx
**Issue**: Monthly rent shows $0 even when property context has rent set
**Root Cause**: Rent value not being passed to bulk comparison API call
**Impact**: Profit calculations are wrong (shows full revenue as profit)
**Fix Required**: Pass monthlyRent from property context to bulk comparison

### 3. Tool 4 (Explore Listings) - Extremely Low Revenue Numbers
**Location**: Tool 4 (Explore Listings) - ExploreListings.tsx
**Issue**: Revenue numbers appear extremely low ($7,038, $4,437, $996 annual for Austin)
**Root Cause**: Possibly fetching wrong data or calculation error
**Impact**: Misleading data for users
**Fix Required**: Investigate API response and calculation logic

### 4. Tool 4 (Explore Listings) - RevPAR Calculation Wrong
**Location**: Tool 4 (Explore Listings) - ExploreListings.tsx
**Issue**: RevPAR values don't match Daily Rate × Occupancy
**Example**: $172 × 15% = $25.80, but shows $19
**Impact**: Incorrect financial metrics
**Fix Required**: Fix RevPAR calculation formula

## Medium Bugs (UI/UX Issues)

### 5. Tool 3 (Market Research) - Wrong Market Comps
**Location**: Tool 3 (See Real Revenue) - MarketResearch.tsx
**Issue**: San Diego properties showing in Miami search results
**Root Cause**: Possible API data issue or incorrect filtering
**Impact**: Confusing for users, wrong market data

### 6. Location Input Appears Blank After Selection
**Location**: Tool 4 (Explore Listings)
**Issue**: After selecting a location, the input field appears blank
**Impact**: Minor UX issue - users may not know what they selected

## Low Priority (Minor Issues)

### 7. Revenue Numbers Truncated in Tool 3
**Location**: Tool 3 (See Real Revenue) - Comp Data section
**Issue**: Revenue shows as $293, $128 instead of full amounts
**Impact**: Minor display issue

## Working Features (Verified)

| Tool | Feature | Status |
|------|---------|--------|
| Tool 1 | Revenue projection | ✅ Working |
| Tool 1 | Market Health Grade with AirDNA score | ✅ Working |
| Tool 1 | Comp Strength Indicator | ✅ Working |
| Tool 1 | Tooltips on metrics | ✅ Working |
| Tool 1 | Rent/profit calculation (when rent entered) | ✅ Working |
| Tool 3 | Market data by bedroom count | ✅ Working |
| Tool 3 | Seasonality charts | ✅ Working |
| Tool 3 | Superhost badges | ✅ Working |
| Tool 4 | Filter & Sort options | ✅ Working |
| Tool 4 | List/Map view toggle | ✅ Working |

## Priority Order for Fixes

1. **HIGH**: Fix distance badges on comp cards (Tool 1)
2. **HIGH**: Fix rent passing in bulk comparison (Tool 2)
3. **MEDIUM**: Investigate low revenue numbers (Tool 4)
4. **MEDIUM**: Fix RevPAR calculation (Tool 4)
5. **LOW**: Fix market comp filtering (Tool 3)
6. **LOW**: Fix location input display (Tool 4)

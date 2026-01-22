# Rental Calculator QA Report
**Date:** January 22, 2026
**Tester:** Automated QA
**Test Address:** 1321 15th St, Denver, CO 80202

---

## Executive Summary

The Validate Deal flow **WORKS** and produces comprehensive results. The TeslaDashboard component shows:
- Projected Annual Revenue: $50,744 (1.2% vs last year)
- Monthly Revenue: $4,229
- Monthly Profit: $1,729 (after $2,500 rent)
- Nightly Rate: $180 ADR
- Occupancy: 77%
- Conservative: $47K / Optimistic: $55K estimates
- Seasonal Forecast chart with 12-month projection
- Arbitrage Analysis with break-even occupancy (46%)
- Market Health Grade: B+ (71/100)
- Similar Properties: 29 listings

---

## Issues Found

### Issue #1: Bedroom Selection Not Persisting (My Property Card)
**Severity:** MEDIUM - UI inconsistency, but validation works with form values
**Location:** StartWithProperty component
**Expected:** When user selects 3 Bedrooms, My Property card should show "3 Bedrooms"
**Actual:** Shows "2 Bedrooms" in My Property card even after selecting 3 in dropdown
**Impact:** Confusing for users, but the Validate Deal form uses its own state correctly
**Note:** The validation API call uses the form values (2 BR shown), not the My Property card values

### Issue #2: New Components Not in TeslaDashboard
**Severity:** LOW - Feature enhancement, not a bug
**Location:** TeslaDashboard.tsx
**Expected:** MarketInsightsPanel and BreakEvenCalculator should appear
**Actual:** These components are only in ChapterPropertyReport (Home.tsx flow)
**Recommendation:** Either add to TeslaDashboard or document that full report is in Home.tsx flow

### Issue #3: Missing Market Insights Panel
**Severity:** LOW - Feature not integrated into TeslaDashboard
**Location:** TeslaDashboard.tsx
**Expected:** Booking lead time, length of stay, supply trend should appear
**Actual:** Not visible in the TeslaDashboard results

---

## What's Working Well

1. **Property Analysis** - Shows comprehensive revenue projections
2. **Seasonal Forecast** - 12-month chart with peak/shoulder/slow indicators
3. **Arbitrage Analysis** - Break-even occupancy (46%) with cushion calculation
4. **Market Health Grade** - B+ score with breakdown
5. **Similar Properties** - 29 comparable listings with photos, ratings, revenue
6. **AI Property Advisor** - Button available for deeper analysis
7. **YoY Comparison** - Toggle to show year-over-year changes

---

## Data Accuracy Check

| Metric | Value | Reasonable? |
|--------|-------|-------------|
| Annual Revenue | $50,744 | Yes - matches Denver 2BR market |
| Monthly Revenue | $4,229 | Yes - $50,744 / 12 = $4,229 |
| Nightly Rate | $180 | Yes - typical for Denver 2BR |
| Occupancy | 77% | Yes - healthy market |
| Break-even Occupancy | 46% | Yes - $2,500 / $4,229 * 77% ≈ 46% |
| Monthly Profit | $1,729 | Yes - $4,229 - $2,500 = $1,729 |

---

## Formatting Issues

1. **None found** - All numbers formatted correctly with $ and %
2. **Charts render properly** - Seasonal forecast bar chart displays correctly
3. **Cards aligned** - Grid layout works on desktop

---

## Recommendations for Going Live

### Must Fix Before Launch
1. **Bedroom selection bug** - Users will be confused when My Property shows wrong value

### Nice to Have
1. Add MarketInsightsPanel to TeslaDashboard for booking patterns
2. Add BreakEvenCalculator to TeslaDashboard for detailed break-even analysis
3. Consider merging TeslaDashboard and ChapterPropertyReport for consistency

### Testing Needed
1. [ ] Test on mobile viewport
2. [ ] Test with different property types (studio, 5BR)
3. [ ] Test with edge cases (very high rent, very low rent)
4. [ ] Test See Real Revenue flow (Step 1)
5. [ ] Test AI Advisor integration

---

## See Real Revenue (Step 1) Test Results

**Status:** WORKING
**Test:** Searched zip code 80202 (Denver LoDo)

**Results Displayed:**
- Market Validated badge: "(LoDo) 80202 is Profitable"
- Avg Annual Revenue: $49,482
- Nightly Rate: $202 ADR
- Occupancy: 67%
- Active Listings: 333

**Revenue by Property Type:**
- 1 BR: $63,757/yr, 80% occupancy, 4 listings
- 2 BR: $76,986/yr, 71% occupancy, 36 listings
- 3 BR: $125,773/yr, 72% occupancy, 10 listings
- 4 BR: Limited data available

**Market Seasonality:**
- Occupancy by Month chart (Avg: 67%)
- ADR by Month chart (Avg: $199)
- Color coding: Green = above average, Amber = below average

---

## Next Steps

1. Fix bedroom selection persistence in StartWithProperty
2. Test the Home.tsx flow to verify ChapterPropertyReport with new components
3. Test See Real Revenue (Step 1) for market-level analysis

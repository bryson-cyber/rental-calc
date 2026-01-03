# Stress Test Findings - St. Louis Property Analysis

**Property:** 4461 Gannett St, Saint Louis, MO, USA
**Rent:** $1,295/month | **Bedrooms:** 2 | **Bathrooms:** 1

## Key Metrics Displayed
- Projected Revenue: $32,480/year
- Monthly Profit: $632 after expenses
- Market Occupancy: 64% average
- Break Even: 7.6 mo estimated

## Quick Facts Section
- Revenue-to-rent ratio: 2.09x - BELOW 2.5x threshold
- Qualification rate: 100% of 3 similar properties are profitable - STRONG
- Direct competitors: 25 same-bedroom listings within 1km - HIGH density
- Break-even: 47.7% occupancy needed, 7.6 months to recover $4800 startup costs
- Sensitivity: At 80% occupancy, profit is $4332/year - STILL PROFITABLE
- Cash reserves: $1974 needed for 3 off-season months
- Market trajectory: GROWING - 61.3% change over 5 years
- VERDICT: CAUTION with MEDIUM confidence - Revenue-to-rent below threshold

## Market Intelligence Report
- Market Health: Strong
- Avg Occupancy: 76% (Above national avg 65%)
- Avg Daily Rate: $92 (Budget-friendly market)
- Active Listings: 4 (Small, niche market)
- Est. RevPAR: $70

## Your Competition Section
- Shows: 4 similar properties
- EXPECTED: 10 similar properties (BUG!)

### Competitors Listed:
1. Private Gym • 2BR • Modern Condo Downtown - 84% occupancy, 3.9★, $35,373/yr
2. Holly Hills Retreat * Fire Pit * Close to Downtown - 65% occupancy, 4.8★, $33,251/yr
3. Stylish South City 2BR w/ Garage & Blazing Wi-fi - 71% occupancy, 4.9★, $32,508/yr
4. Comfortable Extended Stay * Fire Pit * Parking Pad - 65% occupancy, 5★, $32,480/yr

## Potential Issues Identified

### BUG 1: Competitor Count Mismatch
- Header says "4 similar properties" but should show 10
- Only 4 competitor cards displayed

### INCONSISTENCY 1: Competitor Count Discrepancy
- Quick facts says "25 same-bedroom listings within 1km"
- Market Intelligence says "4 active short-term rental listings"
- Competition section shows "4 similar properties"
- These numbers don't match!

### INCONSISTENCY 2: Qualification Rate Sample Size
- Says "100% of 3 similar properties are profitable"
- But competition section shows 4 properties
- Which is correct - 3 or 4?

### INCONSISTENCY 3: Market Overview Data Conflicts
- Market Overview says "200 active listings" with "only 3 being 2-bedroom properties"
- But Market Intelligence Report says "4 active short-term rental listings"
- And Your Competition shows "4 similar properties"
- Quick facts says "25 same-bedroom listings within 1km"
- These numbers are wildly inconsistent: 3 vs 4 vs 25 vs 200!

### INCONSISTENCY 4: Revenue Comparison Issue
- Market Overview says median revenue is $74,709/year
- But projected revenue is only $32,480/year
- This is a HUGE gap - less than half the median!
- The report should flag this more prominently

### INCONSISTENCY 5: Neighborhood Data
- Says "revenue gap between current neighborhood and top-recommended is not available"
- This is a data gap that should be filled or hidden

### INCONSISTENCY 6: Revenue Analysis Data Conflicts
- Revenue Analysis says "average revenue of qualifying competitors is $67,486/year"
- But Market Overview says median is $74,709/year
- And Bedroom Performance says "average revenue for 2-bedroom listings is $23,093/year"
- These numbers don't align: $23,093 vs $32,480 vs $67,486 vs $74,709!

### INCONSISTENCY 7: Competitor Count Still Conflicting
- Revenue Analysis says "3 same-bedroom listings analyzed"
- But Your Competition shows 4 properties
- Market Overview says "only 3 being 2-bedroom properties"
- Market Intelligence says "4 active short-term rental listings"

### BUG 2: CRITICAL - Impossible Occupancy Values in Competitive Landscape
- Says "average occupancy of 7135%" - THIS IS IMPOSSIBLE! Occupancy cannot exceed 100%
- Top performer shows "occupancy of 5378%" - ALSO IMPOSSIBLE!
- This is a data formatting bug - likely missing decimal point (71.35% and 53.78%)

### INCONSISTENCY 8: Competitor Count AGAIN Different
- Competitive Landscape says "25 direct competitors" within 3.0km
- But Your Competition section shows only 4 properties
- Quick facts says "25 same-bedroom listings within 1km"
- Market Overview says "only 3 being 2-bedroom properties"
- WHICH IS CORRECT?!

### INCONSISTENCY 9: Revenue Numbers Still Don't Match
- Competitive Landscape says average competitor revenue is $34,209/year
- Revenue Analysis says average of qualifying competitors is $67,486/year
- Market Overview says median is $74,709/year
- Bedroom Performance says average for 2BR is $23,093/year
- FOUR DIFFERENT NUMBERS!

### ISSUE: Missing Data Displayed as "not available"
- "average similarity score of comps is not available"
- "most common amenities among the top performer's comps are not available"
- "total number of Superhosts in the market is not available"
- "revenue premium for Superhosts is not available"
- "average photo count for competitors is not available"
- These should either be hidden or filled with actual data

### BUG 3: Seasonal Strategy - Contradictory Peak/Low Dates
- Says "Peak dates to price highest are 2026-01-03, 2026-01-04, 2026-01-05, 2026-01-06, 2026-01-07" (January)
- But also says "Peak months are May, June, and July"
- And says "off-season months are December 2025, January 2026, and February 2026"
- CONTRADICTION: January is listed as both PEAK dates AND off-season month!

### BUG 4: Seasonal Strategy - Low Dates in Peak Season
- Says "Low dates where discounts may be needed are 2026-06-14, 2026-06-15, 2026-06-16, 2026-06-17, 2026-06-18" (June)
- But June is listed as a PEAK month!
- This is confusing and contradictory

### ISSUE: Missing Booking Patterns Data
- Says "Based on Booking Patterns, the information is not available"
- This should be hidden if no data available

### TO VERIFY:
- [x] Market Overview - MULTIPLE INCONSISTENCIES FOUND
- [x] Revenue Analysis section - MORE INCONSISTENCIES FOUND
- [x] Competitive Landscape section - CRITICAL BUGS FOUND (impossible occupancy values)
- [x] Seasonal Strategy section - CONTRADICTORY PEAK/LOW DATES
- [x] Historical Context section - LOOKS GOOD (6 years data, 61.3% revenue increase, 11.7% occupancy increase, 45.5% ADR increase)
- [x] Risk Assessment section - MAJOR DISCREPANCY FOUND

### BUG 5: CRITICAL - Massive Profit Projection Discrepancy
- Risk Assessment says "AirDNA's profit projection is $2,272"
- But our analysis shows "Monthly Profit $632" = $7,584/year
- There is a "divergent assessment of -70%"
- This is a HUGE red flag - which number is correct?!
- The report shows $632/month profit but AirDNA says only $2,272/year total

### GOOD: Risk Assessment Has Useful Data
- Overall risk rating: MEDIUM
- Seasonality risk: HIGH
- Regulation risk: MEDIUM  
- Market saturation: LOW
- Top 3 risks with financial impact:
  1. Seasonality - $1,287.33 potential impact
  2. Market Competition - $2,893 gap to top performer
  3. Unexpected Expenses - Unknown impact
- [x] Financial Outlook section - GOOD DATA with detailed calculations
- [x] Conclusion section - GOOD summary with actionable recommendations

### GOOD: Financial Outlook Has Solid Data
- Monthly revenue: $2,706.67
- Monthly expenses: $2,075 (including rent)
- Monthly profit: $631.67
- Annual profit: $7,580
- Startup costs breakdown: Furniture ($3,000), Supplies ($500), Photos ($300), Buffer ($1,000) = $4,800
- Break-even: 7.6 months
- Break-even occupancy: 47.7%
- First-year ROI: 57.9%
- Ongoing annual ROI: 48.8%
- Three scenarios: Conservative ($853/yr), Realistic ($7,580/yr), Optimistic ($8,351/yr)

### INCONSISTENCY 10: Startup Costs Don't Match
- Financial Outlook says startup costs are $4,800
- But Quick Facts says "7.6 months to recover $4800 startup costs"
- Earlier in the report it said "$5000 startup costs" and "$6500 startup costs"
- Which is the correct startup cost figure?
- [x] Revenue Projections accordion - GOOD (Conservative $25,753, Realistic $32,480, Optimistic $33,251)
- [x] Annual Profit accordion - GOOD (Conservative $853, Realistic $7,580, Optimistic $8,351)
  - Shows "What this means" explanation: $632/month in your pocket
  - Numbers are consistent with Financial Outlook section
- [x] Startup Costs & Break-Even accordion - CRITICAL DISCREPANCY!

### BUG 7: CRITICAL - Startup Costs MASSIVELY Different
- Startup Costs & Break-Even accordion shows: **$9,840 - $12,840**
- But Financial Outlook says: **$4,800** (Furniture $3,000, Supplies $500, Photos $300, Buffer $1,000)
- Quick Facts says: "7.6 months to recover $4800 startup costs"
- Break-Even Timeline shows: **12 months** (Range: 11-36 months)
- But Quick Facts says: **7.6 months** break-even
- THESE ARE COMPLETELY INCONSISTENT!
- The accordion shows 2-3x higher startup costs than the AI narrative
- Break-even timeline is 12 months vs 7.6 months - 60% difference!

### BUG 6: CONFIRMED - Only 4 Competitors Instead of 10
- Your Competition section shows "4 similar properties" instead of expected 10
- The 4 competitors shown are:
  1. Holly Hills Retreat - 65% occupancy, 4.8★, $33,251/yr
  2. Stylish South City 2BR - 71% occupancy, 4.9★, $32,508/yr  
  3. Comfortable Extended Stay - 65% occupancy, 5★, $32,480/yr
- Images are showing as house icons instead of actual property photos
- This is a significant issue - should show 10 properties for proper comparison

### GOOD: 12-Month Historical Performance Section
- Shows 3 charts: Occupancy, ADR, and Monthly Revenue trends
- Occupancy: Low 46%, High 73%
- ADR: Low $91, High $162
- Monthly Revenue: Low $1,564, High $3,298
- Trend Analysis shows 7.4% occupancy increase - indicating growing demand
- This section is well-designed and informative!

### INCONSISTENCY 11: Market Intelligence vs Other Sections
- Market Intelligence Report shows "4 active short-term rental listings"
- But Competitive Landscape says "25 direct competitors"
- And Market Overview says "200 active listings" with "3 being 2-bedroom"
- MASSIVE DISCREPANCY: 3 vs 4 vs 25 vs 200!
- [x] Seasonality Analysis accordion - NEED TO VERIFY
- [x] 12-Month Historical Performance accordion - GOOD (charts showing trends)
- [x] Future Pricing Forecast accordion - NEED TO VERIFY
- [x] 5-Year Market History accordion - Shows "6 years of data" label
- [x] Amenity Analysis accordion - NEED TO VERIFY
- [x] Risks to Consider accordion - EXCELLENT SECTION!

### GOOD: Risks to Consider Section is Well-Designed
- 4 risk categories with severity levels:
  1. **Market** (Medium) - 5,597 active listings, 10% ADR drop = -$3,387 revenue
  2. **Financial** (Medium) - 10% expense increase = +$2,020 costs
  3. **Operational** (Medium) - 48% seasonal variance, $1,287.33 peak-to-slow difference
  4. **Regulatory** (Low) - Unknown compliance costs
- Each risk has specific mitigation strategies
- This is one of the best sections in the report!

### INCONSISTENCY 12: Market Listings Count Varies Again
- Risks section says "5,597 active listings"
- Market Overview says "200 active listings"
- Market Intelligence says "4 active listings"
- WHICH IS CORRECT?! This is a major data integrity issue.
- [ ] Amenity Analysis accordion
- [ ] Risks to Consider accordion
- [ ] PDF download functionality
- [ ] Excel download functionality


---

## SUMMARY OF ALL BUGS FOUND

### CRITICAL BUGS (Must Fix):

1. **BUG 1: Impossible Occupancy Values** - Shows 7135% and 5378% occupancy (should be 71.35% and 53.78%)
   - Location: Competitive Landscape section
   - Impact: Makes the report look unprofessional and data unreliable

2. **BUG 7: Startup Costs Massively Inconsistent** 
   - Accordion shows $9,840-$12,840
   - AI narrative says $4,800
   - Quick Facts says $4,800
   - Break-even shows 12 months vs 7.6 months
   - Impact: User doesn't know which number to trust

3. **BUG 6: Only 4 Competitors Instead of 10**
   - Should show 10 similar properties for comparison
   - Currently only showing 4
   - Impact: Insufficient competitive analysis

### HIGH SEVERITY BUGS:

4. **INCONSISTENCY: Market Listings Count Varies Wildly**
   - 4 listings (Market Intelligence)
   - 25 competitors (Competitive Landscape)
   - 200 listings (Market Overview)
   - 5,597 listings (Risks section)
   - Impact: Data integrity issue - which is correct?

5. **BUG 4: Contradictory Peak/Low Dates**
   - Peak months: May, June, July 2026
   - But "Peak dates to price highest" are January 2026 dates
   - Impact: Confusing pricing guidance

6. **BUG 5: Profit Projection Discrepancy**
   - AirDNA says $2,272/year profit
   - Our analysis says $7,580/year profit
   - 70% divergence mentioned but not explained
   - Impact: User doesn't know which projection to trust

### MEDIUM SEVERITY BUGS:

7. **Revenue Percentiles Don't Match Property Type**
   - Shows $68K-$110K percentiles for market
   - But property projected at $32K
   - These are for ALL listings, not 2-bedroom
   - Impact: Misleading comparison

8. **Competitor Images Not Loading**
   - Shows house icons instead of actual property photos
   - Impact: Reduced visual appeal and usefulness

### LOW SEVERITY:

9. **Missing Data Throughout**
   - "Not available" appears frequently
   - Superhost revenue premium, photo counts, amenity gaps all missing
   - Impact: Incomplete analysis

---

## RECOMMENDED FIXES (Priority Order):

1. Fix occupancy display - divide by 100 to show as percentage
2. Standardize startup costs calculation across all sections
3. Increase competitor count to 10
4. Clarify which market scope each section uses (hyperlocal vs regional)
5. Fix peak/low date logic in Seasonal Strategy
6. Explain AirDNA vs our profit projection difference
7. Filter revenue percentiles by bedroom count
8. Load actual competitor images
9. Handle missing data more gracefully

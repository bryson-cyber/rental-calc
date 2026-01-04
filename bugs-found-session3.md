# Bugs Found During Debugging Session 3 - January 4, 2026

## Analysis Test: 1234 Main St, Denver, CO (3BR, 2BA, $2500/mo)

### Issues Found:

1. **Market name showing "Local Market" instead of actual market name**
   - Location: Market Overview section
   - Text: "The Local Market market has 13,376 active short-term rental listings..."
   - Expected: "The Denver market has..."
   - Status: NEEDS FIX

2. **Property Type Analysis showing $0 and 0% occupancy**
   - Location: Property Type Analysis section
   - Shows: "Entire Home $0, 0 listings, 0% occ" and "Private Room $0, 0 listings, 0% occ"
   - Recommendation incorrectly says "private_room" with "0% occupancy"
   - Status: NEEDS FIX - Should hide section when no data available

3. **Inconsistent competitor counts**
   - "1 direct competitors analyzed" in summary badges
   - "There are 1 comparable 3-bedroom properties" in Competitive Landscape
   - "7 same-bedroom competitors" in Market Intelligence section
   - "102 Qualifying Competitors" in another section
   - Status: CONFUSING - Need to clarify what each count means

4. **AirDNA Feasibility shows "-76% vs Our Estimate"**
   - AirDNA: $46,890 vs Our Estimate: $50,892
   - Actual difference is about -8%, not -76%
   - Status: CALCULATION BUG

### Analysis of Issues:

1. **Market name "Local Market" issue**: The code correctly tries to get market name from `submarket_details.parent_market_name` or `submarket_exploration.market_name`, but the AirDNA API may not be returning `parent_market_name` in the submarket details response. Need to check if the API is returning this field.

2. **-76% calculation issue**: The calculation is `(airdnaAnnualProfit - ourAnnualProfit) / Math.abs(ourAnnualProfit) * 100`. If AirDNA profit is $46,890 and our realistic profit is $11,532, then: (46890 - 11532) / 11532 * 100 = 306% (not -76%). The issue might be that we're comparing revenue vs profit incorrectly.

### Working Correctly:
- Executive Summary displays properly with markdown formatting
- Revenue projections show correctly ($32,655 conservative, $50,892 realistic, $54,706 optimistic)
- Profit calculations appear correct
- Break-even occupancy (65%) and timeline (11 months) display correctly
- 5-Year Market Trends display correctly
- Same-Bedroom Competitors list displays correctly with 5 properties shown
- Seasonal Strategy displays correctly

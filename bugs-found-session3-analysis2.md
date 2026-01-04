# Bugs Found - Analysis Run 2 (Austin, TX)

## Test: 123 Main St, Austin, TX (2BR, 1BA, $2000/mo)

### Issues Found:

1. **Market name still showing "Local Market"**
   - Location: Market Overview section
   - Text: "The Local Market market has 24,987 active short-term rental listings..."
   - Expected: "The Austin market has..."
   - Status: STILL NOT FIXED - need to investigate why submarket_details.parent_market_name is not being returned

2. **Property Type Analysis showing $0 and 0% occupancy**
   - Shows: "Entire Home $0, 0 listings, 0% occ" and "Private Room $0, 0 listings, 0% occ"
   - Recommendation incorrectly says "private_room" with "0% occupancy"
   - Status: API LIMITATION - AirDNA not returning property type data

3. **AirDNA Feasibility shows "-92% vs Our Estimate"**
   - AirDNA: $40,542 vs Our Estimate: ~$55,384 (realistic profit)
   - Calculation: (40542 - 55384) / 55384 * 100 = -26.8%, NOT -92%
   - Status: CALCULATION BUG - need to verify what values are being compared

4. **Inconsistent competitor counts**
   - "8 direct competitors analyzed" in summary badges
   - "There are 8 comparable 2-bedroom properties" in Competitive Landscape
   - "10 similar properties" in Your Competition section
   - "25 same-bedroom competitors" in Same-Bedroom Competitors section
   - "22 Qualifying Competitors" in Market Saturation section
   - Status: CONFUSING - different sections use different filtering criteria

### Working Correctly:
- Executive Summary displays properly with markdown formatting
- Revenue projections show correctly ($76,515 conservative, $88,744 realistic, $96,736 optimistic)
- Profit calculations appear correct ($43,155 conservative, $55,384 realistic, $63,376 optimistic)
- Break-even occupancy (43%) and timeline (2-3 months) display correctly
- 5-Year Market Trends display correctly (Revenue up 34.2%, ADR up 32.2%)
- Same-Bedroom Competitors list displays correctly with 5 properties shown
- Seasonal Strategy displays correctly with peak/off-peak months
- Competitor listings display with photos, ratings, revenue, and occupancy

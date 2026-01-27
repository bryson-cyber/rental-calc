# Step 4 (Find the Best Deal) Skill Compliance Audit

## Date: January 27, 2026

## Overview
Step 4 allows users to compare up to 25 properties side-by-side to find which one will make the most money.

## Visible Elements

### Input Form (Before Results)
1. **Property Address Input** - Google Places autocomplete
2. **Rent Input** - Monthly rent amount
3. **Beds Dropdown** - 1-6 bedrooms
4. **Baths Dropdown** - 1-4 bathrooms
5. **Add Another Property Button** - Adds new property row
6. **Find the Winner Button** - Triggers comparison
7. **Property Counter** - "2/25 properties"
8. **How This Tool Helps You** - Expandable help section

### Results Display (After Comparison)
1. **Properties Compared Badge** - "X Properties Compared"
2. **Sort Controls** - Profit, Revenue, Ratio
3. **Property Cards** with:
   - Rank Badge (#1, #2, #3 with Trophy for winner)
   - Property Image
   - Address
   - Bed/Bath/Rent details
   - Rating & Reviews
   - **Profit** - Monthly profit (green/red based on positive/negative)
   - **Revenue** - Monthly revenue
   - **Booking Rate** - Percentage booked
   - **ROI Ratio** - Revenue to rent ratio with ADR
4. **Winner Badge** - For #1 ranked property

## Tooltip Audit

### Input Form
- [ ] Property Address - NO tooltip
- [ ] Rent Input - NO tooltip  
- [ ] Beds Dropdown - NO tooltip
- [ ] Baths Dropdown - NO tooltip
- [ ] Property Counter (2/25) - NO tooltip

### Results Display
- [ ] Profit metric - NO tooltip (just label "Profit" and "per month")
- [ ] Revenue metric - NO tooltip (just label "Revenue" and "per month")
- [ ] Booking Rate metric - NO tooltip (just label "Booking Rate" and "booked nights")
- [ ] ROI Ratio metric - NO tooltip (just label "ROI Ratio" and ADR)
- [ ] Rating - NO tooltip
- [ ] Reviews - NO tooltip
- [ ] Winner Badge - NO tooltip

## Quality Checklist

1. **Does each section have a guiding question?**
   - YES: "Answer: Which property should I choose?"

2. **Is technical jargon translated to plain English?**
   - PARTIAL: Uses "Booking Rate" (good), but "ROI Ratio" and "ADR" are jargon

3. **Are there contextual comparisons?**
   - YES: Properties are ranked and compared side-by-side

4. **Is there a clear verdict/recommendation?**
   - YES: Winner badge with Trophy icon for #1 property

5. **Are confidence indicators shown?**
   - NO: No indication of data source or confidence level

6. **Is the visual hierarchy clear?**
   - YES: Winner highlighted with green border and trophy

7. **Would a complete beginner understand?**
   - PARTIAL: Missing tooltips to explain what each metric means

8. **Are info bubbles added for complex metrics?**
   - NO: No tooltips on any metrics

9. **NO EMOJIS anywhere in the UI?**
   - PASS: No emojis found

## Compliance Gaps Found

### CRITICAL: Missing Tooltips on Results
1. **Profit** - Needs tooltip explaining: "Your monthly profit after paying rent. Revenue minus rent equals profit."
2. **Revenue** - Needs tooltip explaining: "Estimated monthly income from bookings based on similar properties in the area."
3. **Booking Rate** - Needs tooltip explaining: "Percentage of nights booked per month. Higher is better - 70%+ is considered strong."
4. **ROI Ratio** - Needs tooltip explaining: "How many times your rent you'll earn back. 2x means you earn double your rent."
5. **ADR** - Should be translated to "Nightly Rate" or have tooltip

### MODERATE: Jargon Issues
1. "ROI Ratio" - Should be "Profit Multiplier" or similar beginner-friendly term
2. "ADR" - Should be "Nightly Rate" or "Average Nightly Price"

### MINOR: Missing Context
1. No data source/confidence indicator
2. No explanation of how rankings are calculated

## Fixes Required
1. Add InfoTooltip to Profit metric
2. Add InfoTooltip to Revenue metric
3. Add InfoTooltip to Booking Rate metric
4. Add InfoTooltip to ROI Ratio metric (and rename to beginner-friendly term)
5. Change "ADR" to "Nightly Rate"
6. Add confidence indicator showing data source

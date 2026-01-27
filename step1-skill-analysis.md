# Step 1 Analysis Against bnb-lead-magnet-dev Skill Guidelines

## Date: January 27, 2026

## Overview
Analyzing Step 1 "See Real Revenue" against the skill quality checklist and tooltip audit requirements.

---

## SECTION 1: Market Grade Card
**Location**: Top of results

### Metrics Displayed:
1. **Market Grade**: "B" letter grade
2. **469 active listings** - count
3. **64% avg occupancy** - percentage
4. **$36,777 avg revenue** - dollar amount
5. **"What does this mean?"** - explanation paragraph

### Quality Checklist:
- [x] Has guiding question? YES - "What does this mean?" section
- [x] Plain English verdict? YES - "is a Decent Market"
- [x] Contextual comparisons? PARTIAL - mentions "Reasonable performance"
- [x] Clear verdict? YES - "Success depends on property quality and pricing strategy"
- [ ] Confidence indicators? NO - doesn't show "Based on X properties"
- [x] Visual hierarchy? YES - big letter grade, colored badge
- [x] Beginner-friendly? YES

### Tooltip Audit:
- [ ] "active listings" - NEEDS TOOLTIP - "Total number of Airbnb properties currently available in this market"
- [ ] "avg occupancy" - NEEDS TOOLTIP - "How often properties are booked. 64% means booked about 234 nights per year"
- [ ] "avg revenue" - NEEDS TOOLTIP - "Average yearly earnings before expenses for properties in this market"
- [x] "What does this mean?" - HAS EXPLANATION (inline, not tooltip)

---

## SECTION 2: Key Takeaways ("What should I know first about this market?")
**Location**: Below market grade

### Metrics Displayed:
1. **Top Earner**: 6+ Bedroom - $68,570/year avg
2. **Most Booked**: 1 Bedroom - 80% occupancy
3. **Market Size**: 469 active listings
4. **Avg Annual Revenue**: $36,777 - All property types
5. **Avg Nightly Rate**: $157 - Market average ADR
6. **Avg Occupancy**: 64% - Market average
7. **Active Listings**: 469 - All types in market

### Quality Checklist:
- [x] Has guiding question? YES - "What should I know first about this market?"
- [x] Plain English terminology? PARTIAL - "ADR" mentioned (jargon)
- [ ] Contextual comparisons? NO - just raw numbers
- [ ] Clear verdict/recommendation? NO - just data display
- [ ] Confidence indicators? NO
- [x] Visual hierarchy? YES - icons, bold numbers

### Tooltip Audit:
- [ ] "Top Earner" - NEEDS TOOLTIP - "The bedroom type that earns the most money on average"
- [ ] "Most Booked" - NEEDS TOOLTIP - "The bedroom type with the highest occupancy (most nights booked)"
- [ ] "Market Size" - NEEDS TOOLTIP - "Total number of active short-term rentals competing in this area"
- [ ] "Avg Annual Revenue" - NEEDS TOOLTIP - "Average yearly income before expenses"
- [ ] "Avg Nightly Rate" - NEEDS TOOLTIP - "Average price hosts charge per night"
- [ ] "ADR" - NEEDS TOOLTIP OR REMOVAL - Technical jargon, replace with "Nightly Rate"
- [ ] "Avg Occupancy" - NEEDS TOOLTIP - "Percentage of nights booked per year. Higher is better"
- [ ] "$68,570/year avg" - NEEDS CONTEXT - "This is before expenses"

---

## SECTION 3: Property Types Breakdown ("Which property types earn the most?")
**Location**: Below key takeaways

### Metrics Displayed (per bedroom type):
- Studio: $18,340 Revenue/yr, 61% Occupancy, 6 listings
- 1 Bedroom: $34,891 Revenue/yr, 80% Occupancy, 181 listings
- 2 Bedroom: $38,966 Revenue/yr, 70% Occupancy, 143 listings
- 3 Bedroom: $46,322 Revenue/yr, 58% Occupancy, 77 listings
- 4 Bedroom: $61,305 Revenue/yr, 60% Occupancy, 38 listings
- 5 Bedroom: $42,135 Revenue/yr, 51% Occupancy, 9 listings
- 6+ Bedroom: $68,570 Revenue/yr, 62% Occupancy, 15 listings

### "What This Data Shows" Verdict:
- Highest Revenue: 6+ Bedroom properties average $68,570/year
- Highest Demand: 1 Bedroom properties have 80% occupancy
- Most Common: 1 Bedroom has 181 active listings (39% of market)
- "Based on 469 active short-term rentals in this market"

### Quality Checklist:
- [x] Has guiding question? YES - "Which property types earn the most?"
- [x] Plain English terminology? YES
- [x] Contextual comparisons? YES - "39% of market"
- [x] Clear verdict? YES - "What This Data Shows" section
- [x] Confidence indicators? YES - "Based on 469 active short-term rentals"
- [x] Visual hierarchy? YES - cards with icons

### Tooltip Audit:
- [ ] "Revenue/yr" - NEEDS TOOLTIP - "Average yearly income before expenses for this property type"
- [ ] "Occupancy" - NEEDS TOOLTIP - "Percentage of nights booked. Higher means more consistent bookings"
- [ ] "X listings" - NEEDS TOOLTIP - "Number of this property type competing in the market"

---

## SECTION 4: Monthly Earnings Pattern
**Location**: Below property types

### Metrics Displayed:
- Monthly occupancy percentages (Jan-Dec)
- Monthly nightly rates (Jan-Dec)
- "Avg: 64%" and "Avg: $155" reference lines
- Color coding: Green = above average, Amber = below average

### Quality Checklist:
- [x] Has guiding question? YES - "See which months earn the most (and least)"
- [x] Plain English terminology? YES - "How Often It's Booked Each Month"
- [x] Contextual comparisons? YES - above/below average color coding
- [ ] Clear verdict? PARTIAL - no summary of best/worst months
- [ ] Confidence indicators? NO
- [x] Visual hierarchy? YES - bar charts with colors

### Tooltip Audit:
- [x] Chart has legend explaining colors
- [ ] Individual month bars - NEED TOOLTIPS showing exact values on hover
- [ ] "12-month avg" - NEEDS TOOLTIP - "Average across all 12 months"

---

## SECTION 5: Market Trends ("Is this market growing or declining?")
**Location**: Below monthly pattern

### Metrics Displayed:
1. **Booking Rate**: 56% (-2.6% vs last year)
2. **Annual Income**: $2,293 (+2.8% vs last year)
3. **Nightly Rate**: $143 (+6.7% vs last year)
4. **Competition**: 3,667 (-1.2% vs last year)

### Quality Checklist:
- [x] Has guiding question? YES - "Is this market growing or declining?"
- [x] Plain English terminology? PARTIAL - "Booking Rate" vs "Occupancy" inconsistent
- [x] Contextual comparisons? YES - "vs last year"
- [ ] Clear verdict? NO - no summary of whether market is growing or declining
- [ ] Confidence indicators? NO
- [x] Visual hierarchy? YES - tabs, chart

### Tooltip Audit:
- [ ] "Booking Rate" - NEEDS TOOLTIP - "Same as occupancy - how often properties are booked"
- [ ] "Annual Income" - NEEDS TOOLTIP - "Average yearly revenue per listing" (NOTE: $2,293 seems wrong - should be monthly?)
- [ ] "-2.6% vs last year" - NEEDS TOOLTIP - "Occupancy dropped 2.6 percentage points compared to last year"
- [ ] "Competition" - NEEDS TOOLTIP - "Total number of listings in the broader market area"

### ISSUE FOUND:
- **Annual Income shows $2,293** - This seems incorrect. Should be ~$36,777 based on earlier data. May be showing monthly or a different metric.

---

## SECTION 6: Successful Properties ("What are successful properties doing?")
**Location**: Below market trends

### Metrics Displayed (per listing):
- Property name/title
- Bedroom/Bathroom/Guest count
- Property type (house, townhouse, apartment)
- "Top Host" badge
- Yearly Income
- Nightly Rate
- Booking Rate
- Rating (stars and review count)
- "View on Airbnb" link

### Quality Checklist:
- [x] Has guiding question? YES - "What are successful properties doing?"
- [x] Plain English terminology? YES
- [ ] Contextual comparisons? NO - no comparison to market average
- [ ] Clear verdict? NO - no summary of what successful properties have in common
- [ ] Confidence indicators? PARTIAL - shows "Showing 1-25 of 469"
- [x] Visual hierarchy? YES - cards with images

### Tooltip Audit:
- [ ] "Yearly Income" - NEEDS TOOLTIP - "Estimated annual revenue before expenses"
- [ ] "Nightly Rate" - NEEDS TOOLTIP - "Average price charged per night"
- [ ] "Booking Rate" - NEEDS TOOLTIP - "Percentage of nights booked per year"
- [ ] "Top Host" badge - NEEDS TOOLTIP - "Airbnb's recognition for hosts with excellent reviews and reliability"
- [ ] Rating "(62)" - NEEDS TOOLTIP - "Number of guest reviews"

---

## SUMMARY OF GAPS

### Missing Tooltips (CRITICAL - per skill guidelines):
1. All percentage values need tooltips explaining what they mean
2. All dollar amounts need tooltips clarifying "before expenses"
3. "ADR" jargon should be removed or explained
4. Listing counts need context
5. Year-over-year changes need explanation
6. "Top Host" badge needs explanation

### Missing Verdicts/Recommendations:
1. Monthly Pattern - no summary of best/worst months
2. Market Trends - no verdict on whether market is growing
3. Successful Properties - no summary of common success factors

### Data Issues:
1. **Annual Income in trends shows $2,293** - appears incorrect
2. Inconsistent terminology: "Booking Rate" vs "Occupancy"

### Missing Confidence Indicators:
1. Key Takeaways section - no "Based on X properties"
2. Monthly Pattern - no confidence note
3. Market Trends - no data source note

### Missing Contextual Comparisons:
1. Key Takeaways - just raw numbers, no context
2. Successful Properties - no comparison to market average

---

## PRIORITY FIXES

### HIGH PRIORITY (Skill Requirement):
1. Add tooltips to ALL metrics (mandatory per skill)
2. Fix "Annual Income $2,293" data issue (appears to be wrong metric)
3. Add verdict to Monthly Pattern section ("Best months: May-Jul, Slowest: Dec-Jan")
4. Add verdict to Market Trends section ("Market is stable/growing/declining")

### MEDIUM PRIORITY:
5. Add "Based on X properties" to Key Takeaways
6. Standardize "Booking Rate" vs "Occupancy" terminology (use "Booking Rate" consistently)
7. Add comparison to market average in Successful Properties ("This property earns 2x market average")

### LOW PRIORITY:
8. Add summary of success factors in Successful Properties ("Top earners have: X bedrooms, amenities, Superhost status")
9. Add contextual comparisons to Key Takeaways

---

## COMPARISON TO STEP 3 BENCHMARK

### Step 3 Patterns Present in Step 1:
- [x] Guiding questions for sections ("What should I know first?")
- [x] Letter grades (Market Grade: B)
- [x] Visual hierarchy (big numbers, colored badges)
- [x] Confidence indicators in Property Types ("Based on 469 active short-term rentals")
- [x] Color coding (green/amber for above/below average)

### Step 3 Patterns MISSING in Step 1:
- [ ] **Tooltips on ALL metrics** - Step 3 has info bubbles everywhere; Step 1 has almost none
- [ ] **Plain English verdicts everywhere** - Step 3 says "This Property Cash Flows"; Step 1 just shows numbers
- [ ] **Contextual comparisons** - Step 3 compares to S&P 500, savings accounts; Step 1 just shows raw numbers
- [ ] **"What it means for you" framing** - Step 3 frames data as answers; Step 1 just displays data
- [ ] **Progressive disclosure** - Step 3 has expandable sections; Step 1 shows everything at once

### Specific Gaps vs Step 3:

| Step 3 Feature | Step 1 Status | Fix Needed |
|----------------|---------------|------------|
| Info bubbles on every metric | Missing | Add tooltips |
| "You could earn $X/year" framing | Missing | Reframe numbers |
| Comparison to familiar things | Missing | Add "That's $X/month" |
| Break-even analysis | N/A | Not applicable |
| Confidence notes ("Based on X") | Partial | Add to all sections |
| Letter grades | Present | OK |
| Color coding | Present | OK |
| Guiding questions | Present | OK |

---

## TOOLTIP AUDIT RESULTS

### Metrics Needing Tooltips (MANDATORY):

| Metric | Tooltip Text Needed |
|--------|--------------------|
| active listings | "Total number of Airbnb properties currently competing in this market" |
| avg occupancy | "How often properties are booked. 64% means booked about 234 nights per year" |
| avg revenue | "Average yearly earnings before expenses for properties in this market" |
| Top Earner | "The bedroom type that earns the most money on average in this market" |
| Most Booked | "The bedroom type with the highest occupancy (most nights booked per year)" |
| Market Size | "Total number of active short-term rentals competing in this area" |
| Avg Nightly Rate | "Average price hosts charge per night. Also called ADR (Average Daily Rate)" |
| Revenue/yr | "Estimated annual income before expenses for this property type" |
| Occupancy | "Percentage of nights booked per year. Higher means more consistent bookings" |
| X listings | "Number of this property type competing in the market" |
| Booking Rate | "Same as occupancy - percentage of nights booked per year" |
| Annual Income | "Average yearly revenue per listing in the market" |
| Competition | "Total number of listings in the broader market area" |
| Top Host badge | "Airbnb's recognition for hosts with excellent reviews and reliability" |
| Rating (62) | "Number of guest reviews this property has received" |

---

## RECOMMENDED ACTION PLAN

### Phase 1: Critical Fixes (Do First)
1. Add tooltips to ALL metrics listed above
2. Fix the "Annual Income $2,293" display issue
3. Standardize terminology (Booking Rate vs Occupancy)

### Phase 2: Verdict Additions
4. Add verdict to Monthly Pattern: "Best months: [X], Slowest: [Y]"
5. Add verdict to Market Trends: "This market is [growing/stable/declining]"
6. Add success factors summary to Successful Properties

### Phase 3: Contextual Improvements
7. Add "That's $X/month" context to revenue figures
8. Add "Based on X properties" to all sections
9. Add comparison to market average in Successful Properties listings

### Phase 4: Framing Improvements
10. Reframe data as answers: "Hosts here earn $X/year" instead of just "$X"
11. Add "What this means for you" summaries

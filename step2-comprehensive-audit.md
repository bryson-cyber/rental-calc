# Step 2 "Explore Listings" Comprehensive Audit

Based on bnb-lead-magnet-dev skill guidelines

## Quality Checklist (from SKILL.md)

### Already Implemented
- [x] Guiding question: "What properties are succeeding here?"
- [x] Verdict section: "What This Data Shows" with TOP EARNER, MOST BOOKED, AVG REVENUE, AVG BOOKING RATE
- [x] Confidence indicators: "Based on X active Airbnb properties"
- [x] PropertyCard tooltips for: Annual Revenue, Nightly Rate, Booking Rate, Avg Daily Earnings, Rating
- [x] Filter section guiding question: "How can I narrow down my search?"

### Missing Items (Need to Implement)

#### 1. Verdict Section Tooltips
The verdict cards (TOP EARNER, MOST BOOKED, AVG REVENUE, AVG BOOKING RATE) need InfoTooltips explaining:
- TOP EARNER: "The highest-earning property in this search. Shows what's possible in this market."
- MOST BOOKED: "The property with the highest booking rate. High demand means consistent income."
- AVG REVENUE: "The average annual income across all properties shown. Use this as your baseline expectation."
- AVG BOOKING RATE: "How often properties are booked on average. Higher means more consistent income."

#### 2. Letter Grades (Step 3 Pattern)
Step 3 uses letter grades (A+, B+, C) for quick understanding. Step 2 should add:
- Market demand grade based on avg booking rate
- Revenue potential grade based on avg revenue vs market average

#### 3. Contextual Comparisons
Step 3 compares to familiar things (S&P 500, savings accounts). Step 2 should add:
- Compare avg revenue to median household income
- Compare booking rate to hotel industry average
- Compare to long-term rental income potential

#### 4. Progressive Disclosure
Step 3 shows summary first, details on expand. Step 2 could:
- Collapse advanced filters by default
- Show "Quick Stats" summary before full property list
- Add "Show More Details" option on property cards

#### 5. Chart/Graph Tooltips
If any charts are shown, they need axis explanations:
- X-axis meaning
- Y-axis meaning
- What the trend indicates

#### 6. Property Card Enhancements
- Add "Reviews" count with tooltip: "Number of guest reviews. More reviews = more established property"
- Add distance indicator with tooltip: "Distance from your search location"
- Add property type badge with tooltip

#### 7. Filter Section Tooltips
Each filter option needs explanation:
- Bedroom filter: "Filter by number of bedrooms. More bedrooms = higher revenue potential but also higher costs"
- Minimum Revenue filter: "Only show properties earning at least this amount"
- Minimum Rating filter: "Only show properties with this rating or higher"

#### 8. Empty State Messaging
When no results found, provide helpful guidance:
- "No properties match your filters. Try adjusting your criteria."
- Suggest which filter to relax

#### 9. Data Freshness Indicator
Show when data was last updated:
- "Data updated: January 2026"
- Tooltip: "Market data is refreshed monthly from active Airbnb listings"

## Terminology Audit

| Current Term | Should Be |
|--------------|-----------|
| Annual Revenue | Annual Revenue (OK) |
| Nightly Rate | Nightly Rate (OK - was ADR) |
| Booking Rate | Booking Rate (OK - was Occupancy) |
| Avg Daily Earnings | Average Daily Earnings (OK) |

## Action Items Priority

1. HIGH: Add tooltips to verdict section cards
2. HIGH: Add letter grades for market demand
3. MEDIUM: Add contextual comparisons (vs household income)
4. MEDIUM: Add tooltips to filter options
5. LOW: Add data freshness indicator
6. LOW: Improve empty state messaging

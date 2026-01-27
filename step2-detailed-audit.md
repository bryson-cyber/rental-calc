# Step 2 "Explore Listings" Detailed Audit

## Current State (from browser inspection)

### Section: "Here's What's Making Money"
- Title: "Here's What's Making Money"
- Subtitle: "Real Airbnb properties near St. Louis, Missouri, USA"

### Verdict Section: "What This Data Shows"
Currently shows 4 cards:
1. **TOP EARNER** - $195,362/yr - "5BR Stunning Penthouse w..." - HAS TOOLTIP (i icon visible)
2. **MOST BOOKED** - 89% booked - "Soulard's Best..." - HAS TOOLTIP (i icon visible)
3. **AVG REVENUE** - $77,496/yr - "across 24 properties" - HAS TOOLTIP (i icon visible)
4. **AVG BOOKING RATE** - 56% - "Moderate demand" - HAS TOOLTIP (i icon visible)

Confidence note: "Based on 24 active Airbnb properties within your search area"

### Filter Section: "Filter & Sort"
Has guiding question: "How can I narrow down my search?"

Filters available:
- SORT BY: Most Revenue (dropdown)
- PROPERTY TYPE: All Types (dropdown)
- MIN RATING: Any Rating (dropdown)
- MIN BOOKING RATE: Any Booking Rate (dropdown)
- MIN REVENUE: Any Revenue (dropdown)
- HOST TYPE: All Hosts (button)
- View toggle: List View / Map View

### Property Cards
Each card shows:
- Rank badge (#1, #2, etc.)
- Property type (Condominium, House)
- Rating with reviews count (5.0 (18))
- Title: "5BR Stunning Penthouse w/ Rooftop Pool & Hot Tub"
- Beds/Baths: 5 bed, 6.5 bath
- **Annual Revenue** - $195,362 - HAS TOOLTIP (i icon visible)
- **Nightly Rate** - $1,028 - HAS TOOLTIP (i icon visible)
- **Booking Rate** - (need to scroll to see)
- **Avg Daily Earnings** - (need to scroll to see)
- View Listing link
- Analyze button
- Save button

## TOOLTIP AUDIT CHECKLIST

### Verdict Section Cards - NEED VERIFICATION
- [ ] TOP EARNER tooltip content - does it explain what this means for beginners?
- [ ] MOST BOOKED tooltip content - does it explain booking rate significance?
- [ ] AVG REVENUE tooltip content - does it explain this is the baseline expectation?
- [ ] AVG BOOKING RATE tooltip content - does it explain 56% means moderate demand?

### Filter Section - MISSING TOOLTIPS
- [ ] SORT BY - needs tooltip explaining sorting options
- [ ] PROPERTY TYPE - needs tooltip explaining Entire Home vs Private Room
- [ ] MIN RATING - needs tooltip explaining rating significance
- [ ] MIN BOOKING RATE - needs tooltip explaining what booking rate means
- [ ] MIN REVENUE - needs tooltip explaining revenue thresholds
- [ ] HOST TYPE - needs tooltip explaining Superhost vs regular

### Property Card Metrics - HAVE TOOLTIPS (verify content)
- [x] Annual Revenue - has (i) icon
- [x] Nightly Rate - has (i) icon
- [ ] Booking Rate - need to verify
- [ ] Avg Daily Earnings - need to verify
- [ ] Rating - needs tooltip explaining what makes a good rating

### Missing Elements (compared to Step 3)

1. **Letter Grades** - Step 3 uses A+, B+, C grades. Step 2 should add:
   - Market demand grade based on 56% avg booking rate
   - Revenue potential grade based on avg revenue

2. **Contextual Comparisons** - Step 3 compares to S&P 500, savings accounts. Step 2 should add:
   - Compare avg revenue to median household income
   - Compare booking rate to hotel industry average (~65%)
   - "56% booking rate = about 204 nights booked per year"

3. **Property Card Enhancements**:
   - Distance from search location
   - Property type explanation
   - "Why this property ranks #1" explanation

4. **Empty State** - What happens when no results found?

5. **Data Freshness** - When was this data last updated?

## PRIORITY FIXES

### HIGH PRIORITY
1. Add letter grade to verdict section (e.g., "B+ Market Demand")
2. Add contextual comparison to AVG BOOKING RATE ("That's about 204 nights/year")
3. Verify all tooltip content is beginner-friendly

### MEDIUM PRIORITY
4. Add tooltips to all filter options
5. Add "Why #1?" explanation on top property
6. Add data freshness indicator

### LOW PRIORITY
7. Add distance indicator to property cards
8. Improve empty state messaging

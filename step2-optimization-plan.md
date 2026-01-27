# Step 2 Optimization Plan - Following bnb-lead-magnet-dev Skill

## Current State Assessment

Based on browser inspection and code review, Step 2 "Explore Listings" currently has:

### What's Working
- "What This Data Shows" verdict section with TOP EARNER, MOST BOOKED, AVG REVENUE, AVG BOOKING RATE
- Tooltips on verdict cards (InfoTooltip component)
- Filter section with guiding question "How can I narrow down my search?"
- PropertyCard component with tooltips on Annual Revenue, Nightly Rate, Booking Rate, Avg Daily Earnings
- Confidence note "Based on X active Airbnb properties within your search area"

### Missing (Per Skill Checklist)

1. **Letter Grades** - Step 3 has A+, B+, C grades. Step 2 needs:
   - Market demand grade based on avg booking rate
   - Overall opportunity grade

2. **Contextual Comparisons** - Step 3 compares to S&P 500, savings. Step 2 needs:
   - "56% booking rate = about 204 nights booked per year"
   - Compare avg revenue to median household income
   - "Top earner makes 2.5x the average"

3. **Filter Tooltips** - All filter dropdowns need tooltips:
   - SORT BY - explain sorting options
   - PROPERTY TYPE - explain Entire Home vs Private Room
   - MIN RATING - explain rating significance
   - MIN BOOKING RATE - explain booking rate thresholds
   - MIN REVENUE - explain revenue thresholds
   - HOST TYPE (Superhost) - explain what Superhost means

4. **Property Card Enhancements**:
   - "Why #1?" explanation on top property
   - Rating tooltip explaining what makes a good rating

5. **Section Guiding Questions** - Need more prominent questions:
   - Main section: "What properties are succeeding here?"
   - Verdict section: "What can I learn from the top performers?"
   - Filter section: Already has "How can I narrow down my search?" ✓

## Implementation Tasks

### Task 1: Add Letter Grade to Verdict Section
Add a market opportunity grade (A-F) based on:
- Avg booking rate (50%+ = good)
- Avg revenue vs national average
- Number of properties (sample size)

### Task 2: Add Contextual Comparisons
- Convert booking rate to nights per year
- Compare top earner to average ("2.5x the average")
- Add "What this means" explanation

### Task 3: Add Filter Tooltips
Add InfoTooltip to each filter label explaining the option

### Task 4: Add Rating Tooltip to PropertyCard
Explain what 4.5+ vs 4.9+ rating means for success

### Task 5: Add "Why #1?" Badge
Show what makes the top property successful

### Task 6: Verify All Existing Tooltips
Ensure tooltip content is beginner-friendly (no jargon)

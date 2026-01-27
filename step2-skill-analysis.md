# Step 2 "Explore Listings" Skill Analysis

**Date:** Jan 26, 2026
**URL:** https://coachinayahturnkeytool.com/
**Test Location:** St. Louis, Missouri, USA

## Current Step 2 UI Elements

### Header Section
- Title: "Here's What's Making Money"
- Subtitle: "Real Airbnb properties near St. Louis, Missouri, USA"

### Filter & Sort Section
- SORT BY: Most Revenue, Highest Booking Rate, Best Rating, Highest Avg Daily Earnings
- PROPERTY TYPE: All Types, Entire Home, Private Room, Shared Room
- MIN RATING: Any Rating, 4.5+ Stars, 4.7+ Stars, 4.9+ Stars
- MIN BOOKING RATE: Any Booking Rate, 50%+ Booked, 70%+ Booked, 85%+ Booked
- MIN REVENUE: Any Revenue, $30K+/year, $50K+/year, $75K+/year, $100K+/year
- HOST TYPE: All Hosts
- View Toggle: List View / Map View

### Property Cards Display
Each card shows:
- Rank number (#1, #2, etc.)
- Property type icon (Condominium, House, Townhouse)
- Star rating with review count (e.g., 5.0 (18))
- Property title
- Bed count + Bath count
- **Annual Revenue** (green badge) - e.g., $195,362
- **Daily Rate** (yellow badge) - e.g., $1,028
- **Booking Rate** (pink badge) - e.g., 55%
- **Avg Daily Earnings** (purple badge) - e.g., $568
- View Listing button
- Analyze button
- Save button (bookmark icon)

## Skill Compliance Gaps

### 1. Missing Tooltips (CRITICAL)
The following metrics need tooltips:
- [ ] **Annual Revenue** - What does this include? Is it gross or net?
- [ ] **Daily Rate** - Is this the nightly rate or something else?
- [ ] **Booking Rate** - How is this calculated? What's a good rate?
- [ ] **Avg Daily Earnings** - How is this different from Daily Rate?
- [ ] **Star Rating** - What does this rating represent?
- [ ] **Review Count** - Why does this matter?

### 2. Missing Guiding Questions
- [ ] No guiding question for the results section
- [ ] No guiding question for filters
- [ ] No explanation of what "succeeding" means

### 3. Missing Verdicts/Insights
- [ ] No verdict section explaining what the data means
- [ ] No "What This Data Shows" summary
- [ ] No comparison to market averages
- [ ] No "Top Performer" insights

### 4. Missing Confidence Indicators
- [ ] No "Based on X properties" note
- [ ] No data freshness indicator
- [ ] No explanation of ranking methodology

### 5. Terminology Issues
- [x] "Booking Rate" used correctly (not "Occupancy")
- [ ] "Avg Daily Earnings" - needs explanation (RevPAR?)
- [ ] "Daily Rate" - should be "Nightly Rate" for consistency

## Recommended Improvements

### Priority 1: Add Tooltips
Add InfoTooltip to each metric in property cards:
1. **Annual Revenue**: "Total yearly earnings from this property before expenses. Higher is better."
2. **Daily Rate**: "The average price per night this property charges. Also called 'Nightly Rate'."
3. **Booking Rate**: "How often this property is booked. 55% means guests about 200 nights/year."
4. **Avg Daily Earnings**: "Average earnings per night including vacant nights. Calculated as (Annual Revenue ÷ 365)."
5. **Star Rating**: "Guest satisfaction rating from 1-5 stars. Higher ratings attract more bookings."
6. **Review Count**: "Number of guest reviews. More reviews = more credibility and booking potential."

### Priority 2: Add Guiding Questions
Add section headers with questions:
- "Which properties are earning the most?" (for results)
- "How can I narrow down my search?" (for filters)

### Priority 3: Add Verdict Section
Add a summary card at the top of results:
- "Top Earner: [Property Name] - $X/year"
- "Most Booked: [Property Name] - X% booking rate"
- "Average in this area: $X/year"
- "Based on X active properties within Y radius"

### Priority 4: Standardize Terminology
- Change "Daily Rate" to "Nightly Rate" for consistency with Step 1
- Add explanation for "Avg Daily Earnings" (this is RevPAR)

## Files to Modify

1. **client/src/pages/Step2ExploreListing.tsx** (or similar) - Main Step 2 component
2. **client/src/components/PropertyCard.tsx** (if exists) - Property card component
3. **server/api/routers/listings.ts** (if exists) - Backend API for listings

## Implementation Checklist

- [ ] Add InfoTooltip to Annual Revenue
- [ ] Add InfoTooltip to Daily Rate (rename to Nightly Rate)
- [ ] Add InfoTooltip to Booking Rate
- [ ] Add InfoTooltip to Avg Daily Earnings
- [ ] Add InfoTooltip to Star Rating
- [ ] Add InfoTooltip to Review Count
- [ ] Add guiding question header to results section
- [ ] Add verdict/summary section at top of results
- [ ] Add confidence indicator ("Based on X properties")
- [ ] Standardize terminology (Daily Rate → Nightly Rate)
- [ ] Browser test all changes
- [ ] Verify no emojis in UI

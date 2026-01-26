# Glendale, Arizona - Data Issues Analysis

## Current State (Jan 26, 2026)

### Market Verdict Card
- Shows: **C+** grade
- Text: "Below-average metrics. May require exceptional property or strategy to succeed."
- Stats: 1,108 active listings, 57% avg occupancy, $38,648 avg revenue
- **BUG:** "This grade is based on the market's overall health score of 0/100" - score is 0!

### Quick Insights
- Top Earner: 4 Bedroom - $89,374/year avg
- Most Booked: 3 Bedroom - 78% occupancy
- Market Size: 1,108 active listings

### Summary Cards
- Avg Annual Revenue: $38,648 (All property types)
- Avg Nightly Rate: $187 (Market average ADR)
- Avg Occupancy: 57% (Market average)
- Active Listings: 1,108 (All types in market)

### Revenue by Property Type - THE BUG
- **1 Bedroom: "Limited data available"** - BUT summary shows data!
- **2 Bedroom: "Limited data available"** - BUT summary shows data!
- 3 Bedroom: $85,220 Revenue/yr, 78% Occupancy, 12 listings
- 4 Bedroom: $89,374 Revenue/yr, 71% Occupancy, 14 listings
- 5 Bedroom: $79,990 Revenue/yr (visible)

## Root Cause Analysis

### Issue 1: Market Score is 0
The market health score from AirDNA is returning 0 or undefined for Glendale.
This causes the grade calculation to show "0/100" in the explanation text.

### Issue 2: 1BR and 2BR Show "Limited data"
The bedroomBreakdown is calculated from `allListings` which is a sampled subset.
For Glendale (1,108 total listings), we're only fetching ~350-500 listings.
If those sampled listings don't include enough 1BR/2BR properties, they show as "Limited data".

**Evidence from screenshot:**
- Summary cards show 1,108 listings total
- But 3BR only shows 12 listings, 4BR shows 14 listings
- This means we're only getting ~50 listings in the sample that have bedroom data

### Issue 3: Comp Data Count
Need to verify if comp data shows 300 instead of 1,108.

## Fixes Needed

1. **Fix market score display** - When score is 0 or undefined, don't show "0/100"
2. **Fix bedroom breakdown** - Use market-level bedroom stats from AirDNA API instead of calculating from sampled listings
3. **Add encouraging message for challenging markets** - "Even in challenging markets, great opportunities exist. Focus on finding properties that stand out."

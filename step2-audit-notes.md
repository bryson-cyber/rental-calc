# Step 2 (Explore Listings) Audit Notes

## Current State
- Shows "22 Opportunities Found" for Denver, CO
- Displays listing cards with key metrics

## Metrics Displayed Per Listing
1. Property Type (House, Cottage, Vacation_home)
2. Rating (e.g., 5.0) with review count (e.g., 31)
3. Title/Name
4. Beds and Baths
5. Annual Revenue (e.g., $100,752)
6. Daily Rate (e.g., $618)
7. Occupancy (e.g., 50%)
8. RevPAR (e.g., $308)

## Filter Options Available
- Sort By: Most Revenue, Highest Occupancy, Best Rating, Highest RevPAR
- Property Type: All Types, Entire Home, Private Room, Shared Room
- Min Rating: Any Rating, 4.5+ Stars, 4.7+ Stars, 4.9+ Stars
- Min Occupancy: Any Occupancy, 50%+ Booked, 70%+ Booked, 85%+ Booked

## Issues Found

### Issue 1: Location Mismatch
- Searched for "Denver, CO" but results show Lake Hartwell properties (South Carolina)
- "Lake Life Retreat", "Lake Time on Lake Hartwell!", "Clemson/Anderson Lake Hartwell"
- This is a CRITICAL bug - the search is returning wrong location data

### Issue 2: Missing "Avg" Labels
- Revenue, Daily Rate, Occupancy, RevPAR don't indicate these are averages or estimates
- Should clarify data source (e.g., "Avg Annual Revenue" or "Est. Annual Revenue")

### Issue 3: No Bedroom Filtering Applied
- The "Beds" dropdown in search form exists but results show mixed bedroom counts
- When user selects "2 Bedrooms", results should only show 2BR properties

### Issue 4: Missing Data Freshness Indicator
- No indication of when this data was collected
- Should add "Data as of Jan 2026" like in Step 3

### Issue 5: No Comparison Context
- Hard to know if $100K revenue is good or bad for this market
- Could add market average comparison or percentile ranking

## Recommendations
1. FIX CRITICAL: Debug why Denver search returns Lake Hartwell results
2. Add "Avg" or "Est." prefix to revenue metrics
3. Ensure bedroom filter is properly applied to results
4. Add data freshness indicator
5. Consider adding market context (e.g., "Top 10% in this market")

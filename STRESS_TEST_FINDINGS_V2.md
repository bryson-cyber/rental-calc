# Stress Test Findings V2 - St. Louis Property

## Test Property
- Address: 4461 Gannett St, Saint Louis, MO, USA
- Monthly Rent: $1,295
- Bedrooms: 2
- Bathrooms: 1

## Key Metrics Displayed
- Projected Revenue: $32,480/year
- Monthly Profit: $632 after expenses
- Market Occupancy: 64% average
- Break-even: 12.0 mo (properly formatted!)

## Bugs Fixed (Verified Working)
1. ✅ Break-even formatting - Shows "12.0 mo" not raw float
2. ✅ Occupancy values - Shows 64%, 76%, 47.7% (no more 7135% bug)
3. ✅ Qualification rate - Shows "100% of 49 similar properties"

## Bugs Still Present
1. ❌ **Competitor count mismatch** - "Your Competition (4 similar properties)" but "49 similar properties" in qualification rate
2. ❌ **Active Listings discrepancy** - Market Intelligence shows "4 active listings" but should show more
3. ❌ **Startup Costs section still exists** - Should be removed per user request

## Data Discrepancies
- Qualification rate: 49 similar properties
- Your Competition: 4 similar properties
- Active Listings: 4
- Direct competitors: 25 same-bedroom listings within 1km

These numbers don't add up - need to investigate data sources.

## Next Steps
1. Fix competitor count to show 10 properties
2. Remove Startup Costs section entirely
3. Reconcile the listing count discrepancies

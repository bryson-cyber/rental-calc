# Issues to Fix - Property Report

## 1. Supply Trend Chart - Empty
- Chart shows month labels but no bars
- Current value shows 1,688 listings
- 12-Month Change shows 0%
- Need to check if monthly_data is being returned correctly

## 2. Forward-Looking Demand - Grayed Out
- Next 30 Days shows 35% with "Cold Market"
- Next 180 Days shows 18% with "Cold Market"
- Detailed Metrics show $0/0 values
- Need to check if avgAdr, avgSupply, avgDemand are being populated

## 3. Multi-Year Trends - Active Listings = 0
- Occupancy: 46% (-14.6%)
- Avg Revenue: $2,424 (-3.5%)
- Avg Daily Rate: $164 (+9.3%)
- Active Listings: 0 (0%) - THIS IS WRONG
- Need to check getHistoricalData API for active_listings_count

## 4. Seasonal Forecast Alignment
- Avg Occupancy 64% text not aligned with other stats
- Need to check CSS styling

## 5. Best/Slow Months Percentages
- Best Months showing DOWN arrows (red) with percentages like ↓102.6%, ↓86.5%
- This is confusing - should show UP arrows for best months
- The percentages represent deviation from average, not YoY change
- Need to fix the display logic

## 6. Cash Flow Section - Dark Mode
- "This Property Cash Flows" section uses dark navy background
- Rest of page is light mode
- Need to change to light mode styling

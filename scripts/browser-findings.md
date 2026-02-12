# Browser Findings - Seasonality Chart Check

## Monthly Revenue History & Forecast Chart
- Shows Timeline / Year-over-Year toggle buttons
- Legend: Historical (gray), Forecast (gold), Occupancy (line)
- X-axis shows: Feb '24, May '24, Aug '24, Nov '24, Feb '25, May '25, Aug '25, Nov '25, Feb '26, May '26, Aug '26, Nov '26
- Y-axis left: $0k to $12k
- Y-axis right: 0% to 100%
- Has "Forecast →" label at the boundary
- Historical bars appear very small/flat (gray), forecast bars (gold) are visible near the end
- Occupancy line is visible

## Issue spotted:
- The historical bars appear VERY small compared to the forecast bars
- This could be a data issue - need to check if historical revenue data is actually populated
- The bars for Feb '24 through Jan '26 look almost flat/zero

## Need to scroll down to see:
- Seasonality Pattern chart
- Peak/Slowest month labels

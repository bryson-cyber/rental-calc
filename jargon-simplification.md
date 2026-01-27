# Jargon Simplification Mapping

## Goal
Simplify all technical terms to 5th grade reading level, making the tool accessible to complete beginners.

## Term Mapping

| Current Term | Simplified Term | Explanation for Tooltips |
|-------------|-----------------|-------------------------|
| ADR (Average Daily Rate) | Nightly Rate | How much you charge per night |
| Occupancy | Booking Rate | How often your place is booked (out of 100%) |
| Revenue | Earnings / Income | Money you make |
| Historical Seasonality | Monthly Earnings Pattern | How much you earn each month of the year |
| Seasonality | Busy vs Slow Months | Some months are busier than others |
| Revenue Distribution | What Hosts Actually Earn | The range of money hosts make |
| Competition Landscape | Your Competition | Other rentals you're competing with |
| Investability | Profit Potential | How much money you could make |
| Rental Demand | Guest Interest | How many people want to book here |
| Revenue Growth | Earnings Trend | Is this market making more or less money over time? |
| Regulation | Local Rules | Laws about short-term rentals in this area |
| Superhost | Top-Rated Host | Hosts with excellent reviews and track record |
| Professional Management | Property Managers | Companies that manage rentals for owners |
| RevPAR | Revenue Per Night Available | Average earnings per night (including empty nights) |
| YoY (Year over Year) | Compared to Last Year | How things changed from last year |
| Percentile | Ranking | Where you fall compared to others |
| Median | Middle / Typical | The middle value (half earn more, half earn less) |
| Comps / Comparables | Similar Properties | Properties like yours to compare against |
| Lead Time | Booking Window | How far ahead guests book |
| Length of Stay | Trip Length | How many nights guests typically stay |

## Components to Update

### LeadMagnet.tsx
- [ ] "Historical Seasonality" → "Monthly Earnings Pattern"
- [ ] "Avg Occupancy by Month" → "How Often It's Booked Each Month"
- [ ] "Avg Nightly Rate by Month" → "Nightly Rate Each Month"

### TeslaDashboard.tsx
- [ ] "Seasonality Swing" → "Busy vs Slow Month Difference"
- [ ] "Seasonality Score" → "Income Stability"

### StandaloneMarketAdvisor.tsx
- [ ] "Seasonality" → "Income Stability"
- [ ] "Rental Demand" → "Guest Interest"
- [ ] "Revenue Growth" → "Earnings Trend"
- [ ] "Investability" → "Profit Potential"

### SharedMarketReport.tsx
- [ ] "Seasonality" section → "Busy vs Slow Months"

### HistoricalCharts.tsx
- [ ] Chart labels and tooltips

### CompDataTable.tsx
- [ ] Column headers and tooltips

## Implementation Priority
1. **High Impact**: Section headers and guiding questions (already done)
2. **Medium Impact**: Chart labels and axis titles
3. **Lower Impact**: Tooltips and detailed explanations

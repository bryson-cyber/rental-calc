# Test Results for Zip Code 63104 - Property Type Breakdown

## Test Date: Jan 26, 2026

## Market Overview
- **Location**: Soulard, Missouri (63104)
- **Active Listings**: 469
- **Avg Occupancy**: 64%
- **Avg Revenue**: $36,777

## Property Type Breakdown (NOW SHOWING ALL TYPES!)

| Type | Revenue/yr | Occupancy | Listings |
|------|-----------|-----------|----------|
| Studio | $80,886 | 60% | 469 |
| 1 Bedroom | $34,891 | 80% | 181 |
| 2 Bedroom | $38,966 | 70% | 143 |
| 3 Bedroom | $46,322 | 58% | 77 |
| 4 Bedroom | $61,305 | 60% | 38 |
| 5 Bedroom | $42,135 | 51% | 9 |
| 6+ Bedroom | $68,570 | 62% | 15 |

**Total from breakdown**: 469 + 181 + 143 + 77 + 38 + 9 + 15 = **932 listings**

## Data-Driven Insight Summary (NEW FEATURE!)
- **Highest Revenue**: Studio properties average $80,886/year
- **Highest Demand**: 1 Bedroom properties have 80% occupancy
- **Most Common**: Studio has 469 active listings (50% of market)
- Based on 932 active short-term rentals in this market

## ISSUE IDENTIFIED
The "Active Listings: 469" shown at the top doesn't match the total from the bedroom breakdown (932).

This is because:
1. The "469 active listings" comes from the market overview (zip code level)
2. The bedroom breakdown is using the NEW `getBedroomCounts` function which queries each bedroom type separately
3. The API is returning counts that include the broader market area, not just the specific zip code

## NEXT STEPS
Need to investigate why Studio shows 469 listings (same as total market) - this seems incorrect.
The API might be returning market-level data instead of zip-specific data for bedroom counts.
